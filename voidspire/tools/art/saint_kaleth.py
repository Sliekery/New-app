"""SAINT KA'LETH (Hierarchy boss: CLEANSE burns off your afflictions; grows stronger every turn). A winged
machine-saint: an armoured figure with a sunburst halo, a reliquary heart in the chest, four blade-feathered
wings and a long burning sword held point-down before it. Idle, 12 frames: the wings beat slowly (upper pair
leading, lower pair following), the halo rays pulse in and out, the sword's flame flickers, the heart glows."""
import math
from lib import *

ID, N, FPS = "saint_kaleth", 12, 8

def wing(root, spread, upper, ph):
    """One wing on the viewer's right: a jointed spar sweeping up and out, blade feathers fanning off it."""
    P = []
    if upper:
        angs = [-1.05 - spread, -0.70 - spread * 0.8, -0.30 - spread * 0.5]
        lens = [0.26, 0.28, 0.26]
    else:
        angs = [-0.05 - spread * 0.6, 0.20 - spread * 0.4, 0.45 - spread * 0.2]
        lens = [0.22, 0.22, 0.18]
    pts = chain(root, angs, lens)
    P.append(pts)
    P.append([(x, y + 0.03) for x, y in pts[:-1]] + [pts[-1]])        # the spar's underside
    count = 7 if upper else 5
    for k in range(count):
        f = (k + 0.6) / count
        seg = min(int(f * 3), 2)
        t = f * 3 - seg
        a, b = pts[seg], pts[seg + 1]
        base = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 0.02)
        ln = (0.42 if upper else 0.30) * (0.55 + f * 0.6)
        ang = angs[seg] + 1.55 - f * 0.55
        tip = (base[0] + math.cos(ang) * ln, base[1] + math.sin(ang) * ln)
        nx, ny = -math.sin(ang) * 0.03, math.cos(ang) * 0.03
        P.append([(base[0] + nx, base[1] + ny), tip, (base[0] - nx, base[1] - ny)])
    return P

def frame(i, n):
    ph = i / n * 2 * math.pi
    hov = 0.02 * wave(ph)
    P, E = [], []
    y = hov

    # ---- wings, behind the body ----
    for upper, lag in ((True, 0.0), (False, 0.7)):
        spread = 0.22 * wave(ph, 1, -lag)
        for q in wing((0.30, -0.40 + y), spread, upper, ph):
            both(P, q)

    # ---- sunburst halo: rays breathing in and out ----
    hc = (0.0, -0.70 + y)
    P.append(ngon(hc[0], hc[1], 0.17, 20))
    for k in range(12):
        a = k / 12 * 2 * math.pi + math.pi / 12
        long = 0.10 + 0.05 * pos(ph, 2, k * 0.8) + (0.05 if k % 2 == 0 else 0)
        P.append([(hc[0] + math.cos(a) * 0.21, hc[1] + math.sin(a) * 0.21),
                  (hc[0] + math.cos(a) * (0.21 + long), hc[1] + math.sin(a) * (0.21 + long))])

    # ---- head: a smooth faceplate, eyes behind a cross-shaped visor ----
    head = [(-0.10, -0.56 + y), (-0.12, -0.72 + y), (-0.06, -0.82 + y), (0.06, -0.82 + y), (0.12, -0.72 + y),
            (0.10, -0.56 + y), (0.0, -0.50 + y), (-0.10, -0.56 + y)]
    P.append(head)
    P.append([(-0.09, -0.70 + y), (0.09, -0.70 + y)])
    P.append([(0.0, -0.78 + y), (0.0, -0.56 + y)])
    E += [(-0.045, -0.675 + y, 0.02), (0.045, -0.675 + y, 0.02)]

    # ---- armoured torso with a reliquary heart ----
    torso = [(-0.14, -0.50 + y), (-0.30, -0.44 + y), (-0.32, -0.20 + y), (-0.20, 0.10 + y), (0.20, 0.10 + y),
             (0.32, -0.20 + y), (0.30, -0.44 + y), (0.14, -0.50 + y)]
    P.append(torso)
    P.append([(-0.30, -0.44 + y), (-0.44, -0.40 + y), (-0.46, -0.26 + y), (-0.32, -0.22 + y)])
    P.append([(0.30, -0.44 + y), (0.44, -0.40 + y), (0.46, -0.26 + y), (0.32, -0.22 + y)])
    rel = [(0.0, -0.40 + y), (0.09, -0.28 + y), (0.0, -0.14 + y), (-0.09, -0.28 + y), (0.0, -0.40 + y)]
    P.append(rel)
    glow = 0.024 + 0.012 * pos(ph, 2)
    E.append((0.0, -0.27 + y, glow))
    for k in range(3):
        P.append([(-0.22 + k * 0.01, -0.06 + k * 0.05 + y), (0.22 - k * 0.01, -0.06 + k * 0.05 + y)])

    # ---- skirt of armoured tassets, hanging to a point ----
    for s in (1, -1):
        P.append([(s * 0.20, 0.10 + y), (s * 0.30, 0.50 + y), (s * 0.12, 0.70 + y)])
        P.append([(s * 0.10, 0.12 + y), (s * 0.16, 0.48 + y)])
    P.append([(-0.12, 0.70 + y), (0.0, 0.86 + y), (0.12, 0.70 + y)])

    # ---- arms reaching down to the hilt; the sword held point-down ----
    for s in (1, -1):
        P.append([(s * 0.44, -0.30 + y), (s * 0.40, -0.06 + y), (s * 0.14, 0.12 + y)])
        P.append([(s * 0.36, -0.30 + y), (s * 0.32, -0.10 + y), (s * 0.10, 0.06 + y)])
    P.append([(-0.18, 0.12 + y), (0.18, 0.12 + y)])                     # crossguard
    P.append(box(-0.04, -0.02 + y, 0.04, 0.12 + y))                    # grip in the hands
    blade = [(-0.04, 0.12 + y), (-0.035, 0.80 + y), (0.0, 0.92 + y), (0.035, 0.80 + y), (0.04, 0.12 + y)]
    # the blade sits in front of the skirt; the flame licks up both edges
    P.append(blade)
    for s in (1, -1):
        fl = []
        for k in range(7):
            f = k / 6
            yy = 0.18 + y + f * 0.66
            fl.append((s * (0.06 + 0.035 * abs(math.sin(ph * 3 + k * 1.7 + (0 if s > 0 else 1.3)))), yy))
        P.append(fl)

    return pack(P, E)
