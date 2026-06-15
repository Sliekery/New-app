/* =========================================================================
 * VOIDSPIRE — card reference generator.
 * Boots the game data headless and writes a Markdown catalogue of every card
 * (base + upgraded effect) grouped by class. Regenerate after any card change:
 *   node test/cardsdoc.js
 * ========================================================================= */
'use strict';

global.VS = global.VS || {};
require('../js/balance.js');
require('../js/cards.js');

var fs = require('fs');
var path = require('path');
var VS = global.VS, ns = VS, B = VS.BALANCE;
var CARDS = ns.CARDS;

var RARITY = { '-1': 'Curse', 0: 'Starter', 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Legendary' };
var CLASS_ORDER = ['vanguard', 'technomancer', 'voidadept', 'warpcaller', 'any', 'curse'];
var CLASS_NAME = {
  vanguard: 'Vanguard', technomancer: 'Technomancer', voidadept: 'Void Adept',
  warpcaller: 'Warpcaller', any: 'Neutral (any class)', curse: 'Curses',
};
var CLASS_TAG = {
  vanguard: 'Shock trooper — MIGHT weapons & raw aggression.',
  technomancer: 'Machine-priest — TECH shields, turrets & reactors.',
  voidadept: 'Sanctioned psyker — PSI burns, hexes & blasts.',
  warpcaller: 'Ship captain — BOND pets in a positional formation (Wall / Alpha / Butcher).',
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

var out = [];
out.push('# VOIDSPIRE — Card Catalogue\n');
out.push('_Auto-generated from the game data (`node test/cardsdoc.js`). Effect text is exactly what the game shows; numbers are the base values **before** any MIGHT/TECH/PSI/BOND scaling._\n');

// table of contents + totals
var total = Object.keys(CARDS).length;
out.push('**' + total + ' cards total.** Jump to: ' +
  CLASS_ORDER.map(function (c) { return '[' + CLASS_NAME[c] + '](#' + CLASS_NAME[c].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + ')'; }).join(' · ') + '\n');

CLASS_ORDER.forEach(function (cls) {
  var list = group(cls);
  if (!list.length) return;
  out.push('\n---\n');
  out.push('## ' + CLASS_NAME[cls] + '\n');
  out.push('_' + CLASS_TAG[cls] + ' (' + list.length + ' cards)_\n');

  var lastRarity = null;
  list.forEach(function (c) {
    var def = c.def;
    if (def.rarity !== lastRarity) { out.push('\n### ' + RARITY[def.rarity] + '\n'); lastRarity = def.rarity; }

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
var dest = path.join(__dirname, '..', 'CARDS.md');
fs.writeFileSync(dest, out.join('\n'));
console.log('wrote ' + dest + ' (' + total + ' cards)');
