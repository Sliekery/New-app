"""Five directions for a less blocky Vanguard: armoured trooper crossed with a rogue mercenary.
Same rig as js/playerart.js: faces RIGHT (+x), feet ~0.97, weapon drawn pointing UP from atk.pivot and swung
to `ready` by the renderer; `tatters` are the cloth parts the renderer sways on their own timer.
Run: python3 vanguard_concepts.py  -> prints {name: art} JSON."""
import json, math, sys

def fl(path):
    return [round(v, 3) for p in path for v in p]

def arc(cx, cy, rx, ry, a0, a1, n=8):
    return [(cx + math.cos(a0 + (a1 - a0) * k / n) * rx, cy + math.sin(a0 + (a1 - a0) * k / n) * ry) for k in range(n + 1)]

def closed(pts):
    return list(pts) + [pts[0]]

def rifle_long(px, py, L=0.86, scope=True):
    """a slim long rifle drawn straight up from (px, py): stock, receiver, long barrel, scope."""
    w = []
    w.append(closed([(px - 0.04, py + 0.06), (px + 0.05, py + 0.06), (px + 0.05, py - 0.22), (px - 0.05, py - 0.18)]))   # stock
    w.append(closed([(px - 0.05, py - 0.18), (px + 0.06, py - 0.22), (px + 0.06, py - 0.44), (px - 0.04, py - 0.44)]))   # receiver
    w.append([(px + 0.06, py - 0.30), (px + 0.13, py - 0.33), (px + 0.11, py - 0.40), (px + 0.06, py - 0.38)])            # magazine
    w.append([(px - 0.01, py - 0.44), (px - 0.01, py - L)]); w.append([(px + 0.03, py - 0.44), (px + 0.03, py - L)])      # barrel
    w.append(closed([(px - 0.03, py - L), (px + 0.05, py - L), (px + 0.05, py - L - 0.05), (px - 0.03, py - L - 0.05)]))  # brake
    if scope:
        w.append(closed([(px - 0.09, py - 0.30), (px - 0.05, py - 0.30), (px - 0.05, py - 0.52), (px - 0.09, py - 0.52)]))
    return w, [px + 0.01, py - L - 0.06]

def carbine(px, py):
    w = []
    w.append(closed([(px - 0.05, py + 0.05), (px + 0.06, py + 0.04), (px + 0.07, py - 0.42), (px - 0.05, py - 0.42)]))
    w.append([(px - 0.05, py - 0.16), (px + 0.07, py - 0.16)])
    w.append(closed([(px + 0.07, py - 0.20), (px + 0.17, py - 0.22), (px + 0.17, py - 0.34), (px + 0.07, py - 0.32)]))   # drum
    w.append(closed([(px - 0.03, py - 0.42), (px + 0.05, py - 0.42), (px + 0.04, py - 0.66), (px - 0.02, py - 0.66)]))
    w.append([(px - 0.04, py - 0.50), (px + 0.06, py - 0.50)]); w.append([(px - 0.04, py - 0.58), (px + 0.06, py - 0.58)])
    return w, [px + 0.01, py - 0.70]

def shotgun(px, py):
    w = []
    w.append(closed([(px - 0.06, py + 0.06), (px + 0.07, py + 0.06), (px + 0.08, py - 0.30), (px - 0.06, py - 0.30)]))
    w.append(closed([(px - 0.07, py - 0.30), (px + 0.09, py - 0.30), (px + 0.09, py - 0.70), (px - 0.07, py - 0.70)]))  # twin barrels
    w.append([(px + 0.01, py - 0.30), (px + 0.01, py - 0.70)])
    w.append(closed([(px - 0.09, py - 0.40), (px + 0.11, py - 0.40), (px + 0.11, py - 0.50), (px - 0.09, py - 0.50)])) # pump
    w.append([(px - 0.04, py - 0.74), (px - 0.04, py - 0.70)]); w.append([(px + 0.06, py - 0.74), (px + 0.06, py - 0.70)])
    return w, [px + 0.01, py - 0.76]

