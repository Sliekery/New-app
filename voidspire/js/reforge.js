/* =========================================================================
 * VOIDSPIRE — reforge.js
 * THE REFORGE: an engraving, rewritten into one of three shapes at the same
 * budget. This is what the new events trade in.
 *
 * Nothing here is hand-authored per engraving. 87 engravings x 4 tables x 3
 * lenses is 1044 variants — authoring those means balancing them one by one and
 * getting it wrong 1044 times. Instead every effect is priced in a single
 * currency, and the lenses are arithmetic on that price.
 *
 * THE UNIT IS SHIELD. One point of Shield is 1 SP, and every rate below was
 * solved against what the existing engravings ACTUALLY pay at each tier, not
 * invented. The tier-2 point engraving is the anchor because 49 of the 87 sit
 * there: its average is 10 Shield, 16.3 damage, 2 Energy, 1 Reactor — so damage
 * prices at 0.6, Energy at 5, Reactor at a whole engraving on its own.
 * ========================================================================= */
(function (ns) {
  'use strict';

  /* ---- the price list -------------------------------------------------- */
  var SP_FLAT = {
    block: 1.0,     // the anchor
    dmg: 0.6,       // t2 avg 16.3 dmg ~= 10 SP
    heal: 1.6,      // t2 heal 6 ~= 9.6 SP
    draw: 4.5,      // see NOTE below
    energy: 5.0,    // t2 energy 2 = 10 SP
    hploss: -1.3,   // a COST: it hands budget back
  };
  /* NOTE ON DRAW. The source data contradicts itself — tier 1 prices 2 Draw
   * inside a 7 SP budget (3.5 each) while tier 2 prices 1 Draw inside 10 SP
   * (10 each). 4.5 splits it. Draw is the one currency the formula cannot be
   * trusted on and it wants a hand pass if it ever looks silly in play. */

  var SP_STATUS = {
    burn: 1.4,       // t1 burn 6 ~= 8.4 SP
    vuln: 3.5,       // t1 vuln 2.5 ~= 8.8 SP
    weak: 5.0,       // t1 weak 1.5 ~= 7.5 SP
    thorns: 3.5, momentum: 3.5, psiPow: 3.5, turret: 3.5, salvo: 3.5,
    str: 4.0, aim: 4.0,
    conduit: 4.0, hive: 4.0, wildfire: 4.0, entropy: 4.0, bloodPact: 4.0,
    plate: 5.0,
    reactor: 10.0,   // +1 max Energy is a whole engraving and always was
  };
  var SP_SPECIAL = { dieCredits: 0.5, dieExecute: 5.0, dieExhaustDraw: 5.0 };

  ns.REFORGE_RATES = { flat: SP_FLAT, status: SP_STATUS, special: SP_SPECIAL };

  // What a whole engraving is allowed to be worth, by tier.
  ns.TIER_BUDGET = { 1: 7, 2: 10, 3: 14 };
  // A 3-face band fires roughly three times as often, so it is priced down —
  // 0.55 is what the existing bands actually sit at (t2 band block 4.3 vs
  // point 10). A listener is priced down harder still, for the same reason.
  ns.SPAN_MULT = 0.55;
  ns.LISTEN_MULT = 0.25;
  // A rider in your class's own currency costs 30% less. This is not flavour:
  // it is what makes a class table mechanically worth having over the common
  // one, and without it the numbers do not even fit — Plating at a full 5 SP
  // will not go into a 3.5 SP temper slot.
  ns.NATIVE_DISCOUNT = 0.7;

  function spOf(f) {
    if (!f) return 0;
    if (f.k === 'status') return (SP_STATUS[f.s] || 3.5) * (f.v || 0);
    if (f.k === 'special') return (SP_SPECIAL[f.id] || 3) * (f.v || 0);
    return (SP_FLAT[f.k] || 1) * (f.v || 0);
  }
  ns.reforgeSpOf = spOf;

  // What an engraving is worth all-in, riders and costs included.
  ns.engravingSp = function (def) {
    if (!def || !def.fx) return 0;
    return def.fx.reduce(function (a, f) { return a + spOf(f); }, 0);
  };

  /* ---- the four tables --------------------------------------------------
   * The lens SHAPE is universal; what each lens converts INTO comes from the
   * die's own column. The three classes barely share a vocabulary — Vanguard
   * is damage and Aim and blood, Technomancer is Shield and Energy and
   * constructs, the Void Adept is Burn and Psi and rot — so a reforge that
   * offered all of them the same three options would be offering two of them
   * somebody else's build.
   *
   * The table belongs to the DIE, not to the engraving. 65 of the 87 are class
   * locked and only ever sit on their own class's die anyway, so this really
   * only decides where the 22 neutral ones go — and it decides them right.
   * ------------------------------------------------------------------- */
  ns.REFORGE_TABLES = {
    common: {
      name: 'THE COMMON TABLE',
      native: [],                       // no discount: this is what you get for building nothing in particular
      lenses: [
        { id: 'split',     name: 'DIVIDED CUT',  keep: 0.50, into: 'opposite' },
        { id: 'temper',    name: 'TEMPERED CUT', keep: 0.65, rider: { k: 'status', s: 'thorns', who: 'self' } },
        { id: 'transmute', name: 'SOURED CUT',   keep: 0.60, rider: { k: 'status', s: 'burn', who: 'enemy' } },
      ],
    },
    vanguard: {
      name: 'THE WHETSTONE',
      native: ['dmg', 'aim', 'str', 'thorns', 'hploss'],
      lenses: [
        { id: 'split',  name: 'THE SECOND BARREL', keep: 0.50, into: 'dmg' },
        { id: 'temper', name: 'THE SIGHTED CUT',   keep: 0.65, rider: { k: 'status', s: 'aim', who: 'self' } },
        /* THE BLOOD PRICE inverts the whole mechanic, and it should. Vanguard
         * carries 4 of the game's hploss engravings and an identity built on
         * paying in blood — so its third lens does not trade power away for a
         * rider, it BUYS power by taking a cost. */
        { id: 'blood',  name: 'THE BLOOD PRICE',   keep: 1.40, cost: { k: 'hploss', v: 3 } },
      ],
    },
    technomancer: {
      name: 'THE BENCH',
      native: ['block', 'energy', 'draw', 'plate', 'reactor', 'turret'],
      lenses: [
        { id: 'split',  name: 'THE PARALLEL RUN', keep: 0.50, into: 'block', altInto: 'energy' },
        { id: 'temper', name: 'THE HEAT SINK',    keep: 0.65, rider: { k: 'status', s: 'plate', who: 'self' } },
        /* THE FEEDER trades MAGNITUDE for FREQUENCY, and the arithmetic runs
         * the opposite way to how it first looks. A point engraving fires on
         * one roll in twenty. A listener fires whenever its trigger happens,
         * which can be several times a turn — which is exactly why the existing
         * listeners are priced at a quarter of a point engraving. So converting
         * a point into a listener has to SHED value, not gain it: the win is
         * throughput. 0.35 rather than a flat 0.25, as a small premium for
         * having to commit to one trigger. */
        { id: 'feeder', name: 'THE FEEDER',       keep: 0.35, makeListener: true },
      ],
    },
    voidadept: {
      name: 'THE SCOURING',
      native: ['burn', 'psiPow', 'vuln', 'hploss', 'dmg'],
      lenses: [
        { id: 'split',  name: 'THE SPLIT TONGUE', keep: 0.50, into: { k: 'status', s: 'burn', who: 'enemy' } },
        { id: 'temper', name: 'THE DEEP FOCUS',   keep: 0.65, rider: { k: 'status', s: 'psiPow', who: 'self' } },
        /* Decay spreads. The rider goes wide instead of deep. */
        { id: 'wither', name: 'THE WITHERING',    keep: 0.60, rider: { k: 'status', s: 'burn', who: 'enemy' }, all: true },
      ],
    },
  };

  ns.reforgeTableFor = function (cls) { return ns.REFORGE_TABLES[cls] || ns.REFORGE_TABLES.common; };

  /* ---- when there is nothing to shave ----------------------------------
   * A quarter of the pool is a single indivisible stack — "apply 1 Aim",
   * "apply 1 Reactor". You cannot halve one stack, so all three lenses hand
   * back the engraving unchanged and the player is offered the same thing
   * three times. Measured: 142 of 1044 generated options collided this way.
   *
   * So these get their own lenses, built on the opposite principle. Rather than
   * shaving the primary to pay for a rider, they BUY the budget — with blood,
   * which the game already prices, or by throwing the engraving away and
   * cutting again.
   * ------------------------------------------------------------------- */
  ns.INDIVISIBLE_LENSES = [
    { id: 'recast',   name: 'THE RECAST',   recast: true },
    { id: 'overdraw', name: 'THE OVERDRAW', mult: 2, costHp: true },
    { id: 'graft',    name: 'THE GRAFT',    addNative: true, costHp: true },
  ];
  // Indivisible when the primary is one stack of something chunky: halving it
  // would round straight back up to itself.
  function indivisible(fx, pi) {
    var p = fx[pi];
    if (!p) return true;
    // Too poor to buy anything. Listeners and 3-face bands are priced low on
    // purpose, and a 1.8 SP engraving cannot fund even the cheapest rider out
    // of a 50% shave — so shaving it just hands back what you already had.
    var total = fx.reduce(function (a, f) { return a + spOf(f); }, 0);
    if (total < 3.2) return true;
    if (p.v > 2) return false;
    var unit = Math.abs(spOf(p) / (p.v || 1));
    return p.v <= 1 || unit >= 3.5;
  }

  /* ---- reading an engraving ------------------------------------------- */
  // The primary is the single most expensive thing the engraving does. Riders
  // and costs orbit it; the lenses all act on it.
  function primaryIdx(fx) {
    var best = -1, bestSp = 0;
    for (var i = 0; i < fx.length; i++) {
      var s = spOf(fx[i]);
      if (s > bestSp) { bestSp = s; best = i; }
    }
    return best;
  }
  function isDefensive(f) {
    if (f.k === 'block' || f.k === 'heal') return true;
    if (f.k === 'status' && f.who === 'self') return true;
    return false;
  }
  function listenTriggers() { return ['burn', 'debuff', 'shield', 'crit', 'selfHp', 'psi']; }
  ns.REFORGE_TRIGGERS = {
    burn:   'WHEN you apply Burn',
    debuff: 'WHEN you apply Weak or Vulnerable',
    shield: 'WHEN you gain Shield',
    crit:   'WHEN you land a critical hit',
    selfHp: 'WHEN one of your own cards costs you HP',
    psi:    'WHEN you gain Psi Focus',
  };

  /* ---- describing an fx list in the game's own words ------------------- */
  var STATUS_NAME = {
    burn: 'Burn', vuln: 'Vulnerable', weak: 'Weak', thorns: 'Thorns', str: 'Might',
    aim: 'Aim', plate: 'Plating', reactor: 'Reactor', psiPow: 'Psi Focus',
    momentum: 'Momentum', turret: 'Turret', salvo: 'Salvo', conduit: 'Conduit',
    hive: 'Hive', wildfire: 'Wildfire', entropy: 'Entropy', bloodPact: 'Blood Pact',
  };
  ns.reforgeDescribe = function (fx, opt) {
    opt = opt || {};
    var bits = [];
    fx.forEach(function (f) {
      if (!f.v) return;
      if (f.k === 'block') bits.push('gain ' + f.v + ' Shield');
      else if (f.k === 'dmg') bits.push('deal ' + f.v + ' damage');
      else if (f.k === 'heal') bits.push('heal ' + f.v + ' HP');
      else if (f.k === 'draw') bits.push('draw ' + f.v + ' card' + (f.v > 1 ? 's' : ''));
      else if (f.k === 'energy') bits.push('gain ' + f.v + ' Energy');
      else if (f.k === 'hploss') bits.push('lose ' + f.v + ' HP');
      else if (f.k === 'special') bits.push(f.id === 'dieCredits' ? 'gain ' + f.v + ' credits' : 'a special effect');
      else if (f.k === 'status') {
        var nm = STATUS_NAME[f.s] || f.s;
        var whom = f.who === 'self' ? '' : (f.all ? ' to ALL enemies' : '');
        bits.push('apply ' + f.v + ' ' + nm + whom);
      }
    });
    if (!bits.length) return 'Nothing at all.';
    var s = bits.join(', ');
    s = s.charAt(0).toUpperCase() + s.slice(1) + '.';
    return opt.trigger ? (ns.REFORGE_TRIGGERS[opt.trigger] + ': ' + s.charAt(0).toLowerCase() + s.slice(1)) : s;
  };

  /* ---- the generator --------------------------------------------------- */
  function riderCost(table, rider) {
    var base = rider.k === 'status' ? (SP_STATUS[rider.s] || 3.5) : Math.abs(SP_FLAT[rider.k] || 1);
    var key = rider.k === 'status' ? rider.s : rider.k;
    return table.native.indexOf(key) >= 0 ? base * ns.NATIVE_DISCOUNT : base;
  }

  // capped: an Overdraw that asks for 8 HP is not a choice, it is a trap
  /* FLOOR, not round. Rounding the blood price up means the player overpays on
   * roughly half of these and the option comes out worth less than what they
   * started with — which is the one thing a reforge must never do. Capped at 6:
   * an Overdraw that asks for a third of your health is not a choice, it is a
   * trap. */
  function hpFor(sp) { return Math.min(6, Math.floor(Math.abs(sp) / 1.3)); }

  function indivisibleOptions(def, table, baseSp) {
    var out = [];
    var pi = primaryIdx(def.fx), prim = def.fx[pi];

    /* An engraving can be a bare `special` with no numeric value at all, where
     * the effect IS the whole of it and there is no magnitude to double or
     * split. Every lens below multiplies prim.v, so they have nothing to offer
     * here; the recast still applies. The pool has none right now — they were
     * all Arsenal wall cash-outs — but the path is tested, because the next
     * one written this way will hit it with no warning. */
    if (!prim || prim.v == null) {
      out.push({
        lens: 'recast', name: 'THE RECAST', from: def.name, recast: true,
        fx: null, span: def.span || 1, tier: def.tier || 1, cls: def.cls || null,
        desc: 'Scrapped, and cut again — a different engraving of the same tier, at random.',
        note: 'There is no number in this one to bargain with.', sp: baseSp,
      });
      return out;
    }

    // 1. throw it away and cut again — the engine rolls the replacement
    out.push({
      lens: 'recast', name: 'THE RECAST', from: def.name, recast: true,
      fx: null, span: def.span || 1, tier: def.tier || 1, cls: def.cls || null,
      desc: 'Scrapped, and cut again — a different engraving of the same tier, at random.',
      note: 'You will not see it until it is done.', sp: baseSp,
    });

    // 2. twice the effect, paid for in blood
    var fx2 = JSON.parse(JSON.stringify(def.fx));
    var added = spOf(prim);
    fx2[pi].v = prim.v * 2;
    var hp2 = hpFor(added);
    if (hp2 > 0) fx2.push({ k: 'hploss', v: hp2 });
    out.push({
      lens: 'overdraw', name: 'THE OVERDRAW', from: def.name, fx: fx2,
      span: def.span || 1, tier: def.tier || 1, cls: def.cls || null, band: def.band || null,
      desc: ns.reforgeDescribe(fx2), note: '', sp: Math.round(ns.engravingSp({ fx: fx2 }) * 10) / 10,
    });

    // 3. graft this table's own rider on, also paid in blood
    var temper = table.lenses.filter(function (l) { return l.rider; })[0];
    var rider = (temper && temper.rider) || { k: 'status', s: 'thorns', who: 'self' };
    if (prim.k === 'status' && rider.s === prim.s) {
      var alt = table.lenses.filter(function (l) { return l.rider && l.rider.s !== prim.s; })[0];
      rider = (alt && alt.rider) || { k: 'status', s: 'burn', who: 'enemy' };
    }
    var fx3 = JSON.parse(JSON.stringify(def.fx));
    var rc = riderCost(table, rider);
    var rf = { k: rider.k, v: 1 };
    if (rider.s) rf.s = rider.s;
    if (rider.who) rf.who = rider.who;
    fx3.push(rf);
    var hp3 = hpFor(rc);
    if (hp3 > 0) fx3.push({ k: 'hploss', v: hp3 });
    out.push({
      lens: 'graft', name: 'THE GRAFT', from: def.name, fx: fx3,
      span: def.span || 1, tier: def.tier || 1, cls: def.cls || null, band: def.band || null,
      desc: ns.reforgeDescribe(fx3), note: '', sp: Math.round(ns.engravingSp({ fx: fx3 }) * 10) / 10,
    });
    return out;
  }

  /* Generate the three options for `def` on a die belonging to `cls`.
   * Rounding is deliberate and asymmetric: the PRIMARY rounds up and the RIDER
   * rounds down, so a reforge can never come out strictly worse than what you
   * started with. A reforge that is a downgrade feels like a punishment for
   * engaging with the event, and players stop opening it. */
  ns.reforgeOptions = function (def, cls) {
    if (!def || !def.fx || !def.fx.length) return [];
    var table = ns.reforgeTableFor(cls);
    var baseSp = ns.engravingSp(def);
    var out = [];
    if (indivisible(def.fx, primaryIdx(def.fx))) return indivisibleOptions(def, table, baseSp);

    table.lenses.forEach(function (lens) {
      var fx = JSON.parse(JSON.stringify(def.fx));
      var pi = primaryIdx(fx);
      if (pi < 0) return;
      var prim = fx[pi];
      var primUnit = Math.abs(spOf(prim) / (prim.v || 1)) || 1;
      var primSp = spOf(prim);
      var trigger = null, note = '';

      // 1. the primary is scaled
      var keptSp = primSp * lens.keep;
      prim.v = Math.max(1, Math.ceil(keptSp / primUnit));
      var spent = primSp - spOf(prim);          // what the shave freed up (may be negative)

      // 2. and the freed budget is spent, in this table's currency
      if (lens.into) {
        var target = lens.into;
        if (target === 'opposite') target = isDefensive(prim) ? 'dmg' : 'block';
        // a Bench split of a Shield engraving would just be more Shield, so it
        // steps sideways into Energy instead of saying nothing
        if (lens.altInto && target === prim.k) target = lens.altInto;
        var tf = (typeof target === 'string') ? { k: target } : JSON.parse(JSON.stringify(target));
        var unit = tf.k === 'status' ? (SP_STATUS[tf.s] || 3.5) : (SP_FLAT[tf.k] || 1);
        var v = Math.floor(spent / unit);
        /* If the freed budget will not buy even one of the target — Energy is
         * 5 SP and a band split may only free 2 — step down to something the
         * shave can actually afford rather than emitting nothing. */
        if (v < 1) {
          var chain = [{ k: 'dmg' }, { k: 'block' }, { k: 'status', s: 'burn', who: 'enemy' }];
          for (var ci = 0; ci < chain.length && v < 1; ci++) {
            var c2 = chain[ci];
            if (c2.k === prim.k && c2.s === prim.s) continue;
            var u2 = c2.k === 'status' ? (SP_STATUS[c2.s] || 3.5) : (SP_FLAT[c2.k] || 1);
            var v2 = Math.floor(spent / u2);
            if (v2 >= 1) { tf = JSON.parse(JSON.stringify(c2)); v = v2; }
          }
        }
        if (v > 0) { tf.v = v; fx.push(tf); }
      } else if (lens.rider) {
        var rc = riderCost(table, lens.rider) * (lens.all ? 2 : 1);   // going wide costs double
        var stacks = Math.floor(spent / rc);
        // A temper PROMISES a rider. If the shave did not free enough to buy
        // one, shave further rather than handing back an option identical to
        // what the player already had — three choices where one is a no-op is
        // really only two choices.
        var floorV = Math.max(1, Math.ceil(primSp * 0.45 / primUnit));
        while (stacks < 1 && prim.v > floorV) {
          prim.v -= 1;
          spent = primSp - spOf(prim);
          stacks = Math.floor(spent / rc);
        }
        if (stacks > 0) {
          var rf = { k: lens.rider.k, v: stacks };
          if (lens.rider.s) rf.s = lens.rider.s;
          if (lens.rider.who) rf.who = lens.rider.who;
          if (lens.all) rf.all = true;
          fx.push(rf);
        }
      } else if (lens.cost) {
        fx.push({ k: lens.cost.k, v: lens.cost.v });
      }

      /* 3. a Feeder gates the whole thing behind a trigger you pick — but never
       * one the engraving itself satisfies. "WHEN you gain Shield: gain Shield"
       * is not a listener, it is an infinite loop. */
      if (lens.makeListener) {
        var produces = {};
        fx.forEach(function (f) {
          if (f.k === 'block') produces.shield = 1;
          if (f.k === 'hploss') produces.selfHp = 1;
          if (f.k === 'status' && f.s === 'burn') produces.burn = 1;
          if (f.k === 'status' && f.s === 'psiPow') produces.psi = 1;
          if (f.k === 'status' && (f.s === 'vuln' || f.s === 'weak')) produces.debuff = 1;
        });
        var safe = listenTriggers().filter(function (t) { return !produces[t]; });
        trigger = safe[0] || 'crit';
        note = 'You choose the trigger from any it does not feed itself.';
      }

      /* 4. the floor: never strictly worse than what you started with. Skipped
       * for the Feeder, whose whole point is that it is worth LESS per firing
       * and fires far more often — comparing the two totals directly would be
       * comparing a per-roll number with a per-trigger one. */
      var guard = 0;
      if (!lens.makeListener) {
        while (ns.engravingSp({ fx: fx }) < baseSp * 0.98 && guard++ < 40) prim.v += 1;
      }

      out.push({
        lens: lens.id,
        name: lens.name,
        from: def.name,
        fx: fx,
        listen: trigger,
        span: def.span || 1,
        tier: def.tier || 1,
        cls: def.cls || null,
        band: def.band || null,
        desc: ns.reforgeDescribe(fx, { trigger: trigger }),
        note: note,
        sp: Math.round(ns.engravingSp({ fx: fx }) * 10) / 10,
      });
    });

    /* THE REPAIR PASS. Threshold-tuning cannot catch every case: whether a lens
     * can afford its rider depends on the engraving's budget AND on which table
     * is asking, since the Bench's Plating costs more than the Scouring's Burn.
     * So rather than guess a cut-off, check the output — any option that came
     * back identical to what the player already had, or to another option, is a
     * wasted slot and is refilled from the blood-and-recast set instead. */
    var baseDesc = ns.reforgeDescribe(def.fx, { trigger: def.listen });
    var seen = {}, keep = [];
    out.forEach(function (o) {
      if (o.desc === baseDesc || seen[o.desc]) return;
      seen[o.desc] = 1; keep.push(o);
    });
    if (keep.length < 3) {
      indivisibleOptions(def, table, baseSp).forEach(function (o) {
        if (keep.length >= 3 || seen[o.desc]) return;
        seen[o.desc] = 1; keep.push(o);
      });
    }
    return keep;
  };

  /* Forged engravings are not in DIE_AUGMENTS — they are made at runtime and
   * live on the run, so they have to be resolvable by id like anything else.
   * The engine refills this from run.forged whenever a save is loaded. */
  ns.FORGED = {};
  ns.forgedRegister = function (id, def) { ns.FORGED[id] = def; return id; };
  ns.forgedClear = function () { ns.FORGED = {}; };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
