"""INQUISITOR (Hierarchy elite, THE QUESTION: copies the last card you played into your draw pile, soured).
A tall, narrow interrogator in a high conical hood with one slit for an eye, a long cloak; in one hand a crook
bent into a hook, a lamp hanging off it; in the other an open ledger whose pages turn as it copies what you
did. Idle, 12 frames: the ledger's pages flip, the lamp swings and glows on its hook, the hood tips, a
fluttering copied page drifts off the book."""
import math
from lib import *

ID, N, FPS = "inquisitor", 12, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.012 * wave(ph)

    # ---- the cloak: tall, narrow, falling to the floor ----
    P.append([(-0.24, -0.40 + y), (-0.34, 0.20 + y), (-0.40, 0.88), (0.40, 0.88), (0.34, 0.20 + y), (0.24, -0.40 + y)])
    P.append([(0.0, -0.30 + y), (-0.06, 0.88)])
    P.append([(-0.24, -0.40 + y), (0.0, -0.22 + y), (0.24, -0.40 + y)])
    for k in range(3):
        P.append(ngon(0.0, -0.12 + k * 0.14 + y, 0.014, 6))

    # ---- the hood: tall cone, one slit, tipping ----
    tip = 0.04 * wave(ph, 1, 0.6)
    hp = (0.0, -0.40 + y)
    hood = [(-0.20, -0.40), (-0.16, -0.60), (-0.04, -0.94), (0.04, -0.94), (0.16, -0.60), (0.20, -0.40)]
    P.append([R((p[0], p[1] + y), hp, tip) for p in hood])
    face = [(-0.10, -0.46), (-0.10, -0.64), (0.10, -0.64), (0.10, -0.46)]
    P.append([R((p[0], p[1] + y), hp, tip) for p in face])
    sl = [R((p[0], p[1] + y), hp, tip) for p in [(-0.07, -0.56), (0.07, -0.56)]]
    P.append(sl)
    E.append(R((-0.02, -0.56 + y), hp, tip) + (0.022,))

    # ---- right arm (viewer's right): the crook with a lamp hanging off its hook ----
    sh = (0.24, -0.34 + y)
    hand = (0.46, -0.02 + y)
    P.append(bone(sh, hand, 0.05, 0.04))
    P.append([(0.48, 0.86), (0.48, -0.66)])
    hook = [(0.48, -0.66)]
    for k in range(1, 9):
        a = math.pi + k / 8 * math.pi * 1.1
        hook.append((0.62 + math.cos(a) * 0.14, -0.66 + math.sin(a) * 0.14))
    P.append(hook)
    sw = 0.22 * wave(ph, 1, 1.0)
    hang = hook[-1]
    lamp = (hang[0] + math.sin(sw) * 0.14, hang[1] + math.cos(sw) * 0.14)
    P.append([hang, lamp])
    P.append(rot([(lamp[0] - 0.05, lamp[1]), (lamp[0] + 0.05, lamp[1]), (lamp[0] + 0.07, lamp[1] + 0.12), (lamp[0] - 0.07, lamp[1] + 0.12), (lamp[0] - 0.05, lamp[1])], lamp, -sw))
    E.append(R((lamp[0], lamp[1] + 0.07), lamp, -sw) + (0.025 + 0.01 * pos(ph, 2),))

    # ---- left arm (toward the player): the open ledger, pages turning ----
    shl = (-0.24, -0.34 + y)
    bk = (-0.52, 0.02 + y)
    P.append(bone(shl, (-0.44, 0.04 + y), 0.05, 0.04))
    spine_t, spine_b = (bk[0], bk[1] - 0.12), (bk[0], bk[1] + 0.10)
    for s in (1, -1):
        P.append([spine_t, (bk[0] + s * 0.26, bk[1] - 0.16), (bk[0] + s * 0.26, bk[1] + 0.06), spine_b, spine_t])
        for k in range(3):
            yy = bk[1] - 0.08 + k * 0.05
            P.append([(bk[0] + s * 0.05, yy), (bk[0] + s * 0.20, yy - 0.03)])
    # the turning page: sweeps from one side to the other over the loop
    t = (f * 2) % 1.0
    a = math.pi * t
    w = 0.26 * math.cos(a)
    lift = 0.12 * math.sin(a)
    P.append([spine_t, (bk[0] + w, bk[1] - 0.16 - lift), (bk[0] + w, bk[1] + 0.06 - lift), spine_b])
    # a copied page drifting off
    d = f
    px, py = bk[0] - 0.10 - d * 0.22, bk[1] - 0.24 - d * 0.40
    q = 0.06 * (1 - d * 0.6)
    P.append(rot(box(px - q, py - q * 1.3, px + q, py + q * 1.3), (px, py), d * 3))
    return pack(P, E)
