/* =========================================================================
 * VOIDSPIRE — engine.js
 * All game logic. No DOM access: state in, events out (ns.engine.events),
 * so it can be driven by the UI or by a headless simulator.
 * ========================================================================= */
(function (ns) {
  'use strict';

  var B = ns.BALANCE;
  var E = {};
  ns.engine = E;

  /* ---------------- RNG (seeded, persisted in the run) ----------------- */
  var rngState = (Date.now() & 0xffffffff) >>> 0;
  function rnd() {
    rngState = (rngState + 0x6D2B79F5) >>> 0;
    var t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); } // inclusive
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function d20() { return ri(1, 20); }
  E.seed = function (s) { rngState = s >>> 0; };

  /* ---------------- Event queue (UI drains this) ----------------------- */
  E.events = [];
  function emit(type, data) {
    var e = data || {}; e.type = type;
    E.events.push(e);
    if (E.onEvent) E.onEvent(e);
  }

  /* ---------------- Run state ------------------------------------------ */
  E.run = null;
  E.combat = null;
  var uidCounter = 1;

  function mkCard(id, up) { return { uid: uidCounter++, id: id, up: !!up }; }

  E.newRun = function (clsId) {
    var c = B.classes[clsId];
    var deck = ns.STARTER_DECKS[clsId].map(function (id) { return mkCard(id, false); });
    var fac = pick(Object.keys(ns.FACTIONS));
    E.run = {
      cls: clsId,
      hp: c.hp, maxHp: c.hp,
      attrs: { might: c.might, tech: c.tech, psi: c.psi, bond: c.bond || 0 },
      credits: B.player.startCredits,
      deck: deck,
      artifacts: [],
      die: ns.newDie(),    // THE AUGMENTED DIE: faces / core / frame
      bossOrder: shuffle((ns.BOSSES[fac] || []).slice()),   // no sector boss repeats in a run
      relicOff: {},        // relics switched off (toggled on the star chart)
      relicUses: {},       // remaining durability for relics that have it
      sector: 1,
      faction: fac,
      map: null,
      mapRow: -1, mapCol: 0,
      phase: 'none',
      usedEvents: [],
      removeCost: B.shop.removeCost,
      kills: 0, nodesCleared: 0,
      pendingPick: null, pendingAddCard: null,
      quests: {}, questDone: {},
      classQuest: { step: 0, prog: 0, ready: false, picked: null, locked: null },
      augments: [], augmentDeckop: null, augmentOffer: null,
      potions: [], won: false,
      loop: 1, echoes: [], loadout: [], echoOffer: null,
      phylacteryUsed: false, salvageKills: 0,
    };
    E.combat = null;
    if (E.CORNERSTONES !== false && CORNERSTONE_OF[clsId]) {   // grant the class Cornerstone
      E.run.cornerstone = { id: CORNERSTONE_OF[clsId], tier: 1 };
      E.run.artifacts.push(CORNERSTONE_OF[clsId]);
    }
    E.run.map = generateMap(1);
    E.run.phase = 'map';
    E.save();
  };

  // A relic only applies while it's switched ON and not spent (durability > 0).
  E.relicActive = function (id) {
    var r = E.run; if (!r) return true;
    if (r.relicOff && r.relicOff[id]) return false;
    if (r.relicUses && r.relicUses[id] != null && r.relicUses[id] <= 0) return false;
    return true;
  };

  /* ---- Cornerstones: a class signature relic that survives the Recurrence and
   * forges stronger each loop. Its effect scales with the stored forge tier, so
   * it's injected into attr()/art() rather than carried as a static relic value. */
  var CORNERSTONE_OF = { voidadept: 'hexheart' };
  E.CORNERSTONES = true;   // sim can flip this off to measure the baseline
  function cornerstoneHooks() {
    var cs = E.run && E.run.cornerstone;
    if (!cs) return null;
    var t = cs.tier || 1;
    if (cs.id === 'hexheart') {
      // Hexheart (Voidadept / affliction): +PSI, amplifies Burn (hexweaver), and
      // hardens you with starting Shield from tier 3 on.
      return { psi: t, hexweaver: Math.max(0, t - 1), blockStart: t >= 3 ? (t - 2) * 5 : 0 };
    }
    return null;
  }
  E.cornerstoneTier = function () { return (E.run && E.run.cornerstone && E.run.cornerstone.tier) || 0; };

  /* Effective attribute incl. artifacts */
  function attr(name) {
    var v = E.run.attrs[name] || 0;
    for (var i = 0; i < E.run.artifacts.length; i++) {
      if (!E.relicActive(E.run.artifacts[i])) continue;
      var a = ns.ARTIFACTS[E.run.artifacts[i]];
      if (a.k === 'attr' && a.a === name) v += a.v;
    }
    var ch = cornerstoneHooks();
    if (ch && ch[name]) v += ch[name];
    return v;
  }
  E.attr = attr;
  // Is a Void Echo currently EQUIPPED (in the loadout, not merely owned)?
  E.hasEcho = function (id) {
    return !!(E.run && E.run.loadout && E.run.loadout.indexOf(id) >= 0);
  };
  // Cumulative run depth: each cleared Recurrence loop counts as `finale`
  // sectors, so depth == sector on the first loop and keeps climbing after.
  E.depth = function () { return (E.run.loop - 1) * B.run.finale + E.run.sector; };
  // Sum of hook k over owned artifacts, including quest "done" hooks once the
  // artifact's quest has been completed, plus augments and EQUIPPED echoes.
  function art(k) {
    var t = 0, owned = E.run.artifacts;
    for (var i = 0; i < owned.length; i++) {
      if (!E.relicActive(owned[i])) continue;   // toggled off, or spent (durability 0)
      var a = ns.ARTIFACTS[owned[i]];
      if (a.k === k) t += a.v;
      if (a.hooks) for (var hh = 0; hh < a.hooks.length; hh++) if (a.hooks[hh].k === k) t += a.hooks[hh].v;  // multi-effect / tradeoff relics
      if (a.done && a.done.k === k && E.run.questDone && E.run.questDone[owned[i]]) t += a.done.v;
    }
    var aug = E.run.augments || [];
    for (var j = 0; j < aug.length; j++) {
      var g = ns.AUGMENTS[aug[j]];
      if (!g) continue;
      if (g.hook && g.hook.k === k) t += g.hook.v;
      if (g.hooks) for (var h = 0; h < g.hooks.length; h++) if (g.hooks[h].k === k) t += g.hooks[h].v;
    }
    var ech = E.run.loadout || [];
    for (var e = 0; e < ech.length; e++) {
      var ee = ns.ECHOES[ech[e]];
      if (!ee) continue;
      if (ee.hook && ee.hook.k === k) t += ee.hook.v;
      if (ee.hooks) for (var hh = 0; hh < ee.hooks.length; hh++) if (ee.hooks[hh].k === k) t += ee.hooks[hh].v;
    }
    var ch = cornerstoneHooks();
    if (ch && k !== 'psi' && ch[k]) t += ch[k];   // psi is an attribute, handled in attr()
    return t;
  }
  E.art = art;

  /* ---------------- Quest artifacts ------------------------------------ */
  function questProgress(track, amount) {
    var r = E.run;
    if (!r.quests) return;
    Object.keys(r.quests).forEach(function (id) {
      var a = ns.ARTIFACTS[id];
      if (!a || !a.quest || a.quest.track !== track || r.questDone[id]) return;
      if (track === 'creditsAtOnce') r.quests[id] = Math.max(r.quests[id], amount);
      else r.quests[id] += amount;
      if (r.quests[id] >= a.quest.goal) {
        r.quests[id] = a.quest.goal;
        r.questDone[id] = true;
        // some completed quests apply a one-time max-HP change
        if (a.done && a.done.k === 'maxHp') { r.maxHp += a.done.v; r.hp += a.done.v; }
        emit('questDone', { id: id });
      }
    });
  }
  E.questProgress = questProgress;
  E.questState = function (id) {
    var a = ns.ARTIFACTS[id];
    if (!a || !a.quest) return null;
    return { goal: a.quest.goal, progress: (E.run.quests && E.run.quests[id]) || 0, done: !!(E.run.questDone && E.run.questDone[id]) };
  };

  /* ---------------- Class quest chains (earn your signature relic) -------- */
  var CLASS_CHAINS = {
    vanguard: { name: 'The Warpath', relics: ['recoilless_frame', 'execution_protocol'], steps: [
      { track: 'kills', goal: 8, label: 'Kill 8 enemies' },
      { track: 'turnDamage', goal: 45, atOnce: true, label: 'Deal 45 damage in a single turn' },
      { track: 'turnDamage', goal: 80, atOnce: true, label: 'Deal 80 damage in a single turn' } ] },
    technomancer: { name: 'Forge Liturgy', relics: ['forge_reserve', 'capacitive_plating'], steps: [
      { track: 'shieldGained', goal: 80, label: 'Gain 80 Shield' },
      { track: 'shieldAtOnce', goal: 30, atOnce: true, label: 'Hold 30 Shield at once' },
      { track: 'shieldGained', goal: 200, label: 'Gain 200 Shield total' } ] },
    voidadept: { name: 'The Long Hunger', relics: ['hexweaver', 'void_conduit'], steps: [
      { track: 'burnApplied', goal: 40, label: 'Apply 40 Burn' },
      { track: 'burnAtOnce', goal: 10, atOnce: true, label: 'Stack 10 Burn on one enemy' },
      { track: 'burnApplied', goal: 120, label: 'Apply 120 Burn total' } ] },
    warpcaller: { name: 'Brood Covenant', relics: ['blood_bond', 'brood_womb'], steps: [
      { track: 'petsSummoned', goal: 10, label: 'Summon 10 pets' },
      { track: 'petsAlive', goal: 4, atOnce: true, label: 'Have 4 pets alive at once' },
      { track: 'petsSummoned', goal: 22, label: 'Summon 22 pets total' } ] },
  };
  E.classChain = function () { return CLASS_CHAINS[E.run && E.run.cls]; };
  function classQuestTick(track, amount) {
    var r = E.run, q = r.classQuest;
    if (!q || q.ready || q.picked) return;
    var chain = CLASS_CHAINS[r.cls]; if (!chain) return;
    var step = chain.steps[q.step]; if (!step || step.track !== track) return;
    q.prog = step.atOnce ? Math.max(q.prog, amount) : q.prog + amount;
    if (q.prog >= step.goal) {
      q.step++; q.prog = 0;
      if (q.step >= chain.steps.length) { q.ready = true; emit('classQuestReady', { name: chain.name }); }
      else emit('classQuestStep', { step: q.step, total: chain.steps.length, label: chain.steps[q.step].label, name: chain.name });
    }
  }
  E.classQuestTick = classQuestTick;
  E.takeClassRelic = function (i) {
    var r = E.run, q = r.classQuest, chain = CLASS_CHAINS[r.cls];
    if (!q || !q.ready || q.picked || !chain) return;
    var id = chain.relics[i]; if (!id) return;
    addArtifact(id);
    q.picked = id; q.locked = chain.relics[1 - i]; q.ready = false;
    E.save();
  };

  E.score = function () {
    var r = E.run;
    return (r.sector - 1) * B.score.perSector + r.nodesCleared * B.score.perNode + r.kills * B.score.perKill +
      ((r.loop || 1) - 1) * B.score.perLoop;
  };

  /* ---------------- Map generation (branching star chart) -------------- */
  // A planar DAG woven by random walks on a fixed column grid, so paths
  // branch and merge without edge crossings. Boss sits above the top row.
  function generateMap(sector) {
    if (E.run && (E.run.loop || 1) === B.run.heartLoop) return heartMap();
    var M = B.map, ROWS = M.rows, COLS = M.cols;
    var rowObjs = [];
    for (var i = 0; i < ROWS; i++) rowObjs.push({});

    function getNode(rr, col) {
      if (!rowObjs[rr][col]) rowObjs[rr][col] = { row: rr, col: col, type: null, edges: [], parents: [], visited: false };
      return rowObjs[rr][col];
    }
    var gaps = [];
    for (i = 0; i < ROWS - 1; i++) gaps.push({});
    function addEdge(rr, c, c2) {
      // avoid X-crossings: if the opposing diagonal exists in this gap, straighten
      var g = gaps[rr];
      if (c2 === c + 1 && g[(c + 1) + '>' + c]) c2 = c;
      else if (c2 === c - 1 && g[(c - 1) + '>' + c]) c2 = c;
      c2 = Math.max(0, Math.min(COLS - 1, c2));
      var a = getNode(rr, c), b = getNode(rr + 1, c2);
      if (a.edges.indexOf(c2) < 0) a.edges.push(c2);
      if (b.parents.indexOf(c) < 0) b.parents.push(c);
      g[c + '>' + c2] = true;
      return c2;
    }

    // weave several paths bottom -> top
    for (var p = 0; p < M.paths; p++) {
      var c = ri(0, COLS - 1);
      getNode(0, c);
      for (var rr = 0; rr < ROWS - 1; rr++) {
        var nc = c + ri(-1, 1);
        c = addEdge(rr, c, nc);
      }
    }

    // rows as sorted arrays
    var rows = rowObjs.map(function (obj) {
      return Object.keys(obj).map(function (k) { return obj[k]; }).sort(function (x, y) { return x.col - y.col; });
    });

    // boss node above the top content row
    var boss = { row: ROWS, col: Math.floor((COLS - 1) / 2), type: 'boss', edges: [], parents: [], visited: false };
    rows[ROWS - 1].forEach(function (n) { n.edges = ['boss']; });

    // Lanes: the chart's columns split into three braided "highways", each with a
    // character. Which lane sits where is randomised per sector for replay variety.
    var laneNames = shuffle(['gauntlet', 'supply', 'frontier']);
    rows.forEach(function (row) { row.forEach(function (n) { n.lane = laneNames[Math.min(2, Math.floor(n.col / COLS * 3))]; }); });

    assignTypes(rows, sector);
    markHazards(rows);
    return { rows: rows, boss: boss, ROWS: ROWS, COLS: COLS, lanes: laneNames };
  }

  // Some nodes in the Push sit in "hot zones" — entering them costs HP (you fight
  // your way in), but they're worth it. Concentrated on the Gauntlet lane.
  function markHazards(rows) {
    var M = B.map;
    for (var r = M.act1End + 1; r <= M.act2End; r++) {
      rows[r].forEach(function (n) {
        if (n.type === 'fight' || n.type === 'event' || n.type === 'treasure' || n.type === 'rift') {
          var chance = n.lane === 'gauntlet' ? 0.45 : n.lane === 'frontier' ? 0.22 : 0.08;
          if (rnd() < chance) n.hazard = 4 + ri(0, 5);
        }
      });
    }
  }

  function weightedType(weights) {
    var pool = [];
    Object.keys(weights).forEach(function (t) { for (var i = 0; i < weights[t]; i++) pool.push(t); });
    return pick(pool);
  }

  // Each lane skews which encounters show up along it (applied on top of the act
  // weights in the Push/Final): Gauntlet = danger & loot, Supply = sustain & shops,
  // Frontier = the unknown.
  var LANE_BIAS = {
    gauntlet: { elite: 2.4, beacon: 2.4, treasure: 2.0, fight: 1.3, rest: 0.3, shop: 0.4, market: 0.4, forge: 0.4 },
    supply:   { shop: 2.4, market: 2.4, rest: 2.2, forge: 2.4, elite: 0.3, beacon: 0.2, fight: 0.7, rift: 0.4 },
    frontier: { event: 2.2, rift: 2.6, random: 2.2, fight: 0.9, elite: 0.6, beacon: 0.7 },
  };
  function laneWeights(base, lane) {
    var bias = LANE_BIAS[lane]; if (!bias) return base;
    var out = {};
    Object.keys(base).forEach(function (t) { out[t] = Math.max(1, Math.round(base[t] * (bias[t] || 1))); });
    return out;
  }

  function assignTypes(rows, sector) {
    var M = B.map, ROWS = M.rows, A = M.actWeights;
    for (var r = 0; r < ROWS; r++) {
      var isFirst = (r === 0), isLast = (r === ROWS - 1);
      // the three acts gate which encounters can appear at each depth
      var base = (r <= M.act1End) ? A.approach : (r <= M.act2End) ? A.push : A.final;
      var laneBiased = (r > M.act1End);   // Approach stays a gentle, lane-neutral on-ramp
      rows[r].forEach(function (node) {
        if (isFirst) { node.type = 'fight'; return; }                 // entry row: all fights
        if (isLast && M.restBeforeBoss) { node.type = 'rest'; return; } // catch your breath before the boss
        var weights = laneBiased ? laneWeights(base, node.lane) : base;
        var t = weightedType(weights), tries = 0;
        while (tries++ < 16) {
          // don't stack two of the same "special" node back-to-back on a path
          if (t === 'shop' || t === 'rest' || t === 'elite' || t === 'forge') {
            var clash = node.parents.some(function (pc) {
              var pn = rows[r - 1].find(function (x) { return x.col === pc; });
              return pn && pn.type === t;
            });
            if (clash) { t = weightedType(weights); continue; }
          }
          break;
        }
        node.type = t;
      });
    }
  }

  /* ---------------- Map navigation ------------------------------------- */
  function currentNode() {
    var r = E.run, m = r.map;
    if (!m || r.mapRow < 0) return null;
    if (r.mapRow >= m.ROWS) return m.boss;
    var row = m.rows[r.mapRow];
    for (var i = 0; i < row.length; i++) if (row[i].col === r.mapCol) return row[i];
    return null;
  }
  E.currentNode = currentNode;

  // The sector's boss (for the map telegraph).
  E.sectorBossId = function () {
    var r = E.run;
    if ((r.loop || 1) === B.run.heartLoop) return E.counterBossId(r);
    if (r.sector === B.run.finale) return ns.FINAL_BOSS;
    var order = r.bossOrder && r.bossOrder.length ? r.bossOrder : [].concat(ns.BOSSES[r.faction]);
    return order[(r.sector - 1) % order.length];
  };
  E.sectorBossName = function () { var d = ns.ENEMIES[E.sectorBossId()]; return d ? d.name : 'SECTOR BOSS'; };

  E.mapReachable = function () {
    var r = E.run, m = r.map;
    if (!m) return [];
    if (r.mapRow < 0) return m.rows[0].slice();        // choose any starting node
    if (r.mapRow >= m.ROWS) return [];                 // already at the boss
    if (r.mapRow === m.ROWS - 1) return [m.boss];      // top content row -> boss
    var node = currentNode();
    if (!node) return [];
    var nextRow = m.rows[r.mapRow + 1];
    var out = [];
    node.edges.forEach(function (col) {
      for (var i = 0; i < nextRow.length; i++) if (nextRow[i].col === col) out.push(nextRow[i]);
    });
    return out;
  };

  function resolveRandomNode() {
    return weightedType({ fight: 30, event: 34, shop: 16, rest: 20 });
  }

  E.enterNode = function (node) {
    var reach = E.mapReachable();
    if (reach.indexOf(node) < 0) return false;
    var r = E.run;
    r.mapRow = node.row; r.mapCol = node.col;
    node.visited = true;
    if (node.hazard > 0) { hurtPlayer(node.hazard, { pure: true }); emit('hazard', { dmg: node.hazard }); }
    var t = node.type;
    if (t === 'random') { t = resolveRandomNode(); node.resolved = t; }
    E.startNode(t);
    E.save();
    return true;
  };

  E.startNode = function (type) {
    var r = E.run;
    r.nodeType = type;
    if (type === 'fight' || type === 'elite' || type === 'boss' || type === 'beacon') startCombat(type);
    else if (type === 'event') startEvent();
    else if (type === 'shop') { buildShop(false); r.phase = 'shop'; }
    else if (type === 'market') { buildShop(true); r.phase = 'shop'; }
    else if (type === 'rest') r.phase = 'rest';
    else if (type === 'forge') { r.phase = 'forge'; E.save(); }
    else if (type === 'rift') startRift();
    else if (type === 'treasure') startTreasure();
  };

  /* ---- Void Rift: a chaotic anomaly — one big boon paired with a bane ----- */
  var RIFTS = [
    { boon: 'A surge of power floods your frame.', bane: 'but the void takes its tax in blood.', fx: { attr: 1, hp: -14 } },
    { boon: 'You scavenge a cache of fleet scrip.', bane: 'and a parasite-curse latches to your deck.', fx: { credits: 90, curse: true } },
    { boon: 'The rift mends your wounds completely.', bane: 'but strips the cred from your account.', fx: { healPct: 1, loseCredits: true } },
    { boon: 'Forbidden schematics burn into your mind.', bane: 'searing your max vitality away.', fx: { card: 'rare', maxhp: -8 } },
    { boon: 'A relic phases out of the anomaly.', bane: 'as a wound opens that will not close.', fx: { artifact: true, hp: -18 } },
    { boon: 'Time folds — you draft from the future.', bane: 'paying with a sliver of your soul.', fx: { card: 'colorless', maxhp: -6 } },
  ];
  function startRift() {
    var r = E.run;
    r.rift = RIFTS[Math.floor(rnd() * RIFTS.length)];
    var f = r.rift.fx, gained = [];
    if (f.attr) { var a = E.classStat(); r.attrs[a] = (r.attrs[a] || 0) + f.attr; gained.push('+' + f.attr + ' ' + a.toUpperCase()); }
    if (f.hp < 0) { r.hp = Math.max(1, r.hp + f.hp); gained.push(f.hp + ' HP'); }
    if (f.maxhp) { r.maxHp = Math.max(20, r.maxHp + f.maxhp); r.hp = Math.min(r.hp, r.maxHp); gained.push(f.maxhp + ' Max HP'); }
    if (f.healPct) { heal(Math.ceil(r.maxHp * f.healPct)); gained.push('Full heal'); }
    if (f.credits) { r.credits += f.credits; gained.push('+¢' + f.credits); }
    if (f.loseCredits) { gained.push('Lost ¢' + r.credits); r.credits = 0; }
    if (f.curse) { r.deck.push(mkCard(pick(['void_taint', 'shrapnel']), false)); gained.push('A Curse'); }
    if (f.card) {
      var cid = f.card === 'colorless' ? (rollColorlessCard() || rollRewardCard(0)) : f.card === 'rare' ? (function () { var rr = Object.keys(ns.CARDS).filter(function (k) { var cc = ns.CARDS[k]; return cc.rarity === 3 && !cc.pool && (cc.cls === r.cls || cc.cls === 'any'); }); return rr.length ? pick(rr) : rollRewardCard(0); })() : f.card;
      r.deck.push(mkCard(cid, false)); gained.push('Card: ' + ns.CARDS[cid].name);
    }
    if (f.artifact) { var aid = randomArtifact(1); if (aid) { addArtifact(aid); gained.push('Relic: ' + ns.ARTIFACTS[aid].name); } else { r.credits += 60; gained.push('+¢60'); } }
    r.rift.gained = gained;
    r.phase = 'rift';
    E.save();
  }
  E.finishRift = function () { E.run.rift = null; nodeComplete(); };

  /* ---- Forge: deck-sculpting node — upgrade or remove one card ----------- */
  E.forgePick = function (action) { E.run.pendingPick = (action === 'remove') ? 'remove' : 'upgrade'; E.save(); };
  E.finishForge = function () { E.run.pendingPick = null; nodeComplete(); };

  function startTreasure() {
    var r = E.run;
    var choices = randomArtifactChoices(1, 3);
    if (choices.length) r.treasure = { choices: choices, picked: false, pickedId: null };
    else { r.treasure = null; r.credits += 40; }
    r.phase = 'treasure';
    E.save();
  }
  E.takeTreasureArtifact = function (i) {
    var r = E.run;
    if (!r.treasure || r.treasure.picked) return;
    var id = (r.treasure.choices || [])[i];
    if (!id) return;
    addArtifact(id);
    r.treasure.picked = true; r.treasure.pickedId = id;
    E.save();
  };
  E.finishTreasure = function () { E.run.treasure = null; nodeComplete(); };

  function nodeComplete() {
    var r = E.run;
    r.nodesCleared++;
    var node = currentNode();
    var next = (node && node.type === 'boss') ? 'levelup' : 'map';
    if (r.classQuest && r.classQuest.ready && !r.classQuest.picked) {
      r.classQuest.nextPhase = next;     // claim your signature relic before moving on
      r.phase = 'class-relic';
    } else {
      r.phase = next;
    }
    E.save();
  }
  E.nodeComplete = nodeComplete;
  E.finishClassRelic = function () {
    var r = E.run;
    r.phase = (r.classQuest && r.classQuest.nextPhase) || 'map';
    if (r.classQuest) r.classQuest.nextPhase = null;
    E.save();
  };

  /* ---------------- Level up: Augment Protocol draft ------------------- */
  var CLASS_STAT = { vanguard: 'might', technomancer: 'tech', voidadept: 'psi', warpcaller: 'bond' };
  E.classStat = function () { return CLASS_STAT[E.run.cls] || 'might'; };

  // Draft 3 random augments, rarity-weighted and class-flavored, no repeats
  // of augments already owned (so variety builds over a run).
  E.augmentChoices = function () {
    var r = E.run;
    if (r.augmentOffer) return r.augmentOffer; // stable across re-renders
    var W = B.levelUp.rarityWeights || { 1: 100, 2: 52, 3: 20 };
    var pool = Object.keys(ns.AUGMENTS).filter(function (id) {
      var g = ns.AUGMENTS[id];
      if (g.cls !== 'any' && g.cls !== r.cls) return false;
      // owned single-use passives shouldn't re-offer; stat/heal/deckop can repeat
      if ((g.kind === 'hook' || g.kind === 'pact') && r.augments.indexOf(id) >= 0) return false;
      return true;
    });
    function rollOne() {
      var bag = [];
      pool.forEach(function (id) { var w = W[ns.AUGMENTS[id].rarity] || 1; for (var i = 0; i < w; i++) bag.push(id); });
      return pick(bag);
    }
    var picks = [], guard = 0;
    while (picks.length < 3 && guard++ < 300 && pool.length) {
      var id = rollOne();
      if (picks.indexOf(id) < 0) picks.push(id);
      if (picks.length >= pool.length) break;
    }
    r.augmentOffer = picks;
    E.save();
    return picks;
  };

  // Human-readable label/sub for an augment (resolves 'class' to the real stat).
  E.augmentInfo = function (id) {
    var g = ns.AUGMENTS[id];
    var stat = E.classStat().toUpperCase();
    var desc = g.desc.replace('core attribute', stat);
    var tag = g.kind === 'pact' ? 'PACT' : g.kind === 'deckop' ? 'DECK' : g.kind === 'stat' ? 'STAT' : g.kind === 'heal' ? 'REPAIR' : 'MODULE';
    return { name: g.name, desc: desc, rarity: g.rarity, tag: tag, kind: g.kind };
  };

  E.chooseAugment = function (id) {
    var r = E.run, g = ns.AUGMENTS[id];
    if (!g) return;
    function applyStat(stat, v) {
      if (stat === 'maxhp') { r.maxHp += v; heal(v); }
      else { var a = (stat === 'class') ? E.classStat() : stat; r.attrs[a] += v; }
    }
    if (g.kind === 'stat') applyStat(g.stat, g.v);
    else if (g.kind === 'heal') heal(Math.round(r.maxHp * g.healPct));
    else if (g.kind === 'hook') r.augments.push(id);
    else if (g.kind === 'pact') {
      if (g.maxhpPct) { var lose = Math.round(r.maxHp * g.maxhpPct); r.maxHp -= lose; r.hp = Math.min(r.hp, r.maxHp); }
      if (g.stat) applyStat(g.stat, g.v);
      if (g.hook || g.hooks) r.augments.push(id);
    } else if (g.kind === 'deckop') {
      r.augmentDeckop = g.deckop;
      r.augmentOffer = null;
      if (g.deckop === 'remove') r.pendingPick = 'remove';
      else if (g.deckop === 'upgrade2') r.pendingPick = 'upgrade';
      E.save();
      return; // UI resolves the deck op, then calls finishAugment()
    }
    r.augmentOffer = null;
    setupBossArtifacts();
  };

  E.finishAugment = function () {
    E.run.augmentDeckop = null;
    setupBossArtifacts();
  };

  // Requisition deck-op: offer 3 class cards to add
  E.augmentAddOptions = function () {
    var pool = ns.augmentAddPool(E.run.cls);
    shuffle(pool);
    return pool.slice(0, Math.min(3, pool.length));
  };
  E.augmentAddCard = function (cid) { E.run.deck.push(mkCard(cid, false)); };

  function setupBossArtifacts() {
    var r = E.run;
    var pool = Object.keys(ns.ARTIFACTS).filter(function (k) {
      return ns.ARTIFACTS[k].tier === 2 && r.artifacts.indexOf(k) < 0;
    });
    if (pool.length === 0) pool = Object.keys(ns.ARTIFACTS).filter(function (k) { return ns.ARTIFACTS[k].tier === 1 && r.artifacts.indexOf(k) < 0; });
    shuffle(pool);
    r.bossArtifacts = pool.slice(0, Math.min(3, pool.length));
    r.phase = 'boss-artifact';
    E.save();
  }

  E.takeBossArtifact = function (i) {
    var r = E.run;
    if (r.bossArtifacts[i]) addArtifact(r.bossArtifacts[i]);
    r.bossArtifacts = null;
    newSector();
  };

  function newSector() {
    var r = E.run;
    r.sector++;
    var factions = Object.keys(ns.FACTIONS).filter(function (f) { return f !== r.faction; });
    r.faction = pick(factions);
    r.map = generateMap(r.sector);
    r.mapRow = -1; r.mapCol = 0;
    var sh = art('sectorHeal');
    if (sh > 0) heal(Math.round(r.maxHp * sh));
    r.phase = 'sector-intro';
    E.save();
  }
  E.beginSector = function () { E.run.phase = 'map'; E.save(); };

  /* ---------------- Combat: setup --------------------------------------- */
  // Extra enemy power from the Recurrence loop and the Unmaker's Tithe echo,
  // applied on top of normal per-sector scaling.
  function worldPowerMult() {
    return (1 + B.run.loopPower * ((E.run.loop || 1) - 1)) * (1 + art('worldPower'));
  }
  E.worldPowerMult = worldPowerMult;

  /* ---- The Heart gauntlet (NG+ easter egg) ---------------------------------
   * Score the run into 4 build axes and face the tribute that hard-counters
   * the dominant one. */
  var COUNTER_BOSS = { aggro: 'tribute_silent', bulwark: 'tribute_ironclad', affliction: 'tribute_watcher', engine: 'tribute_defect' };
  function counterAxis(r) {
    r = r || E.run;
    var sc = { aggro: 0, bulwark: 0, affliction: 0, engine: 0 };
    sc.aggro += (r.attrs.might || 0) * 2;
    sc.bulwark += (r.attrs.tech || 0) * 1.5;
    sc.affliction += (r.attrs.psi || 0) * 1.5;
    sc.engine += (r.attrs.bond || 0) * 1.5;     // pet/board builds read as 'engine'
    (r.deck || []).forEach(function (card) {
      var def = ns.CARDS[card.id]; if (!def) return;
      if (def.type === 'power') sc.engine += 2;
      (def.fx || []).forEach(function (f) {
        if (f.k === 'pet') sc.engine += 2;
        if (f.k === 'block') sc.bulwark += 1.2;
        if (f.k === 'draw') sc.engine += 0.5;
        if (f.k === 'dmg' && !f.all) sc.aggro += (f.v >= 10 ? 1.5 : 0.5);
        if (f.k === 'status') {
          if (f.s === 'str' || f.s === 'strPerTurn') sc.aggro += 2;
          else if (f.s === 'burn' || f.s === 'plague' || f.s === 'entropy') sc.affliction += 2;
          else if (f.s === 'vuln' || f.s === 'weak') sc.affliction += 1;
          else if (f.s === 'plate' || f.s === 'platedArmor' || f.s === 'barricade' || f.s === 'afterImage' || f.s === 'feelNoPain' || f.s === 'thorns') sc.bulwark += 2;
          else if (f.s === 'turret' || f.s === 'echo' || f.s === 'reactor' || f.s === 'thousandCuts') sc.engine += 2;
        }
        if (f.k === 'special') {
          if (f.id === 'shieldSlam' || f.id === 'shieldSlam15' || f.id === 'doubleBlock') sc.bulwark += 2;
          else if (f.id === 'limitBreak') sc.aggro += 2;
          else if (f.id === 'catalyst' || f.id === 'catalyst3') sc.affliction += 2;
          else if (f.id === 'reap' || f.id === 'overdrive') sc.engine += 1;
        }
      });
    });
    var best = 'aggro', bv = -1;
    ['aggro', 'bulwark', 'affliction', 'engine'].forEach(function (a) { if (sc[a] > bv) { bv = sc[a]; best = a; } });
    return best;
  }
  E.counterAxis = counterAxis;
  E.counterBossId = function (r) { return COUNTER_BOSS[counterAxis(r)]; };
  E.isHeartLoop = function () { return (E.run.loop || 1) === B.run.heartLoop; };

  // The Heart gauntlet's tiny map: one Heart node, then the tribute boss.
  function heartMap() {
    var heart = { row: 0, col: 0, type: 'rest', heart: true, edges: ['boss'], parents: [], visited: false };
    var boss = { row: 1, col: 0, type: 'boss', edges: [], parents: [0], visited: false };
    return { rows: [[heart]], boss: boss, ROWS: 1, COLS: 1 };
  }
  // deeper into a sector = tougher, to keep pace with the deck you've been
  // building across its (now longer) rows.
  function depthMult() {
    var r = E.run; if (!r || r.mapRow == null) return 1;
    var prog = Math.min(1, Math.max(0, r.mapRow) / Math.max(1, B.map.rows - 1));
    return 1 + prog * (B.scaling.depthBonus || 0);
  }
  function scaledHp(base, s) { return Math.round(base * B.scaling.hpMul(s) * worldPowerMult() * depthMult()); }
  function scaledDmg(base, s) { return Math.round(base * B.scaling.dmgMul(s) * worldPowerMult() * depthMult()); }

  function mkEnemy(id) {
    var def = ns.ENEMIES[id];
    var s = E.run.sector;
    var hp = scaledHp(def.hp, s);
    var hs = art('enemyHpScale');   // Famine Engine: enemies start weakened
    if (hs > 0) hp = Math.max(1, Math.round(hp * (1 - hs / 100)));
    var en = {
      id: id, def: def, hp: hp, maxHp: hp, block: 0,
      statuses: {}, moveIdx: 0, lastMove: -1, intent: null, alive: true,
    };
    var bonusStr = Math.floor((s - 1) / B.scaling.strEverySectors);
    if (bonusStr > 0) en.statuses.str = bonusStr;
    if (def.artAlt) en.art = (rnd() < 0.5) ? def.artAlt : def.art;   // pick one of two art models
    return en;
  }

  function startCombat(kind) {
    var r = E.run;
    var ids, isFinal = false;
    if (kind === 'boss') {
      if ((r.loop || 1) === B.run.heartLoop) { ids = [E.counterBossId(r)]; isFinal = true; }
      else if (r.sector === B.run.finale) { ids = [ns.FINAL_BOSS]; isFinal = true; }
      else ids = [E.sectorBossId()];
    } else if (kind === 'elite' || kind === 'beacon') {
      var epool = [].concat(ns.ELITES[r.faction]);
      ids = [pick(epool)];
      if (r.sector >= 3 && rnd() < B.sector.eliteChance2Enemies) ids.push(ns.ELITE_MINIONS[r.faction]);
    } else {
      var packs = ns.PACKS[r.faction];
      // earlier rows in a sector lean toward easier packs; the harder packs
      // (the new-mechanic enemies, slots 4+) are held back until sector 2+ so
      // sector 1 stays a gentle on-ramp.
      var prog = Math.min(1, r.mapRow / Math.max(1, B.map.rows - 1));
      var hi = (r.sector <= 1) ? 6 : packs.length;
      // cap lo at hi-4 so the window stays 4 packs wide instead of collapsing to
      // a single pack near the top of a sector (which flooded sector 1 with the
      // swarm pack and made late-sector fights monotonous).
      var lo = Math.max(0, Math.min(Math.floor(prog * (packs.length - 5)), hi - 6));
      ids = pick(packs.slice(lo, Math.min(hi, lo + 6))).slice();
      // Sector 1 only: add a fodder minion so hallway fights bite even with
      // perfect blocking (more simultaneous telegraph than one block can cover).
      // The very first fight stays gentle as a tutorial; no bleed into sector 2+.
      if (r.sector === 1 && (r.nodesCleared || 0) >= 1) {
        var fodder = ns.ELITE_MINIONS[r.faction];
        if (ids.length < 2) ids.push(fodder);
        else if (ids.length < 3 && rnd() < 0.4) ids.push(fodder);
      }
    }
    var c = E.combat = {
      kind: kind,
      enemies: ids.map(mkEnemy),
      allies: [],          // the Warpcaller's summoned pets (targetable units)
      turn: 0,
      energy: 0,
      hand: [], drawPile: shuffle(r.deck.slice()), discard: [], exhaust: [], consumed: [],
      // The Vanguard is the marksman class: he sights in every fight, so he starts
      // with Aim on the die. It offsets the misfire risk every attacker carries and
      // makes the d20 matter from turn one, not just for a dedicated dice build.
      player: { block: 0, statuses: (r.cls === 'vanguard' ? { aim: B.dice.vanguardAim } : {}) },
      pending: null,       // an in-combat choice awaiting a pick (Scry/Tutor/Discover)
      primed: [],          // armed delayed detonations (Primed)
      echoReady: false,
      playedShield: false,
      startHp: r.hp,
      cardsThisTurn: 0,
      reactiveUsed: false,
      firstPowerUsed: false,   // Resonance Coil / Void Conduit: first Power each combat
      over: false,
      isFinal: isFinal,
    };
    // Drop Ship: deploys a random escort of bots the moment it arrives.
    c.enemies.slice().forEach(function (en) {
      if (en.def.dropship) {
        var b = en.def.dropship;
        var n = b.min + Math.floor(rnd() * (b.max - b.min + 1));
        for (var i = 0; i < n && c.enemies.length < 5; i++) c.enemies.push(mkEnemy(b.bot));
      }
    });
    var ps = art('strStart');
    if (ps > 0) c.player.statuses.str = ps;
    var es = art('echoStart');
    if (es > 0) c.player.statuses.echo = es;
    var vstart = art('vulnStart');
    if (vstart > 0) c.player.statuses.vuln = vstart;
    var pa = art('platedArmorStart');
    if (pa > 0) c.player.statuses.platedArmor = pa;
    var bs = art('blockStart') + art('blockStartTechMul') * attr('tech');   // Forge Reserve scales with TECH
    if (bs > 0) { c.player.block = bs; } // relic Shield is passive, not "played"
    var ws = art('weakStart');
    if (ws > 0) c.enemies.forEach(function (en, i) { addStatus(en, 'weak', ws); });
    var sd = art('combatStartDamage');
    if (sd > 0) hurtPlayer(sd, { pure: true });
    r.phase = 'combat';
    c.enemies.forEach(chooseIntent);
    startPlayerTurn();
  }

  // All player Shield gains route through here so relics that react to gaining
  // Shield (and the "no Shield" quest) see every source.
  // played = the Shield came from a card the player chose to play (so passive
  // relic/plate/trigger Shield does NOT count against the "no Shield" quest).
  function gainBlock(n, played) {
    var c = E.combat, p = c.player;
    if (n <= 0) return;
    if (art('noShield') > 0) return;   // tradeoff relics that forbid Shield entirely
    p.block += n;
    classQuestTick('shieldGained', n);
    classQuestTick('shieldAtOnce', p.block);
    if (played) c.playedShield = true;
    emit('block', { who: 'player', amount: n, blockAfter: p.block });
    var st = art('shieldThorns');
    if (st > 0 && !c.over) {
      var pool = aliveEnemies();
      if (pool.length) { var en = pick(pool); dealToEnemy(en, c.enemies.indexOf(en), st, { noCrit: true, noWeak: true }); }
    }
    var rt = statN(p, 'retaliate');   // Riposte Protocol: gaining Shield strikes back
    if (rt > 0 && !c.over) {
      var rpool = aliveEnemies();
      if (rpool.length) { var ren = pick(rpool); dealToEnemy(ren, c.enemies.indexOf(ren), rt, { noCrit: true, noWeak: true }); }
    }
    var sw = art('shieldWeak');   // Disruptor Field: Shield gains apply Weak
    if (sw > 0 && !c.over) {
      var poolW = aliveEnemies();
      if (poolW.length) { var enW = pick(poolW); addStatus(enW, 'weak', sw); emit('status', { who: 'enemy', idx: c.enemies.indexOf(enW), s: 'weak', v: sw }); }
    }
    var spp = art('shieldPingPct');   // Capacitive Plating: Shield gains chip a random enemy
    if (spp > 0 && !c.over) {
      var d = Math.floor(n * spp / 100);
      if (d > 0) { var poolP = aliveEnemies(); if (poolP.length) { var enP = pick(poolP); dealToEnemy(enP, c.enemies.indexOf(enP), d, { noCrit: true, noWeak: true }); } }
    }
  }

  /* ---------------- Combat: turn structure ------------------------------ */
  function maxEnergy() { return B.player.baseEnergy + art('energyEveryTurn') + (statN(E.combat.player, 'reactor')); }
  E.maxEnergy = function () { return E.combat ? maxEnergy() : (B.player.baseEnergy || 0); };

  var _inConduit = false;   // re-entrancy guard for the Disruption conduit hook
  function statN(ent, s) { return ent.statuses[s] || 0; }
  function addStatus(ent, s, v) {
    ent.statuses[s] = (ent.statuses[s] || 0) + v;
    if (ent.statuses[s] <= 0) delete ent.statuses[s];
    var isEnemy = E.combat && E.combat.enemies.indexOf(ent) >= 0;
    if (v > 0 && isEnemy && (s === 'weak' || s === 'vuln')) {
      var hx = art('hexweaver');                       // Hexweaver: Weak/Vuln also Burns
      if (hx > 0) addStatus(ent, 'burn', hx);
      var cdt = E.combat && statN(E.combat.player, 'conduit');   // DISRUPTION: debuffs arc for damage
      if (cdt > 0 && !E.combat.over && !_inConduit) {
        _inConduit = true;
        dealToEnemy(ent, E.combat.enemies.indexOf(ent), cdt, { noCrit: true, noWeak: true });
        _inConduit = false;
      }
    }
    if (v > 0 && isEnemy && s === 'burn') {
      classQuestTick('burnApplied', v);
      classQuestTick('burnAtOnce', ent.statuses.burn);
    }
  }

  function startPlayerTurn() {
    var c = E.combat, p = c.player;
    var leftover = c.energy;
    c.turn++;
    c.cardsThisTurn = 0;
    c.enemies.forEach(function (e) { if (e.def.plated) e.platedReady = true; });   // Reactive Plating re-arms each turn
    c.nonAttacksThisTurn = 0;   // Recoilless Frame: per-turn non-attack limit
    c.turnDamage = 0;           // class quest: damage dealt this turn
    c.momentum = 0;   // Momentum Engine resets each turn
    if (p.statuses.momentum) p.statuses.momentum = 0;   // Fusillade: Momentum is a per-turn combo
    // Cursed Inheritance: a curse is lodged in hand at the start of combat
    if (c.turn === 1 && E.hasEcho('cursed_inheritance')) c.hand.push(mkCard('recurring_curse', false));
    // block expiry (Retain / Barricade keep your Shield). Turn 1 has no prior
    // turn to expire, so combat-start Shield (Aegis Core / Forge Reserve) persists.
    if (c.turn > 1 && !statN(p, 'retain') && !statN(p, 'barricade')) p.block = 0;
    if (p.statuses.parry) p.statuses.parry = 0;   // Parry is a per-turn stance (like block)
    // energy (with optional carry-over from Overflow Reactor)
    c.energy = maxEnergy() + (art('energyCarry') > 0 ? leftover : 0);
    if (c.turn === 1) c.energy += art('energyTurn1');
    // per-turn passives
    var plate = statN(p, 'plate') + art('plate');
    if (plate > 0) gainBlock(plate);
    var padv = statN(p, 'platedArmor');
    if (padv > 0) { gainBlock(padv); addStatus(p, 'platedArmor', -1); } // Plated Armor: shield = stacks, then decays
    var spt = statN(p, 'strPerTurn');
    if (spt > 0) addStatus(p, 'str', spt);
    var apt = statN(p, 'aimPerTurn');   // STEADY AIM: marksmanship sharpens every turn
    if (apt > 0) { addStatus(p, 'aim', apt); emit('status', { who: 'player', s: 'aim', v: statN(p, 'aim') }); }
    var psr = statN(p, 'psiRamp');     // ASCENDANT MIND: Psi Focus grows each turn
    if (psr > 0) { addStatus(p, 'psiPow', psr); emit('status', { who: 'player', s: 'psiPow', v: statN(p, 'psiPow') }); }
    var rstk = statN(p, 'restock');    // Quartermaster: rack spent shells back each turn (Bandolier reload loop)
    if (rstk > 0) for (var rk = 0; rk < rstk; rk++) reloadShell();
    if (c.primed.length) {             // Primed: tick down armed detonations; fire at zero
      c.primed = c.primed.filter(function (pr) {
        pr.turns -= 1;
        if (pr.turns <= 0) {
          c.enemies.forEach(function (e, i) { if (e.alive) dealToEnemy(e, i, pr.dmg, { noCrit: true, noWeak: true }); });
          emit('primedBlast', { dmg: pr.dmg });
          return false;
        }
        return true;
      });
    }
    var brood = statN(p, 'brood');     // Overgrowth: birth a disposable Spawnling each turn
    if (brood > 0 && c.turn > 1) summonPet('spawnling', brood);
    var bw = statN(p, 'bulwark');      // Entrench: the front pet digs in (gains block) each turn
    if (bw > 0) { var fa = frontAlly(); if (fa) fa.block += bw; }
    var ht = art('healTurn');
    if (ht > 0) heal(ht);
    var bg = art('burnGrow');
    if (bg > 0) c.enemies.forEach(function (en, i) { if (en.alive && statN(en, 'burn') > 0) { addStatus(en, 'burn', bg); emit('status', { who: 'enemy', idx: i, s: 'burn', v: bg }); } });
    var aoe = art('aoeTurnStart');
    var baseDraw = (E.run.cls === 'warpcaller') ? B.player.drawPerTurn - 1 : B.player.drawPerTurn; // smaller hand: you trade cards for formation control
    var draws = baseDraw + art('drawTurn') + (c.turn === 1 ? art('drawStart') : 0);
    drawCards(draws);
    c.echoReady = statN(p, 'echo') > 0;   // Echo Core: first attack each turn plays twice
    emit('turnStart', { turn: c.turn });
    if (aoe > 0) {
      c.enemies.forEach(function (en, i) {
        if (en.alive) dealToEnemy(en, i, aoe, { noCrit: true, src: 'Singularity' });
      });
    }
    // turn-start effects (Plated Armor / Static Capacitor / Contagion / Singularity)
    // can finish off enemies, so resolve victory here too
    checkWin();
  }

  function drawCards(n) {
    var c = E.combat;
    for (var i = 0; i < n; i++) {
      if (c.hand.length >= B.player.maxHand) return;
      if (c.drawPile.length === 0) {
        if (c.discard.length === 0) return;
        c.drawPile = shuffle(c.discard);
        c.discard = [];
        if (art('reshuffleShield') > 0) gainBlock(art('reshuffleShield'));   // Reclaimer Unit
      }
      c.hand.push(c.drawPile.pop());
    }
  }

  function chooseIntent(en) {
    var def = en.def, mv;
    if (def.charge) {
      // Walker: alternate between winding up and firing a (whittle-able) megahit.
      en.intent = en.charging ? { t: 'attack', walkerFire: true } : { t: 'wk_charge' };
      return;
    }
    if (def.corrupt) {
      // Void Shard: a defensive wall counting down to a permanent card corruption.
      en.intent = { t: 'shard', left: Math.max(0, def.corrupt.turns - (en.shardCount || 0)) };
      return;
    }
    if (def.gaze) {
      // Void Gaze core: dormant behind its eyes, then a scaling gaze once exposed.
      en.intent = aliveEnemies().some(function (e) { return e.id === def.gaze.eye; }) ? { t: 'gaze_dormant' } : { t: 'attack', gaze: true };
      return;
    }
    if (def.dropship) {
      // Drop Ship telegraph: shielded strafing while escorts live, then an armed
      // self-destruct countdown once the pod activates.
      var botsAlive = aliveEnemies().some(function (e) { return e.id === def.dropship.bot; });
      if (en.armed) en.intent = { t: 'ds_fuse', fuse: en.fuse, d: def.dropship.dmg };
      else if (botsAlive) en.intent = { t: 'ds_strafe', d: def.dropship.strafe || 4 };
      else en.intent = { t: 'ds_arm' };
      return;
    }
    if (def.ai === 'cycle') {
      mv = def.moves[en.moveIdx % def.moves.length];
      en.moveIdx++;
    } else {
      var pool = [];
      def.moves.forEach(function (m, i) {
        if (i === en.lastMove && def.moves.length > 1) return;
        for (var w = 0; w < (m.w || 1); w++) pool.push(i);
      });
      var idx = pick(pool);
      en.lastMove = idx;
      mv = def.moves[idx];
    }
    en.intent = mv;
  }

  /* Scaled intent values for display */
  E.intentInfo = function (en) {
    var m = en.intent, s = E.run.sector;
    if (!m) return { icon: '?', label: '' };
    if (m.t === 'attack') {
      var d = (m.walkerFire ? Math.max(0, en.pendingHit || 0) : m.gaze ? gazeDamage(en, s) : scaledDmg(m.d, s)) + statN(en, 'str');
      if (statN(en, 'weak')) d = Math.floor(d * B.status.weakMult);
      if (m.walkerFire) return { icon: 'charge', label: '⚡' + d };
      if (m.gaze) return { icon: 'eye', label: '◉' + d };
      if (m.leech) return { icon: 'drain', label: '' + d };
      var nh = m.hits || 0;
      if (m.hitsPer) nh = Math.max(1, aliveEnemies().filter(function (e) { return e.id === m.hitsPer; }).length);
      return { icon: 'atk', label: (nh ? d + '×' + nh : '' + d) + (m.pierce ? '⊘' : '') + (m.jam ? '⊗' : '') };
    }
    if (m.t === 'gaze_dormant') return { icon: 'eye', label: '' };
    if (m.t === 'wk_charge') return { icon: 'charge', label: 'WIND-UP' };
    if (m.t === 'shard') return { icon: 'corrupt', label: (m.left > 0 ? '⟳' + m.left : 'CORRUPT') };
    if (m.t === 'disrupt') return { icon: 'debuff', label: '✕' };
    if (m.t === 'drain') {
      var dd = scaledDmg(m.d, s) + statN(en, 'str');
      if (statN(en, 'weak')) dd = Math.floor(dd * B.status.weakMult);
      return { icon: 'drain', label: '' + dd };
    }
    if (m.t === 'block') return { icon: 'block', label: '' + scaledDmg(m.b, s) };
    if (m.t === 'guard') return { icon: 'block', label: '↗' + scaledDmg(m.v, s) };
    if (m.t === 'buff') return { icon: 'buff', label: '' };
    if (m.t === 'heal') return { icon: 'heal', label: '' + scaledDmg(m.v, s) };
    if (m.t === 'summon') return { icon: 'summon', label: m.n ? '×' + m.n : '' };
    if (m.t === 'ds_strafe') { var sds = scaledDmg(m.d, s) + statN(en, 'str'); if (statN(en, 'weak')) sds = Math.floor(sds * B.status.weakMult); return { icon: 'atk', label: '' + sds }; }
    if (m.t === 'ds_arm') return { icon: 'fuse', label: 'ARM' };
    if (m.t === 'ds_fuse') return { icon: 'fuse', label: scaledDmg(m.d, s) + ' in ' + m.fuse };
    if (m.t === 'debuff') return { icon: 'debuff', label: '' };
    if (m.t === 'curse') return { icon: 'curse', label: '' };
    if (m.t === 'etch') return { icon: 'corrupt', label: 'ETCH' };
    if (m.t === 'unmake') return { icon: 'unmake', label: '' };
    return { icon: '?', label: '' };
  };

  /* ---------------- Combat: playing cards ------------------------------- */
  E.cardInfo = function (card) {
    var def = ns.CARDS[card.id];
    return {
      def: def,
      name: def.name + (card.up ? '+' : ''),
      cost: effCost(def, card.up, card),
      xcost: !!def.xcost,
      desc: ns.cardDesc(def, card.up, liveCtx(), card.vtouch) + (card.corrupt ? ' Void-Corrupted: costs 1 more.' : ''),
      type: def.type,
      needsTarget: ns.cardNeedsTarget(def, card.up),
      unplayable: !!def.unplayable,
      rarity: def.rarity,
      vtouch: !!card.vtouch,
      corrupt: !!card.corrupt,
    };
  };

  // Effective energy cost: X-cost cards read as 0; under Corruption, Skills cost
  // 0; Overclock makes the first card each turn cost less.
  function effCost(def, up, card) {
    if (def.xcost) return 0;
    var c = ns.cardCost(def, up);
    if (card && card.corrupt) c += 1;   // Void Shard: a permanent corruption tax
    if (E.combat && def.type === 'skill' && statN(E.combat.player, 'corruption') > 0) return 0;
    if (E.combat && def.type === 'power' && !E.combat.firstPowerUsed && art('firstPowerFree') > 0) return 0;   // Void Conduit
    if (E.combat && E.combat.cardsThisTurn === 0) {
      var ff = art('firstCardFree');
      if (ff > 0) c = Math.max(0, c - ff);
    }
    return c;
  }
  E.effCost = effCost;

  function liveCtx() {
    return {
      attrs: { might: attr('might'), tech: attr('tech'), psi: attr('psi'), bond: attr('bond') },
      pri: priAttr(),            // primary attribute name (for 'pri'-scaled cards)
      statuses: E.combat ? E.combat.player.statuses : null,
      flatDmg: art('flatDmg'),   // so cards show damage incl. relic/augment buffs
    };
  }

  // primary attribute of the active class — lets shared/defensive cards scale
  // with whatever the class actually invests in, instead of a fixed attribute.
  var PRI_ATTR = { vanguard: 'might', technomancer: 'tech', voidadept: 'psi', warpcaller: 'bond' };
  function priAttr() { return PRI_ATTR[E.run && E.run.cls] || 'might'; }
  function resolveScale(s) { return s === 'pri' ? priAttr() : s; }

  function attackBonus(f) {
    var p = E.combat.player;
    var mul = f.scaleMul || 1;
    var sc = resolveScale(f.scale);
    var v = statN(p, 'str') + statN(p, 'momentum') + art('flatDmg') + (E.combat.momentum || 0); // Strength + Momentum (Fusillade)
    if (sc === 'might') v += attr('might') * B.attrs.mightDmgPerPoint * mul;
    if (sc === 'tech') v += attr('tech') * mul;
    if (sc === 'psi') v += attr('psi') * B.attrs.psiDmgPerPoint * mul + statN(p, 'psiPow');
    if (sc === 'bond') v += attr('bond') * B.attrs.bondPetPerPoint * mul;
    return Math.round(v);   // damage is always a whole number (no decimals)
  }

  // Void Gaze: base damage + extra per player debuff stack and per Void-Touched card.
  function gazeDamage(en, s) {
    var g = en.def.gaze, p = E.combat ? E.combat.player : null;
    var debuffs = p ? (statN(p, 'weak') + statN(p, 'vuln') + statN(p, 'burn')) : 0;
    var vt = E.run.deck.filter(function (c) { return c.vtouch; }).length;
    return scaledDmg(g.base, s) + g.perDebuff * debuffs + g.perVtouch * vt;
  }

  // Void Shard: permanently corrupt a random eligible card in the run deck.
  function shardCorrupt(idx) {
    var r = E.run, cand = [];
    r.deck.forEach(function (card) {
      var def = ns.CARDS[card.id];
      if (def.type !== 'curse' && !def.unplayable && !card.corrupt) cand.push(card);
    });
    if (!cand.length) { emit('corrupt', { idx: idx, card: null }); return; }
    var card = cand[Math.floor(rnd() * cand.length)];
    card.corrupt = true;
    emit('corrupt', { idx: idx, card: card.id });
  }

  function dealToEnemy(en, idx, amount, opts) {
    opts = opts || {};
    var c = E.combat;
    // Drop Ship hull-ward: impervious until its escort bots are cleared.
    if (en.def.dropship && !en.armed && aliveEnemies().some(function (e) { return e.id === en.def.dropship.bot; })) {
      emit('dmg', { who: 'enemy', idx: idx, amount: amount, hpDmg: 0, warded: true, hpAfter: en.hp, blockAfter: en.block });
      return 0;
    }
    // Generic minion-ward (Void Gaze core): impervious while its eyes still live.
    if (en.def.wardedBy && aliveEnemies().some(function (e) { return e.id === en.def.wardedBy; })) {
      emit('dmg', { who: 'enemy', idx: idx, amount: amount, hpDmg: 0, warded: true, hpAfter: en.hp, blockAfter: en.block });
      return 0;
    }
    // Reactive Plating: fully absorbs the FIRST attack it takes each turn (a cheap
    // jab pops the plate; a single big nuke is wasted on it).
    if (en.def.plated && en.platedReady && !opts.noCrit) {
      en.platedReady = false;
      emit('dmg', { who: 'enemy', idx: idx, amount: amount, hpDmg: 0, warded: true, hpAfter: en.hp, blockAfter: en.block });
      return 0;
    }
    var dm = art('dmgMult');
    if (dm > 0) amount = Math.round(amount * (1 + dm));
    if (E.hasEcho('cursed_inheritance') && handHasCurse()) amount = Math.round(amount * 1.25); // Cursed Inheritance
    if (statN(c.player, 'weak') && !opts.noWeak) amount = Math.floor(amount * B.status.weakMult);
    if (statN(en, 'vuln')) { amount = Math.floor(amount * B.status.vulnMult); amount += art('vulnDmg'); }
    if (opts.execute && en.hp <= en.maxHp * 0.30) amount *= 2;
    if (!opts.noCrit && art('executeBonus') > 0 && en.hp <= en.maxHp * 0.25) amount *= 2;   // Execution Protocol
    if (opts.crit) {
      amount = Math.floor(amount * B.dice.critMult);
      var cv = art('critVuln');
      if (cv > 0 && en.alive) { addStatus(en, 'vuln', cv); emit('status', { who: 'enemy', idx: idx, s: 'vuln', v: cv }); }
    } else if (opts.misfire) {
      amount = Math.max(1, Math.floor(amount * B.dice.misfireMult));   // natural 1: the shot goes wide
    } else if (opts.bandMult && opts.bandMult !== 1) {
      amount = Math.max(1, Math.round(amount * opts.bandMult));        // graze / solid hit
    }
    // Void Drone: each hit is capped at its absorb threshold; a hit that would
    // exceed it spits a Void Swarm curse into your deck (unless the blow lands the kill).
    var overAbsorb = false;
    if (en.def.absorb && amount > en.def.absorb.threshold) { overAbsorb = true; amount = en.def.absorb.threshold; }
    var blocked = Math.min(en.block, amount);
    en.block -= blocked;
    var hpDmg = amount - blocked;
    en.hp -= hpDmg;
    emit('dmg', { who: 'enemy', idx: idx, amount: amount, hpDmg: hpDmg, crit: !!opts.crit, roll: opts.roll, hpAfter: Math.max(0, en.hp), blockAfter: en.block });
    // enemy passives that react to being struck by a player ATTACK (not internal
    // sources, which set noCrit): Enrage gains Strength, Thorns retaliates.
    var byAttack = !opts.noCrit;
    if (en.alive && hpDmg > 0 && byAttack) {
      if (en.def.enrage) { addStatus(en, 'str', en.def.enrage); emit('status', { who: 'enemy', idx: idx, s: 'str', v: en.def.enrage }); }
      if (en.def.thorns) hurtPlayer(en.def.thorns, { pure: true });
    }
    var ls = art('lifestealPct');   // Vampiric Array: attacks heal a % of damage dealt
    if (ls > 0 && hpDmg > 0 && byAttack) heal(Math.floor(hpDmg * ls / 100));
    if (byAttack && hpDmg > 0) { c.turnDamage = (c.turnDamage || 0) + hpDmg; classQuestTick('turnDamage', c.turnDamage); }
    if (en.hp <= 0 && en.alive) {
      en.alive = false;
      E.run.kills++;
      questProgress('kills', 1);
      classQuestTick('kills', 1);
      var hk = art('healOnKill'); if (hk > 0) heal(hk);
      var sk = art('strOnKill'); if (sk > 0) { addStatus(c.player, 'str', sk); emit('status', { who: 'player', s: 'str', v: sk }); }
      var kd = art('killDraw'); if (kd > 0) drawCards(kd);
      // Overload Core: detonates on death — hurts you unless you kept Block up
      if (en.def.overload) { var ov = scaledDmg(en.def.overload, E.run.sector); emit('overload', { idx: idx, amount: ov }); hurtPlayer(ov); }
      emit('die', { idx: idx });
      echoKill(idx);
    }
    if (overAbsorb) {
      var swarmed = null;
      if (en.alive && c) { c.discard.push(mkCard(en.def.absorb.card, false)); swarmed = en.def.absorb.card; }
      emit('absorb', { idx: idx, card: swarmed });
    }
    // Walker: damage dealt while it charges whittles down the pending megahit.
    if (en.def.charge && en.charging && hpDmg > 0) en.pendingHit = Math.max(en.pendingFloor || 0, en.pendingHit - hpDmg);
    return hpDmg;
  }

  // Void Echo on-kill triggers (used by both card-dealt and burn-tick kills).
  function echoKill(idx) {
    var c = E.combat, r = E.run;
    if (E.hasEcho('hunger_void')) healRaw(5);                 // Hunger of the Void
    if (E.hasEcho('salvage_doctrine')) {                      // Salvage Doctrine
      r.salvageKills = (r.salvageKills || 0) + 1;
      if (r.salvageKills % 3 === 0) {
        var cid = rollRewardCard(0);
        r.deck.push(mkCard(cid, false));
        emit('salvage', { id: cid });
      }
    }
    if (E.hasEcho('void_touched')) {                          // Void-Touched: chain
      var pool = aliveEnemies();
      if (pool.length) { var en = pick(pool); dealToEnemy(en, c.enemies.indexOf(en), 6, { noCrit: true, noWeak: true }); }
    }
  }

  function healRaw(n) {
    var r = E.run;
    var before = r.hp;
    r.hp = Math.min(r.maxHp, r.hp + n);
    if (r.hp !== before) emit('heal', { who: 'player', amount: r.hp - before, hpAfter: r.hp });
  }
  // Hunger of the Void blocks all ordinary healing; only kill-heals (healRaw) land.
  function heal(n) {
    if (E.hasEcho('hunger_void')) return;
    healRaw(n);
  }
  E.heal = heal;

  function hurtPlayer(amount, opts) {
    opts = opts || {};
    var c = E.combat, r = E.run;
    var p = c ? c.player : null;
    if (p && statN(p, 'vuln') && !opts.pure) amount = Math.floor(amount * B.status.vulnMult);
    var dtm = art('dmgTakenMult');   // Hollow Crown: take +X% damage
    if (dtm > 0 && !opts.pure) amount = Math.round(amount * (1 + dtm));
    var blocked = 0;
    if (p && !opts.pure) {
      blocked = Math.min(p.block, amount);
      p.block -= blocked;
    }
    var hpDmg = amount - blocked;
    r.hp -= hpDmg;
    if (c && hpDmg > 0 && !opts.pure) c.avengeArmed = true;   // taking a real hit arms Vengeance
    emit('dmg', { who: 'player', amount: amount, hpDmg: hpDmg, hpAfter: Math.max(0, r.hp), blockAfter: p ? p.block : 0 });
    // Reactive Plating: the first HP damage each combat grants Shield
    if (c && hpDmg > 0 && !c.reactiveUsed && !opts.pure) {
      var rp = art('reactivePlate');
      if (rp > 0) { c.reactiveUsed = true; gainBlock(rp); }
    }
    if (r.hp <= 0) {
      // Phylactery: once per loop, the first lethal blow leaves you clinging on.
      if (c && E.hasEcho('phylactery') && !r.phylacteryUsed) {
        r.phylacteryUsed = true;
        r.hp = Math.max(1, Math.round(r.maxHp * 0.30));
        ['vuln', 'weak', 'burn'].forEach(function (s) { if (p.statuses[s]) delete p.statuses[s]; });
        emit('revive', { hpAfter: r.hp });
      } else {
        playerDied();
      }
    }
    return hpDmg;
  }

  function playerDied() {
    var r = E.run;
    if (r.phase === 'dead') return;
    r.phase = 'dead';
    if (E.combat) E.combat.over = true;
    E.recordBest();
    E.clearSave();
    emit('lose', {});
  }

  function aliveEnemies() { return E.combat.enemies.filter(function (e) { return e.alive; }); }
  E.aliveEnemies = aliveEnemies;

  /* ---- The Warpcaller's pets (targetable ally units) --------------------- */
  function aliveAllies() { return E.combat ? E.combat.allies.filter(function (a) { return a.alive; }) : []; }
  E.aliveAllies = aliveAllies;
  // A pet's effective action value: BOND scaling + per-pet buffs + pack buffs.
  function petPower(a) {
    var p = E.combat.player;
    return Math.round(attr('bond') * B.attrs.bondPetPerPoint) + (a.bonusDmg || 0) + statN(p, 'pack') + statN(p, 'bloodscent') + adjacentTotem(a);
  }
  E.petPower = petPower;
  // The pack is an ordered formation; c.allies holds only LIVING pets, front first.
  function frontAlly() { var p = aliveAllies(); return p.length ? p[0] : null; }
  E.frontAlly = frontAlly;
  // Sum of adjacent Totems' buff (placement matters — keep a Totem in the middle).
  function adjacentTotem(a) {
    var c = E.combat; if (!c) return 0;
    var i = c.allies.indexOf(a), buff = 0;
    [i - 1, i + 1].forEach(function (j) { var n = c.allies[j]; if (n && n.alive && n.def.act.t === 'support') buff += n.def.act.v; });
    return buff;
  }
  function mkAlly(id) {
    var def = ns.PETS[id];
    var hp = def.hp + Math.round(attr('bond') * 0.3) + art('petBonusHp');   // Brood Womb
    var models = def.models || [];
    var model = models.length ? models[Math.floor(rnd() * models.length)] : null;
    return { id: id, def: def, hp: hp, maxHp: hp, block: 0, statuses: {}, alive: true, bonusDmg: 0, model: model };
  }
  // What a pet will do this turn (icon + scaled value) — for the Manifest readout.
  E.petInfo = function (a) {
    var act = a.def.act, pw = petPower(a);
    if (act.t === 'attack') return { icon: 'atk', val: (act.d || 0) + pw };
    if (act.t === 'burn') return { icon: 'burn', val: act.v + Math.floor(pw * 0.5) };
    if (act.t === 'block') return { icon: 'block', val: act.v + Math.floor(pw * 0.5) };
    if (act.t === 'support') return { icon: 'support', val: act.v };
    return { icon: 'heal', val: act.v + Math.floor(pw * 0.5) };
  };
  // The formation has a SLOT capacity; each pet has a `size` (slots it fills).
  function petSlots() { return E.combat.allies.reduce(function (s, a) { return s + (a.def.size || 1); }, 0); }
  E.petSlots = petSlots;
  function maxSlots() { return 4 + statN(E.combat.player, 'slots'); }   // + Kennel etc.
  E.maxSlots = maxSlots;
  function summonPet(id, n) {
    var c = E.combat, sz = (ns.PETS[id].size || 1);
    for (var i = 0; i < (n || 1); i++) {
      if (petSlots() + sz > maxSlots()) break;   // no room -> the summon fizzles
      c.allies.push(mkAlly(id));                  // joins the BACK of the formation
      emit('petSummon', { idx: c.allies.length - 1, id: id });
      classQuestTick('petsSummoned', 1);
      classQuestTick('petsAlive', c.allies.length);
    }
  }
  E.summonPet = summonPet;
  // Remove a pet from the formation (death/sacrifice) and fire on-death effects.
  function killAlly(a, sacrifice) {
    var c = E.combat, i = c.allies.indexOf(a);
    if (i < 0 || !a.alive) return;
    a.alive = false;
    c.allies.splice(i, 1);
    emit('petDie', { idx: i });
    // Bloodscent: every death (even a sacrifice) feeds the pack's rage (+1 to all pet actions).
    if (statN(c.player, 'bloodscent') > 0) addStatus(c.player, 'bloodscent', 1);
    if (!sacrifice) {
      var sy = statN(c.player, 'symbiosis');   // a pet dies -> master gains Shield + draws
      if (sy > 0) { gainBlock(sy); drawCards(1); }
      // a dying beast's last act — the Spawnling bursts on death.
      if (a.def.onDie && a.def.onDie.dmg) {
        var pool = aliveEnemies();
        if (pool.length) { var en = pick(pool); dealToEnemy(en, c.enemies.indexOf(en), a.def.onDie.dmg, { noCrit: true, src: 'pet' }); }
      }
    }
  }
  E.killAlly = killAlly;
  function dealToAlly(a, amount) {
    var i = E.combat.allies.indexOf(a);
    var blocked = Math.min(a.block, amount);
    a.block -= blocked;
    var hp = amount - blocked;
    a.hp -= hp;
    emit('petHurt', { idx: i, amount: amount, hpDmg: hp, hpAfter: Math.max(0, a.hp), blockAfter: a.block });
    if (a.hp <= 0 && a.alive) killAlly(a);
    return hp;
  }
  // Reorder the formation (the Manifest's tap-swap). Indices into the living line.
  E.swapPets = function (i, j) {
    var L = E.combat && E.combat.allies; if (!L) return false;
    if (i < 0 || j < 0 || i >= L.length || j >= L.length || i === j) return false;
    var t = L[i]; L[i] = L[j]; L[j] = t; emit('petReorder', {}); return true;
  };
  // Pets act after your turn, before the enemy strikes back. Position matters:
  // the Leech heals the pet directly in FRONT of it.
  function petsAct() {
    var c = E.combat;
    c.allies.slice().forEach(function (a) {
      if (c.over || E.run.phase === 'dead' || !a.alive) return;
      var idx = c.allies.indexOf(a), act = a.def.act, pw = petPower(a);
      emit('petAct', { idx: idx, t: act.t });
      if (act.t === 'attack') {
        var pool = aliveEnemies(); if (!pool.length) return;
        var en = pick(pool);
        dealToEnemy(en, c.enemies.indexOf(en), (act.d || 0) + pw, { noCrit: true, src: 'pet' });
        var bb = art('petAttackHeal'); if (bb > 0) heal(bb);   // Blood Bond
        var feast = statN(c.player, 'feast');   // Savage Feast: the captain heals off the hunt
        if (feast > 0) heal(feast);
      } else if (act.t === 'burn') {
        var p2 = aliveEnemies(); if (!p2.length) return;
        var e2 = pick(p2), bv = act.v + Math.floor(pw * 0.5);
        addStatus(e2, 'burn', bv); emit('status', { who: 'enemy', idx: c.enemies.indexOf(e2), s: 'burn', v: bv });
      } else if (act.t === 'block') {
        gainBlock(act.v + Math.floor(pw * 0.5));
      } else if (act.t === 'heal') {
        var hv = act.v + Math.floor(pw * 0.5);
        var ahead = idx > 0 ? c.allies[idx - 1] : a;   // heals the pet in front of it (else itself)
        ahead.hp = Math.min(ahead.maxHp, ahead.hp + hv);
        emit('petHurt', { idx: c.allies.indexOf(ahead), amount: 0, hpDmg: -hv, hpAfter: ahead.hp });
      }
      // support (Totem) does nothing offensive — its buff is the adjacency bonus.
    });
  }
  E.petsAct = petsAct;

  function handHasCurse() {
    var c = E.combat;
    return !!(c && c.hand.some(function (cd) { return ns.CARDS[cd.id].type === 'curse'; }));
  }

  function checkWin() {
    var c = E.combat;
    if (c.over) return false;
    if (aliveEnemies().length === 0) {
      c.over = true;
      winCombat();
      return true;
    }
    return false;
  }

  // Void Swarm: a curse that disables the hand cards immediately left and right.
  function swarmDisabled(handIdx) {
    var c = E.combat; if (!c) return false;
    var L = c.hand[handIdx - 1], R = c.hand[handIdx + 1];
    return !!((L && ns.CARDS[L.id].disableNeighbors) || (R && ns.CARDS[R.id].disableNeighbors));
  }
  E.swarmDisabled = swarmDisabled;

  E.canPlay = function (handIdx) {
    var c = E.combat;
    if (!c || c.over) return false;
    var card = c.hand[handIdx];
    if (!card) return false;
    if (swarmDisabled(handIdx)) return false;
    var info = E.cardInfo(card);
    // Recoilless Frame: at most N non-attack cards per turn
    var lim = art('maxNonAttack');
    if (lim > 0 && info.type !== 'attack' && (c.nonAttacksThisTurn || 0) >= lim) return false;
    return !info.unplayable && info.cost <= c.energy;
  };

  // Push a card to the exhaust pile, triggering Exhaust-synergy powers.
  function exhaustCard(card) {
    var c = E.combat, p = c.player;
    c.exhaust.push(card);
    var fnp = statN(p, 'feelNoPain');
    if (fnp > 0) gainBlock(fnp);
    var de = statN(p, 'darkEmbrace');
    if (de > 0) drawCards(de);
    var sv = statN(p, 'salvo');   // BANDOLIER: every spent shell detonates on a random enemy
    if (sv > 0 && !c.over) { var spool = aliveEnemies(); if (spool.length) { var sen = pick(spool); dealToEnemy(sen, c.enemies.indexOf(sen), sv, { noCrit: true, noWeak: true }); } }
    var dm = statN(p, 'demoCharge');   // DEMOLITION TRAIN: every spent shell shrapnels the whole pack
    if (dm > 0 && !c.over) { c.enemies.forEach(function (e, i) { if (e.alive) dealToEnemy(e, i, dm, { noCrit: true, noWeak: true }); }); }
  }

  // BANDOLIER: rack a spent shell (a random exhausted Attack) back into the chamber.
  function reloadShell() {
    var c = E.combat;
    if (!c || c.hand.length >= B.player.maxHand) return false;
    var spent = c.exhaust.filter(function (cc) { return ns.CARDS[cc.id].type === 'attack'; });
    if (!spent.length) return false;
    var shell = spent[Math.floor(rnd() * spent.length)];
    c.exhaust.splice(c.exhaust.indexOf(shell), 1);
    c.hand.push(shell);
    return true;
  }

  // Burn applied to an enemy by the player (for the Burn quest).
  function trackBurn(n) { questProgress('burnTotal', n); }

  /* ---- Colorless tech: in-combat choices (Scry / Tutor / Discover) ----------
   * These set c.pending and wait for a UI pick. Headless (E.interactive false,
   * the sim/tests) auto-resolves immediately with a sensible heuristic. */
  function startScry(n, drawAfter) {
    var c = E.combat, avail = Math.min(n, c.drawPile.length);
    if (avail === 0) { if (drawAfter) drawCards(drawAfter); return; }
    // drawPile.pop() draws from the END, so the "top" is the last `avail` cards.
    c.pending = { kind: 'scry', cards: c.drawPile.slice(c.drawPile.length - avail).reverse(), draw: drawAfter || 0 };
    emit('choice', { kind: 'scry' });
    if (!E.interactive) E.resolveScry(c.pending.cards.filter(function (cd) {
      var def = ns.CARDS[cd.id]; return def.type === 'curse' || def.unplayable;   // bot: ditch junk
    }).map(function (cd) { return cd.uid; }));
  }
  E.resolveScry = function (discardUids) {
    var c = E.combat; if (!c.pending || c.pending.kind !== 'scry') return;
    (discardUids || []).forEach(function (uid) {
      var card = c.pending.cards.filter(function (cd) { return cd.uid === uid; })[0];
      var ix = card ? c.drawPile.indexOf(card) : -1;
      if (ix >= 0) { c.drawPile.splice(ix, 1); c.discard.push(card); }
    });
    if (c.pending.draw) drawCards(c.pending.draw);
    c.pending = null; emit('choiceDone', { kind: 'scry' });
  };
  function startTutor() {
    var c = E.combat;
    var legal = c.drawPile.filter(function (cd) { return ns.CARDS[cd.id].type !== 'curse'; });
    if (!legal.length) return;
    c.pending = { kind: 'tutor', cards: c.drawPile.slice().reverse() };
    emit('choice', { kind: 'tutor' });
    if (!E.interactive) {   // bot: grab the highest-rarity non-curse card
      var best = legal[0];
      legal.forEach(function (cd) { if (ns.CARDS[cd.id].rarity > ns.CARDS[best.id].rarity) best = cd; });
      E.resolveTutor(best.uid);
    }
  }
  E.resolveTutor = function (uid) {
    var c = E.combat; if (!c.pending || c.pending.kind !== 'tutor') return;
    var ix = -1; for (var i = 0; i < c.drawPile.length; i++) if (c.drawPile[i].uid === uid) ix = i;
    if (ix >= 0 && c.hand.length < B.player.maxHand) c.hand.push(c.drawPile.splice(ix, 1)[0]);
    c.pending = null; emit('choiceDone', { kind: 'tutor' });
  };
  function discoverOptions(n) {
    var keys = Object.keys(ns.CARDS).filter(function (k) {
      var cd = ns.CARDS[k];
      return !cd.pool && cd.type !== 'curse' && cd.rarity >= 1 && (cd.cls === E.run.cls || cd.cls === 'any');
    });
    var out = [];
    for (var i = 0; i < n && keys.length; i++) out.push(keys.splice(Math.floor(rnd() * keys.length), 1)[0]);
    return out;
  }
  function startDiscover() {
    var c = E.combat, opts = discoverOptions(3);
    if (!opts.length) return;
    c.pending = { kind: 'discover', cards: opts.map(function (id) { return mkCard(id, false); }) };
    emit('choice', { kind: 'discover' });
    if (!E.interactive) {   // bot: take the highest-rarity option
      var best = c.pending.cards[0];
      c.pending.cards.forEach(function (cd) { if (ns.CARDS[cd.id].rarity > ns.CARDS[best.id].rarity) best = cd; });
      E.resolveDiscover(best.uid);
    }
  }
  E.resolveDiscover = function (uid) {
    var c = E.combat; if (!c.pending || c.pending.kind !== 'discover') return;
    var card = c.pending.cards.filter(function (cd) { return cd.uid === uid; })[0];
    if (card && c.hand.length < B.player.maxHand) c.hand.push(card);
    c.pending = null; emit('choiceDone', { kind: 'discover' });
  };

  // Roll a colorless card (shop/event stock — these never appear in fight rewards).
  function rollColorlessCard() {
    var keys = Object.keys(ns.CARDS).filter(function (k) { return ns.CARDS[k].pool === 'colorless'; });
    return keys.length ? pick(keys) : null;
  }
  E.rollColorlessCard = rollColorlessCard;

  // Fire the engraving on `face` (if any). Augment fx reuse the card effect
  // vocabulary, so applyCardFx resolves them — no second effect engine.
  function fireDieFace(face, tgt) {
    var r = E.run, c = E.combat;
    if (!r || !r.die || !c || c.over) return;
    var id = ns.dieFaceId(r.die, face);
    if (!id) return;
    var aug = ns.dieEngraving(id);
    if (!aug || !aug.fx || !aug.fx.length) return;
    emit('dieFace', { face: face, id: id, name: aug.name, flaw: !!aug.flaw });
    applyCardFx(aug.fx, { tgt: tgt, crit: false, roll: null, eff: face, misfire: false, bandMult: 1, flags: {}, xval: 0, appliedBurn: false });
  }
  E.fireDieFace = fireDieFace;

  // Resolve a card's effects once. Echo can call this twice. ctx carries the
  // shared roll/crit/target and an appliedBurn flag for Contagion.
  function applyCardFx(fx, ctx) {
    var c = E.combat, p = c.player;
    var tgt = ctx.tgt, crit = ctx.crit, roll = ctx.roll, flags = ctx.flags;
    var misfire = ctx.misfire, eff = ctx.eff, bandMult = ctx.bandMult;
    var totalDealt = 0;
    fx.forEach(function (f) {
      if (c.over && f.k === 'dmg') return;
      switch (f.k) {
        case 'onRoll': {
          // Roll-threshold rider: resolves only if the d20 (plus Aim) met the mark.
          // A natural 20 always qualifies; a natural 1 never does.
          var ok = (roll === 20) || (roll != null && roll > 1 && (eff != null ? eff : roll) >= (f.min || 0));
          if (ok) totalDealt += applyCardFx(f.fx || [], ctx);
          break;
        }
        case 'dmg': {
          var base = f.v + attackBonus(f);
          var hits = f.xcost ? ctx.xval : (f.hits || 1);
          for (var h = 0; h < hits; h++) {
            var pool = aliveEnemies();
            if (pool.length === 0) break;
            var en, idx;
            if (f.all) {
              c.enemies.forEach(function (e, i) {
                if (e.alive) totalDealt += dealToEnemy(e, i, base, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult, execute: flags.execute });
              });
              continue;
            } else if (f.random) {
              en = pick(pool); idx = c.enemies.indexOf(en);
            } else {
              en = (tgt && tgt.alive) ? tgt : pool[0];
              idx = c.enemies.indexOf(en);
            }
            totalDealt += dealToEnemy(en, idx, base, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult, execute: flags.execute });
          }
          break;
        }
        case 'block': {
          var bsc = resolveScale(f.scale);
          var bonus = bsc === 'tech' ? attr('tech') * B.attrs.techBlockPerPoint
                    : bsc === 'might' ? attr('might') * B.attrs.mightBlockPerPoint
                    : bsc === 'psi' ? attr('psi') * B.attrs.psiBlockPerPoint
                    : bsc === 'bond' ? attr('bond') * B.attrs.bondBlockPerPoint : 0;
          gainBlock(f.v + bonus, true);
          break;
        }
        case 'heal': heal(f.v); break;
        case 'hploss': {
          hurtPlayer(f.v, { pure: true });
          var bp = statN(p, 'bloodPact');   // BLOOD PACT: spilled HP feeds your Psi
          if (bp > 0) { addStatus(p, 'psiPow', bp); emit('status', { who: 'player', s: 'psiPow', v: bp }); }
          var brg = statN(p, 'bloodrage');  // BLOOD RAGE: spending life stokes your Might (Bloodforge)
          if (brg > 0) { addStatus(p, 'str', brg); emit('status', { who: 'player', s: 'str', v: brg }); }
          break;
        }
        case 'draw': drawCards(f.v); break;
        case 'energy': c.energy += f.v; break;
        case 'pet': summonPet(f.id, f.n || 1); break;   // Warpcaller: summon a pet
        case 'status': {
          if (f.who === 'self') {
            addStatus(p, f.s, f.v);
            emit('status', { who: 'player', s: f.s, v: f.v });
          } else if (f.who === 'allEnemies') {
            var hit = 0;
            c.enemies.forEach(function (e, i) {
              if (e.alive) { addStatus(e, f.s, f.v); emit('status', { who: 'enemy', idx: i, s: f.s, v: f.v }); hit++; }
            });
            if (f.s === 'burn') { ctx.appliedBurn = true; trackBurn(f.v * hit); }
          } else {
            var st = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            if (st) {
              addStatus(st, f.s, f.v);
              emit('status', { who: 'enemy', idx: c.enemies.indexOf(st), s: f.s, v: f.v });
              if (f.s === 'burn') { ctx.appliedBurn = true; trackBurn(f.v); }
            }
          }
          break;
        }
        case 'special': {
          if (f.id === 'shieldSlam' || f.id === 'shieldSlam15') {
            var dmg = Math.floor(p.block * (f.id === 'shieldSlam15' ? 1.5 : 1)) + statN(p, 'str') + art('flatDmg');
            var sEn = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            if (sEn && dmg > 0) totalDealt += dealToEnemy(sEn, c.enemies.indexOf(sEn), dmg, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult });
          } else if (f.id === 'limitBreak') {
            var s = statN(p, 'str');
            if (s > 0) { addStatus(p, 'str', s); emit('status', { who: 'player', s: 'str', v: s }); }
          } else if (f.id === 'doubleBlock') {
            if (p.block > 0) gainBlock(p.block, true);
          } else if (f.id === 'catalyst' || f.id === 'catalyst3') {
            var ce = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            if (ce) {
              var cur = statN(ce, 'burn');
              var mul = (f.id === 'catalyst3') ? 2 : 1; // extra stacks added
              if (cur > 0) { addStatus(ce, 'burn', cur * mul); emit('status', { who: 'enemy', idx: c.enemies.indexOf(ce), s: 'burn', v: cur * mul }); trackBurn(cur * mul); }
            }
          } else if (f.id === 'detonate') {
            // AFFLICTION payoff: blow up the target's Burn for burst, splashing half to another enemy.
            var de = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            if (de) {
              var bn = statN(de, 'burn');
              if (bn > 0) {
                addStatus(de, 'burn', -bn); emit('status', { who: 'enemy', idx: c.enemies.indexOf(de), s: 'burn', v: 0 });
                var dd = Math.round(bn * (f.v || 1)) + statN(p, 'str') + statN(p, 'psiPow') + art('flatDmg');
                totalDealt += dealToEnemy(de, c.enemies.indexOf(de), dd, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult });
                var others = aliveEnemies().filter(function (e) { return e !== de; });
                if (others.length && bn >= 2) { var oe = pick(others); var sp = Math.floor(bn / 2); addStatus(oe, 'burn', sp); emit('status', { who: 'enemy', idx: c.enemies.indexOf(oe), s: 'burn', v: statN(oe, 'burn') }); trackBurn(sp); }
              }
            }
          } else if (f.id === 'dieCredits') {
            E.run.credits += (f.v || 5); emit('credits', { amount: f.v || 5 });
          } else if (f.id === 'dieLoseBlock') {
            p.block = Math.max(0, p.block - (f.v || 3)); emit('block', { who: 'player', amount: 0, blockAfter: p.block });
          } else if (f.id === 'dieEnemyStr') {
            var esPool = aliveEnemies();
            if (esPool.length) { var esE = pick(esPool); addStatus(esE, 'str', f.v || 1); emit('status', { who: 'enemy', idx: c.enemies.indexOf(esE), s: 'str', v: statN(esE, 'str') }); }
          } else if (f.id === 'dieExecute') {
            var xeT = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            if (xeT) totalDealt += dealToEnemy(xeT, c.enemies.indexOf(xeT), f.v || 8, { execute: true, noCrit: true });
          } else if (f.id === 'spendAim') {
            // KILLSHOT: burn every point of banked Aim into one aimed round.
            var saT = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            var saN = statN(p, 'aim');
            if (saT) {
              if (saN > 0) { addStatus(p, 'aim', -saN); emit('status', { who: 'player', s: 'aim', v: 0 }); }
              var saD = (f.base || 6) + saN * (f.v || 4) + statN(p, 'str') + attr('might') + art('flatDmg');
              totalDealt += dealToEnemy(saT, c.enemies.indexOf(saT), saD, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult });
            }
          } else if (f.id === 'backdraft') {
            // BACKDRAFT: vent your Shield as a wall of fire onto one target (then Detonate it).
            var bdBlk = p.block;
            if (bdBlk > 0) {
              p.block = 0; emit('block', { who: 'player', amount: 0, blockAfter: 0 });
              var bdT = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
              if (bdT) { var bdV = Math.round(bdBlk * (f.v || 1)); addStatus(bdT, 'burn', bdV); emit('status', { who: 'enemy', idx: c.enemies.indexOf(bdT), s: 'burn', v: statN(bdT, 'burn') }); trackBurn(bdV); }
            }
          } else if (f.id === 'psiBarrier') {
            // MIND BULWARK: weave your Focus into a shield (psi as defence).
            var pbV = Math.round(statN(p, 'psiPow') * (f.v || 2));
            if (pbV > 0) gainBlock(pbV);
          } else if (f.id === 'parch') {
            // PARCH: cash a Burn stack as raw damage WITHOUT consuming it (rewards stacking, unlike Detonate).
            var paT = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            if (paT) { var paV = statN(paT, 'burn') + statN(p, 'str') + statN(p, 'psiPow') + art('flatDmg'); if (paV > 0) totalDealt += dealToEnemy(paT, c.enemies.indexOf(paT), paV, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult }); }
          } else if (f.id === 'soulflare') {
            // SOULFLARE: a blast that scales with how WIDE your fire has spread (every burning foe).
            var sfTargets = aliveEnemies().filter(function (e) { return statN(e, 'burn') > 0; });
            var sfDmg = (f.v || 3) + statN(p, 'psiPow');
            sfTargets.forEach(function (e) { totalDealt += dealToEnemy(e, c.enemies.indexOf(e), sfDmg, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult }); });
          } else if (f.id === 'forgeBarrier') {
            // BULWARK STANCE: forge your stacked Might into a wall (Might as defence).
            var fbV = Math.round((statN(p, 'str') + attr('might')) * (f.v || 2));
            if (fbV > 0) gainBlock(fbV);
          } else if (f.id === 'cleave') {
            // CLEAVE: a heavy blow to one foe that carries through to the rest of the pack.
            var clT = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            if (clT) totalDealt += dealToEnemy(clT, c.enemies.indexOf(clT), (f.v || 5) + statN(p, 'str') + attr('might'), { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult });
            aliveEnemies().forEach(function (e) { if (e !== clT) totalDealt += dealToEnemy(e, c.enemies.indexOf(e), (f.splash || 3) + statN(p, 'str') + attr('might'), { noCrit: true }); });
          } else if (f.id === 'repairBay') {
            // REPAIR BAY: patch yourself, and harden if you have a construct deployed.
            heal(f.v || 4);
            if (statN(p, 'turret') > 0 || statN(p, 'drone') > 0) gainBlock(f.block || 6);
          } else if (f.id === 'fiendFire') {
            // ORDNANCE capstone: exhaust the rest of your hand, deal f.v per card.
            var fEn = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            var burnt = c.hand.splice(0, c.hand.length);
            burnt.forEach(function (hc) { exhaustCard(hc); });
            var per = f.v + statN(p, 'str') + art('flatDmg');
            if (fEn) for (var q = 0; q < burnt.length; q++) totalDealt += dealToEnemy(fEn, c.enemies.indexOf(fEn), per, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult });
          } else if (f.id === 'reap') {
            // HEXWEAVER / SUPPRESSION capstone: damage scales with debuffs on target.
            var rEn = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            if (rEn) {
              var stacks = statN(rEn, 'vuln') + statN(rEn, 'weak') + statN(rEn, 'burn');
              var rd = stacks * f.v + statN(p, 'str') + art('flatDmg');
              if (rd > 0) totalDealt += dealToEnemy(rEn, c.enemies.indexOf(rEn), rd, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult });
            }
          } else if (f.id === 'overdrive') {
            // MAELSTROM capstone: damage scales with cards already played this turn.
            var oEn = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            var od = f.v * (c.cardsThisTurn || 0) + statN(p, 'str') + art('flatDmg');
            if (oEn && od > 0) totalDealt += dealToEnemy(oEn, c.enemies.indexOf(oEn), od, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult });
          } else if (f.id === 'reload') {
            reloadShell();   // on-demand restock (a random exhausted Attack)
          } else if (f.id === 'scry') {
            startScry(f.v, f.draw || 0);
          } else if (f.id === 'tutor') {
            startTutor();
          } else if (f.id === 'discover') {
            startDiscover();
          } else if (f.id === 'primed') {
            // PRIMED: arm a delayed detonation that goes off in f.t turns.
            c.primed.push({ turns: f.t, dmg: f.v });
            emit('primed', { turns: f.t, dmg: f.v });
          } else if (f.id === 'bloodbath') {
            // BLOODFORGE cashout: convert your stacked Might into one brutal blow.
            var bEn = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            var bd = f.v * statN(p, 'str') + art('flatDmg');
            if (bEn && bd > 0) totalDealt += dealToEnemy(bEn, c.enemies.indexOf(bEn), bd, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult });
          } else if (f.id === 'unload') {
            // FUSILLADE cashout: dump every point of built-up Momentum into one hit.
            var uEn = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            var ud = f.v * statN(p, 'momentum') + statN(p, 'str') + art('flatDmg');
            if (uEn && ud > 0) totalDealt += dealToEnemy(uEn, c.enemies.indexOf(uEn), ud, { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult });
          } else if (f.id === 'powerSurge') {
            // OVERCLOCK payoff: gain Shield for every Power you've played this combat.
            var pw = 0;
            c.consumed.forEach(function (cc) { if (ns.CARDS[cc.id].type === 'power') pw++; });
            if (pw > 0) gainBlock(f.v * pw, true);
          } else if (f.id === 'frenzy') {
            // PACK FRENZY: the whole pack acts again, right now.
            petsAct();
          } else if (f.id === 'cull') {
            // CULL: sacrifice every pet, deal f.v per pet culled to the target.
            var pets = aliveAllies(), nc = pets.length, sytot = statN(p, 'symbiosis');
            pets.forEach(function (a) { killAlly(a, true); if (sytot > 0) { gainBlock(sytot); drawCards(1); } });
            if (nc > 0) {
              var cEn = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
              if (cEn) totalDealt += dealToEnemy(cEn, c.enemies.indexOf(cEn), f.v * nc + Math.round(attr('bond') * B.attrs.bondPetPerPoint), { crit: crit, roll: roll, misfire: misfire, bandMult: bandMult });
            }
          } else if (f.id === 'feed') {
            // FEED THE ALPHA: sacrifice the weakest pet to permanently empower the strongest.
            var live = aliveAllies();
            if (live.length >= 1) {
              var weak = live.slice().sort(function (a, b) { return a.hp - b.hp; })[0];
              var strong = live.slice().sort(function (a, b) { return (b.bonusDmg || 0) - (a.bonusDmg || 0); })[0];
              if (live.length > 1 && weak !== strong) killAlly(weak, true);
              strong.bonusDmg = (strong.bonusDmg || 0) + f.v;
              emit('petAct', { idx: c.allies.indexOf(strong), t: 'feed' });
            }
          } else if (f.id === 'empower') {
            // APEX PREDATOR: permanently empower your strongest pet (no sacrifice).
            var liveE = aliveAllies();
            if (liveE.length) {
              var champ = liveE.slice().sort(function (a, b) { return E.petInfo(b).val - E.petInfo(a).val; })[0];
              champ.bonusDmg = (champ.bonusDmg || 0) + f.v;
              emit('petAct', { idx: c.allies.indexOf(champ), t: 'feed' });
            }
          } else if (f.id === 'packshield') {
            // AEGIS: the whole formation braces — every pet gains f.v block now.
            aliveAllies().forEach(function (a) { a.block += f.v; });
            emit('petReorder', {});
          }
          break;
        }
      }
    });
    if (flags.leech && totalDealt > 0) gainBlock(totalDealt, true);
    if (flags.drain && totalDealt > 0) heal(Math.ceil(totalDealt / 2));
    return totalDealt;
  }

  E.playCard = function (handIdx, targetIdx) {
    var c = E.combat, r = E.run, p = c.player;
    if (!E.canPlay(handIdx)) return false;
    var card = c.hand[handIdx];
    var def = ns.CARDS[card.id];
    var fx = ns.cardFx(def, card.up, card.vtouch);
    var cost = effCost(def, card.up, card);

    // resolve target (default: first living enemy)
    var tgt = c.enemies[targetIdx];
    if (!tgt || !tgt.alive) {
      targetIdx = c.enemies.findIndex(function (e) { return e.alive; });
      tgt = c.enemies[targetIdx];
    }

    c.energy -= cost;
    c.hand.splice(handIdx, 1);

    var xval = 0;
    if (def.xcost) { xval = c.energy; c.energy = 0; }

    var flags = {};
    fx.forEach(function (f) { if (f.k === 'special') flags[f.id] = true; });

    // One d20 per attack. AIM (Marksmanship) is added to the roll, so stacking it
    // shifts the whole distribution: a natural 20 always crits, a natural 1 always
    // misfires, and everything between is read against the card's roll thresholds.
    var roll = null, crit = false, misfire = false, eff = null, bandMult = 1, bandLabel = null;
    var marksman = (r.cls === 'vanguard');   // the Vanguard reads the whole die face
    // THE AUGMENTED DIE: every card play rolls, so a skill/power deck still
    // engages the die. Only attacks read the damage bands.
    if (def.type !== 'attack') {
      roll = d20();
      eff = Math.min(20, roll + statN(p, 'aim'));
      emit('roll', { roll: roll, eff: eff, crit: false, misfire: false, band: null });
    }
    if (def.type === 'attack') {
      roll = d20();
      eff = Math.min(20, roll + statN(p, 'aim'));
      crit = (roll === 20) || (roll > 1 && eff >= B.dice.critThreshold - art('critBonus'));
      misfire = (roll === 1) && marksman;
      if (roll === 1 && art('critDie1Energy') > 0) c.energy += art('critDie1Energy');   // Misfire Capacitor
      if (misfire) {   // MISFIRE PROTOCOL turns a jam into fuel
        var mg = statN(p, 'misfireGuard');
        if (mg > 0) { addStatus(p, 'momentum', mg); emit('status', { who: 'player', s: 'momentum', v: statN(p, 'momentum') }); c.energy += 1; }
      }
      bandLabel = crit ? 'CRIT' : misfire ? 'MISFIRE' : null;
      if (marksman && !crit && !misfire) {
        for (var bi = 0; bi < B.dice.bands.length; bi++) {
          if (eff >= B.dice.bands[bi].min) { bandMult = B.dice.bands[bi].mult; bandLabel = B.dice.bands[bi].label; break; }
        }
      }
      emit('roll', { roll: roll, eff: eff, crit: crit, misfire: misfire, band: bandLabel });
    }

    var ctx = { tgt: tgt, crit: crit, roll: roll, eff: eff, misfire: misfire, bandMult: bandMult, bandLabel: bandLabel, flags: flags, xval: xval, appliedBurn: false };
    var times = 1;
    if (def.type === 'attack' && c.echoReady) { c.echoReady = false; times = 2; }
    // Doubled Self: on turn 1, every card you play resolves twice
    if (c.turn === 1 && E.hasEcho('doubled_self')) times = Math.max(times, 2);
    var totalDealt = 0;
    for (var rep = 0; rep < times; rep++) {
      if (c.over) break;
      totalDealt += applyCardFx(fx, ctx);
    }
    // VENGEANCE: a connecting Attack, after you took a hit or parried, heals you.
    if (def.type === 'attack' && totalDealt > 0 && c.avengeArmed && statN(p, 'vengeance') > 0) {
      heal(statN(p, 'vengeance'));
      c.avengeArmed = false;
    }
    // Void-Touched drawback: pay HP each time the corrupted card is played
    if (card.vtouch && r.phase !== 'dead') hurtPlayer(ns.VTOUCH_HP, { pure: true });

    // on-play triggers (once per card played, not per echo repeat)
    if (!c.over) {
      var tc = statN(p, 'thousandCuts');
      if (tc > 0) c.enemies.forEach(function (e, i) { if (e.alive) dealToEnemy(e, i, tc, { noCrit: true, noWeak: true }); });
      var ai = statN(p, 'afterImage');
      if (ai > 0) gainBlock(ai);
      // THE AUGMENTED DIE: whatever is engraved on the face you landed on fires.
      // A natural 1 always lands on face 1 — Aim can never carry you off it, which
      // is what makes face 1 the one anchor an Aim build cannot lose.
      if (roll != null) fireDieFace(roll === 1 ? 1 : eff, tgt);
      // crit payoffs (Omega Visor / Targeting Matrix + DEADEYE), once per critting card
      if (crit) {
        var cdr = art('critDraw') + statN(p, 'deadeyeDraw'); if (cdr > 0) drawCards(cdr);
        var cst = art('critStr') + statN(p, 'critFury'); if (cst > 0) { addStatus(p, 'str', cst); emit('status', { who: 'player', s: 'str', v: statN(p, 'str') }); }
      }
      // Soul Pyre: attacks also apply Burn
      var ab = art('attackBurn');
      if (ab > 0 && def.type === 'attack') {
        var stB = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
        if (stB) { addStatus(stB, 'burn', ab); emit('status', { who: 'enemy', idx: c.enemies.indexOf(stB), s: 'burn', v: ab }); trackBurn(ab); }
      }
      // Breaching Rounds: attacks also apply Vulnerable
      var av = art('attackVuln');
      if (av > 0 && def.type === 'attack') {
        var stV = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
        if (stV) { addStatus(stV, 'vuln', av); emit('status', { who: 'enemy', idx: c.enemies.indexOf(stV), s: 'vuln', v: av }); }
      }
    }
    // Contagion: applying Burn spreads it to all enemies
    if (ctx.appliedBurn && statN(p, 'plague') > 0 && !c.over) {
      var pl = statN(p, 'plague'), spread = 0;
      c.enemies.forEach(function (e, i) { if (e.alive) { addStatus(e, 'burn', pl); emit('status', { who: 'enemy', idx: i, s: 'burn', v: pl }); spread++; } });
      trackBurn(pl * spread);
    }

    // Resonance Coil: the first Power each combat draws a card
    if (def.type === 'power' && !c.firstPowerUsed) {
      c.firstPowerUsed = true;
      var fpd = art('firstPowerDraw'); if (fpd > 0) drawCards(fpd);
    }
    // route the played card: powers are consumed, exhaust cards (and skills
    // under Corruption) exhaust, everything else discards
    if (def.type === 'power') {
      var sbr = statN(p, 'subroutine');   // SUBROUTINE: every Power you play cycles a card
      if (sbr > 0) drawCards(sbr);
      c.consumed.push(card);
    }
    else if (def.exhaust || (def.type === 'skill' && statN(p, 'corruption') > 0)) exhaustCard(card);
    else c.discard.push(card);

    c.cardsThisTurn++;
    if (def.type !== 'attack') c.nonAttacksThisTurn = (c.nonAttacksThisTurn || 0) + 1;   // Recoilless Frame
    if (E.hasEcho('momentum_engine')) c.momentum = (c.momentum || 0) + 1; // each card buffs the next
    if (def.type === 'attack') { var fauto = statN(p, 'fullauto'); if (fauto > 0) addStatus(p, 'momentum', fauto); } // Full Auto: each shot builds Momentum
    emit('cardPlayed', { id: card.id, crit: crit, roll: roll, eff: eff, misfire: misfire, band: bandLabel, aim: statN(p, 'aim') });
    checkWin();
    return true;
  };

  /* ---------------- Combat: enemy turn ----------------------------------- */
  E.endTurn = function () {
    var c = E.combat, r = E.run, p = c.player;
    if (!c || c.over) return;

    // end-of-turn: shrapnel curses in hand
    c.hand.forEach(function (card) {
      if (card.id === 'shrapnel') hurtPlayer(2, { pure: true });
    });
    if (r.phase === 'dead') return;

    // discard hand, but keep Retain cards in hand for next turn
    var kept = [];
    c.hand.forEach(function (card) {
      if (ns.CARDS[card.id].retain) kept.push(card);
      else c.discard.push(card);
    });
    c.hand = kept;

    // turret + entropy  (HIVE PROTOCOL: every construct fires one extra time per Hive)
    var hive = statN(p, 'hive');
    var tv = statN(p, 'turret');
    if (tv > 0 && !c.over) {
      for (var hvt = 0; hvt <= hive && !c.over; hvt++) {
        var pool = aliveEnemies();
        if (pool.length) {
          var en = pick(pool);
          dealToEnemy(en, c.enemies.indexOf(en), tv + attr('tech'), { noCrit: true, noWeak: true });
          if (statN(p, 'aegisLink') > 0) gainBlock(statN(p, 'aegisLink'));   // SWARM UPLINK: constructs shield you as they fire
        }
      }
    }
    var drv = statN(p, 'drone');     // Drone Swarm: an AoE turret — strafes ALL enemies
    if (drv > 0 && !c.over) {
      for (var hvd = 0; hvd <= hive && !c.over; hvd++) {
        c.enemies.forEach(function (e, i) { if (e.alive) dealToEnemy(e, i, drv + attr('tech'), { noCrit: true, noWeak: true }); });
        if (statN(p, 'aegisLink') > 0) gainBlock(statN(p, 'aegisLink'));   // SWARM UPLINK
      }
    }
    var ev = statN(p, 'entropy');
    if (ev > 0) {
      var espread = 0;
      c.enemies.forEach(function (e, i) {
        if (e.alive) { addStatus(e, 'burn', ev); emit('status', { who: 'enemy', idx: i, s: 'burn', v: ev }); espread++; }
      });
      trackBurn(ev * espread);
    }
    if (checkWin()) return;

    // the pack strikes (after turrets/entropy, before the enemy retaliates)
    petsAct();
    if (checkWin()) return;

    // player status ticks
    if (statN(p, 'burn')) { hurtPlayer(statN(p, 'burn'), { pure: true }); addStatus(p, 'burn', -B.status.burnTick); }
    if (r.phase === 'dead') return;
    if (statN(p, 'regen')) { heal(statN(p, 'regen')); addStatus(p, 'regen', -1); }
    if (statN(p, 'vuln')) addStatus(p, 'vuln', -1);
    if (statN(p, 'weak')) addStatus(p, 'weak', -1);

    // enemies act
    var s = r.sector;
    c.enemies.forEach(function (en, idx) {
      if (!en.alive || c.over || r.phase === 'dead') return;
      // burn ticks before acting
      if (statN(en, 'burn')) {
        var bd = statN(en, 'burn');
        en.hp -= bd;
        emit('dmg', { who: 'enemy', idx: idx, amount: bd, hpDmg: bd, burn: true, hpAfter: Math.max(0, en.hp), blockAfter: en.block });
        var wf = statN(c.player, 'wildfire');
        if (wf > 0 && en.hp > 0) {
          // WILDFIRE: Burn grows instead of decaying, and spreads to another enemy.
          addStatus(en, 'burn', wf);
          emit('status', { who: 'enemy', idx: idx, s: 'burn', v: statN(en, 'burn') });
          var wfsp = aliveEnemies().filter(function (e) { return e !== en; });
          if (wfsp.length) { var wse = pick(wfsp); addStatus(wse, 'burn', wf); emit('status', { who: 'enemy', idx: c.enemies.indexOf(wse), s: 'burn', v: statN(wse, 'burn') }); trackBurn(wf); }
        } else {
          addStatus(en, 'burn', -B.status.burnTick);
        }
        if (en.hp <= 0) {
          en.alive = false; r.kills++;
          if (en.def.overload) { var ovb = scaledDmg(en.def.overload, s); emit('overload', { idx: idx, amount: ovb }); hurtPlayer(ovb); }
          emit('die', { idx: idx });
          echoKill(idx);
          return;
        }
      }
      // passive: regenerate health each turn
      if (en.def.regen && en.alive) {
        var rg = scaledDmg(en.def.regen, s);
        en.hp = Math.min(en.maxHp, en.hp + rg);
        emit('heal', { who: 'enemy', idx: idx, amount: rg, hpAfter: en.hp });
      }
      // passive: escalate Strength every turn
      if (en.def.rampStr) { addStatus(en, 'str', en.def.rampStr); emit('status', { who: 'enemy', idx: idx, s: 'str', v: en.def.rampStr }); }
      // passive: cleanse its own afflictions (the Ascendant — counters Burn/DoT)
      if (en.def.cleanse) {
        ['burn', 'vuln', 'weak'].forEach(function (st) { if (statN(en, st) > 0) { en.statuses[st] = 0; emit('status', { who: 'enemy', idx: idx, s: st, v: 0 }); } });
      }
      // passive: Discipline — backlash if you dumped your hand (3+ cards) last turn
      if (en.def.discipline && en.alive && (c.cardsThisTurn || 0) >= en.def.discipline.cards) {
        var disc = scaledDmg(en.def.discipline.dmg, s) + statN(en, 'str');
        emit('discipline', { idx: idx, amount: disc });
        hurtPlayer(disc);
      }
      en.block = 0;
      // Drop Ship: shielded strafing -> arm the pod -> count down -> detonate.
      if (en.def.dropship) {
        var dbot = en.def.dropship.bot;
        var dBotsAlive = aliveEnemies().some(function (e) { return e.id === dbot; });
        emit('enemyMove', { idx: idx, move: en.intent });
        if (!en.armed) {
          if (dBotsAlive) {
            var sd2 = scaledDmg(en.def.dropship.strafe || 4, s) + statN(en, 'str');
            if (statN(en, 'weak')) sd2 = Math.floor(sd2 * B.status.weakMult);
            hurtPlayer(sd2);
          } else {
            en.armed = true; en.fuse = en.def.dropship.turns;
            emit('dropArm', { idx: idx, fuse: en.fuse });
          }
        } else {
          en.fuse -= 1;
          emit('dropTick', { idx: idx, fuse: en.fuse });
          if (en.fuse <= 0) {
            var ed = scaledDmg(en.def.dropship.dmg, s);
            emit('dropBoom', { idx: idx, amount: ed });
            hurtPlayer(ed);
            if (en.alive) { en.hp = 0; en.alive = false; r.kills++; emit('die', { idx: idx }); echoKill(idx); }
          }
        }
        if (statN(en, 'vuln')) addStatus(en, 'vuln', -1);
        if (statN(en, 'weak')) addStatus(en, 'weak', -1);
        return;
      }
      // Void Shard: raise a ward each turn; on the Nth turn, permanently corrupt a card.
      if (en.def.corrupt) {
        emit('enemyMove', { idx: idx, move: en.intent });
        var swb = scaledDmg(en.def.corrupt.block || 8, s);
        en.block += swb; emit('block', { who: 'enemy', idx: idx, amount: swb, blockAfter: en.block });
        en.shardCount = (en.shardCount || 0) + 1;
        if (en.shardCount >= en.def.corrupt.turns) { en.shardCount = 0; shardCorrupt(idx); }
        if (statN(en, 'vuln')) addStatus(en, 'vuln', -1);
        if (statN(en, 'weak')) addStatus(en, 'weak', -1);
        return;
      }
      var m = en.intent;
      emit('enemyMove', { idx: idx, move: m });
      if (m.t === 'attack' || m.t === 'drain') {
        var dmg = (m.walkerFire ? Math.max(0, en.pendingHit) : m.gaze ? gazeDamage(en, s) : scaledDmg(m.d, s)) + statN(en, 'str');
        if (statN(en, 'weak')) dmg = Math.floor(dmg * B.status.weakMult);
        var hits = m.hits || 1;
        if (m.hitsPer) hits = Math.max(1, aliveEnemies().filter(function (e) { return e.id === m.hitsPer; }).length); // one volley per living minion
        var totalToPlayer = 0;
        for (var h = 0; h < hits; h++) {
          if (r.phase === 'dead') break;
          // The formation soaks single-target hits FRONT-to-back, but each pet only
          // absorbs up to its own HP+Shield — overflow carries through to the next
          // pet and finally to the fragile master. Pierce ignores pets entirely.
          var remaining = dmg;
          while (remaining > 0 && !m.pierce) {
            var front = frontAlly(); if (!front) break;
            var absorbed = Math.min(remaining, front.hp + front.block);
            dealToAlly(front, absorbed);
            remaining -= absorbed;
          }
          // Parry (Bloodforge): deflect like a shield, but every parried blow ripostes
          // the attacker for a Might-scaled counter. The berserker turns defence into offence.
          if (remaining > 0 && !m.pierce) {
            var pv = statN(p, 'parry');
            if (pv > 0) {
              var deflected = Math.min(remaining, pv);
              addStatus(p, 'parry', -deflected);
              remaining -= deflected;
              emit('block', { who: 'player', amount: 0, blockAfter: p.block });
              if (deflected > 0 && en.alive) {
                var rip = 1 + statN(p, 'str') + attr('might');   // riposte scales with the Might you've stacked
                dealToEnemy(en, idx, rip, { noCrit: true, noWeak: true });
                c.avengeArmed = true;   // parrying a blow also arms Vengeance
                if (!en.alive) break;
              }
            }
          }
          if (remaining > 0) {
            totalToPlayer += hurtPlayer(remaining, m.pierce ? { pure: true } : undefined);
            var th = statN(p, 'thorns') + art('thorns');
            if (th > 0 && en.alive) {
              dealToEnemy(en, idx, th, { noCrit: true, noWeak: true });
              if (!en.alive) break;
            }
          }
        }
        // Reactive WARDS: an enemy that swings at you suffers for the privilege.
        // Triggers on the attack itself (through your Shield), once per attacker per turn.
        if (en.alive && r.phase !== 'dead') {
          var ebw = statN(p, 'emberward');   // EMBER WARD: attackers catch fire
          if (ebw > 0) { addStatus(en, 'burn', ebw); emit('status', { who: 'enemy', idx: idx, s: 'burn', v: statN(en, 'burn') }); trackBurn(ebw); }
          var stw = statN(p, 'staticward');   // STATIC WARD: attackers are Weakened (feeds Conduit)
          if (stw > 0) { addStatus(en, 'weak', stw); emit('status', { who: 'enemy', idx: idx, s: 'weak', v: statN(en, 'weak') }); }
          var spw = statN(p, 'spikeward');   // SPIKED BULWARK: attackers gore themselves on your Might
          if (spw > 0 && en.alive) { dealToEnemy(en, idx, spw + statN(p, 'str') + attr('might'), { noCrit: true, noWeak: true }); }
        }
        if (m.t === 'drain' && en.alive) {
          en.hp = Math.min(en.maxHp, en.hp + dmg);
          emit('heal', { who: 'enemy', idx: idx, amount: dmg, hpAfter: en.hp });
        }
        // Leech: heals only for the damage that got THROUGH your block — so blocking denies its sustain
        if (m.leech && en.alive && totalToPlayer > 0) {
          en.hp = Math.min(en.maxHp, en.hp + totalToPlayer);
          emit('heal', { who: 'enemy', idx: idx, amount: totalToPlayer, hpAfter: en.hp });
        }
        // Voidling: unblocked damage can infect the run deck with a permanent curse.
        if (en.def.infect && totalToPlayer > 0 && r.phase !== 'dead' && rnd() < (en.def.infect.chance || 0.33)) {
          var icard = en.def.infect.card || 'void_taint';
          r.deck.push(mkCard(icard, false));
          emit('infect', { idx: idx, card: icard });
        }
        // Jammer: the laser also burns (exhausts) a card out of this combat.
        if (m.jam && r.phase !== 'dead') {
          var jpools = [c.drawPile, c.hand], jburned = null;
          for (var jp = 0; jp < jpools.length && !jburned; jp++) {
            var jpool = jpools[jp], jcand = [];
            for (var ji = 0; ji < jpool.length; ji++) if (ns.CARDS[jpool[ji].id].type !== 'curse') jcand.push(ji);
            if (jcand.length) { jburned = jpool.splice(jcand[Math.floor(rnd() * jcand.length)], 1)[0]; c.exhaust.push(jburned); }
          }
          emit('jam', { idx: idx, card: jburned ? jburned.id : null });
        }
      } else if (m.t === 'block') {
        var bb = scaledDmg(m.b, s);
        if (m.all) c.enemies.forEach(function (e, i) { if (e.alive) { e.block += bb; emit('block', { who: 'enemy', idx: i, amount: e.block, blockAfter: e.block }); } });
        else { en.block += bb; emit('block', { who: 'enemy', idx: idx, amount: en.block, blockAfter: en.block }); }
      } else if (m.t === 'guard') {
        // Pack Tactics: shield a random OTHER living ally (kill the supporter first)
        var allies = aliveEnemies().filter(function (e) { return e !== en; });
        var gv = scaledDmg(m.v, s);
        if (allies.length) {
          var ally = allies[Math.floor(rnd() * allies.length)];
          var ai = c.enemies.indexOf(ally);
          ally.block += gv; emit('block', { who: 'enemy', idx: ai, amount: ally.block, blockAfter: ally.block });
        } else { en.block += gv; emit('block', { who: 'enemy', idx: idx, amount: en.block, blockAfter: en.block }); }
      } else if (m.t === 'buff') {
        if (m.all) c.enemies.forEach(function (e, i) { if (e.alive) { addStatus(e, m.s, m.v); emit('status', { who: 'enemy', idx: i, s: m.s, v: m.v }); } });
        else { addStatus(en, m.s, m.v); emit('status', { who: 'enemy', idx: idx, s: m.s, v: m.v }); }
      } else if (m.t === 'heal') {
        var hv = scaledDmg(m.v, s);
        if (m.all) c.enemies.forEach(function (e, i) { if (e.alive) { e.hp = Math.min(e.maxHp, e.hp + hv); emit('heal', { who: 'enemy', idx: i, amount: hv, hpAfter: e.hp }); } });
        else { en.hp = Math.min(en.maxHp, en.hp + hv); emit('heal', { who: 'enemy', idx: idx, amount: hv, hpAfter: en.hp }); }
      } else if (m.t === 'summon') {
        var room = 5 - aliveEnemies().length, add = Math.min(m.n || 1, Math.max(0, room));
        for (var sm = 0; sm < add; sm++) {
          var ne = mkEnemy(m.id);
          ne.summonedBy = idx;   // remember the spawner so the renderer can cluster it nearby
          chooseIntent(ne);
          c.enemies.push(ne);
          emit('summon', { idx: c.enemies.length - 1 });
        }
      } else if (m.t === 'debuff') {
        addStatus(p, m.s, m.v);
        emit('status', { who: 'player', s: m.s, v: m.v });
      } else if (m.t === 'disrupt') {
        // THE DERELICT's signature: short out your Powers (counters engines)
        var stripped = 0, dn = m.n || 1;
        for (var dz = 0; dz < dn; dz++) {
          var powers = Object.keys(p.statuses).filter(function (k) { return p.statuses[k] > 0 && k !== 'vuln' && k !== 'weak' && k !== 'burn'; });
          if (!powers.length) break;
          var pk = powers[Math.floor(rnd() * powers.length)];
          p.statuses[pk] = 0;
          emit('status', { who: 'player', s: pk, v: 0 });
          emit('disrupt', { idx: idx, s: pk });
          stripped++;
        }
        if (stripped === 0) { c.discard.push(mkCard('void_taint', false)); emit('curse', { idx: idx, card: 'void_taint' }); }
      } else if (m.t === 'etch') {
        // WARP ETCHER: scars your die. A Flaw takes a face — and denies you the slot.
        var dieR = r.die;
        if (dieR) {
          var flawIds = Object.keys(ns.DIE_FLAWS || {});
          var freeF = [];
          for (var ef = 1; ef <= (ns.DIE.faces || 20); ef++) if (!dieR.faces[ef]) freeF.push(ef);
          if (flawIds.length && freeF.length) {
            var fid = pick(flawIds), ff = pick(freeF);
            ns.dieEngrave(dieR, fid, ff);
            emit('etch', { idx: idx, id: fid, face: ff, name: (ns.DIE_FLAWS[fid] || {}).name || fid });
          } else {   // nowhere left to cut — it just hurts you instead
            hurtPlayer(scaledDmg(8, s));
          }
        }
      } else if (m.t === 'unmake') {
        // THE UNMAKER's signature: erase your defences, jam your deck, knit itself
        if (p.block > 0) { p.block = 0; emit('block', { who: 'player', amount: 0, blockAfter: 0 }); }
        c.discard.push(mkCard('void_taint', false));
        emit('curse', { idx: idx, card: 'void_taint' });
        var uh = scaledDmg(m.v || 12, s);
        en.hp = Math.min(en.maxHp, en.hp + uh);
        emit('heal', { who: 'enemy', idx: idx, amount: uh, hpAfter: en.hp });
        addStatus(en, 'str', m.str || 2);
        emit('status', { who: 'enemy', idx: idx, s: 'str', v: m.str || 2 });
      } else if (m.t === 'curse') {
        c.discard.push(mkCard(m.card, false));
        emit('curse', { idx: idx, card: m.card });
      } else if (m.t === 'wk_charge') {
        // Walker winds up: no attack this turn, but it primes a massive blow that
        // damage dealt to it next turn will whittle down (to a floor).
        en.charging = true;
        en.pendingHit = scaledDmg(en.def.charge.dmg, s);
        en.pendingFloor = Math.max(0, en.pendingHit - scaledDmg(en.def.charge.cap, s));
        emit('charge', { idx: idx });
      }
      // Walker discharged its primed blow this turn — reset the cycle.
      if (en.def && en.def.charge && m.walkerFire) { en.charging = false; en.pendingHit = 0; }
      // enemy debuff ticks after acting
      if (statN(en, 'vuln')) addStatus(en, 'vuln', -1);
      if (statN(en, 'weak')) addStatus(en, 'weak', -1);
    });

    if (r.phase === 'dead') return;
    if (checkWin()) return;

    c.enemies.forEach(function (en) { if (en.alive) chooseIntent(en); });
    startPlayerTurn();
  };

  /* ---------------- Combat: victory & rewards ---------------------------- */
  function creditRange(kind) {
    var r = (kind === 'boss') ? B.rewards.creditsBoss : (kind === 'elite') ? B.rewards.creditsElite : B.rewards.creditsFight;
    var v = ri(r[0], r[1]);
    v = Math.round(v * (1 + (E.run.sector - 1) * B.rewards.creditsPerSectorMul));
    v = Math.round(v * (1 + art('creditsMul')));
    return v;
  }

  // A card's dominant "theme" — used to keep a single reward from offering
  // three cards that all funnel into the same effect/archetype.
  var THEME_STATUS = {
    burn: 'burn', emberward: 'burn', wildfire: 'burn', entropy: 'burn', plague: 'burn',
    psiPow: 'psi', psiRamp: 'psi',
    turret: 'construct', drone: 'construct', hive: 'construct', aegisLink: 'construct',
    weak: 'control', vuln: 'control', conduit: 'control', staticward: 'control',
    plate: 'block', platedArmor: 'block', barricade: 'block', retain: 'block', spikeward: 'block', thorns: 'block',
    reactor: 'power', echo: 'power', afterImage: 'power', subroutine: 'power',
    str: 'might', strPerTurn: 'might', bloodrage: 'might', momentum: 'might', fullauto: 'might',
    salvo: 'exhaust', restock: 'exhaust', feelNoPain: 'exhaust', darkEmbrace: 'exhaust', demoCharge: 'exhaust',
    bloodPact: 'blood', parry: 'might', vengeance: 'might', retaliate: 'block',
  };
  function rewardTheme(id) {
    var c = ns.CARDS[id]; if (!c) return 'misc';
    var fx = c.fx || [], i, f;
    for (i = 0; i < fx.length; i++) {
      f = fx[i];
      if (f.k === 'special') {
        if (/detonate|catalyst/.test(f.id)) return 'burn';
        if (/drain|bloodbath|backdraft/.test(f.id)) return 'blood';
        if (/shieldSlam|doubleBlock|powerSurge|psiBarrier/.test(f.id)) return 'block';
        if (/reap|overdrive|unload|fiendFire|execute|limitBreak/.test(f.id)) return 'finisher';
      }
    }
    for (i = 0; i < fx.length; i++) { f = fx[i]; if (f.k === 'status' && THEME_STATUS[f.s]) return THEME_STATUS[f.s]; }
    if (fx.some(function (g) { return g.k === 'hploss'; })) return 'blood';
    if (c.type === 'skill' && fx.some(function (g) { return g.k === 'block'; })) return 'block';
    if (fx.some(function (g) { return g.k === 'draw' || g.k === 'energy'; })) return 'tempo';
    if (fx.some(function (g) { return g.k === 'dmg' && g.all; })) return 'aoe';
    if (fx.some(function (g) { return g.k === 'dmg'; })) return 'attack';
    return 'misc';
  }
  E.rewardTheme = rewardTheme;

  // Normal reward/shop pool: rarity 1-3, class-legal, and NOT a special pool
  // (event-only / boss-only cards never roll here).
  function rollRewardCard(rareBoost) {
    var roll = rnd();
    var rar = 1;
    if (roll < B.rewards.rareChance + (rareBoost || 0)) rar = 3;
    else if (roll < B.rewards.rareChance + (rareBoost || 0) + B.rewards.uncommonChance) rar = 2;
    var pool = Object.keys(ns.CARDS).filter(function (k) {
      var c = ns.CARDS[k];
      return c.rarity === rar && !c.pool && (c.cls === E.run.cls || c.cls === 'any');
    });
    if (pool.length === 0) pool = Object.keys(ns.CARDS).filter(function (k) {
      var c = ns.CARDS[k];
      return c.rarity === 1 && !c.pool && (c.cls === E.run.cls || c.cls === 'any');
    });
    return pick(pool);
  }
  E.rollRewardCard = rollRewardCard;

  // A reward card of a SPECIFIC rarity tier (1..3) — used by trade-up events.
  function rollRewardCardTier(rar) {
    var pool = Object.keys(ns.CARDS).filter(function (k) {
      var c = ns.CARDS[k];
      return c.rarity === rar && !c.pool && c.type !== 'curse' && (c.cls === E.run.cls || c.cls === 'any');
    });
    if (!pool.length) return rollRewardCard(rar >= 3 ? 0.5 : 0);
    return pick(pool);
  }

  // Legendary (rarity 4, boss pool) for boss/elite rewards.
  function rollLegendary() {
    var pool = Object.keys(ns.CARDS).filter(function (k) {
      var c = ns.CARDS[k];
      return c.rarity === 4 && c.pool === 'boss' && (c.cls === E.run.cls || c.cls === 'any');
    });
    return pool.length ? pick(pool) : null;
  }
  E.rollLegendary = rollLegendary;

  function artifactDroppable(k, tier) {
    var a = ns.ARTIFACTS[k];
    if (!a || a.tier !== tier) return false;
    if (E.run.artifacts.indexOf(k) >= 0) return false;            // already owned
    if (a.cls && a.cls !== E.run.cls) return false;               // class-locked: only its class
    if (a.questOnly || a.cornerstone) return false;               // quest/cornerstone relics never drop
    return true;
  }
  function randomArtifact(tier) {
    var pool = Object.keys(ns.ARTIFACTS).filter(function (k) { return artifactDroppable(k, tier); });
    if (pool.length === 0) return null;
    return pick(pool);
  }
  // N distinct random artifacts of a tier (for pick-1-of-N rewards)
  function randomArtifactChoices(tier, n) {
    var pool = Object.keys(ns.ARTIFACTS).filter(function (k) { return artifactDroppable(k, tier); });
    shuffle(pool);
    return pool.slice(0, Math.min(n, pool.length));
  }
  E.randomArtifactChoices = randomArtifactChoices;
  E.randomArtifact = randomArtifact;

  // Flip a relic on/off — only allowed between fights, on the star chart.
  E.toggleRelic = function (id) {
    var r = E.run;
    if (!r || r.phase !== 'map') return false;
    if (r.artifacts.indexOf(id) < 0) return false;
    if (r.relicUses && r.relicUses[id] != null && r.relicUses[id] <= 0) return false; // spent: can't re-enable
    r.relicOff = r.relicOff || {};
    r.relicOff[id] = !r.relicOff[id];
    E.save();
    return true;
  };
  E.relicUsesLeft = function (id) { return E.run && E.run.relicUses ? E.run.relicUses[id] : undefined; };
  // After a fight, active relics with durability burn a charge.
  function tickRelicDurability() {
    var r = E.run; if (!r || !r.relicUses) return;
    r.artifacts.forEach(function (id) {
      if (r.relicUses[id] != null && r.relicUses[id] > 0 && E.relicActive(id)) {
        r.relicUses[id] -= 1;
        if (r.relicUses[id] <= 0) emit('relicSpent', { id: id });
      }
    });
  }

  function addArtifact(id) {
    var r = E.run;
    if (r.artifacts.indexOf(id) >= 0) return; // no duplicates
    r.artifacts.push(id);
    var a = ns.ARTIFACTS[id];
    if (a.uses) { r.relicUses = r.relicUses || {}; r.relicUses[id] = a.uses; }   // durability charge
    if (a.k === 'maxHp') { r.maxHp += a.v; r.hp += a.v; }
    if (a.special === 'glassCannon') { var lose = Math.round(r.maxHp * 0.25); r.maxHp -= lose; r.hp = Math.min(r.hp, r.maxHp); }
    if (a.quest && !r.questDone[id]) r.quests[id] = r.quests[id] || 0;
    emit('artifact', { id: id });
  }
  E.addArtifact = addArtifact;

  // Reverse of addArtifact's run-state side effects (for relic-for-relic trades).
  function removeArtifact(id) {
    var r = E.run, idx = r.artifacts.indexOf(id);
    if (idx < 0) return;
    var a = ns.ARTIFACTS[id];
    if (a && a.cornerstone) return;                 // the Cornerstone can't be removed/traded
    r.artifacts.splice(idx, 1);
    if (a.k === 'maxHp') { r.maxHp -= a.v; r.hp = Math.min(r.hp, r.maxHp); }
    if (r.relicUses) delete r.relicUses[id];
    if (r.relicOff) delete r.relicOff[id];
    emit('artifact', { id: id, removed: true });
  }
  E.removeArtifact = removeArtifact;

  // Relics a player may trade away: plain, non-quest, non-class, side-effect-free.
  function tradeableRelics() {
    return E.run.artifacts.filter(function (k) {
      var a = ns.ARTIFACTS[k];
      return a && !a.questOnly && !a.cls && !a.special;
    });
  }
  E.tradeableRelics = tradeableRelics;

  function winCombat() {
    var r = E.run, kind = E.combat.kind, cc = E.combat;
    tickRelicDurability();   // active durability relics burn a charge per fight
    // quest credit: combats won without ever gaining Shield / without losing HP
    if (!cc.playedShield) questProgress('noShieldWin', 1);
    if (r.hp >= cc.startHp) questProgress('flawlessWin', 1);

    // The finale: beating THE UNMAKER wins the run.
    if (cc.isFinal) {
      r.won = true;
      if (r.cornerstone && (r.cornerstone.tier || 1) < 4) r.cornerstone.tier = (r.cornerstone.tier || 1) + 1;   // forge a tier per loop cleared
      E.recordBest();
      r.phase = 'victory';
      emit('win', { kind: 'final', credits: 0 });
      E.save();
      return;
    }

    var credits = creditRange(kind);
    if (art('noCredits') > 0) credits = 0;   // Famine Engine: no salvage
    r.credits += credits;
    questProgress('creditsAtOnce', r.credits);
    var hb = art('healAfterCombat');
    if (hb > 0) heal(hb);
    var eliteTier = (kind === 'elite' || kind === 'boss' || kind === 'beacon');
    var rareBoost = eliteTier ? B.rewards.eliteRareChance : 0;
    var cards = [], seen = {}, themeCount = {};
    // Salvage Doctrine forgoes card rewards (the deck grows from kills instead)
    if (!E.hasEcho('salvage_doctrine')) {
      for (var i = 0; i < B.rewards.cardChoices; i++) {
        // reject exact dupes, and never let one theme fill more than 2 of the slots
        var cid = rollRewardCard(rareBoost), guard = 0;
        while ((seen[cid] || (themeCount[rewardTheme(cid)] || 0) >= 2) && guard++ < 25) cid = rollRewardCard(rareBoost);
        seen[cid] = true;
        var th = rewardTheme(cid); themeCount[th] = (themeCount[th] || 0) + 1;
        cards.push(cid);
      }
      // bosses always offer a legendary; elites sometimes do
      if (cards.length && (kind === 'boss' || (kind === 'elite' && rnd() < 0.4))) {
        var leg = rollLegendary();
        if (leg) cards[0] = leg;
      }
      // Distress Beacon: its risk pays in salvage-tech (a guaranteed colorless card)
      if (kind === 'beacon' && cards.length) { var col = rollColorlessCard(); if (col) cards[cards.length - 1] = col; }
    }
    // Elites offer a pick-1-of-2 relic (chosen on the reward screen); beacons no
    // longer hand out a relic (they keep their colorless-card payoff).
    // Rewards come from the fights that earn them: elites offer a pick of two,
    // and bosses now drop a pick of two TIER-2 relics (they previously dropped
    // none, which is why cutting the free-relic nodes hurt so much).
    var artifactChoices = (kind === 'elite') ? randomArtifactChoices(1, 2)
                        : (kind === 'boss') ? randomArtifactChoices(2, 2) : [];
    var artifactDrop = null;   // no auto-grant; picked from artifactChoices
    // The Unmaker's Tithe: an extra relic from every elite & boss
    var bonusArtifact = null;
    if (E.hasEcho('unmaker_tithe') && (kind === 'elite' || kind === 'boss')) {
      bonusArtifact = randomArtifact(1);
      if (bonusArtifact) addArtifact(bonusArtifact);
    }
    var dropP = (kind === 'boss') ? B.potions.bossDropChance : B.potions.dropChance;
    var potionDrop = (rnd() < dropP) ? rollPotion() : null;
    r.reward = { credits: credits, cards: cards, artifact: artifactDrop, artifactChoices: artifactChoices, artifactPicked: false, bonusArtifact: bonusArtifact, potion: potionDrop, potionTaken: false, cardTaken: false, kind: kind };
    r.phase = 'reward';
    emit('win', { kind: kind, credits: credits });
    E.save();
  }

  E.takeRewardArtifact = function (i) {
    var r = E.run;
    if (!r.reward || r.reward.artifactPicked) return;
    var id = (r.reward.artifactChoices || [])[i];
    if (!id) return;
    addArtifact(id);
    r.reward.artifactPicked = true;
    r.reward.artifact = id;
    E.save();
  };
  E.takeRewardCard = function (i) {
    var r = E.run;
    if (!r.reward || r.reward.cardTaken) return;
    var id = r.reward.cards[i];
    if (!id) return;
    r.deck.push(mkCard(id, false));
    r.reward.cardTaken = true;
  };

  E.finishReward = function () {
    var r = E.run;
    if (r.reward && !r.reward.cardTaken) questProgress('rewardSkip', 1);
    r.reward = null;
    E.combat = null;
    nodeComplete();
  };

  /* ---------------- Potions & consumables -------------------------------- */
  function rollPotion() {
    var W = B.potions.rarityWeights, bag = [];
    Object.keys(ns.POTIONS).forEach(function (id) {
      var w = W[ns.POTIONS[id].rarity] || 1;
      for (var i = 0; i < w; i++) bag.push(id);
    });
    return pick(bag);
  }
  E.rollPotion = rollPotion;

  E.potionSlots = function () { return B.potions.slots; };
  E.potionFull = function () { return (E.run.potions || []).length >= B.potions.slots; };

  E.addPotion = function (pid) {
    var r = E.run;
    if (!r.potions) r.potions = [];
    if (r.potions.length >= B.potions.slots) return false;
    r.potions.push(pid);
    E.save();
    return true;
  };

  // Grab the potion offered on a reward screen (no-op if belt is full).
  E.takeRewardPotion = function () {
    var r = E.run;
    if (!r.reward || !r.reward.potion || r.reward.potionTaken) return false;
    if (!E.addPotion(r.reward.potion)) return false;
    r.reward.potionTaken = true;
    return true;
  };

  E.discardPotion = function (slot) {
    var r = E.run;
    if (!r.potions || slot < 0 || slot >= r.potions.length) return false;
    r.potions.splice(slot, 1);
    E.save();
    return true;
  };

  // Does this potion need the player to pick a target? (only when >1 enemy left)
  E.potionNeedsTarget = function (pid) {
    var pot = ns.POTIONS[pid];
    return !!(pot && pot.target) && E.combat && aliveEnemies().length > 1;
  };

  function applyPotion(pot, targetIdx) {
    var c = E.combat, r = E.run, p = c.player;
    var tgt = c.enemies[targetIdx];
    if (!tgt || !tgt.alive) {
      targetIdx = c.enemies.findIndex(function (e) { return e.alive; });
      tgt = c.enemies[targetIdx];
    }
    pot.fx.forEach(function (f) {
      if (c.over && f.k === 'dmg') return;
      switch (f.k) {
        case 'dmg':
          if (f.all) c.enemies.forEach(function (e, i) { if (e.alive) dealToEnemy(e, i, f.v, { noCrit: true }); });
          else if (tgt && tgt.alive) dealToEnemy(tgt, targetIdx, f.v, { noCrit: true });
          break;
        case 'block': gainBlock(f.v); break;          // passive Shield (not a played card)
        case 'energy': c.energy += f.v; break;
        case 'draw': drawCards(f.v); break;
        case 'heal': heal(f.v); break;
        case 'healPct': heal(Math.round(r.maxHp * f.v)); break;
        case 'status':
          if (f.who === 'self') {
            addStatus(p, f.s, f.v);
            emit('status', { who: 'player', s: f.s, v: f.v });
          } else if (f.who === 'allEnemies') {
            var hit = 0;
            c.enemies.forEach(function (e, i) {
              if (e.alive) { addStatus(e, f.s, f.v); emit('status', { who: 'enemy', idx: i, s: f.s, v: f.v }); hit++; }
            });
            if (f.s === 'burn') trackBurn(f.v * hit);
          } else {
            var st = (tgt && tgt.alive) ? tgt : aliveEnemies()[0];
            if (st) {
              addStatus(st, f.s, f.v);
              emit('status', { who: 'enemy', idx: c.enemies.indexOf(st), s: f.s, v: f.v });
              if (f.s === 'burn') trackBurn(f.v);
            }
          }
          break;
      }
    });
  }

  E.usePotion = function (slot, targetIdx) {
    var c = E.combat, r = E.run;
    if (!c || c.over) return false;
    if (!r.potions || slot < 0 || slot >= r.potions.length) return false;
    var pid = r.potions[slot];
    var pot = ns.POTIONS[pid];
    if (!pot) return false;
    r.potions.splice(slot, 1);
    applyPotion(pot, targetIdx);
    emit('potion', { id: pid });
    checkWin();
    return true;
  };

  /* ---------------- Victory & the Recurrence (NG+ loop) ------------------ */
  // Enter the next loop: bump the loop counter, then run the narrative ->
  // echo-draft -> loadout flow before a fresh (reset) descent begins.
  E.enterRecurrence = function () {
    var r = E.run;
    E.combat = null;
    r.loop = (r.loop || 1) + 1;
    r.echoOffer = null;
    r.phase = 'recurrence-intro';
    E.save();
  };

  // From the narrative screen: offer a new Echo (or straight to loadout if
  // every Echo is already collected).
  E.recurrenceContinue = function () {
    var off = E.echoOffer();
    if (off.length) E.run.phase = 'echo-draft';
    else { prepLoadout(); E.run.phase = 'echo-loadout'; }
    E.save();
  };

  // 3 not-yet-owned Echoes to choose from (stable across re-renders).
  E.echoOffer = function () {
    var r = E.run;
    if (r.echoOffer) return r.echoOffer;
    var pool = Object.keys(ns.ECHOES).filter(function (id) { return r.echoes.indexOf(id) < 0; });
    shuffle(pool);
    r.echoOffer = pool.slice(0, Math.min(3, pool.length));
    return r.echoOffer;
  };

  E.chooseEcho = function (id) {
    var r = E.run;
    if (ns.ECHOES[id] && r.echoes.indexOf(id) < 0) r.echoes.push(id);
    r.echoOffer = null;
    prepLoadout();
    r.phase = 'echo-loadout';
    E.save();
  };

  // Default the loadout: keep the previous valid picks, else auto-fill.
  function prepLoadout() {
    var r = E.run, slots = B.echoes.loadoutSlots, owned = r.echoes.slice();
    if (owned.length <= slots) r.loadout = owned.slice();
    else {
      var keep = (r.loadout || []).filter(function (id) { return owned.indexOf(id) >= 0; });
      while (keep.length < slots) { var nx = owned.find(function (id) { return keep.indexOf(id) < 0; }); if (!nx) break; keep.push(nx); }
      r.loadout = keep.slice(0, slots);
    }
  }
  E.prepLoadout = prepLoadout;
  E.echoLoadout = function () { return (E.run.loadout || []).slice(); };
  E.echoLoadoutFull = function () { return (E.run.loadout || []).length >= B.echoes.loadoutSlots; };

  // Toggle an owned Echo in/out of the equipped loadout (respecting the cap).
  E.echoToggle = function (id) {
    var r = E.run, L = r.loadout || (r.loadout = []);
    var i = L.indexOf(id);
    if (i >= 0) { L.splice(i, 1); E.save(); return true; }
    if (r.echoes.indexOf(id) < 0 || L.length >= B.echoes.loadoutSlots) return false;
    L.push(id); E.save(); return true;
  };

  // Commit the loadout and start the fresh (reset) loop.
  E.beginLoop = function () { resetForLoop(E.run); E.save(); };

  // Full reset for a new loop: keep class, loop count, Echoes, loadout, and the
  // cumulative kills/nodes/records ("powers have faded; surroundings stronger").
  function resetForLoop(r) {
    var clsId = r.cls, c = B.classes[clsId];
    // The Heart gauntlet (NG+5) is the climax — you bring your BUILT deck,
    // relics, attributes and potions into it (full-healed), not a fresh start.
    var heart = (r.loop === B.run.heartLoop);
    if (heart) {
      r.hp = r.maxHp;
    } else {
      r.hp = c.hp; r.maxHp = c.hp;
      r.attrs = { might: c.might, tech: c.tech, psi: c.psi, bond: c.bond || 0 };
      if (E.hasEcho('ascendant_core')) r.attrs[CLASS_STAT[clsId]] += 2; // legacy stat
      r.credits = B.player.startCredits;
      r.deck = ns.STARTER_DECKS[clsId].map(function (id) { return mkCard(id, false); });
      r.artifacts = [];
      r.potions = [];
    }
    r.sector = 1;
    r.faction = pick(Object.keys(ns.FACTIONS));
    r.map = generateMap(1);
    r.mapRow = -1; r.mapCol = 0;
    r.usedEvents = [];
    r.removeCost = B.shop.removeCost;
    r.quests = {}; r.questDone = {};
    r.augmentDeckop = null; r.augmentOffer = null;
    if (!heart) { r.augments = []; r.potions = []; }   // keep your augments/belt for the climax
    r.phylacteryUsed = false; r.salvageKills = 0;
    r.reward = null; r.shop = null; r.bossArtifacts = null; r.treasure = null;
    r.pendingPick = null; r.pendingAddCard = null; r.echoOffer = null;
    // the Cornerstone survives the Recurrence even though the rest of the relics reset
    if (r.cornerstone && r.artifacts.indexOf(r.cornerstone.id) < 0) r.artifacts.push(r.cornerstone.id);
    r.phase = 'sector-intro';
    E.combat = null;
  }

  // End the run a victor: record it and clear the save.
  E.claimVictory = function () {
    E.recordBest();
    E.clearSave();
    E.run = null;
    E.combat = null;
  };

  /* ---------------- Events ------------------------------------------------ */
  function startEvent() {
    var r = E.run;
    var pool = ns.EVENTS.filter(function (ev) { return r.usedEvents.indexOf(ev.id) < 0; });
    if (pool.length === 0) { r.usedEvents = []; pool = ns.EVENTS.slice(); }
    var ev = pick(pool);
    r.usedEvents.push(ev.id);
    r.currentEvent = ev.id;
    r.eventResult = null;
    r.phase = 'event';
  }

  E.getEvent = function () {
    var r = E.run;
    for (var i = 0; i < ns.EVENTS.length; i++) if (ns.EVENTS[i].id === r.currentEvent) return ns.EVENTS[i];
    return null;
  };

  // Is a choice available? `cond` gates "blue option" style choices.
  E.eventChoiceAvailable = function (ch) {
    var r = E.run, c = ch.cond;
    if (!c) return true;
    if (c.credits && r.credits < c.credits) return false;
    if (c.attr) { for (var k in c.attr) if (attr(k) < c.attr[k]) return false; }
    if (c.hasArtifact && r.artifacts.indexOf(c.hasArtifact) < 0) return false;
    if (c.hasRelic && E.tradeableRelics().length === 0) return false;
    if (c.minCards && r.deck.filter(function (cd) { return ns.CARDS[cd.id].type !== 'curse'; }).length < c.minCards) return false;
    if (c.hasCurse && !r.deck.some(function (cd) { return ns.CARDS[cd.id].type === 'curse'; })) return false;
    return true;
  };

  // Odds + modifier for a skill check (for the choice preview).
  E.checkOdds = function (check) {
    var bonus = Math.floor(attr(check.attr) / B.attrs.eventCheckBonusDiv) + art('checkBonus');
    var passCount = 0;
    for (var roll = 1; roll <= 20; roll++) {
      var pass = (roll + bonus >= check.dc) || roll === 20;
      if (roll === 1) pass = false;
      if (pass) passCount++;
    }
    return { bonus: bonus, pct: Math.round(passCount / 20 * 100) };
  };

  E.eventChoose = function (ci) {
    var r = E.run;
    var ev = E.getEvent();
    var ch = ev.choices[ci];
    if (!ch) return null;
    if (!E.eventChoiceAvailable(ch)) return null;
    if (ch.cost && r.credits < ch.cost) return null;
    if (ch.cost) r.credits = Math.max(0, r.credits - ch.cost); // pay the price up front

    // Press-your-luck: hand off to the dedicated loop instead of resolving now.
    if (ch.pressLuck) { startPressLuck(ci); E.save(); return { pressLuck: true }; }
    // Sell: pick one of your own cards/relics to liquidate for credits.
    if (ch.sell) { r.pendingSell = { kind: ch.sell.kind || 'card' }; r.eventResult = { text: ch.sell.text || 'What will you part with?', gained: [], roll: null }; r.phase = 'event-result'; E.save(); return { sell: true }; }

    var res = { roll: null, pass: null, dc: null, bonus: 0 };
    var out;
    if (ch.check) {
      var roll = d20();
      var bonus = Math.floor(attr(ch.check.attr) / B.attrs.eventCheckBonusDiv) + art('checkBonus');
      var pass = (roll + bonus >= ch.check.dc) || roll === 20;
      if (roll === 1) pass = false;
      res.roll = roll; res.bonus = bonus; res.dc = ch.check.dc; res.pass = pass;
      res.attr = ch.check.attr;
      out = pass ? ch.success : ch.fail;
    } else if (ch.gamble) {
      var bag = [];
      ch.gamble.forEach(function (g, i) { for (var w = 0; w < (g.w || 1); w++) bag.push(i); });
      out = ch.gamble[bag[Math.floor(rnd() * bag.length)]];
      res.gamble = true;
    } else {
      out = ch.outcome;
    }
    res.text = out.text;
    res.gained = applyOutcome(out.fx || {});
    r.eventResult = res;
    if (r.phase !== 'dead') r.phase = 'event-result';
    E.save();
    return res;
  };

  function applyOutcome(fx) {
    var r = E.run, gained = [];
    if (fx.credits) {
      r.credits = Math.max(0, r.credits + fx.credits);
      if (fx.credits > 0) questProgress('creditsAtOnce', r.credits);
      gained.push((fx.credits > 0 ? '+' : '') + fx.credits + ' credits');
    }
    if (fx.maxhp) {
      r.maxHp += fx.maxhp; r.hp += fx.maxhp;
      gained.push('+' + fx.maxhp + ' Max HP');
    }
    if (fx.healPct) {
      var h = Math.round(r.maxHp * fx.healPct);
      heal(h);
      gained.push('+' + h + ' HP');
    }
    if (fx.hp) {
      if (fx.hp < 0) {
        r.hp += fx.hp;
        gained.push(fx.hp + ' HP');
        if (r.hp <= 0) { playerDied(); return gained; }
      } else { heal(fx.hp); gained.push('+' + fx.hp + ' HP'); }
    }
    if (fx.attr) {
      var a = fx.attr === 'random' ? pick(['might', 'tech', 'psi']) : fx.attr;
      r.attrs[a] += 1;
      gained.push('+1 ' + a.toUpperCase());
    }
    if (fx.card) {
      var cid;
      if (fx.card === 'random') cid = rollRewardCard(0);
      else if (fx.card === 'colorless') cid = rollColorlessCard() || rollRewardCard(0);
      else if (fx.card === 'rare') {
        var rares = Object.keys(ns.CARDS).filter(function (k) {
          var c = ns.CARDS[k];
          return c.rarity === 3 && !c.pool && (c.cls === r.cls || c.cls === 'any');
        });
        cid = rares.length ? pick(rares) : rollRewardCard(0);
      } else cid = fx.card;
      r.deck.push(mkCard(cid, false));
      gained.push('Card: ' + ns.CARDS[cid].name);
    }
    if (fx.artifact) {
      var aid = randomArtifact(1);
      // offer it as a take/skip choice instead of auto-granting
      if (aid) { r.pendingRelic = aid; gained.push('Relic found: ' + ns.ARTIFACTS[aid].name); }
      else { r.credits += 40; gained.push('+40 credits'); }
    }
    if (fx.curse) {
      r.deck.push(mkCard(fx.curse, false));
      gained.push('CURSE: ' + ns.CARDS[fx.curse].name);
    }
    if (fx.removeCurse) {
      var want = fx.removeCurse === true ? 99 : fx.removeCurse, removed = 0;
      for (var ci2 = r.deck.length - 1; ci2 >= 0 && removed < want; ci2--) {
        if (ns.CARDS[r.deck[ci2].id].type === 'curse') { r.deck.splice(ci2, 1); removed++; }
      }
      gained.push(removed ? 'Purged ' + removed + ' curse' + (removed > 1 ? 's' : '') : 'No curses to purge');
    }
    if (fx.addCardChoice) {
      r.pendingAddCard = E.augmentAddOptions();
      gained.push('Choose a card to add');
    }
    if (fx.tradeCard) {
      r.pendingTrade = { kind: 'card' };
      gained.push('Scrap a card to forge a better one');
    }
    if (fx.tradeRelic) {
      r.pendingTrade = { kind: 'relic', given: null, choices: null };
      gained.push('Exchange a relic for two unknown ones');
    }
    if (fx.pick) {
      r.pendingPick = fx.pick;
      gained.push(fx.pick === 'remove' ? 'Choose a card to remove' : fx.pick === 'upgrade' ? 'Choose a card to upgrade' :
        fx.pick === 'vtouch' ? 'Choose a card to Void-Touch' : 'Choose a card to duplicate');
    }
    return gained;
  }

  E.eventAddCard = function (cid) { E.run.deck.push(mkCard(cid, false)); E.run.pendingAddCard = null; };

  // A relic offered by an event: take it into the arsenal, or leave it behind.
  E.takeEventRelic = function () {
    var r = E.run;
    if (r.pendingRelic) { addArtifact(r.pendingRelic); r.pendingRelic = null; E.save(); }
  };
  E.skipEventRelic = function () { E.run.pendingRelic = null; E.save(); };

  E.finishEvent = function () {
    var r = E.run;
    if (r.pendingPick || r.pendingAddCard || r.pendingRelic || r.pendingTrade || r.pendingSell) return; // resolve pending choices first
    r.eventResult = null;
    r.currentEvent = null;
    nodeComplete();
  };

  /* ---------------- Gamble den (dice / wheel / cards) ------------------- */
  var GAMBLE_GAMES = ['bones', 'wheel', 'cards'];
  var CLASS_CORE = { vanguard: 'might', technomancer: 'tech', voidadept: 'psi', warpcaller: 'bond' };
  function coreAttrName() { return CLASS_CORE[E.run.cls] || 'might'; }
  function coreAttr() { return attr(coreAttrName()); }
  function clampP(p) { return Math.max(0.15, Math.min(0.82, p)); }
  function gambleTiers() {
    var cr = E.run.credits, core = coreAttr();
    var base = { '0.25': 0.55, '0.5': 0.46, '1': 0.38 };
    return [
      { frac: 0.25, prize: 'potion', label: 'a Stim', cost: Math.floor(cr * 0.25), p: clampP(base['0.25'] + 0.02 * core) },
      { frac: 0.5, prize: 'card', label: 'an Uncommon / Rare card', cost: Math.floor(cr * 0.5), p: clampP(base['0.5'] + 0.02 * core) },
      { frac: 1, prize: 'relic', label: 'a Relic', cost: cr, p: clampP(base['1'] + 0.02 * core) },
    ];
  }
  E.gambleStart = function () { E.run.gamble = { game: pick(GAMBLE_GAMES), phase: 'bet', result: null }; E.save(); };
  E.gambleInfo = function () {
    if (!E.run.gamble) E.gambleStart();
    var g = E.run.gamble;
    return { game: g.game, phase: g.phase, credits: E.run.credits, core: coreAttr(), coreName: coreAttrName(), tiers: gambleTiers(), result: g.result };
  };
  E.gamblePlay = function (frac) {
    var r = E.run, g = r.gamble; if (!g || g.phase !== 'bet') return null;
    var tier = null, ts = gambleTiers();
    for (var i = 0; i < ts.length; i++) if (ts[i].frac === frac) tier = ts[i];
    if (!tier || tier.cost <= 0 || r.credits < tier.cost) return null;
    r.credits -= tier.cost;
    var won = rnd() < tier.p;
    g.result = { won: won, frac: frac, prize: tier.prize, cost: tier.cost, p: tier.p, detail: gambleResolve(g.game, won, tier.p), claimed: false };
    g.phase = 'reveal';
    E.save();
    return g.result;
  };
  function gambleResolve(game, won, p) {
    if (game === 'bones') {
      var T = 8, a, b, guard = 0;
      do { a = ri(1, 6); b = ri(1, 6); guard++; } while (((a + b >= T) !== won) && guard < 80);
      return { a: a, b: b, target: T };
    }
    if (game === 'wheel') {
      var N = 12, winSegs = Math.max(1, Math.min(N - 1, Math.round(p * N)));
      var seg = won ? Math.floor(rnd() * winSegs) : winSegs + Math.floor(rnd() * (N - winSegs));
      return { N: N, winSegs: winSegs, seg: seg, spins: 4 + Math.floor(rnd() * 3) };
    }
    var pl, dl, guard2 = 0;
    do { pl = 15 + ri(0, 6); dl = 15 + ri(0, 6); guard2++; } while (((pl > dl && pl <= 21) !== won) && guard2 < 120);
    return { player: handFor(pl), dealer: handFor(dl), pTotal: pl, dTotal: dl };
  }
  function handFor(total) {
    var a = Math.max(2, Math.min(11, total - ri(7, 11)));
    var b = total - a;
    if (b < 2) { b = 2; a = total - 2; }
    return [Math.min(11, Math.max(2, a)), Math.min(11, Math.max(2, b))];
  }
  function rollGambleCard() {
    var r = E.run, pool = Object.keys(ns.CARDS).filter(function (k) {
      var c = ns.CARDS[k];
      return c.rarity >= 2 && c.rarity <= 3 && !c.pool && (c.cls === r.cls || c.cls === 'any');
    });
    return pool.length ? pick(pool) : rollRewardCard(0.5);
  }
  E.gambleClaim = function () {
    var r = E.run, g = r.gamble, res = g && g.result;
    if (!res || res.claimed) return null;
    res.claimed = true;
    var got = {};
    if (res.won) {
      if (res.prize === 'potion') { var pid = rollPotion(); if (pid && E.addPotion(pid)) got.potion = pid; else { r.credits += 40; got.credits = 40; } }
      else if (res.prize === 'card') { var cid = rollGambleCard(); r.deck.push(mkCard(cid, false)); got.card = cid; }
      else if (res.prize === 'relic') { var aid = randomArtifact(1); if (aid) { addArtifact(aid); got.relic = aid; } else { r.credits += 80; got.credits = 80; } }
    }
    E.save();
    return got;
  };
  E.gambleFinish = function () { E.run.gamble = null; E.run.eventResult = null; E.run.currentEvent = null; nodeComplete(); };


  /* Resolve a pending deck pick (remove / upgrade / dupe). deckIdx into run.deck */
  E.applyPick = function (deckIdx) {
    var r = E.run;
    var t = r.pendingPick;
    if (!t) return false;
    var card = r.deck[deckIdx];
    if (!card) return false;
    if (t === 'remove') r.deck.splice(deckIdx, 1);
    else if (t === 'upgrade') card.up = true;
    else if (t === 'dupe') r.deck.push(mkCard(card.id, card.up));
    else if (t === 'vtouch') card.vtouch = true;
    r.pendingPick = null;
    E.save();
    return true;
  };

  E.cancelPick = function () { E.run.pendingPick = null; };

  /* ---------------- Trade-up (card-for-card / relic-for-relic) ------------- */
  // Scrap a deck card -> receive a card ONE rarity tier higher. The "math":
  // commons forge uncommons, uncommons forge rares, rares forge rares.
  E.tradeCardPick = function (deckIdx) {
    var r = E.run, t = r.pendingTrade;
    if (!t || t.kind !== 'card') return null;
    var card = r.deck[deckIdx]; if (!card) return null;
    var def = ns.CARDS[card.id];
    if (def.type === 'curse') return null;
    var giveRar = def.rarity || 1;
    r.deck.splice(deckIdx, 1);
    var cid = rollRewardCardTier(Math.min(3, giveRar + 1));
    r.deck.push(mkCard(cid, false));
    r.pendingTrade = null;
    E.save();
    return { gave: def.name, got: cid };
  };
  // Relic-for-relic: surrender one owned relic, then choose one of two fresh ones.
  E.tradeGiveRelic = function (aid) {
    var r = E.run, t = r.pendingTrade;
    if (!t || t.kind !== 'relic' || t.given) return null;
    if (E.tradeableRelics().indexOf(aid) < 0) return null;
    removeArtifact(aid);
    t.given = aid;
    t.choices = randomArtifactChoices(1, 2);
    E.save();
    return t.choices;
  };
  E.tradeTakeRelic = function (aid) {
    var r = E.run, t = r.pendingTrade;
    if (!t || t.kind !== 'relic') return null;
    if (aid && t.choices && t.choices.indexOf(aid) >= 0) addArtifact(aid);
    r.pendingTrade = null;
    E.save();
    return aid;
  };
  E.skipTrade = function () { E.run.pendingTrade = null; E.save(); };

  /* ---------------- Sell (liquidate a card/relic for credits) -------------- */
  function cardSellValue(card) {
    var base = { 1: 18, 2: 32, 3: 55, 4: 80 }[ns.CARDS[card.id].rarity || 1] || 18;
    return base + (card.up ? 12 : 0);
  }
  function relicSellValue(aid) {
    return (ns.ARTIFACTS[aid].tier === 2) ? 90 : 55;
  }
  E.sellOptions = function () {
    var r = E.run, k = r.pendingSell && r.pendingSell.kind;
    if (k === 'relic') {
      return E.tradeableRelics().map(function (aid) { return { id: aid, value: relicSellValue(aid) }; });
    }
    var out = [];
    r.deck.forEach(function (card, i) {
      if (ns.CARDS[card.id].type === 'curse') return;
      out.push({ idx: i, id: card.id, up: card.up, vtouch: card.vtouch, value: cardSellValue(card) });
    });
    return out;
  };
  E.sellPick = function (ref) {
    var r = E.run, p = r.pendingSell; if (!p) return null;
    var got = 0;
    if (p.kind === 'relic') {
      if (E.tradeableRelics().indexOf(ref) < 0) return null;
      got = relicSellValue(ref); removeArtifact(ref);
    } else {
      var card = r.deck[ref]; if (!card || ns.CARDS[card.id].type === 'curse') return null;
      got = cardSellValue(card); r.deck.splice(ref, 1);
    }
    r.credits += got;
    r.pendingSell = null;
    E.save();
    return got;
  };
  E.skipSell = function () { E.run.pendingSell = null; E.save(); };

  /* ---------------- Press-your-luck (escalating risk loops) ---------------- */
  // Config lives on the chosen event choice: ch.pressLuck = {
  //   steps:[fx,...], bust:{base,step}, bustFx:{...}, attr:'might', bankText, bustText, pushVerb }
  function pressLuckCfg() {
    var r = E.run, ev = E.getEvent();
    if (!ev || !r.pressLuck) return null;
    return ev.choices[r.pressLuck.ci].pressLuck;
  }
  function startPressLuck(ci) {
    E.run.pressLuck = { ci: ci, level: 0, accrued: [], busted: false };
    E.run.phase = 'press-luck';
  }
  E.pressLuckInfo = function () {
    var r = E.run, p = r.pressLuck, cfg = pressLuckCfg();
    if (!p || !cfg) return null;
    var lvl = p.level, last = lvl >= cfg.steps.length;
    var bustChance = last ? 1 : clampPL(cfg.bust.base + cfg.bust.step * lvl - attrPLBonus(cfg));
    return {
      level: lvl, maxLevel: cfg.steps.length,
      accrued: p.accrued.slice(),
      nextReward: last ? null : cfg.steps[lvl],
      bustChance: bustChance, busted: p.busted, done: last,
      pushVerb: cfg.pushVerb || 'PUSH', attr: cfg.attr || null,
    };
  };
  function clampPL(p) { return Math.max(0, Math.min(0.92, p)); }
  function attrPLBonus(cfg) { return cfg.attr ? attr(cfg.attr) * 0.015 : 0; }
  E.pressLuckPush = function () {
    var r = E.run, p = r.pressLuck, cfg = pressLuckCfg();
    if (!p || !cfg || p.busted) return null;
    if (p.level >= cfg.steps.length) return null; // nothing left to win — must bank
    var bustChance = clampPL(cfg.bust.base + cfg.bust.step * p.level - attrPLBonus(cfg));
    var threshold = Math.round(bustChance * 20); // bust if d20 <= threshold
    var roll = d20();
    var busted = roll <= threshold;
    var ret = { roll: roll, threshold: threshold, busted: busted, bustChance: bustChance };
    if (busted) {
      p.busted = true;
      ret.reward = null;
    } else {
      var step = cfg.steps[p.level];
      p.accrued.push(step);
      p.level += 1;
      ret.reward = step;
      ret.done = p.level >= cfg.steps.length;
    }
    E.save();
    return ret;
  };
  // Walk away with the pot (or finish a bust): roll resolves into the event result.
  E.pressLuckBank = function () {
    var r = E.run, p = r.pressLuck, cfg = pressLuckCfg();
    if (!p || !cfg) return null;
    var gained = [], text;
    if (p.busted) {
      gained = applyOutcome(cfg.bustFx || {});
      text = cfg.bustText || 'It all goes wrong. You lose what you had gathered.';
    } else {
      p.accrued.forEach(function (fx) { gained = gained.concat(applyOutcome(fx)); });
      text = cfg.bankText || (p.accrued.length ? 'You pocket your haul and pull out.' : 'You leave with nothing but your skin.');
    }
    r.pressLuck = null;
    if (r.phase !== 'dead') { r.eventResult = { text: text, gained: gained, roll: null }; r.phase = 'event-result'; }
    E.save();
    return { gained: gained, text: text };
  };

  /* ---------------- Shop --------------------------------------------------- */
  // market=true -> Black Market: salvage-tech heavy + cheap card removal.
  function buildShop(market) {
    var r = E.run;
    var cards = [], seen = {};
    var nNormal = market ? 2 : 3, nColorless = market ? 2 : 1;
    for (var i = 0; i < nNormal; i++) {
      var cid = rollRewardCard(0.06), guard = 0;
      while (seen[cid] && guard++ < 20) cid = rollRewardCard(0.06);
      seen[cid] = true;
      cards.push({ id: cid, cost: B.shop.cardCost[ns.CARDS[cid].rarity] || 35, sold: false });
    }
    for (var k = 0; k < nColorless; k++) {
      var col = rollColorlessCard();
      if (col && !seen[col]) { seen[col] = true; cards.push({ id: col, cost: (B.shop.cardCost[ns.CARDS[col].rarity] || 35) + (market ? -5 : 10), sold: false }); }
    }
    var aid = randomArtifact(1);
    var pid = (rnd() < B.potions.shopChance) ? rollPotion() : null;
    r.shop = {
      market: !!market,
      cards: cards,
      artifact: aid ? { id: aid, cost: B.shop.artifactCost - (market ? 15 : 0), sold: false } : null,
      potion: pid ? { id: pid, cost: B.potions.shopCost[ns.POTIONS[pid].rarity] || 40, sold: false } : null,
      healUsed: false,
      removeUsed: false,
      removeDiscount: market ? 15 : 0,
    };
  }

  E.shopBuyCard = function (i) {
    var r = E.run, it = r.shop.cards[i];
    if (!it || it.sold || r.credits < it.cost) return false;
    r.credits -= it.cost; it.sold = true;
    r.deck.push(mkCard(it.id, false));
    E.save();
    return true;
  };
  E.shopBuyArtifact = function () {
    var r = E.run, it = r.shop.artifact;
    if (!it || it.sold || r.credits < it.cost) return false;
    r.credits -= it.cost; it.sold = true;
    addArtifact(it.id);
    E.save();
    return true;
  };
  E.shopBuyPotion = function () {
    var r = E.run, it = r.shop.potion;
    if (!it || it.sold || r.credits < it.cost) return false;
    if (E.potionFull()) return false;
    r.credits -= it.cost; it.sold = true;
    E.addPotion(it.id);
    E.save();
    return true;
  };
  E.shopBuyHeal = function () {
    var r = E.run;
    if (r.shop.healUsed || r.credits < B.shop.healCost || r.hp >= r.maxHp) return false;
    r.credits -= B.shop.healCost;
    r.shop.healUsed = true;
    heal(B.shop.healAmount);
    E.save();
    return true;
  };
  E.shopBuyRemove = function () {
    var r = E.run;
    if (r.shop.removeUsed || r.credits < r.removeCost) return false;
    r.credits -= r.removeCost;
    r.removeCost += B.shop.removeCostInc;
    r.shop.removeUsed = true;
    r.pendingPick = 'remove';
    return true;
  };
  E.leaveShop = function () {
    E.run.shop = null;
    nodeComplete();
  };

  /* ---------------- Rest --------------------------------------------------- */
  E.restHeal = function () {
    heal(Math.round(E.run.maxHp * B.rewards.restHealPct));
    nodeComplete();
  };
  E.restUpgrade = function () {
    E.run.pendingPick = 'upgrade';
  };
  E.restFinishUpgrade = function (deckIdx) {
    if (E.applyPick(deckIdx)) nodeComplete();
  };

  /* ---------------- Persistence -------------------------------------------- */
  function store() {
    try { return (typeof localStorage !== 'undefined') ? localStorage : null; } catch (e) { return null; }
  }

  E.save = function () {
    var s = store();
    if (!s || !E.run) return;
    // only save at non-combat checkpoints; a run resumes at the current node
    if (E.run.phase === 'combat' || E.run.phase === 'dead') return;
    try {
      s.setItem('voidspire_save', JSON.stringify({ run: E.run, rng: rngState, uid: uidCounter }));
    } catch (e) { /* storage full / private mode */ }
  };

  E.load = function () {
    var s = store();
    if (!s) return false;
    try {
      var raw = s.getItem('voidspire_save');
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (!data.run || !data.run.deck) return false;
      E.run = data.run;
      rngState = data.rng >>> 0;
      uidCounter = data.uid || 1000;
      E.combat = null;
      // if we saved mid-node-flow, re-enter the node cleanly
      var p = E.run.phase;
      if (p === 'reward' || p === 'event' || p === 'event-result') {
        // restart node types that can't resume mid-way
        if (E.run.nodeType === 'fight' || E.run.nodeType === 'elite' || E.run.nodeType === 'boss') {
          E.startNode(E.run.nodeType);
        }
      }
      return true;
    } catch (e) { return false; }
  };

  E.hasSave = function () {
    var s = store();
    if (!s) return false;
    try { return !!s.getItem('voidspire_save'); } catch (e) { return false; }
  };

  E.clearSave = function () {
    var s = store();
    if (s) { try { s.removeItem('voidspire_save'); } catch (e) {} }
  };

  E.recordBest = function () {
    var s = store();
    if (!s || !E.run) return;
    try {
      var best = JSON.parse(s.getItem('voidspire_best') || '{}');
      var sc = E.score();
      var wonBefore = !!best.won;
      if (!best.score || sc > best.score || (E.run.won && !wonBefore)) {
        best = { score: Math.max(sc, best.score || 0), sector: E.run.sector, loop: E.run.loop || 1, cls: E.run.cls, won: wonBefore || !!E.run.won };
        s.setItem('voidspire_best', JSON.stringify(best));
      }
    } catch (e) {}
  };

  E.getBest = function () {
    var s = store();
    if (!s) return null;
    try { return JSON.parse(s.getItem('voidspire_best') || 'null'); } catch (e) { return null; }
  };

  E.abandonRun = function () {
    E.clearSave();
    E.run = null;
    E.combat = null;
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
