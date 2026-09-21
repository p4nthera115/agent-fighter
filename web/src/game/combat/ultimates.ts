/** Shared choreography, expressed in simulation ticks (60 Hz). */
export const ULTIMATES = {
  clawd: { name: 'CONTEXT COLLAPSE', color: 0xffb078, backdrop: 0x281415, range: 360, hits: [82, 98, 112], damage: [45, 45, 90] },
  grok: { name: 'SHAPE RIOT', color: 0xff58b2, backdrop: 0x190e30, range: 280, hits: [60, 76, 92, 110], damage: [35, 40, 40, 75] },
  muse: { name: 'DREAM SEQUENCE', color: 0x9cacff, backdrop: 0x261743, range: 320, hits: [78, 104], damage: [60, 120] },
  codex: { name: 'EXECUTE ALL', color: 0x61f6e8, backdrop: 0x051f27, range: 340, hits: [76, 94, 110], damage: [40, 50, 90] },
  openclaw: { name: 'SWARM PROTOCOL', color: 0xff6b65, backdrop: 0x301321, range: 340, hits: [68, 82, 96, 110], damage: [30, 35, 40, 75] },
} as const;
export type UltimateId = keyof typeof ULTIMATES;
export const ULTIMATE_INTRO = 36;
export const ULTIMATE_LENGTH = 144;
export const ULTIMATE_COST = 100;
export function ultimateId(id: string): UltimateId {
  return Object.prototype.hasOwnProperty.call(ULTIMATES, id) ? id as UltimateId : 'clawd';
}
export interface UltimateState {
  id: UltimateId;
  attacker: number;
  victim: number;
  tick: number;
  facing: 1 | -1;
  sourceX: number;
  targetX: number;
  targetY: number;
  outcome: 'pending' | 'hit' | 'block' | 'miss';
}
/** Actor and effects are separate tracks; recovery holds the last cel. */
export function ultimateFrame(tick: number, starts: readonly number[]): number {
  let frame = 0;
  for (let i = 1; i < starts.length; i++) if (tick >= starts[i]) frame = i;
  return frame;
}
export const ACTOR_STARTS = [0, 36, 46, 56, 68, 82, 116, 130];
export const EFFECT_STARTS = [36, 46, 58, 70, 82, 96, 110, 126];
