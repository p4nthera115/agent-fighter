# Mascot Fighter — the cabinet

The whole page is one machine, edge to edge: a neon marquee between two
speaker grilles and a monitor sunk into the shell. There is no surrounding
website. Everything that used to be a page section — the move list, the
roster, the settings — now lives on the screen itself, the way a cabinet does
it.

Where there is a keyboard, that is the whole machine. A stick and a row of
buttons are a touch control, and a mouse plays with the keys and clicks the
menus on the glass, so drawing a panel across the bottom would put furniture
between the player and the picture: on a fine pointer the panel is not there
at all, and the one thing the keyboard cannot do for itself — full screen —
sits in the corner of the shell. Touch gets the full panel, because touch has
nothing else.

The shell is a dark violet, lit from the upper left, which is the rule the
artwork is drawn to, so the machine and the picture inside it agree about
where the light is coming from. Held upright in a hand it stops being a bartop
and becomes a handheld: same markup, same controls, laid out the way a
handheld lays them out.

Phaser 3 + TypeScript + Vite, as recommended in `../context.md`.

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # typecheck, then emit dist/
npm run check    # typecheck + simulation tests
```

`dist/` is a plain static directory using relative asset paths, so it serves
from a domain root or any subpath.

## The attract cycle

Left alone, the machine demonstrates itself, and each step hands the next one
its name rather than relying on a timer surviving the transition:

```
title ──14s idle──▶ versus page ──2.3s──▶ demo match ──26s or a KO──▶ cast roll ──9s──▶ title
```

The demo picks two *different* playable fighters each time, so the machine
advertises the cast rather than one fighter twice, and it goes through the
versus page on the way, so the attract loop names the two fighters before it
demonstrates them.

Any input at any point drops the player back to the menu.

## Screens

| Scene | What it is |
|---|---|
| `PreloadScene` | Loads every playable atlas, builds each one's palette swap, reads the high score. |
| `TitleScene` | Logo, main menu, and the keeper of the attract cycle. |
| `CastScene` | The roster, stating plainly which fighters actually exist. |
| `SelectScene` | Character select. The only screen that decides who fights. |
| `InfoScene` | How to play and Options, as two panels of one scene. |
| `VersusScene` | The matchup, announced. Decides nothing; passes its pair on. |
| `FightScene` | The match, in either a real or a demonstration mode. |

### Character select

`1 PLAYER` and `2 PLAYERS` both open the select screen; the menu's only job is
the mode. The grid shows the whole cast, and the fighter under each cursor stands at the
bottom of the screen playing its own idle — its victory loop once it is locked
in. A fighter with no sheet would be greyed out and refused; every entry has
one today, so nothing is, but the roster is where fighters get added and the
next one to arrive without art meets a screen that says so.
Against the CPU the machine spins through the playable cast and locks its own
choice in front of the player, because "who am I fighting" is the question
being asked at that moment.

The pair chosen is written back into the settings, and everything downstream —
which atlases the match binds, whether player two wears a palette swap, the
names on the health bars — reads that pair.

### The versus page

Between the select screen and the match, both fighters get half the screen
each for a little over two seconds. It is a presentation screen and nothing
else: it is handed a pair and hands the same pair on, so the select screen is
still the only place that decides who fights.

Each portrait breaks its frame at both ends — the head comes over the top
edge of the panel, the legs go behind the nameplate — which is what stops the
pair reading as two pictures pasted onto a background. That only works if
every fighter's head and feet land on the same two lines, so the page measures
each silhouette out of the atlas and scales it to put them there:

```
      head line ── PANEL_TOP - HEAD_OVER ────  every head, 8px over the border
                             │
                      the portrait, PORTRAIT_H tall
                             │
      sink line ── PLINTH_TOP + MIN_SINK ────  every pair of feet, 8px behind
