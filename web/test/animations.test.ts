import { AnimMap } from '../src/game/render/animMap';
import { ROSTER } from '../src/game/roster';
import clawdSheet from '../public/assets/clawd/clawd-sheet.json';
import clawdMoves from '../public/assets/clawd/clawd-moves.json';
import grokSheet from '../public/assets/grok/grok-sheet.json';
import grokMoves from '../public/assets/grok/grok-moves.json';
import museSheet from '../public/assets/muse/muse-sheet.json';
import museMoves from '../public/assets/muse/muse-moves.json';
import codexSheet from '../public/assets/codex/codex-sheet.json';
import codexMoves from '../public/assets/codex/codex-moves.json';
import openclawSheet from '../public/assets/openclaw/openclaw-sheet.json';
import openclawMoves from '../public/assets/openclaw/openclaw-moves.json';

type Sheet = typeof clawdSheet;
type Moves = typeof clawdMoves;

/**
 * Every playable fighter goes through the same checks.
 *
 * The renderer asks each sheet for the same seven tags and borrows idle poses
 * for the states that have no clip of their own, so a new sheet that is short
 * of any of that has to fail here rather than at 60Hz in front of a player.
 */
const FIGHTERS: Array<{ id: string; sheet: Sheet; moves: Moves }> = [
  { id: 'clawd', sheet: clawdSheet, moves: clawdMoves },
  { id: 'grok', sheet: grokSheet as unknown as Sheet, moves: grokMoves as unknown as Moves },
  { id: 'muse', sheet: museSheet as unknown as Sheet, moves: museMoves as unknown as Moves },
  { id: 'codex', sheet: codexSheet as unknown as Sheet, moves: codexMoves as unknown as Moves },
  { id: 'openclaw', sheet: openclawSheet as unknown as Sheet, moves: openclawMoves as unknown as Moves },
];

/** Tags FighterView plays or borrows a pose from. */
const REQUIRED_TAGS = ['idle', 'punch', 'kick', 'uppercut', 'damage', 'victory', 'defeated'];
/** The highest idle pose the renderer reaches for, in `pickFrame`. */
const IDLE_POSES_USED = 5;

function check(label: string, condition: boolean): void {
  if (!condition) throw new Error(label);
  console.log(`PASS  ${label}`);
}

const playable = ROSTER.filter((entry) => entry.art).map((entry) => entry.id);
check(
  `every playable roster entry is covered here (${playable.join(', ')})`,
  playable.length === FIGHTERS.length && playable.every((id) => FIGHTERS.some((f) => f.id === id)),
);

for (const { id, sheet, moves } of FIGHTERS) {
  const anims = new AnimMap(sheet, moves);

  check(`${id}: sheet and moves describe the same frame count`, sheet.frames.length === moves.frames.length);
  check(
    `${id}: the pivot is inside the cel`,
    moves.origin.x > 0 &&
      moves.origin.x < moves.frameSize.width &&
      moves.origin.y > 0 &&
      moves.origin.y < moves.frameSize.height,
  );

  for (const tag of REQUIRED_TAGS) {
    check(`${id}: has a "${tag}" clip`, anims.clips.has(tag));
  }

  check(`${id}: idle carries the poses the renderer borrows`, anims.clip('idle').names.length > IDLE_POSES_USED);
  check(`${id}: damage carries the knockdown pose`, anims.clip('damage').names.length > 2);

  for (const tag of ['damage', 'victory', 'defeated']) {
    const clip = anims.clip(tag);
    check(`${id}: ${tag} starts at its first cel`, anims.frameAtTime(tag, 0, false) === clip.names[0]);
    check(
      `${id}: ${tag} holds its final cel when played once`,
      anims.frameAtTime(tag, clip.totalMs * 10, false) === clip.names.at(-1),
    );
    check(
      `${id}: ${tag} advances at exact cel boundary`,
      anims.frameAtTime(tag, clip.durations[0], false) === clip.names[1],
    );
  }

  const victory = anims.clip('victory');
  check(`${id}: victory loops at its duration`, anims.frameAtTime('victory', victory.totalMs) === victory.names[0]);
  check(
    `${id}: negative clock clamps to first pose`,
    anims.frameAtTime('damage', -1, false) === anims.clip('damage').names[0],
  );

  for (const tag of ['punch', 'uppercut', 'kick']) {
    const clip = anims.clip(tag);
    check(`${id}: ${tag} retains its active cel`, moves.frames[clip.contact].active);
    // Startup needs a cel before contact and recovery one after it, or the
    // phase mapping silently collapses onto the contact pose.
    check(`${id}: ${tag} has startup and recovery cels around contact`, clip.contact > clip.from && clip.contact < clip.to);
  }

  // `pose` is how the renderer reaches past the end of a shorter clip.
  check(`${id}: pose clamps past the end`, anims.pose('idle', 99) === anims.clip('idle').names.at(-1));
  check(`${id}: pose -1 is the last cel`, anims.pose('idle', -1) === anims.clip('idle').names.at(-1));
}

console.log('All animation checks passed.');
