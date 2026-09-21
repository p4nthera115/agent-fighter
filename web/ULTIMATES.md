# Ultimate attacks

Each fighter charges a 100-point meter through combat. Press **spacebar** (P1, or **I**), **semicolon / numpad 0** (P2), or the **ULT** touch button when full and grounded. Hold away during the opening to guard. Attacks spend meter even when they miss. The CPU uses and guards ultimates too.

| Fighter | Ultimate | Sequence | Damage | Range |
| --- | --- | --- | --- | --- |
| Clawd | Context Collapse | Compress pages, flick a square projectile, unfold a paper storm | 180 | 360 |
| Grok | Shape Riot | Triangle dive, square slam, capsule dash, giant orb impact | 190 | 280 |
| Muse | Dream Sequence | Draw a portal, scoop with a giant hand, launch with a dream cloud | 180 | 320 |
| Codex | Execute All | Open terminal, bracket target, build and compress a cage, execute | 180 | 340 |
| Openclaw | Swarm Protocol | Broadcast, send mini-claws, build a swarm tower, retrieve a straggler | 180 | 340 |

The 144-tick sequence lasts 2.4 seconds. The first 36 ticks zoom toward the caster and pull back before damage starts. Each fighter temporarily changes the arena's colour and background motifs. HUD stays at normal scale; the original arena returns at the end. Reduced-motion preferences disable camera zoom/shake and background motion.

The simulation freezes normal movement and round time during the sequence. The first hit checks range, height, invulnerability and guard; subsequent hits keep that result. Guard reduces damage to 12% and cannot chip-kill. A lethal hit finishes its cinematic before the round ends. Ultimates cannot chain into another while held. Meter resets each round; ordinary hits charge attacker by 25% of damage and defender by 18%. Ultimate damage only charges the defender.

## Editing and checks

- `src/game/combat/ultimates.ts`: names, ranges, damage, timing.
- `src/game/combat/match.ts`: activation, guard/hit confirmation and round lifecycle.
- `src/game/render/ultimateView.ts`: actor/effect choreography and temporary backgrounds.
- `public/assets/ultimates/`: the character and effect PNG/JSON atlases. Authoring originals remain in the project's `output/ultimate-attacks/`.
- `npm run check`: TypeScript plus combat, audio, logo, animation and ultimate tests.
- `npm run build`: production bundle.
- With `npm run dev`, open `/test/ultimate-preview.html` to inspect cut-in, impact, finish and mirror poses, or play the whole sequence. This fixture is not part of the production build.

Sprites are eight key poses per track, with movement between them supplied by the renderer. They retain the existing exported artwork. Camera, timing and effects can be tuned independently without changing those files.
