import { PLAYABLE } from '../src/game/roster';
import {
  advance,
  buildGauntlet,
  currentOpponent,
  gauntletLabel,
  isComplete,
} from '../src/game/gauntlet';

function check(label: string, ok: boolean): void {
  if (!ok) throw new Error(label);
  console.log(`PASS ${label}`);
}

const ids = PLAYABLE.map((entry) => entry.id);
const player = ids[0];
const first = ids[1];

const run = buildGauntlet(player, first);

check('the run opens on the opponent the select screen landed on', run.opponents[0] === first);
check('the run starts with nothing cleared and nothing banked', run.cleared === 0 && run.score === 0);
check('the run holds the fighter the player chose', run.player === player);
check(
  'the ladder never puts the player against themselves',
  !run.opponents.includes(player),
);
check(
  'the ladder covers every other playable fighter exactly once',
  run.opponents.length === ids.length - 1 &&
    new Set(run.opponents).size === run.opponents.length &&
    ids.filter((id) => id !== player).every((id) => run.opponents.includes(id)),
);

// A roulette that lands on the player's own fighter is kept, because the
// player watched it happen; everyone else still follows.
const mirror = buildGauntlet(player, player);
check('a mirror the roulette chose stays the first fight', mirror.opponents[0] === player);
check(
  'a mirror run still covers the rest of the cast once',
  mirror.opponents.length === ids.length &&
    new Set(mirror.opponents).size === mirror.opponents.length,
);

check('the first opponent is the one standing up now', currentOpponent(run) === first);
check('a fresh run is not complete', !isComplete(run));

// Walk the whole ladder, banking a win each time.
let walk = run;
const met: string[] = [];
for (let i = 0; i < run.opponents.length; i += 1) {
  const opponent = currentOpponent(walk);
  check(`opponent ${i + 1} is queued`, opponent !== null);
  met.push(opponent!);
  check(
    `match ${i + 1} is announced as match ${i + 1}`,
    gauntletLabel(walk) === `MATCH ${i + 1} OF ${run.opponents.length}`,
  );
  check(`the run is still live before match ${i + 1}`, !isComplete(walk));
  walk = advance(walk, (i + 1) * 1000);
}

check('every queued opponent was met, in order', met.join() === run.opponents.join());
check('clearing the last opponent completes the run', isComplete(walk));
check('a completed run has nobody left to fight', currentOpponent(walk) === null);
check('the banked score carries across the run', walk.score === run.opponents.length * 1000);
check('advancing never changes the fighter the player chose', walk.player === player);
check('the ladder itself is never rewritten mid-run', walk.opponents.join() === run.opponents.join());

console.log('gauntlet OK');
