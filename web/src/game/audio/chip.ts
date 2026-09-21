/**
 * A small chip-voice synth: two pulse channels, a triangle, and noise.
 *
 * That is the NES layout, and keeping to it is what stops the music drifting
 * into "retro-flavoured" territory. Everything is built from oscillators, so
 * the soundtrack adds nothing to the download.
 */

export type ChannelKind = 'pulse' | 'triangle' | 'noise';

export interface Voice {
  kind: ChannelKind;
  /** Pulse width. 0.125 is thin and reedy, 0.5 is a hollow square. */
  duty?: number;
  gain: number;
  /** Note length as a fraction of one step. Below 1 leaves a gap. */
  length: number;
  attack: number;
  decay: number;
  /** Level held after the decay, as a fraction of the peak. */
  sustain: number;
  release: number;
  /** Semitones added to every note, for writing patterns in one octave. */
  transpose?: number;
  vibrato?: { rate: number; depth: number; delay: number };
}

const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Parses scientific pitch ("A4", "G#3", "Bb5") to a MIDI number. */
export function noteToMidi(name: string): number | null {
  const match = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name);
  if (!match) return null;
  const [, letter, accidental, octave] = match;
  const base = NOTE_OFFSETS[letter.toUpperCase()];
  if (base === undefined) return null;
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (Number.parseInt(octave, 10) + 1) * 12 + base + shift;
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

const waveCache = new Map<string, PeriodicWave>();

/**
 * Builds a band-limited pulse wave of the given duty cycle.
 *
 * Web Audio only ships a 50% square, and duty is most of what makes one chip
 * lead sound different from another, so the harmonics are computed directly:
 * a_n = (2 / n*pi) * sin(n * pi * duty).
 */
function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const key = `${duty}`;
  const cached = waveCache.get(key);
  if (cached) return cached;

  const harmonics = 32;
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);
  for (let n = 1; n < harmonics; n += 1) {
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  }
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  waveCache.set(key, wave);
  return wave;
}

export interface ScheduledNote {
  stop(when: number): void;
}

/** Plays one pitched note and returns a handle so it can be cut short. */
export function playTone(
  ctx: BaseAudioContext,
  destination: AudioNode,
  voice: Voice,
  midi: number,
  start: number,
  duration: number,
): ScheduledNote {
  const osc = ctx.createOscillator();
  if (voice.kind === 'pulse') osc.setPeriodicWave(pulseWave(ctx, voice.duty ?? 0.5));
  else osc.type = 'triangle';
  osc.frequency.setValueAtTime(midiToFreq(midi + (voice.transpose ?? 0)), start);

  const env = ctx.createGain();
  const peak = Math.max(0.0001, voice.gain);
  const sustainLevel = Math.max(0.0001, peak * voice.sustain);
  const attackEnd = start + voice.attack;
  const decayEnd = attackEnd + voice.decay;
  const end = start + duration;

  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(peak, attackEnd);
  env.gain.exponentialRampToValueAtTime(sustainLevel, Math.max(decayEnd, attackEnd + 0.001));
  env.gain.setValueAtTime(sustainLevel, Math.max(end, decayEnd + 0.001));
  env.gain.exponentialRampToValueAtTime(0.0001, Math.max(end, decayEnd + 0.001) + voice.release);

  let vibrato: OscillatorNode | null = null;
  if (voice.vibrato) {
    vibrato = ctx.createOscillator();
    vibrato.frequency.value = voice.vibrato.rate;
    const depth = ctx.createGain();
    // Depth is in cents, applied to detune so it stays musical at any pitch.
    depth.gain.setValueAtTime(0, start);
    depth.gain.setValueAtTime(0, start + voice.vibrato.delay);
    depth.gain.linearRampToValueAtTime(voice.vibrato.depth, start + voice.vibrato.delay + 0.08);
    vibrato.connect(depth).connect(osc.detune);
    vibrato.start(start);
    vibrato.stop(end + voice.release + 0.05);
  }

  osc.connect(env).connect(destination);
  osc.start(start);
  const stopAt = end + voice.release + 0.05;
  osc.stop(stopAt);

  return {
    stop(when: number) {
      try {
        env.gain.cancelScheduledValues(when);
        env.gain.setValueAtTime(Math.max(0.0001, env.gain.value), when);
        env.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
        osc.stop(when + 0.06);
        vibrato?.stop(when + 0.06);
      } catch {
        // Already stopped; nothing to do.
      }
    },
  };
}

/** White noise for the percussion channel and the effect bus. */
export function createNoiseBuffer(ctx: BaseAudioContext, seconds = 0.6): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export type DrumKind = 'K' | 'S' | 'H' | 'T';

/** Percussion, built from a noise burst plus a pitched thump for the kick. */
export function playDrum(
  ctx: BaseAudioContext,
  destination: AudioNode,
  noise: AudioBuffer,
  kind: DrumKind,
  start: number,
  gain: number,
): void {
  if (kind === 'K' || kind === 'T') {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const top = kind === 'K' ? 148 : 320;
    const bottom = kind === 'K' ? 44 : 120;
    const length = kind === 'K' ? 0.16 : 0.13;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(top, start);
    osc.frequency.exponentialRampToValueAtTime(bottom, start + length);
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(env).connect(destination);
    osc.start(start);
    osc.stop(start + length + 0.02);
    if (kind === 'K') return;
  }

  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.playbackRate.value = kind === 'H' ? 1.6 : 1;

  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  let length: number;
  if (kind === 'H') {
    filter.type = 'highpass';
    filter.frequency.value = 7400;
    length = 0.035;
  } else if (kind === 'S') {
    filter.type = 'bandpass';
    filter.frequency.value = 1900;
    filter.Q.value = 0.7;
    length = 0.13;
  } else {
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;
    length = 0.1;
  }

  const level = kind === 'H' ? gain * 0.45 : gain;
  env.gain.setValueAtTime(level, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + length);

  source.connect(filter).connect(env).connect(destination);
  source.start(start, 0, length + 0.02);
}
