import type { Song, Track } from './music';
import type { Voice } from './chip';

/**
 * The soundtrack, written as tracker data.
 *
 * Both pieces sit on a NES channel layout: a pulse lead, a pulse arpeggio for
 * the chords, a triangle bass, and noise percussion. Chords are played as fast
 * arpeggios rather than held stacks because a chip has no spare channel for
 * them — that rattle is the sound of the constraint, not a stylistic choice.
 */

function lead(duty: number, gain: number, vibrato = true): Voice {
  return {
    kind: 'pulse',
    duty,
    gain,
    length: 0.92,
    attack: 0.005,
    decay: 0.05,
    sustain: 0.62,
    release: 0.05,
    ...(vibrato ? { vibrato: { rate: 5.4, depth: 13, delay: 0.16 } } : {}),
  };
}

function arp(duty: number, gain: number): Voice {
  return {
    kind: 'pulse',
    duty,
    gain,
    // Short and plucky: the arpeggio is texture, and holding it would turn
    // the chord into a wash that buries the lead.
    length: 0.5,
    attack: 0.002,
    decay: 0.02,
    sustain: 0.28,
    release: 0.02,
  };
}

function bassVoice(gain: number): Voice {
  return {
    kind: 'triangle',
    gain,
    length: 0.88,
    attack: 0.004,
    decay: 0.07,
    sustain: 0.72,
    release: 0.06,
  };
}

function drumVoice(gain: number): Voice {
  return { kind: 'noise', gain, length: 1, attack: 0, decay: 0, sustain: 1, release: 0 };
}

/* ------------------------------------------------------------------ title */

const TITLE_LEAD: Track = {
  voice: lead(0.5, 0.2),
  patterns: {
    t1: 'E5 .  .  .  G5 .  .  .  C6 .  .  .  .  .  B5 .',
    t2: 'A5 .  .  .  .  .  E5 .  G5 .  .  .  .  .  .  .',
    t3: 'F5 .  .  .  A5 .  .  .  C6 .  .  .  A5 .  G5 .',
    t4: 'G5 .  .  .  .  .  D5 .  B4 .  .  .  .  .  -  .',
    t5: 'C5 .  E5 .  G5 .  C6 .  .  .  .  .  B5 .  A5 .',
    t6: 'G5 .  .  .  E5 .  .  .  A4 .  .  .  C5 .  E5 .',
    t7: 'D5 .  .  .  F5 .  A5 .  D6 .  .  .  A5 .  F5 .',
    t8: 'G5 .  .  .  B5 .  .  .  D6 .  .  .  .  .  -  .',
  },
  order: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'],
};

const TITLE_ARP: Track = {
  voice: arp(0.25, 0.075),
  patterns: {
    C: 'C4 .  E4 .  G4 .  E4 .  C4 .  E4 .  G4 .  E4 .',
    Am: 'A3 .  C4 .  E4 .  C4 .  A3 .  C4 .  E4 .  C4 .',
    F: 'F3 .  A3 .  C4 .  A3 .  F3 .  A3 .  C4 .  A3 .',
    G: 'G3 .  B3 .  D4 .  B3 .  G3 .  B3 .  D4 .  B3 .',
    Dm: 'D4 .  F4 .  A4 .  F4 .  D4 .  F4 .  A4 .  F4 .',
  },
  order: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'],
};

const TITLE_BASS: Track = {
  voice: bassVoice(0.26),
  patterns: {
    C: 'C3 .  .  .  .  .  .  .  G2 .  .  .  .  .  .  .',
    Am: 'A2 .  .  .  .  .  .  .  E2 .  .  .  .  .  .  .',
    F: 'F2 .  .  .  .  .  .  .  C3 .  .  .  .  .  .  .',
    G: 'G2 .  .  .  .  .  .  .  D3 .  .  .  .  .  .  .',
    Dm: 'D3 .  .  .  .  .  .  .  A2 .  .  .  .  .  .  .',
  },
  order: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'],
};

const TITLE_DRUMS: Track = {
  voice: drumVoice(0.2),
  patterns: {
    soft: 'K .  .  .  H .  .  .  S .  .  .  H .  .  H',
    fill: 'K .  .  .  H .  .  .  S .  .  .  S .  S .',
  },
  order: ['soft', 'soft', 'soft', 'soft', 'soft', 'soft', 'soft', 'fill'],
};

/** Eight bars in C major, about eighteen seconds. Warm, not urgent. */
export const TITLE_THEME: Song = {
  id: 'title',
  bpm: 108,
  stepsPerBar: 16,
  tracks: [TITLE_BASS, TITLE_ARP, TITLE_LEAD, TITLE_DRUMS],
};

/* ------------------------------------------------------------------ fight */

