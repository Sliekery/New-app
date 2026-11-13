"""DRONE SKIRMISHER (Hierarchy, plated: a small fast attacker that snipes, double-taps or shields). A hover pod:
a hexagonal armoured hull with one central eye, two swept fins either side, an antenna, a short cannon slung
under the hull pointing at you, and a grav-thruster ring under it. Idle, 8 frames: it bobs on its thruster, the
fins tilt in a slow flap, the thruster rings pulse downward, the cannon twitches as it tracks."""
import math
from lib import *

ID, N, FPS = "drone_skirmisher", 8, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.06 * wave(ph)

    # ---- hull ----
    P.append([(-0.30, 0.22 + y), (0.30, 0.22 + y), (0.42, -0.04 + y), (0.30, -0.30 + y), (-0.30, -0.30 + y), (-0.42, -0.04 + y), (-0.30, 0.22 + y)])
    P.append([(-0.22, 0.12 + y), (0.22, 0.12 + y), (0.30, -0.04 + y), (0.22, -0.20 + y), (-0.22, -0.20 + y), (-0.30, -0.04 + y), (-0.22, 0.12 + y)])
    P.append(ngon(0.0, -0.04 + y, 0.10, 10))
    E.append((-0.02, -0.04 + y, 0.045))
    # antenna
    P.append([(0.10, -0.30 + y), (0.14, -0.56 + y)])
    P.append(ngon(0.14, -0.60 + y, 0.035, 6))

    # ---- swept fins, flapping ----
    for s in (1, -1):
        a = 0.14 * wave(ph, 2, 0.0)
        root = (s * 0.40, -0.10 + y)
        fin = [(s * 0.40, -0.18), (s * 0.92, -0.42), (s * 0.84, -0.20), (s * 0.94, 0.02), (s * 0.40, 0.04)]
        fin = [R((p[0], p[1] + y), root, s * a) for p in fin]
        P.append(fin)
        P.append([R((s * 0.46, -0.08 + y), root, s * a), R((s * 0.82, -0.24 + y), root, s * a)])

    # ---- underslung cannon, toward the player ----
    tw = 0.03 * math.sin(ph * 3)
    piv = (-0.06, 0.24 + y)
    P.append(rot([(0.10, 0.22 + y), (0.10, 0.34 + y), (-0.10, 0.34 + y), (-0.10, 0.22 + y)], piv, tw))
    P.append(rot([(-0.10, 0.26 + y), (-0.54, 0.26 + y), (-0.54, 0.32 + y), (-0.10, 0.32 + y)], piv, tw))
    P.append(rot([(-0.54, 0.24 + y), (-0.60, 0.24 + y), (-0.60, 0.34 + y), (-0.54, 0.34 + y)], piv, tw))

    # ---- thruster ring and pulses ----
    P.append(ngon(0.20, 0.36 + y, 0.10, 10, 0, 0.03))
    for k in range(2):
        d = (f * 2 + k * 0.5) % 1.0
        P.append(ngon(0.20, 0.42 + y + d * 0.34, 0.10 + d * 0.08, 10, 0, 0.025 + d * 0.01))
    return pack(P, E)
