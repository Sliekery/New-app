"""GAZE EYE (Voidspawn: one of the Void Gaze's lesser eyes; it weakens and exposes you, and shields the core).
A single floating eye cut from the same pattern as its master: a lidded almond with lashes and a round iris, a
socket ring round it like the ones on the Gaze's orbits, and an optic nerve trailing behind. Idle, 8 frames: it
drifts, the pupil darts and settles on you, it blinks once, the nerve sways."""
import math
from lib import *

ID, N, FPS = "gaze_eye", 8, 8

def frame(i, n):
    ph = i / n * 2 * math.pi
    P, E = [], []
    y = 0.06 * wave(ph)
    x0 = 0.03 * wave(ph, 1, 1.4)
    # optic nerve trailing off the back (right)
    a = 0.20 * math.sin(ph)
    P.append(chain((x0 + 0.46, y + 0.04), [0.3 + a, 0.6 - a, 0.9 + a], [0.16, 0.14, 0.12]))
    # socket ring
    P.append(ngon(x0, y, 0.62, 18, 0, 0.50))
    # the almond, blinking on one frame
    if i == 3:
        P.append([(x0 - 0.50, y), (x0, y + 0.06), (x0 + 0.50, y)])
        for k in range(5):
            lx = x0 - 0.30 + k * 0.15
            P.append([(lx, y + 0.05), (lx - 0.02, y + 0.14)])
        return pack(P, E)
    h = 0.30
    P.append([(x0 - 0.50, y), (x0 - 0.24, y - h), (x0 + 0.24, y - h), (x0 + 0.50, y), (x0 + 0.24, y + h), (x0 - 0.24, y + h), (x0 - 0.50, y)])
    for k in range(5):                                    # lashes on the upper lid
        lx = x0 - 0.30 + k * 0.15
        top = y - h * (1 - abs(lx - x0) / 0.62)
        P.append([(lx, top), (lx - 0.03, top - 0.12)])
    dart = [(-0.10, 0.0), (-0.10, 0.0), (-0.04, -0.06), (0.06, 0.04), (-0.10, 0.0), (-0.12, 0.02), (-0.10, 0.0), (-0.10, 0.0)][i]
    P.append(ngon(x0 + dart[0], y + dart[1], 0.18, 14))
    E.append((x0 + dart[0], y + dart[1], 0.08))
    return pack(P, E)
