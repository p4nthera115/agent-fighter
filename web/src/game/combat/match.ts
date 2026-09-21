import { STAGE_W, TICK_HZ } from '../constants';
import { MOVES, PHYSICS, PUSH_HALF_W, RULES, moveLength } from './frameData';
import { Fighter, contactPoint, isHoldingBack, overlaps } from './fighter';
import { ULTIMATES, ULTIMATE_COST, ULTIMATE_LENGTH, ultimateId } from './ultimates';
import type { UltimateState } from './ultimates';
import { SCORE } from '../score';
import type { CombatEvent, InputState, MoveId } from './types';

export type MatchPhase = 'intro' | 'fight' | 'roundEnd' | 'matchEnd';

const INTRO_TICKS = 96;
const ROUND_END_TICKS = 150;
const COMBO_DROP_TICKS = 40;

/** Priority order when several attack buttons are down on the same tick. */
const ATTACK_PRIORITY: MoveId[] = ['uppercut', 'kick', 'punch'];

/**
 * The whole match, as a deterministic state machine.
 *
 * `step` advances exactly one 60 Hz tick. Nothing here reads the clock, the
 * DOM, or the art, so the same inputs always produce the same match.
 */
export class Match {
  readonly fighters: [Fighter, Fighter];
  readonly events: CombatEvent[] = [];

  phase: MatchPhase = 'intro';
  phaseTimer = INTRO_TICKS;
  round = 1;
  tick = 0;

  /** Remaining round time, in ticks. */
  clock = RULES.roundTimeSeconds * TICK_HZ;

  /** Frozen frames shared by both fighters. Read by the renderer for shake. */
  hitstop = 0;
  /** Decays each tick; the renderer turns it into camera shake. */
  shake = 0;

  roundWinner: number | null = null;
  matchWinner: number | null = null;

  ultimate: UltimateState | null = null;
  private ultimateHeld = [false, false];

  constructor(nameA: string, nameB: string, readonly picks: readonly string[] = ['clawd', 'clawd']) {
    this.fighters = [new Fighter(0, nameA), new Fighter(1, nameB)];
    this.resetRound();
  }

  private resetRound(): void {
    this.ultimate = null;
    this.ultimateHeld = [false, false];
    const mid = STAGE_W / 2;
    const half = RULES.startSeparation / 2;
    this.fighters[0].resetForRound(mid - half, 1);
    this.fighters[1].resetForRound(mid + half, -1);
    this.fighters[0].meter = 0;
    this.fighters[1].meter = 0;
    this.clock = RULES.roundTimeSeconds * TICK_HZ;
    this.roundWinner = null;
    this.hitstop = 0;
    this.phase = 'intro';
    this.phaseTimer = INTRO_TICKS;
    this.emit({ type: 'roundStart', round: this.round });
  }

  restart(): void {
    this.round = 1;
    this.matchWinner = null;
    this.fighters[0].wins = 0;
    this.fighters[1].wins = 0;
    this.fighters[0].score = 0;
    this.fighters[1].score = 0;
    this.events.length = 0;
    this.resetRound();
  }

  private emit(event: CombatEvent): void {
    this.events.push(event);
  }

  /** Drain the queue. The renderer calls this once per rendered frame. */
  drainEvents(): CombatEvent[] {
    return this.events.splice(0, this.events.length);
  }

  step(inputs: [InputState, InputState]): void {
    const pressed = inputs.map((input, i) => input.ultimate && !this.ultimateHeld[i]);
    this.ultimateHeld = inputs.map(input => input.ultimate);
    this.tick += 1;
    if (this.ultimate) {
      this.advanceUltimate(inputs);
      return;
    }
    this.shake *= 0.86;
    if (this.shake < 0.05) this.shake = 0;

    // Hitstop freezes everything, including the round clock. It is what makes
    // a connected hit read as an impact rather than a position swap.
    if (this.hitstop > 0) {
      this.hitstop -= 1;
      for (const f of this.fighters) f.hitstop = this.hitstop;
      return;
    }

    for (const f of this.fighters) {
      if (f.flash > 0) f.flash -= 1;
      if (f.invuln > 0) f.invuln -= 1;
      if (f.comboTimer > 0) {
        f.comboTimer -= 1;
        if (f.comboTimer === 0) f.comboCount = 0;
      }
    }

    switch (this.phase) {
      case 'intro':
        this.phaseTimer -= 1;
        this.faceOff();
        if (this.phaseTimer <= 0) this.phase = 'fight';
        return;
      case 'roundEnd':
        this.phaseTimer -= 1;
        this.advancePhysics([inputs[0], inputs[1]], false);
        if (this.phaseTimer <= 0) this.finishRound();
        return;
      case 'matchEnd':
        this.advancePhysics([inputs[0], inputs[1]], false);
        return;
      case 'fight':
        break;
    }

    this.faceOff();
    for (let i = 0; i < 2; i++) {
      const f = this.fighters[i];
      if (pressed[i] && f.actionable && !f.airborne && f.meter >= ULTIMATE_COST) {
        f.meter -= ULTIMATE_COST;
        f.action = 'ultimate';
        f.stance = 'stand';
        f.blocking = false;
        f.vx = 0;
        const victim = this.fighters[1 - i];
        this.ultimate = { id: ultimateId(this.picks[i]), attacker: i, victim: 1-i, tick: 0,
          facing: f.facing, sourceX: f.x, targetX: victim.x, targetY: victim.y, outcome: 'pending' };
        this.emit({ type: 'ultimateStart', fighter: i });
        return;
      }
    }
    this.readInputs(inputs);
    this.advanceActions();
    this.advancePhysics(inputs, true);
    this.resolvePush();
    this.clampToStage();
    this.resolveHits();

    this.clock -= 1;
    this.checkRoundOver();
  }

