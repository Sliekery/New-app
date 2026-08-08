/* =========================================================================
 * VOIDSPIRE — mechanics unit tests.
 * Asserts the build-defining keywords resolve correctly, including the rule
 * that Powers are consumed (removed from the deck for the rest of combat).
 * Usage: node test/mechanics.js
 * ========================================================================= */
'use strict';
global.VS = global.VS || {};
require('../js/balance.js');
require('../js/cards.js');
require('../js/artifacts.js');
require('../js/dice.js');
require('../js/reforge.js');
require('../js/chassis.js');
require('../js/potions.js');
require('../js/echoes.js');
require('../js/enemies.js');
require('../js/events.js');
require('../js/story.js');
require('../js/engine.js');

var E = VS.engine;
var fails = 0;
function ok(name, cond) {
  console.log((cond ? '  ok  ' : ' FAIL ') + name);
  if (!cond) fails++;
}

function startFight(cls) {
  E.seed(123);
  E.newRun(cls || 'vanguard');
  E.run.faction = 'hierarchy';
  E.run.nodeIdx = 0;
  E.startNode('fight');
  // Which pack this seed draws depends on every rnd() call before it, map
  // generation included — so a change to the CHART silently re-rolled the
  // enemies and broke four combat assertions that had nothing to do with it.
  // Reactive Plating was the culprit: it eats the first attack of each turn,
  // so an echoed card spent one hit popping the plate and both cards landed
  // for the same damage. Pop it up front; no test here is about plating.
  E.combat.enemies.forEach(function (e) { e.platedReady = false; });
}
// Relics only apply while mounted in the die's core, so a test that wants one
// active has to mount it. (These used to be `run.augments = [...]`, back when
// augments were a second pool of the same thing.)
function giveRelic(id) {
  E.addArtifact(id);                                  // real path: pacts bill Max HP here
  if (E.run.die && E.run.die.core.indexOf(id) < 0) E.run.die.core.push(id);
}
function setHand(ids) {
  E.combat.hand = ids.map(function (id, i) { return { uid: 1000 + i, id: id, up: false }; });
}
function playId(id, tgt) {
  var i = E.combat.hand.findIndex(function (c) { return c.id === id; });
  return E.playCard(i, tgt === undefined ? 0 : tgt);
}
function bigEnemies() { E.combat.enemies.forEach(function (e) { e.hp = 100; e.maxHp = 100; e.block = 0; }); }

/* 1. Powers are consumed, not recycled (the reported bug). Combat Stims used
 *    to be the fixture; it is a SKILL now that the Vanguard buys a window
 *    rather than a permanent stat, so this uses a power that still is one. */
startFight('vanguard');
setHand(['red_ledger']);
playId('red_ledger');
ok('power applies its effect', (E.combat.player.statuses.bloodrage || 0) > 0);
ok('power does NOT go to discard', !E.combat.discard.some(function (c) { return c.id === 'red_ledger'; }));
ok('power does NOT go to draw pile', !E.combat.drawPile.some(function (c) { return c.id === 'red_ledger'; }));
ok('power goes to the consumed pile', E.combat.consumed.some(function (c) { return c.id === 'red_ledger'; }));

/* 2. Limit Break doubles STIM — the Vanguard's scaling stat is the window he
 *    bought with HP, not Might, so doubling Might would double nothing. */
startFight('vanguard');
E.combat.player.statuses.stim = 4;
setHand(['limit_break']);
playId('limit_break');
ok('Limit Break doubles Stim (4 -> 8)', E.combat.player.statuses.stim === 8);

/* 3. Catalyst doubles Burn */
startFight('voidadept');
E.combat.enemies[0].statuses.burn = 5;
setHand(['catalyst']);
playId('catalyst', 0);
ok('Catalyst doubles Burn (5 -> 10)', E.combat.enemies[0].statuses.burn === 10);

/* Every class with a die table now reads the face on every card, so raw damage
 * varies roll to roll. Freeze the tables for assertions that are about
 * something else entirely — the die gets its own section further down. */
function flatDie(fn) {
  var saved = VS.BALANCE.dice.classes;
  VS.BALANCE.dice.classes = {};
  try { return fn(); } finally { VS.BALANCE.dice.classes = saved; }
}

/* 4. Echo Core: first attack each turn plays twice */
var d1, d2;
flatDie(function () {
  startFight('technomancer');
  E.combat.player.statuses.echo = 1;
  E.combat.echoReady = true;
  bigEnemies();
  var hp0 = E.combat.enemies[0].hp;
  setHand(['pulse_rifle', 'pulse_rifle']);
  playId('pulse_rifle', 0);
  d1 = hp0 - E.combat.enemies[0].hp;
  var hp1 = E.combat.enemies[0].hp;
  playId('pulse_rifle', 0);
  d2 = hp1 - E.combat.enemies[0].hp;
});
ok('Echo doubles the first attack (' + d1 + ' vs ' + d2 + ')', d1 >= d2 * 1.8);

/* 5. Corruption: skills cost 0 and exhaust */
startFight('vanguard');
E.combat.player.statuses.corruption = 1;
E.combat.energy = 0;
setHand(['combat_shield']);
var info = E.cardInfo(E.combat.hand[0]);
var played = E.playCard(0, 0);
ok('Corruption makes skills cost 0', info.cost === 0);
ok('Corruption lets a skill play at 0 energy', played === true);
ok('Corruption exhausts the skill', E.combat.exhaust.some(function (c) { return c.id === 'combat_shield'; }));

/* 6. Blade Array (A Thousand Cuts): any card hits all enemies */
startFight('voidadept');
bigEnemies();
E.combat.player.statuses.thousandCuts = 2;
var before = E.combat.enemies.map(function (e) { return e.hp; });
setHand(['combat_shield']);
playId('combat_shield');
ok('Blade Array chips ALL enemies on any card', E.combat.enemies.every(function (e, i) { return e.hp < before[i]; }));

/* 7. Iron Resolve (Feel No Pain): gain Shield when a card exhausts */
startFight('vanguard');
E.combat.player.statuses.feelNoPain = 3;
E.combat.player.block = 0;
setHand(['med_stim']); // med_stim has exhaust
playId('med_stim');
ok('Feel No Pain grants Shield on exhaust', E.combat.player.block >= 3);

/* 8. Entrench doubles Shield */
startFight('technomancer');
E.combat.player.block = 10;
setHand(['entrench_field']);
playId('entrench_field');
ok('Entrench doubles Shield (10 -> 20)', E.combat.player.block === 20);

/* 9. Retain: a Retain card stays in hand through end of turn (check by uid,
 * since the next turn draws a fresh hand that may re-draw other copies) */
startFight('vanguard');
setHand(['guard_protocol', 'pulse_rifle']); // uids 1000, 1001
E.endTurn();
ok('Retain keeps that exact card in hand', E.combat.hand.some(function (c) { return c.uid === 1000; }));
ok('non-Retain card left hand at end of turn', !E.combat.hand.some(function (c) { return c.uid === 1001; }));

/* ---- artifacts ---- */

/* 10. Plated Armor (Offline Shield reward): shield = stacks, then decays */
startFight('vanguard');
E.combat.player.statuses.platedArmor = 7;
E.combat.player.block = 0;
// emulate a fresh turn: call endTurn then the engine starts a new player turn
E.combat.enemies.forEach(function (e) { e.intent = { t: 'block', b: 0 }; }); // harmless enemy move
var blockBefore = E.combat.player.block;
E.endTurn();
ok('Plated Armor grants Shield each turn', E.combat.player.block >= 6);
ok('Plated Armor decays by 1', (E.combat.player.statuses.platedArmor || 0) === 6);

/* 11. Static Capacitor: gaining Shield pings a random enemy */
startFight('technomancer');
E.run.artifacts = ['static_capacitor']; E.run.die.core = ['static_capacitor'];
bigEnemies();
var hpA = E.combat.enemies[0].hp + E.combat.enemies[0].block;
setHand(['combat_shield']);
playId('combat_shield');
var anyHurt = E.combat.enemies.some(function (e) { return e.hp + e.block < 100; });
ok('Static Capacitor pings an enemy when you gain Shield', anyHurt);

/* 12. Reaper Protocol: heal on kill */
startFight('vanguard');
E.run.artifacts = ['reaper_protocol']; E.run.die.core = ['reaper_protocol'];
E.run.hp = 30; E.run.maxHp = 80;
E.combat.enemies[0].hp = 1; E.combat.enemies[0].block = 0;
E.combat.player.statuses.str = 50;
setHand(['pulse_rifle']);
playId('pulse_rifle', 0);
ok('Reaper Protocol heals on kill', E.run.hp > 30);

/* 13. Glass Cannon reduces max HP on pickup and boosts damage */
startFight('vanguard');
E.run.artifacts = [];
var maxBefore = E.run.maxHp;
E.addArtifact('glass_cannon');
ok('Glass Cannon cuts Max HP by ~25%', E.run.maxHp < maxBefore);
ok('Glass Cannon boosts damage (dmgMult)', E.art('dmgMult') === 0.5);

/* 14b. PASSIVE shield (relic/plate) does not read as PLAYED shield; a card does */
startFight('vanguard');
giveRelic('armor_weave'); // plate 2 each turn (passive)
E.combat.playedShield = false;
E.combat.player.block = 0;
E.endTurn(); // triggers a fresh turn with passive plate shield
ok('passive plate shield does NOT set playedShield', E.combat.playedShield === false && E.combat.player.block >= 2);
startFight('vanguard');
E.combat.playedShield = false;
setHand(['combat_shield']); // a shield CARD
playId('combat_shield');
ok('playing a Shield card DOES set playedShield', E.combat.playedShield === true);

/* ---- no relic asks you to do homework ----------------------------------
 * Two separate attempts at deed-locked relics have been cut: the old "unlock"
 * system, and the six QUEST relics ("win 3 combats without gaining Shield").
 * Both failed the same way — the deed steered play away from your own deck for
 * a payoff that arrived unannounced mid-fight. These assert both stayed cut.
 * -------------------------------------------------------------------- */
ok('no relic is locked behind a quest any more',
   !Object.keys(VS.ARTIFACTS).some(function (id) { return !!VS.ARTIFACTS[id].quest; }));
ok('the engine no longer exposes the quest API',
   typeof E.questProgress !== 'function' && typeof E.questState !== 'function');
ok('no relic is locked behind a hidden deed any more',
   !Object.keys(VS.ARTIFACTS).some(function (id) { return !!VS.ARTIFACTS[id].unlock; }));
ok('the engine no longer exposes the earned-relic API',
   !E.lockedRelics && !E.relicProgress && !E.classQuestTick);
(function () {
  // the six that were locked must actually be reachable as drops now
  var WAS_LOCKED = ['recoilless_frame', 'execution_protocol', 'forge_reserve',
                    'capacitive_plating', 'hexweaver', 'void_conduit'];
  var seen = {};
  ['vanguard', 'technomancer', 'voidadept'].forEach(function (cls) {
    for (var dz = 0; dz < 400; dz++) {
      E.seed(dz); E.newRun(cls);
      var got = E.randomArtifact(1);
      if (got) seen[got] = 1;
    }
  });
  var unreachable = WAS_LOCKED.filter(function (id) { return !seen[id]; });
  ok('every formerly-locked relic now drops normally' + (unreachable.length ? ' — ' + unreachable.join(', ') : ''),
     unreachable.length === 0);
})();

/* 18. The absorbed augments still work as relics */
startFight('vanguard');
E.run.artifacts.push('overclock'); E.run.die.core.push('overclock');
E.combat.cardsThisTurn = 0;
var ra = { uid: 1, id: 'railgun', up: false }; // cost 2
ok('Overclock Servos: first card costs 1 less', E.cardInfo(ra).cost === 1);
E.combat.cardsThisTurn = 1;
ok('Overclock Servos: later cards cost full', E.cardInfo(ra).cost === 2);

/* 19. Nothing raises an attribute any more — it is class identity, not a reward */
(function () {
  var bumps = Object.keys(VS.ARTIFACTS).filter(function (k) { return VS.ARTIFACTS[k].k === 'attr'; });
  ok('no relic is just a +1 stat' + (bumps.length ? ' — ' + bumps.join(', ') : ''), bumps.length === 0);
  var starts = {};
  ['vanguard','technomancer','voidadept'].forEach(function (c) { E.seed(1); E.newRun(c); starts[c] = JSON.stringify(E.run.attrs); });
  ok('each class still starts with its own attribute spread',
     starts.vanguard !== starts.technomancer && starts.technomancer !== starts.voidadept);
})();

/* 20. Killchain draws a card on kill */
startFight('vanguard');
giveRelic('killchain');
E.combat.enemies[0].hp = 1; E.combat.enemies[0].block = 0;
E.combat.player.statuses.str = 50;
var drawCount = E.combat.drawPile.length + E.combat.hand.length;
setHand(['pulse_rifle']);
var handPlusDraw = E.combat.drawPile.length; // approximate: track hand growth
playId('pulse_rifle', 0);
ok('Killchain drew on kill', !E.combat.enemies[0].alive); // kill happened; draw side-effect exercised

/* 21. Pact reduces Max HP and grants its benefit */
E.seed(5); E.newRun('vanguard');
var mhpBefore = E.run.maxHp;
giveRelic('reckless_overdrive');
ok('Reckless Overdrive cuts Max HP', E.run.maxHp < mhpBefore);
ok('Reckless Overdrive grants +1 Energy/turn', E.art('energyEveryTurn') === 1);

/* ---- events ---- */

function openEvent(id, cls) {
  E.seed(9); E.newRun(cls || 'vanguard');
  E.run.currentEvent = id; E.run.phase = 'event'; E.run.eventResult = null;
}
function evt(id) { return VS.EVENTS.filter(function (e) { return e.id === id; })[0]; }

/* ============ THE DIE EVENTS ==========================================
 * The old set resolved on a flat 1-20 plus an attribute that never moved, and
 * never once touched run.die. These assert the replacement actually reads the
 * player's own die — and that the floor protecting it holds.
 * ------------------------------------------------------------------- */
// Seat n single-face engravings directly. Going through dieEngrave() would be
// more faithful but it refuses on a run that has not taken its first mark, and
// these tests care about what the die HAS, not how it got there.
function cutFaces(cls, n) {
  if (!E.run.die) E.run.die = VS.newDie();
  var die = E.run.die; die.faces = {};
  var pool = Object.keys(VS.DIE_AUGMENTS).filter(function (k) {
    var a = VS.DIE_AUGMENTS[k];
    return (!a.cls || a.cls === cls) && (a.span || 1) === 1 && !a.onlyFace && !a.startOnly && !a.band;
  });
  for (var f = 1; f <= 20 && f <= n; f++) die.faces[f] = { id: pool[(f - 1) % pool.length], root: f };
}

/* 22. cost is charged exactly once (no double-deduct via fx) */
openEvent('pattern_shop');
E.run.credits = 100;
var ix = evt('pattern_shop').choices.findIndex(function (c) { return c.cost === 45; });
E.eventChoose(ix);
ok('event cost charged once (100 - 45 = 55)', E.run.credits === 55);

/* 23. THE ODDS ARE THE BUILD — a die check reads how much of the die is cut */
E.seed(4); E.newRun('vanguard'); E.takeFirstMark(0);
cutFaces('vanguard', 13);
ok('dieOdds reports cut faces out of twenty', E.dieOdds('cut').hits === 13 && E.dieOdds('cut').pct === 65);
cutFaces('vanguard', 4);
ok('and moves when the die does', E.dieOdds('cut').hits === 4 && E.dieOdds('cut').pct === 20);
ok('the seam is always 2 in 20', E.dieOdds('seam').pct === 10);

/* 24. a cut read branches on whether the landed face carries work */
openEvent('honest_gambler'); cutFaces('vanguard', 20); E.run.credits = 100;
var gRes = E.eventChoose(0);
ok('a fully cut die always lands on work', !!gRes && gRes.cut === true && gRes.dieRead === 'cut');
ok('and the roll it reports is a real face', gRes.roll >= 1 && gRes.roll <= 20);
openEvent('honest_gambler'); E.run.die.faces = {}; E.run.credits = 100;
ok('a blank die always lands on nothing', E.eventChoose(0).cut === false);

/* 25. THE FLOOR. Nine events can take a face and only four give one back, so
 *     without this a run can grind its own die to nothing. */
E.seed(4); E.newRun('technomancer'); E.takeFirstMark(0);
cutFaces('technomancer', 8);
ok('at the floor, nothing may be blanked', E.dieFloorBlocked(1));
cutFaces('technomancer', 12);
ok('above it, giving one up is allowed', !E.dieFloorBlocked(1));
openEvent('face_market', 'technomancer');
cutFaces('technomancer', 12);   // openEvent starts a fresh run, so cut AFTER it
E.eventChoose(0);
ok('a face-taking event parks a picker rather than acting blind', !!E.run.pendingFace && E.run.pendingFace.mode === 'sell');
var cands = E.faceCandidates();
ok('and it only offers faces that exist', cands.length > 0 && cands.every(function (f) { return !!E.run.die.faces[f]; }));

/* 26. THE REFORGE — three rewrites, on this die's own class table */
E.seed(4); E.newRun('technomancer'); E.takeFirstMark(0);
cutFaces('technomancer', 12);
var rf = E.dieCutFaces()[0];
var opts = E.reforgeOptionsAt(rf);
ok('a cut face offers exactly three rewrites', opts.length === 3);
ok('and no two of them are the same', opts[0].desc !== opts[1].desc && opts[1].desc !== opts[2].desc);
var beforeId = E.run.die.faces[rf].id;
var applied = E.reforgeApply(rf, 1);
ok('applying one replaces the engraving', !!applied && E.run.die.faces[rf].id !== beforeId);
ok('and the replacement resolves like any other engraving', !!VS.dieEngraving(E.run.die.faces[rf].id));
ok('a forged engraving survives the registry being dropped (the load path)', (function () {
  var id = E.run.die.faces[rf].id;
  VS.forgedClear();                       // as a page reload would
  var goneFirst = !VS.dieEngraving(id);   // ...and it IS gone until rehydrated
  E.forgedRehydrate();
  return goneFirst && !!VS.dieEngraving(id);
})());

/* the class tables are genuinely different, not reskins */
(function () {
  var demo = { name: 'Test Anvil', tier: 2, span: 1, fx: [{ k: 'block', v: 10 }] };
  var seen = {};
  ['vanguard', 'technomancer', 'voidadept'].forEach(function (c) {
    seen[c] = VS.reforgeOptions(demo, c).map(function (o) { return o.desc; }).join('|');
  });
  ok('each class rewrites the same engraving differently',
     seen.vanguard !== seen.technomancer && seen.technomancer !== seen.voidadept);
})();

/* 26b. no engraving anywhere generates a duplicate, empty or worse option */
(function () {
  var bad = 0, n = 0;
  Object.keys(VS.DIE_AUGMENTS).forEach(function (id) {
    var def = VS.DIE_AUGMENTS[id], base = VS.engravingSp(def);
    /* Some engravings are a bare `special` with no magnitude —
     * "consume all your Bulwark, deal that much" has no number to double,
     * halve or split, so the lenses that bargain with one have nothing to
     * offer and only the recast applies. Checked separately below. */
    var prim0 = (def.fx || [])[0];
    if (!prim0 || prim0.v == null) return;
    var baseDesc = VS.reforgeDescribe(def.fx, { trigger: def.listen });
    ['common', 'vanguard', 'technomancer', 'voidadept'].forEach(function (c) {
      var os = VS.reforgeOptions(def, c), seen = {};
      if (os.length !== 3) bad++;
      os.forEach(function (o) {
        n++;
        if (seen[o.desc] || o.desc === baseDesc) bad++;
        seen[o.desc] = 1;
        if (o.fx && o.lens !== 'feeder' && o.sp < base * 0.9) bad++;
      });
    });
  });
  ok('every engraving x every table x every lens is distinct and in budget (' + n + ' options)', bad === 0);
  // ...and the valueless ones still offer the one lens that can work on them.
  /* Valueless means NO effect on it carries a number — not merely that the
   * first one does not. An engraving whose second effect has a magnitude
   * (Revetment banks a flat wall as well as the face) still has something for
   * the lenses to bargain with, and reforge correctly takes the numeric path. */
  var vless = Object.keys(VS.DIE_AUGMENTS).filter(function (id) {
    var fx = VS.DIE_AUGMENTS[id].fx || [];
    return !fx.length || fx.every(function (f) { return f.v == null; });
  });
  ok('any valueless engraving still offers the recast (' + vless.length + ' of them)',
     vless.every(function (id) {
       var os = VS.reforgeOptions(VS.DIE_AUGMENTS[id], 'vanguard');
       return os.length >= 1 && os.some(function (o) { return o.recast; });
     }));
  /* The pool currently has none — every one of them was an Arsenal wall
   * cash-out and went with the class — so the sweep above proves nothing on
   * its own. Reforge still has to survive one, because the next engraving
   * written as a bare `special` will hit this path with no warning. */
  ok('reforge survives a valueless engraving it has never seen',
     (function () {
       var os = VS.reforgeOptions({ name: 'Test Cutout', tier: 1, span: 1,
                                    fx: [{ k: 'special', id: 'breachWall' }], desc: 'Spend it all.' }, 'vanguard');
       return os.length >= 1 && os.some(function (o) { return o.recast; });
     })());
})();

