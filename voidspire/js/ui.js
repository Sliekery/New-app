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

  var $hud, $hand, $controls, $overlay, $floaters, $toast, $energy, $hint, $counts, $game, $potions, $potionTip, $drawPile, $discardPile, $rail, $railPanel, $railLine, $dock, $die, $nudge;
  var dieTimer = null, dieRolling = false;
  var railOpen = null;      // which rail panel is open ('buffs'|'debuffs'|'relics'|'draw'|'discard') or null
  var selected = -1;        // selected hand index
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
    lock: function () { beep(720, 0.04, 'square', 0.028, 200); setTimeout(function () { beep(1080, 0.05, 'square', 0.03); }, 42); },
    hurt: function () { beep(90, 0.2, 'sawtooth', 0.06, -40); },
    heal: function () { beep(520, 0.12, 'sine', 0.05, 260); },
    win: function () { beep(523, 0.1, 'square', 0.04); setTimeout(function () { beep(659, 0.1, 'square', 0.04); }, 110); setTimeout(function () { beep(784, 0.22, 'square', 0.05); }, 220); },
    lose: function () { beep(220, 0.3, 'sawtooth', 0.05, -160); },
    dice: function () { beep(330 + Math.random() * 300, 0.03, 'square', 0.02); },
    coin: function () { beep(988, 0.06, 'square', 0.03); setTimeout(function () { beep(1319, 0.1, 'square', 0.03); }, 60); },
    talk: function () { beep(700 + Math.random() * 380, 0.025, 'square', 0.012); },
    // a construct firing: a servo click into a thin report, so it is audibly
    // NOT the player's own weapon
    servoFire: function () { beep(1180, 0.03, 'square', 0.018); setTimeout(function () { beep(300, 0.09, 'sawtooth', 0.035, -120); }, 34); },
    /* THE LADDER. Each link of a trigger chain steps a whole tone above the
     * last, and gets slightly louder. This — not the visuals — is what makes a
     * chain feel like it is still going: the ear anticipates the next rung, so
     * a four-link chain lands as a phrase rather than four separate noises. */
    chainStep: function (i) { beep(392 * Math.pow(2, (i * 2) / 12), 0.13, 'square', Math.min(0.075, 0.038 + i * 0.012)); },
    // ...and the phrase needs an ending, or a long chain just stops.
    chainBreak: function (n) {
      var top = 392 * Math.pow(2, Math.min(14, n * 2) / 12);
      beep(top, 0.1, 'square', 0.05);
      setTimeout(function () { beep(top * 1.5, 0.26, 'square', 0.055); }, 90);
    },
  };

  /* ====================== vector art -> inline SVG ====================== */
  // Same polyline format as enemies: {p:[[x,y,...]], e:[[x,y]], m:[x,y,...]}
  // The die's own glyph — a d20 silhouette, used wherever the die is the subject.
  /* The bay's own glyph: a socket with a module seated in it. Deliberately not
   * a die shape — the two buttons sit side by side and have to be told apart at
   * 22px without reading a label. */
  function bayChipSVG(cls) {
    return '<svg viewBox="0 0 40 40" class="' + (cls || 'art-icon') + '">'
      + '<rect x="5" y="14" width="30" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="2.4"/>'
      + '<polygon points="20,3 28,8 28,16 12,16 12,8" fill="none" stroke="currentColor" stroke-width="2"/>'
      + '<line x1="12" y1="22" x2="28" y2="22" stroke="currentColor" stroke-width="1.6" opacity="0.6"/>'
      + '<line x1="12" y1="28" x2="22" y2="28" stroke="currentColor" stroke-width="1.6" opacity="0.6"/></svg>';
  }

  function dieChipSVG(cls) {
    return '<svg viewBox="0 0 40 40" class="' + (cls || 'art-icon') + '">'
      + '<polygon points="20,3 35,12 35,28 20,37 5,28 5,12" fill="none" stroke="currentColor" stroke-width="2.4"/>'
      + '<polygon points="20,10 29,25 11,25" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.6"/></svg>';
  }
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

    // combat d20 — rides the bottom dock, tumbles when an attack is played
    $die = el('div', '', '<svg viewBox="0 0 40 40" class="die-svg"><polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="20,8 31,26 9,26" fill="none" stroke="currentColor" stroke-width="1" opacity="0.5"/></svg><span class="die-n">—</span>');
    $die.id = 'combat-die';
    $die.style.display = 'none';
    $die.insertBefore(el('canvas', 'die3d'), $die.firstChild);
    // Tapping the die opens the engraving screen. It is the same solid, so
    // "look closer at the thing that just fired" is one gesture rather than a
    // trip back to the star chart.
    $die.addEventListener('pointerdown', function (ev) {
      ev.stopPropagation();
      if (locked || !E.combat || E.combat.over) return;
      SFX.tap();
      showDieScreen();
    });

    /* THE NUDGE PROMPT. It sits under the die and is the near-miss readout as
     * well as the button: it NAMES what is one step either way, so "you missed
     * Bracket Fire by one" is on screen at the moment it stings, with the
     * price of fixing it next to it. One element doing both jobs is why the
     * near-miss needs no separate feedback of its own. */
    $nudge = el('div', '', '');
    $nudge.id = 'nudge-bar';
    $nudge.style.display = 'none';
    $game.appendChild($nudge);
    $game.appendChild($die);

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

    $hint = el('div', '', 'AIM · RELEASE TO FIRE');
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

    // hover tooltips over the canvas status/trait icons (desktop)
    $game.addEventListener('pointermove', onIconHover);
    $game.addEventListener('pointerleave', hideIconTip);

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
    fitHand();                                 // the reserves are measured, so they move with the dock
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

  // Tooltip text for an artifact chip.
  function artifactTip(id) {
    var a = ns.ARTIFACTS[id];
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
      case 'boss-artifact': return showBossArtifact();
      case 'first-mark': return showFirstMark();
      case 'cutscene': return showCutscene();
      case 'unstable': return showInstability();
      case 'sector-intro': return showSectorIntro();
      case 'victory': return showVictory();
      case 'dead': return showGameOver();
      default: return showTitle();
    }
  };

  function overlayScreen(clear) {
    // a sheet left open when the screen behind it changes would hang around
    // over a screen that never opened it
    document.querySelectorAll('.sheet-back').forEach(function (b) {
      if (b._esc) document.removeEventListener('keydown', b._esc);
      b.remove();
    });
    $overlay.innerHTML = '';
    $overlay.classList.add('active');
    combatChrome(false);
    var s = el('div', 'screen' + (clear ? ' clear' : ''));
    $overlay.appendChild(s);
    /* RESERVE ONLY WHAT ACTUALLY COLLIDES.
     *
     * This reserved the HUD's whole height as top padding — but the HUD is a
     * cluster in the top-LEFT corner, about 250px wide. On a 1587px frame that
     * bought 206px of empty band across the entire screen to avoid a collision
     * that could not happen, pushed the title 319px down, and turned a screen
     * that fits into one you scroll (1.27x). On a landscape phone it was the
     * difference between 1.00x and 1.09x.
     *
     * The content is a centred column, so whether it collides depends on the
     * frame's width. That cannot be known until the children exist, so a small
     * padding goes on now and a frame later it is measured for real. */
    if ($hud && $hud.style.display !== 'none' && $hud.innerHTML.trim()) {
      var hh = $hud.getBoundingClientRect().height;
      s.style.paddingTop = '14px';
      requestAnimationFrame(function () {
        if (!s.isConnected) return;
        var kid = s.firstElementChild;
        if (!kid || !(hh > 0 && hh < 220)) return;

        /* PER LEAF, NOT ONE BOX. The HUD is not the corner cluster it looks
         * like — it is that cluster AND a menu button hard against the right
         * edge, so any single bounding box around it spans the entire frame and
         * reports that everything collides. That is why this reserved 206px of
         * empty band on a 1587px screen for a collision that cannot happen, and
         * pushed the title 300px down into a scroll.
         *
         * Only the leaves that actually sit over the content column count, and
         * only those decide how far the content has to duck. */
        /* The COLUMN, not the title. Testing only the first child passed on a
         * narrow frame — the title is short and centred, but the wider blocks
         * below it sat straight under the corner chips. The column is the union
         * of everything the screen actually lays out. */
        var kb = { left: Infinity, right: -Infinity };
        [].forEach.call(s.children, function (c) {
          var b = c.getBoundingClientRect();
          if (!b.width || !b.height) return;
          kb.left = Math.min(kb.left, b.left); kb.right = Math.max(kb.right, b.right);
        });
        if (!isFinite(kb.left)) kb = kid.getBoundingClientRect();
        var need = 0;
        var hb = $hud.getBoundingClientRect();
        var top = hb.top;
        /* MEASURE IN DEVICE PIXELS, RESERVE IN CSS PIXELS.
         *
         * The frame is CSS-transform scaled — 1.52x on a desktop window — so
         * every rect here comes back 1.52x larger than the padding unit it was
         * being assigned to. The screens duly reserved 1.52x the clearance they
         * needed: 115px of padding for an 80px HUD, on every overlay in the
         * game. The overlap test below is unaffected (both sides are scaled the
         * same way); only the distance has to be converted back. */
        var scale = $hud.offsetHeight ? (hb.height / $hud.offsetHeight) : 1;
        if (!(scale > 0.1)) scale = 1;
        (function walk(node) {
          [].forEach.call(node.children, function (c) {
            if (c.children.length) { walk(c); return; }
            var b = c.getBoundingClientRect();
            if (!b.width || !b.height) return;
            if (b.left < kb.right + 8 && b.right > kb.left - 8) need = Math.max(need, (b.bottom - top) / scale + 12);
          });
        })($hud);
        s.style.paddingTop = Math.max(14, need) + 'px';
      });
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
    if ($die) $die.style.display = on ? 'block' : 'none';
    $counts.style.display = 'none';
    $drawPile.style.display = on ? 'block' : 'none';   // piles ride the dock corners (per-class art)
    $discardPile.style.display = on ? 'block' : 'none';
    if (!on && $rail) { $rail.style.display = 'none'; closeRail(); }
    $potions.style.display = on ? 'flex' : 'none';
    if (!on) { $hint.style.display = 'none'; onPotionCancel(); hidePotionTip(); }
    R.combatVisible = on;
  }

  // dock d20: tumble while you drag an attack, settle on the roll when you fire.
  function startDieRoll() {
    if (!$die || dieRolling) return;
    dieRolling = true;
    var n = $die.querySelector('.die-n');
    $die.classList.remove('crit', 'settle'); $die.classList.add('rolling');
    if (dieTimer) clearInterval(dieTimer);
    dieTimer = setInterval(function () { n.textContent = 1 + Math.floor(Math.random() * 20); }, 60);
  }
  // The engraving fires before the card resolves, so its name arrives ahead of
  // the roll it belongs to. Hold it until the readout is drawn.
  var firedFace = null;
  var pendingRoll = null;   // a roll the class table had nothing to say about

  /* ============ THE TRIGGER CHAIN =====================================
   * The best thing the die does is the chain: the face you rolled fires, the
   * bleed catches its neighbours, and whatever is listening answers. Three or
   * four links, and every one of them used to be drawn in the SAME FRAME at the
   * SAME PIXEL — `gapFor('dieFace')` fell through to 0 and every floater went to
   * one fixed spot, so the payoff read as an illegible smear.
   *
   * Four things fix it, and they are all about the same thing: giving the chain
   * a TIME AXIS. Links land 110ms apart on a staircase, each a whole tone higher
   * than the last (the ear is what tells you it is still going), a counter
   * climbs beside them, a receipt totals what they did, and a chain long enough
   * to be remarkable stops the frame for a fifth of a second.
   * ================================================================= */
  var CHAIN = {
    step: 110,        // ms between links. This number simply did not exist.
    stopAt: 4,        // links needed before the frame holds
    hold: 210,        // how long it holds
    n: 0,             // links so far this card
    dmg: 0, blk: 0, en: 0,
    stopped: false,
    batch: 0,         // which action the chain on screen belongs to
  };
  var CHAIN_HOP_MAX = 5;   // links the die itself walks before it lets the receipt carry it
  /* Four link rows, on every screen. The engine's chain depth cap is 2, and a
   * sweep of 3600 played cards never produced more than 3 links — so four shows
   * every chain that actually happens, and anything beyond it is exceptional
   * enough to elide. A cap that varies by viewport just moves where it breaks. */
  var CHAIN_ROWS_MAX = 4;
  /* THE RECEIPT STAYS UP UNTIL YOU ACT AGAIN. It used to fade on a 1.5s timer,
   * which is long enough to watch and far too short to READ — and reading it is
   * the entire point of having it. So it is cleared by the next thing you do
   * rather than by a clock: playing a card wipes it outright, and a chain that
   * happens on someone else's turn (a construct setting off a listener, say)
   * replaces it lazily when its first link lands. */
  var chainBatch = 0;
  function chainWipe() {
    CHAIN.n = 0; CHAIN.dmg = 0; CHAIN.blk = 0; CHAIN.en = 0; CHAIN.stopped = false;
    CHAIN.batch = chainBatch;
    var l = document.getElementById('chain-ledger');
    if (l) { l.classList.remove('on'); l.innerHTML = ''; }
    chainRim(0);
  }
  function chainReset() { chainWipe(); }
  function chainRim(n) {
    var g = document.getElementById('game'); if (!g) return;
    var rim = document.getElementById('chain-rim');
    if (!rim) {
      rim = el('div'); rim.id = 'chain-rim';
      var host = document.getElementById('chain'); if (!host) return;
      host.appendChild(rim);
    }
    rim.style.boxShadow = n < 2 ? 'inset 0 0 0 0 transparent'
      : 'inset 0 0 ' + (14 + n * 20) + 'px ' + (2 + n * 3) + 'px rgba(255,176,46,' + Math.min(0.42, 0.06 + n * 0.08) + ')';
  }
  // One link of the chain lands: staircase floater, a rung up the ladder, the
  // counter, the receipt line, and — if this is the one that crosses the
  // threshold — the frame holds.
  function chainLink(e, pp) {
    // a chain from a later action replaces whatever is still on screen
    if (CHAIN.batch !== chainBatch) chainWipe();
    /* THE DIE WALKS THE CHAIN. Each link hops the solid to the face that just
     * fired — and since a bleed goes to a numeric neighbour, and numeric
     * neighbours are now EDGE neighbours, that hop is one face next door. You
     * watch the current travel rather than reading that it did.
     *
     * 180ms, not the default 600: links land 110ms apart, so at the settle time
     * the die screen uses it would still be turning toward link 2 while the
     * receipt printed link 5. Past CHAIN_HOP_MAX links the die holds and lets
     * the receipt carry the rest — the receipt is the record, the die is the
     * theatre, and they do not both have to say everything. */
    if (combatDie && CHAIN.n > 0 && CHAIN.n < CHAIN_HOP_MAX && e.face) {
      combatDie.setFace(e.face, false, 0.18);
    }
    CHAIN.n++;
    var i = CHAIN.n - 1;
    CHAIN.dmg += (e.dealt || 0); CHAIN.blk += (e.blk || 0); CHAIN.en += (e.en || 0);
    var kind = e.flaw ? 'flaw' : e.listen ? 'listen' : e.bleed || e.why ? 'bleed' : 'root';
    // the staircase. Clamped so a six-link chain cannot walk off the frame.
    var mark = e.flaw ? '✖ ' : (e.listen || e.why) ? '↳ ' : '◆ ';
    var fx = pp.x + 62 + Math.min(4, i) * 20;
    var fy = pp.y - 92 + Math.min(5, i) * 21;
    floater(fx, fy, mark + e.name, 'dielink die' + (e.flaw ? 'flaw' : 'aug'));
    SFX.chainStep(i);
    chainCombo(i);
    chainLedger(e, kind, mark);
    if (CHAIN.n >= CHAIN.stopAt && !CHAIN.stopped) { CHAIN.stopped = true; chainHitstop(); }
  }
  /* The count lives in the receipt's header rather than floating over the
   * battlefield. Two objects saying the same number, one of them parked in the
   * middle of the fight, was a worse answer than one object that already had a
   * title bar to put it in. The punch stays — the badge is what bumps now. */
  function chainCombo(i) {
    if (i < 1) return;                       // a lone face is not a chain
    chainHeader();
    var n = document.querySelector('#chain-ledger .cl-n'); if (!n) return;
    n.textContent = '×' + (i + 1);
    n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
    chainRim(i + 1);
  }
  /* A LINK IS TWO LINES. The first is what fired and what it paid; the second is
   * WHY it landed as hard as it did — the face, the band that face reads in, and
   * whether the bleed came through at full or at a quarter. That second line is
   * roll attribution, folded into the thing you are already reading rather than
   * given a panel of its own. */
  function chainLedger(e, kind, mark) {
    var l = document.getElementById('chain-ledger'); if (!l) return;
    chainHeader();
    var bits = [];
    if (e.dealt) bits.push(e.dealt + ' DMG');
    if (e.blk) bits.push('+' + e.blk + ' SHD');
    if (e.en) bits.push('+' + e.en + ' EN');
    var cause = e.listen ? ('LSTN ' + e.listen) : e.why ? e.why.toUpperCase() : 'ROOT';
    var ln = el('div', 'cl-ln');
    ln.innerHTML = '<span class="cl-c cl-' + kind + '">' + esc(cause) + '</span>'
      + '<span class="cl-w">' + esc(e.name.toUpperCase()) + '</span>'
      + '<span class="cl-v">' + esc(bits.join(' · ')) + '</span>';
    var band = E.faceBand ? E.faceBand(e.face) : null;
    var det = ['face ' + e.face];
    if (band) det.push(band.label + (band.mult !== 1 ? ' ×' + band.mult : ''));
    if (e.why === 'bleed') det.push(e.bleed ? 'bled' : 'FULL, relayed');
    else if (e.why) det.push(e.why);
    if (e.taint) det.push('SCARRED');
    var sub = el('div', 'cl-sub', esc(det.join(' · ')));
    l.appendChild(ln); l.appendChild(sub);
    chainElide(l);
    l.classList.add('on');
    requestAnimationFrame(function () { ln.classList.add('on'); sub.classList.add('on'); });
  }

  /* IN LANDSCAPE THE RECEIPT HAS A CEILING, because landscape is the orientation
   * this is played in and there the sky above the player is only so tall. A
   * five-link chain overhung the player's head by 23px and a longer one by more
   * — measured against the drawn figure, staff included, not against a guess.
   *
   * It elides rather than growing: keep the ROOT, keep the most recent links,
   * and collapse the middle into a marker. Growing upward from a fixed bottom
   * was the other option and it reads worse — every new link would shove the
   * lines you were already reading. */
  function chainElide(l) {
    var rows = l.querySelectorAll('.cl-ln');
    if (rows.length <= CHAIN_ROWS_MAX) return;
    var mark = l.querySelector('.cl-more');
    if (!mark) {
      mark = el('div', 'cl-more', '');
      l.insertBefore(mark, rows[1]);                      // directly under the root
    }
    // drop the oldest link that is not the root, and its detail line
    var victim = null;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i].compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_PRECEDING) { victim = rows[i]; break; }
    }
    if (!victim) return;
    var nx = victim.nextElementSibling;
    if (nx && nx.classList.contains('cl-sub')) nx.remove();
    victim.remove();
    mark.dataset.n = String((+mark.dataset.n || 0) + 1);
    mark.textContent = '⋯ ' + mark.dataset.n + ' more';
  }
  // the title bar, written once per chain, with the count living in it
  function chainHeader() {
    var l = document.getElementById('chain-ledger'); if (!l || l.querySelector('.cl-hd')) return;
    var hd = el('div', 'cl-hd', '<span>CHAIN RECEIPT</span><b class="cl-n">×1</b>');
    l.appendChild(hd);
    requestAnimationFrame(function () { hd.classList.add('on'); });
  }
  // Printed once the chain is over, so the receipt has a bottom line.
  function chainTotal() {
    if (CHAIN.n < 2) { chainCool(); return; }
    var l = document.getElementById('chain-ledger');
    if (l) {
      var bits = [];
      if (CHAIN.dmg) bits.push(CHAIN.dmg + ' DMG');
      if (CHAIN.blk) bits.push(CHAIN.blk + ' SHD');
      if (CHAIN.en) bits.push(CHAIN.en + ' EN');
      if (bits.length) {
        var rule = el('div', 'cl-rule'); l.appendChild(rule);
        var tot = el('div', 'cl-ln');
        tot.innerHTML = '<span class="cl-c cl-tot">CHAIN</span>'
          + '<span class="cl-w cl-tot">CLOSED</span>'
          + '<span class="cl-v cl-tot">' + esc(bits.join(' · ')) + '</span>';
        l.appendChild(tot);
        requestAnimationFrame(function () { tot.classList.add('on'); });
      }
    }
    SFX.chainBreak(CHAIN.n);
    chainCool();
  }
  /* The numbers stay; the FLASH does not. The rim glow is a hit effect, and
   * leaving a heavy orange vignette over the hand while you pick your next card
   * would tint every decision you make. It eases out on its own; the receipt and
   * the count sit there until you act. */
  function chainCool() {
    var b = CHAIN.batch;
    setTimeout(function () { if (CHAIN.batch === b) chainRim(0); }, 700);
  }
  /* HITSTOP. Only for a chain worth remarking on, because a stutter on every
   * roll is a stutter you resent. The chain layer keeps its colour while
   * everything else drains, so what you look at during the hold is the payoff. */
  function chainHitstop() {
    var g = document.getElementById('game'), host = document.getElementById('chain');
    if (!g || !host) return;
    var fl = document.getElementById('chain-flash');
    if (!fl) { fl = el('div'); fl.id = 'chain-flash'; host.appendChild(fl); }
    fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
    g.classList.add('hitstop');
    R.quake && R.quake(R.playerXY().x, R.playerXY().y, '#ffb02e', 0.5);
    setTimeout(function () { g.classList.remove('hitstop'); }, CHAIN.hold);
  }
  // A new fight starts with a clean die — a readout that persists must not
  // outlive the combat it belongs to.
  function clearDieResult() {
    firedFace = null; pendingRoll = null;
    chainReset();
    if (!$die) return;
    var $f = $die.querySelector('.die-flash');
    if ($f) { $f.innerHTML = ''; $f.classList.remove('go'); }
    var $n = $die.querySelector('.die-n'); if ($n) $n.textContent = '\u2014';
    var $a = $die.querySelector('.die-aim'); if ($a) $a.style.display = 'none';
    $die.classList.remove('graze', 'solid', 'misfire', 'crit');
  }

  function setDieResult(value, band, tone, crit, misfire) {
    if (!$die) return;
    var $f = $die.querySelector('.die-flash');
    if (!$f) { $f = document.createElement('span'); $f.className = 'die-flash'; $die.appendChild($f); }
    var lab = crit ? 'CRIT' : (band || '');
    var line = '<span class="dl-roll">' + value + (lab ? ' <b>' + esc(lab) + '</b>' : '') + '</span>';
    if (firedFace) {
      line += '<span class="dl-fired' + (firedFace.flaw ? ' flaw' : '') + '">' +
        (firedFace.flaw ? '\u2716 ' : '\u25c6 ') + esc(firedFace.name) + '</span>';
    }
    $f.innerHTML = line;
    firedFace = null;
    // The readout STAYS until the next roll replaces it — it used to fade after
    // 0.85s, which meant the thing that just triggered was gone before you
    // could read what it was.
    $f.classList.remove('go'); void $f.offsetWidth; $f.classList.add('go');
  }

  function settleDie(value, crit, misfire, aim, band, tone) {
    if (!$die) return;
    dieRolling = false;
    if (dieTimer) { clearInterval(dieTimer); dieTimer = null; }
    $die.classList.remove('rolling');
    $die.querySelector('.die-n').textContent = value;
    // show the Aim the roll was made with, so a crit off a middling face reads
    var $b = $die.querySelector('.die-aim');
    if (!$b) { $b = document.createElement('span'); $b.className = 'die-aim'; $die.appendChild($b); }
    $b.textContent = (aim > 0) ? ('+' + aim) : '';
    $b.style.display = (aim > 0) ? '' : 'none';
    // name the band under the die so every roll says something
    var $l = $die.querySelector('.die-band');
    if (!$l) { $l = document.createElement('span'); $l.className = 'die-band'; $die.appendChild($l); }
    $l.textContent = band || '';
    // Tone, not band name — each class names its own faces, so the HUD colours
    // by whether the face helped or hurt rather than by a hardcoded label.
    $die.classList.remove('graze', 'solid', 'misfire', 'crit');
    if (crit) $die.classList.add('crit');
    else if (tone === 'up') $die.classList.add('solid');
    else if (tone === 'down') $die.classList.add(misfire ? 'misfire' : 'graze');
    setDieResult(value, band, tone, crit, misfire);
    // The solid itself was thrown on the `roll` event; this only settles the
    // number and band under it. Re-throwing here would cut the chain's walk off
    // at the knees, since `cardPlayed` lands at delay 0.
    $die.classList.remove('settle'); void $die.offsetWidth; $die.classList.add('settle');   // settle pop
  }
  function cancelDieRoll() {
    if (!dieRolling && !dieTimer) return;
    dieRolling = false;
    if (dieTimer) { clearInterval(dieTimer); dieTimer = null; }
    if ($die) $die.classList.remove('rolling');
  }

  /* ====================== HUD ====================== */
  function setHud(on) { if ($hud) $hud.style.display = on ? '' : 'none'; }

  // star-chart glyph for the top map button (two nodes on a flight path)
  var MAP_ICON = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4.5 13.5 13 4.5" stroke-dasharray="2 2"/><circle cx="4.5" cy="13.5" r="2.2"/><circle cx="13" cy="4.5" r="2.2"/></svg>';
  /* Paint the nudge prompt. Shown only when a roll has just landed next to
   * something worth reaching, hidden the instant it is spent or the turn
   * turns over. Greyed rather than hidden when you cannot afford it, because
   * "you missed it by one and you are out of Energy" is information too. */
  function updateNudge() {
    if (!$nudge) return;
    var st = (E.combat && !E.combat.over && E.nudgeState) ? E.nudgeState() : null;
    if (!st || locked) { $nudge.style.display = 'none'; return; }
    /* EACH SIDE CARRIES ITS OWN PRICE, because the two directions are rarely
     * the same distance now. Showing one shared cost hid the whole decision —
     * the point is that the near face is cheap and the far one is not. */
    var en = E.combat.energy;
    function side(o, dir) {
      if (!o) return '<span class="nz-bare"></span>';
      var can = en >= o.cost;
      return '<button class="nz-btn' + (can ? '' : ' dim') + (o.flaw ? ' flaw' : '')
        + '" data-dir="' + dir + '" title="' + o.dist + ' face' + (o.dist > 1 ? 's' : '') + ' away">'
        + (dir < 0 ? '<span class="nz-ar">\u25c2</span>' : '')
        + '<span class="nz-nm">' + esc(o.name) + '</span>'
        + '<span class="nz-c">\u26a1' + o.cost + '</span>'
        + (dir > 0 ? '<span class="nz-ar">\u25b8</span>' : '')
        + '</button>';
    }
    $nudge.innerHTML = side(st.left, -1)
      + '<span class="nz-cost">NUDGE</span>'
      + side(st.right, 1);
    $nudge.style.display = 'flex';
    $nudge.querySelectorAll('.nz-btn').forEach(function (b) {
      b.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation();
        var why = E.nudge(+b.getAttribute('data-dir'));
        if (why) { toast(why.toUpperCase(), 1600); return; }
        SFX.tap();
        // the same timeline a card's own chain runs on, so a nudged face
        // arrives up the pitch ladder exactly like one you landed on
        var evts = E.events.slice();
        E.events.length = 0;
        $nudge.style.display = 'none';
        lock(true);
        playTimeline(evts, 70, function () { lock(false); afterAction(false); });
        updateEnergy();
      });
    });
  }

  function updateHUD() {
    var r = E.run;
    if (!r) { $hud.innerHTML = ''; setHud(false); renderRail(); return; }
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
      [['MGT', 'might'], ['TEC', 'tech'], ['PSI', 'psi']].map(function (a) {
        var v = E.attr(a[1]); return v > 0 ? '<span class="attr">' + a[0] + ' <b>' + v + '</b></span>' : '';
      }).join('') +
      (onMap ? '<span class="attr" style="color:' + fac.color + '">' + (E.inHeart && E.inHeart() ? '◈' : '') + 'S' + r.sector + ' ▴' + Math.max(0, r.mapRow + 1) + '/' + (B.map.rows + 1) + '</span>' : '') +
      /* The rating rode its own LINE for a chip. It belongs beside the other
       * run-level readouts — but spelled out ("P1 COLD VACUUM") it is 150px
       * wide, which pushed the HUD cluster across the left edge of the content
       * column and made every overlay reserve a band to duck it. The number is
       * the information; the name is flavour you chose on the title screen, so
       * it rides the tooltip. */
      ((r.pressure || 0) > 0 ? '<span class="hud-press" title="' + esc(E.pressureName(r.pressure)) + '">P' + r.pressure + '</span>' : '') +
      '<span class="spacer"></span>' +
      (onMap ? '' : '<button class="icon-btn" data-act="map" title="Star chart">' + MAP_ICON + '</button>') +
      '<button class="icon-btn" data-act="menu">≡</button>' +
      '</div>';

    /* TWO DOORS, SIDE BY SIDE. The bay used to be reachable only through the die
     * screen, which said relics are a sub-page of engravings. They are a system
     * of their own and they get their own button, on every screen the die
     * button appears on. */
    html += '<div class="artifact-row">';
    var waiting = (E.run.die && E.run.die.pending) ? E.run.die.pending.length : 0;
    html += '<div class="artifact-chip die-chip' + (waiting ? ' has-pending' : '') + '" data-die="1" title="' +
      (waiting ? waiting + ' engraving' + (waiting > 1 ? 's' : '') + ' waiting to be cut' : 'Inspect the die') + '">' +
      dieChipSVG() + (waiting ? '<span class="die-pend-badge">' + waiting + '</span>' : '') + '</div>';
    (function () {
      var die = E.run.die, core = (die && die.core) || [];
      var slots = (die && die.coreSlots) || ns.DIE.coreSlotsStart;
      // a relic you own but have not installed does nothing, so the badge counts
      // exactly that — the number of decisions you have left sitting on the rack
      var racked = r.artifacts.filter(function (x) { return core.indexOf(x) < 0; }).length;
      var room = core.length < slots;
      html += '<div class="artifact-chip bay-chip' + (racked && room ? ' has-pending' : '') + '" data-bay="1" title="' +
        esc(ns.chassisFor(r.cls).name + ' — ' + core.length + '/' + slots + ' installed'
            + (racked ? ', ' + racked + ' on the rack' : '')) + '">' +
        bayChipSVG() + (racked && room ? '<span class="die-pend-badge">' + racked + '</span>' : '') + '</div>';
    })();
    html += '</div>';
    /* THE RELIC LIST IS GONE FROM HERE.
     *
     * It listed every relic you own — mounted, then a separator, then the idle
     * ones — as a second row of chips, on every screen. That was the right
     * answer when the only way to reach a relic was through the die screen,
     * and the wrong one the moment relics got a bay of their own with its own
     * button: the same information, permanently, in the corner of a map you
     * are trying to read. Measured on this frame it cost 38px of HUD, which is
     * 38px the star chart does not get.
     *
     * What survives is the DOOR — the bay chip above, which still badges the
     * number of relics sitting on the rack doing nothing, because that is the
     * part that was ever a call to action. */

    if (c) {
      // Statuses (buffs/powers/debuffs) now live on the on-figure Dual-Rail bar.
      // The HUD only keeps Fusion-Charge timers, which aren't stack statuses.
      var chips = '';
      /* BALLISTIC COMPUTER. The relic's entire effect is this chip: it prints
       * the number BEFORE you choose a card, so the choice is a response to
       * the die instead of a bid against it. Nothing else about it exists. */
      if (c.nextRoll != null) {
        chips += '<span class="status-chip primed" title="Ballistic Computer — your next roll">◈ NEXT ' + c.nextRoll + '</span>';
      }
      (c.primed || []).forEach(function (pr) {   // armed delayed detonations (Fusion Charge)
        chips += '<span class="status-chip primed">⏱ ' + pr.dmg + ' in ' + pr.turns + '</span>';
      });
      if (chips) html += '<div class="status-row">' + chips + '</div>';
    }

    $hud.innerHTML = html;

    // every idle-relic chip opens the die too, not just the die chip itself —
    // querySelector bound only the first of them
    $hud.querySelectorAll('[data-die]').forEach(function (chip) {
      chip.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation(); if (locked) return; SFX.tap(); showDieScreen();
      });
    });
    $hud.querySelectorAll('[data-bay]').forEach(function (chip) {
      chip.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation(); if (locked) return; SFX.tap(); showModules();
      });
    });
    var mapBtn = $hud.querySelector('[data-act="map"]');
    if (mapBtn) mapBtn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); SFX.tap(); showMap(true); });
    var menuBtn = $hud.querySelector('[data-act="menu"]');
    if (menuBtn) menuBtn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); showMenu(); });

    renderRail();
    updateNudge();
  }
  U.updateHUD = updateHUD;

  /* ====================== CREW MANIFEST (Warpcaller) ====================== */
  // icon glyph + colour per pet action, mirroring the on-field readout.
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
    // The left cockpit rail is retired: buffs/debuffs/powers live on the
    // Dual-Rail HP bars and relics ride the top HUD again.
    if ($rail) $rail.style.display = 'none';
    closeRail();
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


  /* ====================== THE DIE ====================== */
  // Which faces you can actually land on, given Aim. eff = min(20, natural+Aim),
  // and a natural 1 always lands on face 1 — so raising Aim strands the low faces.
  // Aim no longer decides WHICH face fires — only which band it lands in — so
  // nothing is ever out of reach. Kept as a function because every caller
  // threads it through; it now simply never dims anything.
  function dieReach() { return function () { return true; }; }
  /* YOUR AIM, read straight from the game. There is no preview any more and so
   * no scratch value to keep in sync, no way for it to disagree with reality,
   * and nothing that can write back into a fight. */
  function dieAimNow() {
    var c = E.combat;
    if (c) return (c.player.statuses.aim || 0);
    return E.run ? E.startAim(E.run.cls) : 0;
  }
  /* THE CLASS TABLE. Roll every face through the class's own reading so the
   * screen shows what the die MEANS for you, and how Aim reshapes it — which is
   * the Voidadept's whole tension: climb the table and you starve the bottom. */
  /* Read a single roll exactly the way playCard would, relics and all. There is
   * one reader in the engine and the screen borrows it — the alternative was a
   * second copy of the band logic here, which is how this table came to be
   * telling the player about a die that a Machined Barrel had already moved. */
  function readRoll(t, roll, aim) {
    var D = ns.BALANCE.dice, live = !!(E.run && E.run.artifacts && E.bandFor);
    var bonus = live ? E.art('rollBonus') : 0;
    var eff = Math.min(20, roll + aim + bonus);
    var wide = live ? Math.max(1, 1 + E.art('misfireWiden')) : 1;
    var critAt = D.critThreshold - (live ? E.art('critBonus') + E.art('critWiden') : 0);
    var lowCrit = live ? E.art('lowCrit') : 0;
    // Same precedence the engine uses: a crit outranks a jam, and only a roll
    // that did NOT jam can crit off the bottom of the table.
    var jam = roll <= wide;
    if (roll === 20 || (roll > 1 && eff >= critAt) || (!jam && lowCrit > 0 && roll <= lowCrit)) {
      return { label: 'CRIT', mult: D.critMult, tone: 'crit' };
    }
    if (jam) return t.misfire;
    if (live) return E.bandFor(t, eff, roll);
    for (var i = 0; i < t.bands.length; i++) if (eff >= t.bands[i].min) return t.bands[i];
    return t.bands[t.bands.length - 1];
  }
  function dieBandRows(cls, aim) {
    var t = ns.BALANCE.dice.classes[cls]; if (!t) return null;
    var seen = [], byLabel = {};
    for (var roll = 1; roll <= 20; roll++) {
      var slot = readRoll(t, roll, aim);
      if (!slot) continue;
      if (!byLabel[slot.label]) { byLabel[slot.label] = { slot: slot, n: 0, lo: roll, hi: roll }; seen.push(slot.label); }
      var e = byLabel[slot.label];
      e.n++; e.lo = Math.min(e.lo, roll); e.hi = Math.max(e.hi, roll);
    }
    // A band used to be a contiguous run of numbers, so lo–hi told the whole
    // truth. Duty Cycle interleaves odd and even and The Devouring crits off
    // the bottom, and both make the set full of holes — the row still shows the
    // span it covers, but `split` marks the ones that are not solid so the
    // table cannot claim a range it does not own. Sorted by the TOP of the span
    // rather than the bottom, or a band that reaches down to 2 lands last.
    return seen.map(function (k) {
      var e = byLabel[k];
      e.split = e.n !== (e.hi - e.lo + 1);
      return e;
    }).sort(function (a, b) { return b.hi - a.hi; });
  }
  function bandTableTitle(cls) {
    var t = ns.BALANCE.dice.classes[cls];
    return t ? t.name : 'NO TABLE';
  }

  /* One line instead of six: the band the selected face lands in, its
   * multiplier, and a prompt that the whole table is one tap away. */
  function dieReadSummaryHTML(cls, aim, sel) {
    var t = ns.BALANCE.dice.classes[cls];
    if (!t) return '<div class="drs"><span class="drs-name">NO TABLE</span>'
      + '<span class="drs-sub">the face does not modulate your cards</span></div>';
    var here = null;
    dieBandRows(cls, aim).forEach(function (e) { if (sel >= e.lo && sel <= e.hi) here = e; });
    var m = here ? here.slot.mult : 1;
    var tone = !here ? 'flat' : here.slot.label === 'CRIT' ? 'crit' : m > 1.02 ? 'up' : m < 0.98 ? 'down' : 'flat';
    return '<div class="drs ' + tone + '">'
      + '<span class="drs-name">' + esc(t.name) + '</span>'
      + (here ? '<span class="drs-band">FACE ' + sel + ' → ' + esc(here.slot.label)
              + ' <b>×' + m.toFixed(2).replace(/0$/, '') + '</b></span>' : '')
      + '<span class="drs-more">FULL TABLE ▸</span></div>';
  }

  /* A dismissable reference panel. Used for anything that is worth reading once
   * and then wants to be out of the way. */
  function showSheet(title, html) {
    var back = el('div', 'sheet-back');
    var card = el('div', 'sheet-card');
    card.innerHTML = '<div class="sheet-head"><span>' + esc(title) + '</span><b class="sheet-x">✕</b></div>'
      + '<div class="sheet-body">' + html + '</div>';
    back.appendChild(card);
    function close() { SFX.tap(); back.remove(); }
    /* TAP ANYWHERE. Closing only on the backdrop or the ✕ left almost no target
     * on a phone — the card fills most of the frame, so the backdrop is a thin
     * margin. This is a read-once reference panel with nothing to interact with
     * inside it, so anywhere is a dismiss. The body still scrolls, because a
     * drag is not a tap. */
    var downAt = null;
    back.addEventListener('pointerdown', function (e) { downAt = { x: e.clientX, y: e.clientY }; });
    back.addEventListener('pointerup', function (e) {
      if (!downAt) return;
      var moved = Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y) > 6;
      downAt = null;
      if (!moved) close();
    });
    // Escape closes it too — a panel with exactly one way out is one bad tap
    // away from being stuck.
    back._esc = function (e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', back._esc); } };
    document.addEventListener('keydown', back._esc);

    /* MOUNT IT ON TOP OF WHATEVER IS OPEN. This was appended to #game, which
     * sits BENEATH #overlay (z-index 100) — so on the die screen the sheet
     * rendered visibly but every pointer event went to the overlay above it,
     * including the one aimed at its own close button. It could be opened and
     * never dismissed, which is exactly the "it keeps showing" that was
     * reported. It goes into the overlay when the overlay is up. */
    var host = ($overlay && $overlay.classList.contains('active')) ? $overlay : document.getElementById('game');
    host.appendChild(back);
    requestAnimationFrame(function () { back.classList.add('on'); });
    return back;
  }
  U.showSheet = showSheet;

  /* ====================== THE MODULE BAY ==============================
   * Relics, on their own screen, drawn as hardware. They were a row of 22px
   * chips under the engraving list whose only description was a hover title —
   * one of the three systems a run is built out of, and the hardest thing in
   * the game to read. */
  function showModules(back) {
    var r = E.run; if (!r) return;
    if (!r.die) r.die = ns.newDie();
    var die = r.die;
    var col = CLASS_COL[r.cls] || '#5dff88';
    var view = null;

    var s = overlayScreen();
    var ch = ns.chassisFor(r.cls);
    s.appendChild(el('h2', 'screen-title', ch.name));
    var sub = el('div', 'screen-sub', '');
    s.appendChild(sub);

    var stage = el('div', 'bay-stage');
    var cv = el('canvas', 'bay-canvas');
    stage.appendChild(cv);
    var readout = el('div', 'bay-readout', '');
    stage.appendChild(readout);
    s.appendChild(stage);

    var rack = el('div', 'bay-rack');
    s.appendChild(rack);

    function slots() { return die.coreSlots || ns.DIE.coreSlotsStart; }
    function mountedList() {
      var out = [];
      for (var i = 0; i < ch.slots.length; i++) out.push(die.core[i] || null);
      return out;
    }
    function describe(id) {
      var a = ns.ARTIFACTS[id];
      if (!a) return '';
      var uses = E.relicUsesLeft && E.relicUsesLeft(id);
      return '<div class="bay-nm" style="color:' + col + '">' + esc(a.name)
        + (a.pact ? ' <span class="bay-tag">PACT</span>' : '')
        + (uses != null ? ' <span class="bay-tag">' + uses + ' LEFT</span>' : '') + '</div>'
        + '<div class="bay-ds">' + esc(a.desc || '') + '</div>';
    }

    function paint(seatIdx, ejectIdx) {
      sub.textContent = die.core.length + ' OF ' + slots() + ' HARDPOINTS LIVE · ' + ch.sub.toUpperCase();
      if (view) {
        view.set(mountedList(), slots());
        if (seatIdx != null) view.seat(seatIdx);
        if (ejectIdx != null) view.eject(ejectIdx);
      }
      // the rack: everything owned but not seated
      var vault = r.artifacts.filter(function (x) { return die.core.indexOf(x) < 0; });
      var h = '<div class="bay-rt">THE RACK <span class="bay-rn">' + vault.length + '</span></div>';
      if (!vault.length) h += '<div class="bay-empty">Nothing on the rack. Everything you own is installed.</div>';
      h += '<div class="bay-list">';
      vault.forEach(function (vid) {
        var a = ns.ARTIFACTS[vid]; if (!a) return;
        h += '<div class="bay-item" data-mount="' + esc(vid) + '">'
          +  '<span class="bay-ic">' + artSVG(a.art, 'art-icon', col) + '</span>'
          +  '<span class="bay-tx"><b>' + esc(a.name) + '</b>' + (a.pact ? ' <i class="bay-tag">PACT</i>' : '')
          +  '<span>' + esc(a.desc || '') + '</span></span>'
          +  '<span class="bay-go">INSTALL ▸</span></div>';
      });
      h += '</div>';
      // and what is seated, so a mounted relic is readable without hovering
      if (die.core.length) {
        h += '<div class="bay-rt">INSTALLED <span class="bay-rn">' + die.core.length + '</span></div><div class="bay-list">';
        die.core.forEach(function (cid, i) {
          var a = ns.ARTIFACTS[cid]; if (!a) return;
          h += '<div class="bay-item on" data-eject="' + i + '">'
            +  '<span class="bay-ic">' + artSVG(a.art, 'art-icon', col) + '</span>'
            +  '<span class="bay-tx"><b>' + esc(a.name) + '</b>' + (a.pact ? ' <i class="bay-tag">PACT</i>' : '')
            +  '<span>' + esc(a.desc || '') + '</span></span>'
            +  '<span class="bay-go out">EJECT ◂</span></div>';
        });
        h += '</div>';
      }
      rack.innerHTML = h;

      rack.querySelectorAll('[data-mount]').forEach(function (b) {
        b.addEventListener('pointerdown', function (ev) {
          ev.stopPropagation();
          if (die.core.length >= slots()) { SFX.tap(); toast('Every hardpoint is live — eject something first.', 1800); return; }
          SFX.play();
          var idx = die.core.length;
          die.core.push(b.dataset.mount);
          E.save();
          readout.innerHTML = describe(b.dataset.mount);
          paint(idx, null);
        });
      });
      rack.querySelectorAll('[data-eject]').forEach(function (b) {
        b.addEventListener('pointerdown', function (ev) {
          ev.stopPropagation(); SFX.tap();
          var i = +b.dataset.eject;
          if (view) view.eject(i);
          die.core.splice(i, 1);
          E.save();
          readout.innerHTML = '';
          setTimeout(function () { paint(null, null); }, 200);
        });
      });
    }

    var btn = el('button', 'btn', 'BACK');
    btn.addEventListener('pointerdown', function () {
      SFX.tap();
      if (view) { view.destroy(); view = null; }
      if (back) back(); else U.refresh();
    });
    s.appendChild(btn);

    setTimeout(function () {
      view = ns.chassisCreate(cv, { cls: r.cls, mounted: mountedList(), slots: slots() });
      // tapping a live hardpoint reads it out
      cv.addEventListener('pointerup', function (ev) {
        if (!view || view.dragged()) return;      // a turn is not a tap
        var b = cv.getBoundingClientRect();
        var i = view.slotAt(ev.clientX - b.left, ev.clientY - b.top);
        if (i < 0) return;
        SFX.tap();
        readout.innerHTML = die.core[i] ? describe(die.core[i])
          : '<div class="bay-nm dim">HARDPOINT ' + (i + 1) + (i < slots() ? ' — EMPTY' : ' — SEALED') + '</div>';
      });
      paint(null, null);
    }, 0);
  }
  U.showModules = showModules;

  function dieReadHTML(cls, aim) {
    var t = ns.BALANCE.dice.classes[cls];
    if (!t) return '<div class="dr-title">NO TABLE<span class="dr-sub">Your die rolls for engravings, but the face does not modulate your cards.</span></div>';
    var h = '<div class="dr-title">' + esc(t.name) + '<span class="dr-sub">' + esc(t.read) + '</span></div>';
    var anySplit = false;
    dieBandRows(cls, aim).forEach(function (e) {
      var m = e.slot.mult, tone = e.slot.label === 'CRIT' ? 'crit' : m > 1.02 ? 'up' : m < 0.98 ? 'down' : 'flat';
      var rider = (e.slot.hploss ? ' <b class="dr-cost">−' + e.slot.hploss + ' HP</b>' : '')
                + (e.slot.energy ? ' <b class="dr-gain">+' + e.slot.energy + ' EN</b>' : '');
      if (e.split) anySplit = true;
      h += '<div class="dr-row ' + tone + '">'
        +  '<span class="dr-rng">' + (e.lo === e.hi ? e.lo : e.lo + '–' + e.hi) + (e.split ? '*' : '') + '</span>'
        +  '<span class="dr-lab">' + esc(e.slot.label) + '</span>'
        +  '<span class="dr-mul">×' + m.toFixed(2).replace(/0$/, '') + rider + '</span>'
        +  '<span class="dr-pct">' + (e.n * 5) + '%</span></div>';
    });
    if (anySplit) h += '<div class="dr-note">* a relic has cut holes in this band — the span is what it reaches, the % is what it actually takes.</div>';
    return h;
  }

  // Face 1 and 20 are labelled in the CLASS's language — a Vanguard's MISFIRE is
  // a Technomancer's BREAKER and a Voidadept's RAVENOUS, and calling them all
  // "misfire" would be telling three classes the same lie.
  /* `die` is optional and only matters for a barrel that is not a d20: a d6's
   * face 3 is not the d20's face 3, it sits on the table where dieScale puts
   * it. Without this a d6 read its bands off raw face numbers and told the
   * player its 6 was a GRAZE when rolling it actually crits. */
  function dieEndTag(cls, face, aim, die) {
    var t = ns.BALANCE.dice.classes[cls];
    if (!t) return null;
    var slot = readRoll(t, die ? ns.dieScale(die, face) : face, aim || 0);
    if (!slot) return null;
    if (slot.label === 'CRIT') return { label: 'CRIT', crit: true };
    return { label: slot.label, crit: false, good: slot.mult > 1.02 };
  }

  function dieFaceRowHTML(die, face, reach, fitFor, aimNow, ghost, welds) {
    var id = ns.dieFaceId(die, face), d = id ? ns.dieEngraving(id) : null;
    var slot = die.faces[face];
    var cont = slot && slot.root !== face;                 // continuation of a band
    var sm = ns.dieSeamAt(die, face), smD = sm ? ns.dieEngraving(sm.id) : null;
    var cls = 'df' + (d ? (d.flaw ? ' flaw' : ' aug') : ' bare') + (reach(face) ? '' : ' unreach');
    // While something is armed, say up-front which faces will take it. A band
    // that runs off the end of the die, or a face-locked engraving, used to be
    // discoverable only by tapping and reading a rejection.
    if (fitFor) cls += fitFor(face) ? ' no-fit' : ' fits';
    /* THE GHOST. The one thing the old screen never showed: a three-face band
     * lit ONE face green and then quietly ate its neighbours. */
    if (ghost && ghost.span.indexOf(face) >= 0) {
      cls += ghost.why ? ' ghost bad' : ' ghost';
      if (ghost.seam === face) cls += ' ghost-seam';
    }
    var et = dieEndTag(E.run && E.run.cls, face, aimNow, die);
    var tag = et ? '<span class="df-tag' + (et.crit || et.good ? ' crit' : '') + '">' + esc(et.label) + '</span>' : '';
    // a scarred face has to look scarred in the list, not only when tapped
    var tt = ns.dieTaintAt(die, face);
    if (tt) cls += ' tainted';
    if (sm) cls += ' seamed';
    /* A WELDED-IN PERMANENT HAS TO LOOK IT. It is locked out of the forge, the
     * bench and every later instability, so a player who cannot see that will
     * tap it, get refused, and read the refusal as a bug. */
    var isPerm = !!(slot && die.faces[slot.root] && die.faces[slot.root].perm);
    if (isPerm) cls += ' permface';
    var scar = tt ? '<span class="df-scar" title="' + esc((ns.DIE_TAINTS[tt] || {}).name || tt) + '">✖</span>' : '';
    var body = d
      ? (cont ? '<span class="df-cont">— ' + esc(d.name) + '</span>' + scar
              : artSVG(d.art, 'df-icon') + '<span class="df-name">' + esc(d.name) + '</span>' + scar)
      : '<span class="df-empty">bare</span>';
    if (smD) body += '<span class="df-seam" title="shared face">+ ' + esc(smD.name) + '</span>';
    // a welded boundary is drawn ON the face that owns its upper edge
    var wl = (welds && ns.dieWelded(die, face, ns.dieStep(face, 1))) ? '<span class="df-weld" title="welded seam">=</span>' : '';
    if (isPerm && !cont) wl += '<span class="df-perm" title="welded in by the instability — it cannot be changed">◆</span>';
    return '<div class="' + cls + '" data-face="' + face + '"><span class="df-n">' + face + '</span>' + body + tag + wl + '</div>';
  }
  var dieView = null;
  // The free-engraving sandbox is a dev tool, not content — it would hand you
  // for nothing what the bench charges for. Opt in with ?workshop=1.
  var DEV_WORKSHOP = (function () {
    try { return /[?&]workshop=1/.test(location.search); } catch (e) { return false; }
  })();
  /* A tag strip for an engraving: which region it may be cut into, and whether
   * it is a listener rather than a doer. Both are new rules, and neither is
   * guessable from the effect text — a listener that says "WHEN you gain
   * Momentum" reads as a doer until you know the category exists. */
  var LISTEN_LABEL = {
    momentum: 'ON MOMENTUM', selfHp: 'ON SELF-DAMAGE', exhaust: 'ON EXHAUST',
    parry: 'ON PARRY', crit: 'ON CRIT', neighbour: 'ON NEIGHBOUR',
  };
  function engTagHTML(g) {
    if (!g) return '';
    var out = '';
    if (g.listen) out += '<span class="eng-tag listen">' + (LISTEN_LABEL[g.listen] || 'LISTENER') + '</span>';
    if (g.field) out += '<span class="eng-tag field">FIELD</span>';
    if (g.band) out += '<span class="eng-tag band">' + esc(ns.dieRegionLabel(g.band)) + '</span>';
    if (g.onlyFace) out += '<span class="eng-tag band">FACE ' + g.onlyFace + '</span>';
    return out;
  }

  function showDieScreen(opts) {
    var r = E.run; if (!r) return;
    if (!r.die) r.die = ns.newDie();
    var die = r.die;
    var bench = !!(opts && opts.bench) && E.benchOpen();
    var back = opts && opts.back;
    var buying = null, moving = null;   // bench: engraving being placed / reseated
    var armed = null;                   // index into die.pending being placed
    /* NOTHING COMMITS ON A TAP ANY MORE. A cut is permanent, costs credits at
     * the bench, and a three-face band takes two faces you did not point at —
     * one click deciding all of that was the single worst interaction on the
     * screen. Tapping a face now ARMS a placement; the panel says exactly what
     * it will do, ◀ ▶ slide it a face at a time, and CONFIRM cuts it. */
    var preview = null;                 // { face } — the anchor being considered
    var wasCombat = r.phase === 'combat';
    var sel = 20, pickOpen = false;
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', bench ? 'The Bench' : 'The Die'));
    var sub = el('div', 'screen-sub', '');
    s.appendChild(sub);

    /* SIDE BY SIDE, not stacked. Measured on landscape: the die stage was 137px
     * and the twenty-face list 187px, one above the other, and the screen ran
     * 1.48 viewports deep — you scrolled past the die to reach the faces, then
     * back up to see the die react to the face you picked, which is the one
     * thing this screen exists to show you.
     *
     * The die and what it says go left, the faces go right. Nothing is removed;
     * the tallest two blocks simply stop queueing behind each other. */
    var split = el('div', 'die-split');
    var pane = el('div', 'die-pane');
    var stage = el('div', 'die-stage');
    var cv = document.createElement('canvas');
    cv.className = 'die-canvas';
    stage.appendChild(cv);
    pane.appendChild(stage);
    /* The canvas is a vector icosahedron and it can only ever be one. Spinning
     * a twenty-sided model to show you a d6's face 4 is a lie about the object
     * in your hand, so a small barrel simply does not get it — its six faces
     * are all listed anyway, which is the whole of what there is to know. */
    if (ns.dieSides(die) !== ns.DIE.faces) {
      stage.style.display = 'none';
      var _sd = ns.dieSides(die);
      pane.appendChild(el('div', 'die-small-note',
        _sd < ns.DIE.faces
          ? 'A d' + _sd + ' — ' + _sd + ' faces, and every one of them is above.'
          : 'GROUND OUT TO ' + _sd + ' FACES — past what an icosahedron can be. Every face is listed above.'));
    }
    var info = el('div', 'die-info');
    pane.appendChild(info);
    var read = el('div', 'die-read');
    pane.appendChild(read);
    split.appendChild(pane);

    var faces = el('div', 'die-faces');
    var wrap = el('div', 'die-cols');
    faces.appendChild(wrap);
    faces.appendChild(el('div', 'die-legend', 'TAP A FACE TO SPIN THE DIE TO IT · THE TAG IS THE BAND IT LANDS IN'));
    split.appendChild(faces);
    s.appendChild(split);

    var shop = el('div', 'die-shop');
    s.appendChild(shop);
    var mods = el('div', 'die-mods');
    s.appendChild(mods);

    function aim() { return dieAimNow(); }
    function reach() { return dieReach(aim()); }

    /* Whichever of the three ways to put an engraving on the die is live. They
     * were three parallel code paths with three copies of "tap a face"; one
     * shape means the preview, the ghost and the commit cannot drift apart. */
    function armedCut() {
      if (buying != null && r.shop && r.shop.engravings[buying]) {
        var it = r.shop.engravings[buying];
        return { kind: 'buy', id: it.id, cost: it.cost, verb: 'CUT' };
      }
      if (moving != null && die.faces[moving]) {
        return { kind: 'move', id: die.faces[moving].id, cost: E.reseatCost(), verb: 'RESEAT' };
      }
      var q = die.pending || [];
      if (armed != null && q[armed]) return { kind: 'pend', id: q[armed], cost: 0, verb: 'CUT' };
      return null;
    }
    // What would happen if `cut` were anchored at `face`. A RESEAT has to be
    // tested against a die the engraving has already left, or it collides with
    // itself and every face reads as taken.
    function placementFor(cut, face) {
      if (!cut) return null;
      if (cut.kind !== 'move') return ns.diePlacement(die, cut.id, face);
      var tmp = {
        faces: JSON.parse(JSON.stringify(die.faces)),
        seams: JSON.parse(JSON.stringify(die.seams || {})),
        welds: [],
      };
      ns.dieScrub(tmp, moving);
      return ns.diePlacement(tmp, cut.id, face);
    }
    function regionFill(face) {
      var reg = ns.dieRegionOf(face);
      if (!reg) return null;
      var rg = ns.DIE_REGION[reg], n = 0, tot = rg[1] - rg[0] + 1;
      for (var f = rg[0]; f <= rg[1]; f++) if (die.faces[f]) n++;
      return { reg: reg, lo: rg[0], hi: rg[1], n: n, tot: tot };
    }
    function commitPreview() {
      var cut = armedCut(); if (!cut || !preview) return;
      var f = preview.face, p = placementFor(cut, f);
      if (p.why) { toast(p.why.toUpperCase(), 1800); return; }
      if (cut.kind === 'buy') {
        var bw = E.shopBuyEngraving(buying, f);
        if (bw) { toast(bw.toUpperCase(), 1700); return; }
        SFX.coin(); buying = null;
      } else if (cut.kind === 'move') {
        var mw = E.shopReseat(moving, f);
        if (mw) { toast(mw.toUpperCase(), 1700); return; }
        SFX.coin(); moving = null;
      } else {
        ns.dieEngrave(die, cut.id, f);
        die.pending.splice(armed, 1);
        armed = null;
        E.save();
      }
      preview = null; sel = f;
      renderAll(true, true);
    }

    function renderAll(spinTo, flair) {
      var a = aim(), rc = reach();
      var queue = die.pending || [];
      if (armed != null && armed >= queue.length) armed = null;
      var pend = (armed != null) ? queue[armed] : null;
      var pg = pend ? ns.dieEngraving(pend) : null;
      var buyG = (buying != null && r.shop && r.shop.engravings[buying]) ? ns.dieEngraving(r.shop.engravings[buying].id) : null;
      var moveG = (moving != null && die.faces[moving]) ? ns.dieEngraving(die.faces[moving].id) : null;
      sub.innerHTML = buyG
        ? ('<span class="die-place">CUTTING: ' + esc(buyG.name) + ' — TAP A FACE TO LINE IT UP · ¢' + r.credits + '</span>')
        : moveG
        ? ('<span class="die-place">MOVING: ' + esc(moveG.name) + ' — TAP A NEW FACE TO LINE IT UP · ¢' + r.credits + '</span>')
        : pg
        ? ('<span class="die-place">CUTTING: ' + esc(pg.name) + ' — TAP A FACE, THEN CONFIRM</span>')
        : queue.length
        ? ('<span class="die-place">' + queue.length + ' ENGRAVING' + (queue.length > 1 ? 'S' : '') + ' WAITING — CHOOSE ONE BELOW</span>')
        : (bench ? '“BRING ME THE DIE.” · ¢' + r.credits + ' — ' : '')
          + (a > 0
          ? ('AIM +' + a + ' — YOU LAND ON ' + Math.min(20, 2 + a) + '–20, PLUS FACE 1 ON A NATURAL 1')
          : 'NO AIM — EVERY FACE IS IN REACH');

      // face index
      var cut = armedCut();
      if (!cut) preview = null;
      var ghost = (cut && preview) ? placementFor(cut, preview.face) : null;
      var fitFor = cut ? function (f) { return placementFor(cut, f).why; } : null;
      wrap.innerHTML = '';
      /* Two columns of however many faces this barrel has. A d6 was drawing
       * twenty rows, fourteen of which were faces it does not own. */
      var _sides = ns.dieSides(die), _half = Math.ceil(_sides / 2);
      [[1, _half], [_half + 1, _sides]].forEach(function (rng) {
        if (rng[0] > rng[1]) return;
        var col = el('div', 'die-col'), h = '';
        for (var f = rng[0]; f <= rng[1]; f++) h += dieFaceRowHTML(die, f, rc, fitFor, a, ghost, true);
        col.innerHTML = h;
        wrap.appendChild(col);
      });
      wrap.querySelectorAll('.df').forEach(function (row) {
        row.addEventListener('pointerdown', function (ev) {
          ev.stopPropagation(); SFX.tap(); pickOpen = false;
          var f = +row.dataset.face;
          if (cut) {
            // tapping a moving engraving's own head puts it back down
            if (cut.kind === 'move' && f === moving && !preview) { moving = null; renderAll(false, false); return; }
            preview = { face: f }; sel = f; renderAll(true, false); return;
          }
          sel = f; renderAll(true, false);
        });
      });

      // selected-face readout
      var id = ns.dieFaceId(die, sel), d = id ? ns.dieEngraving(id) : null;
      var st = dieEndTag(r.cls, sel, a, die);
      var tag = st ? ' <span class="di-tag' + (st.crit || st.good ? ' crit' : '') + '">' + esc(st.label) + '</span>' : '';
      var head = '<div class="di-head"><span class="di-face">' + sel + '</span>' + tag
               + '</div>';
      info.innerHTML = head + (d
        ? '<div class="di-name' + (d.flaw ? ' flaw' : '') + '">' + (d.flaw ? '✖ ' : '◆ ') + esc(d.name) + '</div><div class="di-desc">' + engTagHTML(d) + esc(d.desc) + '</div>'
          + (function () {
              var tt = ns.dieTaintAt(die, sel); if (!tt) return '';
              var T = ns.DIE_TAINTS[tt] || {};
              return '<div class="di-taint">✖ ' + esc(T.name || tt) + ' — ' + esc(T.desc || '') + '</div>';
            })()
          + (function () {
              var sm = ns.dieSeamAt(die, sel); if (!sm) return '';
              var sg = ns.dieEngraving(sm.id); if (!sg) return '';
              return '<div class="di-seam">◈ SHARED WITH ' + esc(sg.name) + ' — both fire at '
                   + Math.round((B.dice.seam || 0.6) * 100) + '% on this face.</div>'
                   + '<div class="di-desc">' + esc(sg.desc || '') + '</div>';
            })()
          + (function () {
              var w = [ns.dieStep(sel, -1), ns.dieStep(sel, 1)].filter(function (nf) { return ns.dieWelded(die, sel, nf); });
              return w.length ? '<div class="di-weld">= WELDED TO ' + w.join(' AND ') + ' — the bleed across runs at full.</div>' : '';
            })()
        : '<div class="di-name bare">bare</div><div class="di-desc">Nothing engraved on this face.</div>');

      /* ---- THE PREVIEW ------------------------------------------------
       * Everything the commit is about to do, in the order you need it: what
       * it covers, how often that fires, what band it lands in, how full the
       * region gets, and who it will be sharing a face with. The frequency
       * line in particular has never been visible anywhere, and the entire SP
       * price of an engraving is computed from it. */
      if (ghost) {
        var pd = ghost.def || {};
        var pct = Math.round(ghost.span.length / ns.dieSides(die) * 100);
        var rf = regionFill(preview.face);
        var smD = ghost.seamWith ? ns.dieEngraving(ghost.seamWith) : null;
        var seamPct = Math.round((B.dice.seam || 0.6) * 100);
        var bandTag = dieEndTag(r.cls, preview.face, a, die);
        var ph = '<div class="pv" ' + (ghost.why ? 'data-bad="1"' : '') + '>'
          + '<div class="pv-head">' + esc(cut.verb) + ' · ' + esc(pd.name || '') + '</div>'
          + '<div class="pv-desc">' + engTagHTML(pd) + esc(pd.desc || '') + '</div>'
          + '<div class="pv-row"><span class="pv-k">COVERS</span><span class="pv-v">'
          + ghost.span.map(function (f) { return f === preview.face ? '<b>' + f + '</b>' : f; }).join(' · ') + '</span></div>'
          + '<div class="pv-row"><span class="pv-k">FIRES ON</span><span class="pv-v">'
          + ghost.span.length + '/' + ns.dieSides(die) + ' FACES — ' + pct + '% OF ROLLS</span></div>'
          + (bandTag ? '<div class="pv-row"><span class="pv-k">ANCHOR</span><span class="pv-v">FACE '
              + preview.face + ' → ' + esc(bandTag.label) + '</span></div>' : '')
          + (rf ? '<div class="pv-row"><span class="pv-k">' + esc(rf.reg.toUpperCase()) + ' ' + rf.lo + '–' + rf.hi
              + '</span><span class="pv-v">' + rf.n + '/' + rf.tot + ' CUT</span></div>' : '');
        if (ghost.seam != null && smD) {
          ph += '<div class="pv-seam">SEAM ON FACE ' + ghost.seam + ' — shares with ' + esc(smD.name)
             +  '. Both fire at ' + seamPct + '% there, and you keep the face.</div>';
        }
        if (ghost.why) ph += '<div class="pv-bad">' + esc(ghost.why.toUpperCase()) + '</div>';
        ph += '<div class="pv-btns">'
          + '<button class="pv-nudge" data-slide="-1">◀</button>'
          + '<button class="pv-go' + (ghost.why ? ' bad' : '') + '" data-confirm="1">'
          + (ghost.why ? 'WILL NOT FIT' : (cut.cost ? cut.verb + ' · ¢' + cut.cost : 'CONFIRM')) + '</button>'
          + '<button class="pv-nudge" data-slide="1">▶</button>'
          + '</div><button class="pv-cancel" data-cancel="1">CANCEL</button></div>';
        info.innerHTML = ph;
      }
      wrap.querySelectorAll('.df').forEach(function (row) { row.classList.toggle('sel', +row.dataset.face === sel); });
      var pvSlide = info.querySelectorAll('[data-slide]');
      pvSlide.forEach(function (b) {
        b.addEventListener('pointerdown', function (ev) {
          ev.stopPropagation(); SFX.tap();
          preview = { face: ns.dieStep(preview.face, +b.dataset.slide) };
          sel = preview.face; renderAll(true, false);
        });
      });
      var pvGo = info.querySelector('[data-confirm]');
      if (pvGo) pvGo.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); SFX.tap(); commitPreview(); });
      var pvNo = info.querySelector('[data-cancel]');
      if (pvNo) pvNo.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation(); SFX.tap(); preview = null; renderAll(false, false);
      });

      /* THE TABLE WAS THE BIGGEST THING ON THE SCREEN and it never changes —
       * five static rows of class reference above the die you are actually
       * editing. It collapses to the one line that DOES change (which band the
       * selected face sits in) and opens in full on a tap. */
      read.innerHTML = dieReadSummaryHTML(r.cls, a, sel);
      read.onclick = function () { SFX.tap(); showSheet(bandTableTitle(r.cls), dieReadHTML(r.cls, a)); };

      // ---- engravings in hand -------------------------------------------
      // These used to be a silent FIFO: the die screen grabbed pending[0] and
      // you placed that one or nothing. Two engravings meant no choice at all,
      // and while one was queued every face tap tried to cut rather than
      // inspect, so you could not even read the die you were changing.
      var h = '';
      if (queue.length) {
        h += '<div class="ws-title">IN HAND <span class="ws-note">' + queue.length +
             ' TO CUT</span></div><div class="pend-tray">';
        queue.forEach(function (pid, i) {
          var g = ns.dieEngraving(pid); if (!g) return;
          var fits = 0;
          for (var pf = 1; pf <= ns.dieSides(die); pf++) if (!ns.dieCanEngrave(die, pid, pf)) fits++;
          h += '<button class="pend-it' + (armed === i ? ' arming' : '') + (fits ? '' : ' poor') + '" data-pend="' + i + '">'
            +  '<span class="bi-icon">' + artSVG(g.art, 'df-icon') + '</span>'
            +  '<span class="bi-body"><span class="bi-name">' + esc(g.name) + '</span>'
            +  '<span class="bi-desc">' + esc(g.desc) + '</span></span>'
            +  '<span class="bi-tier">' + engTagHTML(g) + (g.span > 1 ? g.span + ' FACES' : '1 FACE') + ' · '
            +  (fits ? fits + ' FIT' : 'NO ROOM') + '</span></button>';
        });
        h += '</div>';
        if (armed != null) h += '<div class="ws-hint">TAP A FACE TO LINE THE CUT UP — NOTHING IS CUT UNTIL YOU CONFIRM. ◀ ▶ SLIDE IT A FACE AT A TIME.</div>';
      }
      if (bench) {
        var stock = (r.shop.engravings || []);
        h += '<div class="ws-title">ENGRAVING BENCH <span class="ws-note">¢' + r.credits + '</span></div>';
        h += '<div class="bench-grid">';
        if (!stock.length) h += '<span class="dm-empty">nothing in the case</span>';
        stock.forEach(function (it, i) {
          var g = ns.dieEngraving(it.id); if (!g) return;
          var can = !it.sold && r.credits >= it.cost;
          h += '<button class="bench-it' + (it.sold ? ' sold' : can ? '' : ' poor') + (buying === i ? ' arming' : '') + '" data-buy="' + i + '">'
            +  '<span class="bi-icon">' + artSVG(g.art, 'df-icon') + '</span>'
            +  '<span class="bi-body"><span class="bi-name">' + esc(g.name) + '</span>'
            +  '<span class="bi-desc">' + esc(g.desc) + '</span></span>'
            +  '<span class="bi-cost">' + (it.sold ? 'SOLD' : '¢' + it.cost) + '</span>'
            +  '<span class="bi-tier">' + engTagHTML(g) + 'T' + (g.tier || 1) + (g.span > 1 ? ' · ' + g.span + 'f' : '') + '</span></button>';
        });
        h += '</div>';

        // services operate on the selected face
        var root = die.faces[sel] ? die.faces[sel].root : null;
        var flaws = Object.keys(die.faces).filter(function (f) {
          var e2 = ns.dieEngraving(die.faces[f].id); return e2 && e2.flaw && die.faces[f].root === +f;
        });
        h += '<div class="ws-row bench-row">';
        if (d && d.flaw) {
          h += '<button class="ws-btn danger wide' + (r.shop.grindUsed || r.credits < E.grindCost() ? ' bad' : '') + '" data-grind="' + root + '">'
            +  (r.shop.grindUsed ? 'GRINDER SPENT' : 'GRIND OUT ' + esc(d.name).toUpperCase() + ' · ¢' + E.grindCost()) + '</button>';
        } else if (flaws.length) {
          h += '<span class="ws-hint">' + flaws.length + ' FLAW' + (flaws.length > 1 ? 'S' : '') + ' ON THE DIE — SELECT ONE TO GRIND IT OUT</span>';
        }
        if (d) {
          // FACE LATHE makes the jig free and unspendable, so both the cost and
          // the spent state have to come from the engine rather than the flag.
          var jigOut = E.jigSpent();
          h += '<button class="ws-btn wide' + (jigOut || r.credits < E.reseatCost() ? ' bad' : '') + (moving != null ? ' arming' : '') + '" data-move="' + root + '">'
            +  (jigOut ? 'JIG RESET' : moving != null ? 'CANCEL MOVE'
                : 'RESEAT' + (E.reseatCost() ? ' · ¢' + E.reseatCost() : ' · LATHE')) + '</button>';
        }
        h += '</div>';
        if (!d && !flaws.length) h += '<div class="ws-hint">SELECT AN ENGRAVED FACE FOR THE GRINDER OR THE JIG.</div>';

        /* ---- THE TORCH ------------------------------------------------
         * Welding is the only bench service about the SPACE BETWEEN two
         * engravings rather than about one of them, so it lists boundaries,
         * not faces — and only the boundaries the selected face is part of,
         * or the die would offer you twenty of them. */
        var welded = ns.dieWelds(die), cap = B.dice.weldCap || 3;
        var wOpts = d ? [ns.dieStep(sel, -1), ns.dieStep(sel, 1)].map(function (nf) {
          return { a: sel, b: nf, why: ns.dieCanWeld(die, sel, nf) };
        }).filter(function (o) { return !o.why || ns.dieWelded(die, o.a, o.b); }) : [];
        h += '<div class="ws-title">THE TORCH <span class="ws-note">' + welded.length + '/' + cap + ' WELDED</span></div>';
        h += '<div class="ws-hint">A WELDED BOUNDARY CARRIES THE FULL EFFECT INTO ITS NEIGHBOUR INSTEAD OF '
          +  Math.round((B.dice.bleed || 0.25) * 100) + '%.</div>';
        if (!d) h += '<div class="ws-hint">SELECT AN ENGRAVED FACE TO SEE ITS BOUNDARIES.</div>';
        else if (!wOpts.length) h += '<div class="ws-hint">NOTHING NEXT TO FACE ' + sel + ' TO WELD IT TO.</div>';
        else {
          h += '<div class="ws-row bench-row">';
          wOpts.forEach(function (o) {
            var done2 = ns.dieWelded(die, o.a, o.b);
            var poor = !done2 && r.credits < E.weldCost();
            h += '<button class="ws-btn' + (done2 ? ' on' : poor ? ' bad' : '') + '" data-weld="' + o.a + ',' + o.b + '">'
              +  (done2 ? '= ' + o.a + '–' + o.b + ' WELDED' : 'WELD ' + o.a + '–' + o.b + ' · ¢' + E.weldCost()) + '</button>';
          });
          h += '</div>';
        }
      }

      // ---- inspection / dev workshop ----
      /* A READOUT, NOT A CONTROL. This was a pair of +/- buttons that previewed
       * the table at a hypothetical Aim — but the face list beside it already
       * prints every face's band at your REAL Aim, which is the question you
       * actually have. The preview was a third way of saying the same thing,
       * and it is the one that shipped a cheat: opened mid-fight it wrote
       * c.player.statuses.aim directly.
       *
       * The number stays, because the bands in that list are computed from it
       * and an unexplained number is worse than no number. */
      h += '<div class="ws-row"><span class="ws-lab">AIM</span>'
        +  '<span class="ws-val">+' + a + '</span>'
        +  '<span class="ws-note">every face reads ' + (a === 1 ? '1 band' : a + ' higher') + ' than its number</span>'
        + (DEV_WORKSHOP
          ? ('<span class="ws-gap"></span>'
            + '<button class="ws-btn wide" data-pick="1">' + (pickOpen ? 'CANCEL' : 'ENGRAVE FACE ' + sel) + '</button>'
            + (d ? '<button class="ws-btn danger" data-scrub="1">SCRUB</button>' : ''))
          : '')
        +  '</div>';
      if (pickOpen && DEV_WORKSHOP) {
        h += '<div class="ws-pick">';
        [['AUGMENTS', ns.DIE_AUGMENTS], ['FLAWS', ns.DIE_FLAWS]].forEach(function (grp) {
          h += '<div class="ws-grp">' + grp[0] + '</div><div class="ws-grid">';
          Object.keys(grp[1]).forEach(function (k) {
            var g = grp[1][k], why = ns.dieCanEngrave(die, k, sel);
            h += '<button class="ws-aug' + (g.flaw ? ' flaw' : '') + (why ? ' bad' : '') + '" data-eng="' + k + '"'
              + (why ? ' title="' + esc(why) + '"' : ' title="' + esc(g.desc) + '"') + '>'
              + esc(g.name) + '<span class="ws-t">T' + g.tier + (g.span > 1 ? ' · ' + g.span + 'f' : '') + '</span></button>';
          });
          h += '</div>';
        });
        h += '</div>';
      }
      shop.innerHTML = h;
      shop.querySelectorAll('[data-pend]').forEach(function (b) {
        b.addEventListener('pointerdown', function (ev) {
          ev.stopPropagation(); SFX.tap();
          var i = +b.dataset.pend;
          armed = (armed === i) ? null : i;   // tapping the armed one puts it down
          buying = null; moving = null;
          renderAll(false, false);
        });
      });
      shop.querySelectorAll('[data-buy]').forEach(function (b) {
        b.addEventListener('pointerdown', function (ev) {
          ev.stopPropagation(); SFX.tap();
          var i = +b.dataset.buy, it = r.shop.engravings[i];
          if (it.sold) { toast('SOLD OUT', 1400); return; }
          if (r.credits < it.cost) { toast('NOT ENOUGH CREDITS', 1400); return; }
          buying = (buying === i) ? null : i; moving = null; armed = null;
          renderAll(false, false);
        });
      });
      var gb = shop.querySelector('[data-grind]');
      if (gb) gb.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation(); SFX.tap();
        var why = E.shopGrindFlaw(+gb.dataset.grind);
        if (why) { toast(why.toUpperCase(), 1700); return; }
        SFX.coin(); renderAll(true, true);
      });
      var mb = shop.querySelector('[data-move]');
      if (mb) mb.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation(); SFX.tap();
        if (E.jigSpent()) { toast('THE JIG IS ALREADY RESET', 1600); return; }
        if (r.credits < E.reseatCost()) { toast('NOT ENOUGH CREDITS', 1400); return; }
        moving = (moving != null) ? null : +mb.dataset.move; buying = null;
        renderAll(false, false);
      });

      shop.querySelectorAll('[data-weld]').forEach(function (b) {
        b.addEventListener('pointerdown', function (ev) {
          ev.stopPropagation(); SFX.tap();
          var pr = b.dataset.weld.split(','), wa = +pr[0], wb = +pr[1];
          if (ns.dieWelded(die, wa, wb)) { toast('ALREADY WELDED', 1400); return; }
          var ww = E.shopWeld(wa, wb);
          if (ww) { toast(ww.toUpperCase(), 1700); return; }
          SFX.coin(); renderAll(false, false);
        });
      });

      var pb = shop.querySelector('[data-pick]');
      if (pb) pb.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); SFX.tap(); pickOpen = !pickOpen; renderAll(false, false); });
      var sb = shop.querySelector('[data-scrub]');
      if (sb) sb.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); SFX.tap(); ns.dieScrub(die, sel); E.save(); renderAll(false, false); });
      shop.querySelectorAll('[data-eng]').forEach(function (b) {
        b.addEventListener('pointerdown', function (ev) {
          ev.stopPropagation();
          var k = b.dataset.eng, why = ns.dieCanEngrave(die, k, sel);
          if (why) { SFX.tap(); toast(why, 1600); return; }
          SFX.tap(); ns.dieEngrave(die, k, sel); E.save(); pickOpen = false; renderAll(true, true);
        });
      });

      /* Relics are NOT here any more, in either direction. They were chips on
       * this screen, then a link from it — both of which said a relic is a
       * sub-page of engraving. They are a system of their own with their own
       * button in the HUD, on every screen this one is reachable from. */
      mods.innerHTML = '';

      if (spinTo && dieView) dieView.setFace(sel, !!flair);
    }

    var btn = el('button', 'btn', bench ? 'BACK TO THE TRADER' : 'CLOSE');
    btn.addEventListener('pointerdown', function () {
      SFX.tap();
      if (dieView) { dieView.destroy(); dieView = null; }
      if (back) back(); else if (wasCombat) showCombat(); else U.refresh();
    });
    s.appendChild(btn);

    setTimeout(function () {
      if (dieView) { dieView.destroy(); dieView = null; }
      dieView = ns.dieViewCreate(cv, {
        face: 20,
        tint: function (n) {
          var id2 = ns.dieFaceId(die, n); if (!id2) return null;
          var d2 = ns.dieEngraving(id2);
          return d2 ? { flaw: !!d2.flaw } : null;
        },
      });
      renderAll(true, true);
    }, 0);
  }
  U.showDie = showDieScreen;

  /* ====================== TITLE ====================== */
  var CLASS_INFO = ns.CLASS_INFO;

  function showTitle() {
    combatChrome(false);
    $hud.innerHTML = ''; setHud(false);
    var s = overlayScreen();
    s.appendChild(el('div', 'title-logo', 'VOIDSPIRE'));
    s.appendChild(el('div', 'subtitle', ns.EPIGRAPH ? ns.EPIGRAPH.toUpperCase() : 'AN ENDLESS DESCENT'));
    /* THE BUILD STAMP. Twice now a report of "this feature is missing" has cost
     * a round trip to establish that the page was a cached older build. One
     * line on the title screen settles it in a glance. Stamped by the bundler
     * from git; reads "dev" when running unbundled. */
    s.appendChild(el('div', 'build-stamp', 'BUILD ' + (ns.BUILD || 'dev')));

    if (E.hasSave()) {
      var cont = el('div', 'panel-btn', '<div class="pb-title">▶ CONTINUE RUN</div><div class="pb-sub">Resume your descent</div>');
      cont.addEventListener('pointerdown', function () {
        SFX.tap();
        if (E.load()) U.refresh();
        else { toast('SAVE CORRUPTED'); E.clearSave(); showTitle(); }
      });
      s.appendChild(cont);
    }

    /* ---- VOID PRESSURE: pick the rating you descend at ----
     * The ladder is PER CLASS now, the way an ascension is per character, so
     * the picker browses up to the highest any class has reached and each class
     * button states its own ceiling. Choosing a class clamps you to what THAT
     * class has earned — clearing DRIFT on the Technomancer should not hand a
     * Void Adept a rating it has never finished a run at. */
    var CLASS_IDS = Object.keys(CLASS_INFO);
    var unlockedBy = {};
    CLASS_IDS.forEach(function (c) { unlockedBy[c] = E.pressureUnlocked(c); });
    var unlocked = CLASS_IDS.reduce(function (a, c) { return Math.max(a, unlockedBy[c]); }, 0);
    if (E.nextPressure == null) E.nextPressure = unlocked;
    var maxP = E.pressureMax();
    var pw = el('div', 'press-pick');
    function drawPressure() {
      var lv = E.nextPressure, L = B.ladder[lv] || B.ladder[0];
      var mods = E.pressureMods(lv);
      var chips = [];
      if (mods.enemyHp > 1) chips.push('HOSTILE HP +' + Math.round((mods.enemyHp - 1) * 100) + '%');
      if (mods.enemyDmg > 1) chips.push('HOSTILE DMG +' + Math.round((mods.enemyDmg - 1) * 100) + '%');
      if (mods.eliteWeight) chips.push('MORE ELITES');
      if (mods.misfireOn > 1) chips.push('MISFIRE ON 1–' + mods.misfireOn);
      if (mods.coreSlots) chips.push(mods.coreSlots + ' CORE SLOT');
      if (mods.restHeal < 1) chips.push('REST −' + Math.round((1 - mods.restHeal) * 100) + '%');
      if (mods.startFlaw) chips.push('START WITH A FLAW');
      if (mods.cardChoices) chips.push('CARD PICKS ' + (3 + mods.cardChoices));
      if (mods.shopCost > 1) chips.push('SHOPS +' + Math.round((mods.shopCost - 1) * 100) + '%');
      if (mods.potionDrop < 1) chips.push('FEWER STIMS');
      if (mods.bossStr) chips.push('BOSSES +' + mods.bossStr + ' MIGHT');
      pw.innerHTML =
        '<div class="pp-head"><button class="pp-arrow" data-d="-1" aria-label="Lower rating">◀</button>' +
        '<div class="pp-mid"><div class="pp-lab">VOID PRESSURE ' + lv + ' / ' + maxP + '</div>' +
        '<div class="pp-name">' + esc(L.name) + '</div></div>' +
        '<button class="pp-arrow" data-d="1" aria-label="Higher rating">▶</button></div>' +
        '<div class="pp-desc">' + esc(L.desc) + '</div>' +
        (chips.length ? '<div class="pp-chips">' + chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="pp-lock">' + (unlocked >= maxP ? 'ALL RATINGS UNLOCKED' : 'CLEAR A RATING TO UNLOCK THE NEXT · UNLOCKED: ' + unlocked) + '</div>';
      pw.querySelectorAll('.pp-arrow').forEach(function (b) {
        b.addEventListener('pointerdown', function (ev) {
          ev.stopPropagation(); SFX.tap();
          var next = E.nextPressure + (+b.dataset.d);
          if (next < 0 || next > unlocked) { if (next > unlocked) toast('CLEAR PRESSURE ' + unlocked + ' TO UNLOCK IT', 1600); return; }
          E.nextPressure = next; drawPressure();
        });
      });
    }
    drawPressure();
    s.appendChild(pw);

    Object.keys(CLASS_INFO).forEach(function (cls) {
      var ci = CLASS_INFO[cls], cc = B.classes[cls];
      var stats = cc.hp + ' HP · MGT ' + cc.might + ' · TEC ' + cc.tech + ' · PSI ' + cc.psi;
      var top = unlockedBy[cls];
      var rung = top > 0 ? 'CLEARED TO ' + E.pressureName(top - 1).toUpperCase() : 'NO RATING CLEARED';
      var btn = el('div', 'panel-btn' + (cls === 'technomancer' ? ' cyan' : cls === 'voidadept' ? ' magenta' : ''),
        '<div class="pb-title">' + ci.name + '</div>' +
        '<div class="pb-sub">' + esc(ci.tag) + ' · ' + stats + '</div>' +
        '<div class="pb-desc">' + esc(ci.desc) + '</div>' +
        '<div class="pb-sub">' + rung + ' · MAX ' + E.pressureName(top).toUpperCase() + '</div>');
      btn.addEventListener('pointerdown', function () {
        SFX.play();
        // clamp to what THIS class has earned, and say so rather than silently
        var want = E.nextPressure || 0;
        if (want > top) { E.nextPressure = top; toast(ci.name.toUpperCase() + ' HAS NOT CLEARED THAT — DESCENDING AT ' + E.pressureName(top).toUpperCase(), 2400); }
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

  // NaN guards: some art arrays carry NaN placeholders, which would poison a path
  function artPaths(A, cx, cy, s) {
    if (!A) return '';
    var out = '';
    (A.p || []).forEach(function (poly) {
      var pts = [];
      for (var i = 0; i < poly.length; i += 2) {
        if (isNaN(poly[i]) || isNaN(poly[i + 1])) continue;
        pts.push((cx + poly[i] * s).toFixed(1) + ',' + (cy + poly[i + 1] * s).toFixed(1));
      }
      if (pts.length > 1) out += '<polyline points="' + pts.join(' ') + '"/>';
    });
    (A.e || []).forEach(function (e) {
      out += '<circle class="gdot" cx="' + (cx + e[0] * s).toFixed(1) + '" cy="' + (cy + e[1] * s).toFixed(1) +
             '" r="' + Math.max(0.8, s * 0.06).toFixed(1) + '"/>';
    });
    return out;
  }

  // What lives in a node, shown honestly: a representative of the faction's
  // encounter pool rather than the exact roll, which combat still decides on
  // entry from row/sector context. Stable per node so it never reshuffles.
  function nodeCast(node, faction) {
    var h = (node.row * 31 + node.col * 17) >>> 0;
    if (node.type === 'boss') return ns.ENEMIES[E.sectorBossId()] || null;
    if (node.type === 'elite') { var el2 = ns.ELITES[faction] || []; return ns.ENEMIES[el2[h % el2.length]] || null; }
    if (node.type === 'fight' || node.type === 'beacon') {
      var pk = ns.PACKS[faction] || []; if (!pk.length) return null;
      var pack = pk[h % Math.min(pk.length, 6)];
      return ns.ENEMIES[pack[0]] || null;
    }
    return null;
  }
  var NODE_NAME = {
    fight: 'HOSTILES', elite: 'ELITE', beacon: 'BEACON', event: 'SIGNAL', rift: 'RIFT',
    shop: 'DEALER', market: 'MARKET', forge: 'FORGE', rest: 'CAMP', treasure: 'CACHE', boss: 'BOSS',
  };
  var NODE_CAT = {
    fight: 'HOSTILE', elite: 'MINI-BOSS', beacon: 'DISTRESS', event: 'ANOMALY', rift: 'ANOMALY',
    shop: 'MARKET', market: 'MARKET', forge: 'WORKSHOP', rest: 'SAFE', treasure: 'SALVAGE', boss: 'SECTOR BOSS',
  };

  // The room behind the chart. Deterministic from the sector so it is stable
  // across re-renders, and drawn once as dim line-art the map reads on top of.
  function mapBackdrop(W, H, seed) {
    var s0 = (seed * 2654435761) >>> 0;
    function rr() { s0 = (s0 * 1664525 + 1013904223) & 0x7fffffff; return s0 / 0x7fffffff; }
    var o = '<g class="mapbg">';
    for (var d = 0; d < 6; d++) { var y = (d + 0.5) * (H / 6);
      o += '<path d="M0 ' + y.toFixed(0) + ' L' + W + ' ' + (y - 14).toFixed(0) + '"/>'; }
    for (var v = 0; v < 12; v++) { var x = (v + 0.5) * (W / 12);
      o += '<path d="M' + x.toFixed(0) + ' 0 L' + (x - 26).toFixed(0) + ' ' + H + '"/>'; }
    for (var c2 = 0; c2 < 8; c2++) { var cy2 = rr() * H;
      o += '<path class="cond" d="M0 ' + cy2.toFixed(0) + ' L' + W + ' ' + (cy2 + (rr() - 0.5) * 50).toFixed(0) + '"/>'; }
    for (var pn = 0; pn < 18; pn++) {
      var px = rr() * (W - 120), py = rr() * (H - 80), pw = 40 + rr() * 90, ph = 26 + rr() * 44;
      o += '<rect class="panel" x="' + px.toFixed(0) + '" y="' + py.toFixed(0) + '" width="' + pw.toFixed(0) + '" height="' + ph.toFixed(0) + '"/>';
      for (var ln = 0; ln < 3; ln++)
        o += '<path class="scr" d="M' + (px + 6).toFixed(0) + ' ' + (py + 9 + ln * 9).toFixed(0) +
             ' L' + (px + 6 + rr() * (pw - 16)).toFixed(0) + ' ' + (py + 9 + ln * 9).toFixed(0) + '"/>';
    }
    for (var li = 0; li < 22; li++)
      o += '<circle class="blip" cx="' + (rr() * W).toFixed(0) + '" cy="' + (rr() * H).toFixed(0) + '" r="1.8"/>';
    return o + '</g>';
  }

  function showMap(preview) {
    updateHUD();
    var r = E.run, m = r.map;
    var s = overlayScreen(true);
    s.classList.add('map-screen', 'chartv2');
    var land = isLandscape();
    var COLS = m.COLS, ROWS = m.ROWS;
    var started = r.mapRow >= 0;

    // header strip, notched around the title like a HUD plate
    var head = el('div', 'chart-head');
    head.innerHTML =
      '<span class="ch-l">MAP // SECTOR ' + r.sector + ': ' + esc(ns.FACTIONS[r.faction].name.toUpperCase()) + '</span>' +
      '<span class="ch-mid"><span class="ch-title">' + (preview ? 'TACTICAL VIEW' : started ? 'CHOOSE THE NEXT JUMP' : 'CHOOSE YOUR ENTRY') + '</span></span>' +
      '<span class="ch-r"><b class="hp">' + r.hp + '/' + r.maxHp + '</b><b class="cr">¢' + r.credits + '</b></span>';
    s.appendChild(head);

    if (preview) {
      var back = el('button', 'btn map-back', '◀ RETURN');
      back.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); SFX.tap(); U.refresh(); });
      s.appendChild(back);
    }

    /* Unfinished business, said out loud. An engraving you picked is not cut
     * until you choose a face for it, and a relic does nothing until it is
     * mounted — both of which happen on the die screen, which was reachable
     * only through a 40px chip with a small badge on it. Neither state is rare:
     * 85% of measured runs ended holding a relic that was doing nothing. This
     * is a full-width bar that says which it is and opens the die. */
    if (!preview) {
      var pend = (r.die && r.die.pending) ? r.die.pending.length : 0;
      var mnt = r.die ? r.die.core.concat(r.die.frame) : [];
      var slack = (r.artifacts || []).filter(function (x) { return mnt.indexOf(x) < 0; }).length;
      var free = r.die ? Math.max(0, (r.die.coreSlots || 3) - r.die.core.length) : 0;
      var bits = [];
      if (pend) bits.push('<b>' + pend + '</b> ENGRAVING' + (pend > 1 ? 'S' : '') + ' TO CUT');
      var scars = (r.die ? ns.dieTaintedRoots(r.die).length : 0);
      if (scars) bits.push('<b>' + scars + '</b> SCARRED FACE' + (scars > 1 ? 'S' : ''));
      // only nag about idle relics when there is somewhere to actually put one
      if (slack && free) bits.push('<b>' + free + '</b> EMPTY CORE SLOT' + (free > 1 ? 'S' : ''));
      if (bits.length) {
        var alert = el('div', 'die-alert', '<span class="da-ic">' + dieChipSVG() + '</span>' +
          '<span class="da-txt">' + bits.join(' &nbsp;·&nbsp; ') + '</span><span class="da-go">OPEN THE DIE ▸</span>');
        alert.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); SFX.tap(); showDieScreen(); });
        s.appendChild(alert);
      }
    }

    // geometry: landscape flows left->right with the boss at the far end
    // The lane pitch is what sets the node size: landscape fits COLS lanes into
    // the panel height, so a tighter pitch means a bigger node. 98 is the floor
    // that still clears a node's own label block.
    // Lane pitch is set against the LANE COUNT: with three lanes spanning the
    // cross axis, a tighter pitch would blow the nodes up to fill the panel.
    var lane = land ? 145 : 118, step = land ? 128 : 118;
    // Room for the boss corona (ring 62 + spikes 17) at the far end of the run,
    // and for the entry row's label block at the near end. Portrait used to add
    // the corona allowance BELOW row 0 — the opposite end from the boss — so the
    // boss was cut off 24px by the top of the chart while 133 units sat empty
    // under the entry row.
    var padA = land ? 86 : 92, padE = land ? 77 : 92;
    // The boss is 79 units across where a normal node is 27, and its own name
    // hangs below it — at one plain step it wrote "THE FORGE TYRANT" straight
    // through the node in front of it. Stand it further out; it reads as the
    // destination rather than as one more stop.
    var bossGap = land ? 186 : 178;
    // Both labels hang BELOW their node (see nodeMarkup), so the outer lanes
    // need a strip under them and only a sliver above; portrait's cross axis is
    // horizontal, where the strip is for label WIDTH and so is symmetric.
    var padT = land ? 10 : 12, padB = land ? 36 : 12;
    // distance along the run, measured from the entry end
    function axis(row) { return row >= ROWS ? (ROWS - 1) * step + bossGap : row * step; }
    var runLen = padE + axis(ROWS) + padA;
    /* FIT THE LANE PITCH TO THE PANEL, rather than guessing a constant.
     *
     * The chart is drawn to a viewBox and fitted with `meet`, so its own aspect
     * ratio — not its size — decides how much of the panel it uses. A constant
     * pitch made the chart wider in proportion than the panel, so it either
     * left a band of dead chart above and below (before the row template was
     * fixed) or, once the panel got its full height, ran the back half of the
     * descent off the right-hand edge.
     *
     * Landscape is a FIXED 1024x600 design frame scaled by transform, so the
     * panel is 978x412 on every window from a phone to a 4K monitor — measured
     * across six viewports, identical every time. That is a known number, not
     * something to sample at runtime: solve the pitch for it and the descent
     * fills the panel and ends at its edge. */
    if (land) {
      var PANEL_ASPECT = 978 / 412;
      lane = Math.max(120, Math.min(320,
        Math.round((runLen / PANEL_ASPECT - padT - padB) / COLS)));
    }
    var W = land ? runLen : COLS * lane + padT + padB;
    var H = land ? COLS * lane + padT + padB : runLen;
    var reach = E.mapReachable(), cur = E.currentNode();
    var revealRow = (r.mapRow < 0 ? -1 : r.mapRow) + 3;

    function xy(node) {
      var jx = mapJit(node.row, node.col, 0) * 0.5, jy = mapJit(node.row, node.col, 1) * 0.5;
      if (land) return { x: padE + axis(node.row) + jx, y: padT + (node.col + 0.5) * lane + jy };
      return { x: padT + (node.col + 0.5) * lane + jx, y: H - padE - axis(node.row) + jy };
    }
    function targetOf(node, tc) {
      if (tc === 'boss') return m.boss;
      var nr = m.rows[node.row + 1];
      for (var i = 0; i < nr.length; i++) if (nr[i].col === tc) return nr[i];
      return null;
    }

    var par = land ? 'xMinYMid meet' : 'xMidYMin meet';
    var svg = '<svg class="starchart v2" viewBox="0 0 ' + W.toFixed(0) + ' ' + H.toFixed(0) + '" preserveAspectRatio="' + par + '">';
    svg += mapBackdrop(W, H, r.sector + (r.pressure || 0) * 7);

    // ---- connectors: thick, coloured by where they LEAD, junction ring at the bend
    for (var ri = 0; ri < ROWS; ri++) {
      m.rows[ri].forEach(function (node) {
        node.edges.forEach(function (tc) {
          var t = targetOf(node, tc); if (!t) return;
          var a = xy(node), b = xy(t);
          var live = (node === cur && reach.indexOf(t) >= 0);
          var trav = node.visited && t.visited;
          var cls = live ? 'live' : trav ? 'trav' : 'dim';
          var ic = ns.MAP_ICONS[t.type] || ns.MAP_ICONS.fight;
          var col = (!t.visited && t.row > revealRow && t.type !== 'boss') ? (LANE_COLOR[t.lane] || '#5e8a6c') : ic.color;
          var mx = ((a.x + b.x) / 2).toFixed(1), my = ((a.y + b.y) / 2).toFixed(1);
          var d = 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + mx + ' ' + my + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
          svg += '<path class="ln glow ' + cls + '" style="stroke:' + col + '" d="' + d + '"/>';
          svg += '<path class="ln core ' + cls + '" style="stroke:' + col + '" d="' + d + '"/>';
          svg += '<circle class="jn ' + cls + '" style="stroke:' + col + '" cx="' + mx + '" cy="' + my + '" r="5.5"/>';
        });
      });
    }

    // ---- nodes
    function nodeMarkup(node) {
      var isBoss = node.type === 'boss';
      var fogged = !isBoss && !node.visited && node.row > revealRow;
      var p = xy(node), ic = ns.MAP_ICONS[node.type] || ns.MAP_ICONS.fight;
      var col = fogged ? (LANE_COLOR[node.lane] || '#5e8a6c') : ic.color;
      var rad = isBoss ? 62 : (node.type === 'elite' ? 30 : 27);
      var reachable = reach.indexOf(node) >= 0;
      var state = node === cur ? 'current' : node.visited ? 'visited' : reachable ? 'reachable' : 'locked';
      var cast = fogged ? null : nodeCast(node, r.faction);
      var g = '<g class="mapnode ' + state + (fogged ? ' fogged' : '') + (isBoss ? ' isboss' : '') +
              ' nt-' + node.type + '" data-row="' + node.row + '" data-col="' + node.col + '" style="--nc:' + col + '">';
      g += '<circle class="wash" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + rad + '"/>';
      if (reachable) g += '<circle class="pulse" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + rad + '"/>';
      g += '<circle class="ring" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + rad + '"/>';
      if (isBoss) {
        for (var sp = 0; sp < 10; sp++) {
          var a2 = sp / 10 * Math.PI * 2 - 0.31;
          g += '<path class="spike" d="M' + (p.x + Math.cos(a2) * rad).toFixed(1) + ' ' + (p.y + Math.sin(a2) * rad).toFixed(1) +
               ' L' + (p.x + Math.cos(a2) * (rad + 17)).toFixed(1) + ' ' + (p.y + Math.sin(a2) * (rad + 17)).toFixed(1) + '"/>';
        }
      }
      if (fogged) g += '<text class="fogq" x="' + p.x.toFixed(1) + '" y="' + (p.y + 7).toFixed(1) + '">?</text>';
      else if (cast) g += '<g class="glyph cast">' + artPaths(cast.art, p.x, p.y + rad * 0.06, rad * 0.60) + '</g>';
      else g += '<g class="glyph">' + mapIconPaths(ic, p.x, p.y, rad * 0.50) + '</g>';
      // The reference labels every node because it only has thirteen. A sector
      // has forty, so name only what you can act on — the ones in reach, where
      // you are, and the boss. Everything else reads as shape and colour.
      var named = isBoss || reachable || node === cur;
      if (!fogged && named) {
        // Category over name, both UNDER the node. Splitting them above and
        // below meant two named nodes one lane apart put one's lower label into
        // the other's upper one — "DEALER" sitting on top of "ANOMALY". Stacked
        // beneath, a node's whole label block clears its neighbour's ring.
        // In portrait, neighbouring lanes sit side by side and a name is wider
        // than a lane is (RUST CULTIST is 81px across a 73px lane), so they ran
        // together into "SWARM CORERUST CULTISTFORGE WALKER". Drop every other
        // lane's block down a line: adjacent names never share a baseline.
        var stag = (!land && (node.col % 2)) ? 26 : 0;
        var lo = p.y + rad + (isBoss ? 32 : 15) + stag;
        g += '<text class="ncat" x="' + p.x.toFixed(1) + '" y="' + lo.toFixed(1) + '">' + esc(NODE_CAT[node.type] || '') + '</text>';
        var nm = isBoss ? E.sectorBossName() : (cast ? cast.name.toUpperCase() : (NODE_NAME[node.type] || ''));
        g += '<text class="nname" x="' + p.x.toFixed(1) + '" y="' + (lo + 13).toFixed(1) + '">' + esc(nm) + '</text>';
      }
      g += '<circle class="hit" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (rad + 12) + '"/>';
      return g + '</g>';
    }
    m.rows.forEach(function (row) { row.forEach(function (n) { svg += nodeMarkup(n); }); });
    svg += nodeMarkup(m.boss);
    svg += '</svg>';

    var wrap = el('div', 'map-wrap' + (land ? ' land' : ''));
    wrap.innerHTML = svg;
    s.appendChild(wrap);

    // compact legend + lane key on one strip
    var legend = el('div', 'chart-legend');
    ['fight', 'elite', 'event', 'shop', 'forge', 'rest', 'treasure'].forEach(function (t) {
      var ic = ns.MAP_ICONS[t];
      legend.innerHTML += '<span class="leg" style="color:' + ic.color + '"><svg viewBox="0 0 48 48">' +
        mapIconPaths(ic, 24, 24, 16) + '</svg>' + esc(NODE_LABEL[t]) + '</span>';
    });
    // A sector's rows are narrow enough that the route does not always reach
    // every highway — only key the ones that are actually out there.
    var laneSeen = {};
    m.rows.forEach(function (row) { row.forEach(function (n) { laneSeen[n.lane] = 1; }); });
    (m.lanes || []).forEach(function (ln) {
      if (!laneSeen[ln]) return;
      legend.innerHTML += '<span class="leg lane" style="color:' + LANE_COLOR[ln] + '"><i></i>' + esc(LANE_LABEL[ln]) + '</span>';
    });
    s.appendChild(legend);

    /* THE CHART GETS THE SLACK — whichever row it happens to be in.
     *
     * Landscape lays every screen out on a grid, and this one hard-coded
     * `auto minmax(0,1fr) auto`: three rows for a screen that has three
     * children ONLY when there is no die-alert bar and no RETURN button. With
     * the alert up — which is most of a run — the 1fr landed on the ALERT and
     * the chart fell into an implicit auto row, so a 46px bar was handed 60px
     * of slack above and below it while the star chart got 408px of a 914px
     * window. Same again in tactical view, where RETURN takes a row.
     *
     * The template is built from the children that actually exist, so adding
     * another bar here can never silently re-assign the slack. */
    s.style.gridTemplateRows = [].map.call(s.children, function (k) {
      return k.classList.contains('map-wrap') ? 'minmax(0, 1fr)' : 'auto';
    }).join(' ');

    wrap.addEventListener('pointerdown', function (ev) {
      if (preview) return;
      var g2 = ev.target.closest ? ev.target.closest('.mapnode') : null;
      if (!g2 || !g2.classList.contains('reachable')) return;
      var row = +g2.getAttribute('data-row'), col = +g2.getAttribute('data-col');
      var node = (row >= m.ROWS) ? m.boss : null;
      if (!node) { m.rows[row].forEach(function (n) { if (n.col === col) node = n; }); }
      if (node && E.enterNode(node)) { SFX.play(); U.refresh(); }
    });

    // keep the frontier in view on whichever axis the chart runs
    setTimeout(function () {
      var svgEl = wrap.querySelector('svg'); if (!svgEl) return;
      // Landscape fills the panel's HEIGHT and runs off to the right. CSS gets
      // this from the viewBox aspect, but intrinsic sizing of an inline <svg>
      // is not something to trust blind — pin it in pixels off the real box.
      if (land && wrap.clientHeight > 0) {
        svgEl.style.height = wrap.clientHeight + 'px';
        svgEl.style.width = (W * wrap.clientHeight / H).toFixed(0) + 'px';
      }
      // Before the first jump there is no current node — the frontier is the
      // entry row, which is the LEFT edge in landscape and the BOTTOM in
      // portrait (the chart climbs towards the boss).
      if (!cur) {
        wrap.scrollLeft = 0;
        wrap.scrollTop = land ? 0 : wrap.scrollHeight;
        return;
      }
      var rect = svgEl.getBoundingClientRect();
      var sx = rect.width / W, sy = rect.height / H, p2 = xy(cur);
      if (land) {
        wrap.scrollLeft = Math.max(0, p2.x * sx - wrap.clientWidth * 0.38);
      } else {
        wrap.scrollTop = Math.max(0, p2.y * sy - wrap.clientHeight * 0.62);
      }
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
  /* THE REAL DIE, IN THE FIGHT. It used to be a flat SVG hexagon with a number
   * printed on it — a readout of the die rather than the die. This is the same
   * icosahedron the engraving screen draws, so the solid you cut faces on is the
   * solid you watch land, and the chain hops across it face by face. */
  var combatDie = null;
  function combatDieMount() {
    var r = E.run; if (!r || !$die) return;
    if (combatDie) { combatDie.destroy(); combatDie = null; }
    var cv = $die.querySelector('.die3d'); if (!cv) return;
    var col = CLASS_COL[r.cls] || '#5dff88';
    combatDie = ns.dieViewCreate(cv, {
      face: 20, col: col, colHi: col, colTxt: '#eafcff', colDim: 'rgba(120,150,165,0.55)',
      tint: function (n) {
        var id2 = ns.dieFaceId(r.die, n); if (!id2) return null;
        var d2 = ns.dieEngraving(id2);
        return d2 ? { flaw: !!d2.flaw || !!ns.dieTaintAt(r.die, n) } : null;
      },
    });
    $die.style.color = col;
  }
  function combatDieUnmount() {
    if (combatDie) { combatDie.destroy(); combatDie = null; }
  }

  function showCombat() {
    hideOverlay();
    combatChrome(true);
    /* A LAW THE PLAYER CANNOT SEE IS NOT A RULE, IT IS AN AMBUSH. Stated once,
     * up front, before the first card is played. */
    (function () {
      var laws = (E.activeLaws && E.activeLaws()) || [];
      if (!laws.length || !E.combat || E.combat.turn > 1 || E.combat._lawShown) return;
      E.combat._lawShown = true;
      // several can hold at once now — elites travel in packs at high ratings
      laws.forEach(function (law, i) {
        setTimeout(function () { toast(law.name + ' — ' + law.desc, 4200); }, 500 + i * 900);
      });
    })();
    if (!combatDie) combatDieMount();
    if (E.combat && E.combat.turn <= 1 && !E.combat._dieShown) { E.combat._dieShown = true; clearDieResult(); }
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
    // A drawn override wins, per class art is the fallback. Nothing changes
    // until a slot is filled in js/uiart.js.
    var ic = (ns.uiArt && ns.uiArt('icon.' + which)) || set[which];
    return '<div class="pile-card pile-' + which + '">' + artSVG(ic, 'pile-ic', CLASS_COLOR[cls] || '#5dff88') +
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
    var grid = el('div', 'card-grid dense');
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

  /* ---- the hand fits the bar it is in ---------------------------------
   * Two numbers used to be hand-fitted constants: the card margin (a flat
   * -8px, applied whether you held ten cards or three) and the hand's side
   * padding (`0 142px 0 280px`). Measured on a 1742px window with five in
   * hand: 1320px of room for 450px of card, and they still buried 27% of each
   * other — and what a card covers is the NEXT card's description, the half
   * you read. The right reserve was 72px short of END TURN, so a full hand
   * dealt its last card over the button you end the turn with.
   *
   * Both are measured now. Kept OUT of renderHand because the dock, the belt
   * and the piles are laid out around the same moment the cards are, and
   * measuring them mid-flight reads zero — which is how the reserve came back
   * as 73px when the belt needed 274. It runs after the frame settles and on
   * every resize, and it is idempotent. */
  var CARD_W = 90, CARD_H = 128, GAP_MAX = 5, OVERLAP_MAX = 50;
  function fitHand() {
    var c = E.combat;
    if (!c || !$hand || $hand.style.display === 'none') return;
    var n = $hand.children.length;
    if (!n) return;
    var mid = (n - 1) / 2;
    var spread = n > 1 ? Math.min(4.2, 26 / n) : 0;
    /* The outer cards are ROTATED, so each one's box is wider than the card: a
     * 90x128 card at 12 degrees measures 114 across. Reserve that too, or the
     * end of the fan clips the button it was supposed to be clearing. */
    var fanBulge = Math.abs(CARD_H * Math.sin(mid * spread * Math.PI / 180)) / 2;
    var hb = $hand.getBoundingClientRect();
    var fs0 = $game ? ($game.getBoundingClientRect().width / Math.max(1, $game.offsetWidth)) : 1;
    if (!(fs0 > 0.01)) fs0 = 1;
    function reserve(sels, right) {
      var need = 0;
      sels.forEach(function (sel) {
        var e = document.querySelector(sel); if (!e) return;
        var b = e.getBoundingClientRect(); if (!b.width || !b.height) return;
        need = Math.max(need, right ? (hb.right - b.left) : (b.right - hb.left));
      });
      return Math.max(0, need / fs0) + 12 + fanBulge;
    }
    var padL = reserve(['#draw-pile', '#potion-belt', '.belt-lbl', '#energy-pip'], false);
    var padR = reserve(['#combat-controls', '#discard-pile'], true);
    $hand.style.paddingLeft = padL.toFixed(0) + 'px';
    $hand.style.paddingRight = padR.toFixed(0) + 'px';
    var avail = Math.max(80, $hand.clientWidth - padL - padR);
    var slack = avail - n * CARD_W;                       // px spare across the whole hand
    var per = n > 1 ? slack / (n - 1) : slack;            // ...per join
    /* 50 leaves 40px of every card showing — cost, name and enough art to tell
     * it apart, and still a tappable target. Capping the overlap tighter than
     * the hand needs does not make it fit; it makes the hand overflow its own
     * reserves and sit on the buttons instead. */
    var join = Math.max(-OVERLAP_MAX, Math.min(GAP_MAX, per));
    $hand.style.setProperty('--cm', (join / 2).toFixed(2) + 'px');
  }
  U.fitHand = fitHand;

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
        // a relic capping non-attacks made the card look perfectly playable
        (!info.unplayable && info.type !== 'attack' && E.nonAttackCapped() ? ' capped' : '') +
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
    fitHand();
    requestAnimationFrame(fitHand);   // ...and again once the dock has settled
    fitCards($hand);
  }

  // Auto-scale each card's description down until it fits its box (the standard
  // card-game fix for variable text length — no clipping, no overflow).
  function fitOne(desc) {
    desc.style.fontSize = '';                 // reset to the CSS default
    var cs = parseFloat(getComputedStyle(desc).fontSize) || 8.5;
    // A hand card can shrink hard — it is one of ten, and you can tap to inspect
    // it. A card you are CHOOSING between (reward, shop) is the opposite: the
    // text is the whole decision, so it gets a floor that stays readable and
    // enough card height to reach it.
    var floor = desc.closest && desc.closest('.card-grid:not(.dense)') ? 8.6 : 5.5;
    var guard = 0;
    while (desc.scrollHeight > desc.clientHeight + 0.5 && cs > floor && guard++ < 14) {
      cs -= 0.4; desc.style.fontSize = cs.toFixed(2) + 'px';
    }
  }
  // A name is one or two words, so it cannot be reflowed — "CONFLAGRATION" is
  // simply wider than the band. Breaking it mid-word ("CONFLAGRATIO/N") is the
  // worst of the options, so shrink the longest word until it fits instead.
  // Names that wrap at a space are already fitting and are left alone.
  function fitName(n) {
    n.style.fontSize = '';
    n.style.overflowWrap = 'normal';          // shrink before considering a break
    var cs = parseFloat(getComputedStyle(n).fontSize) || 8.5;
    var guard = 0;
    // 2px of slack: letter-spacing leaves a trailing gap after the last glyph,
    // so scrollWidth sits a pixel or two over clientWidth even when it fits.
    while (n.scrollWidth > n.clientWidth + 2 && cs > 6.5 && guard++ < 14) {
      cs -= 0.4; n.style.fontSize = cs.toFixed(2) + 'px';
    }
    // A hand card's name band is only ~47px wide, and a 13-letter single word
    // (CONFLAGRATION) does not fit it at any readable size. There, breaking the
    // word beats hiding half of it — but only after shrinking has failed.
    if (n.scrollWidth > n.clientWidth + 2) n.style.overflowWrap = 'break-word';
  }
  function fitCards(root) {
    if (!root) return;
    var scope = root.querySelectorAll ? root : document;
    scope.querySelectorAll('.card .cname').forEach(fitName);
    scope.querySelectorAll('.card .cdesc').forEach(fitOne);
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
    drag = { el: el, idx: i, info: E.cardInfo(card), x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0, moved: false, aimed: false, lock: -1, lastLock: -1 };
    // how far to slide this card to the hand's horizontal centre when it lifts to aim (StS-style)
    var hr = $hand.getBoundingClientRect(), cr = el.getBoundingClientRect();
    drag.aimOffX = ((hr.left + hr.width / 2) - (cr.left + cr.width / 2)) / uiScale;
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
      if (drag.info.needsTarget && !drag.info.unplayable) setTargeting(true);
      if (drag.info.type === 'attack' && E.canPlay(drag.idx)) startDieRoll();   // roll while you aim
    }
    if (drag.moved) {
      var aimMode = drag.info.needsTarget && !drag.info.unplayable && E.canPlay(drag.idx) && E.aliveEnemies().length >= 1;
      if (aimMode) {
        // lock-on: card lifts to the hand centre; the reticle locks the enemy under
        // the cursor (with a single enemy it auto-locks the sole target).
        drag.el.classList.add('card-aiming');
        drag.el.style.transform = 'translate(' + drag.aimOffX.toFixed(1) + 'px, -72px) scale(1.2)';
        var bf = document.getElementById('battlefield').getBoundingClientRect();
        var ax = ev.clientX - bf.left, ay = ev.clientY - bf.top;
        var lk = R.enemyAt(ax, ay);
        if (lk < 0 && E.aliveEnemies().length === 1) {
          // single enemy: a forgiving lock zone around it (no pixel-perfect hover),
          // but drag the cursor away from it and it un-targets so you can cancel.
          var sole = soleEnemyIdx(), sp = R.enemyPos(sole), sr = (R.views[sole] && R.views[sole].r) || 50;
          if (Math.hypot(ax - sp.x, ay - sp.y) < Math.max(120, sr * 2.4)) lk = sole;
        }
        R.setAim(ax, ay, lk);
        drag.aimed = true; drag.lock = lk;
        if (lk >= 0 && lk !== drag.lastLock) { SFX.lock(); drag.lastLock = lk; }   // ping on acquire
        else if (lk < 0) drag.lastLock = -1;
        drag.el.classList.toggle('will-play', lk >= 0);
      } else {
        // single-target / non-target cards keep the drag-to-play gesture
        var lift = Math.min(0, drag.dy);
        drag.el.style.transform = 'translate(' + (drag.dx / uiScale) + 'px,' + (drag.dy / uiScale) + 'px) scale(' + (1 + Math.min(0.25, -lift / 400)) + ')';
        drag.el.classList.toggle('will-play', canDropPlay(ev));
      }
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
  function soleEnemyIdx() {
    if (!E.combat) return -1;
    var es = E.combat.enemies, idx = -1, n = 0;
    for (var i = 0; i < es.length; i++) if (es[i].alive) { idx = i; n++; }
    return n === 1 ? idx : -1;
  }

  /* ---- hover tooltips for the canvas status/trait icons ---- */
  var TRAIT_TIP = {
    enrage: { title: 'Enrage', desc: 'Gains Strength every turn it stays alive — kill it fast or focus it down.' },
    thorns: { title: 'Thorns', desc: 'Reflects damage back at you each time you strike it.' },
    plate: { title: 'Reactive Plating', desc: 'Fully absorbs the first attack it takes each turn — a cheap jab pops it.' },
    overload: { title: 'Overload', desc: 'Detonates when it dies. Keep Block up on the turn you finish it.' },
    discipline: { title: 'Discipline', desc: 'Backlashes for damage if you play too many cards in a turn — pace your hand.' },
    ward: { title: 'Warded', desc: 'Immune to damage while its escort lives. Clear the escort first.' },
    leech: { title: 'Leech', desc: "Heals itself from the damage you don't block — block its hits to deny it." },
  };
  function iconTip(hit) {
    if (hit.kind === 'trait') return TRAIT_TIP[hit.key] || { title: hit.key, desc: '' };
    var title = ns.STATUS_NAMES[hit.key] || hit.key;
    return { title: title, desc: ns.KEYWORDS[title] || '' };
  }
  var $iconTip = null;
  function hideIconTip() { if ($iconTip) $iconTip.style.display = 'none'; }
  function showIconTip(hit, cx, cy) {
    if (!$iconTip) {
      $iconTip = document.createElement('div'); $iconTip.id = 'icon-tip';
      $iconTip.style.cssText = 'position:fixed;z-index:300;pointer-events:none;max-width:210px;padding:6px 9px;background:rgba(8,12,18,0.96);border:1px solid #2c3a44;border-radius:5px;font:11px ui-monospace,monospace;color:#cfe0ea;box-shadow:0 4px 14px rgba(0,0,0,0.5);display:none;';
      document.body.appendChild($iconTip);
    }
    var info = iconTip(hit);
    $iconTip.innerHTML = '<div style="font-weight:bold;color:#fff' + (info.desc ? ';margin-bottom:3px' : '') + '">' + esc(info.title) + '</div>' +
      (info.desc ? '<div style="color:#9fb4c0;line-height:1.35">' + esc(info.desc) + '</div>' : '');
    $iconTip.style.display = 'block';
    var tw = $iconTip.offsetWidth, th = $iconTip.offsetHeight;
    $iconTip.style.left = Math.max(8, Math.min(window.innerWidth - tw - 8, cx + 14)) + 'px';
    $iconTip.style.top = Math.max(8, cy - th - 10) + 'px';
  }
  function onIconHover(ev) {
    if (drag || potionDrag || locked || !E.combat || ev.pointerType === 'touch') { hideIconTip(); return; }
    var bf = document.getElementById('battlefield').getBoundingClientRect();
    var hit = R.iconAt && R.iconAt(ev.clientX - bf.left, ev.clientY - bf.top);
    if (hit) showIconTip(hit, ev.clientX, ev.clientY); else hideIconTip();
  }

  function onDragEnd(ev) {
    if (potionDrag) { onPotionEnd(ev); return; }
    if (!drag) return;
    var d = drag;
    drag = null;
    d.el.classList.remove('dragging');
    d.el.classList.remove('will-play');
    d.el.classList.remove('card-aiming');
    d.el.style.transform = '';

    if (!d.moved) { cardTapped(d.idx); return; }

    if (locked || !E.combat || E.combat.over) { setTargeting(false); cancelDieRoll(); return; }

    var info = d.info;
    if (info.unplayable) { setTargeting(false); cancelDieRoll(); toast('UNPLAYABLE — a curse weighs down your deck'); return; }
    if (E.swarmDisabled(d.idx)) { setTargeting(false); cancelDieRoll(); toast('DISABLED — a Void Swarm grips this card'); return; }
    var why = E.whyCantPlay(d.idx);
    if (why) { setTargeting(false); cancelDieRoll(); toast(why, 2600); return; }

    // lock-on aim: fire at the locked target (released over empty space cancels)
    if (d.aimed) {
      if (d.lock >= 0) playCardAt(d.idx, d.lock);   // cardPlayed will settle the die
      else { setTargeting(false); cancelDieRoll(); if (-d.dy > B.feel.swipeThreshold) toast('AIM AT A TARGET'); }
      return;
    }
    // non-target / fallback: swipe up or drop on an enemy to play
    var tgt = enemyAtClient(ev);
    if (tgt >= 0 || -d.dy > B.feel.swipeThreshold) playCardAt(d.idx, tgt);
    else { setTargeting(false); cancelDieRoll(); }
  }

  function onDragCancel() {
    if (potionDrag) { onPotionCancel(); return; }
    if (!drag) return;
    drag.el.classList.remove('dragging');
    drag.el.classList.remove('will-play');
    drag.el.classList.remove('card-aiming');
    drag.el.style.transform = '';
    drag = null;
    setTargeting(false);
    cancelDieRoll();
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
    if (!on && R.clearAim) R.clearAim();
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
    if (!cf) {                                    // unstyled fallback: legacy dematerialise
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
    // -- Vanguard (every card gets a space-marine cast: bolters, ordnance,
    //    chainswords, ceramite plates and blood-price) --
    // bolt weapons
    pulse_rifle: 'boltRound', scrap_shot: 'boltRound', salvage_servitor: 'boltRound',
    burst_fire: 'boltBurst', frenzy: 'boltBurst', hail_of_lead: 'boltBurst',
    rapid_fire: 'boltStorm', full_auto: 'boltStorm',
    unload: 'heavyBolter', heavy_ordnance: 'heavyBolter', salvaged_ordnance: 'heavyBolter',
    executioner: 'execRound',
    suppressing_fire: 'suppress', suppressing_barrage: 'suppress',
    // ordnance
    frag_grenade: 'fragLob', cluster_charge: 'clusterLob', cluster_munitions: 'clusterLob',
    breaching_charge: 'meltaCharge', scorched_earth: 'flamer',
    salvo: 'shrapnelBurst', demolition_train: 'shrapnelBurst',
    orbital_strike: 'orbital', orbital_bombardment: 'orbital',
    // melee / shield
    shield_slam: 'powerFist', shield_bash: 'powerFist', kinetic_discharge: 'slam',
    bayonet_charge: 'chainsword', reckless_charge: 'chainsword', counterstrike: 'chainsword', whirlwind: 'chainsword',
    breach: 'reap',
    // ceramite: guard stances and lock-downs
    iron_resolve: 'plateLock', barricade_protocol: 'plateLock', bunker_down: 'plateLock',
    bulwark: 'plateLock', riot_shield: 'plateLock', rallying_shout: 'plateLock', juggernaut_core: 'plateLock',
    deflect: 'bracePlant', spiked_bulwark: 'bracePlant', riposte_protocol: 'bracePlant', vengeance: 'bracePlant',
    // war-cries and rage
    war_cry: 'warhorn', warlord_protocol: 'warhorn',
    combat_stims: 'furor', limit_break: 'furor', bloodlust: 'furor', reckless_protocol: 'furor', blood_rage: 'furor',
    crimson_pact: 'bloodToll', whet_the_blade: 'bloodToll', bloodbath: 'bloodToll',
    // logistics
    munitions_dump: 'energize', adrenal_surge: 'energize',
    quartermaster: 'reload', field_strip: 'reload', trigger_discipline: 'reload',
    // marksman / dice
    take_aim: 'scan', steady_aim: 'scan', deadeye_protocol: 'warhorn', misfire_protocol: 'reload',
    marksman_round: 'boltRound', hair_trigger: 'boltRound', killshot: 'execRound',
    // -- Technomancer (Forge Choir: rails, arcs, hydraulics and coolant. His
    //    table scales Shield, so plating cards get real casts too) --
    // rail and coil weapons
    shock_coil: 'zap', static_lance: 'railShot', railgun: 'railShot', fortified_strike: 'railShot',
    capacitor_discharge: 'capDump', overcharged_capacitor: 'capDump', overload_surge: 'capDump',
    leech_coil: 'hungerDrain',
    // arcs and electrical fields
    chain_lightning: 'arcChain', arc_welder: 'arcChain', tesla_conduit: 'teslaField',
    static_field: 'teslaField', static_ward: 'teslaField', ion_storm: 'ionStorm',
    emp_blast: 'empWave', emp_mine: 'empWave', disruptor_pulse: 'empWave', system_shock: 'empWave',
    short_circuit: 'shortCircuit', feedback_loop: 'shortCircuit',
    mortar_array: 'mortarArc', hive_protocol: 'mortarArc',
    // constructs
    deploy_turret: 'servoDeploy', sentry_protocol: 'servoDeploy', drone_swarm: 'servoDeploy',
    assault_drone: 'servoDeploy', swarm_uplink: 'servoDeploy', munitions_factory: 'servoDeploy',
    // plating — the band scales these, so they land like plate, not like a puff
    overshield: 'plateWeld', fortify_matrix: 'plateWeld', entrench_field: 'plateWeld',
    reinforced_hull: 'plateWeld', hold_the_line: 'plateWeld', aegis_matrix: 'plateWeld',
    phase_bulwark: 'plateWeld',
    // reactors and powers
    echo_core: 'reactorSpool', aux_reactor: 'reactorSpool', overload_capacitor: 'reactorSpool',
    shield_battery: 'reactorSpool', omega_protocol: 'reactorSpool', singularity_drive: 'reactorSpool',
    flux_capacitor: 'reactorSpool', subroutine: 'reactorSpool',
    // logistics and calibration
    cogwork_surge: 'logicSurge', salvage_protocol: 'logicSurge', surge_protocol: 'logicSurge',
    targeting_uplink: 'logicSurge', overclock: 'overclock',
    recompile: 'recalibrate',
    nano_repair: 'coolantVent',
    // -- Void Adept (THE HUNGER: nothing here has a mechanism. Blood costs get a
    //    sound you feel rather than hear) --
    // focused thought
    mind_spike: 'psiLance', psy_lance: 'psiLance', void_bolt: 'psiLance',
    mind_lance: 'psiLance', cerebral_spike: 'psiLance', vital_lance: 'psiLance',
    mind_storm: 'psiScream', psionic_scream: 'psiScream', psionic_nova: 'psiScream',
    ascendant_mind: 'psiScream',
    tk_crush: 'mindGrip', mind_bulwark: 'mindGrip',
    // fire
    soul_burn: 'emberBloom', hex_weave: 'emberBloom', catalyst: 'emberBloom',
    immolate: 'emberBloom', cinder_burst: 'emberBloom', mind_burn: 'emberBloom',
    ember_storm: 'conflagrate', conflagration: 'conflagrate', wildfire_engine: 'conflagrate',
    backdraft: 'backdraft', ember_ward: 'sanguineWard',
    // blood
    blood_sacrifice: 'bloodPrice', hemorrhage: 'bloodPrice', bloodletting: 'bloodPrice',
    crimson_rite: 'bloodPrice', martyrs_gift: 'bloodPrice',
    exsanguinate: 'hungerDrain', void_siphon: 'hungerDrain',
    sanguine_ward: 'sanguineWard',
    // decay and dread
    wither: 'witherTouch', entropic_lash: 'witherTouch', null_field: 'witherTouch',
    mind_fracture: 'dreadWhisper', dread_whisper: 'dreadWhisper', spectral_grasp: 'dreadWhisper',
    unravel: 'reap',
    // tearing the world
    void_rupture: 'voidRupture', singularity_bloom: 'voidRupture',
    dimensional_rift: 'dimensionRift', eldritch_storm: 'dimensionRift',
    // powers
    psionic_focus: 'sigilBurn', blood_pact: 'sigilBurn', entropy_field: 'sigilBurn',
    mind_array: 'sigilBurn', plague_engine: 'sigilBurn',
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
    /* ---- Vanguard: Adeptus-pattern ordnance. Low, percussive, physical. Every
       hit lands with a white flash, a shockwave and thrown debris (R.quake) so
       the weight reads instantly even at a glance. ---- */
    boltRound: {   // one mass-reactive round: sharp crack, meaty impact
      s: function (e) { noise(0.05, 0.055, 5200, 700); synth(150 * e.pm, 0.2, 'square', 0.055, -95, { detune: 11, filter: [1800, 220] }); },
      a: function (e) { if (e.tp) { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, '#ffe9c0', 4); R.burst(e.sx, e.sy, '#ffe9c0', 5); R.quake(e.tp.x, e.tp.y, e.col, 1); } },
    },
    boltBurst: {   // three-round burst, each shell landing on its own beat
      s: function (e) { [0, 1, 2].forEach(function (i) { setTimeout(function () { noise(0.04, 0.045, 5000, 800); synth(162 * e.pm, 0.13, 'square', 0.048, -80, { detune: 10, filter: [1700, 240] }); }, i * 85); }); },
      a: function (e) { if (e.tp) [0, 85, 170].forEach(function (d) { setTimeout(function () { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, '#ffe9c0', 3); R.quake(e.tp.x, e.tp.y, e.col, 0); }, d); }); },
    },
    boltStorm: {   // the trigger is held down — a hammering stream of rounds
      s: function (e) { noise(0.34, 0.05, 3000, 500); [0, 1, 2, 3, 4].forEach(function (i) { setTimeout(function () { synth(175 * e.pm, 0.07, 'square', 0.032, -60, { filter: [1600, 300] }); }, i * 55); }); },
      a: function (e) { if (e.tp) [0, 55, 110, 165, 220].forEach(function (d) { setTimeout(function () { R.shot(e.sx, e.sy, e.tp.x, e.tp.y, '#ffe9c0'); R.burst(e.tp.x, e.tp.y, e.col, 3); }, d); }); setTimeout(function () { if (e.tp) R.quake(e.tp.x, e.tp.y, e.col, 1); }, 230); },
    },
    heavyBolter: {   // siege-grade shell: deep boom and a wide shockwave
      s: function (e) { noise(0.14, 0.07, 1200, 120); synth(80 * e.pm, 0.3, 'square', 0.07, -26, { detune: 14, filter: [1100, 120] }); },
      a: function (e) { if (e.tp) { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, '#ffe9c0', 8); R.quake(e.tp.x, e.tp.y, e.col, 3); } },
    },
    execRound: {   // executioner shell: a spin-up whine, then one killing round
      s: function (e) { synth(240 * e.pm, 0.16, 'sawtooth', 0.035, 380, { detune: 8 }); setTimeout(function () { noise(0.16, 0.08, 1400, 130); synth(70, 0.3, 'square', 0.075, -20, { detune: 16, filter: [1000, 110] }); }, 170); },
      a: function (e) { if (e.tp) setTimeout(function () { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, '#ffffff', 9); R.nova(e.tp.x, e.tp.y, e.col, e.power); R.quake(e.tp.x, e.tp.y, e.col, 4); }, 170); },
    },
    suppress: {   // raking fire walked across the whole line
      s: function (e) { noise(0.3, 0.05, 2400, 400); [0, 1, 2, 3].forEach(function (i) { setTimeout(function () { synth(170 * e.pm, 0.08, 'square', 0.034, -60, { filter: [1500, 300] }); }, i * 65); }); },
      a: function (e) { var ts = (e.targets && e.targets.length) ? e.targets : (e.tp ? [e.tp] : []); ts.forEach(function (tt, i) { setTimeout(function () { R.beamBolt(e.sx, e.sy, tt.x, tt.y, '#ffe9c0', 3); R.quake(tt.x, tt.y, e.col, 0); }, i * 70); }); },
    },
    fragLob: {   // grenade arcs out, hangs, then detonates with debris
      s: function (e) { synth(300, 0.15, 'sine', 0.022, -160); setTimeout(function () { noise(0.2, 0.075, 1500, 90); synth(70, 0.3, 'square', 0.068, -22, { detune: 16, filter: [900, 100] }); }, 300); },
      a: function (e) { var ts = (e.targets && e.targets.length) ? e.targets : (e.tp ? [e.tp] : []); ts.forEach(function (tt) { R.lob(e.sx, e.sy, tt.x, tt.y, e.col, 0.3); setTimeout(function () { R.quake(tt.x, tt.y, e.col, 2); R.shards(tt.x, tt.y, e.col, 8, -Math.PI / 2, Math.PI * 1.4); }, 300); }); },
    },
    clusterLob: {   // a salvo of charges raining in one after another
      s: function (e) { [0, 1, 2].forEach(function (i) { setTimeout(function () { noise(0.16, 0.06, 1400, 110); synth(84, 0.22, 'square', 0.055, -24, { detune: 14, filter: [950, 110] }); }, 260 + i * 110); }); },
      a: function (e) { var ts = (e.targets && e.targets.length) ? e.targets : (e.tp ? [e.tp] : []); ts.forEach(function (tt, i) { R.lob(e.sx, e.sy, tt.x, tt.y, e.col, 0.26 + i * 0.11); setTimeout(function () { R.quake(tt.x, tt.y, e.col, 2); R.shards(tt.x, tt.y, e.col, 6, -Math.PI / 2, Math.PI * 1.5); }, 260 + i * 110); }); },
    },
    meltaCharge: {   // breaching charge: a searing burn-through, then the wall goes
      s: function (e) { synth(260, 0.18, 'sine', 0.028, 300); setTimeout(function () { noise(0.26, 0.07, 2600, 200); synth(75, 0.3, 'square', 0.07, -20, { detune: 15, filter: [1000, 100] }); }, 200); },
      a: function (e) { if (e.tp) setTimeout(function () { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, '#ffd27a', 10); R.quake(e.tp.x, e.tp.y, BURN_COL, 3); R.embers(e.tp.x, e.tp.y, BURN_COL, 14); }, 200); },
    },
    powerFist: {   // shield/fist slam — thunderclap and a ground quake
      s: function (e) { noise(0.16, 0.08, 900, 110); synth(64 * e.pm, 0.34, 'square', 0.075, -18, { detune: 18, filter: [800, 90] }); },
      a: function (e) { if (e.tp) { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, e.col, 9); R.quake(e.tp.x, e.tp.y, e.col, 4); R.shards(e.tp.x, e.tp.y, '#ffffff', 8, -Math.PI / 2, Math.PI * 1.5); } },
    },
    chainsword: {   // teeth rev, then a heavy cut that throws sparks
      s: function (e) { synth(180 * e.pm, 0.2, 'sawtooth', 0.038, 40, { vib: 55, vibRate: 34, filter: [2200, 600] }); setTimeout(function () { noise(0.08, 0.06, 6000, 900); synth(220, 0.12, 'square', 0.05, -180); }, 190); },
      a: function (e) { if (e.tp) setTimeout(function () { R.spiral(e.tp.x, e.tp.y, e.col, 4, 22); R.shards(e.tp.x, e.tp.y, '#ffffff', 9, 0, Math.PI * 2); R.quake(e.tp.x, e.tp.y, e.col, 1); }, 190); },
    },
    flamer: {   // promethium gout washing over the line
      s: function (e) { noise(0.5, 0.055, 900, 2600); synth(120, 0.4, 'sawtooth', 0.028, 60, { vib: 20, vibRate: 18 }); },
      a: function (e) { var ts = (e.targets && e.targets.length) ? e.targets : (e.tp ? [e.tp] : []); R.shards(e.sx, e.sy, BURN_COL, 10, 0, 0.7); ts.forEach(function (tt, i) { setTimeout(function () { R.embers(tt.x, tt.y, BURN_COL, 16 + e.power * 4); R.ring(tt.x, tt.y, BURN_COL, 34, 0.4); }, i * 60); }); },
    },
    shrapnelBurst: {   // spent casings detonate — fragments spray the whole line
      s: function (e) { noise(0.18, 0.065, 3600, 300); synth(130 * e.pm, 0.16, 'square', 0.045, -70, { detune: 12 }); },
      a: function (e) { var ts = (e.targets && e.targets.length) ? e.targets : (e.tp ? [e.tp] : []); R.shards(e.sx, e.sy, e.col, 14, 0, 1.1); ts.forEach(function (tt) { R.quake(tt.x, tt.y, e.col, 1); }); },
    },
    warhorn: {   // battle-cry: a deep horn and a shout that rolls outward
      s: function (e) { synth(110 * e.pm, 0.4, 'sawtooth', 0.048, 40, { detune: 12, filter: [1400, 500] }); setTimeout(function () { synth(165 * e.pm, 0.3, 'square', 0.038, 20, { detune: 8 }); }, 120); },
      a: function (e) { R.ring(e.pp.x, e.pp.y - 6, e.col, 70, 0.55); setTimeout(function () { R.ring(e.pp.x, e.pp.y - 6, e.col, 96, 0.6); }, 110); R.aura(e.pp.x, e.pp.y - 6, e.col); R.shake(0.35); },
    },
    plateLock: {   // ceramite plates slam home and lock
      s: function (e) { synth(150 * e.pm, 0.1, 'square', 0.048, -40, { filter: [1600, 300] }); setTimeout(function () { noise(0.09, 0.06, 1100, 180); synth(95, 0.2, 'square', 0.055, -24, { detune: 12 }); }, 90); },
      a: function (e) { R.polyRing(e.pp.x, e.pp.y - 6, e.col, 62, 26, 6, 0.42, -3, 3); setTimeout(function () { R.polyRing(e.pp.x, e.pp.y - 6, e.col, 30, 46, 6, 0.4, 2, 2.5); R.shake(0.28); }, 90); R.aura(e.pp.x, e.pp.y - 6, e.col); },
    },
    bracePlant: {   // set the feet and take the hit — a hard guard stance
      s: function (e) { noise(0.08, 0.05, 1500, 220); synth(120 * e.pm, 0.24, 'square', 0.05, -34, { detune: 12, filter: [1300, 260] }); },
      a: function (e) { R.polyRing(e.pp.x, e.pp.y - 6, e.col, 54, 30, 3, 0.45, 1.4, 3); R.shards(e.pp.x, e.pp.y + 16, e.col, 6, -Math.PI / 2, 1.2); R.shake(0.25); },
    },
    furor: {   // stims / rage — the armour floods red and he winds up
      s: function (e) { synth(120 * e.pm, 0.3, 'sawtooth', 0.048, 200, { detune: 14, vib: 16, vibRate: 9 }); },
      a: function (e) { R.aura(e.pp.x, e.pp.y - 6, '#ff4a5e'); R.ring(e.pp.x, e.pp.y - 6, '#ff4a5e', 58, 0.5); setTimeout(function () { R.ring(e.pp.x, e.pp.y - 6, e.col, 76, 0.5); }, 90); R.shake(0.3); },
    },
    bloodToll: {   // paid in his own blood — a hard, wet cost
      s: function (e) { synth(190 * e.pm, 0.18, 'sawtooth', 0.045, -120, { detune: 10 }); setTimeout(function () { synth(90, 0.22, 'square', 0.05, -26, { detune: 14 }); }, 110); },
      a: function (e) { R.implode(e.pp.x, e.pp.y - 6, '#ff4a5e', 34, 40, 14); R.ring(e.pp.x, e.pp.y - 6, '#ff4a5e', 44, 0.45); if (e.tp) setTimeout(function () { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, '#ff8a6e', 6); R.quake(e.tp.x, e.tp.y, '#ff4a5e', 2); }, 110); },
    },
    /* ---- Technomancer: FORGE CHOIR. Where the Vanguard is percussive and
       physical, the Magos is electrical and mechanical — capacitor whine,
       relay clunk, coolant hiss. His table scales Shield, so his plating cards
       get real casts too, not a generic block puff. ---- */
    railShot: {   // magnetic accelerator: the coil spools audibly, then one crack
      s: function (e) { synth(200 * e.pm, 0.24, 'sawtooth', 0.028, 1100, { detune: 8, filter: [500, 3200] }); setTimeout(function () { noise(0.05, 0.06, 7000, 900); synth(1500 * e.pm, 0.09, 'square', 0.05, -1200); }, 200); },
      a: function (e) { setTimeout(function () { if (e.tp) { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, '#d8f6ff', 6); R.quake(e.tp.x, e.tp.y, e.col, 2); R.ring(e.sx, e.sy, e.col, 22, 0.16); } }, 200); if (e.tp) R.aura(e.sx, e.sy, e.col); },
    },
    arcChain: {   // the bolt walks from body to body, each jump a little flatter
      s: function (e) { noise(0.16, 0.04, 6000, 1800); [0, 1, 2].forEach(function (i) { setTimeout(function () { synth((820 - i * 130) * e.pm, 0.11, 'square', 0.034, -240, { vib: 34, vibRate: 32 }); }, i * 90); }); },
      a: function (e) { var src = { x: e.sx, y: e.sy }; e.targets.forEach(function (tg, i) { setTimeout(function () { R.arc(src.x, src.y, tg.x, tg.y, '#d8f6ff', 8, 13); R.burst(tg.x, tg.y, e.col, 5); }, i * 90); src = tg; }); },
    },
    empWave: {   // an EM front rolls out and everything it touches stutters
      s: function (e) { synth(90 * e.pm, 0.4, 'sine', 0.06, 260, { filter: [200, 2600] }); noise(0.22, 0.03, 900, 4000); },
      a: function (e) { R.ring(e.pp.x, e.pp.y - 12, e.col, 34, 0.42); R.ring(e.pp.x, e.pp.y - 12, '#d8f6ff', 20, 0.3); e.targets.forEach(function (tg, i) { setTimeout(function () { R.glitch(tg.x, tg.y, e.col); R.burst(tg.x, tg.y, e.col, 4); }, 70 + i * 55); }); },
    },
    capDump: {   // a bank of capacitors emptied at once: fat, low, over quickly
      s: function (e) { synth(58 * e.pm, 0.3, 'square', 0.075, -14, { detune: 16, filter: [900, 90] }); noise(0.1, 0.05, 2400, 200); },
      a: function (e) { if (e.tp) { R.beamBolt(e.sx, e.sy, e.tp.x, e.tp.y, '#d8f6ff', 9); R.quake(e.tp.x, e.tp.y, e.col, 3); } R.ring(e.sx, e.sy, e.col, 26, 0.2); },
    },
    servoDeploy: {   // something unfolds, seats, and locks
      s: function (e) { noise(0.1, 0.03, 1400, 3000); setTimeout(function () { synth(300 * e.pm, 0.14, 'sawtooth', 0.035, 220, { filter: [700, 2200] }); }, 60); setTimeout(function () { noise(0.05, 0.06, 800, 180); }, 220); },
      a: function (e) { var x = e.pp.x - 26, y = e.pp.y - 18; R.aura(x, y, e.col); setTimeout(function () { R.polyRing(x, y, e.col, 6, 20, 2, 0.36, 4, 1.4); R.burst(x, y, '#d8f6ff', 7); }, 200); },
    },
    plateWeld: {   // hydraulics hiss, then a plate seats with a clunk. His SHIELD.
      s: function (e) { noise(0.16, 0.032, 2600, 700); setTimeout(function () { synth(140 * e.pm, 0.16, 'square', 0.06, -40, { filter: [1200, 200] }); noise(0.05, 0.05, 700, 160); }, 150); },
      a: function (e) { R.aura(e.pp.x, e.pp.y - 10, e.col); setTimeout(function () { R.polyRing(e.pp.x, e.pp.y - 10, e.col, 6, 30, 3, 0.34, 0, 0); R.burst(e.pp.x, e.pp.y - 10, '#d8f6ff', 8); }, 150); },
    },
    coolantVent: {   // pressure released: a long hiss and a falling tone
      s: function (e) { noise(0.42, 0.035, 5200, 700); synth(420 * e.pm, 0.3, 'sine', 0.03, -180, { filter: [2200, 500] }); },
      a: function (e) { for (var i = 0; i < 3; i++) (function (d) { setTimeout(function () { R.aura(e.pp.x + 10 - d * 6, e.pp.y - 20, '#d8f6ff'); }, d * 90); })(i); },
    },
    reactorSpool: {   // a POWER coming online: rising harmonic stack, then it holds
      s: function (e) { [0, 1, 2, 3].forEach(function (i) { setTimeout(function () { synth((160 + i * 110) * e.pm, 0.3, 'sawtooth', 0.026, 40, { detune: 7, filter: [600 + i * 500, 2600] }); }, i * 90); }); },
      a: function (e) { [0, 90, 180, 270].forEach(function (d, i) { setTimeout(function () { R.polyRing(e.pp.x, e.pp.y - 16, e.col, 6, 14 + i * 9, 2, 0.4, 3, 0.8); }, d); }); setTimeout(function () { R.aura(e.pp.x, e.pp.y - 16, '#d8f6ff'); }, 300); },
    },
    logicSurge: {   // data moving: clean machine chirps, no weight at all
      s: function (e) { arp(mul([880, 1174, 1568], e.pm), 46, 0.05, 'square', 0.028); },
      a: function (e) { R.scan(e.pp.x, e.pp.y - 20, e.col); R.burst(e.pp.x + 6, e.pp.y - 14, '#d8f6ff', 6); },
    },
    mortarArc: {   // shells lobbed high and dropped in
      s: function (e) { [0, 1, 2].forEach(function (i) { setTimeout(function () { noise(0.05, 0.03, 900, 2600); }, i * 120); setTimeout(function () { noise(0.1, 0.06, 1600, 160); synth(88 * e.pm, 0.2, 'square', 0.05, -22); }, 340 + i * 120); }); },
      a: function (e) { e.targets.slice(0, 3).forEach(function (tg, i) { setTimeout(function () { R.lob(e.sx, e.sy, tg.x, tg.y, e.col); }, i * 120); setTimeout(function () { R.quake(tg.x, tg.y, e.col, 2); R.burst(tg.x, tg.y, '#d8f6ff', 8); }, 340 + i * 120); }); },
    },
    teslaField: {   // a standing field, crackling where it touches things
      s: function (e) { noise(0.5, 0.028, 4200, 1400); [0, 1, 2, 3].forEach(function (i) { setTimeout(function () { synth((640 + (i % 2) * 180) * e.pm, 0.09, 'square', 0.024, -140, { vib: 40, vibRate: 36 }); }, i * 110); }); },
      a: function (e) { R.ring(e.pp.x, e.pp.y - 14, e.col, 40, 0.5); e.targets.forEach(function (tg, i) { [0, 160, 320].forEach(function (d) { setTimeout(function () { R.arc(e.sx, e.sy, tg.x, tg.y, e.col, 5, 9); }, d + i * 40); }); }); },
    },
    shortCircuit: {   // it fails, violently: a sputter and thrown sparks
      s: function (e) { [0, 1, 2, 3, 4].forEach(function (i) { setTimeout(function () { noise(0.03, 0.05, 6000 - i * 700, 900); }, i * 38); }); synth(210 * e.pm, 0.16, 'sawtooth', 0.04, -160, { vib: 50, vibRate: 44 }); },
      a: function (e) { if (e.tp) { R.arc(e.sx, e.sy, e.tp.x, e.tp.y, '#d8f6ff', 9, 15); R.burst(e.tp.x, e.tp.y, e.col, 10); R.glitch(e.tp.x, e.tp.y, e.col); } },
    },
    ionStorm: {   // the whole field goes electrical
      s: function (e) { noise(0.7, 0.04, 5000, 800); [0, 1, 2, 3, 4, 5].forEach(function (i) { setTimeout(function () { synth((520 + (i % 3) * 220) * e.pm, 0.12, 'square', 0.03, -200, { vib: 36, vibRate: 30 }); }, i * 95); }); },
      a: function (e) { R.ring(e.pp.x, e.pp.y - 16, e.col, 52, 0.6); e.targets.forEach(function (tg, i) { [0, 130, 260, 390].forEach(function (d, k) { setTimeout(function () { R.arc(e.sx, e.sy, tg.x, tg.y, k % 2 ? '#d8f6ff' : e.col, 7, 12); R.burst(tg.x, tg.y, e.col, 4); }, d + i * 45); }); }); },
    },
    recalibrate: {   // a servo re-seats and the machine settles a notch straighter
      s: function (e) { synth(520 * e.pm, 0.08, 'square', 0.03, -120); setTimeout(function () { synth(700 * e.pm, 0.1, 'square', 0.032, 160); noise(0.04, 0.035, 1600, 500); }, 90); },
      a: function (e) { R.polyRing(e.pp.x, e.pp.y - 18, e.col, 4, 18, 2, 0.32, 6, 2.2); R.burst(e.pp.x, e.pp.y - 18, '#d8f6ff', 5); },
    },

    /* ---- Void Adept: THE HUNGER. Breathy, dissonant, wet — nothing here has a
       mechanism. Where the Magos clunks and the Vanguard cracks, the psyker
       exhales. Blood costs get a sound you feel rather than hear. ---- */
    psiLance: {   // a single focused thought, driven through
      s: function (e) { synth(340 * e.pm, 0.22, 'triangle', 0.042, -110, { vib: 16, vibRate: 9, detune: 6, filter: [2600, 700] }); },
      a: function (e) { if (e.tp) { R.beamBolt(e.sx, e.sy - 20, e.tp.x, e.tp.y, PSI_COL, 5); R.polyRing(e.tp.x, e.tp.y, PSI_COL, 3, 24, 3, 0.42, 7, 2); R.burst(e.tp.x, e.tp.y, PSI_COL, 6); } },
    },
    psiScream: {   // a shriek that arrives in every skull at once
      s: function (e) { synth(700 * e.pm, 0.42, 'sawtooth', 0.03, -420, { vib: 26, vibRate: 17, detune: 22, filter: [3800, 600] }); synth(707 * e.pm, 0.4, 'triangle', 0.024, -400, { detune: 30 }); },
      a: function (e) { R.ring(e.pp.x, e.pp.y - 24, PSI_COL, 46, 0.5); e.targets.forEach(function (tg, i) { setTimeout(function () { R.glitch(tg.x, tg.y, PSI_COL); R.polyRing(tg.x, tg.y, PSI_COL, 3, 20, 2, 0.34, 9, 3); }, i * 55); }); },
    },
    emberBloom: {   // fire taking hold, unhurried, certain
      s: function (e) { noise(0.36, 0.04, 2800, 420); setTimeout(function () { synth(190 * e.pm, 0.24, 'triangle', 0.03, 70, { vib: 9, vibRate: 6 }); }, 70); },
      a: function (e) { if (e.tp) { R.embers(e.tp.x, e.tp.y, BURN_COL, 16 + e.power * 5); R.aura(e.tp.x, e.tp.y, BURN_COL); } },
    },
    conflagrate: {   // every fire on the field is fed at once
      s: function (e) { noise(0.62, 0.055, 3200, 350); [0, 1, 2].forEach(function (i) { setTimeout(function () { synth((150 + i * 40) * e.pm, 0.3, 'sawtooth', 0.03, 60, { filter: [1400, 300] }); }, i * 120); }); },
      a: function (e) { e.targets.forEach(function (tg, i) { setTimeout(function () { R.embers(tg.x, tg.y, BURN_COL, 20); R.nova(tg.x, tg.y, BURN_COL, 2); }, i * 100); }); R.aura(e.pp.x, e.pp.y - 16, BURN_COL); },
    },
    bloodPrice: {   // he pays. A wet, low cost — the sound is nearly inside you.
      s: function (e) { synth(74 * e.pm, 0.34, 'sine', 0.07, -26, { detune: 9, filter: [420, 110] }); noise(0.12, 0.026, 700, 160); },
      a: function (e) { R.aura(e.pp.x, e.pp.y - 22, '#ff4a5e'); for (var i = 0; i < 7; i++) R.burst(e.pp.x + (Math.random() - 0.5) * 16, e.pp.y - 14 + Math.random() * 12, '#ff4a5e', 3); },
    },
    sanguineWard: {   // blood set as a barrier, not spent as a weapon
      s: function (e) { synth(110 * e.pm, 0.34, 'triangle', 0.05, 34, { vib: 8, vibRate: 5, detune: 11 }); noise(0.14, 0.022, 900, 300); },
      a: function (e) { R.polyRing(e.pp.x, e.pp.y - 12, '#ff4a5e', 3, 30, 3, 0.4, 4, 1.2); R.aura(e.pp.x, e.pp.y - 12, PSI_COL); },
    },
    witherTouch: {   // something is quietly taken away
      s: function (e) { synth(260 * e.pm, 0.34, 'sine', 0.034, -150, { vib: 13, vibRate: 7, filter: [1400, 300] }); },
      a: function (e) { if (e.tp) { R.spiral(e.tp.x, e.tp.y, PSI_COL, 14, 26); R.glitch(e.tp.x, e.tp.y, PSI_COL); } },
    },
    voidRupture: {   // the floor of the world gives way for a moment
      s: function (e) { synth(52 * e.pm, 0.5, 'sawtooth', 0.06, -18, { detune: 26, filter: [700, 90] }); noise(0.3, 0.03, 400, 2600); },
      a: function (e) { if (e.tp) { R.implode(e.tp.x, e.tp.y, PSI_COL, 76, 76, 26); setTimeout(function () { R.nova(e.tp.x, e.tp.y, PSI_COL, 3); R.quake(e.tp.x, e.tp.y, PSI_COL, 2); }, 210); } },
    },
    mindGrip: {   // held, then closed
      s: function (e) { synth(300 * e.pm, 0.26, 'triangle', 0.032, -170, { vib: 20, vibRate: 12 }); setTimeout(function () { synth(90 * e.pm, 0.16, 'square', 0.055, -34); }, 220); },
      a: function (e) { if (e.tp) { R.implode(e.tp.x, e.tp.y, PSI_COL, 60, 60, 20); setTimeout(function () { R.quake(e.tp.x, e.tp.y, PSI_COL, 2); R.burst(e.tp.x, e.tp.y, PSI_COL, 9); }, 220); } },
    },
    hungerDrain: {   // it comes back to him, and he is the one who wanted it
      s: function (e) { synth(180 * e.pm, 0.3, 'sine', 0.04, 190, { vib: 12, vibRate: 8, filter: [900, 2400] }); },
      a: function (e) { if (e.tp) { R.beamBolt(e.tp.x, e.tp.y, e.pp.x, e.pp.y - 20, '#ff6b8a', 4); R.spiral(e.tp.x, e.tp.y, '#ff6b8a', 12, 22); setTimeout(function () { R.aura(e.pp.x, e.pp.y - 20, PSI_COL); }, 180); } },
    },
    sigilBurn: {   // a POWER: the mark is scorched into the air and stays
      s: function (e) { synth(150 * e.pm, 0.45, 'triangle', 0.038, 90, { vib: 7, vibRate: 4, detune: 14 }); setTimeout(function () { arp(mul([392, 466, 587], e.pm), 70, 0.16, 'triangle', 0.028); }, 120); },
      a: function (e) { R.sigil(e.pp.x, e.pp.y - 26, PSI_COL, 30); setTimeout(function () { R.polyRing(e.pp.x, e.pp.y - 26, PSI_COL, 3, 26, 2, 0.5, 5, 1.1); }, 180); },
    },
    dreadWhisper: {   // barely a sound. It is meant for one listener.
      s: function (e) { noise(0.3, 0.018, 1800, 500); synth(420 * e.pm, 0.32, 'sine', 0.022, -230, { vib: 22, vibRate: 14 }); },
      a: function (e) { if (e.tp) { R.spiral(e.tp.x, e.tp.y, PSI_COL, 10, 20); R.glitch(e.tp.x, e.tp.y, PSI_COL); } R.aura(e.pp.x, e.pp.y - 22, PSI_COL); },
    },
    dimensionRift: {   // a seam opens where there was not one
      s: function (e) { synth(66 * e.pm, 0.55, 'sawtooth', 0.05, 130, { detune: 30, filter: [300, 3000] }); noise(0.4, 0.028, 6000, 400); },
      a: function (e) { R.ring(e.pp.x, e.pp.y - 20, PSI_COL, 38, 0.5); e.targets.forEach(function (tg, i) { setTimeout(function () { R.implode(tg.x, tg.y, PSI_COL, 54, 54, 16); R.shards(tg.x, tg.y, PSI_COL, 8); }, i * 90); }); },
    },
    backdraft: {   // the fire he set is spent all at once
      s: function (e) { noise(0.1, 0.03, 1200, 4000); setTimeout(function () { noise(0.24, 0.07, 3000, 260); synth(96 * e.pm, 0.26, 'square', 0.06, -30, { detune: 12 }); }, 130); },
      a: function (e) { if (e.tp) { R.aura(e.tp.x, e.tp.y, BURN_COL); setTimeout(function () { R.nova(e.tp.x, e.tp.y, BURN_COL, 3 + e.power); R.quake(e.tp.x, e.tp.y, BURN_COL, 3); R.embers(e.tp.x, e.tp.y, BURN_COL, 18); }, 130); } },
    },

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

  /* Enemy act flourishes, keyed to the telegraphed move type. The figure's own
   * motion lives in render (ACT_ENVELOPE); this is the effect that sells what
   * the motion MEANS — a shield snapping up reads differently from a hex. */
  var ENEMY_MOVE_FX = {
    // `attack` deliberately has no entry: the lunge plus the impact fx from the
    // dmg event already carry it, and doubling up reads as noise.
    drain:   function (p, col) { var pp = R.playerXY(); R.beamBolt(p.x, p.y, pp.x, pp.y, '#ff6b8a', 3); R.spiral(p.x, p.y, '#ff6b8a', 10, 20); },
    block:   function (p, col) { R.polyRing(p.x, p.y, '#41d8ff', 6, 30, 6, 0.34, 0, 1.6); R.burst(p.x, p.y, '#41d8ff', 5); },
    guard:   function (p, col) { R.polyRing(p.x, p.y, '#41d8ff', 6, 34, 4, 0.36, 0, 1.8); },
    buff:    function (p, col) { R.aura(p.x, p.y, col); R.polyRing(p.x, p.y, col, 8, 30, 3, 0.42, 4, 1.4); },
    heal:    function (p, col) { R.implode(p.x, p.y, '#5dff88', 54, 54, 14); R.ring(p.x, p.y, '#5dff88', 22, 0.34); },
    debuff:  function (p, col) { var pp = R.playerXY(); R.arc(p.x, p.y, pp.x, pp.y, col, 6, 10); R.glitch(pp.x, pp.y, col); },
    curse:   function (p, col) { var pp = R.playerXY(); R.sigil(p.x, p.y, '#c86bff', 24); R.spiral(pp.x, pp.y, '#c86bff', 10, 22); },
    summon:  function (p, col) { R.ring(p.x, p.y, col, 36, 0.4); R.shards(p.x, p.y, col, 9); R.burst(p.x, p.y, col, 8); },
    disrupt: function (p, col) { R.glitch(p.x, p.y, col); var pp = R.playerXY(); R.glitch(pp.x, pp.y, col); },
    etch:    function (p, col) { var pp = R.playerXY(); R.arc(p.x, p.y, pp.x, pp.y, '#ff4a5e', 7, 12); R.spiral(pp.x, pp.y, '#ff4a5e', 8, 18); },
    unmake:  function (p, col) { R.nova(p.x, p.y, col, 3); R.quake(p.x, p.y, col, 3); R.shake(1); },
  };
  function enemyMoveFx(idx, moveType) {
    R.enemyAct(idx, moveType);
    var fn = ENEMY_MOVE_FX[moveType];
    if (!fn) return;
    var p = R.enemyPos(idx); if (!p) return;
    var en = E.combat && E.combat.enemies[idx];
    var col = (en && en.def && en.def.color) || (en && ns.FACTIONS[en.def.faction] && ns.FACTIONS[en.def.faction].color) || '#ff4a5e';
    if (U.strictFx) { fn(p, col); return; }        // tests: surface the throw
    try { fn(p, col); } catch (err) { /* a cosmetic flourish must never break a turn */ }
  }
  // Same probe hook the card casts use — an enemy flourish that throws or draws
  // nothing is invisible in play, so tests need to drive it directly.
  U.probeEnemyMove = function (idx, moveType) { enemyMoveFx(idx, moveType); };

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
    if (U.strictFx) { m.s(env); m.a(env); return; }        // tests: surface the throw
    try { m.s(env); m.a(env); } catch (err) { /* never let a cosmetic fx break a turn */ }
  }
  // A cast that throws is SILENT in play, by design — which means a broken one
  // can ship unnoticed. This lets a test drive every card's cast with a real
  // combat env and a real target, with the swallow turned off.
  // Plays a card down the REAL path — engine, then the animation timeline — so
  // the chain presentation can be measured as the player sees it rather than
  // by inspecting the event array. (test/chainfeel.js)
  U.probePlay = function (i, targetIdx) { playCardAt(i, targetIdx == null ? 0 : targetIdx); };
  // which face the combat die is currently showing (test/chainfeel.js)
  U.probeDieFace = function () { return combatDie ? combatDie.face() : null; };
  // drive the receipt directly so its height and elision can be measured at any
  // chain length, including ones the engine only reaches rarely (test/uifit.js)
  U.probeChainWipe = function () { chainWipe(); };
  U.probeChainLink = function (i) {
    CHAIN.batch = chainBatch; CHAIN.n = i;
    chainLedger({ name: 'Sympathetic Coil', face: 13 - (i % 5), dealt: 9,
                  why: i === 0 ? '' : 'bleed', bleed: i > 0 },
                i === 0 ? 'root' : 'bleed', i === 0 ? '' : '↳ ');
  };
  U.probeCast = function (cardId) {
    var def = ns.CARDS[cardId]; if (!def || !E.combat) return false;
    var card = { uid: -1, id: cardId, up: false };
    playCardFX(card, def, 0, cardFlavor(def, ns.cardFx(def, false)));
    return true;
  };

  function playCardAt(i, targetIdx) {
    setTargeting(false);
    if (i < 0 || !E.canPlay(i)) { renderHand(); return; }
    var card = E.combat.hand[i], def = ns.CARDS[card.id];
    var castFx = ns.cardFx(def, card.up, card.vtouch);
    var flavor = cardFlavor(def, castFx);
    var srcEl = $hand.children[i];
    var srcRect = srcEl ? srcEl.getBoundingClientRect() : null;
    var clone = srcEl ? srcEl.cloneNode(true) : null;
    chainBatch++; chainWipe();      // playing a card is what clears the last receipt
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
      updateNudge();          // "you missed it by one" lands with the chain
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
    updateNudge();
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
    // A new action, but do NOT clear yet: a receipt is worth reading through
    // the enemy turn. The next chain that actually fires replaces it.
    chainBatch++;
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
        // THE CHAIN NEEDS A TIME AXIS. This fell through to 0, so every link of
        // a trigger chain resolved in one frame and the die's whole payoff was
        // drawn as a single illegible smear.
        // The roll gets a beat to LAND before the card resolves off it. Without
        // this the die is still turning when the first engraving fires, so the
        // chain appears to start before the roll finishes.
        case 'roll': return 300;
        case 'dieFace': return CHAIN.step;
        case 'bossBreak': return 900;
        case 'construct': return 220;     // the turret's shot needs a beat of its own
        case 'enrage': return 900;        // the announcement gets its own beat
        case 'enrageDecay': return 120;
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
        /* HALF HEALTH. The fight changes its mind and has to SAY so, or the
         * player just notices the numbers got worse and does not know why. */
        case 'bossBreak':
          (function (e2, d) {
            setTimeout(function () {
              var v = R.views[e2.idx];
              if (v) floater(v.x, v.y - v.r - 30, e2.line || 'IT BREAKS', 'crit');
              R.shake(1.1); R.flash();
              SFX.lose();
              toast(esc(e2.name.toUpperCase()) + ' — ' + esc(e2.line || 'IT BREAKS'), 2600);
            }, d);
          })(e, delay);
          break;
        // a law biting is small and constant, so it whispers rather than shouts
        case 'bossLaw':
          (function (e2, d) {
            setTimeout(function () {
              var v = R.views[e2.idx];
              if (v) floater(v.x, v.y - v.r - 12, 'THE LAW', 'misfire');
            }, d);
          })(e, delay);
          break;
        // A construct firing has to be visible as the construct firing. The
        // engine used to deal the damage silently, so at end of turn enemies
        // simply lost HP and the thing you spent a card building never moved.
        case 'construct':
          (function (e, d) {
            setTimeout(function () {
              R.constructFire(e.kind, e.idx, CLASS_COL.technomancer);
              SFX.servoFire();
            }, d);
          })(e, delay);
          break;
        // THE COUNT RUNS OUT — a fight that has gone on too long acquires a
        // clock. Announce it loudly the once, then narrate each Shield failure,
        // because losing Shield to an unexplained rule is the worst version of
        // this mechanic.
        case 'enrage':
          (function (d) {
            setTimeout(function () {
              SFX.hit();
              R.flash();
              toast('THE COUNT RUNS OUT — HOSTILES GROW STRONGER EACH TURN', 2600);
            }, d);
          })(delay);
          break;
        case 'enrageDecay':
          // On the turn it starts, the announcement above is the message that
          // matters — don't let the running total overwrite it 900ms later.
          if (!evts.some(function (x) { return x.type === 'enrage'; })) {
            (function (e, d) {
              setTimeout(function () { toast('YOUR SHIELD FAILS  −' + e.lost, 1200); }, d);
            })(e, delay);
          }
          break;
        case 'enemyMove':
          // EVERY move animates now, not just attack/drain. A turn where three
          // enemies buff, shield and hex used to be completely silent.
          if (e.move) {
            (function (e, d) {
              setTimeout(function () { enemyMoveFx(e.idx, e.move.t); }, d);
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
        case 'foresee':
          // the Ballistic Computer has drawn the NEXT number; repaint the chip
          setTimeout(function () { updateHUD(); }, delay);
          break;
        case 'roll':
          /* THE SOLID LANDS HERE, not on `cardPlayed`. `cardPlayed` is processed
           * at delay 0 while the chain links start ~90ms later, so a landing
           * tumble fired from there was interrupted by the first hop before it
           * had turned a quarter of the way — the roll never visibly landed.
           * `roll` is emitted before anything else, so this is the one moment
           * the die has the stage to itself. */
          (function (e2, d) {
            setTimeout(function () { if (combatDie) combatDie.setFace(e2.roll, true, 0.34); }, d);
          })(e, delay);
          // The class table had nothing to say about this card, so no banded
          // settle is coming. Hold the roll in case an engraving fires off it —
          // `roll` is emitted BEFORE `dieFace`, so this cannot settle yet.
          pendingRoll = { v: (e.eff != null ? e.eff : e.roll), crit: !!e.crit, misfire: !!e.misfire, aim: e.aim || 0 };
          break;
        case 'dieFace':
          // the whole point of the die is that you SEE it fire \u2014 one link at a
          // time, up a staircase, up the pitch ladder, with the count climbing
          (function (e, d) {
            setTimeout(function () { chainLink(e, pp); }, d);
          })(e, delay);
          firedFace = { name: e.name, flaw: !!e.flaw };   // named under the die too
          // An unbanded roll that fires an engraving used to be completely
          // invisible: the die never settled, so the trigger had no cause on
          // screen. Settle it here, where we know something happened.
          if (pendingRoll) {
            (function (pr, d) {
              setTimeout(function () { settleDie(pr.v, pr.crit, pr.misfire, pr.aim, '', ''); }, d);
            })(pendingRoll, delay);
            pendingRoll = null;
          }
          break;
        case 'cardPlayed':
          // Settle the dock d20 whenever the face actually MODULATED the card.
          // That is not "attacks only" any more: the Technomancer's table scales
          // Shield, so his defensive turns have to announce themselves too.
          if (e.roll != null && e.band) {
            pendingRoll = null;
            settleDie(e.roll, e.crit, e.misfire, e.aim || 0, e.band, e.tone);
            if (e.crit) floater(pp.x + 60, pp.y - 56, 'CRIT!', 'crit');
            else if (e.band) floater(pp.x + 60, pp.y - (e.misfire ? 56 : 52), e.band,
                                     e.tone === 'up' ? 'solid' : e.misfire ? 'misfire' : 'graze');
            // riders the face charged or paid out, so a bloody roll never lands silently
            if (e.cost) floater(pp.x - 46, pp.y - 30, '−' + e.cost + ' HP', 'misfire');
            if (e.gain) floater(pp.x - 46, pp.y - 30, '+' + e.gain + ' EN', 'solid');
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
    // The chain closes before the action does: the receipt gets its bottom line
    // and the phrase gets its ending note while the last link is still up.
    var lastLink = -1;
    for (var _c = 0; _c < evts.length; _c++) if (evts[_c].type === 'dieFace') lastLink = times[_c];
    if (lastLink >= 0) setTimeout(chainTotal, lastLink + 140);
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
      // A relic only works while it is mounted, and it auto-mounts only if the
      // core has room. With a full core the reward said nothing and the relic
      // went quietly into the vault doing nothing — the single biggest source
      // of the 5.2 dead relics the average run ends holding. Say it here.
      var dieR = E.run.die;
      var freeSlots = dieR ? Math.max(0, (dieR.coreSlots || 3) - dieR.core.length) : 1;
      s.appendChild(el('div', 'screen-sub', 'CHOOSE A RELIC'));
      if (!freeSlots) {
        s.appendChild(el('div', 'reward-warn',
          'THE CORE IS FULL (' + (dieR ? dieR.core.length : 0) + '/' + (dieR ? dieR.coreSlots : 0) +
          ') — a relic you take now sits idle until you swap one out on the die screen.'));
      }
      var acbar = makeConfirmBar();
      rw.artifactChoices.forEach(function (aid, i) {
        var a = ns.ARTIFACTS[aid];
        var apb = el('div', 'panel-btn amber',
          '<div class="pb-title"><span class="pb-icon">' + artSVG(a.art) + '</span>' + esc(a.name) +
          (freeSlots ? '' : ' <span class="pb-warn">IDLE</span>') + '</div><div class="pb-desc">' + esc(a.desc) + '</div>');
        s.appendChild(apb);
        selectConfirm(s, apb, acbar, 'Take <b>' + esc(a.name) + '</b>?<span class="cb-note">' + esc(a.desc) +
          (freeSlots ? '' : ' — the core is full, so this will NOT be active until you mount it.') + '</span>',
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

    // ENGRAVINGS: choose one, then cut it into a face on the die screen.
    if (rw.engChoices && rw.engChoices.length && !rw.engPicked) {
      s.appendChild(el('div', 'screen-sub', 'CHOOSE AN ENGRAVING'));
      var ecbar = makeConfirmBar();
      rw.engChoices.forEach(function (gid) {
        var g = ns.dieEngraving(gid); if (!g) return;
        var gpb = el('div', 'panel-btn',
          '<div class="pb-title"><span class="pb-icon">' + artSVG(g.art) + '</span>' + esc(g.name) + '</div>'
          + '<div class="pb-desc">' + esc(g.desc) + (g.span > 1 ? ' (covers ' + g.span + ' faces)' : '') + '</div>');
        s.appendChild(gpb);
        selectConfirm(s, gpb, ecbar, 'Cut <b>' + esc(g.name) + '</b> into the die?<span class="cb-note">' + esc(g.desc) + '</span>',
          function () { SFX.coin(); E.takeEngraving(gid); showReward(); });
      });
      s.appendChild(ecbar.el);
      var skipE = el('button', 'btn dim small', 'LEAVE THE ENGRAVING');
      skipE.addEventListener('pointerdown', function () { SFX.tap(); rw.engPicked = true; showReward(); });
      s.appendChild(skipE);
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
  U.cardEl = cardEl;   // test/cardfit.js measures real cards in a real grid

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
    /* THE READOUT NAMES WHAT IS BEING READ, not a DC. There is no hidden number
     * to beat any more — the die lands on a face and the face either has your
     * work on it or it does not. */
    var pre = res.dieRead === 'cut'  ? 'YOUR DIE · ' + E.dieOdds('cut').hits + ' OF 20 CUT'
            : res.dieRead === 'seam' ? 'YOUR DIE · THE SEAM · 20 OR 1'
            : res.dieRead === 'face' ? 'YOUR DIE · ' + (res.rolls ? res.rolls.length : 3) + ' ROLLS AT THE TARGET'
            : res.dieRead === 'bet'  ? 'A FLAT TWENTY · NOT YOUR DIE'
            : 'YOUR DIE';
    read.innerHTML = '<span class="d20-dc">' + pre + '</span>';
    var ticks = 0, max = 18, timer = null, settled = false;
    function settle() {
      if (settled) return; settled = true;
      if (timer) clearTimeout(timer);
      numEl.textContent = res.roll;
      svg.classList.remove('rolling');
      svg.classList.add(res.pass ? 'pass' : 'fail');
      var eq, verdict;
      if (res.dieRead === 'face') {
        numEl.textContent = res.total;
        eq = (res.rolls || []).map(function (x) { return x.cut ? x.face : '·' + x.face; }).join('  ');
        verdict = res.total + ' vs ' + res.target;
      } else if (res.dieRead === 'cut') {
        eq = 'FACE ' + res.roll + (res.faceName ? ' · ' + res.faceName.toUpperCase() : '');
        verdict = res.cut ? 'CUT' : 'BLANK';
      } else if (res.dieRead === 'seam') {
        eq = 'FACE ' + res.roll;
        verdict = res.pass ? 'THE SEAM' : 'ELSEWHERE';
      } else {
        eq = 'FACE ' + res.roll;
        verdict = res.pass ? 'PAID' : 'THE HOUSE';
      }
      read.innerHTML = '<span class="d20-eq">' + esc(eq) + '</span>' +
        '<span class="d20-res ' + (res.pass ? 'ok' : 'no') + '">' + esc(verdict) + '</span>';
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
    // Not a transmission — there is nobody to transmit. You walked into it.
    s.appendChild(el('div', 'screen-sub', 'SECTOR ' + E.run.sector + ' · YOU HAVE STOPPED WALKING'));
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
        if (res.op) { showBet(function () { showEventResult(true); }); return; }
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
    // the die verbs — the currency nothing else in the game trades in
    if (fx.reforge) chip('Rewrite a face', true);
    if (fx.bandCollapse) chip('Collapse a band', true);
    if (fx.unlisten) chip('Silence a listener', true);
    if (fx.swapFaces) chip('Swap two faces', true);
    if (fx.swapRandom) chip('Two swap at random', false);
    if (fx.fuseFaces) chip('Fuse two → one', true);
    if (fx.migrateFace) chip('Move an engraving', true);
    if (fx.mirrorFace) chip('Mirror to n+10', true);
    if (fx.stealFace) chip('Take its face', true);
    if (fx.blankPick) chip('−' + fx.blankPick + ' face' + (fx.blankPick > 1 ? 's' : ''), false);
    if (fx.blankBest) chip('−best face', false);
    if (fx.returnUpgraded) chip('back at +' + fx.returnUpgraded + ' tiers', true);
    if (fx.sellFaces) chip('Sell up to ' + fx.sellFaces, true);
    if (fx.sellScarred) chip('Sell a scarred face', true);
    if (fx.giveFace) chip('+' + fx.giveFace + '¢ for a face', true);
    if (fx.teachAway) chip('Teach one away', true);
    if (fx.grantEngraving) chip('Tier ' + fx.grantEngraving + ' cut', true);
    if (fx.coreSlots) chip((fx.coreSlots > 0 ? '+' : '') + fx.coreSlots + ' Core slot', fx.coreSlots > 0);
    if (fx.scarRandom) chip('A face takes ' + (ns.DIE_TAINTS[fx.scarRandom] || {}).name, false);
    if (fx.scarBest || fx.scarMostFired) chip((ns.DIE_TAINTS[fx.scarBest || fx.scarMostFired] || {}).name, false);
    if (fx.scarSpread) chip('Scars spread', false);
    if (fx.tierUpScarred) chip('Scarred faces +1 tier', true);
    if (fx.weldSeam) chip('Weld 20 to 1', true);
    if (fx.seamCopy) chip('Copy across the seam', true);
    if (fx.creditsPerBlank) chip(fx.creditsPerBlank + '¢ per blank', true);
    if (fx.cutPerBlanks) chip('A cut per ' + fx.cutPerBlanks + ' blanks', true);
    if (fx.fireFace) chip('The face fires', true);
    if (fx.hpPct) chip('−' + Math.round(Math.abs(fx.hpPct) * 100) + '% HP', false);
    if (fx.creditsAll) chip('All credits', false);
    if (fx.skipRewards) chip('Skip a reward', false);
    if (fx.doubleNextReward) chip('Next but one doubled', true);
    if (fx.skipEvents) chip('Skip ' + fx.skipEvents + ' events', false);
    if (fx.sectorMaxHpPct) chip(Math.round(fx.sectorMaxHpPct * 100) + '% Max HP / sector', false);
    if (fx.sectorEnergy) chip('+' + fx.sectorEnergy + ' Energy / combat', true);
    if (fx.fightElite) chip('Fight an elite now', false);
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
    if (ch.die) {
      /* THE ODDS ARE PRINTED, AND THEY ARE THE BUILD. The old preview showed a
       * hidden DC against an attribute the player could not move. This shows
       * how many of their own twenty faces are cut, which they can verify by
       * looking at the die. Nothing here is secret. */
      var d = ch.die, od = E.dieOdds(d.read);
      if (d.read === 'cut') {
        pre += '<span class="fx-chip check">◈ ROLL YOUR DIE · ' + od.hits + '/20 CUT · ' + od.pct + '%</span>';
        var wc = fxChips(d.onCut && d.onCut.fx), bc = fxChips(d.onBlank && d.onBlank.fx);
        if (wc) pre += '<span class="pv-row">◆ cut · ' + wc + '</span>';
        if (bc) pre += '<span class="pv-row">◇ blank · ' + bc + '</span>';
      } else if (d.read === 'seam') {
        pre += '<span class="fx-chip check">◈ ROLL YOUR DIE · 20 OR 1 · 10%</span>';
        var ws = fxChips(d.onWin && d.onWin.fx), ls = fxChips(d.onLose && d.onLose.fx);
        if (ws) pre += '<span class="pv-row">✓ ' + ws + '</span>';
        if (ls) pre += '<span class="pv-row">✗ ' + ls + '</span>';
      } else if (d.read === 'face') {
        pre += '<span class="fx-chip check">◈ ' + (d.rolls || 3) + ' ROLLS · YOUR FACES FIRE</span>';
        var wf = fxChips(d.onWin && d.onWin.fx), lf = fxChips(d.onLose && d.onLose.fx);
        if (wf) pre += '<span class="pv-row">✓ ' + wf + '</span>';
        if (lf) pre += '<span class="pv-row">✗ ' + lf + '</span>';
      }
    } else if (ch.op) {
      pre += '<span class="fx-chip check">⚄ ' + (ch.op.k === 'betRegion' ? 'CALL A REGION · 3:1' : 'CALL A FACE · 20:1') + '</span>';
      pre += '<span class="pv-row dim-row">not your die — a flat twenty</span>';
    } else if (ch.outcome) {
      var oc = fxChips(ch.outcome.fx);
      if (oc) pre += '<span class="pv-row">' + oc + '</span>';
    }
    return pre ? '<div class="pv">' + pre + '</div>' : '';
  }

  /* ====================== THE REFORGE PICKER ==========================
   * Three rewrites of one engraving, at the same budget, drawn from the die's
   * own class table. The base is shown above them so the trade is legible —
   * you are always looking at what you are giving up. */
  function showReforge(done) {
    var r = E.run, pr = r.pendingReforge;
    if (!pr) { done(); return; }
    var face = pr.face;
    var opts = E.reforgeOptionsAt(face);
    if (!opts.length) { r.pendingReforge = null; done(); return; }
    var slot = r.die.faces[face];
    var base = slot ? ns.dieEngraving(slot.id) : null;
    var col = CLASS_COL[r.cls] || '#5dff88';
    var table = ns.reforgeTableFor(r.cls);

    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'THE REWRITE'));
    s.appendChild(el('div', 'screen-sub', table.name + ' · FACE ' + face));

    if (base) {
      var was = el('div', 'reforge-base');
      was.innerHTML = '<span class="rb-lbl">WAS</span><span class="rb-name">' + esc(base.name) + '</span>' +
                      '<span class="rb-desc">' + esc(base.desc || '') + '</span>';
      s.appendChild(was);
    }

    opts.forEach(function (o, i) {
      var b = el('div', 'panel-btn reforge-opt');
      b.style.borderColor = col + '55';
      b.innerHTML = '<div class="pb-title" style="color:' + col + '">' + esc(o.name) + '</div>'
        + '<div class="ro-desc">' + esc(o.desc) + '</div>'
        + (o.note ? '<div class="ro-note">' + esc(o.note) + '</div>' : '');
      b.addEventListener('pointerdown', function () {
        SFX.tap();
        var res = E.reforgeApply(face, i);
        if (res) toast(res.name.toUpperCase() + ' — ' + res.desc, 2600);
        done();
      });
      s.appendChild(b);
    });
  }

  /* ====================== THE FACE PICKER =============================
   * Everything that needs the player to point at a face. One screen, because
   * every one of these is the same gesture: here are your twenty, these are
   * the ones this can touch. */
  /* A MOUSE CAN LOOK BEFORE IT COMMITS; A FINGER CANNOT. The face picker
   * shows its readout on hover where hover exists, and makes the first tap a
   * look on the screens where it does not — rather than shipping a two-tap
   * flow to a mouse, which reads as the click not having worked. */
  var hasHover = (function () {
    try { return !!(window.matchMedia && window.matchMedia('(hover: hover)').matches); }
    catch (e) { return false; }
  })();

  var FACE_PROMPT = {
    reforge: 'Which face should she rewrite?', collapse: 'Which band collapses?',
    unlisten: 'Which listener stops waiting?', swap: 'Which two change places?',
    fuse: 'Which two go in the pot?', migrate: 'Move which engraving — then where?',
    mirror: 'Which face crosses to its opposite?', steal: 'Which face does it overwrite?',
    blank: 'Which face do you give up?', sell: 'Which faces go to the floor?',
    sellScar: 'Which scarred face do they take?', give: 'Which face does it buy?',
    teach: 'Which one do you teach away?', grant: 'Where should the cut land?',
  };
  function showFacePick(done) {
    var r = E.run, p = r.pendingFace;
    if (!p) { done(); return; }
    var cands = E.faceCandidates();
    if (!cands.length) { r.pendingFace = null; toast('Nothing on the die can answer that', 2200); done(); return; }
    var col = CLASS_COL[r.cls] || '#5dff88';

    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'THE DIE'));
    s.appendChild(el('div', 'screen-sub',
      esc(FACE_PROMPT[p.mode] || 'Choose a face') + (p.n > 1 ? ' · ' + (p.n - p.picked.length) + ' TO GO' : '')));

    var grid = el('div', 'face-grid');
    /* THE GRID SAID NOTHING. Twenty names, some of them the same name three
     * times because a band covers three faces, and no statement anywhere of
     * what any of them DOES or what it is about to become — on a screen whose
     * whole question is which one to destroy. The readout below the grid
     * follows the pointer on a mouse, and on a touch screen the first tap
     * selects and shows it while the second commits. Nothing is destroyed on
     * one tap, the same rule the engraving screen now follows. */
    var readout = el('div', 'fp-read');
    var sel = null, hov = null;

    function commit(face) {
      SFX.tap();
      var res = E.facePick(face);
      if (!res) return;
      if (res.reforge != null) { showReforge(done); return; }
      if (res.more) { showFacePick(done); return; }
      if (res.text) toast(res.text, 2400);
      done();
    }
    function engBlock(g, cls, extra) {
      if (!g) return '';
      return '<div class="fp-eng ' + cls + '">'
        + '<span class="fp-ic">' + artSVG(g.art, 'df-icon') + '</span>'
        + '<span class="fp-body"><span class="fp-nm">' + esc(g.name) + '</span>'
        + '<span class="fp-ds">' + engTagHTML(g) + esc(g.desc || '') + '</span>'
        + (extra || '') + '</span></div>';
    }
    function paint() {
      var face = hov != null ? hov : sel;
      if (face == null) {
        readout.innerHTML = '<div class="fp-hint">'
          + (hasHover ? 'POINT AT A FACE TO SEE WHAT IT DOES AND WHAT IT BECOMES.'
                      : 'TAP A FACE TO SEE WHAT IT DOES — TAP IT AGAIN TO COMMIT.') + '</div>';
      } else {
        var o = E.faceOutcome(face);
        if (!o) { readout.innerHTML = '<div class="fp-hint">ALREADY CHOSEN.</div>'; }
        else {
          var tt = o.taint ? ns.DIE_TAINTS[o.taint] : null;
          var h = '<div class="fp-head">FACE ' + face + (o.pending ? ' · ' + o.pending + ' MORE TO PICK' : '') + '</div>';
          h += o.from ? engBlock(o.from, 'from',
                 tt ? '<span class="fp-taint">✖ ' + esc(tt.name) + ' — ' + esc(tt.desc || '') + '</span>' : '')
             : '<div class="fp-eng from"><span class="fp-body"><span class="fp-nm bare">bare</span>'
               + '<span class="fp-ds">Nothing is engraved here.</span></span></div>';
          if (o.to) h += '<div class="fp-arrow">BECOMES</div>' + engBlock(o.to, 'to');
          if (o.line) h += '<div class="fp-line">' + esc(o.line) + '</div>';
          readout.innerHTML = h;
        }
      }
      grid.querySelectorAll('.fc').forEach(function (c) {
        c.classList.toggle('armed', sel != null && +c.dataset.face === sel);
      });
      go.style.display = sel == null ? 'none' : '';
      go.textContent = sel == null ? '' : 'CONFIRM FACE ' + sel;
    }

    for (var f = 1; f <= ns.dieSides(r.die); f++) {
      (function (face) {
        var slot = r.die.faces[face];
        var def = slot ? ns.dieEngraving(r.die.faces[slot.root].id) : null;
        var can = cands.indexOf(face) >= 0;
        var chosen = p.picked.indexOf(face) >= 0;
        var taint = slot ? ns.dieTaintAt(r.die, face) : null;
        var cell = el('div', 'fc' + (can ? ' can' : '') + (chosen ? ' chosen' : '') + (def ? ' cut' : ' blank') + (taint ? ' scarred' : ''));
        cell.dataset.face = face;
        cell.innerHTML = '<span class="fc-n">' + face + '</span>'
          + '<span class="fc-name">' + esc(def ? def.name : '—') + '</span>'
          + (taint ? '<span class="fc-scar">' + esc((ns.DIE_TAINTS[taint] || {}).name || '') + '</span>' : '');
        if (can) {
          cell.style.borderColor = col + '77';
          cell.addEventListener('pointerenter', function () { hov = face; paint(); });
          cell.addEventListener('pointerleave', function () { if (hov === face) { hov = null; paint(); } });
          cell.addEventListener('pointerdown', function () {
            // a mouse has already shown you the readout, so it commits on the
            // click you meant; a finger has not, so the first tap is the look
            if (hasHover || sel === face) { commit(face); return; }
            SFX.tap(); sel = face; paint();
          });
        }
        grid.appendChild(cell);
      })(f);
    }
    s.appendChild(grid);
    s.appendChild(readout);
    var go = el('button', 'btn fp-go', '');
    go.addEventListener('pointerdown', function (ev) {
      ev.stopPropagation();
      if (sel != null) commit(sel);
    });
    s.appendChild(go);
    paint();
  }

  /* THE LONG ODDS. Deliberately not your die — a flat twenty, no build in it. */
  // reachable from the fit tests, which have no event to route through
  U._facePick = showFacePick;

  function showBet(done) {
    var r = E.run, op = r.pendingOp;
    if (!op) { done(); return; }
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'THE LONG ODDS'));
    s.appendChild(el('div', 'screen-sub', 'STAKE ¢' + op.stake + ' · PAYS ' + op.pay + ':1 · NOT YOUR DIE'));

    var opts = op.k === 'betRegion'
      ? [{ v: 'low', t: 'LOW · 2–7', o: '6 in 20' }, { v: 'mid', t: 'MID · 8–14', o: '7 in 20' }, { v: 'high', t: 'HIGH · 15–20', o: '6 in 20' }]
      : null;
    if (opts) {
      opts.forEach(function (o) {
        var b = el('div', 'panel-btn', '<div class="pb-title">' + o.t + '</div><div class="pb-sub">' + o.o + '</div>');
        b.addEventListener('pointerdown', function () { SFX.tap(); E.betResolve(o.v); done(); });
        s.appendChild(b);
      });
    } else {
      var grid = el('div', 'face-grid bet-grid');
      for (var f = 1; f <= ns.dieSides(r.die); f++) {
        (function (face) {
          var cell = el('div', 'fc can');
          cell.innerHTML = '<span class="fc-n">' + face + '</span>';
          cell.addEventListener('pointerdown', function () { SFX.tap(); E.betResolve(face); done(); });
          grid.appendChild(cell);
        })(f);
      }
      s.appendChild(grid);
    }
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
      /* The die verbs come first: a face pick can cascade into a reforge pick,
       * and both have to land before the node is allowed to close. */
      if (r.pendingFace) {
        showFacePick(function () { showEventResult(false); });
      } else if (r.pendingReforge) {
        showReforge(function () { showEventResult(false); });
      } else if (r.pendingOp) {
        showBet(function () { showEventResult(true); });
      } else if (r.pendingRelic) {
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
    var grid = el('div', 'card-grid dense');
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

    // The bench: engravings, the grinder and the jig, all on the die screen so
    // you can see the faces you are buying into.
    var stock = (sh.engravings || []).filter(function (it) { return !it.sold; });
    var dieFlaws = Object.keys((r.die && r.die.faces) || {}).filter(function (f) {
      var e2 = ns.dieEngraving(r.die.faces[f].id); return e2 && e2.flaw && r.die.faces[f].root === +f;
    }).length;
    var svc = [];
    if (stock.length) svc.push(stock.length + ' ENGRAVING' + (stock.length > 1 ? 'S' : '') + ' IN THE CASE');
    if (dieFlaws && !sh.grindUsed) svc.push('GRIND OUT A FLAW · ¢' + E.grindCost());
    if (!E.jigSpent()) svc.push(E.reseatCost() ? 'RESEAT ONE · ¢' + E.reseatCost() : 'RESEAT FREELY · FACE LATHE');
    var bb = el('div', 'panel-btn green', '<div class="pb-title"><span class="pb-icon">' + dieChipSVG() + '</span>THE BENCH</div>'
      + '<div class="pb-desc">' + esc(svc.join(' · ') || 'Nothing on offer for the die.') + '</div>');
    bb.addEventListener('pointerdown', function (ev) {
      ev.stopPropagation(); SFX.tap();
      showDieScreen({ bench: true, back: function () { showShop(); } });
    });
    s.appendChild(bb);

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
  function showAddCard(done) {
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Requisition'));
    s.appendChild(el('div', 'screen-sub', 'TAP A CARD TO PREVIEW · CONFIRM TO ADD'));
    var grid = el('div', 'card-grid');
    var cbar = makeConfirmBar();
    E.addCardOptions().forEach(function (cid) {
      var d = cardEl(cid, false);
      grid.appendChild(d);
      selectConfirm(grid, d, cbar, 'Add <b>' + esc(ns.CARDS[cid].name) + '</b> to your deck?',
        function () { E.addChosenCard(cid); done(); }, 'cyan');
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
    var grid = el('div', 'card-grid dense');
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

  /* ====================== THE FIRST MARK ======================
   * Turn zero. Three class-specific offers, each an engraving paired with the
   * card that archetype needs to start. Both halves are shown at full size —
   * the engraving with its art and rule, the card as a real card — because
   * this is the run's opening decision and it should be readable, not a list
   * of names. The face is NOT chosen here: the engraving lands pending and the
   * die screen asks where, so the choice stays open while you learn the table.
   * ==================================================================== */
  function showFirstMark() {
    combatChrome(false);
    $hud.innerHTML = ''; setHud(false);
    var r = E.run, offers = E.firstMarkOffers();
    if (!offers.length) { E.run.phase = 'map'; return U.refresh(); }

    var s = overlayScreen();
    s.classList.add('firstmark-screen');
    s.appendChild(el('h2', 'screen-title', 'The First Mark'));
    s.appendChild(el('div', 'screen-sub', 'THE DIE CAME TO YOU BLANK · CUT ONE ANSWER INTO IT'));

    var cbar = makeConfirmBar();
    offers.forEach(function (m, i) {
      var eng = ns.dieEngraving(m.eng);
      var card = ns.CARDS[m.card];
      var row = el('div', 'panel-btn mark-row');
      row.innerHTML =
        '<div class="pb-title">' + esc(m.name) + '</div>' +
        '<div class="mark-line">' + esc(m.line) + '</div>' +
        '<div class="mark-body">' +
          '<div class="mark-eng">' +
            '<div class="me-head"><span class="pb-icon">' + artSVG(eng.art) + '</span>' + esc(eng.name) + '</div>' +
            '<div class="me-desc">' + esc(eng.desc) + '</div>' +
            '<div class="me-want">' + esc(m.want) + '</div>' +
          '</div>' +
        '</div>';
      // the card, rendered as the card it is
      // reading size, not the dense whole-deck size — this is one card you are
      // choosing a run around, and its rarity tag has to stay legible
      var grid = el('div', 'card-grid mark-card');
      grid.appendChild(cardEl(m.card, false, false));
      row.querySelector('.mark-body').appendChild(grid);
      s.appendChild(row);
      fitCards(grid);
      selectConfirm(s, row, cbar,
        'Cut <b>' + esc(eng.name) + '</b> and take <b>' + esc(card.name) + '</b>?' +
        '<span class="cb-note">You choose the face on the die screen.</span>',
        function () { SFX.coin(); E.takeFirstMark(i); U.refresh(); }, 'cyan');
    });
    s.appendChild(cbar.el);
  }

  var TRIBUTE_TEASE = {
    tribute_ironclad: 'Something vast and armoured waits beyond the Heart.',
    tribute_silent: 'A green blade glints in the dark beyond the Heart.',
    tribute_defect: 'Cold machine-light hums beyond the Heart.',
    tribute_watcher: 'A serene, terrible presence waits beyond the Heart.',
  };
  /* ====================== CUTSCENE ======================
   * A sector boss ends with a wide vector panel and a line of narration.
   * The art is the same language as everything else — polylines, stroked and
   * glowing — but composed in depth layers that drift at different rates, so a
   * still image reads as a slow camera move rather than a picture.
   * ==================================================================== */
  function sceneSVG(scene, color) {
    // scene space: x -1..1, y -0.6..0.6  ->  viewBox 0 0 200 120
    function pts(arr) {
      var o = [];
      for (var i = 0; i < arr.length; i += 2) {
        o.push(((arr[i] + 1) * 100).toFixed(1) + ',' + ((arr[i + 1] + 0.6) * 100).toFixed(1));
      }
      return o.join(' ');
    }
    var out = '<svg class="vec cut-svg" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet"' +
      (color ? ' style="color:' + color + '"' : '') + '>';
    scene.layers.forEach(function (L, li) {
      // depth drives both the parallax amplitude and how solid the layer reads
      var d = L.d == null ? 0.5 : L.d;
      out += '<g class="cut-layer" style="--d:' + d.toFixed(2) + ';--i:' + li + ';opacity:' + (0.4 + d * 0.6).toFixed(2) + '">';
      (L.p || []).forEach(function (p) { out += '<polyline points="' + pts(p) + '"/>'; });
      // `s` are sparks, not eyes — distant lights on the rings, a core still lit.
      // They pulse; they do not blink, because nothing down here is looking.
      (L.s || []).forEach(function (e, ei) {
        out += '<circle class="cut-spark" style="--k:' + ei + '" cx="' + ((e[0] + 1) * 100).toFixed(1) +
               '" cy="' + ((e[1] + 0.6) * 100).toFixed(1) + '" r="1.3"/>';
      });
      out += '</g>';
    });
    return out + '</svg>';
  }

  U.sceneSVG = sceneSVG;   // test/cutshot.js renders a contact sheet of every panel

  function showCutscene() {
    combatChrome(false);
    $hud.innerHTML = ''; setHud(false);
    var r = E.run, cs = ns.cutsceneFor(r.sector);
    if (!cs || !r.cutscene) { E.cutsceneSkip(); return U.refresh(); }
    var idx = Math.min(r.cutscene.panel || 0, cs.panels.length - 1);
    var panel = cs.panels[idx];

    var s = overlayScreen();
    s.classList.add('cutscene-screen');
    var head = el('div', 'cut-title', cs.title);
    head.style.color = cs.color;
    s.appendChild(head);

    var frame = el('div', 'cut-frame');
    frame.innerHTML = sceneSVG(ns.SCENES[panel.scene], cs.color);
    s.appendChild(frame);

    var dots = el('div', 'cut-dots');
    cs.panels.forEach(function (_, i) { dots.appendChild(el('span', i === idx ? 'on' : '')); });
    s.appendChild(dots);

    var p = el('div', 'event-text cut-text', '');
    s.appendChild(p);
    var finish = typeText(p, panel.text, null);

    var last = idx === cs.panels.length - 1;
    var btn = el('button', 'btn', last ? 'GO ON DOWN' : 'CONTINUE');
    function advance() {
      if (typing()) { finish(); return; }
      SFX.tap();
      E.cutsceneNext();
      U.refresh();
    }
    btn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); advance(); });
    s.appendChild(btn);
    // tap anywhere to hurry the line, then to move on
    s.addEventListener('pointerdown', function (ev) {
      if (typing()) { finish(); ev.stopPropagation(); }
    }, true);
  }

  /* ==================================================================
   * THE INSTABILITY
   * ==================================================================
   * Three steps on one screen, because they are one decision: choose what
   * burns, see what the bid earned, choose where the permanent welds in.
   *
   * The count and the TIER are live on the header while you are choosing, so
   * the bid is legible before you commit rather than after. That is the whole
   * reason this is a bid and not a tax — if you cannot see what one more
   * engraving buys you, there is nothing to decide.
   * ================================================================== */
  function showInstability() {
    combatChrome(false);
    $hud.innerHTML = ''; setHud(false);
    var r = E.run;
    var s = overlayScreen();
    s.classList.add('unstable-screen');
    s.appendChild(el('h2', 'screen-title', 'The Die Destabilises'));
    var sub = el('div', 'screen-sub', '');
    s.appendChild(sub);
    var body = el('div', 'un-body');
    s.appendChild(body);
    var acts = el('div', 'un-acts');
    s.appendChild(acts);

    function tierName(t) { return t === 3 ? 'TIER III' : t === 2 ? 'TIER II' : 'TIER I'; }

    function draw() {
      var st = E.instabilityState();
      if (!st) { U.refresh(); return; }
      body.innerHTML = ''; acts.innerHTML = '';

      if (st.stage === 'cull') {
        sub.textContent = 'IT CANNOT HOLD WHAT YOU CUT INTO IT · GIVE BACK ' + st.required + ' OF ' + st.roots.length;
        var over = st.chosen.length - st.required;
        body.appendChild(el('div', 'un-bid',
          '<span class="un-count' + (st.ready ? ' ok' : '') + '">' + st.chosen.length + ' / ' + st.required + '</span>'
          + '<span class="un-tier t' + st.tier + '">' + tierName(st.tier) + ' PERMANENT</span>'
          + '<span class="un-hint">' + (over >= 4 ? 'the fire is fed'
              : 'feed it ' + (2 - (Math.max(0, over) % 2)) + ' more for the next tier') + '</span>'));

        var grid = el('div', 'face-grid');
        for (var f = 1; f <= ns.dieSides(r.die); f++) {
          (function (face) {
            var slot = r.die.faces[face];
            var isRoot = slot && slot.root === face;
            var g = slot ? ns.dieEngraving(r.die.faces[slot.root].id) : null;
            var perm = !!(slot && slot.perm);
            var can = isRoot && !perm;
            var taint = ns.dieTaintAt(r.die, face);
            var cell = el('div', 'fc' + (can ? ' can' : '')
              + (st.chosen.indexOf(face) >= 0 ? ' burning' : '')
              + (perm ? ' permanent' : '')
              + (!slot ? ' blank' : '')
              + ((g && g.flaw) || taint ? ' scarred' : ''),
              '<span class="fc-n">' + face + '</span>'
              + '<span class="fc-name">' + esc(g ? g.name : '—') + '</span>'
              + (perm ? '<span class="fc-scar" style="color:#ffb02e">WELDED</span>' : '')
              + (g && g.flaw ? '<span class="fc-scar">FLAW</span>' : ''));
            if (can) cell.addEventListener('pointerdown', function (ev) {
              ev.stopPropagation(); SFX.tap(); E.instabilityToggle(face); draw();
            });
            grid.appendChild(cell);
          })(f);
        }
        body.appendChild(grid);

        var go = el('button', 'btn' + (st.ready ? '' : ' dim'), 'BURN ' + st.chosen.length + ' · TAKE A ' + tierName(st.tier));
        go.addEventListener('pointerdown', function (ev) {
          ev.stopPropagation();
          var why = E.instabilityCommit();
          if (why) { toast(why.toUpperCase(), 2000); return; }
          SFX.win(); draw();
        });
        acts.appendChild(go);
        return;
      }

      if (st.stage === 'pick') {
        sub.textContent = 'IT FUSES ONE OF THESE INTO THE DIE · IT CAN NEVER BE CHANGED';
        var offers = el('div', 'un-offers');
        (st.offer || []).forEach(function (id) {
          var g = ns.DIE_AUGMENTS[id];
          var card = el('div', 'un-offer t' + (g.tier || 1),
            '<div class="uo-name">' + esc(g.name) + '</div>'
            + '<div class="uo-desc">' + esc(g.desc) + '</div>');
          card.addEventListener('pointerdown', function (ev) {
            ev.stopPropagation(); SFX.tap(); E.instabilityPick(id); draw();
          });
          offers.appendChild(card);
        });
        body.appendChild(offers);
        return;
      }

      // place
      var pg = ns.DIE_AUGMENTS[st.picked];
      sub.textContent = 'WHERE DOES ' + (pg.name || '').toUpperCase() + ' WELD IN?';
      var grid2 = el('div', 'face-grid');
      for (var f2 = 1; f2 <= ns.dieSides(r.die); f2++) {
        (function (face) {
          var legal = !ns.dieCanEngrave(r.die, st.picked, face);
          var slot = r.die.faces[face];
          var g2 = slot ? ns.dieEngraving(r.die.faces[slot.root].id) : null;
          var cell = el('div', 'fc' + (legal ? ' can' : '') + (!slot ? ' blank' : '')
            + (slot && slot.perm ? ' permanent' : ''),
            '<span class="fc-n">' + face + '</span>'
            + '<span class="fc-name">' + esc(g2 ? g2.name : '—') + '</span>');
          if (legal) cell.addEventListener('pointerdown', function (ev) {
            ev.stopPropagation();
            var why = E.instabilityPlace(face);
            if (why) { toast(why.toUpperCase(), 2000); return; }
            SFX.win(); U.refresh();
          });
          grid2.appendChild(cell);
        })(f2);
      }
      body.appendChild(grid2);
      var back = el('button', 'btn dim small', 'CHOOSE A DIFFERENT ONE');
      back.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation(); SFX.tap(); E.instabilityUnpick(); draw();
      });
      acts.appendChild(back);
    }
    draw();
  }

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
    var lore = ns.sectorLore ? ns.sectorLore(r.sector) : null;
    var s = overlayScreen();
    s.appendChild(el('div', 'sector-banner', 'SECTOR ' + r.sector + (lore ? ' · ' + lore.name : '')));
    var ft = el('div', 'faction-tag', esc(fac.name.toUpperCase()));
    ft.style.color = fac.color;
    s.appendChild(ft);
    // What the sector is, and who else is down here — both stated the way the
    // rest of the game states things, which is to say not quite.
    if (lore) s.appendChild(el('div', 'sector-line', lore.line));
    var fl = ns.FACTION_LORE && ns.FACTION_LORE[r.faction];
    if (fl) s.appendChild(el('div', 'sector-line faction-line', fl));
    var btn = el('button', 'btn', 'DESCEND');
    btn.addEventListener('pointerdown', function () { SFX.play(); E.beginSector(); U.refresh(); });
    s.appendChild(btn);
  }

  /* ====================== VICTORY (finale) ======================
   * The run ENDS here. It used to offer the Recurrence — begin again, one loop
   * deeper, everything 12% stronger — which was a second difficulty ladder
   * running beside the Pressure one. There is a single ladder now: beat the
   * Unmaker, the rating clears, the next unlocks, and you start again from
   * nothing, the way an ascension works.
   *
   * The only thing on offer is the Heart, and only at the higher ratings: one
   * more fight against a boss picked to answer your own build. Optional, and
   * declining costs you nothing — the rating has already cleared. */
  function showVictory() {
    combatChrome(false);
    updateHUD();
    var r = E.run;
    SFX.win();
    R.flash();
    var heartWin = E.inHeart && E.inHeart();
    var s = overlayScreen();
    if (heartWin) {
      s.appendChild(el('div', 'sector-banner victory-banner', 'THE TRIBUTE IS UNMADE'));
      s.appendChild(el('div', 'screen-sub', 'YOU ANSWERED THE THING THAT WAS BUILT TO ANSWER YOU'));
      s.appendChild(el('div', 'event-text', 'It dissolves into stardust, wearing your own habits like a borrowed coat. Whatever was keeping score down here has stopped.'));
    } else {
      s.appendChild(el('div', 'sector-banner victory-banner', 'THE UNMAKER FALLS'));
      s.appendChild(el('div', 'screen-sub', 'THE DESCENT IS CONQUERED · ' + E.pressureName(r.pressure || 0)));
    }
    s.appendChild(el('div', 'big-score', E.score() + ' PTS'));

    var cleared = r.pressure || 0;
    var next = E.pressureUnlocked(r.cls);
    var lines = [
      'RATING CLEARED: ' + E.pressureName(cleared) + ' (' + cleared + ')',
      'NODES CLEARED: ' + r.nodesCleared,
      'KILLS: ' + r.kills,
    ];
    if (next > cleared && next <= E.pressureMax()) lines.push('UNLOCKED: ' + E.pressureName(next) + ' (' + next + ') for this class');
    var gl = el('div', 'gain-list');
    lines.forEach(function (l) { gl.appendChild(el('div', '', esc(l))); });
    s.appendChild(gl);

    if (E.heartOpen && E.heartOpen()) {
      var deeper = el('div', 'panel-btn magenta',
        '<div class="pb-title">◈ GO DEEPER</div>' +
        '<div class="pb-desc">Something down here has been reading you the whole way. One more fight, full-healed, with the deck and the die you finished on. Your rating has already cleared — this is for you.</div>');
      deeper.addEventListener('pointerdown', function () {
        SFX.play();
        E.enterHeart();
        U.refresh();
      });
      s.appendChild(deeper);
    }

    var claim = el('div', 'panel-btn',
      '<div class="pb-title">★ CLAIM VICTORY</div>' +
      '<div class="pb-desc">End the run a victor. Your score is recorded and the next rating stands open.</div>');
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

  /* The Recurrence screens are gone with the Recurrence: the loop narrative,
   * the Echo draft (pick 1 of 3) and the loadout board (equip 3 of what you
   * own). The eleven Echoes they served are relics now, drafted from bosses in
   * a normal run, so nothing they offered is out of reach. */

  /* ====================== GAME OVER ====================== */
  function showGameOver() {
    combatChrome(false);
    setHud(false);
    var r = E.run;
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'Signal Lost'));
    s.appendChild(el('div', 'screen-sub', 'YOUR DESCENT ENDS IN SECTOR ' + r.sector + ' · ' + E.pressureName(r.pressure || 0)));
    s.appendChild(el('div', 'big-score', E.score() + ' PTS'));
    var best = E.getBest();
    var lines = [
      'SECTOR REACHED: ' + r.sector,
      'RATING: ' + E.pressureName(r.pressure || 0) + ' (' + (r.pressure || 0) + ')',
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

  /* ---- COMBAT LOG (testing aid) --------------------------------------
   * The engine records every event it emits; this turns that into something
   * readable. It is deliberately verbose about the things that are hard to
   * reason about from watching the screen — which face fired and whether it
   * was the roll, a bleed, or a listener; what the band multiplier did; what a
   * taint took off the top.
   * ------------------------------------------------------------------- */
  function enemyName(idx) {
    var c = E.combat;
    var e = c && c.enemies && c.enemies[idx];
    return e ? (ns.ENEMIES[e.id] || {}).name || e.id : 'enemy ' + idx;
  }
  function logLine(r) {
    var who = function (w, idx) { return w === 'player' ? 'YOU' : enemyName(idx); };
    switch (r.t) {
      case 'turnStart': return { cls: 'lg-turn', s: '── TURN ' + r.turn + ' ──' };
      case 'foresee': return { cls: 'lg-roll', s: 'NEXT ROLL WILL BE ' + r.roll };
      case 'dieGrew':  return { cls: 'lg-roll', s: 'THE DIE IS GROUND OUT TO ' + r.sides + ' FACES' };
      case 'roll': {
        var bits = 'ROLL ' + r.roll;
        if (r.eff !== r.roll) bits += ' (+' + (r.eff - r.roll) + ' aim → ' + r.eff + ')';
        if (r.band) bits += '  ' + r.band;
        if (r.crit) bits += '  ✦CRIT';
        if (r.misfire) bits += '  ✖MISFIRE';
        if (r.cost) bits += '  −' + r.cost + ' HP';
        if (r.gain) bits += '  +' + r.gain + ' NRG';
        return { cls: 'lg-roll', s: bits };
      }
      case 'dieFace': {
        var how = r.listen ? 'LISTENER(' + r.listen + ')' : r.why === 'bleed' ? 'BLEED' : r.why === 'opposite' ? 'OPPOSITE' : 'FACE';
        var t = r.taint ? '  ⟨' + r.taint + '⟩' : '';
        return { cls: r.listen ? 'lg-listen' : r.why ? 'lg-bleed' : 'lg-face',
                 s: '  ' + how + ' ' + r.face + ' ▸ ' + r.name + t };
      }
      case 'dmg': {
        if (r.warded) return { cls: 'lg-dim', s: '  ' + r.amount + ' → ' + who(r.who, r.idx) + ' WARDED' };
        var hp = (r.hpAfter != null) ? '  hp ' + r.hpAfter : '';
        var blk = r.blockAfter ? '  blk ' + r.blockAfter : '';
        return { cls: r.who === 'player' ? 'lg-hurt' : 'lg-dmg',
                 s: '  ' + r.amount + ' dmg → ' + who(r.who, r.idx) + hp + blk };
      }
      case 'block': return { cls: 'lg-blk', s: '  +shield → ' + (r.blockAfter != null ? r.blockAfter : r.amount) };
      case 'heal': return { cls: 'lg-heal', s: '  +' + r.amount + ' HP' };
      case 'status': return { cls: 'lg-st', s: '  ' + (ns.STATUS_NAMES && ns.STATUS_NAMES[r.s] ? ns.STATUS_NAMES[r.s] : r.s) + ' ' + (r.v > 0 ? '+' : '') + r.v + ' → ' + who(r.who, r.idx) };
      case 'enemyMove': {
        // `move` is the intent OBJECT, not a label — describe it from its shape
        var m = r.move || {}, d = m.t || 'acts';
        if (m.t === 'attack') d = 'attack ' + (m.d || 0) + (m.hits > 1 ? ' ×' + m.hits : '');
        else if (m.t === 'block') d = 'block ' + (m.b || 0);
        else if (m.t === 'buff' || m.t === 'debuff') d = m.t + ' ' + (m.s || '') + ' ' + (m.v || '');
        else if (m.t === 'summon') d = 'summon ' + (m.id || '') + (m.n > 1 ? ' ×' + m.n : '');
        return { cls: 'lg-move', s: '  ' + enemyName(r.idx) + ': ' + d };
      }
      case 'etch': return { cls: 'lg-scar', s: r.warded ? '  ✦ scar turned aside' : '  ✖ SCAR ' + (r.name || r.taint) + ' on face ' + r.face };
      case 'relic': return { cls: 'lg-relic', s: '  relic ' + r.id + (r.v != null ? ' (' + r.v + ')' : '') };
      case 'die': return { cls: 'lg-kill', s: '  ☠ ' + enemyName(r.idx) + ' down' };
      case 'win': return { cls: 'lg-turn', s: '── CLEARED (' + r.kind + ') ──' };
      case 'lose': return { cls: 'lg-hurt', s: '── YOU DIED ──' };
      case 'curse': return { cls: 'lg-scar', s: '  curse: ' + r.card };
      default: return null;
    }
  }
  function showLog() {
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'COMBAT LOG'));
    s.appendChild(el('div', 'screen-sub', E.logging ? 'RECORDING' : 'NOT RECORDING — TURN IT ON IN THE MENU'));
    var box = el('div', 'log-box');
    var lines = (E.combatLog || []).map(logLine).filter(Boolean);
    if (!lines.length) box.innerHTML = '<div class="lg-dim">nothing recorded yet — turn logging on, then fight.</div>';
    else box.innerHTML = lines.map(function (l) { return '<div class="' + l.cls + '">' + esc(l.s) + '</div>'; }).join('');
    s.appendChild(box);
    var copy = el('div', 'panel-btn cyan', '<div class="pb-title">⧉ COPY AS TEXT</div><div class="pb-desc">Paste it into a bug report.</div>');
    copy.addEventListener('pointerdown', function () {
      var txt = lines.map(function (l) { return l.s; }).join('\n');
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('LOG COPIED'); }, function () { toast('COPY BLOCKED'); });
      else toast('CLIPBOARD UNAVAILABLE');
    });
    s.appendChild(copy);
    var back = el('div', 'panel-btn', '<div class="pb-title">◀ BACK</div>');
    back.addEventListener('pointerdown', function () { SFX.tap(); showMenu(); });
    s.appendChild(back);
  }
  U.showLog = showLog;

  function showMenu() {
    var r = E.run;
    var wasCombat = r && r.phase === 'combat';
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', 'VOIDSPIRE'));
    s.appendChild(el('div', 'screen-sub', 'SYSTEM MENU'));

    var resume = el('div', 'panel-btn', '<div class="pb-title">▶ RESUME</div>');
    resume.addEventListener('pointerdown', function () { SFX.tap(); if (wasCombat) showCombat(); else U.refresh(); });
    s.appendChild(resume);

    var logT = el('div', 'panel-btn cyan', '<div class="pb-title">' + (E.logging ? '◆ COMBAT LOG: ON' : '◇ COMBAT LOG: OFF') +
      '</div><div class="pb-desc">Records every roll, face, bleed, listener and hit.</div>');
    logT.addEventListener('pointerdown', function () { SFX.tap(); E.logging = !E.logging; if (E.logging) E.clearLog(); showMenu(); });
    s.appendChild(logT);
    var logV = el('div', 'panel-btn', '<div class="pb-title">▤ VIEW LOG</div><div class="pb-desc">' +
      ((E.combatLog || []).length) + ' events recorded.</div>');
    logV.addEventListener('pointerdown', function () { SFX.tap(); showLog(); });
    s.appendChild(logV);

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
        E2('The count runs out', 'Nothing down here waits forever. After turn ' + (B.enrage ? B.enrage.turn : 20) +
          ' every enemy gains Might each turn and your Shield begins to fail. Fights almost never reach it — but a turtle that has lost its offence will not be allowed to stand there.', 'bad'),
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
        E2('Curse', 'A card clogging your hand — most are unplayable; a Void Swarm you can pay to swat. Enemy curses last the combat; event curses are permanent until purged.', 'bad'),
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
        E2('Relics', 'Permanent passives. Elites, events and shops offer them; a boss lets you pick one of three. They only apply while MOUNTED in your die\u2019s core.'),
        E2('Earned relics', 'A few relics cannot be found at all. Each states a deed \u2014 kill 8 enemies, hold 35 Shield at once \u2014 and is granted the moment you do it.'),
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
      { cat: 'Void Pressure', intro: 'The one difficulty ladder. Clear a rating and the next opens — for that class.', entries: [
        E2('Victory', 'Beat the Unmaker and the run ends a win. The rating you descended at is cleared and the next unlocks.', 'sp'),
        E2('Climbing', 'Every rating is carried on top of the ones below it, and most are a designed hazard rather than a bigger number — packs of elites, a hotter die, one less core slot, thinner salvage.'),
        E2('Per class', 'Each class climbs its own ladder. Clearing DRIFT on one does not hand the rating to another that has never finished a run.', 'sp'),
        E2('The Heart', 'From ' + E.pressureName(B.run.heartFrom).toUpperCase() + ' upward, felling the Unmaker opens one more door: a boss built to answer your own build. Optional — your rating has already cleared.', 'sp'),
        E2('Pacts', 'Eleven double-edged relics, one offered at every sector boss beside two ordinary ones. Each is a bargain, never a straight upgrade.'),
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
