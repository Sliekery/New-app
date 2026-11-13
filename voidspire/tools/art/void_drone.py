"""VOID DRONE (Voidspawn: caps every hit at its absorb threshold, and a blow over it flings a curse back). A
hovering funnel-hulled drone: a tapered hull with a stalked eye hanging under its rim, twin antenna pods, folded
landing struts, and around it the absorb field: a hexagon of ward segments that ripples. Idle, 8 frames: it
hovers, the antenna pods blink in turn, the stalked eye swings and looks toward you, the ward segments pulse
in and out one after another."""
import math
from lib import *

ID, N, FPS = "void_drone", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.05 * wave(ph)
    # funnel hull
    P.append([(-0.46, -0.30 + y), (0.46, -0.30 + y), (0.20, 0.20 + y), (-0.20, 0.20 + y), (-0.46, -0.30 + y)])
    P.append([(-0.46, -0.30 + y), (-0.36, -0.44 + y), (0.36, -0.44 + y), (0.46, -0.30 + y)])
    P.append([(-0.33, -0.12 + y), (0.33, -0.12 + y)])
    for x in (-0.20, 0.0, 0.20):
        P.append(ngon(x, -0.37 + y, 0.02, 6))
    # antenna pods, blinking in turn
    for s in (1, -1):
        base = (s * 0.26, -0.44 + y)
        top = (s * 0.36, -0.70 + y)
        P.append([base, top])
        P.append(ngon(top[0], top[1], 0.06, 6))
        if (i // 2) % 2 == (0 if s < 0 else 1):
            E.append((top[0], top[1], 0.035))
    # stalked eye under the hull, swinging, looking left
    sw = 0.18 * wave(ph, 1, 0.5)
    root = (0.0, 0.20 + y)
    eye = (root[0] + math.sin(sw) * 0.26, root[1] + math.cos(sw) * 0.26)
    P.append([root, eye])
    P.append(ngon(eye[0], eye[1], 0.09, 10))
    E.append((eye[0] - 0.03, eye[1], 0.045))
    # landing struts folded up
    for s in (1, -1):
        P.append([(s * 0.16, 0.20 + y), (s * 0.34, 0.36 + y), (s * 0.30, 0.46 + y)])
    # absorb field: six ward arcs closing a ring round it, a swell travelling round them
    for k in range(6):
        a0 = k / 6 * 2 * math.pi + 0.10
        pul = pos(ph, 1, -k * 1.05)
        r = 0.80 + 0.06 * pul
        P.append(arc(0, -0.08 + y, r, a0, a0 + 2 * math.pi / 6 - 0.20, 5, r * 0.88))
        if pul > 0.75:
            P.append(arc(0, -0.08 + y, r - 0.07, a0 + 0.15, a0 + 2 * math.pi / 6 - 0.35, 4, (r - 0.07) * 0.88))
    return pack(P, E)
