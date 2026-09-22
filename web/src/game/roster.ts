import type { PaletteShift } from './render/palette';

/**
 * Everything the runtime needs to put a fighter on screen.
 *
 * Art only. Startup, active, recovery, damage and boxes stay in
 * `combat/frameData.ts` and are shared by the whole cast, so adding a fighter
 * cannot move a hitbox. What a fighter brings is its own sheet, its own pivot
 * and its own costume.
 */
export interface FighterArt {
  /** Folder under `public/assets/`, holding the atlas and its two JSON files. */
  dir: string;
  /** Basename shared by `<base>-sheet.png`, `-sheet.json` and `-moves.json`. */
  base: string;
  /**
   * Ground shadow, sized to the silhouette rather than to the canvas. Both
   * sheets use the same 224 x 160 cel, but they do not fill the same amount
   * of it.
   */
  shadow: { width: number; height: number; color: number; alpha: number };
  /** Player two's costume, applied to a copy of the atlas at load time. */
  alt: PaletteShift;
}

export interface RosterEntry {
  id: string;
  name: string;
  role: string;
  /** Short enough for the cast screen at 480 x 270. */
  note: string;
  /** One line under the portrait on the select screen. */
  tagline: string;
  status: 'playable' | 'concept';
  /** Present exactly when the fighter has a finished sprite sheet. */
  art?: FighterArt;
}

/**
 * Cast list for the attract and select screens. Status reflects what is
 * actually in `output/`: a fighter is playable when it has a sheet.
 */
export const ROSTER: RosterEntry[] = [
  {
    id: 'clawd',
    name: 'CLAWD',
    role: 'ALL-ROUNDER',
    note: 'TERRACOTTA BLOCK',
    tagline: 'PLANTS AND SWINGS',
    status: 'playable',
    art: {
      dir: 'clawd',
      base: 'clawd',
      shadow: { width: 96, height: 16, color: 0x35100e, alpha: 0.42 },
      alt: {
        // Teal sits opposite terracotta on the wheel, so the two fighters
        // never read as the same shape at speed. Saturation is nudged up and
        // lightness down so player two carries the same visual weight as
        // player one.
        hue: 178,
        saturation: 1.06,
        lightness: -0.05,
        preserveBelow: 0.06,
      },
    },
  },
  {
    id: 'grok',
    name: 'GROK BOT',
    role: 'SHAPESHIFTER',
    note: 'FLOATING ORB',
    tagline: 'BECOMES ITS ATTACK',
    status: 'playable',
    art: {
      dir: 'grok',
      base: 'grok',
      // A small round body over a small round shadow. Clawd's is wider
      // because Clawd is wider, not because the canvas is.
      shadow: { width: 68, height: 12, color: 0x0a0d14, alpha: 0.45 },
      alt: {
        // Grok Bot's body is charcoal at barely a sixth saturation, so a plain
        // hue rotation would return the same black orb. The floor gives the
        // rotation something to rotate, turning player two into an oxblood
        // orb; the eyes are held back above it so they stay white.
        hue: 150,
        saturation: 1,
        lightness: 0.14,
        preserveBelow: 0.06,
        preserveAbove: 0.9,
        saturationFloor: 0.55,
      },
    },
  },
  {
    id: 'muse',
    name: 'MUSE',
    role: 'GRAPPLER',
    note: 'CREAM PLUSH',
    tagline: 'SOFT AND HEAVY',
    status: 'playable',
    art: {
      dir: 'muse',
      base: 'muse',
      shadow: { width: 84, height: 15, color: 0x271611, alpha: 0.42 },
      alt: {
        // Cream is a warm near-white, so the rotation lands on a pale blue
        // plush and carries the chest mark from blue round to orange. Only
        // the lightness moves, because a plush that stops reading as soft
        // has lost the thing that makes it Muse.
        hue: 178,
        saturation: 1,
        lightness: -0.05,
        preserveBelow: 0.06,
      },
    },
  },
  {
    id: 'codex',
    name: 'CODEX',
    role: 'ZONER',
    note: 'CLOUD-HEADED SCREEN',
    tagline: 'WORKS AT RANGE',
    status: 'playable',
    art: {
      dir: 'codex',
      base: 'codex',
      // The cloud head is wide but the feet are not; the shadow follows the
      // feet, which is what is actually touching the floor.
      shadow: { width: 70, height: 13, color: 0x060d30, alpha: 0.45 },
      alt: {
        // Fourteen colours, all of them blue but the cyan screen. Half a turn
        // puts the body in gold and the screen in warm red, which is as far
        // from the original as this sheet can go.
        hue: 180,
        saturation: 1.06,
        lightness: -0.04,
        preserveBelow: 0.06,
      },
    },
  },
  {
    id: 'openclaw',
    name: 'OPENCLAW',
    role: 'RUSHDOWN',
    note: 'RED AND ANTENNAED',
    tagline: 'NEVER BACKS OFF',
    status: 'playable',
    art: {
      dir: 'openclaw',
      base: 'openclaw',
      // Wide body, small feet. The shadow follows the feet.
      shadow: { width: 70, height: 13, color: 0x160a0e, alpha: 0.45 },
      alt: {
        // Green rather than the teal directly opposite: the stage is a navy
        // night city, and a cool costume on a red fighter would lose the
        // silhouette against it. Green keeps the value contrast and turns the
        // turquoise pupils magenta, which the other four costumes leave free.
        hue: 140,
        saturation: 1.04,
        lightness: 0,
        preserveBelow: 0.06,
      },
    },
  },
];

/** The fighters with finished sheets, in cast order. */
export const PLAYABLE: RosterEntry[] = ROSTER.filter((entry) => entry.art !== undefined);

export function rosterEntry(id: string): RosterEntry {
  const entry = ROSTER.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`No roster entry for "${id}"`);
  return entry;
}

/** Throws for a fighter that is still only a drawing; callers check first. */
export function fighterArt(id: string): FighterArt {
  const { art } = rosterEntry(id);
  if (!art) throw new Error(`"${id}" has no sprite sheet and cannot be fought with`);
  return art;
}

export function isPlayable(id: string): boolean {
  return ROSTER.some((entry) => entry.id === id && entry.art !== undefined);
}

/** Falls back to the first playable fighter, so a bad URL cannot strand us. */
export function playableOr(id: string | null | undefined): string {
  return id && isPlayable(id) ? id : PLAYABLE[0].id;
}

/**
 * Two *different* playable fighters, for the attract demo.
 *
 * The demo is the machine advertising its cast, so showing the same fighter
 * twice wastes the one thing it is there to do. Falls back to a mirror only
 * while the roster is one deep.
 */
export function demoPair(): [string, string] {
  if (PLAYABLE.length < 2) return [PLAYABLE[0].id, PLAYABLE[0].id];
  const first = Math.floor(Math.random() * PLAYABLE.length);
  const second = (first + 1 + Math.floor(Math.random() * (PLAYABLE.length - 1))) % PLAYABLE.length;
  return [PLAYABLE[first].id, PLAYABLE[second].id];
}

/**
 * Names for the HUD.
 *
 * A mirror match needs two names, and the arcade answer is the one everybody
 * already reads correctly: the second one is the second one.
 */
export function matchNames(picks: readonly [string, string]): [string, string] {
  const [a, b] = picks.map((id) => rosterEntry(id).name);
  return picks[0] === picks[1] ? [a, `${b}-II`] : [a, b];
}
