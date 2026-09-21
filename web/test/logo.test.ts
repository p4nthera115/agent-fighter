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
import { GLYPHS, LAYOUT, VS_LAYOUT, buildWord } from '../src/game/render/logo';

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

// Every letter a layout asks for has to exist, and every layout has to fit
// the space it is drawn into. The versus mark stands in an 18px gutter and is
// allowed to bite into both portrait panels, but not so far that it reaches
// either nameplate.
const LAYOUTS = [
  { name: 'wordmark', layout: LAYOUT, maxWidth: 470 },
  { name: 'versus mark', layout: VS_LAYOUT, maxWidth: 140 },
];

let missing = '';
for (const { layout } of LAYOUTS) {
  for (const word of layout) {
    for (const char of word.text) {
      if (!(char.toUpperCase() in GLYPHS) && !missing) missing = `${word.text} needs "${char}"`;
    }
  }
}
check('every layout only uses letters that exist', missing === '', missing);

for (const { name, layout, maxWidth } of LAYOUTS) {
  for (const word of layout) {
    const shape = buildWord(word.text, word.style.rise, word.style.slant);
    const filled = shape.grid.flat().filter(Boolean).length;
    check(`${name} ${word.text}: builds a non-empty mask`, filled > 40, `${filled} pixels`);
    const width = (word.at[0] + shape.w) * word.style.scale;
    check(
      `${name} ${word.text}: fits its space at scale ${word.style.scale}`,
      width < maxWidth,
      `${width.toFixed(0)}px wide`,
    );
  }
}

const bottom = Math.max(
  ...LAYOUT.map((w) => {
    const shape = buildWord(w.text, w.style.rise, w.style.slant);
    return (w.at[1] + shape.h) * w.style.scale;
  }),
);
check('the wordmark is under 120px tall', bottom < 120, `${bottom.toFixed(0)}px`);

// The mark sits centred between the panels, so its height has to clear both
// the panel top edge and the nameplate it is drawn across.
const markHeight = Math.max(
  ...VS_LAYOUT.map((w) => {
    const shape = buildWord(w.text, w.style.rise, w.style.slant);
    return (w.at[1] + shape.h) * w.style.scale;
  }),
);
check('the versus mark is under 80px tall', markHeight < 80, `${markHeight.toFixed(0)}px`);

// A symbol between two equal halves cannot lean towards one of them.
check(
  'the versus mark sits level',
  VS_LAYOUT.every((w) => w.style.rise === 0),
);

console.log(failures === 0 ? '\nAll logo checks passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) throw new Error(`${failures} check(s) failed.`);