def handcannon(px, py):
    w = []
    w.append(closed([(px - 0.05, py + 0.04), (px + 0.06, py + 0.04), (px + 0.06, py - 0.16), (px - 0.05, py - 0.16)]))
    w.append(closed([(px - 0.08, py - 0.16), (px + 0.10, py - 0.16), (px + 0.10, py - 0.40), (px - 0.08, py - 0.40)]))   # cylinder block
    for k in range(3):
        w.append([(px - 0.08, py - 0.22 - k * 0.06), (px + 0.10, py - 0.22 - k * 0.06)])
    w.append(closed([(px - 0.05, py - 0.40), (px + 0.07, py - 0.40), (px + 0.07, py - 0.62), (px - 0.05, py - 0.62)]))
    w.append(closed([(px - 0.07, py - 0.62), (px + 0.09, py - 0.62), (px + 0.09, py - 0.68), (px - 0.07, py - 0.68)]))
    return w, [px + 0.01, py - 0.70]

def legs(slim=0.0, coat=False):
    """armoured but tapered legs, braced stance, boots. slim narrows them."""
    out = []
    for s in (1, -1):
        hip, knee, ank = (s * 0.14, 0.10), (s * (0.25 - slim), 0.48), (s * (0.28 - slim), 0.84)
        th = [(hip[0] - s * 0.09, hip[1]), (hip[0] + s * 0.15, hip[1]), (knee[0] + s * 0.10, knee[1] - 0.04), (knee[0] - s * 0.09, knee[1] - 0.04)]
        out.append(closed(th))
        out.append([(hip[0] - s * 0.04, hip[1] + 0.12), (hip[0] + s * 0.12, hip[1] + 0.10)])                     # thigh plate seam
        out.append(closed([(knee[0] - s * 0.11, knee[1] - 0.06), (knee[0] + s * 0.11, knee[1] - 0.08), (knee[0] + s * 0.12, knee[1] + 0.06),
                           (knee[0], knee[1] + 0.10), (knee[0] - s * 0.10, knee[1] + 0.06)]))                 # knee guard
        out.append(closed([(knee[0] - s * 0.09, knee[1] + 0.07), (knee[0] + s * 0.10, knee[1] + 0.07), (ank[0] + s * 0.10, ank[1]), (ank[0] - s * 0.08, ank[1])]))
        out.append(closed([(ank[0] - s * 0.10, ank[1]), (ank[0] + s * 0.11, ank[1] - 0.01), (ank[0] + s * 0.18, 0.92), (ank[0] + s * 0.18, 0.97),
                           (ank[0] - s * 0.11, 0.97)]))                                                         # heavy boot
        out.append([(ank[0] - s * 0.10, 0.92), (ank[0] + s * 0.17, 0.92)])
    return out

def bulk(path, k):
    """armour mass: widen the shoulders-to-hips band by k, leaving the head and legs as drawn."""
    out = []
    for x, y in path:
        w = 1.0
        if -0.66 < y < 0.12:
            w = 1.0 + k * min(1.0, (y + 0.66) / 0.10, (0.12 - y) / 0.14)
        out.append((x * w, y))
    return out

def mk(p, e, weapon, muzzle, pivot, tatters=None, ready=0.88, aim=1.46, k=0.28):
    p = [bulk(q, k) for q in p]
    dx = bulk([tuple(pivot)], k)[0][0] - pivot[0]          # the gun rides out with the shoulder it hangs on
    weapon = [[(x + dx, y) for x, y in q] for q in weapon]
    pivot = [round(pivot[0] + dx, 3), pivot[1]]
    muzzle = [round(muzzle[0] + dx, 3), muzzle[1]]
    if tatters:
        tatters = [bulk(q, k) for q in tatters]
    a = {"color": "#5dff8a", "p": [fl(q) for q in p], "e": e, "muzzle": muzzle, "weapon": [fl(q) for q in weapon],
         "atk": {"type": "aim", "pivot": pivot, "aim": aim, "ready": ready, "muzzle": muzzle}}
    if tatters:
        a["tatters"] = [fl(q) for q in tatters]
    return a

