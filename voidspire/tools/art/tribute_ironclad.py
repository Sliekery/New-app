"""THE DREADCLAD (final boss for a bulwark deck: ramps Strength, pierces Shield). A siege juggernaut: a squat
walking bulwark of banded plate with no head to speak of, only a visor slot burning in its chest-plate; a tower
shield on one arm, a ram-lance couched under the other, exhaust vents on its back. Idle, 12 frames: the vents
breathe smoke, the ember behind the visor swells as its strength builds, the lance tip dips and lifts, the
shield shifts its weight, the stubby legs settle."""
import math
from lib import *

ID, N, FPS = "tribute_ironclad", 12, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.015 * wave(ph)

    # ---- legs: short pistons into broad feet ----
    for s in (1, -1):
        for q in ([(0.14, 0.42), (0.36, 0.42), (0.40, 0.70), (0.12, 0.70), (0.14, 0.42)],
                  [(0.06, 0.70), (0.48, 0.70), (0.52, 0.80), (0.02, 0.80), (0.06, 0.70)],
                  [(0.18, 0.52), (0.34, 0.52)], [(0.18, 0.60), (0.36, 0.60)]):
            P.append(q if s > 0 else mx(q))

    # ---- the hull: a domed slab of plate, banded ----
    hull = [(-0.42, 0.44 + y), (-0.52, 0.10 + y), (-0.50, -0.30 + y), (-0.34, -0.58 + y), (0.0, -0.68 + y),
            (0.34, -0.58 + y), (0.50, -0.30 + y), (0.52, 0.10 + y), (0.42, 0.44 + y), (-0.42, 0.44 + y)]
    P.append(hull)
    for yy, w in ((-0.44, 0.44), (0.18, 0.52), (0.32, 0.48)):
        P.append([(-w, yy + y), (w, yy + y)])
    for k in range(5):
        P.append(ngon(-0.32 + k * 0.16, 0.25 + y, 0.014, 6))
    # the visor: a slot in the chest with a burning ember, swelling as it builds
    vy = -0.20 + y
    P.append([(-0.30, vy - 0.06), (0.30, vy - 0.06), (0.24, vy + 0.06), (-0.24, vy + 0.06), (-0.30, vy - 0.06)])
    for k in range(5):
        x = -0.16 + k * 0.08
        P.append([(x, vy - 0.05), (x, vy + 0.05)])
    E.append((0.0, vy, 0.035 + 0.02 * pos(ph)))
    # a crest ridge over the dome
    P.append([(-0.10, -0.64 + y), (0.0, -0.80 + y), (0.10, -0.64 + y)])

    # ---- vents on the back: three stacks, smoke breathing out ----
    for k, x in enumerate((-0.26, 0.0, 0.26)):
        top = -0.74 + y - (0.04 if k == 1 else 0.0)
        P.append([(x - 0.05, -0.60 + y), (x - 0.05, top), (x + 0.05, top), (x + 0.05, -0.60 + y)])
        for c in range(2):
            d = (f + k * 0.31 + c * 0.5) % 1.0
            r = 0.03 + 0.05 * d
            P.append(ngon(x + 0.04 * math.sin(d * 5 + k), top - 0.05 - d * 0.24, r, 7, k + d))

    # ---- left (viewer's left, towards the player): the tower shield ----
    sh = R((-0.62, 0.0 + y), (-0.52, -0.30 + y), 0.04 * wave(ph, 1, 1.0))
    sx, sy = sh
    shield = [(sx - 0.20, sy - 0.46), (sx + 0.14, sy - 0.46), (sx + 0.18, sy + 0.30), (sx - 0.02, sy + 0.50),
              (sx - 0.22, sy + 0.30), (sx - 0.20, sy - 0.46)]
    P.append(shield)
    P.append([(sx - 0.14, sy - 0.38), (sx + 0.08, sy - 0.38), (sx + 0.12, sy + 0.26), (sx - 0.02, sy + 0.40), (sx - 0.16, sy + 0.26),
              (sx - 0.14, sy - 0.38)])
    P.append([(sx - 0.02, sy - 0.38), (sx - 0.02, sy + 0.40)])
    P.append([(sx - 0.15, sy - 0.04), (sx + 0.10, sy - 0.04)])

    # ---- right arm: the ram-lance, couched, its tip dipping and lifting ----
    tilt = -0.10 + 0.06 * wave(ph, 1, 0.8)
    pv = (0.56, -0.06 + y)
    P.append(bone((0.48, -0.30 + y), pv, 0.07, 0.06))
    P.append(ngon(pv[0], pv[1], 0.06, 6))
    lance = [(0.40, 0.05), (0.98, 0.0), (0.40, -0.05)]
    P.append(rot([(p[0], p[1] + pv[1]) for p in [(0.40, 0.05), (0.80, 0.03), (0.98, 0.0), (0.80, -0.03), (0.40, -0.05), (0.40, 0.05)]],
                 pv, tilt))
    P.append(rot([(0.44, pv[1] - 0.10), (0.52, pv[1] - 0.10), (0.52, pv[1] + 0.10), (0.44, pv[1] + 0.10), (0.44, pv[1] - 0.10)], pv, tilt))
    # drawn lance-right; the player stands to the left, so the lance has to point at them
    P = [mx(q) for q in P]
    E = [(-x, yy, d) for x, yy, d in E]
    return pack(P, E)
