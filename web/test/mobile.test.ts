import { settingsFromUrl } from '../src/game/settings';
import { audio } from '../src/game/audio/engine';

function check(label: string, ok: boolean): void {
  if (!ok) throw new Error(label);
  console.log(`PASS ${label}`);
}
let mobile = true;
const gains: Array<{ gain: { value: number }; connect: () => void }> = [];
class FakeAudioContext {
  state = 'running';
  sampleRate = 100;
  destination = {};
  createGain() {
    const node = { gain: { value: 1 }, connect() {} };
    gains.push(node);
    return node;
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  matchMedia: () => ({ matches: mobile }), AudioContext: FakeAudioContext,
} });
check('mobile two-player links become CPU matches', settingsFromUrl('?mode=versus').mode === 'cpu');
mobile = false;
check('desktop two-player links still work', settingsFromUrl('?mode=versus').mode === 'versus');
check('desktop default stays single player', settingsFromUrl('').mode === 'cpu');

audio.setMuted(true);
audio.unlock();
check('saved mute applies before the first audio gesture', gains[0].gain.value === 0);
audio.setMusicEnabled(false);
audio.setSfxEnabled(true);
check('changing sound settings cannot override master mute', gains[0].gain.value === 0);
audio.setMuted(false);
check('unmuting restores master output', gains[0].gain.value === 1);
check('unmuting preserves disabled music', gains[2].gain.value === 0);
check('unmuting preserves enabled effects', gains[1].gain.value === 0.5);
audio.setMuted(true);
check('mute silences an already running audio context', gains[0].gain.value === 0);
