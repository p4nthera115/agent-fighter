import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { UI } from '../ui';
import { PixelLabel } from '../render/pixelLabel';
import { AnimMap } from '../render/animMap';
import { silhouetteBounds } from '../render/silhouette';
import { VS_LAYOUT, wordTexture } from '../render/logo';
import { music } from '../audio/music';
import { FIGHT_THEME } from '../audio/songs';
import { sfx } from '../audio/sfx';
import { demoPair, matchNames, rosterEntry } from '../roster';
import type { Gauntlet } from '../gauntlet';
import { GAUNTLET_KEY, gauntletLabel } from '../gauntlet';
import type { Settings } from '../settings';
import { SETTINGS_KEY } from '../settings';
import { altTexKey, movesKey, sheetKey, texKey } from './PreloadScene';
import type { FightData } from './FightScene';

/**
 * The two portrait panels.
 *
 * Each one is a little under half the screen, leaving an 18 pixel gutter down
 * the middle for the mark to stand in, and the same nine pixel margin on the
 * outside as the gutter gives on the inside, so the pair sits centred.
 */
const PANEL_W = 222;
const PANEL_X: readonly [number, number] = [9, 249];
const PANEL_TOP = 38;
const PANEL_BOTTOM = 250;
/** The panel border, drawn behind the fighter so a head can cross it. */
const STROKE = 2;

/**
 * The nameplate, drawn *in front of* the fighter.
 *
 * This is the other half of the frame-breaking: the head comes over the top
 * edge and the legs go behind this, so the portrait reads as standing in the
 * panel rather than pasted onto it.
 */
const PLINTH_TOP = 206;

/** How far above its panel a head is placed. */
const HEAD_OVER = 8;
/** How far behind the nameplate the feet must end up, however short a fighter is. */
const MIN_SINK = 8;

/** Where a head is placed, and where the feet have to reach. */
const HEAD_Y = PANEL_TOP - HEAD_OVER;
const SINK_Y = PLINTH_TOP + MIN_SINK;

/**
 * Every portrait is drawn to the same silhouette height, which is exactly the
 * span between those two lines.
 *
 * Deriving it that way is what makes the frame-breaking work for the whole
 * cast at once: every fighter's head crosses the top edge by `HEAD_OVER` and
 * every fighter's feet finish `MIN_SINK` behind the nameplate, whether it is
 * 120 pixels of block or 92 of orb.
 *
 * The cost is that the scale is per-fighter and fractional — 1.53 for Clawd
 * against 2.0 for Grok Bot — where the match itself is always a whole
 * magnification. It is paid here and nowhere else: these are portraits held
 * still on a page that lasts two seconds, they only ever move by whole screen
 * pixels, and the alternative is a uniform scale at which the tallest fighter
 * overflows the panel and the shortest floats in front of its own nameplate.
 */
const PORTRAIT_H = SINK_Y - HEAD_Y;

/** The idle drift. Translation only: a fractional zoom would break the grid. */
const PAN_X = 4;
const PAN_Y = 3;
const PAN_X_MS = 5200;
const PAN_Y_MS = 3400;

/**
 * How far down the gutter the mark stands.
 *
 * Not the middle: every fighter's face is in the top third of its panel,
 * because the portraits are aligned by the head, and a mark centred between
 * the panel edges lands squarely on both of them. Sitting it low puts it
 * across the bodies instead.
 */
const MARK_Y = 146;

/** How far outside its panel a portrait starts before sliding in. */
const SLIDE_IN = 34;
/** When the mark lands, measured from the page opening. */
const SLAM_MS = 380;
/**
 * How long the page ignores input.
 *
 * Locking in is a keypress, and a key held down repeats, so without this the
 * button that chose the fighter arrives here a moment later and dismisses the
 * page before it has drawn a frame the player could read. The gate lasts
 * until the mark has landed, which is the point at which there is something
 * worth skipping.
 */
const SKIP_AFTER = SLAM_MS + 60;
/** How long the page holds before the match starts. */
const HOLD_MS = 2300;

