/**
 * Checks on the soundtrack data.
 *
 * Tracker patterns are hand-typed note tables, so the failure mode is a typo:
 * a bar with fifteen steps instead of sixteen, an order entry naming a pattern
 * that does not exist, a note like "H#4" that silently never sounds. None of
 * those throw at runtime — they just quietly make the music wrong. These
 * checks catch all three.
 *
 * Run with `npm run test:music`.
 */
import { midiToFreq, noteToMidi } from '../src/game/audio/chip';
import { noteSteps, patternSteps, songBars, songSteps, tokenAt } from '../src/game/audio/music';
import type { Song } from '../src/game/audio/music';
import { FIGHT_THEME, SONGS, TITLE_THEME } from '../src/game/audio/songs';

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
}

const DRUMS = new Set(['K', 'S', 'H', 'T']);

// --- pitch ----------------------------------------------------------------
check('A4 is MIDI 69', noteToMidi('A4') === 69, `${noteToMidi('A4')}`);
check('A4 is 440 Hz', Math.abs(midiToFreq(69) - 440) < 1e-9);
check('C4 is middle C', noteToMidi('C4') === 60, `${noteToMidi('C4')}`);
check('sharps raise a semitone', noteToMidi('G#4')! - noteToMidi('G4')! === 1);
check('flats lower a semitone', noteToMidi('Bb4')! - noteToMidi('B4')! === -1);
check('octaves double the frequency', Math.abs(midiToFreq(81) / midiToFreq(69) - 2) < 1e-9);
check('nonsense is rejected', noteToMidi('H#4') === null && noteToMidi('.') === null);

// --- every pattern in every song -----------------------------------------
for (const song of SONGS) {
  let badLength = 0;
  let badToken = '';
  let missingPattern = '';
  let patternCount = 0;

  for (const track of song.tracks) {
    for (const [name, pattern] of Object.entries(track.patterns)) {
      patternCount += 1;
      const raw = pattern.trim().split(/\s+/);
      if (raw.length !== song.stepsPerBar) {
        badLength += 1;
        if (!badToken) badToken = `${name} has ${raw.length} steps`;
      }
      for (const token of raw) {
        if (token === '.' || token === '-') continue;
        const ok = track.voice.kind === 'noise' ? DRUMS.has(token) : noteToMidi(token) !== null;
        if (!ok && !badToken) badToken = `${name} contains "${token}"`;
      }
    }
    for (const name of track.order) {
      if (!(name in track.patterns) && !missingPattern) missingPattern = name;
    }
  }

  check(`${song.id}: every bar has ${song.stepsPerBar} steps`, badLength === 0, badToken);
  check(`${song.id}: every token is playable`, badToken === '' || badLength > 0, badToken);
  check(`${song.id}: every order entry exists`, missingPattern === '', missingPattern);
  check(`${song.id}: tracks stay in sync`, song.tracks.every((t) => songBars(song) % t.order.length === 0));
  check(`${song.id}: has patterns`, patternCount > 0, `${patternCount} patterns`);
}

// --- loop length ----------------------------------------------------------
for (const song of SONGS) {
  const seconds = (songSteps(song) * (60 / song.bpm) * 4) / song.stepsPerBar;
  check(
    `${song.id}: loop is between 10 and 60 seconds`,
    seconds > 10 && seconds < 60,
    `${seconds.toFixed(1)}s over ${songBars(song)} bars`,
  );
}

// --- sequencing -----------------------------------------------------------
{
  const song: Song = {
    id: 'probe',
    bpm: 120,
    stepsPerBar: 4,
    tracks: [
      {
        voice: { kind: 'pulse', gain: 1, length: 1, attack: 0, decay: 0, sustain: 1, release: 0 },
        patterns: { a: 'C4 . . -', b: 'E4 E4 . .' },
        order: ['a', 'b'],
      },
    ],
  };
  const track = song.tracks[0];
  check('patternSteps pads a short bar', patternSteps('C4', 4).join(' ') === 'C4 . . .');
  check('patternSteps trims a long bar', patternSteps('C4 D4 E4 F4 G4', 4).length === 4);
  check('tokenAt reads the first bar', tokenAt(song, track, 0) === 'C4');
  check('tokenAt reads the second bar', tokenAt(song, track, 4) === 'E4');
  check('tokenAt wraps the order list', tokenAt(song, track, 8) === 'C4');
  check('a held note extends', noteSteps(song, track, 0) === 3, `${noteSteps(song, track, 0)}`);
  check('a retrigger cuts the previous', noteSteps(song, track, 4) === 1);
  check('the last note does not cross the loop', noteSteps(song, track, 6) === 2);
}

// --- the two real songs ---------------------------------------------------
check('title theme is the slower of the two', TITLE_THEME.bpm < FIGHT_THEME.bpm);
check('both songs use all four channels', SONGS.every((s) => s.tracks.length === 4));
check(
  'each song has exactly one noise channel',
  SONGS.every((s) => s.tracks.filter((t) => t.voice.kind === 'noise').length === 1),
);

console.log(failures === 0 ? '\nAll music checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
