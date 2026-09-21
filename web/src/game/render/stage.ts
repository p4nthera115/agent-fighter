import Phaser from 'phaser';
import { FLOOR_Y, STAGE_W, VIEW_H, VIEW_W } from '../constants';

/** Deterministic noise, so the arena is identical on every load. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

interface LayerSpec {
  key: string;
  width: number;
  height: number;
  scrollFactor: number;
  depth: number;
  y: number;
  paint: (ctx: CanvasRenderingContext2D, rng: () => number) => void;
}

/**
 * "Foundry Yard" — a cool, low-saturation arena.
 *
 * The fighters are a warm terracotta ramp, so the stage is deliberately built
 * from cold indigo and teal. Keeping the background hue opposite the fighters
 * is what makes the silhouettes read at speed.
 */
export class Stage {
  private readonly layers: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    const specs: LayerSpec[] = [
      {
        key: 'stage-sky',
        width: VIEW_W,
        height: VIEW_H,
        scrollFactor: 0,
        depth: -50,
        y: 0,
        paint: paintSky,
      },
      {
        key: 'stage-far',
        width: STAGE_W,
        height: VIEW_H,
        scrollFactor: 0.18,
        depth: -40,
        y: 0,
        paint: paintFar,
      },
      {
        key: 'stage-mid',
        width: STAGE_W,
        height: VIEW_H,
        scrollFactor: 0.52,
        depth: -30,
        y: 0,
        paint: paintMid,
      },
      {
        key: 'stage-floor',
        width: STAGE_W,
        height: VIEW_H - FLOOR_Y + 40,
        scrollFactor: 1,
        depth: -20,
        y: FLOOR_Y - 40,
        paint: paintFloor,
      },
    ];

    let seed = 20260921;
    for (const spec of specs) {
      seed += 7919;
      this.layers.push(this.build(spec, seed));
    }

    this.addScanlines();
    this.addVignette();
  }

  private build(spec: LayerSpec, seed: number): Phaser.GameObjects.Image {
    if (!this.scene.textures.exists(spec.key)) {
      const tex = this.scene.textures.createCanvas(
        spec.key,
        spec.width,
        spec.height,
      ) as Phaser.Textures.CanvasTexture;
      const ctx = tex.context;
      ctx.imageSmoothingEnabled = false;
      spec.paint(ctx, makeRng(seed));
      tex.refresh();
    }
    return this.scene.add
      .image(0, spec.y, spec.key)
      .setOrigin(0, 0)
      .setScrollFactor(spec.scrollFactor)
      .setDepth(spec.depth);
  }

  /** Darkened corners keep the eye on the centre of the arena. */
  private addVignette(): void {
    const key = 'stage-vignette';
    if (!this.scene.textures.exists(key)) {
      const tex = this.scene.textures.createCanvas(key, VIEW_W, VIEW_H) as Phaser.Textures.CanvasTexture;
      const ctx = tex.context;
      const gradient = ctx.createRadialGradient(
        VIEW_W / 2,
        VIEW_H * 0.55,
        VIEW_H * 0.3,
        VIEW_W / 2,
        VIEW_H * 0.55,
        VIEW_W * 0.72,
      );
      gradient.addColorStop(0, 'rgba(5,7,15,0)');
      gradient.addColorStop(1, 'rgba(5,7,15,0.62)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      tex.refresh();
    }
    this.scene.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDepth(59);
  }

  /** A faint scanline grid ties the vector shapes to the pixel art. */
  private addScanlines(): void {
    const key = 'stage-scanlines';
    if (!this.scene.textures.exists(key)) {
      const tex = this.scene.textures.createCanvas(key, 4, 4) as Phaser.Textures.CanvasTexture;
      const ctx = tex.context;
      ctx.fillStyle = 'rgba(8,10,20,0.16)';
      ctx.fillRect(0, 1, 4, 1);
      tex.refresh();
    }
    this.scene.add
      .tileSprite(0, 0, VIEW_W, VIEW_H, key)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(60)
      .setAlpha(0.5);
  }
}

function paintSky(ctx: CanvasRenderingContext2D): void {
  // Banded rather than smooth: a gradient would dither against the palette.
  const bands: Array<[number, string]> = [
    [0.0, '#141a35'],
    [0.14, '#1a2143'],
    [0.28, '#222a53'],
    [0.42, '#2e3160'],
    [0.54, '#3f3669'],
    [0.64, '#553c6a'],
    [0.72, '#6f4566'],
    [0.79, '#8e5060'],
    [0.85, '#b35f58'],
    [0.9, '#d1744f'],
    [1.0, '#e8925c'],
  ];
  for (let i = 0; i < bands.length; i += 1) {
    const [start, colour] = bands[i];
    const end = i + 1 < bands.length ? bands[i + 1][0] : 1;
    ctx.fillStyle = colour;
    ctx.fillRect(0, Math.floor(start * VIEW_H), VIEW_W, Math.ceil((end - start) * VIEW_H) + 1);
  }

  // Stars, thinning out as the sky warms towards the horizon.
  const rng = makeRng(4242);
  for (let i = 0; i < 150; i += 1) {
    const x = Math.floor(rng() * VIEW_W);
    const y = Math.floor(rng() * VIEW_H * 0.55);
    if (rng() < y / (VIEW_H * 0.55)) continue;
    ctx.fillStyle = rng() > 0.82 ? '#ffe0ad' : 'rgba(210,220,255,0.7)';
    ctx.fillRect(x, y, 1, 1);
  }

  // A low sun disc with banded haze, sitting behind the skyline.
  const cx = VIEW_W * 0.7;
  const cy = VIEW_H * 0.4;
  const r = 30;
  for (let y = -r; y <= r; y += 1) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    if (y > 4 && (y + r) % 7 < 2) continue;
    const t = (y + r) / (r * 2);
    ctx.fillStyle = t < 0.4 ? '#ffe0ad' : t < 0.75 ? '#ffb483' : '#fa9564';
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }

  // Thin cloud bars, warm-lit from below.
  for (let i = 0; i < 7; i += 1) {
    const y = Math.floor(VIEW_H * (0.3 + rng() * 0.32));
    const x = Math.floor(rng() * VIEW_W);
    const w = 30 + Math.floor(rng() * 90);
    ctx.fillStyle = 'rgba(20,20,45,0.5)';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = 'rgba(255,180,131,0.22)';
    ctx.fillRect(x, y + 3, w, 1);
  }
}

