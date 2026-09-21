#!/usr/bin/env python3
"""Stage a generated sprite sheet for the browser build.

The animation passes in `output/<id>-animation/` arrive with art timing only:
an atlas, its frame rectangles, and a list of animations. The runtime needs
one thing more — for each cel, the phase it belongs to and whether it is the
*contact* cel, the pose the renderer holds for the whole of a move's active
window. This script adds that to the authoring `-moves.json` in place, then
copies the three runtime files into `web/public/assets/<id>/`.

    python3 scripts/stage-fighter.py muse codex

Clawd is not staged here. Its sheet is assembled by `build-clawd.cjs`, which
writes its own per-cel phases and contact flags; this script is for the
fighters packed from a generated sheet.

Contact cels are declared below rather than guessed. Each was read off the
sheet by measuring how far the art reaches in fighter-local units from the
(106,136) pivot and taking the cel that reaches furthest: forward for a punch
or a kick, upward for an uppercut. Re-measure before changing one — a wrong
contact cel puts the fist somewhere other than where the hitbox is.

This writes no gameplay data. `web/src/game/combat/frameData.ts` stays the one
source of startup, active, recovery, damage and boxes for the whole cast.
"""

import json
import shutil
import sys
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Contact cel per attack, with the measured reach that identified it.
CONTACT = {
    'grok': {'punch': 9, 'uppercut': 15, 'kick': 21},   # +87 fwd, 133 up, +75 fwd
    'muse': {'punch': 9, 'uppercut': 15, 'kick': 21},   # +72 fwd, 120 up, +72 fwd
    'codex': {'punch': 9, 'uppercut': 15, 'kick': 21},  # +66 fwd, 114 up, +71 fwd
    'openclaw': {'punch': 9, 'uppercut': 15, 'kick': 21},  # +71 fwd, 102 up, +63 fwd
}

# Phase names, one per cel. Documentation for anyone reading the JSON or
# stepping the sheet in an editor; nothing reads them at runtime.
PHASES = {
    'idle': ['guard', 'breathe in', 'rise', 'blink', 'breathe out', 'settle'],
    'punch': ['guard', 'wind-up', 'coil', 'extend', 'retract', 'settle'],
    'uppercut': ['guard', 'crouch', 'rise', 'overhead strike', 'recover', 'settle'],
    'kick': ['guard', 'knee lift', 'chamber', 'extend', 'retract', 'settle'],
    'damage': ['impact', 'recoil', 'squeezed', 'hold', 'recover', 'settle'],
    'victory': ['raise', 'cheer', 'bounce', 'bounce', 'cheer', 'settle'],
    'defeated': ['stagger', 'sag', 'kneel', 'fall', 'flatten', 'hold'],
}

# Grok has no limbs to name: it becomes the attack, so its cels say so.
OVERRIDES = {
    'grok': {
        'idle': ['ready', 'squash', 'rise', 'blink', 'breathe out', 'settle'],
        'punch': ['ready', 'wind-up', 'capsule forms', 'strike', 'pull back', 'settle'],
        'uppercut': ['ready', 'dip', 'teardrop', 'rising strike', 'fall back', 'settle'],
        'kick': ['ready', 'weight shift', 'square forms', 'body strike', 'rebound', 'settle'],
        'victory': ['lift', 'shift', 'shift', 'shift', 'shift', 'hold'],
        'defeated': ['stagger', 'dazed', 'sag', 'deflate', 'flatten', 'hold'],
    },
}

NOTE = (
    'Animation timing study, not balanced combat frame data. No gameplay hitboxes '
    'assigned. "active" marks the contact cel the renderer holds for a move\'s '
    'active window.'
)

# What each fighter's moveset actually is, kept from the authoring files.
NOTE_EXTRA = {
    'grok': 'Kick is a square-form body strike.',
    'muse': 'Muse uses plush mitten punches, rising uppercuts and side kicks.',
    'codex': 'Codex uses blue robot punches, rising uppercuts and side kicks.',
    'openclaw': 'Openclaw uses red mitten punches, rising uppercuts and side kicks.',
}


def phases_for(fighter: str, tag: str, length: int) -> list:
    """Phase names for one clip, padded from the last name if the clip is longer."""
    names = OVERRIDES.get(fighter, {}).get(tag) or PHASES.get(tag) or []
    if not names:
        return ['cel'] * length
    return [names[min(i, len(names) - 1)] for i in range(length)]


def stage(fighter: str) -> None:
    source = ROOT / 'output' / f'{fighter}-animation'
    dest = ROOT / 'web' / 'public' / 'assets' / fighter
    moves_path = source / f'{fighter}-moves.json'

    sheet = json.loads((source / f'{fighter}-sheet.json').read_text())
    moves = json.loads(moves_path.read_text())
    contacts = CONTACT[fighter]

    tags = sheet['meta']['frameTags']
    frames = []
    for tag in tags:
        names = phases_for(fighter, tag['name'], tag['to'] - tag['from'] + 1)
        for i, index in enumerate(range(tag['from'], tag['to'] + 1)):
            frames.append(OrderedDict([
                ('index', index),
                ('phase', names[i]),
                ('duration', sheet['frames'][index]['duration']),
                ('active', contacts.get(tag['name']) == index),
            ]))

    if len(frames) != len(sheet['frames']):
        raise SystemExit(f'{fighter}: tags cover {len(frames)} cels, the sheet has {len(sheet["frames"])}')
    if sum(frame['active'] for frame in frames) != len(contacts):
        raise SystemExit(f'{fighter}: a declared contact cel falls outside its own tag')

    animations = OrderedDict()
    for tag in tags:
        existing = moves['animations'][tag['name']]
        if (existing['from'], existing['to']) != (tag['from'], tag['to']):
            raise SystemExit(f'{fighter}: "{tag["name"]}" disagrees between the sheet and the moves file')
        entry = OrderedDict([('loop', existing['loop']), ('from', existing['from']), ('to', existing['to'])])
        for key in ('next', 'holdLast'):
            if key in existing:
                entry[key] = existing[key]
        animations[tag['name']] = entry

    size = moves['frameSize']
    out = OrderedDict([
        ('frameSize', {'width': size.get('width', size.get('w')), 'height': size.get('height', size.get('h'))}),
        ('origin', moves['origin']),
        ('animations', animations),
        ('frames', frames),
        ('note', ' '.join(filter(None, [NOTE, NOTE_EXTRA.get(fighter)]))),
    ])
    moves_path.write_text(json.dumps(out, indent=2) + '\n')

    dest.mkdir(parents=True, exist_ok=True)
    for name in (f'{fighter}-sheet.png', f'{fighter}-sheet.json', f'{fighter}-moves.json'):
        shutil.copy2(source / name, dest / name)
    print(
        f'{fighter}: {len(frames)} cels, {len(tags)} tags, '
        f'{len(contacts)} contact cels -> {dest.relative_to(ROOT)}'
    )


if __name__ == '__main__':
    targets = sys.argv[1:]
    if not targets:
        raise SystemExit(f'usage: stage-fighter.py <fighter> [...]   known: {", ".join(sorted(CONTACT))}')
    for name in targets:
        if name not in CONTACT:
            raise SystemExit(f'no contact cels declared for "{name}"; add them to CONTACT first')
        stage(name)
