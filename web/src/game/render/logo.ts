import Phaser from 'phaser';

/**
 * The wordmark.
 *
 * The 5x7 interface font cannot carry a logo — at display size its one-pixel
 * gaps and uniform stems read as a label, not a title. So the logo has its own
 * 8x11 alphabet, heavier and squarer, covering only the letters it needs.
 *
 * The arcade-poster treatment on top is all procedural: each letter climbs as
 * the word runs right, every row leans forward, the fill is a yellow-to-red
 * ramp with a diagonal highlight across it, and the whole mass carries a thick
 * black outline, a thin red rim and a hard drop shadow.
 */

const GLYPH_H = 11;
const GLYPH_GAP = 1;

/**
 * Glyphs are variable width, taken from the row length.
 *
 * Monospacing a display alphabet wastes the narrow letters and cramps the
 * wide ones; M needs ten columns to keep its chevron open, I needs five.
 * Counters are kept three or four pixels wide, because the shear steps every
 * third row and a two-pixel hole does not survive that plus an outline.
 */
export const GLYPHS: Record<string, string> = {
  M: '##......##|###....###|####..####|##.####.##|##..##..##|##......##|##......##|##......##|##......##|##......##|##......##',
  A: '..####..|.##..##.|##....##|##....##|##....##|########|########|##....##|##....##|##....##|##....##',
  S: '..######|.#######|##......|##......|##......|.######.|..######|......##|......##|#######.|######..',
  C: '..#####.|.#######|##....##|##......|##......|##......|##......|##......|##....##|.#######|..#####.',
  O: '..####..|.######.|##....##|##....##|##....##|##....##|##....##|##....##|##....##|.######.|..####..',
  T: '########|########|...##...|...##...|...##...|...##...|...##...|...##...|...##...|...##...|...##...',
  F: '########|########|##......|##......|##......|#######.|#######.|##......|##......|##......|##......',
  I: '#####|#####|.###.|.###.|.###.|.###.|.###.|.###.|.###.|#####|#####',
  G: '..#####.|.#######|##....##|##......|##......|##..####|##..####|##....##|##....##|.#######|..#####.',
  H: '##....##|##....##|##....##|##....##|########|########|##....##|##....##|##....##|##....##|##....##',
  E: '########|########|##......|##......|##......|######..|######..|##......|##......|########|########',
  R: '#######.|########|##....##|##....##|##....##|#######.|######..|##..##..|##...##.|##....##|##....##',
  // V is not in the wordmark; the versus page's mark is drawn with the
  // same alphabet and the same treatment, so it lives here too.
  V: '##....##|##....##|##....##|##....##|##....##|##....##|.##..##.|.##..##.|..####..|..####..|...##...',
};

type Grid = boolean[][];

function glyph(char: string): Grid {
  const source = GLYPHS[char.toUpperCase()];
  if (!source) throw new Error(`The logo alphabet has no "${char}"`);
  return source.split('|').map((row) => row.split('').map((c) => c === '#'));
}

function glyphWidth(char: string): number {
  return glyph(char)[0].length;
}

function blank(w: number, h: number): Grid {
  return Array.from({ length: h }, () => new Array<boolean>(w).fill(false));
}

export interface WordShape {
  grid: Grid;
  w: number;
  h: number;
}

/**
 * Lays a word out on the pixel grid.
 *
 * `rise` lifts each successive letter, so the word climbs to the right the way
 * the reference does. `slant` shifts every row, with the top shifted furthest,
 * which leans the whole thing forward.
 */
export function buildWord(text: string, rise: number, slant: number): WordShape {
  const letters = [...text];
  const lean = Math.round((GLYPH_H - 1) * slant);
  const climb = Math.round((letters.length - 1) * rise);
  const advances: number[] = [];
  let pen = 0;
  for (const char of letters) {
    advances.push(pen);
    pen += glyphWidth(char) + GLYPH_GAP;
  }
  const w = pen - GLYPH_GAP + lean;
  const h = GLYPH_H + climb;
  const grid = blank(w, h);

  letters.forEach((char, i) => {
    const cells = glyph(char);
    const originX = advances[i];
    // The last letter sits highest, so index 0 gets the full drop.
    const originY = Math.round((letters.length - 1 - i) * rise);
    for (let y = 0; y < GLYPH_H; y += 1) {
      const shift = Math.round((GLYPH_H - 1 - y) * slant);
      for (let x = 0; x < cells[y].length; x += 1) {
        if (!cells[y][x]) continue;
        const gx = originX + x + shift;
        const gy = originY + y;
        if (gy >= 0 && gy < h && gx >= 0 && gx < w) grid[gy][gx] = true;
      }
    }
  });

  return { grid, w, h };
}

