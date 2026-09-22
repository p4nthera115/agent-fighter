/**
 * What the cabinet remembers about a player between visits.
 *
 * Only the fact that they have been shown the controls: enough for the card
 * to greet a newcomer on their first fight and then stay out of the way.
 */

const CONTROLS_KEY = 'agent-fighter.controls-seen';

export function hasSeenControls(): boolean {
  try {
    return window.localStorage.getItem(CONTROLS_KEY) === '1';
  } catch {
    // Blocked storage reads as a first visit, which is the safe way round:
    // a player who knows the keys can dismiss the card in one press.
    return false;
  }
}

export function markControlsSeen(): void {
  try {
    window.localStorage.setItem(CONTROLS_KEY, '1');
  } catch {
    // Nothing to do; the card simply greets them again next time.
  }
}

export function forgetControlsSeen(): void {
  try {
    window.localStorage.removeItem(CONTROLS_KEY);
  } catch {
    // Same again: the in-memory state is what matters this session.
  }
}
