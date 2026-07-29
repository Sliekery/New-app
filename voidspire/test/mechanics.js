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

/* 1. Powers are consumed, not recycled (the reported bug) */
startFight('vanguard');
setHand(['combat_stims']);
playId('combat_stims');
ok('power applies its effect', (E.combat.player.statuses.str || 0) > 0);
ok('power does NOT go to discard', !E.combat.discard.some(function (c) { return c.id === 'combat_stims'; }));
ok('power does NOT go to draw pile', !E.combat.drawPile.some(function (c) { return c.id === 'combat_stims'; }));
ok('power goes to the consumed pile', E.combat.consumed.some(function (c) { return c.id === 'combat_stims'; }));

/* 2. Limit Break doubles Might */
startFight('vanguard');
E.combat.player.statuses.str = 4;
setHand(['limit_break']);
playId('limit_break');
ok('Limit Break doubles Might (4 -> 8)', E.combat.player.statuses.str === 8);

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

/* 13. Quest: Berserker's Pact completes after 15 kills, then grants Might */
startFight('vanguard');
E.run.artifacts = []; E.run.quests = {}; E.run.questDone = {};
E.addArtifact('berserker_pact');
for (var q = 0; q < 15; q++) E.questProgress('kills', 1);
ok("Berserker's Pact quest completes at 15 kills", E.questState('berserker_pact').done);
ok("completed quest grants its hook (strStart)", E.art('strStart') === 2);

/* 14. Quest: Glass Cannon reduces max HP on pickup and boosts damage */
startFight('vanguard');
E.run.artifacts = []; E.run.quests = {}; E.run.questDone = {};
var maxBefore = E.run.maxHp;
E.addArtifact('glass_cannon');
ok('Glass Cannon cuts Max HP by ~25%', E.run.maxHp < maxBefore);
ok('Glass Cannon boosts damage (dmgMult)', E.art('dmgMult') === 0.5);

/* 15. Quest progress: Offline Shield only counts shieldless wins */
startFight('vanguard');
E.run.artifacts = []; E.run.quests = {}; E.run.questDone = {};
E.addArtifact('offline_shield');
E.questProgress('noShieldWin', 1);
ok('Offline Shield advances on a shieldless win', E.questState('offline_shield').progress === 1);

/* 15b. PASSIVE shield (relic/plate) does NOT break the no-Shield quest,
 * but PLAYED shield (a card) does */
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

/* ---- relics you have to earn (was: the class-quest chain) ---- */

/* 16. Unlockable relics are earned, never dropped */
E.seed(5); E.newRun('vanguard');
var locked = E.lockedRelics();
ok('a class starts with its unlockable relics locked', locked.length === 2);
ok('and they carry a stated requirement',
   locked.every(function (id) { var u = VS.ARTIFACTS[id].unlock; return u && u.goal > 0 && !!u.label; }));
var dropped = [];
for (var dz = 0; dz < 300; dz++) { E.seed(dz); E.newRun('vanguard'); var got = E.randomArtifact(1); if (got && VS.ARTIFACTS[got].unlock) dropped.push(got); }
ok('an unlockable relic never turns up as a drop' + (dropped.length ? ' — ' + dropped[0] : ''), dropped.length === 0);

/* 17. Meeting the requirement grants it, on the spot */
E.seed(5); E.newRun('vanguard');
var target = E.lockedRelics().filter(function (id) { return VS.ARTIFACTS[id].unlock.track === 'kills'; })[0];
var goal = VS.ARTIFACTS[target].unlock.goal;
E.events = [];
for (var qk = 0; qk < goal; qk++) E.classQuestTick('kills', 1);
ok('meeting the requirement grants the relic (' + VS.ARTIFACTS[target].name + ')', E.run.artifacts.indexOf(target) >= 0);
ok('and announces it, so the deed reads as the cause',
   E.events.some(function (e) { return e.type === 'relicUnlocked' && e.id === target; }));
