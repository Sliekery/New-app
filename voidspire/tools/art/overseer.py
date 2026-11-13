"""OVERSEER PRIME (Rust Legion boss: plated, summons Scrap Hounds). Front view, facing the viewer.
The foreman of the scrapyard: a domed head whose single searchlight eye sweeps along a visor slot, twin
smokestacks for a crown, a chest of layered armour plates (the PLATED rule, drawn), a piston hammer for a right
arm, a control rod with a signal mast for the left (it calls the hounds), on two hydraulic legs.
Idle, 12 frames: the searchlight sweeps, the pistons in the legs breathe, the stacks puff, the hammer rises and
settles, the mast pulses, the plates shift."""
import math, json

def R(p, c, a):
    ca, sa = math.cos(a), math.sin(a)
    dx, dy = p[0] - c[0], p[1] - c[1]
    return (c[0] + dx * ca - dy * sa, c[1] + dx * sa + dy * ca)

def T(pts, dx=0.0, dy=0.0):
    return [(x + dx, y + dy) for x, y in pts]

def rot(pts, c, a):
    return [R(p, c, a) for p in pts]

def mx(pts):
    return [(-x, y) for x, y in pts]

def box(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]

def flat(pts):
    out = []
    for x, y in pts:
        out += [round(x, 3), round(y, 3)]
    return out

