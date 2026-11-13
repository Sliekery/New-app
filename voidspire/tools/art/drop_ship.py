"""DROP SHIP (Rust: drops bots, rides an impervious hull until they are cleared, then arms a self-destruct).
A boxy dropship seen side-on, NOSE TOWARD THE PLAYER (left): a cockpit canopy at the front, a swept hull, a
dorsal tower with a blinking light, an open drop bay underneath with its doors hanging, a rear engine block
burning. Idle: the hull hovers and pitches a little, the engine flame flickers, the bay doors swing, the
running lights blink in sequence."""
import math
from lib import *

ID, N, FPS = "drop_ship", 8, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.04 * wave(ph)
    pt = 0.03 * wave(ph, 1, 0.8)
    c = (0, y)
    Q = []
    # hull: nose at the left
    Q.append([(-0.86, 0.02 + y), (-0.66, -0.18 + y), (0.50, -0.22 + y), (0.70, -0.10 + y), (0.70, 0.18 + y), (0.40, 0.26 + y),
              (-0.50, 0.26 + y), (-0.86, 0.02 + y)])
    Q.append([(-0.66, -0.18 + y), (-0.60, 0.26 + y)])
    Q.append([(-0.40, 0.02 + y), (0.62, 0.02 + y)])
    # cockpit canopy
    Q.append([(-0.80, 0.0 + y), (-0.70, -0.12 + y), (-0.56, -0.12 + y), (-0.56, 0.0 + y), (-0.80, 0.0 + y)])
    # dorsal tower
    Q.append([(-0.10, -0.22 + y), (-0.04, -0.40 + y), (0.22, -0.40 + y), (0.30, -0.22 + y)])
    Q.append([(0.06, -0.40 + y), (0.06, -0.54 + y)])
    # running lights along the hull
    for k in range(5):
        Q.append(ngon(-0.34 + k * 0.18, -0.10 + y, 0.02, 6))
    # engine block at the rear, flame flickering out of the back (right)
    Q.append(box(0.70, -0.16 + y, 0.86, 0.14 + y))
    fl = 0.10 + 0.06 * abs(math.sin(ph * 2))
    Q.append([(0.86, -0.08 + y), (0.86 + fl, -0.02 + y), (0.86 + fl * 0.6, 0.0 + y), (0.86 + fl, 0.04 + y), (0.86, 0.08 + y)])
    # drop bay with doors swinging
    Q.append([(-0.30, 0.26 + y), (0.20, 0.26 + y)])
    sw = 0.10 * wave(ph, 1, 0.3)
    Q.append([(-0.30, 0.26 + y), R((-0.30, 0.48 + y), (-0.30, 0.26 + y), 0.5 + sw)])
    Q.append([(0.20, 0.26 + y), R((0.20, 0.48 + y), (0.20, 0.26 + y), -0.5 - sw)])
    # landing struts
    for x in (-0.46, 0.36):
        Q.append([(x, 0.26 + y), (x - 0.04, 0.40 + y), (x + 0.06, 0.40 + y)])
    P += [rot(q, c, pt) for q in Q]
    E.append(R((-0.66, -0.06 + y), c, pt) + (0.03,))
    k = i % 5
    E.append(R((-0.34 + k * 0.18, -0.10 + y), c, pt) + (0.025,))
    if i % 4 < 2:
        E.append(R((0.06, -0.58 + y), c, pt) + (0.025,))
    # the engine flame / muzzle reach past the box at full size
    P = [[(x * 0.92, yy * 0.92) for x, yy in q] for q in P]
    E = [(x * 0.92, yy * 0.92) + tuple(r[2:]) for r in E for x, yy in [r[:2]]]
    return pack(P, E)
