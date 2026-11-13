"""THE VANGUARD, as a void corsair: armoured trooper crossed with a rogue mercenary. Writes the vanguard entry
of js/playerart.js.  Run: python3 tools/art/players/vanguard.py

Faces RIGHT (+x), y down, feet on 0.97. A gunslinger's stance: weight on the back leg, the front leg stepped
toward the enemy, the off hand resting on a cutlass hilt. The whole gun arm (sleeve, power gauntlet, hand
cannon) is the `weapon` part and swings from the shoulder as one: drawn pointing straight UP from atk.pivot,
carried low at `ready`, snapped level to `aim` and kicked up by the renderer's recoil. The coat tails and the
epaulette fringe are `tatters`, which the renderer sways on their own timer."""
import math, os, re

def fl(path):
    return [round(v, 3) for p in path for v in p]

def closed(pts):
    return list(pts) + [pts[0]]

P, T, W = [], [], []

# ---------------- head: helm with a swept fin crest, a visor slit, a high collar ----------------
P.append(closed([(-0.11, -0.62), (-0.13, -0.80), (-0.05, -0.91), (0.08, -0.92), (0.16, -0.85), (0.18, -0.71), (0.14, -0.62)]))
P.append(closed([(0.01, -0.91), (-0.12, -1.00), (-0.30, -1.04), (-0.21, -0.95), (-0.12, -0.87)]))       # fin crest, swept back
P.append([(-0.12, -1.00), (-0.18, -0.93)])
P.append([(0.02, -0.80), (0.18, -0.78)])                                                                # visor slit
P.append([(0.03, -0.73), (0.18, -0.72)])
P.append([(0.08, -0.67), (0.16, -0.68)]); P.append([(0.10, -0.64), (0.15, -0.645)])                    # rebreather vents
P.append([(-0.11, -0.71), (0.0, -0.73)])                                                                # helm seam
P.append(closed([(-0.09, -0.59), (-0.26, -0.62), (-0.29, -0.82), (-0.15, -0.71)]))                     # high collar, back flap
P.append(closed([(0.13, -0.59), (0.25, -0.62), (0.27, -0.77), (0.18, -0.69)]))                         # front flap

# ---------------- torso: breastplate showing between open coat lapels ----------------
P.append(closed([(-0.10, -0.58), (0.13, -0.58), (0.16, -0.36), (0.10, -0.12), (-0.07, -0.12), (-0.13, -0.36)]))
P.append([(-0.12, -0.32), (0.15, -0.32)]); P.append([(-0.09, -0.22), (0.12, -0.22)])
P.append([(0.01, -0.56), (0.01, -0.34)])
# the coat's front panels and lapels
P.append([(-0.10, -0.58), (-0.31, -0.57), (-0.38, -0.32), (-0.33, -0.06)])
P.append([(-0.10, -0.58), (-0.19, -0.42), (-0.12, -0.24), (-0.14, -0.06)])
P.append([(0.13, -0.58), (0.31, -0.57), (0.36, -0.32), (0.32, -0.06)])
P.append([(0.13, -0.58), (0.22, -0.42), (0.15, -0.24), (0.17, -0.06)])
for k in range(3):                                                                                      # clasps
    y = -0.48 + k * 0.12
    P.append([(-0.22 + k * 0.01, y), (-0.16 + k * 0.01, y)]); P.append([(0.19 - k * 0.01, y), (0.25 - k * 0.01, y)])
# baldric strap from the gun shoulder across to the cutlass hip
P.append([(0.27, -0.55), (-0.27, -0.06)]); P.append([(0.30, -0.50), (-0.24, -0.02)])
# belt and buckle
P.append(closed([(-0.33, -0.08), (0.32, -0.08), (0.33, 0.03), (-0.34, 0.03)]))
P.append(closed([(-0.04, -0.07), (0.05, -0.07), (0.05, 0.02), (-0.04, 0.02)]))
P.append(closed([(0.16, -0.06), (0.26, -0.06), (0.26, 0.08), (0.16, 0.08)]))                           # powder pouch

# ---------------- the gun shoulder: a heavy power pauldron (the arm itself swings below it) ----------------
P.append(closed([(0.22, -0.60), (0.42, -0.66), (0.54, -0.55), (0.52, -0.40), (0.36, -0.36), (0.24, -0.44)]))
P.append([(0.27, -0.56), (0.44, -0.60), (0.51, -0.51)]); P.append([(0.29, -0.48), (0.45, -0.51), (0.50, -0.44)])

