"""THE FORGE TYRANT (Rust boss: ENRAGE grows stronger when struck; reforges itself; burns). A furnace titan:
a blast-furnace body whose grated mouth shows the fire inside, chimney stacks rising from colossal pauldrons
and throwing sparks, a small horned helm sunk into the top of the furnace, a crane-claw arm and a forge-hammer
arm, on stubby armoured legs. Idle, 12 frames: the fire licks behind the grate, sparks rise from the chimneys,
the claw opens and shuts, the hammer arm sways, molten slag drips from the grate's lip."""
import math
from lib import *

ID, N, FPS = "forge_tyrant", 12, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    b = wave(ph)
    y = 0.012 * b

    # ---- legs ----
    for s in (1, -1):
        for q in ([(0.16, 0.40), (0.42, 0.40), (0.46, 0.64), (0.14, 0.64), (0.16, 0.40)],
                  [(0.08, 0.64), (0.52, 0.64), (0.56, 0.74), (0.04, 0.74), (0.08, 0.64)],
                  [(0.20, 0.50), (0.40, 0.50)]):
            P.append(q if s > 0 else mx(q))

    # ---- the furnace body: tapering stack of riveted bands ----
    body = [(-0.40, 0.42 + y), (-0.54, 0.10 + y), (-0.56, -0.30 + y), (-0.44, -0.56 + y), (0.44, -0.56 + y),
            (0.56, -0.30 + y), (0.54, 0.10 + y), (0.40, 0.42 + y), (-0.40, 0.42 + y)]
    P.append(body)
    for yy in (-0.40, 0.28):
        P.append([(-0.54, yy + y), (0.54, yy + y)])
        for k in range(7):
            P.append(ngon(-0.42 + k * 0.14, yy + 0.05 + y, 0.012, 6))

    # ---- the grate mouth and the fire behind it ----
    gx0, gx1, gy0, gy1 = -0.32, 0.32, -0.26 + y, 0.16 + y
    P.append([(gx0, gy0), (gx1, gy0), (gx1 + 0.04, gy1), (gx0 - 0.04, gy1), (gx0, gy0)])
    for k in range(7):
        x = gx0 + 0.04 + k * 0.08
        P.append([(x, gy0), (x + (x / 0.32) * 0.03, gy1)])
    for k in range(5):                                            # flame tongues, flickering
        x = -0.24 + k * 0.12
        h = 0.18 + 0.10 * abs(math.sin(ph * 2 + k * 1.7))
        lean = 0.03 * math.sin(ph * 3 + k)
        P.append([(x - 0.05, gy1 - 0.02), (x + lean, gy1 - 0.02 - h), (x + 0.05, gy1 - 0.02)])
    E.append((0.0, gy1 - 0.08, 0.035 + 0.01 * pos(ph, 3)))         # the white heart of the fire
    # slag dripping off the lip
    for k, x in enumerate((-0.18, 0.06, 0.22)):
        d = (f * 2 + k * 0.37) % 1.0
        P.append([(x, gy1 + 0.01), (x, gy1 + 0.02 + d * 0.12)])
        if d > 0.55:
            P.append(ngon(x, gy1 + 0.04 + d * 0.14, 0.015, 5))

    # ---- helm: small, horned, sunk into the furnace's crown ----
    hy = -0.56 + y
    P.append([(-0.14, hy), (-0.16, hy - 0.14), (-0.08, hy - 0.22), (0.08, hy - 0.22), (0.16, hy - 0.14), (0.14, hy)])
    P.append([(-0.12, hy - 0.11), (0.12, hy - 0.11), (0.10, hy - 0.06), (-0.10, hy - 0.06), (-0.12, hy - 0.11)])
    E += [(-0.05, hy - 0.085, 0.022), (0.05, hy - 0.085, 0.022)]
    for s in (1, -1):
        horn = [(0.10, hy - 0.20), (0.22, hy - 0.30), (0.26, hy - 0.44), (0.18, hy - 0.30), (0.06, hy - 0.22)]
        P.append(horn if s > 0 else mx(horn))

    # ---- colossal pauldrons with chimney stacks, sparks rising ----
    for s, off in ((1, 0.0), (-1, 0.5)):
        side = []
        side.append([(0.44, -0.56 + y), (0.62, -0.66 + y), (0.86, -0.58 + y), (0.96, -0.36 + y), (0.86, -0.16 + y),
                     (0.56, -0.18 + y)])
        side.append([(0.58, -0.62 + y), (0.80, -0.54 + y), (0.88, -0.36 + y)])
        side.append([(0.62, -0.64 + y), (0.62, -0.92 + y), (0.76, -0.92 + y), (0.76, -0.60 + y)])
        side.append([(0.60, -0.92 + y), (0.78, -0.92 + y)])
        side.append([(0.62, -0.80 + y), (0.76, -0.80 + y)])
        for k in range(3):
            d = (f * 1.5 + off + k / 3) % 1.0
            sx = 0.69 + 0.05 * math.sin(d * 9 + k)
            sy = -0.96 + y - d * 0.30
            sz = 0.02 * (1 - d) + 0.006
            side.append([(sx, sy - sz), (sx + sz, sy), (sx, sy + sz), (sx - sz, sy), (sx, sy - sz)])
        for q in side:
            P.append(q if s > 0 else mx(q))

    # ---- right arm: the crane claw, opening and shutting ----
    sh = (0.80, -0.20 + y)
    elbow = (0.92, 0.08 + y)
    P.append(bone(sh, elbow, 0.08, 0.06))
    wrist = R((0.96, 0.32 + y), elbow, 0.05 * b)
    P.append(bone(elbow, wrist, 0.06, 0.05))
    P.append(ngon(elbow[0], elbow[1], 0.05, 6))
    grip = 0.20 + 0.20 * pos(ph, 1, 0.5)
    for side in (1, -1):
        a = math.pi / 2 + side * grip
        j1 = (wrist[0] + math.cos(a) * 0.22, wrist[1] + math.sin(a) * 0.22)
        j2 = (j1[0] - side * 0.09, j1[1] + 0.14)
        P.append([(wrist[0] + side * 0.03, wrist[1]), j1, j2])
        P.append([(wrist[0] + side * 0.01, wrist[1] + 0.04), (j1[0] - side * 0.03, j1[1]), j2])

    # ---- left arm: the forge hammer, swaying ----
    shl = (-0.80, -0.20 + y)
    sway = 0.08 * wave(ph, 1, 1.2)
    el = R((-0.92, 0.08 + y), shl, sway)
    P.append(bone(shl, el, 0.08, 0.06))
    hand = R((-0.94, 0.30 + y), shl, sway)
    P.append(bone(el, hand, 0.06, 0.05))
    P.append(ngon(el[0], el[1], 0.05, 6))
    hc = (hand[0], hand[1] + 0.18)
    P.append([hand, hc])
    hd = rot(box(hc[0] - 0.20, hc[1], hc[0] + 0.20, hc[1] + 0.20), hc, sway)
    P.append(hd)
    P.append(rot([(hc[0] - 0.10, hc[1] + 0.05), (hc[0] + 0.10, hc[1] + 0.05)], hc, sway))

    return pack(P, E)
