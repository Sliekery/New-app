"""Scrap Hound: side view, facing LEFT (toward the player). An idle prowl, 8 frames: the body breathes, the
weight rocks between the diagonal leg pairs, the head scans and the jaw works, the tail antenna flicks.
Built by forward kinematics so every frame is the same drawing with its joints turned."""
import math, json, sys

def R(p, c, a):
    ca, sa = math.cos(a), math.sin(a)
    dx, dy = p[0] - c[0], p[1] - c[1]
    return (c[0] + dx * ca - dy * sa, c[1] + dx * sa + dy * ca)

def T(pts, dx=0, dy=0):
    return [(x + dx, y + dy) for x, y in pts]

def rot(pts, c, a):
    return [R(p, c, a) for p in pts]

def flat(pts):
    out = []
    for x, y in pts:
        out += [round(x, 3), round(y, 3)]
    return out

def leg(hip, a1, l1, a2, l2, toe, ground=None):
    """Two-bone leg from the hip: thigh at angle a1 (0 = straight down, + = toward the rear/right), shin at a2.
    Each bone is its own tapered outline, so the joint reads as a joint instead of two lines crossing."""
    knee = (hip[0] + math.sin(a1) * l1, hip[1] + math.cos(a1) * l1)
    ankle = (knee[0] + math.sin(a2) * l2, knee[1] + math.cos(a2) * l2)
    if ground is not None:
        ankle = (ankle[0], ground - 0.06)
    def bone(p, q, w0, w1):
        dx, dy = q[0] - p[0], q[1] - p[1]
        n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n
        return [(p[0] + nx * w0, p[1] + ny * w0), (q[0] + nx * w1, q[1] + ny * w1),
                (q[0] - nx * w1, q[1] - ny * w1), (p[0] - nx * w0, p[1] - ny * w0), (p[0] + nx * w0, p[1] + ny * w0)]
    thigh = bone(hip, knee, 0.07, 0.04)
    shin = bone(knee, ankle, 0.035, 0.022)
    joint = [(knee[0] + math.cos(k * math.pi / 3) * 0.04, knee[1] + math.sin(k * math.pi / 3) * 0.04) for k in range(7)]
    fx, fy = ankle
    foot = [(fx + 0.03, fy - 0.01), (fx - 0.02, fy - 0.02), (fx + toe * 0.12, fy + 0.04), (fx + toe * 0.14, fy + 0.06),
            (fx + 0.05, fy + 0.06), (fx + 0.03, fy - 0.01)]
    claw = [(fx + toe * 0.06, fy + 0.03), (fx + toe * 0.09, fy + 0.06)]
    return [thigh, shin, joint, foot, claw]

GROUND = 0.84

