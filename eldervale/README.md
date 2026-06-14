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

## The world — Sunmere & the Dunereach (Nightfall Istan, recreated)

A faithful, mechanics-1:1 recreation of Nightfall's opening — **Kamadan + Plains
of Jarin** — in Eldervale's own setting and names (no trademarked assets/text).

**Sunmere, Jewel of the Coast** (the city / town hub, Kamadan analog): a great
walled port — grand plaza with a fountain, the Hall of the Sun (officers,
trainer), a Grand Bazaar (merchant, material trader, the Order vault), Artisans'
Row (armorer/crafter), three piers on the bay, and three gates (one open to the
Dunereach, two sealed for future zones). Fully safe, no combat — a shared-hub
analog. Service NPCs: Marshal Oyin (quests + your Hero), Blademaster Henko
(skills), Merchant Suki, Trader Kahli (materials), Vault-keeper Jueh, Armorer
Joska, Dockmaster Ahlar, Lady Mehana.

**The Dunereach** (explorable, Plains of Jarin analog): green rolling hills and a
foliaged lake to the **north**, dry red-and-gold desert to the **south**, a river
between. Populated GW1-style in small mixed pulls with support casters and
healers. A resurrection shrine + Sunward Scout sit by the city gate; a Collector
and Beastmaster roam the field.

## Bestiary (Plains-of-Jarin creature families)

- **Skales** (lake): Ridgeback Skale, Skale Blighter (healer-caster), Skale Lasher
- **Insects**: Bladed Termite, Stalking Nephila (spider), Preying Lance
- **Mandragors** (south dunes): Slither & Imp — **burrowed and invisible until you
  stray close, then they erupt and ambush** (the Nightfall signature)
- **Plants** (rooted): Fanged Iboga, Stormseed Jacaranda (lightning caster)
- **Drakes**: Irontooth Drake — tanky, with a periodic fire-breath AoE
- **Field bosses**, each with a ~35% **unique green** drop and a **capturable elite**:
  Sicklemaw the Reaper (insect), Old Galewither (plant), Karesh Duneshaper (mandragor)

## Signature Nightfall mechanics

- **Sunward Hunts (bounties)**: the Scout at the shrine offers creature-family
  hunts (Skale/Insect/Mandragor/Plant/Drake). Each kill of the named kind earns
  **Sunward Honor**, advancing your **rank title** (Recruit → Spearbearer →
  Vanguard → Castellan → Champion of the Sun).
- **Heroes**: Lyra joins as a customizable Hero during the chain. The Party panel
  (👥) sets her **AI stance** (Aggressive / Guard / Passive) and lets you **flag**
  her to hold a position or recall to your side.
- **Elite skill capture**: a **Signet of Capture** on your bar, used beside a slain
  boss, learns that boss's **elite** skill — then slot it at the trainer.
- **Town-vs-explorable** rules, resurrection shrines at portals, **collectors**
  (trade creature trophies for gear), a **material trader**, and a persistent
  **Order vault** (shared storage that travels between cities).

## The primary chain

Onboards through the city (meet the officers, train, gain your Hero), then sends
you into the Dunereach to clear the three field bosses and reopen the desert road,
ending in the rank of **Spear of the Sun**. Side work from the Beastmaster,
Dockmaster, Lady Mehana, and the Blademaster.

## Skills, the GW1 way

Start with your 8 default skills + a free Signet of Capture. **Blademaster Henko
sells** the rest of your profession's pool for gold + a skill point; you compose
your own 8-slot bar in ✨ Skills & Builds (editable in town only — the GW1 outpost
rule). Elites can't be bought — capture them from bosses. Builds save bar +
attributes together.

## Character models

Humanoid characters (you, your Hero, the city NPCs) use the **KayKit Adventurers**
pack (CC0, Kay Lousberg) as glTF with full skeletal animation. The Dunereach
creatures are procedurally modeled (skale, insect, mandragor, plant, drake).
Models load in the background; until then the game falls back to procedural
avatars.
