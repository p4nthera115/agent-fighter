# Clawd — four-move study

Open `index.html` in a browser to preview. The preview works offline; keep
`preview-data.js` beside it. Use Idle / Punch / Uppercut / Kick, pause, frame stepping, playback
speed, previous-frame overlay, and light/dark/checkerboard backgrounds.

## Editable source

Open `clawd.ase` in LibreSprite, or `clawd.aseprite` in Aseprite. The timeline contains:

- **idle:** frames 1–6, looping, 810 ms.
- **punch:** frames 7–15, 659 ms; return to idle after playing once.
- **uppercut:** frames 16–24, 726 ms; grounded dip, rising fist, recovery.
- **kick:** frames 25–33, 743 ms; rightmost leg chambers and extends.
- Frames 11, 20 and 29 are the attack contact poses. This is an animation timing study, not balanced
  fighting-game frame data. No gameplay hitboxes are assigned.

Eight editable image layers: four feet, attack forearm, body, left hand, right
hand. Each layer has a full RGBA cel on every frame. Transparent forearm cels
are intentional when the arm is not extending. Refine cels directly, or draw
new poses on additional layers. The `origin` slice in the Aseprite version marks the fixed pivot. LibreSprite’s older format omits this slice; the origin remains in the JSON.

The far-left foot points outward across every move. The kick raises only the rightmost foot; the other three stay planted.

## Exports

- `clawd-master.png`: neutral pose on the full frame canvas.
- `clawd-sheet.png`: 5 columns × 7 rows, 33 frames (last two cells empty) in reading order.
- `clawd-sheet.json`: Aseprite-style JSON array atlas with frame durations,
  all four animation tags, and the origin slice.
- `clawd-moves.json`: explicit animation transitions and phase labels for the
  browser prototype. Indices here and in JSON are zero-based.
- `frames/`: individual numbered PNGs.
- `parts/`: normalized body and limb source PNGs.

Every frame is **224 × 160**, with no trimming or padding between cells.
The world origin is **(106,136)**. Neutral visible height is **118 pixels**.
Use nearest-neighbor scaling and disable texture smoothing. The same 12 opaque
colours and binary transparency are used throughout. The PNG atlas is
1120 × 1120. Keep the complete canvas to prevent pivot jitter.

Use the JSON frame rectangles and durations to play these in the browser game.
Configure idle to repeat and return to idle when any attack finishes; the preview
implements those transitions directly without a game engine.

## How this was made and checked

The built-in image generator produced separated source artwork based on the
approved Clawd concept. Assembly reduced that artwork to a fixed pixel grid and
shared palette. Body and limb cels were positioned to create the four moves;
the punch also stretches a separate forearm cel behind the fist. These are
reusable-part animations, not 33 independently hand-drawn poses.

The same master cel is used at idle start/end and punch start/end. Supporting feet
stay at y=136, and all artwork fits inside the frame. An independent decoder
recomposited all eight Aseprite layers for every frame and checked exact pixel
equality against the PNG atlas and individual PNGs. Both editable formats match all 33 frames. Results: `verification.json` and `verification-libresprite.json`.

Neither editor was installed on this machine, so application-level opening is not yet tested. The `.ase` export omits newer slice data and zeros reserved fields to match LibreSprite’s documented format. Its image layers, frame durations, palette and tags are preserved. It was encoded against the documented file format:
https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md

## Rebuilding

Workspace scripts: `scripts/build-clawd.cjs` (Node + sharp) and
`scripts/verify-clawd.py` (Python + Pillow). The downloadable ZIP also includes
these under `scripts/`; pass the asset folder as the first argument there.

After editing in your editor, re-export the PNG + JSON for the game. The browser
preview embeds a snapshot in `preview-data.js`; it does not automatically read
later editor edits. Update that embedded data or integrate the exported atlas
into the game to preview subsequent edits.