# ---------------- the off side: fringed epaulette, arm down to a hand on the cutlass ----------------
P.append(closed([(-0.29, -0.61), (-0.44, -0.62), (-0.52, -0.54), (-0.46, -0.47), (-0.30, -0.49)]))
for k in range(5):                                                                                      # the fringe hangs and swings
    x = -0.48 + k * 0.04
    T.append([(x, -0.48), (x - 0.01, -0.41)])
P.append([(-0.46, -0.47), (-0.48, -0.26), (-0.40, -0.06)])                                              # sleeve, outer
P.append([(-0.34, -0.48), (-0.37, -0.28), (-0.31, -0.10)])                                              # sleeve, inner
P.append(closed([(-0.42, -0.08), (-0.30, -0.12), (-0.28, -0.04), (-0.40, 0.0)]))                       # cuff
P.append(closed([(-0.40, 0.0), (-0.28, -0.04), (-0.26, 0.05), (-0.36, 0.08)]))                         # hand on the hilt
# the cutlass: basket guard at the hip, scabbard angled back and down
P.append([(-0.27, 0.04), (-0.22, 0.10), (-0.30, 0.16), (-0.38, 0.10)])
P.append([(-0.34, 0.12), (-0.60, 0.50)]); P.append([(-0.29, 0.15), (-0.55, 0.53)])
P.append(closed([(-0.60, 0.50), (-0.55, 0.53), (-0.60, 0.58), (-0.64, 0.54)]))

# ---------------- legs: the gunslinger's stance ----------------
def leg(hip, knee, ank, toe, s):
    """an armoured leg through hip-knee-ankle with a tall cuffed boot; s=+1 toward the enemy."""
    out = []
    def side(a, b, w):
        dx, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dx, dy)
        return (-dy / l * w, dx / l * w)
    n1 = side(hip, knee, 1); n2 = side(knee, ank, 1)
    out.append(closed([(hip[0] - n1[0] * 0.12, hip[1] - n1[1] * 0.12), (hip[0] + n1[0] * 0.12, hip[1] + n1[1] * 0.12),
                       (knee[0] + n1[0] * 0.09, knee[1] + n1[1] * 0.09), (knee[0] - n1[0] * 0.09, knee[1] - n1[1] * 0.09)]))
    out.append(closed([(knee[0] - 0.10, knee[1] - 0.05), (knee[0] + 0.10, knee[1] - 0.07), (knee[0] + 0.11, knee[1] + 0.05),
                       (knee[0], knee[1] + 0.09), (knee[0] - 0.10, knee[1] + 0.05)]))                      # knee guard
    # tall boot from just under the knee, a folded cuff, the foot
    cuff = (knee[0] + (ank[0] - knee[0]) * 0.18, knee[1] + (ank[1] - knee[1]) * 0.18)
    out.append(closed([(cuff[0] - n2[0] * 0.11, cuff[1] - n2[1] * 0.11), (cuff[0] + n2[0] * 0.11, cuff[1] + n2[1] * 0.11),
                       (cuff[0] + n2[0] * 0.10 + 0.0, cuff[1] + 0.07), (cuff[0] - n2[0] * 0.10, cuff[1] + 0.07)]))
    out.append([(cuff[0] - n2[0] * 0.09, cuff[1] + 0.07), (ank[0] - n2[0] * 0.08, ank[1])])
    out.append([(cuff[0] + n2[0] * 0.09, cuff[1] + 0.07), (ank[0] + n2[0] * 0.08, ank[1])])
    out.append(closed([(ank[0] - s * 0.09, ank[1]), (ank[0] + s * 0.08, ank[1] - 0.01), (toe[0], 0.92), (toe[0], 0.97), (ank[0] - s * 0.10, 0.97)]))
    out.append([(ank[0] - s * 0.09, 0.93), (toe[0] - s * 0.02, 0.93)])
    return out
P += leg((0.13, 0.06), (0.30, 0.46), (0.34, 0.84), (0.52, 0.97), 1)        # front leg, stepped toward the enemy, knee bent
P += leg((-0.12, 0.06), (-0.24, 0.47), (-0.34, 0.85), (-0.18, 0.97), 1)    # back leg, braced and straight, weight on it

# ---------------- the coat tails: long, split behind, flaring ----------------
T.append([(-0.33, 0.03), (-0.44, 0.30), (-0.56, 0.62), (-0.46, 0.64), (-0.50, 0.76), (-0.34, 0.66)])
T.append([(-0.16, 0.03), (-0.24, 0.32), (-0.26, 0.62), (-0.18, 0.56), (-0.14, 0.64)])
T.append([(0.32, 0.03), (0.40, 0.22), (0.46, 0.44), (0.38, 0.42), (0.36, 0.50)])

