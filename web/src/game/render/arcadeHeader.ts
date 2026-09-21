import Phaser from 'phaser';
import { VIEW_W } from '../constants';
import { UI } from '../ui';
import { formatScore } from '../score';
import { PixelLabel } from './pixelLabel';

/**
 * The 1UP / HI-SCORE / 2UP strip every cabinet puts along the top of the
 * screen. Shared by the title screen and the match, so the scores never appear
 * to jump between them.
 */
export class ArcadeHeader {
  private readonly p1: PixelLabel;
  private readonly p2: PixelLabel;
  private readonly hi: PixelLabel;
  private readonly p1Tag: PixelLabel;
  private readonly p2Tag: PixelLabel;
  private readonly hiTag: PixelLabel;
  private blinkAt = 0;

  constructor(scene: Phaser.Scene, y = 4, depth = 102) {
    const tag = { scale: 1, color: UI.cyan, outline: UI.ink };
    const value = { scale: 1, color: UI.cream, outline: UI.ink };

    this.p1Tag = new PixelLabel(scene, 14, y, '1UP', tag).setScrollFactor(0).setDepth(depth);
    this.p1 = new PixelLabel(scene, 14, y + 9, '0000000', value).setScrollFactor(0).setDepth(depth);

    this.hiTag = new PixelLabel(scene, VIEW_W / 2, y, 'HI-SCORE', { ...tag, color: UI.gold }, 'center')
      .setScrollFactor(0)
      .setDepth(depth);
    this.hi = new PixelLabel(scene, VIEW_W / 2, y + 9, '0000000', value, 'center')
      .setScrollFactor(0)
      .setDepth(depth);

    this.p2Tag = new PixelLabel(scene, VIEW_W - 14, y, '2UP', tag, 'right')
      .setScrollFactor(0)
      .setDepth(depth);
    this.p2 = new PixelLabel(scene, VIEW_W - 14, y + 9, '0000000', value, 'right')
      .setScrollFactor(0)
      .setDepth(depth);
  }

  update(time: number, scores: [number, number], hiScore: number, twoPlayer: boolean): void {
    this.p1.setText(formatScore(scores[0]));
    this.p2.setText(formatScore(scores[1]));
    this.hi.setText(formatScore(hiScore));

    // The active player's tag blinks, which is how a cabinet shows whose
    // score is live.
    if (time - this.blinkAt > 480) {
      this.blinkAt = time;
      this.p1Tag.setAlpha(this.p1Tag.image.alpha < 1 ? 1 : 0.25);
      this.p2Tag.setAlpha(twoPlayer ? (this.p2Tag.image.alpha < 1 ? 1 : 0.25) : 0.3);
    }
    this.p2.setAlpha(twoPlayer ? 1 : 0.35);
  }

  setVisible(value: boolean): void {
    for (const label of [this.p1, this.p2, this.hi, this.p1Tag, this.p2Tag, this.hiTag]) {
      label.setVisible(value);
    }
  }
}