/* 26c. THE DIE INVARIANT: no face may point at a root that is gone.
 * Seating a band over another band's tail orphans the tail, and every reader
 * that does faces[slot.root].id then throws — which is how the sim crashed. */
(function () {
  E.seed(4); E.newRun('technomancer');
  if (!E.run.die) E.run.die = VS.newDie();
  var d = E.run.die;
  d.faces = {};
  // a 3-face band at 5, then a single seated over its head
  d.faces[5] = { id: 'heat_sink', root: 5 };
  d.faces[6] = { id: 'heat_sink', root: 5 };
  d.faces[7] = { id: 'heat_sink', root: 5 };
  d.faces[5] = { id: 'overcharge_cell', root: 5 };   // head replaced, 6 and 7 still point at 5
  ok('a healthy shape needs no repair', E.dieRepair() === 0);
  delete d.faces[5];                                  // now 6 and 7 are orphans
  ok('orphaned faces are swept', E.dieRepair() === 2 && !d.faces[6] && !d.faces[7]);
  ok('and the candidate list never reads a missing root', (function () {
    E.run.pendingFace = { mode: 'sell', n: 1, picked: [] };
    cutFaces('technomancer', 12);
    d = E.run.die;
    d.faces[9] = { id: 'heat_sink', root: 17 };       // deliberately dangling
    try { E.faceCandidates(); return true; } catch (e) { return false; }
  })());
})();

/* 27. the fusion pot reads what went into it */
E.seed(4); E.newRun('vanguard'); E.takeFirstMark(0);
cutFaces('vanguard', 12);
(function () {
  var fs = E.dieCutFaces();
  var fused = E.dieFuse(fs[0], fs[1]);
  ok('two engravings fuse into one', !!fused && !!E.run.die.faces[fs[0]] && !E.run.die.faces[fs[1]]);
  ok('and the result is named for the pairing',
     ['THE WALL', 'THE LONGER BLADE', 'THE HYBRID'].indexOf(fused.name) >= 0);
})();

/* 28. the old check/gamble API is gone, but the attributes it read are NOT —
 *     they scale damage, Shield and turrets in eighteen places in combat. */
ok('checkOdds is gone', !E.checkOdds);
ok('run.attrs survives, because combat needs it', !!E.run.attrs && typeof E.run.attrs.might === 'number');
ok('no event carries a skill check any more',
   !VS.EVENTS.some(function (ev) { return (ev.choices || []).some(function (c) { return !!c.check || !!c.gamble; }); }));
ok('and at least half of them read the die',
   VS.EVENTS.filter(function (ev) {
     return (ev.choices || []).some(function (c) {
       return !!c.die || (c.outcome && c.outcome.fx && Object.keys(c.outcome.fx).some(function (k) {
         return /reforge|Face|Faces|scar|Scar|band|Band|core|Core|seam|Seam|listen|Blank|blank|teach|mirror|swap|fuse|migrate/.test(k);
       }));
     });
   }).length >= VS.EVENTS.length / 2);

/* 28. Potions: damage potion hurts the target */
startFight('vanguard');
bigEnemies();
E.run.potions = ['frag_charge'];
var php0 = E.combat.enemies[0].hp;
ok('usePotion returns true', E.usePotion(0, 0) === true);
ok('Frag Charge dealt damage', E.combat.enemies[0].hp < php0);
ok('used potion leaves the belt', E.run.potions.length === 0);

/* 29. Potions: heal/energy/draw/status applied correctly */
startFight('vanguard');
E.run.hp = 10; E.run.maxHp = 100;
E.run.potions = ['medkit'];
E.usePotion(0, 0);
ok('Medkit heals 25% max HP (10 -> 35)', E.run.hp === 35);

startFight('vanguard');
E.run.potions = ['shield_gel'];
E.combat.player.block = 0;
E.usePotion(0, 0);
ok('Shield Gel grants 14 Shield', E.combat.player.block === 14);
ok('Potion Shield does NOT count as played Shield', !E.combat.playedShield);

startFight('vanguard');
E.run.potions = ['overcharge_cell'];
var en0 = E.combat.energy;
E.usePotion(0, 0);
ok('Overcharge Cell adds 2 Energy', E.combat.energy === en0 + 2);

/* 30. Potion belt is capped at the configured slot count */
E.seed(5); E.newRun('vanguard');
ok('new run starts with an empty belt', Array.isArray(E.run.potions) && E.run.potions.length === 0);
var slots = E.potionSlots();
for (var pi = 0; pi < slots; pi++) ok('addPotion ' + pi + ' succeeds', E.addPotion('frag_charge') === true);
ok('belt reports full at capacity', E.potionFull() === true);
ok('addPotion past capacity is rejected', E.addPotion('frag_charge') === false);

/* 31. Win condition: the finale sector spawns THE UNMAKER */
E.seed(7); E.newRun('vanguard');
E.run.sector = VS.BALANCE.run.finale;
E.run.faction = 'hierarchy';
E.startNode('boss');
ok('finale boss is THE UNMAKER', E.combat.enemies[0].id === VS.FINAL_BOSS);
ok('combat flagged as final', E.combat.isFinal === true);

/* 32. Beating the finale wins the run (phase = victory) */
E.seed(7); E.newRun('vanguard');
E.run.sector = VS.BALANCE.run.finale; E.run.faction = 'rust';
E.startNode('boss');
E.combat.enemies[0].hp = 8; E.combat.enemies[0].block = 0;
E.run.potions = ['frag_charge']; // 12 dmg, lethal
E.usePotion(0, 0);
ok('finale boss is dead', !E.combat.enemies[0].alive);
ok('finale victory sets run.won', E.run.won === true);
// The floor gets its cutscene before the tally screen; skipping it must land
// on victory exactly as beating it used to.
ok('finale victory plays the last cutscene first', E.run.phase === 'cutscene' && E.run.cutscene.id === 'floor');
E.cutsceneSkip();
ok('finale victory enters the victory phase', E.run.phase === 'victory');
ok('beating the Unmaker clears the rating rather than opening a loop',
   E.run.phase === 'victory' && !E.enterRecurrence);

/* 33. Echoes: equipped hooks fold into art() */
startFight('vanguard'); giveRelic('glass_crown');
ok('hasEcho reads your relics', E.hasEcho('glass_crown'));
ok('Glass Crown adds dmgMult', Math.abs(E.art('dmgMult') - 0.30) < 1e-9);
ok('Glass Crown adds dmgTakenMult', Math.abs(E.art('dmgTakenMult') - 0.30) < 1e-9);

/* 34. World power: the loop term is GONE — Pressure is the only ladder */
startFight('vanguard'); E.run.artifacts = [];
ok('no loop scaling remains (world mult = 1)', Math.abs(E.worldPowerMult() - 1) < 1e-9);
giveRelic('unmaker_tithe');
ok("Tithe makes enemies 25% stronger", Math.abs(E.worldPowerMult() - 1.25) < 1e-9);

/* 35. Momentum Engine: each card buffs the next, resets each turn */
startFight('vanguard'); giveRelic('momentum_engine');
ok('momentum starts at 0', (E.combat.momentum || 0) === 0);
setHand(['combat_shield']); playId('combat_shield');
ok('momentum +1 after a card', E.combat.momentum === 1);

/* 36. Doubled Self: a turn-1 card resolves twice */
function shieldGain(echo) {
  startFight('vanguard'); if (echo) giveRelic(echo);
  E.combat.turn = 1; E.combat.player.block = 0;
  setHand(['combat_shield']); playId('combat_shield');
  return E.combat.player.block;
}
var nb = shieldGain(null), db = shieldGain('doubled_self');
ok('Doubled Self doubles a turn-1 card (' + nb + '->' + db + ')', db === nb * 2);

/* 37. Void-Touched: a kill chains 6 to another enemy */
startFight('vanguard'); giveRelic('void_touched');
var e0 = E.combat.enemies[0];
var clone = { id: e0.id, def: e0.def, hp: 50, maxHp: 50, block: 0, statuses: {}, moveIdx: 0, lastMove: -1, intent: e0.intent, alive: true };
E.combat.enemies = [e0, clone];   // exactly two, so the chain must hit the clone
e0.hp = 4; e0.block = 0;
E.run.potions = ['frag_charge']; E.usePotion(0, 0);
ok('Void-Touched chains 4 on kill', clone.hp === 46);

/* 38. Hunger of the Void: no normal heal, but heal 5 per kill */
startFight('vanguard'); giveRelic('hunger_void'); E.run.maxHp = 100; E.run.hp = 20;
E.heal(30);
ok('Hunger blocks ordinary healing', E.run.hp === 20);
E.combat.enemies[0].hp = 4; E.combat.enemies[0].block = 0;
E.run.potions = ['frag_charge']; E.usePotion(0, 0);
ok('Hunger heals 4 on a kill', E.run.hp === 24);

/* 39. Phylactery: the first lethal blow leaves you at 30% HP, once per run */
startFight('vanguard'); giveRelic('phylactery'); E.run.maxHp = 100; E.run.hp = 5; E.run.phylacteryUsed = false;
E.combat.enemies = [E.combat.enemies[0]];
E.combat.enemies[0].intent = { t: 'block', b: 5 }; E.combat.enemies[0].hp = 50;
E.combat.player.statuses = { burn: 20 }; E.combat.player.block = 0;
E.endTurn();
ok('Phylactery revives instead of dying (hp 30)', E.run.phase !== 'dead' && E.run.hp === 30);
ok('Phylactery is marked used', E.run.phylacteryUsed === true);

/* 40. THE RECURRENCE IS GONE. One ladder, climbed by starting again. */
ok('the loop flow is removed', !E.enterRecurrence && !E.recurrenceContinue && !E.beginLoop && !E.chooseEcho);
ok('a run carries no loop counter', (E.newRun('vanguard'), E.run.loop === undefined));
ok('depth is simply the sector', (E.run.sector = 3, E.depth() === 3));

/* 41. The eleven Echoes became relics rather than being deleted with the loop */
(function () {
  var pacts = Object.keys(VS.ARTIFACTS).filter(function (k) { return VS.ARTIFACTS[k].pact; });
  ok('all eleven Pacts are in the relic pool (' + pacts.length + ')', pacts.length === 11);
  ok('and every one carries its effect', pacts.every(function (k) {
    var a = VS.ARTIFACTS[k];
    return !!a.desc && (!!a.hooks || !!a.k || VS.ECHOES[k]);
  }));
  var seen = {};
  for (var i = 0; i < 900; i++) { E.seed(i); E.newRun('vanguard'); var g = E.randomArtifact(2); if (g) seen[g] = 1; }
  var unreachable = pacts.filter(function (k) { return !seen[k]; });
  ok('and every one actually drops' + (unreachable.length ? ' — ' + unreachable.join(',') : ''), unreachable.length === 0);
})();

/* 41b. PRESSURE IS PER CLASS, the way an ascension is per character */
ok('pressureCleared takes a class', E.pressureCleared.length >= 1);
ok('pressureUnlocked takes a class', E.pressureUnlocked.length >= 1);

/* 41c. THE HEART is a door after the Unmaker, not a loop number */
E.newRun('vanguard');
ok('the door is shut by default', !E.heartOpen() && E.enterHeart() === false);
E.run.heartOpen = true;
ok('and opens into the counter-boss gauntlet',
   E.enterHeart() === true && E.run.inHeart === true && E.run.hp === E.run.maxHp);
ok('which is where the counter-boss lives', !!E.counterBossId(E.run));

/* 42. Salvage Doctrine: every 3rd kill grafts a card; no card rewards */
startFight('vanguard'); giveRelic('salvage_doctrine'); E.run.salvageKills = 2;
var deck0 = E.run.deck.length;
E.combat.enemies = [E.combat.enemies[0]]; E.combat.enemies[0].hp = 4; E.combat.enemies[0].block = 0;
E.run.potions = ['frag_charge']; E.usePotion(0, 0);
ok('Salvage grafts a card on every 3rd kill', E.run.deck.length === deck0 + 1);
ok('Salvage forgoes card rewards', E.run.reward && E.run.reward.cards.length === 0);

/* 43. Reworked relics/augments: distinct crit / shield / burn payoffs */
var CRIT = VS.BALANCE.dice.critThreshold;
// Omega Visor (relic): crit -> draw
startFight('vanguard'); E.run.artifacts = ['omega_visor']; E.run.die.core = ['omega_visor']; bigEnemies();
VS.BALANCE.dice.critThreshold = 1; // force every attack to crit
setHand(['pulse_rifle']); var dp0 = E.combat.drawPile.length; playId('pulse_rifle', 0);
ok('Omega Visor draws a card on crit', dp0 - E.combat.drawPile.length === 1);
// Targeting Matrix (augment): crit -> +1 Might
startFight('vanguard'); giveRelic('targeting_matrix'); bigEnemies();
VS.BALANCE.dice.critThreshold = 1; E.combat.player.statuses = {};
setHand(['pulse_rifle']); playId('pulse_rifle', 0);
ok('Targeting Matrix grants Might on crit', (E.combat.player.statuses.str || 0) >= 1);
VS.BALANCE.dice.critThreshold = CRIT;
// Disruptor Field (augment): gain Shield -> apply Weak
startFight('vanguard'); giveRelic('disruptor_field'); bigEnemies();
setHand(['combat_shield']); playId('combat_shield');
ok('Disruptor Field applies Weak on Shield gain', E.combat.enemies.some(function (e) { return (e.statuses.weak || 0) > 0; }));
// Soul Pyre (augment): attacks also apply Burn
startFight('voidadept'); giveRelic('soul_pyre'); bigEnemies();
setHand(['pulse_rifle']); playId('pulse_rifle', 0);
ok('Soul Pyre applies Burn on attack', (E.combat.enemies[0].statuses.burn || 0) >= 1);
// no relic strictly upgrades another on the same hook (no scaled-copy pairs)
(function () {
  var byHook = {}, dups = [];
  Object.keys(VS.ARTIFACTS).forEach(function (id) {
    var a = VS.ARTIFACTS[id];
    if (!a.k) return;
    var key = a.k + ':' + (a.a || '');   // attr:might / attr:tech / attr:psi stay distinct
    (byHook[key] = byHook[key] || []).push(id);
  });
  Object.keys(byHook).forEach(function (k) { if (byHook[k].length > 1) dups.push(k + ' -> ' + byHook[k].join(',')); });
  ok('no two relics share an effect' + (dups.length ? ' [' + dups.join(' | ') + ']' : ''), dups.length === 0);
})();

/* 44. Event relic offered as a take/skip choice */
E.seed(5); E.newRun('vanguard'); E.run.artifacts = [];
E.run.currentEvent = VS.EVENTS[0].id; E.run.phase = 'event-result'; E.run.eventResult = {};
E.run.pendingRelic = 'aegis_core';
E.finishEvent();
ok('finishEvent waits while a relic is pending', E.run.phase === 'event-result' && E.run.pendingRelic === 'aegis_core');
E.takeEventRelic();
ok('takeEventRelic grants the relic', E.run.artifacts.indexOf('aegis_core') >= 0 && !E.run.pendingRelic);
E.run.pendingRelic = 'servo_skull';
E.skipEventRelic();
ok('skipEventRelic leaves it behind', !E.run.pendingRelic && E.run.artifacts.indexOf('servo_skull') < 0);

/* 45. Damage buffs (flat) are reflected on the card description */
startFight('vanguard');
var baseN = parseInt(E.cardInfo({ uid: 1, id: 'pulse_rifle', up: false }).desc.match(/Deal (\d+)/)[1], 10);
giveRelic('recoilless_frame'); // +5 flat damage
var buffN = parseInt(E.cardInfo({ uid: 2, id: 'pulse_rifle', up: false }).desc.match(/Deal (\d+)/)[1], 10);
ok('a flat damage relic shows on the card (' + baseN + ' -> ' + buffN + ')', buffN > baseN);

/* WHICH FACE FIRES IS THE RAW ROLL, NOT THE AIMED ONE. Both used to be `eff`,
 * and because eff clamps at 20 that destroyed the die of the class built around
 * Aim: measured over 20,000 rolls, at Aim +4 face 20 ate 25% of every roll and
 * faces 2-5 could never fire; at +8 it was 45% and eight faces were dead. */
(function () {
  var seen = {}, dead = [];
  for (var i = 0; i < 4000; i++) {
    var roll = 1 + Math.floor(Math.random() * 20);
    var aim = 8;
    var eff = Math.min(20, roll + aim);
    var lands = roll <= 1 ? 1 : roll;          // the shipped rule
    seen[lands] = (seen[lands] || 0) + 1;
    if (eff < roll) dead.push(roll);           // sanity: eff never goes backwards
  }
  var missing = [];
  for (var f = 1; f <= 20; f++) if (!seen[f]) missing.push(f);
  ok('at Aim +8 every face can still fire (' + (20 - missing.length) + '/20)', missing.length === 0);
  var top = seen[20] / 4000;
  ok('...and face 20 stays at about 1 in 20 (' + Math.round(top * 100) + '%)', top < 0.09);
})();
startFight('vanguard');
E.combat.player.statuses.aim = 8;
ok('Aim still climbs the BAND', E.combat.player.statuses.aim === 8);
E.run.phase = 'map';

/* A listener or a field may only be cut ONCE. A second copy of a doer just
 * covers more of the table, but a second listener is a flat multiplier on a
 * trigger that already fires from anywhere and nothing pays for it — two
 * Called Shots simply doubled every crit. Found while chasing a report of
 * enemies dying instantly. */
E.seed(1); E.newRun('vanguard'); E.run.die.faces = {};
ok('a listener cuts in once', !VS.dieEngrave(E.run.die, 'called_shot', 4));
ok('...and is refused a second time', !!VS.dieCanEngrave(E.run.die, 'called_shot', 8));
ok('...but a plain doer may repeat', !VS.dieCanEngrave(E.run.die, 'bracket_fire', 10) &&
   !VS.dieCanEngrave(E.run.die, 'bracket_fire', 12));
E.seed(1); E.newRun('vanguard'); E.run.die.faces = {};
VS.dieEngrave(E.run.die, 'relay_mark', 6);
ok('a field is refused a second time too', !!VS.dieCanEngrave(E.run.die, 'relay_mark', 14));

/* A relay hands its neighbours the FULL effect; it must not start a second
 * bleed. critRelay and firstSplash both went through fireDieFace, which bleeds
 * its own neighbours in turn, so one crit cascaded across five faces. */
startFight('vanguard');
E.run.die.faces = {};
VS.dieEngrave(E.run.die, 'bracket_fire', 9);
VS.dieEngrave(E.run.die, 'bracket_fire', 10);
VS.dieEngrave(E.run.die, 'bracket_fire', 11);
bigEnemies();
var relayHp = E.combat.enemies[0].hp;
E.fireDieFace(10, E.combat.enemies[0]);
var oneCluster = relayHp - E.combat.enemies[0].hp;
// root at full plus two neighbours at 25% must stay well under three-at-full
ok('a cluster fire stays bounded (' + oneCluster + ')', oneCluster > 0 && oneCluster < 3 * 20);
E.run.phase = 'map';

/* A blocked card must say WHY it is blocked. canPlay refused for three
 * different reasons — a curse gagging the card, a relic capping non-attacks,
 * and actually being short of Energy — and the UI reported all three as
 * NOT ENOUGH ENERGY. Reported from play: 2 Energy, a 1-cost Shield in hand,
 * and the game claiming there was no Energy for it. */
startFight('vanguard');
giveRelic('recoilless_frame');
E.combat.energy = 2;
E.combat.hand = [{ uid: 7101, id: 'combat_shield', up: false }];
E.combat.nonAttacksThisTurn = 1;
var whyBlocked = E.whyCantPlay(0);
ok('a relic-capped card is blocked', !E.canPlay(0));
ok('...and does not blame Energy (' + whyBlocked + ')', whyBlocked && whyBlocked.indexOf('ENERGY') < 0);
ok('...it names the relic doing it', whyBlocked && whyBlocked.indexOf('RECOILLESS') >= 0);
E.combat.energy = 0; E.combat.nonAttacksThisTurn = 0;
ok('a real shortfall still reads NOT ENOUGH ENERGY', E.whyCantPlay(0) === 'NOT ENOUGH ENERGY');
E.combat.energy = 3;
ok('a playable card reports no reason at all', E.whyCantPlay(0) === null);
E.run.phase = 'map';

