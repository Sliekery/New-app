"""REVENANT (Voidspawn: heals itself every turn and drains you). A dead thing that keeps mending: a gaunt
skeletal figure with a skull, an open ribcage holding a heart of void-light, long clawed hands, and threads of your life drifting into it from the front. Idle, 8
frames: the heart pulses, the drain threads flow in from the left and vanish into the heart, the jaw works,
the claws flex, the body sways."""
import math
from lib import *

ID, N, FPS = "revenant", 8, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.02 * wave(ph)
    sw = 0.03 * wave(ph, 1, 0.5)
    # legs: bone pairs
    for s in (1, -1):
        P.append([(s * 0.12, 0.30 + y), (s * 0.18, 0.58), (s * 0.14, 0.88), (s * 0.26, 0.90)])
    # pelvis and spine
    P.append([(-0.16, 0.30 + y), (0.0, 0.40 + y), (0.16, 0.30 + y), (-0.16, 0.30 + y)])
    P.append([(0.0, 0.30 + y), (sw, -0.46 + y)])
    # ribcage, open, with the heart in it
    for k in range(4):
        yy = -0.36 + k * 0.12 + y
        w = 0.30 - k * 0.04
        P.append([(sw, yy), (-w + sw, yy + 0.04), (-w * 0.8 + sw, yy + 0.10)])
        P.append([(sw, yy), (w + sw, yy + 0.04), (w * 0.8 + sw, yy + 0.10)])
    beat = pos(ph, 2)
    hc = (sw, -0.14 + y)
    r = 0.06 + 0.03 * beat
    P.append([(hc[0], hc[1] + r), (hc[0] - r, hc[1] - r * 0.2), (hc[0] - r * 0.5, hc[1] - r), (hc[0], hc[1] - r * 0.5), (hc[0] + r * 0.5, hc[1] - r), (hc[0] + r, hc[1] - r * 0.2), (hc[0], hc[1] + r)])
    E.append((hc[0], hc[1] - r * 0.2, 0.02 + 0.015 * beat))
    # shoulders and stitched seam across the chest
    P.append([(-0.34 + sw, -0.46 + y), (0.34 + sw, -0.46 + y)])
    # skull, jaw working
    sc = (sw, -0.64 + y)
    P.append([(sc[0] - 0.14, sc[1] + 0.06), (sc[0] - 0.16, sc[1] - 0.10), (sc[0] - 0.08, sc[1] - 0.20), (sc[0] + 0.08, sc[1] - 0.20), (sc[0] + 0.16, sc[1] - 0.10), (sc[0] + 0.14, sc[1] + 0.06)])
    E += [(sc[0] - 0.06, sc[1] - 0.06, 0.03), (sc[0] + 0.06, sc[1] - 0.06, 0.03)]
    jaw = 0.02 + 0.05 * pos(ph, 2, 1.0)
    P.append([(sc[0] - 0.12, sc[1] + 0.06), (sc[0] - 0.08, sc[1] + 0.10 + jaw), (sc[0] + 0.08, sc[1] + 0.10 + jaw), (sc[0] + 0.12, sc[1] + 0.06)])
    for k in range(4):
        x = sc[0] - 0.06 + k * 0.04
        P.append([(x, sc[1] + 0.06), (x, sc[1] + 0.09)])
    # arms with long claws, flexing
    fl = 0.25 * pos(ph, 1, 0.8)
    for s in (1, -1):
        sh = (s * 0.34 + sw, -0.46 + y)
        el = (s * 0.44 + sw, -0.16 + y)
        hd = (s * 0.40 + sw, 0.12 + y)
        P.append([sh, el, hd])
        for k in range(3):
            a = math.pi / 2 + (k - 1) * 0.35 + s * fl
            P.append([hd, (hd[0] + math.cos(a) * 0.10 + s * 0.02, hd[1] + math.sin(a) * 0.10), (hd[0] + math.cos(a) * 0.16 - s * 0.02, hd[1] + math.sin(a) * 0.16 - 0.02)])
    # the drain: threads of life flowing in from the left into the heart
    for k in range(3):
        d = (f + k / 3) % 1.0
        sx = -0.92 + d * (hc[0] + 0.92)
        sy = hc[1] - 0.20 + k * 0.10 + 0.06 * math.sin(d * 7 + k)
        sy = sy + (hc[1] - sy) * d
        L = 0.14 * (1 - d * 0.6)
        P.append([(sx - L, sy + 0.02 * math.sin(d * 9)), (sx, sy)])
        if d < 0.85:
            P.append(ngon(sx, sy, 0.02, 4, math.pi / 4))
    return pack(P, E)
