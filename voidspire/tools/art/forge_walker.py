"""FORGE WALKER (Rust, CHARGE: builds to an 11-damage blow). A stocky bipedal mech: a box hull with a visor slit,
plate seams, twin smokestacks, a furnace core in its chest that glows as the charge builds, claw arms and
piston legs. Idle: the pistons compress and extend, smoke puffs from the stacks, the core swells, the claws
open and shut."""
import math
from lib import *

ID, N, FPS = "forge_walker", 8, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    sq = 0.04 * pos(ph)
    y = sq
    # piston legs
    for s in (1, -1):
        P.append(box(s * 0.14 - 0.08, 0.36 + y, s * 0.14 + 0.08, 0.58))
        P.append([(s * 0.14, 0.58), (s * 0.14, 0.80)])
        P.append(box(s * 0.14 - 0.05, 0.58, s * 0.14 + 0.05, 0.78 - sq))
        P.append([(s * 0.14 - 0.16, 0.88), (s * 0.14 + 0.16, 0.88), (s * 0.14 + 0.12, 0.80), (s * 0.14 - 0.12, 0.80), (s * 0.14 - 0.16, 0.88)])
    # hull
    P.append([(-0.40, 0.36 + y), (-0.44, -0.20 + y), (-0.30, -0.42 + y), (0.30, -0.42 + y), (0.44, -0.20 + y), (0.40, 0.36 + y), (-0.40, 0.36 + y)])
    P.append([(-0.42, 0.10 + y), (0.42, 0.10 + y)])
    P.append([(-0.26, -0.30 + y), (0.26, -0.30 + y), (0.22, -0.20 + y), (-0.22, -0.20 + y), (-0.26, -0.30 + y)])
    E.append((-0.10 + 0.08 * math.sin(ph), -0.25 + y, 0.03))
    # furnace core
    g = 0.07 + 0.03 * pos(ph, 1, 1.0)
    P.append(box(-0.14, -0.10 + y, 0.14, 0.06 + y))
    P.append(ngon(0.0, -0.02 + y, g, 8))
    E.append((0.0, -0.02 + y, 0.02 + 0.015 * pos(ph, 1, 1.0)))
    for k in range(4):
        P.append(ngon(-0.30 + k * 0.20, 0.22 + y, 0.015, 6))
    # smokestacks
    for k, s in enumerate((1, -1)):
        x = s * 0.22
        P.append([(x - 0.05, -0.42 + y), (x - 0.05, -0.66 + y), (x + 0.05, -0.66 + y), (x + 0.05, -0.42 + y)])
        d = (f + k * 0.5) % 1.0
        P.append(ngon(x + 0.03 * math.sin(d * 6), -0.72 + y - d * 0.20, 0.03 + 0.04 * d, 7, d * 3))
    # claw arms
    for s, off in ((-1, 0.0), (1, math.pi)):
        sh = (s * 0.44, -0.16 + y)
        el = (s * 0.60, 0.06 + y)
        wr = (s * 0.62, 0.30 + y)
        P.append(bone(sh, el, 0.05, 0.04)); P.append(bone(el, wr, 0.04, 0.035))
        P.append(ngon(el[0], el[1], 0.035, 6))
        op = 0.25 + 0.25 * pos(ph, 1, off)
        for side in (1, -1):
            a = math.pi / 2 + side * op
            j = (wr[0] + math.cos(a) * 0.10, wr[1] + math.sin(a) * 0.10)
            P.append([wr, j, (j[0] - side * 0.03, j[1] + 0.05)])
    return pack(P, E)
