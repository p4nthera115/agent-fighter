import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { UI } from '../ui';
import { addField } from '../render/field';
import { PixelLabel } from '../render/pixelLabel';
import { AnimMap } from '../render/animMap';
import { music } from '../audio/music';
import { TITLE_THEME } from '../audio/songs';
import { sfx } from '../audio/sfx';
import { PLAYABLE, ROSTER } from '../roster';
import type { Settings } from '../settings';
import { SETTINGS_KEY, isMobile, isHandheld } from '../settings';
import { altTexKey, movesKey, sheetKey, texKey, thumbKey } from './PreloadScene';

/**
 * Portrait grid geometry.
 *
 * Five cells at this pitch span 30..450, and the two fighters standing below
 * leave a 120px column down the middle. Every string on this screen is sized
 * to that column: at the 5x7 font's six pixels per character it holds twenty.
 */
const CELL = 68;
const CELL_SPAN = 88;
const CELL_Y = 74;

/** Where each side's chosen fighter stands, clear of the centre column. */
const PODIUM_Y = 246;
const PODIUM_X: readonly [number, number] = [90, 388];

/** Pause between the last lock-in and the fight, so the lock-in reads. */
const LAUNCH_MS = 900;
/** How long the machine takes to make up its own mind. */
const CPU_ROULETTE_MS = 760;
/** One roulette step. Slow enough to read, fast enough to be a spin. */
const ROULETTE_STEP_MS = 95;
/** Left alone here, the cabinet goes back to advertising itself. */
const IDLE_MS = 24000;

interface Side {
  /** Index into ROSTER, or -1 for a CPU slot that has not chosen yet. */
  cursor: number;
  locked: boolean;
  /** Set while the CPU is still spinning through the cast. */
  choosing: boolean;
  anims?: AnimMap;
  elapsed: number;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  thumb: Phaser.GameObjects.Image;
  cursorFrame: Phaser.GameObjects.Rectangle;
  tag: PixelLabel;
  name: PixelLabel;
  role: PixelLabel;
  tagline: PixelLabel;
  state: PixelLabel;
}

/**
 * Character select.
 *
 * This is the only screen that decides who fights. Everything downstream —
 * the atlases the match loads, the costume player two wears, the names on the
 * health bars — reads the pair written back here.
 *
 * A fighter with no sheet stays on the grid and stays unpickable. Every entry
 * has one today, so nothing is greyed out; the path stays because the roster
 * is where fighters are added, and the next one to arrive without art should
 * meet a screen that says so rather than one that crashes.
 */
export class SelectScene extends Phaser.Scene {
  private settings!: Settings;
  private versus = false;
  private sides!: [Side, Side];
  private hint!: PixelLabel;
  private idleSince = 0;
  private launchAt = 0;
  private rouletteUntil = 0;
  private rouletteStep = -1;
  private leaving = false;

  constructor() {
    super('select');
  }

  create(): void {
    this.settings = this.registry.get(SETTINGS_KEY) as Settings;
    if (isMobile()) this.settings.mode = 'cpu';
    this.versus = this.settings.mode === 'versus';
    this.leaving = false;
    this.launchAt = 0;
    this.rouletteUntil = 0;
    this.rouletteStep = -1;
    this.idleSince = this.game.loop.time;

    addField(this);
    // play() is a no-op when the same song is already running, so the theme
    // carries straight across the title, this screen and the menus.
    music.setIntensity(1);
    music.play(TITLE_THEME);

    new PixelLabel(this, VIEW_W / 2, 8, 'SELECT YOUR FIGHTER', {
      scale: 3,
      color: UI.gold,
      shadow: UI.goldShadow,
      shadowOffset: 1,
      outline: UI.ink,
    }, 'center').setDepth(80);

    this.buildGrid();
    this.sides = [this.buildSide(0), this.buildSide(1)];

    // A rule between the two panels, so two centred blocks do not read as one.
    this.add.rectangle(VIEW_W / 2, 189, 118, 1, 0x5a60d0, 0.8).setDepth(79);

    this.hint = new PixelLabel(this, VIEW_W / 2, VIEW_H - 12, '', {
      scale: 1,
      color: UI.cyan,
      outline: UI.ink,
    }, 'center').setDepth(80);

    this.point(0, this.rosterIndex(this.settings.picks[0]));
    // Against the CPU the machine picks second, once the player has committed.
    if (this.versus) this.point(1, this.rosterIndex(this.settings.picks[1]));
    else this.clear(1);
    this.refresh();

    this.bindKeys();
  }

