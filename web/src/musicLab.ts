/**
 * Dev-only tool for the soundtrack.
 *
 * Auditions each song live, and renders it through an OfflineAudioContext to
 * report levels. The offline pass matters because it drives `emitStep` — the
 * same function the game uses — so the numbers describe the real output, not a
 * re-implementation of it.
 *
 * Served at /music-lab.html by `npm run dev`. Vite only takes index.html as a
 * build input, so this never reaches dist/.
 */
import { audio } from './game/audio/engine';
import { createNoiseBuffer } from './game/audio/chip';
import type { ScheduledNote } from './game/audio/chip';
import { emitStep, music, songBars, songSteps, stepSeconds } from './game/audio/music';
import type { Song } from './game/audio/music';
import { FIGHT_THEME, TITLE_THEME } from './game/audio/songs';

const SONGS: Record<string, Song> = { title: TITLE_THEME, fight: FIGHT_THEME };

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

interface Analysis {
  song: string;
  seconds: number;
  peak: number;
  rms: number;
  clipped: number;
  silentWindows: number;
  windows: number[];
}

async function analyse(song: Song, seconds: number, tempoScale = 1): Promise<Analysis> {
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
  const bus = ctx.createGain();
  // Match the engine's music bus level so the numbers mean something.
  bus.gain.value = 0.34;
  bus.connect(ctx.destination);

  const noise = createNoiseBuffer(ctx);
  const voiced: Array<ScheduledNote | null> = song.tracks.map(() => null);
  const perStep = stepSeconds(song, tempoScale);
  const total = songSteps(song);

  let when = 0;
  let step = 0;
  while (when < seconds) {
    emitStep(ctx, bus, song, step % total, when, perStep, noise, voiced);
    when += perStep;
    step += 1;
  }

  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0);

  let peak = 0;
  let sum = 0;
  let clipped = 0;
  for (let i = 0; i < data.length; i += 1) {
    const value = Math.abs(data[i]);
    if (value > peak) peak = value;
    if (value >= 0.999) clipped += 1;
    sum += data[i] * data[i];
  }

  // Half-second windows, to show the piece has structure rather than a
  // constant drone or a gap where a channel dropped out.
  const windowSize = Math.floor(rate * 0.5);
  const windows: number[] = [];
  for (let start = 0; start + windowSize <= data.length; start += windowSize) {
    let acc = 0;
    for (let i = start; i < start + windowSize; i += 1) acc += data[i] * data[i];
    windows.push(Math.sqrt(acc / windowSize));
  }

  return {
    song: song.id,
    seconds,
    peak,
    rms: Math.sqrt(sum / data.length),
    clipped,
    silentWindows: windows.filter((w) => w < 0.0005).length,
    windows,
  };
}

function describe(a: Analysis): string {
  const db = (v: number) => (v <= 0 ? '-inf' : (20 * Math.log10(v)).toFixed(1));
  return [
    `${a.song}: ${a.seconds.toFixed(1)}s`,
    `peak ${a.peak.toFixed(3)} (${db(a.peak)} dBFS)`,
    `rms ${a.rms.toFixed(4)} (${db(a.rms)} dBFS)`,
    `clipped samples ${a.clipped}`,
    `silent windows ${a.silentWindows}/${a.windows.length}`,
  ].join('   ');
}

function drawWindows(canvas: HTMLCanvasElement, windows: number[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#12101c';
  ctx.fillRect(0, 0, width, height);
  const max = Math.max(0.01, ...windows);
  const barWidth = width / windows.length;
  windows.forEach((value, i) => {
    const h = (value / max) * (height - 4);
    ctx.fillStyle = '#ffc24a';
    ctx.fillRect(i * barWidth, height - h, Math.max(1, barWidth - 1), h);
  });
}

async function runAnalysis(): Promise<void> {
  const out = el<HTMLPreElement>('analysis');
  out.textContent = 'rendering...';
  const results: Analysis[] = [];
  for (const song of [TITLE_THEME, FIGHT_THEME]) {
    const loop = (songSteps(song) * stepSeconds(song));
    results.push(await analyse(song, loop, 1));
  }
  // The fight theme also runs faster when a fighter is in danger.
  results.push(await analyse(FIGHT_THEME, 8, 1.09));

  out.textContent = results.map(describe).join('\n');
  drawWindows(el<HTMLCanvasElement>('windows'), results[1].windows);
  (window as unknown as { __analysis?: Analysis[] }).__analysis = results;
}

function meter(): void {
  const canvas = el<HTMLCanvasElement>('meter');
  const ctx = canvas.getContext('2d');
  let analyser: AnalyserNode | null = null;

  const draw = () => {
    requestAnimationFrame(draw);
    if (!ctx) return;
    const context = audio.context;
    const bus = audio.musicBus;
    if (context && bus && !analyser) {
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      bus.connect(analyser);
    }
    ctx.fillStyle = '#12101c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!analyser) return;

    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    ctx.strokeStyle = '#8fd8ff';
    ctx.beginPath();
    for (let i = 0; i < data.length; i += 1) {
      const x = (i / data.length) * canvas.width;
      const y = ((data[i] - 128) / 128) * (canvas.height / 2) + canvas.height / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  draw();
}

for (const [id, song] of Object.entries(SONGS)) {
  el<HTMLButtonElement>(`play-${id}`).addEventListener('click', () => {
    audio.unlock();
    music.setEnabled(true);
    music.play(song);
    el<HTMLSpanElement>('now').textContent =
      `${song.id} — ${song.bpm} bpm, ${songBars(song)} bars, ${(songSteps(song) * stepSeconds(song)).toFixed(1)}s loop`;
  });
}

el<HTMLButtonElement>('stop').addEventListener('click', () => {
  music.stop();
  el<HTMLSpanElement>('now').textContent = 'stopped';
});

const tempo = el<HTMLInputElement>('tempo');
tempo.addEventListener('input', () => {
  const scale = Number.parseFloat(tempo.value);
  music.setIntensity(scale);
  el<HTMLSpanElement>('tempo-value').textContent = `${scale.toFixed(2)}x`;
});

el<HTMLButtonElement>('analyse').addEventListener('click', () => void runAnalysis());

meter();
void runAnalysis();
