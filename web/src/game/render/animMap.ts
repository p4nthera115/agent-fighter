import type { Fighter } from '../combat/fighter';
import type { MoveId } from '../combat/types';

interface SheetJson {
  frames: Array<{ filename: string; duration: number }>;
  meta: { frameTags: Array<{ name: string; from: number; to: number }> };
}

interface MovesJson {
  frameSize: { width: number; height: number };
  origin: { x: number; y: number };
  frames: Array<{ index: number; phase: string; duration: number; active: boolean }>;
}

export interface ArtClip {
  tag: string;
  from: number;
  to: number;
  /** Absolute frame index of the contact pose, if the clip has one. */
  contact: number;
  names: string[];
  durations: number[];
  totalMs: number;
}

/**
 * Bridges gameplay state to art frames.
 *
 * The direction of this mapping matters: combat decides *when* something
 * happens and this module only decides *what it looks like*. Retiming the
 * sprite sheet moves the pictures around inside a move; it never changes the
 * move's startup, active or recovery.
 *
 * One of these is built per fighter in a match, from that fighter's own pair
 * of exported JSON files. Nothing here is specific to a character, so a new
 * sheet needs no code.
 */
export class AnimMap {
  readonly clips = new Map<string, ArtClip>();
  readonly origin: { x: number; y: number };
  /** Cel size, so the renderer can place the pivot without a shared constant. */
  readonly frame: { w: number; h: number };

  constructor(sheet: SheetJson, moves: MovesJson) {
    this.origin = moves.origin;
    this.frame = { w: moves.frameSize.width, h: moves.frameSize.height };
    for (const tag of sheet.meta.frameTags) {
      const names: string[] = [];
      const durations: number[] = [];
      let contact = -1;
      for (let i = tag.from; i <= tag.to; i += 1) {
        names.push(sheet.frames[i].filename);
        durations.push(sheet.frames[i].duration);
        if (moves.frames[i]?.active) contact = i;
      }
      this.clips.set(tag.name, {
        tag: tag.name,
        from: tag.from,
        to: tag.to,
        contact: contact === -1 ? Math.floor((tag.from + tag.to) / 2) : contact,
        names,
        durations,
        totalMs: durations.reduce((sum, d) => sum + d, 0),
      });
    }
  }

  clip(tag: string): ArtClip {
    const clip = this.clips.get(tag);
    if (!clip) throw new Error(`Missing animation tag "${tag}" in the sprite sheet`);
    return clip;
  }

  /**
   * One named pose out of a clip, by position.
   *
   * Clips are not the same length from fighter to fighter — Clawd's attacks
   * run nine cels and Grok's six — so the states that borrow a pose rather
   * than playing a clip ask for it through here and get the nearest one that
   * exists.
   */
  pose(tag: string, index: number): string {
    const { names } = this.clip(tag);
    if (index < 0) return names[Math.max(0, names.length + index)];
    return names[Math.min(index, names.length - 1)];
  }

  /** Walks the clip's own millisecond timings, used for idle and walking. */
  frameAtTime(tag: string, elapsedMs: number, loop = true): string {
    const clip = this.clip(tag);
    let t = Math.max(0, elapsedMs);
    if (loop) t %= clip.totalMs;
    for (let i = 0; i < clip.names.length; i += 1) {
      t -= clip.durations[i];
      if (t < 0) return clip.names[i];
    }
    return clip.names[clip.names.length - 1];
  }

  /**
   * Picks the pose for an attack.
   *
   * Startup is spread across the frames before the contact pose, the active
   * window holds the contact pose, and recovery plays out the rest. The art
   * therefore always shows the fist out exactly while the hitbox is live,
   * whatever durations the sheet carries.
   */
  attackFrame(fighter: Fighter): string {
    const move = fighter.move;
    if (!move) return this.clip('idle').names[0];
    const clip = this.clip(move.id as MoveId);
    const contactLocal = clip.contact - clip.from;
    const phase = fighter.phase;

    if (phase === 'startup') {
      const ratio = move.startup === 0 ? 1 : fighter.moveTick / move.startup;
      const index = Math.min(contactLocal - 1, Math.floor(ratio * contactLocal));
      return clip.names[Math.max(0, index)];
    }

    if (phase === 'active') return clip.names[contactLocal];

    const recoveryTick = fighter.moveTick - move.startup - move.active;
    const tail = clip.names.length - 1 - contactLocal;
    const ratio = move.recovery === 0 ? 1 : recoveryTick / move.recovery;
    const index = contactLocal + Math.min(tail, Math.round(ratio * tail));
    return clip.names[Math.min(clip.names.length - 1, index)];
  }
}
