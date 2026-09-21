import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { registerRecoloredAtlas } from '../render/palette';
import { drawText } from '../render/font';
import { FIELD, UI } from '../ui';
import { PLAYABLE, ROSTER } from '../roster';
import { loadHiScore } from '../score';

/** Cache keys, derived from the fighter id so the cast stays data-driven. */
export const texKey = (id: string): string => `fighter-${id}`;
/** Player two's costume: the same atlas, recoloured at load time. */
export const altTexKey = (id: string): string => `fighter-${id}-alt`;
export const sheetKey = (id: string): string => `${id}-sheet`;
export const movesKey = (id: string): string => `${id}-moves`;
export const thumbKey = (id: string): string => `cast-${id}`;

const BASE = `${import.meta.env.BASE_URL}assets/`;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('preload');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(FIELD.deep);
    this.drawSplash();

    const bar = this.add.rectangle(VIEW_W / 2 - 80, VIEW_H / 2 + 22, 0, 6, 0xffc24a).setOrigin(0, 0);
    this.add
      .rectangle(VIEW_W / 2 - 81, VIEW_H / 2 + 21, 162, 8)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x3a40b0);
    this.load.on('progress', (value: number) => {
      bar.width = Math.round(160 * value);
    });

    // The exported PNG and JSON are the runtime source of truth; the .ase
    // files stay authoring-only, exactly as the project brief requires.
    for (const entry of PLAYABLE) {
      const art = entry.art!;
      const png = `${BASE}${art.dir}/${art.base}-sheet.png`;
      const json = `${BASE}${art.dir}/${art.base}-sheet.json`;
      const ultimate = `${BASE}ultimates/${entry.id}/`;
      this.load.atlas(`ultimate-${entry.id}`, `${ultimate}character-sheet.png`, `${ultimate}character-sheet.json`);
      this.load.json(`ultimate-${entry.id}-json`, `${ultimate}character-sheet.json`);
      this.load.atlas(`ultimate-fx-${entry.id}`, `${ultimate}effects-sheet.png`, `${ultimate}effects-sheet.json`);
      this.load.atlas(texKey(entry.id), png, json);
      this.load.json(sheetKey(entry.id), json);
      this.load.json(movesKey(entry.id), `${BASE}${art.dir}/${art.base}-moves.json`);
    }
    for (const entry of ROSTER) {
      this.load.image(thumbKey(entry.id), `${BASE}roster/${entry.id}-thumb.png`);
    }
  }

  create(): void {
    for (const entry of PLAYABLE) {
      registerRecoloredAtlas(this, `ultimate-${entry.id}`, `ultimate-${entry.id}-alt`, `ultimate-${entry.id}-json`, entry.art!.alt);
      registerRecoloredAtlas(
        this,
        texKey(entry.id),
        altTexKey(entry.id),
        sheetKey(entry.id),
        entry.art!.alt,
      );
    }
    this.registry.set('hiScore', loadHiScore());
    this.registry.set('scores', [0, 0]);
    this.scene.start('title');
  }

  private drawSplash(): void {
    const key = 'preload-title';
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, 240, 24) as Phaser.Textures.CanvasTexture;
      const ctx = tex.context;
      ctx.imageSmoothingEnabled = false;
      drawText(ctx, 'WARMING UP THE TUBE', 3, 3, {
        scale: 2,
        color: UI.gold,
        outline: UI.ink,
      });
      tex.refresh();
    }
    this.add.image(VIEW_W / 2, VIEW_H / 2 - 10, key).setOrigin(0.5, 0.5);
  }
}
