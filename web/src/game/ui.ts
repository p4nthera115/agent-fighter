/**
 * Shared look for the cabinet's own screens.
 *
 * The sprite sheet's twelve colours govern the fighters. These are interface
 * colours: the gold-on-blue an arcade attract screen has always used, chosen
 * to sit beside that ramp rather than inside it.
 */
export const UI = {
  gold: '#ffc24a',
  goldDeep: '#e08a2a',
  goldShadow: '#7a2d17',
  ink: '#150a1c',
  cream: '#ffe0ad',
  cyan: '#8fd8ff',
  dim: '#7a82d8',
  /** Unselected menu rows: cool, so the gold cursor row is unmistakable. */
  idle: '#c6cbff',
  white: '#ffffff',
  red: '#ff5a4a',
  green: '#7ee787',
} as const;

/** Title-screen field colours, as numbers for Phaser fills. */
export const FIELD = {
  base: 0x2b2f8f,
  deep: 0x20246f,
  /** Only a step above the field: the grid is texture, not content. */
  line: 0x33389f,
  block: 0x2f3496,
} as const;

export const HEADING = {
  scale: 2,
  color: UI.gold,
  shadow: UI.goldShadow,
  shadowOffset: 1,
  outline: UI.ink,
} as const;

export const BODY = {
  scale: 1,
  color: UI.cream,
  outline: UI.ink,
} as const;
