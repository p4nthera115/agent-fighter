"""Independently decode Aseprite layers and compare every pixel with PNG exports."""
from pathlib import Path
import struct, zlib, json, sys
from PIL import Image

root = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent.parent / 'output/clawd-animation'
filename = sys.argv[2] if len(sys.argv)>2 else 'clawd.aseprite'
data = (root / filename).read_bytes()
u16 = lambda pos: struct.unpack_from('<H', data, pos)[0]
u32 = lambda pos: struct.unpack_from('<I', data, pos)[0]
assert u32(0) == len(data)
assert u16(4) == 0xA5E0 and u16(12) == 32
count, w, h = u16(6), u16(8), u16(10)
atlas = Image.open(root / 'clawd-sheet.png').convert('RGBA')
metadata = json.loads((root / 'clawd-sheet.json').read_text())
assert count == len(metadata['frames']) == 33
offset = 128
layer_names, tags, durations = [], [], []
colors = set()
decoded = []
for frame_index in range(count):
    start = offset
    end = start + u32(start)
    assert u16(start+4) == 0xF1FA
    duration = u16(start+8)
    durations.append(duration)
    chunks = u32(start+12) or u16(start+6)
    offset += 16
    cels = {}
    for _ in range(chunks):
        size, kind = u32(offset), u16(offset+4)
        p = offset + 6
        assert size >= 6 and offset + size <= end
        if kind == 0x2004:
            assert u16(p) & 3 == 3
            length = u16(p+16)
            layer_names.append(data[p+18:p+18+length].decode())
        elif kind == 0x2005:
            layer = u16(p)
            x, y = struct.unpack_from('<hh', data, p+2)
            assert data[p+6] == 255 and u16(p+7) == 2
            cw, ch = u16(p+16), u16(p+18)
            raw = zlib.decompress(data[p+20:offset+size])
            assert len(raw) == cw*ch*4
            assert 0 <= x <= w-cw and 0 <= y <= h-ch
            assert layer not in cels
            cels[layer] = (Image.frombytes('RGBA', (cw,ch), raw), (x,y))
        elif kind == 0x2018:
            q = p+10
            for _ in range(u16(p)):
                first,last = u16(q),u16(q+2)
                length = u16(q+17)
                name = data[q+19:q+19+length].decode()
                tags.append((name,first,last))
                q += 19+length
            assert q == offset+size
        offset += size
    assert offset == end
    assert len(cels) == len(layer_names) == 8
    composite = Image.new('RGBA', (w,h))
    for layer in sorted(cels):
        cel, xy = cels[layer]
        composite.alpha_composite(cel, xy)
    individual = Image.open(root / 'frames' / f'{frame_index:02}.png').convert('RGBA')
    assert composite.tobytes() == individual.tobytes(), f'Aseprite frame {frame_index} differs'
    f = metadata['frames'][frame_index]
    r = f['frame']
    extracted = atlas.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
    assert extracted.tobytes() == individual.tobytes(), f'Atlas frame {frame_index} differs'
    assert duration == f['duration'] > 0
    assert composite.getbbox()[3] == 136, 'Feet must remain on the floor'
    assert composite.getbbox()[0] > 0 and composite.getbbox()[2] < w
    pixels = composite.tobytes()
    colors.update(tuple(pixels[k:k+4]) for k in range(0,len(pixels),4))
    decoded.append(composite.tobytes())
assert offset == len(data)
assert tags == [('idle',0,5),('punch',6,14),('uppercut',15,23),('kick',24,32)]
assert all(decoded[i]==decoded[0] for i in [5,6,14,15,23,24,32]), 'Loops must return to master'
assert len(colors) <= 13
assert {c[3] for c in colors} == {0,255}, 'No semitransparent pixels'
report = dict(frames=count,layers=layer_names,tags=tags,canvas=[w,h],colors_including_transparency=len(colors),pixel_comparison='All 33 editable-file composites exactly match individual PNGs and atlas',baseline=136,loop_seams='Every animation begins and ends at the same master pose',application_check='Neither LibreSprite nor Aseprite installed; application-level open not tested')
(root/('verification-libresprite.json' if filename.endswith('.ase') else 'verification.json')).write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
