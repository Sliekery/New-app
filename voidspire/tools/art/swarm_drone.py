"""SWARM DRONE (Rust, tiny; it overloads). A little box drone: one sensor eye, a rotor spinning on a stub mast,
stabiliser fins, a stinger gun under its chin pointed at you. Idle: the rotor blades spin, the drone bobs and
tilts, the eye flickers."""
import math
from lib import *

ID, N, FPS = "swarm_drone", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.06 * wave(ph)
    tl = 0.06 * wave(ph, 1, 1.0)
    c = (0, y)
    body = []
    body.append(box(-0.34, -0.20 + y, 0.34, 0.24 + y))
    body.append([(-0.34, 0.02 + y), (0.34, 0.02 + y)])
    body.append(ngon(-0.12, -0.06 + y, 0.10, 8))
    body.append([(0.0, -0.20 + y), (0.0, -0.46 + y)])
    # rotor: two blades seen nearly edge-on, spinning
    for k in range(2):
        a = ph * 2 + k * math.pi
        x = math.cos(a) * 0.50
        body.append([(0.0, -0.46 + y), (x, -0.46 + y + math.sin(a) * 0.05)])
    body.append(ngon(0.0, -0.46 + y, 0.50, 16, 0, 0.06))
    for s in (1, -1):
        body.append([(s * 0.34, -0.12 + y), (s * 0.54, -0.24 + y), (s * 0.54, 0.16 + y), (s * 0.34, 0.16 + y)])
    body.append([(-0.10, 0.24 + y), (-0.16, 0.36 + y), (-0.44, 0.36 + y)])
    body.append([(-0.16, 0.36 + y), (-0.12, 0.44 + y)])
    P += [rot(q, c, tl) for q in body]
    ex, ey = R((-0.12, -0.06 + y), c, tl)
    E.append((ex, ey, 0.05 if i % 4 else 0.03))
    return pack(P, E)
