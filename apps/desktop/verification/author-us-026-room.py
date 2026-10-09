"""Author the US-032 five-zone room at 320×180. Stdlib only; no design image is read.

Run from any directory with Python 3. Output is the two production RGBA sheets.
Shapes are deliberately placed on the native pixel grid; no resampling or random art.
"""
from pathlib import Path
import struct
import zlib

WIDTH, HEIGHT = 320, 180
background = bytearray(WIDTH * HEIGHT * 4)
foreground = bytearray(WIDTH * HEIGHT * 4)
pixels = background


def colour(value):
    return bytes.fromhex(value.removeprefix('#')) + b'\xff'


def rect(x, y, w, h, fill):
    assert all(isinstance(n, int) for n in (x, y, w, h))
    rgba = colour(fill)
    for row in range(max(0, y), min(HEIGHT, y + h)):
        left, right = max(0, x), min(WIDTH, x + w)
        if right > left:
            offset = (row * WIDTH + left) * 4
            pixels[offset:offset + (right - left) * 4] = rgba * (right - left)


def line(x1, y1, x2, y2, fill):
    dx, dy = abs(x2 - x1), -abs(y2 - y1)
    sx, sy = 1 if x1 < x2 else -1, 1 if y1 < y2 else -1
    error = dx + dy
    while True:
        rect(x1, y1, 1, 1, fill)
        if (x1, y1) == (x2, y2):
            return
        twice = 2 * error
        if twice >= dy:
            error += dy
            x1 += sx
        if twice <= dx:
            error += dx
            y1 += sy


def polygon(points, fill):
    for y in range(min(p[1] for p in points), max(p[1] for p in points) + 1):
        crossings = []
        for (ax, ay), (bx, by) in zip(points, points[1:] + points[:1]):
            if min(ay, by) <= y < max(ay, by):
                crossings.append(round(ax + (y - ay) * (bx - ax) / (by - ay)))
        crossings.sort()
        for left, right in zip(crossings[::2], crossings[1::2]):
            rect(left, y, right - left + 1, 1, fill)


def leaf(x, y, dx, dy, fill):
    # Pointed leaf with a dark base and broad stepped belly, not a grass blade.
    mid_x, mid_y = x + dx // 2, y + dy // 2
    polygon([(x, y), (mid_x - 3, mid_y), (x + dx, y + dy), (mid_x + 3, mid_y + 1)], '244e3b')
    polygon([(x, y - 1), (mid_x - 2, mid_y), (x + dx, y + dy), (mid_x + 2, mid_y)], fill)
    line(x, y, mid_x, mid_y, '244e3b')


def plant(x, y, size=1):
    # x,y = pot bottom-center. Vary foliage height without changing the pixel scale.
    polygon([(x - 6, y - 8), (x + 6, y - 8), (x + 5, y - 1),
             (x + 3, y + 1), (x - 3, y + 1), (x - 5, y - 1)], '754932')
    polygon([(x - 5, y - 7), (x + 5, y - 7), (x + 4, y - 1),
             (x, y), (x - 4, y - 1)], 'ba7642')
    rect(x - 4, y - 6, 2, 4, 'd89b57')
    rect(x - 6, y - 9, 12, 2, '342f35')
    for dx, dy, shade in [(-9, -11, '5d9e38'), (-6, -16, '75ad3f'),
                          (0, -18 - size, '82b646'), (5, -15, '4b8734'),
                          (9, -10, '71a43b'), (-8, -5, '417a36'),
                          (8, -4, '5e9a38'), (2, -12, '96bd4b')]:
        leaf(x, y - 9, dx, dy, shade)


def small_plant(x, y):
    rect(x - 3, y - 3, 6, 4, 'ba7642')
    rect(x - 3, y - 4, 6, 2, '342f35')
    for dx, dy in [(-4, -8), (0, -12), (4, -9), (-2, -10), (3, -6)]:
        leaf(x, y - 4, dx, dy, '75ad3f')


def cup(x, y, shade='f1dfb1'):
    rect(x, y, 4, 4, shade)
    rect(x, y, 4, 1, 'fbebc9')
    rect(x + 1, y + 1, 2, 1, '775743')
    rect(x + 4, y + 1, 2, 2, shade)


