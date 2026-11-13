"""ARCH-CONFESSOR VELM (Hierarchy boss: DISCIPLINE punishes dumping your hand). A towering inquisitor-priest.
A tall mitred helm with a slit visor, a crown of spikes standing behind it, layered vestments and tabards, a
censer swinging on its chain from the right hand and an unrolled confession scroll in the left, listing your
sins. It floats, hem trailing. Idle, 12 frames: the censer swings and smokes, the scroll curls and uncurls, the
spike halo turns, the hem ripples, the whole figure hovers."""
import math
from lib import *

ID, N, FPS = "arch_confessor", 12, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    hov = 0.015 * wave(ph)
    P, E = [], []

    # ---- halo of spikes behind the head, slowly turning ----
    hc = (0.0, -0.62 + hov)
    for k in range(11):
        a = -math.pi + (k + 0.5) / 11 * math.pi + ph / 24
        r0, r1 = 0.26, 0.40 + (0.06 if k % 2 == 0 else 0)
        P.append([(hc[0] + math.cos(a - 0.05) * r0, hc[1] + math.sin(a - 0.05) * r0),
                  (hc[0] + math.cos(a) * r1, hc[1] + math.sin(a) * r1),
                  (hc[0] + math.cos(a + 0.05) * r0, hc[1] + math.sin(a + 0.05) * r0)])
    P.append(arc(hc[0], hc[1], 0.26, -math.pi, 0, 14))

    # ---- mitred helm with a slit visor ----
    y = hov
    helm = [(-0.14, -0.40 + y), (-0.17, -0.62 + y), (-0.10, -0.86 + y), (0.0, -0.98 + y), (0.10, -0.86 + y),
            (0.17, -0.62 + y), (0.14, -0.40 + y), (-0.14, -0.40 + y)]
    P.append(helm)
    P.append([(0.0, -0.96 + y), (0.0, -0.70 + y)])                         # the mitre's seam
    P.append([(-0.11, -0.62 + y), (0.11, -0.62 + y), (0.09, -0.56 + y), (-0.09, -0.56 + y), (-0.11, -0.62 + y)])
    E += [(-0.05, -0.59 + y, 0.022), (0.05, -0.59 + y, 0.022)]
    for k in range(3):                                                    # grille beneath the visor
        P.append([(-0.06 + k * 0.06, -0.52 + y), (-0.06 + k * 0.06, -0.44 + y)])

    # ---- high collar and shoulders ----
    P.append([(-0.18, -0.36 + y), (-0.34, -0.46 + y), (-0.46, -0.36 + y), (-0.44, -0.20 + y)])
    P.append([(0.18, -0.36 + y), (0.34, -0.46 + y), (0.46, -0.36 + y), (0.44, -0.20 + y)])
    P.append([(-0.18, -0.36 + y), (-0.22, -0.46 + y), (0.22, -0.46 + y), (0.18, -0.36 + y)])

    # ---- vestments: a long robe that flares to a rippling hem ----
    hem = []
    for k in range(13):
        x = -0.50 + k / 12 * 1.0
        hem.append((x, 0.78 + y + 0.035 * math.sin(ph * 2 + k * 0.9)))
    robe = [(-0.44, -0.20 + y), (-0.50, 0.78 + y)] + hem[1:-1] + [(0.50, 0.78 + y), (0.44, -0.20 + y)]
    P.append(robe)
    # a tabard down the front, with the Hierarchy's eye-in-a-triangle
    tab = [(-0.16, -0.30 + y), (0.16, -0.30 + y), (0.20, 0.62 + y), (0.0, 0.72 + y), (-0.20, 0.62 + y), (-0.16, -0.30 + y)]
    P.append(tab)
    P.append([(0.0, -0.18 + y), (0.11, 0.02 + y), (-0.11, 0.02 + y), (0.0, -0.18 + y)])
    E.append((0.0, -0.04 + y, 0.02))
    for k in range(4):                                                    # stitched bands
        yy = 0.14 + k * 0.12 + y
        P.append([(-0.17 - k * 0.01, yy), (0.17 + k * 0.01, yy)])
    # robe folds either side
    for s in (1, -1):
        for x0, x1 in ((0.28, 0.32), (0.38, 0.44)):
            P.append([(s * x0, 0.02 + y), (s * x1, 0.70 + y)])

    # ---- right arm (viewer's right): the censer on its chain, swinging ----
    hand = (0.58, 0.04 + y)
    P.append([(0.44, -0.20 + y), (0.62, -0.06 + y), (0.64, 0.06 + y), (0.52, 0.08 + y), (0.42, -0.04 + y)])
    P.append(box(0.52, 0.04 + y, 0.64, 0.12 + y))
    sw = 0.42 * wave(ph)
    links = chain((0.58, 0.12 + y), [math.pi / 2 - sw] * 5, [0.07] * 5)
    for a, b in zip(links, links[1:]):
        P.append([a, b])
    cx, cy = links[-1]
    burner = rot([(cx - 0.07, cy), (cx + 0.07, cy), (cx + 0.09, cy + 0.08), (cx + 0.05, cy + 0.15), (cx - 0.05, cy + 0.15),
                  (cx - 0.09, cy + 0.08), (cx - 0.07, cy)], (cx, cy), -sw)
    P.append(burner)
    P.append(rot([(cx - 0.09, cy + 0.08), (cx + 0.09, cy + 0.08)], (cx, cy), -sw))
    E.append(R((cx, cy + 0.10), (cx, cy), -sw) + (0.022,))
    # smoke curling up from the censer, drifting behind the swing
    for k in range(2):
        f = ((i / n) * 2 + k * 0.5) % 1.0
        sx, sy = cx + 0.04 * math.sin(ph + k), cy - 0.04 - f * 0.34
        P.append([(sx + 0.03 * math.sin(f * 9 + j), sy - j * 0.035) for j in range(5)])

    # ---- left arm: the confession scroll, curling and uncurling ----
    P.append([(-0.44, -0.20 + y), (-0.62, -0.08 + y), (-0.64, 0.04 + y), (-0.52, 0.08 + y), (-0.42, -0.04 + y)])
    top = (-0.70, 0.00 + y)
    unroll = 0.60 + 0.08 * wave(ph, 1, 1.0)
    curl = 0.04 * wave(ph, 1, 1.0)
    left = [(top[0] - 0.10, top[1])]
    right = [(top[0] + 0.10, top[1])]
    for k in range(1, 9):
        f = k / 8
        dx = curl * math.sin(f * math.pi)
        left.append((top[0] - 0.10 + dx, top[1] + f * unroll))
        right.append((top[0] + 0.10 + dx, top[1] + f * unroll))
    P.append(left)
    P.append(right)
    P.append([left[-1], right[-1]])
    P.append(ngon(top[0], top[1], 0.12, 10, 0, 0.03))                          # the rolled head of it
    P.append(ngon(left[-1][0] + 0.10, left[-1][1] + 0.02, 0.12, 10, 0, 0.03))  # and its tail
    for k in range(6):                                                          # the list of your sins
        yy = top[1] + 0.08 + k * unroll / 7
        w = 0.06 if k % 3 == 2 else 0.12
        dx = curl * math.sin((yy - top[1]) / unroll * math.pi)
        P.append([(top[0] - 0.07 + dx, yy), (top[0] - 0.07 + w + dx, yy)])

    return pack(P, E)
