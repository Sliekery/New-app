"""RUST SENTINEL (Rust, THORNS: hitting it cuts you; it guards and strikes). A squat bunker-machine bristling
with rebar spikes: a heavy box body behind overlapping shield plates, a single slit eye in an armoured head,
spikes all over its shoulders and shield edges, a short spiked mace-arm. Idle: the spikes bristle out and in,
the eye scans side to side, the shield plates shift, the mace arm sways."""
import math
from lib import *

ID, N, FPS = "rust_sentinel", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.012 * wave(ph)
    br = 0.03 * pos(ph)
    # legs
    for s in (1, -1):
        P.append(box(s * 0.20 - 0.10, 0.40, s * 0.20 + 0.10, 0.74))
        P.append([(s * 0.20 - 0.16, 0.86), (s * 0.20 + 0.16, 0.86), (s * 0.20 + 0.12, 0.74), (s * 0.20 - 0.12, 0.74), (s * 0.20 - 0.16, 0.86)])
    # body
    P.append(box(-0.44, -0.30 + y, 0.44, 0.42 + y))
    # head
    P.append([(-0.18, -0.30 + y), (-0.20, -0.52 + y), (0.20, -0.52 + y), (0.18, -0.30 + y)])
    sc = 0.08 * math.sin(ph)
    P.append([(-0.14, -0.42 + y), (0.14, -0.42 + y)])
    E.append((sc, -0.42 + y, 0.03))
    # overlapping shield plates across the front, shifting
    for k in range(3):
        dx = 0.02 * wave(ph, 1, k * 1.5)
        x0 = -0.40 + k * 0.26 + dx
        P.append([(x0, -0.16 + y), (x0 + 0.30, -0.16 + y), (x0 + 0.28, 0.34 + y), (x0 + 0.02, 0.34 + y), (x0, -0.16 + y)])
    # spikes on the shoulders and the top edge, bristling
    for k in range(7):
        x = -0.40 + k * 0.1333
        base = (x, -0.30 + y)
        if abs(x) < 0.2:
            continue
        P.append(spike(base, x * 0.9, 0.16 + br + 0.03 * (k % 2), 0.04))   # spike(): 0 = straight up
    for s in (1, -1):
        for k in range(3):
            base = (s * 0.44, -0.18 + k * 0.22 + y)
            P.append(spike(base, s * (math.pi / 2 + (k - 1) * 0.25), 0.14 + br, 0.04))
    # mace arm toward the player, swaying
    sw = 0.12 * wave(ph, 1, 0.6)
    sh = (-0.44, -0.10 + y)
    hand = R((-0.66, 0.18 + y), sh, sw)
    P.append(bone(sh, hand, 0.05, 0.04))
    head = R((-0.74, 0.34 + y), sh, sw)
    P.append([hand, head])
    P.append(ngon(head[0], head[1], 0.07, 8))
    for k in range(5):
        a = k / 5 * 2 * math.pi + sw
        P.append([(head[0] + math.cos(a) * 0.07, head[1] + math.sin(a) * 0.07), (head[0] + math.cos(a) * 0.13, head[1] + math.sin(a) * 0.13)])
    return pack(P, E)
