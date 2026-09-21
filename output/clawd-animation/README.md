# Clawd — seven-animation study

Open index.html for the offline preview. Select any sequence, slow playback,
pause or step through cels. Defeated holds its last cel; Victory loops.

## Editable files

Open clawd.ase in LibreSprite or clawd.aseprite in Aseprite.
56 frames on a fixed 224 × 160 canvas; origin (106,136).
Nine editable layers: four feet, attack trail, body, two hands, and eyes.
The palette has 12 opaque colours plus binary transparency.

| Animation | Editor frames (one-based) | Playback |
| --- | --- | --- |
| Idle | 1–6 | Loop |
| Punch | 7–15 | Return to idle |
| Uppercut | 16–24 | Return to idle |
| Kick | 25–33 | Return to idle |
| Damage | 34–39 | Shock, squeeze, recoil, recover |
| Victory | 40–47 | Happy eyes and cheering loop |
| Defeated | 48–56 | Stagger, X eyes, collapse; hold last cel |

Uppercut uses a curved trail on the drive/contact/follow-through cels only.
The trail narrows and breaks up as the fist rises, then disappears on recovery.
Eyes occupy a separate layer. Normal poses preserve the original pixels.

## Game integration

The PNG atlas is 1120 × 1920, five columns and twelve rows (four empty cells).
Use the frame rectangles in clawd-sheet.json, not hardcoded row counts.
clawd-moves.json describes looping, transitions, and hold-last behavior.
The game copies live in web/public/assets/clawd/ at the project root.
FighterView maps hitstun to Damage, KO to Defeated, and the round winner to Victory.
Combat timing and hitboxes remain in the simulation.

## Rebuild and checks

Run scripts/build-clawd.cjs with Node and sharp; pass this asset folder as the
first argument. The rig reuses the generated body and limb artwork, with
pixel expressions and motion trails on separate cels. Rebuilding replaces
exports, so save manual editor refinements separately before rebuilding.

Run scripts/verify-clawd.py with Python and Pillow, then repeat with clawd.ase
as the second argument. The independent decoder checks all 56 frames against
both the atlas and individual PNGs, palette, baseline and loop seams.
The files pass those checks; opening in LibreSprite/Aseprite is not tested.

After manual editor edits, export PNG + JSON to the game asset directory.
The offline preview embeds its atlas in preview-data.js; refresh that snapshot
to reflect manual changes.
