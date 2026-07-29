/* =========================================================================
 * VOIDSPIRE — codex generator.
 * Boots the game data headless and writes ONE Markdown reference: the classes
 * (stats, die table, openings, archetypes), the keyword glossary, and every
 * card with its base and upgraded effect. Regenerate after any change:
 *   node test/cardsdoc.js
 *
 * Everything measurable is READ from the game data — attributes, starting
 * decks, die bands, opening marks, anchor relics, and the card count behind
 * each archetype. Only the archetype names and their one-line reads are
 * authored here, so the document cannot drift from the game it describes.
 * ========================================================================= */
'use strict';

global.VS = global.VS || {};
require('../js/balance.js');
require('../js/cards.js');
require('../js/cardart.js');
require('../js/artifacts.js');
require('../js/dice.js');

var fs = require('fs');
var path = require('path');
var VS = global.VS, ns = VS, B = VS.BALANCE;
var CARDS = ns.CARDS;

var RARITY = { '-1': 'Curse', 0: 'Starter', 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Legendary' };
var CLASS_INFO = ns.CLASS_INFO;
var CLASS_ORDER = ['vanguard', 'technomancer', 'voidadept', 'any', 'curse'];
var CLASS_NAME = {
  vanguard: 'Vanguard', technomancer: 'Technomancer', voidadept: 'Void Adept',
  any: 'Neutral (any class)', curse: 'Curses',
};
var CLASS_TAG = {
  vanguard: 'Shock trooper — MIGHT weapons & raw aggression.',
  technomancer: 'Machine-priest — TECH shields, turrets & reactors.',
  voidadept: 'Sanctioned psyker — PSI burns, hexes & blasts.',
  any: 'Colourless cards any class can draft (starters, boss & event pool).',
  curse: 'Unplayable junk that clogs your deck.',
};

// which cards start in each class deck (to tag the opening hand)
var STARTERS = {};
Object.keys(ns.STARTER_DECKS).forEach(function (cls) {
  ns.STARTER_DECKS[cls].forEach(function (id) { (STARTERS[id] = STARTERS[id] || {})[cls] = true; });
});

function costStr(def) {
  if (def.xcost) return 'X';
  var base = ns.cardCost(def, false);
  var up = ns.cardCost(def, true);
  return base === up ? String(base) : base + ' → ' + up;
}

function tags(def) {
  var t = [];
  if (def.pool === 'boss') t.push('boss reward only');
  if (def.pool === 'event') t.push('event reward only');
  if (def.exhaust) t.push('Exhaust');
  if (def.retain) t.push('Retain');
  if (def.unplayable) t.push('Unplayable');
  return t;
}

function group(cls) {
  return Object.keys(CARDS).map(function (id) { return { id: id, def: CARDS[id] }; })
    .filter(function (c) {
      if (cls === 'curse') return c.def.type === 'curse';
      return c.def.cls === cls && c.def.type !== 'curse';
    })
    .sort(function (a, b) {
      if (a.def.rarity !== b.def.rarity) return a.def.rarity - b.def.rarity;
      return a.def.name.localeCompare(b.def.name);
    });
}

// The effect line. Cards with a hand-written `text` are authored to be the full
// player-facing description, so prefer it (avoids the auto-fx summary doubling
// up with the flavour text); otherwise build the description from the effects.
function effect(def, upgraded) {
  if (upgraded) {
    if (def.up && def.up.text) return def.up.text;
    if (!def.up) return null;                       // not upgradeable
    if (def.up.fx) return ns.cardDesc(def, true, null, false);
    return def.text || ns.cardDesc(def, true, null, false);   // up only tweaks cost
  }
  return def.text || ns.cardDesc(def, false, null, false);
}

/* ---------------- class section -------------------------------------- */

// A class's archetypes. The status keys are what the game actually calls them,
// so the "N cards" behind each one is counted from the card data rather than
// asserted here — if an archetype loses its support, this number says so.
var ARCHETYPES = {
  vanguard: [
    { name: 'Marksman', keys: ['aim'], rider: true, mark: 'the_long_shot',
      read: 'Aim is added to every attack roll, so he is the only class that can climb his own die table. Crit payoffs sit on top of it.' },
    { name: 'Momentum', keys: ['momentum', 'fullauto'],
      read: 'Every attack makes the next one bigger, and it all resets at end of turn — so the payoff is one long turn, not a long fight.' },
    { name: 'Blood engine', keys: ['bloodrage'],
      read: 'Wounds you inflict on yourself feed your Might. The cards that cost HP stop being a price and start being the engine.' },
    { name: 'Exhaust / Salvo', keys: ['salvo', 'demolition', 'resolve', 'salvage', 'quartermaster'], exhaust: true,
      read: 'Burning a card through Exhaust is itself the effect — shrapnel, Shield or a fresh draw every time one goes.' },
    { name: 'Counter-punch', keys: ['parry', 'thorns', 'retaliate', 'vengeance', 'spikeward'], mark: 'the_set_shield',
      read: 'Parry absorbs like Shield but hits back, and it scales with Might — defence that is not a wasted turn.' },
  ],
  technomancer: [
    { name: 'Constructs', keys: ['turret', 'drone', 'hive', 'swarmUplink'], mark: 'the_standing_line',
      read: 'Turrets and drone swarms fire at the end of every turn whether you did anything or not. Something works while you do not.' },
    { name: 'Reactor', keys: ['reactor'], mark: 'the_closed_circuit',
      read: 'Energy economy. He cannot steer his die, so he builds a bus that makes every roll pay for something.' },
    { name: 'Conduit control', keys: ['conduit', 'weak', 'vuln'], mark: 'the_damping_field',
      read: 'He carries more Weak and Vulnerable than anyone. Conduit turns each application into damage, so control IS the damage.' },
    { name: 'Bulwark', keys: ['plate', 'platedArmor', 'aegisLink', 'barricade'],
      read: 'His die band scales Shield as well as damage, which is why the defensive turn still reads on the roll.' },
    { name: 'Powers', keys: ['subroutine', 'echo'],
      read: 'Powers are permanent for the fight; Subroutine draws off each one, so the setup turns pay themselves back.' },
  ],
  voidadept: [
    { name: 'Burn', keys: ['burn', 'entropy', 'wildfire', 'contagion'], mark: 'the_first_ember',
      read: 'Burn normally halves each turn. Wildfire makes it GROW and spread instead, which turns a slow fight into his best case.' },
    { name: 'Psi ramp', keys: ['psiPow', 'psiRamp', 'ascendant'], mark: 'the_long_whisper',
      read: 'Psi Focus compounds. It is the payoff for surviving the middle of the die, where he is weakest.' },
    { name: 'Blood Pact', keys: ['bloodPact'], mark: 'the_open_vein',
      read: 'Spending HP grants Psi Focus — and the bottom of his die already bills him in HP, so a bad roll feeds the engine.' },
    { name: 'Plague', keys: ['plague', 'vuln', 'weak', 'thousandCuts'],
      read: 'Hexes stacked across the whole encounter, so the damage arrives from every direction at once rather than from a card.' },
  ],
};

// how many of a class's cards touch any of these keys
function archCount(cls, a) {
  return Object.keys(CARDS).filter(function (id) {
    var def = CARDS[id];
    if (def.cls !== cls) return false;
    var blob = JSON.stringify(def);
    if (a.exhaust && def.exhaust) return true;
    if (a.rider && blob.indexOf('"onRoll"') >= 0) return true;
    return (a.keys || []).some(function (k) {
      return blob.indexOf('"s":"' + k + '"') >= 0 || blob.indexOf('"special":"' + k + '"') >= 0;
    });
  }).length;
}

// the relics that exist to point at a class's builds
function anchors(cls) {
  return Object.keys(ns.ARTIFACTS).filter(function (id) { return ns.ARTIFACTS[id].cls === cls; })
    .map(function (id) { return ns.ARTIFACTS[id]; });
}

function classSection(out, cls) {
  var info = CLASS_INFO[cls], st = B.classes[cls], die = B.dice.classes[cls];
  out.push('\n---\n');
  out.push('### ' + CLASS_NAME[cls].toUpperCase() + ' — _' + info.tag + '_\n');
  out.push('> ' + info.desc + '\n');

  var attrs = [['MIGHT', st.might], ['TECH', st.tech], ['PSI', st.psi]]
    .filter(function (a) { return a[1]; }).map(function (a) { return a[0] + ' ' + a[1]; }).join(', ');
  var deck = {};
  ns.STARTER_DECKS[cls].forEach(function (id) { var n = CARDS[id].name; deck[n] = (deck[n] || 0) + 1; });
  out.push('**' + st.hp + ' HP · ' + attrs + ' · ' + group(cls).length + ' cards**  ');
  out.push('Opening deck: ' + Object.keys(deck).map(function (k) { return deck[k] + '× ' + k; }).join(', ') + '\n');

  // the die table, which is the real class identity
  out.push('**' + die.name + '** — _' + die.read + '_\n');
  out.push('| Roll | Band | Damage |');
  out.push('| --- | --- | --- |');
  die.bands.forEach(function (b) {
    out.push('| ' + b.min + '+ | ' + b.label + ' | ×' + b.mult + (b.hploss ? ' _(−' + b.hploss + ' HP)_' : '') + ' |');
  });
  var mf = die.misfire;
  out.push('| nat 1 | ' + mf.label + ' | ×' + mf.mult +
    (mf.energy ? ' _(+' + mf.energy + ' Energy)_' : '') + (mf.hploss ? ' _(−' + mf.hploss + ' HP)_' : '') + ' |');
  out.push('');

  out.push('**Openings.** One is cut into the die before the first jump — a statement of which part of the table you are building for.\n');
  (ns.FIRST_MARKS[cls] || []).forEach(function (m) {
    var eng = ns.DIE_AUGMENTS[m.eng];
    out.push('- **' + m.name + '** — _' + m.want + '_. ' + m.line +
      (eng ? '  \n  Cuts _' + eng.name + '_: ' + eng.desc + (CARDS[m.card] ? ' Adds **' + CARDS[m.card].name + '** to the deck.' : '') : ''));
  });
  out.push('');

  out.push('**Archetypes.**\n');
  out.push('| Build | Cards | Reads |');
  out.push('| --- | --- | --- |');
  ARCHETYPES[cls].forEach(function (a) {
    var mark = a.mark && (ns.FIRST_MARKS[cls] || []).filter(function (m) { return m.id === a.mark; })[0];
    out.push('| **' + a.name + '**' + (mark ? '<br>_opens ' + mark.name + '_' : '') + ' | ' + archCount(cls, a) + ' | ' + a.read + ' |');
  });
  out.push('');

  var an = anchors(cls);
  if (an.length) {
    out.push('**Class-locked relics.**\n');
    an.forEach(function (a) { out.push('- **' + a.name + '** — ' + a.desc); });
    out.push('');
  }
}

/* ---------------- document -------------------------------------------- */

var out = [];
out.push('# VOIDSPIRE — Codex\n');
out.push('_Auto-generated from the game data (`node test/cardsdoc.js`). Effect text is exactly what the game shows; numbers are the base values **before** any MIGHT/TECH/PSI scaling._\n');

var total = Object.keys(CARDS).length;
out.push('**' + total + ' cards · 3 classes.** Jump to: [The Die](#the-die) · [Classes](#the-classes) · [Keywords](#keywords) · ' +
  CLASS_ORDER.map(function (c) { return '[' + CLASS_NAME[c] + ' cards](#' + CLASS_NAME[c].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + ')'; }).join(' · ') + '\n');

/* ---- the die, which every class shares and each one reads differently ---- */
out.push('\n---\n');
out.push('## The Die\n');
out.push('Every attack rolls a d20. All three classes roll the same die and **read it differently** — that table is the class identity more than the cards are.\n');
out.push('| Roll | ' + ['vanguard', 'technomancer', 'voidadept'].map(function (c) {
  return CLASS_NAME[c] + ' — ' + B.dice.classes[c].name;
}).join(' | ') + ' |');
out.push('| --- | --- | --- | --- |');
[0, 1, 2].forEach(function (i) {
  var cells = ['vanguard', 'technomancer', 'voidadept'].map(function (c) {
    var b = B.dice.classes[c].bands[i];
    return b.label + ' ×' + b.mult + (b.hploss ? ' _(−' + b.hploss + ' HP)_' : '');
  });
  out.push('| **' + B.dice.classes.vanguard.bands[i].min + '+** | ' + cells.join(' | ') + ' |');
});
out.push('| **nat 1** | ' + ['vanguard', 'technomancer', 'voidadept'].map(function (c) {
  var m = B.dice.classes[c].misfire;
  return m.label + ' ×' + m.mult + (m.energy ? ' _(+' + m.energy + ' Energy)_' : '') + (m.hploss ? ' _(−' + m.hploss + ' HP)_' : '');
}).join(' | ') + ' |');
out.push('');
out.push('The Vanguard\'s is a **ramp**, and he is the only class with Aim, so he can climb it. The Technomancer\'s is the **widest spread** and he cannot steer at all — his answer is redundancy, and a tripped breaker refunds Energy rather than being dead. The Void Adept\'s is a **U**: the bottom of his die hits harder than the middle and bills him in HP, so his most common outcome is his worst one.\n');

out.push('\n---\n');
out.push('## The Classes\n');
['vanguard', 'technomancer', 'voidadept'].forEach(function (cls) { classSection(out, cls); });

/* ---- keyword glossary ---- */
out.push('\n---\n');
out.push('## Keywords\n');
out.push('_Every status and mechanic the cards below refer to (' + Object.keys(ns.KEYWORDS).length + ')._\n');
Object.keys(ns.KEYWORDS).forEach(function (k) { out.push('- **' + k + '** — ' + ns.KEYWORDS[k]); });
out.push('');

out.push('\n---\n');
out.push('## The Cards\n');

CLASS_ORDER.forEach(function (cls) {
  var list = group(cls);
  if (!list.length) return;
  out.push('\n---\n');
  out.push('### ' + CLASS_NAME[cls] + '\n');
  out.push('_' + CLASS_TAG[cls] + ' (' + list.length + ' cards)_\n');

  var lastRarity = null;
  list.forEach(function (c) {
    var def = c.def;
    if (def.rarity !== lastRarity) { out.push('\n#### ' + RARITY[def.rarity] + '\n'); lastRarity = def.rarity; }

    var type = def.type.charAt(0).toUpperCase() + def.type.slice(1);
    var meta = [type, '⚡' + costStr(def)];
    var tg = tags(def);
    if (STARTERS[c.id]) {
      var inDecks = Object.keys(STARTERS[c.id]);
      // for class cards the starter is obvious; for neutral starters say which class
      if (cls === 'any') tg.push('starter: ' + inDecks.map(function (d) { return CLASS_NAME[d]; }).join(', '));
      else tg.push('starting card');
    }

    var head = '**' + def.name + '**  — ' + meta.join(' · ');
    if (tg.length) head += '  _(' + tg.join('; ') + ')_';
    out.push('- ' + head);

    var base = effect(def, false);
    out.push('    - Base: ' + (base || '—'));
    var up = effect(def, true);
    if (!def.up) out.push('    - Upgraded: _(cannot be upgraded)_');
    else if (up && up !== base) out.push('    - Upgraded: ' + up);
    else out.push('    - Upgraded: _(no change)_');
  });
});

out.push('\n');
var dest = path.join(__dirname, '..', 'CODEX.md');
fs.writeFileSync(dest, out.join('\n'));
console.log('wrote ' + dest + ' (' + total + ' cards, 3 classes, ' + Object.keys(ns.KEYWORDS).length + ' keywords)');
