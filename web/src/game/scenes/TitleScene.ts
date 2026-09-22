import Phaser from 'phaser';
import { VIEW_W } from '../constants';
import { UI } from '../ui';
import { addField } from '../render/field';
import { ArcadeHeader } from '../render/arcadeHeader';
import { Menu } from '../render/menu';
import { PixelLabel } from '../render/pixelLabel';
import { addLogo } from '../render/logo';
import { music } from '../audio/music';
import { TITLE_THEME } from '../audio/songs';
import { sfx } from '../audio/sfx';
import { demoPair } from '../roster';
import { GAUNTLET_KEY } from '../gauntlet';
import type { Settings } from '../settings';
import { SETTINGS_KEY, isMobile, isHandheld, MOBILE_QUERY } from '../settings';

/** Idle time on the menu before the cabinet starts demonstrating itself. */
const ATTRACT_DELAY = 14000;

/**
 * Title screen and main menu, and the keeper of the attract cycle:
 *
 *   menu -> demo match -> cast roll -> menu -> ...
 *
 * Each step hands the next one its name, so the loop is driven by scene
 * transitions rather than by a timer that has to survive them.
 *
 * Starting a match goes through the select screen rather than straight to the
 * fight, so the mode chosen here is the only thing this screen decides.
 */
export class TitleScene extends Phaser.Scene {
  private header!: ArcadeHeader;
  private menu!: Menu;
  private freePlay!: PixelLabel;
  private idleSince = 0;
  private blinkAt = 0;

  constructor() {
    super('title');
  }

  create(): void {
    addField(this);
    // play() is a no-op when the same song is already running, so the theme
    // carries straight across title, cast and the menus without restarting.
    music.setIntensity(1);
    music.play(TITLE_THEME);
    this.header = new ArcadeHeader(this);

    const settings = this.registry.get(SETTINGS_KEY) as Settings;
    const mobile = isMobile();
    if (mobile) settings.mode = 'cpu';
    const device = window.matchMedia(MOBILE_QUERY);
    const refreshMenu = () => this.scene.restart();
    device.addEventListener('change', refreshMenu);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => device.removeEventListener('change', refreshMenu));

    addLogo(this, VIEW_W / 2, 76);

    new PixelLabel(this, VIEW_W / 2, 136, 'A BROWSER ARCADE FIGHTER', {
      scale: 1,
      color: UI.cyan,
      outline: UI.ink,
    }, 'center').setDepth(80);

    this.menu = new Menu(
      this,
      [
        { id: '1p', label: '1 PLAYER', onSelect: () => this.chooseFighters('cpu') },
        ...(!mobile ? [{ id: '2p', label: '2 PLAYERS', onSelect: () => this.chooseFighters('versus') }] : []),
        { id: 'how', label: 'HOW TO PLAY', onSelect: () => this.openPanel('controls') },
        { id: 'opt', label: 'OPTIONS', onSelect: () => this.openPanel('options') },
      ],
      { x: 172, y: 156, step: 20, scale: 2, width: 148 },
    );

    this.freePlay = new PixelLabel(this, VIEW_W / 2, 246, 'FREE PLAY', {
      scale: 2,
      color: UI.gold,
      outline: UI.ink,
    }, 'center').setDepth(80);

    new PixelLabel(this, 14, 254, `CPU: ${settings.difficulty.toUpperCase()}`, {
      scale: 1,
      color: UI.dim,
      outline: UI.ink,
    }).setDepth(80);

    new PixelLabel(this, VIEW_W - 14, 254, isHandheld() ? 'A TO SELECT' : 'ENTER TO SELECT', {
      scale: 1,
      color: UI.dim,
      outline: UI.ink,
    }, 'right').setDepth(80);

    this.bindKeys();
    // game.loop.time is the same clock update() is handed; the scene's own
    // Clock still reads zero this early, which would fire every timer at once.
    this.idleSince = this.game.loop.time;
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on('keydown', (event: KeyboardEvent) => {
      this.idleSince = this.game.loop.time;
      sfx.unlock();
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          event.preventDefault();
          this.menu.move(-1);
          sfx.announce(0);
          break;
        case 'ArrowDown':
        case 'KeyS':
          event.preventDefault();
          this.menu.move(1);
          sfx.announce(0);
          break;
        case 'Enter':
        case 'Space':
        case 'KeyJ':
        case 'NumpadEnter':
          event.preventDefault();
          sfx.announce(2);
          this.menu.confirm();
          break;
        default:
          break;
      }
    });
    this.input.on('pointerdown', () => {
      this.idleSince = this.game.loop.time;
      sfx.unlock();
    });
  }

  private chooseFighters(mode: Settings['mode']): void {
    const settings = this.registry.get(SETTINGS_KEY) as Settings;
    this.registry.set(SETTINGS_KEY, { ...settings, mode: isMobile() ? 'cpu' : mode });
    this.registry.set('scores', [0, 0]);
    // The select screen builds the run; anything left over from the last one
    // would only be a stale ladder sitting behind it.
    this.registry.set(GAUNTLET_KEY, null);
    this.scene.start('select');
  }

  private openPanel(panel: 'controls' | 'options'): void {
    this.scene.start('info', { panel });
  }

  override update(time: number): void {
    const scores = this.registry.get('scores') as [number, number];
    const settings = this.registry.get(SETTINGS_KEY) as Settings;
    this.header.update(time, scores, this.registry.get('hiScore') as number, settings.mode === 'versus');

    if (time - this.blinkAt > 520) {
      this.blinkAt = time;
      this.freePlay.setAlpha(this.freePlay.image.alpha < 1 ? 1 : 0.15);
    }

    if (time - this.idleSince > ATTRACT_DELAY) {
      // Through the versus page, so the attract cycle names the two fighters
      // it is about to demonstrate before it demonstrates them.
      this.scene.start('versus', { mode: 'cpu', demo: true, picks: demoPair() });
    }
  }
}
