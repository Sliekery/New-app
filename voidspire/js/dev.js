/* =========================================================================
 * VOIDSPIRE — dev.js
 * A console for setting up a situation instead of playing to one.
 *
 * WHY THIS EXISTS. Testing a rare interaction meant reaching it: a Flaw firing
 * on a welded seam, against an enemy that only appears in sector 4, with a
 * particular card in hand, is twenty minutes of play away — and it has to be
 * reached again after every change to it. Most of what we have got wrong in
 * combat has been in exactly those corners, and the cost of looking at one was
 * high enough that we mostly did not.
 *
 * WHAT IT IS NOT. It does not simulate anything. Every button here calls a
 * hook in engine.js that hands straight back to the real code — the fight goes
 * through startCombat so relics, pressure, intents and the first turn all
 * happen as they normally do; a card is made with mkCard; a kill goes through
 * dealToEnemy so whatever a kill triggers still triggers. A console that built
 * its own combat state would be a second implementation of the game, and
 * anything it showed us would be a fact about the console.
 *
 * OFF BY DEFAULT. Add ?dev=1 to the url. The engine hooks are always present —
 * this is a single-player game in a browser, so hiding them would inconvenience
 * us and nobody else — but the panel is not, because a stray tap on it during
 * an honest run would ruin the run.
 * ========================================================================= */
