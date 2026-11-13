# The Vanguard's archetypes are beside the die, not made of it

_Review, 13 Nov 2026. Vanguard only. Static read of the live card pool (73 cards,
dumped through `VS.cardDesc`) and the three FIRST_MARKS. The proposal below was
built the same day; what changed on the way, and the measured result, are in
**Outcome** at the end._

## What the complaint is, in numbers

"The archetypes and the cards are not their own thing" is measurable. The Vanguard's one
unique system is the d20. Count the cards in each band whose text touches it at all
(BURST, a roll gate, a face, a misfire, steering, Aim):

| Band (mark) | Cards | Touch the die | Don't |
| --- | --- | --- | --- |
| high (THE LONG SHOT) | 21 | **19** | Full Auto*, Deadeye Protocol |
| mid (THE SET SHIELD) | 20 | **4** | 16, incl. Rampart, Bunker Down, Breach the Wall, Casemate, Buttress… |
| low (THE RED DEBT) | 21 | **1** | 20, incl. every Stim card except The Red Hour |
| neutral | 11 | 5 | Bayonet Charge, Frag Grenade, Orbital Strike… |

\* Full Auto does BURST; its text just does not say so.

So **one archetype is made of the die, and two are made of StS mechanics.** Bulwark is
Barricade + Body Slam. Stim is the Ironclad's Strength + self-damage. Both would work
unchanged if the die were deleted. That is the disconnect.

## Three places where the parts point different ways

1. **The marks don't use their own archetype's resource.**
   - THE RED DEBT's engraving (Whetstone Mark) gives **Might**, but the archetype runs on **Stim**.
   - THE SET SHIELD's engraving (Anvil Mark) gives **Shield**, but the archetype runs on **Bulwark**.
   - The first thing the game hands you therefore says something different from the
     cards it then drafts you.
2. **The bands don't match what the cards want.**
   - SET SHIELD says "middle faces 8–14", but its two die cards (Revetment, The Redoubt)
     scale with the face *number*, which means they want HIGH.
   - RED DEBT says "low faces 2–7", but nothing in it reads a 2–7. The Red Hour reads
     face 1 only.
3. **THE LONG SHOT fights itself.**
   - Aim is spent twice over: once to steer the die, once to load the cashouts
     (Long Shot, Killshot, Empty the Magazine).
   - Every point banked for the payoff is a point not steering toward the faces you
     engraved.
   - It is the one plan that reads the die, and it measures worst (~20% win against
     ~48% and ~42%). CLAUDE.md lists that cause as still open. This conflict is my
     candidate.

A smaller, related one: several powers describe themselves by their status name, not by
what they do. "Gain 2 Loophole", "Gain 4 Reactive Plating", "Gain 1 Full Auto", and
"Gain 1 coldBore", where a raw id leaks into the text. A card that only names itself
can't tell you which plan it belongs to.

## How the good ones do it

Across the genre, the classes people remember share one structure: **the archetype is
a way of using the core mechanic, not a second resource next to it.**