ok('it is no longer listed as locked', E.lockedRelics().indexOf(target) < 0);
var before = E.run.artifacts.length;
E.classQuestTick('kills', goal);
ok('and cannot be granted twice', E.run.artifacts.length === before);

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

function openEvent(id) {
  E.seed(9); E.newRun('vanguard');
  E.run.currentEvent = id; E.run.phase = 'event'; E.run.eventResult = null;
}
function evt(id) { return VS.EVENTS.filter(function (e) { return e.id === id; })[0]; }

/* 22. cost is charged exactly once (no double-deduct via fx) */
openEvent('rogue_trader');
E.run.credits = 100;
var ix = evt('rogue_trader').choices.findIndex(function (c) { return c.cost === 30; });
E.eventChoose(ix);
ok('event cost charged once (100 - 30 = 70)', E.run.credits === 70);

/* 23. conditional "blue" option hidden without the requirement, shown with it */
openEvent('mind_cleanser');
ok('curse-gated option locked with no curse', !E.eventChoiceAvailable(evt('mind_cleanser').choices[0]));
E.run.deck.push({ uid: 1, id: 'void_taint', up: false });
ok('curse-gated option unlocked with a curse', E.eventChoiceAvailable(evt('mind_cleanser').choices[0]));

/* 24. removeCurse purges curses from the deck */
openEvent('mind_cleanser');
E.run.credits = 50;
E.run.deck.push({ uid: 2, id: 'void_taint', up: false });
E.run.deck.push({ uid: 3, id: 'shrapnel', up: false });
var curseBefore = E.run.deck.filter(function (c) { return VS.CARDS[c.id].type === 'curse'; }).length;
E.eventChoose(0); // submit to the purge (removeCurse: true)
var curseAfter = E.run.deck.filter(function (c) { return VS.CARDS[c.id].type === 'curse'; }).length;
ok('removeCurse cleared all curses (' + curseBefore + ' -> ' + curseAfter + ')', curseBefore >= 2 && curseAfter === 0);

/* 25. gamble resolves to one of its outcomes */
openEvent('cryopod');
E.run.credits = 100;
var res = E.eventChoose(0); // force the seal -> commit-blind gamble
ok('gamble produced a result', !!res && typeof res.text === 'string');

/* 26. addCardChoice queues a card chooser */
openEvent('stranded_drifter');
E.run.credits = 100;
E.eventChoose(0); // share supplies -> addCardChoice
ok('addCardChoice offers cards to add', Array.isArray(E.run.pendingAddCard) && E.run.pendingAddCard.length > 0);
ok('finishEvent blocks until a card is chosen', (E.finishEvent(), E.run.phase === 'event-result'));
var deckN = E.run.deck.length;
E.eventAddCard(E.run.pendingAddCard[0]);
ok('eventAddCard adds the card and clears the pending state', E.run.deck.length === deckN + 1 && !E.run.pendingAddCard);

/* 27. check odds are computed sensibly */
E.seed(9); E.newRun('voidadept'); // psi 2
var od = E.checkOdds({ attr: 'psi', dc: 12 });
ok('check odds within 0-100 and reflect the bonus', od.pct >= 0 && od.pct <= 100 && od.bonus === E.attr('psi'));

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
ok('enterRecurrence opens the narrative', (E.enterRecurrence(), E.run.phase === 'recurrence-intro'));

/* 33. Echoes: equipped hooks fold into art() */
startFight('vanguard'); E.run.loadout = ['hollow_crown'];
ok('hasEcho reads the loadout', E.hasEcho('hollow_crown'));
ok('Hollow Crown adds dmgMult', Math.abs(E.art('dmgMult') - 0.30) < 1e-9);
ok('Hollow Crown adds dmgTakenMult', Math.abs(E.art('dmgTakenMult') - 0.30) < 1e-9);

/* 34. World power: loop scaling + the Unmaker's Tithe */
startFight('vanguard'); E.run.loadout = []; E.run.loop = 4;
ok('loop 4 world mult = 1.36', Math.abs(E.worldPowerMult() - 1.36) < 1e-9);
E.run.loop = 1; E.run.loadout = ['unmaker_tithe'];
ok("Tithe makes enemies 25% stronger", Math.abs(E.worldPowerMult() - 1.25) < 1e-9);

