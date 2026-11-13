"""HIEROPHANT KA'RETH (Hierarchy boss: THE SCRUTINY; summons drones). The existing drawing, kept line for line and
brought to life: the robed arms lift and settle from the shoulders out of step with each other, the crested head
tips, the gravity throne under it hums, and a slow orbit of three motes rides the halo ring.
Idle, 12 frames."""
import math
from lib import *

ID, N, FPS = "hierophant", 12, 8

BASE_P, BASE_E = original("hierophant")

def frame(i, n):
    ph = i / n * 2 * math.pi
    hov = 0.02 * wave(ph)
    moves = [
        # the whole figure hovers on its throne
        (lambda x, y: 1.0, lambda p: (p[0], p[1] + hov)),
        # right arm: everything past the shoulder, turning about it
        (lambda x, y: smooth(x, 0.42, 0.62), lambda p: R(p, (0.45, -0.25 + hov), -0.10 * wave(ph))),
        # left arm, out of step
        (lambda x, y: smooth(-x, 0.42, 0.62), lambda p: R(p, (-0.45, -0.25 + hov), 0.10 * wave(ph, 1, 1.4))),
        # the crest and head tip forward a touch
        (lambda x, y: smooth(-y, 0.55, 0.75) * (1 - smooth(abs(x), 0.25, 0.4)),
         lambda p: R(p, (0.0, -0.55 + hov), 0.05 * wave(ph, 1, 0.6))),
    ]
    P, E = deform(BASE_P, BASE_E, moves)
    # three motes orbiting the halo (ring centre ~(0, -0.64), radius ~0.40 in the drawing)
    for k in range(3):
        a = ph + k * 2 * math.pi / 3
        x, y = math.cos(a) * 0.48, -0.64 + hov + math.sin(a) * 0.48
        P.append(ngon(x, y, 0.035, 4, math.pi / 4))
    # the throne's hum: two short field lines under it that pulse
    for k, yy in enumerate((0.98, 1.06)):
        w = 0.30 + 0.10 * pos(ph, 2, k * 1.5)
        P.append([(-w, yy + hov), (w, yy + hov)])
    return pack(P, E)
