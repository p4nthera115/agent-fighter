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

The main completed prototype is Clawd’s animation study in
`output/clawd-animation/`.

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
6. Create matching master sprites and short animation studies for Grok, Muse,
   Codex, and OpenClaw before producing their full movesets.

## Important constraints

- This is a browser game, so exported PNG and JSON assets are the runtime source
  of truth; `.ase` files remain editable authoring files.
- Preserve transparent backgrounds and nearest-neighbor scaling.
- Keep every fighter’s pivot and floor baseline stable between frames.
- Treat mascot identity references as design guidance and keep the final game
  art stylistically consistent.
- Keep combat rules separate from animation timing so visual iteration does not
  silently change gameplay balance.
