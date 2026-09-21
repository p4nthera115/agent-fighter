/**
 * Arcade scoring.
 *
 * Points come from damage dealt, so the number on screen always corresponds to
 * something the player did. The high score is the only piece of state that
 * outlives the tab.
 */

const HI_SCORE_KEY = 'mascot-fighter.hi-score';

export const SCORE = {
  /** Multiplier applied to every point of damage dealt. */
  perDamage: 10,
  roundWin: 5000,
  perfectBonus: 10000,
  /** Awarded per whole second left on the clock when a round is won. */
  timeBonus: 100,
} as const;

/** Seven digits, zero padded, the way a cabinet shows it. */
export function formatScore(value: number): string {
  return Math.max(0, Math.floor(value)).toString().padStart(7, '0');
}

export function loadHiScore(): number {
  try {
    const raw = window.localStorage.getItem(HI_SCORE_KEY);
    const value = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : 12571;
  } catch {
    // Private browsing and blocked storage both throw here; a default is fine.
    return 12571;
  }
}

export function saveHiScore(value: number): void {
  try {
    window.localStorage.setItem(HI_SCORE_KEY, String(Math.floor(value)));
  } catch {
    // Nothing to do: the score simply does not persist.
  }
}
