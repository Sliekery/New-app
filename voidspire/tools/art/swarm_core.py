"""SWARM CORE (Rust, summons drones, then fires once per living drone). A carrier hub: a ring hull with a
central emitter eye, an antenna mast, twin dish-arms and four docking clamps, with little guide lights
circling it like drones on approach. Idle: the dishes turn, the clamps open and close, the approach lights
orbit, the emitter pulses."""
import math
from lib import *

ID, N, FPS = "swarm_core", 8, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.03 * wave(ph)
    c = (0.0, y)
    P.append(ngon(0, y, 0.40, 16))
    P.append(ngon(0, y, 0.28, 16))
    em = 0.12 + 0.03 * pos(ph, 2)
    P.append(ngon(0, y, em, 10, ph / 2))
    E.append((0.0, y, 0.04))
    # mast
    P.append([(0, -0.40 + y), (0, -0.78 + y)])
    P.append([(-0.10, -0.64 + y), (0.10, -0.64 + y)])
    if i % 4 < 2:
        E.append((0.0, -0.82 + y, 0.025))
    # dish arms, turning
    for s, off in ((1, 0.0), (-1, math.pi)):
        base = (s * 0.40, -0.06 + y)
        tip = (s * 0.62, -0.20 + y)
        P.append([base, tip])
        tw = math.cos(ph + off)
        dish = [(tip[0] + s * 0.04 * tw + math.cos(a) * 0.04 * abs(tw), tip[1] + math.sin(a) * 0.14) for a in [k / 10 * 2 * math.pi for k in range(11)]]
        P.append(dish)
        P.append([tip, (tip[0] + s * 0.10 * tw, tip[1])])
    # docking clamps on the lower ring
    for k in range(4):
        a = math.pi / 2 + (k - 1.5) * 0.55
        bx, by = math.cos(a) * 0.40, y + math.sin(a) * 0.40
        op = 0.10 + 0.10 * pos(ph, 1, k)
        for side in (1, -1):
            aa = a + side * op
            P.append([(bx, by), (bx + math.cos(aa) * 0.14, by + math.sin(aa) * 0.14), (bx + math.cos(a) * 0.18, by + math.sin(a) * 0.18 + 0.0)])
    # approach lights orbiting
    for k in range(3):
        a = ph + k * 2 * math.pi / 3
        x, yy = math.cos(a) * 0.80, y + math.sin(a) * 0.22
        P.append(box(x - 0.035, yy - 0.025, x + 0.035, yy + 0.025))
    return pack(P, E)
