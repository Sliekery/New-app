"""VOID LARVA (Voidspawn: a weak biter that grows stronger, and what the Brood Maw spits out). A soft
segmented grub: a lumpy swollen sac with a cluster of three eyes at its front, two twitching feelers and a row
of short tendril legs. Idle, 8 frames: the sac swells and squeezes like breathing, the legs ripple from front to
back, the feelers twitch, the eyes jitter."""
import math
from lib import *

ID, N, FPS = "void_larva", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    sw = 1.0 + 0.06 * wave(ph)
    y = 0.03 * wave(ph, 1, 1.0)
    # the sac: lumpy, swelling
    sac = []
    for k in range(25):
        a = k / 24 * 2 * math.pi
        rr = 0.50 + 0.05 * math.sin(a * 4 + 0.6) + 0.02 * math.sin(a * 7 + ph)
        sac.append((math.cos(a) * rr * sw * 1.1, y + math.sin(a) * rr * 0.80 / sw))
    P.append(sac)
    # segment rings across it
    for x in (-0.20, 0.06, 0.30):
        P.append(arc(x * sw, y, 0.10, -1.2, 1.2, 6, 0.36))
    # tendril legs underneath, rippling
    for k in range(5):
        bx = -0.36 + k * 0.18
        lift = 0.05 * max(0.0, math.sin(ph * 2 - k * 1.1))
        base = (bx * sw, y + 0.36)
        P.append([base, (bx * sw - 0.04, y + 0.52 - lift), (bx * sw - 0.10, y + 0.62 - lift * 0.5)])
    # feelers at the front (left)
    for s, off in ((1, 0.0), (-1, 1.3)):
        tw = 0.12 * math.sin(ph * 2 + off)
        base = (-0.46 * sw, y - 0.20 + s * 0.06)
        mid = (base[0] - 0.18, base[1] - 0.18 + s * 0.06 + tw * 0.4)
        tip = (mid[0] - 0.14, mid[1] - 0.06 + tw)
        P.append([base, mid, tip])
        P.append(ngon(tip[0], tip[1], 0.03, 5))
    # eye cluster at the front
    jit = 0.012 * math.sin(ph * 3)
    for ex, ey, r in ((-0.34, -0.10, 0.08), (-0.18, -0.20, 0.06), (-0.22, 0.04, 0.055)):
        P.append(ngon(ex * sw, y + ey, r, 8))
        E.append((ex * sw - 0.02 + jit, y + ey, r * 0.45))
    return pack(P, E)
