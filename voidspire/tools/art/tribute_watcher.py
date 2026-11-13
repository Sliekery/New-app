"""THE ASCENDANT (final boss for an affliction deck: heals, regenerates, cleanses). A lantern seraph: no face,
only a tall flame burning inside a caged lantern for a head; a narrow body of long robes tapering to a point
that never touches the ground; three pairs of wings made of single long feathers of light; two ribbons of
mending light that wind round it and knit. Idle, 12 frames: the flame flickers and leans, the wing pairs breathe
open and shut out of step, the ribbons wind, motes of light rise off it, the whole figure hovers."""
import math
from lib import *

ID, N, FPS = "tribute_watcher", 12, 8

def feather(base, a, L, w):
    tip = (base[0] + math.cos(a) * L, base[1] + math.sin(a) * L)
    nx, ny = -math.sin(a) * w, math.cos(a) * w
    mid = (base[0] + math.cos(a) * L * 0.55, base[1] + math.sin(a) * L * 0.55)
    return [[base, (mid[0] + nx, mid[1] + ny), tip, (mid[0] - nx, mid[1] - ny), base], [base, (base[0] + math.cos(a) * L * 0.85, base[1] + math.sin(a) * L * 0.85)]]

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.04 * wave(ph)

    # ---- three pairs of wings, each a fan of long feathers, breathing out of step ----
    for k, (by, a0, L, cnt) in enumerate(((-0.42, -0.55, 0.62, 3), (-0.30, -0.05, 0.66, 3), (-0.18, 0.45, 0.50, 2))):
        spread = 0.10 * wave(ph, 1, -k * 1.0)
        for s in (1, -1):
            base = (s * 0.14, by + y)
            for j in range(cnt):
                a = a0 + spread + (j - (cnt - 1) / 2) * 0.22
                aa = a if s > 0 else math.pi - a
                for q in feather(base, aa, L - j * 0.06, 0.035):
                    P.append(q)

    # ---- the robe: narrow, long, tapering to a point that hovers ----
    robe = [(-0.14, -0.46 + y), (-0.18, -0.10 + y), (-0.20, 0.30 + y), (-0.10, 0.62 + y), (0.0, 0.80 + y),
            (0.10, 0.62 + y), (0.20, 0.30 + y), (0.18, -0.10 + y), (0.14, -0.46 + y)]
    P.append(robe)
    P.append([(0.0, -0.40 + y), (0.0, 0.70 + y)])
    for yy, w in ((-0.04, 0.17), (0.30, 0.19)):
        P.append([(-w, yy + y), (w, yy + y)])
    # a mending sigil on the breast: a ring with a cross that turns
    P.append(ngon(0.0, -0.20 + y, 0.07, 12))
    P.append(rot([(0.0, -0.26 + y), (0.0, -0.14 + y)], (0.0, -0.20 + y), ph / 2))
    P.append(rot([(-0.06, -0.20 + y), (0.06, -0.20 + y)], (0.0, -0.20 + y), ph / 2))

    # ---- the lantern head: a cage with a flame ----
    lc = (0.0, -0.66 + y)
    cage = [(-0.12, -0.50 + y), (-0.15, -0.66 + y), (-0.10, -0.84 + y), (0.10, -0.84 + y), (0.15, -0.66 + y), (0.12, -0.50 + y), (-0.12, -0.50 + y)]
    P.append(cage)
    for x in (-0.05, 0.05):
        P.append([(x, -0.50 + y), (x * 1.3, -0.66 + y), (x, -0.84 + y)])
    P.append([(-0.10, -0.84 + y), (0.0, -0.94 + y), (0.10, -0.84 + y)])
    P.append(ngon(0.0, -0.98 + y, 0.04, 8))
    lean = 0.025 * math.sin(ph * 2)
    h = 0.20 + 0.04 * math.sin(ph * 3)
    P.append([(-0.05, -0.54 + y), (-0.06, -0.62 + y), (lean, -0.54 + y - h), (0.06, -0.62 + y), (0.05, -0.54 + y)])
    E.append((lean * 0.4, -0.60 + y, 0.03))

    # ---- two ribbons of light winding round the robe ----
    for r, off in ((0, 0.0), (1, math.pi)):
        # only the arcs passing in front of the robe are drawn, which is what makes it read as winding ROUND it
        run = []
        for k in range(41):
            t = k / 40
            yy = -0.36 + t * 0.96
            a = t * 2 * math.pi + ph + off
            w = 0.30 - 0.12 * t
            if math.sin(a) > -0.15:
                run.append((math.cos(a) * w, yy + y + math.sin(a) * 0.05))
            elif run:
                if len(run) > 1:
                    P.append(run)
                run = []
        if len(run) > 1:
            P.append(run)

    # ---- motes rising off it ----
    for k in range(5):
        d = (f + k / 5) % 1.0
        x = (-0.40 + k * 0.20) + 0.04 * math.sin(d * 6 + k)
        yy = 0.40 + y - d * 1.0
        r = 0.02 * (1 - d) + 0.006
        P.append([(x, yy - r * 1.6), (x + r, yy), (x, yy + r * 1.6), (x - r, yy), (x, yy - r * 1.6)])
    return pack(P, E)