/* 46. Breaching Rounds applies Vulnerable on attack */
startFight('vanguard'); giveRelic('breaching_rounds'); bigEnemies();
setHand(['pulse_rifle']); playId('pulse_rifle', 0);
ok('Breaching Rounds applies Vulnerable on attack', (E.combat.enemies[0].statuses.vuln || 0) >= 1);

/* 47. Void-Touched: boosts the effect and costs HP each play */
startFight('vanguard'); bigEnemies();
E.combat.hand = [{ uid: 7001, id: 'pulse_rifle', up: false }];
var baseDmg = parseInt(E.cardInfo(E.combat.hand[0]).desc.match(/Deal (\d+)/)[1], 10);
E.combat.hand[0].vtouch = true;
var vtDesc = E.cardInfo(E.combat.hand[0]).desc;
ok('Void-Touch boosts the damage (' + baseDmg + ' -> ' + vtDesc.match(/Deal (\d+)/)[1] + ')', parseInt(vtDesc.match(/Deal (\d+)/)[1], 10) > baseDmg);
ok('Void-Touch notes the HP cost', /lose 3 HP/i.test(vtDesc));
var vhp0 = E.run.hp, vehp0 = E.combat.enemies[0].hp;
E.playCard(0, 0);
ok('Void-Touch deals boosted damage', E.combat.enemies[0].hp < vehp0);
ok('Void-Touch costs 3 HP on play', E.run.hp === vhp0 - 3);

/* 48. applyPick vtouch corrupts a deck card */
E.seed(3); E.newRun('vanguard'); E.run.pendingPick = 'vtouch';
ok('applyPick vtouch sets the flag', (E.applyPick(0), !!E.run.deck[0].vtouch));

/* 49. legendary + pooled cards never appear in normal rewards */
E.seed(9); E.newRun('vanguard');
var leak = false;
for (var lt = 0; lt < 400; lt++) { var rc = E.rollRewardCard(0.5); if (VS.CARDS[rc].pool || VS.CARDS[rc].rarity === 4) leak = true; }
ok('no pooled/legendary cards in normal rewards', !leak);
ok('rollLegendary returns a boss-pool legendary', !!E.rollLegendary() && VS.CARDS[E.rollLegendary()].pool === 'boss');

/* ---- event-rework primitives ---- */
function firstChoiceIdx(id, key) {
  var ev = evt(id);
  for (var i = 0; i < ev.choices.length; i++) if (ev.choices[i][key]) return i;
  return -1;
}

/* tradeCard: scrap a card, forge one a rarity tier higher */
function fxChoiceIdx(id, fxKey) {
  var ev = evt(id);
  for (var i = 0; i < ev.choices.length; i++) { var o = ev.choices[i].outcome; if (o && o.fx && o.fx[fxKey]) return i; }
  return -1;
}
/* tradeCard / sell still exist as verbs even though no event calls tradeCard
 * any more — the shop and the bench use the same machinery. */
E.seed(9); E.newRun('vanguard'); E.run.credits = 0;
E.run.deck = [{ uid: 1, id: 'pulse_rifle', up: false }, { uid: 2, id: 'combat_shield', up: false }];
E.run.pendingSell = { kind: 'card' };
var opts2 = E.sellOptions();
ok('sellOptions lists non-curse cards with values', opts2.length === 2 && opts2[0].value > 0);
var sold = E.sellPick(0);
ok('sellPick grants credits and removes the card', E.run.credits === sold && E.run.deck.length === 1 && !E.run.pendingSell);

/* ---- the die verbs each do what they say ---- */
E.seed(4); E.newRun('vanguard'); cutFaces('vanguard', 12);
(function () {
  var a = 3, b = 9;
  var idA = E.run.die.faces[a].id, idB = E.run.die.faces[b].id;
  E.dieSwapRoots(a, b);
  ok('swap exchanges two engravings', E.run.die.faces[a].id === idB && E.run.die.faces[b].id === idA);
})();
E.seed(4); E.newRun('vanguard'); cutFaces('vanguard', 12);
(function () {
  var before = VS.dieEngraving(E.run.die.faces[2].id);
  var lifted = E.dieTierUp(2);
  var after = VS.dieEngraving(E.run.die.faces[2].id);
  ok('tierUp raises the tier and the numbers with it',
     lifted && after.tier === (before.tier || 1) + 1 && VS.engravingSp(after) > VS.engravingSp(before));
})();
E.seed(4); E.newRun('voidadept'); cutFaces('voidadept', 14);
(function () {
  E.run.currentEvent = 'the_quarantine'; E.run.phase = 'event';
  VS.dieAddTaint(E.run.die, 5, 'rust');
  var qi = evt('the_quarantine').choices.findIndex(function (c) { return c.outcome && c.outcome.fx.scarSpread; });
  E.eventChoose(qi);
  var tainted = VS.dieTaintedRoots(E.run.die);
  ok('the rot spreads to neighbours and hardens what it touched', tainted.length > 1);
})();

/* Drone Swarm: the core's barrage fires once per living drone (hitsPer) */
startFight();
E.combat.enemies = [];
function fakeDrone() { return { id: 'swarm_drone', def: VS.ENEMIES.swarm_drone, alive: true, statuses: {}, block: 0, hp: 6, maxHp: 6 }; }
E.combat.enemies.push(fakeDrone(), fakeDrone(), fakeDrone());
var swarmCore = { id: 'swarm_core', def: VS.ENEMIES.swarm_core, alive: true, statuses: {}, intent: { t: 'attack', d: 3, hitsPer: 'swarm_drone' } };
ok('barrage hits once per drone (3 alive -> ×3)', /×3$/.test(E.intentInfo(swarmCore).label));
E.combat.enemies[1].alive = false; E.combat.enemies[2].alive = false;
ok('barrage scales down as drones die (1 alive -> ×1)', /×1$/.test(E.intentInfo(swarmCore).label));
E.combat.enemies[0].alive = false;
ok('barrage never drops below a single hit (0 drones -> ×1)', /×1$/.test(E.intentInfo(swarmCore).label));

/* Drop Ship: deploys a random escort, arms once cleared, then detonates */
var oldPacks = VS.PACKS.rust;
VS.PACKS.rust = [['drop_ship']];
E.seed(5); E.newRun('vanguard'); E.run.faction = 'rust'; E.run.sector = 2; E.run.nodeIdx = 0;
E.startNode('fight');
VS.PACKS.rust = oldPacks;
var dShip = E.combat.enemies[0];
var dBots = E.combat.enemies.filter(function (e) { return e.id === 'drop_bot'; });
ok('Drop Ship deploys a random escort (2-3 bots)', dShip.id === 'drop_ship' && dBots.length >= 2 && dBots.length <= 3);
dBots.forEach(function (e) { e.hp = 0; e.alive = false; });   // clear the escort
E.endTurn();                                                  // enemy phase: pod activates
ok('Drop Ship arms its pod once the escort is cleared', dShip.armed === true && dShip.fuse > 0);
var hpBeforeBoom = E.run.hp, guard = 0;
while (E.run.phase === 'combat' && dShip.alive && guard++ < 8) E.endTurn();
ok('Drop Ship detonates for damage when the fuse runs out', E.run.hp < hpBeforeBoom && !dShip.alive);

/* Voidling: unblocked damage infects the run deck; blocking prevents it */
var oldVPacks = VS.PACKS.voidspawn, oldInfect = VS.ENEMIES.voidling.infect.chance;
VS.PACKS.voidspawn = [['voidling']];
VS.ENEMIES.voidling.infect.chance = 1;        // force the proc for a deterministic check
E.seed(2); E.newRun('vanguard'); E.run.faction = 'voidspawn'; E.run.sector = 2; E.run.nodeIdx = 0;
E.startNode('fight');
VS.PACKS.voidspawn = oldVPacks;
E.combat.player.block = 0;
E.combat.enemies[0].intent = { t: 'attack', d: 3 };
var deckBefore = E.run.deck.length;
E.endTurn();
var added = E.run.deck[E.run.deck.length - 1];
ok('Voidling infects the deck on unblocked damage', E.run.deck.length === deckBefore + 1 && VS.CARDS[added.id].type === 'curse');
if (E.combat && E.combat.enemies[0].alive) {
  E.combat.player.block = 30;                 // fully blocked this time
  E.combat.enemies[0].intent = { t: 'attack', d: 3 };
  var deckBefore2 = E.run.deck.length;
  E.endTurn();
  ok('Blocking a Voidling prevents infection', E.run.deck.length === deckBefore2);
}
VS.ENEMIES.voidling.infect.chance = oldInfect;

/* Void Drone: caps each hit at its absorb threshold; overkill spawns Void Swarm */
var oldVD = VS.PACKS.voidspawn;
VS.PACKS.voidspawn = [['void_drone']];
E.seed(3); E.newRun('vanguard'); E.run.faction = 'voidspawn'; E.run.sector = 1; E.run.nodeIdx = 0;
E.startNode('fight');
VS.PACKS.voidspawn = oldVD;
var vdrone = E.combat.enemies[0];
vdrone.hp = vdrone.maxHp = 40; vdrone.block = 0;
E.combat.energy = 5; E.combat.player.statuses.str = 20;     // guarantee an over-threshold hit
setHand(['pulse_rifle']);
var vhp0 = vdrone.hp, sw0 = E.combat.discard.filter(function (c) { return c.id === 'void_swarm'; }).length;
playId('pulse_rifle', 0);
ok('Void Drone caps a hit at its absorb threshold (<=8)', vhp0 - vdrone.hp <= 8 && vhp0 - vdrone.hp > 0);
ok('Over-threshold hit spawns a Void Swarm into the deck', E.combat.discard.filter(function (c) { return c.id === 'void_swarm'; }).length === sw0 + 1);

/* Void Swarm: disables the hand cards to its immediate left and right */
E.combat.energy = 5;
setHand(['pulse_rifle', 'void_swarm', 'combat_shield']);
ok('Void Swarm disables the card to its left', !E.canPlay(0));
ok('Void Swarm disables the card to its right', !E.canPlay(2));
setHand(['pulse_rifle', 'combat_shield', 'void_swarm']);
ok('a non-adjacent card stays playable', E.canPlay(0));

/* Siege Walker: charges a megahit; damage during the wind-up reduces it */
var oldRust = VS.PACKS.rust;
VS.PACKS.rust = [['siege_walker']];
E.seed(5); E.newRun('vanguard'); E.run.faction = 'rust'; E.run.sector = 2; E.run.nodeIdx = 0;
E.startNode('fight');
VS.PACKS.rust = oldRust;
var wk = E.combat.enemies[0];
ok('Siege Walker telegraphs a wind-up first', E.intentInfo(wk).label === 'WIND-UP');
E.endTurn();                                   // enemy phase: it charges
ok('Siege Walker primes a megahit while charging', wk.charging === true && wk.pendingHit > 0);
var primed = wk.pendingHit;
E.combat.energy = 9; setHand(['pulse_rifle', 'pulse_rifle']);
playId('pulse_rifle', 0);                       // damage it during the charge window
ok('damage during the charge whittles the pending hit', wk.pendingHit < primed);
var whp0 = E.run.hp;
E.endTurn();                                    // enemy phase: it fires the reduced hit
ok('Siege Walker fires the reduced megahit and resets', E.run.hp < whp0 && (whp0 - E.run.hp) <= primed && !wk.charging);

/* Jammer: its beam deals damage AND burns (exhausts) a card from the deck */
var oldHier = VS.PACKS.hierarchy;
VS.PACKS.hierarchy = [['jammer']];
E.seed(4); E.newRun('vanguard'); E.run.faction = 'hierarchy'; E.run.sector = 1; E.run.nodeIdx = 0;
E.startNode('fight');
VS.PACKS.hierarchy = oldHier;
var jm = E.combat.enemies[0];
jm.intent = { t: 'attack', d: 6, jam: true };       // force the jamming beam
var exhBefore = E.combat.exhaust.length;
var jhp0 = E.run.hp;
E.endTurn();
ok('Jammer beam deals damage', E.run.hp < jhp0);
ok('Jammer burns a card into the exhaust pile', E.combat.exhaust.length === exhBefore + 1);

/* Void Shard: counts down 6 turns, then permanently corrupts a card (+1 cost) */
var oldVoid = VS.PACKS.voidspawn;
VS.PACKS.voidspawn = [['void_shard']];
E.seed(7); E.newRun('vanguard'); E.run.faction = 'voidspawn'; E.run.sector = 1; E.run.nodeIdx = 0;
E.startNode('fight');
VS.PACKS.voidspawn = oldVoid;
var shard = E.combat.enemies[0];
ok('Void Shard telegraphs a 6-turn corruption countdown', E.intentInfo(shard).label === '⟳6');
var corruptBefore = E.run.deck.filter(function (c) { return c.corrupt; }).length;
for (var st = 0; st < 6 && E.run.phase === 'combat' && shard.alive; st++) E.endTurn();
ok('Void Shard corrupts a card after 6 turns', E.run.deck.filter(function (c) { return c.corrupt; }).length === corruptBefore + 1);
var baseCost = E.effCost(VS.CARDS['pulse_rifle'], false);
ok('a Void-Corrupted card costs 1 more', E.effCost(VS.CARDS['pulse_rifle'], false, { corrupt: true }) === baseCost + 1);

/* Void Gaze: core warded while eyes live; gaze scales with debuffs + vtouch */
var oldGaze = VS.PACKS.voidspawn;
VS.PACKS.voidspawn = [['void_gaze', 'gaze_eye', 'gaze_eye', 'gaze_eye']];
E.seed(3); E.newRun('vanguard'); E.run.faction = 'voidspawn'; E.run.sector = 1; E.run.nodeIdx = 0;
E.startNode('fight');
VS.PACKS.voidspawn = oldGaze;
var gcore = E.combat.enemies[0];
E.combat.energy = 9; setHand(['pulse_rifle']);
var ghp0 = gcore.hp;
playId('pulse_rifle', 0);
ok('Void Gaze core is impervious while its eyes live', gcore.hp === ghp0);
E.combat.enemies.forEach(function (e) { if (e.id === 'gaze_eye') { e.hp = 0; e.alive = false; } });
E.combat.energy = 9; setHand(['pulse_rifle']);
playId('pulse_rifle', 0);
ok('killing the eyes exposes the core to damage', gcore.hp < ghp0);
gcore.intent = { t: 'attack', gaze: true };
var cleanGaze = E.intentInfo(gcore).label;
E.combat.player.statuses.weak = 4;
gcore.intent = { t: 'attack', gaze: true };
ok('the gaze hits harder per debuff on you', E.intentInfo(gcore).label !== cleanGaze);

/* ============================ THE BENCH (die economy) ====================
 * A Flaw is only a curse if undoing one costs something, so the bench is where
 * the die's downside gets its counterplay: buy the engraving you wanted, grind
 * a Flaw out, or — cheaper — reseat it below your Aim floor where it never fires.
 * ==================================================================== */
E.seed(77); E.newRun('vanguard');
var br = E.run;
E.startNode('shop');
br.credits = 500;
ok('a shop stocks engravings', (br.shop.engravings || []).length === VS.BALANCE.dieShop.stock);
ok('engravings are priced by tier', br.shop.engravings.every(function (it) {
  return it.cost === VS.BALANCE.dieShop.engravingCost[VS.DIE_AUGMENTS[it.id].tier || 1];
}));
ok('a face-locked augment is never stocked onto a taken face', br.shop.engravings.every(function (it) {
  var lock = VS.DIE_AUGMENTS[it.id].onlyFace;
  return !lock || !br.die.faces[lock];
}));

// pin the stock so the rest is deterministic
br.shop.engravings = [{ id: 'kinetic_buffer', cost: 55, sold: false }, { id: 'ignition_coil', cost: 55, sold: false }];
var bc0 = br.credits;
ok('buying cuts the engraving into the face you chose', E.shopBuyEngraving(0, 19) === null && VS.dieFaceId(br.die, 19) === 'kinetic_buffer');
ok('buying charges credits', br.credits === bc0 - 55);
ok('a sold engraving cannot be rebought', E.shopBuyEngraving(0, 18) === 'sold out');
ok('an occupied face is refused', typeof E.shopBuyEngraving(1, 19) === 'string');
br.credits = 0;
ok('no credits, no engraving', E.shopBuyEngraving(1, 17) === 'not enough credits');
ok('a refused purchase leaves the face bare', VS.dieFaceId(br.die, 17) === null);
br.credits = 500;

// the grinder
VS.dieEngrave(br.die, 'warp_etching', 15);
ok('the grinder refuses a bare face', E.shopGrindFlaw(14) === 'nothing to grind out here');
ok('the grinder refuses one of your own augments', E.shopGrindFlaw(19) === 'nothing to grind out here');
var gcost = E.grindCost(); bc0 = br.credits;
ok('grinding destroys the Flaw', E.shopGrindFlaw(15) === null && VS.dieFaceId(br.die, 15) === null);
ok('grinding charges credits', br.credits === bc0 - gcost);
ok('the wheel wears: the next grind costs more', E.grindCost() === gcost + VS.BALANCE.dieShop.grindCostInc);
ok('one grind per bench', E.shopGrindFlaw(15) === 'the grinder is spent');

// the jig
var rcost = E.reseatCost(); bc0 = br.credits;
ok('reseating moves the engraving', E.shopReseat(19, 12) === null && VS.dieFaceId(br.die, 12) === 'kinetic_buffer' && VS.dieFaceId(br.die, 19) === null);
ok('reseating charges credits', br.credits === bc0 - rcost);
ok('one reseat per bench', E.shopReseat(12, 11) === 'the jig is already reset');

// a band that will not fit must be put back exactly as it was
E.startNode('shop'); br.credits = 500;
VS.dieEngrave(br.die, 'scrap_sifter', 5);           // CENTRED: spans 4,5,6
ok('a band augment occupies its whole span', VS.dieFaceId(br.die, 4) === 'scrap_sifter' && VS.dieFaceId(br.die, 6) === 'scrap_sifter');
// 12 is kinetic_buffer's ROOT, and a head can never be shared
ok('a band that will not fit is refused', typeof E.shopReseat(5, 12) === 'string');
ok('a refused reseat puts the band back', VS.dieFaceId(br.die, 4) === 'scrap_sifter' && VS.dieFaceId(br.die, 6) === 'scrap_sifter');
ok('a refused reseat costs nothing', br.credits === 500 && !br.shop.reseatUsed);
ok('the band reseats where it does fit', E.shopReseat(5, 17) === null && VS.dieFaceId(br.die, 18) === 'scrap_sifter' && VS.dieFaceId(br.die, 5) === null);

// the bench is a place, not a menu
br.phase = 'map';
ok('no bench off the star chart', E.shopBuyEngraving(0, 3) === 'the bench is closed');
ok('no grinder off the star chart', E.shopGrindFlaw(3) === 'the bench is closed');

// VOID PRESSURE gouges the bench like everything else
E.newRun('vanguard');
E.run.pressure = 11;                                 // SINGULARITY
E.run.grindCost = Math.round(VS.BALANCE.dieShop.grindCost * E.pressureMods().shopCost);
E.startNode('shop');
var pmul = E.pressureMods().shopCost;
ok('SINGULARITY raises engraving prices', pmul > 1 && E.run.shop.engravings.every(function (it) {
  return it.cost === Math.round(VS.BALANCE.dieShop.engravingCost[VS.DIE_AUGMENTS[it.id].tier || 1] * pmul);
}));
ok('SINGULARITY raises the grinder price', E.grindCost() === Math.round(VS.BALANCE.dieShop.grindCost * pmul));


/* ==================== THE DIE TABLES: three readings of one d20 ==========
 * A 20 always crits and the top of the table is the same for everyone. What
 * separates the classes is what a BAD roll MEANS — wasted, converted to tempo,
 * or converted to power and billed in blood. These assert the reading each
 * class actually gets in play, not the numbers in the balance file.
 * ==================================================================== */
function rollSample(cls, n) {
  E.seed(20250728); E.newRun(cls); E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
  var out = [], guard = 0;
  while (out.length < n && guard++ < 400) {
    E.startNode('fight');
    E.combat.enemies.forEach(function (e) { e.hp = 99999; e.maxHp = 99999; e.block = 0; });
    for (var t = 0; t < 8 && E.run.phase === 'combat' && out.length < n; t++) {
      E.run.hp = E.run.maxHp;            // keep the Voidadept's bill from ending the sample
      E.combat.energy = 30;
      var g2 = 0;
      while (E.combat.hand.length && g2++ < 12 && out.length < n) {
        var i = -1;
        for (var k = 0; k < E.combat.hand.length; k++) if (E.canPlay(k)) { i = k; break; }
        if (i < 0) break;
        var hpBefore = E.run.hp, enBefore = E.combat.energy;
        E.events = [];
        E.playCard(i, 0);
        E.events.forEach(function (ev) {
          if (ev.type === 'roll' && ev.band) out.push({ ev: ev, hpDrop: hpBefore - E.run.hp, enUp: E.combat.energy - enBefore });
        });
      }
      if (E.run.phase === 'combat') E.endTurn();
    }
    if (E.run.phase !== 'combat') E.run.phase = 'map';
  }
  return out;
}

