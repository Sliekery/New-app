"""HONOR GUARD (Hierarchy elite, THE FORMATION: while it holds Shield it cannot be pushed below half). A wall
that stands up: a tall armoured sentinel almost entirely behind a great tower shield set toward you, its seam
and boss glowing; a crested helm with a visor slit over the rim; a halberd held upright behind it; a short
cape. Idle, 12 frames: the shield breathes forward and back, its boss glyph pulses, the halberd sways, the
crest plume and the cape stir."""
import math
from lib import *

ID, N, FPS = "honor_guard", 12, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.012 * wave(ph)

    # ---- legs under the shield ----
    for s in (1, -1):
        leg = [(0.10, 0.50), (0.26, 0.50), (0.30, 0.84), (0.08, 0.84), (0.10, 0.50)]
        P.append(leg if s > 0 else mx(leg))
        P.append([(s * 0.06, 0.84), (s * 0.36, 0.84), (s * 0.38, 0.92), (s * 0.04, 0.92), (s * 0.06, 0.84)])

    # ---- cape behind, stirring ----
    for s in (1, -1):
        cape = [(0.30, -0.46 + y), (0.44 + 0.02 * wave(ph, 1, 1), 0.10 + y), (0.40 + 0.03 * wave(ph, 1, 2), 0.52)]
        P.append(cape if s > 0 else mx(cape))

    # ---- the halberd, upright behind its right shoulder, swaying ----
    sw = 0.04 * wave(ph, 1, 0.7)
    base = (0.40, 0.86)
    top = R((0.40, -0.82), base, sw)
    P.append([base, top])
    # a crescent axe blade on one side of the haft, a hook on the other
    ax = [(0.0, -0.02), (0.12, -0.10), (0.22, 0.02), (0.20, 0.16), (0.10, 0.24), (0.0, 0.18)]
    P.append([R((top[0] + p[0], top[1] + 0.10 + p[1]), top, sw) for p in ax])
    P.append([R((top[0], top[1] + 0.14), top, sw), R((top[0] - 0.10, top[1] + 0.10), top, sw), R((top[0] - 0.12, top[1] + 0.20), top, sw)])
    P.append([R((top[0], top[1] - 0.10), top, sw), top])
    P.append([R((top[0] - 0.08, top[1] + 0.12), top, sw), R((top[0], top[1] + 0.06), top, sw)])

    # ---- the body: pauldrons and helm above the shield rim ----
    P.append([(-0.34, -0.36 + y), (-0.30, -0.52 + y), (-0.12, -0.56 + y), (0.12, -0.56 + y), (0.30, -0.52 + y), (0.34, -0.36 + y)])
    hy = -0.56 + y
    helm = [(-0.12, hy), (-0.14, hy - 0.18), (-0.06, hy - 0.26), (0.06, hy - 0.26), (0.14, hy - 0.18), (0.12, hy)]
    P.append(helm)
    P.append([(-0.10, hy - 0.13), (0.10, hy - 0.13)])
    E.append((0.0, hy - 0.13, 0.03))
    crest = [(0.0, hy - 0.26)]
    for k in range(1, 6):
        t = k / 5
        crest.append((0.04 * t + 0.03 * math.sin(ph + t * 3), hy - 0.26 - 0.10 * math.sin(t * math.pi) - 0.02 * t))
    P.append([(0.0, hy - 0.26), (-0.18, hy - 0.40), (-0.30, hy - 0.34 + 0.02 * wave(ph, 1, 1.2))])
    P.append([(0.0, hy - 0.26), (-0.12, hy - 0.42), (-0.24, hy - 0.42 + 0.02 * wave(ph, 1, 1.6))])

    # ---- the tower shield, set toward the player, breathing forward ----
    push = 0.03 * wave(ph, 1, 0.3)
    cx = -0.14 - push
    w0, w1 = 0.40, 0.36
    sh = [(cx - w0, -0.40 + y), (cx + w0, -0.40 + y), (cx + w1, 0.50 + y), (cx, 0.70 + y), (cx - w1, 0.50 + y), (cx - w0, -0.40 + y)]
    P.append(sh)
    P.append([(cx - w0 + 0.06, -0.34 + y), (cx + w0 - 0.06, -0.34 + y), (cx + w1 - 0.06, 0.46 + y), (cx, 0.62 + y),
              (cx - w1 + 0.06, 0.46 + y), (cx - w0 + 0.06, -0.34 + y)])
    # the seam: the formation line straight down it
    P.append([(cx, -0.34 + y), (cx, 0.62 + y)])
    # the boss: a ring, glyph pulsing
    g = 0.11 + 0.025 * pos(ph)
    P.append(ngon(cx, 0.08 + y, g, 6, math.pi / 6))
    P.append(ngon(cx, 0.08 + y, g * 0.55, 6, 0))
    E.append((cx, 0.08 + y, 0.03))
    for yy in (-0.16, 0.32):
        P.append([(cx - w0 + 0.08, yy + y), (cx - 0.14, yy + y)])
        P.append([(cx + 0.14, yy + y), (cx + w0 - 0.08, yy + y)])
    return pack(P, E)
