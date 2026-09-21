# Codex — first sprite-sheet pass

42 frames across seven sequences, based on the approved blue cloud-headed Codex
concept with its navy face screen, cyan eyes and terminal chest mark.

## Files

- `codex-sheet.png`: transparent 1344 × 1120 atlas, six columns and seven rows.
- `codex-sheet.json`: frame rectangles, durations and named animation tags.
- `codex-moves.json`: art timing, loops, return-to-idle and final-pose hold
  metadata, and one entry per cel carrying its phase name, duration and
  `active` flag. `active` marks the contact cel, not a gameplay hitbox.
- `codex.ase` / `codex.aseprite`: editable timeline with one artwork layer.
- `strips/`: a six-frame transparent PNG strip for each animation.
- `frames/`: individual PNG frames. `codex-master.png` is the neutral guard.

Each frame is 224 × 160, right-facing, with origin (106,136). Keep the full
canvas and use nearest-neighbor scaling. The palette has 14 opaque colours
plus binary transparency.

| Row | Tag | Zero-based frames | Action |
| --- | --- | --- | --- |
| 1 | idle | 0–5 | Guard, breathe, blink; loop |
| 2 | punch | 6–11 | Wind up, extend fist, recover |
| 3 | uppercut | 12–17 | Crouch, rise, overhead fist strike |
| 4 | kick | 18–23 | Knee lift, side kick, retract |
| 5 | damage | 24–29 | Surprise, squeezed eyes, recoil, recovery |
| 6 | victory | 30–35 | Happy eyes and raised-arm cheer; loop |
| 7 | defeated | 36–41 | Sag, kneel, fall onto side; hold final pose |

The three attacks mark their contact cel — punch 9, uppercut 15, kick 21 —
the pose the game holds for the whole of a move's active window. Each was
chosen by measuring reach from the (106,136) pivot and taking the cel that
reaches furthest.

## In the game

Codex is playable in the browser build. `scripts/stage-fighter.py codex`
writes the per-cel metadata above and copies the atlas and both JSON files
into `web/public/assets/codex/`, which is what the browser loads. The `.ase`
files stay authoring-only.

## Authoring notes

This first pass uses generated key poses, not a fully hand-drawn in-between
animation set. Body, eyes and emblem are on one editable artwork layer.
Neutral and loop/hold endpoints reuse identical cels. Refine timing and
intermediate poses in your sprite editor as needed.

The built-in image-generation tool produced the main artwork and a separate
kick study. Originals: source/generated-main.png and source/generated-kick.png.
The combined source/generated-sheet.png includes both.
Its exact prompt is saved in `source/generation-prompts.txt`. Export packing
uses nearest-neighbor scaling, a shared palette and fixed-canvas alignment. The kick study needed an exterior background mask;
its rendering is slightly cleaner than the other poses and may benefit from
a manual consistency pass.
`source/assembly.json` records crop and placement information.

All 42 editable-file cels and atlas crops were compared for exact pixel
equality; results are in `verification.json`. Application-level opening in
LibreSprite/Aseprite was not tested. Use the JSON metadata for playback
rules; editor tag settings alone do not specify final-frame holds.
