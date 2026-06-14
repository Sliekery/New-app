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
    E.run = {
      cls: clsId,
      hp: c.hp, maxHp: c.hp,
      attrs: { might: c.might, tech: c.tech, psi: c.psi },
      credits: B.player.startCredits,
      deck: deck,
      artifacts: [],
      sector: 1,
      faction: pick(Object.keys(ns.FACTIONS)),
      map: null,
      mapRow: -1, mapCol: 0,
      phase: 'none',
      usedEvents: [],
      removeCost: B.shop.removeCost,
      kills: 0, nodesCleared: 0,
      pendingPick: null, pendingAddCard: null,
      quests: {}, questDone: {},
      augments: [], augmentDeckop: null, augmentOffer: null,
      potions: [], won: false,
      loop: 1, echoes: [], loadout: [], echoOffer: null,
      phylacteryUsed: false, salvageKills: 0,
    };
    E.combat = null;
    E.run.map = generateMap(1);
    E.run.phase = 'map';
    E.save();
  };

  /* Effective attribute incl. artifacts */
  function attr(name) {
    var v = E.run.attrs[name];
    for (var i = 0; i < E.run.artifacts.length; i++) {
      var a = ns.ARTIFACTS[E.run.artifacts[i]];
      if (a.k === 'attr' && a.a === name) v += a.v;
    }
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
      var a = ns.ARTIFACTS[owned[i]];
      if (a.k === k) t += a.v;
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

  E.score = function () {
    var r = E.run;
    return (r.sector - 1) * B.score.perSector + r.nodesCleared * B.score.perNode + r.kills * B.score.perKill +
      ((r.loop || 1) - 1) * B.score.perLoop;
  };

  /* ---------------- Map generation (branching star chart) -------------- */
  // A planar DAG woven by random walks on a fixed column grid, so paths
  // branch and merge without edge crossings. Boss sits above the top row.
  function generateMap(sector) {
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

    assignTypes(rows, sector);
    return { rows: rows, boss: boss, ROWS: ROWS, COLS: COLS };
  }

  function weightedType(weights) {
    var pool = [];
    Object.keys(weights).forEach(function (t) { for (var i = 0; i < weights[t]; i++) pool.push(t); });
    return pick(pool);
  }

  function assignTypes(rows, sector) {
    var M = B.map, ROWS = M.rows;
    for (var r = 0; r < ROWS; r++) {
      var isFirst = (r === 0), isLast = (r === ROWS - 1), isTreasure = (r === M.treasureRow);
      rows[r].forEach(function (node) {
        if (isFirst) { node.type = 'fight'; return; }
        if (isLast && M.restBeforeBoss) { node.type = 'rest'; return; }
        if (isTreasure) { node.type = 'treasure'; return; }
        var t = weightedType(M.typeWeights), tries = 0;
        while (tries++ < 16) {
          if (t === 'elite' && r < M.eliteFromRow) { t = weightedType(M.typeWeights); continue; }
          if ((t === 'shop' || t === 'rest') && r < M.shopRestFromRow) { t = weightedType(M.typeWeights); continue; }
          if (t === 'shop' || t === 'rest' || t === 'elite') {
            var clash = node.parents.some(function (pc) {
              var pn = rows[r - 1].find(function (x) { return x.col === pc; });
              return pn && pn.type === t;
            });
            if (clash) { t = weightedType(M.typeWeights); continue; }
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
    var t = node.type;
    if (t === 'random') { t = resolveRandomNode(); node.resolved = t; }
    E.startNode(t);
    E.save();
    return true;
  };

  E.startNode = function (type) {
    var r = E.run;
    r.nodeType = type;
    if (type === 'fight' || type === 'elite' || type === 'boss') startCombat(type);
    else if (type === 'event') startEvent();
    else if (type === 'shop') { buildShop(); r.phase = 'shop'; }
    else if (type === 'rest') r.phase = 'rest';
    else if (type === 'treasure') startTreasure();
  };

  function startTreasure() {
    var r = E.run;
    var aid = randomArtifact(1);
    if (aid) { r.treasure = aid; addArtifact(aid); }
    else { r.treasure = null; r.credits += 40; }
    r.phase = 'treasure';
    E.save();
  }
  E.finishTreasure = function () { E.run.treasure = null; nodeComplete(); };

  function nodeComplete() {
    var r = E.run;
    r.nodesCleared++;
    var node = currentNode();
    if (node && node.type === 'boss') r.phase = 'levelup';
    else r.phase = 'map';
    E.save();
  }
  E.nodeComplete = nodeComplete;

  /* ---------------- Level up: Augment Protocol draft ------------------- */
  var CLASS_STAT = { vanguard: 'might', technomancer: 'tech', voidadept: 'psi' };
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
  function scaledHp(base, s) { return Math.round(base * B.scaling.hpMul(s) * worldPowerMult()); }
  function scaledDmg(base, s) { return Math.round(base * B.scaling.dmgMul(s) * worldPowerMult()); }

  function mkEnemy(id) {
    var def = ns.ENEMIES[id];
    var s = E.run.sector;
    var hp = scaledHp(def.hp, s);
    var en = {
      id: id, def: def, hp: hp, maxHp: hp, block: 0,
      statuses: {}, moveIdx: 0, lastMove: -1, intent: null, alive: true,
    };
    var bonusStr = Math.floor((s - 1) / B.scaling.strEverySectors);
    if (bonusStr > 0) en.statuses.str = bonusStr;
    return en;
  }

  function startCombat(kind) {
    var r = E.run;
    var ids, isFinal = false;
    if (kind === 'boss') {
      if (r.sector === B.run.finale) { ids = [ns.FINAL_BOSS]; isFinal = true; }
      else ids = [ns.BOSSES[r.faction]];
    } else if (kind === 'elite') {
      ids = [ns.ELITES[r.faction]];
      if (r.sector >= 3 && rnd() < B.sector.eliteChance2Enemies) ids.push(ns.ELITE_MINIONS[r.faction]);
    } else {
      var packs = ns.PACKS[r.faction];
      // earlier rows in a sector lean toward easier packs; the harder packs
      // (the new-mechanic enemies, slots 4+) are held back until sector 2+ so
      // sector 1 stays a gentle on-ramp.
      var prog = Math.min(1, r.mapRow / Math.max(1, B.map.rows - 1));
      var hi = (r.sector <= 1) ? 4 : packs.length;
      var lo = Math.min(Math.floor(prog * (packs.length - 3)), hi - 1);
      ids = pick(packs.slice(Math.max(0, lo), Math.min(hi, lo + 4))).slice();
    }
    var c = E.combat = {
      kind: kind,
      enemies: ids.map(mkEnemy),
      turn: 0,
      energy: 0,
      hand: [], drawPile: shuffle(r.deck.slice()), discard: [], exhaust: [], consumed: [],
      player: { block: 0, statuses: {} },
      echoReady: false,
      playedShield: false,
      startHp: r.hp,
      cardsThisTurn: 0,
      reactiveUsed: false,
      over: false,
      isFinal: isFinal,
    };
    var ps = art('strStart');
    if (ps > 0) c.player.statuses.str = ps;
    var es = art('echoStart');
    if (es > 0) c.player.statuses.echo = es;
    var vstart = art('vulnStart');
    if (vstart > 0) c.player.statuses.vuln = vstart;
    var pa = art('platedArmorStart');
    if (pa > 0) c.player.statuses.platedArmor = pa;
    var bs = art('blockStart');
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
    p.block += n;
    if (played) c.playedShield = true;
    emit('block', { who: 'player', amount: n, blockAfter: p.block });
    var st = art('shieldThorns');
    if (st > 0 && !c.over) {
      var pool = aliveEnemies();
      if (pool.length) { var en = pick(pool); dealToEnemy(en, c.enemies.indexOf(en), st, { noCrit: true, noWeak: true }); }
    }
    var sw = art('shieldWeak');   // Disruptor Field: Shield gains apply Weak
    if (sw > 0 && !c.over) {
      var poolW = aliveEnemies();
      if (poolW.length) { var enW = pick(poolW); addStatus(enW, 'weak', sw); emit('status', { who: 'enemy', idx: c.enemies.indexOf(enW), s: 'weak', v: sw }); }
    }
  }

  /* ---------------- Combat: turn structure ------------------------------ */
  function maxEnergy() { return B.player.baseEnergy + art('energyEveryTurn') + (statN(E.combat.player, 'reactor')); }

  function statN(ent, s) { return ent.statuses[s] || 0; }
  function addStatus(ent, s, v) {
    ent.statuses[s] = (ent.statuses[s] || 0) + v;
    if (ent.statuses[s] <= 0) delete ent.statuses[s];
  }

  function startPlayerTurn() {
    var c = E.combat, p = c.player;
    var leftover = c.energy;
    c.turn++;
    c.cardsThisTurn = 0;
    c.momentum = 0;   // Momentum Engine resets each turn
    // Cursed Inheritance: a curse is lodged in hand at the start of combat
    if (c.turn === 1 && E.hasEcho('cursed_inheritance')) c.hand.push(mkCard('recurring_curse', false));
    // block expiry
    if (!statN(p, 'retain')) p.block = 0;
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
    var ht = art('healTurn');
    if (ht > 0) heal(ht);
    var bg = art('burnGrow');
    if (bg > 0) c.enemies.forEach(function (en, i) { if (en.alive && statN(en, 'burn') > 0) { addStatus(en, 'burn', bg); emit('status', { who: 'enemy', idx: i, s: 'burn', v: bg }); } });
    var aoe = art('aoeTurnStart');
    var draws = B.player.drawPerTurn + art('drawTurn') + (c.turn === 1 ? art('drawStart') : 0);
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
      }
      c.hand.push(c.drawPile.pop());
    }
  }

  function chooseIntent(en) {
    var def = en.def, mv;
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
      var d = scaledDmg(m.d, s) + statN(en, 'str');
      if (statN(en, 'weak')) d = Math.floor(d * B.status.weakMult);
      return { icon: 'atk', label: m.hits ? d + '×' + m.hits : '' + d };
    }
    if (m.t === 'drain') {
      var dd = scaledDmg(m.d, s) + statN(en, 'str');
      if (statN(en, 'weak')) dd = Math.floor(dd * B.status.weakMult);
      return { icon: 'drain', label: '' + dd };
    }
    if (m.t === 'block') return { icon: 'block', label: '' + scaledDmg(m.b, s) };
    if (m.t === 'buff') return { icon: 'buff', label: '' };
    if (m.t === 'heal') return { icon: 'heal', label: '' + scaledDmg(m.v, s) };
    if (m.t === 'summon') return { icon: 'summon', label: m.n ? '×' + m.n : '' };
    if (m.t === 'debuff') return { icon: 'debuff', label: '' };
    if (m.t === 'curse') return { icon: 'curse', label: '' };
    if (m.t === 'unmake') return { icon: 'unmake', label: '' };
    return { icon: '?', label: '' };
  };

  /* ---------------- Combat: playing cards ------------------------------- */
  E.cardInfo = function (card) {
    var def = ns.CARDS[card.id];
    return {
      def: def,
      name: def.name + (card.up ? '+' : ''),
      cost: effCost(def, card.up),
      xcost: !!def.xcost,
      desc: ns.cardDesc(def, card.up, liveCtx(), card.vtouch),
      type: def.type,
      needsTarget: ns.cardNeedsTarget(def, card.up),
      unplayable: !!def.unplayable,
      rarity: def.rarity,
      vtouch: !!card.vtouch,
    };
  };

  // Effective energy cost: X-cost cards read as 0; under Corruption, Skills cost
  // 0; Overclock makes the first card each turn cost less.
  function effCost(def, up) {
    if (def.xcost) return 0;
    var c = ns.cardCost(def, up);
    if (E.combat && def.type === 'skill' && statN(E.combat.player, 'corruption') > 0) return 0;
    if (E.combat && E.combat.cardsThisTurn === 0) {
      var ff = art('firstCardFree');
      if (ff > 0) c = Math.max(0, c - ff);
    }
    return c;
  }
  E.effCost = effCost;

  function liveCtx() {
    return {
      attrs: { might: attr('might'), tech: attr('tech'), psi: attr('psi') },
      pri: priAttr(),            // primary attribute name (for 'pri'-scaled cards)
      statuses: E.combat ? E.combat.player.statuses : null,
      flatDmg: art('flatDmg'),   // so cards show damage incl. relic/augment buffs
    };
  }

  // primary attribute of the active class — lets shared/defensive cards scale
  // with whatever the class actually invests in, instead of a fixed attribute.
  var PRI_ATTR = { vanguard: 'might', technomancer: 'tech', voidadept: 'psi' };
  function priAttr() { return PRI_ATTR[E.run && E.run.cls] || 'might'; }
  function resolveScale(s) { return s === 'pri' ? priAttr() : s; }

  function attackBonus(f) {
    var p = E.combat.player;
    var mul = f.scaleMul || 1;
    var sc = resolveScale(f.scale);
    var v = statN(p, 'str') + art('flatDmg') + (E.combat.momentum || 0); // Momentum Engine
    if (sc === 'might') v += attr('might') * B.attrs.mightDmgPerPoint * mul;
    if (sc === 'tech') v += attr('tech') * mul;
    if (sc === 'psi') v += attr('psi') * B.attrs.psiDmgPerPoint * mul + statN(p, 'psiPow');
    return Math.round(v);   // damage is always a whole number (no decimals)
  }

  function dealToEnemy(en, idx, amount, opts) {
    opts = opts || {};
    var c = E.combat;
    var dm = art('dmgMult');
    if (dm > 0) amount = Math.round(amount * (1 + dm));
    if (E.hasEcho('cursed_inheritance') && handHasCurse()) amount = Math.round(amount * 1.25); // Cursed Inheritance
    if (statN(c.player, 'weak') && !opts.noWeak) amount = Math.floor(amount * B.status.weakMult);
    if (statN(en, 'vuln')) { amount = Math.floor(amount * B.status.vulnMult); amount += art('vulnDmg'); }
    if (opts.execute && en.hp <= en.maxHp * 0.30) amount *= 2;
    if (opts.crit) {
      amount = Math.floor(amount * B.dice.critMult);
      var cv = art('critVuln');
      if (cv > 0 && en.alive) { addStatus(en, 'vuln', cv); emit('status', { who: 'enemy', idx: idx, s: 'vuln', v: cv }); }
    }
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
    if (en.hp <= 0 && en.alive) {
      en.alive = false;
      E.run.kills++;
      questProgress('kills', 1);
      var hk = art('healOnKill'); if (hk > 0) heal(hk);
      var sk = art('strOnKill'); if (sk > 0) { addStatus(c.player, 'str', sk); emit('status', { who: 'player', s: 'str', v: sk }); }
      var kd = art('killDraw'); if (kd > 0) drawCards(kd);
      emit('die', { idx: idx });
      echoKill(idx);
    }
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

  E.canPlay = function (handIdx) {
    var c = E.combat;
    if (!c || c.over) return false;
    var card = c.hand[handIdx];
    if (!card) return false;
    var info = E.cardInfo(card);
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
  }

  // Burn applied to an enemy by the player (for the Burn quest).
  function trackBurn(n) { questProgress('burnTotal', n); }

  // Resolve a card's effects once. Echo can call this twice. ctx carries the
  // shared roll/crit/target and an appliedBurn flag for Contagion.
  function applyCardFx(fx, ctx) {
    var c = E.combat, p = c.player;
    var tgt = ctx.tgt, crit = ctx.crit, roll = ctx.roll, flags = ctx.flags;
    var totalDealt = 0;
    fx.forEach(function (f) {
      if (c.over && f.k === 'dmg') return;
      switch (f.k) {
        case 'dmg': {
          var base = f.v + attackBonus(f);
          var hits = f.xcost ? ctx.xval : (f.hits || 1);
          for (var h = 0; h < hits; h++) {
            var pool = aliveEnemies();
            if (pool.length === 0) break;
            var en, idx;
            if (f.all) {
              c.enemies.forEach(function (e, i) {
                if (e.alive) totalDealt += dealToEnemy(e, i, base, { crit: crit, roll: roll, execute: flags.execute });
              });
              continue;
            } else if (f.random) {
              en = pick(pool); idx = c.enemies.indexOf(en);
            } else {
              en = (tgt && tgt.alive) ? tgt : pool[0];
              idx = c.enemies.indexOf(en);
            }
            totalDealt += dealToEnemy(en, idx, base, { crit: crit, roll: roll, execute: flags.execute });
          }
          break;
        }
        case 'block': {
          var bsc = resolveScale(f.scale);
          var bonus = bsc === 'tech' ? attr('tech') * B.attrs.techBlockPerPoint
                    : bsc === 'might' ? attr('might') * B.attrs.mightBlockPerPoint
                    : bsc === 'psi' ? attr('psi') * B.attrs.psiBlockPerPoint : 0;
          gainBlock(f.v + bonus, true);
          break;
        }
        case 'heal': heal(f.v); break;
        case 'hploss': hurtPlayer(f.v, { pure: true }); break;
        case 'draw': drawCards(f.v); break;
        case 'energy': c.energy += f.v; break;
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
            if (sEn && dmg > 0) totalDealt += dealToEnemy(sEn, c.enemies.indexOf(sEn), dmg, { crit: crit, roll: roll });
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
    var cost = effCost(def, card.up);

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

    // one d20 per card play; only attacks can crit
    var roll = null, crit = false;
    if (def.type === 'attack') {
      roll = d20();
      crit = roll >= B.dice.critThreshold - art('critBonus');
    }

    var ctx = { tgt: tgt, crit: crit, roll: roll, flags: flags, xval: xval, appliedBurn: false };
    var times = 1;
    if (def.type === 'attack' && c.echoReady) { c.echoReady = false; times = 2; }
    // Doubled Self: on turn 1, every card you play resolves twice
    if (c.turn === 1 && E.hasEcho('doubled_self')) times = Math.max(times, 2);
    var totalDealt = 0;
    for (var rep = 0; rep < times; rep++) {
      if (c.over) break;
      totalDealt += applyCardFx(fx, ctx);
    }
    // Void-Touched drawback: pay HP each time the corrupted card is played
    if (card.vtouch && r.phase !== 'dead') hurtPlayer(ns.VTOUCH_HP, { pure: true });

    // on-play triggers (once per card played, not per echo repeat)
    if (!c.over) {
      var tc = statN(p, 'thousandCuts');
      if (tc > 0) c.enemies.forEach(function (e, i) { if (e.alive) dealToEnemy(e, i, tc, { noCrit: true, noWeak: true }); });
      var ai = statN(p, 'afterImage');
      if (ai > 0) gainBlock(ai);
      // crit payoffs (Omega Visor / Targeting Matrix), once per critting card
      if (crit) {
        var cdr = art('critDraw'); if (cdr > 0) drawCards(cdr);
        var cst = art('critStr'); if (cst > 0) { addStatus(p, 'str', cst); emit('status', { who: 'player', s: 'str', v: cst }); }
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

    // route the played card: powers are consumed, exhaust cards (and skills
    // under Corruption) exhaust, everything else discards
    if (def.type === 'power') c.consumed.push(card);
    else if (def.exhaust || (def.type === 'skill' && statN(p, 'corruption') > 0)) exhaustCard(card);
    else c.discard.push(card);

    c.cardsThisTurn++;
    if (E.hasEcho('momentum_engine')) c.momentum = (c.momentum || 0) + 1; // each card buffs the next
    emit('cardPlayed', { id: card.id, crit: crit, roll: roll });
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

    // turret + entropy
    var tv = statN(p, 'turret');
    if (tv > 0 && !c.over) {
      var pool = aliveEnemies();
      if (pool.length) {
        var en = pick(pool);
        dealToEnemy(en, c.enemies.indexOf(en), tv + attr('tech'), { noCrit: true, noWeak: true });
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
        addStatus(en, 'burn', -B.status.burnTick);
        if (en.hp <= 0) {
          en.alive = false; r.kills++;
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
      en.block = 0;
      var m = en.intent;
      emit('enemyMove', { idx: idx, move: m });
      if (m.t === 'attack' || m.t === 'drain') {
        var dmg = scaledDmg(m.d, s) + statN(en, 'str');
        if (statN(en, 'weak')) dmg = Math.floor(dmg * B.status.weakMult);
        var hits = m.hits || 1;
        var totalToPlayer = 0;
        for (var h = 0; h < hits; h++) {
          if (r.phase === 'dead') break;
          totalToPlayer += hurtPlayer(dmg);
          var th = statN(p, 'thorns') + art('thorns');
          if (th > 0 && en.alive) {
            dealToEnemy(en, idx, th, { noCrit: true, noWeak: true });
            if (!en.alive) break;
          }
        }
        if (m.t === 'drain' && en.alive) {
          en.hp = Math.min(en.maxHp, en.hp + dmg);
          emit('heal', { who: 'enemy', idx: idx, amount: dmg, hpAfter: en.hp });
        }
      } else if (m.t === 'block') {
        var bb = scaledDmg(m.b, s);
        if (m.all) c.enemies.forEach(function (e, i) { if (e.alive) { e.block += bb; emit('block', { who: 'enemy', idx: i, amount: e.block, blockAfter: e.block }); } });
        else { en.block += bb; emit('block', { who: 'enemy', idx: idx, amount: en.block, blockAfter: en.block }); }
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
          chooseIntent(ne);
          c.enemies.push(ne);
          emit('summon', { idx: c.enemies.length - 1 });
        }
      } else if (m.t === 'debuff') {
        addStatus(p, m.s, m.v);
        emit('status', { who: 'player', s: m.s, v: m.v });
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
      }
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

  // Legendary (rarity 4, boss pool) for boss/elite rewards.
  function rollLegendary() {
    var pool = Object.keys(ns.CARDS).filter(function (k) {
      var c = ns.CARDS[k];
      return c.rarity === 4 && c.pool === 'boss' && (c.cls === E.run.cls || c.cls === 'any');
    });
    return pool.length ? pick(pool) : null;
  }
  E.rollLegendary = rollLegendary;

  function randomArtifact(tier) {
    var pool = Object.keys(ns.ARTIFACTS).filter(function (k) {
      return ns.ARTIFACTS[k].tier === tier && E.run.artifacts.indexOf(k) < 0;
    });
    if (pool.length === 0) return null;
    return pick(pool);
  }
  E.randomArtifact = randomArtifact;

  function addArtifact(id) {
    var r = E.run;
    if (r.artifacts.indexOf(id) >= 0) return; // no duplicates
    r.artifacts.push(id);
    var a = ns.ARTIFACTS[id];
    if (a.k === 'maxHp') { r.maxHp += a.v; r.hp += a.v; }
    if (a.special === 'glassCannon') { var lose = Math.round(r.maxHp * 0.25); r.maxHp -= lose; r.hp = Math.min(r.hp, r.maxHp); }
    if (a.quest && !r.questDone[id]) r.quests[id] = r.quests[id] || 0;
    emit('artifact', { id: id });
  }
  E.addArtifact = addArtifact;

  function winCombat() {
    var r = E.run, kind = E.combat.kind, cc = E.combat;
    // quest credit: combats won without ever gaining Shield / without losing HP
    if (!cc.playedShield) questProgress('noShieldWin', 1);
    if (r.hp >= cc.startHp) questProgress('flawlessWin', 1);

    // The finale: beating THE UNMAKER wins the run.
    if (cc.isFinal) {
      r.won = true;
      E.recordBest();
      r.phase = 'victory';
      emit('win', { kind: 'final', credits: 0 });
      E.save();
      return;
    }

    var credits = creditRange(kind);
    r.credits += credits;
    questProgress('creditsAtOnce', r.credits);
    var hb = art('healAfterCombat');
    if (hb > 0) heal(hb);
    var rareBoost = (kind === 'elite' || kind === 'boss') ? B.rewards.eliteRareChance : 0;
    var cards = [], seen = {};
    // Salvage Doctrine forgoes card rewards (the deck grows from kills instead)
    if (!E.hasEcho('salvage_doctrine')) {
      for (var i = 0; i < B.rewards.cardChoices; i++) {
        var cid = rollRewardCard(rareBoost), guard = 0;
        while (seen[cid] && guard++ < 20) cid = rollRewardCard(rareBoost);
        seen[cid] = true;
        cards.push(cid);
      }
      // bosses always offer a legendary; elites sometimes do
      if (cards.length && (kind === 'boss' || (kind === 'elite' && rnd() < 0.4))) {
        var leg = rollLegendary();
        if (leg) cards[0] = leg;
      }
    }
    var artifactDrop = (kind === 'elite') ? randomArtifact(1) : null;
    if (artifactDrop) addArtifact(artifactDrop);
    // The Unmaker's Tithe: an extra relic from every elite & boss
    var bonusArtifact = null;
    if (E.hasEcho('unmaker_tithe') && (kind === 'elite' || kind === 'boss')) {
      bonusArtifact = randomArtifact(1);
      if (bonusArtifact) addArtifact(bonusArtifact);
    }
    var dropP = (kind === 'boss') ? B.potions.bossDropChance : B.potions.dropChance;
    var potionDrop = (rnd() < dropP) ? rollPotion() : null;
    r.reward = { credits: credits, cards: cards, artifact: artifactDrop, bonusArtifact: bonusArtifact, potion: potionDrop, potionTaken: false, cardTaken: false, kind: kind };
    r.phase = 'reward';
    emit('win', { kind: kind, credits: credits });
    E.save();
  }

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
    r.hp = c.hp; r.maxHp = c.hp;
    r.attrs = { might: c.might, tech: c.tech, psi: c.psi };
    if (E.hasEcho('ascendant_core')) r.attrs[CLASS_STAT[clsId]] += 2; // legacy stat
    r.credits = B.player.startCredits;
    r.deck = ns.STARTER_DECKS[clsId].map(function (id) { return mkCard(id, false); });
    r.artifacts = [];
    r.sector = 1;
    r.faction = pick(Object.keys(ns.FACTIONS));
    r.map = generateMap(1);
    r.mapRow = -1; r.mapCol = 0;
    r.usedEvents = [];
    r.removeCost = B.shop.removeCost;
    r.quests = {}; r.questDone = {};
    r.augments = []; r.augmentDeckop = null; r.augmentOffer = null;
    r.potions = [];
    r.phylacteryUsed = false; r.salvageKills = 0;
    r.reward = null; r.shop = null; r.bossArtifacts = null; r.treasure = null;
    r.pendingPick = null; r.pendingAddCard = null; r.echoOffer = null;
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
    if (r.pendingPick || r.pendingAddCard || r.pendingRelic) return; // resolve pending choices first
    r.eventResult = null;
    r.currentEvent = null;
    nodeComplete();
  };

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

  /* ---------------- Shop --------------------------------------------------- */
  function buildShop() {
    var r = E.run;
    var cards = [], seen = {};
    for (var i = 0; i < 3; i++) {
      var cid = rollRewardCard(0.06), guard = 0;
      while (seen[cid] && guard++ < 20) cid = rollRewardCard(0.06);
      seen[cid] = true;
      cards.push({ id: cid, cost: B.shop.cardCost[ns.CARDS[cid].rarity] || 35, sold: false });
    }
    var aid = randomArtifact(1);
    var pid = (rnd() < B.potions.shopChance) ? rollPotion() : null;
    r.shop = {
      cards: cards,
      artifact: aid ? { id: aid, cost: B.shop.artifactCost, sold: false } : null,
      potion: pid ? { id: pid, cost: B.potions.shopCost[ns.POTIONS[pid].rarity] || 40, sold: false } : null,
      healUsed: false,
      removeUsed: false,
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