/** Grows a mask by `radius` cells, square-wise, for chunky pixel outlines. */
function dilate(shape: WordShape, radius: number): WordShape {
  if (radius <= 0) return shape;
  const w = shape.w + radius * 2;
  const h = shape.h + radius * 2;
  const grid = blank(w, h);
  for (let y = 0; y < shape.h; y += 1) {
    for (let x = 0; x < shape.w; x += 1) {
      if (!shape.grid[y][x]) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          grid[y + radius + dy][x + radius + dx] = true;
        }
      }
    }
  }
  return { grid, w, h };
}

function sample(ramp: Array<[number, string]>, t: number): string {
  let chosen = ramp[0][1];
  for (const [stop, colour] of ramp) {
    if (t >= stop) chosen = colour;
  }
  return chosen;
}

export interface WordStyle {
  scale: number;
  rise: number;
  slant: number;
  /** Vertical colour ramp, as [position 0..1, colour] stops. */
  ramp: Array<[number, string]>;
  outline: string;
  outlineWidth: number;
  rim: string;
  rimWidth: number;
  shadow: string;
  shadowOffset: [number, number];
  /** Bright diagonal streak across the upper half. */
  highlight?: { colour: string; slope: number; from: number; to: number };
}

export interface PlacedWord {
  text: string;
  style: WordStyle;
  /** Top-left of the glyph mass, in source pixels, before decoration. */
  at: [number, number];
}

/** Total decoration the word paints outside its glyphs, in source pixels. */
function margin(style: WordStyle): { left: number; top: number; right: number; bottom: number } {
  const grow = style.outlineWidth + style.rimWidth;
  return {
    left: grow,
    top: grow,
    right: grow + style.shadowOffset[0],
    bottom: grow + style.shadowOffset[1],
  };
}

function paintWord(
  ctx: CanvasRenderingContext2D,
  word: PlacedWord,
  offsetX: number,
  offsetY: number,
): void {
  const { style } = word;
  const shape = buildWord(word.text, style.rise, style.slant);
  const grow = style.outlineWidth + style.rimWidth;
  const scale = style.scale;

  const originX = offsetX + word.at[0];
  const originY = offsetY + word.at[1];

  const cell = (x: number, y: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect((originX + x) * scale, (originY + y) * scale, scale, scale);
  };

  const paintMask = (mask: WordShape, dx: number, dy: number, colour: string) => {
    for (let y = 0; y < mask.h; y += 1) {
      for (let x = 0; x < mask.w; x += 1) {
        if (mask.grid[y][x]) cell(x + dx, y + dy, colour);
      }
    }
  };

  // Shadow, then the red rim, then the black outline, then the letters. Each
  // mask contains the next, so painting in this order layers them correctly.
  const rimMask = dilate(shape, grow);
  const outlineMask = dilate(shape, style.outlineWidth);
  paintMask(rimMask, -grow + style.shadowOffset[0], -grow + style.shadowOffset[1], style.shadow);
  paintMask(rimMask, -grow, -grow, style.rim);
  paintMask(outlineMask, -style.outlineWidth, -style.outlineWidth, style.outline);

  // Column tops, so the ramp can follow the rising baseline instead of
  // washing out the letters that sit highest in the bounding box.
  const columnTop = new Array<number>(shape.w).fill(Number.POSITIVE_INFINITY);
  for (let y = 0; y < shape.h; y += 1) {
    for (let x = 0; x < shape.w; x += 1) {
      if (shape.grid[y][x] && y < columnTop[x]) columnTop[x] = y;
    }
  }

  for (let y = 0; y < shape.h; y += 1) {
    for (let x = 0; x < shape.w; x += 1) {
      if (!shape.grid[y][x]) continue;
      const top = columnTop[x];
      const local = Number.isFinite(top) ? (y - top) / (GLYPH_H - 1) : 0;
      const global = shape.h <= 1 ? 0 : y / (shape.h - 1);
      // Mostly local, with enough of the word position to keep the mass
      // reading as one gradient rather than a row of identical letters.
      const t = Math.max(0, Math.min(1, local * 0.72 + global * 0.28));
      let colour = sample(style.ramp, t);
      if (style.highlight) {
        // A diagonal band measured across the word, so the streak runs with
        // the rising baseline instead of cutting flat across it.
        const d = y - style.highlight.slope * x;
        if (d >= style.highlight.from && d <= style.highlight.to) colour = style.highlight.colour;
      }
      cell(x, y, colour);
    }
  }
}

