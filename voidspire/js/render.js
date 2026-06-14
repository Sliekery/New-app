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
  };

  var canvas, ctx, W = 0, H = 0, dpr = 1;
  var t = 0;
  var stars = [];
  var particles = [];
  var screenShake = 0;
  var flashAlpha = 0;

  R.views = [];           // enemy display states
  R.player = { hp: 1, maxHp: 1, block: 0, flashT: -9 };
  R.combatVisible = false;
  R.targeting = false;

  R.init = function (cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    R.resize();
    for (var i = 0; i < 90; i++) {
      stars.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, tw: Math.random() * 6 });
    }
  };

  R.resize = function () {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    layout();
  };

  /* ---- battlefield layout ---------------------------------------------- */
  function fieldTop() { return 96; }
  function fieldBottom() { return H - 170; }
  function baseY() { return fieldTop() + (fieldBottom() - fieldTop()) * 0.52; }

  function layout() {
    var n = R.views.length;
    if (!n) return;
    var y = baseY() - 14;
    for (var i = 0; i < n; i++) {
      var v = R.views[i];
      var fx;
      if (n === 1) fx = 0.64;
      else if (n === 2) fx = 0.48 + i * 0.30;
      else fx = 0.38 + i * 0.235;
      v.x = W * fx;
      v.y = y;
      v.r = Math.min(W, H) * 0.105 * (v.def.size || 1) * (n === 3 ? 0.82 : 1);
    }
  }

  R.playerXY = function () { return { x: W * 0.15, y: baseY() + 14 }; };

  /* ---- view-state management ------------------------------------------- */
  R.syncCombat = function () {
    var c = ns.engine.combat;
    if (!c) { R.views = []; R.combatVisible = false; return; }
    R.combatVisible = true;
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
        flashT: -9, shakeT: -9, lungeT: -9,
        intent: en.intent,
        x: 0, y: 0, r: 10,
      };
    });
    layout();
    var r = ns.engine.run;
    R.player.hp = r.hp; R.player.maxHp = r.maxHp;
    R.player.block = c.player.block;
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
  R.enemyLunge = function (idx) {
    var v = R.views[idx];
    if (v) v.lungeT = t;
  };
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
      particles.push({
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
      particles.push({
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
      particles.push({
        x: px, y: py, vx: dx / d * sp, vy: dy / d * sp,
        life: 0.32 + Math.random() * 0.34, age: 0, color: color, size: 0.8 + Math.random() * 1.7,
      });
    }
  };
  function deathBurst(v) {
    burst(v.x, v.y, factionColor(v.def), 26);
    burst(v.x, v.y, '#ffffff', 8);
  }

  function factionColor(def) {
    if (def.color) return def.color;   // faction-less bosses (the finale) carry their own colour
    var f = ns.FACTIONS[def.faction];
    return f ? f.color : '#5dff88';
  }

  /* ---- main frame --------------------------------------------------------- */
  R.frame = function (dt) {
    if (!ctx) return;
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
      drawPlayer();
      for (var i = 0; i < R.views.length; i++) drawEnemy(R.views[i], i);
    }

    drawParticles(dt);

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

  // ---- readable status / shield rendering (Slay-the-Spire-ish) ----
  var STATUS_COLORS = {
    vuln: '#ff8a3a', weak: '#c86bff', burn: '#ff5a2a', str: '#5dff88',
    regen: '#56ff9c', plate: '#41d8ff', platedArmor: '#41d8ff', thorns: '#9bb0a6',
  };
  var STATUS_ABBR = { vuln: 'VULN', weak: 'WEAK', burn: 'BURN', str: 'STR' };

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

  function drawEnemy(v, idx) {
    var dying = !v.alive;
    var dieDur = 0.45;
    if (dying && (v.deathT < 0 || t - v.deathT > dieDur)) return;

    var grounded = !!v.def.grounded;
    // grounded enemies stand still (a faint sway); floating ones bob
    var bob = grounded ? Math.sin(t * 1.2 + idx) * 0.8 : Math.sin(t * 1.8 + idx * 1.7) * 3;
    var sx = 0;
    if (t - v.shakeT < 0.22) sx = (Math.random() - 0.5) * 8;
    // lunge toward the player when attacking
    var lu = (t - v.lungeT) / 0.3;
    if (lu >= 0 && lu < 1) sx -= Math.sin(lu * Math.PI) * v.r * 0.35;

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

    strokePaths(v.def.art.p, x, y, scale, flash ? '#ffffff' : color, flash ? 16 : 9, alpha);

    // eyes
    if (!dying || alpha > 0.4) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = flash ? '#ffffff' : '#ffe9f0';
      ctx.shadowColor = color;
      ctx.shadowBlur = 7;
      (v.def.art.e || []).forEach(function (e) {
        var px = x + e[0] * scale, py = y + e[1] * scale;
        var es = Math.max(1.5, scale * 0.05);
        ctx.fillRect(px - es / 2, py - es / 2, es, es);
      });
      ctx.restore();
    }

    if (dying) return;

    // hp bar
    v.dispHp += (v.hp - v.dispHp) * 0.18;
    if (Math.abs(v.dispHp - v.hp) < 0.4) v.dispHp = v.hp;
    var bw = Math.max(46, Math.min(96, v.r * 2.1));
    var bx = v.x - bw / 2, by = v.y + v.r + 14;
    ctx.fillStyle = 'rgba(6, 14, 10, 0.85)';
    ctx.fillRect(bx, by, bw, 6);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(bx + 1, by + 1, (bw - 2) * Math.max(0, v.dispHp / v.maxHp), 4);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(184, 230, 196, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 5);
    ctx.fillStyle = 'rgba(184, 230, 196, 0.9)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.max(0, Math.round(v.dispHp)) + '/' + v.maxHp, v.x, by + 16);

    // block (shield) — clear cyan badge at the HP bar's left edge
    if (v.block > 0) drawBlockBadge(bx - 13, by + 2, v.block);

    // statuses — colour-coded pills under the HP bar
    drawEnemyStatuses(v, by);

    // intent
    drawIntent(v);

    // target reticle
    if (R.targeting) {
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
      // Void Knight: tall armoured coat, helm with halo + crest, chest emblem,
      // gorget collar, blaster carbine held forward.
      color: '#5dff88',
      p: [
        // armoured coat / robe — flares at the hem (the silhouette)
        [-0.27,-0.58, -0.43,-0.5, -0.47,-0.2, -0.41,0.18, -0.52,0.6, -0.45,0.92, -0.17,0.92, -0.12,0.5, 0,0.32, 0.12,0.5, 0.17,0.92, 0.45,0.92, 0.52,0.6, 0.41,0.18, 0.47,-0.2, 0.43,-0.5, 0.27,-0.58, 0.13,-0.56, -0.13,-0.56, -0.27,-0.58],
        [0,0.32, 0,0.9],
        [-0.2,0.5, -0.3,0.86], [0.2,0.5, 0.3,0.86],
        [-0.3,0.92, -0.26,0.96, -0.15,0.96, -0.13,0.92], [0.13,0.92, 0.15,0.96, 0.26,0.96, 0.3,0.92],
        // pauldrons + trim
        [-0.27,-0.55, -0.5,-0.56, -0.52,-0.34, -0.32,-0.3],
        [0.27,-0.55, 0.5,-0.56, 0.52,-0.34, 0.32,-0.3],
        [-0.5,-0.5, -0.36,-0.46], [0.5,-0.5, 0.36,-0.46],
        // gorget collar
        [-0.14,-0.56, 0.14,-0.56, 0.12,-0.64, -0.12,-0.64],
        // helmet + cheek guards + visor + crest
        [-0.13,-0.72, -0.12,-0.9, 0,-0.98, 0.12,-0.9, 0.13,-0.72, 0.05,-0.64, -0.05,-0.64, -0.13,-0.72],
        [0,-0.98, 0,-1.14],
        [-0.11,-0.74, -0.09,-0.66], [0.11,-0.74, 0.09,-0.66],
        [-0.1,-0.8, 0.1,-0.8], [0,-0.84, 0,-0.72],
        // halo ring behind the head
        [-0.2,-0.92, -0.1,-1.0, 0.1,-1.0, 0.2,-0.92, 0.1,-0.84, -0.1,-0.84, -0.2,-0.92],
        // chest emblem + belt
        [-0.16,-0.34, 0,-0.26, 0.16,-0.34], [0,-0.26, 0,-0.08],
        [-0.26,0.0, 0.26,0.0],
        // arms
        [0.3,-0.46, 0.4,-0.2, 0.28,0.06],
        [-0.27,-0.46, -0.1,-0.2, 0.12,-0.02],
        // blaster carbine held forward
        [0.1,-0.05, 0.46,-0.05, 0.46,0.09, 0.1,0.09, 0.1,-0.05],
        [0.46,-0.01, 0.76,-0.01], [0.76,-0.05, 0.82,-0.05, 0.82,0.03, 0.76,0.03],
        [0.16,-0.05, 0.16,-0.11, 0.3,-0.11, 0.3,-0.05],
        [0.2,0.09, 0.22,0.22, 0.32,0.22, 0.3,0.09],
      ],
      e: [[-0.05,-0.84], [0.05,-0.84]],
      muzzle: [0.82, -0.01],
    },
    technomancer: {
      color: '#41d8ff',
      p: [
        // cowl
        [0,-1.12, 0.27,-0.86, 0.2,-0.58, -0.2,-0.58, -0.27,-0.86, 0,-1.12],
        // antenna + emitter
        [0,-1.12, 0,-1.36],
        [-0.07,-1.48, 0.07,-1.48, 0.07,-1.34, -0.07,-1.34, -0.07,-1.48],
        // robe
        [-0.42,-0.52, 0.42,-0.52, 0.52,0.96, -0.52,0.96, -0.42,-0.52],
        [-0.52,0.74, 0.52,0.74],                          // hem band
        // chest cog (diamond) + circuit traces
        [0,-0.36, 0.13,-0.2, 0,-0.04, -0.13,-0.2, 0,-0.36],
        [0,-0.04, 0,0.6],
        [-0.24,-0.14, -0.24,0.55], [0.24,-0.14, 0.24,0.55],
        [-0.24,0.2, -0.1,0.2], [0.24,0.36, 0.1,0.36],
        // arm + power staff
        [0.42,-0.4, 0.64,-0.44],
        [0.64,-1.06, 0.64,0.9],
        [0.54,-1.06, 0.74,-1.06, 0.74,-0.88, 0.54,-0.88, 0.54,-1.06],
        [0.64,-1.2, 0.64,-1.06],
      ],
      e: [[-0.08,-0.74], [0.08,-0.74], [0,-0.2]],
    },
    voidadept: {
      color: '#c86bff',
      p: [
        // hood
        [0,-1.14, 0.3,-0.86, 0.23,-0.56, -0.23,-0.56, -0.3,-0.86, 0,-1.14],
        [-0.13,-0.74, 0.13,-0.74],                        // face shadow
        // third eye
        [0,-0.97, 0.07,-0.89, 0,-0.81, -0.07,-0.89, 0,-0.97],
        // tattered cloak
        [-0.4,-0.5, 0.4,-0.5, 0.5,0.42, 0.42,0.96, 0.26,0.7, 0.1,0.96, -0.1,0.7, -0.26,0.96, -0.42,0.7, -0.5,0.42, -0.4,-0.5],
        [-0.2,-0.3, -0.16,0.4], [0.2,-0.3, 0.16,0.4],     // robe folds
        // outstretched casting arm + floating focus shard
        [0.4,-0.42, 0.72,-0.3, 0.8,-0.42],
        [0.86,-0.62, 0.93,-0.52, 0.86,-0.42, 0.79,-0.52, 0.86,-0.62],
        // drifting void shards on the left
        [-0.66,-0.92, -0.56,-0.82], [-0.78,-0.6, -0.66,-0.54], [-0.7,-0.3, -0.62,-0.36],
      ],
      e: [[-0.08,-0.74], [0.08,-0.74], [0,-0.89]],
    },
  };

  // small auto-turret drone (Technomancer identity)
  function drawTurret(x, y, r, col) {
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.lineJoin = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = 5; ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 6 + i * Math.PI / 3;
      var bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
    }
    ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r * 0.6, y); ctx.lineTo(x + r * 1.6, y); ctx.stroke(); // barrel toward enemies
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r * 0.26, 0, 7); ctx.fill();        // eye
    ctx.restore();
  }

  // Subtle, state-driven identity flourishes per class.
  function drawPlayerFx(r, px, py, scale, col) {
    var c = ns.engine.combat;
    var st = c ? c.player.statuses : {};

    if (r.cls === 'vanguard') {
      // muzzle glow at the blaster, brief flash when firing
      var mz = (CLASS_ART.vanguard.muzzle) || [0.84, 0.12];
      var mx = px + mz[0] * scale, my = py + mz[1] * scale;
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
      // deployed turret drones hover beside you when the Turret power is up
      var tv = st.turret || 0;
      if (tv > 0) {
        var n = Math.max(1, Math.min(3, Math.ceil(tv / 5)));
        for (var i = 0; i < n; i++) {
          var ox = px + (-0.5 - i * 0.16) * scale;
          var oy = py + (-0.45 + i * 0.55) * scale + Math.sin(t * 2 + i) * 2.5;
          drawTurret(ox, oy, scale * 0.26, col);
        }
      }
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

  function drawPlayer() {
    var r = ns.engine.run;
    if (!r) return;
    var p = R.playerXY();
    var scale = Math.min(W, H) * 0.09;
    var bob = Math.sin(t * 1.6) * 1.4;
    var flash = (t - R.player.flashT < 0.15);
    // lunge toward the enemy line when attacking
    var px = p.x;
    var lu = (t - (R.player.lungeT || -9)) / 0.28;
    if (lu >= 0 && lu < 1) px += Math.sin(lu * Math.PI) * 18;
    var art = CLASS_ART[r.cls] || CLASS_ART.vanguard;
    strokePaths(art.p, px, p.y + bob, scale, flash ? '#ff4a5e' : art.color, flash ? 14 : 9, 1);

    // glowing eye/visor points
    ctx.save();
    ctx.fillStyle = flash ? '#ffffff' : '#f2fff5';
    ctx.shadowColor = art.color;
    ctx.shadowBlur = 7;
    (art.e || []).forEach(function (e) {
      var ex = px + e[0] * scale, ey = p.y + bob + e[1] * scale;
      var es = Math.max(1.5, scale * 0.055);
      ctx.fillRect(ex - es / 2, ey - es / 2, es, es);
    });
    ctx.restore();

    // subtle class-identity effects
    drawPlayerFx(r, px, p.y + bob, scale, art.color);

    // shield arc
    if (R.player.block > 0) {
      ctx.save();
      ctx.strokeStyle = '#41d8ff';
      ctx.shadowColor = '#41d8ff';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6 + Math.sin(t * 3) * 0.15;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, scale * 1.5, -1.1, 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, scale * 1.5, Math.PI - 1.1, Math.PI + 1.1);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---- particles ------------------------------------------------------------------ */
  function drawParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      var a = 1 - p.age / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
