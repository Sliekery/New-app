"""IRON ZEALOT (Hierarchy, ENRAGE: grows stronger when struck). A heavy fanatic in plate: a bucket helm with one
burning eye-slot, spiked pauldrons, a riveted cuirass with a glowing rage-seam down it, and a great maul lifted
in its left hand toward you. Idle, 8 frames: the maul head bobs as it shifts its grip, the rage-seam pulses,
steam vents from the pauldrons, it breathes heavily."""
import math
from lib import *

ID, N, FPS = "iron_zealot", 8, 8

def frame(i, n):
    f = i / n
    ph = f * 2 * math.pi
    P, E = [], []
    y = 0.025 * wave(ph)
    br = 0.02 * wave(ph)

    # ---- legs ----
    for s in (1, -1):
        P.append([(s * 0.10, 0.40), (s * 0.30, 0.40), (s * 0.32, 0.82), (s * 0.08, 0.82), (s * 0.10, 0.40)])
        P.append([(s * 0.04, 0.82), (s * 0.38, 0.82), (s * 0.40, 0.90), (s * 0.02, 0.90), (s * 0.04, 0.82)])
        P.append([(s * 0.10, 0.60), (s * 0.31, 0.60)])

    # ---- cuirass ----
    P.append([(-0.34 - br, -0.32 + y), (0.34 + br, -0.32 + y), (0.40 + br, 0.08 + y), (0.30, 0.44 + y), (-0.30, 0.44 + y), (-0.40 - br, 0.08 + y), (-0.34 - br, -0.32 + y)])
    P.append([(-0.38, 0.12 + y), (0.38, 0.12 + y)])
    for x in (-0.24, 0.24):
        for yy in (-0.22, 0.30):
            P.append(ngon(x, yy + y, 0.016, 6))
    # the rage seam
    g = pos(ph, 2)
    P.append([(0.0, -0.30 + y), (0.04, -0.14 + y), (-0.03, 0.0 + y), (0.03, 0.14 + y), (0.0, 0.40 + y)])
    E.append((0.0, 0.0 + y, 0.02 + 0.02 * g))

    # ---- helm ----
    hy = -0.32 + y
    P.append([(-0.16, hy), (-0.18, hy - 0.30), (-0.10, hy - 0.38), (0.10, hy - 0.38), (0.18, hy - 0.30), (0.16, hy), (-0.16, hy)])
    P.append([(-0.12, hy - 0.20), (0.12, hy - 0.20)])
    E.append((-0.02, hy - 0.20, 0.03 + 0.01 * g))
    for k in range(3):
        P.append([(-0.08 + k * 0.08, hy - 0.10), (-0.08 + k * 0.08, hy - 0.04)])

    # ---- spiked pauldrons with steam ----
    for s in (1, -1):
        pd = [(s * 0.18, -0.34 + y), (s * 0.30, -0.44 + y), (s * 0.50, -0.40 + y), (s * 0.54, -0.22 + y), (s * 0.36, -0.18 + y)]
        P.append(pd)
        P.append(spike((s * 0.40, -0.43 + y), -math.pi / 2 + s * 0.4, 0.16, 0.035))
        d = (f + (0.5 if s < 0 else 0)) % 1.0
        P.append(ngon(s * (0.50 + d * 0.08), -0.48 + y - d * 0.26, 0.025 + d * 0.04, 7, d * 3))

    # ---- right arm resting ----
    P.append(bone((0.44, -0.20 + y), (0.50, 0.20 + y), 0.06, 0.05))
    P.append(ngon(0.50, 0.24 + y, 0.06, 6))

    # ---- left arm: the great maul held up toward the player ----
    bob = 0.06 * wave(ph, 1, 0.8)
    sh = (-0.44, -0.20 + y)
    hand = (-0.56, 0.08 + y + bob * 0.5)
    P.append(bone(sh, hand, 0.06, 0.05))
    P.append(ngon(hand[0], hand[1], 0.06, 6))
    top = (-0.64, -0.62 + y + bob)
    P.append([(hand[0] + 0.03, hand[1] + 0.16), top])
    hx, hy2 = top
    P.append([(hx - 0.20, hy2 - 0.12), (hx + 0.16, hy2 - 0.12), (hx + 0.16, hy2 + 0.08), (hx - 0.20, hy2 + 0.08), (hx - 0.20, hy2 - 0.12)])
    P.append([(hx - 0.14, hy2 - 0.12), (hx - 0.14, hy2 + 0.08)])
    P.append([(hx + 0.10, hy2 - 0.12), (hx + 0.10, hy2 + 0.08)])
    return pack(P, E)
