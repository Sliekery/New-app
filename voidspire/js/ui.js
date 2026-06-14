/* =========================================================================
 * VOIDSPIRE — ui.js
 * DOM screens, one-finger combat interaction, action timeline playback.
 * ========================================================================= */
(function (ns) {
  'use strict';

  var U = {};
  ns.ui = U;
  var E = ns.engine;
  var R = ns.render;
  var B = ns.BALANCE;

  var $hud, $hand, $controls, $overlay, $floaters, $toast, $energy, $hint, $counts, $game;
  var selected = -1;        // selected hand index
  var targeting = false;
  var locked = false;       // input lock while timeline plays
  var toastTimer = null;

  /* ====================== tiny synth ====================== */
  var AC = null, muted = false;
  function audio() {
    if (muted) return null;
    if (!AC) {
      try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { muted = true; return null; }
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function beep(freq, dur, type, vol, slide) {
    var ac = audio();
    if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.04, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
  }
  var SFX = {
    tap: function () { beep(660, 0.05, 'square', 0.025); },
    play: function () { beep(440, 0.08, 'square', 0.035, 220); },
    hit: function () { beep(140, 0.12, 'sawtooth', 0.05, -60); },
    crit: function () { beep(880, 0.18, 'square', 0.05, -440); },
    block: function () { beep(520, 0.08, 'triangle', 0.045); },
    hurt: function () { beep(90, 0.2, 'sawtooth', 0.06, -40); },
    heal: function () { beep(520, 0.12, 'sine', 0.05, 260); },
    win: function () { beep(523, 0.1, 'square', 0.04); setTimeout(function () { beep(659, 0.1, 'square', 0.04); }, 110); setTimeout(function () { beep(784, 0.22, 'square', 0.05); }, 220); },
    lose: function () { beep(220, 0.3, 'sawtooth', 0.05, -160); },
    dice: function () { beep(330 + Math.random() * 300, 0.03, 'square', 0.02); },
    coin: function () { beep(988, 0.06, 'square', 0.03); setTimeout(function () { beep(1319, 0.1, 'square', 0.03); }, 60); },
    talk: function () { beep(700 + Math.random() * 380, 0.025, 'square', 0.012); },
  };

  /* ====================== vector art -> inline SVG ====================== */
  // Same polyline format as enemies: {p:[[x,y,...]], e:[[x,y]], m:[x,y,...]}
  function artSVG(art, cls, color) {
    function pts(arr) {
      var o = [];
      for (var i = 0; i < arr.length; i += 2) {
        o.push(((arr[i] + 1.2) * 10).toFixed(2) + ',' + ((arr[i + 1] + 1.2) * 10).toFixed(2));
      }
      return o.join(' ');
    }
    var out = '<svg class="vec' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24"' +
      (color ? ' style="color:' + color + '"' : '') + '>';
    art.p.forEach(function (p) { out += '<polyline points="' + pts(p) + '"/>'; });
    (art.e || []).forEach(function (e) {
      out += '<circle class="eye" cx="' + ((e[0] + 1.2) * 10).toFixed(2) + '" cy="' + ((e[1] + 1.2) * 10).toFixed(2) + '" r="0.6"/>';
    });
    if (art.m) out += '<polyline class="mouth" points="' + pts(art.m) + '"/>';
    return out + '</svg>';
  }

  /* ====================== typewriter ====================== */
  var typerIv = null;
  // Types text into elm; returns a finish() that completes it instantly.
  function typeText(elm, text, done) {
    clearInterval(typerIv);
    var i = 0, ticks = 0;
    elm.textContent = '';
    function finish() {
      if (!typerIv) return;
      clearInterval(typerIv);
      typerIv = null;
      elm.textContent = text;
      if (done) done();
    }
    typerIv = setInterval(function () {
      i += 2;
      elm.textContent = text.slice(0, i);
      if (ticks++ % 3 === 0) SFX.talk();
      if (i >= text.length) finish();
    }, 26);
    return finish;
  }
  function typing() { return !!typerIv; }

  /* ====================== helpers ====================== */
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function toast(msg, ms) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $toast.classList.remove('show'); }, ms || 1600);
  }
  U.toast = toast;

  function floater(x, y, text, cls, delay) {
    setTimeout(function () {
      var f = el('div', 'floater' + (cls ? ' ' + cls : ''), esc(text));
      f.style.left = x + 'px';
      f.style.top = y + 'px';
      $floaters.appendChild(f);
      setTimeout(function () { f.remove(); }, B.feel.floaterLife + 100);
    }, delay || 0);
  }

  /* ====================== init ====================== */
  U.init = function () {
    $game = document.getElementById('game');
    $hud = document.getElementById('hud');
    $hand = document.getElementById('hand');
    $controls = document.getElementById('combat-controls');
    $overlay = document.getElementById('overlay');
    $floaters = document.getElementById('floaters');
    $toast = document.getElementById('toast');

    $energy = el('div', '', '');
    $energy.id = 'energy-pip';
    $game.appendChild($energy);

    $counts = el('div', '', '');
    $counts.id = 'deck-counts';
    $game.appendChild($counts);

    $hint = el('div', '', 'DROP ON A TARGET');
    $hint.id = 'target-hint';
    $hint.style.display = 'none';
    $game.appendChild($hint);

    document.getElementById('battlefield').addEventListener('pointerdown', onFieldTap);
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('pointercancel', onDragCancel);

    // global listener for quest completions (can fire any time)
    E.onEvent = function (e) {
      if (e.type === 'questDone') {
        var a = ns.ARTIFACTS[e.id];
        toast('QUEST COMPLETE — ' + a.name.toUpperCase() + '!  ' + a.doneDesc, 3400);
        SFX.win();
      }
    };
    U.refresh();
  };

  // Tooltip text for an artifact chip, including live quest progress.
  function artifactTip(id) {
    var a = ns.ARTIFACTS[id];
    if (a.quest) {
      var qs = E.questState(id);
      if (qs.done) return a.name + ' ✓ COMPLETE — ' + a.doneDesc;
      return a.name + ' — QUEST ' + qs.progress + '/' + qs.goal + ': ' + a.quest.label;
    }
    return a.name + ' — ' + a.desc;
  }

  /* ====================== phase router ====================== */
  U.refresh = function () {
    var r = E.run;
    selected = -1;
    setTargeting(false);
    if (!r) return showTitle();
    switch (r.phase) {
      case 'combat': return showCombat();
      case 'map': return showMap();
      case 'treasure': return showTreasure();
      case 'reward': return showReward();
      case 'event': return showEvent();
      case 'event-result': return showEventResult(false);
      case 'shop': return showShop();
      case 'rest': return showRest();
      case 'levelup': return showLevelUp();
      case 'boss-artifact': return showBossArtifact();
      case 'sector-intro': return showSectorIntro();
      case 'dead': return showGameOver();
      default: return showTitle();
    }
  };

  function overlayScreen(clear) {
    $overlay.innerHTML = '';
    $overlay.classList.add('active');
    combatChrome(false);
    var s = el('div', 'screen' + (clear ? ' clear' : ''));
    $overlay.appendChild(s);
    // cascade-in for whatever the caller builds next
    setTimeout(function () {
      var kids = s.querySelectorAll('.panel-btn, .card-grid .card');
      for (var i = 0; i < kids.length; i++) {
        kids[i].style.setProperty('--d', Math.min(i * 55, 440) + 'ms');
      }
    }, 0);
    return s;
  }
  function hideOverlay() {
    $overlay.classList.remove('active');
    $overlay.innerHTML = '';
  }
  function combatChrome(on) {
    $hand.style.display = on ? 'flex' : 'none';
    $controls.style.display = on ? 'flex' : 'none';
    $energy.style.display = on ? 'block' : 'none';
    $counts.style.display = on ? 'block' : 'none';
    if (!on) $hint.style.display = 'none';
    R.combatVisible = on;
  }

  /* ====================== HUD ====================== */
  function updateHUD() {
    var r = E.run;
    if (!r) { $hud.innerHTML = ''; return; }
    var c = E.combat;
    var fac = ns.FACTIONS[r.faction];
    var hpPct = Math.max(0, r.hp / r.maxHp);

    var html = '<div class="row">' +
      '<div class="hp-wrap"><div class="hp-bar">' +
      '<div class="hp-fill" style="transform:scaleX(' + hpPct.toFixed(3) + ')"></div>' +
      '<div class="hp-text">' + Math.max(0, r.hp) + ' / ' + r.maxHp + '</div>' +
      '</div></div>';
    if (c && c.player.block > 0) html += '<div class="shield-chip">⬡' + c.player.block + '</div>';
    html += '<div class="stat"><b>¢' + r.credits + '</b></div>' +
      '</div>' +
      '<div class="row2">' +
      '<span class="attr">MGT <b>' + E.attr('might') + '</b></span>' +
      '<span class="attr">TEC <b>' + E.attr('tech') + '</b></span>' +
      '<span class="attr">PSI <b>' + E.attr('psi') + '</b></span>' +
      '<span class="attr" style="color:' + fac.color + '">S' + r.sector + ' ▴' + Math.max(0, r.mapRow + 1) + '/' + (B.map.rows + 1) + '</span>' +
      '<span class="spacer"></span>' +
      '<button class="icon-btn" data-act="deck">DECK ' + r.deck.length + '</button>' +
      '<button class="icon-btn" data-act="menu">≡</button>' +
      '</div>';

    if (r.artifacts.length) {
      html += '<div class="artifact-row">';
      r.artifacts.forEach(function (id, i) {
        var a = ns.ARTIFACTS[id], cls = 'artifact-chip';
        if (a.quest) {
          var qs = E.questState(id);
          cls += qs.done ? ' quest-done' : ' quest';
        }
        html += '<div class="' + cls + '" data-art="' + i + '">' + artSVG(a.art, 'art-icon') + '</div>';
      });
      html += '</div>';
    }

    if (c) {
      var st = c.player.statuses, chips = '';
      Object.keys(st).forEach(function (k) {
        if (st[k] <= 0) return;
        var bad = (k === 'vuln' || k === 'weak' || k === 'burn');
        chips += '<span class="status-chip ' + (bad ? 'debuff' : 'buff') + '">' + esc(ns.STATUS_NAMES[k] || k) + ' ' + st[k] + '</span>';
      });
      if (chips) html += '<div class="status-row">' + chips + '</div>';
    }

    $hud.innerHTML = html;

    $hud.querySelectorAll('[data-art]').forEach(function (chip) {
      chip.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation();
        toast(artifactTip(r.artifacts[+chip.dataset.art]), 2800);
      });
    });
    var deckBtn = $hud.querySelector('[data-act="deck"]');
    if (deckBtn) deckBtn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); showDeckModal(); });
    var menuBtn = $hud.querySelector('[data-act="menu"]');
    if (menuBtn) menuBtn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); showMenu(); });
  }
  U.updateHUD = updateHUD;

  /* ====================== TITLE ====================== */
  var CLASS_INFO = {
    vanguard: { name: 'VANGUARD', tag: 'Shock trooper of the 9th Voidborne', desc: 'High HP. Brutal weapons that scale with MIGHT. Hits first, asks never.' },
    technomancer: { name: 'TECHNOMANCER', tag: 'Machine-priest of the Forge Choir', desc: 'Shields, turrets and reactors that scale with TECH. Out-build the enemy.' },
    voidadept: { name: 'VOID ADEPT', tag: 'Sanctioned psyker, mostly stable', desc: 'Burns, hexes and psionic blasts that scale with PSI. The void answers.' },
  };

  function showTitle() {
    combatChrome(false);
    $hud.innerHTML = '';
    var s = overlayScreen();
    s.appendChild(el('div', 'title-logo', 'VOIDSPIRE'));
    s.appendChild(el('div', 'subtitle', 'AN ENDLESS DESCENT · TACTICAL CARD PROTOCOL'));

    if (E.hasSave()) {
      var cont = el('div', 'panel-btn', '<div class="pb-title">▶ CONTINUE RUN</div><div class="pb-sub">Resume your descent</div>');
      cont.addEventListener('pointerdown', function () {
        SFX.tap();
        if (E.load()) U.refresh();
        else { toast('SAVE CORRUPTED'); E.clearSave(); showTitle(); }
      });
      s.appendChild(cont);
    }

    Object.keys(CLASS_INFO).forEach(function (cls) {
      var ci = CLASS_INFO[cls], cc = B.classes[cls];
      var stats = cc.hp + ' HP · MGT ' + cc.might + ' · TEC ' + cc.tech + ' · PSI ' + cc.psi;
      var btn = el('div', 'panel-btn' + (cls === 'technomancer' ? ' cyan' : cls === 'voidadept' ? ' magenta' : ''),
        '<div class="pb-title">' + ci.name + '</div>' +
        '<div class="pb-sub">' + esc(ci.tag) + ' · ' + stats + '</div>' +
        '<div class="pb-desc">' + esc(ci.desc) + '</div>');
      btn.addEventListener('pointerdown', function () {
        SFX.play();
        E.clearSave();
        E.newRun(cls);
        U.refresh();
      });
      s.appendChild(btn);
    });

    var best = E.getBest();
    var foot = 'TAP A CLASS TO DEPLOY · SWIPE CARDS UP TO PLAY THEM';
    if (best) foot = 'BEST: SECTOR ' + best.sector + ' · SCORE ' + best.score + '<br><br>' + foot;
    s.appendChild(el('div', 'footer-note', foot));
  }

  /* ====================== STAR-CHART MAP ====================== */
  var NODE_LABEL = {
    fight: 'Hostile contact', elite: 'Mini-boss (elite)', boss: 'Sector boss',
    event: 'Unknown signal', random: 'Uncharted', shop: 'Free trader',
    rest: 'Field camp', treasure: 'Supply cache',
  };
  var NODE_DESC = {
    fight: 'A standard enemy pack. Salvage and a card reward on victory.',
    elite: 'A dangerous mini-boss — but it drops a relic.',
    boss: 'The sector boss. Beat it to level up and jump onward.',
    event: 'An unknown signal: a decision with consequences.',
    random: 'Uncharted space. Could be anything.',
    shop: 'A trader. Spend credits on cards, relics and repairs.',
    rest: 'A quiet camp. Heal up, or refine a card.',
    treasure: 'A sealed cache holding a free relic.',
  };

  function mapJit(row, col, axis) { return ((row * 13 + col * 7 + axis * 5) % 7 - 3) * 4; }

  function mapIconPaths(icon, cx, cy, s) {
    var out = '';
    icon.p.forEach(function (poly) {
      var pts = [];
      for (var i = 0; i < poly.length; i += 2) pts.push((cx + poly[i] * s).toFixed(1) + ',' + (cy + poly[i + 1] * s).toFixed(1));
      out += '<polyline points="' + pts.join(' ') + '"/>';
    });
    (icon.e || []).forEach(function (e) {
      out += '<circle class="gdot" cx="' + (cx + e[0] * s).toFixed(1) + '" cy="' + (cy + e[1] * s).toFixed(1) + '" r="' + (s * 0.12).toFixed(1) + '"/>';
    });
    return out;
  }

  // pointy-top hexagon frame
  function hexPts(cx, cy, r) {
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 6 + i * Math.PI / 3;
      pts.push((cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1));
    }
    return pts.join(' ');
  }

  // four corner brackets (a targeting reticle) around a node
  function cornerTicks(cx, cy, r) {
    var c = r * 0.42;
    var segs = [
      [[cx - r, cy - r + c], [cx - r, cy - r], [cx - r + c, cy - r]],
      [[cx + r - c, cy - r], [cx + r, cy - r], [cx + r, cy - r + c]],
      [[cx + r, cy + r - c], [cx + r, cy + r], [cx + r - c, cy + r]],
      [[cx - r + c, cy + r], [cx - r, cy + r], [cx - r, cy + r - c]],
    ];
    return '<g class="ticks">' + segs.map(function (seg) {
      return '<polyline points="' + seg.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
    }).join('') + '</g>';
  }

  function showMap() {
    updateHUD();
    var r = E.run, m = r.map;
    var s = overlayScreen(true);
    s.classList.add('map-screen');
    s.appendChild(el('h2', 'screen-title', 'Sector ' + r.sector + ' · Star Chart'));
    var started = r.mapRow >= 0;
    s.appendChild(el('div', 'screen-sub', esc(ns.FACTIONS[r.faction].name.toUpperCase()) + ' TERRITORY · ' + (started ? 'CHOOSE THE NEXT JUMP' : 'CHOOSE YOUR ENTRY POINT')));

    var COLS = m.COLS, ROWS = m.ROWS, cellW = 100, rowH = 106;
    var W = COLS * cellW, H = (ROWS + 1) * rowH;
    var reach = E.mapReachable(), cur = E.currentNode();

    function cx(col) { return (col + 0.5) * cellW; }
    function xy(node) { return { x: cx(node.col) + mapJit(node.row, node.col, 0), y: H - (node.row + 0.5) * rowH + mapJit(node.row, node.col, 1) }; }
    function targetOf(node, tc) {
      if (tc === 'boss') return m.boss;
      var nr = m.rows[node.row + 1];
      for (var i = 0; i < nr.length; i++) if (nr[i].col === tc) return nr[i];
      return null;
    }

    var svg = '<svg class="starchart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMin meet">';
    // edges (drawn as glowing flight paths with a midpoint waypoint tick)
    for (var ri = 0; ri < ROWS; ri++) {
      m.rows[ri].forEach(function (node) {
        node.edges.forEach(function (tc) {
          var t = targetOf(node, tc); if (!t) return;
          var a = xy(node), b = xy(t);
          var cls = (node === cur && reach.indexOf(t) >= 0) ? 'live' : (node.visited && t.visited) ? 'trav' : 'dim';
          svg += '<line class="edge ' + cls + '" x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '"/>';
          if (cls !== 'dim') {
            var mx = ((a.x + b.x) / 2).toFixed(1), my = ((a.y + b.y) / 2).toFixed(1);
            svg += '<circle class="waypt ' + cls + '" cx="' + mx + '" cy="' + my + '" r="1.8"/>';
          }
        });
      });
    }
    // nodes (glowing hex frames with reticle brackets on reachable ones)
    function nodeMarkup(node) {
      var p = xy(node), icon = ns.MAP_ICONS[node.type] || ns.MAP_ICONS.fight;
      var isBoss = node.type === 'boss';
      var hexR = isBoss ? 29 : 20, size = isBoss ? 24 : 15;
      var reachable = reach.indexOf(node) >= 0;
      var state = node === cur ? 'current' : node.visited ? 'visited' : reachable ? 'reachable' : 'locked';
      var g = '<g class="mapnode ' + state + ' nt-' + node.type + '" data-row="' + node.row + '" data-col="' + node.col + '" style="--nc:' + icon.color + '">';
      if (reachable) {
        g += '<circle class="pulse" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + hexR + '"/>';
        g += '<circle class="pulse p2" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + hexR + '"/>';
      }
      g += '<polygon class="hexfill" points="' + hexPts(p.x, p.y, hexR) + '"/>';
      g += '<polygon class="hex" points="' + hexPts(p.x, p.y, hexR) + '"/>';
      if (isBoss) g += '<polygon class="hex2" points="' + hexPts(p.x, p.y, hexR + 5) + '"/>';
      g += '<g class="glyph">' + mapIconPaths(icon, p.x, p.y, size) + '</g>';
      if (reachable) g += cornerTicks(p.x, p.y, hexR + 5);
      g += '<circle class="hit" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (hexR + 10) + '"/>';
      return g + '</g>';
    }
    m.rows.forEach(function (row) { row.forEach(function (n) { svg += nodeMarkup(n); }); });
    svg += nodeMarkup(m.boss);
    svg += '</svg>';

    var wrap = el('div', 'map-wrap');
    wrap.innerHTML = svg;
    s.appendChild(wrap);

    var legend = el('div', 'map-legend');
    ['fight', 'elite', 'event', 'random', 'shop', 'rest', 'treasure', 'boss'].forEach(function (t) {
      var ic = ns.MAP_ICONS[t];
      legend.innerHTML += '<span class="leg"><span class="leg-ic" style="color:' + ic.color + '">' +
        '<svg viewBox="0 0 48 48">' + mapIconPaths(ic, 24, 24, 17) + '</svg></span>' + esc(NODE_LABEL[t]) + '</span>';
    });
    s.appendChild(legend);

    wrap.addEventListener('pointerdown', function (ev) {
      var g = ev.target.closest ? ev.target.closest('.mapnode') : null;
      if (!g || !g.classList.contains('reachable')) return;
      var row = +g.getAttribute('data-row'), col = +g.getAttribute('data-col');
      var node = (row >= m.ROWS) ? m.boss : null;
      if (!node) { m.rows[row].forEach(function (n) { if (n.col === col) node = n; }); }
      if (node && E.enterNode(node)) { SFX.play(); U.refresh(); }
    });

    // scroll so the active frontier is in view (bottom on entry, current node later)
    setTimeout(function () {
      var svgEl = wrap.querySelector('svg');
      if (!svgEl) return;
      var rect = svgEl.getBoundingClientRect();
      var scale = rect.height / H;
      var focusY = cur ? xy(cur).y * scale : H * scale;
      wrap.scrollTop = Math.max(0, focusY - wrap.clientHeight * 0.62);
    }, 0);
  }

  /* ====================== TREASURE ====================== */
  function showTreasure() {
    updateHUD();
    var r = E.run;
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Supply Cache'));
    s.appendChild(el('div', 'screen-sub', 'A SEALED CACHE, LONG FORGOTTEN'));
    if (r.treasure) {
      var a = ns.ARTIFACTS[r.treasure];
      var fr = el('div', 'comm-frame');
      fr.innerHTML = artSVG(a.art, 'portrait', '#ffb02e');
      s.appendChild(fr);
      s.appendChild(el('div', 'gain-list', '<div>◆ ' + esc(a.name) + ' — ' + esc(a.desc) + '</div>'));
    } else {
      s.appendChild(el('div', 'gain-list', '<div>Relic vault already full — salvaged for +40 credits.</div>'));
    }
    var btn = el('button', 'btn', 'TAKE IT');
    btn.addEventListener('pointerdown', function () { SFX.coin(); E.finishTreasure(); U.refresh(); });
    s.appendChild(btn);
  }

  /* ====================== COMBAT ====================== */
  function showCombat() {
    hideOverlay();
    combatChrome(true);
    R.syncCombat();
    updateHUD();
    renderHand(true);
    renderControls();
    updateEnergy();
    updateCounts();
  }

  function renderControls() {
    $controls.innerHTML = '';
    var btn = el('button', 'btn', 'END TURN');
    btn.addEventListener('pointerdown', function () {
      if (locked || !E.combat || E.combat.over) return;
      SFX.tap();
      doEndTurn();
    });
    $controls.appendChild(btn);
  }

  function updateEnergy() {
    var c = E.combat;
    if (!c) return;
    $energy.textContent = '⚡ ' + c.energy;
  }

  function updateCounts() {
    var c = E.combat;
    if (!c) return;
    $counts.innerHTML = '<span>DRAW ' + c.drawPile.length + '</span><span>DISC ' + c.discard.length + '</span>' +
      (c.exhaust.length ? '<span>EXH ' + c.exhaust.length + '</span>' : '');
  }

  /* ---- shared card markup ---------------------------------------------- */
  var TYPE_ICONS = {
    attack: '<svg viewBox="0 0 14 14"><path d="M2 12 L9 3 L11 7 L6 12 Z"/><path d="M9 9 L12 12"/></svg>',
    skill: '<svg viewBox="0 0 14 14"><path d="M7 1 L12 4 L12 9 L7 13 L2 9 L2 4 Z"/><path d="M7 4 L7 10"/></svg>',
    power: '<svg viewBox="0 0 14 14"><path d="M2 8 L7 3 L12 8"/><path d="M2 12 L7 7 L12 12"/></svg>',
    curse: '<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5"/><path d="M4 4 L10 10 M10 4 L4 10"/></svg>',
  };

  function cardInner(name, cost, type, rarity, desc, unplayable) {
    var r = rarity === 3 ? 'r3' : rarity === 2 ? 'r2' : 'r1';
    return '<div class="cost">' + (unplayable ? '✕' : cost) + '</div>' +
      '<div class="cicon">' + (TYPE_ICONS[type] || '') + '</div>' +
      '<div class="cname">' + esc(name) + '</div>' +
      '<div class="rline ' + r + '"></div>' +
      '<div class="ctype">' + type + (rarity === 3 ? ' · rare' : rarity === 2 ? ' · unc' : '') + '</div>' +
      '<div class="cdesc">' + esc(desc) + '</div>';
  }

  function renderHand(deal) {
    $hand.innerHTML = '';
    var c = E.combat;
    if (!c) return;
    c.hand.forEach(function (card, i) {
      var info = E.cardInfo(card);
      var d = el('div', 'card type-' + info.type +
        (info.cost > c.energy && !info.unplayable ? ' unaffordable' : '') +
        (info.unplayable ? ' unplayable-curse' : '') +
        (deal ? ' deal' : '') +
        (i === selected ? ' selected' : ''));
      if (deal) d.style.setProperty('--d', (i * 60) + 'ms');
      d.innerHTML = cardInner(info.name, info.xcost ? 'X' : info.cost, info.type, info.rarity, info.desc, info.unplayable);
      d.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation();
        startCardDrag(d, i, ev);
      });
      $hand.appendChild(d);
    });
  }

  /* ---- swipe-to-play -------------------------------------------------- */
  // Swipe a card up to play it; drag it onto an enemy to choose the target.
  // A short tap (no movement) selects the card for reading instead.
  var drag = null; // {el, idx, info, x0, y0, dx, dy, moved}

  function startCardDrag(el, i, ev) {
    if (locked || drag || !E.combat || E.combat.over) return;
    var card = E.combat.hand[i];
    if (!card) return;
    drag = { el: el, idx: i, info: E.cardInfo(card), x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0, moved: false };
    if (el.setPointerCapture && ev.pointerId !== undefined) {
      try { el.setPointerCapture(ev.pointerId); } catch (e) { /* not supported */ }
    }
  }

  function onDragMove(ev) {
    if (!drag) return;
    drag.dx = ev.clientX - drag.x0;
    drag.dy = ev.clientY - drag.y0;
    if (!drag.moved && Math.abs(drag.dx) + Math.abs(drag.dy) > 9) {
      drag.moved = true;
      drag.el.classList.add('dragging');
      if (selected >= 0) { selected = -1; var s = $hand.querySelector('.card.selected'); if (s) s.classList.remove('selected'); }
      var multi = E.aliveEnemies().length > 1;
      if (drag.info.needsTarget && multi && !drag.info.unplayable) setTargeting(true);
    }
    if (drag.moved) {
      var lift = Math.min(0, drag.dy);
      drag.el.style.transform = 'translate(' + drag.dx + 'px,' + drag.dy + 'px) scale(' + (1 + Math.min(0.25, -lift / 400)) + ')';
      var armed = canDropPlay(ev);
      drag.el.classList.toggle('will-play', armed);
    }
  }

  function canDropPlay(ev) {
    if (!drag || !E.canPlay(drag.idx)) return false;
    var multi = E.aliveEnemies().length > 1;
    if (drag.info.needsTarget && multi) return enemyAtClient(ev) >= 0;
    return -drag.dy > B.feel.swipeThreshold || enemyAtClient(ev) >= 0;
  }

  function enemyAtClient(ev) {
    var rect = document.getElementById('battlefield').getBoundingClientRect();
    return R.enemyAt(ev.clientX - rect.left, ev.clientY - rect.top);
  }

  function onDragEnd(ev) {
    if (!drag) return;
    var d = drag;
    drag = null;
    d.el.classList.remove('dragging');
    d.el.classList.remove('will-play');
    d.el.style.transform = '';

    if (!d.moved) { cardTapped(d.idx); return; }

    if (locked || !E.combat || E.combat.over) { setTargeting(false); return; }

    var info = d.info;
    if (info.unplayable) { setTargeting(false); toast('UNPLAYABLE — a curse weighs down your deck'); return; }
    if (!E.canPlay(d.idx)) { setTargeting(false); toast('NOT ENOUGH ENERGY'); return; }

    var multi = E.aliveEnemies().length > 1;
    var tgt = enemyAtClient(ev);
    if (info.needsTarget && multi) {
      if (tgt >= 0) playCardAt(d.idx, tgt);
      else {
        setTargeting(false);
        if (-d.dy > B.feel.swipeThreshold) toast('DROP THE CARD ON A TARGET');
      }
    } else {
      if (tgt >= 0 || -d.dy > B.feel.swipeThreshold) playCardAt(d.idx, tgt);
      else setTargeting(false);
    }
  }

  function onDragCancel() {
    if (!drag) return;
    drag.el.classList.remove('dragging');
    drag.el.classList.remove('will-play');
    drag.el.style.transform = '';
    drag = null;
    setTargeting(false);
  }

  // tap = read the card (and arm it for tap-an-enemy targeting)
  function cardTapped(i) {
    if (locked || !E.combat || E.combat.over) return;
    var card = E.combat.hand[i];
    if (!card) return;
    var info = E.cardInfo(card);
    if (i === selected) { selected = -1; setTargeting(false); renderHand(); return; }
    SFX.tap();
    if (info.unplayable) toast('UNPLAYABLE — a curse weighs down your deck');
    selected = i;
    var multi = E.aliveEnemies().length > 1;
    setTargeting(!info.unplayable && info.cost <= E.combat.energy && info.needsTarget && multi);
    renderHand();
  }

  function setTargeting(on) {
    targeting = on;
    R.targeting = on;
    $hint.style.display = on ? 'block' : 'none';
  }

  function onFieldTap(ev) {
    if (locked) return;
    if (!E.combat || E.run.phase !== 'combat') return;
    var rect = ev.currentTarget.getBoundingClientRect();
    var x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    var idx = R.enemyAt(x, y);
    if (selected >= 0) {
      var si = selected;
      if (idx >= 0 && E.canPlay(si)) { selected = -1; playCardAt(si, idx); }
      else { selected = -1; setTargeting(false); renderHand(); }
    } else if (idx >= 0) {
      // inspect enemy
      var en = E.combat.enemies[idx];
      var ii = E.intentInfo(en);
      var what = { atk: 'attacking for ' + ii.label, drain: 'draining ' + ii.label + ' HP', block: 'shielding ' + ii.label, buff: 'powering up', debuff: 'hexing you', curse: 'corrupting your deck' }[ii.icon] || '...';
      toast(en.def.name + ' — intends: ' + what, 1800);
    }
  }

  function playCardAt(i, targetIdx) {
    setTargeting(false);
    if (i < 0 || !E.canPlay(i)) { renderHand(); return; }
    var wasAttack = ns.CARDS[E.combat.hand[i].id].type === 'attack';
    E.events.length = 0;
    var ok = E.playCard(i, targetIdx);
    if (!ok) { renderHand(); return; }
    SFX.play();
    if (wasAttack) R.playerLunge();
    var evts = E.events.slice();
    E.events.length = 0;
    lock(true);
    playTimeline(evts, 70, function () {
      lock(false);
      afterAction(false);
    });
    // hand & energy update immediately — feels snappy
    renderHand();
    updateEnergy();
    updateCounts();
    updateHUD();
  }

  function doEndTurn() {
    E.events.length = 0;
    E.endTurn();
    var evts = E.events.slice();
    E.events.length = 0;
    lock(true);
    $hand.innerHTML = '';
    playTimeline(evts, B.feel.enemyActDelay, function () {
      lock(false);
      R.refreshIntents();
      afterAction(true);
    });
  }

  function afterAction(deal) {
    var r = E.run;
    if (r.phase === 'dead') {
      SFX.lose();
      setTimeout(U.refresh, 700);
    } else if (r.phase === 'reward') {
      SFX.win();
      setTimeout(U.refresh, 650);
    } else if (r.phase === 'combat') {
      renderHand(deal);
      updateEnergy();
      updateCounts();
      updateHUD();
    } else {
      U.refresh();
    }
  }

  function lock(on) { locked = on; }

  /* ---- action timeline: replay engine events with cosmetic stagger ---- */
  function playTimeline(evts, stepDelay, done) {
    var delay = 0;
    var pp = R.playerXY();
    evts.forEach(function (e) {
      switch (e.type) {
        case 'enemyMove':
          delay += stepDelay;
          if (e.move && (e.move.t === 'attack' || e.move.t === 'drain')) {
            (function (e, d) {
              setTimeout(function () { R.enemyLunge(e.idx); }, d);
            })(e, delay);
          }
          break;
        case 'dmg':
          (function (e, d) {
            setTimeout(function () {
              if (e.who === 'enemy') {
                R.hitEnemy(e.idx);
                R.setEnemyView(e.idx, e.hpAfter, e.blockAfter);
                var pos = R.enemyPos(e.idx);
                var txt = e.hpDmg > 0 ? '-' + e.hpDmg : 'BLOCKED';
                if (e.burn) txt = '-' + e.hpDmg + ' BURN';
                floater(pos.x, pos.y - 20, txt, e.crit ? 'crit' : '');
                if (e.crit) SFX.crit(); else SFX.hit();
              } else {
                R.hitPlayer();
                R.setPlayerView(e.hpAfter, e.blockAfter);
                floater(pp.x + 30, pp.y - 30, e.hpDmg > 0 ? '-' + e.hpDmg : 'BLOCKED', '');
                SFX.hurt();
                updateHUD();
              }
            }, d);
          })(e, delay);
          delay += 90;
          break;
        case 'die':
          (function (e, d) {
            setTimeout(function () {
              R.setEnemyView(e.idx, 0, 0, false);
            }, d);
          })(e, delay);
          delay += 140;
          break;
        case 'block':
          (function (e, d) {
            setTimeout(function () {
              SFX.block();
              if (e.who === 'player') {
                R.setPlayerView(null, e.blockAfter);
                floater(pp.x + 26, pp.y - 24, '+' + e.amount + '⬡', 'block');
                updateHUD();
              } else {
                var v = R.views[e.idx];
                if (v) v.block = e.blockAfter;
                var pos = R.enemyPos(e.idx);
                floater(pos.x, pos.y - 18, '⬡', 'block');
              }
            }, d);
          })(e, delay);
          delay += 60;
          break;
        case 'heal':
          (function (e, d) {
            setTimeout(function () {
              SFX.heal();
              if (e.who === 'player') {
                R.setPlayerView(e.hpAfter, null);
                floater(pp.x + 26, pp.y - 24, '+' + e.amount, 'heal');
                updateHUD();
              } else {
                R.setEnemyView(e.idx, e.hpAfter);
                var pos = R.enemyPos(e.idx);
                floater(pos.x, pos.y - 18, '+' + e.amount, 'heal');
              }
            }, d);
          })(e, delay);
          delay += 60;
          break;
        case 'status':
          (function (e, d) {
            setTimeout(function () {
              var name = (ns.STATUS_NAMES[e.s] || e.s).toUpperCase();
              if (e.who === 'player') {
                floater(pp.x + 30, pp.y - 36, name + ' ' + e.v, 'status');
                updateHUD();
              } else {
                var pos = R.enemyPos(e.idx);
                floater(pos.x, pos.y - 26, name + ' ' + e.v, 'status');
              }
            }, d);
          })(e, delay);
          delay += 60;
          break;
        case 'curse':
          (function (e, d) {
            setTimeout(function () {
              toast('CURSE JAMS YOUR SYSTEMS THIS COMBAT: ' + ns.CARDS[e.card].name.toUpperCase(), 2000);
              floater(pp.x + 30, pp.y - 40, '✕ CURSED', 'status');
            }, d);
          })(e, delay);
          delay += 100;
          break;
        case 'cardPlayed':
          if (e.roll !== null && e.roll !== undefined) {
            (function (e, d) {
              setTimeout(function () {
                if (e.crit) floater(pp.x + 60, pp.y - 56, 'd20: ' + e.roll + ' CRIT!', 'crit');
                else floater(pp.x + 54, pp.y - 50, 'd20: ' + e.roll, 'roll');
              }, d);
            })(e, 0);
          }
          break;
        case 'win':
          (function (d) { setTimeout(function () { R.flash(); }, d); })(delay);
          delay += 250;
          break;
      }
    });
    setTimeout(done, delay + 220);
  }

  /* ====================== REWARD ====================== */
  function showReward() {
    updateHUD();
    var r = E.run;
    var rw = r.reward;
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', rw.kind === 'boss' ? 'Sector Boss Eliminated' : rw.kind === 'elite' ? 'Elite Eliminated' : 'Hostiles Eliminated'));
    var subParts = ['+' + rw.credits + ' CREDITS'];
    if (rw.artifact) subParts.push('RELIC: ' + ns.ARTIFACTS[rw.artifact].name.toUpperCase());
    s.appendChild(el('div', 'screen-sub', subParts.join(' · ')));
    if (rw.artifact) {
      var a = ns.ARTIFACTS[rw.artifact];
      s.appendChild(el('div', 'gain-list', '<div><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) + ' — ' + esc(a.desc) + '</div>'));
    }

    if (!rw.cardTaken) {
      s.appendChild(el('div', 'screen-sub', 'TAP A CARD TO PREVIEW · CONFIRM TO TAKE'));
      var grid = el('div', 'card-grid');
      var cbar = makeConfirmBar();
      rw.cards.forEach(function (cid, i) {
        var d = cardEl(cid, false);
        grid.appendChild(d);
        selectConfirm(grid, d, cbar, 'Take <b>' + esc(ns.CARDS[cid].name) + '</b> into your deck?',
          function () { E.takeRewardCard(i); E.finishReward(); U.refresh(); }, 'cyan');
      });
      s.appendChild(grid);
      var skip = el('button', 'btn dim small', 'SKIP CARD');
      skip.addEventListener('pointerdown', function () {
        SFX.tap();
        E.finishReward();
        U.refresh();
      });
      s.appendChild(skip);
      s.appendChild(cbar.el);
    } else {
      var btn = el('button', 'btn', 'CONTINUE');
      btn.addEventListener('pointerdown', function () { SFX.tap(); E.finishReward(); U.refresh(); });
      s.appendChild(btn);
    }
  }

  function cardEl(cid, up) {
    var def = ns.CARDS[cid];
    var ctx = E.run ? { attrs: { might: E.attr('might'), tech: E.attr('tech'), psi: E.attr('psi') }, statuses: null } : null;
    var d = el('div', 'card type-' + def.type);
    d.innerHTML = cardInner(def.name + (up ? '+' : ''), def.xcost ? 'X' : ns.cardCost(def, up), def.type, def.rarity,
      ns.cardDesc(def, up, ctx), def.unplayable);
    return d;
  }

  /* ====================== tap → preview → confirm ====================== */
  // A sticky confirm bar so no irreversible action is ever a single misclick.
  function makeConfirmBar() {
    var bar = el('div', 'confirm-bar');
    bar.innerHTML = '<div class="cb-msg"></div><div class="cb-actions">' +
      '<button class="btn small dim cb-cancel">CANCEL</button>' +
      '<button class="btn small cb-ok">CONFIRM</button></div>';
    var st = {};
    var api = {
      el: bar,
      show: function (msg, onOk, onCancel, okClass) {
        bar.querySelector('.cb-msg').innerHTML = msg;
        st.onOk = onOk; st.onCancel = onCancel;
        bar.querySelector('.cb-ok').className = 'btn small cb-ok' + (okClass ? ' ' + okClass : '');
        bar.classList.add('show');
      },
      hide: function () { bar.classList.remove('show'); st.onOk = st.onCancel = null; },
      shown: function () { return bar.classList.contains('show'); },
    };
    bar.querySelector('.cb-cancel').addEventListener('pointerdown', function (ev) {
      ev.stopPropagation(); SFX.tap(); var f = st.onCancel; api.hide(); if (f) f();
    });
    bar.querySelector('.cb-ok').addEventListener('pointerdown', function (ev) {
      ev.stopPropagation(); SFX.coin(); var f = st.onOk; api.hide(); if (f) f();
    });
    return api;
  }

  // Wire an element so a tap selects+previews it (arming the confirm bar);
  // tapping the already-selected element confirms (double-tap shortcut).
  function selectConfirm(container, elm, cbar, message, onConfirm, okClass, onSelect, onDeselect) {
    var selClass = elm.classList.contains('card') ? 'picked' : 'sel';
    elm._onDesel = onDeselect;
    elm.addEventListener('pointerdown', function (ev) {
      ev.stopPropagation();
      if (elm.classList.contains('disabled') || elm.classList.contains('sold')) return;
      if (elm.classList.contains(selClass)) { SFX.coin(); cbar.hide(); onConfirm(); return; }
      SFX.tap();
      Array.prototype.forEach.call(container.querySelectorAll('.picked, .sel'), function (e) {
        e.classList.remove('picked', 'sel'); if (e._onDesel) e._onDesel();
      });
      elm.classList.add(selClass);
      if (onSelect) onSelect();
      cbar.show(message, onConfirm, function () { elm.classList.remove(selClass); if (onDeselect) onDeselect(); }, okClass);
    });
  }

  /* ====================== EVENT ====================== */
  function showEvent() {
    updateHUD();
    var ev = E.getEvent();
    var s = overlayScreen();

    var frame = el('div', 'comm-frame talking');
    frame.innerHTML = artSVG(ev.art, 'portrait', ev.art.c) + '<div class="comm-scan"></div>';
    s.appendChild(frame);

    s.appendChild(el('h2', 'screen-title', esc(ev.title)));
    s.appendChild(el('div', 'screen-sub', 'INCOMING TRANSMISSION · SECTOR ' + E.run.sector));
    s.appendChild(resourceLine());

    var p = el('div', 'event-text');
    s.appendChild(p);
    var finish = typeText(p, ev.text, function () { frame.classList.remove('talking'); });
    // first tap anywhere completes the transmission instead of acting
    s.addEventListener('pointerdown', function (e2) {
      if (typing()) { finish(); e2.stopPropagation(); }
    }, true);

    ev.choices.forEach(function (ch, i) {
      if (!E.eventChoiceAvailable(ch)) return; // locked "blue option": hide it
      var poor = ch.cost && E.run.credits < ch.cost;
      var sub = ch.sub ? '<div class="pb-sub">' + esc(ch.sub) + '</div>' : '';
      var btn = el('div', 'panel-btn' + (poor ? ' disabled' : ''),
        '<div class="pb-title">' + esc(ch.label) + '</div>' + sub + choicePreviewHTML(ch));
      btn.addEventListener('pointerdown', function () {
        if (poor) { toast('NOT ENOUGH CREDITS'); return; }
        SFX.tap();
        var res = E.eventChoose(i);
        if (!res) return;
        if (E.run.phase === 'dead') { U.refresh(); return; }
        showEventResult(true);
      });
      s.appendChild(btn);
    });
  }

  // compact resource readout for overlay screens (events hide the HUD)
  function resourceLine() {
    var r = E.run;
    var d = el('div', 'res-line');
    d.innerHTML = '<span class="res-cr">¢ ' + r.credits + '</span>' +
      '<span class="res-hp">♥ ' + Math.max(0, r.hp) + ' / ' + r.maxHp + '</span>';
    return d;
  }

  // small reward/cost chips so a player can see what a choice does before taking it
  function fxChips(fx) {
    if (!fx) return '';
    var out = [];
    function chip(t, good) { out.push('<span class="fx-chip ' + (good ? 'good' : 'bad') + '">' + esc(t) + '</span>'); }
    if (fx.credits) chip((fx.credits > 0 ? '+' : '') + fx.credits + '¢', fx.credits > 0);
    if (fx.hp) chip((fx.hp > 0 ? '+' : '') + fx.hp + ' HP', fx.hp > 0);
    if (fx.healPct) chip('+' + Math.round(fx.healPct * 100) + '% HP', true);
    if (fx.maxhp) chip((fx.maxhp > 0 ? '+' : '') + fx.maxhp + ' Max HP', fx.maxhp > 0);
    if (fx.attr) chip('+1 ' + (fx.attr === 'random' ? 'ATTR' : fx.attr.toUpperCase()), true);
    if (fx.card) chip(fx.card === 'rare' ? 'Rare card' : 'Card', true);
    if (fx.addCardChoice) chip('Choose a card', true);
    if (fx.artifact) chip('Relic', true);
    if (fx.removeCurse) chip('Cleanse', true);
    if (fx.pick === 'remove') chip('Remove a card', true);
    if (fx.pick === 'upgrade') chip('Upgrade a card', true);
    if (fx.pick === 'dupe') chip('Duplicate a card', true);
    if (fx.curse) chip('Curse', false);
    return out.join('');
  }

  function choicePreviewHTML(ch) {
    var pre = '';
    if (ch.cost) pre += '<span class="fx-chip bad">−' + ch.cost + '¢</span>';
    if (ch.check) {
      var od = E.checkOdds(ch.check);
      pre += '<span class="fx-chip check">' + ch.check.attr.toUpperCase() + ' DC ' + ch.check.dc +
        ' · you +' + od.bonus + ' · ' + od.pct + '%</span>';
      var win = fxChips(ch.success && ch.success.fx), lose = fxChips(ch.fail && ch.fail.fx);
      if (win) pre += '<span class="pv-row">✓ ' + win + '</span>';
      if (lose) pre += '<span class="pv-row">✗ ' + lose + '</span>';
    } else if (ch.gamble) {
      pre += '<span class="fx-chip check">⚄ GAMBLE</span>';
      var seen = {}, gc = '';
      ch.gamble.forEach(function (g) {
        var c = fxChips(g.fx);
        if (c && !seen[c]) { seen[c] = 1; gc += c; }
      });
      if (gc) pre += '<span class="pv-row">? ' + gc + '</span>';
    } else if (ch.outcome) {
      var oc = fxChips(ch.outcome.fx);
      if (oc) pre += '<span class="pv-row">' + oc + '</span>';
    }
    return pre ? '<div class="pv">' + pre + '</div>' : '';
  }

  function showEventResult(animate) {
    updateHUD();
    var r = E.run;
    var res = r.eventResult;
    if (!res) { U.refresh(); return; }
    var s = overlayScreen();
    var ev = E.getEvent();
    if (ev && ev.art) {
      var mini = el('div', 'comm-frame mini');
      mini.innerHTML = artSVG(ev.art, 'portrait', ev.art.c) + '<div class="comm-scan"></div>';
      s.appendChild(mini);
    }
    s.appendChild(el('h2', 'screen-title', esc(ev ? ev.title : 'OUTCOME')));
    s.appendChild(resourceLine());

    var diceBox = null;
    if (res.roll !== null) {
      diceBox = el('div', 'dice-box', '');
      diceBox.innerHTML = '<span class="dc">' + (res.attr || '').toUpperCase() + ' CHECK · DC ' + res.dc + ' (+' + res.bonus + ')</span><span class="roll">—</span>';
      s.appendChild(diceBox);
    }

    var body = el('div', '', '');
    body.style.opacity = animate && diceBox ? '0' : '1';
    body.style.transition = 'opacity 0.3s';
    body.appendChild(el('div', 'event-text event-result-text', esc(res.text)));
    if (res.gained && res.gained.length) {
      var gl = el('div', 'gain-list');
      res.gained.forEach(function (g) { gl.appendChild(el('div', '', esc(g))); });
      body.appendChild(gl);
    }
    var btn = el('button', 'btn', 'CONTINUE');
    btn.addEventListener('pointerdown', function () {
      SFX.tap();
      if (r.pendingAddCard) {
        showEventAddCard(function () { E.finishEvent(); U.refresh(); });
      } else if (r.pendingPick) {
        showPickModal(r.pendingPick, function () { E.finishEvent(); U.refresh(); });
      } else {
        E.finishEvent();
        U.refresh();
      }
    });
    body.appendChild(btn);
    s.appendChild(body);

    if (diceBox && animate) {
      var rollSpan = diceBox.querySelector('.roll');
      var ticks = 0, max = 13;
      var iv = setInterval(function () {
        ticks++;
        SFX.dice();
        rollSpan.textContent = '' + (1 + Math.floor(Math.random() * 20));
        if (ticks >= max) {
          clearInterval(iv);
          rollSpan.textContent = res.roll + (res.bonus ? ' +' + res.bonus : '');
          diceBox.classList.add(res.pass ? 'pass' : 'fail');
          rollSpan.textContent += res.pass ? '  ✓' : '  ✗';
          if (res.pass) SFX.win(); else SFX.lose();
          body.style.opacity = '1';
        }
      }, 55);
    } else if (diceBox) {
      var rs = diceBox.querySelector('.roll');
      rs.textContent = res.roll + (res.bonus ? ' +' + res.bonus : '') + (res.pass ? '  ✓' : '  ✗');
      diceBox.classList.add(res.pass ? 'pass' : 'fail');
    }
  }

  /* ====================== PICK MODAL (remove/upgrade/dupe) ====================== */
  function showPickModal(type, onDone) {
    var r = E.run;
    var s = overlayScreen();
    var titles = { remove: 'Purge a Card', upgrade: 'Refine a Card', dupe: 'Duplicate a Card' };
    var verbs = { remove: 'Purge', upgrade: 'Refine', dupe: 'Duplicate' };
    var okClass = { remove: 'red', upgrade: 'amber', dupe: 'cyan' }[type] || '';
    s.appendChild(el('h2', 'screen-title', titles[type] || 'Choose a Card'));
    s.appendChild(el('div', 'screen-sub', 'TAP A CARD TO PREVIEW · CONFIRM TO ' + (verbs[type] || 'SELECT').toUpperCase()));
    var grid = el('div', 'card-grid');
    var cbar = makeConfirmBar();
    var any = false;
    r.deck.forEach(function (card, i) {
      var def = ns.CARDS[card.id];
      if (type === 'upgrade' && (card.up || def.type === 'curse')) return;
      if (type === 'dupe' && def.type === 'curse') return;
      any = true;
      var d = cardEl(card.id, card.up);
      grid.appendChild(d);
      var name = def.name;
      var msg, onSelect, onDeselect;
      if (type === 'remove') msg = 'Purge <b>' + esc(name) + '</b> from your deck? This is permanent.';
      else if (type === 'upgrade') {
        msg = 'Refine <b>' + esc(name) + '</b> into <b>' + esc(name) + '+</b>?';
        // preview: swap the card face to its upgraded version while selected
        var baseHTML = d.innerHTML;
        var upHTML = cardEl(card.id, true).innerHTML;
        onSelect = function () { d.innerHTML = upHTML; d.classList.add('preview-up'); };
        onDeselect = function () { d.innerHTML = baseHTML; d.classList.remove('preview-up'); };
      } else msg = 'Duplicate <b>' + esc(name) + '</b>?';
      selectConfirm(grid, d, cbar, msg, function () { E.applyPick(i); onDone(); }, okClass, onSelect, onDeselect);
    });
    s.appendChild(grid);
    if (!any) {
      E.cancelPick();
      s.appendChild(el('div', 'screen-sub', 'NO VALID CARDS'));
      var btn = el('button', 'btn dim', 'BACK');
      btn.addEventListener('pointerdown', function () { onDone(); });
      s.appendChild(btn);
    } else {
      s.appendChild(cbar.el);
    }
  }

  /* ====================== SHOP ====================== */
  function showShop() {
    updateHUD();
    var r = E.run;
    var sh = r.shop;
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Free Trader'));
    s.appendChild(el('div', 'screen-sub', '“EVERYTHING IS FOR SALE.” · ¢' + r.credits));
    var cbar = makeConfirmBar();

    var grid = el('div', 'card-grid');
    sh.cards.forEach(function (it, i) {
      var d = cardEl(it.id, false);
      d.appendChild(el('div', 'price', '¢' + it.cost));
      if (it.sold) { d.classList.add('sold'); grid.appendChild(d); return; }
      grid.appendChild(d);
      var afford = r.credits >= it.cost;
      selectConfirm(s, d, cbar,
        'Buy <b>' + esc(ns.CARDS[it.id].name) + '</b> for ¢' + it.cost + '?' + (afford ? '' : '<span class="cb-note">Not enough credits.</span>'),
        function () { if (E.shopBuyCard(i)) { SFX.coin(); showShop(); } else toast('NOT ENOUGH CREDITS'); }, 'cyan');
    });
    s.appendChild(grid);

    if (sh.artifact) {
      var a = ns.ARTIFACTS[sh.artifact.id];
      var ab = el('div', 'panel-btn amber' + (sh.artifact.sold ? ' disabled' : ''),
        '<div class="pb-title"><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) + ' — ¢' + sh.artifact.cost + '</div>' +
        '<div class="pb-desc">' + esc(a.desc) + '</div>');
      s.appendChild(ab);
      if (!sh.artifact.sold) {
        selectConfirm(s, ab, cbar, 'Buy relic <b>' + esc(a.name) + '</b> for ¢' + sh.artifact.cost + '?',
          function () { if (E.shopBuyArtifact()) { SFX.coin(); showShop(); } else toast('NOT ENOUGH CREDITS'); }, 'amber');
      }
    }

    var row = el('div', 'shop-row');
    var hb = el('button', 'btn cyan small' + (sh.healUsed || r.hp >= r.maxHp ? ' dim' : ''), 'REPAIR +' + B.shop.healAmount + ' HP · ¢' + B.shop.healCost);
    if (!sh.healUsed && r.hp < r.maxHp) {
      selectConfirm(s, hb, cbar, 'Repair <b>+' + B.shop.healAmount + ' HP</b> for ¢' + B.shop.healCost + '?',
        function () { if (E.shopBuyHeal()) { SFX.heal(); showShop(); } else toast('NOT ENOUGH CREDITS'); }, 'cyan');
    } else {
      hb.addEventListener('pointerdown', function () { toast(r.hp >= r.maxHp ? 'HULL ALREADY INTACT' : 'SOLD OUT'); });
    }
    row.appendChild(hb);

    var rb = el('button', 'btn red small' + (sh.removeUsed ? ' dim' : ''), 'PURGE A CARD · ¢' + r.removeCost);
    if (!sh.removeUsed) {
      selectConfirm(s, rb, cbar, 'Pay ¢' + r.removeCost + ' to purge a card from your deck?',
        function () { if (E.shopBuyRemove()) { showPickModal('remove', function () { showShop(); }); } else toast('NOT ENOUGH CREDITS'); }, 'red');
    } else {
      rb.addEventListener('pointerdown', function () { toast('SERVICE USED'); });
    }
    row.appendChild(rb);
    s.appendChild(row);

    var leave = el('button', 'btn', 'DEPART');
    leave.addEventListener('pointerdown', function () { SFX.tap(); E.leaveShop(); U.refresh(); });
    s.appendChild(leave);
    s.appendChild(cbar.el);
  }

  /* ====================== REST ====================== */
  function showRest() {
    updateHUD();
    var r = E.run;
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Field Camp'));
    s.appendChild(el('div', 'screen-sub', 'THE GUNS GO QUIET FOR A WHILE'));
    var cbar = makeConfirmBar();
    var healAmt = Math.round(r.maxHp * B.rewards.restHealPct);
    var h = el('div', 'panel-btn cyan',
      '<div class="pb-title">+ PATCH WOUNDS</div><div class="pb-desc">Heal ' + healAmt + ' HP (' + r.hp + ' → ' + Math.min(r.maxHp, r.hp + healAmt) + ')</div>');
    s.appendChild(h);
    selectConfirm(s, h, cbar, 'Patch wounds — heal <b>' + healAmt + ' HP</b>?',
      function () { SFX.heal(); E.restHeal(); U.refresh(); }, 'cyan');
    var u = el('div', 'panel-btn amber',
      '<div class="pb-title">▲ REFINE A CARD</div><div class="pb-desc">Permanently upgrade one card in your deck.</div>');
    s.appendChild(u);
    selectConfirm(s, u, cbar, 'Spend this camp refining a card?',
      function () {
        E.restUpgrade();
        showPickModal('upgrade', function () {
          if (E.run.pendingPick) { E.cancelPick(); showRest(); return; }
          E.nodeComplete();
          U.refresh();
        });
      }, 'amber');
    s.appendChild(cbar.el);
  }

  /* ====================== LEVEL UP: AUGMENT DRAFT ====================== */
  function showLevelUp() {
    updateHUD();
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Augment Protocol'));
    s.appendChild(el('div', 'screen-sub', 'BOSS PURGED · INSTALL ONE AUGMENT'));
    var cbar = makeConfirmBar();
    var rareClass = { 1: '', 2: 'cyan', 3: 'amber' };
    E.augmentChoices().forEach(function (id) {
      var info = E.augmentInfo(id);
      var pcls = info.kind === 'pact' ? 'panel-btn pact' : 'panel-btn ' + (rareClass[info.rarity] || '');
      var rarTag = info.rarity === 3 ? 'RARE' : info.rarity === 2 ? 'UNCOMMON' : 'COMMON';
      var btn = el('div', pcls,
        '<div class="pb-title">' + esc(info.name) + ' <span class="aug-tag">' + info.tag + '</span></div>' +
        '<div class="pb-desc">' + esc(info.desc) + '</div>' +
        '<div class="pb-sub">' + rarTag + (info.kind === 'deckop' ? ' · choose your cards next' : '') + '</div>');
      s.appendChild(btn);
      selectConfirm(s, btn, cbar, 'Install <b>' + esc(info.name) + '</b>?<span class="cb-note">' + esc(info.desc) + '</span>',
        function () {
          SFX.win();
          E.chooseAugment(id);
          if (E.run.augmentDeckop) runDeckop(E.run.augmentDeckop, function () { E.finishAugment(); U.refresh(); });
          else U.refresh();
        }, info.kind === 'pact' ? 'red' : '');
    });
    s.appendChild(cbar.el);
  }

  // Resolve a deck-operation augment (remove / upgrade 2 / add a card), then done()
  function runDeckop(op, done) {
    if (op === 'remove') {
      E.run.pendingPick = 'remove';
      showPickModal('remove', done);
    } else if (op === 'upgrade2') {
      E.run.pendingPick = 'upgrade';
      showPickModal('upgrade', function () {
        E.run.pendingPick = 'upgrade';
        showPickModal('upgrade', done);
      });
    } else if (op === 'addCard') {
      showAddCard(done);
    } else done();
  }

  function showAddCard(done) {
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Requisition'));
    s.appendChild(el('div', 'screen-sub', 'TAP A CARD TO PREVIEW · CONFIRM TO ADD'));
    var grid = el('div', 'card-grid');
    var cbar = makeConfirmBar();
    E.augmentAddOptions().forEach(function (cid) {
      var d = cardEl(cid, false);
      grid.appendChild(d);
      selectConfirm(grid, d, cbar, 'Add <b>' + esc(ns.CARDS[cid].name) + '</b> to your deck?',
        function () { E.augmentAddCard(cid); done(); }, 'cyan');
    });
    s.appendChild(grid);
    s.appendChild(cbar.el);
  }

  // card chooser for an event that grants "addCardChoice"
  function showEventAddCard(done) {
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Acquire a Card'));
    s.appendChild(el('div', 'screen-sub', 'TAP A CARD TO PREVIEW · CONFIRM TO ADD'));
    var grid = el('div', 'card-grid');
    var cbar = makeConfirmBar();
    (E.run.pendingAddCard || []).forEach(function (cid) {
      var d = cardEl(cid, false);
      grid.appendChild(d);
      selectConfirm(grid, d, cbar, 'Add <b>' + esc(ns.CARDS[cid].name) + '</b> to your deck?',
        function () { E.eventAddCard(cid); done(); }, 'cyan');
    });
    s.appendChild(grid);
    s.appendChild(cbar.el);
  }

  function showBossArtifact() {
    updateHUD();
    var r = E.run;
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Spoils of War'));
    s.appendChild(el('div', 'screen-sub', 'CLAIM ONE RELIC'));
    var cbar = makeConfirmBar();
    (r.bossArtifacts || []).forEach(function (id, i) {
      var a = ns.ARTIFACTS[id];
      var btn = el('div', 'panel-btn amber',
        '<div class="pb-title"><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) + '</div><div class="pb-desc">' + esc(a.desc) + '</div>');
      s.appendChild(btn);
      selectConfirm(s, btn, cbar, 'Claim <b>' + esc(a.name) + '</b>?<span class="cb-note">' + esc(a.desc) + '</span>',
        function () { SFX.coin(); E.takeBossArtifact(i); U.refresh(); }, 'amber');
    });
    s.appendChild(cbar.el);
    if (!r.bossArtifacts || !r.bossArtifacts.length) {
      var btn2 = el('button', 'btn', 'CONTINUE');
      btn2.addEventListener('pointerdown', function () { E.takeBossArtifact(-1); U.refresh(); });
      s.appendChild(btn2);
    }
  }

  function showSectorIntro() {
    updateHUD();
    var r = E.run;
    var fac = ns.FACTIONS[r.faction];
    var s = overlayScreen();
    s.appendChild(el('div', 'sector-banner', 'SECTOR ' + r.sector));
    var ft = el('div', 'faction-tag', esc(fac.name.toUpperCase()) + ' TERRITORY — ' + esc(fac.desc.toUpperCase()));
    ft.style.color = fac.color;
    s.appendChild(ft);
    s.appendChild(el('div', 'screen-sub', 'ENEMIES GROW STRONGER. SO DO YOU.'));
    var btn = el('button', 'btn', 'DESCEND');
    btn.addEventListener('pointerdown', function () { SFX.play(); E.beginSector(); U.refresh(); });
    s.appendChild(btn);
  }

  /* ====================== GAME OVER ====================== */
  function showGameOver() {
    combatChrome(false);
    var r = E.run;
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'Signal Lost'));
    s.appendChild(el('div', 'screen-sub', 'YOUR DESCENT ENDS IN SECTOR ' + r.sector));
    s.appendChild(el('div', 'big-score', E.score() + ' PTS'));
    var best = E.getBest();
    var lines = [
      'SECTOR REACHED: ' + r.sector,
      'NODES CLEARED: ' + r.nodesCleared,
      'KILLS: ' + r.kills,
      'RELICS: ' + r.artifacts.length,
    ];
    if (best) lines.push('', 'BEST: ' + best.score + ' PTS (SECTOR ' + best.sector + ')');
    var gl = el('div', 'gain-list');
    lines.forEach(function (l) { gl.appendChild(el('div', '', esc(l))); });
    s.appendChild(gl);
    var btn = el('button', 'btn', 'NEW DESCENT');
    btn.addEventListener('pointerdown', function () {
      SFX.tap();
      E.abandonRun();
      U.refresh();
    });
    s.appendChild(btn);
  }

  /* ====================== DECK & MENU MODALS ====================== */
  function showDeckModal() {
    var r = E.run;
    if (!r) return;
    var wasCombat = (r.phase === 'combat');
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'Your Deck (' + r.deck.length + ')'));
    var grid = el('div', 'card-grid');
    r.deck.slice().sort(function (a, b) {
      return ns.CARDS[a.id].cost - ns.CARDS[b.id].cost;
    }).forEach(function (card) {
      grid.appendChild(cardEl(card.id, card.up));
    });
    s.appendChild(grid);
    var btn = el('button', 'btn', 'CLOSE');
    btn.addEventListener('pointerdown', function () {
      SFX.tap();
      if (wasCombat) showCombat(); else U.refresh();
    });
    s.appendChild(btn);
  }

  function showMenu() {
    var r = E.run;
    var wasCombat = r && r.phase === 'combat';
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'VOIDSPIRE'));
    s.appendChild(el('div', 'screen-sub', 'SYSTEM MENU'));

    var resume = el('div', 'panel-btn', '<div class="pb-title">▶ RESUME</div>');
    resume.addEventListener('pointerdown', function () { SFX.tap(); if (wasCombat) showCombat(); else U.refresh(); });
    s.appendChild(resume);

    var mute = el('div', 'panel-btn cyan', '<div class="pb-title">' + (muted ? '◇ SOUND: OFF' : '◆ SOUND: ON') + '</div>');
    mute.addEventListener('pointerdown', function () { muted = !muted; showMenu(); });
    s.appendChild(mute);

    var help = el('div', 'panel-btn magenta', '<div class="pb-title">? FIELD MANUAL</div>');
    help.addEventListener('pointerdown', function () { SFX.tap(); showHelp(wasCombat); });
    s.appendChild(help);

    var abandon = el('div', 'panel-btn', '<div class="pb-title" style="color:var(--red)">✕ ABANDON RUN</div><div class="pb-sub">Progress will be lost</div>');
    var confirming = false;
    abandon.addEventListener('pointerdown', function () {
      if (!confirming) {
        confirming = true;
        abandon.querySelector('.pb-title').textContent = '✕ TAP AGAIN TO CONFIRM';
        return;
      }
      E.abandonRun();
      U.refresh();
    });
    s.appendChild(abandon);
  }

  function showHelp(wasCombat) {
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'Field Manual'));
    var txt =
      'SWIPE a card up to play it — or drag it onto an enemy to choose your target. TAP a card to read it first.\n\n' +
      'ENERGY (⚡) limits your plays each turn. Unspent SHIELD (⬡) blocks damage but expires.\n\n' +
      'd20: every attack rolls a die. A high roll is a CRIT for double damage.\n\n' +
      'MIGHT boosts weapons, TECH boosts shields & tech, PSI boosts psionics. Attributes also decide skill checks at events.\n\n' +
      'Beat a sector boss to LEVEL UP and claim a relic. The descent is endless — how deep can you go?';
    var p = el('div', 'event-text', '');
    p.style.whiteSpace = 'pre-line';
    p.textContent = txt;
    s.appendChild(p);
    var btn = el('button', 'btn', 'CLOSE');
    btn.addEventListener('pointerdown', function () { SFX.tap(); if (wasCombat) showCombat(); else showMenu(); });
    s.appendChild(btn);
  }

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
