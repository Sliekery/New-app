"""IRON BUTCHER (Rust elite, THE CLEAVER: strikes twice if you played fewer than 3 cards last turn). A hunched
abattoir mech: horned head low between its shoulders, a vented furnace chest, a plate apron, a huge notched
cleaver lifted in its left hand toward you and a meat hook on a chain swinging from the right. Idle, 12
frames: the cleaver lifts and taps down impatiently, the hook swings, steam puffs from the chest vents, the
eyes flare."""
import math
from lib import *

ID, N, FPS = "iron_butcher", 12, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.015 * wave(ph)

    # ---- legs, bowed ----
    for s in (1, -1):
        for q in ([(0.12, 0.42), (0.32, 0.44), (0.40, 0.66), (0.30, 0.86), (0.12, 0.86), (0.18, 0.64), (0.12, 0.42)],
                  [(0.06, 0.86), (0.42, 0.86), (0.44, 0.94), (0.04, 0.94), (0.06, 0.86)]):
            P.append(q if s > 0 else mx(q))

    # ---- body: hunched barrel, apron ----
    body = [(-0.40, 0.44 + y), (-0.50, 0.0 + y), (-0.46, -0.34 + y), (-0.24, -0.50 + y), (0.24, -0.50 + y), (0.46, -0.34 + y),
            (0.50, 0.0 + y), (0.40, 0.44 + y), (-0.40, 0.44 + y)]
    P.append(body)
    apron = [(-0.26, 0.02 + y), (0.26, 0.02 + y), (0.30, 0.56 + y), (-0.30, 0.56 + y), (-0.26, 0.02 + y)]
    P.append(apron)
    P.append([(-0.28, 0.30 + y), (0.28, 0.30 + y)])
    # chest vents with steam
    for k, x in enumerate((-0.16, 0.0, 0.16)):
        P.append([(x - 0.04, -0.30 + y), (x + 0.04, -0.30 + y), (x + 0.04, -0.12 + y), (x - 0.04, -0.12 + y), (x - 0.04, -0.30 + y)])
        P.append([(x - 0.04, -0.21 + y), (x + 0.04, -0.21 + y)])
    for k in range(2):
        d = (f * 1.5 + k * 0.5) % 1.0
        P.append(ngon(0.30 + d * 0.10, -0.40 + y - d * 0.30, 0.03 + d * 0.05, 7, d * 3))

    # ---- the head: low, horned, between the shoulders ----
    hy = -0.50 + y
    P.append([(-0.14, hy), (-0.16, hy - 0.14), (-0.08, hy - 0.20), (0.08, hy - 0.20), (0.16, hy - 0.14), (0.14, hy)])
    fl = 0.022 + 0.01 * pos(ph, 2)
    E += [(-0.06, hy - 0.10, fl), (0.06, hy - 0.10, fl)]
    P.append([(-0.08, hy - 0.04), (0.08, hy - 0.04)])
    for s in (1, -1):
        horn = [(0.12, hy - 0.16), (0.26, hy - 0.24), (0.30, hy - 0.38), (0.22, hy - 0.26), (0.08, hy - 0.20)]
        P.append(horn if s > 0 else mx(horn))

    # ---- left arm (toward the player): the cleaver held up, lifting and tapping down ----
    lift = pos(ph, 1, 0.0) ** 2
    sh = (-0.46, -0.30 + y)
    el = (-0.64, -0.06 + y)
    P.append(bone(sh, el, 0.07, 0.055))
    P.append(ngon(el[0], el[1], 0.05, 6))
    hand = (-0.62, -0.30 + y - 0.06 * lift)
    P.append(bone(el, hand, 0.055, 0.045))
    a = -0.18 * lift                                     # the blade tips toward you as it lifts
    def cl(pts):
        return rot([(hand[0] + p[0], hand[1] + p[1]) for p in pts], hand, a)
    P.append(cl([(0.0, 0.04), (0.0, -0.16)]))                                       # the handle through the fist
    P.append(cl([(0.04, -0.16), (0.04, -0.52), (-0.30, -0.56), (-0.32, -0.16), (0.04, -0.16)]))   # the blade
    P.append(cl([(-0.24, -0.20), (-0.26, -0.50)]))                                  # the bevel of the edge
    for k in range(3):                                   # notches hacked in the edge
        yy = -0.24 - k * 0.11
        P.append(cl([(-0.32, yy), (-0.28, yy - 0.03), (-0.32, yy - 0.06)]))
    E.append(R((hand[0] - 0.02, hand[1] - 0.46), hand, a) + (0.02,))

    # ---- right arm: the meat hook on a chain, swinging ----
    shr = (0.46, -0.30 + y)
    elr = (0.66, -0.06 + y)
    P.append(bone(shr, elr, 0.07, 0.055))
    P.append(ngon(elr[0], elr[1], 0.05, 6))
    fist = (0.70, 0.18 + y)
    P.append(bone(elr, fist, 0.055, 0.045))
    sw = 0.30 * wave(ph, 1, 1.0)
    links = []
    for k in range(4):
        t = (k + 1) / 4
        links.append((fist[0] + math.sin(sw) * 0.32 * t, fist[1] + math.cos(sw) * 0.32 * t))
    P.append([fist] + links)
    for p in links[:-1]:
        P.append(ngon(p[0], p[1], 0.022, 6, 0, 0.032))
    hx, hy2 = links[-1]
    hook = [(hx, hy2)]
    for k in range(8):
        aa = -math.pi / 2 + sw + k / 7 * math.pi * 1.25
        hook.append((hx - math.cos(aa + math.pi / 2) * 0.0 + math.cos(aa) * 0.07 + math.sin(sw) * 0.0, hy2 + 0.07 + math.sin(aa) * 0.07))
    P.append(hook)
    return pack(P, E)
