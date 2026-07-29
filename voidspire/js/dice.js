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
    overcharge_cell: {
      name: 'Overcharge Cell', tier: 1, span: 1,
      fx: [{ k: 'energy', v: 2 }],
      desc: 'Gain 2 Energy.',
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
      fx: [{ k: 'heal', v: 6 }],
      desc: 'Heal 6 HP.',
      art: { p: [[-0.2,-0.7, 0.2,-0.7, 0.2,-0.2, 0.7,-0.2, 0.7,0.2, 0.2,0.2, 0.2,0.7, -0.2,0.7, -0.2,0.2, -0.7,0.2, -0.7,-0.2, -0.2,-0.2, -0.2,-0.7]] },
    },
    kinetic_buffer: {
      name: 'Kinetic Buffer', tier: 1, span: 1,
      fx: [{ k: 'block', v: 9 }],
      desc: 'Gain 9 Shield.',
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
      fx: [{ k: 'dmg', v: 8, random: true }],
      desc: 'Deal 8 damage to a random enemy.',
      art: { p: [[0.2,-0.86, -0.34,-0.04, 0.06,-0.04, -0.24,0.86, 0.42,-0.08, 0.02,-0.08, 0.36,-0.86, 0.2,-0.86]] },
    },
    scavenger_port: {
      name: 'Scavenger Port', tier: 1, span: 1,
      fx: [{ k: 'special', id: 'dieCredits', v: 12 }],
      desc: 'Gain 12 credits.',
      art: { p: [[-0.6,-0.34, 0.6,-0.34, 0.6,0.5, -0.6,0.5, -0.6,-0.34], [-0.26,-0.34, -0.26,-0.6, 0.26,-0.6, 0.26,-0.34], [-0.2,0.08, 0.2,0.08]] },
    },
    // -- band augments: wider, so cheaper per trigger --
    scrap_sifter: {
      name: 'Scrap Sifter', tier: 1, span: 3,
      fx: [{ k: 'block', v: 4 }],
      desc: 'Gain 4 Shield.',
      art: { p: [[0,-0.7, 0.58,-0.4, 0.58,0.18, 0,0.72, -0.58,0.18, -0.58,-0.4, 0,-0.7], [-0.3,0, 0.3,0]] },
    },
    pressure_valve: {
      name: 'Pressure Valve', tier: 2, span: 3,
      fx: [{ k: 'heal', v: 1 }, { k: 'block', v: 2 }],
      desc: 'Heal 1 HP and gain 2 Shield.',
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
      fx: [{ k: 'block', v: 14 }],
      desc: 'Gain 14 Shield. Engraved on face 1 only — the breaker trips into the plating.',
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
    whetstone_mark: {
      name: 'Whetstone Mark', tier: 2, span: 3, startOnly: true, cls: 'vanguard',
      fx: [{ k: 'dmg', v: 3, scale: 'might' }, { k: 'status', s: 'str', v: 3, who: 'self' }],
      desc: 'Deal 3 damage. Gain 3 Might.',
      art: { p: [[-0.7,0.3, 0.5,-0.5, 0.7,-0.2, -0.5,0.6, -0.7,0.3], [-0.2,0.02, 0.1,-0.2], [0.2,-0.62, 0.34,-0.8]] },
    },
    anvil_mark: {
      name: 'Anvil Mark', tier: 2, span: 3, startOnly: true, cls: 'vanguard',
      fx: [{ k: 'block', v: 5 }, { k: 'status', s: 'thorns', v: 1, who: 'self' }],
      desc: 'Gain 5 Shield, 1 Thorns.',
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
    haemal_tap: {
      name: 'Haemal Tap', tier: 2, span: 3,
      fx: [{ k: 'hploss', v: 2 }, { k: 'draw', v: 1 }, { k: 'energy', v: 1 }],
      desc: 'Lose 2 HP. Draw 1 card. Gain 1 Energy.',
      art: { p: [[0,-0.8, 0.34,-0.2, 0.22,0.4, -0.22,0.4, -0.34,-0.2, 0,-0.8], [-0.22,0.4, -0.3,0.75], [0.22,0.4, 0.3,0.75], [0,0.4, 0,0.8]] },
    },
    plate_layer: {
      name: 'Plate Layer', tier: 2, span: 3,
      fx: [{ k: 'status', s: 'plate', v: 2, who: 'self' }],
      desc: 'Gain 2 Plating.',
      art: { p: [[-0.7,-0.4, 0.7,-0.4], [-0.7,-0.05, 0.7,-0.05], [-0.7,0.3, 0.7,0.3], [-0.4,-0.4, -0.4,0.3], [0,-0.4, 0,0.3], [0.4,-0.4, 0.4,0.3], [-0.7,0.3, -0.7,0.6, 0.7,0.6, 0.7,0.3]] },
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
    bracket_fire: {
      name: 'Bracket Fire', tier: 1, span: 1, cls: 'vanguard',
      fx: [{ k: 'dmg', v: 9, scale: 'might' }],
      desc: 'Deal 9 damage.',
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
      fx: [{ k: 'heal', v: 4 }, { k: 'block', v: 5 }],
      desc: 'Heal 4 HP. Gain 5 Shield.',
      art: { p: [[-0.28,-0.6, 0.28,-0.6, 0.28,0.5, -0.28,0.5, -0.28,-0.6], [-0.28,-0.36, 0.28,-0.36], [-0.14,-0.1, 0.14,-0.1], [0,-0.24, 0,0.04], [-0.16,-0.6, -0.16,-0.74, 0.16,-0.74, 0.16,-0.6], [-0.5,-0.3, -0.28,-0.3], [0.5,-0.3, 0.28,-0.3]], e: [[0,0.3]] },
    },
    firebase: {
      name: 'Firebase', tier: 2, span: 3, cls: 'vanguard', band: 'mid',
      fx: [{ k: 'block', v: 5 }, { k: 'status', s: 'thorns', v: 2, who: 'self' }],
      desc: 'Gain 5 Shield, 2 Thorns.',
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
    chain_loader: {
      name: 'Chain Loader', tier: 2, span: 1, cls: 'vanguard', listen: 'neighbour',
      fx: [{ k: 'energy', v: 1 }],
      desc: 'WHEN a face beside this one fires: gain 1 Energy.',
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
      fx: [{ k: 'dmg', v: 16, scale: 'might' }, { k: 'hploss', v: 4 }],
      desc: 'Deal 16 damage. Lose 4 HP. Cuts only into the graze band.',
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
      fx: [{ k: 'block', v: 6 }],
      desc: 'Gain 6 Shield. Your own cards can no longer cost you HP — they cost 1 Aim instead.',
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
        line: 'You cut it near the top of the table, where the shot is already going.' },
      { id: 'the_red_debt', name: 'THE RED DEBT', eng: 'whetstone_mark', card: 'red_ledger',
        want: 'LOW FACES · 2–7',
        line: 'A bad face is still a face. You give the bottom of the die something to do.' },
      { id: 'the_set_shield', name: 'THE SET SHIELD', eng: 'anvil_mark', card: 'set_against_it',
        want: 'MIDDLE FACES · 8–14',
        line: 'You cut it where the die spends most of its time, and stop trying to steer.' },
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
  ns.dieEngraving = function (id) { return ns.DIE_AUGMENTS[id] || ns.DIE_FLAWS[id] || null; };

  /* ---- Run-state helpers --------------------------------------------- */
  ns.newDie = function () {
    return { faces: {}, core: [], vault: [], frame: [], coreSlots: ns.DIE.coreSlotsStart };
  };

  // Which faces an engraving covers when installed at `face`.
  ns.dieSpan = function (id, face) {
    var d = ns.dieEngraving(id); if (!d) return [];
    var out = [];
    for (var i = 0; i < (d.span || 1); i++) {
      var f = face + i;
      if (f >= 1 && f <= ns.DIE.faces) out.push(f);
    }
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
    for (var f = 1; f <= ns.DIE.faces; f++) {
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
    for (var f = 1; f <= ns.DIE.faces; f++) {
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
    var n = ns.DIE.faces, out = [];
    [face - 1, face + 1].forEach(function (f) {
      if (f < 1) f = n; if (f > n) f = 1;
      // a span sits on several faces; its own body is not its neighbour
      var here = die.faces[face], there = die.faces[f];
      if (there && here && there.root === here.root) return;
      out.push(f);
    });
    return out;
  };

  ns.dieCanEngrave = function (die, id, face) {
    var d = ns.dieEngraving(id);
    if (!d) return 'unknown engraving';
    if (d.onlyFace && d.onlyFace !== face) return 'only fits face ' + d.onlyFace;
    var span = ns.dieSpan(id, face);
    if (span.length < (d.span || 1)) return 'does not fit past face ' + ns.DIE.faces;
    if (d.band) {
      for (var s = 0; s < span.length; s++) {
        if (ns.dieRegionOf(span[s]) !== d.band) return 'only cuts into ' + ns.dieRegionLabel(d.band);
      }
    }
    /* A second copy of a DOER is fine — it just covers more of the table. A
     * second copy of a listener or a field is a flat multiplier on a trigger
     * that already fires from anywhere, and nothing else about the die changes
     * to pay for it: two Called Shots simply doubled every crit. */
    if (d.listen || d.field) {
      for (var q = 1; q <= ns.DIE.faces; q++) {
        if (die.faces[q] && die.faces[q].id === id) {
          return (d.listen ? 'that listener' : 'that field') + ' is already on the die';
        }
      }
    }
    for (var i = 0; i < span.length; i++) if (die.faces[span[i]]) return 'face ' + span[i] + ' is taken';
    return null;
  };

  ns.dieEngrave = function (die, id, face) {
    var why = ns.dieCanEngrave(die, id, face);
    if (why) return why;
    ns.dieSpan(id, face).forEach(function (f) { die.faces[f] = { id: id, root: face }; });
    return null;
  };

  ns.dieScrub = function (die, face) {
    var slot = die.faces[face]; if (!slot) return false;
    var root = slot.root;
    Object.keys(die.faces).forEach(function (f) { if (die.faces[f].root === root) delete die.faces[f]; });
    return true;
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