# ---------------- the gun arm: sleeve, power gauntlet, hand cannon, all drawn pointing UP from the pivot ----------------
PX, PY = 0.36, -0.48
def at(dx, dy):
    return (PX + dx, PY - dy)
W.append([at(-0.065, 0.0), at(-0.06, 0.26)]); W.append([at(0.065, 0.0), at(0.06, 0.26)])            # coat sleeve
W.append(closed([at(-0.075, 0.10), at(0.075, 0.10), at(0.075, 0.16), at(-0.075, 0.16)]))             # elbow cop
W.append(closed([at(-0.09, 0.26), at(0.10, 0.26), at(0.11, 0.42), at(-0.08, 0.44)]))                # power gauntlet
W.append([at(-0.08, 0.31), at(0.10, 0.31)]); W.append([at(-0.08, 0.37), at(0.105, 0.37)])
W.append(closed([at(0.10, 0.28), at(0.15, 0.30), at(0.15, 0.40), at(0.11, 0.41)]))                   # gauntlet power cell
W.append(closed([at(-0.07, 0.44), at(0.09, 0.44), at(0.09, 0.60), at(-0.07, 0.60)]))                # cylinder block
for k in range(3):
    W.append([at(-0.07, 0.48 + k * 0.04), at(0.09, 0.48 + k * 0.04)])
W.append(closed([at(-0.045, 0.60), at(0.06, 0.60), at(0.055, 0.78), at(-0.04, 0.78)]))               # barrel
W.append([at(-0.08, 0.52), at(-0.08, 0.72)])                                                         # top rib
W.append(closed([at(-0.065, 0.78), at(0.075, 0.78), at(0.075, 0.83), at(-0.065, 0.83)]))             # muzzle brake
W.append([at(0.09, 0.48), at(0.14, 0.46), at(0.13, 0.42)])                                           # hammer
MZ = [round(PX + 0.005, 3), round(PY - 0.86, 3)]

ART = {
    "p": [fl(q) for q in P],
    "e": [[0.12, -0.755, 0.035], [0.05, -0.76, 0.022]],
    "weapon": [fl(q) for q in W],
    "tatters": [fl(q) for q in T],
    "muzzle": MZ,
    # the carry is LOW, a gunslinger's: arm hanging forward and down; aim snaps it level
    "atk": {"type": "aim", "pivot": [PX, PY], "aim": 1.50, "ready": 2.15, "muzzle": MZ},
}

def js(v):
    return "[" + ", ".join(js(x) if isinstance(x, list) else ("%g" % x) for x in v) + "]"

def block():
    rows = lambda key: ",\n".join("        " + js(q) for q in ART[key])
    a = ART["atk"]
    return ("    vanguard: {\n"
            "      color: '#5dff88',\n"
            "      // VOID CORSAIR (generated by tools/art/players/vanguard.py; edit that, not this): an armoured\n"
            "      // trooper gone rogue. Finned helm, high-collared long coat over a breastplate, a power pauldron\n"
            "      // on the gun arm and a fringed epaulette on the other, hand resting on a cutlass, a gunslinger's\n"
            "      // stance. The gun arm is the weapon part and swings whole from the shoulder.\n"
            "      p: [\n" + rows("p") + "],\n"
            "      e: " + js(ART["e"]) + ",\n"
            "      muzzle: " + js(ART["muzzle"]) + ",\n"
            "      // the whole arm: coat sleeve, power gauntlet, hand cannon, drawn pointing up from the shoulder pivot\n"
            "      weapon: [\n" + rows("weapon") + "],\n"
            "      // coat tails and epaulette fringe, swayed by the renderer\n"
            "      tatters: [\n" + rows("tatters") + "],\n"
            "      // ready = the idle carry, held LOW; aim = level on target; recoil climbs from aim\n"
            "      atk: { type: 'aim', pivot: " + js(a["pivot"]) + ", aim: %g, ready: %g, muzzle: " % (a["aim"], a["ready"]) + js(a["muzzle"]) + " },\n"
            "    },\n")

if __name__ == "__main__":
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "js", "playerart.js")
    s = open(path).read()
    a = s.index("    vanguard: {\n"); b = s.index("    technomancer: {\n")
    s = s[:a] + block() + s[b:]
    open(path, "w").write(s)
    print("wrote vanguard: %d body paths, %d weapon, %d tatters" % (len(ART["p"]), len(ART["weapon"]), len(ART["tatters"])))
