# Mascot Fighter — Project Context

## Project goal

This project is a browser-based 2D arcade fighter inspired by the feel of
classic Street Fighter-era games. The visual identity is the priority: each
fighter needs a strong silhouette, readable attacks, expressive reactions,
consistent pixel density, and satisfying frame timing.

The planned roster is:

- **Clawd** — Claude’s terracotta block mascot.
- **Grok** — a black floating orb. Its alternate shapes and colours are reserved
  for attacks and special effects rather than its default body.
- **Muse** — Meta’s cream plush mascot with the blue chest mark.
- **Codex** — the blue, cloud-headed screen mascot.
- **OpenClaw** — the round red mascot with antennae and turquoise eyes.

The attached mascot references were used as identity references. The generated
concepts are visual starting points; they are not final production animation.

## Recommended technology

Use **Phaser + TypeScript** for the browser game. Keep the game update loop at
60 updates per second, use fixed frame timing for combat, and render pixel art
with nearest-neighbor scaling and texture smoothing disabled.

Use **LibreSprite or Aseprite** for manual pixel cleanup and pose editing.
Both use the `.ase`/`.aseprite` family of layered animation files. The project
does not require an MCP connection to make or export accurate sprite sheets.
Accuracy comes from fixed canvas sizes, stable pivots, shared palettes, frame
metadata, and visual review.

## Current asset state

The whole planned roster now has finished sheets and is playable in the
browser build: Clawd, Grok, Muse, Codex and OpenClaw, each in
`output/<id>-animation/`. The original concept images stay in
`output/mascot-fighters/` as identity references.

Clawd’s animation study:

- Canvas: **224 × 160 pixels** per frame.
- Standing origin: **(106, 136)**.
- Shared palette: 12 opaque colours plus binary transparency.
- Atlas: `clawd-sheet.png`, 5 columns × 7 rows, 33 frames.
- Metadata: `clawd-sheet.json`.
- Move data: `clawd-moves.json`.
- Editable files: `clawd.ase` for LibreSprite compatibility and
  `clawd.aseprite` for Aseprite.
- Individual frames: `frames/`.
- Normalized source parts: `parts/`.
- Offline browser preview: `index.html` with `preview-data.js`.

Grok, Muse, Codex and OpenClaw share one shape, on the same canvas and pivot: a
`<id>-sheet.png` atlas of 6 columns × 7 rows and 42 frames, a
`<id>-sheet.json`, a `<id>-moves.json`, `.ase`/`.aseprite` files with one
artwork layer, individual `frames/` and per-animation `strips/`. They differ
only in palette:

- Grok: charcoal body, 42 colours; colour is reserved for its transformations.
- Muse: cream plush, 18 colours, blue chest mark.
- Codex: blue robot, 14 colours, cyan screen and terminal mark.
- OpenClaw: red oval, 15 colours, two antennae and turquoise pupils.

The current Clawd tags and frame ranges are:

| Animation | Frames | Timing intent |
|---|---:|---|
| `idle` | 0–5 | Breathing loop, 810 ms total |
| `punch` | 6–14 | Wind-up, contact, follow-through, recovery |
| `uppercut` | 15–23 | Dip, load, rising strike, recovery |
| `kick` | 24–32 | Weight shift, chamber, extension, contact, plant |

The far-left foot points outward across every move to match the original
concept. The rightmost foot is used for the kick. The current animations are
timing and silhouette studies, not final combat-balance data; gameplay hitboxes
have not been assigned.

The Clawd concept references are in `output/mascot-fighters/`. The source
generation prompts are in `output/mascot-fighters/generation-prompts.json`.

## Browser preview

