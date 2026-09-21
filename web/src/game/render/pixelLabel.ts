import Phaser from 'phaser';
import { drawText, measure, padding } from './font';
import type { DrawTextOptions } from './font';

let uid = 0;

/**
 * A single line of bitmap text, backed by its own canvas texture.
 *
 * The canvas is only repainted when the string or style actually changes, so
 * a HUD full of labels costs nothing on a steady frame.
 */
export class PixelLabel {
  readonly image: Phaser.GameObjects.Image;
  private readonly key: string;
  private texture: Phaser.Textures.CanvasTexture;
  private current = '\u0000';
  private style: DrawTextOptions;
  /** Padding baked into the canvas for the outline and drop shadow. */
  private pad = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    style: DrawTextOptions = {},
    private readonly align: 'left' | 'center' | 'right' = 'left',
  ) {
    uid += 1;
    this.key = `pixel-label-${uid}`;
    this.style = style;
    this.texture = scene.textures.createCanvas(this.key, 8, 8) as Phaser.Textures.CanvasTexture;
    this.image = scene.add.image(x, y, this.key).setOrigin(0, 0);
    this.setText(text);
  }

  setText(text: string, style?: DrawTextOptions): this {
    if (style) this.style = { ...this.style, ...style };
    if (text === this.current && !style) return this;
    this.current = text;

    const scale = this.style.scale ?? 1;
    const pad = padding(this.style);
    this.pad = pad * scale;
    const size = measure(text, scale, this.style.gap);
    const w = Math.max(1, Math.ceil(size.width + pad * scale * 2));
    const h = Math.max(1, Math.ceil(size.height + pad * scale * 2));

    this.texture.setSize(w, h);
    const ctx = this.texture.context;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    drawText(ctx, text, pad * scale, pad * scale, this.style);
    this.texture.refresh();

    this.image.setTexture(this.key);
    this.image.setDisplaySize(w, h);
    this.applyAlign(w, h);
    return this;
  }

  /**
   * Anchors the image by the glyphs rather than by the padded canvas.
   *
   * Without this, a label with an outline and a drop shadow sits several
   * pixels lower than the y it was given, which is enough to push a
   * sub-heading into the heading above it.
   */
  private applyAlign(width: number, height: number): void {
    const px = width === 0 ? 0 : this.pad / width;
    const py = height === 0 ? 0 : this.pad / height;
    const originX = this.align === 'left' ? px : this.align === 'center' ? 0.5 : 1 - px;
    this.image.setOrigin(originX, py);
  }

  setPosition(x: number, y: number): this {
    this.image.setPosition(x, y);
    return this;
  }

  get visible(): boolean {
    return this.image.visible;
  }

  setVisible(value: boolean): this {
    this.image.setVisible(value);
    return this;
  }

  setAlpha(value: number): this {
    this.image.setAlpha(value);
    return this;
  }

  setDepth(value: number): this {
    this.image.setDepth(value);
    return this;
  }

  setScrollFactor(value: number): this {
    this.image.setScrollFactor(value);
    return this;
  }

  destroy(): void {
    this.image.destroy();
    this.scene.textures.remove(this.key);
  }
}