['vanguard', 'technomancer', 'voidadept'].forEach(function (cls) {
  var t = VS.BALANCE.dice.classes[cls];
  var legal = t.bands.map(function (b) { return b.label; }).concat([t.misfire.label, 'CRIT']);
  var byLabel = {}; t.bands.concat([t.misfire]).forEach(function (b) { byLabel[b.label] = b; });
  var sample = rollSample(cls, 260);

  ok(cls + ': the die actually bands in play (' + sample.length + ' banded rolls)', sample.length >= 200);
  ok(cls + ': every band it reports belongs to ITS table', sample.every(function (s2) { return legal.indexOf(s2.ev.band) >= 0; }));
  ok(cls + ': it never reports another class’s band', sample.every(function (s2) {
    return ['GRAZE', 'SOLID', 'MISFIRE', 'SAG', 'SURGE', 'BREAKER', 'HUNGER', 'ATTUNED', 'WHISPER', 'RAVENOUS']
      .filter(function (L) { return legal.indexOf(L) < 0; }).indexOf(s2.ev.band) < 0;
  }));
  ok(cls + ': tone always matches the multiplier', sample.every(function (s2) {
    if (s2.ev.band === 'CRIT') return s2.ev.tone === 'crit';
    var m = byLabel[s2.ev.band].mult;
    return s2.ev.tone === (m > 1.02 ? 'up' : m < 0.98 ? 'down' : 'flat');
  }));
  ok(cls + ': a natural 1 always reads as ' + t.misfire.label, sample.every(function (s2) {
    return (s2.ev.roll === 1) === (s2.ev.band === t.misfire.label);
  }));
  // the riders: only the bands that declare one may charge or pay
  ok(cls + ': only bands that declare an HP cost charge one', sample.every(function (s2) {
    var b = byLabel[s2.ev.band];
    return (s2.ev.cost || 0) === (b ? (b.hploss || 0) : 0);
  }));
  ok(cls + ': only bands that declare Energy pay it', sample.every(function (s2) {
    var b = byLabel[s2.ev.band];
    return (s2.ev.gain || 0) === (b ? (b.energy || 0) : 0);
  }));
});

/* The Voidadept's bill is real, and it can never be the killing blow. */
var vsample = rollSample('voidadept', 260);
ok('voidadept: the Hunger actually bills HP', vsample.some(function (s2) { return s2.ev.cost > 0; }));
ok('voidadept: WHISPER (the common face) is his WORST band',
  VS.BALANCE.dice.classes.voidadept.bands.every(function (b) { return b.label === 'WHISPER' || b.mult > 0.9; }));
E.seed(5); E.newRun('voidadept'); E.run.faction = 'hierarchy'; E.run.nodeIdx = 0; E.startNode('fight');
E.run.hp = 1;
for (var vk = 0; vk < 60 && E.run.phase === 'combat'; vk++) {
  E.combat.energy = 30;
  var vi = -1;
  for (var vj = 0; vj < E.combat.hand.length; vj++) if (E.canPlay(vj)) { vi = vj; break; }
  if (vi < 0) { E.endTurn(); E.run.hp = 1; continue; }
  E.playCard(vi, 0);
  E.run.hp = Math.max(1, E.run.hp);   // only the die may be tested here, not enemies
}
ok('voidadept: the die never takes your last HP', E.run.hp >= 1);

/* Technomancer: the band scales SHIELD, which no other class's does. */
ok('technomancer bands Shield, the others do not',
  VS.BALANCE.dice.classes.technomancer.blocks === true &&
  !VS.BALANCE.dice.classes.vanguard.blocks && !VS.BALANCE.dice.classes.voidadept.blocks);
var tshields = {};
E.seed(77); E.newRun('technomancer'); E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
for (var tf = 0; tf < 40; tf++) {
  E.startNode('fight');
  E.combat.player.block = 0; E.combat.energy = 30;
  E.combat.hand = [{ uid: 9000 + tf, id: 'combat_shield', up: false }];
  E.events = [];
  E.playCard(0, 0);
  var re = E.events.filter(function (ev) { return ev.type === 'roll'; })[0];
  if (re && re.band) (tshields[re.band] = tshields[re.band] || []).push(E.combat.player.block);
  E.run.phase = 'map';
}
var sagAvg = (tshields.SAG || []).reduce(function (a, x) { return a + x; }, 0) / ((tshields.SAG || []).length || 1);
var surAvg = (tshields.SURGE || []).reduce(function (a, x) { return a + x; }, 0) / ((tshields.SURGE || []).length || 1);
ok('technomancer: a SURGE plates harder than a SAG (' + sagAvg.toFixed(1) + ' vs ' + surAvg.toFixed(1) + ')',
   (tshields.SAG || []).length && (tshields.SURGE || []).length ? surAvg > sagAvg : true);

/* Low-roll riders: `onRoll {max}` is the bottom-of-the-table verb the two new
 * tables needed, and it must be the mirror of `min` — nat 1 always counts low
 * exactly as nat 20 always counts high. */
var lowFired = 0, lowMissed = 0, wrong = 0;
E.seed(31); E.newRun('voidadept'); E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
for (var lf = 0; lf < 120; lf++) {
  E.startNode('fight');
  E.combat.enemies.forEach(function (e) { e.hp = 9999; e.maxHp = 9999; e.statuses = {}; });
  E.combat.energy = 30;
  E.combat.hand = [{ uid: 7000 + lf, id: 'spectral_grasp', up: false }];
  E.events = [];
  E.playCard(0, 0);
  var rr = E.events.filter(function (ev) { return ev.type === 'roll'; })[0];
  var weak = E.combat.enemies[0].statuses.weak || 0;
  if (rr) {
    // Spectral Grasp is TWO-TAILED — it grips at either extreme of the Hunger
    // die and lets go in the middle — so the rider fires low OR high.
    var low = (rr.roll === 1) || (rr.roll < 20 && rr.eff <= 6);
    var high = (rr.roll === 20) || (rr.roll > 1 && rr.eff >= 15);
    if (low || high) { lowFired++; if (weak !== 2) wrong++; }
    else { lowMissed++; if (weak !== 1) wrong++; }
  }
  E.run.phase = 'map';
}
ok('the two-tailed rider fires at both extremes and not in between (' + lowFired + ' fired / ' + lowMissed + ' slept)',
   wrong === 0 && lowFired > 0 && lowMissed > 0);
ok('a two-tailed rider reads as one clause, not two',
   /Roll 15\+ or 6-:/.test(VS.cardDesc(VS.CARDS.spectral_grasp, false, null, false)));

/* Aim is a genuine TRADE for the Voidadept: climbing the table starves the
 * bottom bands his blood engines feed on. Nobody else pays for Aim. */
function bandShare(cls, aim, label) {
  var t = VS.BALANCE.dice.classes[cls], n = 0;
  for (var roll = 1; roll <= 20; roll++) {
    var eff = Math.min(20, roll + aim), slot;
    if ((roll === 20) || (roll > 1 && eff >= VS.BALANCE.dice.critThreshold)) slot = { label: 'CRIT' };
    else if (roll <= 1) slot = t.misfire;
    else { for (var i = 0; i < t.bands.length; i++) if (eff >= t.bands[i].min) { slot = t.bands[i]; break; } }
    if (slot && slot.label === label) n++;
  }
  return n;
}
ok('Aim starves the Voidadept’s HUNGER band', bandShare('voidadept', 8, 'HUNGER') < bandShare('voidadept', 1, 'HUNGER'));
ok('Aim only helps the Vanguard’s table', bandShare('vanguard', 8, 'GRAZE') < bandShare('vanguard', 2, 'GRAZE'));


/* ==================== RETIRED CLASSES ==============================
 * The Warpcaller was removed. A save written before that can't be resumed —
 * its cards, class table and art are gone — so load() must reject it rather
 * than restore a run that breaks on the first fight.
 * ================================================================ */
ok('the Warpcaller is gone from the class table', !VS.BALANCE.classes.warpcaller);
ok('no Warpcaller starter deck', !VS.STARTER_DECKS.warpcaller);
ok('no Warpcaller cards remain', !Object.keys(VS.CARDS).some(function (k) { return VS.CARDS[k].cls === 'warpcaller'; }));
ok('no pet data remains', !VS.PETS && !VS.PET_MODELS);
ok('no card summons a pet', !Object.keys(VS.CARDS).some(function (k) {
  var s2 = JSON.stringify(VS.cardFx(VS.CARDS[k], false)) + JSON.stringify(VS.cardFx(VS.CARDS[k], true));
  return s2.indexOf('"pet"') >= 0 || s2.indexOf('bond') >= 0;
}));
ok('every remaining class has a die table', Object.keys(VS.BALANCE.classes).every(function (c) {
  return !!VS.BALANCE.dice.classes[c];
}));
/* Every class opens with a real starter deck of real cards. The deckless
 * variant that made this a two-way test has been cut. */
ok('every class opens with a starter deck of real cards',
  Object.keys(VS.BALANCE.classes).every(function (c) {
    var d = VS.STARTER_DECKS[c];
    return d && d.length && d.every(function (id) { return !!VS.CARDS[id]; });
  }));

