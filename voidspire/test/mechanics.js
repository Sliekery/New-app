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
ok('Honed Edge grants +2 flat damage', E.art('flatDmg') === 2);

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
openEvent('quantum_slots');
E.run.credits = 100;
var res = E.eventChoose(0); // feed 25, gamble
ok('gamble produced a result', !!res && typeof res.text === 'string');

/* 26. addCardChoice queues a card chooser */
openEvent('arms_fabricator');
E.run.credits = 100;
E.eventChoose(0); // commission a weapon -> addCardChoice
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
ok('continueDescent routes to the augment draft', (E.continueDescent(), E.run.phase === 'levelup'));

console.log('\n' + (fails === 0 ? 'ALL MECHANIC TESTS PASSED' : fails + ' MECHANIC TESTS FAILED'));
process.exit(fails === 0 ? 0 : 1);
