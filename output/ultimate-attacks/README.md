# Personal ultimate attack sprite packs

Five ultimate attacks, each with an eight-pose character track and eight
separate effect cels: 80 cels total. Assets only; no game integration.

| Folder | Ultimate | Visual sequence |
| --- | --- | --- |
| clawd | Context Collapse | Gather pages, compress a square, flick, paper storm |
| grok | Shape Riot | Triangle dive, square slam, capsule dash, giant orb landing |
| muse | Dream Sequence | Draw portal, plush hand scoops/releases, spring cloud launch |
| codex | Execute All | Type, target brackets, build/compress cage, pixel explosion |
| openclaw | Swarm Protocol | Broadcast, mini-copy rush, swarm tower/burst, late straggler |

## Files in each folder

- `character-sheet.png` and `.json`: four columns × two rows; 224 × 160 cels.
- `effects-sheet.png` and `.json`: four columns × two rows; 320 × 320 cels.
- `character.ase` / `.aseprite` and `effects.ase` / `.aseprite`: editable timelines.
- `character-frames/` and `effects-frames/`: eight separate PNGs each, numbered 00–07.
- `manifest.json`: frame dimensions, origins, timing and descriptive frame labels.
- `choreography.json`: suggested trigger times and effect placement roles.
- `source.png` and `generation-prompt.txt`: generated source artwork and exact prompt.
- `verification.json`: pixel comparison results for exported atlas and editable cels.

Character origin is (106,136), effects origin is (160,160). Character poses are
bottom-aligned; effects are centred within their canvases. Large effects use a
larger canvas intentionally. Use JSON rectangles rather than assuming both
sheets use the same frame size. Scale with nearest-neighbor filtering.

## Playing the tracks

The two sheets are independent tracks, not overlays intended to run frame for
frame at the same location. The choreography file describes where each part
belongs: caster, travelling projectile, target, or target floor. Offsets use
screen coordinates (positive y downward) in unscaled art pixels. Mirror x
offsets and facing for a left-facing fighter. Travel paths, opponent motion,
damage, camera shake and hitstop are owned by your existing game.

Treat the JSON timing as a suggested visual sequence, not balanced combat data.
Each range is inclusive and zero-based. Hold the caster's concluding pose if
effects are still playing, then return to the existing idle animation.
Grok Bot's dive/dash and giant landing require positional motion; the sprite sheet
provides their visual poses. The giant orb cel is larger than the other Grok Bot
poses, and can be scaled further for the final impact.

Openclaw effect cels 0 and 1 form a reusable mini-copy running cycle; cel 2 is
the leap. The cluster/tower/scatter cels are separate composited alternatives.
Spawn instances from both sides rather than stretching one mini into a swarm.
Muse's opponent is intentionally absent from the hand art; position your
existing opponent sprite during the scoop/release sequence.

## Editing and verification

These are generated key-pose studies with cleanup, consistent per-track scale,
binary transparency and aligned export canvases. Some small props and casting
accents are baked into the character cels; the large independently placed
effects are on the effects sheet. Each editable file has one artwork layer.
These are not hand-drawn in-between animations or a guarantee of exact matching
to later manual edits you made to the base roster. Refine seams/timing in your
editor if needed. Rendered character size can differ from the base roster;
match your existing character scale when placing ultimate poses.

Every editable cel and atlas rectangle was decoded and compared with its
individual PNG, including all five packs. LibreSprite/Aseprite application-level
opening has not been tested. Artwork used the built-in image-generation tool;
prompts and originals are included for future revisions.
