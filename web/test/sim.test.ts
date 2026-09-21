/**
 * Headless checks on the combat simulation.
 *
 * The match is pure TypeScript with no Phaser or DOM dependency, which is what
 * makes it testable like this: same inputs, same result, no renderer.
 *
 * Run with `npm run test:sim`.
 */
import { Match } from '../src/game/combat/match';
import { FighterAI } from '../src/game/combat/ai';
import { MOVES, RULES, blockAdvantage, hitAdvantage, moveLength } from '../src/game/combat/frameData';
import { emptyInput } from '../src/game/combat/types';
import type { InputState } from '../src/game/combat/types';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
}

const idle = (): [InputState, InputState] => [emptyInput(), emptyInput()];

// --- 1. A jab at point blank connects and deals its listed damage ----------
{
  const m = new Match('A', 'B');
  while (m.phase === 'intro') m.step(idle());
  // Walk into range.
  const walk = emptyInput(); walk.right = true;
  let guard = 0;
  while (Math.abs(m.fighters[0].x - m.fighters[1].x) > 110 && guard++ < 400) {
    m.step([walk, emptyInput()]);
  }
  const before = m.fighters[1].health;
  const punch = emptyInput(); punch.punch = true;
  m.step([punch, emptyInput()]);
  for (let i = 0; i < 30; i += 1) m.step(idle());
  const dealt = before - m.fighters[1].health;
  check('jab connects at close range', dealt > 0, `dealt ${dealt}`);
  check('jab deals its listed damage', dealt === MOVES.punch.damage, `${dealt} vs ${MOVES.punch.damage}`);
}

// --- 2. Holding back blocks, and only chip gets through --------------------
{
  const m = new Match('A', 'B');
  while (m.phase === 'intro') m.step(idle());
  const walk = emptyInput(); walk.right = true;
  let guard = 0;
  while (Math.abs(m.fighters[0].x - m.fighters[1].x) > 110 && guard++ < 400) m.step([walk, emptyInput()]);
  const before = m.fighters[1].health;
  const punch = emptyInput(); punch.punch = true;
  const block = emptyInput(); block.right = true; // player two faces left, so right is away
  m.step([punch, block]);
  for (let i = 0; i < 30; i += 1) m.step([emptyInput(), block]);
  const dealt = before - m.fighters[1].health;
  check('blocked jab only chips', dealt === MOVES.punch.chip, `dealt ${dealt}, chip is ${MOVES.punch.chip}`);
}

// --- 3. Crouch-blocking loses to the overhead ------------------------------
{
  const m = new Match('A', 'B');
  while (m.phase === 'intro') m.step(idle());
  const walk = emptyInput(); walk.right = true;
  let guard = 0;
  while (Math.abs(m.fighters[0].x - m.fighters[1].x) > 95 && guard++ < 400) m.step([walk, emptyInput()]);
  const before = m.fighters[1].health;
  const up = emptyInput(); up.uppercut = true;
  const crouchBlock = emptyInput(); crouchBlock.right = true; crouchBlock.down = true;
  m.step([up, crouchBlock]);
  for (let i = 0; i < 20; i += 1) m.step([emptyInput(), crouchBlock]);
  const dealt = before - m.fighters[1].health;
  check('uppercut beats a crouching guard', dealt > MOVES.uppercut.chip, `dealt ${dealt}`);
  check('uppercut launches', m.fighters[1].y > 0 || m.fighters[1].action === 'knockdown', `y=${m.fighters[1].y.toFixed(1)} action=${m.fighters[1].action}`);
}

// --- 4. A launched fighter lands in a knockdown and wakes up ---------------
{
  const m = new Match('A', 'B');
  while (m.phase === 'intro') m.step(idle());
  const walk = emptyInput(); walk.right = true;
  let guard = 0;
  while (Math.abs(m.fighters[0].x - m.fighters[1].x) > 95 && guard++ < 400) m.step([walk, emptyInput()]);
  const up = emptyInput(); up.uppercut = true;
  m.step([up, emptyInput()]);
  let sawKnockdown = false;
  for (let i = 0; i < 180; i += 1) {
    m.step(idle());
    if (m.fighters[1].action === 'knockdown') sawKnockdown = true;
  }
  check('launch resolves into a knockdown', sawKnockdown);
  check('fighter recovers to neutral', m.fighters[1].action === 'free', `action=${m.fighters[1].action}`);
}

// --- 5. Frame advantage matches the published table ------------------------
for (const id of ['punch', 'kick', 'uppercut'] as const) {
  const move = MOVES[id];
  check(
    `${id} frame data is internally consistent`,
    moveLength(move) === move.startup + move.active + move.recovery &&
      hitAdvantage(move) > blockAdvantage(move),
    `on hit ${hitAdvantage(move)}, on block ${blockAdvantage(move)}`,
  );
}
check('uppercut is punishable on block', blockAdvantage(MOVES.uppercut) <= -10, `${blockAdvantage(MOVES.uppercut)}`);
check('jab is safe on block', blockAdvantage(MOVES.punch) >= -3, `${blockAdvantage(MOVES.punch)}`);

// --- 6. A full AI-vs-AI match completes without stalling or going wrong ----
{
  const m = new Match('A', 'B');
  const a = new FighterAI(0, 'boss');
  const b = new FighterAI(1, 'rival');
  let ticks = 0;
  let kos = 0;
  while (m.phase !== 'matchEnd' && ticks < 60 * 60 * 12) {
    const inputs: [InputState, InputState] = [
          a.update(m),
      b.update(m),
    ];
    m.step(inputs);
    for (const event of m.drainEvents()) if (event.type === 'ko') kos += 1;
    ticks += 1;
  }
  const finite = m.fighters.every((f) => Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.health));
  check('AI match reaches a result', m.phase === 'matchEnd', `after ${ticks} ticks, round ${m.round}`);
  check('no NaN leaked into fighter state', finite);
  check('someone won at least one round', m.fighters[0].wins + m.fighters[1].wins >= RULES.roundsToWin, `${m.fighters[0].wins}-${m.fighters[1].wins}`);
  check('fighters stayed inside the stage', m.fighters.every((f) => f.x > 0 && f.x < 1120));
  console.log(`      (${kos} knockouts, ${ticks} ticks simulated)`);
}

// --- 7. A kill that launches the victim still settles into the ko pose -----
{
  const m = new Match('A', 'B');
  while (m.phase === 'intro') m.step(idle());
  const walk = emptyInput(); walk.right = true;
  let guard = 0;
  while (Math.abs(m.fighters[0].x - m.fighters[1].x) > 110 && guard++ < 400) m.step([walk, emptyInput()]);
  m.fighters[1].health = 1;
  const up = emptyInput(); up.uppercut = true;
  m.step([up, emptyInput()]);
  let launched = false;
  // Well short of the round-end timer, so the round is still on screen.
  for (let i = 0; i < 120; i += 1) {
    m.step(idle());
    if (m.fighters[1].airborne) launched = true;
  }
  check('a launching finisher lifts the victim', launched);
  check('the defeated fighter holds the ko pose', m.fighters[1].action === 'ko', `action ${m.fighters[1].action}`);
  check('the defeated fighter lands on the floor', m.fighters[1].y === 0, `y ${m.fighters[1].y}`);
}

console.log(failures === 0 ? '\nAll simulation checks passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) throw new Error(`${failures} check(s) failed.`);
