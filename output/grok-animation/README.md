# Grok — first sprite-sheet pass

42 frames, seven animations. Grok is playable in the browser build; the
runtime copies of these files live in `web/public/assets/grok/`.

* `grok-sheet.png`: transparent 1344 × 1120 atlas, six columns and seven rows.
* `grok-sheet.json`: frame rectangles, durations, and animation tags.
* `grok-moves.json`: origin, cel size, loop/return/hold metadata, and one
  entry per frame carrying its phase name, duration and `active` flag. Art
  timing only; `active` marks the contact cel, not a gameplay hitbox.
* `grok.ase` / `grok.aseprite`: editable timeline with seven named tags.
* `strips/`: one transparent six-frame PNG strip per animation.
* `frames/`: 42 individual PNG cels; `grok-master.png` is the neutral pose.

Every cel is 224 × 160. Anchor at (106,136), facing right. Use nearest-neighbor
scaling. Keep the full canvas to preserve the pivot. Black/charcoal is the
default; colour changes accompany transformations.

| Row | Tag | Frames (zero-based) | Action |
| --- | --- | --- | --- |
| 1 | idle | 0–5 | Breathe and blink; loop |
| 2 | punch | 6–11 | Red capsule body punch; return to idle |
| 3 | uppercut | 12–17 | Orange teardrop into rising triangle |
| 4 | kick | 18–23 | Blue square body strike; no literal leg |
| 5 | damage | 24–29 | Recoil, squeezed eyes, recover |
| 6 | victory | 30–35 | Happy eyes across coloured shapes; loop |
| 7 | defeated | 36–41 | Dazed eyes, deflate; hold final cel |

The three attacks mark their contact cel — punch 9, uppercut 15, kick 21 —
which is the pose the game holds for the whole of a move's active window. The
`frames` array uses the same shape as `clawd-moves.json`, so the runtime reads
both sheets through one code path.

This is a first animation pass using generated key poses, not hand-drawn
in-between animation. It uses one editable artwork layer; the eyes are not
separate layers. Neutral poses and loop/hold endpoints reuse identical cels
to prevent seam drift. Further timing and in-between refinements can be made
in LibreSprite or Aseprite.

Source artwork was created with the built-in image-generation tool using the
supplied Grok shape/colour reference and Clawd rendering reference. The exact
prompt is in `source/generation-prompt.txt`; the untouched source is
`source/generated-sheet.png`. Packing applies nearest-neighbor scaling,
palette normalization, binary alpha, and fixed-canvas alignment.

`verification.json` records pixel equality between all 42 exported editable
cels and atlas crops. Neither editor was opened for application-level checking.
The JSON files, rather than editor tag settings, specify loop/hold behavior.

## In the game

Grok is playable in the browser build. `scripts/stage-fighter.py grok` writes
the per-cel metadata above and copies the atlas and both JSON files into
`web/public/assets/grok/`, which is what the browser loads. The `.ase` files
stay authoring-only.