const FIGHT_LEAD: Track = {
  voice: lead(0.25, 0.22),
  patterns: {
    // A section: a rising call, answered by a fall.
    a1: 'A4 .  .  .  C5 .  E5 .  A5 .  .  .  G5 .  E5 .',
    a2: 'F5 .  .  .  E5 .  C5 .  A4 .  .  .  C5 .  .  .',
    a3: 'G4 .  .  .  C5 .  E5 .  G5 .  .  .  E5 .  C5 .',
    a4: 'D5 .  .  .  B4 .  D5 .  G5 .  .  .  .  .  -  .',
    // Turnaround: the same bar, climbing instead of resolving.
    a4b: 'D5 .  .  .  B4 .  D5 .  G5 .  A5 .  B5 .  D6 .',
    // B section opens with a run straight down the scale.
    b1: 'A5 .  G5 .  F5 .  E5 .  D5 .  C5 .  B4 .  A4 .',
    b2: 'C5 .  .  .  F5 .  .  .  E5 .  D5 .  C5 .  .  .',
    b3: 'B4 .  .  .  D5 .  .  .  G5 .  .  .  F5 .  D5 .',
    // E major, not E minor: the raised third pulls hard back to A.
    b4: 'E5 .  .  .  G#5 . B5 .  E5 .  .  .  .  .  -  .',
    b4b: 'E5 .  .  .  G#5 . B5 .  E6 .  .  .  D6 .  B5 .',
  },
  order: [
    'a1', 'a2', 'a3', 'a4',
    'a1', 'a2', 'a3', 'a4b',
    'b1', 'b2', 'b3', 'b4',
    'b1', 'b2', 'b3', 'b4b',
  ],
};

const FIGHT_ARP: Track = {
  voice: arp(0.125, 0.09),
  patterns: {
    Am: 'A4 C5 E5 A4 C5 E5 A4 C5 E5 A4 C5 E5 A4 C5 E5 A4',
    F: 'F4 A4 C5 F4 A4 C5 F4 A4 C5 F4 A4 C5 F4 A4 C5 F4',
    C: 'G4 C5 E5 G4 C5 E5 G4 C5 E5 G4 C5 E5 G4 C5 E5 G4',
    G: 'G4 B4 D5 G4 B4 D5 G4 B4 D5 G4 B4 D5 G4 B4 D5 G4',
    E: 'E4 G#4 B4 E4 G#4 B4 E4 G#4 B4 E4 G#4 B4 E4 G#4 B4 E4',
    // The chord bed drops out under the descending run, so the B section
    // arrives as a lift rather than more of the same.
    out: '-  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .',
  },
  order: [
    'Am', 'F', 'C', 'G',
    'Am', 'F', 'C', 'G',
    'out', 'F', 'G', 'E',
    'Am', 'F', 'G', 'E',
  ],
};

const FIGHT_BASS: Track = {
  voice: bassVoice(0.28),
  patterns: {
    Am: 'A2 .  A2 .  A2 .  A3 .  A2 .  A2 .  E3 .  G3 .',
    F: 'F2 .  F2 .  F2 .  F3 .  F2 .  F2 .  C3 .  E3 .',
    C: 'C3 .  C3 .  C3 .  C4 .  C3 .  C3 .  G3 .  B3 .',
    G: 'G2 .  G2 .  G2 .  G3 .  G2 .  G2 .  D3 .  F3 .',
    E: 'E2 .  E2 .  E2 .  E3 .  E2 .  E2 .  B2 .  D3 .',
  },
  order: [
    'Am', 'F', 'C', 'G',
    'Am', 'F', 'C', 'G',
    'Am', 'F', 'G', 'E',
    'Am', 'F', 'G', 'E',
  ],
};

const FIGHT_DRUMS: Track = {
  voice: drumVoice(0.32),
  patterns: {
    beat: 'K .  H .  S .  H .  K .  H K  S .  H .',
    fill: 'K .  H .  S .  H .  K .  S .  S S  S S',
    // Thinned to match the chord drop on the same bar.
    open: 'K .  .  .  S .  .  .  .  .  .  .  S .  S .',
  },
  order: [
    'beat', 'beat', 'beat', 'beat',
    'beat', 'beat', 'beat', 'fill',
    'open', 'beat', 'beat', 'beat',
    'beat', 'beat', 'beat', 'fill',
  ],
};

/** Sixteen bars in A minor, about twenty-five seconds before it comes round. */
export const FIGHT_THEME: Song = {
  id: 'fight',
  bpm: 152,
  stepsPerBar: 16,
  tracks: [FIGHT_BASS, FIGHT_ARP, FIGHT_LEAD, FIGHT_DRUMS],
};

export const SONGS = [TITLE_THEME, FIGHT_THEME];
