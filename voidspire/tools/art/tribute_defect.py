"""THE DERELICT (final boss for an engine deck: disrupts your cards, then builds Strength). An abandoned
satellite that came back wrong: a cracked dish for a head with a receiver spike and one scanning lamp, a boxy
bus body with hatches blown open, two solar wings with cells missing, torn cables hanging and sparking, a
beacon blinking on its mast, drifting on thruster puffs. Idle, 12 frames: the dish turns a little and the lamp
sweeps, the wings flex on their booms, the cables swing and spark, the beacon blinks, the thrusters puff."""
import math
from lib import *

ID, N, FPS = "tribute_defect", 12, 8

MISSING = {(0, 1), (1, 3), (2, 0), (0, 4), (2, 2), (1, 0)}

def wing(s, y, flex):
    out = []
    root = (s * 0.34, -0.10 + y)
    tip_y = -0.10 + y + flex
    out.append([root, (s * 0.46, -0.10 + y + flex * 0.2)])          # the boom
    x0, x1 = s * 0.46, s * 0.98
    ya0, ya1 = -0.30 + y + flex * 0.2, -0.30 + y + flex
    yb0, yb1 = 0.10 + y + flex * 0.2, 0.10 + y + flex
    out.append([(x0, ya0), (x1, ya1), (x1, yb1), (x0, yb0), (x0, ya0)])
    for c in range(1, 5):                                           # cell columns
        t = c / 5
        out.append([(x0 + (x1 - x0) * t, ya0 + (ya1 - ya0) * t), (x0 + (x1 - x0) * t, yb0 + (yb1 - yb0) * t)])
    for r in (1, 2):
        t = r / 3
        out.append([(x0, ya0 + (yb0 - ya0) * t), (x1, ya1 + (yb1 - ya1) * t)])
    # missing cells: a cross through each
    for (r, c) in MISSING:
        u0, u1 = c / 5, (c + 1) / 5
        v0, v1 = r / 3, (r + 1) / 3
        def at(u, v):
            xa, xb = x0 + (x1 - x0) * u, x0 + (x1 - x0) * u
            top = ya0 + (ya1 - ya0) * u
            bot = yb0 + (yb1 - yb0) * u
            return (xa, top + (bot - top) * v)
        if (s > 0) == ((r + c) % 2 == 0):
            out.append([at(u0, v0), at(u1, v1)])
            out.append([at(u1, v0), at(u0, v1)])
    return out

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.04 * wave(ph)

    # ---- solar wings ----
    for s, off in ((1, 0.0), (-1, 0.9)):
        P += wing(s, y, 0.05 * wave(ph, 1, off))

    # ---- the bus: a box with its hatches blown ----
    P.append(box(-0.34, -0.40 + y, 0.34, 0.30 + y))
    P.append(box(-0.26, -0.32 + y, 0.26, 0.22 + y))
    P.append([(-0.26, -0.06 + y), (0.26, -0.06 + y)])
    # a hatch hanging open on one hinge, swinging
    ha = 0.9 + 0.10 * wave(ph, 1, 0.5)
    hinge = (-0.22, 0.04 + y)
    P.append([hinge, R((0.02, 0.04 + y), hinge, ha), R((0.02, 0.18 + y), hinge, ha), R((-0.22, 0.18 + y), hinge, ha)])
    # exposed circuitry behind it
    for k in range(3):
        P.append([(-0.18 + k * 0.08, 0.02 + y), (-0.18 + k * 0.08, 0.10 + y), (-0.14 + k * 0.08, 0.14 + y)])
    # rivets and panel lines
    for x in (-0.30, 0.30):
        for yy in (-0.36, 0.26):
            P.append(ngon(x, yy + y, 0.012, 6))
    for k in range(3):
        P.append([(0.06 + k * 0.06, -0.26 + y), (0.06 + k * 0.06, -0.12 + y)])

    # ---- the dish head, turning a little; receiver spike; the scanning lamp ----
    turn = 0.14 * wave(ph, 1, 0.3)
    dc = (0.0, -0.62 + y)
    rim = []
    for k in range(17):
        a = math.pi + k / 16 * math.pi
        rim.append((dc[0] + math.cos(a) * 0.36 * math.cos(turn), dc[1] + 0.06 + math.sin(a) * 0.22))
    P.append(rim)
    P.append([rim[0], (dc[0], dc[1] + 0.12), rim[-1]])
    P.append([(dc[0] - 0.05, dc[1] + 0.12), (dc[0] - 0.05, -0.40 + y)])
    P.append([(dc[0] + 0.05, dc[1] + 0.12), (dc[0] + 0.05, -0.40 + y)])
    # a crack across the dish
    P.append([(dc[0] - 0.20 * math.cos(turn), dc[1] - 0.06), (dc[0] - 0.10 * math.cos(turn), dc[1] - 0.02),
              (dc[0] - 0.12 * math.cos(turn), dc[1] + 0.04), (dc[0] - 0.02 * math.cos(turn), dc[1] + 0.08)])
    sp = (dc[0] + math.sin(turn) * 0.12, dc[1] - 0.10)
    P.append([(dc[0], dc[1] + 0.02), sp, (sp[0] + math.sin(turn) * 0.06, sp[1] - 0.14)])
    for s in (1, -1):
        P.append([(dc[0] + s * 0.24 * math.cos(turn), dc[1] - 0.06), sp])
    sweep = 0.12 * math.sin(ph)
    E.append((dc[0] + sweep, dc[1] + 0.03, 0.035))
    P.append([(dc[0] + sweep - 0.05, dc[1] + 0.03), (dc[0] + sweep + 0.05, dc[1] + 0.03)])

    # ---- beacon mast on the right shoulder: blinking ----
    P.append([(0.26, -0.40 + y), (0.30, -0.72 + y)])
    P.append([(0.26, -0.72 + y), (0.34, -0.72 + y)])
    if i % 4 < 2:
        E.append((0.30, -0.78 + y, 0.03))
        for k in range(4):
            a = k / 4 * 2 * math.pi + math.pi / 4
            P.append([(0.30 + math.cos(a) * 0.06, -0.78 + y + math.sin(a) * 0.06), (0.30 + math.cos(a) * 0.10, -0.78 + y + math.sin(a) * 0.10)])
    else:
        P.append(ngon(0.30, -0.78 + y, 0.025, 6))

    # ---- torn cables hanging from the underside, swinging; a spark on the live one ----
    for k, (x, ln, off) in enumerate(((-0.20, 0.36, 0.0), (0.02, 0.48, 1.3), (0.20, 0.30, 2.6))):
        a = 0.20 * wave(ph, 1, off)
        pts = chain((x, 0.30 + y), [math.pi / 2 + a * 0.4, math.pi / 2 + a, math.pi / 2 + a * 1.5], [ln / 3] * 3)
        P.append(pts)
        end = pts[-1]
        P.append([(end[0] - 0.03, end[1]), (end[0] + 0.03, end[1] + 0.04)])
        if k == 1 and i % 3 == 0:
            for j in range(3):
                b = -math.pi / 2 + (j - 1) * 0.9 + i
                P.append([end, (end[0] + math.cos(b) * 0.09, end[1] + math.sin(b) * 0.09)])

    # ---- thrusters under the wings' roots: puffing ----
    for s, off in ((1, 0.0), (-1, 0.5)):
        nz = (s * 0.30, 0.30 + y)
        P.append([(nz[0] - 0.05, nz[1]), (nz[0] - 0.07, nz[1] + 0.06), (nz[0] + 0.07, nz[1] + 0.06), (nz[0] + 0.05, nz[1])])
        d = (f * 2 + off) % 1.0
        P.append(ngon(nz[0], nz[1] + 0.12 + d * 0.20, 0.02 + 0.04 * d, 6, d * 3))
    return pack(P, E)