C = {}

# ---------------- 1. DRIFTER: armoured duster, scarf, one big pauldron, long rifle ----------------
p, t = [], []
p.append(closed([(-0.13, -0.62), (-0.15, -0.80), (-0.06, -0.92), (0.08, -0.92), (0.16, -0.82), (0.15, -0.64)]))       # rounded helm
p.append([(-0.10, -0.78), (0.17, -0.77), (0.17, -0.71), (-0.08, -0.72)])                                              # visor band
p.append([(-0.12, -0.84), (-0.20, -1.00)])                                                                            # whip antenna
p.append(closed([(-0.24, -0.58), (0.26, -0.58), (0.22, -0.30), (0.10, -0.12), (-0.10, -0.12), (-0.22, -0.30)]))       # tapered chest
p.append([(0.0, -0.56), (0.0, -0.18)]); p.append([(-0.20, -0.44), (0.20, -0.44)])
p.append([(-0.22, -0.56), (0.18, -0.14)])                                                                             # bandolier
for k in range(4):
    x, y = -0.14 + k * 0.08, -0.48 + k * 0.077
    p.append(closed([(x - 0.02, y - 0.03), (x + 0.02, y - 0.03), (x + 0.02, y + 0.03), (x - 0.02, y + 0.03)]))
p.append(closed([(-0.18, -0.12), (0.18, -0.12), (0.19, 0.0), (-0.19, 0.0)]))                                          # belt
p.append(closed([(0.10, -0.02), (0.18, -0.02), (0.18, 0.08), (0.10, 0.08)]))                                          # pouch
p.append(arc(0.30, -0.52, 0.20, 0.14, math.pi, 2 * math.pi + 0.5, 8) + [(0.22, -0.40)])                                # gun-side pauldron
p.append(arc(0.30, -0.50, 0.13, 0.08, math.pi + 0.3, 2 * math.pi, 6))
p.append(closed([(-0.22, -0.58), (-0.36, -0.58), (-0.42, -0.46), (-0.30, -0.40)]))                                  # light off-side plate
p.append([(-0.30, -0.42), (-0.38, -0.18), (-0.36, 0.08)])                                                            # off arm, coat sleeve
p.append([(-0.24, -0.40), (-0.27, -0.18), (-0.26, 0.06)])
p.append(closed([(-0.40, 0.06), (-0.24, 0.06), (-0.25, 0.18), (-0.39, 0.18)]))                                        # gauntlet
p += legs(0.02)
# the duster: split at the front, hem frayed (cloth -> tatters)
t.append([(-0.19, 0.0), (-0.30, 0.30), (-0.36, 0.62), (-0.30, 0.66), (-0.33, 0.72), (-0.24, 0.70)])
t.append([(0.19, 0.0), (0.28, 0.28), (0.32, 0.56), (0.26, 0.60), (0.27, 0.66), (0.18, 0.62)])
p.append([(-0.14, -0.62), (0.0, -0.56), (0.16, -0.62)]); p.append([(-0.14, -0.60), (0.0, -0.53), (0.16, -0.60)])  # scarf wrap at the neck
t.append([(-0.14, -0.62), (-0.30, -0.66), (-0.44, -0.62), (-0.54, -0.50)])                                             # scarf tails, streaming back
t.append([(-0.14, -0.60), (-0.26, -0.58), (-0.36, -0.48), (-0.40, -0.36)])
w, mz = rifle_long(0.32, -0.46)
C["drifter"] = mk(p, [[0.04, -0.745], [0.12, -0.745]], w, mz, [0.32, -0.46], t)

