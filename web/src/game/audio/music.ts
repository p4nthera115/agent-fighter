import { audio } from './engine';
import { noteToMidi, playDrum, playTone } from './chip';
import type { DrumKind, ScheduledNote, Voice } from './chip';

/**
 * Tracker-style sequencing.
 *
 * A pattern is a bar of whitespace-separated step tokens:
 *
 *   `A4`  trigger this note        `.`  hold the previous note
 *   `-`   release                  `K S H T` on a noise track, drum hits
 *
 * Each track carries its own bank of patterns plus an order list naming the
 * pattern for every bar, which is how a one-bar drum loop can sit under an
 * eight-bar melody without either being written out twice.
 */
export interface Track {
  voice: Voice;
  patterns: Record<string, string>;
  order: string[];
}

export interface Song {
  id: string;
  bpm: number;
  stepsPerBar: number;
  tracks: Track[];
}

const LOOKAHEAD_SECONDS = 0.12;
const TICK_MS = 25;

/** Splits a pattern into steps, padding short patterns with holds. */
export function patternSteps(pattern: string, stepsPerBar: number): string[] {
  const steps = pattern.trim().split(/\s+/);
  while (steps.length < stepsPerBar) steps.push('.');
  return steps.slice(0, stepsPerBar);
}

export function songBars(song: Song): number {
  return song.tracks.reduce((max, track) => Math.max(max, track.order.length), 1);
}

export function songSteps(song: Song): number {
  return songBars(song) * song.stepsPerBar;
}

/** The token a track shows at an absolute step, looping its order list. */
export function tokenAt(song: Song, track: Track, step: number): string {
  const bar = Math.floor(step / song.stepsPerBar) % track.order.length;
  const name = track.order[bar];
  const pattern = track.patterns[name];
  if (!pattern) return '.';
  return patternSteps(pattern, song.stepsPerBar)[step % song.stepsPerBar];
}

/**
 * How many steps a note started here should ring for.
 *
 * Held steps extend it, a release or the next note ends it. Notes do not carry
 * across the loop point, so the seam cannot leave one hanging.
 */
export function noteSteps(song: Song, track: Track, step: number): number {
  const total = songSteps(song);
  let length = 1;
  for (let next = step + 1; next < total; next += 1) {
    if (tokenAt(song, track, next) !== '.') break;
    length += 1;
  }
  return length;
}

const DRUMS = new Set(['K', 'S', 'H', 'T']);

/** Seconds per step. Four beats to the bar, so a 16-step bar is sixteenths. */
export function stepSeconds(song: Song, tempoScale = 1): number {
  return ((60 / song.bpm) * (4 / song.stepsPerBar)) / tempoScale;
}

/**
 * Schedules one step of every track.
 *
 * Exported so the live player and the offline renderer in the music lab drive
 * exactly the same code; a test that re-implemented the scheduler would only
 * be testing itself.
 */
export function emitStep(
  ctx: BaseAudioContext,
  bus: AudioNode,
  song: Song,
  step: number,
  when: number,
  secondsPerStep: number,
  noise: AudioBuffer | null,
  voiced: Array<ScheduledNote | null>,
): void {
  song.tracks.forEach((track, index) => {
    const token = tokenAt(song, track, step);
    if (token === '.') return;

    if (token === '-') {
      voiced[index]?.stop(when);
      voiced[index] = null;
      return;
    }

    if (track.voice.kind === 'noise') {
      if (!DRUMS.has(token)) return;
      if (noise) playDrum(ctx, bus, noise, token as DrumKind, when, track.voice.gain);
      return;
    }

    const midi = noteToMidi(token);
    if (midi === null) return;

    const duration = noteSteps(song, track, step) * secondsPerStep * track.voice.length;
    voiced[index]?.stop(when);
    voiced[index] = playTone(ctx, bus, track.voice, midi, when, duration);
  });
}

export class Music {
  private song: Song | null = null;
  private pending: Song | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextStepTime = 0;
  private enabled = true;
  private tempoScale = 1;
  private active: ScheduledNote[] = [];
  /** One live note per track, so a new note cuts the previous one. */
  private voiced: Array<ScheduledNote | null> = [];

  get currentId(): string | null {
    return this.song?.id ?? this.pending?.id ?? null;
  }

  /** Starts a song, or does nothing if it is already the one playing. */
  play(song: Song): void {
    if (this.currentId === song.id) return;
    this.stop();
    this.pending = song;
    audio.onUnlock(() => this.begin());
  }

  private begin(): void {
    const ctx = audio.context;
    const song = this.pending;
    if (!ctx || !song || !this.enabled) return;
    this.pending = null;
    this.song = song;
    this.step = 0;
    this.voiced = song.tracks.map(() => null);
    this.nextStepTime = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const when = audio.currentTime;
    for (const note of this.active) note.stop(when);
    this.active = [];
    this.voiced = [];
    this.song = null;
    this.pending = null;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    audio.setMusicEnabled(value);
    if (!value) {
      const resume = this.song ?? this.pending;
      this.stop();
      // Remember what was playing so the toggle can put it back.
      this.pending = resume;
    } else if (this.pending && this.timer === null) {
      audio.onUnlock(() => this.begin());
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** 1 is the written tempo; the fight pushes this up when health is low. */
  setIntensity(scale: number): void {
    this.tempoScale = Math.max(0.5, Math.min(2, scale));
  }

  duck(depth: number, seconds: number): void {
    audio.duckMusic(depth, seconds);
  }

  private secondsPerStep(song: Song): number {
    return stepSeconds(song, this.tempoScale);
  }

  private schedule(): void {
    const ctx = audio.context;
    const song = this.song;
    if (!ctx || !song) return;

    const horizon = ctx.currentTime + LOOKAHEAD_SECONDS;
    let guard = 0;
    while (this.nextStepTime < horizon && guard < 256) {
      this.emit(song, this.step, this.nextStepTime);
      this.nextStepTime += this.secondsPerStep(song);
      this.step = (this.step + 1) % songSteps(song);
      guard += 1;
    }

    // Drop handles for notes that have already finished.
    if (this.active.length > 96) this.active = this.active.slice(-48);
  }

  private emit(song: Song, step: number, when: number): void {
    const ctx = audio.context;
    const bus = audio.musicBus;
    if (!ctx || !bus) return;
    emitStep(ctx, bus, song, step, when, this.secondsPerStep(song), audio.noiseBuffer(), this.voiced);
    for (const note of this.voiced) if (note) this.active.push(note);
  }
}

export const music = new Music();
