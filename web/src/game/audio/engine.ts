import { createNoiseBuffer } from './chip';

/**
 * One audio context for the whole cabinet.
 *
 * Sound effects and music share a graph so they can be balanced against each
 * other, and so music can be ducked out of the way of an impact:
 *
 *   sfxBus ──┐
 *            ├──▶ master ──▶ destination
 *   musicBus ┘
 *
 * Browsers start the context suspended until a gesture, so anything that wants
 * to make noise before then registers with `onUnlock` instead of failing.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private waiting: Array<() => void> = [];

  /** Music sits under the effects; impacts have to cut through it. */
  private musicVolume = 0.34;
  private sfxVolume = 0.5;
  /** Held low while the game is paused, as opposed to the momentary duck. */
  private dimmed = false;

  get context(): AudioContext | null {
    return this.ctx;
  }

  get sfxBus(): GainNode | null {
    return this.sfx;
  }

  get musicBus(): GainNode | null {
    return this.music;
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().then(() => this.flush());
      else this.flush();
      return;
    }

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = this.sfxVolume;
    this.sfx.connect(this.master);

    this.music = this.ctx.createGain();
    this.music.gain.value = this.musicVolume;
    this.music.connect(this.master);

    this.noise = createNoiseBuffer(this.ctx);

    if (this.ctx.state === 'suspended') void this.ctx.resume().then(() => this.flush());
    else this.flush();
  }

  private flush(): void {
    if (!this.ready) return;
    const handlers = this.waiting;
    this.waiting = [];
    for (const handler of handlers) handler();
  }

  /** Runs now if the context is live, otherwise on the next unlock. */
  onUnlock(handler: () => void): void {
    if (this.ready) handler();
    else this.waiting.push(handler);
  }

  noiseBuffer(): AudioBuffer | null {
    return this.noise;
  }

  setSfxEnabled(enabled: boolean): void {
    this.sfxVolume = enabled ? 0.5 : 0;
    if (this.sfx) this.sfx.gain.value = this.sfxVolume;
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicVolume = enabled ? 0.34 : 0;
    if (this.music) this.music.gain.value = this.musicTarget();
  }

  private musicTarget(): number {
    return this.musicVolume * (this.dimmed ? 0.22 : 1);
  }

  /** Holds the music back, for the pause screen. */
  setMusicDim(dimmed: boolean): void {
    if (this.dimmed === dimmed) return;
    this.dimmed = dimmed;
    if (!this.music || !this.ctx) return;
    const now = this.ctx.currentTime;
    const gain = this.music.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.linearRampToValueAtTime(this.musicTarget(), now + 0.18);
  }

  /**
   * Pulls the music down and lets it back up.
   *
   * Used on impact, so a hit lands in a hole in the mix rather than fighting
   * the lead for the same moment.
   */
  duckMusic(depth: number, holdSeconds: number): void {
    if (!this.music || !this.ctx || this.musicVolume === 0) return;
    const base = this.musicTarget();
    const now = this.ctx.currentTime;
    const gain = this.music.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(base * (1 - depth), now + 0.012);
    gain.setValueAtTime(base * (1 - depth), now + holdSeconds);
    gain.linearRampToValueAtTime(base, now + holdSeconds + 0.16);
  }
}

export const audio = new AudioEngine();
