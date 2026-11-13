"""HUSK STALKER (Voidspawn: a leeching striker). A hollowed-out body the void is wearing: a hunched figure with
its head lolling on a broken neck, exposed ribs, a swollen growth bulging off one shoulder, and its forearm
grown into a long barbed whip reaching toward you; spindly legs. Idle, 8 frames: the whip arm uncoils and
curls, the head lolls side to side, the growth pulses, the ribs heave."""
import math
from lib import *

ID, N, FPS = "husk_stalker", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.02 * wave(ph, 2)
    heave = 0.03 * wave(ph, 2)
    # legs, spindly, knees bent
    for s in (1, -1):
        P.append([(s * 0.12, 0.30 + y), (s * 0.22, 0.56), (s * 0.14, 0.86), (s * 0.24, 0.90)])
    # torso: hunched, leaning forward (left)
    torso = [(-0.24, -0.30 + y), (0.26, -0.40 + y), (0.24, 0.10 + y), (0.14, 0.32 + y), (-0.14, 0.32 + y), (-0.22, 0.06 + y), (-0.24, -0.30 + y)]
    P.append(torso)
    P.append([(0.0, -0.34 + y), (0.0, 0.30 + y)])
    for k in range(4):                                    # ribs, heaving
        yy = -0.22 + k * 0.10 + y
        w = 0.20 - k * 0.02 + heave
        P.append([(0.0, yy), (-w, yy + 0.05)])
        P.append([(0.0, yy), (w, yy + 0.05)])
    # the growth on the right shoulder, pulsing
    g = 0.14 + 0.03 * pos(ph)
    P.append(ngon(0.30, -0.42 + y, g, 10, 0, g * 0.85))
    P.append(ngon(0.40, -0.52 + y, g * 0.5, 8))
    E.append((0.32, -0.44 + y, 0.02))
    # head lolling forward on a broken neck
    loll = 0.22 * wave(ph, 1, 0.4)
    neck = (-0.14, -0.34 + y)
    hc = (neck[0] - 0.16 + math.sin(loll) * 0.08, neck[1] - 0.14 + math.cos(loll) * 0.04)
    P.append([neck, (neck[0] - 0.06, neck[1] - 0.10), hc])
    P.append(rot([(hc[0] - 0.12, hc[1] - 0.10), (hc[0] + 0.08, hc[1] - 0.12), (hc[0] + 0.10, hc[1] + 0.06), (hc[0] - 0.02, hc[1] + 0.14), (hc[0] - 0.14, hc[1] + 0.04), (hc[0] - 0.12, hc[1] - 0.10)], hc, loll))
    E.append(R((hc[0] - 0.05, hc[1] - 0.03), hc, loll) + (0.03,))
    P.append(rot([(hc[0] - 0.10, hc[1] + 0.06), (hc[0] - 0.02, hc[1] + 0.08)], hc, loll))
    # right arm hanging limp
    P.append([(0.24, -0.30 + y), (0.36, 0.0 + y), (0.32, 0.22 + y)])
    # left arm: the barbed whip, uncoiling toward the player
    curl = 0.5 + 0.5 * math.sin(ph)
    angs, a = [], math.pi - 0.3
    for k in range(7):
        a += (0.05 + 0.30 * curl) * (k / 6)
        angs.append(a)
    pts = chain((-0.22, -0.24 + y), angs, [0.11] * 7)
    P.append(pts)
    for k in range(2, 7, 2):
        p, q = pts[k], pts[k + 1] if k + 1 < len(pts) else pts[k]
        ang = math.atan2(q[1] - p[1], q[0] - p[0]) + math.pi / 2
        P.append([p, (p[0] + math.cos(ang) * 0.06 - 0.03, p[1] + math.sin(ang) * 0.06)])
    return pack(P, E)
