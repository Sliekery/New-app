"""JAMMER (Hierarchy: its beam deals damage AND burns a card out of your deck). A tripod laser turret: a wide
trapezoid head on a neck, twin emitter rods with a focusing lens between them aimed at you, a sensor eye, three
splayed legs. Idle, 8 frames: the head pans a little, static crackles across the gap between the emitter rods,
the lens charges and dims, the tripod settles."""
import math
from lib import *

ID, N, FPS = "jammer", 8, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.01 * wave(ph)

    # ---- tripod ----
    hub = (0.04, 0.28)
    for foot in ((-0.60, 0.88), (0.68, 0.88), (0.10, 0.92)):
        knee = ((hub[0] + foot[0]) / 2 + (0.08 if foot[0] > 0.2 else -0.08 if foot[0] < -0.2 else 0.0), (hub[1] + foot[1]) / 2 - 0.10)
        P.append([hub, knee, foot])
        P.append([(foot[0] - 0.08, foot[1]), (foot[0] + 0.08, foot[1])])
    P.append(ngon(hub[0], hub[1], 0.06, 6))
    P.append([(hub[0], hub[1]), (hub[0], 0.16 + y)])

    # ---- head, panning about its neck ----
    pan = 0.05 * wave(ph, 1, 0.5)
    nk = (0.04, 0.16 + y)
    def hd(pts):
        return rot([(p[0], p[1] + y) for p in pts], nk, pan)
    P.append(hd([(-0.44, 0.16), (0.52, 0.16), (0.40, -0.24), (-0.30, -0.24), (-0.44, 0.16)]))
    P.append(hd([(-0.36, 0.02), (0.46, 0.02)]))
    for k in range(4):
        P.append(hd([(0.14 + k * 0.08, -0.18), (0.14 + k * 0.08, -0.04)]))
    E.append(hd([(-0.10, -0.10)])[0] + (0.035,))
    P.append(hd(ngon(-0.10, -0.10, 0.07, 8)))

    # ---- twin emitter rods forward (toward the player) with the lens between ----
    for ry in (-0.20, 0.10):
        P.append(hd([(-0.40, ry), (-0.86, ry)]))
        P.append(hd([(-0.86, ry - 0.04), (-0.86, ry + 0.04)]))
    ch = pos(ph, 1, 0.0)
    lc = hd([(-0.74, -0.05)])[0]
    P.append(hd(ngon(-0.74, -0.05, 0.06 + 0.03 * ch, 8, 0, 0.09)))
    E.append((lc[0], lc[1], 0.02 + 0.025 * ch))
    # static jumping the gap between the rods
    if i % 2 == 0:
        for xx in (-0.56, -0.86):
            pts = [(xx, -0.20)]
            for k in range(1, 5):
                pts.append((xx + 0.04 * (1 if (k + i) % 2 else -1), -0.20 + k * 0.06))
            P.append(hd(pts))
    return pack(P, E)
