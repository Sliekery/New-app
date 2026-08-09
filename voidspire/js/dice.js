/* =========================================================================
 * VOIDSPIRE — dice.js
 * The Augmented Die: the player's second build.
 *
 *   FACES (1-20) — engraved augments; fire when the effective roll lands there.
 *   CORE         — always-on modules (the old relics), limited slots.
 *   FRAME        — upgrades that change how the die itself rolls.
 *
 * Augment `fx` reuses the card effect vocabulary (dmg/block/energy/draw/heal/
 * hploss/status/special), so the engine resolves them with applyCardFx — there
 * is no second effect system.
 * ========================================================================= */
(function (ns) {
  'use strict';

  // NOTE: names are DIE_-prefixed on purpose — augments.js already owns
  // ns.AUGMENTS for the level-up draft, and an unprefixed name is silently
  // clobbered by load order.

  // How many faces a die has, and how the core grows.
  /* SIDES ARE PER-DIE NOW. `DIE.faces` is still 20 — it is the shape of a d20
   * and of everything measured against one — but a die may carry its own
   * `sides`, and the Arsenal's two small barrels carry 6. Everything that used
   * to loop 1..DIE.faces asks the die instead.
   *
   * The engraving system does NOT change. A d6 runs the same engravings, the
   * same bands, the same seams, welds and taints as the d20; it simply has six
   * places to put them instead of twenty, which makes every face on it worth
   * more than three times as much. That is the whole trade: the d20 is the
   * lottery with room to build, the d6s are the reliable ones you cannot
   * over-stuff. */
  ns.dieSides = function (die) { return (die && die.sides) || ns.DIE.faces; };
  /* Where a face sits on the d20 scale the class tables are written against.
   * A d6's face 1 is still the jam and its 6 is still the top of the table —
   * anything else would need a second set of bands per die size, which is the
   * parallel-vocabulary mistake in a new hat. */
  ns.dieScale = function (die, face) {
    var n = ns.dieSides(die);
    if (n === ns.DIE.faces) return face;
    /* A GROUND DIE STILL JAMS. FACET GRINDER adds faces, and the small-barrel
     * formula below maps face 1 onto 2 — which would have quietly deleted the
     * misfire as a side effect of buying more room to cut. A bigger die is the
     * same table stretched, not a safer one: face 1 is still the jam, the top
     * face is still 20, and every face you already owned is now a slightly
     * narrower slice of the roll. That last part is the cost. */
    if (n > ns.DIE.faces) {
      return Math.min(ns.DIE.faces, Math.max(1, Math.round(1 + (face - 1) * (ns.DIE.faces - 1) / (n - 1))));
    }
    /* A SMALL BARREL DOES NOT JAM. Mapping a d6's face 1 onto the d20's face 1
     * gave it a 1-in-6 misfire against the big die's 1-in-20 — three times the
     * jam rate, on the dice you are meant to lean on. Measured, it cost the
     * class two thirds of its win rate at every base payload I tried.
     *
     * So the bottom of a small die is the bottom BAND, not the jam. That is
     * also the trade the rack is built on: the d20 is the lottery, swingy and
     * with room to build; the d6s are the reliable ones. The top face still
     * maps to 20, so a small barrel can still crit. */
    return Math.round(2 + (face - 1) * (ns.DIE.faces - 2) / (n - 1));
  };
  ns.DIE = {
    faces: 20,
    coreSlotsStart: 3,     // mounted Core Modules at the start of a run
    coreSlotsPerBoss: 1,   // +1 after each sector boss
    coreSlotsMax: 6,
  };

  /* ---- Face augments -------------------------------------------------
   * span: how many consecutive faces the engraving occupies (1 = point).
   * PRICING RULE (see docs/DICE_SYSTEM.md sec 9): a point augment fires on ~5% of
   * rolls, i.e. ~0.2x per turn. To be worth a relic that ticks every turn, each
   * trigger must therefore be worth roughly 3x that relic's per-turn effect.
   * Band augments cover several faces, fire proportionally more often, and are
   * priced down to match. Content authored at "per-turn" values is ~5x too weak.
   * `anyFace: false` means it can only be engraved where noted.
   * ------------------------------------------------------------------ */
  ns.DIE_AUGMENTS = {
    /* Energy is the most valuable thing a face can hand you, because it buys
     * another card AND another roll. Two of it on a tier 1 measured 11.5 a
     * fire, level with the tier 3s. */
    overcharge_cell: {
      name: 'Overcharge Cell', tier: 1, span: 1,
      fx: [{ k: 'energy', v: 1 }],
      desc: 'Gain 1 Energy.',
      art: { p: [[-0.5,-0.6, 0.5,-0.6, 0.5,0.6, -0.5,0.6, -0.5,-0.6], [-0.22,-0.6, -0.22,-0.82, 0.22,-0.82, 0.22,-0.6], [0.16,-0.3, -0.18,0.08, 0.06,0.08, -0.14,0.46]] },
    },
    munition_feed: {
      name: 'Munition Feed', tier: 1, span: 1,
      fx: [{ k: 'draw', v: 2 }],
      desc: 'Draw 2 cards.',
      art: { p: [[-0.55,-0.5, 0.15,-0.5, 0.15,0.55, -0.55,0.55, -0.55,-0.5], [-0.25,-0.5, -0.25,0.55], [0.15,-0.3, 0.62,-0.3, 0.62,0.4, 0.15,0.4]] },
    },
    repair_nanites: {
      name: 'Repair Nanites', tier: 1, span: 1,
      fx: [{ k: 'heal', v: 10 }],
      desc: 'Heal 10 HP.',
      art: { p: [[-0.2,-0.7, 0.2,-0.7, 0.2,-0.2, 0.7,-0.2, 0.7,0.2, 0.2,0.2, 0.2,0.7, -0.2,0.7, -0.2,0.2, -0.7,0.2, -0.7,-0.2, -0.2,-0.2, -0.2,-0.7]] },
    },
    kinetic_buffer: {
      name: 'Kinetic Buffer', tier: 1, span: 1,
      fx: [{ k: 'block', v: 14 }],
      desc: 'Gain 14 Shield.',
      art: { p: [[0,-0.8, 0.66,-0.46, 0.66,0.2, 0,0.82, -0.66,0.2, -0.66,-0.46, 0,-0.8], [0,-0.5, 0,0.5], [-0.44,-0.16, 0.44,-0.16]] },
    },
    targeting_spike: {
      name: 'Targeting Spike', tier: 1, span: 1,
      fx: [{ k: 'status', s: 'vuln', v: 3, who: 'target' }],
      desc: 'Apply 3 Vulnerable.',
      art: { p: [[-0.6,-0.6, -0.6,-0.24], [-0.6,-0.6, -0.24,-0.6], [0.6,-0.6, 0.24,-0.6], [0.6,-0.6, 0.6,-0.24], [-0.6,0.6, -0.6,0.24], [-0.6,0.6, -0.24,0.6], [0.6,0.6, 0.6,0.24], [0.6,0.6, 0.24,0.6], [-0.5,0, 0.5,0], [0,-0.5, 0,0.5]], e: [[0,0]] },
    },
    ignition_coil: {
      name: 'Ignition Coil', tier: 1, span: 1,
      fx: [{ k: 'status', s: 'burn', v: 6, who: 'target' }],
      desc: 'Apply 6 Burn.',
      art: { p: [[0,-0.85, 0.34,-0.4, 0.18,-0.06, 0.46,0.24, 0.2,0.62, 0,0.8, -0.2,0.62, -0.46,0.24, -0.18,-0.06, -0.34,-0.4, 0,-0.85]] },
    },
    static_discharge: {
      name: 'Static Discharge', tier: 1, span: 1,
      fx: [{ k: 'dmg', v: 6, random: true }],
      desc: 'Deal 6 damage to a random enemy.',
      art: { p: [[0.2,-0.86, -0.34,-0.04, 0.06,-0.04, -0.24,0.86, 0.42,-0.08, 0.02,-0.08, 0.36,-0.86, 0.2,-0.86]] },
    },
    scavenger_port: {
      name: 'Scavenger Port', tier: 1, span: 1,
      fx: [{ k: 'special', id: 'dieCredits', v: 25 }],
      desc: 'Gain 25 credits.',
      art: { p: [[-0.6,-0.34, 0.6,-0.34, 0.6,0.5, -0.6,0.5, -0.6,-0.34], [-0.26,-0.34, -0.26,-0.6, 0.26,-0.6, 0.26,-0.34], [-0.2,0.08, 0.2,0.08]] },
    },
    // -- band augments: wider, so cheaper per trigger --
    scrap_sifter: {
      name: 'Scrap Sifter', tier: 1, span: 3,
      fx: [{ k: 'block', v: 9 }],
      desc: 'Gain 9 Shield.',
      art: { p: [[0,-0.7, 0.58,-0.4, 0.58,0.18, 0,0.72, -0.58,0.18, -0.58,-0.4, 0,-0.7], [-0.3,0, 0.3,0]] },
    },
    /* THE DEAD TAIL. Everything in this group measured under 2.3 impact a fire
     * against a damage face's 16. That is not support, it is filler, and most
     * of why drafting felt like it did not matter was that most of the pool
     * was noise around a handful of engine pieces. */
    pressure_valve: {
      name: 'Pressure Valve', tier: 2, span: 3,
      fx: [{ k: 'heal', v: 3 }, { k: 'block', v: 10 }],
      desc: 'Heal 3 HP and gain 10 Shield.',
      art: { p: [[-0.5,-0.2, 0.5,-0.2, 0.5,0.5, -0.5,0.5, -0.5,-0.2], [0,-0.2, 0,-0.7], [-0.3,-0.7, 0.3,-0.7], [-0.2,0.1, 0.2,0.1]] },
    },
    // -- Vanguard flavour --
    momentum_tap: {
      name: 'Momentum Tap', tier: 2, span: 1,
      fx: [{ k: 'status', s: 'momentum', v: 3, who: 'self' }],
      desc: 'Gain 3 Momentum.',
      art: { p: [[-0.7,0.3, -0.2,-0.3, 0.1,0.1, 0.7,-0.5], [0.7,-0.5, 0.3,-0.5], [0.7,-0.5, 0.7,-0.12]] },
    },
    blood_tithe: {
      name: 'Blood Tithe', tier: 2, span: 1,
      fx: [{ k: 'hploss', v: 2 }, { k: 'status', s: 'str', v: 2, who: 'self' }],
      desc: 'Lose 2 HP. Gain 2 Might.',
      art: { p: [[0,-0.8, 0.4,-0.1, 0.28,0.5, -0.28,0.5, -0.4,-0.1, 0,-0.8], [-0.2,0.06, 0.2,0.06]] },
    },
    aim_assist: {
      name: 'Aim Assist', tier: 2, span: 1,
      fx: [{ k: 'status', s: 'aim', v: 1, who: 'self' }],
      desc: 'Gain 1 Aim for the rest of combat.',
      art: { p: [[-0.75,0, 0.75,0], [0,-0.75, 0,0.75], [0.42,0, 0.3,-0.12], [0.42,0, 0.3,0.12]], e: [[0,0]] },
    },
    // -- Technomancer flavour --
    coolant_bleed: {
      name: 'Coolant Bleed', tier: 2, span: 1,
      fx: [{ k: 'status', s: 'reactor', v: 1, who: 'self' }],
      desc: 'Gain 1 Reactor (+1 max Energy for the fight).',
      art: { p: [[-0.55,-0.55, 0.55,-0.55, 0.55,0.55, -0.55,0.55, -0.55,-0.55], [-0.3,-0.55, -0.3,0.55], [0.3,-0.55, 0.3,0.55], [-0.55,0, 0.55,0]] },
    },
    // -- Voidadept flavour --
    psi_bloom: {
      name: 'Psi Bloom', tier: 2, span: 1,
      fx: [{ k: 'status', s: 'psiPow', v: 2, who: 'self' }],
      desc: 'Gain 2 Psi Power for the rest of combat.',
      art: { p: [[0,-0.8, 0.32,-0.28, 0.8,-0.16, 0.44,0.24, 0.5,0.74, 0,0.5, -0.5,0.74, -0.44,0.24, -0.8,-0.16, -0.32,-0.28, 0,-0.8]], e: [[0,0]] },
    },

    /* -- face-locked: the anchors -------------------------------------
     * Face 1 is where the three classes disagree most — a wasted shot, a
     * tripped breaker, a void that bit too deep — so each gets its own way to
     * make the worst face pay. They are all onlyFace 1 and therefore mutually
     * exclusive: the anchor you cut is a statement about your die.
     * ---------------------------------------------------------------- */
    jam_clearance: {
      name: 'Jam Clearance', tier: 2, span: 1, onlyFace: 1,
      fx: [{ k: 'status', s: 'momentum', v: 3, who: 'self' }, { k: 'energy', v: 1 }],
      desc: 'Gain 3 Momentum and 1 Energy. Engraved on face 1 only — the shot that jams still pays.',
      art: { p: [[-0.6,-0.5, 0.6,-0.5, 0.6,0.5, -0.6,0.5, -0.6,-0.5], [-0.6,-0.5, 0.6,0.5], [0.6,-0.5, -0.6,0.5]] },
    },
    earth_strap: {
      name: 'Earthing Strap', tier: 2, span: 1, onlyFace: 1,
      fx: [{ k: 'block', v: 18 }],
      desc: 'Gain 18 Shield. Engraved on face 1 only, the breaker trips into the plating.',
      art: { p: [[0,-0.8, 0,0.1], [-0.5,0.1, 0.5,0.1], [-0.34,0.38, 0.34,0.38], [-0.18,0.64, 0.18,0.64]] },
    },
    blood_sigil: {
      name: 'Blood Sigil', tier: 2, span: 1, onlyFace: 1,
      fx: [{ k: 'heal', v: 6 }, { k: 'status', s: 'psiPow', v: 2, who: 'self' }],
      desc: 'Heal 6 HP and gain 2 Psi Power. Engraved on face 1 only — what the void takes, it gives back.',
      art: { p: [[0,-0.78, 0.42,-0.12, 0.28,0.54, -0.28,0.54, -0.42,-0.12, 0,-0.78], [-0.42,-0.12, 0.42,-0.12], [0,-0.78, 0,0.54]] },
    },
    /* -- THE FIRST MARK: the run-start inscriptions --------------------
     * One of these is cut before you go down (see ns.FIRST_MARKS below), so
     * each is a statement of intent rather than a pickup. They are `startOnly`
     * — never in a shop, never a drop — and each is tuned to how ITS class
     * reads the die, which is why they are worth more than a tier-1 face:
     *
     *   Vanguard    climbs the table with Aim, so his marks want the top of it
     *   Technomancer never steers, so his are priced for a face he cannot aim at
     *   Voidadept   is strongest at BOTH ends and bored in the middle
     * ---------------------------------------------------------------- */
    ranging_mark: {
      name: 'Ranging Mark', tier: 2, span: 3, startOnly: true, cls: 'vanguard',
      fx: [{ k: 'status', s: 'aim', v: 1, who: 'self' }, { k: 'draw', v: 1 }],
      desc: 'Gain 1 Aim. Draw 1 card.',
      art: { p: [[-0.8,0, 0.8,0], [0,-0.8, 0,0.8], [0.5,-0.5, 0.5,0.5], [-0.5,-0.5, -0.5,0.5], [0.34,0, 0.2,-0.14], [0.34,0, 0.2,0.14]], e: [[0,0]] },
    },
    /* Might scales the FACES as well as the cards, and faces fire far more often
     * than cards do, so a face granting Might pays the die twice and compounds
     * into itself. Printed 5 damage, measured 16.8 impact a fire. */
    whetstone_mark: {
      name: 'Whetstone Mark', tier: 2, span: 3, startOnly: true, cls: 'vanguard',
      fx: [{ k: 'dmg', v: 4, scale: 'might' }, { k: 'status', s: 'str', v: 1, who: 'self' }],
      desc: 'Deal 4 damage. Gain 1 Might.',
      art: { p: [[-0.7,0.3, 0.5,-0.5, 0.7,-0.2, -0.5,0.6, -0.7,0.3], [-0.2,0.02, 0.1,-0.2], [0.2,-0.62, 0.34,-0.8]] },
    },
    anvil_mark: {
      name: 'Anvil Mark', tier: 2, span: 3, startOnly: true, cls: 'vanguard',
      fx: [{ k: 'block', v: 11 }, { k: 'status', s: 'thorns', v: 2, who: 'self' }],
      desc: 'Gain 11 Shield and 2 Thorns.',
      art: { p: [[-0.7,-0.2, 0.7,-0.2, 0.5,0.14, -0.5,0.14, -0.7,-0.2], [-0.24,0.14, -0.34,0.62, 0.34,0.62, 0.24,0.14], [-0.5,-0.2, -0.36,-0.5], [0.5,-0.2, 0.36,-0.5], [0,-0.2, 0,-0.56]] },
    },

    assembly_mark: {
      name: 'Assembly Mark', tier: 2, span: 3, startOnly: true, cls: 'technomancer',
      fx: [{ k: 'status', s: 'turret', v: 3, who: 'self' }],
      desc: 'Deploy a Turret (3 dmg/turn).',
      art: { p: [[-0.6,0.6, -0.3,0.0, 0.3,0.0, 0.6,0.6], [-0.3,0.0, 0.3,0.0, 0.24,-0.4, -0.24,-0.4, -0.3,0.0], [0.24,-0.28, 0.74,-0.28], [-0.5,0.6, 0.5,0.6]], e: [[0,-0.2]] },
    },
    breaker_mark: {
      name: 'Bus Tap', tier: 2, span: 3, startOnly: true, cls: 'technomancer',
      fx: [{ k: 'energy', v: 1 }, { k: 'draw', v: 1 }],
      desc: 'Gain 1 Energy. Draw 1 card.',
      art: { p: [[-0.6,-0.6, -0.6,0.6], [0.6,-0.6, 0.6,0.6], [-0.6,-0.2, 0.3,0.2], [0.3,0.2, 0.6,0.2], [0.1,-0.5, -0.16,-0.1, 0.06,-0.1, -0.1,0.4]] },
    },
    damping_mark: {
      name: 'Damping Mark', tier: 2, span: 3, startOnly: true, cls: 'technomancer',
      fx: [{ k: 'block', v: 5 }, { k: 'status', s: 'weak', v: 1, who: 'allEnemies' }],
      desc: 'Gain 5 Shield. Apply 1 Weak to ALL enemies.',
      art: { p: [[0,-0.75, 0.62,-0.4, 0.62,0.2, 0,0.76, -0.62,0.2, -0.62,-0.4, 0,-0.75], [-0.62,-0.1, 0.62,-0.1], [-0.4,0.24, 0.4,0.24], [-0.2,0.5, 0.2,0.5]] },
    },

    ember_mark: {
      name: 'Ember Mark', tier: 2, span: 3, startOnly: true, cls: 'voidadept',
      fx: [{ k: 'status', s: 'burn', v: 5, who: 'target' }],
      desc: 'Apply 5 Burn.',
      art: { p: [[0,-0.8, 0.3,-0.3, 0.14,0.0, 0.4,0.3, 0.16,0.66, 0,0.78, -0.16,0.66, -0.4,0.3, -0.14,0.0, -0.3,-0.3, 0,-0.8], [0,0.24, 0.12,0.5, 0,0.66, -0.12,0.5, 0,0.24]] },
    },
    vein_mark: {
      name: 'Vein Mark', tier: 2, span: 3, startOnly: true, cls: 'voidadept',
      fx: [{ k: 'hploss', v: 2 }, { k: 'dmg', v: 16, scale: 'psi' }],
      desc: 'Lose 2 HP. Deal 16 damage.',
      art: { p: [[0,-0.8, 0,0.5], [0,-0.4, -0.4,-0.7], [0,-0.1, 0.42,-0.4], [0,0.2, -0.36,0.0], [0,0.5, 0.2,0.74], [-0.16,0.62, 0,0.5, 0.16,0.62]] },
    },
    whisper_mark: {
      name: 'Whisper Mark', tier: 2, span: 3, startOnly: true, cls: 'voidadept',
      fx: [{ k: 'status', s: 'psiPow', v: 2, who: 'self' }, { k: 'status', s: 'vuln', v: 2, who: 'target' }],
      desc: 'Gain 2 Psi Focus. Apply 2 Vulnerable.',
      art: { p: [[-0.75,0, -0.4,-0.4, 0.1,-0.2, 0.5,-0.6, 0.78,-0.1], [-0.6,0.34, -0.2,0.1, 0.2,0.44, 0.62,0.16]], e: [[0,-0.06]] },
    },

    /* -- archetypes that had no face at all ----------------------------
     * The die is the second build, so an archetype with nothing engravable
     * can only ever be half a plan. These three had no engraving of any kind:
     * the Vanguard's Exhaust engine and blood engine, and the Technomancer's
     * Shield stack. Ordinary drops — not startOnly — so they show up in the
     * bench and in rewards like any other face.
     * ---------------------------------------------------------------- */
    salvage_burner: {
      name: 'Salvage Burner', tier: 2, span: 1,
      fx: [{ k: 'special', id: 'dieExhaustDraw', v: 2 }],
      desc: 'Exhaust the top card of your draw pile. Draw 2 cards.',
      art: { p: [[-0.5,-0.6, 0.5,-0.6, 0.5,0.6, -0.5,0.6, -0.5,-0.6], [-0.5,-0.6, 0.5,0.6], [-0.28,-0.86, 0.28,-0.86], [0.5,-0.2, 0.8,-0.2], [0.5,0.2, 0.8,0.2]] },
    },
    /* Draw AND Energy on one face is a free card every landing. */
    haemal_tap: {
      name: 'Haemal Tap', tier: 2, span: 3,
      fx: [{ k: 'hploss', v: 2 }, { k: 'draw', v: 1 }],
      desc: 'Lose 2 HP. Draw 1 card.',
      art: { p: [[0,-0.8, 0.34,-0.2, 0.22,0.4, -0.22,0.4, -0.34,-0.2, 0,-0.8], [-0.22,0.4, -0.3,0.75], [0.22,0.4, 0.3,0.75], [0,0.4, 0,0.8]] },
    },
    plate_layer: {
      name: 'Plate Layer', tier: 2, span: 3,
      fx: [{ k: 'status', s: 'plate', v: 2, who: 'self' }],
      desc: 'Gain 2 Plating.',
      art: { p: [[-0.7,-0.4, 0.7,-0.4], [-0.7,-0.05, 0.7,-0.05], [-0.7,0.3, 0.7,0.3], [-0.4,-0.4, -0.4,0.3], [0,-0.4, 0,0.3], [0.4,-0.4, 0.4,0.3], [-0.7,0.3, -0.7,0.6, 0.7,0.6, 0.7,0.3]] },
    },

    /* =================================================================
     * VOID ADEPT SET — THE HUNGER. His table is a U, not a ramp: ATTUNED x1.2
     * at the top, HUNGER x1.2 at the bottom, and WHISPER x0.9 through the fat
     * middle. Measured after engravings began resolving in their face's band,
     * that cost him 12 points of class parity — because everything sat in the
     * middle, which is the one place his die is BAD.
     *
     * So this set lives at the ENDS. Band-locked pieces are low or high and
     * nothing is written for the middle, which is his identity anyway: the void
     * answers at both extremes and is bored in between.
     * ================================================================= */

    /* ---- standalone ---- */
    ember_notch: {
      name: 'Ember Notch', tier: 1, span: 1, cls: 'voidadept',
      fx: [{ k: 'status', s: 'burn', v: 6, who: 'target' }],
      desc: 'Apply 6 Burn.',
      art: { p: [[0,-0.7, 0.26,-0.28, 0.12,0.0, 0.3,0.3, 0.14,0.6, 0,0.72, -0.14,0.6, -0.3,0.3, -0.12,0.0, -0.26,-0.28, 0,-0.7], [0,-0.24, 0.12,0.06, 0,0.36, -0.12,0.06, 0,-0.24], [-0.5,-0.3, -0.6,0.06], [0.5,-0.3, 0.6,0.06]], e: [[0,0.06]] },
    },
    hunger_mark: {
      name: 'Hunger Mark', tier: 2, span: 1, cls: 'voidadept', band: 'low',
      fx: [{ k: 'hploss', v: 2 }, { k: 'dmg', v: 18, scale: 'psi' }],
      desc: 'Lose 2 HP. Deal 18 damage. Cuts only into the hunger band — where the void already bites.',
      art: { p: [[-0.6,-0.5, -0.3,-0.1, -0.5,0.4], [-0.2,-0.66, -0.06,-0.1, -0.2,0.56], [0.2,-0.66, 0.06,-0.1, 0.2,0.56], [0.6,-0.5, 0.3,-0.1, 0.5,0.4], [-0.45,-0.1, 0.45,-0.1], [-0.16,0.66, 0.16,0.66]], e: [[0,0.74],[-0.62,-0.6],[0.62,-0.6]] },
    },
    attuned_notch: {
      name: 'Attuned Notch', tier: 2, span: 1, cls: 'voidadept', band: 'high',
      fx: [{ k: 'status', s: 'psiPow', v: 3, who: 'self' }],
      desc: 'Gain 3 Psi Focus. Cuts only into the attuned band.',
      art: { p: [[0,-0.8, 0.3,-0.26, 0,0.28, -0.3,-0.26, 0,-0.8], [0,-0.5, 0.14,-0.26, 0,-0.02, -0.14,-0.26, 0,-0.5], [-0.5,0.4, 0.5,0.4], [-0.34,0.58, 0.34,0.58], [-0.18,0.76, 0.18,0.76], [-0.3,-0.26, -0.6,-0.26], [0.3,-0.26, 0.6,-0.26]], e: [[0,-0.26]] },
    },
    plague_notch: {
      name: 'Plague Notch', tier: 1, span: 1, cls: 'voidadept',
      fx: [{ k: 'status', s: 'vuln', v: 2, who: 'allEnemies' }, { k: 'status', s: 'weak', v: 1, who: 'allEnemies' }],
      desc: 'ALL enemies: 2 Vulnerable, 1 Weak.',
      art: { p: [[0,-0.34, 0.28,-0.17, 0.28,0.17, 0,0.34, -0.28,0.17, -0.28,-0.17, 0,-0.34], [-0.66,-0.6, -0.44,-0.47, -0.44,-0.21, -0.66,-0.08, -0.88,-0.21, -0.88,-0.47, -0.66,-0.6], [0.66,-0.6, 0.44,-0.47, 0.44,-0.21, 0.66,-0.08, 0.88,-0.21, 0.88,-0.47, 0.66,-0.6], [0,0.58, 0.22,0.71, 0,0.84, -0.22,0.71, 0,0.58], [-0.28,-0.17, -0.46,-0.3], [0.28,-0.17, 0.46,-0.3], [0,0.34, 0,0.58]], e: [[0,0],[-0.66,-0.34],[0.66,-0.34]] },
    },
    thin_veil: {
      name: 'Thin Veil', tier: 1, span: 3, cls: 'voidadept',
      fx: [{ k: 'block', v: 4 }, { k: 'status', s: 'psiPow', v: 1, who: 'self' }],
      desc: 'Gain 4 Shield and 1 Psi Focus.',
      art: { p: [[0,-0.6, 0.48,-0.34, 0.48,0.14, 0,0.6, -0.48,0.14, -0.48,-0.34, 0,-0.6], [0,-0.86, 0.14,-0.5, 0,-0.14, -0.14,-0.5, 0,-0.86], [-0.48,-0.34, 0.48,0.14], [0.48,-0.34, -0.48,0.14]], e: [[0,-0.5]] },
    },

    /* ---- listeners: the void answers what you feed it ---- */
    kindling_notch: {
      name: 'Kindling Notch', tier: 2, span: 1, cls: 'voidadept', listen: 'burn',
      fx: [{ k: 'dmg', v: 3 }],
      desc: 'WHEN you apply Burn: deal 3 damage.',
      art: { p: [[0,-0.6, 0.22,-0.24, 0.1,0.0, 0.26,0.26, 0.12,0.54, 0,0.64, -0.12,0.54, -0.26,0.26, -0.1,0.0, -0.22,-0.24, 0,-0.6], [-0.66,0.2, -0.4,0.34], [0.66,0.2, 0.4,0.34], [-0.5,-0.4, -0.34,-0.24], [0.5,-0.4, 0.34,-0.24]], e: [[0,0.06],[-0.74,0.24],[0.74,0.24]] },
    },
    vein_notch: {
      name: 'Vein Notch', tier: 2, span: 1, cls: 'voidadept', listen: 'selfHp',
      fx: [{ k: 'status', s: 'psiPow', v: 2, who: 'self' }],
      desc: 'WHEN one of your own cards costs you HP: gain 2 Psi Focus.',
      art: { p: [[0,-0.66, 0,0.4], [0,-0.4, -0.36,-0.66], [0,-0.1, 0.4,-0.36], [0,0.16, -0.34,-0.04], [0,0.4, 0.2,0.64], [-0.18,0.54, 0,0.4, 0.18,0.54], [-0.24,0.78, 0.24,0.78]], e: [[0,0.86]] },
    },
    ascendant_notch: {
      name: 'Ascendant Notch', tier: 2, span: 1, cls: 'voidadept', listen: 'psi',
      fx: [{ k: 'dmg', v: 2, scale: 'psi' }],
      desc: 'WHEN you gain Psi Focus: deal 2 damage plus your Psi.',
      art: { p: [[0,-0.8, 0.2,-0.46, 0,-0.12, -0.2,-0.46, 0,-0.8], [0,-0.46, 0.34,-0.12, 0,0.24, -0.34,-0.12, 0,-0.46], [0,-0.12, 0.48,0.24, 0,0.6, -0.48,0.24, 0,-0.12], [-0.26,0.6, 0.26,0.6], [-0.16,0.76, 0.16,0.76]], e: [[0,-0.46]] },
    },
    contagion_notch: {
      name: 'Contagion Notch', tier: 3, span: 1, cls: 'voidadept', listen: 'debuff',
      fx: [{ k: 'status', s: 'burn', v: 2, who: 'allEnemies' }],
      desc: 'WHEN you apply Weak or Vulnerable: apply 2 Burn to ALL enemies.',
      art: { p: [[0,-0.24, 0.2,-0.1, 0.2,0.16, 0,0.3, -0.2,0.16, -0.2,-0.1, 0,-0.24], [-0.7,-0.5, -0.2,-0.14], [0.7,-0.5, 0.2,-0.14], [-0.7,0.5, -0.2,0.2], [0.7,0.5, 0.2,0.2], [-0.78,-0.62, -0.7,-0.5], [0.78,-0.62, 0.7,-0.5]], e: [[0,0.03],[-0.78,-0.62],[0.78,-0.62],[-0.78,0.6],[0.78,0.6]] },
    },
    ravenous_notch: {
      name: 'Ravenous Notch', tier: 3, span: 1, cls: 'voidadept', onlyFace: 1,
      fx: [{ k: 'dmg', v: 22, scale: 'psi' }, { k: 'status', s: 'psiPow', v: 2, who: 'self' }],
      desc: 'Deal 22 damage and gain 2 Psi Focus. Face 1 only — the void bites deepest when it slips.',
      art: { p: [[-0.6,-0.5, -0.24,-0.06, -0.5,0.5], [-0.2,-0.7, -0.04,-0.06, -0.2,0.66], [0.2,-0.7, 0.04,-0.06, 0.2,0.66], [0.6,-0.5, 0.24,-0.06, 0.5,0.5], [-0.5,-0.06, 0.5,-0.06], [-0.86,-0.3, -0.66,-0.4], [0.86,-0.3, 0.66,-0.4]], e: [[0,-0.86],[0,0.8]] },
    },

    /* ---- adjacency / field ---- */
    sympathetic_seam: {
      name: 'Sympathetic Seam', tier: 3, span: 1, cls: 'voidadept', field: 'relay',
      fx: [{ k: 'status', s: 'burn', v: 3, who: 'target' }],
      desc: 'Apply 3 Burn. Faces either side of this one fire at FULL instead of the bleed.',
      art: { p: [[-0.7,0.0, -0.24,0.0], [0.24,0.0, 0.7,0.0], [0,-0.3, 0.22,-0.1, 0.22,0.18, 0,0.36, -0.22,0.18, -0.22,-0.1, 0,-0.3], [-0.7,-0.26, -0.7,0.26], [0.7,-0.26, 0.7,0.26]], e: [[0,0.03],[-0.7,0],[0.7,0]] },
    },
    red_thread_notch: {
      name: 'Red Thread', tier: 3, span: 1, cls: 'voidadept', field: 'opposite',
      fx: [{ k: 'hploss', v: 2 }, { k: 'dmg', v: 8, scale: 'psi' }],
      desc: 'Lose 2 HP. Deal 8 damage. Also fires the face OPPOSITE this one — the ends answer each other.',
      art: { p: [[-0.8,-0.5, -0.34,-0.14, -0.7,0.14, -0.2,0.5, 0.2,0.14, 0.62,0.5, 0.86,0.1], [-0.34,-0.14, -0.02,-0.5], [0.2,0.14, 0.5,-0.2], [-0.2,0.5, -0.16,0.74]], e: [[-0.34,-0.14],[0.2,0.14],[-0.14,0.82]] },
    },
    long_whisper_field: {
      name: 'Long Whisper', tier: 3, span: 3, cls: 'voidadept', field: 'listenerEcho',
      fx: [{ k: 'status', s: 'psiPow', v: 2, who: 'self' }],
      desc: 'Gain 2 Psi Focus. Every listener on the die answers one extra time.',
      art: { p: [[-0.72,0.0, -0.36,-0.34, 0.36,-0.34, 0.72,0.0, 0.36,0.34, -0.36,0.34, -0.72,0.0], [-0.24,0.0, 0.0,-0.24, 0.24,0.0, 0.0,0.24, -0.24,0.0], [-0.86,-0.44, -0.5,-0.44], [0.86,-0.44, 0.5,-0.44], [-0.86,0.44, -0.5,0.44], [0.86,0.44, 0.5,0.44]], e: [[0,0]] },
    },
    aching_seam: {
      name: 'Aching Seam', tier: 2, span: 1, cls: 'voidadept', listen: 'neighbour',
      fx: [{ k: 'status', s: 'vuln', v: 1, who: 'target' }],
      desc: 'WHEN a face beside this one fires: apply 1 Vulnerable.',
      art: { p: [[-0.56,-0.36, -0.34,-0.52, -0.12,-0.36, -0.12,-0.02, -0.34,0.16, -0.56,-0.02, -0.56,-0.36], [0.56,-0.36, 0.34,-0.52, 0.12,-0.36, 0.12,-0.02, 0.34,0.16, 0.56,-0.02, 0.56,-0.36], [-0.34,0.16, -0.34,0.5], [0.34,0.16, 0.34,0.5], [-0.34,0.5, 0.34,0.5]], e: [[-0.34,-0.26],[0.34,-0.26],[0,0.5]] },
    },

    /* ---- trade-offs: he always pays in blood ---- */
    blood_price: {
      name: 'Blood Price', tier: 2, span: 1, cls: 'voidadept', band: 'low',
      fx: [{ k: 'hploss', v: 3 }, { k: 'status', s: 'bloodPact', v: 2, who: 'self' }],
      desc: 'Lose 3 HP. Gain 2 Blood Pact — spilt HP feeds your Psi from now on.',
      art: { p: [[0,-0.6, 0.2,-0.3, 0,0.0, -0.2,-0.3, 0,-0.6], [-0.44,0.14, 0.44,0.14, 0.36,0.58, -0.36,0.58, -0.44,0.14], [-0.4,0.36, 0.4,0.36], [-0.2,0.0, -0.24,0.14], [0.2,0.0, 0.24,0.14]], e: [[-0.2,0.72],[0.2,0.72],[0,0.78]] },
    },
    wildfire_seam: {
      name: 'Wildfire Seam', tier: 3, span: 1, cls: 'voidadept', band: 'high',
      fx: [{ k: 'status', s: 'wildfire', v: 1, who: 'self' }, { k: 'hploss', v: 3 }],
      desc: 'Gain 1 Wildfire — Burn grows instead of fading. Lose 3 HP.',
      art: { p: [[0,-0.4, 0.22,-0.1, 0.1,0.14, 0.28,0.4, 0.12,0.66, 0,0.74, -0.12,0.66, -0.28,0.4, -0.1,0.14, -0.22,-0.1, 0,-0.4], [-0.56,-0.2, -0.42,0.1, -0.5,0.34], [0.56,-0.2, 0.42,0.1, 0.5,0.34], [-0.82,-0.4, -0.7,-0.1, -0.78,0.16], [0.82,-0.4, 0.7,-0.1, 0.78,0.16], [-0.2,-0.56, 0,-0.76, 0.2,-0.56]], e: [[0,0.3],[0,-0.84]] },
    },
    hollow_out: {
      name: 'Hollow Out', tier: 2, span: 1, cls: 'voidadept',
      fx: [{ k: 'status', s: 'entropy', v: 2, who: 'self' }, { k: 'hploss', v: 2 }],
      desc: 'Gain 2 Entropy — every turn ends in Burn for all of them. Lose 2 HP.',
      art: { p: [[0,-0.66, 0.24,-0.24, 0.12,0.0, 0.3,0.3, 0.14,0.6, 0,0.7, -0.14,0.6, -0.3,0.3, -0.12,0.0, -0.24,-0.24, 0,-0.66], [-0.6,-0.4, -0.46,-0.1, -0.54,0.14], [0.6,-0.4, 0.46,-0.1, 0.54,0.14], [-0.5,0.6, 0.5,0.6], [-0.86,-0.14, -0.74,0.1], [0.86,-0.14, 0.74,0.1]], e: [[0,0.14],[-0.5,0.7],[0.5,0.7]] },
    },
    open_wound: {
      name: 'Open Wound', tier: 2, span: 3, cls: 'voidadept',
      fx: [{ k: 'hploss', v: 1 }, { k: 'status', s: 'burn', v: 4, who: 'target' }],
      desc: 'Lose 1 HP. Apply 4 Burn.',
      art: { p: [[-0.4,-0.5, -0.1,-0.16, -0.34,0.14, 0.0,0.5, 0.3,0.14, 0.1,-0.16, 0.4,-0.5], [-0.4,-0.5, -0.56,-0.66], [0.4,-0.5, 0.56,-0.66], [0.0,0.5, 0.0,0.72], [-0.24,0.62, 0.24,0.62]], e: [[0,0.8],[-0.62,-0.72],[0.62,-0.72]] },
    },

    /* =================================================================
     * TECHNOMANCER SET — LOAD BALANCE. His table is the widest in the game
     * (SURGE x1.35 down to SAG x0.7) and it scales SHIELD as well as damage, so
     * a defensive face reads on the band too. He gets no extra Aim, so he
     * cannot steer: everything here is about REDUNDANCY — constructs that work
     * while he does not, a bus that makes a bad roll pay anyway, and listeners
     * that answer the machine rather than the man.
     * ================================================================= */

    /* ---- standalone ---- */
    load_shunt: {
      name: 'Load Shunt', tier: 1, span: 1, cls: 'technomancer',
      fx: [{ k: 'block', v: 8 }, { k: 'energy', v: 1 }],
      desc: 'Gain 8 Shield and 1 Energy.',
      art: { p: [[-0.7,-0.4, -0.2,-0.4, -0.2,0.4, -0.7,0.4, -0.7,-0.4], [-0.7,0.0, -0.2,0.0], [-0.2,0.0, 0.2,0.0], [0.3,-0.5, 0.1,-0.05, 0.34,-0.05, 0.14,0.5], [0.5,-0.3, 0.7,-0.3], [0.5,0.3, 0.7,0.3]], e: [[-0.45,-0.2],[-0.45,0.2]] },
    },
    servo_rack: {
      name: 'Servo Rack', tier: 2, span: 1, cls: 'technomancer',
      fx: [{ k: 'status', s: 'turret', v: 3, who: 'self' }],
      desc: 'Deploy a Turret (3 dmg/turn).',
      art: { p: [[-0.34,-0.1, 0.2,-0.1, 0.3,0.14, -0.44,0.14, -0.34,-0.1], [-0.44,0.14, -0.4,0.44, 0.26,0.44, 0.3,0.14], [-0.4,0.44, -0.56,0.72], [0.26,0.44, 0.42,0.72], [-0.66,0.72, 0.56,0.72], [0.2,-0.3, 0.74,-0.3], [0.62,-0.42, 0.82,-0.42, 0.82,-0.18, 0.62,-0.18], [-0.34,-0.1, -0.28,-0.34, 0.06,-0.34, 0.2,-0.1]], e: [[-0.08,-0.22],[0.88,-0.3]] },
    },
    heat_sink: {
      name: 'Heat Sink', tier: 1, span: 3, cls: 'technomancer', band: 'mid',
      fx: [{ k: 'block', v: 5 }, { k: 'status', s: 'plate', v: 1, who: 'self' }],
      desc: 'Gain 5 Shield, 1 Plating.',
      art: { p: [[-0.6,-0.5, 0.6,-0.5, 0.6,0.5, -0.6,0.5, -0.6,-0.5], [-0.36,-0.5, -0.36,0.5], [-0.12,-0.5, -0.12,0.5], [0.12,-0.5, 0.12,0.5], [0.36,-0.5, 0.36,0.5], [-0.6,-0.66, 0.6,-0.66], [-0.8,-0.2, -0.6,-0.2], [0.8,-0.2, 0.6,-0.2]], e: [[0,0.66]] },
    },
    bus_bar: {
      name: 'Bus Bar', tier: 2, span: 1, cls: 'technomancer',
      fx: [{ k: 'status', s: 'reactor', v: 1, who: 'self' }],
      desc: 'Gain 1 Reactor — +1 max Energy for the fight.',
      art: { p: [[-0.86,-0.2, 0.86,-0.2], [-0.86,0.2, 0.86,0.2], [-0.5,-0.2, -0.5,0.2], [0.0,-0.2, 0.0,0.2], [0.5,-0.2, 0.5,0.2], [-0.5,-0.2, -0.5,-0.5], [0.5,0.2, 0.5,0.5], [-0.66,-0.5, -0.34,-0.5], [0.34,0.5, 0.66,0.5]], e: [[-0.25,0],[0.25,0]] },
    },
    null_rod: {
      name: 'Null Rod', tier: 1, span: 1, cls: 'technomancer',
      fx: [{ k: 'status', s: 'weak', v: 2, who: 'allEnemies' }],
      desc: 'Apply 2 Weak to ALL enemies.',
      art: { p: [[0,-0.8, 0,0.6], [-0.2,-0.6, 0.2,-0.6], [-0.16,-0.2, 0.16,-0.2], [-0.12,0.2, 0.12,0.2], [-0.34,0.6, 0.34,0.6], [-0.5,-0.4, -0.34,-0.5], [0.5,-0.4, 0.34,-0.5], [-0.5,0.2, -0.3,0.14], [0.5,0.2, 0.3,0.14]], e: [[0,-0.86]] },
    },

    /* ---- listeners: they answer the machine ---- */
    feed_tap: {
      name: 'Feed Tap', tier: 2, span: 1, cls: 'technomancer', listen: 'construct',
      fx: [{ k: 'block', v: 3 }],
      desc: 'WHEN one of your constructs fires: gain 3 Shield.',
      art: { p: [[-0.7,-0.3, -0.3,-0.3, -0.3,0.3, -0.7,0.3, -0.7,-0.3], [-0.3,0.0, 0.1,0.0], [0.1,-0.34, 0.5,-0.34, 0.5,0.34, 0.1,0.34, 0.1,-0.34], [0.5,0.0, 0.8,0.0], [-0.5,-0.3, -0.5,-0.56], [0.3,-0.34, 0.3,-0.56]], e: [[-0.5,0],[0.3,0],[0.86,0]] },
    },
    grounding_pin: {
      name: 'Grounding Pin', tier: 2, span: 1, cls: 'technomancer', listen: 'shield',
      fx: [{ k: 'dmg', v: 3, random: true }],
      desc: 'WHEN you gain Shield: deal 3 damage to a random enemy.',
      art: { p: [[0,-0.7, 0,0.3], [-0.3,0.3, 0.3,0.3], [-0.2,0.46, 0.2,0.46], [-0.1,0.62, 0.1,0.62], [-0.4,-0.5, 0,-0.7, 0.4,-0.5], [0.5,-0.2, 0.34,0.06, 0.56,0.06, 0.4,0.34]], e: [[0,-0.78]] },
    },
    subroutine_notch: {
      name: 'Subroutine Notch', tier: 2, span: 1, cls: 'technomancer', listen: 'power',
      fx: [{ k: 'draw', v: 1 }, { k: 'energy', v: 1 }],
      desc: 'WHEN you play a Power: draw 1 card and gain 1 Energy.',
      art: { p: [[-0.66,-0.5, 0.2,-0.5, 0.2,-0.24, -0.66,-0.24, -0.66,-0.5], [-0.66,-0.1, 0.44,-0.1, 0.44,0.16, -0.66,0.16, -0.66,-0.1], [-0.66,0.3, 0.0,0.3, 0.0,0.56, -0.66,0.56, -0.66,0.3], [-0.5,-0.5, -0.5,-0.24], [-0.5,-0.1, -0.5,0.16], [-0.5,0.3, -0.5,0.56], [0.6,-0.37, 0.86,-0.37], [0.6,0.03, 0.86,0.03]], e: [[-0.58,-0.37],[-0.58,0.03],[-0.58,0.43]] },
    },
    arc_relay: {
      name: 'Arc Relay', tier: 2, span: 1, cls: 'technomancer', listen: 'debuff',
      fx: [{ k: 'dmg', v: 3 }],
      desc: 'WHEN you apply Weak or Vulnerable: deal 3 damage.',
      art: { p: [[-0.8,-0.3, -0.4,-0.3, -0.5,0.0, -0.2,0.0, -0.4,0.4], [0.0,-0.4, 0.4,-0.4, 0.3,-0.1, 0.6,-0.1, 0.4,0.3], [-0.4,-0.3, -0.3,-0.5], [0.4,-0.4, 0.5,-0.6], [0.7,0.2, 0.86,0.4]], e: [[-0.42,0.46],[0.42,0.36]] },
    },
    breaker_notch: {
      name: 'Breaker Notch', tier: 3, span: 1, cls: 'technomancer', onlyFace: 1,
      fx: [{ k: 'energy', v: 2 }, { k: 'status', s: 'reactor', v: 1, who: 'self' }, { k: 'block', v: 8 }],
      desc: 'Gain 2 Energy, 1 Reactor and 8 Shield. Face 1 only — the breaker trips into the bus.',
      art: { p: [[-0.6,-0.5, 0.6,-0.5, 0.6,0.5, -0.6,0.5, -0.6,-0.5], [-0.6,-0.5, 0.6,0.5], [0.2,-0.6, 0.0,-0.16, 0.24,-0.16, 0.04,0.3], [-0.86,0.0, -0.6,0.0], [0.86,0.0, 0.6,0.0]], e: [[-0.4,0.3],[0.4,-0.3]] },
    },

    /* ---- adjacency / field ---- */
    parallel_bus: {
      name: 'Parallel Bus', tier: 3, span: 1, cls: 'technomancer', field: 'relay',
      fx: [{ k: 'energy', v: 1 }],
      desc: 'Gain 1 Energy. Faces either side of this one fire at FULL instead of the bleed.',
      art: { p: [[-0.8,-0.3, 0.8,-0.3], [-0.8,0.3, 0.8,0.3], [-0.24,-0.3, -0.24,0.3], [0.24,-0.3, 0.24,0.3], [-0.24,0.0, 0.24,0.0], [-0.8,-0.5, -0.8,0.5], [0.8,-0.5, 0.8,0.5]], e: [[-0.24,0],[0.24,0],[-0.8,0],[0.8,0]] },
    },
    cross_link: {
      name: 'Cross-Link', tier: 3, span: 1, cls: 'technomancer', field: 'opposite',
      fx: [{ k: 'block', v: 6 }],
      desc: 'Gain 6 Shield. Also fires the face OPPOSITE this one on the die.',
      art: { p: [[-0.7,-0.4, 0.7,0.4], [0.7,-0.4, -0.7,0.4], [-0.2,-0.2, 0.2,-0.2, 0.2,0.2, -0.2,0.2, -0.2,-0.2], [-0.86,-0.5, -0.7,-0.4], [0.86,0.5, 0.7,0.4]], e: [[0,0],[-0.9,-0.54],[0.9,0.54]] },
    },
    load_balancer: {
      name: 'Load Balancer', tier: 3, span: 3, cls: 'technomancer', field: 'listenerEcho',
      fx: [{ k: 'block', v: 4 }],
      desc: 'Gain 4 Shield. Every listener on the die fires one extra time.',
      art: { p: [[-0.8,-0.4, 0.8,-0.4], [-0.8,0.0, 0.8,0.0], [-0.8,0.4, 0.8,0.4], [-0.4,-0.6, -0.4,0.6], [0.0,-0.6, 0.0,0.6], [0.4,-0.6, 0.4,0.6]], e: [[-0.4,-0.4],[0.4,-0.4],[-0.4,0],[0.4,0],[-0.4,0.4],[0.4,0.4],[0,0]] },
    },
    sympathetic_coil: {
      name: 'Sympathetic Coil', tier: 2, span: 1, cls: 'technomancer', listen: 'neighbour',
      fx: [{ k: 'block', v: 3 }],
      desc: 'WHEN a face beside this one fires: gain 3 Shield.',
      art: { p: [[-0.66,-0.34, -0.26,-0.34, -0.26,0.34, -0.66,0.34, -0.66,-0.34], [0.26,-0.34, 0.66,-0.34, 0.66,0.34, 0.26,0.34, 0.26,-0.34], [-0.26,0.0, 0.26,0.0], [-0.46,-0.34, -0.46,0.34], [0.46,-0.34, 0.46,0.34], [-0.86,0.0, -0.66,0.0], [0.86,0.0, 0.66,0.0]], e: [[-0.46,0],[0.46,0]] },
    },

    /* ---- trade-offs: he pays in Energy and plating, not blood ---- */
    overdraw: {
      name: 'Overdraw', tier: 2, span: 1, cls: 'technomancer', band: 'high',
      fx: [{ k: 'dmg', v: 15, scale: 'tech' }, { k: 'status', s: 'weak', v: 2, who: 'self' }],
      desc: 'Deal 15 damage. You take 2 Weak. Cuts only into the surge band.',
      art: { p: [[-0.7,0.2, -0.3,-0.4, 0.0,0.1, 0.4,-0.6, 0.7,0.3], [-0.7,0.44, 0.7,0.54], [0.4,-0.6, 0.2,-0.6], [0.4,-0.6, 0.4,-0.38], [-0.86,0.0, -0.7,0.2]], e: [[0.76,0.36]] },
    },
    brownout_notch: {
      name: 'Brownout Notch', tier: 2, span: 1, cls: 'technomancer', band: 'low',
      fx: [{ k: 'energy', v: 3 }, { k: 'draw', v: 1 }],
      desc: 'Gain 3 Energy and draw 1. Cuts only into the sag band — a bad face still pays.',
      art: { p: [[-0.4,-0.6, 0.4,-0.6, 0.3,-0.1, -0.3,-0.1, -0.4,-0.6], [-0.3,-0.1, -0.24,0.2, 0.24,0.2, 0.3,-0.1], [-0.24,0.2, -0.2,0.44, 0.2,0.44, 0.24,0.2], [-0.26,-0.4, 0.26,-0.4], [0.06,0.44, -0.1,0.66, 0.06,0.66, -0.06,0.86], [-0.6,-0.3, -0.44,-0.3], [0.6,-0.3, 0.44,-0.3]], e: [[0,-0.7]] },
    },
    cascade_fault: {
      name: 'Cascade Fault', tier: 3, span: 1, cls: 'technomancer',
      fx: [{ k: 'status', s: 'conduit', v: 3, who: 'self' }, { k: 'status', s: 'weak', v: 1, who: 'self' }],
      desc: 'Gain 3 Conduit. You take 1 Weak.',
      art: { p: [[-0.7,-0.5, -0.3,-0.5, -0.3,-0.1, -0.7,-0.1, -0.7,-0.5], [-0.5,-0.1, -0.5,0.2], [-0.7,0.2, -0.3,0.2, -0.3,0.6, -0.7,0.6, -0.7,0.2], [0.3,-0.5, 0.7,-0.5, 0.7,-0.1, 0.3,-0.1, 0.3,-0.5], [0.5,-0.1, 0.5,0.2], [0.3,0.2, 0.7,0.2, 0.7,0.6, 0.3,0.6, 0.3,0.2], [-0.3,-0.3, 0.3,-0.3], [-0.3,0.4, 0.3,0.4]], e: [[-0.5,-0.3],[0.5,-0.3],[-0.5,0.4],[0.5,0.4]] },
    },
    hive_notch: {
      name: 'Hive Notch', tier: 3, span: 1, cls: 'technomancer',
      fx: [{ k: 'status', s: 'hive', v: 1, who: 'self' }, { k: 'status', s: 'turret', v: 2, who: 'self' }],
      desc: 'Deploy a Turret (2 dmg/turn) and gain 1 Hive.',
      art: { p: [[0,-0.3, 0.26,-0.15, 0.26,0.15, 0,0.3, -0.26,0.15, -0.26,-0.15, 0,-0.3], [-0.6,-0.62, -0.36,-0.48, -0.36,-0.2, -0.6,-0.06, -0.84,-0.2, -0.84,-0.48, -0.6,-0.62], [0.6,-0.62, 0.36,-0.48, 0.36,-0.2, 0.6,-0.06, 0.84,-0.2, 0.84,-0.48, 0.6,-0.62], [-0.36,0.34, -0.36,0.62], [0.36,0.34, 0.36,0.62], [-0.26,-0.15, -0.5,-0.3], [0.26,-0.15, 0.5,-0.3]], e: [[0,0],[-0.6,-0.34],[0.6,-0.34]] },
    },

    /* =================================================================
     * VANGUARD SET — the first class rebuilt for the new die.
     *
     * The old droppable pool was 22 flat, class-agnostic effects ("Gain 2
     * Energy", "Heal 6 HP") that could be cut anywhere and reacted to nothing.
     * These are built to three rules instead:
     *   BAND     most of them live in one region of the table, so an engraving
     *            can be priced for the part of the die it asks you to build on
     *   LISTEN   a second kind of engraving that answers something happening,
     *            which is what lets the die be wired rather than merely filled
     *   COST     a trade-off pays in Aim or HP — the currencies this class
     *            already cares about — so it reads as a decision, not a tax
     * ================================================================= */

    /* ---- standalone: no setup, good on their own ---- */
    /* A tier 1 measuring 16.5 impact a fire, the same as tier 3s, because flat
     * damage on a face is amplified by Might and bands exactly like a card is. */
    bracket_fire: {
      name: 'Bracket Fire', tier: 1, span: 1, cls: 'vanguard',
      fx: [{ k: 'dmg', v: 6, scale: 'might' }],
      desc: 'Deal 6 damage.',
      art: { p: [[-0.8,-0.5, -0.3,-0.5], [-0.8,0.0, -0.24,0.0], [-0.8,0.5, -0.3,0.5], [-0.3,-0.62, 0.0,-0.5, -0.3,-0.38], [-0.24,-0.12, 0.06,0.0, -0.24,0.12], [-0.3,0.38, 0.0,0.5, -0.3,0.62], [0.3,-0.3, 0.6,0.0, 0.3,0.3]], e: [[0.76,0]] },
    },
    spotters_notch: {
      name: "Spotter's Notch", tier: 1, span: 1, cls: 'vanguard', band: 'high',
      fx: [{ k: 'status', s: 'aim', v: 2, who: 'self' }],
      desc: 'Gain 2 Aim.',
      art: { p: [[-0.7,-0.7, -0.7,-0.3], [-0.7,-0.7, -0.3,-0.7], [0.7,-0.7, 0.3,-0.7], [0.7,-0.7, 0.7,-0.3], [-0.7,0.7, -0.7,0.3], [-0.7,0.7, -0.3,0.7], [0.7,0.7, 0.7,0.3], [0.7,0.7, 0.3,0.7], [-0.4,0, 0.4,0], [0,-0.4, 0,0.4]], e: [[0,0]] },
    },
    field_dressing: {
      name: 'Field Dressing', tier: 1, span: 1, cls: 'vanguard', band: 'low',
      fx: [{ k: 'heal', v: 6 }, { k: 'block', v: 12 }],
      desc: 'Heal 6 HP and gain 12 Shield.',
      art: { p: [[-0.28,-0.6, 0.28,-0.6, 0.28,0.5, -0.28,0.5, -0.28,-0.6], [-0.28,-0.36, 0.28,-0.36], [-0.14,-0.1, 0.14,-0.1], [0,-0.24, 0,0.04], [-0.16,-0.6, -0.16,-0.74, 0.16,-0.74, 0.16,-0.6], [-0.5,-0.3, -0.28,-0.3], [0.5,-0.3, 0.28,-0.3]], e: [[0,0.3]] },
    },
    firebase: {
      name: 'Firebase', tier: 2, span: 3, cls: 'vanguard', band: 'mid',
      fx: [{ k: 'block', v: 11 }, { k: 'status', s: 'thorns', v: 3, who: 'self' }],
      desc: 'Gain 11 Shield and 3 Thorns.',
      art: { p: [[-0.8,0.5, 0.8,0.5], [-0.6,0.5, -0.6,0.1, -0.2,0.1, -0.2,0.5], [0.2,0.5, 0.2,0.1, 0.6,0.1, 0.6,0.5], [-0.6,0.3, -0.2,0.3], [0.2,0.3, 0.6,0.3], [-0.4,0.1, -0.4,-0.2], [0.4,0.1, 0.4,-0.2], [-0.5,-0.2, -0.3,-0.44], [0.3,-0.44, 0.5,-0.2]], e: [[-0.4,-0.5],[0.4,-0.5]] },
    },
    brass_catcher: {
      name: 'Brass Catcher', tier: 2, span: 1, cls: 'vanguard',
      fx: [{ k: 'status', s: 'salvo', v: 2, who: 'self' }],
      desc: 'Gain 2 Salvo — every card you burn spits shrapnel.',
      art: { p: [[-0.5,-0.2, 0.5,-0.2, 0.36,0.5, -0.36,0.5, -0.5,-0.2], [-0.44,0.1, 0.44,0.1], [-0.2,-0.5, -0.14,-0.2], [0.2,-0.56, 0.1,-0.2], [-0.44,-0.44, -0.3,-0.2], [-0.24,-0.7, -0.18,-0.56], [0.28,-0.72, 0.22,-0.6]], e: [[-0.26,-0.78],[0.3,-0.8],[-0.5,-0.5]] },
    },

    /* ---- listeners: they answer, they do not act ---- */
    follow_up_notch: {
      name: 'Follow-Up Notch', tier: 2, span: 1, cls: 'vanguard', listen: 'momentum',
      fx: [{ k: 'dmg', v: 3 }],
      desc: 'WHEN you gain Momentum: deal 3 damage.',
      art: { p: [[-0.8,0.3, -0.3,0.3], [-0.3,0.16, 0.0,0.3, -0.3,0.44], [-0.5,-0.1, 0.0,-0.1], [0.0,-0.24, 0.3,-0.1, 0.0,0.04], [-0.2,-0.5, 0.3,-0.5], [0.3,-0.64, 0.6,-0.5, 0.3,-0.36]], e: [[0.76,-0.5]] },
    },
    blood_debt: {
      name: 'Blood Debt', tier: 2, span: 1, cls: 'vanguard', listen: 'selfHp',
      fx: [{ k: 'status', s: 'str', v: 2, who: 'self' }],
      desc: 'WHEN one of your own cards costs you HP: gain 2 Might.',
      art: { p: [[0,-0.6, 0.2,-0.3, 0,0.0, -0.2,-0.3, 0,-0.6], [-0.44,0.16, 0.44,0.16, 0.36,0.6, -0.36,0.6, -0.44,0.16], [-0.4,0.38, 0.4,0.38], [-0.2,0.0, -0.24,0.16], [0.2,0.0, 0.24,0.16]], e: [[-0.2,0.72],[0.2,0.72],[0,0.78]] },
    },
    sympathetic_det: {
      name: 'Sympathetic Det', tier: 2, span: 1, cls: 'vanguard', listen: 'exhaust',
      fx: [{ k: 'dmg', v: 4 }],
      desc: 'WHEN a card is Exhausted: deal 4 damage.',
      art: { p: [[-0.3,-0.34, 0.3,-0.34, 0.3,0.12, -0.3,0.12, -0.3,-0.34], [-0.3,-0.34, -0.4,-0.5, 0.4,-0.5, 0.3,-0.34], [0,-0.5, 0,-0.7], [-0.6,0.34, -0.34,0.16], [0.6,0.34, 0.34,0.16], [-0.5,-0.16, -0.72,-0.24], [0.5,-0.16, 0.72,-0.24]], e: [[0,-0.78],[-0.68,0.42],[0.68,0.42]] },
    },
    riposte_notch: {
      name: 'Riposte Notch', tier: 2, span: 1, cls: 'vanguard', listen: 'parry',
      fx: [{ k: 'dmg', v: 2, scale: 'might' }],
      desc: 'WHEN you gain Parry: deal 2 damage plus your Might.',
      art: { p: [[-0.66,0.6, -0.1,-0.5], [-0.1,-0.5, -0.02,-0.7, 0.06,-0.5], [0.66,0.5, 0.16,-0.44], [-0.34,-0.3, 0.3,-0.24], [-0.44,-0.1, 0.4,-0.04], [-0.4,0.08, -0.56,0.16], [0.4,0.04, 0.56,0.12]], e: [[-0.02,-0.4]] },
    },
    called_shot: {
      name: 'Called Shot', tier: 3, span: 1, cls: 'vanguard', listen: 'crit',
      fx: [{ k: 'dmg', v: 8 }],
      desc: 'WHEN an attack crits: deal 8 damage.',
      art: { p: [[-0.86,-0.7, -0.24,-0.16], [0.86,-0.7, 0.24,-0.16], [-0.86,0.6, -0.24,0.1], [0.86,0.6, 0.24,0.1], [-0.24,-0.16, 0.24,-0.16, 0.24,0.1, -0.24,0.1, -0.24,-0.16], [0,-0.16, 0,-0.4], [0,0.1, 0,0.34]], e: [[0,-0.03]] },
    },

    /* ---- adjacency: they care who is next to them ---- */
    relay_mark: {
      name: 'Relay Mark', tier: 3, span: 1, cls: 'vanguard', field: 'relay',
      fx: [{ k: 'status', s: 'aim', v: 1, who: 'self' }],
      desc: 'Gain 1 Aim. Faces either side of this one fire at FULL instead of half.',
      art: { p: [[-0.7,0, -0.24,0], [0.24,0, 0.7,0], [-0.24,-0.3, 0.24,-0.3, 0.24,0.3, -0.24,0.3, -0.24,-0.3], [-0.7,-0.24, -0.7,0.24], [0.7,-0.24, 0.7,0.24], [-0.5,-0.4, -0.5,0.4], [0.5,-0.4, 0.5,0.4]], e: [[0,0],[-0.7,0],[0.7,0]] },
    },
    /* Paid 1 Energy per neighbour fire, and the bleed fires both neighbours on
     * every roll: energy, more plays, more rolls, more neighbours. Measured
     * 6085 fires across 44 runs and 15.8% of all engraving impact, the single
     * biggest contributor in the game. Chaining should chain, not print fuel. */
    chain_loader: {
      name: 'Chain Loader', tier: 2, span: 1, cls: 'vanguard', listen: 'neighbour',
      fx: [{ k: 'dmg', v: 2 }],
      desc: 'WHEN a face beside this one fires: deal 2 damage.',
      art: { p: [[-0.7,-0.3, -0.2,-0.3, -0.2,0.3, -0.7,0.3, -0.7,-0.3], [0.2,-0.3, 0.7,-0.3, 0.7,0.3, 0.2,0.3, 0.2,-0.3], [-0.2,0, 0.2,0], [-0.45,-0.3, -0.45,0.3], [0.45,-0.3, 0.45,0.3], [-0.7,0, -0.86,0], [0.7,0, 0.86,0]], e: [[-0.45,0],[0.45,0]] },
    },
    twin_sight: {
      name: 'Twin Sight', tier: 3, span: 1, cls: 'vanguard', field: 'opposite',
      fx: [{ k: 'dmg', v: 5, scale: 'might' }],
      desc: 'Deal 5 damage. Also fires the face OPPOSITE this one on the die.',
      art: { p: [[-0.66,0, -0.2,0], [0.2,0, 0.66,0], [-0.2,-0.26, 0.2,-0.26, 0.2,0.26, -0.2,0.26, -0.2,-0.26], [-0.66,-0.4, -0.86,-0.2, -0.66,0], [0.66,0.4, 0.86,0.2, 0.66,0], [-0.4,-0.5, 0.4,-0.5], [-0.4,0.5, 0.4,0.5]], e: [[-0.8,-0.2],[0.8,0.2]] },
    },
    fire_discipline: {
      name: 'Fire Discipline', tier: 3, span: 3, cls: 'vanguard', field: 'listenerEcho',
      fx: [{ k: 'status', s: 'aim', v: 1, who: 'self' }],
      desc: 'Gain 1 Aim. Every listener on the die fires one extra time.',
      art: { p: [[-0.8,-0.5, 0.8,-0.5], [-0.8,0, 0.8,0], [-0.8,0.5, 0.8,0.5], [-0.5,-0.66, -0.5,0.66], [0,-0.66, 0,0.66], [0.5,-0.66, 0.5,0.66]], e: [[-0.5,-0.5],[0.5,-0.5],[-0.5,0],[0.5,0],[-0.5,0.5],[0.5,0.5],[0,0]] },
    },

    /* ---- trade-offs: they cost Aim or blood ---- */
    open_bolt: {
      name: 'Open Bolt', tier: 2, span: 1, cls: 'vanguard', band: 'low',
      fx: [{ k: 'dmg', v: 12, scale: 'might' }, { k: 'hploss', v: 4 }],
      desc: 'Deal 12 damage. Lose 4 HP. Cuts only into the graze band.',
      art: { p: [[-0.7,-0.2, 0.3,-0.2, 0.3,0.16, -0.7,0.16, -0.7,-0.2], [-0.7,-0.02, 0.3,-0.02], [0.3,-0.1, 0.72,-0.1], [0.3,0.06, 0.72,0.06], [-0.4,-0.2, -0.4,-0.44, -0.1,-0.44], [0.5,-0.36, 0.62,-0.5], [0.5,0.3, 0.62,0.44]], e: [[0.8,-0.02],[-0.25,-0.52]] },
    },
    bore_sight: {
      name: 'Bore Sight', tier: 3, span: 1, cls: 'vanguard', band: 'high',
      fx: [{ k: 'status', s: 'aim', v: 4, who: 'self' }, { k: 'hploss', v: 5 }],
      desc: 'Gain 4 Aim. Lose 5 HP.',
      art: { p: [[-0.86,0, 0.86,0], [0,-0.86, 0,0.86], [-0.4,-0.4, 0.4,-0.4, 0.4,0.4, -0.4,0.4, -0.4,-0.4], [-0.16,-0.16, 0.16,-0.16, 0.16,0.16, -0.16,0.16, -0.16,-0.16], [-0.6,-0.6, -0.4,-0.4], [0.6,0.6, 0.4,0.4]], e: [[0,0]] },
    },
    powder_burn: {
      name: 'Powder Burn', tier: 2, span: 1, cls: 'vanguard', band: 'low',
      fx: [{ k: 'status', s: 'str', v: 3, who: 'self' }, { k: 'hploss', v: 3 }],
      desc: 'Gain 3 Might. Lose 3 HP.',
      art: { p: [[0,-0.66, 0.24,-0.24, 0.12,0.0, 0.3,0.3, 0.14,0.6, 0,0.7, -0.14,0.6, -0.3,0.3, -0.12,0.0, -0.24,-0.24, 0,-0.66], [0,-0.2, 0.12,0.08, 0,0.36, -0.12,0.08, 0,-0.2], [-0.5,-0.4, -0.6,-0.06], [0.5,-0.4, 0.6,-0.06]], e: [[0,0.06],[-0.64,0.1],[0.64,0.1]] },
    },
    overpressure: {
      name: 'Overpressure', tier: 3, span: 3, cls: 'vanguard', band: 'high',
      fx: [{ k: 'dmg', v: 12, scale: 'might' }, { k: 'hploss', v: 3 }],
      desc: 'Deal 12 damage. Lose 3 HP. Takes three faces at the top of the table.',
      art: { p: [[-0.5,0.4, -0.5,-0.2, -0.2,-0.5, 0.2,-0.5, 0.5,-0.2, 0.5,0.4, -0.5,0.4], [-0.5,0.1, 0.5,0.1], [-0.24,-0.5, -0.24,0.1], [0.24,-0.5, 0.24,0.1], [0,-0.5, 0,-0.76], [-0.7,-0.3, -0.86,-0.44], [0.7,-0.3, 0.86,-0.44]], e: [[0,-0.82],[-0.25,0.25],[0.25,0.25]] },
    },
    cauterise: {
      name: 'Cauterise', tier: 2, span: 1, cls: 'vanguard', field: 'cauterise',
      fx: [{ k: 'block', v: 13 }],
      desc: 'Gain 13 Shield.',
      art: { p: [[-0.5,0.3, 0.5,0.3], [-0.34,0.3, -0.34,-0.16, 0.34,-0.16, 0.34,0.3], [-0.34,0.06, 0.34,0.06], [0,-0.16, 0,-0.5], [-0.2,-0.4, 0,-0.6, 0.2,-0.4], [-0.6,-0.1, -0.5,-0.3], [0.6,-0.1, 0.5,-0.3]], e: [[0,-0.66]] },
    },
    deadmans_trigger: {
      name: "Deadman's Trigger", tier: 3, span: 1, cls: 'vanguard', onlyFace: 1,
      fx: [{ k: 'dmg', v: 14, scale: 'might' }, { k: 'status', s: 'vuln', v: 2, who: 'target' }],
      desc: 'Deal 14 damage. Apply 2 Vulnerable. Engraved on face 1 only — the jam still kills.',
      art: { p: [[-0.6,-0.4, 0.4,-0.4, 0.4,0.0, -0.6,0.0, -0.6,-0.4], [-0.6,-0.2, 0.4,-0.2], [-0.1,0.0, -0.16,0.4, 0.06,0.44, 0.1,0.0], [-0.15,0.24, 0.08,0.26], [0.4,-0.3, 0.7,-0.3], [-0.4,-0.4, -0.4,-0.6, -0.1,-0.6]], e: [[0.8,-0.3],[-0.25,-0.68]] },
    },

    executioners_mark: {
      name: "Executioner's Mark", tier: 3, span: 1,
      fx: [{ k: 'special', id: 'dieExecute', v: 12 }],
      desc: 'Deal 12 damage to the target — doubled if it is below 30% HP.',
      art: { p: [[-0.5,0.12, -0.55,-0.4, -0.3,-0.72, 0.3,-0.72, 0.55,-0.4, 0.5,0.12, 0.3,0.24, 0.3,0.5, -0.3,0.5, -0.3,0.24, -0.5,0.12]], e: [[-0.24,-0.22], [0.24,-0.22]] },
    },
  };

  /* ---- Flaws: engravings you did NOT choose ---------------------------
   * A Flaw occupies its face, so it also denies you that slot. Because
   * augments fire on the EFFECTIVE roll, a Flaw can be steered around by
   * raising Aim — a curse pressures your build instead of just taxing it.
   * ------------------------------------------------------------------ */
  ns.DIE_FLAWS = {
    hairline_fracture: {
      name: 'Hairline Fracture', flaw: true, tier: 1, span: 1,
      fx: [{ k: 'hploss', v: 2 }],
      desc: 'Lose 2 HP.',
      art: { p: [[-0.5,-0.6, 0.5,-0.6, 0.5,0.6, -0.5,0.6, -0.5,-0.6], [-0.2,-0.6, 0.05,-0.1, -0.15,0.05, 0.15,0.6]] },
    },
    cold_solder: {
      name: 'Cold Solder', flaw: true, tier: 1, span: 1,
      fx: [{ k: 'special', id: 'dieLoseBlock', v: 3 }],
      desc: 'Lose 3 Shield.',
      art: { p: [[0,-0.75, 0.62,-0.42, 0.62,0.18, 0,0.76, -0.62,0.18, -0.62,-0.42, 0,-0.75], [-0.35,-0.25, 0.35,0.3]] },
    },
    warp_etching: {
      name: 'Warp Etching', flaw: true, tier: 2, span: 1,
      fx: [{ k: 'special', id: 'dieEnemyStr', v: 1 }],
      desc: 'A random enemy gains 1 Might.',
      art: { p: [[0,0, 0.2,-0.22, 0.06,-0.48, -0.32,-0.42, -0.48,0, -0.22,0.48, 0.32,0.52, 0.66,0.06, 0.42,-0.52, -0.2,-0.76]] },
    },
  };

  /* ---- THE FIRST MARK --------------------------------------------------
   * The die comes to you blank and nobody says where from. Before the descent
   * you cut one answer into it — an engraving, and the card that answer implies
   * — and that pair is the run's opening statement of intent.
   *
   * Each mark names an archetype the class already has cards for but no reason
   * to commit to on turn one. The engraving is granted PENDING, so you choose
   * the face yourself on the die screen: the mark says what you are playing,
   * you say where on the table you want it to land. `want` is the face band it
   * was tuned for — a hint on the card, never a restriction.
   * ------------------------------------------------------------------- */
  ns.FIRST_MARKS = {
    vanguard: [
      { id: 'the_long_shot', name: 'THE LONG SHOT', eng: 'ranging_mark', card: 'sighting_round',
        want: 'HIGH FACES · 15–20',
        line: 'The top of the table pays more for the same cut. You build where the multiplier already is.' },
      { id: 'the_red_debt', name: 'THE RED DEBT', eng: 'whetstone_mark', card: 'red_ledger',
        want: 'LOW FACES · 2–7',
        line: 'A bad face is still a face. You give the bottom of the die something to do.' },
      { id: 'the_set_shield', name: 'THE SET SHIELD', eng: 'anvil_mark', card: 'set_against_it',
        want: 'MIDDLE FACES · 8–14',
        line: 'The widest band on the table, and Aim lifts every face of it at once.' },
    ],
    technomancer: [
      { id: 'the_standing_line', name: 'THE STANDING LINE', eng: 'assembly_mark', card: 'assembly_line',
        want: 'ANYWHERE · THE MACHINE DOES NOT AIM',
        line: 'Something should be working while you are not. You give it a place to stand.' },
      { id: 'the_closed_circuit', name: 'THE CLOSED CIRCUIT', eng: 'breaker_mark', card: 'surge_routing',
        want: 'ANYWHERE · IT ALL COMES BACK TO THE BUS',
        line: 'Nothing is wasted if the charge has somewhere to go. You give it somewhere.' },
      { id: 'the_damping_field', name: 'THE DAMPING FIELD', eng: 'damping_mark', card: 'null_lattice',
        want: 'MIDDLE FACES · 8–14',
        line: 'You cut it flat across the middle, where a machine lives, and let it hum.' },
    ],
    voidadept: [
      { id: 'the_first_ember', name: 'THE FIRST EMBER', eng: 'ember_mark', card: 'kindling',
        want: 'LOW FACES · 2–7',
        line: 'You cut it low, in the part of the table that is already hungry.' },
      { id: 'the_open_vein', name: 'THE OPEN VEIN', eng: 'vein_mark', card: 'red_thread',
        want: 'EITHER END · 2–7 OR 15–20',
        line: 'The void answers at both ends. You only decide which end it bills.' },
      { id: 'the_long_whisper', name: 'THE LONG WHISPER', eng: 'whisper_mark', card: 'long_whisper',
        want: 'MIDDLE FACES · 8–14',
        line: 'You cut it through the middle, where the void gets bored, and give it a reason.' },
    ],
  };
  ns.firstMarks = function (cls) { return ns.FIRST_MARKS[cls] || []; };

  // Every engraving, chosen or not.
  /* Reforged engravings are made at runtime by the events and stored on the run
   * rather than in this file, so they have to resolve by id like anything else
   * or every rewritten face reads as a blank. */
  ns.dieEngraving = function (id) {
    return ns.DIE_AUGMENTS[id] || ns.DIE_FLAWS[id] || (ns.FORGED && ns.FORGED[id]) || null;
  };

  /* ---- Run-state helpers --------------------------------------------- */
  ns.newDie = function () {
    return { faces: {}, seams: {}, welds: [], core: [], vault: [], frame: [], coreSlots: ns.DIE.coreSlotsStart };
  };

  // Step `d` faces around the ring. The die is a RING everywhere else in this
  // file — dieNeighbours has always wrapped 20 into 1 — and spans used to be
  // the one thing that did not, which is why a band could never be anchored
  // above face 18 and the top of every class table held fewer bands than it
  // looked like it did.
  ns.dieStep = function (face, d, die) {
    var n = ns.dieSides(die);
    return ((face - 1 + d) % n + n) % n + 1;
  };

  /* Which faces an engraving covers when anchored at `face`.
   *
   * CENTRED, not head-anchored. This used to be `face + i`, so tapping 12 with
   * a three-face band silently ate 13 and 14 — you pointed at one face and got
   * two you never pointed at, and the anchor could never be 19 or 20. The
   * anchor is now the MIDDLE of the cut and the span grows both ways, which is
   * what the die already looked like it was doing. Even spans lean high. */
  ns.dieSpan = function (id, face, die) {
    var d = ns.dieEngraving(id); if (!d) return [];
    /* A three-face band is 15% of a d20 and 50% of a d6. That asymmetry is
     * wanted — a wide cut on a small barrel is a real commitment — but it is
     * capped at half the die so a span can never swallow a d6 whole. */
    var s = Math.min(d.span || 1, Math.max(1, Math.floor(ns.dieSides(die) / 2)));
    var lo = -Math.floor((s - 1) / 2), out = [];
    for (var i = 0; i < s; i++) out.push(ns.dieStep(face, lo + i, die));
    return out;
  };

  // Can `id` be engraved at `face`? Returns null if fine, else a reason.
  /* ---- REGIONS ------------------------------------------------------- *
   * The die already had geography — every class table splits it into bands —
   * but nothing could be told to live in one. An engraving with a `band` may
   * only be cut inside its region, which is what lets a card be priced for the
   * part of the table it is asking you to build around: a thing that only ever
   * fires on a graze can afford to be much stronger than one that fires
   * anywhere.
   * ------------------------------------------------------------------- */
  /* ---- TAINTS -------------------------------------------------------- *
   * A Flaw used to be an engraving in its own right: it took a free face, and
   * since a late-run die has ~15 of 20 faces cut, it landed in whatever dead
   * zone was left and cost the player nothing. Exactly backwards — the fuller
   * your die, the more immune you were.
   *
   * A taint instead attaches to an engraving you already have. You keep the
   * effect and carry the cost, and the cost is paid every time that face fires
   * — so it scales with how central the face is to your build rather than
   * with luck. A taint on the listener at the heart of an engine is expensive;
   * the same taint on a face you rarely roll is nearly free.
   *
   * They attack the systems rather than the HP bar, because one taint fires on
   * roughly 1 roll in 20 and "lose 2 HP" at that rate is noise.
   * ------------------------------------------------------------------- */
  ns.DIE_TAINTS = {
    dead_short: { name: 'Dead Short', desc: 'This face no longer bleeds into its neighbours.' },
    silence:    { name: 'Silence',    desc: 'If this is a listener, it answers only once per combat.' },
    rust:       { name: 'Rust',       desc: "This face's effect is halved." },
    feedback:   { name: 'Feedback',   desc: 'When this face fires, a random enemy gains 1 Might.' },
    cold_weld:  { name: 'Cold Weld',  desc: 'Cannot be scrubbed or reseated until you clear the sector.' },
  };

  // A taint rides the ROOT of an engraving, so a three-face band carries one
  // taint rather than three.
  ns.dieTaintAt = function (die, face) {
    if (!die || !die.faces) return null;
    var slot = die.faces[face];
    if (!slot) return null;
    var root = die.faces[slot.root];
    return (root && root.taint) ? root.taint : null;
  };
  ns.dieTaintedRoots = function (die) {
    var out = [], seen = {};
    if (!die || !die.faces) return out;
    for (var f = 1; f <= ns.dieSides(die); f++) {
      var slot = die.faces[f]; if (!slot || seen[slot.root]) continue;
      seen[slot.root] = 1;
      if (die.faces[slot.root] && die.faces[slot.root].taint) out.push(slot.root);
    }
    return out;
  };
  // Every engraved root that could still take one. A face carries at most ONE:
  // stacking them concentrates the damage on a single square and the choice
  // collapses into "obviously grind that one".
  ns.dieCleanRoots = function (die) {
    var out = [], seen = {};
    if (!die || !die.faces) return out;
    for (var f = 1; f <= ns.dieSides(die); f++) {
      var slot = die.faces[f]; if (!slot || seen[slot.root]) continue;
      seen[slot.root] = 1;
      var rootSlot = die.faces[slot.root];
      if (rootSlot && !rootSlot.taint && !(ns.dieEngraving(slot.id) || {}).flaw) out.push(slot.root);
    }
    return out;
  };
  ns.dieAddTaint = function (die, root, tid) {
    if (!die || !die.faces || !die.faces[root] || die.faces[root].taint) return false;
    die.faces[root].taint = tid;
    return true;
  };
  ns.dieStripTaint = function (die, face) {
    var slot = die.faces[face]; if (!slot) return false;
    var root = die.faces[slot.root];
    if (!root || !root.taint) return false;
    if (root.taint === 'cold_weld') return false;
    delete root.taint;
    return true;
  };

  /* ---- REMOVED: THE ARSENAL ------------------------------------------
   * A fourth class that dropped the card layer entirely — three dice, no
   * deck, engravings instead of a draft — plus everything only it used: the
   * opening kits, the sixty-engraving arena pool, the ten-picks-of-three
   * draft, the PROTOCOL loadout and the two base engravings its small
   * barrels opened with.
   *
   * It was a trial and it did not work. The finding that motivated it still
   * stands and is worth keeping: with the die's variance flattened, drafting
   * commons and drafting rares produced identical win rates, so the cards
   * were not carrying the build. But answering that by deleting the cards
   * produced a class that read as a slot machine — 8% win rate against
   * 26-36% for the other three — and the fix that did work was structural
   * instead: only attacks let a face deal damage, and the card's COST buys
   * the chain. Those shipped; this did not.
   * ------------------------------------------------------------------- */
  /* ==================================================================
   * PERMANENTS — what the instability leaves behind
   * ==================================================================
   * At the end of a sector the die cannot hold what you have cut into it. You
   * give back at least half of your engravings and it fuses one of these into
   * the face you choose. It cannot be reforged, scrubbed, reseated or fed to
   * the next instability. It is the one part of the die that is finished.
   *
   * WHY THEY FIRE ON EVERY ROLL, which is the whole of their identity:
   *
   * An ordinary engraving fires on its own face — 5% of rolls on a d20 — plus
   * a quarter-strength bleed off each neighbour, so call it 7.5% of rolls in
   * effect. Halving the die costs a measured 30% of total output, so a single
   * permanent has to be worth two or three ordinary cuts or the ritual is a
   * tax with a souvenir. Scaling one face's NUMBERS to cover that would print
   * a 20-damage face, which reads as a stat stick and does nothing the pool
   * cannot already do.
   *
   * Firing on every roll is the qualitative version of the same power. It is
   * worth roughly 3x an ordinary cut without a single inflated number on it,
   * it is instantly legible ("this one always goes off"), and it is the only
   * thing on the die that does not care what you rolled — which is exactly
   * what "welded into the structure" should mean.
   *
   * They still respect the two rules that keep the die honest: a non-attack
   * cannot make one deal damage, and Double Feed's second round does not fire
   * them twice.
   * ================================================================== */
  function perm(tier, name, fx, desc, art) {
    return { name: name, tier: tier, span: 1, permanent: tier, everyRoll: true,
             fx: fx, desc: desc, art: art };
  }
  var P = ns.DIE_AUGMENTS;

  /* ---- TIER 1: the minimum bid ------------------------------------- */
  /* THE DAMAGE PERMANENTS ARE PRICED LOW ON PURPOSE. A permanent fires on
   * 100% of rolls against an ordinary cut's ~7.5% (its own face, plus a
   * quarter-strength bleed off each neighbour), so it is worth thirteen of
   * them in FREQUENCY before a single number is compared. Printed at 3/6/9
   * they measured x1.29/x1.41/x1.57 total damage and took the die's share of
   * damage from 30% to 45-55% — which is the eclipse this game already fixed
   * once, arriving back through a different door.
   *
   * So the damaging ones are small, and the pool leans on defence, resource
   * and rule-changing instead. A permanent should be felt because it never
   * stops, not because the number on it is large. */
  P.perm_anchor = perm(1, 'Sunk Anchor',
    [{ k: 'dmg', v: 2, scale: 'might' }],
    'PERMANENT. Every roll deals 2 damage, wherever it lands.',
    { p: [[0,-0.8, 0,0.4], [-0.45,0.1, 0,0.4, 0.45,0.1], [-0.3,-0.6, 0.3,-0.6]], e: [[0,0.4]] });
  P.perm_plate = perm(1, 'Standing Plate',
    [{ k: 'block', v: 3, scale: 'pri' }],
    'PERMANENT. Every roll grants 3 Shield, wherever it lands.',
    { p: [[0,-0.75, 0.6,-0.4, 0.6,0.3, 0,0.75, -0.6,0.3, -0.6,-0.4, 0,-0.75], [-0.6,-0.05, 0.6,-0.05]], e: [] });
  /* NOTHING THAT ACCUMULATES. This was 1 Stim a roll and it measured x3.96
   * total damage — four times — because Stim SCALES the Vanguard's damage, so
   * a permanent handing him one every roll is not adding a face, it is
   * compounding the multiplier on every face after it. The same trap Double
   * Feed fell into earlier.
   *
   * At 100% frequency the rule is absolute: a permanent may deal flat damage,
   * grant flat Shield or change a rule. It may never hand out a scaling stat,
   * Energy or a card, because thirty-odd rolls a fight turns any of those into
   * a different game. */
  P.perm_feed = perm(1, 'Feed Line',
    [{ k: 'dmg', v: 1, all: true, scale: 'might' }],
    'PERMANENT. Every roll deals 1 damage to EVERY enemy.',
    { p: [[-0.75,0.2, -0.25,0.2, -0.25,-0.3, 0.25,-0.3, 0.25,0.2, 0.75,0.2], [-0.5,0.45, 0.5,0.45]], e: [[-0.75,0.2],[0.75,0.2]] });

  /* ---- TIER 2: fed beyond the half --------------------------------- */
  P.perm_groove = perm(2, 'Deep Groove',
    [{ k: 'dmg', v: 4, scale: 'might' }],
    'PERMANENT. Every roll deals 4 damage, wherever it lands.',
    { p: [[-0.7,-0.4, 0.7,-0.4], [-0.7,0, 0.7,0], [-0.7,0.4, 0.7,0.4], [-0.35,-0.6, -0.35,0.6], [0.35,-0.6, 0.35,0.6]], e: [] });
  P.perm_bearing = perm(2, 'Load Bearing',
    [{ k: 'status', s: 'bulwark', v: 5, who: 'self' }],
    'PERMANENT. Every roll banks 5 Bulwark, wherever it lands.',
    { p: [[-0.65,0.55, -0.65,-0.2, 0.65,-0.2, 0.65,0.55], [-0.65,0.15, 0.65,0.15], [-0.3,-0.2, -0.3,0.55], [0.3,-0.2, 0.3,0.55], [-0.8,-0.45, 0.8,-0.45]], e: [] });
  P.perm_weld = perm(2, 'Blood Weld',
    [{ k: 'dmg', v: 3, scale: 'might' }, { k: 'heal', v: 1 }],
    'PERMANENT. Every roll deals 3 damage and heals you 1.',
    { p: [[0,0.6, -0.45,0.15, -0.28,-0.3, 0.02,0.05, 0.12,-0.6, 0.4,-0.1, 0.45,0.2, 0,0.6], [-0.7,-0.55, 0.7,-0.55]], e: [[0.12,-0.6]] });

  /* ---- TIER 3: fed most of the die --------------------------------- */
  P.perm_core = perm(3, 'The Fused Core',
    [{ k: 'special', id: 'permOpposite' }],
    'PERMANENT. Every roll also fires the face OPPOSITE the one it landed on, at full.',
    { p: [[0,-0.8, 0.7,-0.4, 0.7,0.4, 0,0.8, -0.7,0.4, -0.7,-0.4, 0,-0.8], [0,-0.45, 0,0.45], [-0.38,-0.22, 0.38,0.22], [0.38,-0.22, -0.38,0.22], [-0.2,0, 0.2,0]], e: [[0,0]] });
  P.perm_reckoning = perm(3, 'Dead Reckoning',
    [{ k: 'dmg', v: 6, scale: 'might' }],
    'PERMANENT. Every roll deals 6 damage, wherever it lands.',
    { p: [[0,-0.85, 0,-0.35], [0,0.85, 0,0.35], [-0.85,0, -0.35,0], [0.85,0, 0.35,0], [-0.35,-0.35, 0.35,-0.35, 0.35,0.35, -0.35,0.35, -0.35,-0.35], [-0.14,-0.14, 0.14,0.14], [0.14,-0.14, -0.14,0.14]], e: [[0,0]] });
  P.perm_ledger = perm(3, 'The Standing Ledger',
    [{ k: 'dmg', v: 3, scale: 'might' }, { k: 'status', s: 'bulwark', v: 5, who: 'self' }],
    'PERMANENT. Every roll deals 3 damage AND banks 5 Bulwark.',
    { p: [[-0.6,-0.7, -0.6,0.7], [0.6,-0.7, 0.6,0.7], [-0.6,0, 0.6,0], [-0.35,-0.45, -0.35,-0.15], [0.35,0.15, 0.35,0.45], [-0.6,-0.7, 0.6,-0.7], [-0.6,0.7, 0.6,0.7]], e: [[-0.6,0],[0.6,0]] });

  // Everything the instability may offer, at the tier the bid earned.
  ns.permanentPool = function (tier) {
    return Object.keys(P).filter(function (k) { return P[k].permanent === tier; });
  };

  ns.DIE_REGION = { low: [2, 7], mid: [8, 14], high: [15, 20] };
  ns.dieRegionOf = function (face) {
    if (face <= 1) return 'misfire';
    for (var k in ns.DIE_REGION) {
      if (face >= ns.DIE_REGION[k][0] && face <= ns.DIE_REGION[k][1]) return k;
    }
    return null;
  };
  ns.dieRegionLabel = function (b) {
    var r = ns.DIE_REGION[b];
    return r ? (b.toUpperCase() + ' ' + r[0] + '-' + r[1]) : (b || '').toUpperCase();
  };

  // Faces either side of a root, for adjacency. The die is a RING: 20 is next
  // to 1, so a chain can close on the seam between the best face and the worst.
  ns.dieNeighbours = function (die, face) {
    var n = ns.dieSides(die), out = [];
    [face - 1, face + 1].forEach(function (f) {
      if (f < 1) f = n; if (f > n) f = 1;
      // a span sits on several faces; its own body is not its neighbour
      var here = die.faces[face], there = die.faces[f];
      if (there && here && there.root === here.root) return;
      out.push(f);
    });
    return out;
  };

  /* ---- SEAMS --------------------------------------------------------- *
   * A face may carry a SECOND engraving. `die.faces` keeps the primary and
   * `die.seams` the passenger, rather than one map of arrays, because of the
   * invariant below: an engraving's ROOT is always a primary. Every reader in
   * the game that walks `die.faces` collecting roots — listeners, taints, the
   * reforge target list, the scrub list — therefore still sees every engraving
   * on the die without knowing seams exist. Only FIRING has to look at both.
   *
   * THE HEAD CANNOT BE SHARED. You may seam onto the body of a band but never
   * onto the face another engraving is anchored at. That is what keeps roots
   * primary, and it reads as a rule rather than as an implementation detail:
   * the head is where the cut begins.
   * ------------------------------------------------------------------- */
  ns.dieSeamAt = function (die, face) {
    return (die && die.seams && die.seams[face]) || null;
  };
  ns.dieSeamId = function (die, face) {
    var s = ns.dieSeamAt(die, face);
    return s ? s.id : null;
  };
  // Every engraving on a face, primary first. One or two entries, or none.
  ns.dieSlotsAt = function (die, face) {
    var out = [];
    if (die && die.faces && die.faces[face]) out.push(die.faces[face]);
    var s = ns.dieSeamAt(die, face);
    if (s) out.push(s);
    return out;
  };
  ns.dieIsRoot = function (die, face) {
    var slot = die && die.faces && die.faces[face];
    return !!(slot && slot.root === face);
  };
  // How much a single engraving on `face` fires for. A shared face pays for
  // itself: BOTH occupants come out reduced, not just the newcomer.
  ns.dieSeamMult = function (die, face) {
    return ns.dieSeamAt(die, face) ? (ns.BALANCE.dice.seam || 0.6) : 1;
  };

  /* What placing `id` at `face` would do — the whole answer in one object, so
   * the preview and the commit cannot disagree about it. `why` is non-null if
   * it is illegal; `seam` is the one face that would be shared. */
  ns.diePlacement = function (die, id, face) {
    var d = ns.dieEngraving(id);
    var out = { id: id, face: face, span: [], seam: null, seamWith: null, why: null, def: d };
    if (!d) { out.why = 'unknown engraving'; return out; }
    if (d.onlyFace && d.onlyFace !== face) { out.why = 'only fits face ' + d.onlyFace; return out; }
    var span = out.span = ns.dieSpan(id, face, die);
    if (span.length < (d.span || 1)) { out.why = 'does not fit'; return out; }
    if (d.band) {
      for (var s = 0; s < span.length; s++) {
        if (ns.dieRegionOf(span[s]) !== d.band) { out.why = 'only cuts into ' + ns.dieRegionLabel(d.band); return out; }
      }
    }
    /* A second copy of a DOER is fine — it just covers more of the table. A
     * second copy of a listener or a field is a flat multiplier on a trigger
     * that already fires from anywhere, and nothing else about the die changes
     * to pay for it: two Called Shots simply doubled every crit. */
    if (d.listen || d.field) {
      for (var q = 1; q <= ns.dieSides(die); q++) {
        if (ns.dieFaceId(die, q) === id || ns.dieSeamId(die, q) === id) {
          out.why = (d.listen ? 'that listener' : 'that field') + ' is already on the die';
          return out;
        }
      }
    }
    for (var i = 0; i < span.length; i++) {
      var f = span[i], occ = die.faces[f];
      if (!occ) continue;
      // A flaw is cut into the die BY the void, not placed by the player, and
      // it has no business buying a face at a discount.
      if (d.flaw) { out.why = 'face ' + f + ' is taken'; return out; }
      /* A BASIC ENGRAVING IS OVERWRITTEN, NOT SHARED. The Arsenal's small
       * barrels arrive with the base cards cut into every face, which under
       * the old rule made them permanently full — every face was the head of
       * something, so nothing could ever be placed and the two dice you lean
       * on could never improve. Basics are the floor you build over: cutting
       * on top of one REPLACES it outright rather than doubling with it. */
      if (occ.root === f && (ns.dieEngraving(occ.id) || {}).basic && !d.basic) { out.replaces = true; continue; }
      if (occ.root === f) { out.why = 'face ' + f + ' is the head of ' + (ns.dieEngraving(occ.id) || {}).name; return out; }
      if ((ns.dieEngraving(occ.id) || {}).basic) { out.replaces = true; continue; }
      if (ns.dieSeamAt(die, f)) { out.why = 'face ' + f + ' is already doubled'; return out; }
      if (out.seam != null) { out.why = 'that would double two faces — slide it'; return out; }
      out.seam = f;
      out.seamWith = occ.id;
    }
    return out;
  };

  ns.dieCanEngrave = function (die, id, face) {
    return ns.diePlacement(die, id, face).why;
  };

  ns.dieEngrave = function (die, id, face) {
    var p = ns.diePlacement(die, id, face);
    if (p.why) return p.why;
    if (!die.seams) die.seams = {};
    p.span.forEach(function (f) {
      var occ = die.faces[f];
      // the incumbent yields the face to the newcomer and rides along as the
      // passenger — it can never be a root, so nothing else has to be repointed.
      // A BASIC is not a passenger: it is simply gone, replaced by the cut.
      if (occ && !(ns.dieEngraving(occ.id) || {}).basic) die.seams[f] = occ;
      die.faces[f] = { id: id, root: face };
    });
    return null;
  };

  // Lift an engraving off the die, seams and welds included, and promote any
  // passenger it was carrying back to primary.
  ns.dieScrub = function (die, face) {
    var slot = die.faces[face]; if (!slot) return false;
    var root = slot.root;
    if (!die.seams) die.seams = {};
    Object.keys(die.faces).forEach(function (f) {
      if (die.faces[f].root !== root) return;
      delete die.faces[f];
      if (die.seams[f]) { die.faces[f] = die.seams[f]; delete die.seams[f]; }
    });
    Object.keys(die.seams).forEach(function (f) { if (die.seams[f].root === root) delete die.seams[f]; });
    ns.dieWeldPrune(die);
    return true;
  };

  /* ---- WELDS --------------------------------------------------------- *
   * A boundary between two DIFFERENT engravings, paid for at the bench, where
   * the bleed runs at full instead of a quarter. Adjacency already does
   * something on its own; this is the player choosing WHICH adjacency matters.
   * ------------------------------------------------------------------- */
  ns.dieWeldKey = function (a, b) { return (a < b ? a + '|' + b : b + '|' + a); };
  ns.dieWelds = function (die) { return (die && die.welds) || []; };
  ns.dieWelded = function (die, a, b) {
    return ns.dieWelds(die).indexOf(ns.dieWeldKey(a, b)) >= 0;
  };
  ns.dieCanWeld = function (die, a, b) {
    if (ns.dieStep(a, 1, die) !== b && ns.dieStep(b, 1, die) !== a) return 'those faces do not touch';
    var sa = die.faces[a], sb = die.faces[b];
    if (!sa || !sb) return 'both faces must be cut';
    if (sa.root === sb.root) return 'that is one engraving, not two';
    if (ns.dieWelded(die, a, b)) return 'that seam is already welded';
    if (ns.dieWelds(die).length >= (ns.BALANCE.dice.weldCap || 3)) return 'the die will hold no more welds';
    return null;
  };
  ns.dieWeld = function (die, a, b) {
    var why = ns.dieCanWeld(die, a, b);
    if (why) return why;
    die.welds = ns.dieWelds(die).concat([ns.dieWeldKey(a, b)]);
    return null;
  };
  // A weld across a boundary that stopped being one — either face scrubbed, or
  // both sides now the same engraving — is dropped rather than left dangling.
  ns.dieWeldPrune = function (die) {
    if (!die || !die.welds || !die.welds.length) return 0;
    var before = die.welds.length;
    die.welds = die.welds.filter(function (k) {
      var p = k.split('|'), a = +p[0], b = +p[1];
      var sa = die.faces[a], sb = die.faces[b];
      return !!(sa && sb && sa.root !== sb.root);
    });
    return before - die.welds.length;
  };

  // The engraving that fires for an effective roll (null if the face is bare).
  ns.dieFaceAt = function (die, face) {
    if (!die || !die.faces) return null;
    var slot = die.faces[face];
    return slot ? ns.dieEngraving(slot.id) : null;
  };
  ns.dieFaceId = function (die, face) {
    if (!die || !die.faces) return null;
    var slot = die.faces[face];
    return slot ? slot.id : null;
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