The preview can be opened by serving `output/clawd-animation/` as a static
directory, for example:

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory output/clawd-animation
```

It provides controls for Idle, Punch, Uppercut, and Kick; pause/play; frame
stepping; quarter and half speed; looping attacks; previous-frame overlay; and
dark, light, or transparency-grid backgrounds. Keyboard shortcuts are Space,
P, U, K, and the arrow keys.

## Build and verification scripts

`scripts/stage-fighter.py` prepares a generated sheet for the game: it writes
the per-cel phase, duration and contact-cel metadata the runtime needs into
the authoring `-moves.json`, then copies the atlas and both JSON files into
`web/public/assets/<id>/`. It is idempotent and writes no gameplay data.

`scripts/build-clawd.cjs` rebuilds the parts, frames, atlas, JSON metadata, and
both editable file formats. It uses Node.js and the `sharp` package. The output
directory can be passed as the first argument.

`scripts/verify-clawd.py` independently decodes the layered editable file,
recomposites every frame, and compares the result pixel-for-pixel against the
individual PNG frames and atlas. It also checks the animation tags, durations,
baseline, loop seams, canvas bounds, and transparency. Pass a second argument
of `clawd.ase` to verify the LibreSprite export.

Verification reports are stored as `verification.json` and
`verification-libresprite.json`.

## Art direction

Use a shared retro arcade pixel treatment:

- crisp hard-edged pixel clusters;
- limited palette and deliberate shadow ramps;
- dark warm outlines with strong upper-left lighting;
- silhouettes readable at roughly 100–150 pixels tall;
- full frame canvases retained so pivots do not drift;
- attack effects and projectiles kept on separate layers where practical.

AI-generated images are useful for design exploration and pose references. They
should be cleaned up manually before becoming final sprite frames. Do not ask a
single generated image to serve as a complete animation sheet without checking
proportions, anatomy, palette consistency, and frame-to-frame details.

## Planned next work

1. Install LibreSprite or Aseprite and open both Clawd editable files to confirm
   application-level compatibility.
2. Refine Clawd’s hand-drawn poses, especially the uppercut fist and kick leg,
   while preserving the 224 × 160 canvas and origin.
3. Add hurt, victory, and defeated animations with deliberate eye changes.
4. Add attack, hurt, block, knockdown, and defeat hitbox metadata separately from
   art frames.
5. Build the Phaser prototype with one stage, two fighters, local input, fixed
   60 Hz combat updates, hit-stop, hit sparks, sound, and knockback.
6. Hand-clean the four generated key-pose sheets. The roster is complete, but
   Grok, Muse, Codex and OpenClaw are all first passes and want the same work
   Clawd is getting.
7. Give each fighter its own hurtbox, pushbox and attack reach. The whole cast
   currently fights inside Clawd's boxes, which are cut to arms none of the
   other four have. This is now the largest gap between how the game looks and
   how it plays.

## Important constraints

- This is a browser game, so exported PNG and JSON assets are the runtime source
  of truth; `.ase` files remain editable authoring files.
- Preserve transparent backgrounds and nearest-neighbor scaling.
- Keep every fighter’s pivot and floor baseline stable between frames.
- Treat mascot identity references as design guidance and keep the final game
  art stylistically consistent.
- Keep combat rules separate from animation timing so visual iteration does not
  silently change gameplay balance.


## Clawd reaction update — 2026-09-21

Clawd now has 56 frames across idle, punch, uppercut, kick, damage, victory and defeated. Nine layers include editable eyes and an uppercut trail. Damage recoils with shock/squeezed eyes; victory cheers with happy eyes; defeated collapses with X eyes and holds the last pose. Authoring assets are in output/clawd-animation; the runtime PNG/JSON copies are in web/public/assets/clawd. FighterView selects these states without changing simulation balance. See output/clawd-animation/README.md for ranges and rebuilding.


## Grok in the game — 2026-09-21

Grok's 42-frame sheet is wired into the browser build the same way Clawd's is.
`output/grok-animation/grok-moves.json` was extended to carry the same
per-frame `phase`/`duration`/`active` array Clawd's has, so `AnimMap` reads
both through one code path; the runtime copies are in `web/public/assets/grok/`.

The cast is now data. `web/src/game/roster.ts` holds each fighter's sheet
folder, ground shadow and player-two costume, `PreloadScene` loads whatever is
marked playable, and `FightScene` builds one `AnimMap` and one `FighterView`
per side. A new fighter is three copied files and a roster entry.

A character select screen (`SelectScene`) now sits between the menu and the
match and is the only place that decides who fights. Concept fighters appear
on the grid, greyed out, and cannot be locked in. Player two wears the palette
swap only in a mirror match. Grok's swap needed a saturation floor, because
rotating the hue of its near-grey charcoal returned the same charcoal.

Combat balance is untouched: every fighter still shares `frameData.ts`, so the
whole cast has Clawd's boxes. That is visible with Grok, whose orb is smaller
than the hurtbox it stands in, and it is recorded in web/README.md's known
limits rather than fixed by quietly editing balance data.


## Muse and Codex in the game — 2026-09-21

Muse and Codex went in behind Grok, through the same path and with no new
runtime code: stage the sheet, add a roster entry, done. The staging step is
now `scripts/stage-fighter.py`, which writes the per-cel phase, duration and
contact-cel metadata into the authoring `-moves.json` and copies the three
runtime files across. All three generated sheets share a layout — 42 cels,
seven tags, contact on 9, 15 and 21 — so the script needs only a contact table
and per-fighter phase names.

Costumes for player two: Muse's cream rotates to a pale blue plush with an
orange chest mark, Codex's blue to gold with a red screen. Both use the plain
rotation Clawd does; only Grok needed the saturation floor.

The cast is now four playable and one drawing, and both the cast screen and
the select screen count that rather than stating it, so neither goes stale
when OpenClaw lands.

Balance is still untouched and still shared. The art/box gap the Grok entry
records applies to Muse and Codex as well, mostly as reach: their attacks have
boxes that extend 30 to 50 pixels past where the art stops.


## OpenClaw, and a complete roster — 2026-09-21

OpenClaw went in through the same path as the previous three: declare its
contact cels in `scripts/stage-fighter.py`, run it, add a roster entry. Its
sheet matches the others exactly — 42 cels, seven tags, contact on 9, 15 and
21 — so no new phase names were needed either.

Player two is green rather than the cyan directly opposite its red. The stage
is a navy night city and a cool costume lost the silhouette against it; green
keeps the value contrast and turns the turquoise pupils magenta.

All five planned fighters are now playable. Two places that had been written
as apologies now count instead: the cast screen prints "ALL FIVE ARE FINISHED.
THE CAST IS COMPLETE." off the roster rather than a hardcoded line, and the
select screen's greyed-out path survives for whoever is added next without art.

One bug surfaced with the longest name in the cast: "OPENCLAW-II" ran under
the round-win pips on the health bar, which had sat at a fixed offset chosen
for eight characters. The HUD now measures the name and slides the pips clear,
clamped so they stay on the bar however long a name gets.


## A versus page — 2026-09-21

There is now a screen between choosing a fighter and fighting: `VersusScene`,
which gives each fighter half of the 480 x 270 screen for a little over two
seconds. Both ways into a match go through it — the select screen's lock-in
and the attract cycle's demo — and it decides nothing, taking a `FightData`
and handing the same one on, so the select screen is still the only place the
pair is chosen.

The composition is a frame-break at both ends: each head crosses the top edge
of its panel and each pair of feet finishes behind the nameplate. Making that
true for the whole cast is the only hard part, because the five silhouettes
run from Grok's 92-pixel orb to Clawd's 120-pixel block on the same canvas.
The page measures each one out of the atlas (`render/silhouette.ts`, a cached
alpha scan) and scales it so the head and the feet land on two fixed lines;
`PORTRAIT_H` is derived as the distance between those lines, so the constants
cannot drift apart. Redrawing a pose moves the framing with it, which matters
while four of the five sheets are still first passes.

That costs a fractional, per-fighter portrait scale where the rest of the game
is always a whole magnification. It is the one place in the project that pays
it, and it buys the thing the page exists for: no uniform scale both fills the
panel for the shortest fighter and keeps the tallest inside it. The portraits
only ever translate, so nothing resamples frame to frame. Clawd is the single
fighter cropped by its panel — its idle holds both arms out at 176 x 120 — and
it loses the outer half of each fist.

The mark reuses the wordmark: `render/logo.ts` grew a `V`, and `wordTexture`
was lifted out of `addLogo` so any placed-word layout can be painted with the
same ramp, rim and outline. `VS` does not climb the way MASCOT FIGHTER does,
because a symbol between two equal halves cannot lean towards one of them.

Two smaller things fell out of it. `demoPicks` moved from `FightScene` to
`roster.ts` as `demoPair`, because the title screen now needs the pair before
the match does. And the page ignores input until the mark lands: locking in is
a keypress, a held key repeats, and without the gate the button that chose the
fighter dismisses the page before it has drawn a frame.

Combat is untouched. Nothing on this page is read by the simulation.
