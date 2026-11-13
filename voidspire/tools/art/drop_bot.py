"""DROP BOT (Rust, tiny walker deployed by the Drop Ship). A box chassis with a visor, a stub antenna with a
light, two stub legs and two side arms, one of them a little blaster pointed at you. Idle: it marches on the
spot (legs alternate), the antenna wobbles, the visor eye scans."""
import math
from lib import *

ID, N, FPS = "drop_bot", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    st = math.sin(ph)
    y = 0.03 * abs(st)
    # legs, alternating
    for s, lift in ((-1, max(0, st)), (1, max(0, -st))):
        x = s * 0.18
        P.append(box(x - 0.08, 0.34 - y, x + 0.08, 0.66 - lift * 0.10))
        P.append([(x - 0.14, 0.80 - lift * 0.12), (x + 0.14, 0.80 - lift * 0.12), (x + 0.10, 0.66 - lift * 0.10), (x - 0.10, 0.66 - lift * 0.10), (x - 0.14, 0.80 - lift * 0.12)])
    # chassis
    P.append(box(-0.40, -0.34 - y, 0.40, 0.34 - y))
    P.append([(-0.30, -0.22 - y), (0.30, -0.22 - y), (0.30, -0.04 - y), (-0.30, -0.04 - y), (-0.30, -0.22 - y)])
    E.append((0.16 * math.sin(ph * 0.5 + 1), -0.13 - y, 0.05))
    P.append([(-0.26, 0.14 - y), (0.26, 0.14 - y)])
    P.append([(-0.26, 0.22 - y), (0.26, 0.22 - y)])
    # antenna
    wob = 0.08 * math.sin(ph * 2)
    P.append([(0.16, -0.34 - y), (0.16 + wob, -0.62 - y)])
    P.append(ngon(0.16 + wob, -0.66 - y, 0.04, 6))
    # arms: the blaster (left, toward you) and a claw
    P.append([(-0.40, -0.02 - y), (-0.58, 0.04 - y), (-0.58, 0.14 - y)])
    P.append(box(-0.86, 0.10 - y, -0.52, 0.20 - y))
    P.append([(0.40, -0.02 - y), (0.58, 0.10 - y), (0.56, 0.26 - y)])
    P.append([(0.56, 0.26 - y), (0.50, 0.34 - y)]); P.append([(0.56, 0.26 - y), (0.64, 0.34 - y)])
    return pack(P, E)
