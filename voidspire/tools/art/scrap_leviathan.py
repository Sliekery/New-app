"""THE SCRAP LEVIATHAN (Rust boss: CHARGE winds up a 34-damage hit over two turns; OVERLOAD detonates when it
dies). A scrap-built crusher beast coming at you head-on: a huge maw of grinding jaw plates under a riveted
brow of sensor eyes, a reactor core in its chest behind hazard stripes (the overload), smokestacks on its back,
on two banks of tank treads. Idle, 12 frames: the jaws grind open and shut, the treads roll, the reactor
pulses, the stacks belch in turn, the brow's eyes flicker in a scan."""
import math
from lib import *

ID, N, FPS = "scrap_leviathan", 12, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    rumble = 0.008 * wave(ph, 4)

    # ---- treads: two banks, links rolling toward you ----
    for s in (1, -1):
        side = []
        side.append([(0.36, 0.50), (0.92, 0.50), (0.98, 0.62), (0.92, 0.84), (0.36, 0.84), (0.30, 0.62), (0.36, 0.50)])
        for k in range(6):
            x = 0.38 + ((k + i / n) % 6) / 6 * 0.56
            side.append([(x, 0.52), (x, 0.82)])
        for cx in (0.46, 0.64, 0.82):
            side.append(ngon(cx, 0.67, 0.06, 8, ph))
        for q in side:
            P.append(q if s > 0 else mx(q))
    P.append([(-0.30, 0.62), (0.30, 0.62)])                       # the axle housing between them

    # ---- hull: a wide plated body ----
    y = rumble
    hull = [(-0.34, 0.54 + y), (-0.80, 0.50 + y), (-0.94, 0.20 + y), (-0.88, -0.24 + y), (-0.62, -0.50 + y),
            (0.62, -0.50 + y), (0.88, -0.24 + y), (0.94, 0.20 + y), (0.80, 0.50 + y), (0.34, 0.54 + y)]
    P.append(hull)
    for s in (1, -1):                                             # flank armour plates with rivets
        for k in range(3):
            yy = -0.30 + k * 0.22 + y
            P.append([(s * 0.66, yy), (s * 0.88, yy + 0.04), (s * 0.86, yy + 0.18), (s * 0.64, yy + 0.16), (s * 0.66, yy)])
            P.append(ngon(s * 0.76, yy + 0.10, 0.015, 6))

    # ---- smokestacks on the back, belching in turn ----
    for s, off in ((1, 0.0), (-1, math.pi)):
        st = [(0.48, -0.50 + y), (0.50, -0.80 + y), (0.62, -0.80 + y), (0.64, -0.50 + y)]
        P.append(st if s > 0 else mx(st))
        P.append([(s * 0.47, -0.80 + y), (s * 0.65, -0.80 + y)])
        puff = pos(ph, 1, off)
        if puff > 0.25:
            r = 0.04 + 0.05 * puff
            P.append(ngon(s * 0.56, -0.88 + y - puff * 0.10, r, 8, ph, r * 0.7))

    # ---- brow: a riveted visor of sensor eyes, scanning ----
    brow = [(-0.60, -0.50 + y), (-0.50, -0.30 + y), (0.50, -0.30 + y), (0.60, -0.50 + y)]
    P.append(brow)
    for k in range(5):
        x = -0.36 + k * 0.18
        P.append(box(x - 0.05, -0.46 + y, x + 0.05, -0.36 + y))
        lit = abs(math.sin(ph - k * 0.9))
        if lit > 0.35:
            E.append((x, -0.41 + y, 0.02 + 0.012 * lit))

    # ---- the maw: upper and lower crusher plates, grinding ----
    gape = 0.05 + 0.07 * pos(ph, 2)
    upper_y, lower_y = -0.22 + y, -0.06 + y + gape
    upper = [(-0.52, -0.28 + y), (-0.56, upper_y), (0.56, upper_y), (0.52, -0.28 + y)]
    lower = [(-0.56, lower_y), (-0.48, lower_y + 0.20), (0.48, lower_y + 0.20), (0.56, lower_y)]
    P += [upper, lower]
    for k in range(9):                                             # teeth, interlocking
        x = -0.48 + k * 0.12
        P.append([(x - 0.04, upper_y), (x, upper_y + 0.09), (x + 0.04, upper_y)])
        x2 = x + 0.06
        if x2 < 0.5:
            P.append([(x2 - 0.04, lower_y), (x2, lower_y - 0.08), (x2 + 0.04, lower_y)])
    for s in (1, -1):                                              # hydraulic rams working the jaw
        P.append([(s * 0.62, -0.26 + y), (s * 0.60, lower_y + 0.10)])
        P.append([(s * 0.68, -0.26 + y), (s * 0.66, lower_y + 0.10)])

    # ---- reactor core behind hazard stripes: what goes off when it dies ----
    cy = 0.32 + y
    P.append(box(-0.26, cy - 0.12, 0.26, cy + 0.14))
    for k in range(6):
        x = -0.24 + k * 0.09
        P.append([(x, cy + 0.14), (x + 0.05, cy + 0.06)])
    pulse = pos(ph, 2)
    P.append(ngon(0.0, cy - 0.01, 0.07 + 0.02 * pulse, 6, ph / 6))
    P.append(ngon(0.0, cy - 0.01, 0.04, 6, -ph / 6))
    E.append((0.0, cy - 0.01, 0.022 + 0.014 * pulse))

    return pack(P, E)
