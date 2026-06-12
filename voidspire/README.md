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

- **Tap a card** to select it, **tap it again** to play it.
- With multiple enemies, **tap an enemy** to choose the target.
- Tap empty space to deselect; tap an enemy with no card selected to inspect
  its intent. **END TURN** when you're done.

## The game

- **3 classes** — Vanguard (MIGHT/weapons), Technomancer (TECH/shields &
  turrets), Void Adept (PSI/burns & hexes).
- **Endless sectors** — each sector is 8 nodes (fights, decision events,
  shops, rest sites, an elite, then a boss) against one of three factions:
  the Hierarchy, the Rust Legion, the Voidspawn. Enemies scale forever;
  your score is how deep you go.
- **Progression** — card rewards & upgrades, ~20 passive artifacts,
  level-ups after every boss (+attribute or +max HP), credits, deck purges.
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
node test/sim.js 200        # bot plays 200 full runs; prints avg sector reached
                            # and death locations per class — a quick balance read
```

The bot is deliberately dumb, so treat its numbers as a floor; what matters
is the *relative* movement when you change values, and that classes stay
roughly comparable.

Optional (needs `npm i jsdom canvas` somewhere on `NODE_PATH`):

```sh
NODE_PATH=/path/to/node_modules node test/dom.js   # boots the real UI and taps through a run
NODE_PATH=/path/to/node_modules node test/shot.js  # renders battlefield PNGs of every faction
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
