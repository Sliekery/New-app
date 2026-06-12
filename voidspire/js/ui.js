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
  };

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
    U.refresh();
  };

  /* ====================== phase router ====================== */
  U.refresh = function () {
    var r = E.run;
    selected = -1;
    setTargeting(false);
    if (!r) return showTitle();
    switch (r.phase) {
      case 'combat': return showCombat();
      case 'node-select': return showNodeSelect();
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
      '<span class="attr" style="color:' + fac.color + '">S' + r.sector + ':' + (r.nodeIdx + 1) + '/' + B.sector.script.length + '</span>' +
      '<span class="spacer"></span>' +
      '<button class="icon-btn" data-act="deck">DECK ' + r.deck.length + '</button>' +
      '<button class="icon-btn" data-act="menu">≡</button>' +
      '</div>';

    if (r.artifacts.length) {
      html += '<div class="artifact-row">';
      r.artifacts.forEach(function (id, i) {
        html += '<div class="artifact-chip" data-art="' + i + '">' + esc(ns.ARTIFACTS[id].name.charAt(0)) + '</div>';
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
        var a = ns.ARTIFACTS[r.artifacts[+chip.dataset.art]];
        toast(a.name + ': ' + a.desc, 2400);
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

  /* ====================== NODE SELECT ====================== */
  var NODE_INFO = {
    fight: { title: '⌖ HOSTILE CONTACT', cls: '', desc: 'Enemy signatures ahead. Clear them out for salvage and gear.' },
    event: { title: '? UNKNOWN SIGNAL', cls: 'magenta', desc: 'Something unexpected. Could be fortune. Could be teeth.' },
    shop: { title: '¢ FREE TRADER', cls: 'amber', desc: 'Cards, relics and repairs — for a price.' },
    rest: { title: '+ FIELD CAMP', cls: 'cyan', desc: 'A quiet moment. Patch wounds or refine a card.' },
  };

  function showNodeSelect() {
    updateHUD();
    var r = E.run;
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Choose Your Path'));
    s.appendChild(el('div', 'screen-sub', 'SECTOR ' + r.sector + ' · ' + esc(ns.FACTIONS[r.faction].name.toUpperCase()) + ' TERRITORY'));
    r.nodeOptions.forEach(function (opt, i) {
      var ni = NODE_INFO[opt];
      var btn = el('div', 'panel-btn ' + ni.cls,
        '<div class="pb-title">' + ni.title + '</div><div class="pb-desc">' + esc(ni.desc) + '</div>');
      btn.addEventListener('pointerdown', function () {
        SFX.tap();
        E.chooseNode(i);
        U.refresh();
      });
      s.appendChild(btn);
    });
    // upcoming nodes preview
    var up = B.sector.script.slice(r.nodeIdx + 1).map(function (n) {
      return n === 'boss' ? 'BOSS' : n === 'elite' ? 'ELITE' : '·';
    }).join(' ');
    if (up) s.appendChild(el('div', 'footer-note', 'AHEAD: ' + up));
  }

  /* ====================== COMBAT ====================== */
  function showCombat() {
    hideOverlay();
    combatChrome(true);
    R.syncCombat();
    updateHUD();
    renderHand();
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

  function renderHand() {
    $hand.innerHTML = '';
    var c = E.combat;
    if (!c) return;
    c.hand.forEach(function (card, i) {
      var info = E.cardInfo(card);
      var d = el('div', 'card type-' + info.type +
        (info.cost > c.energy && !info.unplayable ? ' unaffordable' : '') +
        (info.unplayable ? ' unplayable-curse' : '') +
        (i === selected ? ' selected' : ''));
      d.innerHTML = cardInner(info.name, info.cost, info.type, info.rarity, info.desc, info.unplayable);
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
    E.events.length = 0;
    var ok = E.playCard(i, targetIdx);
    if (!ok) { renderHand(); return; }
    SFX.play();
    var evts = E.events.slice();
    E.events.length = 0;
    lock(true);
    playTimeline(evts, 70, function () {
      lock(false);
      afterAction();
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
      afterAction();
    });
  }

  function afterAction() {
    var r = E.run;
    if (r.phase === 'dead') {
      SFX.lose();
      setTimeout(U.refresh, 700);
    } else if (r.phase === 'reward') {
      SFX.win();
      setTimeout(U.refresh, 650);
    } else if (r.phase === 'combat') {
      renderHand();
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
      s.appendChild(el('div', 'gain-list', '<div>◆ ' + esc(a.name) + ' — ' + esc(a.desc) + '</div>'));
    }

    if (!rw.cardTaken) {
      s.appendChild(el('div', 'screen-sub', 'TAKE ONE CARD'));
      var grid = el('div', 'card-grid');
      rw.cards.forEach(function (cid, i) {
        var d = cardEl(cid, false);
        d.addEventListener('pointerdown', function () {
          SFX.coin();
          E.takeRewardCard(i);
          E.finishReward();
          U.refresh();
        });
        grid.appendChild(d);
      });
      s.appendChild(grid);
      var skip = el('button', 'btn dim small', 'SKIP CARD');
      skip.addEventListener('pointerdown', function () {
        SFX.tap();
        E.finishReward();
        U.refresh();
      });
      s.appendChild(skip);
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
    d.innerHTML = cardInner(def.name + (up ? '+' : ''), ns.cardCost(def, up), def.type, def.rarity,
      ns.cardDesc(def, up, ctx), def.unplayable);
    return d;
  }

  /* ====================== EVENT ====================== */
  function showEvent() {
    updateHUD();
    var ev = E.getEvent();
    var s = overlayScreen();
    s.appendChild(el('h2', 'screen-title', esc(ev.title)));
    s.appendChild(el('div', 'screen-sub', 'SECTOR ' + E.run.sector + ' · ANOMALY'));
    s.appendChild(el('div', 'event-text', esc(ev.text)));
    ev.choices.forEach(function (ch, i) {
      var sub = ch.sub ? '<div class="pb-sub">' + esc(ch.sub) + '</div>' : '';
      var disabled = ch.cost && E.run.credits < ch.cost;
      var btn = el('div', 'panel-btn' + (disabled ? ' disabled' : ''),
        '<div class="pb-title">' + esc(ch.label) + '</div>' + sub);
      btn.addEventListener('pointerdown', function () {
        if (disabled) return;
        SFX.tap();
        var res = E.eventChoose(i);
        if (!res) return;
        if (E.run.phase === 'dead') { U.refresh(); return; }
        showEventResult(true);
      });
      s.appendChild(btn);
    });
  }

  function showEventResult(animate) {
    updateHUD();
    var r = E.run;
    var res = r.eventResult;
    if (!res) { U.refresh(); return; }
    var s = overlayScreen();
    var ev = E.getEvent();
    s.appendChild(el('h2', 'screen-title', esc(ev ? ev.title : 'OUTCOME')));

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
      if (r.pendingPick) {
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
    var titles = { remove: 'Remove a Card', upgrade: 'Upgrade a Card', dupe: 'Duplicate a Card' };
    s.appendChild(el('h2', 'screen-title', titles[type] || 'Choose a Card'));
    s.appendChild(el('div', 'screen-sub', 'TAP A CARD'));
    var grid = el('div', 'card-grid');
    r.deck.forEach(function (card, i) {
      var def = ns.CARDS[card.id];
      if (type === 'upgrade' && (card.up || def.type === 'curse')) return;
      if (type === 'dupe' && def.type === 'curse') return;
      var d = cardEl(card.id, card.up);
      d.addEventListener('pointerdown', function () {
        SFX.coin();
        E.applyPick(i);
        onDone();
      });
      grid.appendChild(d);
    });
    s.appendChild(grid);
    if (!grid.children.length) {
      E.cancelPick();
      s.appendChild(el('div', 'screen-sub', 'NO VALID CARDS'));
      var btn = el('button', 'btn dim', 'BACK');
      btn.addEventListener('pointerdown', function () { onDone(); });
      s.appendChild(btn);
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

    var grid = el('div', 'card-grid');
    sh.cards.forEach(function (it, i) {
      var d = cardEl(it.id, false);
      if (it.sold) d.classList.add('sold');
      d.appendChild(el('div', 'price', '¢' + it.cost));
      d.addEventListener('pointerdown', function () {
        if (it.sold) return;
        if (E.shopBuyCard(i)) { SFX.coin(); showShop(); }
        else toast('NOT ENOUGH CREDITS');
      });
      grid.appendChild(d);
    });
    s.appendChild(grid);

    var row = el('div', 'shop-row');
    if (sh.artifact) {
      var a = ns.ARTIFACTS[sh.artifact.id];
      var ab = el('div', 'panel-btn amber' + (sh.artifact.sold ? ' disabled' : ''),
        '<div class="pb-title">◆ ' + esc(a.name) + ' — ¢' + sh.artifact.cost + '</div>' +
        '<div class="pb-desc">' + esc(a.desc) + '</div>');
      ab.addEventListener('pointerdown', function () {
        if (sh.artifact.sold) return;
        if (E.shopBuyArtifact()) { SFX.coin(); showShop(); }
        else toast('NOT ENOUGH CREDITS');
      });
      s.appendChild(ab);
    }

    var hb = el('button', 'btn cyan small' + (sh.healUsed || r.hp >= r.maxHp ? ' dim' : ''), 'REPAIR +' + B.shop.healAmount + ' HP · ¢' + B.shop.healCost);
    hb.addEventListener('pointerdown', function () {
      if (E.shopBuyHeal()) { SFX.heal(); showShop(); }
      else toast(r.hp >= r.maxHp ? 'HULL ALREADY INTACT' : sh.healUsed ? 'SOLD OUT' : 'NOT ENOUGH CREDITS');
    });
    row.appendChild(hb);

    var rb = el('button', 'btn red small' + (sh.removeUsed ? ' dim' : ''), 'PURGE A CARD · ¢' + r.removeCost);
    rb.addEventListener('pointerdown', function () {
      if (sh.removeUsed) { toast('SERVICE USED'); return; }
      if (E.shopBuyRemove()) {
        SFX.tap();
        showPickModal('remove', function () { showShop(); });
      } else toast('NOT ENOUGH CREDITS');
    });
    row.appendChild(rb);
    s.appendChild(row);

    var leave = el('button', 'btn', 'DEPART');
    leave.addEventListener('pointerdown', function () { SFX.tap(); E.leaveShop(); U.refresh(); });
    s.appendChild(leave);
  }

  /* ====================== REST ====================== */
  function showRest() {
    updateHUD();
    var r = E.run;
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Field Camp'));
    s.appendChild(el('div', 'screen-sub', 'THE GUNS GO QUIET FOR A WHILE'));
    var healAmt = Math.round(r.maxHp * B.rewards.restHealPct);
    var h = el('div', 'panel-btn cyan',
      '<div class="pb-title">+ PATCH WOUNDS</div><div class="pb-desc">Heal ' + healAmt + ' HP (' + r.hp + ' → ' + Math.min(r.maxHp, r.hp + healAmt) + ')</div>');
    h.addEventListener('pointerdown', function () { SFX.heal(); E.restHeal(); U.refresh(); });
    s.appendChild(h);
    var u = el('div', 'panel-btn amber',
      '<div class="pb-title">▲ REFINE A CARD</div><div class="pb-desc">Permanently upgrade one card in your deck.</div>');
    u.addEventListener('pointerdown', function () {
      SFX.tap();
      E.restUpgrade();
      showPickModal('upgrade', function () {
        if (E.run.pendingPick) { E.cancelPick(); showRest(); return; }
        E.nodeComplete();
        U.refresh();
      });
    });
    s.appendChild(u);
  }

  /* ====================== LEVEL UP / BOSS ARTIFACT ====================== */
  function showLevelUp() {
    updateHUD();
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Level Up'));
    s.appendChild(el('div', 'screen-sub', 'THE DESCENT HARDENS YOU · CHOOSE ONE'));
    E.levelUpOptions().forEach(function (opt) {
      var btn = el('div', 'panel-btn',
        '<div class="pb-title">' + esc(opt.label) + '</div><div class="pb-desc">' + esc(opt.desc) + '</div>');
      btn.addEventListener('pointerdown', function () {
        SFX.win();
        E.levelUp(opt.id);
        U.refresh();
      });
      s.appendChild(btn);
    });
  }

  function showBossArtifact() {
    updateHUD();
    var r = E.run;
    var s = overlayScreen(true);
    s.appendChild(el('h2', 'screen-title', 'Spoils of War'));
    s.appendChild(el('div', 'screen-sub', 'CLAIM ONE RELIC'));
    (r.bossArtifacts || []).forEach(function (id, i) {
      var a = ns.ARTIFACTS[id];
      var btn = el('div', 'panel-btn amber',
        '<div class="pb-title">◆ ' + esc(a.name) + '</div><div class="pb-desc">' + esc(a.desc) + '</div>');
      btn.addEventListener('pointerdown', function () {
        SFX.coin();
        E.takeBossArtifact(i);
        U.refresh();
      });
      s.appendChild(btn);
    });
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
