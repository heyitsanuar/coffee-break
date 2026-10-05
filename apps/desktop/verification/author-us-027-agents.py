"""Independently author US-027's native-grid character sheets; no reference raster is read.

Run with Python 3; --check verifies reproducibility without writing assets.
The four legacy mock cells are preserved from the existing production sheet.
"""
from pathlib import Path
import struct
import sys
import zlib

ASSETS = Path(__file__).resolve().parents[1] / 'src/office/assets'
INK = '263343'
SKIN, SKIN_SHADE = 'e2b98e', 'bf8d70'
IDENTITIES = [
    ('35343c', '57535b', '78927a', 'a0b293'),  # Ari: dark crop / sage.
    ('684530', '95633f', 'ba7e60', 'dda48a'),  # Mina: asymmetric bob / terracotta.
    ('d3a647', 'f0cc72', '465c7a', '758ba5'),  # Sol: blond tuft / navy.
]


def decode_rgba(png):
    """Read the production legacy cells without preserving PNG compression/filter choices."""
    assert png[:8] == b'\x89PNG\r\n\x1a\n'
    offset, compressed = 8, b''
    while offset < len(png):
        length = struct.unpack('>I', png[offset:offset + 4])[0]
        kind, data = png[offset + 4:offset + 8], png[offset + 8:offset + 8 + length]
        if kind == b'IHDR':
            width, height, depth, mode, _, _, interlace = struct.unpack('>IIBBBBB', data)
            assert (depth, mode, interlace) == (8, 6, 0)
        if kind == b'IDAT':
            compressed += data
        offset += length + 12
    raw = zlib.decompress(compressed)
    stride = width * 4
    pixels = bytearray(width * height * 4)
    for y in range(height):
        filter_type = raw[y * (stride + 1)]
        assert filter_type <= 4
        for x in range(stride):
            i = y * stride + x
            a = pixels[i - 4] if x >= 4 else 0
            b = pixels[i - stride] if y else 0
            c = pixels[i - stride - 4] if y and x >= 4 else 0
            p = a + b - c
            pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
            paeth = a if pa <= pb and pa <= pc else b if pb <= pc else c
            pixels[i] = (raw[y * (stride + 1) + 1 + x] + (0, a, b, (a + b) // 2, paeth)[filter_type]) % 256
    return width, height, pixels


def character(identity, pose):
    pixels = bytearray(20 * 24 * 4)
    hair, hair_light, shirt, shirt_light = IDENTITIES[identity]

    def rect(x, y, width, height, colour):
        assert 0 <= x < x + width <= 20 and 0 <= y < y + height <= 24
        rgba = bytes.fromhex(colour) + b'\xff'
        for row in range(y, y + height):
            for column in range(x, x + width):
                i = (row * 20 + column) * 4
                pixels[i:i + 4] = rgba

    # Upper body stays fixed; Ari/Mina's connected lap sits inside the foreground seat strip.
    rect(5, 12, 10, 9, INK)
    rect(6, 13, 8, 7, shirt)
    rect(7, 13, 2, 7, shirt_light)
    rect(9, 12, 3, 2, SKIN)
    if identity < 2:
        rect(5, 20, 10, 2, INK)
        rect(6, 20, 8, 1, shirt)
    else:
        rect(7, 21, 3, 2, shirt)
        rect(12, 21, 3, 2, shirt)
        rect(6, 23, 4, 1, INK)
        rect(12, 23, 4, 1, INK)

    def relaxed_left():
        rect(4, 13, 2, 8, INK)
        rect(5, 13, 1, 7, shirt_light)
        rect(4, 20, 2, 2, SKIN)

    def relaxed_right():
        rect(14, 13, 2, 8, INK)
        rect(14, 13, 1, 7, shirt)
        rect(14, 20, 2, 2, SKIN)

    if pose == 'idle':
        relaxed_left()
        relaxed_right()
    elif pose in ('work-a', 'work-b'):
        rect(3, 14, 8, 3, INK)
        rect(4, 15, 6, 1, shirt_light)
        rect(14, 14, 5, 3, INK)
        rect(14, 15, 3, 1, shirt)
        step = pose == 'work-b'
        rect(8, 14 + step, 3, 2, SKIN)
        rect(17, 13 + step, 2, 2, SKIN)
    elif pose == 'waiting':
        rect(4, 13, 3, 6, INK)
        rect(5, 14, 2, 4, shirt_light)
        rect(13, 13, 3, 6, INK)
        rect(13, 14, 2, 4, shirt)
        rect(6, 18, 8, 3, INK)
        rect(7, 18, 3, 2, SKIN)
        rect(10, 19, 3, 1, SKIN_SHADE)
    elif pose == 'completed':
        relaxed_left()
        rect(14, 13, 2, 7, INK)
        rect(14, 14, 1, 4, shirt)
        rect(14, 18, 3, 2, SKIN)
    elif pose == 'complete-ack':
        relaxed_right()
        rect(2, 8, 3, 8, INK)
        rect(3, 9, 1, 6, shirt_light)
        rect(4, 13, 2, 4, INK)
        rect(2, 6, 2, 3, SKIN)
    elif pose == 'error':
        relaxed_left()
        rect(13, 13, 3, 6, INK)
        rect(14, 14, 1, 3, shirt)
        rect(12, 12, 3, 2, SKIN)
    elif pose == 'error-ack':
        rect(3, 14, 3, 5, INK)
        rect(4, 14, 1, 3, shirt_light)
        rect(14, 14, 3, 5, INK)
        rect(15, 14, 1, 3, shirt)
        rect(2, 12, 3, 2, SKIN)
        rect(15, 12, 3, 2, SKIN)
    elif pose in ('coffee-a', 'coffee-b'):
        relaxed_left()
        rect(14, 14, 4, 5, INK)
        rect(14, 15, 2, 2, shirt)
        rect(15, 17, 2, 1, SKIN)
        cup_x = 16 if pose == 'coffee-a' else 15
        rect(cup_x, 12, 3, 5, INK)
        rect(cup_x, 12, 3, 1, 'f7f0df')
        rect(cup_x, 13, 2, 3, '8ca57b')
    else:
        raise ValueError(pose)

    # Independently drawn broad heads, simple eyes, one mouth, and identity hair silhouettes.
    rect(4, 3, 12, 9, INK)
    rect(5, 6, 10, 5, SKIN)
    rect(5, 10, 2, 1, SKIN_SHADE)
    rect(13, 10, 2, 1, SKIN_SHADE)
    if identity == 0:
        rect(6, 1, 8, 2, INK)
        rect(5, 2, 10, 3, hair)
        rect(5, 3, 7, 1, hair_light)
        rect(4, 4, 2, 4, hair)
        rect(14, 4, 2, 3, hair)
    elif identity == 1:
        rect(5, 1, 10, 2, INK)
        rect(4, 2, 12, 3, hair)
        rect(5, 2, 8, 1, hair_light)
        rect(3, 4, 3, 9, INK)
        rect(4, 4, 2, 8, hair)
        rect(14, 4, 3, 11, INK)
        rect(14, 4, 2, 10, hair_light)
        rect(6, 5, 3, 1, hair)
    else:
        rect(10, 1, 3, 1, INK)
        rect(7, 2, 6, 2, hair_light)
        rect(5, 3, 10, 3, hair)
        rect(4, 4, 2, 3, hair)
        rect(14, 4, 2, 3, hair)
    rect(7, 8, 1, 1, INK)
    rect(12, 8, 1, 1, INK)
    rect(9, 11, 3, 1, SKIN_SHADE)
    if pose in ('completed', 'complete-ack'):
        rect(9, 10, 3, 1, SKIN_SHADE)
        rect(10, 11, 1, 1, SKIN)
    if pose in ('error', 'error-ack'):
        rect(7, 7, 2, 1, INK)
        rect(11, 7, 2, 1, INK)
    return pixels


def png(width, height, pixels):
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))
    raw = b''.join(b'\0' + pixels[y * width * 4:(y + 1) * width * 4] for y in range(height))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def build():
    poses = ['idle', 'work-a', 'waiting', 'completed', 'error', 'work-b', 'complete-ack', 'error-ack']
    lifecycle = bytearray(160 * 72 * 4)
    width, height, coffee = decode_rgba((ASSETS / 'mock-agents.png').read_bytes())
    assert (width, height) == (120, 24)
    for identity in range(3):
        for column, pose in enumerate(poses):
            frame = character(identity, pose)
            for y in range(24):
                offset = ((identity * 24 + y) * 160 + column * 20) * 4
                lifecycle[offset:offset + 80] = frame[y * 80:(y + 1) * 80]
    for column, pose in [(4, 'coffee-a'), (5, 'coffee-b')]:
        frame = character(2, pose)
        for y in range(24):
            offset = (y * 120 + column * 20) * 4
            coffee[offset:offset + 80] = frame[y * 80:(y + 1) * 80]
    return {'agent-lifecycle.png': png(160, 72, lifecycle), 'mock-agents.png': png(120, 24, coffee)}


if __name__ == '__main__':
    assert sys.argv[1:] in ([], ['--check'])
    for name, data in build().items():
        path = ASSETS / name
        if '--check' in sys.argv:
            assert path.read_bytes() == data, f'Non-reproducible asset: {name}'
        else:
            path.write_bytes(data)
        print(('Verified' if '--check' in sys.argv else 'Authored'), name, len(data), 'bytes')
