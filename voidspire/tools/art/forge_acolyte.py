"""FORGE ACOLYTE (Rust, REPAIR: heals all its allies each turn). Two models, picked per spawn.
A: a hooded tech-acolyte with a welding torch in one hand and a big wrench in the other; a bright repair arc
leaps from the torch, sparks falling. Idle: the arc crackles and the sparks fall, the wrench taps, the hood
tips.
B (frame_alt): a stooped acolyte carrying a tool-pack on its back, a jointed servo-arm reaching over its
shoulder with a welder at its tip; floating rings of repair light rise from its hands. Idle: the servo-arm
weaves, the rings rise and fade, the pack's lamp blinks."""
import math
from lib import *

ID, N, FPS = "forge_acolyte", 8, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.015 * wave(ph)
    # robe
    P.append([(-0.22, -0.30 + y), (-0.32, 0.40), (-0.36, 0.86), (0.36, 0.86), (0.32, 0.40), (0.22, -0.30 + y)])
    P.append([(-0.30, 0.20), (0.30, 0.20)])
    for k in range(3):
        P.append(ngon(-0.12 + k * 0.12, 0.28, 0.02, 6))
    # hood, tipping
    tp = 0.05 * wave(ph, 1, 0.4)
    hp = (0.0, -0.30 + y)
    hood = [(-0.22, -0.30), (-0.24, -0.58), (-0.04, -0.80), (0.10, -0.72), (0.24, -0.56), (0.22, -0.30)]
    P.append([R((p[0], p[1] + y), hp, tp) for p in hood])
    face = [(-0.12, -0.34), (-0.12, -0.54), (0.12, -0.54), (0.12, -0.34)]
    P.append([R((p[0], p[1] + y), hp, tp) for p in face])
    P.append([R((p[0], p[1] + y), hp, tp) for p in [(-0.10, -0.46), (0.10, -0.46)]])
    E.append(R((-0.04, -0.46 + y), hp, tp) + (0.028,))
    E.append(R((0.05, -0.46 + y), hp, tp) + (0.02,))
    # torch arm toward the player, arc leaping from it
    P.append(bone((-0.22, -0.24 + y), (-0.46, -0.04 + y), 0.045, 0.035))
    P.append([(-0.46, -0.04 + y), (-0.62, -0.16 + y)])
    P.append(box(-0.52, -0.10 + y, -0.42, 0.02 + y))
    tip = (-0.64, -0.18 + y)
    pts = [tip]
    for k in range(1, 5):
        pts.append((tip[0] - k * 0.06 + 0.04 * math.sin(ph * 3 + k * 2.1 + i), tip[1] - k * 0.07))
    P.append(pts)
    E.append((tip[0], tip[1], 0.025))
    for k in range(3):
        d = (f * 2 + k / 3) % 1.0
        P.append(ngon(tip[0] + 0.03 * k - 0.03, tip[1] + d * 0.40, 0.012, 4))
    # wrench arm, tapping
    t = 0.15 * pos(ph, 2)
    sh = (0.22, -0.24 + y)
    hand = R((0.44, 0.06 + y), sh, -t)
    P.append(bone(sh, hand, 0.045, 0.035))
    head = R((0.50, 0.34 + y), sh, -t)
    P.append([hand, head])
    P.append([R((0.44, 0.40 + y), sh, -t), head, R((0.56, 0.40 + y), sh, -t)])
    P.append([R((0.46, 0.04 + y), sh, -t), R((0.40, -0.02 + y), sh, -t), R((0.48, -0.04 + y), sh, -t)])
    return pack(P, E)

def frame_alt(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.015 * wave(ph)
    # stooped body
    P.append([(-0.18, -0.20 + y), (-0.30, 0.30), (-0.34, 0.86), (0.30, 0.86), (0.30, 0.30), (0.20, -0.24 + y)])
    P.append([(-0.04, -0.20 + y), (-0.04, 0.86)])
    # tool-pack on its back
    P.append(box(0.18, -0.40 + y, 0.48, 0.20 + y))
    P.append([(0.18, -0.10 + y), (0.48, -0.10 + y)])
    for k in range(3):
        P.append([(0.24 + k * 0.08, -0.40 + y), (0.24 + k * 0.08, -0.52 + y)])
    if i % 4 < 2:
        E.append((0.40, 0.08 + y, 0.025))
    # head, low and forward
    hy = -0.20 + y
    P.append([(-0.30, hy), (-0.32, hy - 0.22), (-0.14, hy - 0.32), (0.04, hy - 0.22), (0.02, hy)])
    P.append([(-0.26, hy - 0.14), (-0.04, hy - 0.14)])
    E += [(-0.20, hy - 0.14, 0.022), (-0.10, hy - 0.14, 0.022)]
    # servo-arm over the shoulder, weaving, welder at its tip
    w = 0.20 * wave(ph, 1, 0.3)
    pts = chain((0.30, -0.40 + y), [-1.9 + w * 0.3, -2.6 + w, 2.4 + w * 1.2], [0.24, 0.24, 0.16])
    for a, b in zip(pts, pts[1:]):
        P.append(bone(a, b, 0.03, 0.025))
    for p in pts[1:-1]:
        P.append(ngon(p[0], p[1], 0.035, 6))
    tip = pts[-1]
    E.append((tip[0], tip[1], 0.03))
    for k in range(3):
        a = -math.pi / 2 + (k - 1) * 0.8 + ph
        P.append([(tip[0], tip[1]), (tip[0] + math.cos(a) * 0.07, tip[1] + math.sin(a) * 0.07)])
    # hands together in front, rings of repair light rising from them
    hands = (-0.34, 0.12 + y)
    P.append(bone((-0.16, -0.12 + y), hands, 0.04, 0.03))
    for k in range(2):
        d = (f + k / 2) % 1.0
        r = 0.06 + 0.10 * d
        if d < 0.9:
            P.append(ngon(hands[0], hands[1] - 0.06 - d * 0.40, r, 12, 0, r * 0.35))
    return pack(P, E)
