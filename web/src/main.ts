import './site/styles.css';
import { createGame } from './game';
import type { FightScene } from './game/scenes/FightScene';
import type { InputState } from './game/combat/types';
import { sfx } from './game/audio/sfx';
import { music } from './game/audio/music';
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

/** Wire the panel's controls to player one once the fight scene exists. */
game.events.on('fight:ready', (scene: FightScene) => {
  document.querySelectorAll<HTMLElement>('[data-touch]').forEach((button) => {
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    const action = button.dataset.touch as keyof InputState | undefined;
    if (action) scene.bindTouchControl(button, action);
  });
  const stick = document.querySelector<HTMLElement>('#stick');
  if (stick) scene.bindStick(stick);
});

const fullscreen = need<HTMLButtonElement>('#fullscreen');
fullscreen.addEventListener('click', () => {
  const root = document.documentElement;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void root.requestFullscreen?.().catch(() => undefined);
});
document.addEventListener('fullscreenchange', () => {
  fullscreen.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
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
