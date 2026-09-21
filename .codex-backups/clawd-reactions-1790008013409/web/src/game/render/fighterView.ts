import Phaser from 'phaser';
import { FLOOR_Y, FRAME_H, FRAME_W, ORIGIN_X, ORIGIN_Y, PALETTE } from '../constants';
import type { Fighter } from '../combat/fighter';
import type { AnimMap } from './animMap';

const ORIGIN_FX = ORIGIN_X / FRAME_W;
const ORIGIN_FY = ORIGIN_Y / FRAME_H;

/** Walk cycle borrows the idle frames at a brisker, fixed cadence. */
const WALK_FRAME_MS = 85;

/**
 * Draws one fighter.
 *
 * All motion here is cosmetic: squash on a crouch, stretch at the top of a
 * jump, a lean during hitstun. None of it feeds back into the simulation, so
 * the look can be tuned freely without touching frame data.
 */
export class FighterView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private elapsed = 0;
  private landSquash = 0;
  private lastGrounded = true;

  constructor(
    scene: Phaser.Scene,
    private readonly fighter: Fighter,
    private readonly anims: AnimMap,
    textureKey: string,
  ) {
    this.shadow = scene.add
      .ellipse(fighter.x, FLOOR_Y + 2, 96, 16, PALETTE.shadow, 0.42)
      .setDepth(4);
    this.sprite = scene.add
      .sprite(fighter.x, FLOOR_Y, textureKey, this.anims.clip('idle').names[0])
      .setOrigin(ORIGIN_FX, ORIGIN_FY)
      .setDepth(10);
  }

  /** `delta` is real elapsed milliseconds; hitstop pauses cosmetic time too. */
  update(delta: number): void {
    const f = this.fighter;
    if (f.hitstop === 0) this.elapsed += delta;

    if (this.landSquash > 0) this.landSquash = Math.max(0, this.landSquash - delta / 110);
    if (!this.lastGrounded && !f.airborne) this.landSquash = 1;
    this.lastGrounded = !f.airborne;

    this.sprite.setFrame(this.pickFrame());
    this.sprite.setFlipX(f.facing === -1);
    this.sprite.setPosition(Math.round(f.x), Math.round(FLOOR_Y - f.y));

    const { scaleX, scaleY, rotation } = this.pickDeformation();
    this.sprite.setScale(scaleX, scaleY);
    this.sprite.setRotation(rotation);

    // Hit flash: a single white frame sells contact more cheaply than any
    // particle does, then two warmer frames ease out of it.
    if (f.flash > 2) this.sprite.setTintFill(0xffffff);
    else if (f.flash > 0) this.sprite.setTintFill(PALETTE.cream);
    else this.sprite.clearTint();

    if (f.invuln > 0 && f.action === 'wakeup') {
      this.sprite.setAlpha(Math.floor(this.elapsed / 60) % 2 === 0 ? 0.45 : 1);
    } else {
      this.sprite.setAlpha(1);
    }

    const lift = Phaser.Math.Clamp(1 - f.y / 190, 0.28, 1);
    this.shadow.setPosition(Math.round(f.x), FLOOR_Y + 2);
    this.shadow.setDisplaySize(96 * lift, 16 * lift);
    this.shadow.setAlpha(0.42 * lift);
  }

  private pickFrame(): string {
    const f = this.fighter;
    const idle = this.anims.clip('idle');

    switch (f.action) {
      case 'attack':
        return this.anims.attackFrame(f);
      case 'knockdown':
      case 'ko':
        return idle.names[0];
      case 'wakeup':
        return idle.names[2];
      case 'hitstun':
        return idle.names[f.airborne ? 3 : 0];
      case 'blockstun':
        return idle.names[5];
      default:
        break;
    }

    if (f.airborne) return idle.names[f.vy > 0 ? 3 : 4];
    if (f.stance === 'crouch') return idle.names[0];
    if (f.blocking) return idle.names[5];
    if (Math.abs(f.vx) > 0.4) {
      const step = Math.floor(this.elapsed / WALK_FRAME_MS) % idle.names.length;
      return idle.names[step];
    }
    return this.anims.frameAtTime('idle', this.elapsed);
  }

  private pickDeformation(): { scaleX: number; scaleY: number; rotation: number } {
    const f = this.fighter;
    let scaleX = 1;
    let scaleY = 1;
    let rotation = 0;

    if (f.action === 'knockdown' || f.action === 'ko') {
      const progress =
        f.action === 'ko' ? 1 : 1 - Phaser.Math.Clamp(f.stunTimer / 26, 0, 1);
      rotation = f.facing * -1.35 * Math.min(1, progress * 3);
      scaleY = 1 - 0.06 * Math.min(1, progress * 3);
    } else if (f.action === 'wakeup') {
      const progress = 1 - Phaser.Math.Clamp(f.stunTimer / 12, 0, 1);
      rotation = f.facing * -1.35 * (1 - progress);
      scaleY = 0.9 + 0.1 * progress;
    } else if (f.action === 'hitstun') {
      rotation = f.facing * 0.1;
      scaleX = 0.97;
      scaleY = 1.01;
    } else if (f.action === 'blockstun' || (f.blocking && f.actionable)) {
      scaleX = 0.93;
      scaleY = 1.01;
    } else if (f.stance === 'crouch' && !f.airborne) {
      scaleX = 1.12;
      scaleY = 0.66;
    } else if (f.airborne) {
      const stretch = Phaser.Math.Clamp(f.vy / 14, -1, 1);
      scaleY = 1 + stretch * 0.12;
      scaleX = 1 - stretch * 0.1;
    }

    if (this.landSquash > 0) {
      scaleY *= 1 - 0.18 * this.landSquash;
      scaleX *= 1 + 0.14 * this.landSquash;
    }

    // Mirroring is handled by flipX, so scaleX stays positive here.
    return { scaleX, scaleY, rotation };
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
