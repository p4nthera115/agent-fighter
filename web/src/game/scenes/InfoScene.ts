import Phaser from 'phaser';
import { VIEW_W } from '../constants';
import { UI } from '../ui';
import { addField } from '../render/field';
import { Menu } from '../render/menu';
import { PixelLabel } from '../render/pixelLabel';
import { MOVES, MOVE_ORDER, blockAdvantage, hitAdvantage } from '../combat/frameData';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { TITLE_THEME } from '../audio/songs';
import { forgetControlsSeen, hasSeenControls, markControlsSeen } from '../firstRun';
import type { Settings } from '../settings';
import { SETTINGS_KEY, isHandheld } from '../settings';

type Panel = 'controls' | 'options';

const CONTROLS: Array<[string, string, string]> = [
  ['A D', 'ARROWS', 'WALK - HOLD AWAY TO BLOCK'],
  ['W', 'UP', 'JUMP'],
  ['S', 'DOWN', 'CROUCH'],
  ['J', ', OR NUM1', 'JAB'],
  ['K', '. OR NUM2', 'ROUNDHOUSE'],
  ['L', '/ OR NUM3', 'RISING CLAW'],
  ['SPACE', '; OR NUM0', 'ULTIMATE - FULL METER'],
];

/**
 * The same list for the handheld, where there is no keyboard to name and the
 * player is looking straight at four lettered caps and a pad.
 */
const TOUCH_CONTROLS: Array<[string, string, string]> = [
  ['PAD', '', 'WALK - HOLD AWAY TO BLOCK'],
  ['PAD UP', '', 'JUMP'],
  ['PAD DOWN', '', 'CROUCH'],
  ['B', '', 'JAB'],
  ['A', '', 'ROUNDHOUSE'],
  ['X', '', 'RISING CLAW'],
  ['Y', '', 'ULTIMATE - FULL METER'],
];

const DIFFICULTIES = ['rookie', 'rival', 'boss'] as const;

/** The two screens that used to be page sections, now inside the cabinet. */
export class InfoScene extends Phaser.Scene {
  private panel: Panel = 'controls';
  private menu?: Menu;

  constructor() {
    super('info');
  }

  init(data: { panel?: Panel }): void {
    this.panel = data.panel ?? 'controls';
  }

  create(): void {
    addField(this);
    music.play(TITLE_THEME);
    const settings = this.registry.get(SETTINGS_KEY) as Settings;

    new PixelLabel(this, VIEW_W / 2, 12, this.panel === 'controls' ? 'HOW TO PLAY' : 'OPTIONS', {
      scale: 3,
      color: UI.gold,
      shadow: UI.goldShadow,
      shadowOffset: 1,
      outline: UI.ink,
    }, 'center').setDepth(80);

    if (this.panel === 'controls') this.buildControls();
    else this.buildOptions(settings);

    new PixelLabel(this, VIEW_W / 2, 252, isHandheld() ? 'B TO RETURN' : 'ESC OR BACKSPACE TO RETURN', {
      scale: 1,
      color: UI.dim,
      outline: UI.ink,
    }, 'center').setDepth(80);

    this.bindKeys();
  }

  private buildControls(): void {
    const small = { scale: 1, color: UI.cream, outline: UI.ink } as const;
    const head = { scale: 1, color: UI.cyan, outline: UI.ink } as const;

    new PixelLabel(this, 20, 42, 'PLAYER ONE', head).setDepth(80);
    new PixelLabel(this, 104, 42, 'ACTION', head).setDepth(80);

    (isHandheld() ? TOUCH_CONTROLS : CONTROLS).forEach(([p1, _p2, action], i) => {
      const y = 56 + i * 11;
      new PixelLabel(this, 20, y, p1, { ...small, color: UI.gold }).setDepth(80);
      new PixelLabel(this, 104, y, action, small).setDepth(80);
    });

    // The move list is read from the module the simulation uses, so the
    // numbers on this screen cannot drift from the ones being played.
    const cols = [20, 132, 196, 252, 312, 372, 428];
    const headers = ['MOVE', 'STARTUP', 'ACTIVE', 'RECOVER', 'DAMAGE', 'ON BLOCK', 'ON HIT'];
    headers.forEach((text, i) => {
      new PixelLabel(this, cols[i], 140, text, head).setDepth(80);
    });

    MOVE_ORDER.forEach((id, i) => {
      const move = MOVES[id];
      const y = 154 + i * 12;
      const onBlock = blockAdvantage(move);
      const onHit = hitAdvantage(move);
      const cells = [
        move.name.toUpperCase(),
        `${move.startup}`,
        `${move.active}`,
        `${move.recovery}`,
        `${move.damage}`,
        onBlock > 0 ? `+${onBlock}` : `${onBlock}`,
        onHit > 0 ? `+${onHit}` : `${onHit}`,
      ];
      cells.forEach((text, c) => {
        const colour = c === 5 ? (onBlock >= 0 ? UI.green : UI.red)
          : c === 6 ? (onHit >= 0 ? UI.green : UI.red)
          : c === 0 ? UI.gold
          : UI.cream;
        new PixelLabel(this, cols[c], y, text, { scale: 1, color: colour, outline: UI.ink }).setDepth(80);
      });
    });

    const notes = [
      'FRAMES ARE 60THS OF A SECOND. ON BLOCK COUNTS FROM THE FIRST ACTIVE FRAME.',
      'NEGATIVE ON BLOCK MEANS YOU RECOVER SECOND AND CAN BE PUNISHED.',
      'RISING CLAW IS AN OVERHEAD - A CROUCHING GUARD DOES NOT STOP IT.',
      'HIT AN OPPONENT DURING THEIR STARTUP FOR A COUNTER HIT.',
    ];
    notes.forEach((text, i) => {
      new PixelLabel(this, 20, 200 + i * 11, text, {
        scale: 1,
        color: UI.cream,
        outline: UI.ink,
      }).setDepth(80);
    });
  }

