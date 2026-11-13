"""SALVAGE CRAWLER (Rust elite, THE TAKING: every hit it lands takes credits with it). A scavenger on six
jointed legs: a low armoured carapace, two pincer arms reaching forward, a sensor head with twin lamps, and on
its back an open hopper heaped with the credits it has taken, a coin always tumbling in. Idle, 12 frames: the
legs shift their weight in a ripple, the pincers snip, a coin arcs up off the pincer into the hopper, the lamps
pan."""
import math
from lib import *

ID, N, FPS = "salvage_crawler", 12, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.015 * wave(ph, 2)

    # ---- six legs, rippling ----
    for s in (1, -1):
        for k in range(3):
            # fanned out: front pair high and narrow, back pair low and wide, so the six never bunch
            hip = (s * (0.36 + k * 0.06), 0.16 + k * 0.08 + y)
            lift = 0.05 * max(0.0, math.sin(ph + k * 2.1 + (math.pi if s < 0 else 0)))
            knee = (s * (0.62 + k * 0.10), -0.18 + k * 0.10 + y - lift)
            foot = (s * (0.52 + k * 0.20), 0.62 + k * 0.08 - lift * 0.5)
            P.append([hip, knee, foot])
            P.append([(foot[0] - s * 0.04, foot[1]), (foot[0] + s * 0.03, foot[1])])
            P.append(ngon(knee[0], knee[1], 0.022, 6))

    # ---- the carapace ----
    shell = [(-0.56, 0.30 + y), (-0.50, 0.04 + y), (-0.30, -0.10 + y), (0.30, -0.10 + y), (0.50, 0.04 + y), (0.56, 0.30 + y),
             (0.40, 0.46 + y), (-0.40, 0.46 + y), (-0.56, 0.30 + y)]
    P.append(shell)
    for x in (-0.20, 0.0, 0.20):
        P.append([(x, -0.10 + y), (x * 1.3, 0.46 + y)])
    P.append([(-0.50, 0.22 + y), (0.50, 0.22 + y)])

    # ---- the hopper on its back, heaped with credits ----
    P.append([(-0.30, -0.10 + y), (-0.38, -0.46 + y), (0.38, -0.46 + y), (0.30, -0.10 + y)])
    P.append([(-0.36, -0.36 + y), (0.36, -0.36 + y)])
    for k, (cx, cy) in enumerate([(-0.20, -0.50), (-0.06, -0.53), (0.08, -0.51), (0.22, -0.49), (-0.13, -0.58), (0.02, -0.61), (0.15, -0.57)]):
        P.append(ngon(cx, cy + y, 0.055, 8, 0, 0.025))
    # a coin arcing from the pincer into the hopper
    t = f
    sx, sy = -0.78, 0.02 + y
    ex, ey = 0.0, -0.66 + y
    cx = sx + (ex - sx) * t
    cy = sy + (ey - sy) * t - 0.45 * math.sin(math.pi * t)
    spin = abs(math.cos(t * 6 * math.pi))
    P.append(ngon(cx, cy, 0.045, 8, 0, 0.045 * spin + 0.008))

    # ---- the head: low at the front, two lamps panning ----
    P.append([(-0.18, 0.46 + y), (-0.14, 0.58 + y), (0.14, 0.58 + y), (0.18, 0.46 + y)])
    pan = 0.04 * math.sin(ph)
    E += [(-0.08 + pan, 0.52 + y, 0.025), (0.08 + pan, 0.52 + y, 0.025)]

    # ---- pincers, reaching forward and snipping ----
    for s, off in ((-1, 0.0), (1, math.pi)):
        sh = (s * 0.48, 0.10 + y)
        el = (s * 0.72, -0.16 + y)
        wr = (s * 0.84, 0.04 + y)
        P.append(bone(sh, el, 0.04, 0.035))
        P.append(bone(el, wr, 0.035, 0.03))
        snip = 0.15 + 0.25 * pos(ph * 2, 1, off)
        for side in (1, -1):
            a = math.pi / 2 + (-0.4 if s < 0 else 0.4) + side * snip
            j = (wr[0] + math.cos(a) * 0.12, wr[1] + math.sin(a) * 0.12)
            P.append([wr, j, (j[0] - side * 0.03, j[1] + 0.04)])
    return pack(P, E)