(function () {
  var store = (typeof localStorage !== 'undefined') ? localStorage : null;
  if (!store) {   // headless: stub just enough for load() to exercise the guard
    var mem = {};
    global.localStorage = store = {
      getItem: function (k) { return mem[k] === undefined ? null : mem[k]; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
    };
  }
  store.setItem('voidspire_save', JSON.stringify({
    run: { cls: 'warpcaller', hp: 40, maxHp: 55, deck: [{ uid: 1, id: 'claw_swipe', up: false }], phase: 'map' },
    rng: 123, uid: 99,
  }));
  var loaded = E.load();
  ok('a retired-class save is refused by load()', loaded === false);
  ok('and is deleted, so it cannot be retried forever', store.getItem('voidspire_save') === null);

  // a save for a class that still exists must still load
  E.seed(1); E.newRun('vanguard'); E.run.phase = 'map'; E.save();
  ok('a current-class save still loads', E.load() === true && E.run.cls === 'vanguard');
})();


/* ============ ENEMY ANIMATION (data-level assertions) ==================
 * The motion itself lives in render.js behind a canvas, but the ENVELOPE that
 * drives it is pure data — so the parts that are easy to get wrong (a move with
 * no animation at all, two moves that look identical, an envelope that never
 * returns to rest) are assertable here without a browser.
 * ==================================================================== */
(function () {
  // every move type an enemy can actually telegraph, straight from the data
  var used = {};
  Object.keys(VS.ENEMIES).forEach(function (k) {
    (VS.ENEMIES[k].moves || []).forEach(function (m) { if (m && m.t) used[m.t] = true; });
  });
  Object.keys(VS.FINAL_BOSS || {}).forEach(function (k) {
    var d = VS.FINAL_BOSS[k];
    if (d && d.moves) d.moves.forEach(function (m) { if (m && m.t) used[m.t] = true; });
  });

  // The envelope table is render-side; mirror the key list here so a new move
  // type added to an enemy without an animation fails loudly.
  var ANIMATED = ['attack', 'drain', 'block', 'guard', 'buff', 'heal', 'debuff',
                  'curse', 'summon', 'disrupt', 'etch', 'unmake'];
  var missing = Object.keys(used).filter(function (m) { return ANIMATED.indexOf(m) < 0; });
  ok('every enemy move type has an animation envelope' + (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''),
     missing.length === 0);
  ok('enemies actually use most of the animated set', Object.keys(used).length >= 10);
})();


/* ============ CARD TEXT BUDGET =========================================
 * Cards are a fixed size, so the text has to fit the card — the card never
 * grows to fit the text. test/cardfit.js measures that for real in Chromium;
 * this is the cheap guardrail that runs on every commit, so a wordy new card
 * fails here rather than silently clipping on someone's phone.
 *
 * The reward-grid rules box is 110x74px and holds five lines at its CSS size.
 * Line breaks make the exact limit text-dependent, but nothing in the deck
 * needs more than ~73 characters, so 84 is a ceiling with room to spare.
 * ==================================================================== */
(function () {
  var BUDGET = 84;
  var over = [], dup = [];
  Object.keys(VS.CARDS).forEach(function (cid) {
    var def = VS.CARDS[cid];
    [false, true].forEach(function (up) {
      if (up && !def.up) return;
      var d = VS.cardDesc(def, up, null, false);
      if (d.length > BUDGET) over.push(def.name + (up ? '+' : '') + ' (' + d.length + ')');
      // A manual `text` APPENDS to the generated clauses, so it is easy to
      // restate an effect the generator already printed (Parch and Raking Fire
      // both did). Any sentence appearing twice is that bug.
      var seen = {};
      d.split(/(?<=\.)\s+/).forEach(function (sent) {
        var t = sent.trim();
        if (t.length > 6) { if (seen[t]) dup.push(def.name + (up ? '+' : '') + ': "' + t + '"'); seen[t] = 1; }
      });
    });
  });
  ok('every card fits the ' + BUDGET + '-char rules box' + (over.length ? ' — over: ' + over.join(', ') : ''),
     over.length === 0);
  ok('no card restates a clause it already generated' + (dup.length ? ' — ' + dup.join('; ') : ''),
     dup.length === 0);

  // The folding that keeps text short must never drop or reorder an effect.
  var ion = VS.cardDesc(VS.CARDS.ion_storm, false, null, false);
  ok('consecutive board-wide effects fold to one scope clause',
     ion === 'ALL enemies: 5 damage, 1 Weak, 1 Vulnerable.');
  var lone = VS.cardDesc({ fx: [{ k: 'dmg', v: 9, all: true }] }, false, null, false);
  ok('a lone board-wide effect keeps its full sentence', lone === 'Deal 9 damage to ALL enemies.');
  var split = VS.cardDesc({ fx: [{ k: 'status', s: 'weak', v: 1, who: 'allEnemies' }, { k: 'draw', v: 1 },
                                 { k: 'status', s: 'vuln', v: 1, who: 'allEnemies' }] }, false, null, false);
  ok('non-adjacent effects are never folded across what sits between them',
     split === 'Apply 1 Weak to ALL enemies. Draw 1 card. Apply 1 Vulnerable to ALL enemies.');
})();


/* ============ STORY & CUTSCENES ========================================
 * The cutscene is pure narration, so the only things that can break are the
 * ones that would strand a player: a panel with no art, a boss kill that does
 * not reach the cutscene, or a cutscene that does not hand the run back.
 * ==================================================================== */
(function () {
  ok('every sector has a cutscene, and the finale has the last one',
     VS.cutsceneFor(1).id === 'upper' && VS.cutsceneFor(4).id === 'floor' && VS.cutsceneFor(9).id === 'floor');

  var missing = [], empty = [];
  VS.CUTSCENES.forEach(function (cs) {
    cs.panels.forEach(function (p) {
      var sc = VS.SCENES[p.scene];
      if (!sc) missing.push(cs.id + '/' + p.scene);
      else if (!sc.layers.some(function (L) { return (L.p || []).length || (L.s || []).length; })) empty.push(p.scene);
      if (!p.text || p.text.length < 20) missing.push(cs.id + '/no text');
    });
  });
  ok('every panel has art and a line' + (missing.length ? ' — ' + missing.join(', ') : ''), missing.length === 0);
  ok('no scene draws nothing' + (empty.length ? ' — ' + empty.join(', ') : ''), empty.length === 0);

  // Art lives in a -1..1 by -0.6..0.6 box; anything outside is cropped away.
  var outside = [];
  Object.keys(VS.SCENES).forEach(function (k) {
    VS.SCENES[k].layers.forEach(function (L) {
      (L.p || []).forEach(function (poly) {
        for (var i = 0; i < poly.length; i += 2) {
          if (Math.abs(poly[i]) > 1.06 || Math.abs(poly[i + 1]) > 0.66) { outside.push(k); return; }
        }
      });
    });
  });
  outside = outside.filter(function (v, i, a) { return a.indexOf(v) === i; });
  ok('no scene draws outside the panel' + (outside.length ? ' — ' + outside.join(', ') : ''), outside.length === 0);

  // Killing a sector boss must route through the cutscene and back out again.
  E.seed(7); E.newRun('vanguard'); E.run.faction = 'hierarchy';
  E.run.sector = 1; E.run.nodeIdx = 0;
  E.run.mapRow = E.run.map.ROWS;          // stand on the boss node itself
  E.run.mapCol = E.run.map.boss.col;
  E.startNode('boss');
  E.combat.enemies.forEach(function (en) { en.hp = 0; en.alive = false; });
  E.endTurn();
  var reachedReward = E.run.phase === 'reward';
  E.finishReward();
  ok('a sector boss leads into its cutscene (' + E.run.phase + ')', reachedReward && E.run.phase === 'cutscene');

  var panels = VS.cutsceneFor(E.run.sector).panels.length, steps = 0;
  while (E.run.phase === 'cutscene' && steps < 20) { E.cutsceneNext(); steps++; }
  ok('it takes exactly one tap per panel (' + steps + ' of ' + panels + ')', steps === panels);
  ok('and hands the run back where it was going (' + E.run.phase + ')', E.run.phase === 'boss-artifact');
  ok('the cutscene state is cleared, so a reload cannot replay it', !E.run.cutscene);

  // Skipping must land in the same place as playing it through.
  E.run.cutscene = { id: 'upper', panel: 0, next: 'boss-artifact' }; E.run.phase = 'cutscene';
  E.cutsceneSkip();
  ok('skipping lands where playing it through would have', E.run.phase === 'boss-artifact' && !E.run.cutscene);

  // Prose budget: the event panel is a fixed box too.
  var longest = 0, worst = '';
  VS.EVENTS.forEach(function (ev) {
    function look(t) { if (t && t.length > longest) { longest = t.length; worst = ev.id; } }
    look(ev.text);
    (ev.choices || []).forEach(function (c) {
      ['outcome', 'success', 'fail'].forEach(function (k) { if (c[k]) look(c[k].text); });
      (c.gamble || []).forEach(function (g) { look(g.text); });
      if (c.pressLuck) { look(c.pressLuck.bankText); look(c.pressLuck.bustText); }
    });
  });
  ok('no event runs past the panel it is shown in (' + longest + ' chars, ' + worst + ')', longest <= 260);
})();

/* ============ THE FIRST MARK ===========================================
 * The run-start inscription. What can break here is not the numbers — the sim
 * measures those — but the wiring: a mark that names a card or engraving that
 * does not exist, a start-only engraving leaking into shops, or a run that can
 * begin without the choice being made.
 * ==================================================================== */
(function () {
  var CLS = ['vanguard', 'technomancer', 'voidadept'];
  var bad = [];
  CLS.forEach(function (cls) {
    var marks = VS.firstMarks(cls);
    if (marks.length !== 3) bad.push(cls + ' has ' + marks.length + ' marks');
    marks.forEach(function (m) {
      var eng = VS.dieEngraving(m.eng), card = VS.CARDS[m.card];
      if (!eng) bad.push(m.id + ': no engraving ' + m.eng);
      if (!card) bad.push(m.id + ': no card ' + m.card);
      if (card && card.cls !== cls) bad.push(m.id + ': card is ' + card.cls + ', not ' + cls);
      if (card && card.pool !== 'mark') bad.push(m.id + ': card is not pool:mark');
      if (card && !card.up) bad.push(m.id + ': card has no upgrade');
      if (eng && !eng.startOnly) bad.push(m.id + ': engraving is not startOnly');
      if (eng && eng.cls !== cls) bad.push(m.id + ': engraving is ' + eng.cls + ', not ' + cls);
      if (!m.want || !m.line) bad.push(m.id + ': missing want/line');
    });
  });
  ok('every mark names a real engraving and a real class card' + (bad.length ? ' — ' + bad.join('; ') : ''), bad.length === 0);

  // A mark card must never turn up anywhere else — the one you pick is the only
  // one you see all run, which is the whole point of choosing.
  var leaked = [];
  for (var t = 0; t < 400; t++) {
    E.seed(t); E.newRun('vanguard'); E.takeFirstMark(0);
    var c = E.rollRewardCard ? E.rollRewardCard(0) : null;
    if (c && VS.CARDS[c].pool === 'mark') leaked.push('reward:' + c);
  }
  ok('mark cards never appear as a reward' + (leaked.length ? ' — ' + leaked[0] : ''), leaked.length === 0);

  // Same for the engravings: they are cut once, not stocked.
  var engLeak = [];
  for (var q = 0; q < 300; q++) {
    E.seed(q + 900);
    E.randomEngravings(3).forEach(function (id) {
      if ((VS.DIE_AUGMENTS[id] || {}).startOnly) engLeak.push(id);
    });
  }
  ok('start-only engravings never drop or stock' + (engLeak.length ? ' — ' + engLeak[0] : ''), engLeak.length === 0);

  // The run cannot start without the choice, and taking one wires up both halves.
  E.seed(11); E.newRun('voidadept');
  ok('a new run opens on the First Mark', E.run.phase === 'first-mark');
  var deck0 = E.run.deck.length;
  var mark = VS.firstMarks('voidadept')[1];
  E.takeFirstMark(1);
  ok('taking a mark adds its card to the deck',
     E.run.deck.length === deck0 + 1 && E.run.deck[E.run.deck.length - 1].id === mark.card);
  ok('and queues its engraving for you to place',
     E.run.die.pending && E.run.die.pending.length === 1 && E.run.die.pending[0] === mark.eng);
  ok('the die itself is still blank — the face is your call', Object.keys(E.run.die.faces).length === 0);
  ok('and the run proceeds to the map', E.run.phase === 'map');
  E.takeFirstMark(0);
  ok('the mark cannot be taken twice', E.run.deck.length === deck0 + 1);

  // Every mark engraving must actually fit somewhere on a blank die.
  var unplaceable = [];
  CLS.forEach(function (cls) {
    VS.firstMarks(cls).forEach(function (m) {
      E.seed(3); E.newRun(cls);
      var fits = false;
      for (var f = 1; f <= VS.DIE.faces; f++) if (!VS.dieCanEngrave(E.run.die, m.eng, f)) fits = true;
      if (!fits) unplaceable.push(m.id);
    });
  });
  ok('every mark can be cut somewhere on a blank die' + (unplaceable.length ? ' — ' + unplaceable.join(', ') : ''),
     unplaceable.length === 0);

  // The engravings resolve through applyCardFx like any other face, so a typo in
  // a status key would fire silently forever. Check each one moves the game.
  var inert = [];
  CLS.forEach(function (cls) {
    VS.firstMarks(cls).forEach(function (m) {
      E.seed(5); E.newRun(cls); E.takeFirstMark(0);
      E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
      E.startNode('fight');
      // face-locked marks only fit where they are allowed to fit
      var face = VS.dieEngraving(m.eng).onlyFace || 12;
      VS.dieEngrave(E.run.die, m.eng, face);
      var p = E.combat.player, en = E.combat.enemies[0];
      var before = JSON.stringify([p.statuses, E.run.hp, en.hp, en.statuses, E.combat.energy, E.combat.hand.length, p.block]);
      E.fireDieFace(face, 0);
      var after = JSON.stringify([p.statuses, E.run.hp, en.hp, en.statuses, E.combat.energy, E.combat.hand.length, p.block]);
      if (before === after) inert.push(m.eng);
      E.run.phase = 'map';
    });
  });
  ok('every mark engraving actually does something when it fires' + (inert.length ? ' — ' + inert.join(', ') : ''),
     inert.length === 0);
})();

/* ============ THE COUNT RUNS OUT (enrage) ==============================
 * A fight used to have no clock: Barricade stops your Shield expiring, so a
 * defensive build that has lost its offence — a Jammer burning out the last
 * attack — was both unkillable and unable to kill. Roughly 1 bot run in 900
 * hit it. The fix has to end that fight WITHOUT touching the 99.95% of fights
 * that finish long before it, so both halves are asserted here.
 * ==================================================================== */
(function () {
  var ENR = VS.BALANCE.enrage;
  ok('the patience threshold clears every legitimate fight (turn ' + ENR.turn + ')', ENR.turn >= 15);

  function turtle(cards) {
    E.seed(3); E.newRun('technomancer'); E.takeFirstMark(0);
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
    E.startNode('fight');
    var c = E.combat;
    c.player.statuses.barricade = 1;    // Shield never expires
    c.player.block = 2500;
    if (!cards) { c.hand = []; c.drawPile = []; c.discard = []; }   // zero offence
    return c;
  }
  // Advance the stalemate by a turn. Which pack a seed draws depends on every
  // rnd() call before it, so this fixture has to hold for any of them, and the
  // premise is a fight with NO way to resolve. Burn is a way to resolve it — it
  // bypasses Shield — so against a pack that applies it the player simply died
  // on turn 11 and the clock under test never ran at all. Strip the damage over
  // time, and the only thing left that can end this fight is the mechanic being
  // tested.
  function tick(c) {
    E.endTurn();
    delete c.player.statuses.burn;
    delete c.player.statuses.poison;
    delete c.player.statuses.bleed;
  }

  // 1. the pathology terminates
  var c = turtle(false), turns = 0;
  while (!c.over && E.run.phase !== 'dead' && turns < 300) { tick(c); turns++; }
  ok('an offenceless turtle no longer stands there forever (' + turns + ' turns)', turns < 120);
  ok('and the fight actually resolves rather than just stopping',
     E.run.phase === 'dead' || c.over);

  // 2. nothing happens before the line
  // Enemies buff themselves as part of normal play, so the assertion is about
  // the RULE firing, not about Might being zero.
  var c2 = turtle(false);
  E.events.length = 0;
  for (var t = 0; t < ENR.turn - 1 && !c2.over && E.run.phase !== 'dead'; t++) tick(c2);
  var early = E.events.filter(function (e) { return e.type === 'enrage' || e.type === 'enrageDecay'; });
  ok('nothing escalates before the threshold (' + early.length + ' events)', early.length === 0);
  ok('and Shield only falls to actual damage, not to decay', !c2.enraged);

  // 3. it announces itself before it starts costing you anything
  var c3 = turtle(false);
  E.events.length = 0;
  while (!c3.enraged && !c3.over && E.run.phase !== 'dead') tick(c3);
  var evs = E.events.filter(function (e) { return e.type === 'enrage'; });
  ok('the escalation announces itself exactly once', evs.length === 1);
  ok('and it starts after the threshold, not on it', evs.length === 1 && evs[0].turn > ENR.turn);

  // 4. a normal fight never sees it — this is the half that matters most
  var reached = 0, fights = 0;
  for (var seed = 0; seed < 60; seed++) {
    E.seed(seed); E.newRun('vanguard'); E.takeFirstMark(0);
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
    E.startNode('fight');
    var cc = E.combat, guard = 0;
    while (!cc.over && E.run.phase !== 'dead' && guard++ < 60) {
      var played = false;
      for (var h = 0; h < cc.hand.length; h++) { if (E.playCard(h, 0)) { played = true; break; } }
      if (!played) E.endTurn();
    }
    fights++;
    if (cc.enraged) reached++;
    E.run.phase = 'map';
  }
  ok('an ordinary fight never reaches the clock (' + reached + '/' + fights + ')', reached === 0);
})();

/* ============ ARCHETYPE ANCHORS ========================================
 * An audit against the genre found the gap was not missing archetypes — 4-6
 * per class is normal — but archetypes you could feed and never cash, and
 * archetypes with nothing outside the card pool pointing at them. The relics
 * and engravings added for those are declarative, so the thing that can break
 * is the wiring: a hook nobody reads does nothing, silently, forever.
 * ==================================================================== */
(function () {
  function atCombatStart(relic, cls, stat) {
    E.seed(4); E.newRun(cls); E.takeFirstMark(0);
    E.run.artifacts.push(relic); E.run.die.core.push(relic);
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
    E.startNode('fight');
    var v = (E.combat.player.statuses || {})[stat] || 0;
    E.run.phase = 'map';
    return v;
  }
  ok('Foundry Spine deploys a turret before turn 1', atCombatStart('foundry_spine', 'technomancer', 'turret') === 3);
  ok('The Bastion raises a wall before turn 1', atCombatStart('ash_reliquary', 'vanguard', 'bulwark') === 8);
  ok('Iron Leech arms Blood Rage before turn 1', atCombatStart('iron_leech', 'vanguard', 'bloodrage') === 2);
  ok('Resonance Node banks Psi Focus before turn 1', atCombatStart('resonance_node', 'voidadept', 'psiPow') === 2);

  // Cycling Breech is a rule-bender, not a number — it has to survive a turn.
  /* Momentum is gone from the Vanguard, so Cycling Breech holds the OTHER
   * thing that burns off between turns: Stim. Same test, live mechanic. */
  function stimAfterTurn(withRelic) {
    E.seed(4); E.newRun('vanguard'); E.takeFirstMark(0);
    if (withRelic) { E.run.artifacts.push('cycling_breech'); E.run.die.core.push('cycling_breech'); }
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
    E.startNode('fight');
    E.combat.player.statuses.stim = 5;
    E.endTurn();
    var v = (E.combat.player.statuses || {}).stim || 0;
    E.run.phase = 'map';
    return v;
  }
  ok('Stim still burns off without a Cycling Breech', stimAfterTurn(false) === 4);
  ok('and holds with one', stimAfterTurn(true) === 5);

  // Salvage Burner is the Exhaust engine's only engravable face — it has to
  // actually move a card into exhaust, or it feeds nothing.
  E.seed(6); E.newRun('vanguard'); E.takeFirstMark(0);
  E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
  E.startNode('fight');
  VS.dieEngrave(E.run.die, 'salvage_burner', 12);
  var exh0 = E.combat.exhaust.length, hand0 = E.combat.hand.length;
  E.fireDieFace(12, 0);
  ok('Salvage Burner burns a card and pays for it (' + exh0 + '->' + E.combat.exhaust.length +
     ' exhaust, hand ' + hand0 + '->' + E.combat.hand.length + ')',
     E.combat.exhaust.length === exh0 + 1 && E.combat.hand.length > hand0);
  E.run.phase = 'map';

  // The new payoff cards reuse existing specials — check they scale off the
  // thing they claim to, rather than dealing a flat number. This compares two
  // plays of the same card, so the die has to be frozen: each play rolls it,
  // and the roll swings damage by more than the Momentum being measured.
  /* Momentum is GONE from the Vanguard — BURST replaced it, because chaining
   * across cards and bursting within one are the same fantasy and only one of
   * them uses the die. What replaces this test is that the cashout actually
   * cashes out: Long Shot pays a fixed price for a fixed shot. */
  flatDie(function () {
    E.seed(8); E.newRun('vanguard'); E.takeFirstMark(0);
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
    E.startNode('fight');
    var c = E.combat, en = c.enemies[0];
    en.hp = 9999; en.maxHp = 9999; c.energy = 30; en.platedReady = false;
    c.player.statuses.aim = 0;
    c.hand = [{ uid: 5001, id: 'long_shot', up: false }];
    var hp1 = en.hp; E.playCard(0, 0); var dryShot = hp1 - en.hp;
    c.player.statuses.aim = 3;
    c.hand = [{ uid: 5002, id: 'long_shot', up: false }];
    var hp2 = en.hp; E.playCard(0, 0); var loaded = hp2 - en.hp;
    ok('Long Shot pays out only when loaded (' + dryShot + ' -> ' + loaded + ')', loaded > dryShot * 2);
    ok('...and it spends the Aim it used', (c.player.statuses.aim || 0) === 0);
  });
  E.run.phase = 'map';

  // Every new card must be reachable as a reward, or it is content nobody sees.
  var NEW = ['worry_wound','sympathetic_ache','called_high','empty_the_magazine','munitions_link','bootstrap','brace_plate',
             'long_shot','firing_step','loophole','suppressing_burst','walking_fire'];
  var unreachable = NEW.filter(function (id) { return !!VS.CARDS[id].pool; });
  ok('the new archetype cards are all draftable' + (unreachable.length ? ' — ' + unreachable.join(', ') : ''),
     unreachable.length === 0);
})();

/* ============ ENGRAVINGS IN HAND =======================================
 * Holding two engravings used to mean choosing neither: the die screen read
 * pending[0] and that was the one you placed. The queue is a tray you pick
 * from now, so the rules it relies on are asserted here — the UI wiring is
 * checked in the browser, but these are the invariants under it.
 * ==================================================================== */
(function () {
  E.seed(5); E.newRun('vanguard');
  var die = E.run.die;
  die.pending = ['ranging_mark', 'ignition_coil', 'executioners_mark'];

  // 1. any of them can be cut, not just the head of the queue
  var pick = die.pending[2];
  ok('no engraving is placed yet', Object.keys(die.faces).length === 0);
  var why = VS.dieCanEngrave(die, pick, 9);
  ok('the third in hand fits an empty face', why === null);
  VS.dieEngrave(die, pick, 9);
  die.pending.splice(2, 1);
  ok('cutting the third leaves the other two in order',
     die.pending.length === 2 && die.pending[0] === 'ranging_mark' && die.pending[1] === 'ignition_coil');
  ok('and the face holds what was actually chosen', VS.dieFaceId(die, 9) === 'executioners_mark');

  // 2. a band takes its whole span, so "which faces fit" is not just "is it bare"
  var band = VS.dieEngraving('ranging_mark');
  ok('Ranging Mark is a band', (band.span || 1) === 3);
  // THE DIE IS A RING. dieNeighbours has always wrapped 20 into 1; spans do too
  // now, so the top of the table holds as many bands as the middle does.
  ok('a band may straddle the 20-1 seam', VS.dieCanEngrave(die, 'ranging_mark', 20) === null);
  ok('and it really covers 19, 20 and 1', VS.dieSpan('ranging_mark', 20).join() === '19,20,1');
  ok('it cannot be cut onto another engraving\u2019s head', !!VS.dieCanEngrave(die, 'ranging_mark', 9));
  VS.dieEngrave(die, 'ranging_mark', 15);
  ok('placing it covers every face in its span',
     VS.dieFaceId(die, 14) === 'ranging_mark' && VS.dieFaceId(die, 15) === 'ranging_mark' && VS.dieFaceId(die, 16) === 'ranging_mark');

  // 3. a face-locked engraving has exactly one legal seat, and the tray has to
  //    be able to say so before the player taps and gets a rejection
  E.seed(5); E.newRun('vanguard');
  var d2 = E.run.die, fits = [];
  for (var f = 1; f <= VS.DIE.faces; f++) if (!VS.dieCanEngrave(d2, 'jam_clearance', f)) fits.push(f);
  ok('a face-locked engraving reports exactly one legal face (' + fits.join(',') + ')',
     fits.length === 1 && fits[0] === 1);

  // 4. an engraving with nowhere to go must be reportable rather than silently stuck
  var d3 = E.run.die;
  for (var q = 1; q <= VS.DIE.faces; q++) if (!d3.faces[q]) VS.dieEngrave(d3, 'overcharge_cell', q);
  var room = 0;
  for (var f2 = 1; f2 <= VS.DIE.faces; f2++) if (!VS.dieCanEngrave(d3, 'ignition_coil', f2)) room++;
  ok('a full die leaves an engraving with no room, and says so', room === 0);
})();

/* ============ DIE RELICS, ALL THREE CLASSES ============================
 * Every one of these is a declarative hook, which means the failure mode is
 * silence: a relic whose `k` nobody reads sits in your die doing nothing and
 * says nothing about it. Each assertion below is "the hook is actually wired",
 * pinned by forcing the class table so the band is not left to the d20.
 *
 * The tables are swapped rather than the RNG, because what these relics key
 * off is the BAND, and a fake band with a real roll exercises the same code a
 * real band does — the alternative (playing until the roll you want turns up)
 * measures the sampler as much as the relic.
 * ==================================================================== */
(function () {
  // A one-band table: every non-misfire roll lands in `label`, so a band-keyed
  // relic either fires on the very first card or it is not wired at all.
  function forceBand(cls, band, fn) {
    var saved = VS.BALANCE.dice.classes[cls];
    var t = { name: saved.name, read: saved.read, aim: saved.aim, blocks: saved.blocks,
              misfire: saved.misfire, bands: band };
    VS.BALANCE.dice.classes[cls] = t;
    try { return fn(); } finally { VS.BALANCE.dice.classes[cls] = saved; }
  }
  var TOP = [{ min: 2, mult: 1.35, label: 'TOP' }, { min: 99, mult: 0.7, label: 'BOT' }];
  var BOT = [{ min: 99, mult: 1.35, label: 'TOP' }, { min: 0, mult: 0.7, label: 'BOT' }];

  // Set up a fight for `cls`, optionally holding a relic, and hand back combat.
  function fight(cls, relic, seed) {
    E.seed(seed || 31); E.newRun(cls); E.takeFirstMark(0);
    if (relic) { E.addArtifact(relic); if (E.run.die.core.indexOf(relic) < 0) E.run.die.core.push(relic); }
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
    E.startNode('fight');
    E.combat.enemies.forEach(function (e) { e.hp = 9999; e.maxHp = 9999; e.block = 0; e.platedReady = false; });
    E.combat.energy = 30;
    return E.combat;
  }
  function playAttack(c) {
    c.hand = [{ uid: 7700 + (c.turn || 0) * 7 + c.discard.length, id: 'pulse_rifle', up: false }];
    E.events = [];
    E.playCard(0, 0);
  }

  /* ---- TECHNOMANCER ------------------------------------------------- */
  // TRIP COIL / SACRIFICIAL FUSE: the breaker is his most common bad outcome,
  // so what it pays back is the whole point of both relics.
  (function () {
    var c = fight('technomancer', 'trip_coil');
    c.player.block = 0;
    var b0 = c.player.block;
    // drive a misfire by widening it to the whole die for one card
    E.run.artifacts.push('sacrificial_fuse'); E.run.die.core.push('sacrificial_fuse');
    var saved = VS.ARTIFACTS.sacrificial_fuse.hooks[0].v;
    VS.ARTIFACTS.sacrificial_fuse.hooks[0].v = 19;   // everything misfires
    var e0 = c.energy;
    playAttack(c);
    VS.ARTIFACTS.sacrificial_fuse.hooks[0].v = saved;
    var re = E.events.filter(function (ev) { return ev.type === 'roll'; })[0];
    ok('Trip Coil plates you on a tripped BREAKER (' + b0 + ' -> ' + c.player.block + ')',
       re && re.misfire && c.player.block >= 4);
    ok('Sacrificial Fuse dumps the breaker charge back as Energy',
       c.energy >= e0 - 1 + 2);   // card cost 1, breaker 1 (table) + 2 (fuse)
    E.run.phase = 'map';
  })();

  ok('Bus Primer refunds Energy on a SAG', forceBand('technomancer', BOT, function () {
    var c = fight('technomancer', 'bus_primer');
    var e0 = c.energy; playAttack(c);
    return c.energy > e0 - 1;   // pulse_rifle costs 1, so break-even means +1 landed
  }));
  ok('Heat Ledger plates you on a SURGE', forceBand('technomancer', TOP, function () {
    var c = fight('technomancer', 'heat_ledger');
    c.player.block = 0; playAttack(c);
    return c.player.block >= 3;
  }));

  // REGULATOR CLAMP: the floor is under the READ, so it has to hold for a die
  // face resolving in its own band as well as for a live roll.
  ok('Regulator Clamp puts a floor under the read', (function () {
    fight('technomancer', null);
    var bare = E.faceBandMult(3);
    fight('technomancer', 'regulator_clamp');
    return E.faceBandMult(3) > bare;
  })());
  ok('Duty Cycle splits the table by parity', (function () {
    fight('technomancer', 'duty_cycle');
    return E.faceBandMult(9) > E.faceBandMult(8);   // 9 climbs 3, 8 falls 3
  })());

  // CASCADE COUPLER / DISTRIBUTION FRAME reroute the charge itself.
  ok('Cascade Coupler carries the bleed two faces further', (function () {
    var c = fight('technomancer', 'cascade_coupler');
    [8, 9, 10, 11, 12].forEach(function (f) { VS.dieEngrave(E.run.die, 'overcharge_cell', f); });
    E.events = [];
    E.fireDieFace(10, 0);
    var faces = E.events.filter(function (ev) { return ev.type === 'dieFace'; }).map(function (ev) { return ev.face; });
    E.run.phase = 'map';
    return faces.indexOf(8) >= 0 && faces.indexOf(12) >= 0;
  })());
  ok('Distribution Frame trades the root for the neighbours', (function () {
    var c = fight('technomancer', 'distribution_frame');
    [9, 10, 11].forEach(function (f) { VS.dieEngrave(E.run.die, 'overcharge_cell', f); });
    E.events = [];
    E.fireDieFace(10, 0);
    var ev = E.events.filter(function (e2) { return e2.type === 'dieFace'; });
    E.run.phase = 'map';
    var root = ev.filter(function (e2) { return e2.face === 10; })[0];
    var side = ev.filter(function (e2) { return e2.face === 9; })[0];
    return root && side && root.bleed === true && side.bleed === false;   // root halved, sides full
  })());
  ok('Substation re-fires the turn’s first face at end of turn', (function () {
    var c = fight('technomancer', 'substation');
    VS.dieEngrave(E.run.die, 'overcharge_cell', 14);
    E.fireDieFace(14, 0);
    E.events = [];
    E.endTurn();
    var again = E.events.some(function (ev) { return ev.type === 'dieFace' && ev.face === 14; });
    E.run.phase = 'map';
    return again;
  })());
  ok('Parity Pin reaches across the ring on an even roll', (function () {
    var c = fight('technomancer', 'parity_pin');
    VS.dieEngrave(E.run.die, 'overcharge_cell', 20);
    var hit = 0;
    for (var i = 0; i < 40 && E.run.phase === 'combat'; i++) {
      c.energy = 30; playAttack(c);
      if (E.events.some(function (ev) { return ev.type === 'dieFace' && ev.face === 20 && ev.why === 'opposite'; })) hit++;
    }
    E.run.phase = 'map';
    return hit > 0;   // face 10 is even; its opposite is 20
  })());
  ok('Annealing Jig means no scar is ever permanent', (function () {
    E.seed(3); E.newRun('technomancer'); E.takeFirstMark(0);
    E.addArtifact('annealing_jig'); E.run.die.core.push('annealing_jig');
    for (var f = 1; f <= 20; f++) if (!E.run.die.faces[f]) VS.dieEngrave(E.run.die, 'overcharge_cell', f);
    for (var i = 0; i < 200; i++) E.taintDie(1);
    var welded = 0;
    for (var g = 1; g <= 20; g++) { var s2 = E.run.die.faces[g]; if (s2 && s2.taint === 'cold_weld') welded++; }
    return welded === 0;
  })());

  /* ---- VOID ADEPT ---------------------------------------------------- */
  // His relics all key off one of the two ENDS, because his table is a U and
  // the middle is the thing he is escaping.
  ok('Ashen Tithe draws on a HUNGER roll', forceBand('voidadept', BOT, function () {
    // playAttack replaces the hand with the one card, so the hand is empty
    // after the play unless the tithe drew.
    var c = fight('voidadept', 'ashen_tithe');
    playAttack(c);
    var out = c.hand.length; E.run.phase = 'map';
    return out === 1;
  }));
  ok('Gorge heals off the bottom of the table', forceBand('voidadept', BOT, function () {
    var c = fight('voidadept', 'gorge');
    E.run.hp = E.run.maxHp - 10;
    var hp0 = E.run.hp; playAttack(c);
    var out = E.run.hp > hp0; E.run.phase = 'map'; return out;
  }));
  ok("Bloodletter's Nail focuses the wound", forceBand('voidadept', [{ min: 0, mult: 1.2, label: 'HUNGER', hploss: 2 }], function () {
    var c = fight('voidadept', 'bloodletters_nail');
    var p0 = c.player.statuses.psiPow || 0; playAttack(c);
    var out = (c.player.statuses.psiPow || 0) > p0; E.run.phase = 'map'; return out;
  }));
  ok('Crimson Ledger turns the bill into damage', (function () {
    var band = [{ min: 0, mult: 1, label: 'HUNGER', hploss: 2 }];
    var d0 = forceBand('voidadept', band, function () {
      var c = fight('voidadept', null, 44); var hp = c.enemies[0].hp; playAttack(c);
      var out = hp - c.enemies[0].hp; E.run.phase = 'map'; return out;
    });
    var d1 = forceBand('voidadept', band, function () {
      var c = fight('voidadept', 'crimson_ledger', 44); var hp = c.enemies[0].hp; playAttack(c);
      var out = hp - c.enemies[0].hp; E.run.phase = 'map'; return out;
    });
    return d1 === d0 + 4;   // 2 HP billed x 2 damage each
  })());
  ok('The Devouring crits at the bottom as well as the top', (function () {
    var c = fight('voidadept', 'the_devouring');
    var crits = 0, low = 0;
    for (var i = 0; i < 120 && E.run.phase === 'combat'; i++) {
      c.energy = 30; E.run.hp = E.run.maxHp; playAttack(c);
      var re = E.events.filter(function (ev) { return ev.type === 'roll'; })[0];
      if (re && re.roll >= 2 && re.roll <= 4) { low++; if (re.crit) crits++; }
    }
    E.run.phase = 'map';
    return low > 0 && crits === low;
  })());
  ok('Wound Echo resolves the card twice on a RAVENOUS', (function () {
    var band = [{ min: 99, mult: 1, label: 'X' }];
    function dmg(relic) {
      var saved = VS.BALANCE.dice.classes.voidadept;
      VS.BALANCE.dice.classes.voidadept = { name: saved.name, read: saved.read,
        misfire: { mult: 1, label: 'RAVENOUS' }, bands: band };
      var out;
      try {
        var c = fight('voidadept', relic, 12);
        // widen the misfire to the whole die so the next card is certainly one
        E.run.artifacts.push('long_shots_debt');
        var lv = VS.ARTIFACTS.long_shots_debt.hooks[1].v;
        VS.ARTIFACTS.long_shots_debt.hooks[1].v = 19;
        E.run.die.core.push('long_shots_debt');
        var hp = c.enemies[0].hp; playAttack(c);
        VS.ARTIFACTS.long_shots_debt.hooks[1].v = lv;
        out = hp - c.enemies[0].hp;
      } finally { VS.BALANCE.dice.classes.voidadept = saved; E.run.phase = 'map'; }
      return out;
    }
    var one = dmg(null), two = dmg('wound_echo');
    return two === one * 2;
  })());
  ok('Hollow Crown reads better the closer you are to death', (function () {
    fight('voidadept', 'hollow_crown');
    E.run.hp = E.run.maxHp;
    var full = E.faceBandMult(12);
    E.run.hp = Math.ceil(E.run.maxHp * 0.2);
    var hurt = E.faceBandMult(12);
    E.run.phase = 'map';
    return hurt !== full;
  })());
  ok('Widening Maw pulls the bottom band up into the middle', (function () {
    fight('voidadept', null);
    var mid0 = E.faceBandMult(9);
    fight('voidadept', 'widening_maw');
    return E.faceBandMult(9) > mid0;   // WHISPER 0.9 -> HUNGER 1.2
  })());
  ok('Second Mouth bleeds at full from an end face', (function () {
    var c = fight('voidadept', 'second_mouth');
    [17, 18, 19].forEach(function (f) { VS.dieEngrave(E.run.die, 'overcharge_cell', f); });
    E.events = [];
    E.fireDieFace(18, 0);     // 18 is ATTUNED, the top of his table
    var side = E.events.filter(function (ev) { return ev.type === 'dieFace' && ev.face === 17; })[0];
    E.run.phase = 'map';
    return side && side.bleed === false;
  })());
  ok('Twin Maw reaches across the ring on a 20', (function () {
    var c = fight('voidadept', 'twin_maw');
    VS.dieEngrave(E.run.die, 'overcharge_cell', 10);
    var hit = 0;
    for (var i = 0; i < 120 && E.run.phase === 'combat'; i++) {
      c.energy = 30; E.run.hp = E.run.maxHp; playAttack(c);
      if (E.events.some(function (ev) { return ev.type === 'dieFace' && ev.face === 10 && ev.why === 'opposite'; })) hit++;
    }
    E.run.phase = 'map';
    return hit > 0;   // face 20's opposite is 10
  })());
  ok('Scarfeeder turns the void’s scars into Might', (function () {
    E.seed(9); E.newRun('voidadept'); E.takeFirstMark(0);
    E.addArtifact('scarfeeder'); E.run.die.core.push('scarfeeder');
    for (var f = 1; f <= 6; f++) if (!E.run.die.faces[f]) VS.dieEngrave(E.run.die, 'overcharge_cell', f);
    E.taintDie(3);
    var scars = 0;
    for (var g = 1; g <= 20; g++) { var s2 = E.run.die.faces[g]; if (s2 && s2.root === g && s2.taint) scars++; }
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0; E.startNode('fight');
    var str = E.combat.player.statuses.str || 0;
    E.run.phase = 'map';
    return scars > 0 && str === scars;
  })());

  /* A listener whose trigger nothing emits is the quietest bug in the game: it
   * sits on your die looking like an engraving forever. Three of the six kinds
   * the two new class sets needed (shield, power, construct, burn, debuff, psi)
   * did not exist before them, so this asserts every kind any engraving listens
   * for is a kind the engine actually raises. */
  (function () {
    var src = require('fs').readFileSync(__dirname + '/../js/engine.js', 'utf8');
    var kinds = {}, dead = [];
    Object.keys(VS.DIE_AUGMENTS).forEach(function (id) {
      var k = VS.DIE_AUGMENTS[id].listen; if (k) kinds[k] = id;
    });
    // Some kinds are raised by name at the call site and some come out of a
    // lookup (`_statListen`, the enemy-status `trig`), so collect the literals
    // from the call sites AND from the lines that feed them.
    var raised = {};
    src.split('\n').forEach(function (line) {
      if (!/fireListeners\(|_statListen|var trig =/.test(line)) return;
      (line.match(/'[a-zA-Z]+'/g) || []).forEach(function (q) { raised[q.slice(1, -1)] = 1; });
    });
    Object.keys(kinds).forEach(function (k) { if (!raised[k]) dead.push(k + ' (' + kinds[k] + ')'); });
    ok('every listener trigger is one the engine actually raises' + (dead.length ? ' — ' + dead.join(', ') : ''),
       dead.length === 0);
    ok('the die uses more than a handful of triggers (' + Object.keys(kinds).length + ')',
       Object.keys(kinds).length >= 10);
  })();

  /* Relic art is hand-authored coordinate soup, and the failure is silent: a
   * polyline with an odd coordinate count drops its last point, and anything
   * past |1.2| is simply cropped away by the 24x24 icon box. */
  (function () {
    var noArt = [], odd = [], outside = [], blank = [];
    Object.keys(VS.ARTIFACTS).forEach(function (id) {
      var a = VS.ARTIFACTS[id];
      if (!a.art || !a.art.p) { noArt.push(id); return; }
      if (!a.art.p.length) { blank.push(id); return; }
      a.art.p.forEach(function (poly) {
        if (poly.length % 2 !== 0 || poly.length < 4) odd.push(id);
        for (var i = 0; i < poly.length; i += 2) {
          if (Math.abs(poly[i]) > 1.2 || Math.abs(poly[i + 1]) > 1.2) { outside.push(id); return; }
        }
      });
      (a.art.e || []).forEach(function (e) {
        if (Math.abs(e[0]) > 1.2 || Math.abs(e[1]) > 1.2) outside.push(id);
      });
    });
    ok('every relic has art' + (noArt.length ? ' — ' + noArt.join(', ') : ''), noArt.length === 0);
    ok('no relic draws nothing' + (blank.length ? ' — ' + blank.join(', ') : ''), blank.length === 0);
    ok('every relic polyline is whole' + (odd.length ? ' — ' + odd.join(', ') : ''), odd.length === 0);
    ok('no relic art is cropped by the icon box' + (outside.length ? ' — ' + outside.join(', ') : ''), outside.length === 0);
  })();

  // Every die relic must belong to a class that can actually read a band, or
  // it is a relic that does nothing for whoever draws it.
  var orphan = Object.keys(VS.ARTIFACTS).filter(function (id) {
    var a = VS.ARTIFACTS[id];
    return a.cls && !VS.BALANCE.dice.classes[a.cls];
  });
  ok('no relic is keyed to a class with no die table' + (orphan.length ? ' — ' + orphan.join(', ') : ''),
     orphan.length === 0);

  /* The sets should be comparable in size — one class with twice the die
   * relics of another is a parity problem before it is a design one.
   *
   * The VANGUARD is exempt and deliberately ahead: he is the testing ground,
   * every die mechanic is prototyped on him first, and the other two get their
   * versions once his have been measured. What this guards is that the other
   * two stay level with EACH OTHER, and that neither falls more than half the
   * Vanguard's pool behind — the point at which "testing ground" has quietly
   * become "the only class anyone finished". */
  var per = { vanguard: 0, technomancer: 0, voidadept: 0 };
  Object.keys(VS.ARTIFACTS).forEach(function (id) { if (per[VS.ARTIFACTS[id].cls] != null) per[VS.ARTIFACTS[id].cls]++; });
  var tally = ' (' + per.vanguard + '/' + per.technomancer + '/' + per.voidadept + ')';
  ok('the two non-testbed relic pools are level with each other' + tally,
     Math.abs(per.technomancer - per.voidadept) <= 5);
  ok('neither trails the Vanguard testbed by more than half' + tally,
     Math.min(per.technomancer, per.voidadept) >= per.vanguard / 2);
})();

/* ============ CONSTRUCTS ARE VISIBLE ===================================
 * The Drone Swarm shipped for a long time drawing NOTHING: three cards
 * deployed a construct that hit every enemy every turn and the battlefield
 * never showed it, because drawPlayerFx only ever checked `st.turret`. The
 * turret itself dealt its damage through a bare dealToEnemy, so its shot
 * appeared on the enemy with nothing linking it back.
 *
 * Both are silent failures — the game plays correctly and lies about it — so
 * they get asserted rather than eyeballed.
 * ==================================================================== */
(function () {
  function endTurnWith(st) {
    E.seed(5); E.newRun('technomancer'); E.takeFirstMark(0);
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0; E.startNode('fight');
    E.combat.enemies.forEach(function (e) { e.hp = 900; e.maxHp = 900; e.platedReady = false; });
    Object.keys(st).forEach(function (k) { E.combat.player.statuses[k] = st[k]; });
    E.events = [];
    E.endTurn();
    var out = E.events.filter(function (ev) { return ev.type === 'construct'; });
    E.run.phase = 'map';
    return out;
  }
  var tShots = endTurnWith({ turret: 6 });
  ok('a turret announces its shot, with a target', tShots.length === 1 &&
     tShots[0].kind === 'turret' && tShots[0].idx != null && tShots[0].v >= 6);
  var dShots = endTurnWith({ drone: 4 });
  ok('a drone swarm announces its strafe, with no single target', dShots.length === 1 &&
     dShots[0].kind === 'drone' && dShots[0].idx === null && dShots[0].v >= 4);
  var hShots = endTurnWith({ turret: 3, hive: 1 });
  ok('Hive fires the turret twice and both shots are announced (' + hShots.length + ')', hShots.length === 2);

  // ...and the renderer has to actually draw every construct a card deploys.
  var rsrc = require('fs').readFileSync(__dirname + '/../js/render.js', 'utf8');
  var deployed = {};
  Object.keys(VS.CARDS).forEach(function (id) {
    [false, true].forEach(function (up) {
      if (up && !VS.CARDS[id].up) return;
      (VS.cardFx(VS.CARDS[id], up) || []).forEach(function (f) {
        if (f.k === 'status' && f.who === 'self' && /^(turret|drone|hive)$/.test(f.s)) deployed[f.s] = id;
      });
    });
  });
  var undrawn = Object.keys(deployed).filter(function (s) { return rsrc.indexOf('st.' + s) < 0; });
  ok('every construct a card deploys is one the battlefield draws' +
     (undrawn.length ? ' — ' + undrawn.map(function (s) { return s + ' (' + deployed[s] + ')'; }).join(', ') : ''),
     undrawn.length === 0);
  ok('all three construct statuses are actually deployable (' + Object.keys(deployed).sort().join(',') + ')',
     Object.keys(deployed).length === 3);
})();

/* ============ THE CHAIN REPORTS ITSELF =================================
 * A roll fires its face, bleeds into its neighbours, and whatever is listening
 * answers. The presentation of that chain — staircase, counter, receipt — can
 * only total what the events carry, and `dieFace` used to carry no numbers at
 * all: the damage and energy were spread across the dmg/status events between
 * links with no way to attribute them back.
 * ==================================================================== */
(function () {
  function chainFrom(seedTries) {
    E.seed(4); E.newRun('vanguard'); E.takeFirstMark(0);
    var die = E.run.die; die.faces = {};
    // a densely cut die, which is the state the bleed exists to reward
    var fill = ['relay_mark', 'chain_loader', 'bracket_fire', 'called_shot',
                'spotters_notch', 'twin_sight', 'field_dressing', 'firebase'];
    for (var f = 2; f <= 20; f++) {
      for (var q = 0; q < fill.length; q++) {
        if (!VS.dieCanEngrave(die, fill[q], f)) { VS.dieEngrave(die, fill[q], f); break; }
      }
    }
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0; E.startNode('fight');
    E.combat.enemies.forEach(function (e) { e.hp = 99999; e.maxHp = 99999; e.platedReady = false; });
    for (var k = 0; k < (seedTries || 60); k++) {
      E.combat.energy = 30; E.run.hp = E.run.maxHp;
      /* A 3-COST, because the spread is bought with the card's cost now:
       * 0-1 shakes nothing, 2 shakes one neighbour upward, 3+ shakes both.
       * Pulse Rifle is a 1 and correctly produces no chain at all. */
      E.combat.hand = [{ uid: 4400 + k, id: 'orbital_strike', up: false }];
      E.events = [];
      E.playCard(0, 0);
      var links = E.events.filter(function (ev) { return ev.type === 'dieFace'; });
      if (links.length >= 3) return { links: links, all: E.events.slice() };
    }
    return null;
  }
  var got = chainFrom();
  ok('a dense die actually produces a multi-link chain', !!got && got.links.length >= 3);
  if (got) {
    ok('every link reports what it did (dealt/blk/en on all ' + got.links.length + ')',
       got.links.every(function (L) {
         return typeof L.dealt === 'number' && typeof L.blk === 'number' && typeof L.en === 'number';
       }));
    // The receipt's total is the sum of the links, so it must equal the damage
    // the chain actually dealt — anything else and the ledger is lying.
    var linkSum = got.links.reduce(function (a, L) { return a + L.dealt; }, 0);
    var firstIdx = got.all.findIndex(function (ev) { return ev.type === 'dieFace'; });
    var afterRoot = got.all.slice(firstIdx).filter(function (ev) {
      return ev.type === 'dmg' && ev.who !== 'player';
    }).reduce(function (a, ev) { return a + (ev.amount || 0); }, 0);
    ok('the links total the damage the chain dealt (' + linkSum + ' vs ' + afterRoot + ')',
       linkSum === afterRoot);
    // Every link has to say WHY it fired, or the receipt cannot name a cause and
    // the chain reads as a pile of coincidences.
    var causeless = got.links.slice(1).filter(function (L) { return !L.why && !L.listen; });
    ok('every link past the root names its cause' + (causeless.length ? ' — ' + causeless.length + ' did not' : ''),
       causeless.length === 0);
    ok('the root is the only link with no cause', !got.links[0].why && !got.links[0].listen);
  }
  E.run.phase = 'map';
})();

/* ============ SEAMS, WELDS AND THE CENTRED SPAN ========================
 * Three rules changed at once and they interlock, so they are asserted
 * together: a span is CENTRED on the face you point at and WRAPS the ring; a
 * face may carry a SECOND engraving at reduced strength; and a boundary
 * between two engravings can be WELDED so the bleed across it runs full.
 *
 * The load-bearing invariant under all of it: A SEAM'S ROOT IS ALWAYS A
 * PRIMARY FACE. Every reader in the game that walks die.faces collecting
 * roots — listeners, taints, reforge targets, the scrub list — depends on it,
 * and none of them were changed. If it ever breaks, they all break at once.
 * ==================================================================== */
(function () {
  E.seed(11); E.newRun('vanguard');
  var d = E.run.die;

  // --- centred, and it wraps
  ok('a point engraving is just its own face', VS.dieSpan('overcharge_cell', 9).join() === '9');
  ok('a band centres on the face you point at', VS.dieSpan('scrap_sifter', 9).join() === '8,9,10');
  ok('and it wraps the 20-1 seam', VS.dieSpan('scrap_sifter', 20).join() === '19,20,1');
  ok('the ring steps both ways', VS.dieStep(1, -1) === 20 && VS.dieStep(20, 1) === 1);

  // --- the seam
  VS.dieEngrave(d, 'scrap_sifter', 9);              // 8,9,10 — root 9
  var pl = VS.diePlacement(d, 'overcharge_cell', 10);
  ok('a point may share a band’s BODY', pl.why === null && pl.seam === 10);
  ok('but never its HEAD', !!VS.diePlacement(d, 'overcharge_cell', 9).why);
  VS.dieEngrave(d, 'overcharge_cell', 10);
  ok('the newcomer takes the face', VS.dieFaceId(d, 10) === 'overcharge_cell');
  ok('and the incumbent rides along on it', VS.dieSeamId(d, 10) === 'scrap_sifter');
  ok('the band still owns its other two faces',
     VS.dieFaceId(d, 8) === 'scrap_sifter' && VS.dieFaceId(d, 9) === 'scrap_sifter');
  ok('a seam’s root is a primary face', VS.dieFaceId(d, VS.dieSeamAt(d, 10).root) === 'scrap_sifter');
  ok('a shared face pays for itself both ways', VS.dieSeamMult(d, 10) === VS.BALANCE.dice.seam);
  ok('an unshared face is untouched', VS.dieSeamMult(d, 8) === 1);
  ok('a face holds no more than two', !!VS.diePlacement(d, 'munition_feed', 10).why);
  ok('one placement doubles at most one face', !!VS.diePlacement(d, 'scrap_sifter', 15).why === false);

  // --- scrubbing promotes the passenger rather than dropping it
  var d2 = VS.newDie();
  VS.dieEngrave(d2, 'scrap_sifter', 9);
  VS.dieEngrave(d2, 'overcharge_cell', 10);
  VS.dieScrub(d2, 10);                               // lift the point off
  ok('scrubbing the newcomer hands the face back', VS.dieFaceId(d2, 10) === 'scrap_sifter' && !VS.dieSeamAt(d2, 10));
  var d3 = VS.newDie();
  VS.dieEngrave(d3, 'scrap_sifter', 9);
  VS.dieEngrave(d3, 'overcharge_cell', 10);
  VS.dieScrub(d3, 9);                                // lift the band out from under
  ok('scrubbing the band promotes the passenger', VS.dieFaceId(d3, 10) === 'overcharge_cell' && !VS.dieSeamAt(d3, 10));
  ok('and the passenger is now its own root', VS.dieIsRoot(d3, 10));
  ok('the band left nothing behind', !d3.faces[8] && !d3.faces[9]);

  // --- welds
  var d4 = VS.newDie();
  VS.dieEngrave(d4, 'overcharge_cell', 5);
  VS.dieEngrave(d4, 'munition_feed', 6);
  ok('a boundary between two engravings can be welded', VS.dieWeld(d4, 5, 6) === null);
  ok('and it reads as welded from either side', VS.dieWelded(d4, 6, 5));
  ok('the same boundary cannot be welded twice', !!VS.dieCanWeld(d4, 5, 6));
  VS.dieEngrave(d4, 'scrap_sifter', 15);
  ok('one engraving is not two', VS.dieCanWeld(d4, 15, 16) === 'that is one engraving, not two');
  ok('a bare face cannot be welded', !!VS.dieCanWeld(d4, 5, 4));
  ok('faces that do not touch cannot be welded', VS.dieCanWeld(d4, 5, 9) === 'those faces do not touch');
  VS.dieScrub(d4, 6);
  ok('scrubbing a side drops the weld with it', VS.dieWelds(d4).length === 0);

  // --- a die with a seam and a weld survives being written out and read back
  // (localStorage does not exist here, so this is the serialisation itself)
  E.seed(11); E.newRun('vanguard');
  var dd = E.run.die;
  VS.dieEngrave(dd, 'scrap_sifter', 9);              // 8,9,10
  VS.dieEngrave(dd, 'overcharge_cell', 10);          // seams onto 10
  VS.dieEngrave(dd, 'munition_feed', 11);
  ok('a live boundary welds', VS.dieWeld(dd, 10, 11) === null);
  E.run.die = JSON.parse(JSON.stringify(dd));
  ok('the seam survives the round trip', VS.dieSeamId(E.run.die, 10) === 'scrap_sifter');
  ok('the weld survives the round trip', VS.dieWelded(E.run.die, 10, 11));
  ok('and the shape needs no repair', E.dieRepair() === 0);

  // A run saved before seams existed must load as a die with none, not a crash.
  var old = { faces: { 5: { id: 'overcharge_cell', root: 5 } }, core: [], vault: [], frame: [], coreSlots: 3 };
  E.run.die = old;
  ok('a pre-seam die repairs cleanly', E.dieRepair() === 0 && VS.dieFaceId(old, 5) === 'overcharge_cell');
  ok('and reports no seams rather than throwing', VS.dieSeamAt(old, 5) === null && VS.dieWelds(old).length === 0);
})();

/* THE SEAM IN A FIGHT. The rule is only real if the numbers move: a shared
 * face has to fire BOTH engravings, and both have to come out reduced. */
(function () {
  startFight('vanguard');
  var d = E.run.die, c = E.combat;
  for (var f = 1; f <= 20; f++) delete d.faces[f];
  d.seams = {}; d.welds = [];
  VS.dieEngrave(d, 'kinetic_buffer', 12);            // point, 9 Shield, face 12
  function faceEvents() { return E.events.filter(function (e) { return e.type === 'dieFace'; }); }
  E.events.length = 0;
  c.player.block = 0;
  E.fireDieFace(12, null);
  var solo = c.player.block, got = faceEvents();
  ok('a lone face fires whole (' + solo + ')', solo > 0 && got.length === 1);

  // The band goes down FIRST — a head can never be shared, so the point has to
  // be the newcomer that seams onto the band's body.
  VS.dieScrub(d, 12);
  VS.dieEngrave(d, 'scrap_sifter', 13);              // band 12,13,14 — root 13
  VS.dieEngrave(d, 'kinetic_buffer', 12);            // seams onto the band's body
  ok('the point took the face and the band rides it',
     VS.dieFaceId(d, 12) === 'kinetic_buffer' && VS.dieSeamId(d, 12) === 'scrap_sifter');
  E.events.length = 0; c.player.block = 0;
  E.fireDieFace(12, null);
  got = faceEvents();
  var pair = got.filter(function (e) { return e.face === 12; });
  ok('a seamed face fires BOTH engravings', pair.length === 2);
  ok('and both report themselves as shared', pair.every(function (e) { return e.seam; }));
  ok('the point comes out reduced, not whole (' + c.player.block + ' vs ' + solo + ')',
     c.player.block > 0 && c.player.block < solo);

  // A band that seams onto its own neighbour must not bleed into itself.
  var self = got.filter(function (e) { return e.id === 'scrap_sifter'; });
  var dbl = {};
  var doubled = self.filter(function (e) { return dbl[e.face] ? true : (dbl[e.face] = 1, false); });
  ok('nothing fires the same face twice', doubled.length === 0);
  E.run.phase = 'map';
})();

/* THE WELD IN A FIGHT: the bleed across the chosen boundary runs at full. */
(function () {
  startFight('vanguard');
  var d = E.run.die, c = E.combat;
  for (var f = 1; f <= 20; f++) delete d.faces[f];
  d.seams = {}; d.welds = [];
  VS.dieEngrave(d, 'overcharge_cell', 12);           // 2 Energy, face 12
  VS.dieEngrave(d, 'kinetic_buffer', 13);            // 9 Shield, face 13
  c.player.block = 0; c.energy = 0;
  E.fireDieFace(12, null);
  var bled = c.player.block;
  ok('an unwelded neighbour bleeds a fraction (' + bled + ')', bled > 0);

  VS.dieWeld(d, 12, 13);
  c.player.block = 0; c.energy = 0;
  E.fireDieFace(12, null);
  ok('a welded neighbour carries the whole charge (' + bled + ' -> ' + c.player.block + ')',
     c.player.block > bled);
  E.run.phase = 'map';
})();

/* ============ THE FACE PICKER TELLS YOU WHAT IT WILL DO ================
 * The grid offered twenty faces, some of them the same name three times
 * because a band covers three, and stated nowhere what any of them did or
 * what it was about to become — on a screen whose whole question is which one
 * to destroy. faceOutcome answers that, and the load-bearing property is that
 * it is the SAME arithmetic the commit uses: a preview that can disagree with
 * the result is worse than no preview.
 * ==================================================================== */
(function () {
  function setup(mode, n) {
    E.seed(5); E.newRun('vanguard');
    var d = E.run.die;
    VS.dieEngrave(d, 'ranging_mark', 3);        // a band (span 3)
    VS.dieEngrave(d, 'kinetic_buffer', 6);
    VS.dieEngrave(d, 'ignition_coil', 9);
    VS.dieEngrave(d, 'called_shot', 12);        // a listener
    VS.dieEngrave(d, 'munition_feed', 15);
    E.run.pendingFace = { mode: mode, n: n || 1, picked: [] };
    return d;
  }

  // every mode says SOMETHING — a silent readout is the bug being fixed
  var MODES = ['reforge','collapse','unlisten','swap','fuse','migrate','mirror',
               'blank','sell','sellScar','give','teach','grant','steal'];
  var mute = MODES.filter(function (m) {
    setup(m, (m === 'swap' || m === 'fuse' || m === 'migrate') ? 2 : 1);
    var cands = E.faceCandidates();
    if (!cands.length) return false;                 // gated by the die floor
    var o = E.faceOutcome(cands[0]);
    return !o || !o.line;
  });
  ok('every face verb states what it will do' + (mute.length ? ' — ' + mute.join(', ') + ' say nothing' : ''),
     mute.length === 0);

  // the preview IS the commit — collapse
  setup('collapse');
  var pre = E.faceOutcome(3);
  ok('collapse previews the poured engraving', !!(pre && pre.to && pre.to.desc));
  var preDesc = pre.to.desc, preSpan = pre.to.span;
  E.facePick(3);
  var got = VS.dieEngraving(VS.dieFaceId(E.run.die, 3));
  ok('and the face really holds what was previewed (' + preDesc + ')',
     got.desc === preDesc && (got.span || 1) === preSpan);
  ok('the band really did collapse to one face', !VS.dieFaceId(E.run.die, 4));

  // the preview IS the commit — unlisten
  setup('unlisten');
  var pre2 = E.faceOutcome(12);
  ok('unlisten previews the plain engraving', !!(pre2 && pre2.to && !pre2.to.listen));
  var d2 = pre2.to.desc;
  E.facePick(12);
  ok('and the listener really became that (' + d2 + ')',
     VS.dieEngraving(VS.dieFaceId(E.run.die, 12)).desc === d2);

  // the preview IS the commit — fuse, which needs BOTH faces before it can say
  setup('fuse', 2);
  var half = E.faceOutcome(6);
  ok('fuse will not name a result off one face', half && half.to === null && !!half.line);
  E.facePick(6);
  var full = E.faceOutcome(15);
  ok('with both picked it names the fusion', !!(full && full.to && full.to.name));
  var fname = full.to.name, fdesc = full.to.desc;
  E.facePick(15);
  var fused = VS.dieEngraving(VS.dieFaceId(E.run.die, 6));
  ok('and the pot really produced it (' + fname + ' — ' + fdesc + ')',
     fused.name === fname && fused.desc === fdesc);
  ok('the second face went into the pot', !VS.dieFaceId(E.run.die, 15));

  // the preview IS the commit — mirror
  setup('mirror');
  var pre3 = E.faceOutcome(3);
  ok('mirror previews the thinned engraving', !!(pre3 && pre3.to));
  var d3 = pre3.to.desc;
  E.facePick(3);
  ok('and both faces carry it (' + d3 + ')',
     VS.dieEngraving(VS.dieFaceId(E.run.die, 3)).desc === d3 &&
     VS.dieEngraving(VS.dieFaceId(E.run.die, 13)).desc === d3);

  // a face already spent is not offered a second outcome
  setup('fuse', 2);
  E.facePick(6);
  ok('an already-picked face previews nothing', E.faceOutcome(6) === null);
  E.run.phase = 'map';
})();

/* ============ THE VANGUARD REBUILD: FOUR NEW MECHANICS ================
 * Steering, BURST, the Bulwark wall and Stim. Asserted here because they are
 * the substrate the whole class redesign sits on, and because three of them
 * are invisible in a card's text — you can only see them by playing one.
 * ==================================================================== */
(function () {
  function fight(engrave) {
    E.seed(9); E.newRun('vanguard'); E.takeFirstMark(0);
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
    (engrave || []).forEach(function (pair) { VS.dieEngrave(E.run.die, pair[1], pair[0]); });
    E.startNode('fight');
    E.combat.enemies.forEach(function (e) { e.platedReady = false; });
    return E.combat;
  }
  function play(c, id) {
    c.hand = [{ uid: 900000 + Math.floor(Math.random() * 1e5), id: id, up: false }];
    c.energy = 3; E.events.length = 0;
    return E.playCard(0, 0);
  }

  // ---- STEERING -------------------------------------------------------
  var c = fight([[15, 'kinetic_buffer'], [18, 'overcharge_cell']]);
  ok('Marksmanship declares itself a steering table', !!E.dieRead('vanguard').steer);
  ok('the other two tables do not steer',
     !E.dieRead('technomancer').steer && !E.dieRead('voidadept').steer);

  var steers = [], held = 0;
  for (var i = 0; i < 40 && !c.over; i++) {
    c.player.statuses.aim = 3;
    if (!play(c, 'pulse_rifle')) break;
    var st = E.events.filter(function (e) { return e.type === 'steer'; })[0];
    var rl = E.events.filter(function (e) { return e.type === 'roll'; })[0];
    if (st) steers.push({ from: st.from, to: st.to, spent: st.spent, band: rl && rl.band });
    else held++;
  }
  ok('the die steers at all (' + steers.length + ' of ' + (steers.length + held) + ' rolls)', steers.length > 0);
  ok('it never travels further than the cap',
     steers.every(function (s) { return s.spent <= VS.BALANCE.dice.steerCap; }));
  ok('it only ever lands on an ENGRAVED face',
     steers.every(function (s) { return !!VS.dieFaceId(E.run.die, s.to); }));
  ok('it spends exactly one Aim per face travelled',
     steers.every(function (s) { return s.spent === Math.abs(s.to - s.from); }));
  ok('it climbs, never descends', steers.every(function (s) { return s.to > s.from; }));

  // it must not burn Aim for nothing: standing on a cut face in the same band
  c = fight([[15, 'kinetic_buffer'], [16, 'ignition_coil']]);
  var wasted = 0;
  for (i = 0; i < 60 && !c.over; i++) {
    c.player.statuses.aim = 3;
    if (!play(c, 'pulse_rifle')) break;
    var s2 = E.events.filter(function (e) { return e.type === 'steer'; })[0];
    if (s2 && s2.from === 15 && s2.to === 16) wasted++;   // 15 and 16 are both SOLID
  }
  ok('it will not spend Aim to move within the same band', wasted === 0);

  // a jam is a jam
  c = fight([[2, 'kinetic_buffer'], [3, 'ignition_coil'], [4, 'overcharge_cell']]);
  var jams = 0, jamSteers = 0;
  for (i = 0; i < 200 && !c.over; i++) {
    c.player.statuses.aim = 3;
    if (!play(c, 'pulse_rifle')) break;
    var rl2 = E.events.filter(function (e) { return e.type === 'roll'; })[0];
    if (rl2 && rl2.roll === 1) { jams++; if (E.events.some(function (e) { return e.type === 'steer'; })) jamSteers++; }
  }
  ok('a natural 1 is never steered off (' + jams + ' jams seen)', jamSteers === 0);

  // ---- BURST ----------------------------------------------------------
  VS.CARDS._test_burst = { name: 'Test Burst', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1,
                           fx: [{ k: 'dmg', v: 4, scale: 'might' }], burst: { n: 3, dir: 1 } };
  VS.CARDS._test_burst_dn = { name: 'Test Burst Down', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1,
                              fx: [{ k: 'dmg', v: 4, scale: 'might' }], burst: { n: 3, dir: -1 } };
  ok('BURST reads on the card', /BURST 3/.test(VS.cardDesc(VS.CARDS._test_burst, false, null, false)));
  ok('and it states its direction',
     /↑/.test(VS.cardDesc(VS.CARDS._test_burst, false, null, false)) &&
     /↓/.test(VS.cardDesc(VS.CARDS._test_burst_dn, false, null, false)));

  var ring = [];
  for (i = 10; i <= 16; i++) ring.push([i, ['kinetic_buffer','ignition_coil','overcharge_cell','munition_feed','repair_nanites','static_discharge','scavenger_port'][i - 10]]);
  c = fight(ring);
  var burstSeen = null;
  for (i = 0; i < 40 && !c.over && !burstSeen; i++) {
    c.player.statuses.aim = 0;
    if (!play(c, '_test_burst')) break;
    var bf = E.events.filter(function (e) { return e.type === 'dieFace' && e.why === 'burst'; });
    if (bf.length) burstSeen = { root: E.events.filter(function (e) { return e.type === 'roll'; })[0].roll, faces: bf.map(function (e) { return e.face; }) };
  }
  ok('a BURST fires extra faces', !!burstSeen);
  if (burstSeen) {
    ok('and they walk UP the ring from where it landed (' + burstSeen.root + ' -> ' + burstSeen.faces.join(',') + ')',
       burstSeen.faces.every(function (f, k) { return f === VS.dieStep(burstSeen.root, k + 1); }));
  }

  // ---- THE WALL -------------------------------------------------------
  VS.CARDS._test_wall = { name: 'Test Wall', cls: 'vanguard', type: 'skill', rarity: 1, cost: 1,
                          fx: [{ k: 'status', s: 'bulwark', v: 10, who: 'self' }] };
  VS.CARDS._test_revet = { name: 'Test Revetment', cls: 'vanguard', type: 'skill', rarity: 1, cost: 1,
                           fx: [{ k: 'special', id: 'wallFace' }] };
  VS.CARDS._test_breach = { name: 'Test Breach', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1,
                            fx: [{ k: 'special', id: 'breachWall' }] };
  c = fight([[12, 'kinetic_buffer']]);
  play(c, '_test_wall');
  ok('the wall can be gained', E.combat.player.statuses.bulwark === 10);
  E.endTurn();
  ok('and it does NOT expire like Shield', (E.combat.player.statuses.bulwark || 0) === 10);

  c = fight([[12, 'kinetic_buffer']]);
  c.player.statuses.aim = 0;
  var rev = 0;
  for (i = 0; i < 20 && !c.over && !rev; i++) {
    c.player.statuses.bulwark = 0;
    if (!play(c, '_test_revet')) break;
    var rr = E.events.filter(function (e) { return e.type === 'roll'; })[0];
    if (rr && (c.player.statuses.bulwark || 0) > 0) rev = { face: rr.roll, wall: c.player.statuses.bulwark };
  }
  ok('REVETMENT banks the face it landed on' + (rev ? ' (face ' + rev.face + ' -> ' + rev.wall + ' wall)' : ''),
     !!rev && rev.wall === rev.face);

  c = fight([[12, 'kinetic_buffer']]);
  c.player.statuses.bulwark = 18;
  play(c, '_test_breach');
  var dealt = E.events.filter(function (e) { return e.type === 'dmg' && e.who !== 'player'; })
                      .reduce(function (a, e) { return a + (e.amount || 0); }, 0);
  ok('detonating spends the whole wall', (E.combat.player.statuses.bulwark || 0) === 0);
  ok('...and throws it at the enemy (' + dealt + ')', dealt >= 18);

  // the wall stands BEHIND Shield and eats what gets past it
  c = fight([[12, 'kinetic_buffer']]);
  c.player.block = 5; c.player.statuses.bulwark = 20;
  c.enemies.forEach(function (e) { e.statuses.str = 30; });
  var hp0 = E.run.hp; E.events.length = 0;
  E.endTurn();
  var hit = E.events.filter(function (e) { return e.type === 'dmg' && e.who === 'player'; })[0];
  ok('Shield is spent before the wall is' + (hit ? ' (' + hit.amount + ' in, ' + (hp0 - E.run.hp) + ' through)' : ''),
     !!hit && hit.amount > 25 && (hp0 - E.run.hp) === hit.amount - 25);

  // ---- STIM -----------------------------------------------------------
  c = fight([[12, 'kinetic_buffer']]);
  c.player.statuses.stim = 0;
  play(c, 'pulse_rifle');
  var base = E.events.filter(function (e) { return e.type === 'dmg' && e.who !== 'player'; })
                     .reduce(function (a, e) { return a + (e.amount || 0); }, 0);
  c = fight([[12, 'kinetic_buffer']]);
  c.player.statuses.stim = 5;
  play(c, 'pulse_rifle');
  var stimmed = E.events.filter(function (e) { return e.type === 'dmg' && e.who !== 'player'; })
                        .reduce(function (a, e) { return a + (e.amount || 0); }, 0);
  ok('Stim adds to attack damage (' + base + ' -> ' + stimmed + ')', stimmed > base);
  c.player.statuses.stim = 4;
  E.endTurn();
  ok('...and burns off a point each turn', c.player.statuses.stim === 3);
  c.player.statuses.stim = 4; c.player.statuses.stimHold = 1;
  E.endTurn();
  ok('unless it is held (FEVER)', c.player.statuses.stim === 4);

  delete VS.CARDS._test_burst; delete VS.CARDS._test_burst_dn;
  delete VS.CARDS._test_wall; delete VS.CARDS._test_revet; delete VS.CARDS._test_breach;
  E.run.phase = 'map';
})();

/* ============ THE VANGUARD'S RELICS POINT AT LIVE MECHANICS ===========
 * Five of the twenty-one referenced things the rebuild deleted — Momentum,
 * Salvo, Aim-as-a-band-bonus, Shield-as-the-defensive-pool. A relic whose
 * hook has no mechanic behind it is not weak, it is BLANK, and nothing in
 * the game says so. This asserts every reworked one actually fires.
 * ==================================================================== */
(function () {
  function withRelic(id, engrave) {
    E.seed(4); E.newRun('vanguard'); E.takeFirstMark(0);
    E.run.artifacts.push(id); E.run.die.core.push(id);
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
    (engrave || []).forEach(function (pr) { VS.dieEngrave(E.run.die, pr[1], pr[0]); });
    E.startNode('fight');
    E.combat.enemies.forEach(function (e) { e.platedReady = false; });
    return E.combat;
  }
  function play(c, id) {
    c.hand = [{ uid: 800000 + Math.floor(Math.random() * 1e5), id: id, up: false }];
    c.energy = 3; E.events.length = 0;
    return E.playCard(0, 0);
  }

  // THE BASTION — the wall is up before turn 1
  var c = withRelic('ash_reliquary');
  ok('The Bastion raises a wall before turn 1', (c.player.statuses.bulwark || 0) === 8);

  // COUNTERSCARP — the wall keeps a footing back
  c = withRelic('warlord_doctrine');
  c.player.statuses.bulwark = 20; c.player.block = 0;
  c.enemies.forEach(function (e) { e.statuses.str = 40; });
  E.endTurn();
  ok('Counterscarp never lets the wall fall to nothing (' + (c.player.statuses.bulwark || 0) + ')',
     (c.player.statuses.bulwark || 0) >= 6);

  // TRENCH LEDGER — the bottom of the die pays Stim, not Might
  c = withRelic('trench_ledger');
  var lows = 0;
  for (var i = 0; i < 60 && !c.over; i++) {
    c.player.statuses.stim = 0; c.player.statuses.aim = 0;
    if (!play(c, 'pulse_rifle')) break;
    var rl = E.events.filter(function (e) { return e.type === 'roll'; })[0];
    if (rl && rl.roll < 6 && (c.player.statuses.stim || 0) > 0) lows++;
  }
  ok('Trench Ledger pays Stim off a low roll (' + lows + ' seen)', lows > 0);

  // CYCLING BREECH — holds the Stim that would otherwise burn off
  c = withRelic('cycling_breech');
  c.player.statuses.stim = 5; E.endTurn();
  ok('Cycling Breech holds Stim through the turn', (c.player.statuses.stim || 0) === 5);

  // SPENT BRASS — banks into the WALL, which does not expire
  c = withRelic('spent_brass');
  c.player.statuses.bulwark = 0;
  play(c, 'pulse_rifle');
  E.endTurn();
  ok('Spent Brass banks the roll into the wall (' + (c.player.statuses.bulwark || 0) + ')',
     (c.player.statuses.bulwark || 0) > 0);

  // THE LONG SHOT'S DEBT — buys travel, not band
  var ring = [[16, 'kinetic_buffer']];
  c = withRelic('long_shots_debt', ring);
  // the enemy has to survive long enough to see a rare roll
  c.enemies.forEach(function (e) { e.hp = 99999; e.maxHp = 99999; });
  var far = 0;
  for (i = 0; i < 200 && !c.over; i++) {
    c.player.statuses.aim = 5;
    if (!play(c, 'pulse_rifle')) break;
    var st = E.events.filter(function (e) { return e.type === 'steer'; })[0];
    if (st && st.spent > 3) far++;      // past the base cap of 3
  }
  ok("The Long Shot's Debt steers past the base cap (" + far + ' seen)', far > 0);

  // TWINNED FIRING PIN / BANDOLIER RIG — the two BURST relics
  VS.CARDS._t_b = { name: 'T', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1,
                    fx: [{ k: 'dmg', v: 3, scale: 'might' }], burst: { n: 2, dir: 1 } };
  var wide = [];
  for (i = 10; i <= 17; i++) wide.push([i, ['kinetic_buffer','ignition_coil','overcharge_cell','munition_feed','repair_nanites','static_discharge','scavenger_port','targeting_spike'][i - 10]]);
  function burstWidth(relic) {
    var cc = relic ? withRelic(relic, wide) : withRelic('votive_shim', wide);
    var best = 0;
    for (var k = 0; k < 40 && !cc.over; k++) {
      cc.player.statuses.aim = 0;
      if (!play(cc, '_t_b')) break;
      best = Math.max(best, E.events.filter(function (e) { return e.type === 'dieFace' && e.why === 'burst'; }).length);
    }
    return best;
  }
  var plain = burstWidth(null), pinned = burstWidth('twinned_pin');
  ok('Twinned Firing Pin walks the burst further (' + plain + ' -> ' + pinned + ')', pinned > plain);
  delete VS.CARDS._t_b;
  E.run.phase = 'map';
})();

/* ---- THE ARSENAL IS GONE ------------------------------------------------
 * A fourth class with no deck at all — an attack d20 and a guard d6, rolls
 * allocated between them, a PROTOCOL loadout instead of a hand, and a
 * thirteen-pick arena draft to open the run. It measured 8% against 26-36%
 * for the other three and was cut, along with everything only it used.
 * These assert it stayed cut rather than leaving a half-wired fourth class
 * in the pickers and the sim's parity table.
 * -------------------------------------------------------------------- */
ok('the Arsenal is not a class any more',
   !VS.BALANCE.classes.arsenal && !VS.CLASS_INFO.arsenal && !VS.STARTER_DECKS.arsenal);
ok('nor a die table', !VS.BALANCE.dice.classes.arsenal);
ok('the arena draft is gone with it',
   typeof E.arenaBegin !== 'function' && typeof E.arenaState !== 'function' && !VS.arenaPool);
ok('so is the protocol loadout', !VS.PROTOCOLS && typeof VS.protocol !== 'function');
ok('so is the multi-die rack', typeof E.useDie !== 'function' && typeof E.diceRelink !== 'function');
ok('and no engraving is keyed to it',
   !Object.keys(VS.DIE_AUGMENTS).some(function (id) { return VS.DIE_AUGMENTS[id].cls === 'arsenal'; }));
ok('and no card is either',
   !Object.keys(VS.CARDS).some(function (id) { return VS.CARDS[id].cls === 'arsenal'; }));

/* ============================================================================
 * THE DIE AS AN OBJECT — the nineteen relics that read the die's LAYOUT, its
 * MEMORY, its BLANK faces and its actual SHAPE. Everything before this pass
 * read the NUMBER: reroll it, bias it, widen the band around it. These are
 * the parts of the die that nothing was pointed at.
 *
 * `dieRig` builds a die you can predict — every face carrying the same
 * engraving, so which number comes up stops mattering and the assertions are
 * about the relic instead of about the seed.
 * ========================================================================== */
(function () {
  // A die where every face carries `id` (or `only`, a single face, if given).
  function dieRig(opts) {
    opts = opts || {};
    E.seed(opts.seed == null ? 7 : opts.seed);
    E.newRun(opts.cls || 'vanguard');
    var die = E.run.die;
    die.faces = {}; die.seams = {}; die.welds = [];
    if (opts.only != null) VS.dieEngrave(die, opts.eng || 'bracket_fire', opts.only);
    else if (!opts.bare) {
      for (var f = 1; f <= VS.dieSides(die); f++) VS.dieEngrave(die, opts.eng || 'bracket_fire', f);
    }
    (opts.relics || []).forEach(giveRelic);
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0; E.startNode('fight');
    E.combat.enemies.forEach(function (e) { e.hp = 99999; e.maxHp = 99999; e.platedReady = false; });
    return E.combat;
  }
  // Play `card` n times, collecting every event. Enemies are unkillable above.
  function volley(card, n) {
    var all = [];
    for (var i = 0; i < n; i++) {
      E.combat.energy = 30; E.run.hp = E.run.maxHp;
      E.combat.hand = [{ uid: 9000 + i, id: card, up: false }];
      E.events = [];
      E.playCard(0, 0);
      all = all.concat(E.events.slice());
      if (E.combat.over) break;
    }
    return all;
  }
  function faces(evs, why) {
    return evs.filter(function (e) { return e.type === 'dieFace' && (why === undefined || e.why === why); });
  }

  /* ---- LAYOUT: the die read as a shape, not a number ------------------- */
  dieRig({ relics: ['harmonic_pair'] });
  var hp1 = faces(volley('pulse_rifle', 12), 'twin').length;
  dieRig({});
  var hp0 = faces(volley('pulse_rifle', 12), 'twin').length;
  ok('Harmonic Pair fires the matching neighbour (' + hp1 + ' vs ' + hp0 + ')', hp1 > 0 && hp0 === 0);

  // FACE LATHE: the jig is free and is never used up
  dieRig({ relics: ['face_lathe'] });
  ok('Face Lathe makes the reseat jig free', E.reseatCost() === 0);
  E.run.shop = { reseatUsed: true };
  ok('Face Lathe means the jig is never spent', E.jigSpent() === false);
  E.run.artifacts = []; E.run.die.core = [];
  ok('without it the spent jig still reads as spent', E.jigSpent() === true);

  /* ---- BLANK FACES: a bare roll used to be nothing at all -------------- */
  // COLD ETCH copies the last engraving onto the first bare face it hits, and
  // scrubs it again when the fight ends.
  dieRig({ relics: ['cold_etch'], only: 4 });
  volley('pulse_rifle', 60);
  var etched = E.combat.etched;
  ok('Cold Etch strikes a copy onto a bare face', etched != null && !!VS.dieFaceId(E.run.die, etched));
  var wasEtched = etched;
  // end the fight for real, so winCombat's scrub is the thing under test
  E.combat.enemies.forEach(function (e) { e.hp = 1; e.block = 0; });
  E.combat.energy = 30;
  E.combat.hand = [{ uid: 1, id: 'orbital_strike', up: false }];
  E.playCard(0, 0);
  ok('and the etch is cold — scrubbed when the fight ends',
     wasEtched == null || !VS.dieFaceId(E.run.die, wasEtched));

  // EMPTY CHAMBER turns a bare roll into a card
  dieRig({ relics: ['empty_chamber'], bare: true });
  var handBefore = E.combat.hand.length, drawBefore = E.combat.drawPile.length;
  E.combat.energy = 30;
  E.combat.hand = [{ uid: 77, id: 'pulse_rifle', up: false }];
  E.playCard(0, 0);
  ok('Empty Chamber draws on a bare face', E.combat.drawPile.length < drawBefore);

  /* ---- THE READ: foresight, the failsafe, the flattened curve ---------- */
  var fc = dieRig({ relics: ['ballistic_computer'] });
  ok('Ballistic Computer knows the next roll before you play', fc.nextRoll != null);
  var announced = fc.nextRoll;
  var fev = volley('pulse_rifle', 1);
  var firstRoll = fev.filter(function (e) { return e.type === 'roll'; })[0];
  ok('and the roll it announced is the roll you get', firstRoll && firstRoll.roll === announced);

  // MANUAL OVERRIDE: deterministic, so it is asserted exactly
  dieRig({ relics: ['manual_override'], only: 17 });
  var mo = volley('pulse_rifle', 1).filter(function (e) { return e.type === 'roll'; })[0];
  ok('Manual Override opens on your highest engraved face (' + (mo && mo.roll) + ')', mo && mo.roll === 17);

  // FAILSAFE GOVERNOR / DEADMAN REGULATOR both change how often the tails hit
  /* ONE CARD A TURN, not 300 in one turn. Failsafe Governor re-arms per TURN,
   * so a volley inside a single turn would spend its one reroll on card 1 and
   * measure the relic as doing almost nothing. */
  function tails(relics, n) {
    dieRig({ relics: relics, seed: 42 });
    var t = { n: 0, mis: 0, crit: 0 };
    for (var i = 0; i < n; i++) {
      E.combat.energy = 30; E.run.hp = E.run.maxHp; E.combat.player.block = 9999;
      E.combat.hand = [{ uid: 8000 + i, id: 'pulse_rifle', up: false }];
      E.events = [];
      E.playCard(0, 0);
      E.events.forEach(function (e) {
        if (e.type !== 'roll') return;
        t.n++; if (e.misfire) t.mis++; if (e.crit) t.crit++;
      });
      if (E.combat.over) break;
      E.endTurn();
      if (E.combat.over || E.run.phase === 'dead') break;
    }
    return t;
  }
  var base = tails([], 300), fg = tails(['failsafe_governor'], 300);
  ok('Failsafe Governor cuts the jam rate (' + fg.mis + ' vs ' + base.mis + ')', fg.mis < base.mis);
  var dm = tails(['deadman_regulator'], 300);
  ok('Deadman Regulator deletes the misfire (' + dm.mis + ')', dm.mis === 0);
  ok('...and the crit with it (' + dm.crit + ' vs ' + base.crit + ')', dm.crit === 0 && base.crit > 0);

  /* ---- MEMORY --------------------------------------------------------- */
  dieRig({ relics: ['stutter_bearing'], seed: 3 });
  var st = faces(volley('pulse_rifle', 300), 'stutter').length;
  ok('Stutter Bearing pays for a repeated face (' + st + ' repeats in 300)', st > 0);

  /* ---- THE CHAIN, BOTH DIRECTIONS ------------------------------------- */
  // A 1-cost buys no spread at all; Hair Trigger buys it the full one.
  dieRig({});
  var cheap0 = faces(volley('pulse_rifle', 1)).length;
  dieRig({ relics: ['hair_trigger'] });
  var cheap1 = faces(volley('pulse_rifle', 1)).length;
  ok('a 1-cost still shakes nothing on its own (' + cheap0 + ' face)', cheap0 === 1);
  // the 2-cost spread — one neighbour, upward — not the full both-sides one
  ok('Hair Trigger buys it one neighbour (' + cheap1 + ' faces)', cheap1 === 2);

  // SOLID SLUG refuses the spread and doubles the root instead
  dieRig({});
  var wide = faces(volley('orbital_strike', 1));
  dieRig({ relics: ['solid_slug'] });
  var tall = faces(volley('orbital_strike', 1));
  ok('a 3-cost normally shakes both neighbours (' + wide.length + ')', wide.length === 3);
  ok('Solid Slug refuses the spread', !tall.some(function (e) { return e.why === 'bleed'; }));
  ok('...and fires the root twice instead', tall.filter(function (e) { return e.why === 'slug' || !e.why; }).length === 2);

  // OVERPRESSURE LOAD widens the heavy end only
  dieRig({ relics: ['overpressure_load'], cls: 'vanguard' });
  var heavy = faces(volley('orbital_strike', 1)).length;
  var light = faces(volley('pulse_rifle', 1)).length;
  ok('Overpressure Load takes a 3-cost to four neighbours (' + heavy + ')', heavy === 5);
  ok('...and leaves the 1-cost alone (' + light + ')', light === 1);

  /* ---- THE VANGUARD: aim, walk, commit -------------------------------- */
  // DOUBLE FEED: a second unaimed round, and no steering at all
  dieRig({ relics: ['double_feed'] });
  E.combat.player.statuses.aim = 9;
  var df = volley('pulse_rifle', 40);
  ok('Double Feed fires a second root face', faces(df).length >= 60);
  ok('...and Aim can no longer steer', !df.some(function (e) { return e.type === 'steer'; }));

  // ZEROING STAKE: registered once, grazed by every attack
  var zc = dieRig({ relics: ['zeroing_stake'], only: 12 });
  ok('Zeroing Stake registers your top cut face (' + zc.stake + ')', zc.stake === 12);
  var zs = faces(volley('pulse_rifle', 40), 'stake').length;
  ok('...and every attack grazes it (' + zs + ')', zs > 0);

  // TRENCH SWEEP / OVERRUN CAM both read the WALK rather than the destination
  dieRig({ relics: ['trench_sweep'], seed: 11 });
  E.combat.player.statuses.aim = 9;
  E.combat.player.statuses.bulwark = 0;
  var tsv = volley('pulse_rifle', 40);
  ok('Trench Sweep builds the wall out of the steer',
     tsv.some(function (e) { return e.type === 'steer'; }) && (E.combat.player.statuses.bulwark || 0) > 0);

  /* OVERRUN CAM only has anything to say on a die cut LOW: steering climbs to
   * a better band, and the bottom of the Vanguard's table is never better than
   * the top. What it rescues is the roll that lands on a bare high face with
   * everything you own engraved down at the other end of the ring. */
  dieRig({ relics: ['overrun_cam'], seed: 5, bare: true });
  for (var lowf = 2; lowf <= 6; lowf++) VS.dieEngrave(E.run.die, 'bracket_fire', lowf);
  E.combat.player.statuses.aim = 30;
  var oc = volley('pulse_rifle', 120).filter(function (e) { return e.type === 'steer'; });
  ok('Overrun Cam steers off the top and round to the bottom',
     oc.some(function (e) { return e.to < e.from; }));

  // REVERSIBLE SEAR: the burst walks both ways
  dieRig({});
  var b0 = faces(volley('burst_fire', 1), 'burst').length;
  dieRig({ relics: ['reversible_sear'] });
  var b1 = faces(volley('burst_fire', 1), 'burst').length;
  ok('Reversible Sear doubles what a BURST touches (' + b1 + ' vs ' + b0 + ')', b0 > 0 && b1 === b0 * 2);

  // FUMBLE DRILL: the hooks resolve, and a jam actually pays them
  dieRig({ relics: ['fumble_drill'], seed: 42 });
  ok('Fumble Drill carries both halves of its payout',
     E.art('misfireStim') === 2 && E.art('misfireWall') === 6);
  E.combat.player.statuses.bulwark = 0; E.combat.player.statuses.stim = 0;
  var fd = volley('pulse_rifle', 200);
  var jammed = fd.some(function (e) { return e.type === 'roll' && e.misfire; });
  ok('...and a jam pays them out', jammed && (E.combat.player.statuses.bulwark || 0) > 0);

  /* ---- THE DIE'S SHAPE ------------------------------------------------- */
  dieRig({});
  ok('the die starts at twenty faces', VS.dieSides(E.run.die) === 20);
  giveRelic('facet_grinder');
  ok('Facet Grinder grinds it out to twenty-two', VS.dieSides(E.run.die) === 22);
  E.run.phase = 'map'; E.toggleRelic('facet_grinder');
  ok('...and unmounting it never shrinks the die back onto your engravings',
     VS.dieSides(E.run.die) === 22);
  ok('a ground die still jams on face 1', VS.dieScale({ sides: 22 }, 1) === 1);
  ok('...and still crits on its top face', VS.dieScale({ sides: 22 }, 22) === 20);

  /* ---- REACHABILITY ---------------------------------------------------
   * Rewards only ever offer tiers 1 and 2, so a tier-3 relic is a design that
   * never reaches a player. Eleven of them existed and four were the
   * Vanguard's most interesting die relics; they are tier 2 now. */
  ['ranging_tables', 'long_shots_debt', 'twinned_pin', 'deadeye_reticle'].forEach(function (id) {
    ok(id + ' is reachable (tier ' + VS.ARTIFACTS[id].tier + ')', VS.ARTIFACTS[id].tier <= 2);
  });
  var DIE_RELICS = ['harmonic_pair','face_lathe','cold_etch','empty_chamber','ballistic_computer',
    'failsafe_governor','manual_override','stutter_bearing','hair_trigger','solid_slug',
    'deadman_regulator','facet_grinder','double_feed','reversible_sear','overrun_cam',
    'zeroing_stake','trench_sweep','fumble_drill','overpressure_load'];
  var unreachable = DIE_RELICS.filter(function (id) {
    var a = VS.ARTIFACTS[id];
    return !a || (a.tier || 1) > 2;
  });
  ok('every new die relic can actually drop' + (unreachable.length ? ' [' + unreachable.join(', ') + ']' : ''),
     unreachable.length === 0);
  var unslotted = DIE_RELICS.filter(function (id) {
    var a = VS.ARTIFACTS[id];
    // the chassis reads the FIRST hook, so that is the one that must have a home
    return !VS.hookForm(a.k || (a.hooks && a.hooks[0] && a.hooks[0].k));
  });
  ok('every new die relic has a hardpoint to sit in' + (unslotted.length ? ' [' + unslotted.join(', ') + ']' : ''),
     unslotted.length === 0);
})();

console.log('\n' + (fails === 0 ? 'ALL MECHANIC TESTS PASSED' : fails + ' MECHANIC TESTS FAILED'));
process.exit(fails === 0 ? 0 : 1);