  private buildOptions(settings: Settings): void {
    const save = () => this.registry.set(SETTINGS_KEY, { ...settings });
    // The card is remembered outside the settings object, since it outlives
    // the tab the way the high score does.
    let cardSeen = hasSeenControls();

    this.menu = new Menu(
      this,
      [
        {
          id: 'difficulty',
          label: 'CPU DIFFICULTY',
          value: () => settings.difficulty.toUpperCase(),
          onSelect: (direction) => {
            const at = DIFFICULTIES.indexOf(settings.difficulty);
            const next = (at + (direction === -1 ? -1 : 1) + DIFFICULTIES.length) % DIFFICULTIES.length;
            settings.difficulty = DIFFICULTIES[next];
            save();
          },
        },
        {
          id: 'boxes',
          label: 'HITBOX OVERLAY',
          value: () => (settings.showBoxes ? 'ON' : 'OFF'),
          onSelect: () => {
            settings.showBoxes = !settings.showBoxes;
            save();
          },
        },
        {
          id: 'sound',
          label: 'SOUND',
          value: () => (settings.sound ? 'ON' : 'OFF'),
          onSelect: () => {
            settings.sound = !settings.sound;
            sfx.unlock();
            sfx.setEnabled(settings.sound);
            save();
          },
        },
        {
          id: 'music',
          label: 'MUSIC',
          value: () => (settings.music ? 'ON' : 'OFF'),
          onSelect: () => {
            settings.music = !settings.music;
            sfx.unlock();
            music.setEnabled(settings.music);
            save();
          },
        },
        {
          id: 'crt',
          label: 'CRT GLASS',
          value: () => (settings.crt ? 'ON' : 'OFF'),
          onSelect: () => {
            settings.crt = !settings.crt;
            this.game.events.emit('cabinet:crt', settings.crt);
            save();
          },
        },
        {
          id: 'card',
          label: 'CONTROLS CARD',
          // ON means the card greets the player at the next fight; it turns
          // itself off once they have read it.
          value: () => (cardSeen ? 'OFF' : 'ON'),
          onSelect: () => {
            cardSeen = !cardSeen;
            if (cardSeen) markControlsSeen();
            else forgetControlsSeen();
          },
        },
        {
          id: 'reset',
          label: 'CLEAR HI-SCORE',
          onSelect: () => {
            this.registry.set('hiScore', 0);
            this.game.events.emit('cabinet:clearHiScore');
          },
        },
        { id: 'back', label: 'BACK', onSelect: () => this.back() },
      ],
      // Eight rows now, so they sit a little closer together.
      { x: 96, y: 58, step: 20, scale: 2, width: 292 },
    );

    new PixelLabel(this, VIEW_W / 2, 226, 'LEFT AND RIGHT CHANGE A SETTING', {
      scale: 1,
      color: UI.cyan,
      outline: UI.ink,
    }, 'center').setDepth(80);
  }

  private bindKeys(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      sfx.unlock();
      switch (event.code) {
        case 'Escape':
        case 'Backspace':
          event.preventDefault();
          this.back();
          break;
        case 'ArrowUp':
        case 'KeyW':
          event.preventDefault();
          this.menu?.move(-1);
          sfx.announce(0);
          break;
        case 'ArrowDown':
        case 'KeyS':
          event.preventDefault();
          this.menu?.move(1);
          sfx.announce(0);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          event.preventDefault();
          this.menu?.confirm(-1);
          sfx.announce(1);
          break;
        case 'ArrowRight':
        case 'KeyD':
          event.preventDefault();
          this.menu?.confirm(1);
          sfx.announce(1);
          break;
        case 'Enter':
        case 'Space':
        case 'KeyJ':
          event.preventDefault();
          sfx.announce(2);
          this.menu ? this.menu.confirm(1) : this.back();
          break;
        default:
          break;
      }
    });
    if (this.panel === 'controls') {
      this.input.on('pointerdown', () => this.back());
    }
  }

  private back(): void {
    this.scene.start('title');
  }
}
