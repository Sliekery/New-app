"""SIEGE WALKER (Rust: a massive blow every other turn, softened by damage on its wind-up). A striding
war-walker seen side-on, FACING THE PLAYER (left): a rounded armoured hull with a visor at the front, twin
antennae, a long siege cannon slung under the hull pointing left with a charge glowing at its breech, four
angular legs. Idle: the legs shift their weight in pairs, the hull rocks, the cannon settles and the charge
in its breech pulses brighter, the antennae bob."""
import math
from lib import *

ID, N, FPS = "siege_walker", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.025 * wave(ph, 2)
    rk = 0.03 * wave(ph)
    c = (0, -0.20 + y)
    Q = []
    # hull: rounded, visor at the front (left)
    hull = []
    for k in range(13):
        a = math.pi + k / 12 * math.pi
        hull.append((0.10 + math.cos(a) * 0.62, -0.10 + y + math.sin(a) * 0.32))
    hull += [(0.72, 0.04 + y), (-0.52, 0.04 + y)]
    hull.append(hull[0])
    Q.append(hull)
    Q.append([(-0.48, -0.20 + y), (-0.30, -0.28 + y), (-0.18, -0.20 + y), (-0.30, -0.14 + y), (-0.48, -0.20 + y)])
    Q.append([(-0.10, -0.38 + y), (0.40, -0.36 + y)])
    for k in range(4):
        Q.append(ngon(0.06 + k * 0.14, -0.04 + y, 0.015, 6))
    # antennae
    for k, x in enumerate((0.26, 0.40)):
        b = 0.04 * wave(ph, 1, k)
        Q.append([(x, -0.40 + y), (x + 0.06 + b, -0.64 + y)])
    # cannon slung under the hull, pointing left
    Q.append(box(-0.92, 0.10 + y, -0.10, 0.20 + y))
    Q.append(box(-0.96, 0.08 + y, -0.88, 0.22 + y))
    Q.append(box(-0.10, 0.04 + y, 0.20, 0.28 + y))
    for k in range(3):
        Q.append([(-0.70 + k * 0.16, 0.10 + y), (-0.70 + k * 0.16, 0.20 + y)])
    P += [rot(q, c, rk) for q in Q]
    E.append(R((-0.30, -0.21 + y), c, rk) + (0.035,))
    E.append(R((0.05, 0.16 + y), c, rk) + (0.02 + 0.025 * pos(ph),))
    # four angular legs, shifting in pairs
    for k, (hx, fx) in enumerate(((-0.34, -0.62), (-0.14, -0.30), (0.30, 0.30), (0.52, 0.66))):
        lift = 0.05 * max(0.0, math.sin(ph + (0 if k % 2 == 0 else math.pi)))
        hip = (hx, 0.04 + y)
        knee = (hx + (fx - hx) * 0.5 + (-0.10 if fx < hx else 0.10), 0.36 + y - lift)
        foot = (fx, 0.86 - lift)
        P.append([hip, knee, foot])
        P.append([(hip[0] + 0.05, hip[1]), (knee[0] + 0.05, knee[1]), (foot[0] + 0.04, foot[1])])
        P.append([(foot[0] - 0.08, foot[1]), (foot[0] + 0.12, foot[1])])
    # the engine flame / muzzle reach past the box at full size
    P = [[(x * 0.92, yy * 0.92) for x, yy in q] for q in P]
    E = [(x * 0.92, yy * 0.92) + tuple(r[2:]) for r in E for x, yy in [r[:2]]]
    return pack(P, E)
