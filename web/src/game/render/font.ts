/**
 * A 5x7 bitmap font.
 *
 * Browser text rendering antialiases, which reads as mush next to hard-edged
 * pixel clusters. Drawing the HUD from an explicit glyph table keeps every
 * letter on the same pixel grid as the fighters.
 */

const GLYPHS: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.###.',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '#####|..#..|..#..|..#..|..#..|..#..|#####',
  J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#.#.#|#..##|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.###.|#...#|#....|.###.|....#|#...#|.###.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|..##.|.#...|#....|#####',
  '3': '#####|...#.|..#..|...#.|....#|#...#|.###.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '..##.|.#...|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|...#.|.##..',
  ' ': '.....|.....|.....|.....|.....|.....|.....',
  '.': '.....|.....|.....|.....|.....|.##..|.##..',
  ',': '.....|.....|.....|.....|.##..|.##..|.#...',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '?': '.###.|#...#|....#|..##.|..#..|.....|..#..',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....',
  '-': '.....|.....|.....|#####|.....|.....|.....',
  "'": '..#..|..#..|.....|.....|.....|.....|.....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##',
  '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....',
  X_MULT: '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
  '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.',
  '=': '.....|.....|#####|.....|#####|.....|.....',
  '_': '.....|.....|.....|.....|.....|.....|#####',
  '(': '..##.|.#...|.#...|.#...|.#...|.#...|..##.',
  ')': '.##..|...#.|...#.|...#.|...#.|...#.|.##..',
  '\u2022': '.....|.....|.###.|.###.|.###.|.....|.....',
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** One blank column between glyphs. */
export const GLYPH_GAP = 1;

const CACHE = new Map<string, boolean[][]>();

function glyph(char: string): boolean[][] {
  const key = char === '×' ? 'X_MULT' : char.toUpperCase();
  const cached = CACHE.get(key);
  if (cached) return cached;
  const source = GLYPHS[key] ?? GLYPHS['?'];
  const rows = source.split('|').map((row) => row.split('').map((c) => c === '#'));
  CACHE.set(key, rows);
  return rows;
}

export interface DrawTextOptions {
  color?: string;
  scale?: number;
  shadow?: string;
  /** Offset of the drop shadow, in source pixels. */
  shadowOffset?: number;
  outline?: string;
  /**
   * Blank columns between glyphs, in source pixels.
   *
   * This font has one-pixel gaps inside several letters, so a display-sized
   * heading needs more air between characters than body text does.
   */
  gap?: number;
  /**
   * Keep the shadow out of enclosed counters, such as the holes in A, O and R.
   *
   * A one-pixel shadow would otherwise fill every one of them, and at display
   * sizes that turns the letters into solid blocks.
   */
  shadowOutsideOnly?: boolean;
}

/** How far the decorations extend past the glyphs, in source pixels. */
export function padding(options: DrawTextOptions): number {
  const outline = options.outline ? 1 : 0;
  const shadow = options.shadow ? (options.shadowOffset ?? 1) : 0;
  return Math.max(outline, shadow);
}

/** Lays the string out as a grid of set pixels, one cell per source pixel. */
function buildGrid(text: string, gap: number): boolean[][] {
  const cols = text.length === 0 ? 0 : text.length * (GLYPH_W + gap) - gap;
  const grid: boolean[][] = Array.from({ length: GLYPH_H }, () => new Array<boolean>(cols).fill(false));
  let penX = 0;
  for (const char of text) {
    const rows = glyph(char);
    for (let y = 0; y < GLYPH_H; y += 1) {
      for (let x = 0; x < GLYPH_W; x += 1) {
        if (rows[y][x]) grid[y][penX + x] = true;
      }
    }
    penX += GLYPH_W + gap;
  }
  return grid;
}

/**
 * Marks every empty cell reachable from outside the text.
 *
 * Whatever is left unmarked is an enclosed counter, which is how the renderer
 * tells the hole in an A apart from the notch in an M.
 */
function floodOutside(grid: boolean[][], pad: number): boolean[][] {
  const h = grid.length + pad * 2;
  const w = (grid[0]?.length ?? 0) + pad * 2;
  const outside: boolean[][] = Array.from({ length: h }, () => new Array<boolean>(w).fill(false));
  const solid = (x: number, y: number) => {
    const gx = x - pad;
    const gy = y - pad;
    return gy >= 0 && gy < grid.length && gx >= 0 && gx < (grid[0]?.length ?? 0) && grid[gy][gx];
  };

  const queue: Array<[number, number]> = [];
  for (let x = 0; x < w; x += 1) {
    queue.push([x, 0], [x, h - 1]);
  }
  for (let y = 0; y < h; y += 1) {
    queue.push([0, y], [w - 1, y]);
  }

  while (queue.length > 0) {
    const [x, y] = queue.pop() as [number, number];
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    if (outside[y][x] || solid(x, y)) continue;
    outside[y][x] = true;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return outside;
}

export function measure(text: string, scale = 1, gap = GLYPH_GAP): { width: number; height: number } {
  const n = text.length;
  const width = n === 0 ? 0 : (n * GLYPH_W + (n - 1) * gap) * scale;
  return { width, height: GLYPH_H * scale };
}

/**
 * Stamps `text` onto a 2D context with its glyph box's top-left at (x, y).
 *
 * Decorations are resolved on the pixel grid before anything is drawn, so the
 * outline and the shadow never fight over the same cell.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: DrawTextOptions = {},
): void {
  const {
    color = '#ffe0ad',
    scale = 1,
    shadow,
    shadowOffset = 1,
    outline,
    gap = GLYPH_GAP,
    shadowOutsideOnly = false,
  } = options;
  if (text.length === 0) return;

  const grid = buildGrid(text, gap);
  const rows = grid.length;
  const cols = grid[0].length;
  const pad = padding(options);
  const outside = shadow && shadowOutsideOnly ? floodOutside(grid, pad) : null;

  const at = (gx: number, gy: number) =>
    gy >= 0 && gy < rows && gx >= 0 && gx < cols && grid[gy][gx];

  const cell = (gx: number, gy: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x + gx * scale, y + gy * scale, scale, scale);
  };

  // Shadow first, then outline in the cells the shadow did not claim, then
  // the glyph itself on top.
  const claimed = new Set<string>();

  if (shadow) {
    for (let gy = -pad; gy < rows + pad; gy += 1) {
      for (let gx = -pad; gx < cols + pad; gx += 1) {
        if (at(gx, gy)) continue;
        if (!at(gx - shadowOffset, gy - shadowOffset)) continue;
        if (outside && !outside[gy + pad]?.[gx + pad]) continue;
        claimed.add(`${gx},${gy}`);
        cell(gx, gy, shadow);
      }
    }
  }

  if (outline) {
    for (let gy = -1; gy < rows + 1; gy += 1) {
      for (let gx = -1; gx < cols + 1; gx += 1) {
        if (at(gx, gy) || claimed.has(`${gx},${gy}`)) continue;
        if (at(gx - 1, gy) || at(gx + 1, gy) || at(gx, gy - 1) || at(gx, gy + 1)) {
          cell(gx, gy, outline);
        }
      }
    }
  }

  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      if (grid[gy][gx]) cell(gx, gy, color);
    }
  }
}