```

`PORTRAIT_H` is the distance between those two lines rather than a number of
its own, so the four constants above cannot drift apart. Measuring rather
than tabulating matters because the cast's silhouettes run from 92 pixels of
orb to 120 of block on the same 224 x 160 canvas, and four of the five sheets
are still waiting to be hand-cleaned; a table of heights in the source would
be wrong the first time somebody redrew a pose.

The cost is that the portrait scale is per-fighter and fractional — 1.53 for
Clawd against 2.0 for Grok — where everything else in the game is a whole
magnification. A uniform scale cannot do this: at the one that fits Clawd,
Grok floats in front of its own nameplate, and at the one that fills the panel
for Grok, Clawd is a wall of terracotta with its eyes off the top. It is paid
on this page only, the portraits never move by a fraction of a screen pixel,
and nothing measured here reaches the match.

The drift on the portraits is translation, for the same reason: a slow zoom
would resample the art every frame. Input is ignored until the mark lands,
because the button that locked the fighter in is very likely still held down
when the page opens, and a held key repeats.

## How it is put together

The central rule from the project brief is that **combat rules stay separate
from animation timing**, so iterating on the art can never quietly rebalance
the game. That constraint shapes the directory layout:

| Path | Responsibility |
|---|---|
| `src/game/combat/` | The match, as pure TypeScript. No Phaser, no DOM, no clock of its own. |
| `src/game/combat/frameData.ts` | The only source of balance: startup, active, recovery, damage, boxes, knockback — all in 60 Hz ticks. |
| `src/game/render/` | Everything visual. Reads simulation state, never writes it. |
| `src/game/render/animMap.ts` | The one-way bridge from a move's phase to a sprite frame, one per fighter. |
| `src/game/roster.ts` | The cast: who exists, who is playable, and each fighter's sheet, shadow and costume. |
| `src/game/render/font.ts` | A 5x7 bitmap font. Browser text would antialias against the sprites. |
| `src/game/render/logo.ts` | The wordmark and the versus mark: an 8x11 alphabet plus the poster treatment. |
| `src/game/render/silhouette.ts` | Where the drawing is inside a cel, measured off the atlas. |
| `src/game/audio/` | Every sound in the game, synthesised. No audio files. |
| `src/game/scenes/` | The five screens above. |
| `src/site/styles.css` | The cabinet: shell, marquee, bezel, CRT glass, control panel, and the handheld it becomes in a tall window. |
| `src/game/render/tube.ts` | The curvature of the glass, as a post-processing pass. |
| `test/sim.test.ts` | Headless checks on the simulation. |

`Match.step()` advances exactly one 60 Hz tick and reads only the two
`InputState` objects it is handed, so the same inputs always produce the same
match. Hitstop freezes both fighters and the round clock, which is what makes
a connected hit read as an impact rather than a position swap.

### Why the art cannot change the balance

`frameData.ts` is written in ticks and never imports the sprite sheet.
`animMap.ts` goes the other way: it takes a fighter's current phase and picks a
frame, spreading startup across the frames before the contact pose, holding the
contact pose for the whole active window, and playing the rest out over
recovery. Retiming the sheet moves pictures around inside a move; it cannot
move a hitbox.

The move list on the **How to play** screen is read from `frameData.ts` at
runtime, so the numbers on screen are the numbers being played.

### The screen sizes itself to the picture

`createGame` measures the area the cabinet may fill, picks the largest whole
number of screen pixels per art pixel that fits, and then sets the *screen
element* to exactly that size. Sizing the glass to the canvas rather than the
canvas to the glass removes the letterbox completely: there is never a gap
between the bezel and the picture, and every art pixel stays a whole number of
screen pixels. Below 1:1 — a phone narrower than the 480px buffer — it falls
back to a fraction, because cropping the health bars would be worse.

The hole in the case is cut to fit the monitor rather than the other way
round: the matte black around the bezel is spread off the frame, so however
large the picture ends up, the case closes around it by the same amount.

Because a magnification is a whole number, a case twenty pixels too deep costs
a whole step and shows half the picture it could have. So `fit` measures the
machine twice — once as it is, once with every part of it at its floor size —
and only keeps the roomy case when it is free. Where it is not, `cab-tight`
goes on the body and the marquee, hood and panel all shrink. On a 1920 x 1080
window that is the difference between 2x and 3x; nothing is dropped, the
machine just stops taking room the picture could use.

### The CRT

The glass effects are CSS layers over the canvas, not a shader. At a 480 x 270
framebuffer a fragment shader cannot resolve a scanline or an aperture grille,
because those are features of the *output* resolution; moving to a larger
framebuffer would mean rewriting every HUD coordinate. CSS works in output
pixels, so it gets this right, and it degrades to nothing on the Canvas
renderer.

Scanline pitch is driven by the current zoom, and both the scanlines and the
grille switch themselves off below the magnification where they would stop
being structure and start being a dark filter. `Options ▸ CRT glass` turns the
whole thing off.

The one thing CSS cannot do over the top of a canvas is bend it, so the
geometry of the glass is a shader instead: `render/tube.ts` is a post-FX
pipeline on each scene's camera. A tube is a section of a sphere pressed into
a rectangle, so the corners bow outwards while the middle of each edge stays
put — which is also what keeps the HUD safe, since the health bars and the
timer live along the top edge and a bulge in the middle of it would push them
off the picture. The bend is a fraction of an art pixel, so the shader reads
between texels rather than snapping to the nearest one, blending only across
the width of a single *screen* pixel: the corners curve smoothly, the middle
of the picture stays exactly as sharp as the nearest-neighbour upscale around
it. The curvature is on the same switch as the rest of the glass, and on the
Canvas renderer, which has no pipelines, the picture is simply flat.

## The wordmark

The interface font cannot carry a title. At display size its one-pixel gaps
and uniform stems read as a label, so the logo has a separate 8x11 alphabet,
variable width, covering only the twelve letters it needs. M gets ten columns
to keep its chevron open; I gets five. Counters are three or four pixels wide,
because the shear steps every third row and a two-pixel hole does not survive
that plus an outline.

Everything on top of the letterforms is procedural, in `logo.ts`:

- each letter climbs as the word runs right, and every row leans forward
- a yellow-to-red ramp with a diagonal highlight streak across the upper rows
- a one-pixel black outline, a one-pixel red rim outside it, and a hard shadow
- the two words locked together, FIGHTER tucked under and right of MASCOT

The gradient is the one part that needed care. A single ramp across the whole
word looks right on a flat baseline, but once the baseline climbs, the last
letter sits in the palest stop and the first in the darkest — MASCOT came out
with a white T and a rust-red M. The fill now mixes each letter's own vertical
span with its position in the word, so every letter gets the full range while
the mass still reads as one gradient.

The versus page's mark is the same machinery: `VS` is drawn with the same
alphabet — which needed a `V`, since MASCOT FIGHTER does not use one — and the
same ramp, rim and outline, so the two read as one poster. It does not climb,
though. The wordmark rises because it is a phrase being read left to right; VS
is a symbol standing between two equal halves, and tilting it would take a
side. Because the letters lean, the ink does not sit in the middle of its own
canvas, so the mark is centred on its measured extent rather than on the
texture.

`npm run test:logo` checks the alphabet: square glyph rows, no stray
characters, every letter either layout asks for existing, each layout fitting
the space it is drawn into, and the versus mark still sitting level.

## Sound

There are no audio assets. Effects and music are both built from Web Audio
oscillators, which costs nothing to download and keeps the impact timing locked
to the simulation.

| File | Responsibility |
|---|---|
| `engine.ts` | One shared context and two buses, so music can be ducked under an impact. |
| `chip.ts` | The voices: pulse, triangle and noise, plus note/frequency maths. |
| `music.ts` | Tracker-style sequencing and playback. |
| `songs.ts` | The soundtrack, as pattern data. |
| `sfx.ts` | Hits, guards, jumps, knockdowns, fanfares. |

### The soundtrack

Two pieces, on a NES channel layout — a pulse lead, a pulse arpeggio for the
chords, a triangle bass, and noise percussion:

- **Title** — C major, 108 bpm, eight bars, an 17.8 second loop.
- **Fight** — A minor, 152 bpm, sixteen bars, a 25.3 second loop, with a
  turnaround at the end of each half and the chord bed dropping out under the
  descending run that opens the B section.

Chords are arpeggiated rather than held because a chip has no spare channel for
them. That rattle is the sound of the constraint, not a stylistic choice.

Being generated rather than streamed buys three things a rendered file cannot:
the loop has no seam to hunt for, nothing is downloaded, and the music can
react. The tempo lifts about nine percent once either fighter drops below a
quarter health, every hit ducks the music for the length of the impact, and the
pause screen holds it back until you resume.

A song is a set of patterns plus a per-track order list:

```
`A4`  trigger        `.`  hold        `-`  release        `K S H T`  drums
```

Each track names a pattern for every bar, so a one-bar drum loop can sit under
an eight-bar melody without either being written out twice.

### Working on the music

`npm run dev` serves a dev-only tool at **/music-lab.html**: play either song,
drag the intensity slider, watch the waveform, and see an offline render's peak
and RMS. Edit `songs.ts` and it hot-reloads. Vite only takes `index.html` as a
build input, so the lab never reaches `dist/`.

`npm run test:music` validates the pattern data — bar lengths, order entries
naming patterns that exist, and every token being a playable note or drum.
Those are the failure modes that do not throw; they just quietly make the music
wrong.

## Controls

On the select screen the arrow keys move player one against the CPU; in a
two-player match they move player two and `A`/`D` move player one. Any attack
button locks in, and pressing it again unlocks.

| | Player one | Player two |
|---|---|---|
| Move / block | `A` `D` | `←` `→` |
| Jump, crouch | `W`, `S` | `↑`, `↓` |
| Jab | `J` | `,` or numpad `1` |
| Roundhouse | `K` | `.` or numpad `2` |
| Rising Claw | `L` | `/` or numpad `3` |

Menus take the arrow keys or `W`/`S`, `Enter` to confirm, `Esc` to go back.
In a match: `Esc` pauses, `R` restarts, `Q` quits to the title, `H` toggles the
hitbox overlay. Blocking is holding away from the opponent.

Sound and music each have their own switch under Options.

On a touch device the panel under the screen drives player one: the joystick
takes a drag in any of eight directions, the three buttons are jab, roundhouse
and rising claw, and the ball leans whichever way player one is holding,
keyboard included. Held upright the stick becomes a four-way pad, which is
what a thumb can hold. None of it is drawn for a mouse.

The panel is a fighter control, not a menu one: menus take the keyboard or a
click on the screen itself, the same as they always have.

In a tall narrow window the same controls are laid out as a handheld: the four
directions become a moulded pad under the left thumb, the three attacks sit in
an arc under the right one - a row of three wide enough for a thumb will not
fit beside a pad wide enough for one - and full screen takes the place a
handheld keeps its start button.

The caps are lenses rather than plastic discs: a lit centre, a saturated rim,
and the ring of the nut holding each one into the panel, drilled on a rising
arc so a hand rolls across them. **Full screen** is the same lens in the size
a utility gets, labelled on the shell above it the way a cabinet labels COIN
and START. It is the one control that is always there, and it takes the whole
machine with it rather than just the picture.

Query parameters: `?mode=versus`, `?difficulty=rookie|rival|boss`, `?boxes=1`,
`?crt=0`, `?music=0`, and `?p1=clawd&p2=grok` to open the select screen on a
particular pair.

## Scoring

Points come from damage dealt (ten per point), plus a round-win bonus, the
seconds left on the clock, and a perfect bonus. The high score persists in
`localStorage`; `Options ▸ Clear hi-score` resets it. Against the CPU, 2UP
stays at zero rather than advertising the machine's own score.

## Assets

`public/assets/<fighter>/` holds that fighter's exported atlas and JSON, copied
from `../output/<fighter>-animation/`. The runtime reads only the PNG and JSON
— never an `.ase` authoring file — matching the constraint in the brief.

Clawd's sheet is assembled by `../scripts/build-clawd.cjs`; the other four are
packed from a generated sheet and staged by `../scripts/stage-fighter.py`,
which adds the per-cel metadata the runtime needs and copies the three files
across:

```bash
python3 ../scripts/stage-fighter.py grok muse codex openclaw
cp ../output/clawd-animation/clawd-sheet.{png,json} \
   ../output/clawd-animation/clawd-moves.json \
   public/assets/clawd/
