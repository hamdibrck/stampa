#!/usr/bin/env python3
"""Generates the Stampa app icon set (a passport stamp with a map pin) without dependencies.

Usage: python3 scripts/generate-icons.py   (run from apps/mobile)
"""
import math
import struct
import zlib

BG = (0x0E, 0x17, 0x26)
ACCENT = (0xFF, 0x6B, 0x4A)
WHITE = (255, 255, 255)
ANGLE = math.radians(-8)
COS, SIN = math.cos(ANGLE), math.sin(ANGLE)


def rounded_box(x, y, half, radius):
    qx, qy = abs(x) - half + radius, abs(y) - half + radius
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - radius


def in_triangle(x, y, a, b, c):
    def side(p, q):
        return (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1])

    d1, d2, d3 = side(a, b), side(b, c), side(c, a)
    return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))


def shape(u, v):
    """True where the stamp is drawn. (u, v) in [-0.5, 0.5], y down."""
    x, y = u * COS + v * SIN, -u * SIN + v * COS
    if abs(rounded_box(x, y, 0.31, 0.075)) <= 0.02:
        return True
    cy = -0.045
    if math.hypot(x, y - cy) <= 0.05:
        return False
    if math.hypot(x, y - cy) <= 0.125:
        return True
    return in_triangle(x, y, (-0.108, cy + 0.062), (0.108, cy + 0.062), (0.0, 0.2))


def render(size, scale, fg, bg):
    """bg=None → transparent background."""
    rows = []
    offsets = (0.25, 0.75)
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            hits = 0
            for oy in offsets:
                for ox in offsets:
                    u = ((px + ox) / size - 0.5) / scale
                    v = ((py + oy) / size - 0.5) / scale
                    hits += shape(u, v)
            a = hits / 4
            if bg is None:
                row += bytes((*fg, round(255 * a)))
            else:
                row += bytes((*(round(bg[i] + (fg[i] - bg[i]) * a) for i in range(3)), 255))
        rows.append(bytes(row))
    return b''.join(rows)


def write_png(path, size, data):
    def chunk(kind, body):
        return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body))

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(data, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print('wrote', path)


OUT = 'assets/images/'
write_png(OUT + 'icon.png', 1024, render(1024, 1.0, ACCENT, BG))
write_png(OUT + 'splash-icon.png', 512, render(512, 1.25, ACCENT, None))
write_png(OUT + 'android-icon-foreground.png', 1024, render(1024, 0.62, ACCENT, None))
write_png(OUT + 'android-icon-monochrome.png', 1024, render(1024, 0.62, WHITE, None))
write_png(OUT + 'favicon.png', 64, render(64, 1.0, ACCENT, BG))
