"""Rust Ogre (elite, THE GRUDGE: thorns that bite harder with every blow). Front view, so drawn symmetric about
x=0 and animated per side. A hulking scrap brute: small horned head sunk between huge shoulders, a furnace for a
chest, long arms ending in spiked fists that rest on the ground, everything bristling with thorns.
Idle, 10 frames: it heaves a breath (shoulders lift, chest swells), the arms sway out of step, the fists clench,
the furnace flickers and the shoulder vents puff."""
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

def flat(pts):
    out = []
    for x, y in pts:
        out += [round(x, 3), round(y, 3)]
    return out

def spike(base, ang, length, w=0.035):
    """A thorn: a narrow triangle standing out of a surface at angle `ang` (0 = straight up, + = clockwise)."""
    tip = (base[0] + math.sin(ang) * length, base[1] - math.cos(ang) * length)
    nx, ny = math.cos(ang) * w, math.sin(ang) * w
    return [(base[0] - nx, base[1] - ny), tip, (base[0] + nx, base[1] + ny)]

def frame(i, n=10):
    ph = i / n * 2 * math.pi
    b = math.sin(ph)                         # the breath
    heave = -0.025 * (b + 1) / 2             # shoulders lift on the in-breath
    paths, eyes = [], []

    # ---- legs: short, bowed, planted wide ----
    for s in (1, -1):
        leg = [(0.16, 0.38), (0.30, 0.42), (0.36, 0.62), (0.40, 0.78), (0.22, 0.78), (0.20, 0.62), (0.12, 0.44)]
        foot = [(0.18, 0.78), (0.46, 0.78), (0.48, 0.84), (0.14, 0.84), (0.18, 0.78)]
        knee = [(0.22, 0.58), (0.36, 0.56)]
        for q in (leg, foot, knee):
            paths.append(q if s > 0 else mx(q))

    # ---- body: a barrel of plate, wider at the top ----
    swell = 0.012 * (b + 1) / 2
    torso = [(-0.30, 0.42), (-0.44 - swell, 0.10), (-0.50 - swell, -0.26 + heave), (-0.30, -0.44 + heave),
             (0.30, -0.44 + heave), (0.50 + swell, -0.26 + heave), (0.44 + swell, 0.10), (0.30, 0.42), (-0.30, 0.42)]
    paths.append(torso)
    # belt plate with a riveted buckle
    paths.append([(-0.38, 0.24), (0.38, 0.24)])
    paths.append([(-0.10, 0.20), (0.10, 0.20), (0.10, 0.34), (-0.10, 0.34), (-0.10, 0.20)])
    # furnace in the chest: a grate whose bars flicker as it burns
    paths.append([(-0.22, -0.24 + heave), (0.22, -0.24 + heave), (0.26, 0.10), (-0.26, 0.10), (-0.22, -0.24 + heave)])
    for k in range(5):
        x = -0.16 + k * 0.08
        fl = 0.04 * math.sin(ph * 3 + k * 1.9)
        paths.append([(x, -0.18 + heave + fl), (x, 0.05)])
    eyes.append((0.0, -0.06 + heave * 0.5, 0.03))        # the coal at the heart of it

    # ---- head: small, horned, sunk between the shoulders, glaring ----
    hy = -0.46 + heave * 1.3
    head = [(-0.16, hy + 0.05), (-0.19, hy - 0.11), (-0.10, hy - 0.23), (0.10, hy - 0.23), (0.19, hy - 0.11),
            (0.16, hy + 0.05), (-0.16, hy + 0.05)]
    paths.append(head)
    # brow ridge and an underbite of tusks
    paths.append([(-0.15, hy - 0.15), (-0.03, hy - 0.10), (0.03, hy - 0.10), (0.15, hy - 0.15)])
    for s in (1, -1):
        tusk = [(0.06, hy + 0.04), (0.10, hy - 0.04), (0.11, hy + 0.04)]
        horn = [(0.10, hy - 0.17), (0.24, hy - 0.30), (0.30, hy - 0.46), (0.20, hy - 0.32), (0.06, hy - 0.20)]
        paths.append(tusk if s > 0 else mx(tusk))
        paths.append(horn if s > 0 else mx(horn))
        eyes.append((s * 0.08, hy - 0.06, 0.03))

    # ---- shoulders and arms, each side breathing out of step with the other ----
    for s in (1, -1):
        sway = 0.05 * math.sin(ph + (0 if s > 0 else math.pi))
        shoulder = (0.50, -0.28 + heave)
        pad = [(0.28, -0.42 + heave), (0.48, -0.56 + heave), (0.70, -0.52 + heave), (0.80, -0.34 + heave),
               (0.72, -0.16 + heave), (0.52, -0.14 + heave)]
        side = [pad]
        # thorns along the pauldron: the grudge, worn on the outside
        for k, (bx, by, a) in enumerate([(0.46, -0.55, -0.3), (0.60, -0.56, 0.15), (0.73, -0.48, 0.55), (0.79, -0.32, 1.0)]):
            ln = 0.13 + 0.015 * math.sin(ph * 2 + k)
            side.append(spike((bx, by + heave), a, ln))
        # vent on the pauldron, puffing on the out-breath
        puff = 0.04 * max(0, -b)
        side.append([(0.56, -0.44 + heave), (0.64, -0.44 + heave), (0.64, -0.36 + heave), (0.56, -0.36 + heave), (0.56, -0.44 + heave)])
        if puff > 0.005:
            side.append([(0.58, -0.47 + heave - puff), (0.60, -0.52 + heave - puff * 1.6)])
            side.append([(0.62, -0.47 + heave - puff), (0.65, -0.55 + heave - puff * 2)])
        # the arm: a long upper arm, a massive forearm, the fist near the ground
        elbow = R((0.74, 0.10), shoulder, sway)
        upper = [(0.58, -0.18 + heave), (0.80, -0.16 + heave), elbow, (elbow[0] - 0.16, elbow[1] + 0.02), (0.56, -0.08 + heave)]
        wrist = R((0.80, 0.50), shoulder, sway * 1.4)
        fore = [(elbow[0] - 0.14, elbow[1]), (elbow[0] + 0.10, elbow[1] - 0.02), (wrist[0] + 0.10, wrist[1]),
                (wrist[0] - 0.12, wrist[1]), (elbow[0] - 0.14, elbow[1])]
        side += [upper, fore]
        # forearm bands
        for f in (0.35, 0.65):
            a = (elbow[0] - 0.14 + (wrist[0] - 0.12 - (elbow[0] - 0.14)) * f, elbow[1] + (wrist[1] - elbow[1]) * f)
            c = (elbow[0] + 0.10 + (wrist[0] + 0.10 - (elbow[0] + 0.10)) * f, elbow[1] - 0.02 + (wrist[1] + 0.02 - elbow[1]) * f)
            side.append([a, c])
        # the fist: a knuckled block that clenches (shrinks and tightens) on the in-breath
        cl = 0.015 * (b + 1) / 2
        fx, fy = wrist
        fist = [(fx - 0.14 + cl, fy), (fx + 0.14 - cl, fy), (fx + 0.16 - cl, fy + 0.18), (fx - 0.16 + cl, fy + 0.18),
                (fx - 0.14 + cl, fy)]
        side.append(fist)
        for k in range(3):
            kx = fx - 0.09 + k * 0.09
            side.append([(kx - 0.03, fy + 0.18), (kx, fy + 0.12), (kx + 0.03, fy + 0.18)])
        # knuckle spikes, standing out more as the fist tightens
        for k, a in enumerate([-0.6, 0.0, 0.6]):
            side.append(spike((fx - 0.08 + k * 0.08, fy + 0.02), a, 0.09 + cl * 3, 0.025))
        for q in side:
            paths.append(q if s > 0 else mx(q))

    return {"p": [flat(q) for q in paths], "e": [[round(x, 3), round(y, 3), d] for x, y, d in eyes]}

if __name__ == "__main__":
    n = 10
    print(json.dumps({"fps": 8, "frames": [frame(i, n) for i in range(n)]}, separators=(",", ":")))
