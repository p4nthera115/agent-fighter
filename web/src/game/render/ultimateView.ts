import Phaser from 'phaser';
import { FLOOR_Y, STAGE_W, VIEW_H, VIEW_W } from '../constants';
import type { Match } from '../combat/match';
import { ACTOR_STARTS, EFFECT_STARTS, ULTIMATES, ULTIMATE_INTRO, ULTIMATE_LENGTH, ultimateFrame } from '../combat/ultimates';
import type { FighterView } from './fighterView';
import { PixelLabel } from './pixelLabel';

// Visible bottom of each untrimmed FX cel, measured from the exported alpha.
const EFFECT_BOTTOMS = {
  clawd: [272, 256, 280, 212, 255, 296, 291, 271],
  grok: [289, 282, 283, 227, 296, 304, 298, 286],
  muse: [243, 293, 292, 287, 308, 242, 297, 229],
  codex: [226, 229, 255, 271, 272, 237, 294, 263],
  openclaw: [226, 227, 229, 263, 291, 290, 281, 251],
};

/** Presentation follows simulation time, so pause and restart cannot strand a cut-in. */
export class UltimateView {
  private actor: Phaser.GameObjects.Sprite;
  private effect: Phaser.GameObjects.Sprite;
  private world: Phaser.GameObjects.Graphics;
  private title: PixelLabel;
  readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(scene: Phaser.Scene, private match: Match, private views: [FighterView, FighterView]) {
    this.world = scene.add.graphics().setDepth(2);
    this.actor = scene.add.sprite(0, 0, 'ultimate-clawd', 'ultimate-0').setOrigin(106 / 224, 136 / 160).setDepth(12).setVisible(false);
    this.effect = scene.add.sprite(0, 0, 'ultimate-fx-clawd', 'ultimate-0').setOrigin(0.5).setDepth(14).setVisible(false);
    this.title = new PixelLabel(scene, VIEW_W / 2, 66, '', { scale: 2, color: '#fff4dc', outline: '#080b1c' }, 'center')
      .setDepth(112).setScrollFactor(0).setVisible(false);
  }

