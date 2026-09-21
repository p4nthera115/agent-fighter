/**
 * Combat vocabulary. Nothing in this directory imports Phaser or touches the
 * DOM: the match is a pure state machine that a renderer observes.
 */

export type MoveId = 'punch' | 'kick' | 'uppercut';

export type Stance = 'stand' | 'crouch' | 'air';

export type Action =
  | 'free'
  | 'attack'
  | 'ultimate'
  | 'hitstun'
  | 'blockstun'
  | 'knockdown'
  | 'wakeup'
  | 'ko';

/** Axis-aligned box in fighter-local units: +x is forward, +y is up from the feet. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MoveDef {
  id: MoveId;
  name: string;
  /** Frames before the hitbox exists. */
  startup: number;
  /** Frames the hitbox is live. */
  active: number;
  /** Frames after the hitbox ends, still committed. */
  recovery: number;
  damage: number;
  /** Damage dealt through a successful block. */
  chip: number;
  hitbox: Box;
  /** Frames the victim is stunned on hit / on block. */
  hitstun: number;
  blockstun: number;
  /** Frames both fighters freeze on contact. Sells the impact. */
  hitstop: number;
  blockHitstop: number;
  /** Velocity applied to the victim. +x pushes them away from the attacker. */
  knockback: { x: number; y: number };
  blockPush: number;
  /** Velocity applied to the attacker, for a recoil step. */
  selfPush: number;
  /** A launcher puts the victim in the air and ends in a knockdown. */
  launcher: boolean;
  /** Crouching blocks it only if true; otherwise standing block is required. */
  overhead: boolean;
  meterGain: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  punch: boolean;
  kick: boolean;
  uppercut: boolean;
  ultimate: boolean;
}

export function emptyInput(): InputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
    uppercut: false,
    ultimate: false,
  };
}

/** Events the simulation emits for the renderer and audio to react to. */
export type CombatEvent =
  | { type: 'ultimateStart'; fighter: number }
  | { type: 'ultimateHit'; attacker: number; victim: number; damage: number; blocked: boolean }
  | { type: 'ultimateEnd'; fighter: number }
  | { type: 'hit'; attacker: number; victim: number; move: MoveId; x: number; y: number; counter: boolean }
  | { type: 'block'; attacker: number; victim: number; move: MoveId; x: number; y: number }
  | { type: 'whiff'; fighter: number; move: MoveId }
  | { type: 'swing'; fighter: number; move: MoveId }
  | { type: 'jump'; fighter: number }
  | { type: 'land'; fighter: number; hard: boolean }
  | { type: 'knockdown'; fighter: number; x: number }
  | { type: 'ko'; fighter: number }
  | { type: 'roundStart'; round: number }
  | { type: 'roundEnd'; winner: number | null }
  | { type: 'matchEnd'; winner: number | null };