interface Portrait {
  sprite: Phaser.GameObjects.Sprite;
  anims: AnimMap;
  /** Resting position, before the entrance and the drift are added. */
  baseX: number;
  baseY: number;
  /** 1 while the portrait is still outside its panel, 0 once it has landed. */
  slide: number;
  /** Which way this one slides in from. */
  direction: number;
  /** Offsets the drift so the two portraits are never in lockstep. */
  phase: number;
  elapsed: number;
}

/**
 * The versus page.
 *
 * It sits between the select screen and the match, and it is the one screen
 * in the game whose whole job is to say who is fighting whom. Nothing is
 * decided here: it is handed a `FightData` and passes the same one on, so the
 * pair the select screen wrote is the pair that fights.
 *
 * The fight music starts here rather than in `FightScene`, because
 * `music.play` is a no-op for a song already running: the track that opens
 * under the matchup is the same one that carries into the round, with no seam
 * at the scene change.
 */
export class VersusScene extends Phaser.Scene {
  private fight!: FightData;
  private settings!: Settings;
  private portraits: Portrait[] = [];
  private stripes: Phaser.GameObjects.TileSprite[] = [];
  /** Kept so they can be destroyed: a mask's shape is not a scene child. */
  private maskShapes: Phaser.GameObjects.Graphics[] = [];
  private mark!: Phaser.GameObjects.Image;
  private flash!: Phaser.GameObjects.Rectangle;
  private settled = false;
  private elapsed = 0;
  private startAt = 0;
  private skipFrom = 0;
  private leaving = false;

  constructor() {
    super('versus');
  }

  init(data: Partial<FightData>): void {
    const settings = this.registry.get(SETTINGS_KEY) as Settings;
    const demo = data.demo ?? false;
    this.fight = {
      mode: data.mode ?? 'cpu',
      demo,
      picks: data.picks ?? (demo ? demoPair() : settings.picks),
    };
    this.portraits = [];
    this.stripes = [];
    this.maskShapes = [];
    this.settled = false;
    this.elapsed = 0;
    this.leaving = false;
  }

