"""THE DEVOURER (Voidspawn boss: IT KNITS ITSELF WHOLE: regenerates every turn and drains your life). A gravemind
head: a vast swollen skull-mass crowned with spikes, many eyes across its brow, a jaw hanging open on two rows
of teeth, the whole thing stitched together with sinew threads where it heals; spore sacs on its flanks and
tentacles trailing beneath. Idle, 12 frames: the jaw chews, the sacs swell and empty, the stitches tighten,
the tentacles writhe, the eyes roll."""
import math
from lib import *

ID, N, FPS = "devourer", 12, 8

def tentacle(base, a0, length, ph, off, segs=7):
    angs, a = [], a0
    for k in range(segs):
        a += 0.10 * math.sin(ph + off + k * 0.8)
        angs.append(a)
    pts = chain(base, angs, [length / segs] * segs)
    left, right = [], []
    for k, p in enumerate(pts):
        w = 0.04 * (1 - k / len(pts)) + 0.005
        a = angs[min(k, segs - 1)]
        left.append((p[0] - math.sin(a) * w, p[1] + math.cos(a) * w))
        right.append((p[0] + math.sin(a) * w, p[1] - math.cos(a) * w))
    return left + right[::-1]

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.02 * wave(ph)
    chew = pos(ph, 2)

    # ---- tentacles beneath ----
    for k, (bx, a0, ln) in enumerate([(-0.40, 1.95, 0.55), (-0.16, 1.65, 0.62), (0.16, 1.50, 0.62), (0.40, 1.20, 0.55)]):
        P.append(tentacle((bx, 0.52 + y), a0, ln, ph, k * 1.6))

    # ---- the skull-mass: lumpy and swollen, wider at the brow ----
    mass = []
    for k in range(21):
        a = math.pi + k / 20 * math.pi
        rr = 0.78 + 0.05 * math.sin(k * 2.3) + 0.01 * wave(ph, 1, k)
        mass.append((math.cos(a) * rr, -0.06 + y + math.sin(a) * rr * 0.80))
    mass += [(0.74, 0.10 + y), (0.56, 0.36 + y), (0.36, 0.30 + y)]
    mass = [(-0.36, 0.30 + y), (-0.56, 0.36 + y), (-0.74, 0.10 + y)] + mass
    P.append(mass)

    # ---- crown of spikes along the top ----
    for k in range(7):
        a = math.pi + (k + 1) / 8 * math.pi
        bx, by = math.cos(a) * 0.74, -0.06 + y + math.sin(a) * 0.74 * 0.80
        P.append(spike((bx, by), (a + math.pi / 2) * 0.9, 0.16 + (0.08 if k == 3 else 0.0), 0.04))

    # ---- stitches: sinew threads across old wounds, tightening as it heals ----
    tight = 0.01 * pos(ph, 1, 1.0)
    for (x0, y0, x1, y1) in ((-0.56, -0.40, -0.30, -0.18), (0.34, -0.48, 0.58, -0.22)):
        P.append([(x0, y0 + y), (x1, y1 + y)])
        for k in range(4):
            t = (k + 0.5) / 4
            cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + y
            nx, ny = -(y1 - y0), (x1 - x0)
            l = math.hypot(nx, ny)
            nx, ny = nx / l * (0.05 - tight), ny / l * (0.05 - tight)
            P.append([(cx - nx, cy - ny), (cx + nx, cy + ny)])

    # ---- eyes across the brow, rolling ----
    for k, (ex, ey, sz) in enumerate([(-0.40, -0.34, 0.05), (-0.16, -0.46, 0.06), (0.12, -0.46, 0.06), (0.36, -0.34, 0.05),
                                      (-0.02, -0.62, 0.035)]):
        P.append(ngon(ex, ey + y, sz + 0.035, 10, 0, (sz + 0.035) * 0.8))
        rx, ry = 0.02 * math.sin(ph + k * 1.1), 0.012 * math.cos(ph + k * 1.1)
        E.append((ex + rx, ey + y + ry, sz * 0.7))

    # ---- the jaw: upper teeth fixed to the mass, the lower jaw hanging and chewing ----
    uy = -0.16 + y
    P.append([(-0.50, uy), (0.50, uy)])
    for k in range(10):
        x = -0.45 + k * 0.10
        P.append([(x - 0.04, uy), (x, uy + 0.12), (x + 0.04, uy)])
    for k in range(8):                                             # the second, inner row
        x = -0.35 + k * 0.10
        P.append([(x - 0.03, uy + 0.02), (x, uy + 0.08), (x + 0.03, uy + 0.02)])
    ly = 0.10 + y + 0.10 * chew
    jaw = [(-0.52, uy + 0.02), (-0.46, ly + 0.08), (-0.20, ly + 0.20), (0.20, ly + 0.20), (0.46, ly + 0.08), (0.52, uy + 0.02)]
    P.append(jaw)
    P.append([(-0.44, ly), (0.44, ly)])
    for k in range(9):
        x = -0.40 + k * 0.10
        P.append([(x - 0.04, ly), (x, ly - 0.11), (x + 0.04, ly)])
    # drool strands between the jaws, stretching as it opens
    for x in (-0.22, 0.18):
        P.append([(x, uy + 0.12), (x + 0.02, (uy + ly) / 2 + 0.04), (x, ly - 0.06)])

    # ---- spore sacs on the flanks, swelling and emptying ----
    for s, off in ((1, 0.0), (-1, 1.7)):
        sw = 0.10 + 0.04 * pos(ph, 1, off)
        cx, cy = s * 0.80, 0.14 + y
        P.append(ngon(cx, cy, sw, 12, 0, sw * 1.2))
        P.append(ngon(cx, cy, sw * 0.5, 8, ph, sw * 0.6))
        if pos(ph, 1, off) < 0.25:                                 # a puff of spores as it empties
            for k in range(3):
                a = -math.pi / 2 + (k - 1) * 0.5
                P.append(ngon(cx + math.cos(a) * 0.22, cy + math.sin(a) * 0.22, 0.015, 5))

    return pack(P, E)