- **Balatro.**
  - The core mechanic is the poker hand, and the archetype *is* the hand you play
    (flush build, pairs build).
  - Planets level a hand, and jokers read hand contents ("if played hand contains a
    Flush").
  - Nearly every card in the game reads the one mechanic, so there's nothing to be
    "separate" from.
- **Dicey Dungeons.**
  - The class changes what a die *means*: the Robot's CPU jackpot, the Inventor's
    gadgets.
  - Equipment slots read die values: "needs a 6", "odd only", "max 3".
  - Your build is literally which numbers you want to roll.
- **Slice & Dice.** The faces *are* the abilities. Upgrading a hero is upgrading what its
  die can land on.
- **Monster Train.**
  - The archetype is a visible thing you grow: the clan champion, upgraded down one of
    three paths as the run goes.
  - The deck feeds the champion, and the choice is made once and then deepened all run.
- **Slay the Spire.**
  - The Ironclad's three plans (Strength, Exhaust, Block) all inherit the class's
    signature of HP as a resource, and cards double-dip.
  - Limit Break (Strength), Burning Pact (Exhaust) and Second Wind (Block + Exhaust)
    each carry a plan, and cards like Second Wind serve two at once.
  - The plans overlap because they share one identity; they aren't three separate
    themes.
- **MTG / Ravnica-style keywords.** Each pair of colours has one keyword that both
  colours can feed. The identity is a verb, the cards are ways of doing that verb, and
  the flavour names the verb.

What they share:
1. **One core verb.** Every archetype does it, each in its own way.
2. **Something visible that grows** and is the archetype: a hand level, a champion, a
   loaded die.
3. **Build-arounds.** Cards that are weak outside the plan and great inside it, plus
   glue that's fine anywhere.
4. **The opening choice keeps getting deeper.** It isn't a one-off at the start.

Voidspire already has (1): the d20, and "one die, three readings" was the spine of
VANGUARD.md. The implementation drifted. Mid and low became resources that sit next to
the die instead of readings of it.

## Proposal: make every plan a reading of the die

Same three bands, same marks, same keep-what-works. Each plan's resource is earned **by
where the die lands**, so the engraving bench, the cards and the mark all point at one
thing.

### HIGH, 15–20: the called shot (rename candidate: DEADEYE)

- **Cashouts stop consuming Aim.** Aim only steers. That removes the bank-or-steer
  conflict.
- **Payoffs read the landing face**, not a stockpile:
  - Killshot: "deal 3 per face above 14 you land on".
  - Long Shot: "land 18+: 18 damage, else 4".
- **New verb, CALL:** a card names a face or a short run. Aim steers to it, and landing
  it pays big. No deckbuilder asks you to call your number.
  - This makes the faces you engrave and the calls you draft the same decision.

### MID, 8–14: the line (rename candidate: HOLD THE LINE)

- **Every roll that lands 8–14 lays a brick:** Bulwark equal to half the face. The wall
  is built *by the middle of the die*. Engrave the middle and you build faster.
- **Consistency cards:**
  - "This turn your rolls can't land below 8."
  - "Roll twice, keep the one nearer 11."
  - The archetype that tames variance, which the other two exploit.
- Revetment and The Redoubt get rewritten to read the band, not the face number.
- **Anvil Mark gives Bulwark**, not Shield.

### LOW, 2–7: the red debt (keeps its name)

- **Low rolls pay Stim:** a 2–7 gives +1 Stim, and a misfire on 1 gives +3. The worst
  outcome on everyone else's die is your income.
- HP loss stays, but as one way among others to dive the die.
  - "Roll twice, keep the lower; it pays double."
  - Steady Hands moves here.
- Payoffs cash Stim the way they do now (Ravening, Limit Break, Bloodbath).
- **Whetstone Mark gives Stim**, not Might.

### Across all three

- **Target: about 70% of each band's cards touch the die.** HIGH is already there; MID
  and LOW are at 20% and 5%.
- **The mark grows** (the Monster Train lesson):
  - The opening engraving upgrades at fixed beats, e.g. after the sector-1 boss and
    the sector-2 boss.
  - It widens by a face or gains a rider, so the first-minute choice deepens all run.
- **Power text says what it does**, not its status name. Fix the `coldBore` leak.
- **Bridges stay.** The three pair cards per pair in VANGUARD.md are the right idea.
  With all three plans reading the die, a pair becomes "which part of the die do I
  split", which is a real decision.

## Balancing, and what can be known

- The current standings are LONG SHOT ~20%, RED DEBT ~48%, SET SHIELD ~42%. Treat them
  with the sim caveats in CLAUDE.md: about a 10-point spread on identical code, and
  deltas under ~5 points unresolved.
- I'm not proposing numbers here. These are structural changes, and the sim can judge
  structure.
- Each change gets four or more runs per side at n ≥ 600, compared as
  distributions. `tools/jsnode` runs the sims without Node.
- The gates to hold:
  - Each band reaches 8+ of its own cards in 70%+ of decks (today's figure, kept).
  - No mark more than ~8 points from the others in win rate.
  - The die-touch share per band, as counted above.

## Outcome (built 13 Nov 2026)

Built as proposed, with four changes the sim forced:

1. **HIGH needed a reading of its own.**
   - Two plans opened with an engine power that read their band. LONG SHOT opened
     with a 4-damage attack.
   - The mark card is now **Sighting In**: a roll of 15–20 grants 1 Aim, and every
     attack deals +1 damage per banked Aim.
   - The reason is that Stim is a global damage stat (Pulse Rifle hit 16.7 a play
     under RED DEBT against 12.1 under LONG SHOT), and Aim was not.
2. **The Redoubt kept its engine and changed what it reads.** It now banks the
   highest 8–14 face per turn instead of the highest face. "8–14 counts as SOLID"
   measured SET SHIELD at ~28%, and the old rule restored it to ~40%: one card was
   carrying the plan.
3. **The Line kept its Thorns** (Anvil Mark, Set Against It, Range Card). The old
   SET SHIELD won partly on Thorns, and cutting them cost ~15 points.
4. **A misfire pays the Red Debt double, not triple.**

Results, 6×600 against 4×600:

| | LONG SHOT | RED DEBT | SET SHIELD | class |
| --- | --- | --- | --- | --- |
| before | ~24% | ~49% | ~43% | ~38.7% |
| after | ~33% | ~44% | ~37% | ~38.2% |

- **Die-touch per band:** high 20/20, mid 13/20 (from 4), low 13/22 (from 1).
- **Decks reaching 8+ of their own band:** 78% (gate 70%).
- **Mark spread:** 25 → 12 points. **Still above the ≤8 gate.**
  - The remaining gap is the low pool, plus Stim reaching every attack.
  - The next lever is RED DEBT's payoffs (Ravening, Bloodbath, Limit Break), not
    another LONG SHOT buff.
