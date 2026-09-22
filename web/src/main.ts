import './site/styles.css';
import { createGame } from './game';
import type { FightScene } from './game/scenes/FightScene';
import type { InputState } from './game/combat/types';
import { sfx } from './game/audio/sfx';
import { music } from './game/audio/music';
import { audio } from './game/audio/engine';
import { SETTINGS_KEY, settingsFromUrl } from './game/settings';
import type { Settings } from './game/settings';

function need<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Cabinet is missing ${selector}`);
  return element;
}

const area = need('#cab-area');
const frame = need('#cab-frame');
const screen = need('#cab-screen');
const mount = need('#stage-mount');

const settings: Settings = settingsFromUrl(window.location.search);
document.body.classList.toggle('no-crt', !settings.crt);

const mute = need<HTMLButtonElement>('#mute');
const muteLabel = need('#mute-label');
const MUTE_KEY = 'mascot-fighter.muted';
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === 'true'; } catch { /* Storage is optional. */ }
const updateMute = () => {
  audio.setMuted(muted);
  mute.setAttribute('aria-checked', String(!muted));
  mute.title = muted ? 'Turn sound on' : 'Turn sound off';
  muteLabel.textContent = muted ? 'OFF' : 'ON';
};
updateMute();
mute.addEventListener('click', () => {
  muted = !muted;
  updateMute();
  audio.unlock();
  try { localStorage.setItem(MUTE_KEY, String(muted)); } catch { /* Keep the in-memory choice. */ }
});

const game = createGame({ mount, screen, frame, area }, settings);


/** Audio needs a gesture; the first one anywhere on the page opens it. */
const unlock = () => {
  sfx.unlock();
  const current = game.registry.get(SETTINGS_KEY) as Settings;
  sfx.setEnabled(current.sound);
  music.setEnabled(current.music);
};
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

game.events.on('cabinet:crt', (on: boolean) => {
  document.body.classList.toggle('no-crt', !on);
});

game.events.on('cabinet:clearHiScore', () => {
  try {
    window.localStorage.removeItem('mascot-fighter.hi-score');
  } catch {
    // Storage is unavailable; the in-memory reset already happened.
  }
});

// Install once for the entire cabinet, including menus and nested button labels.
// Pointer events still reach the game, so held movement and multi-touch work.
const cabinet = need('.cab');
for (const eventName of ['contextmenu', 'selectstart', 'dragstart']) {
  cabinet.addEventListener(eventName, (event) => event.preventDefault());
}

// Cancel native long-press recognition at the start of a held control, before
// the browser can display a callout or provide its haptic feedback. These
// controls use pointer events, not the emulated clicks this also suppresses.
// Keep ordinary clicks on Start, Mute and Fullscreen, and Phaser's touch input.
document.querySelectorAll<HTMLElement>('[data-touch], #stick').forEach((control) => {
  control.addEventListener('touchstart', (event) => {
    if (event.cancelable) event.preventDefault();
  }, { passive: false });
});

/** Wire the panel's controls to player one once the fight scene exists. */
game.events.on('fight:ready', (scene: FightScene) => {
  document.querySelectorAll<HTMLElement>('[data-touch]').forEach((button) => {
    const action = button.dataset.touch as keyof InputState | undefined;
    if (action) scene.bindTouchControl(button, action);
  });
  const stick = document.querySelector<HTMLElement>('#stick');
  if (stick) scene.bindStick(stick);
});

const fullscreen = need<HTMLButtonElement>('#fullscreen');
const installHelp = need<HTMLDialogElement>('#install-help');
const standalone = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)');
const updateFullscreen = () => {
  const active = Boolean(document.fullscreenElement) || standalone.matches;
  fullscreen.setAttribute('aria-pressed', String(active));
  fullscreen.title = active ? 'Fullscreen active' : 'Play without the address bar';
};
const coarse = window.matchMedia('(pointer: coarse)');

/** Locking is still absent from the DOM types, and from Safari. */
type Lockable = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
  unlock?: () => void;
};
const orientationApi = (): Lockable | undefined => window.screen.orientation as Lockable | undefined;

/**
 * Portrait spends most of the shell on plastic; landscape gives the picture
 * the whole width. Fullscreen is the one moment a browser will let a page ask
 * to be turned, so ask then. Android turns; iOS has no lock at all and a
 * desktop has nothing to turn, so this is an improvement where it lands and
 * silent where it does not.
 */
async function faceLandscape(): Promise<void> {
  if (!coarse.matches) return;
  try {
    await orientationApi()?.lock?.('landscape');
  } catch {
    // Refused or unsupported; the player turns the phone themselves.
  }
}

fullscreen.addEventListener('click', async () => {
  if (standalone.matches && !document.fullscreenElement) return;
  try {
    if (document.fullscreenElement) {
      orientationApi()?.unlock?.();
      await document.exitFullscreen();
    } else if (document.fullscreenEnabled) {
      await document.documentElement.requestFullscreen();
      await faceLandscape();
    } else installHelp.showModal();
  } catch {
    installHelp.showModal();
  }
});
document.addEventListener('fullscreenchange', updateFullscreen);
standalone.addEventListener('change', updateFullscreen);
updateFullscreen();

function sendCommand(code: string): void {
  const keyCode = ({ Enter: 13, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 } as Record<string, number>)[code];
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, keyCode, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, keyCode, bubbles: true }));
}

// Keep the physical controls useful in menus as well as during a fight.
need<HTMLButtonElement>('#handheld-start').addEventListener('click', () => {
  sendCommand(game.scene.isActive('fight') ? 'Escape' : 'Enter');
});
// The caps read A, B, X and Y on the handheld, so the menus answer to them the
// way a handheld's menus do: A confirms, B backs out, the other two confirm
// rather than sit dead under a thumb.
const menuCommands: Record<string, string> = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  kick: 'Enter', punch: 'Escape', uppercut: 'Enter', ultimate: 'Enter',
};
document.querySelectorAll<HTMLElement>('[data-touch]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    if (game.scene.isActive('fight')) return;
    event.preventDefault();
    const code = menuCommands[button.dataset.touch ?? ''];
    if (code) sendCommand(code);
  });
});

// The arrow keys and space scroll the page by default, which fights the game.
window.addEventListener(
  'keydown',
  (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  },
  { passive: false },
);
