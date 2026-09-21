import Phaser from 'phaser';
import { PALETTE, VIEW_W } from '../constants';
import { RULES } from '../combat/frameData';
import type { Match } from '../combat/match';
import { PixelLabel } from './pixelLabel';
import { measure } from './font';
import { ArcadeHeader } from './arcadeHeader';

const BAR_W = 196;
const BAR_H = 10;
/** Below the 1UP / HI-SCORE / 2UP strip. */
const BAR_Y = 26;
const EDGE = 14;
/** Round pips: size, spacing, and how far in they sit beside a short name. */
const PIP_SIZE = 6;
const PIP_STEP = 10;
const PIP_MIN_OFFSET = 58;

interface Side {
  frame: Phaser.GameObjects.Rectangle;
  drain: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  name: PixelLabel;
  pips: Phaser.GameObjects.Rectangle[];
  /** Lagging health, so chip and combos read as a drain rather than a jump. */
  ghost: number;
  combo: PixelLabel;
  comboLife: number;
}

/**
 * The heads-up display.
 *
 * Everything is drawn in view space with a zero scroll factor, on the same
 * pixel grid as the fighters, so nothing shimmers when the camera moves.
 */
export class Hud {
  private readonly sides: [Side, Side];
  private readonly timer: PixelLabel;
  private readonly announce: PixelLabel;
  private readonly subAnnounce: PixelLabel;
  private readonly announcePlate: Phaser.GameObjects.Rectangle;
  private readonly header: ArcadeHeader;
  private announceLife = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly match: Match,
  ) {
    this.sides = [this.buildSide(0), this.buildSide(1)];
    this.header = new ArcadeHeader(scene, 4);

    this.timer = new PixelLabel(scene, VIEW_W / 2, BAR_Y - 2, '60', {
      scale: 3,
      color: '#ffe0ad',
      outline: '#0a0e20',
    }, 'center')
      .setScrollFactor(0)
      .setDepth(102);

    // A band behind the announcement: white-on-outline alone loses against a
    // busy stage, and this text has to be readable during the noisiest frame
    // of the match.
    this.announcePlate = scene.add
      .rectangle(0, 52, VIEW_W, 62, 0x05070f, 0.6)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(109)
      .setVisible(false);

    this.announce = new PixelLabel(scene, VIEW_W / 2, 60, '', {
      scale: 5,
      color: '#ffffff',
      outline: '#35100e',
      shadow: 'rgba(10,14,32,0.65)',
      shadowOffset: 2,
    }, 'center')
      .setScrollFactor(0)
      .setDepth(110)
      .setVisible(false);

    this.subAnnounce = new PixelLabel(scene, VIEW_W / 2, 98, '', {
      scale: 2,
      color: '#ffb483',
      outline: '#35100e',
    }, 'center')
      .setScrollFactor(0)
      .setDepth(110)
      .setVisible(false);
  }

  private buildSide(index: number): Side {
    const scene = this.scene;
    const mirrored = index === 1;
    const x = mirrored ? VIEW_W - EDGE - BAR_W : EDGE;

    const frame = scene.add
      .rectangle(x - 2, BAR_Y - 2, BAR_W + 4, BAR_H + 4, 0x0a0e20, 0.9)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setStrokeStyle(1, 0x7a6480, 0.9);

    const drain = scene.add
      .rectangle(mirrored ? x + BAR_W : x, BAR_Y, BAR_W, BAR_H, 0xc0392b)
      .setOrigin(mirrored ? 1 : 0, 0)
      .setScrollFactor(0)
      .setDepth(101);

    const fill = scene.add
      .rectangle(mirrored ? x + BAR_W : x, BAR_Y, BAR_W, BAR_H, PALETTE.bright)
      .setOrigin(mirrored ? 1 : 0, 0)
      .setScrollFactor(0)
      .setDepth(102);

    const name = new PixelLabel(
      scene,
      mirrored ? VIEW_W - EDGE : EDGE,
      BAR_Y + BAR_H + 6,
      '',
      { scale: 1, color: '#ffe0ad', outline: '#0a0e20' },
      mirrored ? 'right' : 'left',
    )
      .setScrollFactor(0)
      .setDepth(102);

    // Round pips sit beside the fighter's name rather than under the clock,
    // where they would crowd the timer digits. `setNames` moves them to clear
    // whatever name they end up beside.
    const pips: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < RULES.roundsToWin; i += 1) {
      const offset = PIP_MIN_OFFSET + i * PIP_STEP;
      const px = mirrored ? VIEW_W - EDGE - offset : EDGE + offset;
      pips.push(
        scene.add
          .rectangle(px, BAR_Y + BAR_H + 9, PIP_SIZE, PIP_SIZE, 0x0a0e20)
          .setScrollFactor(0)
          .setDepth(102)
          .setStrokeStyle(1, 0x7a6480, 0.9),
      );
    }

    const combo = new PixelLabel(
      scene,
      mirrored ? VIEW_W - EDGE : EDGE,
      64,
      '',
      { scale: 2, color: '#ffffff', outline: '#35100e' },
      mirrored ? 'right' : 'left',
    )
      .setScrollFactor(0)
      .setDepth(103)
      .setVisible(false);

    return { frame, drain, fill, name, pips, ghost: RULES.maxHealth, combo, comboLife: 0 };
  }

  setNames(a: string, b: string): void {
    const names = [a.toUpperCase(), b.toUpperCase()];
    for (let i = 0; i < 2; i += 1) {
      this.sides[i].name.setText(names[i]);
      this.placePips(i, names[i]);
    }
  }

  /**
   * Slides the round pips clear of the name they sit beside.
   *
   * A fixed offset only works while every name is short. "OPENCLAW-II" is
   * eleven characters, which runs straight under the first pip, so the gap is
   * measured from the text instead — and clamped so the last pip stays on the
   * health bar however long a name gets.
   */
  private placePips(index: number, name: string): void {
    const side = this.sides[index];
    const count = side.pips.length;
    const wanted = Math.ceil(measure(name, 1).width) + 8;
    const limit = BAR_W - PIP_SIZE - (count - 1) * PIP_STEP;
    const base = Math.min(Math.max(PIP_MIN_OFFSET, wanted), limit);
    for (let i = 0; i < count; i += 1) {
      const offset = base + i * PIP_STEP;
      side.pips[i].x = index === 1 ? VIEW_W - EDGE - offset : EDGE + offset;
    }
  }

  /** Big centre text. `life` is milliseconds. */
  say(text: string, sub = '', life = 1100): void {
    this.announce.setText(text).setVisible(true).setAlpha(1);
    this.subAnnounce.setText(sub).setVisible(sub.length > 0).setAlpha(1);
    this.announcePlate.setVisible(true).setAlpha(0.6);
    this.announcePlate.height = sub.length > 0 ? 62 : 44;
    this.announceLife = life;
  }

  /** Mirrors the cabinet's score strip; called with the scene clock. */
  updateHeader(time: number, hiScore: number, twoPlayer: boolean): void {
    this.header.update(
      time,
      // Against the CPU there is no second player, so 2UP stays at zero
      // rather than advertising the machine's own score.
      [this.match.fighters[0].score, twoPlayer ? this.match.fighters[1].score : 0],
      hiScore,
      twoPlayer,
    );
  }

  update(delta: number): void {
    for (let i = 0; i < 2; i += 1) {
      const side = this.sides[i];
      const fighter = this.match.fighters[i];
      const ratio = fighter.health / RULES.maxHealth;

      side.ghost += (fighter.health - side.ghost) * Math.min(1, delta / 260);
      if (side.ghost < fighter.health) side.ghost = fighter.health;

      side.fill.width = Math.max(0, Math.round(BAR_W * ratio));
      side.drain.width = Math.max(0, Math.round(BAR_W * (side.ghost / RULES.maxHealth)));
      side.fill.fillColor = ratio < 0.25 ? 0xff5a4a : ratio < 0.5 ? PALETTE.light : PALETTE.bright;

      for (let p = 0; p < side.pips.length; p += 1) {
        side.pips[p].fillColor = p < fighter.wins ? PALETTE.bright : 0x0a0e20;
      }

      const opponent = this.match.fighters[1 - i];
      if (fighter.comboCount > 1) {
        side.combo.setText(`${fighter.comboCount} HIT`);
        side.combo.setVisible(true).setAlpha(1);
        side.comboLife = 900;
      } else if (side.comboLife > 0) {
        side.comboLife -= delta;
        side.combo.setAlpha(Math.min(1, side.comboLife / 300));
        if (side.comboLife <= 0) side.combo.setVisible(false);
      }
      void opponent;
    }

    this.timer.setText(`${this.match.secondsLeft}`.padStart(2, '0'), {
      color: this.match.secondsLeft <= 10 ? '#ff5a4a' : '#ffe0ad',
    });

    if (this.announceLife > 0) {
      this.announceLife -= delta;
      const fade = Math.min(1, this.announceLife / 260);
      this.announce.setAlpha(fade);
      this.subAnnounce.setAlpha(fade);
      this.announcePlate.setAlpha(0.6 * fade);
      if (this.announceLife <= 0) {
        this.announce.setVisible(false);
        this.subAnnounce.setVisible(false);
        this.announcePlate.setVisible(false);
      }
    }
  }
}
