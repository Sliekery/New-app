"""CHOIR ADEPT (Hierarchy elite, THE HYMN: every Shield you gain heals every enemy). A cantor: a robed figure
with a round, open-mouthed mask lifted to sing, a high collar like a bell, a tuning-fork staff, and the hymn
itself as rings of sound that roll out from the mask and wash over its allies. Idle, 12 frames: the sound rings
expand and fade on a loop, the mouth opens and closes with them, the fork's tines shiver, the robe sways."""
import math
from lib import *

ID, N, FPS = "choir_adept", 12, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.015 * wave(ph)
    sing = pos(ph, 2)

    # ---- the robe: a bell shape, swaying ----
    sw = 0.03 * wave(ph, 1, 0.5)
    robe = [(-0.20, -0.30 + y), (-0.34, 0.20 + y), (-0.50 + sw, 0.86), (0.50 + sw, 0.86), (0.34, 0.20 + y), (0.20, -0.30 + y)]
    P.append(robe)
    for k in range(4):
        x = -0.24 + k * 0.16
        P.append([(x * 0.6, -0.10 + y), (x + sw, 0.86)])
    P.append([(-0.34, 0.20 + y), (0.34, 0.20 + y)])

    # ---- the bell collar ----
    P.append([(-0.20, -0.30 + y), (-0.30, -0.38 + y), (-0.20, -0.46 + y), (0.20, -0.46 + y), (0.30, -0.38 + y), (0.20, -0.30 + y), (-0.20, -0.30 + y)])

    # ---- the mask: a round face lifted to sing ----
    mc = (0.0, -0.64 + y)
    P.append(ngon(mc[0], mc[1], 0.17, 16, 0, 0.19))
    E += [(-0.07, mc[1] - 0.06, 0.02), (0.07, mc[1] - 0.06, 0.02)]
    P.append([(-0.10, mc[1] - 0.11), (-0.03, mc[1] - 0.09)])
    P.append([(0.10, mc[1] - 0.11), (0.03, mc[1] - 0.09)])
    mo = 0.02 + 0.05 * sing
    P.append(ngon(mc[0], mc[1] + 0.06, 0.05, 10, 0, mo))
    # a tonsure ring above
    P.append(ngon(mc[0], mc[1] - 0.24, 0.10, 12, 0, 0.025))

    # ---- arms: one raised to the side conducting, one holding the fork ----
    shl = (-0.22, -0.36 + y)
    hand = R((-0.56, -0.48 + y), shl, -0.10 * sing)
    P.append(bone(shl, hand, 0.05, 0.035))
    for k in range(3):
        a = math.pi + 0.5 + (k - 1) * 0.35 - 0.10 * sing
        P.append([hand, (hand[0] + math.cos(a) * 0.07, hand[1] + math.sin(a) * 0.07)])
    shr = (0.22, -0.36 + y)
    hr = (0.44, -0.08 + y)
    P.append(bone(shr, hr, 0.05, 0.035))
    P.append([(0.46, 0.86), (0.46, -0.40 + y)])
    jit = 0.008 * math.sin(ph * 6)
    for s in (1, -1):
        P.append([(0.46, -0.40 + y), (0.46 + s * 0.06 + s * jit, -0.46 + y), (0.46 + s * 0.06 + s * jit, -0.70 + y)])

    # ---- the hymn: sound rings rolling out from the mouth ----
    for k in range(3):
        d = (f + k / 3) % 1.0
        r = 0.22 + d * 0.62
        fade = 1 - d
        if fade < 0.12:
            continue
        span = 0.5 + 0.4 * fade
        for s in (1, -1):
            a0 = (0 if s > 0 else math.pi) - span / 2
            pts = [(mc[0] + math.cos(a0 + j / 8 * span) * r, mc[1] + 0.06 + math.sin(a0 + j / 8 * span) * r * 0.8) for j in range(9)]
            P.append(pts)
    return pack(P, E)