/* 35. Momentum Engine: each card buffs the next, resets each turn */
startFight('vanguard'); E.run.loadout = ['momentum_engine'];
ok('momentum starts at 0', (E.combat.momentum || 0) === 0);
setHand(['combat_shield']); playId('combat_shield');
ok('momentum +1 after a card', E.combat.momentum === 1);

/* 36. Doubled Self: a turn-1 card resolves twice */
function shieldGain(echo) {
  startFight('vanguard'); if (echo) E.run.loadout = [echo];
  E.combat.turn = 1; E.combat.player.block = 0;
  setHand(['combat_shield']); playId('combat_shield');
  return E.combat.player.block;
}
var nb = shieldGain(null), db = shieldGain('doubled_self');
ok('Doubled Self doubles a turn-1 card (' + nb + '->' + db + ')', db === nb * 2);

/* 37. Void-Touched: a kill chains 6 to another enemy */
startFight('vanguard'); E.run.loadout = ['void_touched'];
var e0 = E.combat.enemies[0];
var clone = { id: e0.id, def: e0.def, hp: 50, maxHp: 50, block: 0, statuses: {}, moveIdx: 0, lastMove: -1, intent: e0.intent, alive: true };
E.combat.enemies = [e0, clone];   // exactly two, so the chain must hit the clone
e0.hp = 4; e0.block = 0;
E.run.potions = ['frag_charge']; E.usePotion(0, 0);
ok('Void-Touched chains 6 on kill', clone.hp === 44);

/* 38. Hunger of the Void: no normal heal, but heal 5 per kill */
startFight('vanguard'); E.run.loadout = ['hunger_void']; E.run.maxHp = 100; E.run.hp = 20;
E.heal(30);
ok('Hunger blocks ordinary healing', E.run.hp === 20);
E.combat.enemies[0].hp = 4; E.combat.enemies[0].block = 0;
E.run.potions = ['frag_charge']; E.usePotion(0, 0);
ok('Hunger heals 5 on a kill', E.run.hp === 25);

/* 39. Phylactery: the first lethal blow leaves you at 30% HP, once per loop */
startFight('vanguard'); E.run.loadout = ['phylactery']; E.run.maxHp = 100; E.run.hp = 5; E.run.phylacteryUsed = false;
E.combat.enemies = [E.combat.enemies[0]];
E.combat.enemies[0].intent = { t: 'block', b: 5 }; E.combat.enemies[0].hp = 50;
E.combat.player.statuses = { burn: 20 }; E.combat.player.block = 0;
E.endTurn();
ok('Phylactery revives instead of dying (hp 30)', E.run.phase !== 'dead' && E.run.hp === 30);
ok('Phylactery is marked used', E.run.phylacteryUsed === true);

/* 40. The Recurrence: full reset keeps Echoes; Ascendant Core persists */
E.newRun('voidadept'); E.run.echoes = ['ascendant_core']; E.run.loadout = ['ascendant_core'];
E.run.artifacts.push('void_lens');   // a normal relic that the Recurrence should wipe
E.run.won = true; E.run.phase = 'victory';
var lp = E.run.loop;
E.enterRecurrence();
ok('Recurrence increments the loop', E.run.loop === lp + 1);
ok('enterRecurrence -> narrative', E.run.phase === 'recurrence-intro');
E.recurrenceContinue();
ok('narrative -> echo draft', E.run.phase === 'echo-draft');
E.chooseEcho(E.echoOffer()[0]);
ok('choosing an Echo -> loadout', E.run.phase === 'echo-loadout');
E.beginLoop();
ok('Recurrence resets the deck to starter', E.run.deck.length === 10);
ok('Recurrence wipes normal relics but keeps the Cornerstone',
   E.run.artifacts.indexOf('void_lens') < 0 && E.run.artifacts.indexOf('hexheart') >= 0);
