# THE ARSENAL — the dice-builder trial

_A fourth class that asks whether the **die**, not the deck, should be the thing you build._

This is a trial, not a product. It exists to answer one question with a number:
after the Vanguard rebuild, drafting **still** did not reward deliberate choices as
much as it should. Is that a card problem or a format problem?

To make the answer mean anything, the Arsenal is a **deliberate copy** of the
Vanguard — same 100 HP, same MGT 2, same d20, same ten-card starter deck. Nothing
about it is tuned to be better. The only difference is where progression lives.

---

## The three dice

| Die | Faces | Role |
| --- | --- | --- |
| **d20** | 20 | The lottery. Bands, seams, welds, taints, class engravings — the whole existing surface. |
| **BATTERY** (d6) | 6 | Damage. The floor. |
| **PLATE** (d6) | 6 | Shield. The floor. |

The d20 fires per card play, exactly as it does for every other class. The two
small dice **cycle once a turn** — the first card you play spins them both.

### Why once a turn

This is the single biggest thing the first build got wrong, and it is the most
transferable lesson here.

Six faces is 16.7% a face against the d20's 5%. Once every face is cut, a d6
fires on **every** play. Twelve plays a fight meant the two small dice
out-produced the entire deck, and the class measured **72.5% win** against the
Vanguard's 28%.

Per-play pricing does not fix it either — it forces every face down to 1s and 2s,
numbers nobody can read or care about. Three firings a fight instead of twelve
lets the faces keep numbers with weight (5 → 15) *and* lands the class at parity.

### Why the dice start fully cut

Every face begins with its die's basic engraving: **Shot** on the battery, **Plate**
on the plate. Never blank.

Dice that mostly whiff early read as *broken*, not as *unfinished* — the player has
no way to tell the difference. Starting cut also makes progression legible:
"your Shot became a Heavy Slug" is a far better reward than "face 4 is no longer
blank", and it means every single reward **displaces** something, which is the
decision the format exists to create.

---

## The twelve small cuts

**BATTERY** — damage

| Cut | Tier | Effect |
| --- | --- | --- |
| Shot | 1 | Deal 5 damage. |
| Twin Shot | 2 | Deal 9 damage. |
| Spray | 2 | Deal 6 damage to ALL enemies. |
| Piercing | 2 | Deal 6 damage and apply 1 Vulnerable. |
| Hot Load | 2 | Deal 5 damage and gain 1 Stim. |
| Heavy Slug | 3 | Deal 15 damage. |

**PLATE** — shield

| Cut | Tier | Effect |
| --- | --- | --- |
| Plate | 1 | Gain 4 Bulwark. |
| Slab | 2 | Gain 7 Bulwark. |
| Spiked Ply | 2 | Gain 5 Bulwark and 2 Thorns. |
| Weave | 2 | Gain 7 Block. |
| Vent | 2 | Gain 4 Bulwark and draw a card. |
| Bastion Ply | 3 | Gain 12 Bulwark. |

## The d20: Bulwark, translated

The Vanguard's wall archetype rewritten as cuts rather than cards.

| Engraving | Tier | Span | Effect |
| --- | --- | --- | --- |
| Revetment | 1 | 1 | Gain Bulwark equal to this face. |
| Buttress | 2 | 3 | Gain 5 Bulwark. |
| Embrasure | 2 | 1 | Deal 6 damage. Gain Bulwark equal to the damage dealt. |
| Spall | 2 | 1 | Deal damage equal to half your Bulwark, and spend it. |
| Breach the Wall | 3 | 1 | Consume all your Bulwark: deal that much damage. |
| Detonate | 3 | 1 | Consume all your Bulwark: deal that much to ALL enemies. |

### What the translation taught

**Attacks and skills translate cleanly.** "Gain 8 Bulwark", "spend the wall for
damage", "bank the face you landed on" are one-shot effects, and a face *is* a
one-shot effect that happens sometimes. Straight swap.

