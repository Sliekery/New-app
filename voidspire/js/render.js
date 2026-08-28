/* =========================================================================
 * VOIDSPIRE — render.js
 * Canvas battlefield: starfield, vector line-art entities, particles.
 * The UI layer feeds it staggered "view" updates so HP bars and deaths
 * animate in sync with the action timeline, not the (instant) engine state.
 * ========================================================================= */
(function (ns) {
  'use strict';

  var R = {};
  ns.render = R;

  // Star-chart node icons (polylines in a -1..1 box; same format as enemy art).
  // Shared by the map UI (SVG) and the headless map screenshot tool (canvas).
  ns.MAP_ICONS = {
    fight:    { color: '#ff8a3a', p: [[-0.75,0.75, 0.55,-0.6], [0.3,-0.72, 0.72,-0.42], [0.75,0.75, -0.55,-0.6], [-0.3,-0.72, -0.72,-0.42]] },
    elite:    { color: '#ff4a5e', p: [[-0.5,-0.15, -0.42,-0.55, 0,-0.72, 0.42,-0.55, 0.5,-0.15, 0.32,0.1, 0.22,0.1, 0.22,0.45, -0.22,0.45, -0.22,0.1, -0.32,0.1, -0.5,-0.15], [-0.22,0.45, -0.1,0.28, 0,0.45, 0.1,0.28, 0.22,0.45]], e: [[-0.2,-0.18], [0.2,-0.18]] },
    boss:     { color: '#ff4a5e', p: [[-0.6,-0.45, -0.4,-0.8, -0.13,-0.5, 0.13,-0.85, 0.4,-0.5, 0.6,-0.8, 0.62,-0.3, 0.55,0.05, 0.32,0.15, 0.22,0.15, 0.22,0.5, -0.22,0.5, -0.22,0.15, -0.32,0.15, -0.55,0.05, -0.62,-0.3, -0.6,-0.45], [-0.22,0.5, -0.08,0.32, 0,0.5, 0.08,0.32, 0.22,0.5], [-0.85,-0.55, -0.6,-0.4], [0.85,-0.55, 0.6,-0.4]], e: [[-0.24,-0.12], [0.24,-0.12]] },
    event:    { color: '#41d8ff', p: [[-0.6,-0.55, 0.6,-0.55, 0.6,0.28, 0.0,0.28, -0.22,0.62, -0.27,0.28, -0.6,0.28, -0.6,-0.55]], e: [[-0.28,-0.12], [0,-0.12], [0.28,-0.12]] },
    random:   { color: '#c86bff', p: [[-0.4,-0.42, -0.12,-0.72, 0.28,-0.6, 0.38,-0.22, 0.04,-0.02, 0.0,0.28]], e: [[0,0.6]] },
    shop:     { color: '#ffb02e', p: [[0.0,-0.62, 0.44,-0.44, 0.62,0.0, 0.44,0.44, 0.0,0.62, -0.44,0.44, -0.62,0.0, -0.44,-0.44, 0.0,-0.62], [0.0,-0.82, 0.0,0.82], [-0.22,-0.28, 0.22,-0.28], [-0.22,0.28, 0.22,0.28]] },
    rest:     { color: '#5dff88', p: [[0.0,0.62, -0.42,0.2, -0.26,-0.22, 0.02,0.1, 0.12,-0.55, 0.32,-0.1, 0.42,0.26, 0.0,0.62], [0.0,0.62, 0.0,0.1]] },
    treasure: { color: '#ffb02e', p: [[-0.6,-0.08, 0.6,-0.08, 0.6,0.55, -0.6,0.55, -0.6,-0.08], [-0.6,-0.08, -0.5,-0.5, 0.5,-0.5, 0.6,-0.08], [-0.12,0.1, 0.12,0.1, 0.12,0.32, -0.12,0.32, -0.12,0.1]], e: [[0,0.2]] },
    // -- new node types --
    forge:    { color: '#7fd8ff', p: [[-0.55,0.25, 0.5,0.25, 0.62,0.05, -0.2,0.05, -0.55,0.25], [-0.18,0.25, -0.18,0.6, 0.18,0.6, 0.18,0.25], [-0.5,-0.55, -0.1,-0.2], [-0.62,-0.62, -0.18,-0.32, -0.32,-0.55, -0.62,-0.62]] },
    beacon:   { color: '#ff7a4a', p: [[0,-0.55, 0,0.55], [-0.32,0.55, 0.32,0.55], [0,-0.55, -0.26,-0.18], [0,-0.55, 0.26,-0.18], [0.22,-0.62, 0.42,-0.45], [0.3,-0.74, 0.58,-0.5]], e: [[0,-0.5]] },
    market:   { color: '#c89bff', p: [[-0.45,-0.08, 0.45,-0.08, 0.56,0.58, -0.56,0.58, -0.45,-0.08], [-0.26,-0.08, -0.26,-0.34, 0.26,-0.34, 0.26,-0.08], [-0.18,0.18, 0.18,0.18]], e: [[0,0.36]] },
    rift:     { color: '#d86bff', p: [[0,-0.55, 0.42,-0.28, 0.46,0.22, 0.08,0.46, -0.28,0.28, -0.3,-0.08, 0.04,-0.22, 0.2,0.06]], e: [[0,0]] },
  };

  var canvas, ctx, W = 0, H = 0, dpr = 1;
  var t = 0;
  var stars = [];
  var particles = [];
  // Every particle in the game is born here. The counter is monotonic, which is
  // what lets a test prove a card's cast actually DREW something — live count
  // alone can't, because particles from the previous cast are expiring while
  // you measure.
  var fxSpawns = 0;
  function spawn(p) { fxSpawns++; particles.push(p); return p; }
  var screenShake = 0;
  var flashAlpha = 0;

  R.views = [];           // enemy display states
  R.hotIcons = [];        // per-frame hover hit-boxes: { x0,y0,x1,y1, kind, key }
  R.iconAt = function (px, py) {
    for (var i = R.hotIcons.length - 1; i >= 0; i--) {
      var h = R.hotIcons[i];
      if (px >= h.x0 && px <= h.x1 && py >= h.y0 && py <= h.y1) return h;
    }
    return null;
  };
  R.player = { hp: 1, maxHp: 1, block: 0, flashT: -9 };
  R.combatVisible = false;
  R.targeting = false;
  // lock-on aiming reticle (drag a targeted card out of hand -> reticle follows
  // the cursor and locks the enemy under it; release fires the card)
  R.aim = { on: false, x: 0, y: 0, lock: -1, lockT: -9 };
  R.setAim = function (x, y, lock) {
    R.aim.on = true; R.aim.x = x; R.aim.y = y;
    var lk = (lock == null ? -1 : lock);
    if (lk !== R.aim.lock) { R.aim.lock = lk; if (lk >= 0) R.aim.lockT = t; }   // new target -> start the lock-on anim
  };
  R.clearAim = function () { R.aim.on = false; R.aim.lock = -1; };

  R.init = function (cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    R.resize();
    for (var i = 0; i < 90; i++) {
      stars.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, tw: Math.random() * 6 });
    }
  };

  /* WHERE THE CARDS ACTUALLY START.
   *
   * `fieldBottom()` reserves min(170, H*0.28) for the hand, which is a guess:
   * the hand is a DOM element whose height depends on the card size, the frame
   * scale and the orientation. Measured on a 1773x894 window it is 229px tall,
   * so the guess was 59px optimistic — and 59px is exactly how a boss's HP bar
   * and its number ended up drawn behind the cards.
   *
   * The canvas is sized in CSS pixels (W/H are the rect, dpr only scales the
   * backing store), so a rect offset from the canvas IS a canvas coordinate.
   * Cached per resize rather than read every frame. */
  var handY = 0, leftY = 0;
  /* LAYOUT POSITION, NOT THE PAINTED RECT. Cards deal in with a translateY and
   * the hand fans, so a getBoundingClientRect on them is a moving target for
   * the third of a second it takes to settle — the reserve line would slide
   * down and back up while the animation ran, flipping HP bars with it. The
   * offsetTop chain is where the element LANDS, which is the line we want, and
   * transforms do not touch it. */
  function layoutTop(el) {
    var y = 0;
    for (var n = el; n; n = n.offsetParent) y += n.offsetTop;
    return y;
  }
  function topEdge(base, k, cb, sel, all) {
    var best = Infinity;
    var list = all ? document.querySelectorAll(sel) : [document.querySelector(sel)];
    [].forEach.call(list, function (el) {
      if (!el) return;
      var b = el.getBoundingClientRect();
      if (!b.height || !b.width) return;          // hidden out of combat
      /* THE LOWER OF THE TWO, which is right in both regimes. While the cards
       * deal in they are translated DOWN, so the painted rect is below where
       * they land and the layout value is the honest one. Once settled, the
       * fan ROTATES them and a rotated card's box reaches higher than its
       * layout box, so the painted rect is the honest one. Taking the minimum
       * is conservative during the animation and exact after it. */
      best = Math.min(best, (layoutTop(el) - base) * k, b.top - cb.top);
    });
    return best;
  }
  /* TWO REGIONS, because the chrome is not one bar. The cards sit centre and
   * right; the stim belt, the energy pip and the draw pile sit far left, which
   * is exactly where the player figure and its gauge stand. Measuring one
   * rectangle for both would push the enemy bars up to clear a belt they are
   * nowhere near.
   *
   * THE CARDS, NOT THE HAND. #hand is 227px tall with the cards occupying only
   * its bottom 90 — measured, the box top sits 149px above the first card — so
   * reserving against the container flipped ordinary enemies above their heads
   * to clear empty space. The card elements are the obstacle; the container is
   * not. Falls back to the dock, which is always there.
   *
   * RE-MEASURED EVERY FRAME. This ran once, in syncCombat, and the hand and the
   * belt are laid out AFTER that — so whether the reserve was right depended on
   * when the first frame landed. That is exactly the flavour of bug that shows
   * up on someone else's machine and not on the one it was written on. Six rect
   * reads a frame is nothing next to being wrong intermittently. */
  function measureChrome() {
    var cb = canvas && canvas.getBoundingClientRect();
    if (!cb || !cb.height || typeof document === 'undefined') { handY = leftY = H; return; }
    // the frame is transform scaled, so layout px have to be converted into the
    // canvas coordinate space the rest of this file draws in
    var k = canvas.offsetHeight ? (cb.height / canvas.offsetHeight) : 1;
    if (!(k > 0.01)) k = 1;
    var base = layoutTop(canvas);
    var cards = topEdge(base, k, cb, '#hand .card', true);
    var dock = topEdge(base, k, cb, '#combat-dock');
    var left = Math.min(
      topEdge(base, k, cb, '#potion-belt'), topEdge(base, k, cb, '.belt-lbl'),
      topEdge(base, k, cb, '#energy-pip'), topEdge(base, k, cb, '#draw-pile'), dock);
    handY = Math.max(0, Math.min(H, Math.min(cards, dock)));
    leftY = Math.max(0, Math.min(H, left));
  }
  // The lowest line a readout may occupy. Called with the block's own height so
  // each caller says how much room it needs rather than sharing a guess.
  function readableBottom(need) { return Math.min(H, handY || H) - (need || 0); }
  function playerBottom(need) { return Math.min(H, leftY || H) - (need || 0); }
  R.readableBottom = readableBottom;

  R.resize = function () {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    measureChrome();
    layout();
  };

  /* ---- battlefield layout ----------------------------------------------
   * FIGURE SIZE IS TIED TO THE BAND THE FIGURES HAVE TO FIT IN, not to
   * min(W, H). That old basis picked WIDTH in portrait and HEIGHT in landscape,
   * so the same character was drawn at 45px on a phone and 67.5px turned
   * sideways — 50% bigger, for no reason anyone chose. Measured, both ways.
   *
   * Taking the smaller of "a fraction of the width" and "a fraction of the
   * usable vertical band" means the figures shrink when either axis is tight and
   * never overrun the ground they stand on.
   * -------------------------------------------------------------------- */
  /* The reserves are PROPORTIONAL with a cap, not flat pixels. 96 above and 170
   * below are the HUD and the hand on a tall phone — but held flat they eat
   * 266px of a 390px landscape screen, 68% of it, leaving the fight a 124px
   * band to stand in. That was true before any of this and the old figure scale
   * simply overflowed it rather than fitting. */
  function fieldTop() { return Math.min(96, H * 0.14); }
  function fieldBottom() { return H - Math.min(170, H * 0.28); }
  function fieldBand() { return fieldBottom() - fieldTop(); }
  // 1.8, not 1.5: landscape is the orientation this is played in, and at 1.5 the
  // band term bound so hard there that the figures used a quarter of the ground
  // they had. Portrait and desktop are width-bound and unaffected.
  function figScale(k) { return Math.min(W * k, fieldBand() * k * 1.8); }
  /* The line the fight stands on sits LOW, at 0.72 of the band rather than 0.52.
   * At 0.52 everything piled into the upper half and 42% of the battlefield
   * below the figures was empty grid — measured on three viewports. That dead
   * space was the reason the chain receipt had nowhere to live except on top of
   * the fight. Dropping the line fills it and frees the top for the readouts. */
  function baseY() { return fieldTop() + fieldBand() * 0.72; }

  // where summoned minions fan out relative to their spawner (mult of spawner
  // radius): leads with straight up / straight down, then around — so adds feel
  // like they boil up around the mob instead of trailing in a conga line.
  var MINION_SLOTS = [[0.2, -1.55], [0.2, 1.55], [1.15, -1.05], [1.15, 1.05], [1.4, 0], [-0.7, -1.25], [-0.7, 1.25], [2.0, -0.6], [2.0, 0.6]];
  function layout() {
    var n = R.views.length;
    if (!n) return;
    var y = baseY() - 14;
    // split into base enemies (laid out on the line) and summoned minions
    // (clustered around whoever spawned them)
    var base = [], minions = [];
    for (var i = 0; i < n; i++) {
      var v = R.views[i];
      if (v.anchorFrom != null && v.anchorFrom >= 0 && R.views[v.anchorFrom]) minions.push(v);
      else base.push(v);
    }
    // base line: 1-3 keep their hand-tuned spots; 4-5 spread evenly so none
    // lands off the right edge (the old 0.38+i*0.235 pushed them past x=W).
    var bn = base.length;
    var bshrink = bn >= 5 ? 0.64 : bn === 4 ? 0.74 : bn === 3 ? 0.82 : 1;
    for (var b = 0; b < bn; b++) {
      var bv = base[b], fx;
      if (bn === 1) fx = 0.64;
      else if (bn === 2) fx = 0.48 + b * 0.30;
      else if (bn === 3) fx = 0.38 + b * 0.235;
      else fx = 0.34 + (0.93 - 0.34) * (b / (bn - 1));
      bv.x = W * fx;
      bv.y = y;
      // A boss reads as a different KIND of thing before it reads as a bigger
      // number, so it gets a third again the silhouette on top of its own size.
      bv.r = figScale(0.092) * (bv.def.size || 1) * (bv.def.boss ? 1.32 : 1) * bshrink;
    }
    // minions: fan around their spawner with vertical offset, clamped on-field
    var per = {};
    for (var mi = 0; mi < minions.length; mi++) {
      var mv = minions[mi], sp = R.views[mv.anchorFrom];
      var k = per[mv.anchorFrom] || 0; per[mv.anchorFrom] = k + 1;
      var slot = MINION_SLOTS[k % MINION_SLOTS.length];
      var rr = figScale(0.092) * (mv.def.size || 1) * 0.7;
      mv.r = rr;
      mv.x = Math.max(rr + 4, Math.min(W - rr - 4, sp.x + sp.r * slot[0] + rr * 0.3));
      mv.y = Math.max(fieldTop() + rr, Math.min(fieldBottom() - rr, sp.y + sp.r * slot[1]));
    }
  }

  R.playerXY = function () { return { x: W * 0.15, y: baseY() + 14 }; };

  /* ---- view-state management ------------------------------------------- */
  R.syncCombat = function () {
    var c = ns.engine.combat;
    if (!c) { R.views = []; R.combatVisible = false; return; }
    R.combatVisible = true;
    // the hand and the belt are display:none outside a fight, so a resize taken
    // on the map measured them as zero — re-read once the chrome is actually up
    measureChrome();
    R.views = c.enemies.map(function (en, i) {
      var old = R.views[i];
      var same = old && old.en === en;
      return {
        def: en.def, en: en,
        hp: en.hp, maxHp: en.maxHp, dispHp: same ? old.dispHp : en.hp,
        block: en.block,
        alive: en.alive,
        deathT: same ? old.deathT : -1,
        spawnT: same ? old.spawnT : t,         // warp-in animation
        spawned: same ? old.spawned : false,
        flashT: -9, shakeT: -9, lungeT: -9, actT: -9, actEnv: null,
        intent: en.intent,
        anchorFrom: en.summonedBy != null ? en.summonedBy : -1,
        x: 0, y: 0, r: 10,
      };
    });
    layout();
    var r = ns.engine.run;
    R.player.hp = r.hp; R.player.maxHp = r.maxHp;
    R.player.block = c.player.block;
  };

  // append a view for a summoned enemy (mid-combat) and re-layout, keeping the
  // existing views' animation state intact
  R.addEnemyView = function (en) {
    R.views.push({
      def: en.def, en: en, hp: en.hp, maxHp: en.maxHp, dispHp: en.hp,
      block: en.block, alive: en.alive, deathT: -1, spawnT: t, spawned: false,
      flashT: -9, shakeT: -9, lungeT: -9, actT: -9, actEnv: null, intent: en.intent,
      anchorFrom: en.summonedBy != null ? en.summonedBy : -1,
      x: 0, y: 0, r: 10,
    });
    layout();
  };

  // staggered updates from the action timeline
  R.setEnemyView = function (idx, hp, block, alive) {
    var v = R.views[idx];
    if (!v) return;
    v.hp = hp;
    if (block !== null && block !== undefined) v.block = block;
    if (alive === false && v.alive) { v.alive = false; v.deathT = t; deathBurst(v); }
  };
  R.setPlayerView = function (hp, block) {
    if (hp !== null && hp !== undefined) R.player.hp = hp;
    if (block !== null && block !== undefined) R.player.block = block;
  };
  R.refreshIntents = function () {
    R.views.forEach(function (v) { v.intent = v.en.intent; });
  };

  R.hitEnemy = function (idx) {
    var v = R.views[idx];
    if (!v) return;
    v.flashT = t; v.shakeT = t;
    burst(v.x, v.y, factionColor(v.def), 10);
  };
  R.hitPlayer = function () {
    R.player.flashT = t;
    screenShake = 1;
    var p = R.playerXY();
    burst(p.x, p.y, '#ff4a5e', 12);
  };
  R.playerLunge = function () { R.player.lungeT = t; };
  // Short card-play animation, keyed by card type: 'attack' | 'defend' | 'utility'.
  R.playerAnim = function (type, targetIdx) {
    R.player.animT = t; R.player.animType = type;
    var p = R.playerXY(), sc = figScale(0.098);
    var run = ns.engine.run, cls = run && run.cls;
    var col = ((run && CLASS_ART[cls]) || CLASS_ART.vanguard).color;
    if (type === 'attack') {
      var ti = (typeof targetIdx === 'number' && targetIdx >= 0 && R.views[targetIdx] && R.views[targetIdx].alive) ? targetIdx : null;
      if (ti == null) for (var i = 0; i < R.views.length; i++) if (R.views[i] && R.views[i].alive) { ti = i; break; }
      var ep = ti != null ? R.enemyPos(ti) : { x: p.x + sc * 4, y: p.y };
      R.player.atkTX = ep.x; R.player.atkTY = ep.y;
      // one-shot latches: muzzle flash / staff slam / shard volley each fire once
      R.player.aimFired = false; R.player.staffFired = false; R.player.shardFired = false;
    }
    if (type === 'defend') burst(p.x, p.y - sc * 0.35, col, 9);
    else if (type === 'utility') burst(p.x, p.y - sc * 0.5, col, 11);
  };
  // A transient ring drawn during a defend/utility animation.
  function drawAnimRing(px, py, sc, prog, type, col) {
    ctx.save();
    ctx.globalAlpha = (1 - prog) * 0.75;
    ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    var cy = py - sc * 0.35;
    if (type === 'defend') {                          // hexagonal ward snapping shut
      var rr = sc * (0.85 - prog * 0.32);
      ctx.beginPath();
      for (var i = 0; i < 6; i++) { var a = -Math.PI / 2 + i * Math.PI / 3, x = px + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 1.15; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.closePath(); ctx.stroke();
    } else {                                          // utility — energy ring rising off the figure
      var ry = cy - prog * sc * 0.8, rr2 = sc * (0.3 + prog * 0.7);
      ctx.beginPath(); ctx.ellipse(px, ry, rr2, rr2 * 0.32, 0, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
  // rotate a point in art-space around a pivot
  function rotPt(p, pivot, ang) { var ca = Math.cos(ang), sa = Math.sin(ang), dx = p[0] - pivot[0], dy = p[1] - pivot[1]; return [pivot[0] + dx * ca - dy * sa, pivot[1] + dx * sa + dy * ca]; }
  // stroke polylines rotated around a pivot, then translated/scaled to (px,py,sc)
  function strokeRot(paths, px, py, sc, pivot, ang, col, glow) {
    var ca = Math.cos(ang), sa = Math.sin(ang);
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.shadowColor = col; ctx.shadowBlur = glow;
    paths.forEach(function (p) {
      ctx.beginPath();
      for (var i = 0; i < p.length; i += 2) { var dx = p[i] - pivot[0], dy = p[i + 1] - pivot[1], rx = pivot[0] + dx * ca - dy * sa, ry = pivot[1] + dx * sa + dy * ca; if (i === 0) ctx.moveTo(px + rx * sc, py + ry * sc); else ctx.lineTo(px + rx * sc, py + ry * sc); }
      ctx.stroke();
    });
    ctx.restore();
  }
  // muzzle flash + bolt streaking from (mx,my) toward the card's target (tx,ty)
  function muzzleFlash(mx, my, sc, col, tx, ty) {
    var dx = (tx == null ? mx + sc : tx) - mx, dy = (ty == null ? my : ty) - my, len = Math.hypot(dx, dy) || 1, nx = dx / len, ny = dy / len, ox = -ny, oy = nx;
    ctx.save();
    ctx.lineCap = 'round';
    // hot white core with a warmer halo
    ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff2c8'; ctx.beginPath(); ctx.arc(mx, my, sc * 0.2, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(mx, my, sc * 0.1, 0, 7); ctx.fill();
    // 4-ray star flare — long down the barrel, short across
    ctx.strokeStyle = '#fff7e0'; ctx.lineWidth = 2.6; ctx.shadowBlur = 12;
    function ray(ax, ay, l) { ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + ax * sc * l, my + ay * sc * l); ctx.stroke(); }
    ray(nx, ny, 0.6); ray(-nx, -ny, 0.22); ray(ox, oy, 0.32); ray(-ox, -oy, 0.32);
    // forked muzzle petals along the barrel
    ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(mx, my); ctx.lineTo(mx + nx * sc * 0.44 + ox * sc * 0.12, my + ny * sc * 0.44 + oy * sc * 0.12);
    ctx.moveTo(mx, my); ctx.lineTo(mx + nx * sc * 0.44 - ox * sc * 0.12, my + ny * sc * 0.44 - oy * sc * 0.12);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
  }
  // Voidadept halo of shards; on attack one swells then streaks to the card target.
  /* The psyker's shard ring. At rest it orbits; on a cast the WHOLE ring
   * contracts, converges on a point in front of the raised hand, then throws
   * itself at the target. Every shard moves — the Vanguard fires one round, the
   * Voidadept spends the whole halo. */
  function drawShards(a, px, py, sc, col, glow, prog, tx, ty) {
    var cvx = 0.72, cvy = -0.62;                        // convergence point (the raised hand)
    ctx.save(); ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.shadowColor = col; ctx.shadowBlur = glow; ctx.lineWidth = 1.6;
    for (var i = 0; i < a.n; i++) {
      var spin = prog >= 0 ? t * (0.5 + prog * 7) : t * 0.5;
      var ang = spin + i / a.n * Math.PI * 2;
      var rad = a.rad, S = a.size * sc, alpha = 0.9, X, Y;
      if (prog >= 0 && prog < 0.34) {                   // contract and spool up
        var e0 = prog / 0.34;
        rad = a.rad * (1 - e0 * 0.55); S = a.size * sc * (1 + e0 * 0.7);
      } else if (prog >= 0.34 && prog < 0.52) {         // converge to the hand
        var e1 = (prog - 0.34) / 0.18;
        rad = a.rad * 0.45 * (1 - e1);
        S = a.size * sc * (1.7 + e1 * 0.9);
      } else if (prog >= 0.52) {                        // thrown
        var e2 = Math.min(1, (prog - 0.52) / 0.48);
        var hx0 = px + cvx * sc, hy0 = py + cvy * sc;
        X = hx0 + ((tx == null ? hx0 + sc * 3 : tx) - hx0) * e2;
        Y = hy0 + ((ty == null ? hy0 : ty) - hy0) * e2;
        S = a.size * sc * 2.6 * (1 - e2 * 0.6); alpha = 1 - e2 * 0.8;
      }
      if (X == null) {
        var ox0 = a.cx + Math.cos(ang) * rad, oy0 = a.cy + Math.sin(ang) * rad * 0.7;
        if (prog >= 0.34 && prog < 0.52) {              // slide the orbit centre toward the hand
          var e3 = (prog - 0.34) / 0.18;
          ox0 += (cvx - a.cx) * e3; oy0 += (cvy - a.cy) * e3;
        }
        X = px + ox0 * sc; Y = py + oy0 * sc;
      }
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.moveTo(X, Y - S * 1.5); ctx.lineTo(X + S, Y); ctx.lineTo(X, Y + S * 1.5); ctx.lineTo(X - S, Y); ctx.closePath(); ctx.stroke();
      X = null;
    }
    ctx.restore();
  }
  /* ---- Enemy act animations ------------------------------------------------
   * Every enemy used to share one sideways lunge, and only `attack`/`drain`
   * animated at all — block, buff, debuff, summon, heal, curse and disrupt were
   * visually silent, which is most of what a turn actually contains. Each move
   * type now gets its own envelope, read by drawEnemy:
   *
   *   dir  -1 lunge at the player · +1 recoil away · 0 stay put
   *   rise how far it lifts (buffs swell upward, heals settle down)
   *   sc   scale pulse (summon splits outward, block hunkers in)
   *   spin a shear/tilt (disrupt stutters, curse writhes)
   * ------------------------------------------------------------------------ */
  var ACT_ENVELOPE = {
    attack:  { dur: 0.34, dir: -1,   wind: 0.34, rise: 0.05, sc:  0.07, spin: 0 },
    drain:   { dur: 0.52, dir: -0.5, wind: 0.5, rise: -0.05, sc: -0.04, spin: 0 },
    block:   { dur: 0.40, dir:  0.25, wind: 0.3, rise: 0.06, sc: -0.10, spin: 0 },
    guard:   { dur: 0.46, dir: -0.35, wind: 0.28, rise: -0.04, sc: 0.04, spin: 0 },
    buff:    { dur: 0.50, dir:  0,   wind: 0.45, rise: -0.16, sc:  0.10, spin: 0 },
    heal:    { dur: 0.50, dir:  0,   wind: 0.5, rise:  0.05, sc: -0.06, spin: 0 },
    debuff:  { dur: 0.44, dir: -0.55, wind: 0.55, rise: -0.04, sc: 0.03, spin: 0.06 },
    curse:   { dur: 0.60, dir: -0.35, wind: 0.6, rise: -0.08, sc:  0.05, spin: 0.14 },
    summon:  { dur: 0.55, dir:  0,   wind: 0.35, rise: -0.06, sc:  0.20, spin: 0 },
    disrupt: { dur: 0.40, dir: -0.3, wind: 0.4, rise:  0,    sc:  0.04, spin: 0.22 },
    etch:    { dur: 0.60, dir: -0.3, wind: 0.6, rise: -0.05, sc:  0.04, spin: 0.10 },
    unmake:  { dur: 0.85, dir: -0.4, wind: 0.6, rise: -0.14, sc:  0.22, spin: 0.08 },
  };

  /* The envelope evaluated at progress `au` (0..1). Pure — no canvas, no view —
   * so the motion can be asserted directly instead of eyeballed in a frame.
   * `dx` is in units of the figure's radius and is negative toward the player. */
  function actPose(moveType, au) {
    var env = ACT_ENVELOPE[moveType] || ACT_ENVELOPE.attack;
    if (!(au >= 0 && au < 1)) return { dx: 0, dy: 0, scale: 1, tilt: 0, glow: 0, e: 0 };
    // wind back, then commit: negative before `wind`, full swing after
    var e = au < env.wind
      ? -Math.sin((au / env.wind) * Math.PI) * 0.3
      : Math.sin(((au - env.wind) / (1 - env.wind)) * Math.PI);
    return {
      dx: env.dir * e * 0.42,
      dy: env.rise * e,
      scale: 1 + env.sc * e,
      tilt: env.spin * e * Math.sin(au * 22),
      glow: Math.max(0, e) * 7,
      e: e,
    };
  }
  R.actPose = actPose;
  R.actMoveTypes = function () { return Object.keys(ACT_ENVELOPE); };

  R.enemyAct = function (idx, moveType) {
    var v = R.views[idx];
    if (!v) return;
    v.actT = t;
    v.actMove = ACT_ENVELOPE[moveType] ? moveType : 'attack';
    v.actEnv = ACT_ENVELOPE[v.actMove];
  };
  // kept for callers that only mean "it swung at me"
  R.enemyLunge = function (idx) { R.enemyAct(idx, 'attack'); };
  R.flash = function () { flashAlpha = 0.35; };

  R.enemyPos = function (idx) {
    var v = R.views[idx];
    return v ? { x: v.x, y: v.y } : { x: W / 2, y: H / 3 };
  };

  R.enemyAt = function (px, py) {
    for (var i = 0; i < R.views.length; i++) {
      var v = R.views[i];
      if (!v.alive) continue;
      var pad = Math.max(34, v.r * 1.4);
      if (Math.abs(px - v.x) < pad && Math.abs(py - v.y) < pad + 14) return i;
    }
    return -1;
  };

  /* ---- particles --------------------------------------------------------- */
  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140;
      spawn({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.4, age: 0, color: color, size: 1 + Math.random() * 2,
      });
    }
  }
  R.burst = burst;
  // Transporter/disintegrate sparkles: rise upward from a card-sized area and
  // twinkle out (used by the card-play dematerialise effect).
  R.beam = function (x, y, color, w, h, n) {
    for (var i = 0; i < n; i++) {
      var sp = 50 + Math.random() * 120;
      spawn({
        x: x + (Math.random() - 0.5) * w, y: y + (Math.random() - 0.5) * h,
        vx: (Math.random() - 0.5) * 50, vy: -sp,
        life: 0.5 + Math.random() * 0.6, age: 0, color: color, size: 0.7 + Math.random() * 1.6,
      });
    }
  };
  // Void-implosion sparkles: spawn around a card-sized area and rush inward to
  // the centre (used by the Void Adept card-play effect).
  R.implode = function (x, y, color, w, h, n) {
    for (var i = 0; i < n; i++) {
      var px = x + (Math.random() - 0.5) * w, py = y + (Math.random() - 0.5) * h;
      var dx = x - px, dy = y - py, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = 110 + Math.random() * 130;
      spawn({
        x: px, y: py, vx: dx / d * sp, vy: dy / d * sp,
        life: 0.32 + Math.random() * 0.34, age: 0, color: color, size: 0.8 + Math.random() * 1.7,
      });
    }
  };
  function deathBurst(v) {
    burst(v.x, v.y, factionColor(v.def), 26);
    burst(v.x, v.y, '#ffffff', 8);
  }

  /* ---- card-cast vector FX (8-bit, space/old-school) --------------------- */
  // A directed tracer/projectile from (x0,y0) to a target — vector streak +
  // trailing sparks. Reaches the target in ~0.13s for snappy attack feel.
  R.shot = function (x0, y0, x1, y1, color) {
    var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy) || 1;
    var sp = Math.max(440, d / 0.13);
    spawn({ kind: 'streak', x: x0, y: y0, vx: dx / d * sp, vy: dy / d * sp,
      len: 16, life: d / sp, age: 0, color: color, size: 2 });
    for (var i = 0; i < 4; i++) spawn({
      x: x0 + (Math.random() - 0.5) * 6, y: y0 + (Math.random() - 0.5) * 6,
      vx: dx / d * sp * 0.45 * (0.6 + Math.random() * 0.6), vy: dy / d * sp * 0.45 * (0.6 + Math.random() * 0.6),
      life: 0.16 + Math.random() * 0.14, age: 0, color: color, size: 1 + Math.random() });
  };
  // Expanding vector shockwave ring (AoE / impacts / shield bloom).
  R.ring = function (x, y, color, maxR, life) {
    spawn({ kind: 'ring', x: x, y: y, r0: 5, r1: maxR || 60, life: life || 0.42, age: 0, color: color, lw: 2 });
  };
  // Lobbed ordnance: a shell that arcs from (x0,y0) to (x1,y1) under gravity and
  // lands after `time` seconds — solve the ballistic so it hits exactly on time.
  R.lob = function (x0, y0, x1, y1, color, time) {
    var T = time || 0.3, g = 1500;
    spawn({ kind: 'streak', x: x0, y: y0,
      vx: (x1 - x0) / T, vy: (y1 - y0) / T - 0.5 * g * T, grav: g,
      len: 9, life: T, age: 0, color: color, size: 2.4 });
    for (var i = 0; i < 5; i++) spawn({   // smoke puffs off the arc
      x: x0, y: y0, vx: (x1 - x0) / T * (0.2 + Math.random() * 0.5), vy: -(30 + Math.random() * 50),
      life: 0.2 + Math.random() * 0.3, age: 0, color: color, size: 1 + Math.random() });
  };
  // Heavy impact: a hard double shockwave, thrown debris and a kick of shake.
  // `power` 0..4 scales how much the hit is felt.
  R.quake = function (x, y, color, power) {
    var p = Math.max(0, Math.min(4, power || 0));
    R.ring(x, y, '#ffffff', 16 + p * 8, 0.16);
    R.ring(x, y, color, 30 + p * 16, 0.34 + p * 0.05);
    for (var i = 0; i < 4 + p * 3; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5, sp = 90 + Math.random() * (120 + p * 60);
      spawn({ kind: 'streak', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 620,
        len: 5 + p, life: 0.28 + Math.random() * 0.3, age: 0, color: color, size: 1.4 + p * 0.3 });
    }
    if (p >= 1) R.shake(0.2 + p * 0.13);
  };
  // Upward flickering embers (Burn / fire). Floats up and slows.
  R.embers = function (x, y, color, n) {
    for (var i = 0; i < (n || 12); i++) spawn({
      x: x + (Math.random() - 0.5) * 22, y: y + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 30, vy: -(50 + Math.random() * 95), grav: -55,
      life: 0.4 + Math.random() * 0.55, age: 0, color: Math.random() < 0.4 ? '#ffd23d' : color, size: 1 + Math.random() * 2 });
  };
  // Buff/power aura: a ring pulse + rising sparks in the class colour.
  R.aura = function (x, y, color) {
    R.ring(x, y, color, 46, 0.5);
    for (var i = 0; i < 14; i++) spawn({
      x: x + (Math.random() - 0.5) * 34, y: y + (Math.random() - 0.5) * 42,
      vx: (Math.random() - 0.5) * 22, vy: -(38 + Math.random() * 70),
      life: 0.5 + Math.random() * 0.5, age: 0, color: color, size: 1 + Math.random() * 1.8 });
  };
  // Debuff/hex: horizontal glitch shards that streak sideways then vanish.
  R.glitch = function (x, y, color) {
    for (var i = 0; i < 10; i++) spawn({ kind: 'streak',
      x: x + (Math.random() - 0.5) * 28, y: y + (Math.random() - 0.5) * 34,
      vx: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 130), vy: 0,
      len: 6 + Math.random() * 10, life: 0.16 + Math.random() * 0.22, age: 0, color: color, size: 1.6 });
  };
  // A ring that can be a rotating regular polygon (sides>=3) and grow/shrink
  // its radius from rFrom to rTo over its life. The shape vocabulary for
  // shields, sigils and shockwaves.
  R.polyRing = function (x, y, color, rFrom, rTo, sides, life, spin, lw) {
    spawn({ kind: 'ring', x: x, y: y, r0: rFrom, r1: rTo, sides: sides || 0,
      rot0: Math.random() * Math.PI, spin: spin || 0, life: life || 0.5, age: 0, color: color, lw: lw || 2 });
  };
  // Jagged lightning between two points (chain/arc/tesla attacks).
  R.arc = function (x0, y0, x1, y1, color, segs, jitter) {
    segs = segs || 7; jitter = jitter || 11;
    var pts = [];
    for (var s = 0; s <= segs; s++) {
      var t = s / segs, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (s > 0 && s < segs) { x += (Math.random() - 0.5) * jitter * 2; y += (Math.random() - 0.5) * jitter * 2; }
      pts.push([x, y]);
    }
    spawn({ kind: 'bolt', pts: pts, life: 0.18, age: 0, color: color, lw: 2.2 });
    spawn({ kind: 'bolt', pts: pts, life: 0.1, age: 0, color: '#ffffff', lw: 1 });
  };
  // Thick piercing beam (railgun / lance), bright core, quick decay.
  R.beamBolt = function (x0, y0, x1, y1, color, width) {
    spawn({ kind: 'beam', x0: x0, y0: y0, x1: x1, y1: y1, life: 0.24, age: 0, color: color, w: width || 5 });
    spawn({ kind: 'beam', x0: x0, y0: y0, x1: x1, y1: y1, life: 0.15, age: 0, color: '#ffffff', w: (width || 5) * 0.4 });
  };
  // Orbital strike: a streak that falls from above onto a target + impact ring.
  R.strike = function (x, y, color, power) {
    spawn({ kind: 'streak', x: x, y: -12, vx: 0, vy: (y + 12) / 0.16, len: 28 + power * 8, life: 0.16, age: 0, color: color, size: 2.5 + power });
    R.ring(x, y, color, 34 + power * 12, 0.45);
    burst(x, y, color, 8 + power * 3);
  };
  // Directional pellet spread (frag / cluster / shotgun) with gravity drop.
  R.shards = function (x, y, color, n, dir, spread) {
    for (var i = 0; i < n; i++) {
      var ang = dir + (Math.random() - 0.5) * (spread || 1.0), sp = 150 + Math.random() * 170;
      spawn({ kind: 'streak', x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, grav: 130,
        len: 7, life: 0.3 + Math.random() * 0.25, age: 0, color: color, size: 1.5 });
    }
  };
  // Tangential blades whirling around a centre (Whirlwind).
  R.spiral = function (x, y, color, n, r) {
    r = r || 30;
    for (var i = 0; i < n; i++) {
      var ang = i / n * Math.PI * 2, px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r, sp = 210;
      spawn({ kind: 'streak', x: px, y: py, vx: -Math.sin(ang) * sp, vy: Math.cos(ang) * sp, len: 15, life: 0.28, age: 0, color: color, size: 2 });
    }
  };
  // Rotating warding sigil — counter-spinning polygons + orbiting motes (PSI).
  R.sigil = function (x, y, color, r) {
    r = r || 32;
    R.polyRing(x, y, color, r, r, 6, 0.6, 4, 2);
    R.polyRing(x, y, color, r * 0.62, r * 0.62, 3, 0.6, -5.5, 1.6);
    for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; spawn({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: -Math.sin(a) * 38, vy: Math.cos(a) * 38, life: 0.5, age: 0, color: color, size: 1.6 }); }
  };
  // Big multi-ring detonation (AoE bombs / capstones). Scales with power.
  R.nova = function (x, y, color, power) {
    R.ring(x, y, '#ffffff', 18 + power * 10, 0.24);
    R.ring(x, y, color, 48 + power * 20, 0.5);
    R.ring(x, y, color, 78 + power * 30, 0.68);
    burst(x, y, color, 16 + power * 8); burst(x, y, '#ffffff', 6 + power * 3);
  };
  R.shake = function (v) { screenShake = Math.max(screenShake, v || 0.6); };
  // Total particles ever spawned. A card cast that silently draws NOTHING (a
  // helper called with the wrong arity, say) is invisible in play AND invisible
  // to a smoke test that only checks for throws — this is what makes it
  // assertable. Test-facing only; nothing in the game reads it.
  R.fxSpawns = function () { return fxSpawns; };
  // Targeting scan: a reticle bracket + a scan-line sweeping down the target.
  R.scan = function (x, y, color) {
    R.polyRing(x, y, color, 26, 26, 4, 0.55, 0, 1.6);
    spawn({ kind: 'scanline', x: x, y0: y - 17, y1: y + 17, w: 36, life: 0.5, age: 0, color: color });
  };

  /* ---- class shields (one per archetype) --------------------------------- */
  // Vanguard: heavy plated barrier — a tilted square plate snaps inward.
  R.shieldVan = function (x, y, col) {
    R.polyRing(x, y, col, 56, 30, 4, 0.42, 0.6, 4);
    R.polyRing(x, y, '#fff3d6', 42, 24, 4, 0.3, 0.6, 2);
    burst(x, y, col, 9);
  };
  // Technomancer: hexagonal energy field — two counter-rotating hexes shimmer.
  R.shieldTech = function (x, y, col) {
    R.polyRing(x, y, col, 22, 46, 6, 0.5, 3, 2);
    R.polyRing(x, y, '#bff6ff', 18, 40, 6, 0.46, -4, 1.5);
    for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; spawn({ x: x + Math.cos(a) * 44, y: y + Math.sin(a) * 44, vx: 0, vy: 0, life: 0.42, age: 0, color: col, size: 1.6 }); }
  };
  // Void Adept: warding sigil ward — spinning glyphs of containment.
  R.shieldVoid = function (x, y, col) {
    R.sigil(x, y, col, 40);
    R.polyRing(x, y, '#f0d6ff', 48, 30, 3, 0.4, 6, 1.5);
  };

  function factionColor(def) {
    if (def.color) return def.color;   // faction-less bosses (the finale) carry their own colour
    var f = ns.FACTIONS[def.faction];
    return f ? f.color : '#5dff88';
  }

  /* ---- main frame --------------------------------------------------------- */
  R.frame = function (dt) {
    if (!ctx) return;
    if (R.combatVisible) measureChrome();
    t += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#04080a';
    ctx.fillRect(0, 0, W, H);

    var shx = 0, shy = 0;
    if (screenShake > 0.01) {
      var m = ns.BALANCE.feel.shakeMag * screenShake;
      shx = (Math.random() - 0.5) * m; shy = (Math.random() - 0.5) * m;
      screenShake *= Math.pow(0.0008, dt);
    }
    ctx.translate(shx, shy);

    drawBackground(dt);

    if (R.combatVisible) {
      R.hotIcons.length = 0;   // rebuilt each frame: hover hit-boxes for status/trait icons
      drawPlayer();
      for (var i = 0; i < R.views.length; i++) drawEnemy(R.views[i], i);
    }

    drawParticles(dt);

    if (R.combatVisible && R.aim.on) drawAimReticle();

    if (flashAlpha > 0.01) {
      ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha.toFixed(3) + ')';
      ctx.fillRect(-20, -20, W + 40, H + 40);
      flashAlpha *= Math.pow(0.001, dt);
    }
  };

  /* ---- background scenes -------------------------------------------------- */
  // One scene per faction territory (plus a neutral menu scene). Static
  // elements are generated once per faction so nothing flickers.
  var scene = null, sceneKey = null;

  var THEME = {
    menu:      { rgb: '93,255,136',  grid: 'rgba(93, 255, 136, 0.10)' },
    hierarchy: { rgb: '200,107,255', grid: 'rgba(200, 107, 255, 0.09)' },
    rust:      { rgb: '255,150,40',  grid: 'rgba(255, 150, 40, 0.09)' },
    voidspawn: { rgb: '93,255,136',  grid: 'rgba(93, 255, 136, 0.10)' },
  };

  function ensureScene() {
    var k = (ns.engine.run && ns.engine.run.faction) ? ns.engine.run.faction : 'menu';
    if (k === sceneKey && scene) return;
    sceneKey = k;
    scene = buildScene(k);
  }

  function buildScene(k) {
    var s = { kind: k, theme: THEME[k] || THEME.menu, nebula: [], ships: [], towers: [], lights: [], spores: [], tendrils: [] };
    var i;
    for (i = 0; i < 4; i++) {
      s.nebula.push({ x: Math.random(), y: Math.random() * 0.45, r: 0.22 + Math.random() * 0.3, a: 0.05 + Math.random() * 0.06 });
    }
    if (k === 'hierarchy' || k === 'menu') {
      for (i = 0; i < 3; i++) {
        s.ships.push({ x: Math.random(), y: 0.08 + Math.random() * 0.22, v: 0.002 + Math.random() * 0.004, s: 0.5 + Math.random() * 0.8, dir: Math.random() < 0.5 ? -1 : 1 });
      }
    }
    if (k === 'rust') {
      var x = 0;
      while (x < 1.05) {
        var w = 0.04 + Math.random() * 0.08;
        var h = 0.03 + Math.random() * 0.10;
        var chimney = Math.random() < 0.45;
        s.towers.push({ x: x, w: w, h: h, c: chimney });
        if (Math.random() < 0.6) s.lights.push({ x: x + w * Math.random(), y: h * (0.3 + Math.random() * 0.6), ph: Math.random() * 6, sp: 1 + Math.random() * 2 });
        x += w + 0.01 + Math.random() * 0.04;
      }
    }
    if (k === 'voidspawn') {
      for (i = 0; i < 14; i++) {
        s.spores.push({ x: Math.random(), y: Math.random(), v: 0.004 + Math.random() * 0.008, ph: Math.random() * 6, r: 1 + Math.random() * 2 });
      }
      for (i = 0; i < 4; i++) {
        s.tendrils.push({ x: 0.06 + Math.random() * 0.88, len: 0.10 + Math.random() * 0.14, ph: Math.random() * 6, seg: 4 + Math.floor(Math.random() * 3) });
      }
      s.rift = { x: 0.62 + Math.random() * 0.2, pts: [] };
      var rx = 0;
      for (i = 0; i <= 6; i++) s.rift.pts.push([(Math.random() - 0.5) * 0.10, 0.06 + i * 0.045]);
    }
    return s;
  }

  function drawBackground(dt) {
    ensureScene();
    var th = scene.theme;

    // nebula blobs
    scene.nebula.forEach(function (n) {
      var nx = n.x * W, ny = n.y * H, nr = n.r * Math.min(W, H) * 1.3;
      var g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      g.addColorStop(0, 'rgba(' + th.rgb + ',' + n.a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + th.rgb + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
    });

    if (scene.kind === 'hierarchy' || scene.kind === 'menu') drawHierarchySky(dt);
    if (scene.kind === 'rust') drawRustSky();
    if (scene.kind === 'voidspawn') drawVoidSky();

    // stars
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.y += dt * 0.006 * s.z;
      if (s.y > 1) { s.y -= 1; s.x = Math.random(); }
      var a = 0.25 + 0.5 * s.z * (0.6 + 0.4 * Math.sin(t * 2 + s.tw));
      ctx.fillStyle = 'rgba(150, 210, 190, ' + a.toFixed(3) + ')';
      var sz = s.z > 0.75 ? 1.6 : 1;
      ctx.fillRect(s.x * W, s.y * H, sz, sz);
    }

    if (scene.kind === 'rust') drawRustSkyline();

    // perspective grid floor under the battlefield
    var gy = baseY() + Math.min(W, H) * 0.13;
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gy); ctx.lineTo(W, gy);
    for (var g2 = 1; g2 <= 4; g2++) {
      var yy = gy + g2 * g2 * 9;
      if (yy > H) break;
      ctx.moveTo(0, yy); ctx.lineTo(W, yy);
    }
    var cx = W * 0.5;
    for (var vx = -6; vx <= 6; vx++) {
      ctx.moveTo(cx + vx * W * 0.09, gy);
      ctx.lineTo(cx + vx * W * 0.30, Math.min(H, gy + 160));
    }
    ctx.stroke();
  }

  /* Hierarchy / menu: ringed gas giant, a vast orbital ring, drifting warships */
  function drawHierarchySky(dt) {
    var th = scene.theme;
    var px = W * 0.80, py = H * 0.15, pr = W * 0.26;
    // planet disc
    var g = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr);
    g.addColorStop(0, 'rgba(' + th.rgb + ',0.16)');
    g.addColorStop(1, 'rgba(' + th.rgb + ',0.02)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(' + th.rgb + ',0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.stroke();
    // cloud bands
    ctx.strokeStyle = 'rgba(' + th.rgb + ',0.18)';
    ctx.beginPath();
    ctx.arc(px, py, pr * 0.72, 2.5, 3.9);
    ctx.moveTo(px + pr * 0.5, py + pr * 0.35);
    ctx.arc(px, py, pr * 0.6, 0.5, 1.3);
    ctx.stroke();
    // planet ring
    ctx.strokeStyle = 'rgba(' + th.rgb + ',0.30)';
    ctx.beginPath(); ctx.ellipse(px, py, pr * 1.5, pr * 0.34, -0.28, 3.0, 6.55); ctx.stroke();
    // the great orbital ring spanning the sky (our Halo)
    ctx.strokeStyle = 'rgba(' + th.rgb + ',0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(W / 2, H * 2.7, H * 2.52, -Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H * 2.7, H * 2.52 + 7, -Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4); ctx.stroke();
    // ring struts
    ctx.strokeStyle = 'rgba(' + th.rgb + ',0.14)';
    for (var k = -3; k <= 3; k++) {
      var a = -Math.PI / 2 + k * 0.11;
      var x1 = W / 2 + Math.cos(a) * H * 2.52, y1 = H * 2.7 + Math.sin(a) * H * 2.52;
      var x2 = W / 2 + Math.cos(a) * (H * 2.52 + 7), y2 = H * 2.7 + Math.sin(a) * (H * 2.52 + 7);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // drifting warships (angular silhouettes)
    ctx.strokeStyle = 'rgba(' + th.rgb + ',0.40)';
    ctx.lineWidth = 1;
    scene.ships.forEach(function (sh) {
      sh.x += sh.v * sh.dir * dt;
      if (sh.x > 1.15) sh.x = -0.15;
      if (sh.x < -0.15) sh.x = 1.15;
      var sx = sh.x * W, sy = sh.y * H, sc = 14 * sh.s, d = sh.dir;
      ctx.beginPath();
      ctx.moveTo(sx - sc * d, sy);
      ctx.lineTo(sx + sc * 0.4 * d, sy - sc * 0.28);
      ctx.lineTo(sx + sc * d, sy - sc * 0.05);
      ctx.lineTo(sx + sc * 0.5 * d, sy + sc * 0.22);
      ctx.closePath();
      ctx.stroke();
    });
  }

  /* Rust: dim red sun with occlusion slats, smog bands, industrial skyline */
  function drawRustSky() {
    var sx = W * 0.24, sy = H * 0.17, sr = W * 0.13;
    var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.4);
    g.addColorStop(0, 'rgba(255, 90, 40, 0.30)');
    g.addColorStop(0.45, 'rgba(255, 120, 40, 0.10)');
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - sr * 2.4, sy - sr * 2.4, sr * 4.8, sr * 4.8);
    ctx.fillStyle = 'rgba(255, 96, 40, 0.32)';
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
    // retro occlusion slats
    ctx.fillStyle = '#04080a';
    for (var i = 0; i < 4; i++) {
      var yy = sy + sr * (0.1 + i * 0.24);
      ctx.fillRect(sx - sr - 4, yy, sr * 2 + 8, 2 + i * 1.5);
    }
    // smog bands
    ctx.fillStyle = 'rgba(255, 140, 60, 0.045)';
    ctx.fillRect(0, H * 0.25, W, H * 0.035);
    ctx.fillRect(0, H * 0.33, W, H * 0.02);
  }

  function drawRustSkyline() {
    var gy = baseY() + Math.min(W, H) * 0.13;
    ctx.fillStyle = 'rgba(4, 8, 10, 0.9)';
    ctx.strokeStyle = 'rgba(255, 150, 40, 0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    scene.towers.forEach(function (tw) {
      var x0 = tw.x * W, x1 = (tw.x + tw.w) * W, hh = tw.h * H;
      ctx.lineTo(x0, gy);
      ctx.lineTo(x0, gy - hh);
      if (tw.c) {
        var cx0 = x0 + (x1 - x0) * 0.3, cx1 = x0 + (x1 - x0) * 0.55;
        ctx.lineTo(cx0, gy - hh); ctx.lineTo(cx0, gy - hh - 10);
        ctx.lineTo(cx1, gy - hh - 10); ctx.lineTo(cx1, gy - hh);
      }
      ctx.lineTo(x1, gy - hh);
      ctx.lineTo(x1, gy);
    });
    ctx.lineTo(W, gy);
    ctx.fill();
    ctx.stroke();
    // blinking hazard lights
    scene.lights.forEach(function (l) {
      var a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * l.sp + l.ph));
      ctx.fillStyle = 'rgba(255, 150, 40, ' + a.toFixed(3) + ')';
      ctx.fillRect(l.x * W - 1, gy - l.y * H - 1, 2, 2);
    });
  }

  /* Voidspawn: a torn rift in space, hanging tendrils, drifting spores */
  function drawVoidSky() {
    var gy = baseY();
    // the rift
    var rx = scene.rift.x * W;
    var pulse = 0.5 + 0.35 * Math.sin(t * 1.3);
    ctx.save();
    ctx.strokeStyle = 'rgba(93, 255, 136, ' + (0.30 + 0.25 * pulse).toFixed(3) + ')';
    ctx.shadowColor = '#5dff88';
    ctx.shadowBlur = 12 * pulse + 4;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    scene.rift.pts.forEach(function (p, i) {
      var x = rx + p[0] * W, y = p[1] * H;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(230, 255, 240, ' + (0.25 + 0.3 * pulse).toFixed(3) + ')';
    ctx.stroke();
    ctx.restore();

    // hanging tendrils, swaying
    ctx.strokeStyle = 'rgba(93, 255, 136, 0.22)';
    ctx.lineWidth = 1.2;
    scene.tendrils.forEach(function (td) {
      var x = td.x * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (var i = 1; i <= td.seg; i++) {
        var p = i / td.seg;
        ctx.lineTo(x + Math.sin(t * 0.8 + td.ph + p * 3) * 8 * p, td.len * H * p);
      }
      ctx.stroke();
    });

    // drifting spores
    scene.spores.forEach(function (sp) {
      sp.y -= sp.v * 0.016;
      if (sp.y < -0.02) { sp.y = 1.02; sp.x = Math.random(); }
      var a = 0.10 + 0.14 * (0.5 + 0.5 * Math.sin(t * 1.5 + sp.ph));
      ctx.fillStyle = 'rgba(93, 255, 136, ' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(sp.x * W + Math.sin(t + sp.ph) * 6, sp.y * Math.min(gy + 60, H), sp.r, 0, 7);
      ctx.fill();
    });
  }

  /* ---- entity drawing -------------------------------------------------------- */
  // A toothed gear ring, built once at load. The Forge Choir's cog-halo is the
  // Technomancer's single most recognisable shape, so it is generated rather
  // than hand-typed — 12 teeth is 96 numbers nobody should maintain by hand.
  function cogPath(cx, cy, rOut, rIn, teeth) {
    var p = [], step = Math.PI * 2 / teeth;
    for (var i = 0; i < teeth; i++) {
      var a0 = i * step;
      p.push(cx + Math.cos(a0) * rIn, cy + Math.sin(a0) * rIn);
      p.push(cx + Math.cos(a0 + step * 0.24) * rOut, cy + Math.sin(a0 + step * 0.24) * rOut);
      p.push(cx + Math.cos(a0 + step * 0.50) * rOut, cy + Math.sin(a0 + step * 0.50) * rOut);
      p.push(cx + Math.cos(a0 + step * 0.74) * rIn, cy + Math.sin(a0 + step * 0.74) * rIn);
    }
    p.push(p[0], p[1]);
    return p;
  }

  /* Stroke polylines whose TIPS drift while their roots stay pinned. One
   * primitive covers both signature idles: a Magos's mechadendrites coiling in
   * the air, and a psyker's hem fraying into the warp. Displacement ramps as
   * the square of the distance along the run, so the anchor barely moves and
   * the far end really travels — that is what sells "attached to something"
   * rather than "the whole shape is wobbling".
   * `flare` pushes every point outward from the body on a cast. */
  function strokeLive(paths, px, py, sc, col, glow, o) {
    o = o || {};
    var amp = o.amp || 0.03, speed = o.speed || 1.2, ph0 = o.phase || 0, flare = o.flare || 0;
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = o.lw || 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = glow; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    paths.forEach(function (p, k) {
      var n = Math.max(1, p.length / 2 - 1), tipX = null, tipY = null;
      ctx.beginPath();
      for (var i = 0; i < p.length; i += 2) {
        var f = (i / 2) / n, w = f * f;
        var ph = ph0 + k * 1.73 + f * 2.4;
        var X = p[i]     + Math.sin(t * speed + ph) * amp * w + (p[i] < 0 ? -flare : flare) * w;
        var Y = p[i + 1] + Math.cos(t * speed * 0.77 + ph) * amp * 0.6 * w + flare * 0.25 * w;
        if (i === 0) ctx.moveTo(px + X * sc, py + Y * sc); else ctx.lineTo(px + X * sc, py + Y * sc);
        if (i === p.length - 2) { tipX = px + X * sc; tipY = py + Y * sc; }
      }
      ctx.stroke();
      if (o.tip && tipX != null) {                  // a manipulator claw at the end
        var g = sc * 0.035;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY - g * 1.6); ctx.lineTo(tipX + g, tipY); ctx.lineTo(tipX, tipY + g * 1.6); ctx.lineTo(tipX - g, tipY);
        ctx.closePath(); ctx.stroke();
      }
    });
    ctx.restore();
  }

  function strokePaths(paths, x, y, scale, color, glow, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6 / scale;
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    paths.forEach(function (p) {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      ctx.stroke();
    });
    ctx.restore();
  }

  /* ANIMATED ART. An art block is normally one shape — { p, e } — but it may
   * instead carry { fps, frames: [ {p,e}, ... ] }, in which case the frames
   * play on a loop off the shared clock. Everything downstream keeps reading a
   * plain { p, e }, so nothing else in the renderer has to know.
   *
   * Off the shared clock and not a per-figure timer on purpose: two of the
   * same enemy should breathe together, the way the existing idle bob does. */
  function artFrame(art) {
    if (!art || !art.frames || !art.frames.length) return art;
    var fps = art.fps || 8;
    return art.frames[Math.floor(t * fps) % art.frames.length] || art.frames[0];
  }
  ns.artFrame = artFrame;

  // ---- readable status / shield rendering (Slay-the-Spire-ish) ----
  var STATUS_COLORS = {
    vuln: '#ff8a3a', weak: '#c86bff', burn: '#ff5a2a', str: '#5dff88',
    regen: '#56ff9c', plate: '#41d8ff', platedArmor: '#41d8ff', thorns: '#9bb0a6',
    aim: '#ffb02e',
  };
  var STATUS_ABBR = { vuln: 'VULN', weak: 'WEAK', burn: 'BURN', str: 'STR', aim: 'AIM' };

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBlockBadge(cx, cy, val) {
    var r = 11;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.85);
    ctx.lineTo(cx + r, cy - r * 0.85);
    ctx.lineTo(cx + r, cy + r * 0.15);
    ctx.quadraticCurveTo(cx + r, cy + r * 0.9, cx, cy + r * 1.15);
    ctx.quadraticCurveTo(cx - r, cy + r * 0.9, cx - r, cy + r * 0.15);
    ctx.closePath();
    ctx.fillStyle = 'rgba(5, 22, 30, 0.96)';
    ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#41d8ff';
    ctx.shadowColor = '#41d8ff'; ctx.shadowBlur = 6; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#cdeeff';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('' + val, cx, cy + 4);
    ctx.restore();
  }

  function drawEnemyStatuses(v, by) {
    var st = v.en.statuses;
    var keys = Object.keys(st).filter(function (k) { return st[k] > 0; });
    if (!keys.length) return;
    ctx.save();
    ctx.font = 'bold 9px ui-monospace, monospace';
    var gap = 4, pills = keys.map(function (k) {
      var abbr = STATUS_ABBR[k] || (ns.STATUS_NAMES[k] || k).slice(0, 4).toUpperCase();
      var txt = abbr + ' ' + st[k];
      return { txt: txt, w: ctx.measureText(txt).width + 11, color: STATUS_COLORS[k] || '#9bb0a6' };
    });
    var total = pills.reduce(function (a, p) { return a + p.w + gap; }, -gap);
    var x = v.x - total / 2, y = by + 22, h = 14;
    pills.forEach(function (p) {
      roundRect(x, y, p.w, h, 3);
      ctx.fillStyle = 'rgba(6, 14, 12, 0.94)'; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = p.color; ctx.stroke();
      ctx.fillStyle = p.color; ctx.textAlign = 'center';
      ctx.fillText(p.txt, x + p.w / 2, y + 10);
      x += p.w + gap;
    });
    ctx.restore();
  }

  // ---- unified Dual-Rail status display: buffs (+ powers) ABOVE the bar,
  // debuffs BELOW it, so good/bad reads by position. Powers = bright hexagon. ----
  var DEBUFF_SET = { vuln: 1, weak: 1, burn: 1, plague: 1, entropy: 1, corruption: 1, poison: 1, frail: 1 };
  var SIMPLE_BUFF = { str: 1, regen: 1, plate: 1, platedArmor: 1, thorns: 1, barricade: 1, parry: 1, strPerTurn: 1, momentum: 1, aim: 1 };
  var SGLYPH = { str: 'str', regen: 'regen', vuln: 'vuln', weak: 'weak', burn: 'burn', thorns: 'thorns', plate: 'plate', platedArmor: 'plate', barricade: 'plate', aim: 'aim' };
  function statGlyph(g, cx, cy, r, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
    var i, a, px, py;
    if (g === 'str') { ctx.moveTo(cx, cy + r); ctx.lineTo(cx, cy - r); ctx.moveTo(cx - r * 0.7, cy - r * 0.3); ctx.lineTo(cx, cy - r); ctx.lineTo(cx + r * 0.7, cy - r * 0.3); ctx.stroke(); }
    else if (g === 'regen') { ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke(); }
    else if (g === 'vuln') { ctx.moveTo(cx - r * 0.7, cy - r); ctx.lineTo(cx + r * 0.7, cy - r); ctx.lineTo(cx + r * 0.7, cy + r * 0.1); ctx.quadraticCurveTo(cx, cy + r * 1.1, cx - r * 0.7, cy + r * 0.1); ctx.closePath(); ctx.stroke(); }
    else if (g === 'weak') { ctx.moveTo(cx - r, cy - r * 0.5); ctx.lineTo(cx, cy + r * 0.5); ctx.lineTo(cx + r, cy - r * 0.5); ctx.moveTo(cx - r, cy + r * 0.1); ctx.lineTo(cx, cy + r); ctx.lineTo(cx + r, cy + r * 0.1); ctx.stroke(); }
    else if (g === 'burn') { ctx.moveTo(cx, cy + r); ctx.quadraticCurveTo(cx - r, cy + r * 0.2, cx - r * 0.3, cy - r * 0.4); ctx.quadraticCurveTo(cx, cy - r * 1.1, cx + r * 0.2, cy - r * 0.2); ctx.quadraticCurveTo(cx + r * 0.6, cy - r * 0.7, cx + r * 0.5, cy + r * 0.1); ctx.quadraticCurveTo(cx + r, cy + r * 0.4, cx, cy + r); ctx.fill(); }
    else if (g === 'thorns') { for (i = -1; i <= 1; i++) { ctx.moveTo(cx + i * r * 0.7, cy + r); ctx.lineTo(cx + i * r * 0.7, cy - r); } ctx.stroke(); }
    else if (g === 'aim') { ctx.arc(cx, cy, r * 0.72, 0, 7); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke(); }
    else if (g === 'plate') { for (i = 0; i < 6; i++) { a = Math.PI / 6 + i * Math.PI / 3; px = cx + r * Math.cos(a); py = cy + r * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); }
    else if (g === 'power') { for (i = 0; i < 6; i++) { a = Math.PI / 6 + i * Math.PI / 3; px = cx + r * Math.cos(a); py = cy + r * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  function classifyStatuses(statuses) {
    var buffs = [], debuffs = [];
    for (var k in statuses) {
      var val = statuses[k]; if (!val || val <= 0) continue;
      var deb = !!DEBUFF_SET[k];
      var power = !deb && !SIMPLE_BUFF[k];
      var col = STATUS_COLORS[k] || (deb ? '#ff6a8a' : power ? '#41d8ff' : '#7fd6ff');
      var ab = power ? ((ns.STATUS_NAMES && ns.STATUS_NAMES[k] || k).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()) : null;
      (deb ? debuffs : buffs).push({ key: k, v: val, col: col, glyph: deb ? (SGLYPH[k] || null) : (power ? 'power' : (SGLYPH[k] || null)), power: power, ab: ab });
    }
    return { buffs: buffs, debuffs: debuffs };
  }
  function drawStatusRow(cx, y, items, fp) {
    if (!items.length) return;
    ctx.save();
    ctx.font = 'bold ' + fp + 'px ui-monospace, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    var labels = items.map(function (it) { return it.power && it.ab ? (it.ab + (it.v > 1 ? it.v : '')) : ('' + it.v); });
    var step = items.map(function (it, i) { return 12 + ctx.measureText(labels[i]).width; });
    var total = step.reduce(function (a, w) { return a + w + 4; }, -4);
    var x = cx - total / 2;
    for (var i = 0; i < items.length; i++) {
      var it = items[i], ix = x + 6;
      if (it.glyph) statGlyph(it.glyph, ix, y, 5, it.col);
      else { ctx.fillStyle = it.col; ctx.beginPath(); ctx.arc(ix, y, 3.5, 0, 7); ctx.fill(); }
      ctx.fillStyle = it.col; ctx.fillText(labels[i], ix + 7, y + 0.5);
      R.hotIcons.push({ x0: x, y0: y - 8, x1: x + step[i], y1: y + 8, kind: it.power ? 'power' : 'status', key: it.key });
      x += step[i] + 4;
    }
    ctx.restore();
  }
  // topY = buff row (above bar), botY = debuff row (below bar)
  function drawStatusRails(cx, topY, botY, statuses, fp) {
    var L = classifyStatuses(statuses);
    drawStatusRow(cx, topY, L.buffs, fp);
    drawStatusRow(cx, botY, L.debuffs, fp);
  }

  // ---- Fire-Control HP bar: targeting brackets + cyan shield line + status chips ----
  var ST_AB = { vuln: 'V', weak: 'W', burn: 'B', str: 'S', aim: 'A', regen: 'R', plate: 'P', platedArmor: 'P', barricade: 'BR', thorns: 'T', parry: 'PY', momentum: 'M', poison: 'PO', plague: 'PL', entropy: 'EN', psiPow: 'Ψ', strPerTurn: 'S', feelNoPain: 'FN', afterImage: 'AI', retain: 'RT' };
  function statusChipList(st) {
    if (!st) return [];
    var out = [];
    Object.keys(st).forEach(function (k) {
      if (st[k] <= 0) return;
      out.push({ ab: ST_AB[k] || k.slice(0, 1).toUpperCase(), val: st[k], col: STATUS_COLORS[k] || '#9bb0a6' });
    });
    return out;
  }
  function fcBrackets(bx, by, bw, bh, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.2;
    var c = Math.min(6, bh * 0.9);
    var pts = [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]];
    ctx.beginPath();
    for (var i = 0; i < 4; i++) { var p = pts[i]; ctx.moveTo(p[0] + p[2] * c, p[1]); ctx.lineTo(p[0], p[1]); ctx.lineTo(p[0], p[1] + p[3] * c); }
    ctx.stroke();
  }
  function fcChips(cx, y, chips, fp) {
    ctx.font = 'bold ' + fp + 'px ui-monospace, monospace'; ctx.textBaseline = 'middle';
    var gap = 3, h = fp + 4, i;
    var ws = chips.map(function (c) { return Math.max(15, ctx.measureText(c.ab + c.val).width + 7); });
    var total = -gap; for (i = 0; i < ws.length; i++) total += ws[i] + gap;
    var x = cx - total / 2;
    for (i = 0; i < chips.length; i++) {
      var c = chips[i], w = ws[i];
      ctx.fillStyle = 'rgba(8,12,17,0.85)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = c.col; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = c.col; ctx.textAlign = 'center';
      ctx.fillText(c.ab + c.val, x + w / 2, y + h / 2 + 0.5);
      x += w + gap;
    }
  }
  // cx = centre, midY = vertical centre of the bar.
  function drawHpBarFC(cx, midY, bw, h, frac, hpColr, hpTxt, shield, shMax, statuses, opt) {
    opt = opt || {};
    var bx = cx - bw / 2, by = midY - h / 2, fp = opt.font || 8.5;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fillRect(bx, by, bw, h);
    ctx.fillStyle = hpColr; ctx.shadowColor = hpColr; ctx.shadowBlur = 4;
    ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, frac)), h); ctx.shadowBlur = 0;
    fcBrackets(bx - 2, by - 2, bw + 4, h + 4, '#6f8a98');
    if (shield > 0) {
      var sw = bw * Math.max(0.05, Math.min(1, shield / Math.max(1, shMax)));
      ctx.fillStyle = '#41d8ff'; ctx.shadowColor = '#41d8ff'; ctx.shadowBlur = 5;
      ctx.fillRect(bx, by - 3.5, sw, 2.5); ctx.shadowBlur = 0;
      // small cyan hexagon + value to the right (drawn, not a font glyph)
      var hxr = fp * 0.52, hxc = bx + bw + 7 + hxr, hyc = by + h / 2;
      ctx.beginPath();
      for (var z = 0; z < 6; z++) { var az = Math.PI / 6 + z * Math.PI / 3, hx = hxc + hxr * Math.cos(az), hy = hyc + hxr * Math.sin(az); z ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy); }
      ctx.closePath(); ctx.strokeStyle = '#41d8ff'; ctx.lineWidth = 1.2; ctx.shadowColor = '#41d8ff'; ctx.shadowBlur = 4; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#9fe9ff'; ctx.font = 'bold ' + fp + 'px ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('' + shield, hxc + hxr + 3, hyc + 0.5);
    }
    ctx.font = 'bold ' + fp + 'px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f2fff6'; ctx.shadowColor = '#04140c'; ctx.shadowBlur = 3;
    ctx.fillText(hpTxt, cx, midY + 0.5); ctx.shadowBlur = 0;
    // Dual Rail: buffs (+powers) above the bar, debuffs below
    drawStatusRails(cx, by - 15, by + h + 12, statuses, opt.chipFont || 8.5);
    ctx.restore();
  }

  // ---- persistent trait badges (passive enemy mechanics shown at a glance) ----
  var TRAIT_DEFS = [
    { key: 'rampStr',    glyph: 'enrage',     col: '#ff6a4a', val: function (d) { return d.rampStr; } },
    { key: 'thorns',     glyph: 'thorns',     col: '#9bb0a6', val: function (d) { return d.thorns; } },
    { key: 'plated',     glyph: 'plate',      col: '#8fb6c8', val: function () { return null; } },
    { key: 'overload',   glyph: 'overload',   col: '#ff7a1e', val: function (d) { return d.overload; } },
    { key: 'discipline', glyph: 'discipline', col: '#ffd23d', val: function (d) { return d.discipline.dmg; } },
    { key: 'wardedBy',   glyph: 'ward',       col: '#41d8ff', val: function () { return null; } },
  ];
  function enemyTraits(def) {
    var out = [];
    TRAIT_DEFS.forEach(function (t) { if (def[t.key]) out.push({ glyph: t.glyph, col: t.col, val: t.val(def) }); });
    if (def.moves && def.moves.some(function (m) { return m.leech; })) out.push({ glyph: 'leech', col: '#ff4a5e', val: null });
    return out;
  }
  function drawTraitGlyph(g, cx, cy, r, col) {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    var i, a, px, py;
    if (g === 'enrage') {
      ctx.moveTo(cx - r, cy); ctx.lineTo(cx, cy - r * 0.7); ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx - r, cy + r * 0.8); ctx.lineTo(cx, cy + r * 0.1); ctx.lineTo(cx + r, cy + r * 0.8); ctx.stroke();
    } else if (g === 'thorns') {
      for (i = -1; i <= 1; i++) { ctx.moveTo(cx + i * r * 0.7, cy + r); ctx.lineTo(cx + i * r * 0.7, cy - r); } ctx.stroke();
      ctx.beginPath(); for (i = -1; i <= 1; i++) { ctx.moveTo(cx + i * r * 0.7 - 2.4, cy - r * 0.35); ctx.lineTo(cx + i * r * 0.7, cy - r); ctx.lineTo(cx + i * r * 0.7 + 2.4, cy - r * 0.35); } ctx.stroke();
    } else if (g === 'plate') {
      for (i = 0; i < 6; i++) { a = Math.PI / 6 + i * Math.PI / 3; px = cx + r * Math.cos(a); py = cy + r * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke();
    } else if (g === 'overload') {
      for (i = 0; i < 4; i++) { a = i * Math.PI / 2; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      for (i = 0; i < 4; i++) { a = i * Math.PI / 2 + Math.PI / 4; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55); } ctx.stroke();
    } else if (g === 'discipline') {
      ctx.lineWidth = 1.7; ctx.moveTo(cx - r * 0.45, cy - r); ctx.lineTo(cx - r * 0.45, cy + r); ctx.moveTo(cx + r * 0.45, cy - r); ctx.lineTo(cx + r * 0.45, cy + r); ctx.stroke();
    } else if (g === 'ward') {
      ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 1.3, 0, 7); ctx.fill();
    } else if (g === 'leech') {
      ctx.moveTo(cx, cy - r); ctx.quadraticCurveTo(cx + r, cy, cx, cy + r); ctx.quadraticCurveTo(cx - r, cy, cx, cy - r); ctx.stroke();
    }
  }
  function drawEnemyTraits(v, by, hasStatus) {
    var traits = enemyTraits(v.def);
    if (!traits.length) return;
    var y = by + (hasStatus ? 40 : 23);
    ctx.save();
    ctx.font = 'bold 8px ui-monospace, monospace'; ctx.textBaseline = 'middle';
    var items = traits.map(function (t) { return { t: t, w: 13 + (t.val != null ? ctx.measureText('' + t.val).width + 2 : 0) }; });
    var total = items.reduce(function (a, it) { return a + it.w + 5; }, -5);
    var x = v.x - total / 2;
    items.forEach(function (it) {
      ctx.globalAlpha = 0.92;
      drawTraitGlyph(it.t.glyph, x + 6, y, 5, it.t.col);
      if (it.t.val != null) { ctx.fillStyle = it.t.col; ctx.textAlign = 'left'; ctx.fillText('' + it.t.val, x + 13, y + 0.5); }
      R.hotIcons.push({ x0: x, y0: y - 8, x1: x + it.w, y1: y + 8, kind: 'trait', key: it.t.glyph });
      x += it.w + 5;
    });
    ctx.restore();
  }

  /* THE CROWN. Drawn UNDER the boss so it never fights the silhouette: a slow
   * counter-rotating pair of arcs and a ground shadow, and once the thing has
   * broken at half health the ring goes red, doubles up and spins harder. It is
   * the same trick the die ring uses — a shape that is obviously not part of
   * the creature, so a boss is legible as a boss at a glance. */
  function drawBossCrown(v, col) {
    var r = v.r * 1.55, broke = !!(v.en && v.en.broken);
    var spin = t * (broke ? 0.55 : 0.22);
    var cy = v.y + v.r * 0.1;
    ctx.save();
    ctx.translate(v.x, cy);
    var ring = broke ? '#ff4a5e' : col;
    for (var k = 0; k < (broke ? 2 : 1); k++) {
      var rr = r * (1 + k * 0.16), dir = k % 2 ? -1 : 1;
      ctx.save();
      ctx.rotate(spin * dir + k);
      ctx.strokeStyle = ring;
      ctx.globalAlpha = broke ? 0.5 : 0.28;
      ctx.lineWidth = 1.4;
      ctx.shadowColor = ring; ctx.shadowBlur = broke ? 14 : 6;
      for (var a = 0; a < 5; a++) {
        ctx.beginPath();
        var a0 = a * (Math.PI * 2 / 5);
        ctx.arc(0, 0, rr, a0, a0 + 0.62);
        ctx.stroke();
      }
      ctx.restore();
    }
    // a weight under it: bosses stand on the ground harder than anything else
    ctx.globalAlpha = 0.22; ctx.shadowBlur = 0;
    ctx.strokeStyle = ring; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, v.r * 0.92, r * 0.82, r * 0.2, 0, 0, 7); ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(v, idx) {
    var dying = !v.alive;
    var dieDur = 0.45;
    if (dying && (v.deathT < 0 || t - v.deathT > dieDur)) return;

    var grounded = !!v.def.grounded;
    /* IDLE, by faction. A drilled soldier, a failing machine and a warp-thing
     * should not share one sine wave. `grounded` still separates standing from
     * floating; the faction decides the *character* of the motion. */
    var ph = idx * 1.7;
    var bob, sx = 0, idleTilt = 0;
    var fac = v.def.faction;
    if (fac === 'hierarchy') {
      // disciplined: almost still, with a crisp micro-correction now and then —
      // a soldier holding formation, not a creature breathing.
      var snap = Math.max(0, Math.sin(t * 0.7 + ph) - 0.97) * 40;
      bob = (grounded ? 0.5 : 2.2) * Math.sin(t * 1.1 + ph) - snap;
      sx = Math.sin(t * 0.4 + ph) * 0.7;
    } else if (fac === 'rust') {
      // failing machinery: irregular hitches and a sputter that never quite
      // settles into a rhythm.
      var hitch = Math.max(0, Math.sin(t * 3.1 + ph) - 0.93) * 26;
      bob = (grounded ? 0.7 : 2.4) * Math.sin(t * 1.6 + ph) + hitch;
      sx = Math.sin(t * 2.3 + ph) * 0.9 + Math.sin(t * 7.9 + ph) * 0.35;
      idleTilt = Math.sin(t * 1.9 + ph) * 0.012;
    } else if (fac === 'voidspawn') {
      // warp-thing: a slow drift on two periods that never sync, so it reads as
      // adrift rather than bobbing.
      bob = (grounded ? 1.4 : 3.4) * Math.sin(t * 0.62 + ph) + 1.5 * Math.sin(t * 1.13 + ph * 0.7);
      sx = Math.sin(t * 0.47 + ph) * 2.4;
      idleTilt = Math.sin(t * 0.53 + ph) * 0.035;
    } else {
      // faction-less (the finale bosses): heavy, slow, deliberate
      bob = (grounded ? 0.9 : 2.0) * Math.sin(t * 0.8 + ph);
      idleTilt = Math.sin(t * 0.4 + ph) * 0.018;
    }
    if (t - v.shakeT < 0.22) sx += (Math.random() - 0.5) * 8;

    /* ACT: the move-type envelope. `dir` is toward the player, who stands to the
     * LEFT of every enemy, so a lunge is -x. */
    var actScale = 1, actTilt = 0, actGlow = 0;
    var env = v.actEnv || ACT_ENVELOPE.attack;
    var au = (t - v.actT) / env.dur;
    if (au >= 0 && au < 1) {
      var pose = actPose(v.actMove, au);
      sx += pose.dx * v.r;
      bob += pose.dy * v.r;
      actScale = pose.scale;
      actTilt = pose.tilt;
      actGlow = pose.glow;
    }
    // legacy single-lunge path (anything still calling enemyLunge directly)
    var lu = (t - v.lungeT) / 0.3;
    if (lu >= 0 && lu < 1 && v.actT < v.lungeT) sx -= Math.sin(lu * Math.PI) * v.r * 0.35;

    var alpha = 1, scale = v.r;
    if (dying) {
      var dp = (t - v.deathT) / dieDur;
      alpha = 1 - dp;
      scale = v.r * (1 - dp * 0.5);
    }
    // warp-in on combat start
    var su = (t - v.spawnT) / 0.5;
    if (su >= 0 && su < 1) {
      var eo = 1 - Math.pow(1 - su, 3);
      scale *= eo + Math.sin(su * Math.PI) * 0.08;
      alpha *= Math.min(1, su * 2);
      if (!v.spawned && su > 0.12) {
        v.spawned = true;
        burst(v.x, v.y, factionColor(v.def), 14);
      }
    }

    var color = factionColor(v.def);
    var flash = (t - v.flashT < 0.13);
    var x = v.x + sx, y = v.y + bob;
    var art = artFrame((v.en && v.en.art) || v.def.art);   // per-spawn art model (artAlt)
    scale *= actScale;

    // Tilt (idle lean + act shear) needs a rotation strokePaths doesn't do, so
    // rotate the canvas about the figure's centre and draw in local space.
    var tilt = idleTilt + actTilt;
    // the crown goes down before the body, so it frames rather than overdraws
    if (v.def.boss && !dying) drawBossCrown(v, color);
    if (tilt) { ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.translate(-x, -y); }
    // A broken boss is stroked twice — a red ghost offset behind the line work,
    // so the second half of the fight looks different, not just harder.
    if (v.def.boss && v.en && v.en.broken && !dying) {
      strokePaths(art.p, x + 2, y - 1, scale * 1.03, '#ff4a5e', 14, alpha * 0.42);
    }
    strokePaths(art.p, x, y, scale, flash ? '#ffffff' : color, (flash ? 16 : 9) + actGlow, alpha);
    if (tilt) ctx.restore();

    // eyes
    if (!dying || alpha > 0.4) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = flash ? '#ffffff' : '#ffe9f0';
      ctx.shadowColor = color;
      ctx.shadowBlur = 7;
      (art.e || []).forEach(function (e) {
        var px = x + e[0] * scale, py = y + e[1] * scale;
        var es = Math.max(1.5, scale * 0.05);
        ctx.fillRect(px - es / 2, py - es / 2, es, es);
      });
      ctx.restore();
    }

    if (dying) return;

    // hp bar — Dual Rail: buffs above, shield on the bar, debuffs below, traits beneath
    v.dispHp += (v.hp - v.dispHp) * 0.18;
    if (Math.abs(v.dispHp - v.hp) < 0.4) v.dispHp = v.hp;
    var bw = Math.max(46, Math.min(96, v.r * 2.1));
    var bx = v.x - bw / 2, by = v.y + v.r + 20, bh = 6;
    /* A BOSS OUTGROWS ITS OWN LABEL.
     *
     * The bar sits under the feet, which works for anything that fits the
     * band — but a boss is 178px of radius standing on a line at 0.72 of it,
     * so "under the feet" is 68px INTO the hand and the number 83px into it.
     * Measured on a 1773x894 window against SAINT KA'LETH: the one readout
     * that decides whether you can win the turn was behind your cards.
     *
     * Bosses are meant to overrun the frame — legs disappearing behind the
     * hand reads as too big for the screen, which is the point. The readout is
     * not. When the block will not clear the cards it goes ABOVE the figure
     * instead, under the crown, where a boss has empty sky anyway. */
    /* HOW FAR THE BLOCK ACTUALLY REACHES, not a worst case. The bar and its
     * number are always drawn; the debuff rail and the trait row are only
     * there when the enemy has statuses or traits. Estimating the worst case
     * flipped ordinary enemies above their own heads to protect a rail that
     * was not being drawn. */
    var stk0 = v.en.statuses, anyStatus = false;
    for (var sk0 in stk0) { if (stk0[sk0] > 0) { anyStatus = true; break; } }
    var anyTrait = enemyTraits(v.def).length > 0;
    var reach = 24 + (anyStatus ? 14 : 0) + (anyTrait ? (anyStatus ? 40 : 23) + 8 : 0);
    /* A BOSS OUTGROWS ITS OWN LABEL. The bar sits under the feet, which works
     * for anything that fits the band — but a boss is 178px of radius standing
     * on a line at 0.72 of it, so "under the feet" is 68px INTO the hand and
     * the number 83px in. Measured on a 1773x894 window against SAINT KA'LETH:
     * the one readout that decides whether you can win the turn was behind
     * your cards.
     *
     * Bosses are meant to overrun the frame — legs vanishing behind the hand
     * reads as too big for the screen, which is the point. The readout is not.
     * When the block will not clear the cards it goes ABOVE instead, high
     * enough to clear the intent floating at v.r+22. */
    var barsUp = by + reach > readableBottom(0);
    if (barsUp) by = Math.max(fieldTop() + 22, v.y - v.r - 46 - reach);
    // recorded so the fit test can assert where the block actually landed
    // rather than re-deriving it and drifting from this
    v.barY = by; v.barBottom = by + reach; v.barsUp = barsUp;
    ctx.fillStyle = 'rgba(6, 14, 10, 0.85)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = color; ctx.globalAlpha = 0.9;
    ctx.fillRect(bx + 1, by + 1, (bw - 2) * Math.max(0, v.dispHp / v.maxHp), bh - 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(184, 230, 196, 0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    // shield: cyan line riding the bar's top edge + hexagon value
    if (v.block > 0) {
      var sbw = bw * Math.max(0.06, Math.min(1, v.block / Math.max(1, v.maxHp)));
      ctx.fillStyle = '#41d8ff'; ctx.shadowColor = '#41d8ff'; ctx.shadowBlur = 4; ctx.fillRect(bx, by - 3, sbw, 2); ctx.shadowBlur = 0;
      statGlyph('plate', bx + bw + 7, by + bh / 2, 4, '#41d8ff');
      ctx.fillStyle = '#9fe9ff'; ctx.font = 'bold 8px ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('' + v.block, bx + bw + 12, by + bh / 2);
    }
    ctx.fillStyle = 'rgba(184, 230, 196, 0.9)'; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(Math.max(0, Math.round(v.dispHp)) + '/' + v.maxHp, v.x, by + 15);

    // Dual Rail: buffs above the bar, debuffs below the HP number
    drawStatusRails(v.x, by - 12, by + 24, v.en.statuses, 8);

    // persistent passive-trait badges (Enrage / Thorns / Plated / Overload / etc.)
    drawEnemyTraits(v, by + 2, anyStatus);

    // intent
    drawIntent(v);

    // target reticle (tap-to-select mode only; lock-on drag draws its own)
    if (R.targeting && !R.aim.on) {
      var rr = v.r + 12 + Math.sin(t * 6) * 3;
      ctx.strokeStyle = '#ffb02e';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ffb02e';
      ctx.shadowBlur = 8;
      cornerBox(v.x, v.y, rr);
      ctx.shadowBlur = 0;
    }
  }

  function cornerBox(x, y, r) {
    var c = r * 0.4;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r + c); ctx.lineTo(x - r, y - r); ctx.lineTo(x - r + c, y - r);
    ctx.moveTo(x + r - c, y - r); ctx.lineTo(x + r, y - r); ctx.lineTo(x + r, y - r + c);
    ctx.moveTo(x + r, y + r - c); ctx.lineTo(x + r, y + r); ctx.lineTo(x + r - c, y + r);
    ctx.moveTo(x - r + c, y + r); ctx.lineTo(x - r, y + r); ctx.lineTo(x - r, y + r - c);
    ctx.stroke();
  }

  // lock-on targeting computer: a scanning reticle follows the cursor, snaps to
  // a hard LOCK with a tether line + crosshair when over a valid target.
  function drawAimReticle() {
    var aim = R.aim;
    var lockV = (aim.lock >= 0 && R.views[aim.lock] && R.views[aim.lock].alive) ? R.views[aim.lock] : null;
    ctx.save();
    if (lockV) {
      // hard LOCK — brackets snap in from large to a tight hug (easeOutBack)
      var since = t - (aim.lockT || -9), dur = 0.24, p = Math.min(1, since / dur);
      var c1 = 2.0, eb = 1 + (c1 + 1) * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      var pulse = 0.6 + 0.4 * Math.sin(t * 8);
      var finalR = lockV.r + 4 + Math.sin(t * 8) * 1.2;
      var rr = finalR + (1 - eb) * 30;               // starts ~+30px, snaps inward
      var appear = Math.min(1, p * 1.5);             // crosshair + label fade in
      // converging flash ring during the acquire
      if (p < 1) {
        ctx.globalAlpha = (1 - p) * 0.85; ctx.strokeStyle = '#b6ffd2'; ctx.lineWidth = 2; ctx.shadowColor = '#5dff88'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(lockV.x, lockV.y, rr + 6, 0, 7); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = '#5dff88'; ctx.shadowColor = '#5dff88'; ctx.shadowBlur = 9 * pulse + (1 - p) * 14; ctx.lineWidth = 2;
      cornerBox(lockV.x, lockV.y, rr); ctx.shadowBlur = 0;
      ctx.globalAlpha = appear * 0.85; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(lockV.x - rr - 5, lockV.y); ctx.lineTo(lockV.x - rr, lockV.y);
      ctx.moveTo(lockV.x + rr, lockV.y); ctx.lineTo(lockV.x + rr + 5, lockV.y);
      ctx.moveTo(lockV.x, lockV.y - rr - 5); ctx.lineTo(lockV.x, lockV.y - rr);
      ctx.moveTo(lockV.x, lockV.y + rr); ctx.lineTo(lockV.x, lockV.y + rr + 5); ctx.stroke();
      ctx.globalAlpha = appear; ctx.fillStyle = '#5dff88'; ctx.font = 'bold 10px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.shadowColor = '#5dff88'; ctx.shadowBlur = 6; ctx.fillText('◉ LOCK', lockV.x, lockV.y - rr - 10); ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    } else {
      // scanning reticle riding the cursor: two counter-rotating bracket rings
      var x = aim.x, y = aim.y;
      ctx.strokeStyle = '#ffb02e'; ctx.shadowColor = '#ffb02e'; ctx.shadowBlur = 7; ctx.lineWidth = 1.7;
      ctx.translate(x, y); ctx.rotate(t * 1.4); cornerBox(0, 0, 22); ctx.rotate(-t * 2.8); cornerBox(0, 0, 13); ctx.rotate(t * 1.4);
      ctx.shadowBlur = 0; ctx.globalAlpha = 0.75; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(-31, 0); ctx.lineTo(-10, 0); ctx.moveTo(10, 0); ctx.lineTo(31, 0);
      ctx.moveTo(0, -31); ctx.lineTo(0, -10); ctx.moveTo(0, 10); ctx.lineTo(0, 31); ctx.stroke();
      ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawHex(x, y, r) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 6 + i * Math.PI / 3;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawIntent(v) {
    if (!v.intent) return;
    var info = ns.engine.intentInfo(v.en);
    var y = v.y - v.r - 22 + Math.sin(t * 1.8) * 2;
    var x = v.x;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.textAlign = 'left';
    var label = info.label;
    var col;
    if (info.icon === 'atk' || info.icon === 'drain') {
      col = '#ff4a5e';
      // blade
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x - 14, y + 6); ctx.lineTo(x - 4, y - 6); ctx.lineTo(x - 6, y + 4); ctx.closePath();
      ctx.stroke();
      if (info.icon === 'drain') { ctx.beginPath(); ctx.arc(x - 9, y - 8, 2.5, 0, 7); ctx.stroke(); }
    } else if (info.icon === 'block') {
      col = '#41d8ff';
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 6); ctx.lineTo(x - 2, y - 6); ctx.lineTo(x - 2, y + 2);
      ctx.lineTo(x - 6, y + 7); ctx.lineTo(x - 10, y + 2); ctx.closePath();
      ctx.stroke();
    } else if (info.icon === 'buff') {
      col = '#5dff88';
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 6); ctx.lineTo(x - 6, y - 6);
      ctx.moveTo(x - 10, y - 2); ctx.lineTo(x - 6, y - 6); ctx.lineTo(x - 2, y - 2);
      ctx.stroke();
      label = '+';
    } else if (info.icon === 'debuff') {
      col = '#c86bff';
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 6); ctx.lineTo(x - 6, y + 6);
      ctx.moveTo(x - 10, y + 2); ctx.lineTo(x - 6, y + 6); ctx.lineTo(x - 2, y + 2);
      ctx.stroke();
      label = '−';
    } else if (info.icon === 'curse') {
      col = '#ff4a5e';
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(x - 6, y, 6, 0.4, 5.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - 6, y, 2.5, 2, 7.5);
      ctx.stroke();
      label = '✕';
    } else if (info.icon === 'heal') {
      col = '#5dff88';
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x - 9, y); ctx.lineTo(x - 1, y);
      ctx.moveTo(x - 5, y - 4); ctx.lineTo(x - 5, y + 4);
      ctx.stroke();
    } else if (info.icon === 'summon') {
      col = '#c86bff';
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(x - 10, y - 2, 2, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - 4, y + 1, 2, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - 9, y + 4, 1.6, 0, 7); ctx.stroke();
      label = '+';
    } else if (info.icon === 'eye') {
      col = '#c86bff';
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.beginPath();                                   // eye almond
      ctx.moveTo(x - 13, y); ctx.quadraticCurveTo(x - 6, y - 6, x + 1, y); ctx.quadraticCurveTo(x - 6, y + 6, x - 13, y); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - 6, y, 2.4, 0, 7); ctx.stroke();   // pupil
    } else if (info.icon === 'corrupt') {
      col = '#c86bff';
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.beginPath();                                   // spiral = building corruption
      for (var ci = 0; ci < 22; ci++) {
        var ang = ci * 0.6, rad = ci * 0.28;
        var px = x - 6 + Math.cos(ang) * rad, py = y + Math.sin(ang) * rad;
        if (ci === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (info.icon === 'charge') {
      col = '#ff4a5e';
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 9;
      ctx.beginPath();                                   // lightning bolt = primed megahit
      ctx.moveTo(x - 4, y - 7); ctx.lineTo(x - 9, y + 1); ctx.lineTo(x - 5, y + 1);
      ctx.lineTo(x - 8, y + 7); ctx.lineTo(x - 1, y - 2); ctx.lineTo(x - 5, y - 2); ctx.closePath();
      ctx.stroke();
    } else if (info.icon === 'fuse') {
      col = '#ff8a2e';
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x - 7, y + 2, 5, 0, 7); ctx.stroke();          // bomb body
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 2); ctx.lineTo(x - 1, y - 6);                      // fuse
      ctx.moveTo(x - 1, y - 6); ctx.lineTo(x + 2, y - 8);
      ctx.moveTo(x - 1, y - 6); ctx.lineTo(x + 1, y - 9);                      // spark
      ctx.stroke();
    } else if (info.icon === 'unmake') {
      col = '#b8ecff';
      ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x - 10, y); ctx.lineTo(x - 2, y);
      ctx.moveTo(x - 6, y - 5); ctx.lineTo(x - 6, y + 5);
      ctx.moveTo(x - 10, y - 5); ctx.lineTo(x - 2, y + 5);
      ctx.moveTo(x - 2, y - 5); ctx.lineTo(x - 10, y + 5);
      ctx.stroke();
      label = '!';
    }
    if (label) {
      ctx.fillStyle = col || '#b8e6c4';
      ctx.shadowBlur = 4;
      ctx.fillText(label, x + 2, y + 4);
    }
    ctx.restore();
  }

  /* ---- player avatar ----------------------------------------------------------- */
  var CLASS_ART = {
    vanguard: {
      color: '#5dff88',
      // power-armoured shock trooper: slab pauldrons, backpack stacks, respirator
      // helm sunk between the shoulders, braced stance, bolter at the ready.
      p: [
          // backpack: top plate and twin exhaust stacks rising behind the shoulders
          [-0.36,-0.58, 0.36,-0.58],
          [-0.34,-0.58, -0.34,-0.92, -0.22,-0.92, -0.22,-0.58], [-0.37,-0.92, -0.19,-0.92, -0.19,-0.99, -0.37,-0.99, -0.37,-0.92],
          [0.34,-0.58, 0.34,-0.92, 0.22,-0.92, 0.22,-0.58], [0.37,-0.92, 0.19,-0.92, 0.19,-0.99, 0.37,-0.99, 0.37,-0.92],
          // helm with respirator snout turned toward the enemy
          [-0.14,-0.60, -0.15,-0.76, -0.08,-0.87, 0.04,-0.90, 0.14,-0.84, 0.15,-0.66, 0.12,-0.60, -0.14,-0.60],
          [-0.10,-0.80, 0.10,-0.78, 0.11,-0.70, -0.09,-0.71, -0.10,-0.80],
          [0.13,-0.80, 0.24,-0.77, 0.25,-0.66, 0.12,-0.64],
          [0.15,-0.75, 0.24,-0.73], [0.15,-0.70, 0.24,-0.68],
          [-0.11,-0.60, 0.11,-0.60, 0.12,-0.54, -0.12,-0.54, -0.11,-0.60],
          // slab pauldrons
          [-0.28,-0.58, -0.46,-0.62, -0.61,-0.52, -0.67,-0.34, -0.63,-0.16, -0.44,-0.10, -0.29,-0.17, -0.27,-0.40, -0.28,-0.58],
          [-0.45,-0.55, -0.57,-0.45, -0.59,-0.30, -0.51,-0.18],
          [0.28,-0.58, 0.46,-0.62, 0.61,-0.52, 0.67,-0.34, 0.63,-0.16, 0.44,-0.10, 0.29,-0.17, 0.27,-0.40, 0.28,-0.58],
          [0.45,-0.55, 0.57,-0.45, 0.59,-0.30, 0.51,-0.18],
          // barrel chest and ribbed abdomen
          [-0.27,-0.56, 0.27,-0.56, 0.31,-0.30, 0.25,-0.06, -0.25,-0.06, -0.31,-0.30, -0.27,-0.56],
          [-0.25,-0.18, 0.25,-0.18], [-0.24,-0.11, 0.24,-0.11],
          [0,-0.50, 0.13,-0.43, 0.10,-0.30, 0,-0.24, -0.10,-0.30, -0.13,-0.43, 0,-0.50],
          [0,-0.44, 0.06,-0.37, 0,-0.29, -0.06,-0.37, 0,-0.44],
          // heavy belt and codpiece plate
          [-0.25,-0.06, 0.25,-0.06, 0.27,0.10, -0.27,0.10, -0.25,-0.06],
          [-0.25,0.02, 0.25,0.02],
          [-0.12,0.10, 0.12,0.10, 0.10,0.24, -0.10,0.24, -0.12,0.10],
          // braced armoured legs: wide base, knee guards, heavy boots
          [-0.24,0.10, -0.38,0.30, -0.36,0.50, -0.14,0.52, -0.08,0.30, -0.07,0.12, -0.24,0.10],
          [0.24,0.10, 0.38,0.30, 0.36,0.50, 0.14,0.52, 0.08,0.30, 0.07,0.12, 0.24,0.10],
          [-0.37,0.48, -0.14,0.50, -0.15,0.62, -0.38,0.60, -0.37,0.48], [0.37,0.48, 0.14,0.50, 0.15,0.62, 0.38,0.60, 0.37,0.48],
          [-0.36,0.60, -0.41,0.80, -0.34,0.87, -0.21,0.85, -0.17,0.62, -0.36,0.60], [0.36,0.60, 0.41,0.80, 0.34,0.87, 0.21,0.85, 0.17,0.62, 0.36,0.60],
          [-0.34,0.85, -0.44,0.96, -0.16,0.97, -0.18,0.85, -0.34,0.85], [0.34,0.85, 0.44,0.96, 0.16,0.97, 0.18,0.85, 0.34,0.85],
          // off arm hanging heavy below the pauldron, fist clenched at the thigh
          [-0.58,-0.12, -0.60,0.08, -0.56,0.24, -0.42,0.26, -0.42,0.08, -0.44,-0.12, -0.58,-0.12],
          [-0.58,0.06, -0.43,0.07],
          [-0.58,0.22, -0.40,0.24, -0.40,0.36, -0.57,0.34, -0.58,0.22]],
      e: [[-0.05,-0.755], [0.05,-0.745]],
      muzzle: [0.51, -1.27],
      // chunky bolter: boxed receiver, side magazine, muzzle brake
      weapon: [[0.28,-0.52, 0.33,-0.38, 0.56,-0.46, 0.52,-0.60, 0.28,-0.52],
               [0.42,-0.58, 0.35,-0.50, 0.41,-0.44, 0.46,-0.54],
               [0.42,-0.58, 0.60,-0.58, 0.60,-0.78, 0.42,-0.78, 0.42,-0.58],
               [0.40,-0.80, 0.62,-0.80, 0.62,-0.98, 0.40,-0.98, 0.40,-0.80],
               [0.62,-0.74, 0.78,-0.74, 0.78,-0.94, 0.62,-0.94, 0.62,-0.74],
               [0.45,-0.98, 0.45,-1.12, 0.57,-1.12, 0.57,-0.98],
               [0.43,-1.12, 0.59,-1.12, 0.59,-1.21, 0.43,-1.21, 0.43,-1.12],
               [0.47,-1.21, 0.49,-1.27, 0.53,-1.27, 0.55,-1.21],
               [0.44,-1.00, 0.44,-1.06, 0.58,-1.06, 0.58,-1.00]],
      // ready = the idle carry angle (weapon held forward, not skyward); aim = on target
      atk: { type: 'aim', pivot: [0.32,-0.46], aim: 1.46, ready: 0.88, muzzle: [0.51,-1.27] },

    },
    technomancer: {
      color: '#41d8ff',
      // MAGOS OF THE FORGE CHOIR: peaked cowl over an augmetic lens-cluster face,
      // a toothed cog-halo turning at his back, a ribbed reactor cuirass, and
      // three mechadendrites coiling in the air on their own time. He does not
      // stand like a soldier — he stands like a machine that has been left on.
      p: [
          // cowl, and the recessed face plate sunk inside it
          [-0.02,-1.06, 0.20,-0.92, 0.26,-0.68, 0.24,-0.52, -0.24,-0.52, -0.26,-0.68, -0.20,-0.92, -0.02,-1.06],
          [-0.17,-0.88, 0.17,-0.88],
          [-0.15,-0.85, 0.15,-0.85, 0.13,-0.58, -0.13,-0.58, -0.15,-0.85],
          [-0.13,-0.79, 0.13,-0.79],                    // lens bar
          [-0.10,-0.70, 0.10,-0.70], [-0.10,-0.65, 0.10,-0.65],   // respirator grille
          [0.13,-0.76, 0.22,-0.72, 0.22,-0.62, 0.13,-0.60],       // cheek augmetic
          // heavy mantle over the shoulders, ribbed
          [-0.24,-0.52, -0.46,-0.48, -0.57,-0.34, -0.51,-0.19, -0.27,-0.15],
          [0.24,-0.52, 0.46,-0.48, 0.57,-0.34, 0.51,-0.19, 0.27,-0.15],
          [-0.44,-0.44, -0.50,-0.29], [0.44,-0.44, 0.50,-0.29],
          // reactor cuirass
          [-0.26,-0.50, 0.26,-0.50, 0.30,-0.16, 0.28,0.06, -0.28,0.06, -0.30,-0.16, -0.26,-0.50],
          [0,-0.44, 0.16,-0.35, 0.16,-0.16, 0,-0.07, -0.16,-0.16, -0.16,-0.35, 0,-0.44],
          [0,-0.36, 0.09,-0.31, 0.09,-0.20, 0,-0.15, -0.09,-0.20, -0.09,-0.31, 0,-0.36],
          [0.16,-0.31, 0.30,-0.35], [-0.16,-0.31, -0.30,-0.35],   // coolant runs
          // belt and ribbed robe falling to the hem
          [-0.29,0.02, 0.29,0.02], [-0.28,0.11, 0.28,0.11],
          [-0.28,0.06, -0.40,0.44, -0.45,0.86, 0.45,0.86, 0.40,0.44, 0.28,0.06],
          [-0.19,0.12, -0.22,0.86], [0.19,0.12, 0.22,0.86], [0,0.12, 0,0.86],
          // servo-boots under the hem
          [-0.33,0.86, -0.36,0.97, -0.16,0.98, -0.16,0.86],
          [0.33,0.86, 0.36,0.97, 0.16,0.98, 0.16,0.86],
          // forearm crossing to grip the staff
          [0.28,-0.30, 0.46,-0.33, 0.58,-0.39],
          [0.30,-0.22, 0.47,-0.26]],
      e: [[-0.08,-0.79], [0,-0.79], [0.08,-0.79]],
      // the cog-halo turns behind him, always
      halo: { paths: [cogPath(0, -0.78, 0.56, 0.46, 12)], pivot: [0, -0.78], speed: 0.22, alpha: 0.5 },
      // three mechadendrites: two low and forward, one arcing over the cowl
      dendrites: [
        [-0.30,-0.44, -0.61,-0.53, -0.85,-0.36, -0.87,-0.05, -0.69,0.11],
        [-0.26,-0.55, -0.47,-0.93, -0.24,-1.25, 0.17,-1.33, 0.44,-1.17],
        [0.28,-0.42, 0.51,-0.31, 0.62,-0.11, 0.55,0.10]],
      // POWER-STAFF: plasma coil in a pronged housing, ferrule shod for the slam
      weapon: [[0.66,-1.00, 0.66,0.92],
               [0.56,-1.12, 0.76,-1.12, 0.76,-0.94, 0.56,-0.94, 0.56,-1.12],
               [0.60,-1.30, 0.60,-1.12], [0.72,-1.30, 0.72,-1.12],
               [0.60,-1.30, 0.57,-1.43], [0.72,-1.30, 0.75,-1.43],
               [0.57,-1.43, 0.66,-1.35, 0.75,-1.43],
               [0.598,-1.03, 0.626,-1.06, 0.666,-1.06, 0.694,-1.03, 0.694,-0.99, 0.666,-0.96, 0.626,-0.96, 0.598,-0.99, 0.598,-1.03],
               [0.60,-0.42, 0.72,-0.42], [0.60,-0.32, 0.72,-0.32],
               [0.60,0.84, 0.72,0.84, 0.70,0.94, 0.62,0.94, 0.60,0.84]],
      // LOAD BALANCE made concrete: wind the staff back, SLAM the ferrule into
      // the deck, discharge the coil, recover to the carry.
      atk: { type: 'staff', pivot: [0.66,-0.34], orb: [0.66,-1.02], ferrule: [0.66,0.90],
             carry: 0, wind: -0.34, slam: 0.30 },
    },
    voidadept: {
      color: '#c86bff',
      // THE HUNGER, given a body: a psyker who does not touch the ground. Tall
      // hollow cowl with one vertical eye, torn banner-cloth streaming off the
      // back, and a hem that frays into ribbons instead of ending in feet.
      p: [
          // cowl, and the hollow inside it
          [0,-1.16, 0.22,-0.94, 0.28,-0.66, 0.24,-0.48, -0.24,-0.48, -0.28,-0.66, -0.22,-0.94, 0,-1.16],
          [-0.16,-0.92, -0.18,-0.66, -0.10,-0.54, 0.10,-0.54, 0.18,-0.66, 0.16,-0.92, 0,-1.00, -0.16,-0.92],
          // the third eye: a vertical lens, the only thing inside the hood
          [0,-0.92, 0.055,-0.80, 0,-0.66, -0.055,-0.80, 0,-0.92],
          // hunched mantle
          [-0.24,-0.48, -0.42,-0.40, -0.49,-0.24, -0.40,-0.13],
          [0.24,-0.48, 0.42,-0.40, 0.49,-0.24, 0.40,-0.13],
          // robe front and the sash crossing it
          [-0.24,-0.48, -0.30,-0.10, -0.34,0.24, 0.34,0.24, 0.30,-0.10, 0.24,-0.48],
          [-0.26,-0.34, 0.28,-0.19],
          [-0.22,0.06, 0.26,0.06],
          // raised channelling hand, fingers splayed
          [0.40,-0.13, 0.57,-0.34, 0.67,-0.58, 0.63,-0.73],
          [0.63,-0.73, 0.56,-0.85], [0.63,-0.73, 0.67,-0.87], [0.63,-0.73, 0.73,-0.80],
          [0.40,-0.13, 0.51,0.06, 0.44,0.23],
          // low hand, drawing something up out of the floor
          [-0.40,-0.13, -0.52,0.04, -0.57,0.23],
          [-0.57,0.23, -0.63,0.34], [-0.57,0.23, -0.55,0.36], [-0.57,0.23, -0.48,0.33],
          [-0.40,-0.13, -0.57,0.01, -0.53,0.19]],
      e: [[0,-0.80]],
      // torn banner-cloth caught in a wind that is not there
      banner: [
        [-0.26,-0.47, -0.55,-0.38, -0.76,-0.49, -0.93,-0.31, -0.82,-0.11, -0.61,-0.21, -0.42,-0.12, -0.26,-0.28],
        [-0.28,-0.10, -0.50,0.02, -0.66,-0.03, -0.78,0.14]],
      // the hem frays into the warp instead of ending in feet
      tatters: [
        [-0.34,0.24, -0.45,0.47, -0.38,0.64],
        [-0.23,0.26, -0.28,0.55, -0.18,0.74, -0.27,0.82],
        [-0.10,0.28, -0.12,0.47],
        [0.01,0.28, 0.05,0.58, -0.03,0.78],
        [0.13,0.27, 0.19,0.50, 0.11,0.66],
        [0.25,0.26, 0.33,0.44],
        [0.34,0.24, 0.45,0.52, 0.36,0.70, 0.44,0.80]],
      // THE HUNGER: the ring contracts, converges to a point, and is thrown as
      // one volley — the void answers all at once or not at all.
      atk: { type: 'shard', cx: 0, cy: -0.74, rad: 0.56, n: 8, size: 0.07 },
    },
  };

  /* ====================== CONSTRUCTS ==================================
   * The Technomancer's whole thesis is that he does not fight you, he builds
   * the thing that does — and until now the board did not show it. The turret
   * was one dim hexagon whatever its damage, the DRONE SWARM was drawn NOT AT
   * ALL (three cards deployed something invisible that hit every enemy every
   * turn), and neither had any visible connection to the damage they dealt at
   * end of turn, so their shots read as the game hurting enemies for no reason.
   *
   * Everything below fixes that: real silhouettes, a damage readout, and a
   * shot that visibly leaves the construct.
   * =================================================================== */

  // Where the constructs are standing this frame, so their shots can start at
  // them. Written by drawConstructs, read by R.constructFire.
  R.constructs = { turret: [], drone: [] };

  function conStroke(col, w, blur, a) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.globalAlpha = a;
  }
  function conPoly(pts, close) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i += 2) { if (i === 0) ctx.moveTo(pts[0], pts[1]); else ctx.lineTo(pts[i], pts[i + 1]); }
    if (close) ctx.closePath();
    ctx.stroke();
  }
  function conDot(x, y, r, col, a) {
    ctx.save(); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.globalAlpha = a == null ? 1 : a;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
  }

  /* TRIPOD SENTRY — the single-target turret. Legs, because a distinct
   * silhouette is the only thing that still reads as a gun at 15 pixels: a
   * hexagon at that size is a dot, and a dot is what it used to be. */
  function drawTurret(x, y, r, col, fireT) {
    var kick = fireT != null ? Math.max(0, 1 - (t - fireT) / 0.22) : 0;   // recoil
    var bx = x - kick * r * 0.5;
    ctx.save(); conStroke(col, 1.6, 7 + kick * 8, 0.95);
    // head: a rounded wedge
    conPoly([bx - r * 0.7, y - r * 0.15, bx - r * 0.45, y - r * 0.7, bx + r * 0.5, y - r * 0.7,
             bx + r * 0.8, y - r * 0.2, bx + r * 0.8, y + r * 0.25, bx - r * 0.7, y + r * 0.25], true);
    conPoly([bx - r * 0.4, y - r * 0.42, bx + r * 0.45, y - r * 0.42]);        // visor slit
    conPoly([bx + r * 0.8, y - r * 0.05, bx + r * 2.1, y - r * 0.05]);         // barrel
    conPoly([bx + r * 1.6, y - r * 0.28, bx + r * 1.6, y + r * 0.18]);         // muzzle brake
    conPoly([bx + r * 1.9, y - r * 0.28, bx + r * 1.9, y + r * 0.18]);
    // three legs — these stay planted while the head recoils
    conPoly([x - r * 0.35, y + r * 0.25, x - r * 0.85, y + r * 1.35]);
    conPoly([x + r * 0.05, y + r * 0.25, x + r * 0.05, y + r * 1.5]);
    conPoly([x + r * 0.45, y + r * 0.25, x + r * 0.9, y + r * 1.3]);
    conPoly([x - r * 1.0, y + r * 1.38, x - r * 0.7, y + r * 1.38]);
    conPoly([x - r * 0.15, y + r * 1.52, x + r * 0.25, y + r * 1.52]);
    conPoly([x + r * 0.75, y + r * 1.33, x + r * 1.05, y + r * 1.33]);
    ctx.restore();
    // the eye sweeps while idle and locks forward while firing
    var sw = kick > 0 ? r * 0.34 : Math.sin(t * 2.2) * r * 0.34;
    conDot(bx + sw, y - r * 0.42, r * 0.16, col);
    conDot(bx + r * 2.15, y - r * 0.05, r * (0.1 + kick * 0.24), col, 0.7 + kick * 0.3);
    return { x: x + r * 2.15, y: y - r * 0.05 };     // where its shot leaves from
  }

  /* WEDGE FLIGHT — the Drone Swarm. Three delta darts in formation, trailing.
   * It hits EVERY enemy, so it had to read as a strafing run rather than as
   * another emplacement, or the two constructs would look like the same thing. */
  function drawSwarm(x, y, r, col, fireT) {
    var kick = fireT != null ? Math.max(0, 1 - (t - fireT) / 0.3) : 0;
    var off = [[0, 0], [-1.05, -0.85], [-1.05, 0.85]];
    for (var i = 0; i < 3; i++) {
      var dx = x + off[i][0] * r + kick * r * 0.6, dy = y + off[i][1] * r + Math.sin(t * 3 + i * 2) * r * 0.12;
      ctx.save(); conStroke(col, 1.5, 6 + kick * 8, 0.92);
      conPoly([dx + r * 0.78, dy, dx - r * 0.42, dy - r * 0.4, dx - r * 0.2, dy, dx - r * 0.42, dy + r * 0.4], true);
      ctx.globalAlpha = 0.32 + 0.18 * Math.sin(t * 9 + i) + kick * 0.5;       // thruster trail
      conPoly([dx - r * 0.3, dy, dx - r * (1.15 + kick * 1.4), dy]);
      ctx.restore();
      conDot(dx + r * 0.5, dy, r * (0.1 + kick * 0.14), col, 0.9);
    }
    return { x: x + r * 0.78, y: y };
  }

  /* The damage readout. A 2-damage Targeting Uplink and an 8-damage Mortar
   * Array used to draw the identical hexagon, so the board told you a construct
   * existed and nothing about whether it mattered. */
  function conLabel(x, y, txt, col, size) {
    ctx.save();
    ctx.font = '700 ' + size.toFixed(1) + 'px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(3,8,10,0.92)'; ctx.shadowBlur = 0;
    ctx.strokeText(txt, x, y);
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
    ctx.fillText(txt, x, y);
    ctx.restore();
  }

  /* Constructs stand in a column just ahead of the Technomancer, between him
   * and the pack — they used to sit BEHIND him at the screen edge, which is
   * most of why nobody saw them. One sprite per construct, not one per five
   * points of damage: the board should say what is actually deployed. */
  function drawConstructs(st, px, py, scale, col) {
    R.constructs.turret = []; R.constructs.drone = [];
    var tv = st.turret || 0, dv = st.drone || 0, hive = st.hive || 0;
    if (tv <= 0 && dv <= 0) return;
    // AHEAD of him and clear of his silhouette. The player's art runs to about
    // +1 scale, so anything closer than this draws inside him — which is what
    // the old -0.5 offset did on the other side, at the screen edge.
    var r = scale * 0.3;
    var slot = 0;
    function place() {
      var sx = px + (1.85 + (slot % 2) * 0.42) * scale;
      var sy = py + (-1.35 + slot * 0.88) * scale + Math.sin(t * 2 + slot) * 2.5;
      slot++;
      return { x: sx, y: sy };
    }
    var lab = Math.max(9, scale * 0.17);
    if (tv > 0) {
      var pT = place();
      var muzT = drawTurret(pT.x, pT.y, r, col, R.conFire.turret);
      conLabel(pT.x - r * 1.5, pT.y - r * 0.3, String(tv), col, lab);
      R.constructs.turret.push(muzT);
    }
    if (dv > 0) {
      var pD = place();
      var muzD = drawSwarm(pD.x + r * 0.5, pD.y, r, col, R.conFire.drone);
      conLabel(pD.x - r * 1.5, pD.y - r * 0.15, String(dv) + '×', col, lab);
      R.constructs.drone.push(muzD);
    }
    // HIVE doubles every construct's output and had no representation at all.
    if (hive > 0) {
      var hx = px + 1.85 * scale, hy = py + (-1.35 + slot * 0.88) * scale;
      ctx.save(); conStroke(col, 1.3, 6, 0.55 + 0.25 * Math.sin(t * 3));
      for (var h = 0; h < 6; h++) {                       // a little comb of cells
        var cx2 = hx + (h % 3) * r * 0.52, cy2 = hy + Math.floor(h / 3) * r * 0.46;
        ctx.beginPath();
        for (var k = 0; k < 6; k++) {
          var a2 = Math.PI / 6 + k * Math.PI / 3;
          var vx = cx2 + Math.cos(a2) * r * 0.26, vy = cy2 + Math.sin(a2) * r * 0.26;
          if (k === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
        }
        ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
      conLabel(hx + r * 0.52, hy + r * 1.1, 'HIVE ×' + (hive + 1), col, Math.max(8, scale * 0.12));
    }
  }

  // When each construct last fired, so the sprite can recoil with its shot.
  R.conFire = { turret: -9, drone: -9 };
  /* A construct's shot has to visibly LEAVE the construct. Before this the
   * engine called dealToEnemy directly and the damage simply appeared on the
   * enemy, which reads as the game hurting them for no reason. */
  R.constructFire = function (kind, idx, col) {
    R.conFire[kind] = t;
    var from = (R.constructs[kind] || [])[0];
    if (!from) return;
    var to = (idx == null) ? null : R.enemyPos(idx);
    if (to) R.shot(from.x, from.y, to.x, to.y, col || '#41d8ff');
    else R.views.forEach(function (v) { if (v.alive) R.shot(from.x, from.y, v.x, v.y, col || '#41d8ff'); });
  };

  // Subtle, state-driven identity flourishes per class.
  function drawPlayerFx(r, px, py, scale, col) {
    var c = ns.engine.combat;
    var st = c ? c.player.statuses : {};

    if (r.cls === 'vanguard') {
      // muzzle glow at the blaster, brief flash when firing (tracks the live weapon angle)
      var mz = (CLASS_ART.vanguard.muzzle) || [0.84, 0.12];
      var mx = R.player.muzzleX != null ? R.player.muzzleX : px + mz[0] * scale;
      var my = R.player.muzzleY != null ? R.player.muzzleY : py + mz[1] * scale;
      var fl = (t - (R.player.lungeT || -9)) / 0.28;
      var firing = fl >= 0 && fl < 0.5;
      ctx.save();
      ctx.fillStyle = firing ? '#ffe9c0' : col;
      ctx.shadowColor = firing ? '#ffd27a' : col;
      ctx.shadowBlur = firing ? 14 : 5;
      ctx.globalAlpha = firing ? 0.9 : 0.28 + 0.12 * Math.sin(t * 7);
      ctx.beginPath(); ctx.arc(mx, my, scale * (firing ? 0.16 : 0.05), 0, 7); ctx.fill();
      if (firing) {
        ctx.strokeStyle = '#ffe9c0'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mx, my); ctx.lineTo(mx + scale * 0.32, my - scale * 0.05);
        ctx.moveTo(mx, my); ctx.lineTo(mx + scale * 0.3, my + scale * 0.07);
        ctx.stroke();
      }
      ctx.restore();
    } else if (r.cls === 'technomancer') {
      // everything he has built, standing between him and the pack
      drawConstructs(st, px, py, scale, col);
      // idle spark at the staff tip
      ctx.save();
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4);
      ctx.beginPath(); ctx.arc(px + 0.64 * scale, py - 1.06 * scale, scale * 0.045, 0, 7); ctx.fill();
      ctx.restore();
    } else if (r.cls === 'voidadept') {
      // psionic motes orbiting the adept; more with Psi Focus
      var motes = 3 + Math.min(4, st.psiPow || 0);
      ctx.save();
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
      for (var m = 0; m < motes; m++) {
        var a = t * 1.1 + m * (6.283 / motes);
        var rad = scale * (0.55 + 0.12 * Math.sin(t * 1.7 + m));
        var ex = px + Math.cos(a) * rad;
        var ey = py - 0.35 * scale + Math.sin(a) * rad * 0.66;
        ctx.globalAlpha = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * 3 + m));
        ctx.beginPath(); ctx.arc(ex, ey, scale * (0.028 + (m % 2) * 0.014), 0, 7); ctx.fill();
      }
      ctx.restore();
    }
  }

  // The Shield you're holding, drawn as your archetype's themed barrier (scales with it).
  function drawPlayerShield(r, cx, cy, scale, blk) {
    var c = ctx, sc = scale, sy = cy - scale * 0.42, TAU2 = Math.PI * 2;
    var pcol = (CLASS_ART[r.cls] || CLASS_ART.vanguard).color, p, i, a;
    c.save();
    if (r.cls === 'vanguard') {                 // aegis half-dome bubble (in front)
      var vx = cx + sc * 0.2; p = 0.45 + Math.sin(t * 3.5) * 0.16;
      c.strokeStyle = pcol; c.shadowColor = pcol; c.shadowBlur = 10;
      c.lineWidth = 2.4; c.globalAlpha = 0.7 + p * 0.3;
      c.beginPath(); c.ellipse(vx, sy, sc * 0.95, sc * 1.15, 0, -1.35, 1.35); c.stroke();
      c.lineWidth = 1.2; c.globalAlpha = p * 0.5;
      c.beginPath(); c.ellipse(vx, sy, sc * 0.78, sc * 0.95, 0, -1.3, 1.3); c.stroke();
      for (i = -2; i <= 2; i++) { c.globalAlpha = p * 0.4; c.beginPath(); c.moveTo(vx, sy + i * sc * 0.4); c.lineTo(vx + sc * 0.92, sy + i * sc * 0.28); c.stroke(); }
    } else if (r.cls === 'technomancer') {      // hologrid dome (wireframe sphere)
      p = 0.5 + Math.sin(t * 3.5) * 0.15;
      c.strokeStyle = pcol; c.shadowColor = pcol; c.shadowBlur = 9; c.lineWidth = 1.6; c.globalAlpha = 0.7 + p * 0.3;
      c.beginPath(); c.arc(cx, sy, sc * 1.3, 0, TAU2); c.stroke();
      c.lineWidth = 1; c.globalAlpha = p * 0.5;
      for (i = 1; i < 4; i++) { c.beginPath(); c.ellipse(cx, sy, sc * 1.3, sc * 1.3 * Math.cos(i / 4 * Math.PI / 2), 0, 0, TAU2); c.stroke(); }
      for (i = 0; i < 6; i++) { a = i / 6 * Math.PI; c.beginPath(); c.ellipse(cx, sy, sc * 1.3 * Math.sin(a + 0.01), sc * 1.3, a, 0, TAU2); c.stroke(); }
    } else if (r.cls === 'voidadept') {         // fracture barrier (cracked-glass plane in front)
      var fx = cx + sc * 0.6; p = 0.5 + Math.sin(t * 4) * 0.16;
      c.strokeStyle = pcol; c.shadowColor = pcol; c.shadowBlur = 9; c.lineWidth = 2; c.globalAlpha = 0.8;
      c.beginPath(); c.moveTo(fx, sy - sc * 1.15); c.lineTo(fx + sc * 0.22, sy - sc * 0.4); c.lineTo(fx + sc * 0.12, sy + sc * 0.4); c.lineTo(fx, sy + sc * 1.15); c.lineTo(fx - sc * 0.2, sy + sc * 0.4); c.lineTo(fx - sc * 0.1, sy - sc * 0.4); c.closePath(); c.stroke();
      c.lineWidth = 1; c.globalAlpha = p * 0.6;
      c.beginPath(); c.moveTo(fx, sy - sc * 1.15); c.lineTo(fx, sy + sc * 1.15); c.moveTo(fx - sc * 0.15, sy); c.lineTo(fx + sc * 0.18, sy - sc * 0.1); c.moveTo(fx - sc * 0.05, sy - sc * 0.5); c.lineTo(fx + sc * 0.12, sy - sc * 0.4); c.moveTo(fx - sc * 0.12, sy + sc * 0.5); c.lineTo(fx + sc * 0.08, sy + sc * 0.4); c.stroke();
    }
    c.restore();
  }

  function drawPlayer() {
    var r = ns.engine.run;
    if (!r) return;
    var p = R.playerXY();
    var scale = figScale(0.098);
    // breathing at two rates so the idle never ticks like a metronome, plus a slow
    // weight shift boot-to-boot — the trooper is holding a stance, not standing still.
    var bob = Math.sin(t * 1.6) * 1.4 + Math.sin(t * 0.83) * 0.7;
    var swayX = (r.cls === 'vanguard') ? Math.sin(t * 0.62) * 1.7 : 0;
    if (r.cls === 'voidadept') {
      // he HOVERS. A slower, deeper rise and fall than breathing, with a lateral
      // drift on a different period so the two never sync into a bounce.
      bob = Math.sin(t * 0.74) * 4.2 + Math.sin(t * 1.31) * 1.1;
      swayX = Math.sin(t * 0.45) * 2.6;
    } else if (r.cls === 'technomancer') {
      // a machine left running: almost no drift, but a servo hitch every few
      // seconds so he reads as powered rather than paused.
      var hitch = Math.max(0, Math.sin(t * 0.55) - 0.985) * 120;
      bob = Math.sin(t * 1.1) * 0.8 + hitch;
      swayX = Math.sin(t * 0.31) * 0.7;
    }
    var flash = (t - R.player.flashT < 0.15);
    var px = p.x + swayX, py = p.y + bob, sc = scale, glow = flash ? 14 : 9;
    var art = CLASS_ART[r.cls] || CLASS_ART.vanguard, atk = art.atk;
    // card-play animation: attack (weapon rig) / defend brace / utility surge
    var atype = R.player.animType, adt = t - (R.player.animT || -9), aprog = -1;
    var dur = atype === 'attack' ? (atk && atk.type === 'aim' ? 0.66 : 0.5) : 0.42;
    var aimKick = 0;   // vanguard recoil envelope: 0 before the shot, spikes on fire, decays
    if (adt >= 0 && adt < dur) {
      aprog = adt / dur;
      var s = Math.sin(aprog * Math.PI);   // attack moves the weapon, not the body
      if (atype === 'defend') { py += s * 10; sc *= 1 - s * 0.06; glow += s * 6; }
      else if (atype === 'utility') { py -= s * 12; sc *= 1 + s * 0.08; glow += s * 8; }
      else if (atype === 'attack' && atk && atk.type === 'aim' && aprog >= 0.4) {
        aimKick = Math.max(0, 1 - (aprog - 0.4) / 0.42); aimKick *= aimKick;   // sharp kick, quick recover
      }
    }
    // the whole soldier is shoved back off the shot (recoil), then settles
    px -= aimKick * sc * 0.13; py -= aimKick * sc * 0.02; glow += aimKick * 6;
    var col = flash ? '#ff4a5e' : art.color;

    // BEHIND the figure: the cog-halo, and the psyker's torn banner-cloth.
    if (art.halo) strokeRot(art.halo.paths, px, py, sc, art.halo.pivot, t * art.halo.speed, col, glow * 0.7);
    if (art.banner) strokeLive(art.banner, px, py, sc, col, glow * 0.8, { amp: 0.055, speed: 0.9, alpha: 0.75 });

    strokePaths(art.p, px, py, sc, col, glow, 1);

    // Live parts: the mechadendrites and the frayed hem move on their OWN
    // timers, which is most of what makes these two read as alive rather than
    // as a wireframe that happens to bob. A cast flares them outward.
    var castFlare = (aprog >= 0 && atype === 'attack') ? Math.sin(aprog * Math.PI) * 0.10 : 0;
    if (art.dendrites) strokeLive(art.dendrites, px, py, sc, col, glow, { amp: 0.045, speed: 1.35, flare: castFlare, tip: true });
    if (art.tatters) strokeLive(art.tatters, px, py, sc, col, glow * 0.85, { amp: 0.05, speed: 0.85, flare: castFlare * 1.4, alpha: 0.9 });

    // weapon / attack animation per class
    var atking = atype === 'attack' && aprog >= 0, tx = R.player.atkTX, ty = R.player.atkTY;
    function ease(x) { return x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x); }
    if (atk && atk.type === 'aim') {                 // vanguard: ready carry -> snap on target, FIRE, return to ready
      // he never holds perfectly still: slow drift plus a faster tremor keeps the muzzle alive
      var rest = (atk.ready || 0) + Math.sin(t * 0.9) * 0.045 + Math.sin(t * 2.7) * 0.016;
      var ang = rest, firing = false;
      if (atking) {
        if (aprog < 0.34) ang = rest + (atk.aim - rest) * ease(aprog / 0.34);      // bring the muzzle onto target
        else if (aprog < 0.4) ang = atk.aim;                                      // brief settle on target
        else if (aprog < 0.58) { ang = atk.aim - aimKick * 0.55; firing = true; } // FIRE — muzzle climbs with the kick
        else ang = atk.aim + (rest - atk.aim) * ease((aprog - 0.58) / 0.42);       // back down to the ready carry
      }
      strokeRot(art.weapon, px, py, sc, atk.pivot, ang, col, glow);
      var mz = rotPt(atk.muzzle, atk.pivot, ang);   // live muzzle position for the idle glow
      R.player.muzzleX = px + mz[0] * sc; R.player.muzzleY = py + mz[1] * sc;
      if (firing) {
        var m = rotPt(atk.muzzle, atk.pivot, ang);
        var mx = px + m[0] * sc, my = py + m[1] * sc;
        muzzleFlash(mx, my, sc, art.color, tx, ty);
        if (!R.player.aimFired) {           // fire the shot ONCE: tracer bolt, sparks, brass, muzzle pop
          R.player.aimFired = true;
          if (tx != null) { R.beamBolt(mx, my, tx, ty, '#ffe9c0', 5); R.shot(mx, my, tx, ty, '#fff2c8'); }
          burst(mx, my, '#ffe9c0', 8);
          R.ring(mx, my, '#fff2c8', sc * 0.24, 0.14);   // tight muzzle pop, not a big bubble
          for (var ce = 0; ce < 3; ce++) spawn({ x: mx - sc * 0.12, y: my, vx: -55 - Math.random() * 70, vy: -130 - Math.random() * 80, life: 0.45 + Math.random() * 0.2, age: 0, color: '#ffcf6b', size: 1.5 + Math.random(), grav: 560 });
        }
      }
    } else if (atk && atk.type === 'staff') {
      /* MAGOS: wind the staff back, SLAM the ferrule into the deck, discharge
       * the coil, recover to the carry. The slam is the beat — it lands on the
       * floor with a ring and a quake, so the weight is felt before the bolt
       * even leaves the orb. */
      var srest = atk.carry + Math.sin(t * 0.7) * 0.02;
      var sang = srest, charge = 0, discharging = false;
      if (atking) {
        if (aprog < 0.30) { sang = srest + (atk.wind - srest) * ease(aprog / 0.30); charge = aprog / 0.30 * 0.5; }
        else if (aprog < 0.42) { sang = atk.wind + (atk.slam - atk.wind) * ease((aprog - 0.30) / 0.12); charge = 0.5 + (aprog - 0.30) / 0.12 * 0.5; }
        else if (aprog < 0.64) { sang = atk.slam; charge = 1; discharging = true; }
        else { sang = atk.slam + (srest - atk.slam) * ease((aprog - 0.64) / 0.36); charge = Math.max(0, 1 - (aprog - 0.64) / 0.36); }
      }
      strokeRot(art.weapon, px, py, sc, atk.pivot, sang, col, glow + charge * 8);
      var orbP = rotPt(atk.orb, atk.pivot, sang), ox2 = px + orbP[0] * sc, oy2 = py + orbP[1] * sc;
      R.player.muzzleX = ox2; R.player.muzzleY = oy2;
      // the coil visibly spools up before it lets go
      if (charge > 0.02) {
        ctx.save();
        ctx.strokeStyle = '#d8f6ff'; ctx.shadowColor = art.color; ctx.shadowBlur = 10 + charge * 14;
        ctx.globalAlpha = 0.35 + charge * 0.55; ctx.lineWidth = 1 + charge * 1.6;
        ctx.beginPath(); ctx.arc(ox2, oy2, sc * (0.05 + charge * 0.13), 0, 7); ctx.stroke();
        ctx.restore();
      }
      if (atking && !R.player.aimFired && aprog >= 0.30 && aprog < 0.42) {
        R.player.aimFired = true;                              // the SLAM, once
        var fp = rotPt(atk.ferrule, atk.pivot, sang);
        var fx2 = px + fp[0] * sc, fy2 = py + fp[1] * sc;
        R.ring(fx2, fy2, art.color, sc * 0.9, 0.3);
        for (var sp = 0; sp < 9; sp++) spawn({ x: fx2, y: fy2, vx: (Math.random() - 0.5) * 180, vy: -40 - Math.random() * 110, life: 0.4 + Math.random() * 0.25, age: 0, color: '#d8f6ff', size: 1.4 + Math.random(), grav: 520 });
      }
      if (discharging && !R.player.staffFired) {
        R.player.staffFired = true;                            // then the coil lets go
        muzzleFlash(ox2, oy2, sc, art.color, tx, ty);
        if (tx != null) { R.beamBolt(ox2, oy2, tx, ty, '#d8f6ff', 5); R.shot(ox2, oy2, tx, ty, art.color); }
        burst(ox2, oy2, '#d8f6ff', 9);
        R.ring(ox2, oy2, art.color, sc * 0.3, 0.16);
      }
      if (!atking) R.player.staffFired = false;

    } else if (atk && atk.type === 'shard') {
      /* PSYKER: the ring contracts, converges to a single point in front of the
       * raised hand, and is thrown as ONE volley — the void answers all at once
       * or not at all. Nothing like the Vanguard's aimed single round. */
      drawShards(atk, px, py, sc, col, glow, atking ? aprog : -1, tx, ty);
      if (atking && !R.player.shardFired && aprog >= 0.52) {
        R.player.shardFired = true;
        var cvx = px + 0.72 * sc, cvy = py - 0.62 * sc;
        if (tx != null) for (var v = 0; v < 5; v++) (function (d) {
          setTimeout(function () { R.shot(cvx, cvy, tx, ty, '#e6c4ff'); }, d);
        })(v * 34);
        burst(cvx, cvy, '#e6c4ff', 10);
        R.ring(cvx, cvy, art.color, sc * 0.42, 0.2);
      }
      if (!atking) R.player.shardFired = false;
    }

    // glowing eye/visor points
    ctx.save();
    ctx.fillStyle = flash ? '#ffffff' : '#f2fff5';
    ctx.shadowColor = art.color;
    ctx.shadowBlur = 7;
    (art.e || []).forEach(function (e) {
      var ex = px + e[0] * sc, ey = py + e[1] * sc;
      var es = Math.max(1.5, sc * 0.055);
      ctx.fillRect(ex - es / 2, ey - es / 2, es, es);
    });
    ctx.restore();

    // transient ring during a defend / utility animation
    if (aprog >= 0 && (atype === 'defend' || atype === 'utility')) drawAnimRing(px, py, sc, aprog, atype, art.color);

    // subtle class-identity effects (follow the animated figure)
    drawPlayerFx(r, px, py, sc, art.color);

    // archetype shield: a persistent ward around you while you hold Shield
    if (R.player.block > 0) drawPlayerShield(r, p.x + swayX, p.y + bob, scale, R.player.block);

    // the cockpit gauge — energy cap + HP bar + shield overlay, below the figure
    if (R.combatVisible) drawPlayerGauge(p.x, p.y, scale);
  }

  // A sci-fi vector readout under the character: a slanted ENERGY cap on the
  // front, then the HP bar (with number), and a hatched SHIELD overlay that
  // grows over the bar but never past its end.
  // Player HP readout — Fire-Control: bracketed bar, cyan shield line, status chips.
  function drawPlayerGauge(px, py, scale) {
    var c = ns.engine.combat; if (!c) return;
    var hp = Math.max(0, Math.round(R.player.hp)), maxHp = R.player.maxHp || 1;
    var block = Math.round(R.player.block || 0);
    var frac = Math.max(0, Math.min(1, hp / maxHp));
    var hpCol = frac > 0.5 ? '#5dff88' : frac > 0.25 ? '#ffb02e' : '#ff4a5e';
    var bw = Math.max(104, scale * 2.4), h = Math.max(6, scale * 0.14);
    var fs = Math.max(9, Math.round(scale * 0.22));
    /* The gauge hangs a fixed multiple of the figure below it, and the stim
     * belt is a DOM element pinned a fixed distance above the bottom — so on a
     * tall window they meet, and "¢299 STIMS" was printed straight across your
     * own HP. Same rule as the enemy bars: the readout yields to the chrome. */
    var cy = Math.min(py + scale * 1.74, playerBottom(h / 2 + fs + 8));
    R.playerGaugeBottom = cy + h / 2 + fs + 2;      // for the fit test, as above
    // the player figure sits at the far left — shift the bar's centre right so
    // the bracketed bar and chip row never clip off the left edge.
    var cx = Math.max(bw / 2 + 8, px);
    drawHpBarFC(cx, cy, bw, h, frac, hpCol, hp + '/' + maxHp, block, maxHp,
      c.player.statuses, { font: fs, chipFont: Math.max(8, fs - 1) });
  }
  function L(x1, y1, x2, y2, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w || 1; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }


  /* ---- particles ------------------------------------------------------------------ */
  function drawParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      var a = 1 - p.age / p.life;
      ctx.globalAlpha = a;
      if (p.kind === 'ring') {
        var r = p.r0 + (p.r1 - p.r0) * (p.age / p.life);
        ctx.strokeStyle = p.color; ctx.lineWidth = p.lw || 2;
        ctx.beginPath();
        if (p.sides && p.sides >= 3) {           // rotating regular polygon
          var rot = (p.rot0 || 0) + (p.spin || 0) * p.age;
          for (var s = 0; s <= p.sides; s++) {
            var ang = rot + s / p.sides * Math.PI * 2, px = p.x + Math.cos(ang) * r, py = p.y + Math.sin(ang) * r;
            if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
        } else { ctx.arc(p.x, p.y, r, 0, Math.PI * 2); }
        ctx.stroke();
        continue;
      }
      if (p.kind === 'bolt') {                    // static jagged lightning
        ctx.strokeStyle = p.color; ctx.lineWidth = p.lw || 2;
        ctx.beginPath();
        for (var b = 0; b < p.pts.length; b++) { if (b === 0) ctx.moveTo(p.pts[b][0], p.pts[b][1]); else ctx.lineTo(p.pts[b][0], p.pts[b][1]); }
        ctx.stroke();
        continue;
      }
      if (p.kind === 'beam') {                    // thick piercing beam, tapers out
        ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(0.5, p.w * a); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x0, p.y0); ctx.lineTo(p.x1, p.y1); ctx.stroke(); ctx.lineCap = 'butt';
        continue;
      }
      if (p.kind === 'scanline') {                 // horizontal scan sweeping down
        var yy = p.y0 + (p.y1 - p.y0) * (p.age / p.life);
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(p.x - p.w / 2, yy); ctx.lineTo(p.x + p.w / 2, yy); ctx.stroke();
        continue;
      }
      if (p.grav) p.vy += p.grav * dt;          // negative grav floats upward
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'streak') {                 // tracers keep their speed
        var d = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size || 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / d * p.len, p.y - p.vy / d * p.len); ctx.stroke();
        continue;
      }
      p.vx *= 0.96; p.vy *= 0.96;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
