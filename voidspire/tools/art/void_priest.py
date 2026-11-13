"""VOID PRIEST (Voidspawn elite, THE LITANY: its regeneration doubles for every turn it goes undamaged). A
hooded celebrant reciting without end: a deep hood with two cold eyes, a tall mitre of void-horns, a heart of
light in a hollow of its chest that pulses as it mends; in its hands a long string of prayer beads it tells
one by one, and a tablet of the litany orbiting it. Idle, 12 frames: the beads slide through its fingers, the
heart pulses brighter on each count, the tablet orbits behind and in front, the robe hem stirs."""
import math
from lib import *

ID, N, FPS = "void_priest", 12, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.015 * wave(ph)

    # ---- robe ----
    hem = [(-0.40 + 0.02 * wave(ph, 1, k), 0.86) for k in range(1)]
    P.append([(-0.24, -0.40 + y), (-0.32, 0.30 + y), (-0.40 + 0.02 * wave(ph, 1, 0.5), 0.86), (-0.14, 0.82), (0.0, 0.88), (0.14, 0.82),
              (0.40 + 0.02 * wave(ph, 1, 1.5), 0.86), (0.32, 0.30 + y), (0.24, -0.40 + y)])
    P.append([(-0.30, 0.10 + y), (0.30, 0.10 + y)])
    P.append([(0.0, 0.10 + y), (0.0, 0.86)])

    # ---- chest hollow with the heart of light ----
    P.append([(0.0, -0.36 + y), (0.14, -0.20 + y), (0.0, 0.02 + y), (-0.14, -0.20 + y), (0.0, -0.36 + y)])
    beat = pos(ph, 3)
    hr = 0.04 + 0.03 * beat
    P.append(ngon(0.0, -0.17 + y, hr, 8, 0, hr * 1.1))
    E.append((0.0, -0.17 + y, 0.02 + 0.015 * beat))

    # ---- hood, eyes, and the mitre of void-horns ----
    hy = -0.40 + y
    P.append([(-0.24, hy), (-0.26, hy - 0.20), (-0.12, hy - 0.34), (0.12, hy - 0.34), (0.26, hy - 0.20), (0.24, hy)])
    P.append([(-0.14, hy - 0.02), (-0.15, hy - 0.18), (0.0, hy - 0.26), (0.15, hy - 0.18), (0.14, hy - 0.02)])
    E += [(-0.06, hy - 0.14, 0.022), (0.06, hy - 0.14, 0.022)]
    for s in (1, -1):
        horn = [(0.06, hy - 0.32), (0.10, hy - 0.46), (0.22, hy - 0.54), (0.20, hy - 0.46), (0.12, hy - 0.34)]
        P.append(horn if s > 0 else mx(horn))
    P.append([(-0.04, hy - 0.34), (0.0, hy - 0.52), (0.04, hy - 0.34)])

    # ---- hands together in front, the beads looping down from them ----
    for s in (1, -1):
        P.append(bone((s * 0.24, -0.34 + y), (s * 0.10, 0.10 + y), 0.045, 0.035))
    hands = (0.0, 0.14 + y)
    P.append(ngon(hands[0], hands[1], 0.06, 8, 0, 0.04))
    # the bead loop: an ellipse hanging from the hands; beads slide along it
    loop = []
    for k in range(25):
        a = -math.pi / 2 + k / 24 * 2 * math.pi
        loop.append((math.cos(a) * 0.16, hands[1] + 0.20 + math.sin(a) * 0.20))
    P.append(loop)
    for k in range(9):
        t = (k / 9 + f / 9 * 3) % 1.0
        a = -math.pi / 2 + t * 2 * math.pi
        bx, by = math.cos(a) * 0.16, hands[1] + 0.20 + math.sin(a) * 0.20
        P.append(ngon(bx, by, 0.022 if k else 0.034, 6))

    # ---- the litany tablet orbiting it ----
    a = ph
    ox, oz = math.cos(a) * 0.66, math.sin(a)
    oy = -0.30 + y + math.sin(a) * 0.08
    sc = 1.0 + 0.18 * oz
    w, h = 0.10 * sc * (0.5 + 0.5 * abs(math.cos(a * 0.5))), 0.14 * sc
    P.append([(ox - w, oy - h + 0.03), (ox, oy - h - 0.02), (ox + w, oy - h + 0.03), (ox + w, oy + h), (ox - w, oy + h), (ox - w, oy - h + 0.03)])
    for k in range(3):
        P.append([(ox - w * 0.6, oy - 0.06 + k * 0.06), (ox + w * 0.6, oy - 0.06 + k * 0.06)])
    return pack(P, E)
