"""THE NIGHTSHADE (final boss for an aggro deck: thorns, Weak, Burn). A carnivorous briar-sentinel: a huge
nightshade flower for a head whose five petals open on a throat of needle teeth and a single pistil-eye,
standing on a knotted stem-body, two thorned vine arms coiling out, a skirt of roots, berries of venom hanging
from its shoulders. Idle, 12 frames: the petals breathe open and shut, the pistil eye sways, the vines coil and
uncoil, the berries swing and drip."""
import math
from lib import *

ID, N, FPS = "tribute_silent", 12, 8

def vine(base, a0, length, ph, off, s):
    angs, a = [], a0
    for k in range(8):
        a += s * (0.16 + 0.10 * math.sin(ph + off)) * (k / 7)
        angs.append(a)
    pts = chain(base, angs, [length / 8] * 8)
    out = [pts]
    for k in range(1, 8, 2):                               # thorns along the outside of the curl
        p, q = pts[k], pts[k + 1]
        a = math.atan2(q[1] - p[1], q[0] - p[0]) - s * math.pi / 2
        out.append([p, (p[0] + math.cos(a) * 0.06, p[1] + math.sin(a) * 0.06), q])
    return out, pts[-1]

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.02 * wave(ph)
    bloom = pos(ph)

    # ---- roots: a skirt of them splaying into the ground ----
    for k in range(7):
        x0 = -0.18 + k * 0.06
        x1 = -0.60 + k * 0.20
        P.append([(x0, 0.40), ((x0 + x1) / 2 + 0.04 * math.sin(k * 2.1), 0.58), (x1, 0.78 + 0.03 * (k % 2))])

    # ---- the stem-body: knotted, twisting up ----
    for s in (1, -1):
        P.append([(s * 0.16, 0.42), (s * 0.10, 0.20 + y), (s * 0.16, -0.02 + y), (s * 0.08, -0.24 + y), (s * 0.10, -0.38 + y)])
    for yy in (0.24, -0.06):
        P.append(ngon(0.0, yy + y, 0.10, 8, 0, 0.04))
    # leaves at the shoulders
    for s in (1, -1):
        leaf = [(0.08, -0.30 + y), (0.30, -0.42 + y), (0.46, -0.36 + y), (0.30, -0.26 + y), (0.08, -0.30 + y)]
        P.append(leaf if s > 0 else mx(leaf))
        P.append([(s * 0.08, -0.30 + y), (s * 0.40, -0.36 + y)])

    # ---- vine arms ----
    for s, off in ((1, 0.0), (-1, 1.9)):
        out, tip = vine((s * 0.12, -0.10 + y), math.pi / 2 - s * 1.55, 0.86, ph, off, s)
        P += out
        P.append(ngon(tip[0], tip[1], 0.03, 5))

    # ---- venom berries hanging under the leaves, swinging, dripping ----
    for s, off in ((1, 0.4), (-1, 2.4)):
        a = 0.18 * wave(ph, 1, off)
        top = (s * 0.32, -0.30 + y)
        b = (top[0] + math.sin(a) * 0.20, top[1] + math.cos(a) * 0.20)
        P.append([top, b])
        P.append(ngon(b[0], b[1] + 0.05, 0.05, 8))
        d = (f + (0.5 if s < 0 else 0.0)) % 1.0
        if d > 0.3:
            dy = (d - 0.3) / 0.7
            P.append(ngon(b[0], b[1] + 0.13 + dy * 0.34, 0.016 * (1 - dy) + 0.006, 5, 0, 0.026 * (1 - dy) + 0.008))

    # ---- the flower head: five petals opening on a throat of needle teeth ----
    hc = (0.0, -0.66 + y)
    open_ = 0.55 + 0.30 * bloom
    for k in range(5):
        a = -math.pi / 2 + (k - 2) * 0.62 * open_ + (0.0 if k != 2 else 0.0)
        base_l = (hc[0] + math.cos(a - 0.30) * 0.12, hc[1] + math.sin(a - 0.30) * 0.12)
        base_r = (hc[0] + math.cos(a + 0.30) * 0.12, hc[1] + math.sin(a + 0.30) * 0.12)
        L = 0.40 if k != 2 else 0.30
        mid_l = (hc[0] + math.cos(a - 0.22) * L * 0.75, hc[1] + math.sin(a - 0.22) * L * 0.75)
        mid_r = (hc[0] + math.cos(a + 0.22) * L * 0.75, hc[1] + math.sin(a + 0.22) * L * 0.75)
        tip = (hc[0] + math.cos(a) * L, hc[1] + math.sin(a) * L)
        curl = (tip[0] + math.cos(a + 1.6) * 0.05, tip[1] + math.sin(a + 1.6) * 0.05)
        P.append([base_l, mid_l, tip, curl, mid_r, base_r])
        P.append([(hc[0] + math.cos(a) * 0.12, hc[1] + math.sin(a) * 0.12), (hc[0] + math.cos(a) * L * 0.8, hc[1] + math.sin(a) * L * 0.8)])
    # lower sepals, fixed, framing the mouth from below
    for s in (1, -1):
        sep = [(0.06, -0.56 + y), (0.26, -0.48 + y), (0.12, -0.60 + y)]
        P.append(sep if s > 0 else mx(sep))
    # the throat ring and its teeth, teeth lengthening as it opens
    P.append(ngon(hc[0], hc[1], 0.13, 14))
    for k in range(10):
        a = k / 10 * 2 * math.pi
        r0, r1 = 0.13, 0.13 - (0.04 + 0.03 * bloom)
        P.append([(hc[0] + math.cos(a - 0.12) * r0, hc[1] + math.sin(a - 0.12) * r0),
                  (hc[0] + math.cos(a) * r1, hc[1] + math.sin(a) * r1),
                  (hc[0] + math.cos(a + 0.12) * r0, hc[1] + math.sin(a + 0.12) * r0)])
    # the pistil: a stalk with one eye, swaying
    sw = 0.03 * wave(ph, 1, 1.2)
    P.append([hc, (hc[0] + sw, hc[1] - 0.03)])
    E.append((hc[0] + sw, hc[1] - 0.03, 0.04))
    return pack(P, E)