function paintFar(ctx: CanvasRenderingContext2D, rng: () => number): void {
  const horizon = FLOOR_Y - 34;
  let x = -20;
  while (x < STAGE_W + 20) {
    const w = 18 + Math.floor(rng() * 46);
    const h = 26 + Math.floor(rng() * 96);
    const top = horizon - h;
    ctx.fillStyle = '#161c38';
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = '#202748';
    ctx.fillRect(x, top, w, 2);

    // Lit windows, sparse and aligned to a 6px grid.
    for (let wy = top + 6; wy < horizon - 6; wy += 8) {
      for (let wx = x + 4; wx < x + w - 4; wx += 6) {
        if (rng() > 0.78) {
          ctx.fillStyle = rng() > 0.5 ? '#ffb483' : '#8fd8ff';
          ctx.fillRect(wx, wy, 2, 3);
        }
      }
    }
    x += w + 2 + Math.floor(rng() * 10);
  }

  ctx.fillStyle = '#121734';
  ctx.fillRect(0, horizon, STAGE_W, VIEW_H - horizon);
}

function paintMid(ctx: CanvasRenderingContext2D, rng: () => number): void {
  const base = FLOOR_Y - 4;

  // Support pillars framing the fight, with a banner strung between them.
  for (let i = 0; i < 9; i += 1) {
    const x = 40 + i * 132 + Math.floor(rng() * 14);
    const w = 20;
    const top = base - (120 + Math.floor(rng() * 40));
    ctx.fillStyle = '#10152b';
    ctx.fillRect(x, top, w, base - top);
    ctx.fillStyle = '#1d2646';
    ctx.fillRect(x, top, 3, base - top);
    ctx.fillStyle = '#0a0e20';
    ctx.fillRect(x + w - 3, top, 3, base - top);
    ctx.fillStyle = '#2a3560';
    ctx.fillRect(x - 4, top, w + 8, 5);

    // Hanging lamp.
    ctx.fillStyle = '#0a0e20';
    ctx.fillRect(x + 8, top + 12, 4, 8);
    ctx.fillStyle = '#ffd08a';
    ctx.fillRect(x + 6, top + 20, 8, 5);
    ctx.fillStyle = 'rgba(255,208,138,0.10)';
    ctx.fillRect(x - 6, top + 24, 32, 70);
  }

  // Crowd barrier along the back of the platform.
  ctx.fillStyle = '#0c1126';
  ctx.fillRect(0, base - 26, STAGE_W, 26);
  ctx.fillStyle = '#18203d';
  ctx.fillRect(0, base - 26, STAGE_W, 2);
  for (let x = 0; x < STAGE_W; x += 10) {
    ctx.fillStyle = '#131a35';
    ctx.fillRect(x, base - 22, 2, 22);
  }
}

function paintFloor(ctx: CanvasRenderingContext2D, rng: () => number): void {
  const h = ctx.canvas.height;
  const lip = 40; // The canvas starts 40px above the floor line.

  ctx.fillStyle = '#0c1126';
  ctx.fillRect(0, 0, STAGE_W, lip);

  // Deck boards receding towards the camera.
  const rows: Array<[number, string]> = [
    [0, '#2f2942'],
    [3, '#3b3250'],
    [8, '#453a56'],
    [16, '#3a2e48'],
    [26, '#2e2439'],
  ];
  for (let i = 0; i < rows.length; i += 1) {
    const [offset, colour] = rows[i];
    const next = i + 1 < rows.length ? rows[i + 1][0] : h - lip;
    ctx.fillStyle = colour;
    ctx.fillRect(0, lip + offset, STAGE_W, next - offset);
  }

  // Plank seams widen as they come forward, which sells the perspective.
  for (let x = 0; x < STAGE_W; x += 32) {
    const jitter = Math.floor(rng() * 6);
    ctx.fillStyle = 'rgba(12,17,38,0.55)';
    ctx.fillRect(x + jitter, lip + 3, 1, 8);
    ctx.fillRect(x + jitter - 1, lip + 11, 2, 12);
    ctx.fillRect(x + jitter - 2, lip + 23, 3, h - lip - 23);
  }

  // Bright edge exactly on the floor line so the baseline never reads as fuzzy.
  ctx.fillStyle = '#7a6480';
  ctx.fillRect(0, lip - 1, STAGE_W, 1);
  ctx.fillStyle = '#ffb483';
  for (let x = 0; x < STAGE_W; x += 4) {
    if (rng() > 0.72) ctx.fillRect(x, lip - 1, 2, 1);
  }
}
