"""THE UNMAKER (the finale: every cycle it erases your Shield, curses your deck, knits itself whole and grows).
A faction-less cosmic thing that ends the descent. A tall hooded figure whose hood holds no face, only a
vertical slit of an eye; three broken halos tilted in real 3D turn around its head; six long arms fan out from
under the mantle, each hand holding a fragment it is taking apart; below the waist it does not end, it comes
apart, its robe breaking into squares that fall away and fade. Idle, 16 frames: the halos turn, the arms drift
in a slow wave from top pair to bottom, the fragments in its hands crumble, the falling squares fall and fade
on a loop, the eye opens and narrows."""
import math
from lib import *

ID, N, FPS = "unmaker", 16, 8

def halo(r, tilt, spin, gap, cy, roll):
    """A ring in 3D seen nearly edge-on: radius r, its plane tipped `tilt` toward the viewer, turning by `spin`
    within that plane (the gap travels round, which is what makes it read as turning), then rolled in the picture
    plane so the three rings cross like a gyroscope."""
    pts = []
    for s in range(29):
        a = gap / 2 + s / 28 * (2 * math.pi - gap) + spin
        x, y = math.cos(a) * r, math.sin(a) * r * math.sin(tilt)
        pts.append(R((x, cy + y), (0.0, cy), roll))
    return pts

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.025 * wave(ph)

    # ---- the halos behind and around the head ----
    hc = -0.98 + y
    for k, (r, tilt, sp, roll) in enumerate([(0.36, 0.30, 1.0, 0.0), (0.46, 0.22, -1.0, 0.42), (0.46, 0.22, 1.0, -0.42)]):
        P.append(halo(r, tilt + 0.05 * wave(ph, 1, k), sp * ph + k * 2.0, 0.8, hc, roll + 0.04 * wave(ph, 1, k * 2)))

    # ---- the hood: tall, pointed, empty; the slit eye in the dark of it ----
    hood = [(-0.20, -0.66 + y), (-0.24, -0.92 + y), (-0.12, -1.16 + y), (0.0, -1.32 + y), (0.12, -1.16 + y), (0.24, -0.92 + y),
            (0.20, -0.66 + y)]
    P.append(hood)
    inner = [(-0.12, -0.70 + y), (-0.15, -0.92 + y), (-0.06, -1.10 + y), (0.0, -1.16 + y), (0.06, -1.10 + y), (0.15, -0.92 + y),
             (0.12, -0.70 + y)]
    P.append(inner)
    op = 0.02 + 0.03 * pos(ph, 1, 2.0)
    P.append([(0.0, -1.04 + y), (op, -0.94 + y), (0.0, -0.84 + y), (-op, -0.94 + y), (0.0, -1.04 + y)])
    E.append((0.0, -0.94 + y, 0.022))
    E.append((0.0, -1.06 + y, 0.012))                    # two cold stars above it, the only "face" it has
    E.append((0.0, -0.80 + y, 0.012))

    # ---- the mantle: wide, angular shoulders ----
    mantle = [(-0.20, -0.66 + y), (-0.56, -0.58 + y), (-0.72, -0.40 + y), (-0.44, -0.30 + y), (-0.30, -0.10 + y),
              (0.30, -0.10 + y), (0.44, -0.30 + y), (0.72, -0.40 + y), (0.56, -0.58 + y), (0.20, -0.66 + y)]
    P.append(mantle)
    P.append([(-0.20, -0.66 + y), (0.0, -0.40 + y), (0.20, -0.66 + y)])
    P.append([(0.0, -0.40 + y), (0.0, -0.10 + y)])
    # a sigil of an empty die face on the chest: a square with no pips
    P.append([(0.0, -0.34 + y), (0.10, -0.24 + y), (0.0, -0.14 + y), (-0.10, -0.24 + y), (0.0, -0.34 + y)])

    # ---- six arms, a slow wave running down them; each hand unmaking a fragment ----
    for s in (1, -1):
        for k, (sy, a0, l1, l2) in enumerate([(-0.48, -0.55, 0.26, 0.24), (-0.36, -0.05, 0.28, 0.24), (-0.24, 0.45, 0.24, 0.22)]):
            d = 0.12 * wave(ph, 1, -k * 0.9 + (0 if s > 0 else math.pi))
            sh = (s * 0.50, sy + y)
            a1 = a0 + d
            a2 = a1 + 0.35 + 0.05 * wave(ph, 1, k)
            pts = chain(sh, [a1 if s > 0 else math.pi - a1, a2 if s > 0 else math.pi - a2], [l1, l2])
            P.append(bone(pts[0], pts[1], 0.035, 0.025))
            P.append(bone(pts[1], pts[2], 0.025, 0.015))
            hx, hy = pts[2]
            # fingers splayed around the fragment
            for fk in range(3):
                fa = (a2 if s > 0 else math.pi - a2) + (fk - 1) * 0.5
                P.append([(hx, hy), (hx + math.cos(fa) * 0.07, hy + math.sin(fa) * 0.07)])
            # the fragment: a square coming apart into smaller squares that drift off
            cr = (f + k * 0.29 + (0.5 if s < 0 else 0)) % 1.0
            sz = 0.06 * (1 - cr * 0.5)
            fx, fy = hx + s * 0.08, hy - 0.04
            P.append(rot(box(fx - sz, fy - sz, fx + sz, fy + sz), (fx, fy), ph * 0.5 + k))
            for c in range(2):
                dd = (cr + c * 0.5) % 1.0
                q = 0.018 * (1 - dd)
                if q > 0.004:
                    cx, cy = fx + s * (0.06 + dd * 0.18), fy - 0.02 - dd * 0.10 + c * 0.05
                    P.append(box(cx - q, cy - q, cx + q, cy + q))

    # ---- the body below the waist: a robe that comes apart into falling squares ----
    P.append([(-0.30, -0.10 + y), (-0.40, 0.30 + y)])
    P.append([(0.30, -0.10 + y), (0.40, 0.30 + y)])
    for k in range(7):                                    # the robe's ragged lower edge, already breaking up
        x = -0.40 + k * 0.1333
        P.append([(x, 0.30 + y), (x + 0.066, 0.36 + y + 0.04 * (k % 2)), (x + 0.1333, 0.30 + y)])
    for k in range(4):
        P.append([(-0.24 + k * 0.16, -0.06 + y), (-0.28 + k * 0.186, 0.28 + y)])
    for k in range(14):                                   # the falling squares: a loop, so they never run out
        col = (k * 5) % 7
        dd = (f + (k * 0.618) % 1.0) % 1.0
        x = -0.36 + col * 0.12 + 0.02 * math.sin(k * 3.1 + dd * 4)
        yy = 0.40 + y + dd * 0.62
        q = 0.035 * (1 - dd) + 0.006
        P.append(rot(box(x - q, yy - q, x + q, yy + q), (x, yy), dd * 2 + k))

    # it was drawn standing a little tall for its box: bring the hood's point down out of the health bar
    P = [T(q, 0, 0.16) for q in P]
    E = [(x, y2 + 0.16, d) for x, y2, d in E]
    return pack(P, E)
