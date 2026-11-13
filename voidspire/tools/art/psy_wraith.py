"""PSY-WRAITH (Voidspawn: exposes you, strikes, and taints your deck). A shroud with nobody in it: an outer
tattered shroud and a hood inside it whose face is a hollow with one psychic eye, wisps for arms reaching out,
and shards of broken thought drifting round its head. Idle, 8 frames: it hovers and sways, the hem's tatters
ripple, the wisp arms curl, the shards drift round, the eye pulses."""
import math
from lib import *

ID, N, FPS = "psy_wraith", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.05 * wave(ph)
    sw = 0.04 * wave(ph, 1, 0.6)
    # outer shroud with a tattered hem
    hem = []
    for k in range(9):
        x = -0.40 + k * 0.10
        hem.append((x + sw * (1 + abs(x)), 0.58 + y + (0.14 if k % 2 else 0.0) + 0.04 * math.sin(ph * 2 + k)))
    shroud = [(0.0, -0.76 + y), (0.30, -0.56 + y), (0.36, -0.10 + y), (0.40, 0.58 + y)] + hem[::-1] + [(-0.36, -0.10 + y), (-0.30, -0.56 + y), (0.0, -0.76 + y)]
    P.append(shroud)
    # hood within it and the hollow face
    P.append([(-0.20, -0.20 + y), (-0.22, -0.48 + y), (0.0, -0.64 + y), (0.22, -0.48 + y), (0.20, -0.20 + y)])
    P.append(ngon(0.0, -0.38 + y, 0.12, 12, 0, 0.15))
    pu = 0.04 + 0.02 * pos(ph, 2)
    P.append(ngon(-0.02, -0.38 + y, pu + 0.03, 10))
    E.append((-0.02, -0.38 + y, pu))
    P.append([(0.0, -0.10 + y), (0.04 + sw, 0.50 + y)])
    # wisp arms curling out
    for s, off in ((-1, 0.0), (1, 1.6)):
        angs, a = [], (math.pi - 0.3 if s < 0 else 0.3)
        for k in range(5):
            a += s * -0.22 * (0.6 + 0.4 * math.sin(ph + off)) * (k / 4)
            angs.append(a)
        P.append(chain((s * 0.32, -0.16 + y), angs, [0.10] * 5))
    # drifting shards of thought round the head
    for k in range(3):
        a = ph + k * 2 * math.pi / 3
        x, yy = math.cos(a) * 0.56, -0.60 + y + math.sin(a) * 0.14
        s = 0.8 + 0.25 * math.sin(a)
        P.append([(x, yy - 0.07 * s), (x + 0.04 * s, yy), (x, yy + 0.07 * s), (x - 0.04 * s, yy), (x, yy - 0.07 * s)])
    return pack(P, E)