# ---------------- 2. HUNTER: sloped lens-helm with a grille, half-cape, slim plate, carbine ----------------
p, t = [], []
p.append(closed([(-0.13, -0.60), (-0.15, -0.78), (-0.08, -0.90), (0.06, -0.92), (0.14, -0.86), (0.18, -0.72), (0.16, -0.60)]))   # helm sloping forward
p.append(closed([(0.02, -0.82), (0.10, -0.82), (0.10, -0.74), (0.02, -0.74)])); p.append(closed([(0.11, -0.80), (0.17, -0.79), (0.17, -0.73), (0.11, -0.73)]))  # twin lenses
for k in range(3):
    p.append([(0.06 + k * 0.04, -0.70), (0.06 + k * 0.04, -0.63)])                                                  # breathing grille
p.append([(-0.10, -0.88), (-0.13, -0.98)])                                                                         # stub antenna
p.append(closed([(-0.22, -0.58), (0.24, -0.58), (0.26, -0.40), (0.14, -0.14), (-0.14, -0.14), (-0.24, -0.40)]))
p.append([(-0.22, -0.40), (0.0, -0.30), (0.24, -0.40)]); p.append([(-0.16, -0.22), (0.16, -0.22)])
p.append(closed([(0.22, -0.60), (0.40, -0.58), (0.44, -0.44), (0.30, -0.38), (0.22, -0.46)]))                        # small gun pauldron
p.append([(0.24, -0.52), (0.40, -0.50)])
p.append(closed([(-0.16, -0.14), (0.16, -0.14), (0.18, -0.02), (-0.18, -0.02)]))
p.append([(-0.04, -0.14), (-0.04, -0.02)])
p.append(closed([(0.20, 0.02), (0.30, 0.0), (0.32, 0.26), (0.22, 0.28)]))                                            # holster on thigh
p.append([(0.24, 0.0), (0.26, -0.08), (0.30, -0.08)])
p.append([(-0.22, -0.48), (-0.30, -0.22), (-0.28, 0.02)]); p.append([(-0.16, -0.44), (-0.20, -0.22), (-0.18, 0.02)])
p.append(closed([(-0.31, 0.02), (-0.17, 0.02), (-0.18, 0.14), (-0.30, 0.14)]))
p += legs(0.04)
# half-cape off the left shoulder, swept back
t.append([(-0.10, -0.62), (-0.30, -0.62), (-0.46, -0.40), (-0.54, -0.04), (-0.58, 0.30), (-0.46, 0.26), (-0.48, 0.38), (-0.36, 0.30)])
t.append([(-0.20, -0.58), (-0.34, -0.30), (-0.40, 0.10), (-0.36, 0.30)])
w, mz = carbine(0.30, -0.44)
C["hunter"] = mk(p, [[0.06, -0.78, 0.03], [0.14, -0.765, 0.025]], w, mz, [0.30, -0.44], t)

# ---------------- 3. BREACHER: bare head, rebreather, cyber-eye, angled plate, augmetic arm, shotgun ----------------
p, t = [], []
p.append([(-0.10, -0.64), (-0.12, -0.80), (-0.06, -0.90), (0.06, -0.90), (0.12, -0.82), (0.12, -0.66)])          # head (no helm)
for k in range(5):                                                                                                 # crest of hair
    x = -0.06 + k * 0.03
    p.append([(x, -0.90), (x - 0.03, -0.98 - 0.02 * (k % 2))])
