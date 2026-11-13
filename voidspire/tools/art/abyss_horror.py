"""ABYSS HORROR (Voidspawn elite, THE STARE: end a turn without damaging it and it gains Might). It is all eyes,
and every one of them is on you: a lumpy floating mass whose whole front is lids and pupils, one great eye in
the middle, a fringe of tentacles below. Idle, 12 frames: the eyes blink out of step, every pupil sits toward
the player and drifts a little as it watches, the great eye's iris narrows, the mass breathes, the tentacles
curl."""
import math
from lib import *

ID, N, FPS = "abyss_horror", 12, 8

EYES = [(-0.36, -0.38, 0.08), (-0.06, -0.58, 0.07), (0.28, -0.46, 0.09), (0.50, -0.14, 0.06), (-0.54, -0.04, 0.07),
        (-0.38, 0.30, 0.06), (0.40, 0.26, 0.08), (0.10, 0.44, 0.06), (-0.12, 0.36, 0.045), (0.56, 0.08, 0.04),
        (-0.20, -0.26, 0.04), (0.20, -0.22, 0.045)]

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.03 * wave(ph)
    br = 1.0 + 0.02 * wave(ph, 1, 0.5)

    # ---- tentacles below ----
    for k in range(6):
        bx = -0.40 + k * 0.16
        angs, a = [], math.pi / 2 + (bx * 0.6)
        for j in range(6):
            a += 0.14 * math.sin(ph + k * 1.3 + j * 0.9)
            angs.append(a)
        P.append(chain((bx, 0.52 + y), angs, [0.07] * 6))

    # ---- the mass: lumpy outline ----
    mass = []
    for k in range(33):
        a = k / 32 * 2 * math.pi
        rr = (0.72 + 0.05 * math.sin(a * 5 + 0.7) + 0.03 * math.sin(a * 9 + ph)) * br
        mass.append((math.cos(a) * rr, y + math.sin(a) * rr * 0.86))
    P.append(mass)

    look = (-0.025 + 0.012 * math.sin(ph * 2), 0.006 * math.cos(ph))   # toward the player, on the left
    # ---- small eyes, blinking out of step ----
    for k, (ex, ey, r) in enumerate(EYES):
        ex, ey = ex * br, ey * br + y
        lid = pos(ph, 1, k * 1.9)
        blink = lid > 0.92                                       # each eye shut on its own frame or two
        hgt = r * (0.15 if blink else 0.75)
        P.append([(ex - r * 1.3, ey), (ex, ey - hgt), (ex + r * 1.3, ey), (ex, ey + hgt), (ex - r * 1.3, ey)])
        if not blink:
            E.append((ex + look[0] * r / 0.08, ey + look[1], r * 0.45))

    # ---- the great eye ----
    gy = -0.02 + y
    P.append([(-0.30, gy), (-0.14, gy - 0.16), (0.14, gy - 0.16), (0.30, gy), (0.14, gy + 0.16), (-0.14, gy + 0.16), (-0.30, gy)])
    irx = look[0] * 2.4
    P.append(ngon(irx, gy, 0.11, 14))
    sl = 0.02 + 0.03 * pos(ph, 1, 2.2)
    P.append([(irx, gy - 0.10), (irx + sl, gy), (irx, gy + 0.10), (irx - sl, gy), (irx, gy - 0.10)])
    E.append((irx, gy, 0.03))
    return pack(P, E)
