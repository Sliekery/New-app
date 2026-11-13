"""VOIDLING (Voidspawn: a tiny null-minion; damage it gets through can burrow a curse into your deck). A sharp
little shard of void: a faceted kite body with one eye, a crown of jagged spikes, and a drill-tipped tail it
burrows with, trailing tendrils. Idle, 8 frames: it bobs and tilts, the spikes flex, the tail drill turns and
the tendrils flick, the eye blinks once."""
import math
from lib import *

ID, N, FPS = "voidling", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.05 * wave(ph)
    tilt = 0.08 * wave(ph, 1, 0.8)
    c = (0.0, -0.10 + y)
    def t(pts):
        return rot(pts, c, tilt)
    body = [(0.0, -0.56 + y), (0.38, -0.18 + y), (0.20, 0.30 + y), (0.0, 0.40 + y), (-0.20, 0.30 + y), (-0.38, -0.18 + y), (0.0, -0.56 + y)]
    P.append(t(body))
    P.append(t([(0.0, -0.56 + y), (0.0, -0.30 + y), (0.38, -0.18 + y)]))
    P.append(t([(0.0, -0.30 + y), (-0.38, -0.18 + y)]))
    P.append(t([(-0.20, 0.30 + y), (0.0, 0.10 + y), (0.20, 0.30 + y)]))
    # spikes, flexing
    fl = 0.05 * wave(ph, 2)
    for bx, by, a, L in ((-0.38, -0.18, math.pi + 0.5, 0.26), (0.38, -0.18, -0.5, 0.26), (-0.20, -0.40, -2.2, 0.20),
                         (0.20, -0.40, -0.9, 0.20), (0.0, -0.56, -math.pi / 2, 0.22)):
        P.append(t(spike((bx, by + y), a, L + fl, 0.05)))
    # the eye, blinking on one frame
    if i == 5:
        P.append(t([(-0.12, -0.08 + y), (0.12, -0.08 + y)]))
    else:
        P.append(t(ngon(0.0, -0.08 + y, 0.11, 10, 0, 0.08)))
        ex, ey = R((-0.03, -0.08 + y), c, tilt)
        E.append((ex, ey, 0.05))
    # drill tail: a cone with turning bands
    tip = (0.0, 0.80 + y)
    P.append(t([(-0.10, 0.36 + y), tip, (0.10, 0.36 + y)]))
    for k in range(3):
        u = ((k / 3) + i / n) % 1.0
        yy = 0.40 + u * 0.36
        w = 0.10 * (1 - u)
        P.append(t([(-w, yy + y - 0.03), (w, yy + y + 0.03)]))
    # tendrils trailing
    for s in (1, -1):
        b = (s * 0.18, 0.30 + y)
        fk = 0.08 * math.sin(ph * 2 + (0 if s > 0 else 1.5))
        P.append(t([b, (s * 0.36, 0.46 + y + fk), (s * 0.40 + fk, 0.66 + y)]))
    return pack(P, E)
