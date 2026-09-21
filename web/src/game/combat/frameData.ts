import type { Box, MoveDef, MoveId } from './types';

/**
 * Gameplay frame data, in 60 Hz ticks.
 *
 * This file is deliberately the only source of combat balance. It knows
 * nothing about `clawd-sheet.json` durations, so repainting or retiming the
 * art cannot silently change how the game plays. The renderer maps a move's
 * phase onto art frames in `render/animMap.ts`; that mapping is one-way.
 *
 * Hitbox and hurtbox coordinates are fighter-local: +x is forward, +y is up
 * from the feet, and the origin is the pivot baked into the sprite (106,136).
 * Boxes are given as a bottom-left corner plus a size.
 */

export const MOVES: Record<MoveId, MoveDef> = {
  punch: {
    id: 'punch',
    name: 'Jab',
    startup: 5,
    active: 3,
    recovery: 9,
    damage: 58,
    chip: 6,
    // The art throws the fist to +113; the box stops short so the visual
    // always covers the hit rather than the other way round.
    hitbox: { x: 46, y: 44, w: 70, h: 38 },
    hitstun: 16,
    blockstun: 10,
    hitstop: 5,
    blockHitstop: 4,
    knockback: { x: 3.0, y: 0 },
    blockPush: 2.2,
    selfPush: 0.6,
    launcher: false,
    overhead: false,
    meterGain: 6,
  },
  kick: {
    id: 'kick',
    name: 'Roundhouse',
    startup: 9,
    active: 4,
    recovery: 15,
    damage: 92,
    chip: 10,
    // Out-ranges the jab, which is what makes the spacing game work.
    hitbox: { x: 48, y: 22, w: 78, h: 40 },
    hitstun: 21,
    blockstun: 13,
    hitstop: 7,
    blockHitstop: 5,
    knockback: { x: 4.4, y: 0 },
    blockPush: 3.2,
    selfPush: 1.0,
    launcher: false,
    overhead: false,
    meterGain: 9,
  },
  uppercut: {
    id: 'uppercut',
    name: 'Rising Claw',
    startup: 4,
    active: 6,
    // Heavily negative on block: the payoff for a 4-frame launcher.
    recovery: 26,
    damage: 118,
    chip: 13,
    hitbox: { x: 8, y: 40, w: 78, h: 92 },
    hitstun: 26,
    blockstun: 15,
    hitstop: 9,
    blockHitstop: 6,
    knockback: { x: 2.6, y: 9.6 },
    blockPush: 2.6,
    selfPush: 0,
    launcher: true,
    // Rising strike: crouch-blocking it does not work.
    overhead: true,
    meterGain: 12,
  },
};

export const MOVE_ORDER: MoveId[] = ['punch', 'kick', 'uppercut'];

/** Total committed length of a move, in ticks. */
export function moveLength(move: MoveDef): number {
  return move.startup + move.active + move.recovery;
}

/** Frame advantage on block, for the move list in the UI. */
export function blockAdvantage(move: MoveDef): number {
  return move.blockstun - (move.active - 1 + move.recovery);
}

export function hitAdvantage(move: MoveDef): number {
  return move.hitstun - (move.active - 1 + move.recovery);
}

export const HURTBOX: Record<'stand' | 'crouch' | 'air', Box> = {
  stand: { x: -56, y: 0, w: 112, h: 118 },
  crouch: { x: -56, y: 0, w: 112, h: 78 },
  air: { x: -52, y: 6, w: 104, h: 108 },
};

/**
 * Pushbox half-width, matched to the body block rather than the full sprite.
 * The side arms are allowed to overlap; the blocks themselves are not, because
 * two interpenetrating silhouettes are unreadable at speed.
 */
export const PUSH_HALF_W = 56;

export const PHYSICS = {
  walkForward: 2.5,
  walkBack: 2.0,
  jumpVelocity: 11.4,
  jumpForward: 3.2,
  gravity: 0.62,
  /** Per-tick decay applied to knockback while grounded. */
  groundFriction: 0.82,
  airDrag: 0.99,
  /** Landing from a knockdown costs this many ticks on the floor. */
  knockdownTicks: 26,
  wakeupTicks: 12,
  /** Invulnerability on wake-up so a downed fighter cannot be looped forever. */
  wakeupInvuln: 10,
} as const;

export const RULES = {
  maxHealth: 620,
  maxMeter: 100,
  roundTimeSeconds: 60,
  roundsToWin: 2,
  startSeparation: 240,
  /** A hit landed during an opponent's startup counts as a counter-hit. */
  counterDamageScale: 1.25,
  counterHitstunBonus: 6,
} as const;