  /** Cinematic time freezes the clock and physics. Guard can be held during the cut-in.
   * The first strike checks range, height, invulnerability and guard; later hits
   * belong to that same confirmed sequence, never acquiring a missed target.
   */
  private advanceUltimate(inputs: [InputState, InputState]): void {
    const u = this.ultimate!;
    const def = ULTIMATES[u.id];
    const a = this.fighters[u.attacker], v = this.fighters[u.victim];
    u.tick++;
    this.shake *= 0.86;
    for (const f of this.fighters) if (f.flash > 0) f.flash--;
    const hit = (def.hits as readonly number[]).indexOf(u.tick);
    if (hit >= 0) {
      if (u.outcome === 'pending') {
        const distance = (v.x - a.x) * u.facing;
        const reachable = distance >= 0 && distance <= def.range && v.y < 100 && v.invuln === 0 && !v.defeated;
        const guard = !v.airborne && (v.actionable || v.action === 'blockstun') && isHoldingBack(inputs[u.victim], v.facing);
        u.outcome = !reachable ? 'miss' : guard ? 'block' : 'hit';
      }
      if ((u.outcome === 'hit' || u.outcome === 'block') && !v.defeated) {
        const blocked = u.outcome === 'block';
        // Ultimates cannot chip-kill, and do not recharge the attacker's meter.
        const requested = blocked ? Math.min(Math.round(def.damage[hit] * 0.12), Math.max(0, v.health - 1)) : def.damage[hit];
        const damage = Math.min(requested, v.health);
        if (blocked) v.takeBlock(damage, 18, 0);
        else {
          v.takeHit(damage, 24, 0, 0, false);
          a.comboCount++;
          a.comboTimer = COMBO_DROP_TICKS;
          v.meter = Math.min(RULES.maxMeter, v.meter + damage * 0.18);
        }
        a.score += damage * SCORE.perDamage;
        this.shake = blocked ? 1 : hit === def.hits.length - 1 ? 5 : 2;
        this.emit({ type: 'ultimateHit', attacker: u.attacker, victim: u.victim, damage, blocked });
      }
    }
    if (u.tick >= ULTIMATE_LENGTH) {
      a.action = 'free';
      a.comboTimer = COMBO_DROP_TICKS;
      if (u.outcome === 'hit') {
        v.vx = u.facing * 5;
        v.vy = 8;
        v.y = Math.max(v.y, 0.01);
      } else if (u.outcome === 'block') v.vx = u.facing * 3;
      this.ultimate = null;
      this.emit({ type: 'ultimateEnd', fighter: u.attacker });
      if (v.defeated) this.emit({ type: 'ko', fighter: u.victim });
      this.checkRoundOver();
    }
  }

  /** Fighters turn to face each other whenever they are free to act. */
  private faceOff(): void {
    const [a, b] = this.fighters;
    const want: 1 | -1 = a.x <= b.x ? 1 : -1;
    if (a.actionable && !a.airborne) a.facing = want;
    if (b.actionable && !b.airborne) b.facing = (-want) as 1 | -1;
  }

