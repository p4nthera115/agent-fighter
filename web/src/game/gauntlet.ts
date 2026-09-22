import { PLAYABLE, rosterEntry } from './roster';

/**
 * A single-player run through the cast.
 *
 * One player, one fighter, and a queue of opponents met one after another
 * without going back through the select screen. The run ends the first time
 * the player loses a match, or when the queue is empty and there is nobody
 * left to fight.
 *
 * It is plain data on purpose: it lives in the Phaser registry, so it has to
 * survive a scene change, and every scene that reads it only reads it.
 */
export interface Gauntlet {
  /** The fighter the player chose, held for the whole run. */
  player: string;
  /** Opponent roster ids, in the order they are fought. */
  opponents: string[];
  /** How many have been beaten, which is also the index of the current one. */
  cleared: number;
  /** Score banked from the matches already won, carried into the next one. */
  score: number;
}

export const GAUNTLET_KEY = 'gauntlet';

/**
 * Builds the ladder behind an opponent the select screen has already chosen.
 *
 * The machine's roulette pick stays where the player saw it land — first —
 * and the rest of the playable cast follows in a fresh order each run. The
 * player's own fighter is left out, because a run is against the *other*
 * mascots; the one exception is a mirror the roulette itself chose, which is
 * kept because the player watched it happen.
 */
export function buildGauntlet(player: string, first: string): Gauntlet {
  const rest = PLAYABLE.map((entry) => entry.id).filter((id) => id !== player && id !== first);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return { player, opponents: [first, ...rest], cleared: 0, score: 0 };
}

/** Whoever is standing in the other corner right now, or null once cleared. */
export function currentOpponent(run: Gauntlet): string | null {
  return run.cleared < run.opponents.length ? run.opponents[run.cleared] : null;
}

/** The run after a win: one more cleared, and the score so far banked. */
export function advance(run: Gauntlet, score: number): Gauntlet {
  return { ...run, cleared: run.cleared + 1, score };
}

export function isComplete(run: Gauntlet): boolean {
  return run.cleared >= run.opponents.length;
}

/** "MATCH 2 OF 5", for the versus page. */
export function gauntletLabel(run: Gauntlet): string {
  return `MATCH ${Math.min(run.cleared + 1, run.opponents.length)} OF ${run.opponents.length}`;
}

/** The display name of the fighter a run is currently pointed at. */
export function opponentName(run: Gauntlet): string | null {
  const id = currentOpponent(run);
  return id === null ? null : rosterEntry(id).name;
}
