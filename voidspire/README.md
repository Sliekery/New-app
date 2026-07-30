# VOIDSPIRE

A one-finger, turn-based sci-fi roguelike card game. Halo/Warhammer-flavored
setting with DnD bones: MIGHT / TECH / PSI attributes, d20 crit rolls in
combat, and skill-check decision events. Rendered in retro-futuristic neon
vector line-art (think *Marathon* terminal meets *Slay the Spire*).

No build step, no dependencies, no network. Pure HTML/CSS/JS.

## Play

Open `index.html` in any modern browser, or serve the folder:

```sh
cd voidspire
python3 -m http.server 8080
# -> http://localhost:8080 (on your phone: http://<your-ip>:8080)
```

Works best on a phone in portrait. Add it to your home screen for fullscreen.
Runs are auto-saved at every node — close the tab and continue later.

### Controls (one finger, always)

- **Swipe a card up** to play it — or **drag it onto an enemy** to choose
  the target.
- **Tap a card** to enlarge and read it (tap again, or tap empty space, to
  put it back). While a card is selected, tapping an enemy plays it there.
- Tap an enemy with no card selected to inspect its intent.
  **END TURN** when you're done.

## The game

- **3 classes** — Vanguard (MIGHT/weapons), Technomancer (TECH/shields &
  turrets), Void Adept (PSI/burns & hexes).
- **Endless sectors** — each sector is 8 nodes (fights, decision events,
  shops, rest sites, an elite, then a boss) against one of three factions:
  the Hierarchy, the Rust Legion, the Voidspawn. Enemies scale forever;
  your score is how deep you go.
- **A win condition** — the boss of the finale sector (`BALANCE.run.finale`,
  default 4) is **THE UNMAKER**, a faction-less cosmic entity. Beat it to win
  the run, then **claim victory** (run ends, recorded) or enter **the
  Recurrence**.
- **The Recurrence (NG+ loop)** — choosing to go on warps you into a fresh
  descent of the *same* spire: your powers fade (deck, relics and
  stats reset to baseline), the world grows `loopPower`-stronger each loop, and
  you carry one permanent **Void Echo** (`js/echoes.js`) into every future loop.
  Echoes are sideways-by-design (glass-cannon, combo, execute-chain, pacts…);
  you collect one per loop and **equip up to `BALANCE.echoes.loadoutSlots`** in
  a loadout, so deep loops are a build puzzle, not a power treadmill.
- **Potions & consumables** — a 3-slot belt of one-shot items used in combat
  (damage, Shield, Energy, draw, heal, buffs/debuffs). They drop from fights,
  appear in shops, and the belt is shown beside your hand. ~13 potions across
  three rarities; tap a slot to use (targeted potions ask you to tap an enemy).
- **Progression** — three tracks, and only three: **cards** (rewards, shops,
  upgrades), **relics** (~60 passives, live only while mounted in your die's
  core; a boss lets you pick one of three) and **die engravings** (what fires
  when the d20 lands on a face). A handful of relics can't be found at all —
  they state a deed (*hold 35 Shield at once*) and arrive the moment you do it.
  MIGHT / TECH / PSI are class identity, not a reward: nothing raises them.
