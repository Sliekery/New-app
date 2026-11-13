"""VOID SHARD (Voidspawn: wards itself every turn and never strikes, but after six turns it corrupts one of your
cards). A crowned crystal core with a single eye, four shards orbiting it in real depth (shrinking as they pass
behind), and a ring of six ticks round its base, the countdown it is keeping. Idle, 8 frames: the shards orbit,
the core breathes, the eye narrows, one tick after another lights up round the ring."""
import math
from lib import *

ID, N, FPS = "void_shard", 8, 8

def shard(cx, cy, s):
    return [(cx, cy - 0.20 * s), (cx + 0.08 * s, cy), (cx, cy + 0.20 * s), (cx - 0.08 * s, cy), (cx, cy - 0.20 * s)]

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.03 * wave(ph)
    behind, front = [], []
    for k in range(4):
        a = ph / 2 + k * math.pi / 2                     # a quarter turn per loop: four identical shards, so it repeats
        z = math.sin(a)
        s = 1.0 + 0.25 * z
        p = shard(math.cos(a) * 0.70, -0.04 + y + z * 0.10, s)
        (front if z > 0 else behind).append(p)
    P += behind
    # the core: a tall crystal, crowned, breathing
    b = 1.0 + 0.04 * wave(ph, 2)
    core = [(0.0, -0.50 * b + y), (0.24 * b, -0.18 + y), (0.20 * b, 0.26 + y), (0.0, 0.44 * b + y), (-0.20 * b, 0.26 + y), (-0.24 * b, -0.18 + y), (0.0, -0.50 * b + y)]
    P.append(core)
    P.append([(-0.24 * b, -0.18 + y), (0.0, -0.06 + y), (0.24 * b, -0.18 + y)])
    P.append([(0.0, -0.06 + y), (0.0, 0.44 * b + y)])
    for k in range(3):
        x = -0.14 + k * 0.14
        P.append([(x, -0.40 * b + y - 0.06 + abs(x) * 0.4), (x, -0.56 * b + y - (0.10 if k == 1 else 0.04))])
    op = 0.04 + 0.03 * pos(ph)
    P.append([(-0.10, -0.18 + y), (0.0, -0.18 + y - op), (0.10, -0.18 + y), (0.0, -0.18 + y + op), (-0.10, -0.18 + y)])
    E.append((-0.02, -0.18 + y, 0.035))
    P += front
    # the countdown ring: six ticks, lighting in turn
    lit = i * 6 // n
    for k in range(6):
        a = math.pi + (k + 0.5) / 6 * math.pi
        x, yy = math.cos(a + math.pi) * 0.40, 0.62 + y + math.sin(a + math.pi) * 0.08
        r = 0.04 if k == lit else 0.025
        P.append(ngon(x, yy, r, 4, math.pi / 4))
    return pack(P, E)
