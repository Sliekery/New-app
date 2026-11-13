"""BROOD MAW (Voidspawn: spits out Void Larvae and bites). A walking egg sac: a round translucent belly with
larvae visibly squirming inside, a wide toothed mouth across its bottom half, two stalked eyes and two feelers
on top, stubby legs. Idle, 8 frames: the larvae turn inside, the belly swells, the mouth gapes and closes, the
eye stalks sway and the feelers twitch."""
import math
from lib import *

ID, N, FPS = "brood_maw", 8, 8

def grub(cx, cy, a, s):
    pts = []
    for k in range(7):
        t = k / 6
        pts.append(R((cx - 0.10 * s + t * 0.20 * s, cy + 0.03 * s * math.sin(t * math.pi * 2)), (cx, cy), a))
    return pts

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.02 * wave(ph, 2)
    sw = 1.0 + 0.04 * wave(ph)
    gape = pos(ph, 1, 1.0)
    # legs
    for s in (1, -1):
        P.append([(s * 0.30, 0.46 + y), (s * 0.42, 0.66), (s * 0.36, 0.86), (s * 0.46, 0.88)])
    # the sac body
    P.append(ngon(0.0, -0.06 + y, 0.58 * sw, 24, 0, 0.56 * sw))
    P.append(ngon(0.0, -0.18 + y, 0.40 * sw, 20, 0, 0.30 * sw))      # the membrane of the brood chamber
    # larvae inside, squirming
    for k, (gx, gy) in enumerate(((-0.18, -0.24), (0.12, -0.30), (0.02, -0.08))):
        P.append(grub(gx, gy + y, ph * (1 if k % 2 else -1) * 0.5 + k * 1.7, 1.0))
        E.append((gx + 0.0, gy + y, 0.012))
    # the mouth across the bottom, gaping
    my = 0.20 + y
    h = 0.04 + 0.16 * gape
    P.append([(-0.40, my), (-0.20, my - h * 0.4), (0.20, my - h * 0.4), (0.40, my), (0.20, my + h), (-0.20, my + h), (-0.40, my)])
    for k in range(6):
        x = -0.28 + k * 0.11
        P.append([(x - 0.04, my - h * 0.35), (x, my - h * 0.35 + 0.07), (x + 0.04, my - h * 0.35)])
        P.append([(x - 0.04, my + h * 0.95), (x + 0.01, my + h * 0.95 - 0.07), (x + 0.05, my + h * 0.95)])
    # eye stalks and feelers on top
    for s, off in ((-1, 0.0), (1, 1.4)):
        a = -math.pi / 2 + s * 0.45 + 0.14 * wave(ph, 1, off)
        base = (s * 0.24, -0.56 + y)
        top = (base[0] + math.cos(a) * 0.24, base[1] + math.sin(a) * 0.24)
        P.append([base, top])
        P.append(ngon(top[0], top[1], 0.07, 8))
        E.append((top[0] - 0.02, top[1], 0.035))
        fa = -math.pi / 2 + s * 1.05 + 0.20 * math.sin(ph * 2 + off)
        fb = (s * 0.44, -0.42 + y)
        P.append([fb, (fb[0] + math.cos(fa) * 0.22, fb[1] + math.sin(fa) * 0.22)])
    return pack(P, E)