**Powers do not translate at all.** Casemate (3 wall every turn), Reactive Plating
(the wall hits back), Barricade Protocol (+50% wall) are *persistent* — and a face
fires again every time you land on it, so cutting one would stack it without
limit. They have to become relics, or one-shot versions of themselves.

Roughly **a third of the Vanguard's cards are Powers, and none of them can be a
face.** That is a real constraint on a dice builder, not a detail. It is also an
argument *for* the format: it forces every effect to be something that **happens**,
rather than something that is **true**.

---

## The reward loop

Every Arsenal fight offers **three cuts** instead of three cards, then asks which
of the six faces it replaces.

Six faces is a small enough board that there is no hoarding — every pick displaces
something, and the second step shows you exactly what you are giving up. That is
the trial's whole proposition: *a card reward is three cards you cannot evaluate
without knowing your draw; an engraving reward is "which of my six faces does this
replace", which is a decision with geometry in it.*

The deck never grows. It stays the ten-card starter all run, which is why the
Arsenal sees ~130% of its deck per fight against the Vanguard's ~95%.

---

## Measurements

All figures from `test/sim.js`, which is **deterministic** as of this work — the
bot's map-routing fallback used `Math.random`, and the same unchanged code was
measuring 28.0%, 31.5%, 33.0% and 37.0% on four consecutive n=200 runs. That
9-point spread was wider than most effects the sim exists to detect.

### The clock

| | hallway | elite | boss | boss ÷ hallway |
| --- | --- | --- | --- | --- |
| Arsenal | 4 | 6 | 11 | 3.3× |
| Vanguard | 3 | 4 | 7 | 2.5× |
| genre | 4–6 | — | 9–14 | ~2.3× |

The Arsenal sits *inside* the genre band the Vanguard still undershoots.

### The draft gate

The number the trial exists to produce: does picking well beat picking at random?

**n = 900 per arm**, deterministic harness. `VS_RANDOM_DRAFT` takes a random reward
every time — a random card for the Vanguard, a random cut onto a random face for
the Arsenal.

| Class | deliberate | random | gate |
| --- | --- | --- | --- |
| **Arsenal** (cuts) | 35.0% | 34.3% | **+0.7** |
| **Vanguard** (cards) | 30.6% | 34.2% | **−3.6** |

Standard error is ~1.6 points per arm, ~2.2 on the difference. Read honestly:

- **The Vanguard is still inverted.** Drafting at random beats drafting
  deliberately by 3.6 points (~1.6σ). This is the residue of the "pick random
  shit, play random shit, win" problem, down from the 27-point inversion the
  rebuild started at, but not gone.
- **The Arsenal is flat.** +0.7 ± 2.2 is indistinguishable from zero. The dice
  builder **removes the inversion** — it never punishes you for choosing well —
  but it does **not** yet reward choosing well either.

That is a real improvement and an honest disappointment in the same number.

**The caveat that matters.** The Arsenal's "deliberate" bot is crude: take the
highest-tier cut on offer, displace the lowest-tier face, skip if that would be a
downgrade. It does not weigh Vent's draw against Heavy Slug's damage, does not
know what the d20 is built toward, does not plan. The Vanguard's card bot is far
more developed. A flat gate can mean *the format has no gradient* or *the bot
cannot find the gradient*, and this measurement cannot separate those. Before
concluding anything about dice builders, the Arsenal needs a bot as good as the
Vanguard's — and a deeper cut pool for it to be good about.

---

## Open questions

- Twelve cuts is a thin pool. A real dice builder wants 30+, and the tier-1/2/3
  spread is hand-priced rather than measured.
- The deck is inert. Ten fixed cards that never change is honest for a trial but
  would be dull for a hundred runs.
- Relics were not touched. The Arsenal draws from the Vanguard's reworked pool,
  several of which point at card mechanics it barely uses.
- The d20 and the small dice do not interact at all. That is deliberate for
  measurement and probably wrong for a game.
