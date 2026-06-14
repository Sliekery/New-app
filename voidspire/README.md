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
- **Progression** — card rewards & upgrades, ~20 passive artifacts,
  level-ups after every boss (+attribute or +max HP), credits, deck purges.
- **Build archetypes** (Slay-the-Spire-inspired) — each class has a keyword
  to draft around, with build-defining rares that go exponential when the RNG
  cooperates ("god runs"):
  - **Vanguard — Might & Exhaust:** Heavy Ordnance (MIGHT ×3), Limit Break
    (double Might), Whirlwind (X-cost), Iron Resolve (Shield on Exhaust),
    Reckless Protocol (Corruption: Skills cost 0 but Exhaust).
  - **Technomancer — Shields, Turrets & Powers:** Kinetic Discharge (damage =
    Shield), Entrench (double Shield), Overload Capacitor (Shield per card),
    Echo Core (first attack each turn plays twice).
  - **Void Adept — Burn & card-spam:** Catalyst (double a target's Burn),
    Plague Engine (Burn spreads to all), Mind Array (deal to all on every card).
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
| `js/artifacts.js` | Relics: one hook key + value each. |
| `js/enemies.js` | Enemy stats, AI move patterns, encounter packs, and vector art (polyline coordinates in a −1..1 box). |
| `js/events.js` | Decision events with skill checks and outcome effects. |

### Validate your tweaks headlessly

```sh
node test/sim.js 300        # bot plays full runs; prints avg sector reached,
                            # death locations, and a difficulty profile
node test/mechanics.js      # unit tests for the build-defining keywords
                            # (power consumption, Echo, Corruption, Catalyst, …)
```

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
  floaters, and a tiny WebAudio synth (mutable in the menu).
- `js/main.js` — boot + requestAnimationFrame loop.

## Single-file build

`voidspire.html` is the whole game bundled into one file (handy for playing
from a download or a raw-file URL). Regenerate it after changing any source:

```sh
node -e "
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<link rel=\"stylesheet\"[^>]*>/, '<style>\n' + fs.readFileSync('css/style.css', 'utf8') + '\n</style>');
let js = '';
for (const s of ['balance','cards','artifacts','enemies','events','engine','render','ui','main']) js += '\n' + fs.readFileSync('js/' + s + '.js', 'utf8');
html = html.replace(/(\s*<script src=[^>]*><\/script>)+/, '\n<script>\n' + js.replace(/<\/script>/g, '<\\\\/script>') + '\n</script>\n');
fs.writeFileSync('voidspire.html', html);
"
```
