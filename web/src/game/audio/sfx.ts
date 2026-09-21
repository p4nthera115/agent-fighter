import { audio } from './engine';

/**
 * Synthesised sound effects.
 *
 * The project has no audio assets, and shipping placeholder samples would be
 * worse than shaping the sounds directly: a Web Audio graph costs nothing to
 * download and keeps the impact timing locked to the simulation.
 *
 * The context, the buses and the noise buffer live in `engine.ts`, shared with
 * the music so the two can be balanced and so an impact can duck the score.
 */

type Curve = 'exp' | 'linear';

export class Sfx {
  private enabled = true;

  /** Browsers require a gesture before audio starts; call this from one. */
  unlock(): void {
    audio.unlock();
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    audio.setSfxEnabled(value);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  private tone(
    frequency: number,
    endFrequency: number,
    duration: number,
    gain: number,
    type: OscillatorType = 'square',
    curve: Curve = 'exp',
    delay = 0,
  ): void {
    const ctx = audio.context;
    const bus = audio.sfxBus;
    if (!ctx || !bus || !this.enabled) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (curve === 'exp') {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    } else {
      osc.frequency.linearRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    }
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env).connect(bus);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noise(duration: number, gain: number, filterFrom: number, filterTo: number): void {
    const ctx = audio.context;
    const bus = audio.sfxBus;
    const buffer = audio.noiseBuffer();
    if (!ctx || !bus || !buffer || !this.enabled) return;

    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(filterFrom, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), now + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(env).connect(bus);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  swing(weight: number): void {
    this.noise(0.13 + weight * 0.05, 0.16, 1800 - weight * 500, 320);
  }

  hit(power: number, counter: boolean): void {
    this.tone(180 + power * 60, 46, 0.16 + power * 0.08, 0.3, 'square');
    this.noise(0.1 + power * 0.06, 0.34, 900, 120);
    if (counter) this.tone(1200, 420, 0.12, 0.16, 'triangle');
    // Pull the music down so the impact lands in a hole in the mix.
    audio.duckMusic(0.45 + power * 0.25, 0.09 + power * 0.06);
  }

  guard(): void {
    this.tone(760, 520, 0.07, 0.18, 'square');
    this.noise(0.07, 0.14, 3200, 1400);
    audio.duckMusic(0.3, 0.05);
  }

  jump(): void {
    this.tone(220, 520, 0.11, 0.12, 'square', 'linear');
  }

  land(hard: boolean): void {
    this.noise(hard ? 0.2 : 0.1, hard ? 0.3 : 0.14, 400, 70);
    if (hard) this.tone(120, 44, 0.22, 0.22, 'triangle');
  }

  knockdown(): void {
    this.noise(0.3, 0.34, 520, 60);
    this.tone(150, 40, 0.3, 0.26, 'sawtooth');
    audio.duckMusic(0.5, 0.2);
  }

  ko(): void {
    this.tone(320, 60, 0.7, 0.3, 'sawtooth');
    this.noise(0.6, 0.3, 1200, 80);
  }

  bell(): void {
    this.tone(880, 880, 0.18, 0.2, 'triangle');
    this.tone(1320, 1320, 0.3, 0.16, 'triangle', 'exp', 0.11);
  }

  /** Short rising fanfare for the end of a match. */
  victory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, i) => {
      this.tone(frequency, frequency, 0.16, 0.2, 'square', 'exp', i * 0.11);
      this.tone(frequency / 2, frequency / 2, 0.16, 0.12, 'triangle', 'exp', i * 0.11);
    });
    this.tone(1046.5, 1046.5, 0.55, 0.22, 'square', 'exp', 0.46);
    this.tone(1567.98, 1567.98, 0.55, 0.12, 'square', 'exp', 0.46);
  }

  announce(step: number): void {
    this.tone(440 + step * 110, 440 + step * 110, 0.16, 0.18, 'square');
  }
}

export const sfx = new Sfx();