p.append(closed([(0.0, -0.70), (0.16, -0.72), (0.18, -0.62), (0.02, -0.60)]))                                      # rebreather
p.append([(0.06, -0.66), (0.16, -0.66)])
p.append([(0.02, -0.62), (-0.02, -0.54), (-0.10, -0.52)])                                                          # hose
p.append(closed([(0.04, -0.82), (0.12, -0.82), (0.12, -0.76), (0.04, -0.76)]))                                     # cyber-eye socket
p.append(closed([(-0.30, -0.58), (0.30, -0.58), (0.34, -0.42), (0.20, -0.16), (-0.20, -0.16), (-0.32, -0.42)]))
p.append([(-0.30, -0.58), (0.0, -0.36), (0.30, -0.58)]); p.append([(0.0, -0.36), (0.0, -0.16)])
p.append([(-0.04, -0.56), (0.0, -0.46), (0.04, -0.56)]); p.append(closed([(-0.02, -0.46), (0.02, -0.46), (0.02, -0.40), (-0.02, -0.40)]))  # dog tags
p.append(closed([(0.26, -0.62), (0.48, -0.60), (0.54, -0.42), (0.40, -0.32), (0.28, -0.40)]))                       # gun pauldron, angled
p.append([(0.30, -0.56), (0.46, -0.54)]); p.append([(0.32, -0.48), (0.48, -0.46)])
p.append(closed([(-0.20, -0.16), (0.20, -0.16), (0.21, -0.04), (-0.21, -0.04)]))
for k in range(5):
    p.append(closed([(-0.18 + k * 0.08, -0.14), (-0.14 + k * 0.08, -0.14), (-0.14 + k * 0.08, -0.06), (-0.18 + k * 0.08, -0.06)]))
# augmetic off arm: pistons
p.append(closed([(-0.30, -0.56), (-0.42, -0.50), (-0.44, -0.34), (-0.32, -0.30)]))
p.append([(-0.40, -0.32), (-0.44, -0.04)]); p.append([(-0.34, -0.32), (-0.36, -0.04)]); p.append([(-0.38, -0.32), (-0.40, -0.04)])
p.append(closed([(-0.48, -0.04), (-0.32, -0.04), (-0.30, 0.10), (-0.48, 0.12)]))
p.append([(-0.46, 0.12), (-0.48, 0.18)]); p.append([(-0.40, 0.12), (-0.40, 0.19)]); p.append([(-0.34, 0.11), (-0.32, 0.18)])
p += legs(0.0)
t.append([(-0.20, -0.04), (-0.24, 0.20), (-0.20, 0.30)]); t.append([(0.20, -0.04), (0.26, 0.18), (0.22, 0.28)])        # loincloth flaps
w, mz = shotgun(0.32, -0.44)
C["breacher"] = mk(p, [[0.08, -0.79, 0.045], [-0.02, -0.79, 0.025]], w, mz, [0.32, -0.44], t)

# ---------------- 4. RANGER: hood over a slit helm, tattered poncho, marksman rifle ----------------
p, t = [], []
p.append([(-0.20, -0.56), (-0.22, -0.78), (-0.10, -0.96), (0.08, -1.00), (0.20, -0.86), (0.20, -0.64)])            # hood
p.append(closed([(-0.08, -0.62), (-0.10, -0.80), (0.0, -0.88), (0.12, -0.84), (0.14, -0.64)]))                      # face plate in the hood
p.append([(-0.04, -0.75), (0.13, -0.74)])                                                                          # slit
p.append(closed([(-0.22, -0.56), (0.24, -0.56), (0.22, -0.26), (0.14, -0.10), (-0.14, -0.10), (-0.22, -0.26)]))
p.append([(-0.18, -0.24), (0.18, -0.24)]); p.append([(-0.14, -0.10), (0.14, -0.10), (0.16, 0.02), (-0.16, 0.02)])
p.append(closed([(0.24, -0.58), (0.38, -0.54), (0.40, -0.40), (0.26, -0.40)]))
p.append([(-0.22, -0.50), (-0.30, -0.24), (-0.30, 0.0)]); p.append(closed([(-0.34, 0.0), (-0.22, 0.0), (-0.23, 0.12), (-0.33, 0.12)]))
p += legs(0.05)
p.append(closed([(-0.30, 0.44), (-0.16, 0.44), (-0.17, 0.54), (-0.30, 0.54)]))                                    # knee pad
# the poncho, falling from the shoulders to the thigh, ragged
t.append([(-0.20, -0.58), (-0.40, -0.40), (-0.46, -0.06), (-0.40, 0.04), (-0.44, 0.14), (-0.32, 0.10), (-0.30, 0.22), (-0.20, 0.12)])
t.append([(0.20, -0.58), (0.34, -0.34), (0.38, -0.06), (0.32, 0.0), (0.34, 0.10), (0.22, 0.06)])
t.append([(-0.18, -0.92), (-0.34, -0.86), (-0.46, -0.78)])                                                         # hood tail
w, mz = rifle_long(0.32, -0.44, L=0.98)
C["ranger"] = mk(p, [[0.06, -0.745, 0.03]], w, mz, [0.32, -0.44], t)

