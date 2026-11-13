"""Shared geometry for the sprite generators in this folder. Art is polylines in a -1..1 box (y down), the same
format as every other drawing in the game; an animated block is {fps, frames: [{p, e}, ...]}.
A generator module defines ID (the enemy id), N (frame count), FPS and frame(i, n) -> {"p": [...], "e": [...]}.
`python3 tools/art/build.py` runs them all and writes js/enemyart.js."""
import math

def R(p, c, a):
    """Rotate point p about c by a radians (clockwise on screen, since y points down)."""
    ca, sa = math.cos(a), math.sin(a)
    dx, dy = p[0] - c[0], p[1] - c[1]
    return (c[0] + dx * ca - dy * sa, c[1] + dx * sa + dy * ca)

def T(pts, dx=0.0, dy=0.0):
    return [(x + dx, y + dy) for x, y in pts]

def rot(pts, c, a):
    return [R(p, c, a) for p in pts]

def S(pts, c, k, ky=None):
    """Scale about c."""
    ky = k if ky is None else ky
    return [(c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * ky) for x, y in pts]

def mx(pts):
    """Mirror across x = 0."""
    return [(-x, y) for x, y in pts]

def box(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]

def ngon(cx, cy, r, n, a0=0.0, ry=None):
    ry = r if ry is None else ry
    return [(cx + math.cos(a0 + k / n * 2 * math.pi) * r, cy + math.sin(a0 + k / n * 2 * math.pi) * ry) for k in range(n + 1)]

def arc(cx, cy, r, a0, a1, steps=10, ry=None):
    ry = r if ry is None else ry
    return [(cx + math.cos(a0 + (a1 - a0) * k / steps) * r, cy + math.sin(a0 + (a1 - a0) * k / steps) * ry)
            for k in range(steps + 1)]

def spike(base, ang, length, w=0.035):
    """A thorn standing out of a surface: ang 0 = straight up, + = clockwise."""
    tip = (base[0] + math.sin(ang) * length, base[1] - math.cos(ang) * length)
    nx, ny = math.cos(ang) * w, math.sin(ang) * w
    return [(base[0] - nx, base[1] - ny), tip, (base[0] + nx, base[1] + ny)]

def bone(p, q, w0, w1):
    """A tapered limb segment as a closed outline from p to q."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n, dx / n
    return [(p[0] + nx * w0, p[1] + ny * w0), (q[0] + nx * w1, q[1] + ny * w1),
            (q[0] - nx * w1, q[1] - ny * w1), (p[0] - nx * w0, p[1] - ny * w0), (p[0] + nx * w0, p[1] + ny * w0)]

def chain(base, angles, lengths):
    """Forward kinematics along a chain: absolute angle per segment (0 = +x, y down). Returns the joint points."""
    pts, p = [base], base
    for a, l in zip(angles, lengths):
        p = (p[0] + math.cos(a) * l, p[1] + math.sin(a) * l)
        pts.append(p)
    return pts

def gear(cx, cy, r, teeth, turn=0.0, inner=0.75):
    pts = []
    for k in range(teeth):
        a0 = k / teeth * 2 * math.pi + turn
        for f, rr in ((0.0, r * inner), (0.15, r), (0.35, r), (0.5, r * inner)):
            a = a0 + f * (2 * math.pi / teeth)
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    pts.append(pts[0])
    return pts

def both(paths, pts):
    """Append a shape and its mirror."""
    paths.append(pts)
    paths.append(mx(pts))

def flat(pts):
    out = []
    for x, y in pts:
        out += [x, y]
    return out

def pack(paths, eyes):
    """paths: list of point lists; eyes: list of (x, y) or (x, y, size)."""
    return {"p": [flat(q) for q in paths if len(q) >= 2],
            "e": [list(e) for e in eyes]}

def wave(ph, k=1.0, off=0.0):
    return math.sin(ph * k + off)

def pos(ph, k=1.0, off=0.0):
    """0..1 version of a sine, for things that only go one way (lift, puff)."""
    return (math.sin(ph * k + off) + 1) / 2

# ---------------------------------------------------------------------------------------------------------------
# Animating a drawing that already exists. original(id) reads an enemy's current art out of js/enemies.js; then
# deform() moves its points by REGION, each region a soft-edged area with its own pivot and motion, so a line
# that runs from a still part into a moving one bends smoothly instead of tearing.

import json as _json, os as _os, re as _re

_SRC = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "..", "js", "enemies.js")

def _object_at(s, start):
    depth, k = 0, start
    while True:
        c = s[k]
        if c in "{[":
            depth += 1
        elif c in "}]":
            depth -= 1
            if depth == 0:
                return s[start:k + 1]
        k += 1

def original(eid, key="art"):
    """The enemy's art block as it is in enemies.js (ELITE_ART overrides win, as they do in the game)."""
    s = open(_SRC).read()
    hits = [m.start() for m in _re.finditer(r"(?:\b%s: \{ c:|ns\.ENEMIES\.%s = \{|\n    %s: \{)" % (eid, eid, eid), s)]
    if not hits:
        raise KeyError(eid)
    best = None
    for h in hits:
        if s[h:h + 60].find(" c:") >= 0:          # an ELITE_ART entry is itself the art block
            best = _object_at(s, s.index("{", h))
            break
    if best is None:
        k = s.index(key + ": {", hits[0])
        best = _object_at(s, k + len(key) + 2)
    txt = _re.sub(r"(?<=[{,\s])([a-z]\w*)\s*:", r'"\1":', best)
    txt = _re.sub(r"'([^']*)'", r'"\1"', txt)
    txt = _re.sub(r",\s*([}\]])", r"\1", txt)
    d = _json.loads(txt)
    paths = [[(p[k], p[k + 1]) for k in range(0, len(p) - 1, 2)] for p in d["p"]]
    eyes = [tuple(e) for e in d.get("e", [])]
    return paths, eyes

def smooth(v, e0, e1):
    """0 below e0, 1 above e1, smoothstep between."""
    if e1 == e0:
        return 1.0 if v >= e1 else 0.0
    t = max(0.0, min(1.0, (v - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)

def deform(paths, eyes, moves):
    """moves: list of (weight_fn(x, y) -> 0..1, fn(point) -> moved point). Each move is blended by its weight."""
    def move(p):
        x, y = p[0], p[1]
        for wfn, fn in moves:
            w = wfn(x, y)
            if w > 0:
                q = fn((x, y))
                x, y = x + (q[0] - x) * w, y + (q[1] - y) * w
        return (x, y)
    P = [[move(p) for p in q] for q in paths]
    E = []
    for e in eyes:
        m = move(e)
        E.append((m[0], m[1]) + tuple(e[2:]))
    return P, E
