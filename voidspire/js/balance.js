/* =========================================================================
 * VOIDSPIRE — balance.js
 * Every tunable number in the game lives here. Tweak freely.
 * ========================================================================= */
(function (ns) {
  'use strict';

  ns.BALANCE = {

    /* ---- Player ----------------------------------------------------- */
    player: {
      baseEnergy: 3,            // energy gained at the start of each turn
      drawPerTurn: 5,           // cards drawn at the start of each turn
      maxHand: 10,              // cards beyond this are not drawn
      startCredits: 30,
    },

    /* ---- Classes ---------------------------------------------------- */
    classes: {
      /* +20 with the combat clock. Longer fights mean more enemy turns per
       * node and the same number of rests to recover between them, so the run
       * bleeds faster even with per-turn damage cut. HP is the lever that pays
       * for that without touching the shape of a fight. Vanguard only — he is
       * the testing ground for the clock work. */
      vanguard:  { hp: 100, might: 2, tech: 0, psi: 0 },
      technomancer: { hp: 68, might: 0, tech: 2, psi: 0 },
      voidadept: { hp: 80, might: 0, tech: 0, psi: 2 },
      /* THE ARSENAL — the dice-builder trial. Same body as the Vanguard on
       * purpose, so any difference measured is the DICE and not the stat line. */
      arsenal:   { hp: 100, might: 2, tech: 0, psi: 0 },
    },

    /* ---- Attribute scaling ------------------------------------------ */
    attrs: {
      mightDmgPerPoint: 1.7,    // bonus damage per MIGHT (trimmed: Vanguard led parity by ~10pts)
      techBlockPerPoint: 1,     // bonus block per TECH on tech-scaling skills
      mightBlockPerPoint: 1,    // bonus block per MIGHT on primary-scaling skills
      psiBlockPerPoint: 1,      // bonus block per PSI on primary-scaling skills
      psiDmgPerPoint: 1.55,     // bonus damage per PSI (raised: Voidadept trailed parity)
      eventCheckBonusDiv: 1,    // event check bonus = attr / this (rounded down)
    },

    /* ---- d20 / crits ------------------------------------------------
     * One die, read three ways. A 20 always crits and the top of the table is
     * the same for everyone — what separates the classes is what a BAD roll
     * MEANS. The Vanguard wastes it, the Technomancer converts it to tempo, the
     * Voidadept converts it to power and pays in blood. That is the whole
     * design: three answers to the same question, not three sets of numbers.
     * ---------------------------------------------------------------- */
    dice: {
      // THE ROLL BLEEDS: a roll fires its face fully and the faces either side
      // at this fraction. It is what makes WHERE you cut matter as much as
      // WHAT, and it turns a filled die from a dead end into the payoff.
      bleed: 0.25,
      /* THE SEAM. Two engravings may share ONE face. Neither is destroyed and
       * neither wins: on the shared face both fire at this fraction. The die's
       * scarce resource is faces, not power, so a seam BUYS BACK a face and
       * pays for it in strength — two span-3 bands that share a face occupy 5
       * of your 20 instead of 6. Total coverage falls, which is why this is
       * priced as a trade rather than a bonus. */
      seam: 0.6,
      /* STEERING (Marksmanship). 1 Aim per face of travel, and never more than
       * this many faces however much you hold — the cap is what stops a loaded
       * marksman landing on his best face every single roll and turning the die
       * into decoration. Surplus Aim past the cap only feeds the cashouts. */
      steerCap: 3,
      /* BURST N fires the landing face and the next N-1 round the ring at these
       * fractions. The landing face still matters most; later faces are a bonus
       * that stacks with the 25% bleed and with welds. */
      /* Raised from the designed 0.6/0.35 once Marksmanship had measured as the
       * weakest of the three archetypes three separate times. The arithmetic
       * was always against it: on a MEDIAN engraving of 8 a BURST 3 added 7.6
       * damage, and only when both faces past the landing one were cut, while
       * two Pulse Rifles deal 12 for the same two energy — the payoff sat below
       * the filler. At these rates a BURST 3 adds 11.2 and a BURST 4 adds 14.8,
       * so a dense run is worth building toward while a sparse die still makes
       * these cards bad, which is the intended shape. */
      burst: [1, 0.8, 0.6, 0.45, 0.3],
      /* THE WELD. Bleed across a chosen boundary between two DIFFERENT
       * engravings runs at full instead of `bleed`. Bought at the bench, and
       * hard-capped: on a dense die every engraving touches another, so an
       * automatic weld would be a flat multiplier on cutting a lot rather than
       * on cutting deliberately. */
      weldCap: 3,
      weldCost: 70,
      weldStep: 60,
      // a listener may set off another listener, but only this deep — the
      // shape of "when you apply Burn, attack" is a loop waiting to happen
      chainDepth: 2,
      /* THE VOID SCARS THE DIE. Chance that clearing a fight taints one of your
       * engravings, by sector. Sectors 1-2 are untouched — the early game is
       * already inside its targets and the power that needs answering is all in
       * the back half. Elites and bosses always scar, from sector 3 on. */
      // Raised once engravings started resolving in their face's band, which
      // made the die meaningfully stronger: reach-sector-5 went 27% -> 34% on
      // the band change alone, and this curve brings it back to 26%.
      taintBySector: { 1: 0, 2: 0, 3: 0.12, 4: 0.22, 5: 0.32, 6: 0.38, 7: 0.43, 8: 0.47, 9: 0.50, max: 0.50 },
      taintEliteFrom: 3,        // an elite or boss scars outright from this sector
      coldWeldChance: 0.12,     // ...and rarely it welds, which removes the choice
      critThreshold: 20,        // roll + Aim >= (threshold - critBonus) crits
      critMult: 2.0,            // crit damage multiplier
      misfireMult: 0.5,         // legacy fallback for a class with no table
      baseAim: 1,               // every class steers the die a little — it is a game-wide system

      classes: {
        /* MARKSMANSHIP — the marksman POINTS the die.
         *
         * Aim used to be added to the roll, which made it a flat damage
         * multiplier wearing a marksman's hat: it improved the band and nothing
         * else, and deliberately did NOT move the landing face (at +5 Aim,
         * faces 1-5 could never fire and half the die would be dead).
         *
         * It steers now. After the roll the die CLIMBS to the highest engraved
         * face it can reach, spending 1 Aim per face, and the band is read from
         * where it lands — so climbing earns SOLID as a consequence rather than
         * as a separate rule, and a crit means literally reaching face 20.
         * Bare faces are never a destination, so Aim is worth exactly as much
         * as your engraving is good, and the skill moves from a mid-fight
         * prompt into how you lay the die out.
         *
         * The other two classes keep Aim as a band bonus. This matters: the
         * Void Adept's table is a U and he wants to go DOWN. */
        vanguard: {
          name: 'MARKSMANSHIP',
          read: 'Aim STEERS the die: it climbs to the highest face you have cut, and the band is read from where it lands.',
          steer: true,
          aim: 1,               // the marksman sights in further on top of the base
          misfire: { mult: 0.5, label: 'MISFIRE' },
          bands: [
            { min: 15, mult: 1.25, label: 'SOLID' },
            { min: 8,  mult: 1.0,  label: 'HIT' },
            { min: 2,  mult: 0.8,  label: 'GRAZE' },
          ],
        },

        /* THE ARSENAL reads the d20 exactly as the Vanguard does — it is a
         * copy by design, so the trial measures the two extra dice and nothing
         * else. It does NOT steer: Aim is a Marksmanship rule, and this class
         * builds width across three dice instead of precision on one. */
        arsenal: {
          name: 'THREE BARRELS',
          read: 'Every card rolls all three dice. The d20 is the lottery; the d6s are the floor you built.',
          misfire: { mult: 0.5, label: 'MISFIRE' },
          bands: [
            { min: 15, mult: 1.25, label: 'SOLID' },
            { min: 8,  mult: 1.0,  label: 'HIT' },
            { min: 2,  mult: 0.8,  label: 'GRAZE' },
          ],
        },

        /* LOAD BALANCE — throughput. A machine does not miss, it sags. The band
         * scales Shield as well as damage, so the die reads on a defensive turn
         * too, and a tripped breaker dumps its charge back as Energy. */
        technomancer: {
          name: 'LOAD BALANCE',
          read: 'The band scales Shield as well as damage. A tripped breaker dumps its charge back as Energy.',
          blocks: true,
          // A wider spread than the Vanguard's: a reactor swings. The answer is
          // not to steer (he gets no extra Aim) but to build redundancy, and a
          // tripped breaker is never dead — it dumps its charge back as Energy.
          misfire: { mult: 0.6, label: 'BREAKER', energy: 1 },
          bands: [
            { min: 15, mult: 1.35, label: 'SURGE' },
            { min: 8,  mult: 1.0,  label: 'NOMINAL' },
            { min: 2,  mult: 0.7,  label: 'SAG' },
          ],
        },

        /* THE HUNGER — appetite. The void always answers; the only question is
         * who pays. The bottom of the die is STRONGER than the middle and bills
         * you in HP, so Aim is a genuine trade for the Voidadept: climb the
         * table and you starve the blood engines that feed on the bottom. */
        voidadept: {
          name: 'THE HUNGER',
          read: 'The bottom of the die hits HARDER than the middle — and bills you in HP.',
          // A U, not a ramp. The void answers at either extreme and is bored by
          // the middle — WHISPER, the most common face, is his WORST outcome.
          // The bottom pays in blood, and it pays through spendLife, so the
          // blood engines drink from a bad roll.
          misfire: { mult: 1.5, label: 'RAVENOUS', hploss: 4 },
          bands: [
            { min: 15, mult: 1.2, label: 'ATTUNED' },
            { min: 8,  mult: 0.9, label: 'WHISPER' },
            { min: 2,  mult: 1.2, label: 'HUNGER', hploss: 1 },
          ],
        },
      },
    },

    /* ---- The count runs out ------------------------------------------
     * A fight with no clock can run forever: Barricade / Phase Lock stop your
     * Shield expiring, so a defensive build that has lost its offence (a Jammer
     * burning out the last attack, say) becomes both unkillable and unable to
     * kill. It happened in roughly 1 bot run in 900.
     *
     * `turn` is set from measurement, not taste: over 26,469 simulated fights
     * the 99th percentile is 8 turns and the 99.9th is 14, and bosses — the
     * longest legitimate fights — sit at p99 = 12. Only 0.05% of fights reach
     * turn 20 at all, and essentially all of those are the pathology.
     *
     * Past that line the Spire stops waiting. Enemies gain Might every turn AND
     * your Shield starts sloughing off, because raising damage alone does not
     * beat an unbounded Shield pool in any sensible number of turns.
     * ------------------------------------------------------------------ */
    enrage: {
      /* Retuned with the clock. The old 20 came from a measurement taken when
       * the 99th percentile fight was 8 turns and the 99.9th was 14; under the
       * new clock p99 is 14 and the longest legitimate fights reach 25, so 20
       * would start escalating fights that are merely long rather than stuck. */
      turn: 30,          // last patient turn; escalation begins on the next one
      str: 2,            // Might each enemy gains per turn, cumulative
      shieldDecay: 0.34, // fraction of your Shield that fails each turn
      shieldFloor: 5,    // ...and at least this much, so small pools still drain
    },

    /* ---- Status effects ---------------------------------------------- */
    status: {
      vulnMult: 1.5,            // damage taken multiplier while Vulnerable
      weakMult: 0.75,           // damage dealt multiplier while Weakened
      burnTick: 1,              // burn stacks lost per turn (damage = stacks)
    },

    /* ---- Enemy scaling per sector (s = sector, 1-based) -------------- */
    /* ---- THE COMBAT CLOCK ---------------------------------------------
     * Measured over 2,139 fights, a hallway fight lasted a MEDIAN OF 2 TURNS
     * and a boss 3.8. The genre runs 4-6 and 9-14. At two turns you draw 10
     * cards of a 26-card deck, so 62% of what you drafted is never seen — and
     * a card that needs turns AFTER being drawn (61% of the Vanguard's rares
     * are Powers) is worth close to nothing. That is measurable: drafting
     * commons won 56.0% of runs and drafting rares 28.7%. The game's own
     * signal for "this card is better" was pointing the wrong way, because
     * the fight was too short for better to mean anything.
     *
     * It also starved three systems we had already built. The die's bleed and
     * listener chains, the nine elite signature laws and the six boss laws are
     * all things that need turns to express — which is why elite signatures
     * measured as a win-rate cost with no movement in the death distribution.
     *
     * HP goes up and damage-per-turn comes down together, so the TOTAL damage
     * a fight deals is roughly preserved and the fight simply takes longer:
     *   fight  2.2 x 0.37     elite  2.4 x 0.37     boss  2.9 x 0.33
     *
     * The boss column is steeper on HP: a boss being 1.8x a trash fight is why
     * it never read as a different kind of event, and it is 2.3x now.
     *
     * MEASURED CAVEAT. The clock is difficulty-neutral ON ITS OWN — with the
     * boss and elite LAWS silenced it lands at 24.0% against a 24.2% baseline.
     * With them on it lands at 14.7%, because the fifteen signature laws were
     * tuned when a boss fight was 3.8 turns and they now get seven. They are
     * worth -9.3 win points at this clock and want retuning one at a time;
     * they are. Holding elite and boss HP down was tried as a stopgap and did
     * not earn its keep — the laws fire per TURN, so a 25% shorter boss fight
     * bought 1.5 win points and gave back the length the boss needed. The
     * clock keeps its honest values and the laws are the next job. -------- */
    clock: {
      hp:  { fight: 2.2, elite: 2.4, boss: 2.9, beacon: 2.4, heart: 2.9 },
      dmg: { fight: 0.37, elite: 0.37, boss: 0.33, beacon: 0.37, heart: 0.33 },
    },

    scaling: {
      hpMul:  function (s) { return 1 + 0.30 * (s - 1) + 0.034 * (s - 1) * (s - 1); },
      dmgMul: function (s) { return 1 + 0.165 * (s - 1) + 0.017 * (s - 1) * (s - 1); },
      // extra flat strength enemies gain every N sectors (late-game pressure)
      strEverySectors: 3,
      // within-sector ramp: enemies at the top of a (now 12-row) sector hit this
      // much harder than at the entry, to match the deck you've assembled.
      depthBonus: 0.18,
    },

    /* ---- Sector / encounters ---------------------------------------- */
    sector: {
      eliteChance2Enemies: 0.35, // chance an elite brings a minion (sector 3+)
    },

    /* ---- Branching map (Slay-the-Spire-style star chart) ------------- */
    map: {
      rows: 12,            // content rows per sector (the boss sits above them)
      // Three lanes, because a row is 2-3 nodes and rows SPAN the lanes rather
      // than sliding across them. Five lanes meant a row covered part of the
      // width and slid sideways to vary — which swept the chart diagonally. At
      // three, a lane IS a highway: gauntlet, supply and frontier run the length
      // of the sector and you can follow one with your eye.
      cols: 3,
      // ROW SHAPE. The chart is sized directly rather than woven from random
      // walks — see generateMap. Rows of 2-3 across 5 lanes fill 49% of the
      // grid, which is where Slay the Spire's 7x15 sits; the old weave filled
      // 74% and read as a lattice rather than as a route you pick.
      entryWidth: 3,       // ways into the sector (Slay the Spire opens with 3-4)
      minWidth: 2,         // at least two places to be at every depth
      maxWidth: 3,
      weave: 1,            // how often a row-join branches instead of running straight
      // a sector reads as three acts: a safe Approach, the dangerous Push, and
      // a Final Approach that ends on a guaranteed rest before the boss.
      act1End: 3,          // rows 1..act1End  = Approach (fights/events only)
      act2End: 8,          // rows act1End+1..act2End = The Push (elites/shops/forges...)
      // NODE DIET: 11 types -> 7. `market` folded into `shop`, `rift` cut (its
      // "boon with a price" is what events already do), `treasure` made rare so a
      // free relic is an event rather than routine. Combat pushed to ~60% of the
      // map, in line with the genre, so rewards are things you fought for.
      actWeights: {
        approach: { fight: 66, event: 18, treasure: 4, rest: 6 },
        push:     { fight: 34, elite: 18, beacon: 7, event: 14, shop: 8, rest: 10, forge: 6, treasure: 3 },
        final:    { fight: 40, elite: 10, event: 14, shop: 8, rest: 14, forge: 7, treasure: 3 },
      },
      restBeforeBoss: true, // the top content row is always a rest (catch your breath)
    },

    /* ---- Relics ------------------------------------------------------ */
    relics: {
      // How many times a CLASS relic goes into the bag against a colourless
      // one. At weight 1 the Vanguard's die-shaping set was 17% of his pool and
      // none of tier 1 — a run could reach sector 3 without meeting it.
      //
      // Weight cuts both ways: it concentrates draws onto a class's OWN set,
      // and the Vanguard has 15+ relics where the other two still have ~5, so
      // it amplifies whichever class has been rebuilt. Measured at 300 runs:
      //
      //   weight 1   reached-5 37%   class spread 8
      //   weight 2   reached-5 35%   class spread 15
      //   weight 4   reached-5 30%   class spread 19   <- here
      //
      // 4 is set deliberately. The Vanguard is the class being tuned, and at 4
      // he is the only one whose relics reliably show up — which is the point
      // while he is the testing ground, and puts reached-sector-5 inside its
      // 15-30% target for the first time. The spread is not a bug to fix here;
      // it closes when the other two classes have sets of comparable size.
      classWeight: 4,
    },

    /* ---- Rewards ------------------------------------------------------ */
    rewards: {
      creditsFight: [18, 30],   // [min, max] credits from a normal fight
      creditsElite: [40, 60],
      creditsBoss:  [70, 95],
      creditsPerSectorMul: 0.10, // +10% credits per sector beyond the first
      cardChoices: 3,            // cards offered after a fight
      rareChance: 0.08,          // chance an offered card is rare
      uncommonChance: 0.32,      // chance an offered card is uncommon (else common)
      eliteRareChance: 0.25,     // rarity boost for elite rewards
      bossHealPct: 0.28,         // heal option after beating a boss
      restHealPct: 0.30,         // heal at a rest node
    },

    /* ---- Shop ---------------------------------------------------------- */
    shop: {
      cardCost:     { 1: 35, 2: 55, 3: 90 },  // by rarity
      artifactCost: 80,
      removeCost: 40,            // remove a card from the deck
      removeCostInc: 15,         // increase per purchase this run
      healCost: 30,
      healAmount: 18,
    },

    /* ---- The die economy ------------------------------------------------
     * Fights hand you engravings; the bench is where you buy the ones you
     * actually want and undo the ones you didn't choose. A Flaw is only a real
     * curse if grinding it out costs something, so the prices below are the
     * counterplay tax — deliberately steep enough that you weigh moving a Flaw
     * out of reach (cheap) against destroying it (dear).
     * ------------------------------------------------------------------ */
    dieShop: {
      stock: 2,                            // engravings a bench carries
      // an engraving is worth about a relic (¢80) — a shade under, because a
      // relic is unconditional and a face only fires when the die lands there.
      engravingCost: { 1: 70, 2: 105, 3: 150 },
      grindCost: 50,                       // destroy a Flaw outright
      grindCostInc: 25,                    // per grind this run
      reseatCost: 30,                      // move an installed engraving
    },

    /* ---- Combat feel (UI timings, ms) ---------------------------------- */
    feel: {
      enemyActDelay: 520,        // stagger between enemy actions
      cardPlayDelay: 260,        // pause after playing a card
      floaterLife: 900,
      shakeMag: 7,
      swipeThreshold: 64,        // px of upward drag needed to play a card
    },

    /* ---- Score ---------------------------------------------------------- */
    score: {
      perSector: 100,
      perNode: 12,
      perKill: 4,
    },

    /* ---- Run arc / win condition ---------------------------------------- */
    run: {
      finale: 4,   // the boss of this sector is THE UNMAKER (the win condition).
                   // Beat it and the run ENDS — the rating clears and the next
                   // one unlocks. There is no NG+ loop: difficulty lives on one
                   // ladder, climbed by starting again, the way an ascension does.
      heartFrom: 4, // from this rating up, beating the Unmaker opens one more
                    // door: the counter-boss. Optional, and the run ends either way.
    },

    ladder: [
      { name: 'DRIFT',         desc: 'Standard descent. Nothing out there but the Spire.', mods: {} },
      { name: 'COLD VACUUM',   desc: 'Hostiles run 10% harder to kill.',                  mods: { enemyHp: 1.10 } },
      // more elites alone made the game EASIER (elites pay in relics and
      // engravings), so this rating makes elites nastier rather than commoner.
      { name: 'DEBRIS FIELD',  desc: 'Elites never travel alone, and there are more of them.', mods: { eliteWeight: 4, eliteMinion: 1 } },
      { name: 'SOLAR FLARE',   desc: 'Your die runs hot: a 1 or a 2 misfires, and misfires bite harder.', mods: { misfireOn: 2, misfireMult: 0.7 } },
      { name: 'GRAVITY WELL',  desc: 'The die frame buckles — one less core slot, now and forever.', mods: { coreSlots: -1, coreSlotsMax: -1 } },
      { name: 'RADIATION BELT',desc: 'Field repairs take poorly. Rest heals 30% less.',   mods: { restHeal: 0.70 } },
      { name: 'ION STORM',     desc: 'Hostiles hit 10% harder.',                          mods: { enemyDmg: 1.10 } },
      { name: 'HULL BREACH',   desc: 'You launch with a Flaw already cut into your die.', mods: { startFlaw: 1 } },
      { name: 'DEAD RECKONING',desc: 'Salvage is thin — 2 cards offered, not 3.',         mods: { cardChoices: -1 } },
      { name: 'EVENT HORIZON', desc: 'Hostiles run 10% harder to kill again.',            mods: { enemyHp: 1.10 } },
      { name: 'SINGULARITY',   desc: 'Markets gouge (+30%) and stims are scarce.',        mods: { shopCost: 1.30, potionDrop: 0.6 } },
      { name: 'THE LONG DARK', desc: 'Hostiles hit 10% harder, and every boss wakes angry.', mods: { enemyDmg: 1.10, bossStr: 1 } },
    ],

    /* ---- The Pacts (were: Void Echoes) ----------------------------------
     * Eleven double-edged relics that used to exist only inside the Recurrence:
     * you drafted one per loop and equipped three. With the loop gone they had
     * no delivery mechanism at all, so they became what they always resembled —
     * boss relics with a real cost attached. Nothing was cut. */

    /* ---- Potions & consumables ------------------------------------------ */
    potions: {
      slots: 3,            // how many potions you can carry at once
      dropChance: 0.40,    // chance a normal/elite fight also drops a potion
      bossDropChance: 1.0, // a sector boss always offers a potion
      shopChance: 0.7,     // chance a shop stocks a potion
      shopCost: { 1: 35, 2: 55, 3: 85 },  // shop price by rarity
      rarityWeights: { 1: 100, 2: 46, 3: 15 },
    },
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