# ---------------- 5. CORSAIR: crested helm, high collar coat with tails, oversized gauntlet, hand cannon ----------------
p, t = [], []
p.append(closed([(-0.12, -0.62), (-0.14, -0.82), (-0.04, -0.92), (0.10, -0.90), (0.15, -0.80), (0.14, -0.62)]))
p.append([(-0.04, -0.92), (-0.12, -1.02), (-0.26, -1.04), (-0.18, -0.94), (-0.12, -0.86)])                          # swept crest fin
p.append([(0.0, -0.78), (0.15, -0.76)]); p.append([(0.0, -0.70), (0.14, -0.70)])
p.append([(-0.22, -0.54), (-0.26, -0.72), (-0.12, -0.62)]); p.append([(0.22, -0.54), (0.24, -0.70), (0.14, -0.62)])  # high collar
p.append(closed([(-0.24, -0.56), (0.24, -0.56), (0.22, -0.30), (0.12, -0.12), (-0.12, -0.12), (-0.22, -0.30)]))
p.append([(-0.06, -0.54), (-0.06, -0.14)]); p.append([(0.06, -0.54), (0.06, -0.14)])
for k in range(3):
    p.append(closed([(-0.03, -0.46 + k * 0.10), (0.03, -0.46 + k * 0.10), (0.03, -0.42 + k * 0.10), (-0.03, -0.42 + k * 0.10)]))
p.append(closed([(-0.16, -0.12), (0.16, -0.12), (0.17, -0.02), (-0.17, -0.02)])); p.append(closed([(-0.04, -0.12), (0.04, -0.12), (0.04, -0.02), (-0.04, -0.02)]))
# gun arm: the oversized power gauntlet
p.append(closed([(0.22, -0.56), (0.40, -0.60), (0.48, -0.46), (0.38, -0.36), (0.24, -0.42)]))
p.append(closed([(0.26, -0.50), (0.42, -0.50), (0.42, -0.36), (0.26, -0.38)]))
# off arm in a coat sleeve, hand on hip
p.append([(-0.24, -0.54), (-0.36, -0.40), (-0.40, -0.20), (-0.24, -0.08)]); p.append([(-0.24, -0.40), (-0.30, -0.24), (-0.20, -0.14)])
p += legs(0.03)
# coat tails flaring behind, split
t.append([(-0.17, -0.04), (-0.34, 0.20), (-0.46, 0.52), (-0.36, 0.54), (-0.40, 0.66), (-0.26, 0.58)])
t.append([(-0.10, -0.02), (-0.20, 0.30), (-0.22, 0.56), (-0.14, 0.50)])
t.append([(0.17, -0.04), (0.26, 0.20), (0.30, 0.44), (0.22, 0.42)])
w, mz = handcannon(0.34, -0.44)
C["corsair"] = mk(p, [[0.08, -0.77], [0.08, -0.70, 0.02]], w, mz, [0.34, -0.44], t)

if __name__ == "__main__":
    json.dump(C, sys.stdout, separators=(",", ":"))
