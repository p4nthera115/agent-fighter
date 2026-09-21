import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { FIELD } from '../ui';

/**
 * The flat blue field the cabinet's own screens sit on.
 *
 * Drawn once into a canvas texture: a grid, a few darker blocks for texture,
 * and a soft diagonal sweep. The CRT glass effects live in the page around the
 * canvas, so this stays deliberately plain.
 */
export function addField(scene: Phaser.Scene, depth = -50): Phaser.GameObjects.Image {
  const key = 'ui-field';
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, VIEW_W, VIEW_H) as Phaser.Textures.CanvasTexture;
    const ctx = tex.context;
    ctx.imageSmoothingEnabled = false;

    const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
    ctx.fillStyle = hex(FIELD.base);
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Blocky panels, on the grid, at a handful of fixed positions.
    ctx.fillStyle = hex(FIELD.block);
    const blocks: Array<[number, number, number, number]> = [
      [0, 48, 112, 64],
      [128, 16, 64, 48],
      [352, 32, 128, 96],
      [64, 176, 96, 48],
      [288, 192, 160, 64],
      [208, 96, 64, 32],
    ];
    for (const [x, y, w, h] of blocks) ctx.fillRect(x, y, w, h);

    ctx.fillStyle = hex(FIELD.line);
    for (let x = 0; x <= VIEW_W; x += 16) ctx.fillRect(x, 0, 1, VIEW_H);
    for (let y = 0; y <= VIEW_H; y += 16) ctx.fillRect(0, y, VIEW_W, 1);

    // A wide diagonal lift across the upper right, the way a tube catches the
    // room it is standing in.
    const sweep = ctx.createLinearGradient(VIEW_W * 0.3, VIEW_H, VIEW_W, 0);
    sweep.addColorStop(0, 'rgba(255,255,255,0)');
    sweep.addColorStop(0.62, 'rgba(255,255,255,0.05)');
    sweep.addColorStop(0.78, 'rgba(255,255,255,0.09)');
    sweep.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    tex.refresh();
  }
  return scene.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
}