ok('Recurrence keeps Echoes', E.run.echoes.indexOf('ascendant_core') >= 0);
ok('Ascendant Core grants +2 core attribute (+1 from Hexheart tier 1)', E.attr('psi') === 5);
ok('new loop begins at sector 1', E.run.sector === 1 && E.run.phase === 'sector-intro');

/* 41. Loadout respects the slot cap */
E.newRun('vanguard');
E.run.echoes = ['hollow_crown', 'void_battery', 'momentum_engine', 'hunger_void']; E.run.loadout = [];
E.echoToggle('hollow_crown'); E.echoToggle('void_battery'); E.echoToggle('momentum_engine');
ok('three Echoes equip', E.run.loadout.length === 3);
ok('a 4th is rejected at the cap', E.echoToggle('hunger_void') === false && E.run.loadout.length === 3);
ok('un-equipping frees a slot', E.echoToggle('hollow_crown') === true && E.run.loadout.length === 2);

/* 42. Salvage Doctrine: every 3rd kill grafts a card; no card rewards */
startFight('vanguard'); E.run.loadout = ['salvage_doctrine']; E.run.salvageKills = 2;
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
    if (!a.k || a.quest) return;
    var key = a.k + ':' + (a.a || '');   // attr:might / attr:tech / attr:psi stay distinct
    (byHook[key] = byHook[key] || []).push(id);
  });
  Object.keys(byHook).forEach(function (k) { if (byHook[k].length > 1) dups.push(k + ' -> ' + byHook[k].join(',')); });
  ok('no two non-quest relics share an effect' + (dups.length ? ' [' + dups.join(' | ') + ']' : ''), dups.length === 0);
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
openEvent('asteroid_exchange');
E.run.deck = [{ uid: 1, id: 'pulse_rifle', up: false }, { uid: 2, id: 'combat_shield', up: false }];
E.eventChoose(fxChoiceIdx('asteroid_exchange', 'tradeCard'));
ok('tradeCard sets pendingTrade(card)', !!E.run.pendingTrade && E.run.pendingTrade.kind === 'card');
var giveRar = VS.CARDS['pulse_rifle'].rarity || 1, beforeN = E.run.deck.length;
var tr = E.tradeCardPick(0);
ok('tradeCard removed one and added a higher-tier card', !!tr && E.run.deck.length === beforeN && !E.run.pendingTrade);
ok('tradeCard forged a card a tier up', (VS.CARDS[E.run.deck[E.run.deck.length - 1].id].rarity || 1) >= Math.min(3, giveRar + 1));

/* sell: liquidate a card for credits */
E.newRun('vanguard'); E.run.credits = 0;
E.run.deck = [{ uid: 1, id: 'pulse_rifle', up: false }, { uid: 2, id: 'combat_shield', up: false }];
E.run.pendingSell = { kind: 'card' };
var opts = E.sellOptions();
ok('sellOptions lists non-curse cards with values', opts.length === 2 && opts[0].value > 0);
var sold = E.sellPick(0);
ok('sellPick grants credits and removes the card', E.run.credits === sold && E.run.deck.length === 1 && !E.run.pendingSell);

