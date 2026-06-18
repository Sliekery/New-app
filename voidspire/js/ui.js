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

  var $hud, $hand, $controls, $overlay, $floaters, $toast, $energy, $hint, $counts, $game, $potions, $potionTip, $drawPile, $discardPile, $manifest, $rail, $railPanel, $railLine, $dock;
  var railOpen = null;      // which rail panel is open ('buffs'|'debuffs'|'relics'|'draw'|'discard') or null
  var selected = -1;        // selected hand index
  var manifestSel = -1;     // selected pet in the Manifest (tap-to-swap reorder)
  var targeting = false;
  var locked = false;       // input lock while timeline plays
  var toastTimer = null;
  var orient = 'auto';  // 'auto' (fit to screen) | 'portrait' | 'landscape' (persisted)
  var uiScale = 1;      // current #game transform scale — drag offsets divide by it

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
    E.interactive = true;   // in-combat choices (Scry/Tutor/Discover) wait for a player pick
    $game = document.getElementById('game');
    $hud = document.getElementById('hud');
    $hand = document.getElementById('hand');
    $controls = document.getElementById('combat-controls');
    $overlay = document.getElementById('overlay');
    $floaters = document.getElementById('floaters');
    $toast = document.getElementById('toast');

    // unified bottom dock frame (energy │ stims │ cards │ END all ride on it)
    $dock = el('div', '', '');
    $dock.id = 'combat-dock';
    $game.appendChild($dock);

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

    // The Warpcaller's Crew Manifest — the interactive formation panel (left of
    // the hand). Lists each pet with its model + HP/action; tap two cells to swap
    // their order. The front cell (top) is the one single-target attacks strike.
    $manifest = el('div', '', '');
    $manifest.id = 'manifest';
    $game.appendChild($manifest);

    // Cockpit rail — the buttons docked to the right edge (Buffs/Debuffs/Relics/
    // Draw/Discard); each opens a tactical panel above or below it.
    $rail = el('div', '', '');
    $rail.id = 'rail';
    $game.appendChild($rail);
    // leader line tying an open panel back to the button it sprang from
    $railLine = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    $railLine.setAttribute('id', 'rail-line');
    $railLine.innerHTML = '<polyline points="" fill="none" stroke-width="1.4" /><circle r="2.2" />';
    $railLine.style.display = 'none';
    $game.appendChild($railLine);
    $railPanel = el('div', '', '');
    $railPanel.id = 'rail-panel';
    $railPanel.style.display = 'none';
    $game.appendChild($railPanel);
    // a tap anywhere else closes an open panel
    document.addEventListener('pointerdown', function (ev) {
      if (railOpen && !$rail.contains(ev.target) && !$railPanel.contains(ev.target)) closeRail();
    }, true);

    // ---- card inspect: right-click (desktop) or long-press (touch) any card ----
    document.addEventListener('contextmenu', function (ev) {
      var c = ev.target.closest ? ev.target.closest('.card[data-cid]') : null;
      if (c) { ev.preventDefault(); SFX.tap(); inspectCard(c.dataset.cid, c.dataset.up === '1', c.dataset.vt === '1'); }
    });
    var lpT = null, lpX = 0, lpY = 0;
    function cancelLP() { if (lpT) { clearTimeout(lpT); lpT = null; } }
    document.addEventListener('pointerdown', function (ev) {
      if ($inspect) return;
      var c = ev.target.closest ? ev.target.closest('.card[data-cid]') : null;
      if (!c) return;
      lpX = ev.clientX; lpY = ev.clientY;
      lpT = setTimeout(function () {
        lpT = null;
        if (drag) { try { drag.el.style.transform = ''; drag.el.classList.remove('dragging'); } catch (e) {} drag = null; setTargeting(false); }
        SFX.tap(); inspectCard(c.dataset.cid, c.dataset.up === '1', c.dataset.vt === '1');
      }, 460);
    }, true);
    document.addEventListener('pointermove', function (ev) {
      if (lpT && Math.abs(ev.clientX - lpX) + Math.abs(ev.clientY - lpY) > 8) cancelLP();
    }, true);
    document.addEventListener('pointerup', cancelLP, true);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeInspect(); });

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
  // Scale-to-fit: render at a fixed design frame, then scale the whole #game
  // uniformly to fill the window — so a big screen looks like a bigger, crisp
  // version of the same layout (cards/HUD stay proportional, the canvas
  // re-renders sharp). A design size per orientation.
  var DESIGN = { portrait: [400, 868], landscape: [1024, 600] };
  function applyScale() {
    if (!$game) return;
    var d = isLandscape() ? DESIGN.landscape : DESIGN.portrait;
    var s = Math.min(window.innerWidth / d[0], window.innerHeight / d[1]);
    uiScale = s || 1;
    $game.style.setProperty('--design-w', d[0] + 'px');
    $game.style.setProperty('--design-h', d[1] + 'px');
    $game.style.setProperty('--ui-scale', s.toFixed(4));
    $game.classList.add('scaled');
  }
  function applyOrient() {
    var land = isLandscape();
    lastLandscape = land;
    if ($game) $game.classList.toggle('landscape', land);
    applyScale();                              // set the frame scale before the canvas reads its box
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
    applyScale();
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
      case 'press-luck': return showPressLuck();
      case 'shop': return showShop();
      case 'rest': return showRest();
      case 'forge': return showForge();
      case 'rift': return showRift();
      case 'levelup': return showLevelUp();
      case 'class-relic': return showClassRelic();
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
      fitCards(s);   // auto-scale any preview-card descriptions to fit
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
    $dock.style.display = on ? 'block' : 'none';
    $energy.style.display = on ? 'flex' : 'none';   // energy lives in the bottom dock now
    $counts.style.display = 'none';
    $drawPile.style.display = on ? 'block' : 'none';   // piles ride the dock corners (per-class art)
    $discardPile.style.display = on ? 'block' : 'none';
    if (!on && $rail) { $rail.style.display = 'none'; closeRail(); }
    $potions.style.display = on ? 'flex' : 'none';
    if (!on) { $hint.style.display = 'none'; onPotionCancel(); hidePotionTip(); }
    R.combatVisible = on;
    if (!on && $manifest) { $manifest.style.display = 'none'; manifestSel = -1; }
  }

  /* ====================== HUD ====================== */
  function setHud(on) { if ($hud) $hud.style.display = on ? '' : 'none'; }

  // star-chart glyph for the top map button (two nodes on a flight path)
  var MAP_ICON = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4.5 13.5 13 4.5" stroke-dasharray="2 2"/><circle cx="4.5" cy="13.5" r="2.2"/><circle cx="13" cy="4.5" r="2.2"/></svg>';
  function updateHUD() {
    var r = E.run;
    if (!r) { $hud.innerHTML = ''; setHud(false); renderManifest(); renderRail(); return; }
    setHud(true);
    var c = E.combat;
    var fac = ns.FACTIONS[r.faction];
    var hpPct = Math.max(0, r.hp / r.maxHp);
    var inCombat = !!c && r.phase === 'combat';   // in combat, HP/shield live on the cockpit gauge

    var onMap = r.phase === 'map';
    var html = '';
    // Out of combat, only the credits ride the top right (HP readout will return
    // in a later pass). In combat, HP is on the gauge and credits on the dock.
    if (!inCombat) {
      html += '<div class="row"><span class="spacer"></span>' +
        '<div class="stat"><b>¢' + r.credits + '</b></div></div>';
    }
    html += '<div class="row2">' +
      [['MGT', 'might'], ['TEC', 'tech'], ['PSI', 'psi'], ['BND', 'bond']].map(function (a) {
        var v = E.attr(a[1]); return v > 0 ? '<span class="attr">' + a[0] + ' <b>' + v + '</b></span>' : '';
      }).join('') +
      (onMap ? '<span class="attr" style="color:' + fac.color + '">' + (r.loop > 1 ? 'L' + r.loop + '·' : '') + 'S' + r.sector + ' ▴' + Math.max(0, r.mapRow + 1) + '/' + (B.map.rows + 1) + '</span>' : '') +
      '<span class="spacer"></span>' +
      (onMap ? '' : '<button class="icon-btn" data-act="map" title="Star chart">' + MAP_ICON + '</button>') +
      '<button class="icon-btn" data-act="menu">≡</button>' +
      '</div>';

    // relics show here ONLY on the star chart (where you toggle them on/off);
    // in combat they live on the cockpit rail instead.
    if (onMap && r.artifacts.length) {
      html += '<div class="artifact-row">';
      r.artifacts.forEach(function (id, i) {
        var a = ns.ARTIFACTS[id], cls = 'artifact-chip';
        if (a.quest) { var qs = E.questState(id); cls += qs.done ? ' quest-done' : ' quest'; }
        var uses = E.relicUsesLeft(id), spent = uses != null && uses <= 0;
        if (!E.relicActive(id)) cls += ' relic-off';
        if (!spent) cls += ' relic-toggle';
        var badge = (uses != null) ? '<span class="relic-uses">' + uses + '</span>' : '';
        html += '<div class="' + cls + '" data-art="' + i + '">' + artSVG(a.art, 'art-icon') + badge + '</div>';
      });
      html += '</div>';
    }

    if (c) {
      // Statuses (buffs/powers/debuffs) now live on the on-figure Dual-Rail bar.
      // The HUD only keeps Fusion-Charge timers, which aren't stack statuses.
      var chips = '';
      (c.primed || []).forEach(function (pr) {   // armed delayed detonations (Fusion Charge)
        chips += '<span class="status-chip primed">⏱ ' + pr.dmg + ' in ' + pr.turns + '</span>';
      });
      if (chips) html += '<div class="status-row">' + chips + '</div>';
    }

    $hud.innerHTML = html;

    $hud.querySelectorAll('[data-art]').forEach(function (chip) {
      chip.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation();
        var id = r.artifacts[+chip.dataset.art];
        if (r.phase === 'map' && E.toggleRelic(id)) {   // tap toggles a relic on the chart
          SFX.tap(); updateHUD();
          toast(ns.ARTIFACTS[id].name + (E.relicActive(id) ? ' — ONLINE' : ' — OFFLINE'), 1400);
        } else {
          toast(artifactTip(id), 2800);
        }
      });
    });
    var mapBtn = $hud.querySelector('[data-act="map"]');
    if (mapBtn) mapBtn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); SFX.tap(); showMap(true); });
    var menuBtn = $hud.querySelector('[data-act="menu"]');
    if (menuBtn) menuBtn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); showMenu(); });

    renderManifest();
    renderRail();
  }
  U.updateHUD = updateHUD;

  /* ====================== CREW MANIFEST (Warpcaller) ====================== */
  // icon glyph + colour per pet action, mirroring the on-field readout.
  var MF_ACT = {
    atk:     ['▶', '#ff6a6a'],   // ▶ strike
    burn:    ['≈', '#ff8a3d'],   // ≈ burn
    block:   ['⬡', '#6bd8ff'],   // ⬡ shield
    heal:    ['✚', '#6bff9d'],   // ✚ mend
    support: ['✦', '#ffd24a'],   // ✦ buff (adjacent)
  };
  function renderManifest() {
    if (!$manifest) return;
    var c = E.combat;
    var show = !!c && !!E.run && E.run.cls === 'warpcaller' && R.combatVisible && !c.over;
    $manifest.style.display = show ? 'flex' : 'none';
    if (!show) { manifestSel = -1; return; }
    var allies = c.allies;
    if (manifestSel >= allies.length) manifestSel = -1;
    var html = '<div class="mf-head">PACK <b>' + E.petSlots() + '/' + E.maxSlots() + '</b></div>';
    if (!allies.length) {
      html += '<div class="mf-empty">no units<br>summoned</div>';
    } else {
      allies.forEach(function (a, i) {
        var info = E.petInfo(a), ac = MF_ACT[info.icon] || MF_ACT.atk;
        var sz = a.def.size || 1, col = a.def.color || '#7b8cff';
        var m = a.model && ns.PET_MODELS[a.model] && ns.PET_MODELS[a.model].art;
        var svg = m ? artSVG(m, 'mf-art', col) : '';
        var hpPct = Math.max(0, a.hp / a.maxHp);
        var cls = 'mf-cell' + (i === 0 ? ' front' : '') + (i === manifestSel ? ' sel' : '') + (sz > 1 ? ' big' : '');
        html += '<div class="' + cls + '" data-mf="' + i + '">' +
          (i === 0 ? '<span class="mf-front">FRONT</span>' : '') +
          (sz > 1 ? '<span class="mf-size">' + sz + '□</span>' : '') +
          '<div class="mf-fig">' + svg + '</div>' +
          '<div class="mf-hp"><div class="mf-hp-fill" style="transform:scaleX(' + hpPct.toFixed(3) +
            ');background:' + (hpPct > 0.3 ? col : '#ff5b6b') + '"></div></div>' +
          '<div class="mf-stats"><span class="mf-act" style="color:' + ac[1] + '">' + ac[0] + info.val + '</span>' +
          '<span class="mf-hpn">♥' + Math.max(0, Math.ceil(a.hp)) + '</span></div>' +
        '</div>';
      });
    }
    $manifest.innerHTML = html;
    $manifest.querySelectorAll('[data-mf]').forEach(function (cell) {
      cell.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); onManifestTap(+cell.dataset.mf); });
    });
  }
  U.renderManifest = renderManifest;
  // Tap a pet to pick it up, tap another cell to swap their positions.
  function onManifestTap(i) {
    if (locked || !E.combat || E.combat.over) return;
    var allies = E.combat.allies;
    if (allies.length < 2) return;            // nothing to reorder with one pet
    SFX.tap();
    if (manifestSel < 0) { manifestSel = i; }
    else if (manifestSel === i) { manifestSel = -1; }  // tap again to cancel
    else { E.swapPets(manifestSel, i); manifestSel = -1; }
    renderManifest();
  }

  /* ====================== COCKPIT RAIL ====================== */
  function railDebuffs() {
    var c = E.combat; if (!c) return [];
    var st = c.player.statuses, out = [];
    ['vuln', 'weak', 'burn'].forEach(function (k) { if (st[k] > 0) out.push({ name: ns.STATUS_NAMES[k] || k, val: st[k] }); });
    return out;
  }
  // universal combat stats: always shown on top as buffs, never folded into a
  // power's row (so Might from Combat Stims still reads as "Might" up top).
  var CORE_BUFF = { str: 1, regen: 1, plate: 1, platedArmor: 1, thorns: 1, barricade: 1 };
  var BUFF_PRIORITY = ['str', 'block', 'regen', 'plate', 'platedArmor', 'thorns', 'barricade'];
  // the self-status a power maintains (its "value"), if any
  function powerSelfStatus(cc) {
    var d = ns.CARDS[cc.id]; if (!d) return null;
    var fx = (cc.up && d.up && d.up.fx) ? d.up.fx : d.fx;
    if (!fx) return null;
    for (var i = 0; i < fx.length; i++) { var f = fx[i]; if (f.k === 'status' && (f.who === 'self' || f.who == null)) return f.s; }
    return null;
  }
  function railPowers() {
    var c = E.combat; if (!c) return [];
    var seen = {}, out = [];
    c.consumed.forEach(function (cc) { var d = ns.CARDS[cc.id]; if (d && d.type === 'power' && !seen[cc.id]) { seen[cc.id] = true; out.push(cc); } });
    return out;
  }
  function railBuffs() {
    var c = E.combat; if (!c) return [];
    var st = c.player.statuses;
    // non-core statuses that a played power owns -> shown on the power, not here
    var owned = {};
    railPowers().forEach(function (cc) { var s = powerSelfStatus(cc); if (s && !CORE_BUFF[s]) owned[s] = 1; });
    var out = [];
    if (c.player.block > 0) out.push({ key: 'block', name: 'Shield', val: Math.round(c.player.block) });
    Object.keys(st).forEach(function (k) {
      if (st[k] <= 0 || k === 'vuln' || k === 'weak' || k === 'burn' || owned[k]) return;
      out.push({ key: k, name: ns.STATUS_NAMES[k] || k, val: st[k] });
    });
    out.sort(function (a, b) {
      var ap = BUFF_PRIORITY.indexOf(a.key), bp = BUFF_PRIORITY.indexOf(b.key);
      if (ap < 0) ap = 99; if (bp < 0) bp = 99;
      return ap !== bp ? ap - bp : (a.name < b.name ? -1 : 1);
    });
    return out;
  }

  // thin vector glyphs for the rail switches (stroke = the button's colour)
  function svgIc(body) {
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }
  var RAIL_ICON = {
    buffs: svgIc('<path d="M8 13V4"/><path d="M4.3 7.7 8 4l3.7 3.7"/>'),
    debuffs: svgIc('<path d="M8 3v9"/><path d="M4.3 8.3 8 12l3.7-3.7"/>'),
    relics: svgIc('<path d="M8 2.3 13.7 8 8 13.7 2.3 8Z"/><path d="M8 5.6 10.4 8 8 10.4 5.6 8Z"/>'),
    draw: svgIc('<rect x="5.4" y="4" width="7" height="9" rx="0.6"/><path d="M3.4 6.2V11a1.6 1.6 0 0 0 1.6 1.6h4.4"/>'),
    discard: svgIc('<rect x="4.4" y="3.6" width="7" height="9" rx="0.6"/><path d="M6.2 6.1 9.7 9.6M9.7 6.1 6.2 9.6"/>'),
  };
  function renderRail() {
    if (!$rail) return;
    var c = E.combat;
    var show = !!c && E.run && E.run.phase === 'combat' && R.combatVisible;
    $rail.style.display = show ? 'flex' : 'none';
    if (!show) { closeRail(); return; }
    var items = [
      { k: 'buffs', ic: RAIL_ICON.buffs, col: '#5dff88', n: railBuffs().length + railPowers().length },
      { k: 'debuffs', ic: RAIL_ICON.debuffs, col: '#ff4a5e', n: railDebuffs().length },
      { k: 'relics', ic: RAIL_ICON.relics, col: '#ffb02e', n: E.run.artifacts.length },
    ];
    $rail.innerHTML = items.map(function (it) {
      return '<div class="rail-row" style="--rc:' + it.col + '"><span class="rk-sw"></span>' +
        '<button class="rail-btn' + (railOpen === it.k ? ' active' : '') + '" data-rk="' + it.k + '">' +
        '<span class="rk-ic">' + it.ic + '</span><span class="rk-n">' + it.n + '</span></button></div>';
    }).join('');
    $rail.querySelectorAll('[data-rk]').forEach(function (btn) {
      btn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); onRailTap(btn.dataset.rk); });
    });
    if (railOpen === 'buffs' || railOpen === 'debuffs' || railOpen === 'relics') renderRailPanel(railOpen);
  }
  U.renderRail = renderRail;

  function onRailTap(k) {
    if (locked) return;
    SFX.tap();
    if (k === 'draw' || k === 'discard') { closeRail(); if (E.combat) showPileModal(k); return; }
    if (railOpen === k) { closeRail(); renderRail(); return; }
    // renderRail() rebuilds the buttons (detaching any passed node), then renders
    // the panel against the fresh button it re-queries — so don't pass a stale ref.
    railOpen = k; renderRail();
  }
  function closeRail() {
    if (!railOpen) return;
    railOpen = null;
    if ($railPanel) $railPanel.style.display = 'none';
    if ($railLine) $railLine.style.display = 'none';
    if ($rail) $rail.querySelectorAll('.rail-btn.active').forEach(function (b) { b.classList.remove('active'); });
  }

  var RAIL_COL = { buffs: '#5dff88', debuffs: '#ff4a5e', relics: '#ffb02e' };
  function renderRailPanel(k, btn) {
    if (!$railPanel) return;
    btn = btn || ($rail && $rail.querySelector('[data-rk="' + k + '"]'));
    if (!btn) return;
    var col = RAIL_COL[k] || '#5dff88';
    var title = { buffs: 'BUFFS & POWERS', debuffs: 'DEBUFFS', relics: 'RELICS' }[k] || k.toUpperCase();
    var body = k === 'buffs' ? buffsPanelHTML() : k === 'debuffs' ? debuffsPanelHTML() : relicsPanelHTML();
    $railPanel.style.setProperty('--rc', col);
    $railPanel.innerHTML = '<div class="rp-title">' + title + '</div><div class="rp-scroll">' + body + '</div>';
    $railPanel.style.display = 'block';
    positionRailPanel(btn);
    wireRailPanel(k);
  }
  // The callout floats just off the rail (battlefield side) and a leader line
  // links it to the button it sprang from — vector HUD, not a free-floating box.
  function positionRailPanel(btn) {
    if (!btn || !$railPanel || !$game) return;
    var gr = $game.getBoundingClientRect(), br = btn.getBoundingClientRect();
    var gameW = $game.clientWidth, gameH = $game.clientHeight;
    var scale = gr.width / gameW || 1;   // true on-screen scale (uiScale may be stale)
    var btnCX = (br.left + br.width / 2 - gr.left) / scale;
    var btnCY = (br.top + br.height / 2 - gr.top) / scale;
    var railRight = (br.right - gr.left) / scale;
    var pw = $railPanel.offsetWidth, ph = $railPanel.offsetHeight;
    // rail lives on the left edge -> panel opens to the right of it
    var left = railRight + 16;
    if (left + pw > gameW - 8) left = Math.max(8, gameW - 8 - pw);
    var top = Math.max(8, Math.min(gameH - ph - 8, btnCY - ph / 2));
    $railPanel.style.left = left + 'px';
    $railPanel.style.right = 'auto';
    $railPanel.style.top = top + 'px';
    drawRailLine(btnCX, btnCY, railRight, left, top, ph);
  }
  function drawRailLine(btnCX, btnCY, railRight, panelLeft, panelTop, panelH) {
    if (!$railLine) return;
    var gw = $game.clientWidth, gh = $game.clientHeight;
    $railLine.setAttribute('width', gw); $railLine.setAttribute('height', gh);
    $railLine.setAttribute('viewBox', '0 0 ' + gw + ' ' + gh);
    var col = RAIL_COL[railOpen] || '#5dff88';
    // elbow: button -> out into the gap -> up/down to the panel's near edge
    var anchorY = Math.max(panelTop + 7, Math.min(panelTop + panelH - 7, btnCY));
    var midX = (railRight + panelLeft) / 2;
    var pts = (railRight) + ',' + btnCY + ' ' + midX + ',' + btnCY + ' ' + midX + ',' + anchorY + ' ' + panelLeft + ',' + anchorY;
    var line = $railLine.querySelector('polyline'), dot = $railLine.querySelector('circle');
    line.setAttribute('points', pts); line.setAttribute('stroke', col);
    dot.setAttribute('cx', railRight); dot.setAttribute('cy', btnCY); dot.setAttribute('fill', col);
    $railLine.style.display = 'block';
  }

  // one expandable □ row + its hidden detail line (powers, relics)
  function rpExpRow(eid, head, detail) {
    return '<div class="rp-row rp-exp" data-eid="' + eid + '"><span class="rp-box">□</span>' + head + '</div>' +
      '<div class="rp-text" data-et="' + eid + '" style="display:none">' + detail + '</div>';
  }
  // a plain readout row (buffs / debuffs): bullet · name · value
  function rpReadRow(name, val, bad) {
    return '<div class="rp-row"><span class="rp-dot">◇</span><span class="rp-name">' + esc(name) +
      '</span><span class="rp-val' + (bad ? ' rp-bad' : '') + '">' + val + '</span></div>';
  }
  function buffsPanelHTML() {
    var buffs = railBuffs(), powers = railPowers();
    if (!buffs.length && !powers.length) return '<div class="rp-empty">no active buffs</div>';
    // Might / Shield / Regen etc. ride on top; powers follow in the order played.
    var st = E.combat.player.statuses, h = '';
    buffs.forEach(function (b) { h += rpReadRow(b.name, b.val, false); });
    powers.forEach(function (cc, i) {
      var d = ns.CARDS[cc.id], sKey = powerSelfStatus(cc);
      var val = (sKey && !CORE_BUFF[sKey] && st[sKey] > 0) ? st[sKey] : null;
      var head = '<span class="rp-name">' + esc(d.name) + '</span>' + (val != null ? '<span class="rp-val">' + val + '</span>' : '');
      h += rpExpRow('p' + i, head, esc(ns.cardDesc(d, cc.up, null, cc.vtouch)));
    });
    return h;
  }
  function debuffsPanelHTML() {
    var d = railDebuffs();
    if (!d.length) return '<div class="rp-empty">no debuffs</div>';
    return d.map(function (x) { return rpReadRow(x.name, x.val, true); }).join('');
  }
  function relicsPanelHTML() {
    var r = E.run;
    if (!r.artifacts.length) return '<div class="rp-empty">no relics</div>';
    var h = r.artifacts.map(function (id, i) {
      var a = ns.ARTIFACTS[id], active = E.relicActive(id), uses = E.relicUsesLeft(id);
      var spent = uses != null && uses <= 0;
      var tag = spent ? '<span class="rp-spent">SPENT</span>' : '<span class="rp-state ' + (active ? 'on' : 'off') + '">' + (active ? 'ONLINE' : 'OFFLINE') + '</span>';
      var dur = uses != null && !spent ? ' <span class="rp-dur">' + uses + ' left</span>' : '';
      var head = '<span class="rp-name rp-relic-name' + (active ? '' : ' off') + '">' + esc(a.name) + '</span>' + tag + dur;
      return rpExpRow('r' + i, head, esc(a.desc));
    }).join('');
    return h + '<div class="rp-sub">toggle relics on the star chart</div>';
  }
  function wireRailPanel(k) {
    var btn = $rail.querySelector('[data-rk="' + k + '"]');
    $railPanel.querySelectorAll('.rp-exp').forEach(function (row) {
      row.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation(); SFX.tap();
        var id = row.dataset.eid, txt = $railPanel.querySelector('.rp-text[data-et="' + id + '"]'), box = row.querySelector('.rp-box');
        var open = txt.style.display === 'none';
        txt.style.display = open ? 'block' : 'none'; box.textContent = open ? '▣' : '□';
        positionRailPanel(btn);
      });
    });
  }

  /* ====================== TITLE ====================== */
  var CLASS_INFO = {
    vanguard: { name: 'VANGUARD', tag: 'Shock trooper of the 9th Voidborne', desc: 'High HP. Brutal weapons that scale with MIGHT. Hits first, asks never.' },
    technomancer: { name: 'TECHNOMANCER', tag: 'Machine-priest of the Forge Choir', desc: 'Shields, turrets and reactors that scale with TECH. Out-build the enemy.' },
    voidadept: { name: 'VOID ADEPT', tag: 'Sanctioned psyker, mostly stable', desc: 'Burns, hexes and psionic blasts that scale with PSI. The void answers.' },
    warpcaller: { name: 'WARPCALLER', tag: 'Frail herald of the things between stars', desc: 'Glass cannon. Almost no HP — but your summoned pets fight, soak and scale with BOND. The pack does the killing.' },
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

    var codex = el('div', 'panel-btn magenta dim-panel', '<div class="pb-title">? CODEX</div><div class="pb-sub">Every mechanic, explained</div>');
    codex.addEventListener('pointerdown', function () { SFX.tap(); showCodex(false); });
    s.appendChild(codex);

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
    forge: 'Forge', beacon: 'Distress beacon', market: 'Black market', rift: 'Void rift',
  };
  var LANE_COLOR = { gauntlet: '#ff5b6b', supply: '#41d8ff', frontier: '#c86bff' };
  var LANE_LABEL = { gauntlet: 'GAUNTLET · danger & loot', supply: 'SUPPLY · sustain & shops', frontier: 'FRONTIER · the unknown' };
  var NODE_DESC = {
    fight: 'A standard enemy pack. Salvage and a card reward on victory.',
    elite: 'A dangerous mini-boss — but it drops a relic.',
    boss: 'The sector boss. Beat it to level up and jump onward.',
    event: 'An unknown signal: a decision with consequences.',
    random: 'Uncharted space. Could be anything.',
    shop: 'A trader. Spend credits on cards, relics and repairs.',
    rest: 'A quiet camp. Heal up, or refine a card.',
    treasure: 'A sealed cache holding a free relic.',
    forge: 'A weapons-forge: upgrade or strip a card from your deck.',
    beacon: 'A trap fight — but the risk pays in a relic and salvage-tech.',
    market: 'A black market: off-doctrine salvage-tech and cheap removal.',
    rift: 'A void anomaly. A great boon, paired with a price.',
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

  function showMap(preview) {
    updateHUD();
    var r = E.run, m = r.map;
    var s = overlayScreen(true);
    s.classList.add('map-screen');
    s.appendChild(el('h2', 'screen-title', 'Sector ' + r.sector + ' · Star Chart'));
    var started = r.mapRow >= 0;
    s.appendChild(el('div', 'screen-sub', esc(ns.FACTIONS[r.faction].name.toUpperCase()) + ' TERRITORY · ' + (preview ? 'TACTICAL VIEW' : started ? 'CHOOSE THE NEXT JUMP' : 'CHOOSE YOUR ENTRY POINT')));
    if (preview) {
      var back = el('button', 'btn map-back', '◀ RETURN');
      back.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); SFX.tap(); U.refresh(); });
      s.appendChild(back);
    }

    var COLS = m.COLS, ROWS = m.ROWS;
    var land = isLandscape();
    var lane = 100, step = 106;        // lane = perpendicular spacing, step = progress spacing
    var W = land ? (ROWS + 1) * step : COLS * lane;
    var H = land ? COLS * lane : (ROWS + 1) * step;
    var reach = E.mapReachable(), cur = E.currentNode();
    // fog of war: you scout ~3 rows ahead; further nodes show only their lane,
    // not the encounter, and resolve as you advance.
    var revealRow = (r.mapRow < 0 ? -1 : r.mapRow) + 3;

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
          var lc = LANE_COLOR[node.lane] || '#9fb6c0', op = cls === 'dim' ? 0.32 : cls === 'trav' ? 0.7 : 1;
          svg += '<line class="edge ' + cls + '" style="stroke:' + lc + ';opacity:' + op + '" x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '"/>';
          if (cls !== 'dim') {
            var mx = ((a.x + b.x) / 2).toFixed(1), my = ((a.y + b.y) / 2).toFixed(1);
            svg += '<circle class="waypt ' + cls + '" cx="' + mx + '" cy="' + my + '" r="1.8"/>';
          }
        });
      });
    }
    // nodes (glowing hex frames with reticle brackets on reachable ones)
    function nodeMarkup(node) {
      var isBoss = node.type === 'boss';
      var fogged = !isBoss && !node.visited && node.row > revealRow;
      var p = xy(node), icon = ns.MAP_ICONS[node.type] || ns.MAP_ICONS.fight;
      var nc = fogged ? (LANE_COLOR[node.lane] || '#5e8a6c') : icon.color;   // fogged: show only the lane
      var hexR = isBoss ? 29 : 20, size = isBoss ? 24 : 15;
      var reachable = reach.indexOf(node) >= 0;
      var state = node === cur ? 'current' : node.visited ? 'visited' : reachable ? 'reachable' : 'locked';
      var g = '<g class="mapnode ' + state + (fogged ? ' fogged' : '') + ' nt-' + node.type + '" data-row="' + node.row + '" data-col="' + node.col + '" style="--nc:' + nc + '">';
      if (reachable) {
        g += '<circle class="pulse" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + hexR + '"/>';
        g += '<circle class="pulse p2" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + hexR + '"/>';
      }
      g += '<polygon class="hexfill" points="' + hexPts(p.x, p.y, hexR) + '"/>';
      if (node.hazard) g += '<circle class="hazring" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (hexR + 4) + '"/>';
      g += '<polygon class="hex" points="' + hexPts(p.x, p.y, hexR) + '"/>';
      if (isBoss) g += '<polygon class="hex2" points="' + hexPts(p.x, p.y, hexR + 5) + '"/>';
      if (fogged) g += '<text class="fogq" x="' + p.x.toFixed(1) + '" y="' + (p.y + size * 0.42).toFixed(1) + '">?</text>';
      else g += '<g class="glyph">' + mapIconPaths(icon, p.x, p.y, size) + '</g>';
      if (reachable) g += cornerTicks(p.x, p.y, hexR + 5);
      g += '<circle class="hit" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (hexR + 10) + '"/>';
      return g + '</g>';
    }
    m.rows.forEach(function (row) { row.forEach(function (n) { svg += nodeMarkup(n); }); });
    svg += nodeMarkup(m.boss);
    // boss telegraph: name the sector boss looming at the end of the chart
    var bxy = xy(m.boss);
    svg += '<text class="boss-label" x="' + bxy.x.toFixed(1) + '" y="' + (bxy.y + (land ? 50 : 46)).toFixed(1) + '">' + esc(E.sectorBossName()) + '</text>';
    svg += '</svg>';

    var wrap = el('div', 'map-wrap' + (land ? ' land' : ''));
    wrap.innerHTML = svg;
    s.appendChild(wrap);

    var legend = el('div', 'map-legend');
    ['fight', 'elite', 'beacon', 'event', 'rift', 'shop', 'market', 'forge', 'rest', 'treasure', 'boss'].forEach(function (t) {
      var ic = ns.MAP_ICONS[t];
      legend.innerHTML += '<span class="leg"><span class="leg-ic" style="color:' + ic.color + '">' +
        '<svg viewBox="0 0 48 48">' + mapIconPaths(ic, 24, 24, 17) + '</svg></span>' + esc(NODE_LABEL[t]) + '</span>';
    });
    s.appendChild(legend);

    // lane key — which highway is which this sector
    var lanebar = el('div', 'map-lanes');
    (m.lanes || []).forEach(function (ln) {
      lanebar.innerHTML += '<span class="lane-key" style="--lc:' + LANE_COLOR[ln] + '"><span class="lane-dash"></span>' + esc(LANE_LABEL[ln]) + '</span>';
    });
    s.appendChild(lanebar);

    wrap.addEventListener('pointerdown', function (ev) {
      if (preview) return;   // read-only star-chart view (e.g. opened mid-combat)
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
    var r = E.run, t = r.treasure;
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Supply Cache'));
    if (!t || !t.choices || !t.choices.length) {
      s.appendChild(el('div', 'screen-sub', 'RELIC VAULT FULL — SALVAGED FOR +40 CREDITS'));
      var btn0 = el('button', 'btn', 'CONTINUE');
      btn0.addEventListener('pointerdown', function () { SFX.coin(); E.finishTreasure(); U.refresh(); });
      s.appendChild(btn0);
      return;
    }
    s.appendChild(el('div', 'screen-sub', 'CHOOSE ONE RELIC — THE REST RESEAL'));
    var cbar = makeConfirmBar();
    t.choices.forEach(function (id, i) {
      var a = ns.ARTIFACTS[id];
      var btn = el('div', 'panel-btn amber',
        '<div class="pb-title"><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) + '</div><div class="pb-desc">' + esc(a.desc) + '</div>');
      s.appendChild(btn);
      selectConfirm(s, btn, cbar, 'Take <b>' + esc(a.name) + '</b>?<span class="cb-note">' + esc(a.desc) + '</span>',
        function () { SFX.coin(); E.takeTreasureArtifact(i); E.finishTreasure(); U.refresh(); }, 'amber');
    });
    s.appendChild(cbar.el);
    var skip = el('button', 'btn', 'LEAVE IT');
    skip.addEventListener('pointerdown', function () { E.finishTreasure(); U.refresh(); });
    s.appendChild(skip);
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
    $potions.appendChild(el('div', 'belt-lbl', '<b class="belt-cr">¢' + r.credits + '</b> STIMS'));
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
      '<div class="pt-panel"><div class="pt-name">' + esc(pot.name) + ' <span class="pt-tag">STIM · ' + rarTag + '</span></div>' +
      '<div class="pt-desc">' + esc(pot.desc) + '</div></div><div class="pt-ptr"></div>';
    $potionTip.style.display = 'block';
    // float the tactical callout centred ABOVE the slot, pointer aimed at it
    var gr = $game.getBoundingClientRect(), cr = chipEl.getBoundingClientRect();
    var scale = gr.width / $game.clientWidth || 1;
    var slotCX = (cr.left + cr.width / 2 - gr.left) / scale;
    var slotTop = (cr.top - gr.top) / scale;
    var tipW = $potionTip.offsetWidth, tipH = $potionTip.offsetHeight;
    var left = Math.max(6, Math.min($game.clientWidth - tipW - 6, slotCX - tipW / 2));
    $potionTip.style.right = 'auto';
    $potionTip.style.left = left + 'px';
    $potionTip.style.top = Math.max(6, slotTop - tipH - 11) + 'px';
    $potionTip.style.setProperty('--ptr', (slotCX - left) + 'px');
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
      potionDrag.el.style.transform = 'translate(' + (potionDrag.dx / uiScale) + 'px,' + (potionDrag.dy / uiScale) + 'px) scale(1.12)';
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

  // bolt-in-a-hexagon energy glyph (the indicator that sits left of the cards)
  var ENERGY_GLYPH = '<svg class="en-ic" viewBox="0 0 24 24" fill="none">' +
    '<path d="M12 2.4 21 7.2v9.6L12 21.6 3 16.8V7.2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<path d="M13 6.2 8.4 12.8h3.4L11 17.8l4.6-6.6h-3.4Z" fill="currentColor"/></svg>';
  function updateEnergy() {
    var c = E.combat;
    if (!c) return;
    var mx = E.maxEnergy ? E.maxEnergy() : c.energy;
    $energy.innerHTML = ENERGY_GLYPH + '<span class="en-n">' + c.energy + '<span class="en-mx">/' + mx + '</span></span>';
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

  // In-combat card pickers for the colorless tech (Scry / Tutor / Discover).
  function showChoiceModal() {
    var c = E.combat, p = c && c.pending;
    if (!p) { afterAction(false); return; }
    var s = overlayScreen(true);
    var titles = { scry: 'SCRY', tutor: 'REQUISITION', discover: 'DISCOVER' };
    var subs = {
      scry: 'TAP CARDS TO DISCARD THEM — THE REST STAY ON TOP OF YOUR DECK',
      tutor: 'TAP A CARD TO PULL IT INTO YOUR HAND',
      discover: 'TAP A CARD TO ADD IT TO YOUR HAND',
    };
    s.appendChild(el('h2', 'screen-title', titles[p.kind]));
    s.appendChild(el('div', 'screen-sub', subs[p.kind]));
    var marked = {};
    var grid = el('div', 'card-grid');
    p.cards.forEach(function (card) {
      var ce = cardEl(card.id, card.up, card.vtouch);
      ce.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation(); SFX.tap();
        if (p.kind === 'scry') {
          if (marked[card.uid]) { delete marked[card.uid]; ce.classList.remove('pick-ditch'); }
          else { marked[card.uid] = true; ce.classList.add('pick-ditch'); }
        } else if (p.kind === 'tutor') { E.resolveTutor(card.uid); finishChoice(); }
        else { E.resolveDiscover(card.uid); finishChoice(); }
      });
      grid.appendChild(ce);
    });
    s.appendChild(grid);
    if (p.kind === 'scry') {
      var done = el('button', 'btn', 'CONFIRM');
      done.addEventListener('pointerdown', function () { SFX.tap(); E.resolveScry(Object.keys(marked).map(Number)); finishChoice(); });
      s.appendChild(done);
    } else {
      var skip = el('button', 'btn ghost', p.kind === 'tutor' ? 'TAKE NOTHING' : 'SKIP');
      skip.addEventListener('pointerdown', function () { SFX.tap(); c.pending = null; finishChoice(); });
      s.appendChild(skip);
    }
  }
  function finishChoice() {
    hideOverlay();
    showCombat();
    afterAction(false);
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
  function cardMotifSVG(cid) {
    return artSVG(ns.cardMotif(ns.cardClass(cid)), 'cmotif-svg');
  }
  var TYPE_BADGE = {
    attack: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13 13 3M8 3h5v5"/></svg>',
    skill: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 2.5 13 5v4.5L8 13.5 3 9.5V5Z"/></svg>',
    power: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5.6" cy="8" r="3"/><circle cx="10.4" cy="8" r="3"/></svg>',
    curse: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"/></svg>',
  };
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
      '<div class="ctype t-' + type + '">' + (TYPE_BADGE[type] || '') + '</div>' +
      '<div class="cname">' + esc(name) + '</div>' +
      '<div class="cart"><span class="cmotif">' + cardMotifSVG(cid) + '</span>' + cardGlyphSVG(cid) + '</div>' +
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
      var d = el('div', 'card type-' + info.type + ' cls-' + ns.cardClass(card.id) + rareClassOf(info.rarity) +
        (info.vtouch ? ' vtouched' : '') +
        (info.cost > c.energy && !info.unplayable ? ' unaffordable' : '') +
        (info.unplayable ? ' unplayable-curse' : '') +
        (info.corrupt ? ' corrupted' : '') +
        (!info.unplayable && E.swarmDisabled(i) ? ' swarm-disabled' : '') +
        (deal ? ' deal' : '') +
        (i === selected ? ' selected' : ''));
      if (deal) d.style.setProperty('--d', (i * 55) + 'ms');
      // fan the hand into an arc so cards don't simply stack behind each other
      var off = i - mid;
      var rot = off * spread;
      var ty = Math.abs(off) * Math.abs(off) * 1.5;
      d.style.setProperty('--fan', 'rotate(' + rot.toFixed(2) + 'deg) translateY(' + ty.toFixed(1) + 'px)');
      d.dataset.cid = card.id; if (card.up) d.dataset.up = '1'; if (info.vtouch) d.dataset.vt = '1';
      d.innerHTML = cardInner(info.name, info.xcost ? 'X' : info.cost, info.type, info.rarity, info.desc, info.unplayable, card.id);
      d.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation();
        startCardDrag(d, i, ev);
      });
      $hand.appendChild(d);
    });
    fitCards($hand);
  }

  // Auto-scale each card's description down until it fits its box (the standard
  // card-game fix for variable text length — no clipping, no overflow).
  function fitOne(desc) {
    desc.style.fontSize = '';                 // reset to the CSS default
    var cs = parseFloat(getComputedStyle(desc).fontSize) || 8.5;
    var guard = 0;
    while (desc.scrollHeight > desc.clientHeight + 0.5 && cs > 5.5 && guard++ < 14) {
      cs -= 0.4; desc.style.fontSize = cs.toFixed(2) + 'px';
    }
  }
  function fitCards(root) {
    if (!root) return;
    (root.querySelectorAll ? root : document).querySelectorAll('.card .cdesc').forEach(fitOne);
  }
  U.fitCards = fitCards;

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
      // the card lives inside the scaled #game frame, so divide the screen-space
      // drag offset by the scale to keep the card pinned under the finger
      drag.el.style.transform = 'translate(' + (drag.dx / uiScale) + 'px,' + (drag.dy / uiScale) + 'px) scale(' + (1 + Math.min(0.25, -lift / 400)) + ')';
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
    if (E.swarmDisabled(d.idx)) { setTargeting(false); toast('DISABLED — a Void Swarm grips this card'); return; }
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
  // Discard and exhaust LOOK DIFFERENT, each in its class's own idiom. A card
  // that lands in the discard pile gets a "disc" style (and a small nudge
  // toward the pile); a card that is exhausted/consumed gets an "exh" style
  // that destroys it in place. Warpcaller has no entry here and falls back to
  // the legacy CLASS_FX dematerialise below.
  //  Vanguard     — frag (shatters toward the pile)  / incinerate (burns bottom-up)
  //  Technomancer — cache (pixel-fades, files away)   / delete (RGB-split glitch)
  //  Void Adept   — drift (sinks off, fading rune)    / unmake (cracks, implodes)
  var CARD_FX = {
    vanguard:     { color: '#ffb02e', disc: 'cf-van-disc',  exh: 'cf-van-exh',  dLife: 300, eLife: 440 },
    technomancer: { color: '#41d8ff', disc: 'cf-tech-disc', exh: 'cf-tech-exh', dLife: 430, eLife: 420 },
    voidadept:    { color: '#c86bff', disc: 'cf-void-disc', exh: 'cf-void-exh', dLife: 540, eLife: 480 },
  };
  function cardPlayFx(rect, clone, card, def) {
    if (!rect) return;
    var w = rect.width, h = rect.height;
    var bf = document.getElementById('battlefield').getBoundingClientRect();
    var cx = rect.left + w / 2 - bf.left, cy = rect.top + h / 2 - bf.top;
    var c = E.combat;
    var consumed = !!c && (c.exhaust.some(function (x) { return x.uid === card.uid; }) ||
                           c.consumed.some(function (x) { return x.uid === card.uid; }));

    var cf = CARD_FX[E.run.cls];
    if (!cf) {                                    // warpcaller / unstyled: legacy dematerialise
      var fx = CLASS_FX[E.run.cls] || CLASS_FX.vanguard;
      if (clone) {
        clone.classList.add('card-ghost', fx.cls);
        clone.classList.remove('selected', 'dragging', 'deal', 'unaffordable');
        clone.style.position = 'fixed'; clone.style.margin = '0'; clone.style.transition = 'none'; clone.style.transform = 'none';
        clone.style.left = rect.left + 'px'; clone.style.top = rect.top + 'px';
        clone.style.width = w + 'px'; clone.style.height = h + 'px';
        clone.style.setProperty('--beam', fx.color);
        // body, not $game: #game is transform-scaled, which would make this
        // position:fixed ghost resolve against the game's local (scaled) space.
        document.body.appendChild(clone);
        setTimeout(function () { clone.remove(); }, fx.life + 80);
      }
      if (fx.mode === 'shatter') { R.burst(cx, cy, fx.color, 22); R.burst(cx, cy, '#fff3d6', 9); }
      else if (fx.mode === 'implode') { R.implode(cx, cy, fx.color, w * 0.82, h * 0.92, 24); R.implode(cx, cy, '#f0d6ff', w * 0.55, h * 0.65, 9); }
      else { R.beam(cx, cy, fx.color, w * 0.74, h * 0.82, 24); R.beam(cx, cy, '#e6fbff', w * 0.6, h * 0.7, 12); }
      blinkPile(consumed ? null : $discardPile, fx.color);
      return;
    }

    // Where the discard pile sits, so discards can lean toward it.
    var dpx = cx, dpy = cy + h;
    if ($discardPile) {
      var dpr = $discardPile.getBoundingClientRect();
      dpx = dpr.left + dpr.width / 2 - bf.left; dpy = dpr.top + dpr.height / 2 - bf.top;
    }
    var dir = Math.atan2(dpy - cy, dpx - cx);

    if (clone) {
      clone.classList.add('card-ghost', consumed ? cf.exh : cf.disc);
      clone.classList.remove('selected', 'dragging', 'deal', 'unaffordable');
      clone.style.position = 'fixed'; clone.style.margin = '0'; clone.style.transition = 'none'; clone.style.transform = 'none';
      clone.style.left = rect.left + 'px'; clone.style.top = rect.top + 'px';
      clone.style.width = w + 'px'; clone.style.height = h + 'px';
      clone.style.setProperty('--beam', cf.color);
      if (!consumed) {                            // discards drift a touch toward the pile
        var k = 0.26;
        var tx = Math.max(-90, Math.min(90, (dpx - cx) * k));
        var ty = Math.max(-70, Math.min(120, (dpy - cy) * k));
        clone.style.setProperty('--tx', tx.toFixed(1) + 'px');
        clone.style.setProperty('--ty', ty.toFixed(1) + 'px');
      }
      // body, not $game: #game is transform-scaled, which would otherwise
      // resolve this position:fixed ghost against the game's scaled space.
      document.body.appendChild(clone);
      setTimeout(function () { clone.remove(); }, (consumed ? cf.eLife : cf.dLife) + 90);
    }

    // Canvas particles matched to each CSS leave style.
    if (E.run.cls === 'vanguard') {
      if (consumed) { R.embers(cx, cy + h * 0.22, '#ff7a1e', 16); R.embers(cx, cy, '#ffd23d', 8); R.ring(cx, cy + h * 0.34, '#ff7a1e', 26, 0.4); }
      else { R.shards(cx, cy, cf.color, 13, dir, 0.85); R.burst(cx, cy, '#fff3d6', 7); }
    } else if (E.run.cls === 'technomancer') {
      if (consumed) { R.glitch(cx, cy, cf.color); R.glitch(cx, cy, '#ff3b6b'); R.glitch(cx, cy, '#3bd9ff'); R.burst(cx, cy, cf.color, 7); }
      else { var bx = cx + (dpx - cx) * 0.4, by = cy + (dpy - cy) * 0.4; R.beamBolt(cx, cy, bx, by, cf.color, 1.3); R.implode(cx, cy, cf.color, w * 0.66, h * 0.76, 11); }
    } else {                                       // voidadept
      if (consumed) { R.implode(cx, cy, cf.color, w * 0.86, h * 0.96, 22); R.ring(cx, cy, '#f0d6ff', 30, 0.32); R.burst(cx, cy, '#f0d6ff', 8); }
      else { R.sigil(cx, cy, cf.color, 20); R.ring(cx, cy, cf.color, 24, 0.5); }
    }

    blinkPile(consumed ? null : $discardPile, cf.color);
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
    mind_storm: 'psiStorm', tk_crush: 'crush', exsanguinate: 'drainBolt',
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
    var castFx = ns.cardFx(def, card.up, card.vtouch);
    var flavor = cardFlavor(def, castFx);
    var srcEl = $hand.children[i];
    var srcRect = srcEl ? srcEl.getBoundingClientRect() : null;
    var clone = srcEl ? srcEl.cloneNode(true) : null;
    E.events.length = 0;
    var ok = E.playCard(i, targetIdx);
    if (!ok) { renderHand(); return; }
    playCardFX(card, def, targetIdx, flavor);
    R.playerAnim(def.type === 'attack' ? 'attack' : def.type === 'power' ? 'utility' : 'defend', targetIdx);
    var evts = E.events.slice();
    E.events.length = 0;
    lock(true);
    playTimeline(evts, 70, function () {
      lock(false);
      if (E.combat && E.combat.pending) showChoiceModal();   // Scry/Tutor/Discover need a pick
      else afterAction(false);
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
      // resync the on-figure Shield to the engine: the start-of-turn block wipe
      // (startPlayerTurn) clears block silently with no event, so without this the
      // canvas shield keeps showing last turn's leftover until the next block event.
      if (E.combat) R.setPlayerView(null, E.combat.player.block);
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
        case 'curse': return 100; case 'summon': return 160; case 'infect': return 120; case 'absorb': return 120; case 'charge': return 100; case 'jam': return 120; case 'corrupt': return 160; case 'overload': return 120; case 'discipline': return 90;
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
                if (e.warded) txt = 'SHIELDED';
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
        case 'infect':
          (function (e, d) {
            setTimeout(function () {
              toast('INFECTED — ' + ns.CARDS[e.card].name.toUpperCase() + ' burrows into your deck', 2200);
              floater(pp.x + 30, pp.y - 44, '☣ INFECTED', 'status');
              SFX.curse && SFX.curse();
            }, d);
          })(e, delay);
          delay += 120;
          break;
        case 'absorb':
          (function (e, d) {
            setTimeout(function () {
              var pos = R.enemyPos(e.idx);
              floater(pos.x, pos.y - 36, 'ABSORBED', 'block');
              if (e.card) toast('OVERLOAD — a VOID SWARM is flung into your deck (it disables its neighbours in hand)', 2400);
            }, d);
          })(e, delay);
          delay += 120;
          break;
        case 'charge':
          (function (e, d) {
            setTimeout(function () {
              var pos = R.enemyPos(e.idx);
              floater(pos.x, pos.y - 36, '⚡ PRIMING', 'status');
              toast('WIND-UP — damage it now to weaken the incoming hit', 1900);
            }, d);
          })(e, delay);
          delay += 100;
          break;
        case 'jam':
          (function (e, d) {
            setTimeout(function () {
              floater(pp.x + 30, pp.y - 44, '⊗ JAMMED', 'status');
              if (e.card) toast('JAMMED — ' + ns.CARDS[e.card].name.toUpperCase() + ' is burned out of this combat', 2200);
              SFX.curse && SFX.curse();
            }, d);
          })(e, delay);
          delay += 120;
          break;
        case 'corrupt':
          (function (e, d) {
            setTimeout(function () {
              floater(pp.x + 30, pp.y - 44, '⟳ CORRUPTED', 'status');
              if (e.card) toast('VOID-CORRUPTED — ' + ns.CARDS[e.card].name.toUpperCase() + ' now costs 1 more, permanently', 2600);
              SFX.curse && SFX.curse();
              renderHand();
            }, d);
          })(e, delay);
          delay += 160;
          break;
        case 'overload':
          (function (e, d) {
            setTimeout(function () {
              var pos = R.enemyPos(e.idx); R.burst(pos.x, pos.y, '#ff7a1e', 18); R.ring(pos.x, pos.y, '#ff7a1e', 34, 0.4);
              floater(pos.x, pos.y - 18, '⚠ OVERLOAD', 'status');
              if (SFX.hit) SFX.hit();
            }, d);
          })(e, delay);
          delay += 120;
          break;
        case 'discipline':
          (function (e, d) {
            setTimeout(function () {
              floater(pp.x + 30, pp.y - 50, 'DISCIPLINE!', 'status');
              if (SFX.hit) SFX.hit();
            }, d);
          })(e, delay);
          delay += 90;
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
    if (rw.bonusArtifact) subParts.push('TITHE: ' + ns.ARTIFACTS[rw.bonusArtifact].name.toUpperCase());
    s.appendChild(el('div', 'screen-sub', subParts.join(' · ')));
    if (rw.bonusArtifact) {   // the Unmaker's Tithe relic is auto-granted
      var ab = ns.ARTIFACTS[rw.bonusArtifact];
      s.appendChild(el('div', 'gain-list', '<div><span class="pb-icon">' + artSVG(ab.art) + '</span>' + esc(ab.name) + ' — ' + esc(ab.desc) + '</div>'));
    }
    if (rw.artifactChoices && rw.artifactChoices.length && !rw.artifactPicked) {   // elite: pick 1 of 2
      s.appendChild(el('div', 'screen-sub', 'CHOOSE A RELIC'));
      var acbar = makeConfirmBar();
      rw.artifactChoices.forEach(function (aid, i) {
        var a = ns.ARTIFACTS[aid];
        var apb = el('div', 'panel-btn amber',
          '<div class="pb-title"><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) + '</div><div class="pb-desc">' + esc(a.desc) + '</div>');
        s.appendChild(apb);
        selectConfirm(s, apb, acbar, 'Take <b>' + esc(a.name) + '</b>?<span class="cb-note">' + esc(a.desc) + '</span>',
          function () { SFX.coin(); E.takeRewardArtifact(i); showReward(); }, 'amber');
      });
      s.appendChild(acbar.el);
    } else if (rw.artifact) {
      var ap = ns.ARTIFACTS[rw.artifact];
      s.appendChild(el('div', 'gain-list', '<div><span class="pb-icon">' + artSVG(ap.art) + '</span>' + esc(ap.name) + ' — ' + esc(ap.desc) + '</div>'));
    }
    // make the relic choice resolve before the rest of the reward
    if (rw.artifactChoices && rw.artifactChoices.length && !rw.artifactPicked) {
      var skipR = el('button', 'btn dim small', 'LEAVE THE RELIC');
      skipR.addEventListener('pointerdown', function () { SFX.tap(); rw.artifactPicked = true; showReward(); });
      s.appendChild(skipR);
      return;
    }

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
    var d = el('div', 'card type-' + def.type + ' cls-' + ns.cardClass(cid) + rareClassOf(def.rarity) + (vtouch ? ' vtouched' : ''));
    d.dataset.cid = cid; if (up) d.dataset.up = '1'; if (vtouch) d.dataset.vt = '1';
    d.innerHTML = cardInner(def.name + (up ? '+' : ''), def.xcost ? 'X' : ns.cardCost(def, up), def.type, def.rarity,
      ns.cardDesc(def, up, ctx, vtouch), def.unplayable, cid);
    return d;
  }

  /* ====================== card inspect (right-click / long-press) ====================== */
  var $inspect = null;
  function closeInspect() { if ($inspect) { $inspect.remove(); $inspect = null; } }
  U.closeInspect = closeInspect;
  function inspectCard(cid, up, vtouch) {
    var def = ns.CARDS[cid]; if (!def) return;
    closeInspect();
    var ov = el('div', 'card-inspect');
    var wrap = el('div', 'ci-wrap');
    var box = el('div', 'ci-cardbox');
    var card = cardEl(cid, up, vtouch);
    card.classList.add('ci-card');
    box.appendChild(card); wrap.appendChild(box);
    // keyword glossary entries that appear in this card's (cleaned) text
    var ctx = E.run ? { attrs: { might: E.attr('might'), tech: E.attr('tech'), psi: E.attr('psi') }, statuses: null } : null;
    var desc = ns.cardDesc(def, up, ctx, vtouch) + (def.exhaust ? ' Exhaust.' : '') + (def.retain ? ' Retain.' : '') + (vtouch ? ' Void-Touched.' : '');
    var found = [];
    Object.keys(ns.KEYWORDS).forEach(function (kw) {
      var re = new RegExp('\\b' + kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b');
      if (found.indexOf(kw) < 0 && re.test(desc)) found.push(kw);
    });
    var kl = el('div', 'ci-keys');
    kl.innerHTML = found.length
      ? '<div class="ci-keys-h">KEYWORDS</div>' + found.map(function (kw) {
          return '<div class="ci-key"><span class="ci-key-n">' + esc(kw) + '</span><span class="ci-key-d">' + esc(ns.KEYWORDS[kw]) + '</span></div>';
        }).join('')
      : '<div class="ci-none">No keywords to explain on this card.</div>';
    wrap.appendChild(kl);
    wrap.appendChild(el('div', 'ci-hint', 'tap anywhere to close'));
    ov.appendChild(wrap);
    ov.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); SFX.tap(); closeInspect(); });
    ($game || document.body).appendChild(ov);
    $inspect = ov;
    var dd = card.querySelector('.cdesc'); if (dd) fitOne(dd);
  }
  U.inspectCard = inspectCard;

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
  /* ====================== GAMBLE DEN ====================== */
  var DIE_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function diePips(v) {
    var on = DIE_PIPS[v] || [], h = '';
    for (var i = 0; i < 9; i++) h += '<span class="pip' + (on.indexOf(i) >= 0 ? ' on' : '') + '"></span>';
    return h;
  }
  /* ---- d20 skill-check die: a vector icosahedron that tumbles to its roll ---- */
  function d20SVG(n, cls) {
    var R = 46, pts = [];
    for (var i = 0; i < 6; i++) { var a = (-90 + 60 * i) * Math.PI / 180; pts.push([R * Math.cos(a), R * Math.sin(a)]); }
    var hex = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ') + ' Z';
    var tR = 23, tri = [];
    for (var j = 0; j < 3; j++) { var b = (-90 + 120 * j) * Math.PI / 180; tri.push([tR * Math.cos(b), tR * Math.sin(b)]); }
    var triPath = tri.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ') + ' Z';
    var spokes = '';
    for (var k = 0; k < 3; k++) { var hp = pts[k * 2]; spokes += '<line x1="' + tri[k][0].toFixed(1) + '" y1="' + tri[k][1].toFixed(1) + '" x2="' + hp[0].toFixed(1) + '" y2="' + hp[1].toFixed(1) + '"/>'; }
    return '<svg class="d20 ' + (cls || '') + '" viewBox="-52 -52 104 104">' +
      '<path class="d20-hex" d="' + hex + '"/>' +
      '<g class="d20-facet"><path d="' + triPath + '"/>' + spokes + '</g>' +
      '<text class="d20-num" x="0" y="2" text-anchor="middle" dominant-baseline="central">' + n + '</text></svg>';
  }
  // Animate a die in `box` decelerating to res.roll, then reveal pass/fail. Returns a skip fn.
  function rollDie(box, res, onSettle) {
    box.innerHTML = '<div class="d20-wrap">' + d20SVG('?', 'rolling') + '</div><div class="d20-readout"></div>';
    var svg = box.querySelector('.d20'), numEl = svg.querySelector('.d20-num'), read = box.querySelector('.d20-readout');
    var pre = (res.attr ? res.attr.toUpperCase() + ' · ' : '') + 'DC ' + res.dc + (res.bonus ? ' · you +' + res.bonus : '');
    read.innerHTML = '<span class="d20-dc">' + pre + '</span>';
    var ticks = 0, max = 18, timer = null, settled = false;
    function settle() {
      if (settled) return; settled = true;
      if (timer) clearTimeout(timer);
      numEl.textContent = res.roll;
      svg.classList.remove('rolling');
      svg.classList.add(res.pass ? 'pass' : 'fail');
      var total = res.roll + (res.bonus || 0);
      read.innerHTML = '<span class="d20-eq">' + res.roll + (res.bonus ? ' +' + res.bonus + ' = ' + total : '') + ' vs ' + res.dc + '</span>' +
        '<span class="d20-res ' + (res.pass ? 'ok' : 'no') + '">' + (res.pass ? 'SUCCESS' : 'FAILURE') + '</span>';
      if (SFX) { if (res.pass) SFX.win(); else SFX.lose(); }
      if (onSettle) onSettle();
    }
    function tick() {
      ticks++;
      if (SFX && SFX.dice) SFX.dice();
      if (ticks >= max) { settle(); return; }
      numEl.textContent = 1 + Math.floor(Math.random() * 20);
      var delay = 32 + Math.pow(ticks / max, 2.4) * 210; // decelerate toward the landing
      timer = setTimeout(tick, delay);
    }
    tick();
    return settle; // call to skip straight to the result
  }

  function wheelHTML(N, winSegs, rot) {
    var R = 46, segs = '';
    for (var i = 0; i < N; i++) {
      var a0 = (i / N) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / N) * 2 * Math.PI - Math.PI / 2;
      var x0 = (R * Math.cos(a0)).toFixed(1), y0 = (R * Math.sin(a0)).toFixed(1), x1 = (R * Math.cos(a1)).toFixed(1), y1 = (R * Math.sin(a1)).toFixed(1);
      var col = i < winSegs ? '#41ff9d' : '#ff4a6e';
      segs += '<path d="M0 0 L' + x0 + ' ' + y0 + ' A' + R + ' ' + R + ' 0 0 1 ' + x1 + ' ' + y1 + ' Z" fill="' + col + '" fill-opacity="0.09"/>';
      segs += '<path d="M' + x0 + ' ' + y0 + ' A' + R + ' ' + R + ' 0 0 1 ' + x1 + ' ' + y1 + '" fill="none" stroke="' + col + '" stroke-width="3" stroke-opacity="0.9"/>';
      segs += '<line x1="0" y1="0" x2="' + x0 + '" y2="' + y0 + '" stroke="rgba(127,224,255,0.30)" stroke-width="0.5"/>';
    }
    return '<svg class="g-wheel" viewBox="-50 -50 100 100" style="transform:rotate(' + rot + 'deg)">' + segs +
      '<circle r="' + R + '" fill="none" stroke="#7fe0ff" stroke-width="0.9"/></svg>';
  }
  function wheelReticle(N) {
    var ticks = '';
    for (var i = 0; i < N; i++) {
      var a = (i / N) * 2 * Math.PI - Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
      ticks += '<line x1="' + (47 * c).toFixed(1) + '" y1="' + (47 * s).toFixed(1) + '" x2="' + (52 * c).toFixed(1) + '" y2="' + (52 * s).toFixed(1) + '" stroke="#3a6b78" stroke-width="1"/>';
    }
    return '<svg class="wheel-fixed" viewBox="-56 -56 112 112">' +
      '<circle r="54.5" fill="none" stroke="rgba(127,224,255,0.22)" stroke-width="0.7"/>' +
      '<circle r="50" fill="none" stroke="#274652" stroke-width="0.8"/>' + ticks +
      '<line x1="-6" y1="0" x2="6" y2="0" stroke="#3a6b78" stroke-width="0.6"/><line x1="0" y1="-6" x2="0" y2="6" stroke="#3a6b78" stroke-width="0.6"/>' +
      '<circle r="9" fill="#06121a" stroke="#7fe0ff" stroke-width="1.2"/><circle r="2.4" fill="#7fe0ff"/></svg>';
  }
  function cardHTML(v, i) {
    var face = v >= 11 ? 'A' : '' + v;
    return '<div class="g-card"><div class="gc-inner" style="animation-delay:' + (i * 0.18) + 's">' +
      '<div class="gc-face gc-back"></div><div class="gc-face gc-front"><span>' + face + '</span></div></div></div>';
  }
  function gambleStageIdle(game) {
    if (game === 'bones') return '<div class="dice-game"><div class="dice-row"><div class="die">' + diePips(5) + '</div><div class="die">' + diePips(2) + '</div></div></div>';
    if (game === 'wheel') return '<div class="wheel-wrap"><div class="wheel-ptr">▼</div>' + wheelReticle(12) + wheelHTML(12, 6, 0) + '</div>';
    return '<div class="bj"><div class="bj-row"><span class="bj-lbl">HOUSE</span><div class="g-card2"><div class="gc2 back"></div></div><div class="g-card2"><div class="gc2 back"></div></div></div></div>';
  }
  function showGamble(ev) {
    updateHUD();
    var info = E.gambleInfo();
    var s = overlayScreen(true);
    s.classList.add('gamble-screen');
    var frame = el('div', 'comm-frame'); frame.innerHTML = artSVG(ev.art, 'portrait', ev.art.c); s.appendChild(frame);
    s.appendChild(el('h2', 'screen-title', esc(ev.title)));
    var gn = { bones: 'BONES · TWO DICE', wheel: 'THE WHEEL', cards: 'THE CUT · 21' }[info.game];
    s.appendChild(el('div', 'screen-sub', gn + ' · FORTUNE +' + (info.core * 2) + '% [' + info.coreName.toUpperCase() + ']'));
    var stage = el('div', 'gamble-stage'); s.appendChild(stage);
    var panel = el('div', 'gamble-panel'); s.appendChild(panel);
    if (info.phase === 'bet') gambleBet(ev, info, stage, panel);
    else gambleReveal(ev, info, stage, panel);
  }
  function gambleBet(ev, info, stage, panel) {
    stage.innerHTML = gambleStageIdle(info.game);
    panel.appendChild(el('div', 'gamble-prompt', 'STAKE YOUR SCRIP — ¢' + info.credits + ' ON HAND'));
    info.tiers.forEach(function (t) {
      var afford = t.cost > 0 && info.credits >= t.cost;
      var btn = el('div', 'panel-btn amber' + (afford ? '' : ' disabled'),
        '<div class="pb-title">' + Math.round(t.frac * 100) + '% · ¢' + t.cost + '  →  ' + esc(t.label) + '</div>' +
        '<div class="pb-desc">' + Math.round(t.p * 100) + '% to win · lose the stake on a bust</div>');
      if (afford) btn.addEventListener('pointerdown', function () { SFX.tap(); E.gamblePlay(t.frac); showGamble(ev); });
      panel.appendChild(btn);
    });
    var walk = el('button', 'btn dim small', 'WALK AWAY');
    walk.addEventListener('pointerdown', function () { SFX.tap(); E.gambleFinish(); U.refresh(); });
    panel.appendChild(walk);
  }
  function gambleReveal(ev, info, stage, panel) {
    var res = info.result, d = res.detail, game = info.game;
    if (game === 'bones') animateBones(stage, d);
    else if (game === 'wheel') animateWheel(stage, d);
    else animateCards(stage, d);
    panel.innerHTML = '<div class="gamble-rolling">' + (game === 'wheel' ? 'THE WHEEL SPINS…' : game === 'cards' ? 'THE DEAL…' : 'THE BONES TUMBLE…') + '</div>';
    var dur = game === 'wheel' ? 2400 : game === 'cards' ? 1500 : 1300;
    setTimeout(function () {
      SFX[res.won ? 'coin' : 'tap']();
      panel.innerHTML = '';
      panel.appendChild(el('div', 'gamble-result ' + (res.won ? 'win' : 'lose'), res.won ? '✦ FORTUNE FAVORS YOU' : '✕ THE HOUSE TAKES IT'));
      if (res.won) {
        var claim = el('button', 'btn', 'CLAIM ' + (res.prize === 'potion' ? 'STIM' : res.prize === 'card' ? 'CARD' : 'RELIC'));
        claim.addEventListener('pointerdown', function () {
          SFX.coin(); claim.remove();
          gamblePayout(panel, E.gambleClaim());
          var cont = el('button', 'btn', 'LEAVE'); cont.addEventListener('pointerdown', function () { E.gambleFinish(); U.refresh(); }); panel.appendChild(cont);
        });
        panel.appendChild(claim);
      } else {
        panel.appendChild(el('div', 'gamble-lost', 'You stake ¢' + res.cost + ' and walk away lighter.'));
        var cont2 = el('button', 'btn', 'LEAVE'); cont2.addEventListener('pointerdown', function () { SFX.tap(); E.gambleFinish(); U.refresh(); }); panel.appendChild(cont2);
      }
    }, dur);
  }
  function gamblePayout(panel, got) {
    got = got || {};
    var msg = got.potion ? 'STIM WON · ' + esc(ns.POTIONS[got.potion].name)
      : got.card ? 'CARD WON · ' + esc(ns.CARDS[got.card].name) + ' added to your deck'
      : got.relic ? 'RELIC WON · ' + esc(ns.ARTIFACTS[got.relic].name)
      : got.credits ? 'No room — salvaged for +' + got.credits + ' credits' : '';
    if (msg) panel.appendChild(el('div', 'gamble-payout', msg));
  }
  function rd6() { return 1 + Math.floor(Math.random() * 6); }
  function animateBones(stage, d) {
    stage.innerHTML = '<div class="dice-game"><div class="dice-row"><div class="die rolling"></div><div class="die rolling"></div></div><div class="dice-sum"></div></div>';
    var dice = stage.querySelectorAll('.die'), sum = stage.querySelector('.dice-sum'), t = 0;
    var iv = setInterval(function () {
      t++;
      if (t >= 12) {
        clearInterval(iv);
        dice[0].innerHTML = diePips(d.a); dice[1].innerHTML = diePips(d.b);
        dice[0].classList.remove('rolling'); dice[1].classList.remove('rolling');
        sum.innerHTML = '<b>' + (d.a + d.b) + '</b> · need ' + d.target + '+';
      } else { dice[0].innerHTML = diePips(rd6()); dice[1].innerHTML = diePips(rd6()); }
    }, 95);
  }
  function animateWheel(stage, d) {
    stage.innerHTML = '<div class="wheel-wrap"><div class="wheel-ptr">▼</div>' + wheelReticle(d.N) + wheelHTML(d.N, d.winSegs, 0) + '</div>';
    var w = stage.querySelector('.g-wheel');
    var finalRot = d.spins * 360 - ((d.seg + 0.5) / d.N) * 360;
    requestAnimationFrame(function () { requestAnimationFrame(function () { w.style.transform = 'rotate(' + finalRot + 'deg)'; }); });
  }
  function animateCards(stage, d) {
    function row(lbl, hand, total) {
      return '<div class="bj-row"><span class="bj-lbl">' + lbl + '</span>' +
        hand.map(function (v) { return '<div class="g-card2" data-v="' + v + '"><div class="gc2 back"></div></div>'; }).join('') +
        '<span class="bj-total" style="opacity:0">' + total + '</span></div>';
    }
    stage.innerHTML = '<div class="bj">' + row('YOU', d.player, d.pTotal) + row('HOUSE', d.dealer, d.dTotal) + '</div>';
    var cards = stage.querySelectorAll('.g-card2'), totals = stage.querySelectorAll('.bj-total');
    cards.forEach(function (card, i) {
      setTimeout(function () {
        card.classList.add('flip');                    // squash edge-on
        setTimeout(function () {
          var v = +card.dataset.v, face = v >= 11 ? 'A' : '' + v;
          var inner = card.querySelector('.gc2');
          inner.className = 'gc2 front'; inner.innerHTML = '<span>' + face + '</span>';
          card.classList.remove('flip');               // open face-up
        }, 150);
      }, 230 + i * 170);
    });
    setTimeout(function () { totals.forEach(function (t) { t.style.opacity = '1'; }); }, 230 + cards.length * 170 + 220);
  }

  function showEvent() {
    updateHUD();
    var ev = E.getEvent();
    if (ev && ev.gambleDen) return showGamble(ev);
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
    if (fx.tradeCard) chip('Trade up a card', true);
    if (fx.tradeRelic) chip('Trade a relic', true);
    if (fx.curse) chip('Curse', false);
    return out.join('');
  }

  function choicePreviewHTML(ch) {
    var pre = '';
    if (ch.cost) pre += '<span class="fx-chip bad">−' + ch.cost + '¢</span>';
    if (ch.pressLuck) {
      pre += '<span class="fx-chip check">⚠ PRESS YOUR LUCK</span>';
      var seen = {}, pc = '';
      (ch.pressLuck.steps || []).forEach(function (st) { var c = fxChips(st); if (c && !seen[c]) { seen[c] = 1; pc += c; } });
      if (pc) pre += '<span class="pv-row">↑ ' + pc + '</span>';
      var bf = fxChips(ch.pressLuck.bustFx); if (bf) pre += '<span class="pv-row">✗ ' + bf + '</span>';
      return pre ? '<div class="pv">' + pre + '</div>' : '';
    }
    if (ch.sell) {
      pre += '<span class="fx-chip good">Sell ' + (ch.sell.kind === 'relic' ? 'a relic' : 'a card') + ' → ¢</span>';
      return '<div class="pv">' + pre + '</div>';
    }
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
      s.appendChild(diceBox);
    }

    var body = el('div', '', '');
    body.style.opacity = animate && diceBox ? '0' : '1';
    body.style.transition = 'opacity 0.35s';
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
      } else if (r.pendingTrade) {
        showTrade(function () { E.finishEvent(); U.refresh(); });
      } else if (r.pendingSell) {
        showSell(function () { E.finishEvent(); U.refresh(); });
      } else {
        E.finishEvent();
        U.refresh();
      }
    });
    body.appendChild(btn);
    s.appendChild(body);

    if (diceBox && animate) {
      var skip = rollDie(diceBox, res, function () { body.style.opacity = '1'; });
      // first tap settles the die instantly instead of acting
      s.addEventListener('pointerdown', function once(e2) {
        if (body.style.opacity === '0') { skip(); e2.stopPropagation(); s.removeEventListener('pointerdown', once, true); }
      }, true);
    } else if (diceBox) {
      rollDie(diceBox, res, null)();  // render the landed die immediately (no animation)
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
    s.appendChild(el('h2', 'screen-title', sh.market ? 'Black Market' : 'Free Trader'));
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
    var node = E.currentNode && E.currentNode();
    var atHeart = node && node.heart;
    s.appendChild(el('h2', 'screen-title', atHeart ? 'The Destroyed Heart' : 'Field Camp'));
    s.appendChild(el('div', 'screen-sub', atHeart
      ? 'A VAST RUINED HEART, LONG DEAD. ITS LAST WARMTH IS YOURS — STEEL YOURSELF.'
      : 'THE GUNS GO QUIET FOR A WHILE'));
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

  /* ====================== FORGE (deck-sculpting node) ====================== */
  function showForge() {
    updateHUD();
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Forge'));
    s.appendChild(el('div', 'screen-sub', 'A WEAPONS-FORGE GLOWS IN THE WRECK · TEMPER YOUR ARSENAL'));
    var cbar = makeConfirmBar();
    function pick(action, label, cls, msg) {
      var btn = el('div', 'panel-btn ' + cls, label);
      s.appendChild(btn);
      selectConfirm(s, btn, cbar, msg, function () {
        E.forgePick(action);
        showPickModal(action, function () {
          if (E.run.pendingPick) { E.cancelPick(); showForge(); return; }
          E.finishForge(); U.refresh();
        });
      }, cls);
    }
    pick('upgrade', '<div class="pb-title">▲ UPGRADE A CARD</div><div class="pb-desc">Permanently upgrade one card in your deck.</div>', 'amber', 'Upgrade a card at the forge?');
    pick('remove', '<div class="pb-title">✕ STRIP A CARD</div><div class="pb-desc">Permanently remove one card from your deck.</div>', 'red', 'Strip a card from your deck?');
    var skip = el('div', 'panel-btn', '<div class="pb-title">→ MOVE ON</div><div class="pb-desc">Leave the forge cold and jump onward.</div>');
    s.appendChild(skip);
    selectConfirm(s, skip, cbar, 'Leave the forge?', function () { E.finishForge(); U.refresh(); }, '');
    s.appendChild(cbar.el);
  }

  /* ====================== VOID RIFT (anomaly node) ====================== */
  function showRift() {
    updateHUD();
    var r = E.run, rift = r.rift;
    if (!rift) { U.refresh(); return; }
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'Void Rift'));
    s.appendChild(el('div', 'screen-sub', 'REALITY FRAYS · THE ANOMALY GIVES, AND IT TAKES'));
    s.appendChild(resourceLine());
    var body = el('div', '', '');
    body.appendChild(el('div', 'event-text event-result-text', esc(rift.boon + ' ' + rift.bane)));
    if (rift.gained && rift.gained.length) {
      var gl = el('div', 'gain-list');
      rift.gained.forEach(function (g) { gl.appendChild(el('div', '', esc(g))); });
      body.appendChild(gl);
    }
    s.appendChild(body);
    var btn = el('button', 'btn', 'CONTINUE');
    btn.addEventListener('pointerdown', function () { SFX.tap(); E.finishRift(); U.refresh(); });
    s.appendChild(btn);
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

  // Trade-up flow: card-for-card or relic-for-relic.
  function showTrade(done) {
    var t = E.run.pendingTrade;
    if (!t) { done(); return; }
    if (t.kind === 'card') return showTradeCard(done);
    return showTradeRelic(done);
  }

  // Scrap one card -> forge a card a tier higher. Show the result before closing.
  function showTradeCard(done) {
    var r = E.run;
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'Trade Up'));
    s.appendChild(el('div', 'screen-sub', 'SCRAP A CARD · FORGE ONE A TIER HIGHER'));
    var grid = el('div', 'card-grid');
    var cbar = makeConfirmBar();
    var any = false;
    r.deck.forEach(function (card, i) {
      var def = ns.CARDS[card.id];
      if (def.type === 'curse') return;
      any = true;
      var d = cardEl(card.id, card.up, card.vtouch);
      grid.appendChild(d);
      selectConfirm(grid, d, cbar, 'Scrap <b>' + esc(def.name) + '</b> to forge a stronger card?',
        function () {
          var got = E.tradeCardPick(i);
          SFX.coin();
          if (got) showTradeReveal(got.got, 'FORGED', done); else done();
        }, 'amber');
    });
    s.appendChild(grid);
    if (!any) { E.skipTrade(); s.appendChild(el('div', 'screen-sub', 'NO TRADEABLE CARDS')); }
    else s.appendChild(cbar.el);
    var skip = el('button', 'btn dim small', 'KEEP YOUR DECK');
    skip.addEventListener('pointerdown', function () { SFX.tap(); E.skipTrade(); done(); });
    s.appendChild(skip);
  }

  // Relic-for-relic: surrender one, then pick one of two unknowns.
  function showTradeRelic(done) {
    var r = E.run, t = r.pendingTrade;
    if (t.given) return showTradeRelicTake(done);
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Relic Exchange'));
    s.appendChild(el('div', 'screen-sub', 'SURRENDER A RELIC FOR A CHANCE AT TWO MORE'));
    var cbar = makeConfirmBar();
    var owned = E.tradeableRelics();
    owned.forEach(function (aid) {
      var a = ns.ARTIFACTS[aid];
      var btn = el('div', 'panel-btn',
        '<div class="pb-title"><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) + '</div>' +
        '<div class="pb-desc">' + esc(a.desc) + '</div>');
      s.appendChild(btn);
      selectConfirm(s, btn, cbar, 'Surrender <b>' + esc(a.name) + '</b>? You will choose from two unknown relics.',
        function () { SFX.tap(); E.tradeGiveRelic(aid); showTradeRelicTake(done); }, 'red');
    });
    s.appendChild(cbar.el);
    var skip = el('button', 'btn dim small', 'WALK AWAY');
    skip.addEventListener('pointerdown', function () { SFX.tap(); E.skipTrade(); done(); });
    s.appendChild(skip);
  }

  function showTradeRelicTake(done) {
    var t = E.run.pendingTrade;
    var choices = (t && t.choices) || [];
    if (!choices.length) { E.skipTrade(); done(); return; }
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Choose Your Salvage'));
    s.appendChild(el('div', 'screen-sub', 'TAP TO PREVIEW · TAKE ONE'));
    var cbar = makeConfirmBar();
    choices.forEach(function (aid) {
      var a = ns.ARTIFACTS[aid];
      var btn = el('div', 'panel-btn amber',
        '<div class="pb-title"><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) + '</div>' +
        '<div class="pb-desc">' + esc(a.desc) + '</div>');
      s.appendChild(btn);
      selectConfirm(s, btn, cbar, 'Take <b>' + esc(a.name) + '</b>?<span class="cb-note">' + esc(a.desc) + '</span>',
        function () { SFX.coin(); E.tradeTakeRelic(aid); done(); }, 'amber');
    });
    s.appendChild(cbar.el);
  }

  // Brief reveal of a forged/received card before continuing.
  function showTradeReveal(cid, tag, done) {
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', tag || 'ACQUIRED'));
    var grid = el('div', 'card-grid');
    grid.appendChild(cardEl(cid, false));
    s.appendChild(grid);
    var btn = el('button', 'btn', 'CONTINUE');
    btn.addEventListener('pointerdown', function () { SFX.tap(); done(); });
    s.appendChild(btn);
  }

  /* ---- Sell screen: liquidate one of your cards/relics for credits ---- */
  function showSell(done) {
    var r = E.run, p = r.pendingSell;
    if (!p) { done(); return; }
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', p.kind === 'relic' ? 'Liquidate a Relic' : 'Liquidate a Card'));
    s.appendChild(el('div', 'screen-sub', 'TAP TO PREVIEW · SELL ONE FOR CREDITS'));
    var cbar = makeConfirmBar();
    var opts = E.sellOptions();
    if (!opts.length) { E.skipSell(); s.appendChild(el('div', 'screen-sub', 'NOTHING TO SELL')); var b0 = el('button', 'btn dim', 'BACK'); b0.addEventListener('pointerdown', function () { done(); }); s.appendChild(b0); return; }
    if (p.kind === 'relic') {
      opts.forEach(function (o) {
        var a = ns.ARTIFACTS[o.id];
        var btn = el('div', 'panel-btn amber',
          '<div class="pb-title"><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) + ' <span class="aug-tag">¢' + o.value + '</span></div>' +
          '<div class="pb-desc">' + esc(a.desc) + '</div>');
        s.appendChild(btn);
        selectConfirm(s, btn, cbar, 'Sell <b>' + esc(a.name) + '</b> for ¢' + o.value + '?',
          function () { SFX.coin(); E.sellPick(o.id); done(); }, 'amber');
      });
      s.appendChild(cbar.el);
    } else {
      var grid = el('div', 'card-grid');
      opts.forEach(function (o) {
        var d = cardEl(o.id, o.up, o.vtouch);
        d.appendChild(el('div', 'price', '¢' + o.value));
        grid.appendChild(d);
        selectConfirm(grid, d, cbar, 'Sell <b>' + esc(ns.CARDS[o.id].name) + '</b> for ¢' + o.value + '?',
          function () { SFX.coin(); E.sellPick(o.idx); done(); }, 'amber');
      });
      s.appendChild(grid);
      s.appendChild(cbar.el);
    }
    var skip = el('button', 'btn dim small', 'KEEP EVERYTHING');
    skip.addEventListener('pointerdown', function () { SFX.tap(); E.skipSell(); done(); });
    s.appendChild(skip);
  }

  /* ---- Press-your-luck screen: PUSH for more (rising bust risk) or BANK ---- */
  function showPressLuck(rollRes) {
    updateHUD();
    var info = E.pressLuckInfo();
    if (!info) { U.refresh(); return; }
    var ev = E.getEvent();
    var s = overlayScreen();
    if (ev && ev.art) {
      var mini = el('div', 'comm-frame mini');
      mini.innerHTML = artSVG(ev.art, 'portrait', ev.art.c) + '<div class="comm-scan"></div>';
      s.appendChild(mini);
    }
    s.appendChild(el('h2', 'screen-title', esc(ev ? ev.title : 'PRESS YOUR LUCK')));
    s.appendChild(resourceLine());

    // accrued pot
    var pot = el('div', 'pl-pot');
    var potChips = '';
    info.accrued.forEach(function (fx) { potChips += fxChips(fx); });
    pot.innerHTML = '<div class="pl-pot-lbl">SECURED IF YOU BANK</div><div class="pl-pot-chips">' + (potChips || '<span class="pl-empty">— nothing yet —</span>') + '</div>';
    s.appendChild(pot);

    // the die stage (animates on a push)
    var stage = el('div', 'pl-stage');
    s.appendChild(stage);

    var meter = el('div', 'pl-meter');
    s.appendChild(meter);

    var actions = el('div', 'pl-actions');
    s.appendChild(actions);

    function paintMeter() {
      var nfo = E.pressLuckInfo();
      if (nfo.done) { meter.innerHTML = '<div class="pl-risk max">VEIN EXHAUSTED · BANK YOUR HAUL</div>'; return; }
      var pct = Math.round(nfo.bustChance * 100);
      var nx = fxChips(nfo.nextReward) || '';
      meter.innerHTML = '<div class="pl-next">NEXT ' + esc(info.pushVerb) + ': ' + nx + '</div>' +
        '<div class="pl-risk' + (pct >= 50 ? ' hot' : '') + '">BUST RISK <b>' + pct + '%</b></div>';
    }
    function paintActions(locked) {
      var nfo = E.pressLuckInfo();
      actions.innerHTML = '';
      if (!nfo.done) {
        var push = el('button', 'btn pl-push' + (locked ? ' disabled' : ''), info.pushVerb);
        push.addEventListener('pointerdown', function () { if (!locked) doPush(); });
        actions.appendChild(push);
      }
      var bank = el('button', 'btn dim pl-bank' + (locked ? ' disabled' : ''), 'BANK' + (nfo.accrued.length ? ' & LEAVE' : ' (LEAVE)'));
      bank.addEventListener('pointerdown', function () { if (!locked) doBank(); });
      actions.appendChild(bank);
    }
    function doPush() {
      paintActions(true);
      var res = E.pressLuckPush();
      if (!res) { showPressLuck(); return; }
      // animate the d20 against the bust threshold
      var dres = { roll: res.roll, bonus: 0, dc: res.threshold + 1, attr: info.attr, pass: !res.busted };
      stage.classList.add('show');
      var skip = rollDie(stage, dres, function () {
        SFX[res.busted ? 'lose' : 'win'] && SFX[res.busted ? 'lose' : 'win']();
        setTimeout(function () {
          if (res.busted) { doBank(); return; }       // bust auto-resolves to the bad outcome
          showPressLuck();                              // success: re-render with the new pot
        }, 620);
      });
      s.addEventListener('pointerdown', function once(e2) { skip(); e2.stopPropagation(); s.removeEventListener('pointerdown', once, true); }, true);
    }
    function doBank() {
      paintActions(true);
      E.pressLuckBank();
      showEventResult(false);
    }
    paintMeter();
    paintActions(false);
  }

  function showClassRelic() {
    updateHUD();
    var r = E.run, chain = E.classChain && E.classChain();
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', chain ? chain.name + ' · Complete' : 'Signature Relic'));
    s.appendChild(el('div', 'screen-sub', 'CLAIM ONE — THE OTHER IS LOST FOR THIS RUN'));
    var cbar = makeConfirmBar();
    (chain ? chain.relics : []).forEach(function (id, i) {
      var a = ns.ARTIFACTS[id];
      var btn = el('div', 'panel-btn amber',
        '<div class="pb-title"><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) + '</div><div class="pb-desc">' + esc(a.desc) + '</div>');
      s.appendChild(btn);
      selectConfirm(s, btn, cbar, 'Claim <b>' + esc(a.name) + '</b>?<span class="cb-note">' + esc(a.desc) + '</span>',
        function () { SFX.coin(); E.takeClassRelic(i); E.finishClassRelic(); U.refresh(); }, 'amber');
    });
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

  var TRIBUTE_TEASE = {
    tribute_ironclad: 'Something vast and armoured waits beyond the Heart.',
    tribute_silent: 'A green blade glints in the dark beyond the Heart.',
    tribute_defect: 'Cold machine-light hums beyond the Heart.',
    tribute_watcher: 'A serene, terrible presence waits beyond the Heart.',
  };
  function showSectorIntro() {
    updateHUD();
    var r = E.run;
    if (E.isHeartLoop && E.isHeartLoop()) {
      var s2 = overlayScreen();
      s2.appendChild(el('div', 'sector-banner victory-banner', 'THE RECURSION DEEPENS'));
      s2.appendChild(el('div', 'screen-sub', 'NG+5 · THE LOOP BENDS BACK ON ITSELF'));
      var teaser = (E.counterBossId && TRIBUTE_TEASE[E.counterBossId(r)]) || '';
      s2.appendChild(el('div', 'event-text', 'You fall through the floor of the world and into a chamber that should not be — a vast, destroyed Heart, long cold. Echoes of other wanderers haunt the dark. ' + teaser + ' Rest here. There is no further down.'));
      var b2 = el('button', 'btn', 'APPROACH THE HEART');
      b2.addEventListener('pointerdown', function () { SFX.play(); E.beginSector(); U.refresh(); });
      s2.appendChild(b2);
      return;
    }
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
    var heartWin = (r.loop === B.run.heartLoop);
    var s = overlayScreen();
    if (heartWin) {
      s.appendChild(el('div', 'sector-banner victory-banner', 'THE TRIBUTE IS UNMADE'));
      s.appendChild(el('div', 'screen-sub', 'YOU OUTLASTED AN ECHO OF ANOTHER SPIRE — A FEAT ALMOST NONE WILL SEE'));
      s.appendChild(el('div', 'event-text', 'The wanderer dissolves into stardust. For an instant the Recurrence falters... then, somewhere far below, it begins again. You have gone where the loop forgets to end.'));
    } else {
      s.appendChild(el('div', 'sector-banner victory-banner', 'THE UNMAKER FALLS'));
      var loopTxt = r.loop > 1 ? 'LOOP ' + r.loop + ' CONQUERED' : 'THE DESCENT IS CONQUERED';
      s.appendChild(el('div', 'screen-sub', loopTxt));
    }
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

    var help = el('div', 'panel-btn magenta', '<div class="pb-title">? CODEX</div><div class="pb-sub">Every mechanic, explained</div>');
    help.addEventListener('pointerdown', function () { SFX.tap(); showCodex(wasCombat); });
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

  // ---- Codex: a browsable, categorised manual of every mechanic. Key numbers
  // are pulled live from balance.js so the text can never drift out of sync. ----
  function buildCodex() {
    var B = ns.BALANCE;
    var vuln = Math.round((B.status.vulnMult - 1) * 100);
    var weak = Math.round((1 - B.status.weakMult) * 100);
    var crit = B.dice.critMult;
    var energy = (B.player.baseEnergy != null ? B.player.baseEnergy : 3);
    var draw = (B.player.drawPerTurn != null ? B.player.drawPerTurn : 5);
    var finale = B.run.finale;
    var loop = Math.round(B.run.loopPower * 100);
    var slots = (B.echoes && B.echoes.loadoutSlots) || 3;
    var vh = ns.VTOUCH_HP;
    function E2(t, d, cls) { return { t: t, d: d, c: cls }; }
    return [
      { cat: 'Basics', entries: [
        E2('Deploy', 'Tap a class on the title screen to start a run. Each turn you play cards, then END TURN.'),
        E2('Play a card', 'Swipe a card up to play it, or drag it onto an enemy to aim. Tap a card to enlarge and read it first.'),
        E2('Energy ⚡', 'You get ' + energy + ' Energy each turn. Every card has a cost — you cannot play what you cannot afford. Unused Energy is lost.'),
        E2('Draw', 'You draw ' + draw + ' cards at the start of each turn; cards left in hand are discarded at turn end (unless they Retain).'),
        E2('Inspect', 'Tap an enemy to read its intent. Tap your power gauge (left of your character) to read your active augmentations.'),
        E2('Auto-save', 'Runs save at every node — close the tab and continue later from the title screen.'),
      ] },
      { cat: 'Combat', entries: [
        E2('The turn', 'Spend Energy to play cards, then END TURN. Enemies then act on their telegraphed intents, and a new turn begins.'),
        E2('Intents', 'Each enemy shows what it will do next: an attack value, a shield, a buff, a debuff, or a curse jammed into your deck.'),
        E2('Shield ⬡ (Block)', 'Absorbs incoming damage, removed before HP. Unspent Shield expires at the start of your turn — unless you have Barricade or Phase Lock.', 'def'),
        E2('The d20', 'Every attack rolls a visible d20. A high enough roll is a CRIT for ' + crit + '× damage. Some relics widen the crit range.'),
        E2('Damage order', 'Damage strips Shield first, then HP. Vulnerable and Weak change the numbers before they land.'),
        E2('Death', 'At 0 HP the run ends — unless a relic or Echo pulls you back.', 'bad'),
      ] },
      { cat: 'Attributes', entries: [
        E2('MIGHT', 'Raises Might-scaling weapon damage. The Vanguard’s core stat.', 'off'),
        E2('TECH', 'Raises Shield and tech-attack values. The Technomancer’s core stat.', 'def'),
        E2('PSI', 'Raises psionic damage and Burn. The Void Adept’s core stat.', 'sp'),
        E2('BOND', 'Empowers your summoned pets (their attacks, Burn, Shield and healing) and toughens them. The Warpcaller’s core stat.', 'sp'),
        E2('Primary scaling', 'Your starter Shield and shared skills scale with your class’s own primary attribute, so investing in your stat helps offense and defense.'),
        E2('Skill checks', 'Attributes also resolve event checks (e.g. "TECH check, DC 12"). Higher stat = better odds.'),
      ] },
      { cat: 'Keywords', entries: [
        E2('Attack', 'Deals damage and rolls a d20. Carries your Might/Tech/Psi scaling and Strength.'),
        E2('Skill', 'Utility: Shield, draw, debuffs, energy and more. No d20.'),
        E2('Power', 'A permanent buff for the rest of the combat. It is consumed when played — one use per fight.', 'sp'),
        E2('Exhaust', 'The card is removed for the rest of the combat. Several cards pay off when you Exhaust.'),
        E2('Retain', 'The card stays in your hand between turns instead of being discarded.'),
        E2('X-Cost', 'Spends ALL your Energy; the effect scales with how much you spent.'),
        E2('Void-Touched', 'An empowered card that also costs ' + vh + ' HP each time you play it. Power at a price.', 'bad'),
        E2('Curse', 'An unplayable card clogging your hand. Enemy curses last the combat; event curses are permanent until purged.', 'bad'),
      ] },
      { cat: 'Augments', intro: 'Your Powers and positive statuses — shown on the battlefield gauge. Amber = offense, cyan = defense, magenta = engine.', entries: [
        E2('Might (Strength)', '+1 damage to every attack, per stack.', 'off'),
        E2('Warlord', 'Gain Might at the start of each turn.', 'off'),
        E2('Psi Focus', '+damage to your psionic attacks.', 'off'),
        E2('Contagion', 'Whenever you apply Burn, apply Burn to ALL enemies.', 'off'),
        E2('Blade Array', 'Whenever you play a card, deal damage to ALL enemies.', 'off'),
        E2('Entropy', 'At the end of your turn, apply Burn to ALL enemies.', 'off'),
        E2('Plating', 'Gain Shield at the start of each turn.', 'def'),
        E2('Plated Armor', 'Gain Shield each turn — the amount drops by 1 each time.', 'def'),
        E2('Barricade', 'Your Shield no longer expires between turns.', 'def'),
        E2('Phase Lock', 'Shield no longer expires (the power form of Barricade).', 'def'),
        E2('Thorns', 'Attackers take damage whenever they hit you.', 'def'),
        E2('Regen', 'Heal a little at the start of each turn.', 'def'),
        E2('Resolve', 'Gain Shield whenever you Exhaust a card.', 'def'),
        E2('Mirror Field', 'Gain Shield whenever you play a card.', 'def'),
        E2('Salvage', 'Draw a card whenever you Exhaust a card.', 'sp'),
        E2('Turret', 'At the end of your turn, a deployed turret fires at a random enemy.', 'sp'),
        E2('Echo', 'The first Attack you play each turn is played twice.', 'sp'),
        E2('Reactor', '+1 Energy at the start of each turn.', 'sp'),
        E2('Corruption', 'Skills cost 0 this combat, but Exhaust when played.', 'sp'),
        E2('Blood Pact', 'Whenever you lose HP to your own cards, gain Psi Focus.', 'sp'),
      ] },
      { cat: 'Debuffs', entries: [
        E2('Vulnerable', 'The target takes ' + vuln + '% more damage while Vulnerable.', 'bad'),
        E2('Weak', 'The target deals ' + weak + '% less damage while Weak.', 'bad'),
        E2('Burn', 'At the start of its turn the target loses HP equal to its Burn, then Burn drops by 1. Ignores Shield — great vs. big HP pools.', 'bad'),
      ] },
      { cat: 'Gauge', entries: [
        E2('Power gauge', 'Your active Powers stack as small squares to the left of your character — amber (offense), cyan (defense), magenta (engine). It grows as you install more.'),
        E2('Tactical readout', 'Tap the gauge to expand a readout listing every active augmentation with its value. Tap again, or elsewhere, to close it.'),
        E2('Debuff chips', 'Negative statuses on YOU (Vulnerable / Weak / Burn) stay in the top HUD as red warning chips.', 'bad'),
      ] },
      { cat: 'The Run', entries: [
        E2('Sectors', 'Each sector is a branching star-chart against one faction. You choose your path node to node.'),
        E2('Node types', 'Fight, Elite (mini-boss), Event (choices), Shop, Rest (heal or upgrade), Treasure (free relic), and the Sector Boss.'),
        E2('Factions', 'The Hierarchy, the Rust Legion, the Voidspawn — each with its own enemies and pressure.'),
        E2('The Finale', 'The boss of sector ' + finale + ' is THE UNMAKER, a faction-less cosmic entity. Beat it to win the run.', 'sp'),
        E2('Scaling', 'Enemies gain HP and damage every sector. Deeper is harder — build a deck that scales.'),
      ] },
      { cat: 'Progress', entries: [
        E2('Card rewards', 'After most fights, take 1 of 3 offered cards — or skip to keep your deck lean.'),
        E2('Upgrades', 'Rest sites and some events upgrade a card to stronger numbers.'),
        E2('Relics', 'Passive artifacts that last the whole run; from bosses, elites, treasure and shops.'),
        E2('Augment draft', 'After each boss you draft an Augment Protocol — a permanent module or stat boost.'),
        E2('Credits & Shop', 'Spend credits on cards, relics, healing, and removing weak cards from your deck.'),
      ] },
      { cat: 'Potions', entries: [
        E2('The belt', 'A 3-slot belt of one-shot consumables for combat — damage, Shield, Energy, draw, heal, buffs and debuffs.'),
        E2('Using one', 'Tap a belt slot to use it; targeted potions ask you to tap an enemy. They drop from fights and stock the shop.'),
      ] },
      { cat: 'Events', entries: [
        E2('Choices', 'Decision events offer branching options with real consequences — reward, risk, or both.'),
        E2('Skill checks', 'Some options roll your attribute vs a DC. A natural 1 always fails; a natural 20 always succeeds.'),
        E2('Risk', 'Failed checks can cost HP or jam a curse into your deck. Read the odds before you gamble.', 'bad'),
      ] },
      { cat: 'Recurrence', intro: 'New Game+ : beating THE UNMAKER opens an endless loop of the same spire.', entries: [
        E2('Victory', 'Beat the Unmaker, then claim victory (run recorded) or enter the Recurrence for a fresh descent.', 'sp'),
        E2('Powers fade', 'Each loop your deck, relics, augments and stats reset to baseline. You start over — almost.'),
        E2('Void Echoes', 'You keep one permanent Echo per loop — sideways relics (glass-cannon, combo, execute-chains, pacts). Equip up to ' + slots + ' at once.', 'sp'),
        E2('The world strengthens', 'Enemies gain +' + loop + '% HP & damage per loop, on top of normal scaling. Deep loops are a build puzzle, not a treadmill.'),
      ] },
      { cat: 'Enemies', entries: [
        E2('Summon', 'Some enemies call in reinforcements mid-fight — clear adds or focus the summoner.'),
        E2('Regen / Reforge', 'Healers undo your damage each turn. Out-pace them or burst them down fast.'),
        E2('Enrage', 'The enemy gains Strength whenever it is struck — finish enraging foes quickly.'),
        E2('Thorns', 'Striking the enemy damages you back. Watch your HP against thorny foes.'),
        E2('The Unmaking', 'The Unmaker strips your Shield, jams your deck and heals itself. You cannot turtle it — race it down.', 'bad'),
        E2('Boss signatures', 'Every finale boss has a unique trick. Read the intent and adapt your plan.'),
      ] },
    ];
  }
  var codexCat = 0;
  function showCodex(wasCombat, catIdx) {
    if (catIdx != null) codexCat = catIdx;
    var CODEX = buildCodex();
    if (codexCat >= CODEX.length) codexCat = 0;
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'Codex'));
    s.appendChild(el('div', 'screen-sub', 'FIELD MANUAL · ALL SYSTEMS'));
    var nav = el('div', 'codex-nav', '');
    CODEX.forEach(function (c, i) {
      var chip = el('span', 'codex-chip' + (i === codexCat ? ' active' : ''), esc(c.cat));
      chip.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); SFX.tap(); showCodex(wasCombat, i); });
      nav.appendChild(chip);
    });
    s.appendChild(nav);
    var cat = CODEX[codexCat];
    var body = el('div', 'codex-body', '');
    if (cat.intro) body.appendChild(el('div', 'codex-intro', esc(cat.intro)));
    cat.entries.forEach(function (e) {
      body.appendChild(el('div', 'codex-entry',
        '<span class="codex-term' + (e.c ? ' ' + e.c : '') + '">' + esc(e.t) + '</span>' +
        '<span class="codex-def">' + esc(e.d) + '</span>'));
    });
    s.appendChild(body);
    var btn = el('button', 'btn', 'CLOSE');
    btn.addEventListener('pointerdown', function () { SFX.tap(); if (wasCombat) showCombat(); else if (E.run) showMenu(); else showTitle(); });
    s.appendChild(btn);
  }

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
