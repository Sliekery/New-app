"""DOMINUS (Hierarchy: SUMMON calls drone reinforcements; strikes; saps your strength). A commander-priest of
the Hierarchy: a narrow crested helm with one eye inside a ring halo, a high-collared robe, a long command
staff held out toward you topped by an open cradle where a new drone takes shape, and one small drone already
circling it. Idle, 8 frames: the halo turns (its notches travel), the cradle glows and the drone-seed in it
spins, the escort drone orbits the staff head, the robe hem stirs."""
import math
from lib import *

ID, N, FPS = "dominus", 8, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.025 * wave(ph)

    # ---- robe ----
    P.append([(-0.22, -0.32 + y), (-0.36, 0.30 + y), (-0.46 + 0.02 * wave(ph, 1, 0.3), 0.86), (0.46 + 0.02 * wave(ph, 1, 1.3), 0.86), (0.36, 0.30 + y), (0.22, -0.32 + y)])
    P.append([(-0.22, -0.32 + y), (0.0, -0.10 + y), (0.22, -0.32 + y)])
    P.append([(0.0, -0.10 + y), (0.0, 0.86)])
    P.append([(-0.38, 0.40 + y), (0.38, 0.40 + y)])
    P.append(ngon(0.0, 0.14 + y, 0.06, 4, math.pi / 4))
    # high collar
    for s in (1, -1):
        P.append([(s * 0.12, -0.36 + y), (s * 0.30, -0.56 + y), (s * 0.28, -0.32 + y)])

    # ---- helm, eye, halo ----
    hy = -0.36 + y
    P.append([(0.0, hy - 0.44), (0.14, hy - 0.30), (0.14, hy - 0.10), (0.0, hy), (-0.14, hy - 0.10), (-0.14, hy - 0.30), (0.0, hy - 0.44)])
    E.append((-0.02, hy - 0.20, 0.03))
    P.append([(-0.09, hy - 0.20), (0.07, hy - 0.20)])
    hc = (0.0, hy - 0.24)
    P.append(ngon(hc[0], hc[1], 0.28, 20))
    for k in range(4):
        a = k / 4 * 2 * math.pi + ph / 4
        P.append([(hc[0] + math.cos(a) * 0.24, hc[1] + math.sin(a) * 0.24), (hc[0] + math.cos(a) * 0.33, hc[1] + math.sin(a) * 0.33)])

    # ---- right hand at rest ----
    P.append(bone((0.24, -0.26 + y), (0.40, 0.12 + y), 0.045, 0.035))

    # ---- left arm: the command staff toward the player ----
    P.append(bone((-0.24, -0.26 + y), (-0.50, 0.02 + y), 0.045, 0.035))
    P.append([(-0.56, 0.86), (-0.56, -0.50 + y)])
    cc = (-0.56, -0.62 + y)
    for s in (1, -1):
        P.append([(-0.56, -0.50 + y), (-0.56 + s * 0.14, -0.58 + y), (-0.56 + s * 0.12, -0.76 + y)])
    g = pos(ph, 2)
    seed = rot([(cc[0], cc[1] - 0.06), (cc[0] + 0.06, cc[1]), (cc[0], cc[1] + 0.06), (cc[0] - 0.06, cc[1]), (cc[0], cc[1] - 0.06)], cc, ph)
    P.append(seed)
    E.append((cc[0], cc[1], 0.02 + 0.015 * g))

    # ---- the escort drone orbiting the staff head ----
    a = ph
    ox, oy = cc[0] + math.cos(a) * 0.30, cc[1] + math.sin(a) * 0.12
    k = 0.8 + 0.2 * math.sin(a)
    P.append([(ox - 0.08 * k, oy), (ox - 0.04 * k, oy - 0.04 * k), (ox + 0.04 * k, oy - 0.04 * k), (ox + 0.08 * k, oy), (ox + 0.04 * k, oy + 0.04 * k), (ox - 0.04 * k, oy + 0.04 * k), (ox - 0.08 * k, oy)])
    for s in (1, -1):
        P.append([(ox + s * 0.08 * k, oy), (ox + s * 0.14 * k, oy - 0.04 * k)])
    return pack(P, E)
