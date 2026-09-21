/**
 * Fixed world and presentation constants.
 *
 * World units are art pixels. The camera never scales them by a fractional
 * amount, so a world unit is always a whole screen pixel after integer zoom.
 */

/** Internal render resolution. Scaled to the window by an integer factor. */
export const VIEW_W = 480;
export const VIEW_H = 270;

/** Playfield is wider than the view; the camera tracks the midpoint. */
export const STAGE_W = 1120;

/** World y of the floor line. Fighter origins sit here when grounded. */
export const FLOOR_Y = 236;

/** Combat runs on a fixed tick. Rendering is free to run at any rate. */
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Guard against spiral-of-death after a tab stall. */
export const MAX_TICKS_PER_FRAME = 5;

/** Clawd's source canvas, from output/clawd-animation/clawd-moves.json. */
export const FRAME_W = 224;
export const FRAME_H = 160;
export const ORIGIN_X = 106;
export const ORIGIN_Y = 136;

/** Palette lifted from the sprite sheet: 12 opaque colours, terracotta ramp. */
export const PALETTE = {
  shadow: 0x35100e,
  deepest: 0x551911,
  deep: 0x752319,
  dark: 0x923022,
  midDark: 0xaf3c29,
  base: 0xc84d33,
  light: 0xdd6240,
  lighter: 0xee7950,
  bright: 0xfa9564,
  highlight: 0xffb483,
  cream: 0xffe0ad,
  ink: 0x080605,
} as const;