- **Build archetypes** (Slay-the-Spire-inspired) — **four per class**, each
  with build-defining rares that go exponential when the RNG cooperates ("god
  runs"). Some pairs synergise hard, others barely share cards — mixing is a
  spectrum, not a free-for-all:
  - **Vanguard** — *Warlord* (stack Might: Combat Stims, Warlord Protocol,
    Heavy Ordnance ×3, Limit Break) · *Ordnance* (Exhaust payoff: Scorched
    Earth, Iron Resolve, Reckless Protocol, Munitions Dump) · *Bulwark*
    (Shield → damage: Shield Slam, Barricade Protocol, Bunker Down, Riot
    Shield) · *Suppression* (AoE + Vuln/Weak control: Frag Grenade, Orbital
    Strike, Breach). Warlord+Ordnance and Bulwark+Suppression combo best.
  - **Technomancer** — *Aegis* (Shield → damage: Kinetic Discharge, Entrench,
    Overload Capacitor, Cogwork Surge) · *Constructs* (turret engine: Deploy
    Turret, Sentry Protocol, Drone Swarm) · *Overclock* (stack Powers: Echo
    Core, Auxiliary Reactor, Omega Protocol) · *Tesla* (direct burst + Weak:
    Railgun, Chain Lightning, Static Field). Aegis+Constructs+Overclock
    interlock; Tesla is the aggressive outlier.
  - **Void Adept** — *Pyre* (Burn/DoT: Soul Burn, Catalyst, Plague Engine) ·
    *Maelstrom* (card-spam: Mind Array, Mind Storm, Eldritch Storm) ·
    *Hexweaver* (debuff exploit: Mind Fracture, Void Siphon, Unravel) ·
    *Blood Pact* (HP-as-fuel glass cannon: Blood Pact, Exsanguinate,
    Hemorrhage). Pyre+Hexweaver and Maelstrom+Blood Pact pair naturally.
  - **Keywords:** Powers are **consumed** when played (one use per combat);
    **Exhaust** removes a card for the combat (with payoff cards); **Retain**
    keeps a card across turns; **X-cost** spends all your Energy.
- **DnD flavor** — every attack rolls a visible d20 (high roll = crit ×2;
  artifacts widen the crit range). Events offer choices with attribute
  checks (`TECH check, DC 12`), natural 1 always fails, natural 20 always
  succeeds. Curses can clog your deck.
- Enemy curse moves jam your deck *for the current combat*; curses gained
  from events are permanent until purged.

## Tweaking balance

**Everything numeric lives in `js/balance.js`** — player energy/draw, class
stats, attribute scaling, crit rules, status multipliers, per-sector enemy
HP/damage curves, node mix & weights, reward sizes, shop prices, level-up
gains, even animation timings. Change a number, reload, done.

Content is data-driven too:

| File | Contents |
| --- | --- |
| `js/cards.js` | All cards: declarative effect lists + upgrade patches. Descriptions auto-generate from effects, so tweaks stay truthful. |
| `js/artifacts.js` | Relics: one hook key + value each — the ONE pool of permanent passives. A relic only applies while mounted in the die's core. `unlock: {track, goal, label}` marks a relic that cannot drop and must be earned by a deed; `art()` in engine.js sums every live hook. |
| `js/enemies.js` | Enemy stats, AI move patterns, encounter packs, the finale boss (THE UNMAKER), and vector art (polyline coordinates in a −1..1 box). |
| `js/potions.js` | Consumables: name, rarity, colour, target flag, and an effect list (same `fx` style as cards). |
| `js/echoes.js` | Void Echoes (Recurrence/NG+ relics): simple ones carry `hook`/`hooks` (fold into `art()` while equipped); rule-benders are checked by `E.hasEcho(id)`. |
| `js/events.js` | Decision events with skill checks and outcome effects. |
| `js/dice.js` | The Augmented Die: face engravings, Flaws, and `FIRST_MARKS` — the three class-specific inscriptions offered at the mouth of the Spire, each pairing an engraving with the card its archetype needs. Engravings flagged `startOnly` are cut once and never drop or stock. |
| `js/story.js` | The overarching narrative: sector and faction lore, the cutscene that plays after each sector boss, and the vector scene art they are drawn from. The header comment states what the game is *implying* — none of it is ever said out loud in-game, and it should stay that way. |

### Validate your tweaks headlessly

```sh
node test/sim.js 300        # bot plays full runs; prints avg sector reached,
                            # death locations, and a difficulty profile
node test/mechanics.js      # unit tests for the build-defining keywords
                            # (power consumption, Echo, Corruption, Catalyst, …)
                            # plus the card-text budget and the cutscene flow
```

Layout is the one thing these cannot check — jsdom computes no geometry — so
three tools drive real headless Chromium instead. Install `playwright-core`
first, and remove `node_modules` before committing:

```sh
npm install playwright-core --no-save
node test/uifit.js          # every overlay screen at phone / small / desktop:
                            # fails on clipped text, sub-8.4px text, overflow
node test/cardfit.js        # every card variant in a real reward grid: fails if
                            # any description still clips at the auto-shrink floor
node test/cardfit.js --all  # …and lists the ones that only fit by shrinking
node test/combatfit.js      # the combat HUD against the FIGHT, on ten viewports
rm -rf node_modules
```

`combatfit.js` exists because `uifit.js` structurally cannot catch its class of
bug: the player and the enemies are drawn on a canvas and have no DOM boxes, so
a DOM-only overlap check passes cleanly while the chain receipt sits on the
player's head. It measures the readouts against the figures' real drawn extents
— staff tip included — at every chain length.

It leads with landscape, because that is the orientation the game is played in
and it is the one that breaks. In landscape the whole frame is CSS-scaled to fit
(0.65 on an 844x390 phone), so every DOM size is multiplied by that before it
reaches the screen: a panel tuned while looking at portrait arrives a third
smaller, and one that clears the figures in portrait can cover them here.

The bot plays like a competent-but-not-expert human (blocks lethal damage,
finishes kills, picks sensible rewards). The difficulty curve is calibrated
against Slay-the-Spire-shaped targets, printed with every run:

- sector-1 death rate ≤ ~15% (Act 1 is learnable, not free)
- median sector reached ~3-4 (a typical good run ≈ beating Act 3)
- sector 5+ reached by ~15-30% of runs (deep endless is earned)
- ≥ ~55% of deaths at elites/bosses (spikes kill you, not hallways)

If you tweak `balance.js`, re-run the sim and keep the profile inside those
brackets to preserve the feel.

Optional (needs `npm i jsdom canvas` somewhere on `NODE_PATH`):

```sh
NODE_PATH=/path/to/node_modules node test/dom.js   # boots the real UI and taps through a run
NODE_PATH=/path/to/node_modules node test/shot.js   # renders battlefield PNGs of every faction
NODE_PATH=/path/to/node_modules node test/sheet.js  # contact sheet of all enemy/event/artifact art
```

## Architecture

- `js/engine.js` — all game logic. **No DOM access**: state in, an event
  queue out, which is what makes the headless tests possible.
- `js/render.js` — canvas battlefield: starfield, glow-stroked polyline
  entities, particles, intents, reticles. The UI feeds it staggered view
  updates so HP bars and deaths animate on the action timeline rather than
  snapping to the (instantly-resolved) engine state.
- `js/ui.js` — DOM screens, hand interaction, the action timeline player,
  floaters, per-card cast FX, and a tiny WebAudio synth (mutable in the menu).
- `js/music.js` — `VS.music`: a procedural deep-synthwave bed on its own
  WebAudio context. Dark D-minor progression (bass + pad) that layers in
  kick/hats/arp and lifts tempo + brightness as the sector tenses. Subtle by
  design; no-ops where WebAudio is unavailable.
- `js/main.js` — boot + requestAnimationFrame loop.

## Single-file build

`voidspire.html` is the whole game bundled into one file (handy for playing
from a download or a raw-file URL). Regenerate it after changing any source:

```sh
node -e "
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
// NOTE: use FUNCTION replacers — js/css can contain '$' (e.g. regex \$1), which
// String.replace would otherwise treat as a capture-group backreference.
html = html.replace(/<link rel=\"stylesheet\"[^>]*>/, () => '<style>\n' + fs.readFileSync('css/style.css', 'utf8') + '\n</style>');
let js = '';
for (const s of ['balance','cards','cardart','artifacts','dice','dieview','potions','echoes','enemies','events','story','engine','render','music','ui','main']) js += '\n' + fs.readFileSync('js/' + s + '.js', 'utf8');
html = html.replace(/(\s*<script src=[^>]*><\/script>)+/, () => '\n<script>\n' + js.replace(/<\/script>/g, '<\\\\/script>') + '\n</script>\n');
fs.writeFileSync('voidspire.html', html);
"
```
