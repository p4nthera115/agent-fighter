# Openclaw — first sprite-sheet pass

42 frames across seven sequences, based on the approved red oval Openclaw
concept with its two antennae, black eye sockets and turquoise pupils.

## Files

- `openclaw-sheet.png`: transparent 1344 × 1120 atlas, six columns and seven rows.
- `openclaw-sheet.json`: frame rectangles, durations and named animation tags.
- `openclaw-moves.json`: art timing, loops, return-to-idle and final-pose hold
  metadata, and one entry per cel carrying its phase name, duration and
  `active` flag. `active` marks the contact cel, not a gameplay hitbox.
- `openclaw.ase` / `openclaw.aseprite`: editable timeline with one artwork layer.
- `strips/`: a six-frame transparent PNG strip for each animation.
- `frames/`: individual PNG frames. `openclaw-master.png` is the neutral guard.

Each frame is 224 × 160, right-facing, with origin (106,136). Keep the full
canvas and use nearest-neighbor scaling. The palette has 15 opaque colours
plus binary transparency.

| Row | Tag | Zero-based frames | Action |
| --- | --- | --- | --- |
| 1 | idle | 0–5 | Guard, breathe, blink; loop |
| 2 | punch | 6–11 | Wind up, extend mitten, recover |
| 3 | uppercut | 12–17 | Crouch, rise, overhead mitten strike |
| 4 | kick | 18–23 | Knee lift, side kick, retract |
| 5 | damage | 24–29 | Surprise, squeezed eyes, recoil, recovery |
| 6 | victory | 30–35 | Happy eyes and raised-arm cheer; loop |
| 7 | defeated | 36–41 | Droop antennae, crouch, fall onto side; hold final pose |

The three attacks mark their contact cel — punch 9, uppercut 15, kick 21 —
the pose the game holds for the whole of a move's active window. Each was
chosen by measuring reach from the (106,136) pivot and taking the cel that
reaches furthest.

## In the game

Openclaw is playable in the browser build. `scripts/stage-fighter.py openclaw`
writes the per-cel metadata above and copies the atlas and both JSON files
into `web/public/assets/openclaw/`, which is what the browser loads. The
`.ase` files stay authoring-only.

Player two wears a green costume rather than the cyan directly opposite the
red: the stage is a navy night city, and a cool costume on this fighter would
lose the silhouette against it.

## Authoring notes

This first pass uses generated key poses, not a fully hand-drawn in-between
animation set. Body, eyes and antennae are on one editable artwork layer.
Neutral and loop/hold endpoints reuse identical cels. Refine timing and
intermediate poses in your sprite editor as needed.

The built-in image-generation tool produced `source/generated-sheet.png`.
Its exact prompt is saved in `source/generation-prompt.txt`. Export packing
uses nearest-neighbor scaling, a shared palette and fixed-canvas alignment.
`source/assembly.json` records crop and placement information.

All 42 editable-file cels and atlas crops were compared for exact pixel
equality; results are in `verification.json`. Application-level opening in
LibreSprite/Aseprite was not tested. Use the JSON metadata for playback
rules; editor tag settings alone do not specify final-frame holds.
