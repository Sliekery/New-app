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

  var $hud, $hand, $controls, $overlay, $floaters, $toast, $energy, $hint, $counts, $game, $potions, $potionTip, $drawPile, $discardPile;
  var selected = -1;        // selected hand index
  var targeting = false;
  var locked = false;       // input lock while timeline plays
  var toastTimer = null;
  var orient = 'auto';  // 'auto' (fit to screen) | 'portrait' | 'landscape' (persisted)

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
  // 8-bit noise burst with an optional swept low-pass (explosions, sizzle, sweeps).
  function noise(dur, vol, f0, f1) {
    var ac = audio();
    if (!ac) return;
    var n = Math.max(1, Math.floor(ac.sampleRate * dur));
    var buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var src = ac.createBufferSource(); src.buffer = buf;
    var g = ac.createGain();
    g.gain.setValueAtTime(vol || 0.05, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    if (f0) {
      var bq = ac.createBiquadFilter(); bq.type = 'lowpass';
      bq.frequency.setValueAtTime(f0, ac.currentTime);
      bq.frequency.exponentialRampToValueAtTime(Math.max(60, f1 || f0), ac.currentTime + dur);
      src.connect(bq); bq.connect(g);
    } else src.connect(g);
    g.connect(ac.destination); src.start(); src.stop(ac.currentTime + dur);
  }
  // Stepped arpeggio — the classic chiptune "rising power-up" / cluster.
  function arp(freqs, step, dur, type, vol) {
    freqs.forEach(function (f, i) {
      setTimeout(function () { beep(f, dur || 0.07, type || 'square', vol || 0.035); }, i * (step || 45));
    });
  }
  // Fatter "synth" voice: detuned twin oscillator, optional vibrato + swept
  // low-pass, ADSR-ish envelope. Used for the meatier card sounds.
  function synth(freq, dur, type, vol, slide, opts) {
    var ac = audio(); if (!ac) return;
    opts = opts || {};
    var now = ac.currentTime, g = ac.createGain();
    var o = ac.createOscillator(); o.type = type || 'square'; o.frequency.setValueAtTime(freq, now);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(28, freq + slide), now + dur);
    var o2 = null;
    if (opts.detune) {
      o2 = ac.createOscillator(); o2.type = opts.type2 || o.type; o2.frequency.setValueAtTime(freq, now);
      o2.detune.setValueAtTime(opts.detune, now);
      if (slide) o2.frequency.exponentialRampToValueAtTime(Math.max(28, freq + slide), now + dur);
    }
    if (opts.vib) {
      var lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = opts.vibRate || 13; lg.gain.value = opts.vib;
      lfo.connect(lg); lg.connect(o.frequency); if (o2) lg.connect(o2.frequency);
      lfo.start(now); lfo.stop(now + dur);
    }
    var sink = g;
    if (opts.filter) {
      var bq = ac.createBiquadFilter(); bq.type = 'lowpass';
      bq.frequency.setValueAtTime(opts.filter[0], now); bq.frequency.exponentialRampToValueAtTime(Math.max(60, opts.filter[1]), now + dur);
      o.connect(bq); if (o2) o2.connect(bq); bq.connect(g); sink = g;
    } else { o.connect(g); if (o2) o2.connect(g); }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol || 0.04, now + (opts.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    g.connect(ac.destination);
    o.start(now); o.stop(now + dur); if (o2) { o2.start(now); o2.stop(now + dur); }
  }
  // Stable per-card pitch so two cards of the same motif still differ.
  function hashId(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function semiMul(seed, span) { return Math.pow(2, ((hashId(seed) % span) - Math.floor(span / 2)) / 12); }
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

    $drawPile = el('div', '', '<div class="pile-card"><span class="pile-n">0</span></div><div class="pile-lbl">DRAW</div>');
    $drawPile.id = 'draw-pile';
    $game.appendChild($drawPile);
    $discardPile = el('div', '', '<div class="pile-card"><span class="pile-n">0</span></div><div class="pile-lbl">DISC</div>');
    $discardPile.id = 'discard-pile';
    $game.appendChild($discardPile);
    $drawPile.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); if (E.combat && !locked) { SFX.tap(); showPileModal('draw'); } });
    $discardPile.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); if (E.combat && !locked) { SFX.tap(); showPileModal('discard'); } });

    $hint = el('div', '', 'DROP ON A TARGET');
    $hint.id = 'target-hint';
    $hint.style.display = 'none';
    $game.appendChild($hint);

    $potions = el('div', '', '');
    $potions.id = 'potion-belt';
    $game.appendChild($potions);

    $potionTip = el('div', '', '');
    $potionTip.id = 'potion-tip';
    $game.appendChild($potionTip);

    document.getElementById('battlefield').addEventListener('pointerdown', onFieldTap);
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('pointercancel', onDragCancel);

    // kick the synthwave bed off on the first user gesture (browsers require it)
    document.addEventListener('pointerdown', function startMusic() {
      if (!muted && ns.music) ns.music.start();
      document.removeEventListener('pointerdown', startMusic, true);
    }, true);

    loadOrient();
    applyOrient();

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

  /* ====================== display orientation ====================== */
  var lastLandscape = null;
  function loadOrient() {
    try {
      var v = window.localStorage && window.localStorage.getItem('voidspire_orient');
      if (v === 'landscape' || v === 'portrait' || v === 'auto') orient = v;
    } catch (e) { /* private mode */ }
  }
  // 'auto' picks the layout from the viewport's aspect ratio so the game fits
  // any screen (phone portrait, PC landscape...). portrait/landscape force it.
  function isLandscape() {
    if (orient === 'landscape') return true;
    if (orient === 'portrait') return false;
    return (window.innerWidth / Math.max(1, window.innerHeight)) >= 1.1;
  }
  function applyOrient() {
    var land = isLandscape();
    lastLandscape = land;
    if ($game) $game.classList.toggle('landscape', land);
    if (R.resize) R.resize();
    if (E.combat && R.syncCombat) R.syncCombat();
  }
  function setOrient(v) {
    orient = v;
    try { if (window.localStorage) window.localStorage.setItem('voidspire_orient', v); } catch (e) { /* ignore */ }
    applyOrient();
  }
  function cycleOrient() { setOrient(orient === 'auto' ? 'portrait' : orient === 'portrait' ? 'landscape' : 'auto'); }
  function orientLabel() {
    return orient === 'auto' ? '⤢ DISPLAY: AUTO' : orient === 'landscape' ? '▭ DISPLAY: HORIZONTAL' : '▯ DISPLAY: VERTICAL';
  }

  // window resize / fullscreen change: refit, and re-render an overlay if the
  // auto orientation flipped (so the map / panels reflow to the new layout)
  U.onResize = function () {
    var land = isLandscape();
    if ($game) $game.classList.toggle('landscape', land);
    if (R.resize) R.resize();
    if (E.combat && R.syncCombat) R.syncCombat();
    if (land !== lastLandscape) {
      lastLandscape = land;
      if (E.run && E.run.phase !== 'combat' && $overlay.classList.contains('active')) U.refresh();
    }
  };

  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function fsSupported() { var el = document.documentElement; return !!(el.requestFullscreen || el.webkitRequestFullscreen); }
  // already running as an installed/home-screen app (iOS standalone or PWA)?
  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function toggleFullscreen() {
    var d = document, el = d.documentElement;
    try {
      if (fsElement()) { (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d); }
      else { (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el); }
    } catch (e) { /* not supported */ }
  }
  // Fullscreen control that adapts to the platform. Returns null if already
  // running fullscreen as an installed app (nothing to offer).
  function makeFullscreenBtn(reRender, cls) {
    if (isStandalone()) return null;
    var b;
    if (fsSupported()) {
      b = el('div', 'panel-btn ' + (cls || ''),
        '<div class="pb-title">⛶ ' + (fsElement() ? 'EXIT FULLSCREEN' : 'FULLSCREEN') + '</div>' +
        '<div class="pb-sub">Fill the whole screen</div>');
      b.addEventListener('pointerdown', function () { SFX.tap(); toggleFullscreen(); setTimeout(reRender, 140); });
    } else {
      // iPhone Safari blocks the Fullscreen API — Add to Home Screen instead
      b = el('div', 'panel-btn ' + (cls || ''),
        '<div class="pb-title">⤓ ADD TO HOME SCREEN</div>' +
        '<div class="pb-sub">For true fullscreen on iPhone: Share → “Add to Home Screen”, then open from the icon</div>');
      b.addEventListener('pointerdown', function () {
        SFX.tap();
        toast('Tap the Share button, choose “Add to Home Screen”, then launch from the icon for fullscreen.', 4600);
      });
    }
    return b;
  }

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
    if (ns.music) {
      ns.music.setSector(r ? (r.sector || 1) : 1);
      ns.music.setScene(r && r.phase === 'combat' ? 'combat' : 'menu');
    }
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
      case 'victory': return showVictory();
      case 'recurrence-intro': return showRecurrenceIntro();
      case 'echo-draft': return showEchoDraft();
      case 'echo-loadout': return showEchoLoadout();
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
    // reserve room for the HUD (which sits on top) so a screen title never
    // collides with the HP bar / attribute row behind it
    if ($hud && $hud.style.display !== 'none' && $hud.innerHTML.trim()) {
      var hh = $hud.getBoundingClientRect().height;
      if (hh > 0 && hh < 220) s.style.paddingTop = (hh + 12) + 'px';
    }
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
    $counts.style.display = 'none';
    $drawPile.style.display = on ? 'block' : 'none';
    $discardPile.style.display = on ? 'block' : 'none';
    $potions.style.display = on ? 'flex' : 'none';
    if (!on) { $hint.style.display = 'none'; onPotionCancel(); hidePotionTip(); }
    R.combatVisible = on;
  }

  /* ====================== HUD ====================== */
  function setHud(on) { if ($hud) $hud.style.display = on ? '' : 'none'; }

  function updateHUD() {
    var r = E.run;
    if (!r) { $hud.innerHTML = ''; setHud(false); return; }
    setHud(true);
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
      '<span class="attr" style="color:' + fac.color + '">' + (r.loop > 1 ? 'L' + r.loop + '·' : '') + 'S' + r.sector + ' ▴' + Math.max(0, r.mapRow + 1) + '/' + (B.map.rows + 1) + '</span>' +
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
      // Only debuffs live in the HUD now — Powers show on the field as the
      // "battle augmentation" gauge (tap it to read names/values).
      var st = c.player.statuses, chips = '';
      Object.keys(st).forEach(function (k) {
        if (st[k] <= 0 || (k !== 'vuln' && k !== 'weak' && k !== 'burn')) return;
        chips += '<span class="status-chip debuff">' + esc(ns.STATUS_NAMES[k] || k) + ' ' + st[k] + '</span>';
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
    $hud.innerHTML = ''; setHud(false);
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

    var disp = el('div', 'panel-btn dim-panel',
      '<div class="pb-title">' + orientLabel() + '</div>' +
      '<div class="pb-sub">Tap to cycle · Auto fits your screen</div>');
    disp.addEventListener('pointerdown', function () { SFX.tap(); cycleOrient(); showTitle(); });
    s.appendChild(disp);

    var fsb = makeFullscreenBtn(showTitle, 'dim-panel');
    if (fsb) s.appendChild(fsb);

    var best = E.getBest();
    var foot = 'TAP A CLASS TO DEPLOY · SWIPE CARDS UP TO PLAY THEM';
    if (best) {
      var bestWhere = best.loop > 1 ? 'LOOP ' + best.loop : 'SECTOR ' + best.sector;
      var bestLine = (best.won ? '★ THE UNMAKER SLAIN · ' : '') + 'BEST: ' + bestWhere + ' · SCORE ' + best.score;
      foot = bestLine + '<br><br>' + foot;
    }
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

    var COLS = m.COLS, ROWS = m.ROWS;
    var land = isLandscape();
    var lane = 100, step = 106;        // lane = perpendicular spacing, step = progress spacing
    var W = land ? (ROWS + 1) * step : COLS * lane;
    var H = land ? COLS * lane : (ROWS + 1) * step;
    var reach = E.mapReachable(), cur = E.currentNode();

    // portrait flows bottom->top; landscape flows left->right (boss at the far end)
    function xy(node) {
      var jx = mapJit(node.row, node.col, 0), jy = mapJit(node.row, node.col, 1);
      if (land) return { x: (node.row + 0.5) * step + jx, y: (node.col + 0.5) * lane + jy };
      return { x: (node.col + 0.5) * lane + jx, y: H - (node.row + 0.5) * step + jy };
    }
    function targetOf(node, tc) {
      if (tc === 'boss') return m.boss;
      var nr = m.rows[node.row + 1];
      for (var i = 0; i < nr.length; i++) if (nr[i].col === tc) return nr[i];
      return null;
    }

    var par = land ? 'xMinYMid meet' : 'xMidYMin meet';
    var svg = '<svg class="starchart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="' + par + '">';
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

    var wrap = el('div', 'map-wrap' + (land ? ' land' : ''));
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

    // portrait scrolls vertically to keep the active frontier in view; the
    // landscape chart is sized to fit, so it needs no scrolling
    if (!land) setTimeout(function () {
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
    updatePotions();
  }

  /* ---- potion belt ----------------------------------------------------- */
  // Shared vial glyph, tinted per potion.
  function potionSVG(pid, cls) {
    var pot = ns.POTIONS[pid];
    return artSVG(ns.POTION_ICON, cls, pot.color);
  }

  function updatePotions() {
    var r = E.run;
    $potions.innerHTML = '';
    if (!E.combat) return;
    var slots = E.potionSlots();
    for (var i = 0; i < slots; i++) {
      var pid = (r.potions || [])[i];
      if (pid) {
        var chip = el('div', 'potion-chip', potionSVG(pid, 'pot-icon'));
        chip.setAttribute('data-slot', i);
        (function (slot, id, chipEl) {
          chipEl.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); startPotionDrag(chipEl, slot, ev); });
          // desktop hover tooltip (touch shows it on press, in startPotionDrag)
          chipEl.addEventListener('mouseenter', function () { if (!potionDrag) showPotionTip(id, chipEl); });
          chipEl.addEventListener('mouseleave', function () { if (!potionDrag) hidePotionTip(); });
        })(i, pid, chip);
        $potions.appendChild(chip);
      } else {
        $potions.appendChild(el('div', 'potion-chip empty', ''));
      }
    }
  }

  /* ---- potion tooltip ---- */
  function showPotionTip(pid, chipEl) {
    var pot = ns.POTIONS[pid];
    var rarTag = pot.rarity === 3 ? 'RARE' : pot.rarity === 2 ? 'UNCOMMON' : 'COMMON';
    $potionTip.innerHTML =
      '<div class="pt-name">' + esc(pot.name) + ' <span class="pt-tag">' + rarTag + '</span></div>' +
      '<div class="pt-desc">' + esc(pot.desc) + '</div>';
    $potionTip.style.display = 'block';
    var gr = $game.getBoundingClientRect(), cr = chipEl.getBoundingClientRect();
    // sit to the LEFT of the belt (which hugs the right edge)
    $potionTip.style.left = 'auto';
    $potionTip.style.right = Math.round(gr.right - cr.left + 10) + 'px';
    var tipH = $potionTip.getBoundingClientRect().height || 56;
    $potionTip.style.top = Math.max(6, Math.round(cr.top - gr.top - (tipH - cr.height) / 2)) + 'px';
  }
  function hidePotionTip() { $potionTip.style.display = 'none'; }

  /* ---- potion drag-to-use ----
     Press a potion to see its tooltip; drag it onto an enemy (or anywhere on
     the field) to use it, or drag it back to the belt to cancel. */
  var potionDrag = null;

  function startPotionDrag(chipEl, slot, ev) {
    if (locked || drag || potionDrag || !E.combat || E.combat.over) return;
    var pid = (E.run.potions || [])[slot];
    if (!pid) return;
    potionDrag = { el: chipEl, slot: slot, pid: pid, x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0, moved: false };
    showPotionTip(pid, chipEl);
    if (chipEl.setPointerCapture && ev.pointerId !== undefined) {
      try { chipEl.setPointerCapture(ev.pointerId); } catch (e) { /* not supported */ }
    }
  }

  function overPotionArea(ev) {
    var rct = $potions.getBoundingClientRect(), pad = 28;
    return ev.clientX >= rct.left - pad && ev.clientX <= rct.right + pad &&
           ev.clientY >= rct.top - pad && ev.clientY <= rct.bottom + pad;
  }

  function onPotionMove(ev) {
    potionDrag.dx = ev.clientX - potionDrag.x0;
    potionDrag.dy = ev.clientY - potionDrag.y0;
    if (!potionDrag.moved && Math.abs(potionDrag.dx) + Math.abs(potionDrag.dy) > 9) {
      potionDrag.moved = true;
      potionDrag.el.classList.add('dragging');
    }
    if (potionDrag.moved) {
      potionDrag.el.style.transform = 'translate(' + potionDrag.dx + 'px,' + potionDrag.dy + 'px) scale(1.12)';
      var armed = !overPotionArea(ev);            // armed everywhere except back over the belt
      potionDrag.el.classList.toggle('will-play', armed);
      R.targeting = armed && E.aliveEnemies().length > 0;  // show reticles as drop hints
    }
  }

  function onPotionEnd(ev) {
    var pd = potionDrag;
    potionDrag = null;
    pd.el.classList.remove('dragging', 'will-play');
    pd.el.style.transform = '';
    R.targeting = false;
    hidePotionTip();
    if (!pd.moved) return;                          // a tap just previews; you must drag to use
    if (locked || !E.combat || E.combat.over) return;
    if (overPotionArea(ev)) return;                 // dragged back to the belt -> cancel
    usePotionAt(pd.slot, enemyAtClient(ev));        // enemy under pointer, or -1 (defaults to first)
  }

  function onPotionCancel() {
    if (!potionDrag) return;
    potionDrag.el.classList.remove('dragging', 'will-play');
    potionDrag.el.style.transform = '';
    potionDrag = null;
    R.targeting = false;
    hidePotionTip();
  }

  function usePotionAt(slot, targetIdx) {
    setTargeting(false);
    E.events.length = 0;
    var ok = E.usePotion(slot, targetIdx);
    if (!ok) { updatePotions(); return; }
    SFX.play();
    var evts = E.events.slice();
    E.events.length = 0;
    lock(true);
    playTimeline(evts, 70, function () {
      lock(false);
      afterAction(false);
    });
    updatePotions();
    updateEnergy();
    updateCounts();
    updateHUD();
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

  var CLASS_COLOR = { vanguard: '#ffb02e', technomancer: '#41d8ff', voidadept: '#c86bff' };
  function pileHTML(cls, which, n, sub) {
    var set = ns.PILE_ICONS[cls] || ns.PILE_ICONS.vanguard;
    return '<div class="pile-card pile-' + which + '">' + artSVG(set[which], 'pile-ic', CLASS_COLOR[cls] || '#5dff88') +
      '<span class="pile-n">' + n + '</span></div>' +
      '<div class="pile-lbl">' + (which === 'draw' ? 'DRAW' : 'DISC' + (sub || '')) + '</div>';
  }
  function updateCounts() {
    var c = E.combat;
    if (!c) return;
    var cls = E.run.cls;
    $drawPile.innerHTML = pileHTML(cls, 'draw', c.drawPile.length, '');
    $discardPile.innerHTML = pileHTML(cls, 'discard', c.discard.length, c.exhaust.length ? '·E' + c.exhaust.length : '');
  }

  // Look into the draw / discard pile.
  function showPileModal(which) {
    var c = E.combat;
    if (!c) return;
    var wasCombat = E.run.phase === 'combat';
    var cards = (which === 'draw' ? c.drawPile : c.discard).slice();
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', (which === 'draw' ? 'Draw Pile' : 'Discard Pile') + ' (' + cards.length + ')'));
    s.appendChild(el('div', 'screen-sub', which === 'draw' ? 'ORDER IS HIDDEN UNTIL DRAWN' : 'MOST RECENTLY PLAYED LAST'));
    if (!cards.length) s.appendChild(el('div', 'screen-sub', '— EMPTY —'));
    var grid = el('div', 'card-grid');
    var list = (which === 'draw') ? cards.sort(function (a, b) { return ns.CARDS[a.id].cost - ns.CARDS[b.id].cost; }) : cards;
    list.forEach(function (card) { grid.appendChild(cardEl(card.id, card.up, card.vtouch)); });
    s.appendChild(grid);
    var btn = el('button', 'btn', 'CLOSE');
    btn.addEventListener('pointerdown', function () { SFX.tap(); if (wasCombat) showCombat(); else U.refresh(); });
    s.appendChild(btn);
  }

  /* ---- shared card markup ---------------------------------------------- */
  var TYPE_ICONS = {
    attack: '<svg viewBox="0 0 14 14"><path d="M2 12 L9 3 L11 7 L6 12 Z"/><path d="M9 9 L12 12"/></svg>',
    skill: '<svg viewBox="0 0 14 14"><path d="M7 1 L12 4 L12 9 L7 13 L2 9 L2 4 Z"/><path d="M7 4 L7 10"/></svg>',
    power: '<svg viewBox="0 0 14 14"><path d="M2 8 L7 3 L12 8"/><path d="M2 12 L7 7 L12 12"/></svg>',
    curse: '<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5"/><path d="M4 4 L10 10 M10 4 L4 10"/></svg>',
  };

  function cardGlyphSVG(cid) {
    return artSVG(ns.cardGlyph(cid, ns.CARDS[cid]), 'cart-svg');
  }
  // Colour combat keywords in card text to match the on-field status pills.
  var KW_MAP = [
    ['Plated Armor', 'pa'], ['Vulnerable', 'vu'], ['Shield', 'sh'], ['Weak', 'wk'],
    ['Burn', 'bn'], ['Might', 'mi'], ['Energy', 'en'], ['Exhaust', 'ex'],
    ['Retain', 'rt'], ['Heal', 'hl'], ['Echo', 'ec'], ['Thorns', 'th'], ['Regen', 'rg'],
  ];
  function descHTML(desc) {
    var s = esc(desc);
    for (var i = 0; i < KW_MAP.length; i++) {
      s = s.replace(new RegExp('\\b(' + KW_MAP[i][0] + 's?)\\b', 'g'), '<span class="kw kw-' + KW_MAP[i][1] + '">$1</span>');
    }
    return s;
  }
  function rareClassOf(rarity) { return rarity === 4 ? ' legendary' : rarity === 3 ? ' rare' : rarity === 2 ? ' unc' : ''; }
  function cardInner(name, cost, type, rarity, desc, unplayable, cid) {
    var r = rarity === 4 ? 'r4' : rarity === 3 ? 'r3' : rarity === 2 ? 'r2' : 'r1';
    var tag = rarity === 4 ? 'LEGENDARY' : rarity === 3 ? 'RARE' : rarity === 2 ? 'UNC' : '';
    return '<div class="cost"><svg viewBox="0 0 24 24"><polygon points="12,0.8 21.7,6.4 21.7,17.6 12,23.2 2.3,17.6 2.3,6.4"/></svg>' +
      '<span class="cost-n">' + (unplayable ? '✕' : cost) + '</span></div>' +
      '<div class="cname">' + esc(name) + '</div>' +
      '<div class="cart">' + cardGlyphSVG(cid) + '</div>' +
      '<div class="rline ' + r + '">' + (tag ? '<span class="rtag">' + tag + '</span>' : '') + '</div>' +
      '<div class="cdesc">' + descHTML(desc) + '</div>';
  }

  function renderHand(deal) {
    $hand.innerHTML = '';
    var c = E.combat;
    if (!c) return;
    var n = c.hand.length, mid = (n - 1) / 2;
    var spread = n > 1 ? Math.min(4.2, 26 / n) : 0; // degrees between cards
    c.hand.forEach(function (card, i) {
      var info = E.cardInfo(card);
      var d = el('div', 'card type-' + info.type + rareClassOf(info.rarity) +
        (info.vtouch ? ' vtouched' : '') +
        (info.cost > c.energy && !info.unplayable ? ' unaffordable' : '') +
        (info.unplayable ? ' unplayable-curse' : '') +
        (deal ? ' deal' : '') +
        (i === selected ? ' selected' : ''));
      if (deal) d.style.setProperty('--d', (i * 55) + 'ms');
      // fan the hand into an arc so cards don't simply stack behind each other
      var off = i - mid;
      var rot = off * spread;
      var ty = Math.abs(off) * Math.abs(off) * 1.5;
      d.style.setProperty('--fan', 'rotate(' + rot.toFixed(2) + 'deg) translateY(' + ty.toFixed(1) + 'px)');
      d.innerHTML = cardInner(info.name, info.xcost ? 'X' : info.cost, info.type, info.rarity, info.desc, info.unplayable, card.id);
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
    if (potionDrag) { onPotionMove(ev); return; }
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
    if (potionDrag) { onPotionEnd(ev); return; }
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
    if (potionDrag) { onPotionCancel(); return; }
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
    // power gauge: tap to expand / collapse the augmentation readout
    if (selected < 0 && R.gaugeHit(x, y)) { SFX.tap(); R.toggleReadout(); return; }
    if (R.isReadoutOpen()) { R.closeReadout(); if (selected < 0) return; }   // tap elsewhere dismisses it
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

  // Card-play flourish: the card DEMATERIALISES in place — it breaks into rising
  // scan-lines (transporter / Gauss-flayer style) while a column of sparkles
  // beams upward, then the pile it went to blinks. Tinted by the class colour.
  function blinkPile(pileEl, color) {
    if (!pileEl) return;
    var pc = pileEl.querySelector('.pile-card');
    if (!pc) return;
    pc.style.setProperty('--blink', color);
    pc.classList.remove('blink'); void pc.offsetWidth; pc.classList.add('blink');
    setTimeout(function () { pc.classList.remove('blink'); }, 480);
  }
  // Each class dematerialises its played cards differently, in its own colour:
  //  Vanguard  — kinetic shatter: the card flashes and blasts apart (amber sparks out).
  //  Technomancer — transporter beam-up: breaks into rising scan-lines (cyan + white shimmer).
  //  Void Adept — void implosion: spirals into a point as sparks rush inward (magenta).
  var CLASS_FX = {
    vanguard:     { color: '#ffb02e', cls: 'beam-van',  mode: 'shatter', life: 260 },
    technomancer: { color: '#41d8ff', cls: 'beam-tech', mode: 'beam',    life: 380 },
    voidadept:    { color: '#c86bff', cls: 'beam-void', mode: 'implode', life: 300 },
  };
  function cardPlayFx(rect, clone, card, def) {
    if (!rect) return;
    var fx = CLASS_FX[E.run.cls] || CLASS_FX.vanguard;
    var w = rect.width, h = rect.height;
    var bf = document.getElementById('battlefield').getBoundingClientRect();
    var cx = rect.left + w / 2 - bf.left, cy = rect.top + h / 2 - bf.top;
    if (clone) {
      clone.classList.add('card-ghost', fx.cls);
      clone.classList.remove('selected', 'dragging', 'deal', 'unaffordable');
      clone.style.position = 'fixed'; clone.style.margin = '0'; clone.style.transition = 'none'; clone.style.transform = 'none';
      clone.style.left = rect.left + 'px'; clone.style.top = rect.top + 'px';
      clone.style.width = w + 'px'; clone.style.height = h + 'px';
      clone.style.setProperty('--beam', fx.color);
      $game.appendChild(clone);
      setTimeout(function () { clone.remove(); }, fx.life + 80);
    }
    if (fx.mode === 'shatter') {
      R.burst(cx, cy, fx.color, 22); R.burst(cx, cy, '#fff3d6', 9);
    } else if (fx.mode === 'implode') {
      R.implode(cx, cy, fx.color, w * 0.82, h * 0.92, 24); R.implode(cx, cy, '#f0d6ff', w * 0.55, h * 0.65, 9);
    } else {
      R.beam(cx, cy, fx.color, w * 0.74, h * 0.82, 24); R.beam(cx, cy, '#e6fbff', w * 0.6, h * 0.7, 12);
    }
    var c = E.combat;
    var consumed = !!c && (c.exhaust.some(function (x) { return x.uid === card.uid; }) ||
                           c.consumed.some(function (x) { return x.uid === card.uid; }));
    blinkPile(consumed ? null : $discardPile, fx.color);
  }

  // Classify a card by what it actually does, so every card gets a fitting
  // 8-bit sound + vector cast animation (space / old-school philosophy).
  function cardFlavor(def, fx) {
    var sp = []; fx.forEach(function (f) { if (f.k === 'special') sp.push(f.id); });
    if (sp.indexOf('fiendFire') >= 0) return 'multiAttack';
    if (sp.indexOf('catalyst') >= 0 || sp.indexOf('catalyst3') >= 0) return 'burn';
    if (sp.indexOf('reap') >= 0 || sp.indexOf('overdrive') >= 0 || sp.indexOf('shieldSlam') >= 0 || sp.indexOf('shieldSlam15') >= 0) return 'attack';
    if (sp.indexOf('doubleBlock') >= 0) return 'block';
    if (sp.indexOf('limitBreak') >= 0) return 'buff';
    if (sp.indexOf('drain') >= 0) return 'drain';
    if (def.type === 'power') return 'power';
    if (fx.some(function (f) { return f.k === 'status' && f.s === 'burn'; })) return 'burn';
    if (fx.some(function (f) { return f.k === 'hploss'; }) && !fx.some(function (f) { return f.k === 'dmg'; })) return 'drain';
    var dmg = fx.filter(function (f) { return f.k === 'dmg'; });
    var allHit = dmg.some(function (f) { return f.all; }) || fx.some(function (f) { return f.k === 'status' && f.who === 'allEnemies'; });
    if (dmg.length) {
      if (allHit) return 'aoe';
      if (dmg.some(function (f) { return (f.hits || 1) > 1 || f.xcost; })) return 'multiAttack';
      if (fx.some(function (f) { return f.k === 'hploss'; })) return 'drain';   // blood attacks
      return 'attack';
    }
    if (fx.some(function (f) { return f.k === 'block'; })) return 'block';
    if (fx.some(function (f) { return f.k === 'heal'; })) return 'heal';
    if (fx.some(function (f) { return f.k === 'status' && f.who === 'target'; })) return 'debuff';
    if (fx.some(function (f) { return f.k === 'status' && (f.who === 'self' || f.who === 'allEnemies'); })) return 'buff';
    return 'utility';
  }

  var CLASS_COL = { vanguard: '#ffb02e', technomancer: '#41d8ff', voidadept: '#c86bff' };
  var BURN_COL = '#ff7a1e', HEAL_COL = '#5dff88', PSI_COL = '#c86bff';
  function mul(arr, m) { return arr.map(function (f) { return f * m; }); }

  // Per-card motif: each card maps to its own distinct cast animation + sound.
  // Unlisted cards fall back to a class/flavor default (fallbackMotif).
  var CARD_MOTIF = {
    // -- Vanguard --
    pulse_rifle: 'bullet', scrap_shot: 'bullet', bayonet_charge: 'slash',
    burst_fire: 'burst3', suppressing_fire: 'spray', frag_grenade: 'grenade', cluster_munitions: 'hail',
    shield_slam: 'slam', kinetic_discharge: 'slam', executioner: 'execute',
    heavy_ordnance: 'heavyShot', salvaged_ordnance: 'heavyShot', whirlwind: 'spiral',
    orbital_strike: 'hail', orbital_bombardment: 'hail',
    breach: 'reap', combat_stims: 'energize', war_cry: 'warcry', warlord_protocol: 'surge', limit_break: 'surge',
    iron_resolve: 'fortify', reckless_protocol: 'fortify', barricade_protocol: 'fortify', bunker_down: 'fortify', juggernaut_core: 'fortify',
    scorched_earth: 'scorch', munitions_dump: 'energize', adrenal_surge: 'energize',
    // -- Technomancer --
    shock_coil: 'zap', static_lance: 'rail', railgun: 'rail', leech_coil: 'rail',
    chain_lightning: 'arc', arc_welder: 'arc', emp_blast: 'pulse', static_field: 'pulse',
    deploy_turret: 'deploy', sentry_protocol: 'deploy', drone_swarm: 'deploy',
    echo_core: 'overcharge', aux_reactor: 'overcharge', phase_bulwark: 'overcharge', overload_capacitor: 'overcharge',
    shield_battery: 'overcharge', omega_protocol: 'overcharge', cogwork_surge: 'overcharge', salvage_protocol: 'overcharge',
    nano_repair: 'repair', overclock: 'overclock',
    // -- Void Adept --
    mind_spike: 'psiBolt', psy_lance: 'psiBolt', void_bolt: 'psiBolt', void_siphon: 'psiBolt',
    mind_storm: 'psiStorm', tk_crush: 'crush', void_grasp: 'drainBolt', exsanguinate: 'drainBolt',
    soul_burn: 'ignite', hex_weave: 'ignite', wither: 'ignite', catalyst: 'ignite',
    mind_fracture: 'hex', unravel: 'reap', eldritch_storm: 'psiRain',
    psionic_focus: 'sigil', blood_pact: 'sigil', entropy_field: 'sigil', mind_array: 'sigil', plague_engine: 'sigil',
    singularity_bloom: 'singularity', blood_sacrifice: 'drainSelf', hemorrhage: 'drainSelf',
    premonition: 'foresee', forbidden_lore: 'foresee',
    // -- Neutral --
    combat_scan: 'scan', reload: 'reload', med_stim: 'repair', stim_overdose: 'energize',
  };
  function fallbackMotif(flavor, cls) {
    switch (flavor) {
      case 'attack':      return 'bullet';
      case 'multiAttack': return 'burst3';
      case 'aoe':         return 'novaCast';
      case 'block':       return 'block';
      case 'power':       return cls === 'voidadept' ? 'sigil' : cls === 'technomancer' ? 'overcharge' : 'fortify';
      case 'buff':        return 'surge';
      case 'debuff':      return 'hex';
      case 'burn':        return 'ignite';
      case 'heal':        return 'heal';
      case 'drain':       return 'drainBolt';
      default:            return 'utility';
    }
  }

  // Each motif: s(env) = sound, a(env) = animation. env carries muzzle origin
  // (sx,sy), target pos (tp), all live targets, class colour, cost-as-power,
  // and a per-card pitch multiplier (pm) so same-motif cards still differ.
  var MOTIF = {
    bullet: {
      s: function (e) { synth(430 * e.pm, 0.09, 'square', 0.045, -150, { detune: 7 }); },
      a: function (e) { if (e.tp) { R.shot(e.sx, e.sy, e.tp.x, e.tp.y, e.col); R.burst(e.sx, e.sy, e.col, 4); } },
    },
    burst3: {
      s: function (e) { [0, 1, 2].forEach(function (i) { setTimeout(function () { beep((560 + i * 40) * e.pm, 0.05, 'square', 0.03); }, i * 60); }); },
      a: function (e) { if (e.tp) [0, 70, 140].forEach(function (d) { setTimeout(function () { R.shot(e.sx, e.sy, e.tp.x, e.tp.y, e.col); }, d); }); },
    },
    spray: {
      s: function (e) { noise(0.2, 0.045, 1600, 500); synth(360 * e.pm, 0.1, 'square', 0.03, -120); },
      a: function (e) { if (e.tp) [0, 40, 80, 120].forEach(function (d) { setTimeout(function () { R.shot(e.sx, e.sy, e.tp.x, e.tp.y, e.col); }, d); }); },
    },
    shards: {
      s: function (e) { noise(0.16, 0.05, 2200, 280); synth(150 * e.pm, 0.16, 'sawtooth', 0.04, -40, { detune: 9 }); },
      a: function (e) { if (e.tp) { var dir = Math.atan2(e.tp.y - e.sy, e.tp.x - e.sx); R.shards(e.sx, e.sy, e.col, 8 + e.power * 3, dir, 0.7); R.ring(e.tp.x, e.tp.y, e.col, 30, 0.4); } },
    },
    slash: {
      s: function (e) { noise(0.07, 0.05, 6000, 900); synth(520 * e.pm, 0.08, 'square', 0.04, -260); },
      a: function (e) { if (e.tp) { R.shot(e.sx, e.sy, e.tp.x, e.tp.y, e.col); R.spiral(e.tp.x, e.tp.y, e.col, 3, 16); R.burst(e.tp.x, e.tp.y, '#ffffff', 5); } },
    },
    slam: {
      s: function (e) { synth(110 * e.pm, 0.18, 'square', 0.05, -30, { detune: 10 }); noise(0.1, 0.05, 800, 200); },
      a: function (e) { if (e.tp) { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, e.col, 5); R.ring(e.tp.x, e.tp.y, e.col, 40, 0.4); R.shake(0.4 + e.power * 0.1); } },
    },
    execute: {
      s: function (e) { synth(200 * e.pm, 0.14, 'sawtooth', 0.05, -120, { detune: 8 }); setTimeout(function () { synth(90, 0.16, 'square', 0.05, -20); }, 90); },
      a: function (e) { if (e.tp) { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, e.col, 6); R.nova(e.tp.x, e.tp.y, e.col, e.power); R.shake(0.6); } },
    },
    heavyShot: {
      s: function (e) { synth(90 * e.pm, 0.22, 'square', 0.06, -20, { detune: 12, filter: [1400, 200] }); noise(0.12, 0.05, 900, 150); },
      a: function (e) { if (e.tp) { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, e.col, 7); R.ring(e.tp.x, e.tp.y, e.col, 48, 0.5); R.shake(0.7); } },
    },
    rail: {
      s: function (e) { synth(300 * e.pm, 0.12, 'sawtooth', 0.03, 700, { detune: 6 }); setTimeout(function () { synth(1200 * e.pm, 0.1, 'square', 0.045, -900); }, 100); },
      a: function (e) { if (e.tp) R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, e.col, 4); },
    },
    arc: {
      s: function (e) { noise(0.12, 0.04, 5000, 2000); synth(700 * e.pm, 0.14, 'square', 0.035, -200, { vib: 30, vibRate: 30 }); },
      a: function (e) { var src = { x: e.sx, y: e.sy }; e.targets.forEach(function (t) { R.arc(src.x, src.y, t.x, t.y, e.col, 7, 11); src = t; }); },
    },
    spiral: {
      s: function (e) { noise(0.26, 0.05, 600, 2600); },
      a: function (e) { R.spiral(e.pp.x, e.pp.y - 6, e.col, 8 + e.power * 2, 32); e.targets.forEach(function (t) { R.ring(t.x, t.y, e.col, 28, 0.35); }); R.shake(0.3); },
    },
    orbital: {
      s: function (e) { synth(1500, 0.4, 'sine', 0.04, -1250, { vib: 8 }); setTimeout(function () { noise(0.3, 0.06, 1600, 150); }, 360); },
      a: function (e) { e.targets.forEach(function (t) { R.strike(t.x, t.y, e.col, e.power); }); R.shake(0.7); },
    },
    psiBolt: {
      s: function (e) { synth(450 * e.pm, 0.16, 'triangle', 0.04, -60, { vib: 18, vibRate: 11, detune: 5 }); },
      a: function (e) { if (e.tp) { R.shot(e.sx, e.sy, e.tp.x, e.tp.y, PSI_COL); R.polyRing(e.tp.x, e.tp.y, PSI_COL, 6, 26, 3, 0.4, 5, 1.5); } },
    },
    psiStorm: {
      s: function (e) { arp(mul([440, 554, 659, 880], e.pm), 50, 0.1, 'triangle', 0.035); },
      a: function (e) { if (e.tp) { [0, 60, 120].forEach(function (d) { setTimeout(function () { R.shot(e.sx, e.sy, e.tp.x, e.tp.y, PSI_COL); }, d); }); R.sigil(e.tp.x, e.tp.y, PSI_COL, 26); } },
    },
    crush: {
      s: function (e) { synth(120 * e.pm, 0.24, 'sawtooth', 0.045, 260, { vib: 14 }); },
      a: function (e) { if (e.tp) { R.implode(e.tp.x, e.tp.y, PSI_COL, 40, 46, 18); R.ring(e.tp.x, e.tp.y, PSI_COL, 34, 0.4); R.shake(0.4); } },
    },
    reap: {
      s: function (e) { synth(330 * e.pm, 0.2, 'sawtooth', 0.04, 420, { vib: 10 }); noise(0.1, 0.03, 3000, 800); },
      a: function (e) { if (e.tp) { R.spiral(e.tp.x, e.tp.y, e.col, 5, 28); R.glitch(e.tp.x, e.tp.y, e.col); R.ring(e.tp.x, e.tp.y, e.col, 36, 0.45); } },
    },
    drainBolt: {
      s: function (e) { synth(520 * e.pm, 0.22, 'sine', 0.04, -340, { vib: 9, vibRate: 8 }); },
      a: function (e) { if (e.tp) R.shot(e.tp.x, e.tp.y, e.sx, e.sy, PSI_COL); R.implode(e.pp.x, e.pp.y - 6, PSI_COL, 30, 36, 12); },
    },
    ignite: {
      s: function (e) { noise(0.3, 0.045, 3400, 500); setTimeout(function () { beep(1000 * e.pm, 0.05, 'square', 0.02); }, 40); },
      a: function (e) { if (e.tp) R.embers(e.tp.x, e.tp.y, BURN_COL, 14 + e.power * 4); },
    },
    hex: {
      s: function (e) { synth(400 * e.pm, 0.2, 'sawtooth', 0.04, -230, { detune: 9, vib: 12 }); },
      a: function (e) { if (e.tp) { R.glitch(e.tp.x, e.tp.y, e.col); R.polyRing(e.tp.x, e.tp.y, e.col, 8, 24, 3, 0.4, -6, 1.5); } },
    },
    heal: {
      s: function (e) { arp(mul([523, 659, 784, 1047], e.pm), 60, 0.13, 'sine', 0.045); },
      a: function (e) { R.aura(e.pp.x, e.pp.y - 6, HEAL_COL); },
    },
    surge: {
      s: function (e) { synth(330 * e.pm, 0.12, 'square', 0.045, 330, { detune: 8 }); arp(mul([330, 440, 554, 660], e.pm), 55, 0.09, 'square', 0.032); },
      a: function (e) { R.aura(e.pp.x, e.pp.y - 6, e.col); R.ring(e.pp.x, e.pp.y - 6, e.col, 54, 0.6); if (e.power >= 2) R.shake(0.3); },
    },
    fortify: {
      s: function (e) { synth(160 * e.pm, 0.22, 'square', 0.05, 40, { detune: 10, filter: [1200, 400] }); },
      a: function (e) { R.polyRing(e.pp.x, e.pp.y - 6, e.col, 20, 50, 4, 0.5, 1.2, 3); R.aura(e.pp.x, e.pp.y - 6, e.col); },
    },
    deploy: {
      s: function (e) { [0, 1, 2].forEach(function (i) { setTimeout(function () { beep(300 + i * 120, 0.04, 'square', 0.04); }, i * 70); }); synth(140, 0.18, 'square', 0.03, 30); },
      a: function (e) { var dx = e.pp.x + 44, dy = e.pp.y - 10; R.polyRing(dx, dy, e.col, 4, 18, 4, 0.5, 2, 2); R.burst(dx, dy, e.col, 8); },
    },
    overcharge: {
      s: function (e) { synth(420 * e.pm, 0.14, 'sawtooth', 0.035, 520, { detune: 10, vib: 10 }); arp(mul([523, 659, 784], e.pm), 50, 0.09, 'square', 0.03); },
      a: function (e) { R.aura(e.pp.x, e.pp.y - 6, e.col); R.polyRing(e.pp.x, e.pp.y - 6, e.col, 16, 44, 6, 0.5, 4, 2); },
    },
    sigil: {
      s: function (e) { synth(120 * e.pm, 0.3, 'triangle', 0.04, 30, { vib: 12, vibRate: 7, detune: 6 }); setTimeout(function () { synth(240 * e.pm, 0.2, 'sine', 0.03, -40, { vib: 14 }); }, 60); },
      a: function (e) { R.sigil(e.pp.x, e.pp.y - 6, PSI_COL, 34); R.ring(e.pp.x, e.pp.y - 6, PSI_COL, 52, 0.6); },
    },
    drainSelf: {
      s: function (e) { synth(160 * e.pm, 0.16, 'sawtooth', 0.045, 120); beep(90, 0.1, 'square', 0.04, -20); },
      a: function (e) { R.implode(e.pp.x, e.pp.y - 6, PSI_COL, 28, 32, 12); R.embers(e.pp.x, e.pp.y - 6, PSI_COL, 6); },
    },
    novaCast: {
      s: function (e) { noise(0.28, 0.06, 2000, 180); synth(120 * e.pm, 0.22, 'sawtooth', 0.05, -70, { detune: 10 }); },
      a: function (e) { e.targets.forEach(function (t) { R.shot(e.sx, e.sy, t.x, t.y, e.col); R.ring(t.x, t.y, e.col, 34, 0.4); }); R.ring(e.pp.x, e.pp.y - 6, e.col, 60, 0.5); if (e.power >= 3) R.shake(0.5); },
    },
    scan: {   // Combat Scan: a targeting reticle + scan-line sweep, sci-fi ping
      s: function (e) { synth(380 * e.pm, 0.42, 'square', 0.022, 520, { detune: 4 }); [0, 1, 2, 3].forEach(function (i) { setTimeout(function () { beep(1200 + i * 130, 0.02, 'square', 0.014); }, i * 95); }); },
      a: function (e) { if (e.tp) R.scan(e.tp.x, e.tp.y, e.col); },
    },
    hail: {   // Orbital Strike: rounds rain from the sky, old-school explosions
      s: function (e) { synth(1600, 0.34, 'sine', 0.03, -1300, { vib: 6 }); [0, 1, 2].forEach(function (i) { setTimeout(function () { noise(0.22, 0.06, 1500, 140); }, 200 + i * 130); }); },
      a: function (e) {
        var ts = e.targets.length ? e.targets : (e.tp ? [e.tp] : []);
        ts.forEach(function (t, ti) { for (var k = 0; k < 3; k++) (function (tt, kk) { setTimeout(function () { R.strike(tt.x + (kk - 1) * 11, tt.y, e.col, e.power); }, kk * 120 + ti * 45); })(t, k); });
        R.shake(0.8);
      },
    },
    grenade: {   // Frag Grenade: a lobbed charge that detonates
      s: function (e) { synth(140 * e.pm, 0.12, 'square', 0.03, -40); setTimeout(function () { noise(0.2, 0.06, 1700, 200); }, 240); },
      a: function (e) { if (e.tp) { var dir = Math.atan2(e.tp.y - e.sy, e.tp.x - e.sx); R.shards(e.sx, e.sy, e.col, 4, dir - 0.35, 0.3); setTimeout(function () { R.nova(e.tp.x, e.tp.y, e.col, e.power); }, 240); } },
    },
    warcry: {   // War Cry: a roar that ripples out in shockrings
      s: function (e) { noise(0.18, 0.05, 700, 1700); synth(180 * e.pm, 0.22, 'sawtooth', 0.045, 110, { vib: 14, vibRate: 8 }); },
      a: function (e) { R.ring(e.pp.x, e.pp.y - 6, e.col, 40, 0.4); setTimeout(function () { R.ring(e.pp.x, e.pp.y - 6, e.col, 64, 0.5); }, 80); setTimeout(function () { R.ring(e.pp.x, e.pp.y - 6, e.col, 90, 0.6); }, 160); R.aura(e.pp.x, e.pp.y - 6, e.col); },
    },
    energize: {   // Combat Stims / Adrenal Surge: an energizing jolt
      s: function (e) { synth(300 * e.pm, 0.16, 'square', 0.04, 600, { detune: 6 }); },
      a: function (e) { R.aura(e.pp.x, e.pp.y - 6, e.col); R.ring(e.pp.x, e.pp.y - 6, e.col, 34, 0.35); },
    },
    repair: {   // Nano Repair: nanobots converge and knit you back together
      s: function (e) { arp(mul([523, 784, 1047], e.pm), 50, 0.1, 'sine', 0.04); },
      a: function (e) { R.implode(e.pp.x, e.pp.y - 6, HEAL_COL, 34, 40, 16); R.aura(e.pp.x, e.pp.y - 6, HEAL_COL); },
    },
    overclock: {   // Overclock: a CPU spin-up of rapid pulses
      s: function (e) { arp(mul([440, 587, 740, 880, 1175], e.pm), 34, 0.04, 'square', 0.03); },
      a: function (e) { for (var i = 0; i < 3; i++) (function (ii) { setTimeout(function () { R.ring(e.pp.x, e.pp.y - 6, e.col, 20 + ii * 10, 0.25); }, ii * 60); })(i); R.burst(e.pp.x, e.pp.y - 6, e.col, 8); },
    },
    pulse: {   // EMP / Static Field: an electromagnetic pulse washes over the field
      s: function (e) { synth(90, 0.3, 'sine', 0.05, 30, { vib: 30, vibRate: 40 }); noise(0.18, 0.04, 400, 2200); },
      a: function (e) { R.ring(e.pp.x, e.pp.y - 6, e.col, 112, 0.5); R.ring(e.pp.x, e.pp.y - 6, '#ffffff', 60, 0.3); e.targets.forEach(function (t) { R.glitch(t.x, t.y, e.col); R.ring(t.x, t.y, e.col, 30, 0.35); }); R.shake(0.4); },
    },
    foresee: {   // Premonition / Forbidden Lore: a flash of foresight
      s: function (e) { synth(720 * e.pm, 0.3, 'sine', 0.03, 260, { vib: 10, vibRate: 6 }); },
      a: function (e) { R.ring(e.pp.x, e.pp.y - 30, e.col, 30, 0.5); R.polyRing(e.pp.x, e.pp.y - 6, e.col, 10, 40, 6, 0.5, 2, 1.5); R.aura(e.pp.x, e.pp.y - 6, e.col); },
    },
    psiRain: {   // Eldritch Storm: psychic bolts strike at random
      s: function (e) { arp(mul([523, 659, 784, 988, 1318], e.pm), 45, 0.09, 'triangle', 0.03); },
      a: function (e) { var ts = e.targets.length ? e.targets : (e.tp ? [e.tp] : []); if (!ts.length) return; for (var k = 0; k < 5; k++) (function (kk) { setTimeout(function () { var t = ts[Math.floor(Math.random() * ts.length)]; if (t) R.strike(t.x + (Math.random() - 0.5) * 16, t.y, PSI_COL, e.power); }, kk * 70); })(k); },
    },
    singularity: {   // Singularity Bloom: space collapses inward then erupts
      s: function (e) { synth(60, 0.5, 'sine', 0.05, 200, { vib: 20, vibRate: 5, detune: 8 }); setTimeout(function () { noise(0.2, 0.05, 320, 1800); }, 300); },
      a: function (e) { R.implode(e.pp.x, e.pp.y - 6, PSI_COL, 60, 70, 26); R.sigil(e.pp.x, e.pp.y - 6, PSI_COL, 40); R.shake(0.5); },
    },
    scorch: {   // Scorched Earth: a sweeping wall of fire across the field
      s: function (e) { noise(0.4, 0.06, 3000, 300); synth(120 * e.pm, 0.3, 'sawtooth', 0.05, -60, { detune: 12 }); },
      a: function (e) { e.targets.forEach(function (t) { R.embers(t.x, t.y, BURN_COL, 16); R.ring(t.x, t.y, BURN_COL, 40, 0.45); }); R.shake(0.6); },
    },
    zap: {   // Shock Coil: a single forked jolt of electricity
      s: function (e) { noise(0.08, 0.04, 6000, 3000); synth(800 * e.pm, 0.12, 'square', 0.035, -300, { vib: 25, vibRate: 35 }); },
      a: function (e) { if (e.tp) R.arc(e.sx, e.sy, e.tp.x, e.tp.y, e.col, 7, 10); },
    },
    reload: {   // Reload: eject, slam home a fresh magazine, chamber a round
      s: function (e) { beep(200, 0.04, 'square', 0.04); setTimeout(function () { beep(140, 0.05, 'square', 0.04); }, 90); setTimeout(function () { beep(520, 0.04, 'square', 0.03); }, 180); },
      a: function (e) { var dx = e.pp.x + 6, dy = e.pp.y - 4; R.shards(dx, dy, e.col, 3, Math.PI / 2, 0.3); R.burst(dx, dy - 10, e.col, 5); },
    },
    block: {
      s: function (e) { beep(300 * e.pm, 0.04, 'square', 0.022, 120); },   // soft charge; the shield sounds on the block event
      a: function (e) { R.burst(e.pp.x, e.pp.y - 6, e.col, 4); },          // shield itself draws on the block event
    },
    utility: {
      s: function (e) { beep(520 * e.pm, 0.06, 'square', 0.03, 180); setTimeout(function () { beep(700 * e.pm, 0.05, 'square', 0.025); }, 60); },
      a: function (e) { R.ring(e.pp.x, e.pp.y - 6, e.col, 26, 0.3); R.burst(e.pp.x, e.pp.y - 6, e.col, 5); },
    },
  };

  function shieldSound() {
    var cls = E.run.cls;
    if (cls === 'technomancer') synth(300, 0.2, 'sine', 0.04, 160, { detune: 6, vib: 8 });          // energy hum
    else if (cls === 'voidadept') synth(180, 0.26, 'triangle', 0.04, 40, { vib: 11, vibRate: 9 });  // ward drone
    else { beep(220, 0.05, 'square', 0.06); setTimeout(function () { noise(0.08, 0.05, 1200, 300); }, 30); } // plate clank
  }
  function classShield(p) {
    var cls = E.run.cls, col = CLASS_COL[cls] || CLASS_COL.vanguard;
    if (cls === 'technomancer') R.shieldTech(p.x, p.y - 6, col);
    else if (cls === 'voidadept') R.shieldVoid(p.x, p.y - 6, col);
    else R.shieldVan(p.x, p.y - 6, col);
  }

  function playCardFX(card, def, targetIdx, flavor) {
    var c = E.combat; if (!c) return;
    var pp = R.playerXY();
    var cls = E.run.cls, col = CLASS_COL[cls] || CLASS_COL.vanguard;
    var ti = (targetIdx >= 0 && c.enemies[targetIdx] && c.enemies[targetIdx].alive)
      ? targetIdx : c.enemies.findIndex(function (e) { return e.alive; });
    var tp = ti >= 0 ? R.enemyPos(ti) : null;
    var targets = [];
    c.enemies.forEach(function (en, idx) { if (en.alive) { var ep = R.enemyPos(idx); if (ep) targets.push(ep); } });
    var cost = ns.cardCost(def, card.up); if (cost == null) cost = def.cost || 0;
    var env = { pp: pp, sx: pp.x + 8, sy: pp.y - 10, tp: tp, targets: targets, col: col, cls: cls,
      power: Math.max(0, Math.min(4, cost)), pm: semiMul(card.id, 7), id: card.id };
    var m = MOTIF[CARD_MOTIF[card.id] || fallbackMotif(flavor, cls)] || MOTIF.utility;
    try { m.s(env); m.a(env); } catch (err) { /* never let a cosmetic fx break a turn */ }
  }

  function playCardAt(i, targetIdx) {
    setTargeting(false);
    if (i < 0 || !E.canPlay(i)) { renderHand(); return; }
    var card = E.combat.hand[i], def = ns.CARDS[card.id];
    var wasAttack = def.type === 'attack';
    var castFx = ns.cardFx(def, card.up, card.vtouch);
    var flavor = cardFlavor(def, castFx);
    var srcEl = $hand.children[i];
    var srcRect = srcEl ? srcEl.getBoundingClientRect() : null;
    var clone = srcEl ? srcEl.cloneNode(true) : null;
    E.events.length = 0;
    var ok = E.playCard(i, targetIdx);
    if (!ok) { renderHand(); return; }
    playCardFX(card, def, targetIdx, flavor);
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
    cardPlayFx(srcRect, clone, card, def); // after piles update so the blink sticks
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
      updatePotions();
    } else {
      U.refresh();
    }
  }

  function lock(on) { locked = on; }

  /* ---- action timeline: replay engine events with cosmetic stagger ---- */
  function playTimeline(evts, stepDelay, done) {
    var delay = 0;
    var pp = R.playerXY();
    // timing pre-pass: when one action hits several enemies (AoE), resolve their
    // damage and deaths together; multi-hits on a single enemy still stagger.
    function isHit(e) { return (e.type === 'dmg' || e.type === 'die') && e.who !== 'player'; }
    function gapFor(ty) {
      switch (ty) {
        case 'dmg': return 90;            // staggers enemy multi-hits on the player
        case 'die': return 140;
        case 'block': case 'heal': case 'status': return 60;
        case 'curse': return 100; case 'summon': return 160;
        case 'revive': return 260; case 'salvage': return 80; case 'win': return 250;
        default: return 0;
      }
    }
    var times = new Array(evts.length), endDelay = 0, _i = 0;
    while (_i < evts.length) {
      var _e = evts[_i];
      if (_e.type === 'enemyMove') { endDelay += stepDelay; times[_i] = endDelay; _i++; continue; }
      if (_e.type === 'cardPlayed') { times[_i] = 0; _i++; continue; }
      if (isHit(_e)) {
        var _j = _i, _idxs = {};
        while (_j < evts.length && isHit(evts[_j])) { _idxs[evts[_j].idx] = 1; _j++; }
        if (Object.keys(_idxs).length > 1) {                 // AoE wave -> simultaneous
          for (var _k = _i; _k < _j; _k++) times[_k] = endDelay;
          endDelay += 150;
        } else {                                             // single target -> staggered
          for (var _k2 = _i; _k2 < _j; _k2++) { times[_k2] = endDelay; endDelay += (evts[_k2].type === 'die') ? 140 : 90; }
        }
        _i = _j; continue;
      }
      times[_i] = endDelay; endDelay += gapFor(_e.type); _i++;
    }
    evts.forEach(function (e, _ei) {
      delay = times[_ei];
      switch (e.type) {
        case 'enemyMove':
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
              if (e.who === 'player') {
                shieldSound(); classShield(pp);   // archetype-specific shield bloom + sound
                R.setPlayerView(null, e.blockAfter);
                floater(pp.x + 26, pp.y - 24, '+' + e.amount + '⬡', 'block');
                updateHUD();
              } else {
                SFX.block();
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
        case 'summon':
          (function (e, d) {
            setTimeout(function () {
              var en = E.combat && E.combat.enemies[e.idx];
              if (en) { R.addEnemyView(en); SFX.play(); var pos = R.enemyPos(e.idx); R.burst(pos.x, pos.y, '#c86bff', 16); floater(pos.x, pos.y - 24, 'SUMMONED', 'status'); }
            }, d);
          })(e, delay);
          delay += 160;
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
        case 'revive':
          (function (e, d) {
            setTimeout(function () {
              R.flash();
              R.setPlayerView(e.hpAfter, null);
              floater(pp.x, pp.y - 50, '✦ PHYLACTERY ✦', 'crit');
              SFX.win();
              updateHUD();
            }, d);
          })(e, delay);
          delay += 260;
          break;
        case 'salvage':
          (function (e, d) {
            setTimeout(function () {
              toast('SALVAGED: ' + ns.CARDS[e.id].name.toUpperCase() + ' GRAFTED INTO YOUR DECK', 2000);
              floater(pp.x + 30, pp.y - 40, '+ ' + ns.CARDS[e.id].name, 'status');
            }, d);
          })(e, delay);
          delay += 80;
          break;
        case 'win':
          (function (d) { setTimeout(function () { R.flash(); }, d); })(delay);
          delay += 250;
          break;
      }
    });
    setTimeout(done, endDelay + 220);
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
    if (rw.bonusArtifact) subParts.push('TITHE: ' + ns.ARTIFACTS[rw.bonusArtifact].name.toUpperCase());
    s.appendChild(el('div', 'screen-sub', subParts.join(' · ')));
    [rw.artifact, rw.bonusArtifact].forEach(function (aid) {
      if (!aid) return;
      var a = ns.ARTIFACTS[aid];
      s.appendChild(el('div', 'gain-list', '<div><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) + ' — ' + esc(a.desc) + '</div>'));
    });

    if (rw.potion && !rw.potionTaken) {
      var pot = ns.POTIONS[rw.potion];
      var full = E.potionFull();
      var pb = el('div', 'panel-btn' + (full ? ' disabled' : ''),
        '<div class="pb-title"><span class="pb-icon">' + potionSVG(rw.potion) + '</span>GRAB POTION: ' + esc(pot.name) + '</div>' +
        '<div class="pb-desc">' + esc(pot.desc) + (full ? ' — BELT FULL' : '') + '</div>');
      pb.addEventListener('pointerdown', function () {
        if (E.potionFull()) { toast('POTION BELT FULL'); return; }
        SFX.coin();
        if (E.takeRewardPotion()) showReward();
      });
      s.appendChild(pb);
    } else if (rw.potion && rw.potionTaken) {
      s.appendChild(el('div', 'gain-list', '<div>◇ Stowed: ' + esc(ns.POTIONS[rw.potion].name) + '</div>'));
    }

    if (!rw.cards || rw.cards.length === 0) {
      // Salvage Doctrine forgoes card rewards
      if (E.hasEcho('salvage_doctrine')) s.appendChild(el('div', 'screen-sub', 'SALVAGE DOCTRINE · NO CARD REWARD'));
      var cbtn = el('button', 'btn', 'CONTINUE');
      cbtn.addEventListener('pointerdown', function () { SFX.tap(); E.finishReward(); U.refresh(); });
      s.appendChild(cbtn);
    } else if (!rw.cardTaken) {
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

  function cardEl(cid, up, vtouch) {
    var def = ns.CARDS[cid];
    var ctx = E.run ? { attrs: { might: E.attr('might'), tech: E.attr('tech'), psi: E.attr('psi') }, statuses: null } : null;
    var d = el('div', 'card type-' + def.type + rareClassOf(def.rarity) + (vtouch ? ' vtouched' : ''));
    d.innerHTML = cardInner(def.name + (up ? '+' : ''), def.xcost ? 'X' : ns.cardCost(def, up), def.type, def.rarity,
      ns.cardDesc(def, up, ctx, vtouch), def.unplayable, cid);
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
    if (fx.pick === 'vtouch') chip('Void-Touch a card', true);
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
      if (r.pendingRelic) {
        showEventRelic(function () { E.finishEvent(); U.refresh(); });
      } else if (r.pendingAddCard) {
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
    var titles = { remove: 'Purge a Card', upgrade: 'Refine a Card', dupe: 'Duplicate a Card', vtouch: 'Void-Touch a Card' };
    var verbs = { remove: 'Purge', upgrade: 'Refine', dupe: 'Duplicate', vtouch: 'Corrupt' };
    var okClass = { remove: 'red', upgrade: 'amber', dupe: 'cyan', vtouch: 'magenta' }[type] || '';
    s.appendChild(el('h2', 'screen-title', titles[type] || 'Choose a Card'));
    s.appendChild(el('div', 'screen-sub', 'TAP A CARD TO PREVIEW · CONFIRM TO ' + (verbs[type] || 'SELECT').toUpperCase()));
    var grid = el('div', 'card-grid');
    var cbar = makeConfirmBar();
    var any = false;
    r.deck.forEach(function (card, i) {
      var def = ns.CARDS[card.id];
      if (type === 'upgrade' && (card.up || def.type === 'curse')) return;
      if (type === 'dupe' && def.type === 'curse') return;
      if (type === 'vtouch' && (card.vtouch || def.type === 'curse')) return;
      any = true;
      var d = cardEl(card.id, card.up, card.vtouch);
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
      } else if (type === 'vtouch') {
        msg = 'Void-Touch <b>' + esc(name) + '</b>? It hits ~50% harder but costs 3 HP each play.';
        // preview the corrupted face while selected
        var baseV = d.innerHTML;
        var vHTML = cardEl(card.id, card.up, true).innerHTML;
        onSelect = function () { d.innerHTML = vHTML; d.classList.add('vtouched'); };
        onDeselect = function () { d.innerHTML = baseV; if (!card.vtouch) d.classList.remove('vtouched'); };
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

    if (sh.potion) {
      var pot = ns.POTIONS[sh.potion.id];
      var pfull = E.potionFull();
      var disabled = sh.potion.sold || pfull;
      var note = sh.potion.sold ? '' : pfull ? ' — BELT FULL' : '';
      var pb = el('div', 'panel-btn cyan' + (disabled ? ' disabled' : ''),
        '<div class="pb-title"><span class="pb-icon">' + potionSVG(sh.potion.id) + '</span>' + esc(pot.name) + ' — ¢' + sh.potion.cost + '</div>' +
        '<div class="pb-desc">' + esc(pot.desc) + note + '</div>');
      s.appendChild(pb);
      if (!disabled) {
        selectConfirm(s, pb, cbar, 'Buy <b>' + esc(pot.name) + '</b> for ¢' + sh.potion.cost + '?',
          function () { if (E.shopBuyPotion()) { SFX.coin(); showShop(); } else toast(E.potionFull() ? 'POTION BELT FULL' : 'NOT ENOUGH CREDITS'); }, 'cyan');
      } else if (pfull && !sh.potion.sold) {
        pb.addEventListener('pointerdown', function () { toast('POTION BELT FULL'); });
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

  // relic offered by an event: preview it, then TAKE or LEAVE it
  function showEventRelic(done) {
    var aid = E.run.pendingRelic;
    if (!aid) { done(); return; }
    var a = ns.ARTIFACTS[aid];
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Salvaged Relic'));
    s.appendChild(el('div', 'screen-sub', 'TAP TO PREVIEW · TAKE IT OR LEAVE IT'));
    var cbar = makeConfirmBar();
    var btn = el('div', 'panel-btn amber',
      '<div class="pb-title"><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) + '</div>' +
      '<div class="pb-desc">' + esc(a.desc) + '</div>');
    s.appendChild(btn);
    selectConfirm(s, btn, cbar, 'Take <b>' + esc(a.name) + '</b>?<span class="cb-note">' + esc(a.desc) + '</span>',
      function () { SFX.coin(); E.takeEventRelic(); done(); }, 'amber');
    var skip = el('button', 'btn dim small', 'LEAVE IT');
    skip.addEventListener('pointerdown', function () { SFX.tap(); E.skipEventRelic(); done(); });
    s.appendChild(skip);
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

  /* ====================== VICTORY (finale) ====================== */
  function showVictory() {
    combatChrome(false);
    updateHUD();
    var r = E.run;
    SFX.win();
    R.flash();
    var s = overlayScreen();
    s.appendChild(el('div', 'sector-banner victory-banner', 'THE UNMAKER FALLS'));
    var loopTxt = r.loop > 1 ? 'LOOP ' + r.loop + ' CONQUERED' : 'THE DESCENT IS CONQUERED';
    s.appendChild(el('div', 'screen-sub', loopTxt));
    s.appendChild(el('div', 'big-score', E.score() + ' PTS'));
    var lines = [
      'LOOP: ' + r.loop,
      'NODES CLEARED: ' + r.nodesCleared,
      'KILLS: ' + r.kills,
      'ECHOES HELD: ' + (r.echoes ? r.echoes.length : 0),
    ];
    var gl = el('div', 'gain-list');
    lines.forEach(function (l) { gl.appendChild(el('div', '', esc(l))); });
    s.appendChild(gl);

    var cont = el('div', 'panel-btn cyan',
      '<div class="pb-title">↻ ENTER THE RECURRENCE</div>' +
      '<div class="pb-desc">Begin again. Your powers fade and the void grows stronger — but you carry an Echo of yourself into the next loop.</div>');
    cont.addEventListener('pointerdown', function () {
      SFX.play();
      E.enterRecurrence();
      U.refresh();
    });
    s.appendChild(cont);

    var claim = el('div', 'panel-btn',
      '<div class="pb-title">★ CLAIM VICTORY</div>' +
      '<div class="pb-desc">End the run a victor. Your score is recorded.</div>');
    claim.addEventListener('pointerdown', function () {
      SFX.coin();
      E.claimVictory();
      U.refresh();
    });
    s.appendChild(claim);
  }

  /* ====================== THE RECURRENCE (NG+ loop) ====================== */
  // Vector glyph for an Echo: the void seraph's halo + eye, tinted.
  var ECHO_ICON = {
    p: [
      [0, -0.62, 0.42, -0.04, 0, 0.5, -0.42, -0.04, 0, -0.62],
      [-0.16, -0.04, 0, 0.1, 0.16, -0.04, 0, -0.2, -0.16, -0.04],
    ],
  };
  function echoSVG(cls) { return artSVG(ECHO_ICON, cls, '#b8ecff'); }

  function showRecurrenceIntro() {
    combatChrome(false);
    $hud.innerHTML = ''; setHud(false);
    var slides = [
      'Space warps around you like a void. Your mind goes blank…',
      'You find yourself in a familiar setting, an urge to continue… Haven’t you been here before?',
      'Powers you once had have faded — yet your surroundings seem… stronger.',
    ];
    var idx = 0;
    function render() {
      var s = overlayScreen();
      s.classList.add('recurrence-screen');
      s.appendChild(el('div', 'recurrence-loop', 'LOOP ' + E.run.loop));
      var p = el('div', 'event-text recurrence-text', '');
      s.appendChild(p);
      var finish = typeText(p, slides[idx], null);
      var btn = el('button', 'btn', idx < slides.length - 1 ? 'CONTINUE' : 'REACH INTO THE VOID');
      btn.addEventListener('pointerdown', function () {
        if (typing()) { finish(); return; }
        SFX.tap();
        idx++;
        if (idx < slides.length) render();
        else { E.recurrenceContinue(); U.refresh(); }
      });
      s.appendChild(btn);
      // tapping anywhere also completes the current line
      s.addEventListener('pointerdown', function (e2) {
        if (typing()) { finish(); e2.stopPropagation(); }
      }, true);
    }
    render();
  }

  function showEchoDraft() {
    $hud.innerHTML = ''; setHud(false);
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title victory-banner', 'A Void Echo'));
    s.appendChild(el('div', 'screen-sub', 'CLAIM ONE FRAGMENT OF A PAST SELF · IT IS YOURS FOREVER'));
    var cbar = makeConfirmBar();
    E.echoOffer().forEach(function (id) {
      var ec = ns.ECHOES[id];
      var btn = el('div', 'panel-btn echo-card',
        '<div class="pb-title"><span class="pb-icon echo-ic">' + echoSVG() + '</span>' + esc(ec.name) +
        ' <span class="aug-tag">' + esc(ec.tag) + '</span></div>' +
        '<div class="pb-desc">' + esc(ec.desc) + '</div>' +
        '<div class="pb-sub echo-flavor">' + esc(ec.flavor) + '</div>');
      s.appendChild(btn);
      selectConfirm(s, btn, cbar, 'Claim <b>' + esc(ec.name) + '</b>?<span class="cb-note">' + esc(ec.desc) + '</span>',
        function () { SFX.win(); E.chooseEcho(id); U.refresh(); }, 'cyan');
    });
    s.appendChild(cbar.el);
  }

  function showEchoLoadout() {
    $hud.innerHTML = ''; setHud(false);
    var r = E.run, slots = B.echoes.loadoutSlots;
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Attune Your Echoes'));

    function render() {
      // rebuild list region in place
      var old = s.querySelector('.echo-list'); if (old) old.remove();
      var oldsub = s.querySelector('.echo-sub'); if (oldsub) oldsub.remove();
      var oldbtn = s.querySelector('.echo-begin'); if (oldbtn) oldbtn.remove();
      var equipped = E.echoLoadout();
      s.appendChild(el('div', 'screen-sub echo-sub', 'EQUIP UP TO ' + slots + ' · ' + equipped.length + '/' + slots + ' ATTUNED'));
      var list = el('div', 'echo-list');
      r.echoes.forEach(function (id) {
        var ec = ns.ECHOES[id];
        var on = equipped.indexOf(id) >= 0;
        var full = !on && equipped.length >= slots;
        var card = el('div', 'panel-btn echo-card' + (on ? ' equipped' : '') + (full ? ' disabled' : ''),
          '<div class="pb-title"><span class="pb-icon echo-ic">' + echoSVG() + '</span>' + esc(ec.name) +
          ' <span class="aug-tag">' + esc(ec.tag) + '</span>' + (on ? ' <span class="echo-on">ATTUNED</span>' : '') + '</div>' +
          '<div class="pb-desc">' + esc(ec.desc) + '</div>');
        card.addEventListener('pointerdown', function () {
          if (full) { toast('LOADOUT FULL — UNEQUIP ONE FIRST'); return; }
          SFX.tap(); E.echoToggle(id); render();
        });
        list.appendChild(card);
      });
      s.appendChild(list);
      var begin = el('button', 'btn echo-begin', 'BEGIN THE LOOP');
      begin.addEventListener('pointerdown', function () { SFX.play(); E.beginLoop(); U.refresh(); });
      s.appendChild(begin);
    }
    render();
  }

  /* ====================== GAME OVER ====================== */
  function showGameOver() {
    combatChrome(false);
    setHud(false);
    var r = E.run;
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'Signal Lost'));
    s.appendChild(el('div', 'screen-sub', r.loop > 1 ? 'THE LOOP CLAIMS YOU IN LOOP ' + r.loop + ' · SECTOR ' + r.sector : 'YOUR DESCENT ENDS IN SECTOR ' + r.sector));
    s.appendChild(el('div', 'big-score', E.score() + ' PTS'));
    var best = E.getBest();
    var lines = [
      (r.loop > 1 ? 'LOOP REACHED: ' + r.loop + ' · SECTOR ' + r.sector : 'SECTOR REACHED: ' + r.sector),
      'NODES CLEARED: ' + r.nodesCleared,
      'KILLS: ' + r.kills,
      'ECHOES HELD: ' + (r.echoes ? r.echoes.length : 0),
    ];
    if (best) lines.push('', 'BEST: ' + best.score + ' PTS' + (best.loop > 1 ? ' (LOOP ' + best.loop + ')' : ' (SECTOR ' + best.sector + ')'));
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
      grid.appendChild(cardEl(card.id, card.up, card.vtouch));
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
    mute.addEventListener('pointerdown', function () {
      muted = !muted;
      if (ns.music) { ns.music.setMuted(muted); if (!muted) ns.music.start(); }
      showMenu();
    });
    s.appendChild(mute);

    if (ns.music && ns.music.setVolume) {
      var mv = Math.round((ns.music.getVolume ? ns.music.getVolume() : 0.7) * 100);
      var volRow = el('div', 'panel-btn cyan',
        '<div class="pb-title">♪ MUSIC VOLUME · <span id="volval">' + mv + '%</span></div>' +
        '<input id="volslider" class="vol-slider" type="range" min="0" max="100" value="' + mv + '">');
      var slider = volRow.querySelector('#volslider'), valSpan = volRow.querySelector('#volval');
      slider.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      slider.addEventListener('input', function () {
        var v = parseInt(slider.value, 10) || 0;
        valSpan.textContent = v + '%';
        ns.music.setVolume(v / 100);
        if (!muted && v > 0 && !ns.music.isOn()) ns.music.start();
      });
      s.appendChild(volRow);
    }

    var disp = el('div', 'panel-btn',
      '<div class="pb-title">' + orientLabel() + '</div>' +
      '<div class="pb-sub">Tap to cycle · Auto fits your screen</div>');
    disp.addEventListener('pointerdown', function () { SFX.tap(); cycleOrient(); showMenu(); });
    s.appendChild(disp);

    var fsb = makeFullscreenBtn(showMenu, '');
    if (fsb) s.appendChild(fsb);

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