  private readInputs(inputs: [InputState, InputState]): void {
    for (let i = 0; i < 2; i += 1) {
      const f = this.fighters[i];
      const input = inputs[i];
      if (f.action === 'ko') continue;

      const back = isHoldingBack(input, f.facing);
      const forward = f.facing === 1 ? input.right : input.left;

      if (!f.actionable) {
        // Holding back through blockstun keeps the guard up for the next hit.
        f.blocking = f.action === 'blockstun' && back;
        continue;
      }

      if (f.airborne) {
        f.blocking = false;
        continue;
      }

      f.stance = input.down ? 'crouch' : 'stand';
      f.blocking = back;

      const attack = ATTACK_PRIORITY.find((id) => input[id]);
      if (attack) {
        f.startMove(attack);
        this.emit({ type: 'swing', fighter: i, move: attack });
        continue;
      }

      if (input.up && f.stance !== 'crouch') {
        f.vy = PHYSICS.jumpVelocity;
        f.y = 0.01;
        f.vx = forward ? PHYSICS.jumpForward * f.facing : back ? -PHYSICS.jumpForward * f.facing : 0;
        f.stance = 'air';
        this.emit({ type: 'jump', fighter: i });
        continue;
      }

      if (f.stance === 'crouch') {
        f.vx = 0;
      } else if (forward) {
        f.vx = PHYSICS.walkForward * f.facing;
      } else if (back) {
        f.vx = -PHYSICS.walkBack * f.facing;
      } else {
        f.vx *= PHYSICS.groundFriction;
      }
    }
  }

