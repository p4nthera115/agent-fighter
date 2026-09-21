import type { Difficulty } from './combat/ai';
import { PLAYABLE, playableOr } from './roster';

export interface Settings {
  mode: 'cpu' | 'versus';
  difficulty: Difficulty;
  showBoxes: boolean;
  sound: boolean;
  music: boolean;
  /** Drives the CRT glass effects in the page around the canvas. */
  crt: boolean;
  /**
   * The last fighters chosen, by roster id. The select screen opens on these
   * and writes them back, so a rematch starts where the player left off.
   */
  picks: [string, string];
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'cpu',
  difficulty: 'rival',
  showBoxes: false,
  sound: true,
  music: true,
  crt: true,
  picks: [PLAYABLE[0].id, PLAYABLE[Math.min(1, PLAYABLE.length - 1)].id],
};

export const SETTINGS_KEY = 'settings';

/**
 * A few settings are readable from the query string, so a link can point at a
 * specific configuration: `?boxes=1&difficulty=boss&mode=versus&crt=0&music=0`,
 * plus `?p1=grok&p2=clawd` to preselect the fighters.
 */
export function settingsFromUrl(search: string): Settings {
  const params = new URLSearchParams(search);
  const difficulty = params.get('difficulty');
  const mode = params.get('mode');
  return {
    ...DEFAULT_SETTINGS,
    mode: mode === 'versus' ? 'versus' : 'cpu',
    difficulty:
      difficulty === 'rookie' || difficulty === 'boss' || difficulty === 'rival'
        ? difficulty
        : DEFAULT_SETTINGS.difficulty,
    showBoxes: params.get('boxes') === '1',
    crt: params.get('crt') !== '0',
    music: params.get('music') !== '0',
    picks: [
      playableOr(params.get('p1') ?? DEFAULT_SETTINGS.picks[0]),
      playableOr(params.get('p2') ?? DEFAULT_SETTINGS.picks[1]),
    ],
  };
}
