import Phaser from 'phaser';
import { FLOOR_Y, PALETTE } from '../constants';
import { PixelLabel } from './pixelLabel';

interface Particle {
  object: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  maxLife: number;
  spin: number;
  shrink: number;
  baseScale: number;
}

const STAR_KEY = 'fx-star';
const RING_KEY = 'fx-ring';

/** Draws the impact flash and ring into textures so they stay on the pixel grid. */
function buildTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(STAR_KEY)) {
    const size = 31;
    const half = (size - 1) / 2;
    const tex = scene.textures.createCanvas(STAR_KEY, size, size) as Phaser.Textures.CanvasTexture;
    const ctx = tex.context;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - half;
        const dy = y - half;
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        // Four long spikes plus shorter diagonals: a classic impact burst.
        const spike = ax * ax * 0.06 + ay < half * 0.34 || ay * ay * 0.06 + ax < half * 0.34;
        const diagonal = Math.abs(ax - ay) < 2 && ax + ay < half * 0.95;
        const core = ax + ay < half * 0.38;
        if (!spike && !diagonal && !core) continue;
        const distance = Math.hypot(dx, dy) / half;
        ctx.fillStyle = core || distance < 0.28 ? '#ffffff' : distance < 0.62 ? '#ffe0ad' : '#ffb483';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.refresh();
  }

  if (!scene.textures.exists(RING_KEY)) {
    const size = 33;
    const half = (size - 1) / 2;
    const tex = scene.textures.createCanvas(RING_KEY, size, size) as Phaser.Textures.CanvasTexture;
    const ctx = tex.context;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffe0ad';
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const d = Math.hypot(x - half, y - half);
        if (d > half - 2.2 && d <= half) ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.refresh();
  }
}

/**
 * Impact effects: flashes, rings, debris, dust and floating damage numbers.
 *
 * Everything is pooled or short-lived, and nothing here can affect the match;
 * the simulation emits events and this class decides how loud they look.
 */
export class Fx {
  private readonly particles: Particle[] = [];
  private readonly numbers: { label: PixelLabel; life: number; vy: number }[] = [];
  private readonly numberPool: PixelLabel[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    buildTextures(scene);
  }

  /** The big one: a connected hit. */
  hitSpark(x: number, y: number, power: number, counter: boolean): void {
    const flash = this.scene.add
      .image(Math.round(x), Math.round(y), STAR_KEY)
      .setDepth(40)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.push(flash, {
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 1,
      life: counter ? 200 : 150,
      spin: 0,
      shrink: -1.4,
      baseScale: 0.5 + power * 0.55,
    });

    const ring = this.scene.add
      .image(Math.round(x), Math.round(y), RING_KEY)
      .setDepth(39)
      .setAlpha(0.85)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.push(ring, {
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 1,
      life: 180,
      spin: 0,
      shrink: -2.6,
      baseScale: 0.4 + power * 0.4,
    });

    const count = Math.round(6 + power * 8);
    for (let i = 0; i < count; i += 1) {
      const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const speed = Phaser.Math.FloatBetween(0.9, 3.4) * (0.7 + power);
      const size = Phaser.Math.Between(1, 3);
      const shard = this.scene.add
        .rectangle(
          Math.round(x),
          Math.round(y),
          size,
          size,
          i % 3 === 0 ? PALETTE.cream : counter ? 0xffffff : PALETTE.highlight,
        )
        .setDepth(38);
      this.push(shard, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6,
        gravity: 0.09,
        drag: 0.98,
        life: Phaser.Math.Between(220, 460),
        spin: 0,
        shrink: 0,
        baseScale: 1,
      });
    }
  }

  /** A blocked hit: tighter, cooler, less debris. */
  guardSpark(x: number, y: number): void {
    const ring = this.scene.add
      .image(Math.round(x), Math.round(y), RING_KEY)
      .setDepth(39)
      .setTint(0x8fd8ff)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.push(ring, {
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 1,
      life: 150,
      spin: 0,
      shrink: -2.2,
      baseScale: 0.35,
    });
    for (let i = 0; i < 5; i += 1) {
      const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const shard = this.scene.add
        .rectangle(Math.round(x), Math.round(y), 2, 2, 0xbfeaff)
        .setDepth(38);
      this.push(shard, {
        vx: Math.cos(angle) * 1.6,
        vy: Math.sin(angle) * 1.6,
        gravity: 0.05,
        drag: 0.95,
        life: 200,
        spin: 0,
        shrink: 0,
        baseScale: 1,
      });
    }
  }

  /** Floor contact: a low, wide puff that reads as weight. */
  dust(x: number, strength = 1): void {
    const count = Math.round(4 + strength * 5);
    for (let i = 0; i < count; i += 1) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const puff = this.scene.add
        .rectangle(
          Math.round(x + Phaser.Math.Between(-16, 16)),
          FLOOR_Y - Phaser.Math.Between(0, 5),
          Phaser.Math.Between(2, 4),
          2,
          PALETTE.deep,
        )
        .setDepth(8)
        .setAlpha(0.7);
      this.push(puff, {
        vx: dir * Phaser.Math.FloatBetween(0.5, 1.8) * strength,
        vy: -Phaser.Math.FloatBetween(0.2, 1.1),
        gravity: 0.03,
        drag: 0.93,
        life: Phaser.Math.Between(240, 420),
        spin: 0,
        shrink: 0,
        baseScale: 1,
      });
    }
  }

  /** Rising damage number above the victim. */
  damageNumber(x: number, y: number, amount: number, counter: boolean): void {
    const label = this.numberPool.pop() ??
      new PixelLabel(this.scene, 0, 0, '', {}, 'center');
    label
      .setText(`${amount}`, {
        scale: counter ? 2 : 1,
        color: counter ? '#ffffff' : '#ffe0ad',
        outline: '#35100e',
      })
      .setPosition(Math.round(x), Math.round(y))
      .setDepth(45)
      .setVisible(true)
      .setAlpha(1);
    this.numbers.push({ label, life: 650, vy: -0.55 });
  }

  private push(
    object: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle,
    spec: Omit<Particle, 'object' | 'maxLife'>,
  ): void {
    object.setScale(spec.baseScale);
    this.particles.push({ object, maxLife: spec.life, ...spec });
  }

  update(delta: number): void {
    const step = delta / 16.6667;
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        p.object.destroy();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * step;
      p.vx *= p.drag;
      p.object.x += p.vx * step;
      p.object.y += p.vy * step;
      const t = p.life / p.maxLife;
      p.object.setAlpha(Math.min(1, t * 1.6));
      if (p.shrink !== 0) {
        p.object.setScale(p.baseScale * (1 - p.shrink * (1 - t)));
      }
    }

    for (let i = this.numbers.length - 1; i >= 0; i -= 1) {
      const n = this.numbers[i];
      n.life -= delta;
      n.vy *= 0.96;
      n.label.image.y += n.vy * step;
      n.label.setAlpha(Math.min(1, (n.life / 650) * 2));
      if (n.life <= 0) {
        n.label.setVisible(false);
        this.numberPool.push(n.label);
        this.numbers.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const p of this.particles) p.object.destroy();
    this.particles.length = 0;
    for (const n of this.numbers) {
      n.label.setVisible(false);
      this.numberPool.push(n.label);
    }
    this.numbers.length = 0;
  }
}
