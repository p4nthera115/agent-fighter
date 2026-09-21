import { MOVES } from './frameData';
import type { Match } from './match';
import { emptyInput } from './types';
import type { InputState, MoveId } from './types';

export type Difficulty = 'rookie' | 'rival' | 'boss';

interface Tuning {
  /** Ticks between decisions. Higher is slower to react. */
  thinkTicks: number;
  /** Chance of guarding once the opponent's startup is visible. */
  blockChance: number;
  /** Chance of taking a swing when in range. */
  pressure: number;
  /** Chance of stepping back after a whiff. */
  discipline: number;
}

const TUNING: Record<Difficulty, Tuning> = {
  rookie: { thinkTicks: 16, blockChance: 0.25, pressure: 0.35, discipline: 0.2 },
  rival: { thinkTicks: 9, blockChance: 0.55, pressure: 0.55, discipline: 0.45 },
  boss: { thinkTicks: 5, blockChance: 0.82, pressure: 0.75, discipline: 0.7 },
};

/**
 * A deliberately simple opponent: it reads distance and the player's move
 * phase, then commits to one intention for a few ticks. It has no access to
 * anything the player cannot also see on screen.
 */
export class FighterAI {
  private tuning: Tuning;
  private timer = 0;
  private intent: InputState = emptyInput();
  private holdFor = 0;

  constructor(
    private readonly index: number,
    difficulty: Difficulty = 'rival',
  ) {
    this.tuning = TUNING[difficulty];
  }

  setDifficulty(difficulty: Difficulty): void {
    this.tuning = TUNING[difficulty];
  }

  update(match: Match): InputState {
    const self = match.fighters[this.index];
    const foe = match.fighters[1 - this.index];

    if (match.phase !== 'fight' || self.action === 'ko') return emptyInput();

    if (this.holdFor > 0) {
      this.holdFor -= 1;
      // Buttons are edge-ish: release them after the first tick so the AI
      // does not machine-gun the same attack.
      return { ...this.intent, punch: false, kick: false, uppercut: false };
    }

    this.timer -= 1;
    if (this.timer > 0) return this.intent;
    this.timer = this.tuning.thinkTicks;

    const next = emptyInput();
    const gap = Math.abs(foe.x - self.x);
    const towards = foe.x > self.x ? 'right' : 'left';
    const away = towards === 'right' ? 'left' : 'right';

    const foeThreatening = foe.action === 'attack' && foe.phase !== 'recovery' && gap < 190;
    const foePunishable = foe.action === 'attack' && foe.phase === 'recovery';

    if (foeThreatening && Math.random() < this.tuning.blockChance) {
      next[away] = true;
      if (Math.random() < 0.4) next.down = true;
      this.intent = next;
      return next;
    }

    if (foe.airborne && gap < 150 && Math.random() < this.tuning.blockChance) {
      this.intent = this.commit({ ...next, uppercut: true });
      return this.intent;
    }

    if (gap < 132) {
      if (foePunishable || Math.random() < this.tuning.pressure) {
        const move = this.pickMove(gap, foePunishable);
        this.intent = this.commit({ ...next, [move]: true } as InputState);
        return this.intent;
      }
      if (Math.random() < this.tuning.discipline) {
        next[away] = true;
        this.intent = next;
        return next;
      }
      next.down = Math.random() < 0.3;
      this.intent = next;
      return next;
    }

    if (gap > 260 && Math.random() < 0.12) {
      next.up = true;
      next[towards] = true;
      this.intent = next;
      return next;
    }

    next[towards] = true;
    this.intent = next;
    return next;
  }

  private pickMove(gap: number, punish: boolean): MoveId {
    if (punish && gap < 100) return 'uppercut';
    if (gap > MOVES.punch.hitbox.x + MOVES.punch.hitbox.w - 20) return 'kick';
    const roll = Math.random();
    if (roll < 0.5) return 'punch';
    if (roll < 0.82) return 'kick';
    return 'uppercut';
  }

  private commit(input: InputState): InputState {
    this.holdFor = 4;
    return input;
  }
}
