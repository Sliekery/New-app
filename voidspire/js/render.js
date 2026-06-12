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
      return {
        def: en.def, en: en,
        hp: en.hp, maxHp: en.maxHp, dispHp: old && old.en === en ? old.dispHp : en.hp,
        block: en.block,
        alive: en.alive,
        deathT: (old && old.en === en) ? old.deathT : -1,
        flashT: -9, shakeT: -9,
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
  function deathBurst(v) {
    burst(v.x, v.y, factionColor(v.def), 26);
    burst(v.x, v.y, '#ffffff', 8);
  }

  function factionColor(def) {
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

  /* ---- background ---------------------------------------------------------- */
  function drawBackground(dt) {
    // stars
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.y += dt * 0.006 * s.z;
      if (s.y > 1) { s.y -= 1; s.x = Math.random(); }
      var a = 0.25 + 0.5 * s.z * (0.6 + 0.4 * Math.sin(t * 2 + s.tw));
      ctx.fillStyle = 'rgba(120, 200, 160, ' + a.toFixed(3) + ')';
      var sz = s.z > 0.75 ? 1.6 : 1;
      ctx.fillRect(s.x * W, s.y * H, sz, sz);
    }
    // perspective grid floor under the battlefield
    var gy = baseY() + Math.min(W, H) * 0.13;
    ctx.strokeStyle = 'rgba(93, 255, 136, 0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gy); ctx.lineTo(W, gy);
    for (var g = 1; g <= 4; g++) {
      var yy = gy + g * g * 9;
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

  function drawEnemy(v, idx) {
    var dying = !v.alive;
    var dieDur = 0.45;
    if (dying && (v.deathT < 0 || t - v.deathT > dieDur)) return;

    var bob = Math.sin(t * 1.8 + idx * 1.7) * 3;
    var sx = 0;
    if (t - v.shakeT < 0.22) sx = (Math.random() - 0.5) * 8;

    var alpha = 1, scale = v.r;
    if (dying) {
      var dp = (t - v.deathT) / dieDur;
      alpha = 1 - dp;
      scale = v.r * (1 - dp * 0.5);
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

    // block chip
    if (v.block > 0) {
      ctx.fillStyle = 'rgba(5, 20, 28, 0.95)';
      ctx.strokeStyle = '#41d8ff';
      drawHex(bx - 12, by + 3, 9);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#41d8ff';
      ctx.fillText('' + v.block, bx - 12, by + 6.5);
    }

    // statuses (live from engine entity)
    var st = v.en.statuses, sx2 = v.x, parts = [];
    Object.keys(st).forEach(function (k) {
      if (st[k] > 0) parts.push((ns.STATUS_NAMES[k] || k).slice(0, 3).toUpperCase() + st[k]);
    });
    if (parts.length) {
      ctx.fillStyle = 'rgba(200, 107, 255, 0.85)';
      ctx.font = '8px ui-monospace, monospace';
      ctx.fillText(parts.join(' '), sx2, by + 27);
    }

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
    ctx.font = '12px ui-monospace, monospace';
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
      color: '#5dff88',
      p: [
        // helmet + visor
        [-0.28,-1.05, 0.28,-1.05, 0.34,-0.72, 0.22,-0.6, -0.22,-0.6, -0.34,-0.72, -0.28,-1.05],
        [-0.2,-0.84, 0.2,-0.84],
        [0,-1.05, 0,-1.18],                              // comm fin
        // torso + chest plate
        [-0.4,-0.6, 0.4,-0.6, 0.46,-0.08, 0.3,0.18, -0.3,0.18, -0.46,-0.08, -0.4,-0.6],
        [-0.16,-0.46, 0.16,-0.46, 0.16,-0.26, -0.16,-0.26, -0.16,-0.46],
        [0,-0.26, 0,0.05],                               // sternum seam
        // pauldrons
        [-0.4,-0.6, -0.68,-0.66, -0.72,-0.34, -0.46,-0.28],
        [0.4,-0.6, 0.68,-0.66, 0.72,-0.34, 0.46,-0.28],
        // legs + knee plates
        [-0.27,0.18, -0.32,0.55, -0.3,0.96, -0.08,0.96, -0.06,0.55, -0.04,0.3],
        [0.27,0.18, 0.32,0.55, 0.3,0.96, 0.08,0.96, 0.06,0.55, 0.04,0.3],
        [-0.33,0.52, -0.05,0.52], [0.05,0.52, 0.33,0.52],
        // rifle, aimed at the enemy line
        [-0.05,0.0, 0.12,-0.12, 0.92,-0.5],
        [0.92,-0.5, 1.0,-0.6],
        [0.4,-0.26, 0.44,-0.08],
        [0.62,-0.36, 0.66,-0.5],
      ],
      e: [[-0.09,-0.84], [0.09,-0.84]],
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

  function drawPlayer() {
    var r = ns.engine.run;
    if (!r) return;
    var p = R.playerXY();
    var scale = Math.min(W, H) * 0.082;
    var bob = Math.sin(t * 1.6) * 2;
    var flash = (t - R.player.flashT < 0.15);
    var art = CLASS_ART[r.cls] || CLASS_ART.vanguard;
    strokePaths(art.p, p.x, p.y + bob, scale, flash ? '#ff4a5e' : art.color, flash ? 14 : 9, 1);

    // glowing eye/visor points
    ctx.save();
    ctx.fillStyle = flash ? '#ffffff' : '#f2fff5';
    ctx.shadowColor = art.color;
    ctx.shadowBlur = 7;
    (art.e || []).forEach(function (e) {
      var px = p.x + e[0] * scale, py = p.y + bob + e[1] * scale;
      var es = Math.max(1.5, scale * 0.055);
      ctx.fillRect(px - es / 2, py - es / 2, es, es);
    });
    ctx.restore();

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