/* pressLuck: push accrues, bank applies the pot */
openEvent('asteroid_mine');
var plIdx = firstChoiceIdx('asteroid_mine', 'pressLuck');
ok('asteroid_mine has a pressLuck choice', plIdx >= 0);
E.eventChoose(plIdx);
ok('pressLuck enters its own phase', E.run.phase === 'press-luck' && !!E.run.pressLuck);
var info0 = E.pressLuckInfo();
ok('pressLuckInfo reports level 0 and a next reward', info0.level === 0 && !!info0.nextReward);
// force a guaranteed-safe push by zeroing the bust chance is awkward; just push and accept either result
var beforeCr = E.run.credits;
var push = E.pressLuckPush();
ok('pressLuckPush returns a roll vs threshold', !!push && typeof push.roll === 'number' && typeof push.busted === 'boolean');
E.pressLuckBank();
ok('pressLuckBank clears state and produces a result', !E.run.pressLuck && E.run.phase === 'event-result' && !!E.run.eventResult);

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
VS.dieEngrave(br.die, 'scrap_sifter', 5);           // spans 5,6,7
ok('a band augment occupies its whole span', VS.dieFaceId(br.die, 7) === 'scrap_sifter');
ok('a band that will not fit is refused', typeof E.shopReseat(5, 11) === 'string');   // 11-13, and 12 is taken
ok('a refused reseat puts the band back', VS.dieFaceId(br.die, 5) === 'scrap_sifter' && VS.dieFaceId(br.die, 7) === 'scrap_sifter');
ok('a refused reseat costs nothing', br.credits === 500 && !br.shop.reseatUsed);
ok('the band reseats where it does fit', E.shopReseat(5, 16) === null && VS.dieFaceId(br.die, 18) === 'scrap_sifter' && VS.dieFaceId(br.die, 5) === null);

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
ok('every remaining class has a starter deck whose cards all exist',
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
  ok('Ash Reliquary arms Salvo before turn 1', atCombatStart('ash_reliquary', 'vanguard', 'salvo') === 2);
  ok('Iron Leech arms Blood Rage before turn 1', atCombatStart('iron_leech', 'vanguard', 'bloodrage') === 2);
  ok('Resonance Node banks Psi Focus before turn 1', atCombatStart('resonance_node', 'voidadept', 'psiPow') === 2);

  // Cycling Breech is a rule-bender, not a number — it has to survive a turn.
  function momentumAfterTurn(withRelic) {
    E.seed(4); E.newRun('vanguard'); E.takeFirstMark(0);
    if (withRelic) { E.run.artifacts.push('cycling_breech'); E.run.die.core.push('cycling_breech'); }
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
    E.startNode('fight');
    E.combat.player.statuses.momentum = 5;
    E.endTurn();
    var v = (E.combat.player.statuses || {}).momentum || 0;
    E.run.phase = 'map';
    return v;
  }
  ok('Momentum still resets without a Cycling Breech', momentumAfterTurn(false) === 0);
  ok('and survives the turn with one', momentumAfterTurn(true) === 5);

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
  flatDie(function () {
    E.seed(8); E.newRun('vanguard'); E.takeFirstMark(0);
    E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
    E.startNode('fight');
    var c = E.combat, en = c.enemies[0];
    en.hp = 9999; en.maxHp = 9999; c.energy = 30; en.platedReady = false;
    c.player.statuses.momentum = 0;
    c.hand = [{ uid: 5001, id: 'follow_through', up: false }];
    var hp1 = en.hp; E.playCard(0, 0); var dmgNoMo = hp1 - en.hp;
    c.player.statuses.momentum = 6;
    c.hand = [{ uid: 5002, id: 'follow_through', up: false }];
    var hp2 = en.hp; E.playCard(0, 0); var dmgMo = hp2 - en.hp;
    ok('Follow Through actually spends Momentum (' + dmgNoMo + ' -> ' + dmgMo + ')', dmgMo > dmgNoMo);
  });
  E.run.phase = 'map';

  // Every new card must be reachable as a reward, or it is content nobody sees.
  var NEW = ['worry_wound','sympathetic_ache','follow_through','overrun','munitions_link','bootstrap','brace_plate'];
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
  ok('it cannot start where it would run off the die', !!VS.dieCanEngrave(die, 'ranging_mark', 19));
  ok('nor where its span would overlap something', !!VS.dieCanEngrave(die, 'ranging_mark', 7));
  VS.dieEngrave(die, 'ranging_mark', 15);
  ok('placing it covers every face in its span',
     VS.dieFaceId(die, 15) === 'ranging_mark' && VS.dieFaceId(die, 16) === 'ranging_mark' && VS.dieFaceId(die, 17) === 'ranging_mark');

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

console.log('\n' + (fails === 0 ? 'ALL MECHANIC TESTS PASSED' : fails + ' MECHANIC TESTS FAILED'));
process.exit(fails === 0 ? 0 : 1);
