"""THE NULLIFIER (Voidspawn boss: CLEANSE strips your buffs; DISRUPT jams your cards). A void-thing that
erases: one lidless eye inside two nested wireframe solids turning on different axes in real 3D (an
octahedron inside a cube), girdled by a broken null ring whose gaps creep round, with shards orbiting it.
Idle, 12 frames: the solids rotate (a full quarter-turn of the cube per loop, so it repeats seamlessly), the
ring turns the other way, the shards orbit, the eye's iris widens and narrows."""
import math
from lib import *

ID, N, FPS = "nullifier", 12, 8

def project(v, ax, ay, scale, cy):
    x, y, z = v
    # turn about y, then about x
    x, z = x * math.cos(ay) + z * math.sin(ay), -x * math.sin(ay) + z * math.cos(ay)
    y, z = y * math.cos(ax) - z * math.sin(ax), y * math.sin(ax) + z * math.cos(ax)
    f = 6.0 / (6.0 + z)                                   # gentle perspective
    return (x * scale * f, cy + y * scale * f)

def solid(verts, edges, ax, ay, scale, cy):
    pts = [project(v, ax, ay, scale, cy) for v in verts]
    return [[pts[a], pts[b]] for a, b in edges]

CUBE_V = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
CUBE_E = [(a, b) for a in range(8) for b in range(a + 1, 8) if sum(1 for k in range(3) if CUBE_V[a][k] != CUBE_V[b][k]) == 1]
OCT_V = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
OCT_E = [(a, b) for a in range(6) for b in range(a + 1, 6) if OCT_V[a] != tuple(-c for c in OCT_V[b])]

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    cy = -0.08 + 0.02 * wave(ph)

    # ---- the outer cube: a quarter turn per loop about the vertical, a fixed tilt so it reads as 3D ----
    P += solid(CUBE_V, CUBE_E, 0.52, f * math.pi / 2 + 0.3, 0.40, cy)
    # ---- the octahedron inside, turning the other way and faster (a half turn: it is symmetric under it) ----
    P += solid(OCT_V, OCT_E, -0.35 + 0.1 * wave(ph), -f * math.pi, 0.34, cy)

    # ---- the null ring: an ellipse girdling it, broken into arcs whose gaps creep round ----
    for k in range(4):
        a0 = k / 4 * 2 * math.pi - ph / 4
        P.append(arc(0, cy + 0.02, 0.82, a0, a0 + math.pi / 2 - 0.35, 10, 0.20))
    # tick marks on the ring, like a dial being zeroed
    for k in range(8):
        a = k / 8 * 2 * math.pi - ph / 4 + 0.2
        x, y = math.cos(a) * 0.82, cy + 0.02 + math.sin(a) * 0.20
        P.append([(x, y - 0.035), (x, y + 0.035)])

    # ---- shards in orbit: they pass behind and in front, shrinking with distance ----
    for k in range(5):
        a = k / 5 * 2 * math.pi + ph
        depth = math.sin(a)
        r = 0.66
        x, y = math.cos(a) * r, cy - 0.46 + math.sin(a) * 0.10 + k % 2 * 0.06
        sz = 0.05 + 0.02 * depth
        P.append([(x, y - sz * 1.6), (x + sz, y), (x, y + sz * 1.6), (x - sz, y), (x, y - sz * 1.6)])

    # ---- the eye at the centre: lids, an iris that widens and narrows ----
    open_ = 0.07 + 0.02 * pos(ph, 2)
    P.append([(-0.17, cy), (-0.08, cy - open_), (0.08, cy - open_), (0.17, cy), (0.08, cy + open_), (-0.08, cy + open_), (-0.17, cy)])
    P.append(ngon(0, cy, open_ * 0.7, 10))
    E.append((0.0, cy, 0.03))

    return pack(P, E)