  update(): void {
    const u = this.match.ultimate;
    this.world.clear();
    this.actor.setVisible(!!u);
    this.effect.setVisible(!!u && u.tick >= ULTIMATE_INTRO);
    this.title.setVisible(!!u);
    this.views.forEach(view => view.sprite.setVisible(true));
    if (!u) return;
    const def = ULTIMATES[u.id];
    const t = u.tick, dir = u.facing;
    const fade = Math.min(1, (t + 1) / 8, (ULTIMATE_LENGTH - t) / 16);
    const target = u.sourceX + dir * Math.min(def.range, Math.abs(u.targetX - u.sourceX));
    const actorStarts = u.id === 'grok' ? [0, 36, 52, 70, 86, 102, 118, 132] : ACTOR_STARTS;
    const effectStarts = u.id === 'grok' ? [36, 60, 76, 88, 96, 110, 118, 132]
      : u.id === 'muse' ? [36, 46, 58, 76, 86, 96, 104, 126] : EFFECT_STARTS;
    const actorFrame = ultimateFrame(t, actorStarts);
    const effectFrame = ultimateFrame(t, effectStarts);
    const alt = u.attacker === 1 && this.match.picks[0] === this.match.picks[1] ? '-alt' : '';
    this.views[u.attacker].sprite.setVisible(false);
    this.actor.setTexture(`ultimate-${u.id}${alt}`, `ultimate-${actorFrame}`)
      .setPosition(u.sourceX, FLOOR_Y).setFlipX(dir === -1).setScale(u.id === 'clawd' ? 1.25 : 1);
    this.effect.setTexture(`ultimate-fx-${u.id}`, `ultimate-${effectFrame}`)
      .setFlipX(dir === -1).setScale(0.65).setAlpha(fade).setPosition(target, FLOOR_Y - 82);
    this.title.setText(def.name).setAlpha(fade);

    switch (u.id) {
      case 'clawd': {
        const flight = Phaser.Math.Clamp((t - 70) / 12, 0, 1);
        const x = effectFrame < 3 ? u.sourceX + dir * 40 : effectFrame === 3
          ? Phaser.Math.Linear(u.sourceX + dir * 50, target, flight) : target;
        this.effect.setPosition(x, FLOOR_Y - 82).setScale(effectFrame < 3 ? 0.42 : 0.65);
        break;
      }
      case 'grok': {
        if (t >= 52 && t < 118) {
          const x = Phaser.Math.Linear(u.sourceX, target - dir * 45, Math.min(1, (t - 52) / 8));
          const lift = t < 70 ? 32 * Math.sin((t - 52) / 18 * Math.PI) : t >= 102 ? 48 * Math.sin((t - 102) / 16 * Math.PI) : 0;
          this.actor.setPosition(x, FLOOR_Y - lift);
        } else if (t >= 118) this.actor.setPosition(Phaser.Math.Linear(target - dir * 45, u.sourceX, Math.min(1, (t - 118) / 14)), FLOOR_Y);
        this.effect.setPosition(target, FLOOR_Y - (effectFrame === 5 ? 25 : 64));
        break;
      }
      case 'muse':
        this.effect.setPosition(effectFrame < 2 ? u.sourceX + dir * 55 : target - dir * 22, FLOOR_Y - 88).setScale(0.72);
        if (u.outcome === 'hit' && t >= 78 && t < 126) {
          const lift = t < 104 ? 20 * Math.sin((t - 78) / 26 * Math.PI) : 60 * Math.sin((t - 104) / 22 * Math.PI);
          this.views[u.victim].sprite.y -= lift;
        }
        break;
      case 'codex':
        this.effect.setPosition(effectFrame < 2 ? u.sourceX + dir * 55 : target, FLOOR_Y - 65)
          .setScale(effectFrame < 2 ? 0.42 : 0.68);
        break;
      case 'openclaw': {
        const march = Phaser.Math.Clamp((t - 36) / 32, 0, 1);
        this.effect.setPosition(effectFrame < 3 ? Phaser.Math.Linear(u.sourceX + dir * 50, target, march) : target, FLOOR_Y - 40)
          .setScale(effectFrame === 4 ? 0.65 : 0.5);
        if (effectFrame === 7) this.effect.setPosition(Phaser.Math.Linear(target, u.sourceX + dir * 35, (t - 126) / 18), FLOOR_Y - 30);
        break;
      }
    }

    const floorLimit = FLOOR_Y - (EFFECT_BOTTOMS[u.id][effectFrame] - 160) * this.effect.scaleY;
    this.effect.y = Math.min(this.effect.y, floorLimit);

    // Temporary arena transformation. Ground geometry remains readable below it.
    const g = this.world;
    g.fillStyle(def.backdrop, 0.86 * fade).fillRect(0, 0, STAGE_W, VIEW_H);
    g.lineStyle(1, def.color, 0.23 * fade);
    const motion = this.reducedMotion ? 0 : t;
    if (u.id === 'codex') {
      for (let x = 0; x < STAGE_W; x += 32) g.lineBetween(x, 0, x, FLOOR_Y);
      for (let y = 0; y < FLOOR_Y; y += 24) g.lineBetween(0, y, STAGE_W, y);
    } else if (u.id === 'openclaw') {
      for (let i = 0; i < 5; i++) g.strokeCircle(u.sourceX, FLOOR_Y - 70, 30 + (motion * 2 + i * 60) % 300);
    } else {
      for (let i = 0; i < 28; i++) {
        const x = (i * 73 + motion * (i % 2 ? 1 : -1) + STAGE_W) % STAGE_W;
        const y = 20 + (i * 43) % 190;
        if (u.id === 'clawd') g.strokeRect(x, y, 8, 11);
        else if (u.id === 'muse') { g.lineBetween(x - 3, y, x + 3, y); g.lineBetween(x, y - 3, x, y + 3); }
        else {
          g.lineStyle(1, [0xff454e, 0x4d9aff, 0xb26bff, 0xffd34a][i % 4], 0.32 * fade);
          if (i % 2) g.strokeTriangle(x, y - 8, x - 7, y + 5, x + 7, y + 5);
          else g.strokeRect(x, y, 10, 10);
        }
      }
    }
    g.lineStyle(1, def.color, fade * 0.5).lineBetween(0, FLOOR_Y + 2, STAGE_W, FLOOR_Y + 2);
  }

  /** A short ease-in / hold / pull-back, complete before any damaging frame. */
  camera(): { zoom: number; focus: number } {
    const u = this.match.ultimate;
    if (!u || this.reducedMotion || u.tick >= ULTIMATE_INTRO) return { zoom: 1, focus: 0 };
    const weight = u.tick < 10 ? u.tick / 10 : u.tick < 22 ? 1 : (ULTIMATE_INTRO - u.tick) / 14;
    const smooth = weight * weight * (3 - 2 * weight);
    return { zoom: 1 + 0.65 * smooth, focus: smooth };
  }
}
