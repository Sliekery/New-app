"""PLASMA ACOLYTE (Hierarchy: sets you burning, strikes, steels itself). A squat devotee: a dome helm with two
eye lenses and a tall vent stack, a stout robed body, a fuel tank on its back feeding a hose round to its
hands, which cup a plasma orb held out in front of it toward you. Idle, 8 frames: the orb pulses and its inner
flame swirls, sparks lick off it, the vent stack puffs, it sways on its feet."""
import math
from lib import *

ID, N, FPS = "plasma_acolyte", 8, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.02 * wave(ph)

    # ---- the tank on its back (drawn first, behind) ----
    P.append([(0.30, -0.32 + y), (0.56, -0.32 + y), (0.56, 0.22 + y), (0.30, 0.22 + y)])
    P.append(ngon(0.43, -0.32 + y, 0.13, 10, 0, 0.05))
    P.append([(0.30, -0.06 + y), (0.56, -0.06 + y)])

    # ---- body: stout robe ----
    P.append([(-0.32, -0.36 + y), (0.32, -0.36 + y), (0.46, 0.38 + y), (0.30, 0.62), (-0.30, 0.62), (-0.46, 0.38 + y), (-0.32, -0.36 + y)])
    P.append([(-0.40, 0.30 + y), (0.40, 0.30 + y)])
    for k in range(3):
        P.append(ngon(0.0, -0.20 + k * 0.14 + y, 0.014, 6))
    for s in (1, -1):
        P.append([(s * 0.10, 0.62), (s * 0.12, 0.74), (s * 0.24, 0.74)])

    # ---- dome helm with two lenses and the vent stack ----
    hy = -0.36 + y
    dome = [(-0.22, hy)] + [(math.cos(math.pi + k / 10 * math.pi) * 0.22, hy - 0.04 + math.sin(math.pi + k / 10 * math.pi) * 0.22) for k in range(11)] + [(0.22, hy)]
    P.append(dome)
    P.append([(-0.18, hy - 0.08), (0.18, hy - 0.08)])
    E += [(-0.08, hy - 0.14, 0.03), (0.06, hy - 0.14, 0.03)]
    P.append([(-0.06, hy - 0.26), (-0.06, hy - 0.42), (0.06, hy - 0.42), (0.06, hy - 0.26)])
    d = f % 1.0
    P.append(ngon(0.02 * math.sin(d * 6), hy - 0.46 - d * 0.12, 0.025 + 0.03 * d, 7, d * 3))

    # ---- arms reaching forward, hands cupping the orb ----
    oc = (-0.64, 0.0 + y)
    r0 = 0.17
    for s, sh in ((1, (-0.30, -0.26 + y)), (-1, (-0.36, 0.16 + y))):
        hand = (oc[0] + 0.08, oc[1] - s * (r0 + 0.02))
        P.append(bone(sh, hand, 0.05, 0.04))
        P.append([(hand[0], hand[1]), (hand[0] - 0.12, hand[1] + s * 0.03)])       # fingers curled round the orb
    # the hose from the tank to the hands
    P.append([(0.43, 0.22 + y), (0.36, 0.44 + y), (0.0, 0.46 + y), (-0.30, 0.30 + y), (-0.46, 0.20 + y)])

    # ---- the plasma orb ----
    r = r0 - 0.02 + 0.03 * pos(ph, 2)
    P.append(ngon(oc[0], oc[1], r, 14))
    sw = []
    for k in range(10):
        t = k / 9
        a = ph * 1.5 + t * 4.0
        sw.append((oc[0] + math.cos(a) * r * 0.75 * t, oc[1] + math.sin(a) * r * 0.75 * t))
    P.append(sw)
    E.append((oc[0], oc[1], 0.035 + 0.01 * pos(ph, 2)))
    for k in range(3):
        a = -math.pi / 2 - 0.6 + k * 0.6 + 0.3 * math.sin(ph * 2 + k)
        l = 0.05 + 0.05 * abs(math.sin(ph * 2 + k * 1.3))
        P.append([(oc[0] + math.cos(a) * r, oc[1] + math.sin(a) * r), (oc[0] + math.cos(a) * (r + l), oc[1] + math.sin(a) * (r + l))])
    return pack(P, E)
