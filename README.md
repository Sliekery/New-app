# Eldervale — The Sunward Reach

A **GW1-style MMO-lite prototype** for the phone — a full level 1–10 campaign in the
spirit of Nightfall's Istan starting zone. Rendered
in a **low-poly 3D** take on the GW1 art style — Three.js (vendored, r147), flat-shaded
terrain and characters, no build step.

Renderer (Three.js, vendored): ACES-filmic tone mapping, a gradient sky dome with a sun
disc, warm directional sunlight with optional dynamic shadows, vertex-colored rolling
terrain, animated swelling water, instanced palms/acacias/grass tufts/crags, adobe and
tent props, primitive-built animated characters, and a cinematic vignette. Graphics
quality (Low/Medium/High) is selectable in Settings. If WebGL is unavailable the game
logic still runs headless (used by the 39-check test harness).

## Controls & UI

Tap-only, GW1 mouse-style. The left-edge menu opens full-screen panels:
**🛡️ Hero** (stats, attributes, equipment), **✨ Skills & Builds** (skill bar reference,
save/load attribute builds, refund), **🎒 Inventory** (item grid — equip / sell / drop),
**📜 Quest Log**, and **⚙️ Settings** (graphics quality + shadows, camera zoom, vignette,
fullscreen, delete save). Tapping a panel or an NPC dialog never moves your character;
tap the dim backdrop to close. The layout adapts to portrait and landscape. Progress
auto-saves to the device (localStorage) and reloads on return.

## Play it

Any static server works:

```bash
cd eldervale
python3 -m http.server 8080
```

Then open `http://<your-ip>:8080` on your phone (same Wi-Fi), or just open
`index.html` directly in a browser. On iOS/Android, use "Add to Home Screen"
for a fullscreen app feel.

| Input | Action |
|---|---|
| Tap ground | Walk there (moving cancels casts, GW1-style) |
| Tap a foe | Target it and engage auto-attack (your character chases into range) |
| Tap an NPC | Walk over and talk (quests, merchant) |
| Skill buttons 1–8 | Use skills (cost top-left, recharge sweep / adrenaline fill) |
| Desktop | WASD to move, click to target, keys 1–8, Esc to drop target |

## What's GW1 about it

- **8-skill bar** with energy costs, activation (cast) times, and per-skill recharge
- **Adrenaline** for the Warrior: strikes build it, skills like Sever Artery → Gash →
  Final Thrust spend it (Final Thrust drains it all); it fades out of combat
- **Conditions incl. Deep Wound** (−20% max HP), Bleeding, Burning, Crippled/Chilled
- **Attributes**: +3 points per level, spent in the Hero panel (🛡️) — Strength /
  Swordsmanship / Tactics, or Energy Storage / Fire Magic / Storm Magic
- **Items & inventory**: weapons, shields/foci and trophies drop with GW1 rarity
  colors (white/blue/purple/gold); equip gear in the Inventory grid (🎒), sell
  trophies to Merchant Suki at the outpost
- **Level cap 10** with a 5-quest chain that carries you there
- **Energy pips**: constant energy regen (~4 pips), health only regens out of combat
- **Aggro bubble** on the compass (the white circle) — wander inside it and mobs charge
- **Henchman**: Lyra the Mender follows you, assists your target, and heals the party
- **Conditions**: Bleeding, Burning, Crippled — applied by skills, shown on the target bar
- **Death penalty**: −15% max HP/energy per death (stacks to 60%), cleared on level-up
  or quest turn-in; you resurrect at the shrine
- **Resurrection Signet**–style skill to pick Lyra back up mid-fight
- **Called-shot flow**: select target → skills/auto-attack fire on that target
- Outpost safe zone, leashing mobs that reset and heal, social aggro in mob groups

## Professions

Pick at character start, GW1 primary/secondary flavor:

- ⚔️ **Warrior (W/E)** — melee sword bar below, fire support from the Elementalist secondary
- 🔥 **Elementalist (E/Mo)** — ranged wand auto-attack, big energy pool with faster regen
  (energy storage), and: Flare (spammable), Fireball (AoE), Lightning Strike (instant),
  Ice Shard (chill), Immolate (burn), Armor of Earth (−40% damage taken), Aura of
  Restoration (heal + energy, the Monk secondary), Restore Ally

## The Warrior skill bar

1. 🩸 **Sever Artery** — 4 adrenaline. +5 dmg, Bleeding 15s
2. 🗡️ **Gash** — 6 adrenaline. +7 dmg; Deep Wound (−20% max HP) on a Bleeding foe
3. ⚔️ **Final Thrust** — 9 adrenaline, drains all. +20 dmg, +40 below half health
4. 🦶 **Hamstring** — 7e, 12s rc. Cripples 8s
5. ✚ **Healing Signet** — 0e, 2s cast, 20s rc. Heal 45% max HP (+Tactics)
6. 😤 **Frenzy** — 5e, 15s rc. Attack 33% faster, take double damage (6s)
7. 🔥 **Fire Bolt** — 10e, 0.8s cast, 5s rc. 35 dmg + Burning (E secondary)
8. 💫 **Restore Ally** — 0e, 3s cast, 90s rc. Resurrect Lyra

## Zone: the Sunward Reach (levels 1–10)

Istan-savanna look: golden grass, sandy roads, turquoise river with palms,
flat-top acacias, an adobe hut at the Sunspear outpost.

Quest chain from Captain Aldra (turn-ins clear death penalty and pay XP/gold,
some pay gear):

1. *Jackals at the Gates* — 4 Sand Jackals
2. *Skale Infestation* — 5 Istani Skale by the river (rewards a blue weapon)
3. *The Road East* — break the corsair patrol
4. *The Blackmaw Gang* — kill boss **Korr Blackmaw** (telegraphed whirl AoE;
   purple reward) — his **Avengers** (lvl 7 veterans) then land at the camp
5. *Cleansing the Reach* — cut down 10 corsairs → **Sunspear Cadet** title
   banner and a gold-rarity weapon

Avengers respawn, so you can farm the camp to hit the level 10 cap.
Sell trophies (Skale Fins, Jackal Pelts, Corsair Emblems) to **Merchant Suki**.

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
