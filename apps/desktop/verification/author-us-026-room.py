"""Author the fixed US-026 room at 320×180. Stdlib only; no design image is read.

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
shelf(206, 15, 32, 22)
rect(241, 24, 16, 13, 'a5663b')
rect(241, 24, 16, 2, 'd39b5b')
rect(244, 30, 10, 5, 'bf8450')
rect(248, 31, 2, 1, 'f0cf8b')
rect(245, 18, 8, 7, 'c2c7cf')
rect(246, 19, 6, 4, 'e4dfd2')
rect(248, 20, 2, 2, '8997aa')
plant(19, 35, 2)
plant(120, 35)
plant(196, 34)
plant(279, 35, 2)
small_plant(228, 17)
shelf(293, 32, 18, 21)
small_plant(302, 31)

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
for shift in (0, 94):
    x = 130 + shift
    rect(x + 1, 61, 53, 19, 'ac6a38')
    rect(x, 58, 52, 19, '654932')
    rect(x + 1, 59, 50, 15, 'dfa35c')
    rect(x + 2, 59, 48, 2, 'efbe77')
    rect(x + 2, 73, 48, 1, 'c58341')
    rect(x + 1, 75, 50, 2, 'ac6a38')
    for dx in (2, 48):
        rect(x + dx, 77, 2, 8, '283044')
        rect(x + dx, 77, 1, 6, '54637c')
    cx = 146 + shift
    rect(cx - 8, 70, 16, 11, '283044')
    rect(cx - 7, 70, 14, 8, '42587c')
    rect(cx - 6, 71, 12, 1, '697d9d')
    rect(cx - 9, 77, 2, 6, '283044')
    rect(cx + 7, 77, 2, 6, '283044')
    rect(cx - 6, 79, 12, 5, '364a6c')
    rect(cx - 1, 84, 2, 3, '283044')
    line(cx, 86, cx - 6, 89, '283044')
    line(cx, 86, cx + 6, 89, '283044')
    rect(cx - 7, 89, 2, 2, '283044')
    rect(cx + 5, 89, 2, 2, '283044')
    mx = 158 + shift
    rect(mx - 2, 49, 24, 14, '283044')
    rect(mx - 1, 50, 22, 1, '7c83a0')
    rect(mx, 51, 20, 8, '66839b')
    rect(mx + 9, 63, 3, 2, '283044')
    rect(mx + 6, 65, 9, 1, '3d4b60')
    rect(mx, 67, 15, 3, '283044')
    rect(mx + 1, 67, 13, 1, '526582')
    for dx in (2, 5, 8, 11):
        rect(mx + dx, 68, 2, 1, '7c89a2')
    small_plant(x + 9, 59)
    cup(x + 7, 64)
    rect(x + 44, 67, 5, 5, '576a49')
    rect(x + 45, 68, 1, 3, 'd8a34c')
plant(197, 77, 2)
plant(283, 77)

# Lower-left cool coffee tile with cabinet, distinct appliances, cups and stools.
rect(8, 99, 113, 67, '8991b0')
rect(121, 115, 14, 51, '8991b0')
for y in range(100, 166, 9):
    rect(8, y, 113 if y < 115 else 127, 1, '737e9f')
    for x in range(9 + (y // 9 % 2) * 5, 133 if y >= 115 else 119, 10):
        rect(x, y + 1, 1, 8, '7c87a6')
rect(10, 108, 90, 36, '283044')
rect(11, 110, 88, 19, 'b3b7c1')
rect(12, 110, 86, 2, 'd3d4d5')
rect(11, 131, 88, 12, '455675')
rect(12, 132, 86, 1, '617391')
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
small_plant(94, 118)
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

# Perimeter props and a low decorative glass entry, not a functional second room.
shelf(295, 126, 16, 25)
small_plant(303, 124)
plant(299, 163, 2)
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
rect(133, 158, 9, 11, '283044')
rect(207, 158, 9, 11, '283044')
plant(137, 164)
plant(211, 164)

# Foreground is ONLY two native 10×2 chair-seat strips. Two pixels above the
# study strips keeps both existing selection strokes unobstructed at depth 20.
pixels = foreground
for x in (141, 235):
    rect(x, 83, 10, 1, '53688b')
    rect(x, 84, 10, 1, '283044')


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
