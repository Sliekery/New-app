"""THE MAW (Voidspawn boss: ABSORB caps big hits and jams your deck with Void Swarm; regenerates; spawns larvae).
A floating mouth of the void: a fleshy rim around rings of hooked teeth spiralling down into a throat, a cluster
of eyes along the top of the rim, tentacles trailing below and to the sides. Idle, 12 frames: the mouth breathes
open and shut, the inner ring of teeth turns against the outer, the tentacles undulate, the eyes drift."""
import math
from lib import *

ID, N, FPS = "the_maw", 12, 8

def tentacle(base, a0, length, ph, off, segs=7, curl=0.5):
    angs, a = [], a0
    for k in range(segs):
        a += curl * 0.12 * math.sin(ph + off + k * 0.7)
        angs.append(a)
    pts = chain(base, angs, [length / segs] * segs)
    # a tapered outline rather than a single stroke, so it reads as flesh
    left, right = [], []
    for k, p in enumerate(pts):
        w = 0.035 * (1 - k / len(pts)) + 0.004
        a = angs[min(k, segs - 1)]
        left.append((p[0] - math.sin(a) * w, p[1] + math.cos(a) * w))
        right.append((p[0] + math.sin(a) * w, p[1] - math.cos(a) * w))
    return [left + right[::-1]]

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    drift = 0.02 * wave(ph)
    cy = -0.10 + drift
    breath = pos(ph)
    ry = 0.46 + 0.04 * breath                                  # the rim stretches as it opens

    # ---- tentacles first, behind the rim ----
    for k, (bx, a0, ln) in enumerate([(-0.46, 1.9, 0.70), (-0.22, 1.7, 0.80), (0.22, 1.45, 0.80), (0.46, 1.25, 0.70),
                                      (-0.62, 2.5, 0.46), (0.62, 0.65, 0.46)]):
        base = (bx, cy + (0.36 if abs(bx) < 0.5 else 0.20))
        P += tentacle(base, a0, ln, ph, k * 1.3)

    # ---- the rim: a thick lip, lumpy, around the mouth ----
    rim, rim_in = [], []
    for k in range(25):
        a = k / 24 * 2 * math.pi
        bump = 0.03 * math.sin(a * 7 + ph * 0.5)
        rim.append((math.cos(a) * (0.62 + bump), cy + math.sin(a) * (ry + bump)))
        rim_in.append((math.cos(a) * 0.50, cy + math.sin(a) * (ry - 0.10)))
    P += [rim, rim_in]

    # ---- teeth: an outer ring pointing in, an inner ring turning the other way ----
    for ring, r, count, ln, turn in ((0, 0.50, 16, 0.12, 0.0), (1, 0.33, 12, 0.10, -ph / 6)):
        k_ry = (ry - 0.10) / 0.50
        for k in range(count):
            a = k / count * 2 * math.pi + turn + (0.0 if ring == 0 else ph / 12)
            bx, by = math.cos(a) * r, cy + math.sin(a) * r * k_ry
            tip_r = r - ln * (0.6 + 0.4 * breath)
            hook = 0.25
            tx, ty = math.cos(a + hook) * tip_r, cy + math.sin(a + hook) * tip_r * k_ry
            w = 0.05
            P.append([(math.cos(a - w) * r, cy + math.sin(a - w) * r * k_ry), (tx, ty),
                      (math.cos(a + w) * r, cy + math.sin(a + w) * r * k_ry)])
        if ring == 1:
            P.append(ngon(0, cy, r, 24, 0, r * k_ry))

    # ---- the throat: spiralling down into nothing ----
    sp = []
    for k in range(40):
        f = k / 39
        a = f * 4 * math.pi + ph / 2
        rr = 0.20 * (1 - f) + 0.02
        sp.append((math.cos(a) * rr, cy + math.sin(a) * rr * 0.9))
    P.append(sp)

    # ---- eyes clustered on the top of the rim, each on a little stalk ----
    for k, (ex, stalk, sz) in enumerate([(-0.36, 0.10, 0.03), (-0.14, 0.16, 0.04), (0.10, 0.18, 0.045),
                                         (0.32, 0.12, 0.03), (0.0, 0.08, 0.025)]):
        base_y = cy - ry * math.sqrt(max(0.0, 1 - (ex / 0.62) ** 2)) - 0.02
        sway = 0.04 * math.sin(ph + k * 1.4)
        top = (ex + sway, base_y - stalk)
        P.append([(ex, base_y), ((ex + top[0]) / 2 + sway * 0.3, (base_y + top[1]) / 2), top])
        P.append(ngon(top[0], top[1], sz + 0.02, 8))
        E.append((top[0], top[1], sz))

    # drawn a size small; grow it to fill the box like the other bosses
    k = 1.14
    return pack([S(q, (0, 0), k) for q in P], [(x * k, y * k, d) for x, y, d in E])
