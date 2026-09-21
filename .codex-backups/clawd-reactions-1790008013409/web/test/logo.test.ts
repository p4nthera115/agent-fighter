/**
 * Checks on the logo alphabet.
 *
 * The glyphs are hand-typed pixel rows, so the failure modes are a row that is
 * a character short — which silently shifts everything after it — and a letter
 * the layout asks for that was never drawn, which throws only when the title
 * screen opens.
 *
 * Run with `npm run test:logo`.
 */
import { GLYPHS, LAYOUT, buildWord } from '../src/game/render/logo';

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
}

const ROWS = 11;

let ragged = '';
let wrongHeight = '';
let empty = '';
for (const [name, source] of Object.entries(GLYPHS)) {
  const rows = source.split('|');
  if (rows.length !== ROWS && !wrongHeight) wrongHeight = `${name} has ${rows.length} rows`;
  const widths = new Set(rows.map((r) => r.length));
  if (widths.size !== 1 && !ragged) ragged = `${name} has widths ${[...widths].join(',')}`;
  if (!source.includes('#') && !empty) empty = name;
  const bad = rows.find((r) => /[^#.]/.test(r));
  if (bad && !ragged) ragged = `${name} has a row with stray characters`;
}

check(`every glyph is ${ROWS} rows tall`, wrongHeight === '', wrongHeight);
check('every glyph has square rows', ragged === '', ragged);
check('no glyph is blank', empty === '', empty);
check('the alphabet has glyphs', Object.keys(GLYPHS).length > 0, `${Object.keys(GLYPHS).length} letters`);

// Every letter the title screen asks for has to exist.
let missing = '';
for (const word of LAYOUT) {
  for (const char of word.text) {
    if (!(char.toUpperCase() in GLYPHS) && !missing) missing = `${word.text} needs "${char}"`;
  }
}
check('the layout only uses letters that exist', missing === '', missing);

// Layout geometry, so the wordmark cannot silently grow off the 480x270 screen.
for (const word of LAYOUT) {
  const shape = buildWord(word.text, word.style.rise, word.style.slant);
  const filled = shape.grid.flat().filter(Boolean).length;
  check(`${word.text}: builds a non-empty mask`, filled > 40, `${filled} pixels`);
  check(
    `${word.text}: fits the screen at scale ${word.style.scale}`,
    (word.at[0] + shape.w) * word.style.scale < 470,
    `${((word.at[0] + shape.w) * word.style.scale).toFixed(0)}px wide`,
  );
}

const bottom = Math.max(
  ...LAYOUT.map((w) => {
    const shape = buildWord(w.text, w.style.rise, w.style.slant);
    return (w.at[1] + shape.h) * w.style.scale;
  }),
);
check('the wordmark is under 120px tall', bottom < 120, `${bottom.toFixed(0)}px`);

console.log(failures === 0 ? '\nAll logo checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
