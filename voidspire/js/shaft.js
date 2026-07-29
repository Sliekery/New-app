/* =========================================================================
 * VOIDSPIRE — shaft.js
 * THE FALL: navigation you can watch.
 *
 * The first version of the descent was a route table and a button, and it read
 * like a form. Navigation has to be a PLACE you move through — so this is the
 * shaft itself: a tunnel of rings receding into the dark, each carrying a room,
 * with your die tumbling down past them.
 *
 * You flick the die in. A soft flick drops it onto the first ring; a hard one
 * punches it past rings you would rather not stop at, and every ring it blows
 * through settles the shaft further behind you. So the push-your-luck valve is
 * a gesture and not a prompt.
 *
 * Same vector language as everything else: stroked polylines, glow, no fills.
 * Self-contained like dieview.js — mount it on a canvas, drive it, destroy it.
 * ========================================================================= */
(function (ns) {
  'use strict';

  // room -> a compact glyph, drawn small and read at speed
  var ROOM_ART = {
    fight:    [[-0.6,-0.5, 0.6,0.5], [0.6,-0.5, -0.6,0.5]],
    elite:    [[-0.6,-0.5, 0.6,0.5], [0.6,-0.5, -0.6,0.5], [0,-0.85, 0,0.85], [-0.85,0, 0.85,0]],
    beacon:   [[0,-0.8, 0.5,0.5, -0.5,0.5, 0,-0.8], [0,-0.3, 0,0.2]],
    event:    [[0,-0.7, 0.45,-0.2, 0.15,0.35], [0.15,0.35, 0.15,0.5], [0.15,0.75, 0.15,0.8]],
    shop:     [[-0.6,-0.2, 0.6,-0.2, 0.45,0.6, -0.45,0.6, -0.6,-0.2], [-0.3,-0.2, -0.3,-0.6], [0.3,-0.2, 0.3,-0.6]],
    rest:     [[-0.65,0.4, 0.65,0.4], [-0.4,0.4, -0.4,-0.1, 0.4,-0.1, 0.4,0.4], [-0.4,-0.1, -0.15,-0.5, 0.15,-0.5, 0.4,-0.1]],
    forge:    [[-0.65,0.2, 0.65,0.2, 0.4,0.6, -0.4,0.6, -0.65,0.2], [0,0.2, 0,-0.25], [-0.35,-0.55, 0.35,-0.75]],
    treasure: [[-0.6,-0.1, 0.6,-0.1, 0.6,0.6, -0.6,0.6, -0.6,-0.1], [-0.6,-0.1, 0,-0.6, 0.6,-0.1], [-0.15,0.15, 0.15,0.15]],
    sealed:   [[-0.55,-0.55, 0.55,0.55], [0.55,-0.55, -0.55,0.55]],
  };
  var ROOM_COL = {
    fight: '#ff8a94', elite: '#ff5e6e', beacon: '#ff5e6e',
    event: '#9fb6c0', shop: '#ffb02e', rest: '#5dff88', forge: '#ffb02e', treasure: '#ffe14a',
    sealed: '#4a5a52',
  };

  ns.shaftCreate = function (canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var raf = 0, dead = false, last = 0;

    // camera depth. Rings sit at fixed depths; falling moves the camera down
    // and they swell past it.
    var camZ = 0, targetZ = 0, vel = 0;
    var RING_GAP = 1;                // depth between rings
    var AHEAD = 5;                   // how many rings are drawn below you
    var rings = [];                  // {z, room, sealed}
    var dieSpin = 0, dieFace = 20, landedAt = null, settle = 0, aimAt = 0;
    var state = { collapse: 0, reach: 2, tier: 'OPEN' };
    var onLand = null;

    function size() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.max(120, r.width), h = Math.max(160, r.height);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      return { w: w, h: h, dpr: dpr };
    }

    // Build the rings below the camera. `rooms` is what the engine says is down
    // there; anything past the collapse line is drawn sealed.
    function stock(rooms) {
      rings = [];
      var n = (rooms && rooms.length) || AHEAD;
      for (var i = 0; i < n; i++) {
        rings.push({
          z: (i + 1) * RING_GAP,
          room: rooms && rooms[i] ? rooms[i] : 'fight',
          sealed: i > state.reach,
        });
      }
    }

    function poly(pts, cx, cy, s, alpha, col) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(0.8, s * 0.09);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var i = 0; i < pts.length; i += 2) {
        var x = cx + pts[i] * s, y = cy + pts[i + 1] * s;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    function ellipse(cx, cy, rx, ry, alpha, col, w) {
      ctx.save();
      ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = w || 1.2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    function draw(now) {
      if (dead) return;
      var s = size();
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);

      // Looking DOWN a shaft at a slight angle: the vanishing point sits high,
      // the next floor is large and low, and deeper floors stack upward toward
      // it. Concentric rings on one centre read as a target, not a fall.
      var cx = s.w / 2;
      var VAN = s.h * 0.17;             // where the shaft disappears
      var SPREAD = s.h * 0.60;          // how far the near ring hangs below it
      var F = s.w * 0.52;               // near ring fills the frame
      var SQUASH = 0.26;

      // ---- fall physics ---------------------------------------------------
      if (camZ < targetZ - 0.001) {
        vel += (targetZ - camZ) * 10 * dt;
        vel *= 0.87;
        camZ = Math.min(targetZ, camZ + vel * dt * 9);
        dieSpin += dt * (6 + vel * 6);
      } else if (targetZ > 0) {
        camZ = targetZ; vel = 0;
        if (settle < 1) { settle = Math.min(1, settle + dt * 3); dieSpin += dt * 1.5 * (1 - settle); }
        else if (onLand) { var fn = onLand; onLand = null; fn(); }
      } else {
        dieSpin += dt * 0.7;
      }
      var speed = Math.min(1, Math.abs(vel) * 0.8);

      function zOf(i) { return Math.max(0.2, rings[i].z - camZ); }
      function yOf(z) { return VAN + SPREAD / z; }
      function kOf(z) { return F / z; }

      // ---- the tube: spokes running the whole visible depth ----------------
      if (rings.length) {
        var zn = zOf(0), zf = zOf(rings.length - 1) + 1.6;
        for (var sp = 0; sp < 8; sp++) {
          var ang = (sp / 8) * Math.PI * 2 + 0.39;
          ctx.save(); ctx.globalAlpha = 0.15; ctx.strokeStyle = '#7fd8a8'; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * kOf(zn), yOf(zn) + Math.sin(ang) * kOf(zn) * SQUASH);
          ctx.lineTo(cx + Math.cos(ang) * kOf(zf), yOf(zf) + Math.sin(ang) * kOf(zf) * SQUASH);
          ctx.stroke(); ctx.restore();
        }
      }

      // ---- rings, far first so near ones sit on top ------------------------
      for (var i = rings.length - 1; i >= 0; i--) {
        var R = rings[i];
        var z = zOf(i);
        if (R.z - camZ <= 0.2) continue;
        var k = kOf(z), y = yOf(z);
        if (y > s.h * 1.5) continue;
        var a = Math.max(0.14, Math.min(1, 1.5 - z * 0.2));
        var isAim = (aimAt === i && targetZ === 0);
        var col = R.sealed ? ROOM_COL.sealed : (isAim ? '#eafcff' : 'rgba(130,205,168,0.95)');
        ellipse(cx, y, k, k * SQUASH, a * (isAim ? 1 : 0.55), col, R.sealed ? 2.2 : (isAim ? 2.8 : 1.3));

        var art = ROOM_ART[R.sealed ? 'sealed' : R.room] || ROOM_ART.fight;
        var gs = Math.max(6, Math.min(30, k * 0.26));
        var gy = y - k * SQUASH * 0.30;
        var gcol = R.sealed ? ROOM_COL.sealed : (ROOM_COL[R.room] || '#9fb6c0');
        // an aimed room gets brackets, not a blob — the shaft must stay visible
        if (isAim) {
          var b = gs * 1.9;
          ctx.save(); ctx.globalAlpha = 0.95; ctx.strokeStyle = gcol; ctx.lineWidth = 2;
          [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function (q) {
            ctx.beginPath();
            ctx.moveTo(cx + q[0] * b, gy + q[1] * b - q[1] * b * 0.45);
            ctx.lineTo(cx + q[0] * b, gy + q[1] * b);
            ctx.lineTo(cx + q[0] * b - q[0] * b * 0.45, gy + q[1] * b);
            ctx.stroke();
          });
          ctx.restore();
        }
        art.forEach(function (pp) { poly(pp, cx, gy, gs, a * (isAim ? 1 : 0.8), gcol); });
        if (landedAt === i && settle > 0) {
          ellipse(cx, gy, gs * (3 - settle * 1.7), gs * (3 - settle * 1.7), (1 - settle) * 0.9, gcol, 2.4);
        }
      }

      // ---- speed lines, streaming down past you -----------------------------
      if (speed > 0.05) {
        for (var sl = 0; sl < 18; sl++) {
          var sx = cx + (((sl * 37) % 100) / 100 - 0.5) * s.w * 0.95;
          var sy0 = ((sl * 53) % 100) / 100 * s.h;
          ctx.save(); ctx.globalAlpha = speed * 0.3; ctx.strokeStyle = '#b6ffd6'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(sx, sy0); ctx.lineTo(sx, sy0 + speed * s.h * 0.28); ctx.stroke();
          ctx.restore();
        }
      }

      // ---- you: the die, riding the top of the shaft ------------------------
      // You ride just inside the mouth of the shaft, not floating below it.
      var dk = Math.max(12, s.w * 0.05);
      var z0 = rings.length ? zOf(0) : 1;
      var dy = Math.min(s.h * 0.88, yOf(z0) + kOf(z0) * SQUASH * 0.62);
      ctx.save();
      ctx.translate(cx, dy);
      ctx.rotate(Math.sin(dieSpin) * 0.55 * (1 - settle * 0.8));
      ctx.globalAlpha = 0.98; ctx.strokeStyle = '#7fdcff'; ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(65,216,255,0.95)'; ctx.shadowBlur = 14;
      ctx.beginPath();
      for (var v = 0; v <= 6; v++) {
        var va = v / 6 * Math.PI * 2 - Math.PI / 2;
        if (v === 0) ctx.moveTo(Math.cos(va) * dk, Math.sin(va) * dk);
        else ctx.lineTo(Math.cos(va) * dk, Math.sin(va) * dk);
      }
      ctx.stroke();
      if (settle > 0.4) {
        ctx.globalAlpha = (settle - 0.4) / 0.6;
        ctx.shadowBlur = 9; ctx.fillStyle = '#eafcff';
        ctx.font = '700 ' + Math.round(dk * 1.05) + 'px ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(dieFace), 0, 1);
      }
      ctx.restore();

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return {
      // what is down there right now
      setRooms: function (rooms, st) {
        if (st) state = { collapse: st.collapse || 0, reach: st.reach == null ? 2 : st.reach, tier: st.tier || 'OPEN' };
        stock(rooms);
        camZ = 0; targetZ = 0; vel = 0; settle = 0; landedAt = null;
      },
      // which ring the drag is currently pointing at
      setAim: function (d) { aimAt = d; },
      // flick it in: `depth` rings passed (0 = the first one), then it settles
      fall: function (depth, face, cb) {
        dieFace = face;
        landedAt = Math.max(0, Math.min(rings.length - 1, depth));
        targetZ = rings[landedAt].z - 0.72;
        settle = 0; vel = 0;
        onLand = cb || null;
      },
      destroy: function () { dead = true; cancelAnimationFrame(raf); },
    };
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