def shelf(x, y, w, h):
    rect(x + 1, y + 2, w, h, 'a2643b')
    rect(x, y, w, h, '342f35')
    rect(x + 2, y + 2, w - 4, h - 4, '754932')
    rect(x, y, w, 2, 'd29455')
    for row in range(2):
        base = y + 11 + row * 11
        for index, dx in enumerate(range(4, w - 3, 4)):
            height = (6, 8, 5, 7)[(index + row) % 4]
            shade = ('cd7045', '668aa1', 'e4b862', 'b25866', '92a064')[(index + row) % 5]
            rect(x + dx, base - height, 2, height, shade)
            rect(x + dx, base - height + 1, 1, 1, 'f2d69f')
        rect(x + 1, base, w - 2, 2, 'cf9054')
    rect(x + 2, y + h - 3, w - 4, 1, '513d35')


def bounded_plant(x, y, w, h):
    cx = x + w // 2
    polygon([(x + 2, y + h - 6), (x + w - 2, y + h - 6),
             (x + w - 3, y + h - 1), (x + 3, y + h - 1)], 'ba7642')
    rect(x + 1, y + h - 7, w - 2, 2, '283044')
    line(cx, y + 2, cx, y + h - 7, '244e3b')
    for dx, dy in [(-w // 2 + 1, 4), (w // 2 - 2, 6), (-w // 2 + 2, 9)]:
        polygon([(cx, y + h - 7), (x + w // 2 + dx, y + dy),
                 (cx, y + dy + 2)], '5d9e38')
    rect(cx, y + 1, 1, h - 8, '82b646')


def empty_chair(x, y, w, h):
    rect(x, y, w, h - 2, '283044')
    rect(x + 2, y + 1, w - 4, h // 2 - 1, '42587c')
    rect(x + 2, y + 2, w - 4, 1, '697d9d')
    rect(x + 2, y + h // 2 + 1, w - 4, h // 2 - 3, '546b88')
    rect(x + 2, y + h - 2, 2, 2, '283044')
    rect(x + w - 4, y + h - 2, 2, 2, '283044')


# Continuous amber planks. Quiet staggered joints/grain, never operational data.
rect(0, 0, WIDTH, HEIGHT, '283044')
rect(7, 26, 306, 145, 'cc894f')
for row, y in enumerate(range(27, 169, 7)):
    rect(8, y, 304, 6, ('ce8c51', 'ca854a', 'd18f53', 'cd894d')[row % 4])
    rect(8, y + 6, 304, 1, 'bf7e47')
    for x in range(8 + (row % 3) * 17, 312, 53):
        rect(x, y, 1, 6, 'c08048')
        if x + 17 < 312:
            rect(x + 8, y + 3, 9, 1, 'd09157')
        if x + 29 < 312:
            rect(x + 24, y + 1, 5, 1, 'c58249')

# Shallow blue-violet masonry and low perimeter caps.
rect(2, 2, 316, 25, '646d94')
for y in range(4, 27, 6):
    rect(4, y, 312, 1, '7c83a7')
    for x in range(4 + (y // 6 % 2) * 8, 318, 16):
        rect(x, y + 1, 1, 5, '596487')
rect(2, 2, 316, 3, '8b90b4')
rect(3, 27, 4, 142, '56617f')
rect(313, 27, 4, 142, '56617f')
rect(2, 7, 5, 20, '4c5877')
rect(313, 7, 5, 20, '4c5877')
rect(1, 3, 7, 5, '9196bc')
rect(312, 3, 7, 5, '9196bc')
rect(7, 169, 306, 6, '687396')
rect(7, 169, 306, 1, '9099b7')
rect(7, 175, 306, 3, '354260')
for x in range(8, 313, 17):
    rect(x, 170, 1, 5, '56617f')
rect(1, 164, 7, 9, '9196bc')
rect(312, 164, 7, 9, '9196bc')

# Rear storage rhythm and wide window; no fabricated screens or signs.
shelf(45, 10, 30, 27)
shelf(89, 15, 22, 21)
rect(135, 9, 52, 18, '283044')
rect(137, 11, 23, 14, '518bb3')
rect(163, 11, 22, 14, '518bb3')
rect(138, 12, 21, 5, '66a5c5')
rect(164, 12, 20, 5, '66a5c5')
for x in (139, 165):
    line(x, 21, x + 8, 13, '81bfd7')
    line(x + 12, 22, x + 17, 17, '71b2cf')
rect(160, 10, 3, 16, '364f73')
rect(134, 27, 54, 2, '9e744d')
shelf(198, 12, 27, 22)
plant(19, 35, 2)
plant(120, 35)
plant(196, 34)

# Upper-left support/lounge: bounded slate rug, magenta sofa, compact table.
rect(12, 47, 93, 49, '4b5265')
rect(13, 48, 91, 47, '636b7b')
for y in range(50, 95, 4):
    rect(14, y, 88, 1, '606776')
rect(39, 44, 50, 20, '58334e')
rect(41, 43, 46, 8, 'ca5688')
rect(42, 44, 44, 2, 'e776a4')
rect(41, 52, 46, 10, 'b74679')
rect(43, 52, 20, 7, 'd96697')
rect(65, 52, 20, 7, 'd96697')
rect(39, 48, 3, 13, 'd25b8e')
rect(86, 48, 3, 13, 'd25b8e')
rect(42, 63, 2, 2, '283044')
rect(84, 63, 2, 2, '283044')
rect(14, 62, 20, 28, '283044')
rect(16, 63, 16, 25, '465c7e')
rect(17, 64, 14, 9, '61789a')
rect(17, 75, 14, 10, '586e91')
rect(15, 87, 3, 2, '9d794b')
rect(30, 87, 3, 2, '9d794b')
rect(44, 69, 41, 17, '283044')
rect(45, 68, 39, 15, '5b7092')
rect(46, 69, 37, 1, '8c9bb5')
rect(46, 85, 2, 3, '283044')
rect(81, 85, 2, 3, '283044')
small_plant(53, 77)
rect(62, 69, 7, 6, 'd2cfb9')
rect(63, 70, 5, 2, 'b1546e')
rect(63, 74, 6, 2, '333e56')
cup(74, 74)
rect(31, 48, 3, 11, '283044')
rect(29, 59, 7, 2, '283044')
rect(29, 37, 7, 11, 'e1b970')
rect(30, 38, 5, 8, 'f7deb0')
plant(19, 59)
plant(97, 63)
plant(97, 94)

# Two honey tops, short aprons/legs, dark chair backs/arms and caster bases.
for offset_x, dy in ((0, 0), (34, 33)):
    x = 130 + offset_x
    rect(x + 1, 61 + dy, 53, 19, 'ac6a38')
    rect(x, 58 + dy, 52, 19, '654932')
    rect(x + 1, 59 + dy, 50, 15, 'dfa35c')
    rect(x + 2, 59 + dy, 48, 2, 'efbe77')
    rect(x + 2, 73 + dy, 48, 1, 'c58341')
    rect(x + 1, 75 + dy, 50, 2, 'ac6a38')
    for dx in (2, 48):
        rect(x + dx, 77 + dy, 2, 8, '283044')
        rect(x + dx, 77 + dy, 1, 6, '54637c')
    cx = 146 + offset_x
    rect(cx - 8, 70 + dy, 16, 11, '283044')
    rect(cx - 7, 70 + dy, 14, 8, '42587c')
    rect(cx - 6, 71 + dy, 12, 1, '697d9d')
    rect(cx - 9, 77 + dy, 2, 6, '283044')
    rect(cx + 7, 77 + dy, 2, 6, '283044')
    rect(cx - 6, 79 + dy, 12, 5, '364a6c')
    rect(cx - 1, 84 + dy, 2, 3, '283044')
    line(cx, 86 + dy, cx - 6, 89 + dy, '283044')
    line(cx, 86 + dy, cx + 6, 89 + dy, '283044')
    rect(cx - 7, 89 + dy, 2, 2, '283044')
    rect(cx + 5, 89 + dy, 2, 2, '283044')
    mx = 158 + offset_x
    rect(mx - 2, 49 + dy, 24, 14, '283044')
    rect(mx - 1, 50 + dy, 22, 1, '7c83a0')
    rect(mx, 51 + dy, 20, 8, '66839b')
    rect(mx + 9, 63 + dy, 3, 2, '283044')
    rect(mx + 6, 65 + dy, 9, 1, '3d4b60')
    rect(mx, 67 + dy, 15, 3, '283044')
    rect(mx + 1, 67 + dy, 13, 1, '526582')
    for dx in (2, 5, 8, 11):
        rect(mx + dx, 68 + dy, 2, 1, '7c89a2')
    bounded_plant(x - 2, 48 + dy, 6, 14)
    rect(x + 44, 67 + dy, 5, 5, '576a49')
    rect(x + 45, 68 + dy, 1, 3, 'd8a34c')
plant(197, 77, 2)
bounded_plant(207, 125, 14, 19)

# Lower-left cool coffee tile with cabinet, distinct appliances, cups and stools.
rect(8, 99, 113, 67, '8991b0')
rect(121, 115, 14, 51, '8991b0')
for y in range(100, 166, 9):
    rect(8, y, 113 if y < 115 else 127, 1, '737e9f')
    for x in range(9 + (y // 9 % 2) * 5, 133 if y >= 115 else 119, 10):
        rect(x, y + 1, 1, 8, '7c87a6')
rect(10, 108, 86, 36, '283044')
rect(11, 110, 84, 19, 'b3b7c1')
rect(12, 110, 82, 2, 'd3d4d5')
rect(11, 131, 84, 12, '455675')
rect(12, 132, 82, 1, '617391')
for x in (38, 68):
    rect(x, 133, 1, 10, '344762')
    rect(x - 2, 134, 1, 2, '9ba6b7')
    rect(x + 2, 134, 1, 2, '9ba6b7')
# Espresso machine: light top, dark recess, spout and tray. No fake text.
rect(26, 105, 17, 20, '34425a')
rect(26, 104, 17, 5, 'd1d2d3')
rect(28, 105, 13, 2, 'eee3cd')
rect(28, 110, 13, 3, '8e9cac')
rect(29, 114, 11, 8, '283044')
rect(32, 113, 5, 2, 'c5c9cf')
rect(34, 115, 1, 3, 'a5b3be')
cup(33, 118)
rect(28, 124, 13, 2, '71819a')
# Rounded drip brewer, recognizable carafe and short cream highlight.
rect(49, 107, 11, 15, '283044')
rect(48, 106, 13, 5, '44546e')
rect(50, 107, 9, 2, '617391')
rect(51, 112, 7, 2, '9fa9b6')
rect(50, 115, 9, 8, '71819a')
rect(51, 117, 7, 5, '583a30')
rect(52, 116, 5, 1, 'e5d9bd')
rect(59, 117, 2, 4, 'c2c7cf')
rect(48, 124, 13, 2, '34425a')
rect(68, 113, 3, 9, 'a7663c')
rect(69, 110, 1, 4, '283044')
rect(68, 117, 3, 2, 'ecd6a8')
cup(78, 118)
cup(84, 117, 'd7dbe0')
small_plant(18, 116)
bounded_plant(88, 104, 8, 15)
for x in (39, 62):
    rect(x - 4, 148, 8, 3, '283044')
    rect(x - 1, 150, 2, 6, '283044')
    line(x, 154, x - 5, 158, '283044')
    line(x, 154, x + 5, 158, '283044')
    rect(x - 5, 140, 10, 7, 'a86532')
    rect(x - 4, 140, 8, 4, 'dd9b4d')
    rect(x - 3, 140, 6, 1, 'efb968')
# A tiny return ledge and permanent mug beside Sol's fixed coffee envelope.
# Steam envelope (115,124)+(5,6) touches this mug, clear of the current sprite.
rect(115, 131, 9, 3, '34425a')
rect(115, 130, 9, 1, 'b3b7c1')
cup(117, 130, '8ca57b')
# Five logical pixels farther right than the study foliage keeps the permanent
# mug and both unchanged steam frames clear of leaves and Sol's hand envelope.
plant(129, 143)

# Empty decorative Meeting/Focus zones. Glass stays below all presentation objects.
for top, bottom in ((10, 90), (98, 166)):
    rect(232, top, 80, bottom - top, '8991b0')
    for y in range(top + 2, bottom, 9):
        rect(233, y, 78, 1, '737e9f')
        for x in range(234, 312, 10):
            rect(x, y + 1, 1, min(8, bottom - y - 1), '7c87a6')
rect(228, 10, 4, 156, '364f73')
rect(229, 11, 2, 155, '518bb3')
for top, bottom in ((74, 86), (140, 152)):
    rect(228, top, 4, bottom - top, 'cc894f')
rect(232, 90, 80, 8, '4c5877')
rect(232, 90, 80, 2, '9196bc')
# Rear picture, rug, four unmistakably empty chairs and honey-wood table.
rect(245, 39, 55, 47, '636b7b')
rect(246, 40, 53, 45, '697d9d')
rect(265, 29, 24, 10, '283044')
rect(267, 31, 20, 6, 'efbe77')
rect(269, 32, 7, 4, '518bb3')
rect(280, 33, 5, 3, 'ca5688')
for x in (253, 277):
    empty_chair(x, 34, 14, 13)
rect(249, 45, 46, 20, '283044')
rect(250, 46, 44, 16, 'dfa35c')
rect(251, 47, 42, 1, 'efbe77')
rect(250, 63, 44, 2, 'ac6a38')
for x in (253, 277):
    empty_chair(x, 64, 14, 19)
bounded_plant(269, 48, 6, 11)
rect(279, 52, 8, 5, '668aa1')
rect(280, 53, 6, 1, 'e8edf6')
shelf(302, 31, 7, 26)
rect(297, 39, 2, 14, '283044')
rect(294, 53, 8, 2, '283044')
rect(294, 29, 8, 10, 'efbe77')
rect(295, 30, 6, 7, 'fbebc9')
bounded_plant(235, 67, 13, 20)
bounded_plant(297, 65, 13, 22)
# Focus monitor is unlit decoration, never a third trusted state field.
rect(244, 128, 57, 37, '636b7b')
rect(245, 129, 55, 35, '697d9d')
rect(265, 115, 23, 6, '283044')
rect(267, 116, 19, 4, 'ca5688')
rect(256, 132, 39, 18, '283044')
rect(257, 133, 37, 14, 'dfa35c')
rect(258, 134, 35, 1, 'efbe77')
rect(257, 148, 37, 2, 'ac6a38')
rect(262, 122, 20, 12, '283044')
rect(263, 123, 18, 10, '54637c')
rect(264, 124, 16, 6, '283044')
rect(271, 130, 2, 4, '283044')
rect(263, 138, 16, 3, '283044')
rect(264, 138, 14, 1, '697d9d')
empty_chair(265, 148, 14, 15)
rect(235, 139, 10, 19, '283044')
rect(236, 140, 8, 17, 'ac6a38')
for y in (145, 151):
    rect(237, y, 6, 1, 'efbe77')
shelf(302, 119, 7, 37)
bounded_plant(240, 116, 12, 23)
bounded_plant(290, 146, 12, 18)

# Existing central entry, entirely decorative.
rect(145, 144, 9, 26, '56617f')
rect(194, 144, 9, 26, '56617f')
rect(145, 144, 9, 3, '9099b7')
rect(194, 144, 9, 3, '9099b7')
rect(154, 148, 40, 21, '283044')
rect(156, 150, 17, 16, '518bb3')
rect(176, 150, 16, 16, '518bb3')
rect(156, 150, 17, 4, '71b2cf')
rect(176, 150, 16, 4, '71b2cf')
line(158, 163, 168, 153, '81bfd7')
line(178, 163, 188, 153, '81bfd7')
rect(172, 151, 1, 14, '364f73')
rect(174, 153, 1, 10, '9ac4d7')
rect(154, 167, 40, 2, 'a77148')
rect(207, 158, 9, 11, '283044')
plant(211, 164)

# Foreground is ONLY two native 10×2 chair-seat strips. Two pixels above the
# study strips keeps both existing selection strokes unobstructed at depth 20.
pixels = foreground
for x, y in ((141, 83), (175, 116)):
    rect(x, y, 10, 1, '53688b')
    rect(x, y + 1, 10, 1, '283044')


def png(data):
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))
    scanlines = b''.join(b'\0' + data[y * WIDTH * 4:(y + 1) * WIDTH * 4] for y in range(HEIGHT))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', WIDTH, HEIGHT, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(scanlines, 9)) + chunk(b'IEND', b''))


if __name__ == '__main__':
    assets = Path(__file__).resolve().parents[1] / 'src/office/assets'
    for name, data in [('background', background), ('foreground', foreground)]:
        (assets / f'office-room-{name}.png').write_bytes(png(data))
        print(f'{name}: {WIDTH}×{HEIGHT}, {len(set(tuple(data[i:i+4]) for i in range(0, len(data), 4)))} RGBA colours')
