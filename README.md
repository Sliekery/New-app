# Eldervale — Thornveil Reach

A **GW1-style MMO-lite prototype** for the phone. High fantasy, first zone, rendered
in a **low-poly 3D** take on the GW1 art style — Three.js (vendored, r147), flat-shaded
terrain and characters, no build step.

Renderer notes: rolling vertex-colored terrain generated from the tile map, instanced
low-poly trees/palisades/crags, primitive-built characters (sword/staff/bow/cleaver),
tilted third-person camera with fog, and a 2D overlay for damage numbers, health bars,
and the virtual joystick. If WebGL is unavailable the logic still runs headless (used
by the test harness).

## Play it

Any static server works:

```bash
cd eldervale
python3 -m http.server 8080
```

Then open `http://<your-ip>:8080` on your phone (same Wi-Fi), or just open
`index.html` directly in a browser. On iOS/Android, use "Add to Home Screen"
for a fullscreen app feel.

## Controls

| Input | Action |
|---|---|
| Drag lower-left of screen | Virtual joystick — move (moving cancels casts, GW1-style) |
| Tap a foe | Target it and engage auto-attack (your character chases into range) |
| Tap ground | Click-to-move |
| Tap Captain Aldra | Walk over and talk (quests) |
| Skill buttons 1–8 | Use skills (energy cost top-left, recharge sweep when used) |
| `?` button | Skill descriptions |
| Desktop | WASD to move, click to target, keys 1–8, Esc to drop target |

## What's GW1 about it

- **8-skill bar** with energy costs, activation (cast) times, and per-skill recharge
- **Energy pips**: constant energy regen (~4 pips), health only regens out of combat
- **Aggro bubble** on the compass (the white circle) — wander inside it and mobs charge
- **Henchman**: Lyra the Mender follows you, assists your target, and heals the party
- **Conditions**: Bleeding, Burning, Crippled — applied by skills, shown on the target bar
- **Death penalty**: −15% max HP/energy per death (stacks to 60%), cleared on level-up
  or quest turn-in; you resurrect at the shrine
- **Resurrection Signet**–style skill to pick Lyra back up mid-fight
- **Called-shot flow**: select target → skills/auto-attack fire on that target
- Outpost safe zone, leashing mobs that reset and heal, social aggro in mob groups

## The skill bar (Sword Vanguard)

1. 🩸 **Sever Artery** — 5e, 4s rc. +8 dmg, Bleeding 12s
2. 🗡️ **Final Thrust** — 10e, 8s rc. +18 dmg, doubled below 50% HP
3. 🌀 **Cyclone Slash** — 8e, 10s rc. Hits all adjacent foes
4. 🦶 **Hamstring** — 7e, 12s rc. Cripples 8s
5. ✚ **Healing Signet** — 0e, 2s cast, 20s rc. Heal 45% max HP
6. 💨 **Sprint** — 5e, 15s rc. +40% speed 6s
7. 🔥 **Fire Bolt** — 10e, 0.8s cast, 5s rc. 35 dmg + Burning (secondary-profession flavor)
8. 💫 **Restore Ally** — 0e, 3s cast, 90s rc. Resurrect Lyra

## Zone: Thornveil Reach

- **Outpost** (SW): Captain Aldra (quests), resurrection shrine, safe zone
- River with a bridge crossing; **River Skales** on the banks
- **Grey Wolf** packs in the meadows (quest 1: *Wolves at the Gates*)
- Bandit road patrol, then the palisaded **Blackmaw camp** (NE) with raiders, archers,
  and the boss **Korr Blackmaw** — he has a telegraphed whirl AoE (quest 2: *The
  Blackmaw Gang*; killing him completes the zone)

## Prototype scope / next steps

This is a single-player vertical slice ("mmolite" = MMO systems without the server):
all combat, AI, and quest logic runs client-side. Natural next steps:

- WebSocket server for shared persistent zones (entity state is already
  plain-data and tick-based, so it ports cleanly to a server-authoritative loop)
- Character persistence (localStorage → account DB), more professions and skill unlocks
- Second zone gate, loot/inventory beyond gold, skill capture from bosses
- Wrap in Capacitor/WKWebView for an installable native app

## Testing

Headless logic tests (map gen, combat, skills, death/respawn, quests, henchman AI)
run under Node with a DOM stub — see the repo history for the harness.
