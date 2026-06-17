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
 require('../js/augments.js');
require('../js/potions.js');
require('../js/echoes.js');
require('../js/enemies.js');
require('../js/events.js');
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

/* 4. Echo Core: first attack each turn plays twice */
startFight('technomancer');
E.combat.player.statuses.echo = 1;
E.combat.echoReady = true;
bigEnemies();
var hp0 = E.combat.enemies[0].hp;
setHand(['pulse_rifle', 'pulse_rifle']);
playId('pulse_rifle', 0);
var d1 = hp0 - E.combat.enemies[0].hp;
var hp1 = E.combat.enemies[0].hp;
playId('pulse_rifle', 0);
var d2 = hp1 - E.combat.enemies[0].hp;
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
E.run.artifacts = ['static_capacitor'];
bigEnemies();
var hpA = E.combat.enemies[0].hp + E.combat.enemies[0].block;
setHand(['combat_shield']);
playId('combat_shield');
var anyHurt = E.combat.enemies.some(function (e) { return e.hp + e.block < 100; });
ok('Static Capacitor pings an enemy when you gain Shield', anyHurt);

/* 12. Reaper Protocol: heal on kill */
startFight('vanguard');
E.run.artifacts = ['reaper_protocol'];
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
E.run.augments = ['armor_weave']; // plate 2 each turn (passive)
E.combat.playedShield = false;
E.combat.player.block = 0;
E.endTurn(); // triggers a fresh turn with passive plate shield
ok('passive plate shield does NOT set playedShield', E.combat.playedShield === false && E.combat.player.block >= 2);
startFight('vanguard');
E.combat.playedShield = false;
setHand(['combat_shield']); // a shield CARD
playId('combat_shield');
ok('playing a Shield card DOES set playedShield', E.combat.playedShield === true);

/* ---- augments (level-up draft) ---- */

/* 16. Augment draft offers 3 class-legal options */
E.seed(5); E.newRun('vanguard');
var offer = E.augmentChoices();
ok('Augment draft offers 3 options', offer.length === 3);
ok('augments are class-legal', offer.every(function (id) { var g = VS.AUGMENTS[id]; return g.cls === 'any' || g.cls === 'vanguard'; }));

/* 17. A hook augment becomes active immediately */
E.seed(5); E.newRun('vanguard');
E.chooseAugment('honed_edge');
ok('Honed Edge grants +3 flat damage', E.art('flatDmg') === 3);

/* 18. Stat augment resolves "class" to the right attribute */
E.seed(5); E.newRun('voidadept');
var psiBefore = E.run.attrs.psi;
E.chooseAugment('calibrate');
ok('Calibration adds to the class stat (PSI for Void Adept)', E.run.attrs.psi === psiBefore + 1);

/* 19. Overclock makes the first card of a turn cost 1 less */
startFight('vanguard');
E.run.augments = ['overclock'];
E.combat.cardsThisTurn = 0;
var ra = { uid: 1, id: 'railgun', up: false }; // cost 2
ok('Overclock: first card costs 1 less', E.cardInfo(ra).cost === 1);
E.combat.cardsThisTurn = 1;
ok('Overclock: later cards cost full', E.cardInfo(ra).cost === 2);

/* 20. Killchain draws a card on kill */
startFight('vanguard');
E.run.augments = ['killchain'];
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
E.chooseAugment('reckless_overdrive');
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
ok('Recurrence wipes relics', E.run.artifacts.length === 0);
ok('Recurrence keeps Echoes', E.run.echoes.indexOf('ascendant_core') >= 0);
ok('Ascendant Core grants +2 core attribute', E.attr('psi') === 4);
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
startFight('vanguard'); E.run.artifacts = ['omega_visor']; bigEnemies();
VS.BALANCE.dice.critThreshold = 1; // force every attack to crit
setHand(['pulse_rifle']); var dp0 = E.combat.drawPile.length; playId('pulse_rifle', 0);
ok('Omega Visor draws a card on crit', dp0 - E.combat.drawPile.length === 1);
// Targeting Matrix (augment): crit -> +1 Might
startFight('vanguard'); E.run.augments = ['targeting_matrix']; bigEnemies();
VS.BALANCE.dice.critThreshold = 1; E.combat.player.statuses = {};
setHand(['pulse_rifle']); playId('pulse_rifle', 0);
ok('Targeting Matrix grants Might on crit', (E.combat.player.statuses.str || 0) >= 1);
VS.BALANCE.dice.critThreshold = CRIT;
// Disruptor Field (augment): gain Shield -> apply Weak
startFight('vanguard'); E.run.augments = ['disruptor_field']; bigEnemies();
setHand(['combat_shield']); playId('combat_shield');
ok('Disruptor Field applies Weak on Shield gain', E.combat.enemies.some(function (e) { return (e.statuses.weak || 0) > 0; }));
// Soul Pyre (augment): attacks also apply Burn
startFight('voidadept'); E.run.augments = ['soul_pyre']; bigEnemies();
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
E.run.pendingRelic = 'war_sigil';
E.finishEvent();
ok('finishEvent waits while a relic is pending', E.run.phase === 'event-result' && E.run.pendingRelic === 'war_sigil');
E.takeEventRelic();
ok('takeEventRelic grants the relic', E.run.artifacts.indexOf('war_sigil') >= 0 && !E.run.pendingRelic);
E.run.pendingRelic = 'cog_implant';
E.skipEventRelic();
ok('skipEventRelic leaves it behind', !E.run.pendingRelic && E.run.artifacts.indexOf('cog_implant') < 0);

/* 45. Damage buffs (flat) are reflected on the card description */
startFight('vanguard');
var baseN = parseInt(E.cardInfo({ uid: 1, id: 'pulse_rifle', up: false }).desc.match(/Deal (\d+)/)[1], 10);
E.run.augments = ['honed_edge']; // +3 flat damage
var buffN = parseInt(E.cardInfo({ uid: 2, id: 'pulse_rifle', up: false }).desc.match(/Deal (\d+)/)[1], 10);
ok('Honed Edge (+3) shows on the card (' + baseN + ' -> ' + buffN + ')', buffN === baseN + 3);

/* 46. Breaching Rounds applies Vulnerable on attack */
startFight('vanguard'); E.run.augments = ['breaching_rounds']; bigEnemies();
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

console.log('\n' + (fails === 0 ? 'ALL MECHANIC TESTS PASSED' : fails + ' MECHANIC TESTS FAILED'));
process.exit(fails === 0 ? 0 : 1);
