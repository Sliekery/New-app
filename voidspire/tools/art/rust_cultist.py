"""RUST CULTIST (Rust, hits / guards / curses you with shrapnel). Two models, picked per spawn.
A: a hooded cyborg, a cog amulet on its breast, a cog-headed staff, a segmented mechadendrite arching over
its shoulder. Idle: the amulet turns, the mechadendrite sways and its claw opens, the staff head spins.
B (frame_alt): a masked zealot with a rebreather and hoses, a ring of cogs for a crown, a heavy wrench held
across its body. Idle: the crown cogs turn, the hoses breathe, the wrench rocks."""
import math
from lib import *

ID, N, FPS = "rust_cultist", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.015 * wave(ph)
    # robe and legs
    P.append([(-0.22, -0.30 + y), (-0.34, 0.50), (-0.20, 0.86), (0.20, 0.86), (0.34, 0.50), (0.22, -0.30 + y)])
    P.append([(0.0, -0.20 + y), (0.0, 0.86)])
    # hood
    P.append([(-0.24, -0.30 + y), (-0.24, -0.62 + y), (0.0, -0.86 + y), (0.24, -0.62 + y), (0.24, -0.30 + y)])
    P.append([(-0.14, -0.34 + y), (-0.14, -0.58 + y), (0.14, -0.58 + y), (0.14, -0.34 + y)])
    E.append((-0.05, -0.47 + y, 0.03)); E.append((0.06, -0.47 + y, 0.02))
    # cog amulet, turning
    P.append(gear(0.0, -0.08 + y, 0.10, 6, ph / 3))
    P.append(ngon(0.0, -0.08 + y, 0.04, 6, -ph / 3))
    # staff toward the player
    P.append([(-0.46, 0.86), (-0.46, -0.66 + y)])
    P.append(bone((-0.20, -0.22 + y), (-0.44, 0.02 + y), 0.045, 0.035))
    P.append(gear(-0.46, -0.74 + y, 0.14, 8, ph / 4))
    P.append(ngon(-0.46, -0.74 + y, 0.05, 6))
    # mechadendrite over the right shoulder
    sw = 0.18 * wave(ph, 1, 0.5)
    pts = chain((0.20, -0.30 + y), [-1.2 + sw * 0.4, -0.5 + sw, 0.4 + sw, 1.2 + sw], [0.18, 0.16, 0.14, 0.10])
    P.append(pts)
    for p in pts[1:-1]:
        P.append(ngon(p[0], p[1], 0.03, 6))
    tip = pts[-1]
    op = 0.3 + 0.3 * pos(ph, 1, 1.0)
    a = 1.2 + sw
    for s in (1, -1):
        P.append([tip, (tip[0] + math.cos(a + s * op) * 0.08, tip[1] + math.sin(a + s * op) * 0.08)])
    return pack(P, E)

def frame_alt(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.015 * wave(ph)
    # body: broad coat, belted
    P.append([(-0.26, -0.30 + y), (-0.36, 0.40), (-0.26, 0.86), (0.26, 0.86), (0.36, 0.40), (0.26, -0.30 + y)])
    P.append([(-0.34, 0.20), (0.34, 0.20)])
    P.append([(-0.10, 0.86), (-0.10, 0.50)]); P.append([(0.10, 0.86), (0.10, 0.50)])
    # head with rebreather mask
    hy = -0.30 + y
    P.append([(-0.16, hy), (-0.18, hy - 0.26), (0.0, hy - 0.34), (0.18, hy - 0.26), (0.16, hy)])
    P.append([(-0.14, hy - 0.20), (0.14, hy - 0.20)])
    E += [(-0.07, hy - 0.24, 0.025), (0.07, hy - 0.24, 0.025)]
    P.append(ngon(0.0, hy - 0.08, 0.07, 8))
    br = 0.03 * pos(ph)
    for s in (1, -1):                                  # breathing hoses to a tank on the back
        P.append([(s * 0.06, hy - 0.06), (s * (0.20 + br), hy + 0.06), (s * 0.24, hy + 0.20)])
    # crown of cogs, turning
    for k, (cx, r) in enumerate(((-0.14, 0.06), (0.0, 0.08), (0.14, 0.06))):
        P.append(gear(cx, hy - 0.40 - (0.03 if k == 1 else 0), r, 6, ph * (1 if k % 2 else -1) / 6))
    # wrench across the body, rocking
    rk = 0.12 * wave(ph, 1, 0.7)
    c = (0.0, 0.0 + y)
    P.append(rot([(-0.50, 0.30 + y), (0.38, -0.26 + y)], c, rk))
    P.append(rot([(-0.58, 0.24 + y), (-0.50, 0.30 + y), (-0.44, 0.40 + y), (-0.54, 0.46 + y)], c, rk))
    P.append(rot([(0.34, -0.36 + y), (0.38, -0.26 + y), (0.48, -0.24 + y), (0.46, -0.36 + y), (0.40, -0.40 + y)], c, rk))
    for s, hp in ((-1, (-0.26, 0.14)), (1, (0.20, -0.14))):
        P.append(bone((s * 0.26, -0.24 + y), rot([(hp[0], hp[1] + y)], c, rk)[0], 0.045, 0.035))
    return pack(P, E)