```

The metadata it adds is one entry per cel: the phase it belongs to, its
duration, and whether it is the *contact* cel — the pose the renderer holds
for the whole of a move's active window. Contact cels are declared in that
script, measured off each sheet by reach from the pivot, because a wrong one
puts the fist somewhere other than where the hitbox is.

### Adding a fighter

A finished sheet needs no new code. Stage it, then give that fighter's roster
entry an `art` block — its folder, its ground shadow and its alternate
costume. `PreloadScene` loads whatever `PLAYABLE` contains, `FightScene` builds
one `AnimMap` per side from the fighter's own JSON, and
`npm run test:animations` runs the same checks over every playable entry, so a
sheet missing a tag the renderer needs fails there rather than mid-match.

What a fighter brings is art. Startup, active, recovery, damage and boxes stay
in `frameData.ts` and are shared by the whole cast, so a new fighter cannot
move a hitbox.

### Player two's costume

A mirror match recolours player two by rotating the hue of a copy of the atlas
at load time (`src/game/render/palette.ts`); against a different fighter both
sides keep their own colours, because two distinct silhouettes already tell
each other apart. The darkest pixels are held back so the outline stays an
outline.

Each fighter picks its own rotation, because each sheet starts somewhere
different on the wheel: Clawd's terracotta goes teal, Muse's cream goes pale
blue with an orange chest mark, and Codex's fourteen shades of blue go gold
with a red screen. OpenClaw's red goes green rather than the cyan directly
opposite it — the stage is a navy night city, and a cool costume there would
cost the silhouette more than the extra hue distance is worth.

Grok needed one addition to that machinery. Its body is charcoal at barely a
sixth saturation, and rotating the hue of a near-grey returns the same grey, so
its costume sets a saturation floor to give the rotation something to work
with — and holds back the *brightest* pixels too, so the eyes stay white while
the body turns oxblood.

`public/assets/roster/*-thumb.png` are the concept images from
`../output/mascot-fighters/`, box-downsampled by exactly 19x (1254 → 66) so
they stay on a whole-pixel grid.

## Known limits

- All five fighters have art, so the cast is complete and nothing on the
  select screen is greyed out. The honesty the cast screen was built for is
  now a counted statement rather than an apology.
- Every fighter uses the same hurtbox and pushbox, which are Clawd's. Muse
  (107 x 106), Codex (91 x 102) and OpenClaw (90 x 92) sit close enough inside
  the 112 x 118 box, but Grok's orb is 92 x 88, so it can be clipped by an
  attack that looks like it missed. Reach is the wider gap: the boxes are cut
  to Clawd's arms, whose jab reaches +113 against a box ending at +116. The
  other four reach +87, +72, +66 and +71, so a jab at maximum range connects
  30 to 50 pixels before the art arrives, and a roundhouse is worse. Per-fighter boxes are item 4
  in the project's next-work list; doing them here would have been a balance
  change hiding inside an art change.
- The four generated sheets are key-pose passes, not hand-drawn in-between
  animation, and Codex's kick study was rendered separately from its other
  poses and is slightly cleaner than they are.
- On the versus page Clawd is the one fighter cropped by its panel, seventeen
  art pixels off each side. Its idle holds both arms out, so the silhouette is
  176 x 120 — half as wide again as it is tall — against panels that are
  taller than they are wide. The block, both eyes and the legs stay; the outer
  half of each fist does not. The alternative is fitting Clawd by width, which
  makes it too short to reach either the top border or the nameplate and drops
  the frame-breaking that the page is built around.
- Walking, crouching, jumping and knockdown reuse the idle frames with squash,
  stretch and rotation. Those animations do not exist yet; item 3 in the
  project's next-work list covers them.
- `Fighter.meter` accumulates but nothing spends it. It is the hook a super
  move would use, and it is kept out of the HUD until it does something.
- The soundtrack is two loops. A real release wants a theme per stage, and the
  melodies are written by a programmer, not a composer. `music.play()` takes a
  `Song`, so swapping in streamed files later means changing that one call.
- The curvature only exists on the WebGL renderer. Where Phaser falls back to
  Canvas the picture is flat, which is the same degradation the CSS glass
  layers make.
- Phaser hit-tests menu rows against the unbent picture, so a pointer near the
  corners of the glass is out by a pixel or two. Nothing clickable is within
  reach of it.
- The display font is 5x7 with one-pixel interior gaps. At heading sizes the
  renderer flood-fills from the border so the drop shadow skips enclosed
  counters; an outline would still close them, so headings do not use one.

## Advance mobile shell

Phones use a purple Game Boy Advance inspired shell. Landscape places the D-pad
and four face buttons beside the display; portrait puts them below it. The LCD is 3:2;
the game remains 16:9 with letterboxing, so fighters and menus are never stretched
or cropped. Dynamic viewport height and safe-area insets account for browser bars
and notches. Very short windows can scroll the shell instead of losing controls.

The four round face buttons are B (jab), A (roundhouse), L (rising claw), and R
(ultimate). START confirms
menus and pauses/resumes matches. The D-pad navigates menus; A/B confirm and L
returns. Desktop keeps its arcade cabinet and keyboard controls.

Full screen uses the browser Fullscreen API when supported. Otherwise it opens
Home Screen instructions. The manifest and Apple web-app metadata let the game
launch without the address bar from a Home Screen icon (on newer iOS, leave
“Open as Web App” enabled when adding it). A normal browser tab cannot forcibly
hide its address bar. This adds standalone launching, not offline asset caching.

The shell’s MUTE button silences the master audio output, including both music
and effects. It persists locally and leaves the separate Options preferences
intact. Mobile devices offer single-player only, including `?mode=versus` links;
desktop retains the two-player menu. `npm run test:mobile` checks the mode policy
and master mute behavior before and after audio unlock.
