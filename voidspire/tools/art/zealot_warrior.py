"""ZEALOT WARRIOR (Hierarchy, discipline: punishes long turns; slashes, steels itself). A lean, digitigrade
warrior: a narrow helm with a swept fan crest and a single eye slit, mandibles at the jaw, a tabard, an energy
blade held forward in its left hand toward you, a clawed off-hand drawn back. Idle, 8 frames: the blade hums
(its edge shimmers and the tip drifts), the crest sways, the mandibles open and close, it rocks on its bent
legs."""
import math
from lib import *

ID, N, FPS = "zealot_warrior", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.025 * wave(ph)

    # ---- digitigrade legs ----
    for s in (1, -1):
        hip = (s * 0.14, 0.18 + y)
        knee = (s * 0.26, 0.42 + y * 0.5)
        hock = (s * 0.14, 0.64)
        foot = (s * 0.26, 0.86)
        P.append([hip, knee, hock, foot])
        P.append([(foot[0] - s * 0.06, foot[1]), (foot[0] + s * 0.10, foot[1])])

    # ---- torso and tabard ----
    P.append([(-0.24, -0.34 + y), (0.24, -0.34 + y), (0.18, 0.18 + y), (-0.18, 0.18 + y), (-0.24, -0.34 + y)])
    P.append([(-0.12, 0.06 + y), (-0.14, 0.52 + y + 0.02 * wave(ph, 1, 1)), (0.14, 0.52 + y + 0.02 * wave(ph, 1, 1.6)), (0.12, 0.06 + y)])
    P.append([(0.0, -0.30 + y), (0.0, 0.06 + y)])
    P.append(ngon(0.0, -0.16 + y, 0.05, 6))

    # ---- pauldrons, so it reads as armoured rather than a stick figure ----
    for s in (1, -1):
        P.append([(s * 0.14, -0.36 + y), (s * 0.30, -0.42 + y), (s * 0.38, -0.30 + y), (s * 0.26, -0.22 + y)])

    # ---- helm, eye, mandibles ----
    hy = -0.36 + y
    P.append([(0.0, hy - 0.42), (0.15, hy - 0.30), (0.15, hy - 0.10), (0.0, hy), (-0.15, hy - 0.10), (-0.15, hy - 0.30), (0.0, hy - 0.42)])
    P.append([(-0.10, hy - 0.22), (0.08, hy - 0.22)])
    E.append((-0.03, hy - 0.22, 0.03))
    m = 0.04 * pos(ph, 2)
    for s in (1, -1):
        P.append([(s * 0.10, hy - 0.06), (s * (0.16 + m), hy + 0.04), (s * (0.08 + m * 0.5), hy + 0.10)])
    # crest: a fan of swept spines, swaying
    sw = 0.08 * wave(ph, 1, 0.4)
    for k in range(5):
        a = -math.pi / 2 + 0.5 + k * 0.16 + sw
        base = (0.02 + k * 0.02, hy - 0.40)
        L = 0.22 + 0.04 * (2 - abs(k - 2))
        P.append([base, (base[0] + math.cos(a) * L, base[1] + math.sin(a) * L)])

    # ---- off-hand, drawn back (to the right), claws ----
    sh = (0.24, -0.28 + y)
    el = (0.44, -0.08 + y)
    hd = (0.40, 0.14 + y)
    P.append([sh, el, hd])
    for k in range(3):
        a = math.pi / 2 + (k - 1) * 0.45
        P.append([hd, (hd[0] + math.cos(a) * 0.08, hd[1] + math.sin(a) * 0.08)])

    # ---- blade arm, forward toward the player ----
    shl = (-0.24, -0.28 + y)
    ell = (-0.42, -0.10 + y)
    hdl = (-0.52, -0.22 + y)
    P.append([shl, ell, hdl])
    P.append([(hdl[0] + 0.04, hdl[1] + 0.06), (hdl[0] - 0.04, hdl[1] - 0.06)])          # guard
    tip_a = -2.0 + 0.05 * wave(ph, 1, 0.9)
    L = 0.56
    tip = (hdl[0] + math.cos(tip_a) * L, hdl[1] + math.sin(tip_a) * L)
    nx, ny = -math.sin(tip_a), math.cos(tip_a)
    w = 0.045
    P.append([(hdl[0] + nx * w, hdl[1] + ny * w), tip, (hdl[0] - nx * w, hdl[1] - ny * w)])
    # the hum: a shimmering inner edge line
    j = 0.012 * math.sin(ph * 4)
    P.append([(hdl[0] + math.cos(tip_a) * 0.08 + nx * j, hdl[1] + math.sin(tip_a) * 0.08 + ny * j),
              (hdl[0] + math.cos(tip_a) * (L - 0.10) - nx * j, hdl[1] + math.sin(tip_a) * (L - 0.10) - ny * j)])
    # the crest reaches past the top of the box; sit the whole figure a little lower
    P = [T(q, 0, 0.07) for q in P]
    E = [(x, yy + 0.07, d) for x, yy, d in E]
    return pack(P, E)