  create(): void {
    this.settings = this.registry.get(SETTINGS_KEY) as Settings;
    this.startAt = this.game.loop.time + HOLD_MS;
    this.skipFrom = this.game.loop.time + SKIP_AFTER;

    this.add.image(0, 0, this.backdrop()).setOrigin(0, 0).setDepth(-50);

    const names = matchNames(this.fight.picks);
    for (let i = 0; i < 2; i += 1) this.buildPanel(i, names[i]);

    this.buildMark();

    new PixelLabel(this, VIEW_W / 2, VIEW_H - 14, this.footer(), {
      scale: 1,
      color: UI.dim,
      outline: UI.ink,
    }, 'center').setDepth(80);

    this.flash = this.add
      .rectangle(0, 0, VIEW_W, VIEW_H, 0xffffff, 0)
      .setOrigin(0, 0)
      .setDepth(200);

    music.setIntensity(1);
    music.play(FIGHT_THEME);

    this.playEntrance();

    // The page is short, and a player who has already seen it should not have
    // to watch it again.
    this.input.keyboard?.on('keydown', () => {
      sfx.unlock();
      this.skip();
    });
    this.input.on('pointerdown', () => {
      sfx.unlock();
      this.skip();
    });

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const shape of this.maskShapes) shape.destroy();
      this.maskShapes = [];
    });
  }

  /**
   * The page behind the panels.
   *
   * Deliberately darker than anything inside a panel, because the whole
   * overlap only reads if there is something for a head to be seen against
   * once it crosses the border.
   */
  private backdrop(): string {
    const key = 'versus-backdrop';
    if (this.textures.exists(key)) return key;

    const tex = this.textures.createCanvas(key, VIEW_W, VIEW_H) as Phaser.Textures.CanvasTexture;
    const ctx = tex.context;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0714';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // A shaft of light down the gutter, so the middle of the page is the
    // brightest part of it and the mark has something to stand on.
    const shaft = ctx.createLinearGradient(VIEW_W / 2 - 60, 0, VIEW_W / 2 + 60, 0);
    shaft.addColorStop(0, 'rgba(90,96,208,0)');
    shaft.addColorStop(0.5, 'rgba(120,128,255,0.22)');
    shaft.addColorStop(1, 'rgba(90,96,208,0)');
    ctx.fillStyle = shaft;
    ctx.fillRect(VIEW_W / 2 - 60, 0, 120, VIEW_H);

    // Hard pixel rules top and bottom, on the grid, to close the page off.
    ctx.fillStyle = '#2b2f8f';
    ctx.fillRect(0, 22, VIEW_W, 1);
    ctx.fillRect(0, VIEW_H - 23, VIEW_W, 1);

    tex.refresh();
    return key;
  }

  /** One 16x16 diagonal stripe, which tiles seamlessly along both axes. */
  private stripeTile(): string {
    const key = 'versus-stripe';
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, 16, 16) as Phaser.Textures.CanvasTexture;
    const ctx = tex.context;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 16; i += 1) ctx.fillRect((i + 12) % 16, i, 4, 1);
    tex.refresh();
    return key;
  }

  private buildPanel(index: number, name: string): void {
    const entry = rosterEntry(this.fight.picks[index]);
    const left = PANEL_X[index];
    const cx = left + PANEL_W / 2;
    const height = PANEL_BOTTOM - PANEL_TOP;
    const cy = PANEL_TOP + height / 2;
    const warm = index === 0;
    const accent = warm ? 0xffc24a : 0x8fd8ff;
    const accentText = warm ? UI.gold : UI.cyan;

    this.add.rectangle(cx, cy, PANEL_W, height, warm ? 0x341a3a : 0x1a2450).setDepth(10);

    const stripes = this.add
      .tileSprite(cx, cy, PANEL_W, height, this.stripeTile())
      .setAlpha(0.35)
      .setDepth(11);
    this.stripes.push(stripes);

    // A vertical lift inside the panel, brightest where the fighter stands.
    this.add
      .image(cx, cy, this.panelWash(warm))
      .setDepth(12);

    // Behind the fighter, so a head crosses it rather than stopping at it.
    this.add
      .rectangle(cx, cy, PANEL_W, height)
      .setStrokeStyle(STROKE, accent, 0.9)
      .setDepth(16);

    this.buildPortrait(index, cx);

    // The nameplate: in front of the portrait, which is what puts the fighter
    // behind the frame at the bottom.
    const plinthH = PANEL_BOTTOM - PLINTH_TOP;
    this.add
      .rectangle(cx, PLINTH_TOP + plinthH / 2, PANEL_W - STROKE * 2, plinthH, 0x0d0a1c, 0.96)
      .setDepth(30);
    this.add.rectangle(cx, PLINTH_TOP, PANEL_W - STROKE * 2, 2, accent, 0.9).setDepth(31);

    new PixelLabel(this, cx, PLINTH_TOP + 10, name, {
      scale: 2,
      color: accentText,
      shadow: UI.ink,
      shadowOffset: 1,
      outline: UI.ink,
    }, 'center').setDepth(34);

    new PixelLabel(this, cx, PLINTH_TOP + 29, entry.role, {
      scale: 1,
      color: UI.cream,
      outline: UI.ink,
    }, 'center').setDepth(34);

    // The player tab, hung off the top outer corner of the panel.
    const tabX = warm ? left + 24 : left + PANEL_W - 24;
    this.add.rectangle(tabX, PANEL_TOP, 44, 14, accent, 1).setDepth(40);
    new PixelLabel(this, tabX, PANEL_TOP - 3, this.sideTag(index), {
      scale: 1,
      color: '#160c22',
    }, 'center').setDepth(41);
  }

  /** The inside of a panel: a vertical lift, warm on the left, cool on the right. */
  private panelWash(warm: boolean): string {
    const key = `versus-wash-${warm ? 'warm' : 'cool'}`;
    if (this.textures.exists(key)) return key;
    const height = PANEL_BOTTOM - PANEL_TOP;
    const tex = this.textures.createCanvas(key, PANEL_W, height) as Phaser.Textures.CanvasTexture;
    const ctx = tex.context;
    ctx.imageSmoothingEnabled = false;
    const wash = ctx.createLinearGradient(0, 0, 0, height);
    wash.addColorStop(0, warm ? 'rgba(255,140,60,0.00)' : 'rgba(110,190,255,0.00)');
    wash.addColorStop(0.55, warm ? 'rgba(255,150,70,0.16)' : 'rgba(120,190,255,0.16)');
    wash.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, PANEL_W, height);
    tex.refresh();
    return key;
  }

  private sideTag(index: number): string {
    if (this.fight.demo) return 'CPU';
    if (index === 0) return '1P';
    return this.fight.mode === 'versus' ? '2P' : 'CPU';
  }

  /**
   * Stands a fighter in its panel.
   *
   * The framing is measured off the atlas rather than tabulated, so it stays
   * right when a sheet is redrawn — which matters, because four of the five
   * sheets are still first passes waiting to be hand-cleaned.
   *
   * Width is left to fall where it may. Only Clawd overflows its panel, by
   * seventeen art pixels a side, because its idle holds both arms out and is
   * half as wide again as it is tall; the fists crop and the block, the eyes
   * and the legs all stay.
   */
  private buildPortrait(index: number, cx: number): void {
    const id = this.fight.picks[index];
    const anims = new AnimMap(
      this.cache.json.get(sheetKey(id)),
      this.cache.json.get(movesKey(id)),
    );
    // Player two wears the palette swap only in a mirror match, which is the
    // rule the select screen and the match both use.
    const mirror = index === 1 && this.fight.picks[0] === this.fight.picks[1];
    const key = mirror ? altTexKey(id) : texKey(id);
    const idle = anims.clip('idle');
    const bounds = silhouetteBounds(this, key, idle.names);

    // Scaling by the measured height puts the head and the feet on their two
    // lines by construction, so there is nothing left to clamp.
    const scale = PORTRAIT_H / bounds.height;
    const baseY = HEAD_Y + (anims.origin.y - bounds.top) * scale;

    // The pivot is the standing foot, not the middle of the drawing, so the
    // portrait is centred on the silhouette it actually has.
    const silhouetteCx = (bounds.left + bounds.right) / 2;
    const flip = index === 1;
    const baseX = cx + (anims.origin.x - silhouetteCx) * scale * (flip ? -1 : 1);

    const sprite = this.add
      .sprite(Math.round(baseX), Math.round(baseY), key, idle.names[0])
      .setOrigin(anims.origin.x / anims.frame.w, anims.origin.y / anims.frame.h)
      .setScale(scale)
      .setFlipX(flip)
      .setDepth(20)
      .setAlpha(0);

    // Clipped to the panel's inside edges, which keeps the side borders crisp
    // while leaving the top open for the head to come over. The bottom is
    // covered by the nameplate rather than by the mask.
    const shape = this.make.graphics({}, false);
    shape.fillStyle(0xffffff);
    shape.fillRect(
      PANEL_X[index] + STROKE,
      0,
      PANEL_W - STROKE * 2,
      PANEL_BOTTOM,
    );
    sprite.setMask(shape.createGeometryMask());
    this.maskShapes.push(shape);

    this.portraits.push({
      sprite,
      anims,
      baseX: Math.round(baseX),
      baseY: Math.round(baseY),
      slide: 1,
      direction: index === 0 ? -1 : 1,
      phase: index === 0 ? 0 : Math.PI,
      elapsed: index * 180,
    });
  }

  private buildMark(): void {
    const key = wordTexture(this, 'versus-mark', VS_LAYOUT);

    // The mark leans, so the ink does not sit in the middle of its own canvas
    // — the top of the V is four pixels right of the bottom of it. Centring
    // the canvas would hang the whole thing off to one side of the gutter, so
    // the origin is put on the ink instead.
    const sheet = this.textures.get(key).getSourceImage();
    const ink = silhouetteBounds(this, key, ['__BASE']);
    this.mark = this.add
      .image(VIEW_W / 2, MARK_Y, key)
      .setOrigin(
        ((ink.left + ink.right + 1) / 2) / sheet.width,
        ((ink.top + ink.bottom + 1) / 2) / sheet.height,
      )
      .setDepth(62)
      .setScale(2.6)
      .setAlpha(0);
  }

  /**
   * The line under the panels.
   *
   * In a single-player run it is the only place the ladder is written down,
   * which is why it says where in the run this match falls rather than just
   * naming the difficulty.
   */
  private footer(): string {
    if (this.fight.demo) return 'DEMO - PRESS ANY KEY';
    if (this.fight.mode === 'versus') return '2 PLAYER MATCH';
    const difficulty = this.settings.difficulty.toUpperCase();
    const run = this.registry.get(GAUNTLET_KEY) as Gauntlet | null;
    const inRun = run && run.player === this.fight.picks[0] && run.opponents.length > 1;
    return inRun ? `${gauntletLabel(run)}  -  ${difficulty}` : `CPU - ${difficulty}`;
  }

  private playEntrance(): void {
    for (const portrait of this.portraits) {
      this.tweens.add({
        targets: portrait,
        slide: 0,
        duration: 420,
        ease: 'Cubic.easeOut',
      });
      this.tweens.add({
        targets: portrait.sprite,
        alpha: 1,
        duration: 220,
      });
    }
    sfx.announce(0);
    this.time.delayedCall(140, () => sfx.announce(1));

    this.time.delayedCall(SLAM_MS, () => {
      this.mark.setAlpha(1);
      this.tweens.add({
        targets: this.mark,
        scale: 1,
        duration: 220,
        ease: 'Back.easeOut',
        onComplete: () => this.mark.setScale(1),
      });
      this.flash.setAlpha(0.5);
      this.tweens.add({ targets: this.flash, alpha: 0, duration: 190 });
      this.cameras.main.shake(190, 0.008);
      sfx.bell();
      sfx.land(true);
      this.settled = true;
    });
  }

  override update(time: number, delta: number): void {
    this.elapsed += delta;

    for (const portrait of this.portraits) {
      portrait.elapsed += delta;
      portrait.sprite.setFrame(portrait.anims.frameAtTime('idle', portrait.elapsed));

      // The drift only starts once the portrait has landed, so the entrance
      // and the idle pan never pull in opposite directions.
      const drift = this.settled ? 1 : 0;
      const panX = Math.sin((this.elapsed / PAN_X_MS) * Math.PI * 2 + portrait.phase) * PAN_X;
      const panY = Math.sin((this.elapsed / PAN_Y_MS) * Math.PI * 2 + portrait.phase) * PAN_Y;
      portrait.sprite.setPosition(
        Math.round(portrait.baseX + portrait.slide * portrait.direction * SLIDE_IN + drift * panX),
        Math.round(portrait.baseY + drift * panY),
      );
    }

    for (let i = 0; i < this.stripes.length; i += 1) {
      const way = i === 0 ? 1 : -1;
      this.stripes[i].tilePositionX -= (delta / 1000) * 9 * way;
      this.stripes[i].tilePositionY -= (delta / 1000) * 9 * way;
    }

    if (!this.leaving && time >= this.startAt) this.launch();
  }

  /**
   * Any input drops the page.
   *
   * In the attract cycle that means going back to the menu, the same as every
   * other attract screen; for a player who chose this match it means starting
   * it now rather than waiting out the hold.
   */
  private skip(): void {
    if (this.leaving || this.game.loop.time < this.skipFrom) return;
    if (this.fight.demo) {
      this.leaving = true;
      this.scene.start('title');
      return;
    }
    this.launch();
  }

  private launch(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('fight', this.fight);
  }
}