def frame(i, n=8):
    ph = i / n * 2 * math.pi
    breathe = math.sin(ph) * 0.012
    rock = math.sin(ph) * 0.05           # weight shift between diagonal pairs
    lift = math.sin(ph * 2) * 0.006
    paths, eyes = [], []

    # ---- body: a plated drum, front lower than the haunch (a hunting crouch) ----
    by = 0.10 + breathe + lift          # the whole upper body sits low, in a crouch
    body = T([(-0.50, -0.16), (-0.36, -0.30), (0.06, -0.34), (0.42, -0.30), (0.60, -0.16), (0.60, 0.02),
              (0.44, 0.12), (-0.34, 0.12), (-0.52, 0.02), (-0.50, -0.16)], 0, by)
    paths.append(body)
    # three overlapping back plates, each lifting a touch as it breathes
    for k, x in enumerate([-0.24, 0.04, 0.32]):
        up = breathe * (1.6 + k * 0.4)
        paths.append(T([(x - 0.16, -0.31), (x - 0.08, -0.44 - up), (x + 0.12, -0.43 - up), (x + 0.16, -0.32)], 0, by))
    # belly ribs and a vent grille
    for x in (-0.2, -0.06, 0.08, 0.22):
        paths.append(T([(x, -0.06), (x + 0.04, 0.12)], 0, by))
    paths.append(T([(0.30, -0.22), (0.46, -0.22), (0.46, -0.10), (0.30, -0.10), (0.30, -0.22)], 0, by))
    # exhaust stack on the haunch, puffing
    puff = 0.03 * max(0, math.sin(ph * 2))
    paths.append(T([(0.36, -0.36), (0.38, -0.56 - puff), (0.48, -0.56 - puff), (0.47, -0.36)], 0, by))
    paths.append(T([(0.35, -0.56 - puff), (0.51, -0.56 - puff)], 0, by))

    # ---- head: on a short neck, scanning ----
    neck = (-0.50, -0.14 + by)
    paths.append(T([(-0.42, -0.30), (-0.58, -0.36), (-0.60, -0.06), (-0.44, 0.04)], 0, by))
    scan = math.sin(ph) * 0.07 - 0.03
    head = [(-0.56, -0.36), (-0.72, -0.46), (-0.92, -0.40), (-1.00, -0.24), (-0.98, -0.12), (-0.66, -0.10),
            (-0.56, -0.12), (-0.56, -0.36)]
    head = rot(T(head, 0, by), neck, scan)
    paths.append(head)
    # sensor visor slit across the snout
    visor = rot(T([(-0.66, -0.34), (-0.88, -0.33), (-0.90, -0.27), (-0.68, -0.27), (-0.66, -0.34)], 0, by), neck, scan)
    paths.append(visor)
    # ear vanes swept back
    paths.append(rot(T([(-0.62, -0.44), (-0.52, -0.62), (-0.48, -0.40)], 0, by), neck, scan))
    paths.append(rot(T([(-0.72, -0.46), (-0.66, -0.60), (-0.60, -0.44)], 0, by), neck, scan))
    # jaw on its own hinge, working open and shut
    hinge = R((-0.62, -0.11 + by), neck, scan)
    gape = 0.08 + 0.10 * max(0, math.sin(ph * 2 + 0.6))
    jaw = [(-0.62, -0.11), (-0.94, -0.10), (-0.98, -0.04), (-0.70, 0.0), (-0.62, -0.05)]
    jaw = rot(rot(T(jaw, 0, by), neck, scan), hinge, -gape)
    paths.append(jaw)
    # teeth along the jaw
    for k in range(4):
        a = R((-0.92 + k * 0.07, -0.10 + by), neck, scan)
        a = R(a, hinge, -gape)
        b = (a[0] + 0.02, a[1] - 0.04)
        paths.append([a, b])
    eyes.append(R((-0.80, -0.305 + by), neck, scan))

    # ---- tail: a segmented antenna whipping up from the haunch ----
    base = (0.60, -0.12 + by)
    p, tail = base, [base]
    th = 0.35 + math.sin(ph + 1.2) * 0.12
    for k in range(4):
        th += 0.22 + math.sin(ph * 2 + k) * 0.04
        p = (p[0] + math.cos(th) * 0.12, p[1] - math.sin(th) * 0.12)
        tail.append(p)
    paths.append(tail)
    tip = tail[-1]
    paths.append([(tip[0] - 0.035, tip[1]), (tip[0], tip[1] - 0.05), (tip[0] + 0.035, tip[1]), (tip[0], tip[1] + 0.05),
                  (tip[0] - 0.035, tip[1])])

    # ---- legs: the far pair first (set back a touch), then the near pair ----
    # front legs are straight-ish, hind legs bend backward at the hock, like a dog's
    def front(hx, phase, far):
        s = math.sin(ph + phase)
        return leg((hx, 0.08 + by), -0.08 + s * 0.12, 0.28, 0.10 - s * 0.10, 0.30, -1, GROUND - (0.015 if far else 0))
    def hind(hx, phase, far):
        s = math.sin(ph + phase)
        return leg((hx, 0.06 + by), -0.55 + s * 0.10, 0.26, 0.55 - s * 0.10, 0.34, -1, GROUND - (0.015 if far else 0))
    for parts in (front(-0.14, math.pi, True), hind(0.48, 0, True), front(-0.36, 0, False), hind(0.26, math.pi, False)):
        paths += parts

    return {"p": [flat(q) for q in paths], "e": [[round(eyes[0][0], 3), round(eyes[0][1], 3), 0.035]]}

if __name__ == "__main__":
    n = 8
    print(json.dumps({"fps": 8, "frames": [frame(i, n) for i in range(n)]}, separators=(",", ":")))
