import Phaser from 'phaser';

/**
 * The opaque extent of a set of cels, in cel-local pixels, inclusive.
 *
 * Cels are full canvases with a lot of empty space around the fighter — the
 * sheets keep them untrimmed so pivots cannot drift — so anything that wants
 * to frame a fighter rather than stand it on the floor has to find the
 * drawing inside the canvas first.
 */
export interface SilhouetteBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** The sheets carry binary alpha, so anything above a hair is drawing. */
const ALPHA_FLOOR = 8;

const cache = new Map<string, SilhouetteBounds>();

/**
 * Measures the union of the opaque pixels across `frameNames`.
 *
 * Measuring rather than tabulating matters here: the cast is five fighters
 * whose silhouettes run from 92 to 120 pixels tall, every one of them drawn
 * on the same 224 x 160 canvas, and item 6 of the project's next-work list is
 * hand-cleaning four of those sheets. A table of heights in the source would
 * be wrong the first time somebody redraws a pose; reading the atlas cannot
 * be.
 *
 * The scan costs one canvas read per cel and is cached per texture and frame
 * set, so it runs once for each fighter that appears on the versus page and
 * never during a frame of the match.
 */
export function silhouetteBounds(
  scene: Phaser.Scene,
  textureKey: string,
  frameNames: readonly string[],
): SilhouetteBounds {
  const cacheKey = `${textureKey}|${frameNames.join(',')}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const texture = scene.textures.get(textureKey);
  const source = texture.getSourceImage() as CanvasImageSource;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable, cannot measure a silhouette');

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = -1;
  let bottom = -1;
  let celW = 0;
  let celH = 0;

  for (const name of frameNames) {
    const frame = texture.get(name);
    const w = Math.ceil(frame.cutWidth);
    const h = Math.ceil(frame.cutHeight);
    if (w <= 0 || h <= 0) continue;
    // A trimmed frame sits at an offset inside its cel; these sheets are not
    // trimmed, but reading the offset costs nothing and keeps the measurement
    // true if one ever is.
    const offX = frame.x;
    const offY = frame.y;
    celW = Math.max(celW, Math.ceil(frame.width));
    celH = Math.max(celH, Math.ceil(frame.height));

    // Assigning the size also clears the canvas, and resets the context, so
    // smoothing goes off again after every resize.
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, frame.cutX, frame.cutY, w, h, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y += 1) {
      const row = y * w * 4;
      for (let x = 0; x < w; x += 1) {
        if (data[row + x * 4 + 3] <= ALPHA_FLOOR) continue;
        const cx = x + offX;
        const cy = y + offY;
        if (cx < left) left = cx;
        if (cx > right) right = cx;
        if (cy < top) top = cy;
        if (cy > bottom) bottom = cy;
      }
    }
  }

  // An entirely transparent set of cels is a broken sheet, not a crash: fall
  // back to the whole canvas so the page still draws something.
  const bounds: SilhouetteBounds =
    right < 0
      ? { left: 0, top: 0, right: celW - 1, bottom: celH - 1, width: celW, height: celH }
      : { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };

  cache.set(cacheKey, bounds);
  return bounds;
}
