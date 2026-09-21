import { HURTBOX, MOVES, PHYSICS, PUSH_HALF_W, RULES, moveLength } from './frameData';
import type { Action, Box, InputState, MoveDef, MoveId, Stance } from './types';

export type Phase = 'startup' | 'active' | 'recovery';

/** A world-space rectangle, y measured upward from the floor line. */
export interface WorldBox {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export class Fighter {
  readonly index: number;
  name: string;

  /** Horizontal position of the pivot. */
  x = 0;
  /** Height of the pivot above the floor. 0 means grounded. */
  y = 0;
  vx = 0;
  vy = 0;

  facing: 1 | -1 = 1;
  action: Action = 'free';
  stance: Stance = 'stand';

  move: MoveDef | null = null;
  /** Ticks elapsed inside the current move. */
  moveTick = 0;
  /** The live window already connected, so it cannot hit twice. */
  moveConnected = false;

  /** Ticks remaining of hitstun / blockstun / knockdown / wake-up. */
  stunTimer = 0;
  /** Frozen frames on contact. Shared with the opponent. */
  hitstop = 0;
  invuln = 0;

  health: number = RULES.maxHealth;
  /**
   * Accumulated on hit and on block. Nothing spends it yet — it is the hook a
   * super move would use, and it is deliberately not shown in the HUD until
   * there is something to spend it on.
   */
  meter = 0;
  wins = 0;
  /** Arcade score. Carried across rounds, reset only between matches. */
  score = 0;

  blocking = false;
  comboCount = 0;
  /** Ticks since the combo counter last advanced, for display decay. */
  comboTimer = 0;

  /** Purely cosmetic: set on the tick a state change happens. */
  flash = 0;

  constructor(index: number, name: string) {
    this.index = index;
    this.name = name;
  }

  get grounded(): boolean {
    return this.y <= 0 && this.action !== 'knockdown';
  }

  get airborne(): boolean {
    return this.y > 0;
  }

  get defeated(): boolean {
    return this.health <= 0;
  }

  get phase(): Phase | null {
    if (this.action !== 'attack' || !this.move) return null;
    if (this.moveTick < this.move.startup) return 'startup';
    if (this.moveTick < this.move.startup + this.move.active) return 'active';
    return 'recovery';
  }

  /** 0..1 progress through the committed move, for the animation mapping. */
  get moveProgress(): number {
    if (!this.move) return 0;
    return Math.min(1, this.moveTick / moveLength(this.move));
  }

  /** Can accept a new action this tick. */
  get actionable(): boolean {
    return this.action === 'free';
  }

  resetForRound(x: number, facing: 1 | -1): void {
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.action = 'free';
    this.stance = 'stand';
    this.move = null;
    this.moveTick = 0;
    this.moveConnected = false;
    this.stunTimer = 0;
    this.hitstop = 0;
    this.invuln = 0;
    this.health = RULES.maxHealth;
    this.blocking = false;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.flash = 0;
  }

  startMove(id: MoveId): void {
    this.move = MOVES[id];
    this.action = 'attack';
    this.moveTick = 0;
    this.moveConnected = false;
    this.stance = this.airborne ? 'air' : 'stand';
    this.blocking = false;
  }

  /** Enter hitstun. `launch` lifts the fighter into a knockdown arc. */
  takeHit(damage: number, stun: number, kbx: number, kby: number, launch: boolean): void {
    this.health = Math.max(0, this.health - damage);
    this.move = null;
    this.moveConnected = false;
    this.blocking = false;
    this.vx = kbx;
    if (launch) {
      this.vy = kby;
      this.y = Math.max(this.y, 0.01);
      this.action = 'hitstun';
      this.stunTimer = stun;
    } else {
      this.action = 'hitstun';
      this.stunTimer = stun;
    }
    // Three ticks: one white frame, two warm. Long enough to register the
    // impact, short enough not to read as a glitch.
    this.flash = 3;
  }

  takeBlock(chip: number, stun: number, push: number): void {
    this.health = Math.max(0, this.health - chip);
    this.vx = push;
    this.action = 'blockstun';
    this.stunTimer = stun;
    this.meter = Math.min(RULES.maxMeter, this.meter + 2);
  }

  knockDown(): void {
    this.action = 'knockdown';
    this.stunTimer = PHYSICS.knockdownTicks;
    this.y = 0;
    this.vy = 0;
    this.vx *= 0.3;
    this.move = null;
  }

  /** World-space hurtbox for the current stance. */
  hurtbox(): WorldBox {
    const local =
      this.action === 'knockdown'
        ? { x: -54, y: 0, w: 108, h: 46 }
        : this.airborne
          ? HURTBOX.air
          : this.stance === 'crouch'
            ? HURTBOX.crouch
            : HURTBOX.stand;
    return this.toWorld(local);
  }

  /** World-space hitbox, or null when no strike is live. */
  hitbox(): WorldBox | null {
    if (this.phase !== 'active' || !this.move || this.moveConnected) return null;
    return this.toWorld(this.move.hitbox);
  }

  pushbox(): { left: number; right: number } {
    return { left: this.x - PUSH_HALF_W, right: this.x + PUSH_HALF_W };
  }

  toWorld(box: Box): WorldBox {
    const x1 = this.x + this.facing * box.x;
    const x2 = this.x + this.facing * (box.x + box.w);
    return {
      left: Math.min(x1, x2),
      right: Math.max(x1, x2),
      bottom: this.y + box.y,
      top: this.y + box.y + box.h,
    };
  }

  /** Centre of mass, used to place hit sparks and the camera. */
  centreY(): number {
    return this.y + (this.stance === 'crouch' && !this.airborne ? 40 : 62);
  }
}

export function overlaps(a: WorldBox, b: WorldBox): boolean {
  return a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;
}

/** Intersection centre, so a spark lands where the boxes actually meet. */
export function contactPoint(a: WorldBox, b: WorldBox): { x: number; y: number } {
  return {
    x: (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2,
    y: (Math.max(a.bottom, b.bottom) + Math.min(a.top, b.top)) / 2,
  };
}

/** True when the defender is holding away from the attacker. */
export function isHoldingBack(input: InputState, facing: 1 | -1): boolean {
  return facing === 1 ? input.left : input.right;
}
