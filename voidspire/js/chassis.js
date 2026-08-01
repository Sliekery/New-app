/* =========================================================================
 * VOIDSPIRE — chassis.js
 * THE MODULE BAY: relics, drawn as hardware you install into a real object.
 *
 * Relics used to be a row of 22px chips at the bottom of the die screen whose
 * only description was a hover title. They are one of the three systems a run
 * is built out of and they were the hardest thing in the game to look at.
 *
 * So they get their own screen, and the screen is a MODEL. Each class carries a
 * chassis — the Vanguard's rifle, the Technomancer's reactor frame, the Void
 * Adept's reliquary — built the same way the die is: real vertices in three
 * dimensions, rotated by quaternion, projected orthographically, drawn as
 * depth-cued wireframe. Same technique, same house style, no assets.
 *
 * Hardpoints are points ON THE MODEL, so they orbit with it. A module seats at
 * a hardpoint in 3D and runs a tracer back to the core through the object's
 * own space — which is the whole reason to do this in 3D rather than flat: you
 * can see which side of the thing your build lives on.
 * ========================================================================= */
(function (ns) {
  'use strict';

  /* ---- model builders ----------------------------------------------------
   * Everything is (verts, edges). Building from primitives keeps the models
   * short enough to read and adjust, rather than a wall of hand-typed points. */
  function Model() { return { v: [], e: [] }; }
  function push(m, verts, edges) {
    var base = m.v.length;
    verts.forEach(function (p) { m.v.push(p); });
    edges.forEach(function (pair) { m.e.push([base + pair[0], base + pair[1]]); });
    return base;
  }
  // an axis-aligned box, as 8 corners and 12 edges
  function box(m, x0, y0, z0, x1, y1, z1) {
    push(m, [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ], [[0,1],[1,2],[2,3],[3,0], [4,5],[5,6],[6,7],[7,4], [0,4],[1,5],[2,6],[3,7]]);
  }
  // a tube along X: two n-gons joined by rails
  function tubeX(m, x0, x1, r, n, cy, cz) {
    cy = cy || 0; cz = cz || 0;
    var vs = [], es = [];
    for (var k = 0; k < n; k++) {
      var a = k / n * Math.PI * 2;
      vs.push([x0, cy + Math.cos(a) * r, cz + Math.sin(a) * r]);
      vs.push([x1, cy + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    for (var k2 = 0; k2 < n; k2++) {
      var i = k2 * 2, j = ((k2 + 1) % n) * 2;
      es.push([i, j], [i + 1, j + 1], [i, i + 1]);
    }
    push(m, vs, es);
  }
  // an n-gon ring in the XY plane at depth z
  function ringXY(m, r, z, n, rot) {
    var vs = [], es = [];
    for (var k = 0; k < n; k++) {
      var a = (rot || 0) + k / n * Math.PI * 2;
      vs.push([Math.cos(a) * r, Math.sin(a) * r, z]);
      es.push([k, (k + 1) % n]);
    }
    return push(m, vs, es);
  }
  // join two rings built back-to-back into a prism
  function joinRings(m, aBase, bBase, n) {
    for (var k = 0; k < n; k++) m.e.push([aBase + k, bBase + k]);
  }

  function buildRifle() {
    var m = Model();
    box(m, -0.58, -0.02, -0.09, 0.26, 0.16, 0.09);        // receiver
    tubeX(m, 0.26, 0.86, 0.052, 8, 0.07, 0);               // barrel
    box(m, -0.52, -0.10, -0.05, 0.24, -0.02, 0.05);        // top rail
    box(m, -0.92, 0.03, -0.06, -0.58, 0.22, 0.06);         // stock
    box(m, -0.26, 0.16, -0.05, -0.12, 0.50, 0.05);         // grip
    box(m, 0.00, 0.16, -0.045, 0.18, 0.56, 0.045);         // magazine
    box(m, 0.30, 0.16, -0.03, 0.44, 0.30, 0.03);           // fore grip
    box(m, 0.80, -0.06, -0.02, 0.84, 0.02, 0.02);          // front sight
    return {
      m: m,
      slots: [[-0.40, -0.14, 0], [-0.16, -0.14, 0], [0.08, -0.14, 0],
              [0.52, 0.02, 0], [-0.75, 0.12, 0], [0.09, 0.60, 0]],
      core: [-0.16, 0.07, 0],
    };
  }

  function buildFrame() {
    var m = Model();
    var a = ringXY(m, 0.72, -0.10, 6, Math.PI / 2);
    var b = ringXY(m, 0.72, 0.10, 6, Math.PI / 2);
    joinRings(m, a, b, 6);                                  // outer hexagonal shell
    var c = ringXY(m, 0.26, -0.16, 6, Math.PI / 2);
    var d = ringXY(m, 0.26, 0.16, 6, Math.PI / 2);
    joinRings(m, c, d, 6);                                  // the reactor
    var e2 = ringXY(m, 0.10, 0, 6, Math.PI / 2);            // its heart
    // spars from reactor to shell
    for (var k = 0; k < 6; k++) m.e.push([a + k, c + k], [b + k, d + k]);
    for (var k2 = 0; k2 < 6; k2++) m.e.push([c + k2, e2 + k2]);
    var slots = [];
    for (var k3 = 0; k3 < 6; k3++) {
      var ang = Math.PI / 2 + k3 / 6 * Math.PI * 2;
      slots.push([Math.cos(ang) * 0.72, Math.sin(ang) * 0.72, 0]);
    }
    return { m: m, slots: slots, core: [0, 0, 0] };
  }

  function buildReliquary() {
    var m = Model();
    // a cage: a small crown ring, a wide belly, tapering to a point
    var crown = ringXY(m, 0.22, 0, 6, 0);
    var belly = ringXY(m, 0.50, 0, 6, 0);
    var waist = ringXY(m, 0.34, 0, 6, 0);
    // lift them onto their own heights by hand (ringXY builds in one plane)
    for (var k = 0; k < 6; k++) {
      m.v[crown + k] = [m.v[crown + k][0], -0.62, m.v[crown + k][1]];
      m.v[belly + k] = [m.v[belly + k][0], -0.06, m.v[belly + k][1]];
      m.v[waist + k] = [m.v[waist + k][0], 0.36, m.v[waist + k][1]];
    }
    var tip = m.v.length; m.v.push([0, 0.84, 0]);
    for (var k2 = 0; k2 < 6; k2++) {
      m.e.push([crown + k2, belly + k2], [belly + k2, waist + k2], [waist + k2, tip]);
    }
    // the thing inside it
    var core = m.v.length;
    m.v.push([0, -0.30, 0], [0.14, -0.06, 0], [0, 0.18, 0], [-0.14, -0.06, 0],
             [0, -0.06, 0.14], [0, -0.06, -0.14]);
    m.e.push([core, core + 1], [core + 1, core + 2], [core + 2, core + 3], [core + 3, core],
             [core, core + 4], [core + 4, core + 2], [core + 2, core + 5], [core + 5, core]);
    // suspension
    m.e.push([crown, crown + 3]);
    var slots = [];
    for (var k3 = 0; k3 < 6; k3++) {
      var ang = k3 / 6 * Math.PI * 2;
      var isCrown = k3 % 2 === 0;
      var r = isCrown ? 0.22 : 0.50;
      slots.push([Math.cos(ang) * r, isCrown ? -0.62 : -0.06, Math.sin(ang) * r]);
    }
    return { m: m, slots: slots, core: [0, -0.06, 0] };
  }

  var BUILT = null;
  function built() {
    if (BUILT) return BUILT;
    BUILT = {
      vanguard:     { name: 'THE RIFLE',      col: '#ffb02e', scale: 1.04,
                      sub: 'Modules seat along the rail. What you bolt on is what it becomes.',
                      geo: buildRifle() },
      technomancer: { name: 'THE FRAME',      col: '#41d8ff', scale: 0.84,
                      sub: 'Modules seat in the ring. Power is what you route, not what you carry.',
                      geo: buildFrame() },
      voidadept:    { name: 'THE RELIQUARY',  col: '#c86bff', scale: 0.76,
                      sub: 'Modules seat in the settings. It holds what should not be held.',
                      geo: buildReliquary() },
    };
    return BUILT;
  }
  ns.CHASSIS = {};
  ns.chassisFor = function (cls) {
    var B = built();
    var c = B[cls] || B.vanguard;
    return { name: c.name, col: c.col, sub: c.sub, slots: c.geo.slots, scale: c.scale };
  };

  /* ---- quaternions (same maths the die uses) --------------------------- */
  function norm3(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; }
  function qMul(a, b) {
    return [a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
            a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
            a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
            a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
  }
  function qFromAxis(ax, ang) {
    var a = norm3(ax), s = Math.sin(ang / 2);
    return [Math.cos(ang / 2), a[0]*s, a[1]*s, a[2]*s];
  }
  function qRot(q, v) {
    var t = [2*(q[2]*v[2]-q[3]*v[1]), 2*(q[3]*v[0]-q[1]*v[2]), 2*(q[1]*v[1]-q[2]*v[0])];
    return [v[0]+q[0]*t[0]+q[2]*t[2]-q[3]*t[1],
            v[1]+q[0]*t[1]+q[3]*t[0]-q[1]*t[2],
            v[2]+q[0]*t[2]+q[1]*t[1]-q[2]*t[0]];
  }

  /* ---- the live view --------------------------------------------------- */
  ns.chassisCreate = function (canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var B = built();
    var ch = B[opts.cls] || B.vanguard;
    var geo = ch.geo, col = ch.col;
    var raf = 0, dead = false, t0 = performance.now(), t = 0;
    var mounted = opts.mounted || [];
    var slotsLive = opts.slots || geo.slots.length;
    var anim = [];
    // a slight fixed tilt so nothing is ever seen perfectly edge-on, plus a
    // slow yaw the player can grab and throw
    var yaw = -0.55, pitch = -0.32, spin = 0.16, drag = null;
    var proj = [];                       // last frame's projected slot points

    function size() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.max(120, r.width), h = Math.max(120, r.height);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      return { w: w, h: h, dpr: dpr };
    }

    function rgba(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n>>16)&255) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')';
    }

    function draw(now) {
      if (dead) return;
      var dt = Math.min(0.05, (now - t0) / 1000 - t);
      t = (now - t0) / 1000;
      if (!drag) yaw += spin * dt;
      var s = size();
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);
      var cx = s.w / 2, cy = s.h / 2;
      var R = Math.min(s.w * 0.40, s.h * 0.62) * (ch.scale || 1);

      var q = qMul(qFromAxis([1, 0, 0], pitch), qFromAxis([0, 1, 0], yaw));
      function P(v) {
        var r = qRot(q, v);
        return [cx + r[0] * R, cy + r[1] * R, r[2]];
      }
      var V = geo.m.v.map(P);

      /* DEPTH IS THE WHOLE POINT of doing this in three dimensions rather than
       * flat: an edge on the far side is dimmer and thinner, so the object has
       * a near face and a far one and you can read which side a module is on. */
      ctx.save();
      ctx.shadowColor = col;
      geo.m.e.forEach(function (pair) {
        var a = V[pair[0]], b = V[pair[1]];
        var z = (a[2] + b[2]) / 2;                 // -1 far .. +1 near
        var k = (z + 1) / 2;
        ctx.globalAlpha = 0.18 + k * 0.72;
        ctx.lineWidth = 0.8 + k * 1.1;
        ctx.shadowBlur = 2 + k * 7;
        ctx.strokeStyle = col;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      });
      ctx.restore();

      var corePt = P(geo.core);
      proj = [];

      // hardpoints, drawn far-to-near so nearer modules overlap further ones
      var order = geo.slots.map(function (sp, i) { return { i: i, p: P(sp) }; })
                           .sort(function (a, b) { return a.p[2] - b.p[2]; });

      order.forEach(function (o) {
        var i = o.i, pt = o.p;
        proj[i] = pt;
        var open = i < slotsLive, filled = !!mounted[i];
        var depth = (pt[2] + 1) / 2;               // 0 far .. 1 near
        var a = anim[i], k = 1;
        if (a != null) {
          var el = t - Math.abs(a), dur = 0.55;
          if (el >= dur) { anim[i] = null; k = 1; }
          else k = a >= 0 ? el / dur : 1 - el / dur;
          k = k < 0 ? 0 : k > 1 ? 1 : k;
        }
        var ease = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3) / 2;

        ctx.save();
        ctx.strokeStyle = open ? col : 'rgba(120,140,150,0.6)';
        ctx.globalAlpha = (open ? (filled ? 0.3 : 0.55) : 0.28) * (0.35 + depth * 0.65);
        ctx.lineWidth = 1.1;
        ctx.setLineDash(open && !filled ? [3, 3] : []);
        ctx.beginPath(); ctx.arc(pt[0], pt[1], R * 0.085 * (0.7 + depth * 0.3), 0, 7); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        if (!filled) return;

        // the tracer, run through the object's own space as the module seats
        ctx.save();
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.34 * ease * (0.3 + depth * 0.7);
        ctx.lineWidth = 1; ctx.shadowColor = col; ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.moveTo(corePt[0], corePt[1]);
        ctx.lineTo(corePt[0] + (pt[0]-corePt[0]) * ease, corePt[1] + (pt[1]-corePt[1]) * ease);
        ctx.stroke();
        ctx.restore();

        // the module flies in along the outward radial in SCREEN space, but its
        // size and brightness follow its depth, so it belongs to the object
        var dx = pt[0]-corePt[0], dy = pt[1]-corePt[1], len = Math.hypot(dx, dy) || 1;
        var fly = (1 - ease) * R * 0.8;
        var mx = pt[0] + (dx/len) * fly, my = pt[1] + (dy/len) * fly;
        var rr = R * 0.075 * (0.62 + ease * 0.38) * (0.62 + depth * 0.38);

        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate((1 - ease) * 1.5);
        ctx.globalAlpha = (0.35 + 0.65 * ease) * (0.4 + depth * 0.6);
        ctx.strokeStyle = col; ctx.lineWidth = 1.4;
        ctx.shadowColor = col; ctx.shadowBlur = 5 + 14 * (1 - ease);
        ctx.beginPath();
        for (var v = 0; v < 6; v++) {
          var ang = -Math.PI/2 + v * Math.PI/3;
          var qx = Math.cos(ang) * rr, qy = Math.sin(ang) * rr;
          if (v === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy);
        }
        ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, rr * 0.34, 0, 7); ctx.stroke();
        ctx.restore();

        if (ease > 0.72 && ease < 1) {
          ctx.save();
          ctx.globalAlpha = (1 - ease) / 0.28 * 0.85;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
          ctx.shadowColor = col; ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.arc(pt[0], pt[1], rr * (1.2 + (1-ease) * 5), 0, 7); ctx.stroke();
          ctx.restore();
        }
      });

      // the core brightens with everything wired into it
      var live = mounted.filter(Boolean).length;
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.09 * live + Math.sin(t * 2.2) * 0.06;
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8 + live * 4;
      ctx.beginPath(); ctx.arc(corePt[0], corePt[1], R * 0.03, 0, 7); ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    /* Grab and turn it. A model you cannot rotate may as well have been drawn
     * flat — being able to look round the back is the reason it is a model. */
    function down(e) {
      drag = { x: e.clientX, y: e.clientY, yaw: yaw, pitch: pitch, moved: false };
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    }
    function move(e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      yaw = drag.yaw + dx * 0.012;
      pitch = Math.max(-1.2, Math.min(1.2, drag.pitch + dy * 0.010));
    }
    function up() { drag = null; }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    return {
      set: function (list, slots) {
        mounted = list.slice();
        if (slots != null) slotsLive = slots;
      },
      seat: function (i) { anim[i] = t; },
      eject: function (i) { anim[i] = -t; },
      dragged: function () { return !!(drag && drag.moved); },
      // hit-test against where the hardpoints ACTUALLY projected this frame
      slotAt: function (px, py) {
        var s = size(), R = Math.min(s.w * 0.40, s.h * 0.62) * (ch.scale || 1);
        var best = -1, bestD = R * 0.16;
        for (var i = 0; i < proj.length; i++) {
          if (!proj[i]) continue;
          var d = Math.hypot(px - proj[i][0], py - proj[i][1]);
          if (d < bestD) { bestD = d; best = i; }
        }
        return best;
      },
      chassis: ch,
      destroy: function () {
        dead = true; if (raf) cancelAnimationFrame(raf);
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', up);
      },
    };
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
