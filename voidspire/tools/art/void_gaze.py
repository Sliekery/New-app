"""VOID GAZE (Voidspawn: a core eye shielded by the Gaze Eyes floating round it; once they die its gaze grows
with every debuff on you). The great eye in the middle with heavy lids and a slit iris, inside two crossing
orbital rings whose empty sockets are where its lesser eyes ride, and a fringe of optic nerves trailing below.
Idle, 8 frames: the rings precess, the sockets travel round them, the lids breathe and the slit widens and
narrows, the nerves sway."""
import math
from lib import *

ID, N, FPS = "void_gaze", 8, 8

def ring(r, ry, roll, spin, cy, nodes):
    pts = []
    for k in range(29):
        a = k / 28 * 2 * math.pi
        pts.append(R((math.cos(a) * r, cy + math.sin(a) * ry), (0, cy), roll))
    sockets = []
    for k in range(nodes):
        a = spin + k / nodes * 2 * math.pi
        sockets.append(R((math.cos(a) * r, cy + math.sin(a) * ry), (0, cy), roll))
    return pts, sockets

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    cy = -0.06 + 0.03 * wave(ph)
    # optic nerves trailing below
    for k in range(4):
        bx = -0.18 + k * 0.12
        a = math.pi / 2 + 0.10 * math.sin(ph + k * 1.4) + (bx * 0.5)
        P.append(chain((bx, cy + 0.32), [a, a + 0.12 * math.sin(ph + k), a - 0.10 * math.sin(ph + k * 0.7)], [0.14, 0.14, 0.12]))
    # two crossing rings, sockets travelling round them
    for roll, spin in ((0.42 + 0.05 * wave(ph), ph / 3), (-0.42 - 0.05 * wave(ph), -ph / 3 + 1.0)):
        pts, socks = ring(0.80, 0.24, roll, spin, cy, 3)
        P.append(pts)
        for sx, sy in socks:
            P.append(ngon(sx, sy, 0.05, 8))
    # the great eye
    lid = 0.24 + 0.04 * wave(ph, 1, 1.0)
    P.append([(-0.42, cy), (-0.22, cy - lid), (0.22, cy - lid), (0.42, cy), (0.22, cy + lid), (-0.22, cy + lid), (-0.42, cy)])
    P.append([(-0.36, cy - 0.04), (-0.18, cy - lid - 0.06), (0.18, cy - lid - 0.06), (0.36, cy - 0.04)])
    P.append(ngon(-0.04, cy, 0.18, 16))
    sl = 0.03 + 0.05 * pos(ph, 1, 2.0)
    P.append([(-0.04, cy - 0.16), (-0.04 + sl, cy), (-0.04, cy + 0.16), (-0.04 - sl, cy), (-0.04, cy - 0.16)])
    E.append((-0.04, cy, 0.04))
    return pack(P, E)