  private advanceActions(): void {
    for (const f of this.fighters) {
      switch (f.action) {
        case 'attack': {
          if (!f.move) break;
          f.moveTick += 1;
          if (f.moveTick >= moveLength(f.move)) {
            if (!f.moveConnected) {
              this.emit({ type: 'whiff', fighter: f.index, move: f.move.id });
            }
            f.move = null;
            f.action = 'free';
            f.moveTick = 0;
          }
          break;
        }
        case 'hitstun':
        case 'blockstun': {
          f.stunTimer -= 1;
          // An airborne victim stays in hitstun until they hit the floor.
          if (f.stunTimer <= 0 && !f.airborne) {
            f.action = 'free';
            f.stunTimer = 0;
          }
          break;
        }
        case 'knockdown': {
          f.stunTimer -= 1;
          if (f.stunTimer <= 0) {
            f.action = 'wakeup';
            f.stunTimer = PHYSICS.wakeupTicks;
            f.invuln = PHYSICS.wakeupInvuln;
          }
          break;
        }
        case 'wakeup': {
          f.stunTimer -= 1;
          if (f.stunTimer <= 0) {
            f.action = 'free';
            f.stance = 'stand';
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private advancePhysics(_inputs: [InputState, InputState], live: boolean): void {
    for (const f of this.fighters) {
      if (f.airborne) {
        f.vy -= PHYSICS.gravity;
        f.y += f.vy;
        f.x += f.vx;
        f.vx *= PHYSICS.airDrag;
        if (f.y <= 0) {
          const hard = f.action === 'hitstun' || f.vy < -13;
          f.y = 0;
          f.vy = 0;
          f.stance = 'stand';
          if (f.defeated) {
            // A killing blow that launched the victim keeps its arc, then
            // settles into the defeated pose here. Without this the landing
            // below would put a dead fighter back on their feet.
            f.action = 'ko';
            f.move = null;
            f.vx = 0;
          } else if (f.action === 'hitstun') {
            f.knockDown();
            if (live) this.emit({ type: 'knockdown', fighter: f.index, x: f.x });
            this.shake = Math.max(this.shake, 3);
          } else {
            f.action = f.action === 'attack' ? f.action : 'free';
            f.vx = 0;
          }
          if (live) this.emit({ type: 'land', fighter: f.index, hard });
        }
      } else {
        f.x += f.vx;
        if (f.action !== 'free' || f.stance === 'crouch') {
          f.vx *= PHYSICS.groundFriction;
          if (Math.abs(f.vx) < 0.05) f.vx = 0;
        }
      }
    }
  }

  /** Grounded fighters cannot stand inside each other. */
  private resolvePush(): void {
    const [a, b] = this.fighters;
    const pa = a.pushbox();
    const pb = b.pushbox();
    const overlap = Math.min(pa.right, pb.right) - Math.max(pa.left, pb.left);
    if (overlap <= 0) return;
    const dir = a.x <= b.x ? 1 : -1;
    const shift = overlap / 2;
    a.x -= shift * dir;
    b.x += shift * dir;
  }

  private clampToStage(): void {
    for (const f of this.fighters) {
      f.x = Math.max(PUSH_HALF_W, Math.min(STAGE_W - PUSH_HALF_W, f.x));
    }
  }

  private resolveHits(): void {
    for (let i = 0; i < 2; i += 1) {
      const attacker = this.fighters[i];
      const victim = this.fighters[1 - i];
      const hitbox = attacker.hitbox();
      if (!hitbox || !attacker.move) continue;
      if (victim.invuln > 0 || victim.action === 'ko') continue;

      const hurtbox = victim.hurtbox();
      if (!overlaps(hitbox, hurtbox)) continue;

      attacker.moveConnected = true;
      const point = contactPoint(hitbox, hurtbox);
      const move = attacker.move;
      const dir = attacker.facing;

      const guardUp =
        victim.blocking &&
        !victim.airborne &&
        (victim.action === 'free' || victim.action === 'blockstun') &&
        !(move.overhead && victim.stance === 'crouch');

      if (guardUp) {
        victim.takeBlock(move.chip, move.blockstun, move.blockPush * dir);
      attacker.score += move.chip * SCORE.perDamage;
        attacker.vx = -move.selfPush * dir;
        attacker.meter = Math.min(RULES.maxMeter, attacker.meter + move.meterGain * 0.4);
        this.applyHitstop(move.blockHitstop);
        this.shake = Math.max(this.shake, 1.2);
        this.emit({ type: 'block', attacker: i, victim: 1 - i, move: move.id, x: point.x, y: point.y });
        continue;
      }

      const counter = victim.action === 'attack' && victim.phase === 'startup';
      const scaling = Math.max(0.4, 1 - 0.13 * attacker.comboCount);
      const damage = Math.round(move.damage * scaling * (counter ? RULES.counterDamageScale : 1));
      const stun = move.hitstun + (counter ? RULES.counterHitstunBonus : 0);
      const launch = move.launcher || victim.airborne;

      victim.takeHit(damage, stun, move.knockback.x * dir, move.knockback.y, launch);
      attacker.score += damage * SCORE.perDamage;
      attacker.comboCount += 1;
      attacker.comboTimer = COMBO_DROP_TICKS;
      attacker.meter = Math.min(RULES.maxMeter, attacker.meter + damage * 0.25);
      victim.meter = Math.min(RULES.maxMeter, victim.meter + damage * 0.18);

      this.applyHitstop(move.hitstop + (counter ? 3 : 0));
      this.shake = Math.max(this.shake, counter ? 4 : 2.4);
      this.emit({
        type: 'hit',
        attacker: i,
        victim: 1 - i,
        move: move.id,
        x: point.x,
        y: point.y,
        counter,
      });

      if (victim.health <= 0) {
        this.emit({ type: 'ko', fighter: 1 - i });
        this.shake = Math.max(this.shake, 6);
      }
    }
  }

  private applyHitstop(ticks: number): void {
    this.hitstop = Math.max(this.hitstop, ticks);
    for (const f of this.fighters) f.hitstop = this.hitstop;
  }

  private checkRoundOver(): void {
    const [a, b] = this.fighters;
    if (a.defeated || b.defeated) {
      this.endRound(a.defeated && b.defeated ? null : a.defeated ? 1 : 0);
      return;
    }
    if (this.clock <= 0) {
      this.clock = 0;
      const winner = a.health === b.health ? null : a.health > b.health ? 0 : 1;
      this.endRound(winner);
    }
  }

  private endRound(winner: number | null): void {
    this.roundWinner = winner;
    this.phase = 'roundEnd';
    this.phaseTimer = ROUND_END_TICKS;
    if (winner !== null) {
      const champion = this.fighters[winner];
      champion.wins += 1;
      champion.score += SCORE.roundWin + this.secondsLeft * SCORE.timeBonus;
      if (champion.health >= RULES.maxHealth) champion.score += SCORE.perfectBonus;
    }
    for (const f of this.fighters) {
      if (!f.defeated) continue;
      f.move = null;
      // A victim still in the air rides out the knockdown arc and drops into
      // the defeated pose on landing, so the clip always starts from its
      // first cel with the fighter on the floor.
      if (f.airborne) continue;
      f.action = 'ko';
      f.vx = 0;
    }
    this.emit({ type: 'roundEnd', winner });
  }

  private finishRound(): void {
    const [a, b] = this.fighters;
    if (a.wins >= RULES.roundsToWin || b.wins >= RULES.roundsToWin) {
      this.matchWinner = a.wins > b.wins ? 0 : b.wins > a.wins ? 1 : null;
      this.phase = 'matchEnd';
      this.emit({ type: 'matchEnd', winner: this.matchWinner });
      return;
    }
    this.round += 1;
    this.resetRound();
  }

  /** Seconds left on the round clock, for the HUD. */
  get secondsLeft(): number {
    return Math.ceil(this.clock / TICK_HZ);
  }
}

export { MOVES };