(function (ns) {
  'use strict';

  var ON = false;
  try { ON = /[?&]dev=1/.test(location.search); } catch (e) { return; }
  if (!ON) return;

  var E = ns.engine, U = ns.ui;

  /* ---- the panel's own stylesheet, so style.css stays about the game ---- */
  var css = document.createElement('style');
  css.textContent = [
    '#vsdev{position:fixed;top:0;right:0;z-index:99999;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;',
    '  color:#eafcff;max-width:min(360px,100vw);max-height:100vh;display:flex;flex-direction:column;align-items:flex-end}',
    /* The panel is 360px of a 1280px stage, so on the right it sits on top of
       whatever enemy is standing there — and the thing you have just set up is
       exactly what you want to look at. One tap moves it to the other edge. */
    '#vsdev.left{right:auto;left:0;align-items:flex-start}',
    '#vsdev.left .tab,#vsdev.left .body{border-radius:0 0 4px 0}',
    '#vsdev .tabs{display:flex}',
    '#vsdev .tab{background:#111a08;border:1px solid #7ee02a;color:#a8ff4d;border-radius:0 0 0 4px;',
    '  padding:6px 10px;font:700 10px/1 ui-monospace,monospace;letter-spacing:.14em;cursor:pointer}',
    '#vsdev .body{display:none;background:rgba(4,10,4,.97);border:1px solid #4a7a20;border-top:0;',
    '  border-radius:0 0 0 4px;padding:8px;overflow-y:auto;max-height:calc(100vh - 30px);width:min(360px,100vw)}',
    '#vsdev.open .body{display:block}',
    '#vsdev h3{font:700 9px/1 ui-monospace,monospace;letter-spacing:.16em;color:#7ea86a;margin:11px 0 5px}',
    '#vsdev h3:first-child{margin-top:0}',
    '#vsdev button{background:rgba(10,20,8,.9);border:1px solid #3e6a1c;border-radius:3px;color:#dff5cf;',
    '  font:700 9.5px/1 ui-monospace,monospace;letter-spacing:.05em;padding:6px 7px;cursor:pointer;margin:0}',
    '#vsdev button:hover{border-color:#a8ff4d;color:#a8ff4d}',
    '#vsdev button.on{background:rgba(168,255,77,.18);border-color:#a8ff4d;color:#a8ff4d}',
    '#vsdev button.go{border-color:#a8ff4d;color:#a8ff4d}',
    '#vsdev .row{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:4px}',
    '#vsdev input{background:#040a04;border:1px solid #3e6a1c;border-radius:3px;color:#eafcff;',
    '  font:10px ui-monospace,monospace;padding:5px;min-width:0}',
    '#vsdev input[type=text]{flex:1}',
    '#vsdev input[type=number]{width:62px}',
    '#vsdev .pick{max-height:132px;overflow-y:auto;border:1px solid #2c4c14;border-radius:3px;margin-bottom:4px}',
    '#vsdev .pick div{padding:4px 6px;cursor:pointer;border-bottom:1px solid rgba(62,106,28,.3);font-size:10px}',
    '#vsdev .pick div:hover{background:rgba(168,255,77,.12)}',
    '#vsdev .pick div.sel{background:rgba(168,255,77,.2);color:#a8ff4d}',
    '#vsdev .pick div i{color:#7ea86a;font-style:normal;float:right;font-size:9px}',
    '#vsdev .say{color:#7ea86a;font-size:9.5px;min-height:13px;margin:4px 0 0}',
    '#vsdev .say.bad{color:#ff8a6a}',
  ].join('\n');
  document.head.appendChild(css);

  var root = document.createElement('div');
  root.id = 'vsdev';
  root.innerHTML = '<div class="tabs"><div class="tab" id="vsdevSide">\u25c0\u25b6</div>'
    + '<div class="tab" id="vsdevTab">DEV</div></div><div class="body"></div>';
  document.body.appendChild(root);
  var tab = root.querySelector('#vsdevTab'), body = root.querySelector('.body');
  tab.onclick = function () { root.classList.toggle('open'); if (root.classList.contains('open')) build(); };

  var SIDE_KEY = 'voidspire.dev.side';
  try { if (localStorage.getItem(SIDE_KEY) === 'left') root.classList.add('left'); } catch (e) {}
  root.querySelector('#vsdevSide').onclick = function () {
    root.classList.toggle('left');
    try { localStorage.setItem(SIDE_KEY, root.classList.contains('left') ? 'left' : 'right'); } catch (e) {}
  };

  /* main.js swallows touchmove everywhere but .screen, to stop iOS rubber-band.
   * The panel scrolls, so its own moves have to stop before they get there. */
  body.addEventListener('touchmove', function (ev) { ev.stopPropagation(); }, { passive: true });

  /* ---- tiny builders --------------------------------------------------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function h3(t) { return el('h3', null, t); }
  function row() {
    var r = el('div', 'row');
    for (var i = 0; i < arguments.length; i++) r.appendChild(arguments[i]);
    return r;
  }
  function btn(label, fn, cls) {
    var b = el('button', cls || null, label);
    b.onclick = fn;
    return b;
  }
  function num(value, w) {
    var i = el('input');
    i.type = 'number'; i.value = value;
    if (w) i.style.width = w;
    return i;
  }
  /* The message survives the rebuild that follows it. Writing it into the DOM
   * and then rebuilding the panel wiped it every time, so every action looked
   * silent — including the ones that had failed and said why. */
  var lastSay = { msg: '', bad: false };
  function say(msg, bad) {
    lastSay = { msg: msg || '', bad: !!bad };
    var s = document.getElementById('vsdevSay');
    if (!s) return;
    s.textContent = lastSay.msg;
    s.className = 'say' + (bad ? ' bad' : '');
  }
  /* Every hook returns null when it worked and a sentence when it did not, so
   * one wrapper covers all of them and the panel never silently does nothing. */
  /* Same as run(), minus the rebuild: for the pickers, where a rebuild would
   * throw away the filter you just typed. */
  function quiet(fn, okMsg) {
    var why;
    try { why = fn(); } catch (e) { say(e.message, true); return; }
    if (why) { say(why, true); return; }
    say(okMsg || 'done');
    if (U && U.refresh) U.refresh();
  }
  function run(fn, okMsg) {
    var why;
    try { why = fn(); }
    catch (e) { say(e.message, true); return; }
    if (why) { say(why, true); return; }
    say(okMsg || 'done');
    if (U && U.refresh) U.refresh();
    build();
  }

  /* A filterable list. Used for enemies, cards and engravings alike — three
   * pickers over three tables of very different sizes, one behaviour. */
  function picker(items, onPick, opts) {
    opts = opts || {};
    var wrap = el('div');
    var search = el('input');
    search.type = 'text'; search.placeholder = opts.placeholder || 'search…';
    var list = el('div', 'pick');
    function paint() {
      var q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      var n = 0;
      items.forEach(function (it) {
        if (q && it.label.toLowerCase().indexOf(q) < 0 && it.id.indexOf(q) < 0) return;
        if (++n > 120) return;
        var d = el('div', opts.isSel && opts.isSel(it.id) ? 'sel' : null);
        d.textContent = it.label;
        if (it.note) d.appendChild(el('i', null, it.note));
        d.onclick = function () { onPick(it.id); paint(); };
        list.appendChild(d);
      });
      if (!n) list.appendChild(el('div', null, 'nothing matches'));
    }
    search.oninput = paint;
    paint();
    wrap.appendChild(row(search));
    wrap.appendChild(list);
    return wrap;
  }

  /* ---- state the panel itself keeps ------------------------------------ */
  var chosen = [];               // enemy ids staged for the next fight
  var kind = 'fight';
  var upgraded = false;
  var cardWhere = 'hand';
  var face = 20;

  function enemyItems() {
    return E.dev.enemyIds().map(function (id) {
      var d = ns.ENEMIES[id];
      return { id: id, label: d.name || id,
               note: (d.boss ? 'BOSS ' : d.elite ? 'ELITE ' : '') + d.hp + 'hp' };
    }).sort(function (a, b) { return a.label < b.label ? -1 : 1; });
  }
  function cardItems() {
    return E.dev.cardIds().map(function (id) {
      var c = ns.CARDS[id];
      return { id: id, label: c.name || id, note: c.cls + ' · ' + c.cost };
    }).sort(function (a, b) { return a.label < b.label ? -1 : 1; });
  }
  function engItems() {
    return E.dev.engravingIds().map(function (id) {
      var g = ns.dieEngraving(id) || {};
      return { id: id, label: g.name || id,
               note: (ns.DIE_FLAWS && ns.DIE_FLAWS[id]) ? 'FLAW' : ('T' + (g.tier || 1)) };
    }).sort(function (a, b) { return a.label < b.label ? -1 : 1; });
  }

  /* ---- the panel ------------------------------------------------------- */
  function build() {
    if (!root.classList.contains('open')) return;
    body.innerHTML = '';
    var r = E.run, c = E.combat;

    // ---------- where we are ----------
    body.appendChild(h3('WHERE WE ARE'));
    body.appendChild(el('div', 'say',
      r ? (r.cls + ' · sector ' + r.sector + ' · ' + r.phase
           + ' · ' + r.hp + '/' + r.maxHp + 'hp · ' + r.credits + 'cr'
           + (c ? ' · turn ' + c.turn + ' · ' + c.energy + ' energy' : ''))
        : 'no run'));

    // ---------- a run ----------
    body.appendChild(h3('RUN'));
    var cls = row();
    ['vanguard', 'technomancer', 'voidadept'].forEach(function (k) {
      cls.appendChild(btn(k.toUpperCase().slice(0, 4), function () {
        run(function () { E.newRun(k); return null; }, 'new ' + k + ' run');
      }, r && r.cls === k ? 'on' : null));
    });
    body.appendChild(cls);
    if (r) {
      var hp = num(r.hp), mhp = num(r.maxHp), sec = num(r.sector, '46px'), cr = num(r.credits);
      body.appendChild(row(el('span', null, 'hp'), hp, el('span', null, '/'), mhp,
        btn('SET', function () {
          run(function () { return E.dev.set('maxHp', +mhp.value) || E.dev.set('hp', +hp.value); });
        })));
      body.appendChild(row(el('span', null, 'sector'), sec, el('span', null, 'cr'), cr,
        btn('SET', function () {
          run(function () { return E.dev.set('sector', +sec.value) || E.dev.set('credits', +cr.value); });
        }),
        btn('FULL HEAL', function () { run(function () { return E.dev.set('hp', r.maxHp); }); })));
    }

    if (!r) { body.appendChild(el('p', 'say', 'start a run above, then everything else opens up')); return; }

    // ---------- a fight ----------
    body.appendChild(h3('FIGHT — pick up to five'));
    var kr = row();
    ['fight', 'elite', 'boss'].forEach(function (k) {
      kr.appendChild(btn(k.toUpperCase(), function () { kind = k; build(); }, kind === k ? 'on' : null));
    });
    kr.appendChild(btn('CLEAR', function () { chosen = []; build(); }));
    body.appendChild(kr);
    /* This line updates in place rather than through a rebuild: rebuilding on
     * every pick emptied the search box, which is precisely the wrong moment
     * to lose it when you are choosing three enemies out of forty-nine. */
    var summary = el('div', 'say');
    summary.id = 'vsdevPicked';   // named, so it is not just "one of the .say lines"
    function paintSummary() {
      summary.textContent = chosen.length
        ? chosen.map(function (i) { return (ns.ENEMIES[i].name || i); }).join(' + ')
        : 'nobody picked';
    }
    paintSummary();
    body.appendChild(summary);
    body.appendChild(picker(enemyItems(), function (id) {
      var at = chosen.indexOf(id);
      if (at >= 0) chosen.splice(at, 1);
      else if (chosen.length < 5) chosen.push(id);
      paintSummary();
    }, { placeholder: 'find an enemy…', isSel: function (id) { return chosen.indexOf(id) >= 0; } }));
    body.appendChild(row(btn('START THIS FIGHT', function () {
      run(function () { return E.dev.fight(chosen, kind); }, 'fighting ' + chosen.length);
    }, 'go')));

    // ---------- cards ----------
    body.appendChild(h3('CARDS'));
    var wr = row();
    ['hand', 'draw', 'discard', 'deck'].forEach(function (w) {
      wr.appendChild(btn(w.toUpperCase(), function () { cardWhere = w; build(); }, cardWhere === w ? 'on' : null));
    });
    wr.appendChild(btn(upgraded ? 'UPGRADED' : 'BASE', function () { upgraded = !upgraded; build(); },
      upgraded ? 'on' : null));
    body.appendChild(wr);
    body.appendChild(picker(cardItems(), function (id) {
      quiet(function () { return E.dev.card(id, upgraded, cardWhere); },
        (ns.CARDS[id].name || id) + ' → ' + cardWhere);
    }, { placeholder: 'find a card…' }));

    // ---------- the die ----------
    body.appendChild(h3('THE DIE — cut without the bench'));
    var fi = num(face, '52px');
    fi.min = 1; fi.max = ns.dieSides(r.die);
    fi.oninput = function () { face = +this.value; };
    body.appendChild(row(el('span', null, 'face'), fi,
      btn('SCRUB IT', function () { run(function () { return E.dev.scrub(face); }, 'face ' + face + ' cleared'); })));
    body.appendChild(picker(engItems(), function (id) {
      run(function () { return E.dev.engrave(face, id); }, id + ' cut into face ' + face);
    }, { placeholder: 'find an engraving…' }));

    // ---------- in the fight ----------
    if (c) {
      body.appendChild(h3('IN THE FIGHT'));
      var en = num(c.energy, '52px'), bl = num(c.player.block, '52px');
      body.appendChild(row(el('span', null, 'energy'), en, el('span', null, 'shield'), bl,
        btn('SET', function () {
          run(function () { return E.dev.set('energy', +en.value) || E.dev.set('block', +bl.value); });
        })));
      var sr = row();
      ['str', 'aim', 'stim', 'bulwark', 'momentum', 'weak', 'vuln'].forEach(function (s) {
        sr.appendChild(btn('+1 ' + s, function () {
          run(function () { return E.dev.status('player', s, 1); }, s + ' +1');
        }));
      });
      body.appendChild(sr);
      var kr2 = row(
        btn('END TURN', function () { run(function () { E.endTurn(); return null; }, 'turn ended'); }, 'go'),
        btn('KILL ALL', function () { run(function () { return E.dev.kill(null); }, 'cleared'); }));
      c.enemies.forEach(function (e2, i) {
        if (!e2.alive) return;
        kr2.appendChild(btn('KILL ' + (i + 1), function () {
          run(function () { return E.dev.kill(i); }, (e2.def.name || '') + ' down');
        }));
      });
      body.appendChild(kr2);
    }

    // ---------- everything that is not a fight ----------
    body.appendChild(h3('GO TO'));
    var nr = row();
    ['shop', 'market', 'rest', 'forge', 'event', 'treasure', 'rift'].forEach(function (t) {
      nr.appendChild(btn(t.toUpperCase(), function () {
        run(function () { return E.dev.node(t); }, 'at the ' + t);
      }));
    });
    nr.appendChild(btn('MAP', function () {
      run(function () { E.run.phase = 'map'; return null; }, 'back to the map');
    }));
    body.appendChild(nr);

    var s = el('p', 'say' + (lastSay.bad ? ' bad' : ''), lastSay.msg);
    s.id = 'vsdevSay';
    body.appendChild(s);
  }

  // Expose it for the test harness, which drives these rather than the buttons
  // when it only needs a situation set up and does not care how it got there.
  ns.dev = { build: build, open: function () { root.classList.add('open'); build(); } };
})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