const MASCOT_STYLE: WordStyle = {
  scale: 3,
  rise: 1.0,
  slant: 0.36,
  ramp: [
    [0.0, '#fff6cc'],
    [0.09, '#ffe872'],
    [0.22, '#ffd234'],
    [0.42, '#ffab1e'],
    [0.62, '#fb7c18'],
    [0.82, '#f0501b'],
    [1.0, '#dc2a1a'],
  ],
  outline: '#1a0604',
  outlineWidth: 1,
  rim: '#d41b12',
  rimWidth: 1,
  shadow: '#0b0202',
  shadowOffset: [1, 2],
  highlight: { colour: '#fffdf2', slope: -0.34, from: 0.2, to: 1.4 },
};

const FIGHTER_STYLE: WordStyle = {
  scale: 3,
  rise: 0.8,
  slant: 0.36,
  ramp: [
    [0.0, '#ffe58a'],
    [0.12, '#ffc32c'],
    [0.34, '#ff8f1e'],
    [0.58, '#f4571b'],
    [0.8, '#e02718'],
    [1.0, '#c00f14'],
  ],
  outline: '#1a0604',
  outlineWidth: 1,
  rim: '#d41b12',
  rimWidth: 1,
  shadow: '#0b0202',
  shadowOffset: [1, 2],
};

/** The two words, positioned so FIGHTER tucks under and right of MASCOT. */
export const LAYOUT: PlacedWord[] = [
  { text: 'MASCOT', style: MASCOT_STYLE, at: [0, 0] },
  { text: 'FIGHTER', style: FIGHTER_STYLE, at: [8, 15] },
];

/**
 * The versus page's mark.
 *
 * It borrows the wordmark's ramp, rim and outline so the two read as the same
 * poster, but it does not climb: MASCOT FIGHTER rises because it is a phrase
 * being read left to right, whereas VS is a symbol sitting between two equal
 * halves, and tilting it would take a side.
 */
const VS_STYLE: WordStyle = {
  scale: 4,
  rise: 0,
  slant: 0.36,
  ramp: MASCOT_STYLE.ramp,
  outline: '#1a0604',
  outlineWidth: 1,
  rim: '#d41b12',
  rimWidth: 1,
  shadow: '#0b0202',
  shadowOffset: [1, 2],
  highlight: { colour: '#fffdf2', slope: -0.34, from: 0.2, to: 1.4 },
};

export const VS_LAYOUT: PlacedWord[] = [{ text: 'VS', style: VS_STYLE, at: [0, 0] }];

/**
 * Paints a set of placed words into a texture, once per key.
 *
 * Every word in one layout shares a magnification, because the canvas is
 * sized in source pixels and multiplied by it at the end.
 */
export function wordTexture(scene: Phaser.Scene, key: string, layout: readonly PlacedWord[]): string {
  if (scene.textures.exists(key)) return key;

  const scale = layout[0].style.scale;
  let width = 0;
  let height = 0;
  for (const word of layout) {
    const shape = buildWord(word.text, word.style.rise, word.style.slant);
    const m = margin(word.style);
    width = Math.max(width, word.at[0] + shape.w + m.right);
    height = Math.max(height, word.at[1] + shape.h + m.bottom);
  }
  const pad = Math.max(...layout.map((w) => Math.max(margin(w.style).left, margin(w.style).top)));

  const texture = scene.textures.createCanvas(
    key,
    (width + pad) * scale,
    (height + pad) * scale,
  ) as Phaser.Textures.CanvasTexture;
  const ctx = texture.context;
  ctx.imageSmoothingEnabled = false;
  for (const word of layout) paintWord(ctx, word, pad, pad);
  texture.refresh();
  return key;
}

/**
 * Renders the wordmark into a texture and returns it as an image.
 *
 * The texture is built once and reused; nothing here runs per frame.
 */
export function addLogo(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 80,
): Phaser.GameObjects.Image {
  const key = wordTexture(scene, 'logo-wordmark', LAYOUT);
  return scene.add.image(Math.round(x), Math.round(y), key).setOrigin(0.5, 0.5).setDepth(depth);
}
