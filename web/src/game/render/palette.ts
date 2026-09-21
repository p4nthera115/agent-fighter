import Phaser from 'phaser';

export interface PaletteShift {
  /** Degrees added to the hue of every opaque pixel. */
  hue: number;
  /** Multiplier on saturation. */
  saturation: number;
  /** Additive lightness, in 0..1 units. */
  lightness: number;
  /** Pixels darker than this keep their colour, preserving the ink outline. */
  preserveBelow?: number;
  /** Pixels lighter than this keep their colour, preserving white eyes. */
  preserveAbove?: number;
  /**
   * Minimum saturation after the multiplier.
   *
   * Rotating the hue of a near-grey does nothing, because there is almost no
   * hue there to rotate. A sheet built on charcoal therefore needs a floor
   * before the rotation has any colour to work with.
   */
  saturationFloor?: number;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return [h, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/**
 * Registers a hue-shifted copy of an atlas under a new key.
 *
 * Each sheet keeps its colours on one ramp, so rotating hue preserves the
 * shadow ordering and the alternate costume still reads as the same sculpt.
 * The darkest pixels are left alone so the outline stays an outline, and a
 * sheet can hold its brightest pixels back too.
 */
export function registerRecoloredAtlas(
  scene: Phaser.Scene,
  sourceKey: string,
  newKey: string,
  jsonKey: string,
  shift: PaletteShift,
): void {
  if (scene.textures.exists(newKey)) return;

  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource & {
    width: number;
    height: number;
  };
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable, cannot build the alternate costume');

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const floorS = shift.saturationFloor ?? 0;
  const preserveLow = shift.preserveBelow ?? 0;
  const preserveHigh = shift.preserveAbove ?? 1;
  const cache = new Map<number, [number, number, number]>();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const packed = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let mapped = cache.get(packed);
    if (!mapped) {
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      mapped =
        l <= preserveLow || l >= preserveHigh
          ? [data[i], data[i + 1], data[i + 2]]
          : hslToRgb(
              (h + shift.hue / 360) % 1,
              Math.min(1, Math.max(floorS, Math.max(0, s * shift.saturation))),
              Math.min(1, Math.max(0, l + shift.lightness)),
            );
      cache.set(packed, mapped);
    }
    data[i] = mapped[0];
    data[i + 1] = mapped[1];
    data[i + 2] = mapped[2];
  }

  ctx.putImageData(image, 0, 0);

  const atlasData = scene.cache.json.get(jsonKey);
  scene.textures.addAtlas(newKey, canvas as unknown as HTMLImageElement, atlasData);
}