  private rosterIndex(id: string): number {
    const at = ROSTER.findIndex((entry) => entry.id === id);
    return at === -1 ? 0 : at;
  }

  private cellX(index: number): number {
    return Math.round(VIEW_W / 2 - (CELL_SPAN * (ROSTER.length - 1)) / 2 + index * CELL_SPAN);
  }

  private buildGrid(): void {
    ROSTER.forEach((entry, i) => {
      const x = this.cellX(i);
      const playable = entry.status === 'playable';

      this.add
        .rectangle(x, CELL_Y, CELL, CELL, playable ? 0x3a40b0 : 0x1e2270)
        .setDepth(70)
        .setStrokeStyle(1, playable ? 0x5a60d0 : 0x343a90);

      this.add
        .image(x, CELL_Y, thumbKey(entry.id))
        .setDepth(72)
        .setAlpha(playable ? 1 : 0.4);

      new PixelLabel(this, x, CELL_Y + CELL / 2 + 5, entry.name, {
        scale: 1,
        color: playable ? UI.cream : UI.dim,
        outline: UI.ink,
      }, 'center').setDepth(74);

      // A finger needs something to hit; the portrait is the target.
      this.add
        .rectangle(x, CELL_Y, CELL, CELL, 0xffffff, 0)
        .setDepth(76)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.hover(i))
        .on('pointerdown', () => {
          this.hover(i);
          this.confirm(0);
        });
    });
  }

  private buildSide(index: number): Side {
    const mirrored = index === 1;
    const colour = index === 0 ? UI.gold : UI.cyan;
    const tint = index === 0 ? 0xffc24a : 0x8fd8ff;
    // Player one's panel sits above the rule, player two's below it.
    const top = index === 0 ? 136 : 197;

    // The fighter stands on the floor line in the costume it will actually
    // wear, so the preview is not lying about the colours.
    const shadow = this.add.ellipse(PODIUM_X[index], PODIUM_Y + 2, 96, 16, 0x1b1f52, 0.5).setDepth(58);
    const sprite = this.add
      .sprite(PODIUM_X[index], PODIUM_Y, texKey(PLAYABLE[0].id))
      .setDepth(60)
      .setFlipX(mirrored)
      .setVisible(false);

    const thumb = this.add
      .image(PODIUM_X[index], PODIUM_Y - 46, thumbKey(ROSTER[ROSTER.length - 1].id))
      .setDepth(60)
      .setAlpha(0.5)
      .setVisible(false);

    const label = (y: number, scale: number, color: string) =>
      new PixelLabel(this, VIEW_W / 2, y, '', { scale, color, outline: UI.ink }, 'center').setDepth(80);

    return {
      cursor: -1,
      locked: false,
      choosing: false,
      elapsed: 0,
      sprite,
      shadow,
      thumb,
      cursorFrame: this.add
        .rectangle(0, CELL_Y, CELL + 6, CELL + 6)
        .setDepth(78)
        .setStrokeStyle(2, tint)
        .setVisible(false),
      tag: new PixelLabel(this, 0, CELL_Y + CELL / 2 + 15, index === 0 ? '1P' : this.versus ? '2P' : 'CPU', {
        scale: 1,
        color: colour,
        outline: UI.ink,
      }, 'center').setDepth(79).setVisible(false),
      name: label(top, 2, colour),
      role: label(top + 18, 1, UI.cream),
      tagline: label(top + 29, 1, UI.idle),
      state: label(top + 42, 1, UI.green),
    };
  }

  /** Points a side at a roster entry and swaps in that fighter's sheet. */
  private point(index: number, cursor: number): void {
    const side = this.sides[index];
    side.cursor = cursor;
    side.elapsed = 0;

    const entry = ROSTER[cursor];
    if (!entry.art) {
      side.anims = undefined;
      side.sprite.setVisible(false);
      side.shadow.setVisible(false);
      side.thumb.setTexture(thumbKey(entry.id)).setVisible(true);
      return;
    }

    const anims = new AnimMap(
      this.cache.json.get(sheetKey(entry.id)),
      this.cache.json.get(movesKey(entry.id)),
    );
    side.anims = anims;
    side.thumb.setVisible(false);
    // Player two only wears the palette swap in a mirror match, which is the
    // same rule the match uses.
    const mirror = index === 1 && this.sides[0].cursor === cursor;
    side.sprite
      .setTexture(mirror ? altTexKey(entry.id) : texKey(entry.id), anims.clip('idle').names[0])
      .setOrigin(anims.origin.x / anims.frame.w, anims.origin.y / anims.frame.h)
      .setVisible(true);
    side.shadow
      .setVisible(true)
      .setFillStyle(entry.art.shadow.color, entry.art.shadow.alpha)
      .setDisplaySize(entry.art.shadow.width, entry.art.shadow.height);
  }

  /** Empties a side: the CPU slot before the player has committed. */
  private clear(index: number): void {
    const side = this.sides[index];
    side.cursor = -1;
    side.anims = undefined;
    side.sprite.setVisible(false);
    side.shadow.setVisible(false);
    side.thumb.setVisible(false);
  }

  private hover(cursor: number): void {
    // One pointer, one cursor: the mouse always drives player one.
    if (this.leaving || this.sides[0].locked || this.sides[0].cursor === cursor) return;
    this.idleSince = this.game.loop.time;
    this.select(0, cursor);
    sfx.announce(0);
  }

  private move(index: number, delta: number): void {
    const side = this.sides[index];
    if (this.leaving || side.locked || side.choosing) return;
    this.idleSince = this.game.loop.time;
    this.select(index, (Math.max(0, side.cursor) + delta + ROSTER.length) % ROSTER.length);
    sfx.announce(0);
  }

  private select(index: number, cursor: number): void {
    this.point(index, cursor);
    // Whether this is a mirror match just changed, so player two's costume
    // may have to change with it.
    const other = this.sides[1 - index];
    if (index === 0 && other.cursor >= 0) this.point(1, other.cursor);
    this.refresh();
  }

  private confirm(index: number): void {
    const side = this.sides[index];
    if (this.leaving || side.choosing || side.cursor < 0) return;
    this.idleSince = this.game.loop.time;

    if (side.locked) {
      side.locked = false;
      this.launchAt = 0;
      if (!this.versus && index === 0) {
        this.sides[1].locked = false;
        this.clear(1);
      }
      this.refresh();
      sfx.announce(1);
      return;
    }

    if (!ROSTER[side.cursor].art) {
      // Refused, and it says why rather than silently doing nothing.
      sfx.guard();
      this.flashUnavailable(index);
      return;
    }

    side.locked = true;
    sfx.bell();
    this.refresh();

    if (!this.versus && index === 0) this.startCpuChoice();
    else if (this.sides[0].locked && this.sides[1].locked) {
      this.launchAt = this.game.loop.time + LAUNCH_MS;
    }
  }

  /**
   * The machine picks for itself, visibly.
   *
   * A roulette across the playable cast costs almost nothing and answers the
   * question the player is actually asking, which is who they are fighting.
   */
  private startCpuChoice(): void {
    this.sides[1].choosing = true;
    this.rouletteUntil = this.game.loop.time + CPU_ROULETTE_MS;
    this.rouletteStep = -1;
    this.refresh();
  }

  private spinCpuChoice(time: number): void {
    const cpu = this.sides[1];
    if (time >= this.rouletteUntil) {
      this.rouletteUntil = 0;
      cpu.choosing = false;
      cpu.locked = true;
      this.refresh();
      sfx.bell();
      this.launchAt = time + LAUNCH_MS;
      return;
    }
    const step = Math.floor(time / ROULETTE_STEP_MS);
    if (step === this.rouletteStep) return;
    this.rouletteStep = step;
    const pick = PLAYABLE[Phaser.Math.Between(0, PLAYABLE.length - 1)];
    this.point(1, this.rosterIndex(pick.id));
    this.refresh();
  }

  private flashUnavailable(index: number): void {
    const side = this.sides[index];
    side.state.setText('NOT IN THIS BUILD', { color: UI.red });
    this.tweens.add({
      targets: side.state.image,
      alpha: { from: 1, to: 0.25 },
      duration: 110,
      yoyo: true,
      repeat: 2,
      onComplete: () => side.state.setAlpha(1),
    });
  }

  private refresh(): void {
    for (let i = 0; i < 2; i += 1) {
      const side = this.sides[i];
      const entry = side.cursor >= 0 ? ROSTER[side.cursor] : null;
      const showCursor = entry !== null && !side.choosing;

      side.cursorFrame.setVisible(showCursor).setPosition(this.cellX(Math.max(0, side.cursor)), CELL_Y);
      side.cursorFrame.setStrokeStyle(2, i === 0 ? 0xffc24a : 0x8fd8ff, side.locked ? 1 : 0.7);
      side.tag.setVisible(showCursor).setPosition(this.cellX(Math.max(0, side.cursor)), CELL_Y + CELL / 2 + 15);

      if (!entry) {
        side.name.setText(i === 0 ? '' : 'CPU');
        side.role.setText('');
        side.tagline.setText(i === 0 ? '' : 'WAITING FOR 1P');
        side.state.setText('', { color: UI.dim });
        continue;
      }

      const playable = entry.status === 'playable';
      side.name.setText(side.choosing ? 'CPU' : entry.name);
      side.role.setText(entry.role);
      side.tagline.setText(entry.tagline);
      side.state.setText(
        side.choosing
          ? 'CHOOSING'
          : side.locked
            ? 'READY'
            : playable
              ? 'PRESS TO LOCK IN'
              : 'CONCEPT ART',
        { color: side.locked ? UI.green : playable ? UI.cream : UI.dim },
      );
      side.state.setAlpha(1);
    }

    this.hint.setText(this.hintText());
  }

  private hintText(): string {
    if (this.leaving) return 'HERE WE GO';
    if (this.versus) return '1P A D + J      2P ARROWS + ,      ESC BACK';
    if (isHandheld()) return 'PAD MOVES    A LOCKS IN    B BACK';
    return 'ARROWS MOVE    ENTER LOCKS IN    ESC BACK';
  }

  private bindKeys(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      sfx.unlock();
      this.idleSince = this.game.loop.time;
      switch (event.code) {
        case 'Escape':
        case 'Backspace':
          event.preventDefault();
          if (!this.leaving) this.scene.start('title');
          break;
        case 'KeyA':
          event.preventDefault();
          this.move(0, -1);
          break;
        case 'KeyD':
          event.preventDefault();
          this.move(0, 1);
          break;
        // Against the CPU both key sets drive player one, so nobody has to be
        // told which half of the keyboard this screen wants.
        case 'ArrowLeft':
          event.preventDefault();
          this.move(this.versus ? 1 : 0, -1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          this.move(this.versus ? 1 : 0, 1);
          break;
        case 'Enter':
        case 'NumpadEnter':
        case 'Space':
        case 'KeyJ':
        case 'KeyK':
        case 'KeyL':
          event.preventDefault();
          this.confirm(0);
          break;
        case 'Comma':
        case 'Period':
        case 'Slash':
        case 'Numpad1':
        case 'Numpad2':
        case 'Numpad3':
          event.preventDefault();
          this.confirm(this.versus ? 1 : 0);
          break;
        default:
          break;
      }
    });
  }

  override update(time: number, delta: number): void {
    for (const side of this.sides) {
      if (!side.anims || side.cursor < 0) continue;
      side.elapsed += delta;
      // A locked fighter celebrates; the rest breathe.
      side.sprite.setFrame(side.anims.frameAtTime(side.locked ? 'victory' : 'idle', side.elapsed));
    }

    if (this.rouletteUntil > 0) this.spinCpuChoice(time);

    if (this.launchAt > 0 && time > this.launchAt) this.launch();
    else if (!this.leaving && this.launchAt === 0 && time - this.idleSince > IDLE_MS) {
      this.scene.start('title');
    }
  }

  private launch(): void {
    if (this.leaving) return;
    this.leaving = true;
    const picks: [string, string] = [
      ROSTER[this.sides[0].cursor].id,
      ROSTER[this.sides[1].cursor].id,
    ];
    this.settings = { ...this.settings, picks };
    this.registry.set(SETTINGS_KEY, this.settings);
    this.registry.set('scores', [0, 0]);
    this.refresh();
    sfx.announce(2);
    // The versus page announces the matchup and hands the same pair on; it
    // decides nothing, so this screen is still the only place picks are made.
    this.scene.start('versus', { mode: this.settings.mode, demo: false, picks });
  }
}
