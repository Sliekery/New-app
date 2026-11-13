"""WARP ETCHER (Voidspawn elite, THE ETCHING: every third turn it scars a face of your die). It is a die being
cut: a crystalline shard-thing with one eye in its core, and in front of it, turning in real 3D, a d20 that it
holds and scores with a stylus-limb; scratches glow on the die where it has cut and sparks fly off the stylus.
Idle, 12 frames: the d20 turns (a fifth of a turn per loop, so it repeats), the stylus scratches back and forth,
sparks fly, the shards around its core drift."""
import math
from lib import *

ID, N, FPS = "warp_etcher", 12, 8

G = (1 + 5 ** 0.5) / 2
ICO_V = []
for a in (-1, 1):
    for b in (-G, G):
        ICO_V += [(0, a, b), (a, b, 0), (b, 0, a)]
ICO_E = [(p, q) for p in range(12) for q in range(p + 1, 12)
         if abs(sum((ICO_V[p][k] - ICO_V[q][k]) ** 2 for k in range(3)) - 4) < 1e-6]

ADJ = {p: {q for e in ICO_E for p2, q in (e, e[::-1]) if p2 == p} for p in range(12)}
FACE_OF = {(a, b): [c for c in ADJ[a] & ADJ[b]] for a, b in ICO_E}

def project(v, ax, ay, scale, c):
    x, y, z = v
    x, z = x * math.cos(ay) + z * math.sin(ay), -x * math.sin(ay) + z * math.cos(ay)
    y, z = y * math.cos(ax) - z * math.sin(ax), y * math.sin(ax) + z * math.cos(ax)
    f = 6.0 / (6.0 + z)
    return (c[0] + x * scale * f, c[1] + y * scale * f), z

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.02 * wave(ph)

    # ---- the shard body: a tall crystal with flanking shards drifting ----
    core = (0.22, -0.10 + y)
    P.append([(0.22, -0.86 + y), (0.46, -0.30 + y), (0.40, 0.40 + y), (0.22, 0.80 + y), (0.04, 0.40 + y), (-0.02, -0.30 + y), (0.22, -0.86 + y)])
    P.append([(0.22, -0.86 + y), (0.22, 0.80 + y)])
    P.append([(-0.02, -0.30 + y), (0.46, -0.30 + y)])
    P.append([(0.04, 0.40 + y), (0.40, 0.40 + y)])
    for k, (sx, sy, h) in enumerate([(0.66, -0.40, 0.26), (0.72, 0.18, 0.20), (0.56, 0.62, 0.16)]):
        d = 0.03 * wave(ph, 1, k * 1.7)
        P.append([(sx + d, sy - h + y), (sx + 0.07 + d, sy + y), (sx + d, sy + h + y), (sx - 0.07 + d, sy + y), (sx + d, sy - h + y)])
    P.append(ngon(core[0], core[1], 0.08, 10))
    E.append((core[0], core[1], 0.035))

    # ---- the d20, held out toward you, turning ----
    c = (-0.46, 0.0 + y)
    ay = f * 2 * math.pi / 5 * 1.0
    pts = [project(v, 0.35, ay, 0.24, c) for v in ICO_V]
    # hidden edges are not drawn: an edge shows only if one of the two faces it borders turns toward you
    for a, b in ICO_E:
        if any(sum(pts[k][1] for k in (a, b, cc)) < 0 for cc in FACE_OF[(a, b)]):
            P.append([pts[a][0], pts[b][0]])
    # the scar: a glowing scratch across the nearest face, re-cut as the stylus moves
    near = sorted(range(12), key=lambda k: pts[k][1])[:3]
    q = [pts[k][0] for k in near]
    m = ((q[0][0] + q[1][0] + q[2][0]) / 3, (q[0][1] + q[1][1] + q[2][1]) / 3)
    sc = 0.5 + 0.5 * math.sin(ph * 2)
    P.append([(m[0] - 0.06, m[1] - 0.04), (m[0] - 0.06 + 0.12 * sc, m[1] - 0.04 + 0.08 * sc)])
    P.append([(m[0] - 0.04, m[1] + 0.03), (m[0] + 0.05, m[1] - 0.01)])

    # ---- the stylus-limb, from the body to the die, scratching ----
    tipx = m[0] - 0.06 + 0.12 * sc
    tipy = m[1] - 0.04 + 0.08 * sc
    elbow = (-0.06, -0.52 + y)
    P.append([(0.04, -0.40 + y), elbow, (tipx, tipy)])
    P.append([(0.00, -0.30 + y), (-0.10, -0.46 + y), (tipx + 0.02, tipy - 0.01)])
    # sparks off the stylus tip
    for k in range(3):
        a = -math.pi / 2 - 0.9 + k * 0.6 + 0.4 * math.sin(ph * 3 + k)
        l = 0.05 + 0.05 * abs(math.sin(ph * 2 + k))
        P.append([(tipx + math.cos(a) * 0.03, tipy + math.sin(a) * 0.03), (tipx + math.cos(a) * (0.03 + l), tipy + math.sin(a) * (0.03 + l))])
    # a holding claw under the die
    P.append([(0.08, 0.26 + y), (-0.20, 0.30 + y), (-0.40, c[1] + 0.26), (-0.52, c[1] + 0.24)])
    return pack(P, E)