def frame(i, n=12):
    ph = i / n * 2 * math.pi
    b = math.sin(ph)
    sink = 0.02 * (b + 1) / 2              # the frame settles onto its pistons
    paths, eyes = [], []

    # ---- hydraulic legs: a thigh housing, a chrome piston that slides, a splayed foot ----
    for s in (1, -1):
        side = []
        side.append([(0.12, 0.30 + sink), (0.34, 0.30 + sink), (0.38, 0.52 + sink * 0.5), (0.16, 0.52 + sink * 0.5), (0.12, 0.30 + sink)])
        rod_top = 0.52 + sink * 0.5
        side.append([(0.22, rod_top), (0.22, 0.72)])
        side.append([(0.30, rod_top), (0.30, 0.72)])
        side.append([(0.18, 0.66), (0.34, 0.66)])          # piston collar
        side.append([(0.10, 0.84), (0.16, 0.72), (0.36, 0.72), (0.46, 0.84), (0.10, 0.84)])
        side.append([(0.46, 0.84), (0.54, 0.80)])          # a toe claw gripping the ground
        side.append([(0.10, 0.84), (0.04, 0.80)])
        for q in side:
            paths.append(q if s > 0 else mx(q))

    # ---- hips and torso ----
    y0 = sink
    paths.append([(-0.36, 0.34 + y0), (-0.44, 0.18 + y0), (0.44, 0.18 + y0), (0.36, 0.34 + y0), (-0.36, 0.34 + y0)])
    torso = [(-0.44, 0.18 + y0), (-0.56, -0.08 + y0), (-0.52, -0.40 + y0), (-0.30, -0.54 + y0), (0.30, -0.54 + y0),
             (0.52, -0.40 + y0), (0.56, -0.08 + y0), (0.44, 0.18 + y0)]
    paths.append(torso)
    # three layered chest plates, overlapping like shingles, each shifting a hair out of step
    for k in range(3):
        yy = -0.40 + k * 0.17 + y0 + 0.006 * math.sin(ph + k * 1.3)
        w = 0.40 - k * 0.05
        paths.append([(-w, yy), (-w + 0.04, yy + 0.13), (w - 0.04, yy + 0.13), (w, yy)])
        for rx in (-w + 0.08, w - 0.08):                       # rivets
            paths.append(box(rx - 0.015, yy + 0.04, rx + 0.015, yy + 0.07))
    # the overseer's badge: a gear on the lowest plate
    gx, gy, gr = 0.0, -0.02 + y0, 0.07
    gear = []
    for k in range(9):
        a0 = k / 8 * 2 * math.pi
        rr = gr if k % 2 == 0 else gr * 0.72
        gear.append((gx + math.cos(a0 + ph * 0.25) * rr, gy + math.sin(a0 + ph * 0.25) * rr))
    gear = []
    for k in range(8):
        a0 = k / 8 * 2 * math.pi + ph / 12
        for f, rr in ((0.0, gr * 0.75), (0.15, gr), (0.35, gr), (0.5, gr * 0.75)):
            a = a0 + f * (2 * math.pi / 8)
            gear.append((gx + math.cos(a) * rr, gy + math.sin(a) * rr))
    gear.append(gear[0])
    paths.append(gear)

    # ---- head: a dome on a neck ring, one searchlight sweeping along the visor ----
    hy = -0.56 + y0
    paths.append([(-0.16, hy + 0.02), (0.16, hy + 0.02)])                 # neck ring
    dome = [(-0.24, hy), (-0.26, hy - 0.16)]
    for k in range(9):
        a = math.pi + k / 8 * math.pi
        dome.append((math.cos(a) * 0.26, hy - 0.16 + math.sin(a) * 0.20))
    dome += [(0.26, hy - 0.16), (0.24, hy), (-0.24, hy)]
    paths.append(dome)
    paths.append([(-0.20, hy - 0.18), (0.20, hy - 0.18), (0.18, hy - 0.10), (-0.18, hy - 0.10), (-0.20, hy - 0.18)])
    sweep = math.sin(ph) * 0.13
    eyes.append((sweep, hy - 0.14, 0.035))
    # the beam's tick marks either side of the light, so the sweep reads at a glance
    paths.append([(sweep - 0.06, hy - 0.14), (sweep - 0.10, hy - 0.14)])
    paths.append([(sweep + 0.06, hy - 0.14), (sweep + 0.10, hy - 0.14)])
    # jaw grille
    for k in range(5):
        x = -0.12 + k * 0.06
        paths.append([(x, hy - 0.06), (x, hy - 0.01)])
    # twin smokestacks, puffing alternately
    for s, off in ((1, 0.0), (-1, math.pi)):
        st = [(0.10, hy - 0.33), (0.12, hy - 0.52), (0.22, hy - 0.52), (0.22, hy - 0.28)]
        lip = [(0.09, hy - 0.52), (0.25, hy - 0.52)]
        paths.append(st if s > 0 else mx(st))
        paths.append(lip if s > 0 else mx(lip))
        puff = max(0.0, math.sin(ph * 2 + off))
        if puff > 0.15:
            r = 0.03 + 0.03 * puff
            cx, cy = s * 0.17, hy - 0.58 - puff * 0.08
            ring = [(cx + math.cos(a / 6 * 2 * math.pi) * r, cy + math.sin(a / 6 * 2 * math.pi) * r * 0.7) for a in range(7)]
            paths.append(ring)

    # ---- right arm (viewer's right): the piston hammer, lifting and settling ----
    sh = (0.56, -0.34 + y0)
    paths.append([(0.46, -0.48 + y0), (0.66, -0.56 + y0), (0.80, -0.46 + y0), (0.78, -0.26 + y0), (0.58, -0.20 + y0)])
    lift = -0.10 * (b + 1) / 2
    elbow = R((0.80, 0.02 + y0), sh, lift)
    paths.append([(0.70, -0.30 + y0), (0.86, -0.28 + y0), (elbow[0] + 0.06, elbow[1]), (elbow[0] - 0.08, elbow[1])])
    paths.append([(0.70, -0.30 + y0), (elbow[0] - 0.08, elbow[1])])
    head_c = R((0.82, 0.30 + y0), sh, lift * 1.3)
    paths.append([(elbow[0] - 0.02, elbow[1]), (head_c[0] - 0.02, head_c[1] - 0.10)])
    paths.append([(elbow[0] + 0.04, elbow[1]), (head_c[0] + 0.04, head_c[1] - 0.10)])
    hammer = rot(box(head_c[0] - 0.16, head_c[1] - 0.10, head_c[0] + 0.16, head_c[1] + 0.10), head_c, lift * 0.6)
    paths.append(hammer)
    for k in (-0.08, 0.0, 0.08):
        paths.append(rot([(head_c[0] + k, head_c[1] - 0.10), (head_c[0] + k, head_c[1] + 0.10)], head_c, lift * 0.6))

    # ---- left arm: the control rod and its signal mast (what calls the hounds) ----
    shl = (-0.56, -0.34 + y0)
    paths.append(mx([(0.46, -0.48 + y0), (0.66, -0.56 + y0), (0.80, -0.46 + y0), (0.78, -0.26 + y0), (0.58, -0.20 + y0)]))
    elb = (-0.78, -0.02 + y0)
    paths.append([(-0.70, -0.30 + y0), (-0.86, -0.28 + y0), (elb[0] - 0.06, elb[1]), (elb[0] + 0.08, elb[1]), (-0.70, -0.30 + y0)])
    hand = (-0.80, 0.20 + y0)
    paths.append([(elb[0] - 0.04, elb[1]), (hand[0] - 0.04, hand[1])])
    paths.append([(elb[0] + 0.06, elb[1]), (hand[0] + 0.06, hand[1])])
    paths.append(box(hand[0] - 0.07, hand[1], hand[0] + 0.09, hand[1] + 0.10))          # the grip
    rod_top = (hand[0] - 0.02, -0.80 + y0)
    paths.append([(hand[0] + 0.01, hand[1] + 0.16), rod_top])
    # signal rings broadcasting from the mast tip, expanding and fading out on a loop
    for k in range(2):
        f = ((i / n) + k * 0.5) % 1.0
        r = 0.04 + f * 0.16
        if f < 0.85:
            arc = [(rod_top[0] + math.cos(a) * r, rod_top[1] + math.sin(a) * r * 0.8)
                   for a in [math.pi * (1.15 + j * 0.07) for j in range(11)]]
            paths.append(arc)
    eyes.append((rod_top[0], rod_top[1], 0.03 + 0.012 * (b + 1) / 2))

    return {"p": [flat(q) for q in paths], "e": [[round(x, 3), round(y, 3), round(d, 3)] for x, y, d in eyes]}

if __name__ == "__main__":
    n = 12
    print(json.dumps({"fps": 8, "frames": [frame(i, n) for i in range(n)]}, separators=(",", ":")))
