/* =========================================================================
 * VOIDSPIRE — chassis.js
 * THE MODULE BAY: relics, drawn as hardware going into a thing.
 *
 * Relics used to be a row of 22px chips at the bottom of the die screen, below
 * the engraving list, readable only by hovering for a title attribute. They are
 * one of the three systems a run is actually built out of and they were the
 * hardest thing in the game to look at.
 *
 * So they get their own screen, and the screen is not a list. Each class has a
 * CHASSIS — the Vanguard's rifle, the Technomancer's reactor frame, the Void
 * Adept's reliquary — with hardpoints cut into it. Mounting a relic flies it to
 * a hardpoint and seats it, and a tracer runs from the hardpoint back to the
 * core so a mounted module is visibly WIRED IN rather than merely listed.
 *
 * Vector line art in the house style: everything here is polylines in a -1..1
 * box, stroked live, so it costs nothing and matches the enemies and the cards.
 * ========================================================================= */
(function (ns) {
  'use strict';

  /* ---- the three chassis -------------------------------------------------
   * `p` are polylines. `slots` are hardpoints in the same space, in mount
   * order. `core` is where the tracers run back to. */
  ns.CHASSIS = {
    vanguard: {
      name: 'THE RIFLE', col: '#ffb02e', scale: 1.34,
      sub: 'Modules seat along the rail. What you bolt on is what it becomes.',
      p: [
        // receiver
        [-0.72, 0.06, 0.34, 0.06, 0.34, 0.26, -0.72, 0.26, -0.72, 0.06],
        // barrel and shroud
        [0.34, 0.11, 0.92, 0.11, 0.92, 0.21, 0.34, 0.21],
        [0.52, 0.09, 0.52, 0.23], [0.64, 0.09, 0.64, 0.23], [0.76, 0.09, 0.76, 0.23],
        // top rail — the hardpoints live along here
        [-0.66, -0.02, 0.30, -0.02], [-0.66, -0.02, -0.66, 0.06], [0.30, -0.02, 0.30, 0.06],
        // stock
        [-0.72, 0.10, -0.95, 0.20, -0.95, 0.34, -0.72, 0.26],
        // grip and trigger guard
        [-0.30, 0.26, -0.38, 0.56, -0.22, 0.58, -0.16, 0.26],
        [-0.12, 0.26, -0.10, 0.40, 0.04, 0.42, 0.08, 0.26],
        // magazine
        [0.06, 0.26, 0.10, 0.62, 0.30, 0.62, 0.28, 0.26],
        // sight post
        [0.86, 0.11, 0.86, 0.02, 0.90, 0.02],
      ],
      slots: [[-0.50, -0.02], [-0.24, -0.02], [0.02, -0.02], [0.26, -0.02], [0.58, 0.05], [-0.84, 0.20]],
      core: [-0.20, 0.16],
    },
    technomancer: {
      name: 'THE FRAME', col: '#41d8ff', scale: 1.0,
      sub: 'Modules seat in the ring. Power is what you route, not what you carry.',
      p: [
        // outer ring
        [0, -0.78, 0.68, -0.39, 0.68, 0.39, 0, 0.78, -0.68, 0.39, -0.68, -0.39, 0, -0.78],
        // inner reactor
        [0, -0.30, 0.26, -0.15, 0.26, 0.15, 0, 0.30, -0.26, 0.15, -0.26, -0.15, 0, -0.30],
        [0, -0.14, 0.12, -0.07, 0.12, 0.07, 0, 0.14, -0.12, 0.07, -0.12, -0.07, 0, -0.14],
        // spars
        [0, -0.78, 0, -0.30], [0.68, -0.39, 0.26, -0.15], [0.68, 0.39, 0.26, 0.15],
        [0, 0.78, 0, 0.30], [-0.68, 0.39, -0.26, 0.15], [-0.68, -0.39, -0.26, -0.15],
        // mounting brackets
        [-0.10, -0.86, 0.10, -0.86], [0.76, -0.45, 0.86, -0.28], [0.76, 0.45, 0.86, 0.28],
        [-0.10, 0.86, 0.10, 0.86], [-0.76, 0.45, -0.86, 0.28], [-0.76, -0.45, -0.86, -0.28],
      ],
      slots: [[0, -0.78], [0.68, -0.39], [0.68, 0.39], [0, 0.78], [-0.68, 0.39], [-0.68, -0.39]],
      core: [0, 0],
    },
    voidadept: {
      name: 'THE RELIQUARY', col: '#c86bff', scale: 1.05,
      sub: 'Modules seat in the settings. It holds what should not be held.',
      p: [
        // the heart-cage
        [0, 0.84, -0.62, -0.06, -0.34, -0.56, 0, -0.24, 0.34, -0.56, 0.62, -0.06, 0, 0.84],
        [0, -0.24, 0, 0.48],
        [-0.40, -0.14, 0.40, -0.14],
        // ribs
        [-0.46, 0.10, 0.46, 0.10], [-0.30, 0.36, 0.30, 0.36],
        // crown settings
        [-0.34, -0.56, -0.40, -0.78], [0.34, -0.56, 0.40, -0.78], [0, -0.24, 0, -0.62],
        // suspension chains
        [-0.62, -0.06, -0.80, -0.30], [0.62, -0.06, 0.80, -0.30],
      ],
      slots: [[0, -0.62], [-0.40, -0.78], [0.40, -0.78], [-0.46, 0.10], [0.46, 0.10], [0, 0.56]],
      core: [0, 0.06],
    },
  };

  ns.chassisFor = function (cls) { return ns.CHASSIS[cls] || ns.CHASSIS.vanguard; };

  /* ---- the live view -----------------------------------------------------
   * mounted: array of relic ids in slot order. Calling `seat(i)` plays the
   * install for slot i; `eject(i)` plays it backwards. */
  ns.chassisCreate = function (canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var ch = ns.chassisFor(opts.cls);
    var col = ch.col;
    var raf = 0, dead = false, t0 = performance.now(), t = 0;
    var mounted = opts.mounted || [];
    var slotsLive = opts.slots || ch.slots.length;
    // per-slot animation clocks: >=0 means seating, <0 means ejecting
    var anim = [];

    function size() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.max(120, r.width), h = Math.max(120, r.height);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      return { w: w, h: h, dpr: dpr };
    }

    function draw(now) {
      if (dead) return;
      t = (now - t0) / 1000;
      var s = size();
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);
      var cx = s.w / 2, cy = s.h / 2;
      // fit to BOTH axes, then apply the chassis's own aspect correction
      var R = Math.min(s.w * 0.46, s.h * 0.46) * (ch.scale || 1);
      function P(x, y) { return [cx + x * R, cy + y * R]; }

      // ---- the chassis itself, breathing very slightly
      var breathe = 1 + Math.sin(t * 0.8) * 0.004;
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.85; ctx.shadowColor = col; ctx.shadowBlur = 7;
      ch.p.forEach(function (poly) {
        ctx.beginPath();
        for (var i = 0; i < poly.length; i += 2) {
          var q = P(poly[i] * breathe, poly[i + 1] * breathe);
          if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
        }
        ctx.stroke();
      });
      ctx.restore();

      var corePt = P(ch.core[0], ch.core[1]);

      // ---- hardpoints
      ch.slots.forEach(function (sp, i) {
        var open = i < slotsLive;
        var pt = P(sp[0], sp[1]);
        var filled = !!mounted[i];
        var a = anim[i];
        var k = 1;                                  // 0..1 seating progress
        if (a != null) {
          var el = t - Math.abs(a);
          var dur = 0.55;
          if (el >= dur) { anim[i] = null; k = 1; }
          else k = a >= 0 ? el / dur : 1 - el / dur;
          k = k < 0 ? 0 : k > 1 ? 1 : k;
        }
        var ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

        // the empty socket
        ctx.save();
        ctx.strokeStyle = open ? col : 'rgba(120,140,150,0.45)';
        ctx.globalAlpha = open ? (filled ? 0.35 : 0.5) : 0.3;
        ctx.lineWidth = 1.2;
        ctx.setLineDash(open && !filled ? [3, 3] : []);
        ctx.beginPath(); ctx.arc(pt[0], pt[1], R * 0.095, 0, 7); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        if (!filled) return;

        // the tracer back to the core — drawn as it seats, so the module
        // visibly WIRES IN rather than just appearing
        ctx.save();
        ctx.strokeStyle = col; ctx.globalAlpha = 0.30 * ease;
        ctx.lineWidth = 1; ctx.shadowColor = col; ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.moveTo(corePt[0], corePt[1]);
        ctx.lineTo(corePt[0] + (pt[0] - corePt[0]) * ease, corePt[1] + (pt[1] - corePt[1]) * ease);
        ctx.stroke();
        ctx.restore();

        // the module: flies in from outside along the socket's own radial
        var dx = pt[0] - corePt[0], dy = pt[1] - corePt[1];
        var len = Math.hypot(dx, dy) || 1;
        var fly = (1 - ease) * R * 0.75;
        var mx = pt[0] + (dx / len) * fly, my = pt[1] + (dy / len) * fly;
        var rr = R * 0.085 * (0.62 + ease * 0.38);

        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate((1 - ease) * 1.4 + Math.sin(t * 0.6 + i) * 0.03);
        ctx.globalAlpha = 0.35 + 0.65 * ease;
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.shadowColor = col; ctx.shadowBlur = 6 + 14 * (1 - ease);
        // a hex module blank
        ctx.beginPath();
        for (var v = 0; v < 6; v++) {
          var ang = -Math.PI / 2 + v * Math.PI / 3;
          var qx = Math.cos(ang) * rr, qy = Math.sin(ang) * rr;
          if (v === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy);
        }
        ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, rr * 0.34, 0, 7); ctx.stroke();
        ctx.restore();

        // the seat flash
        if (ease > 0.72 && ease < 1) {
          ctx.save();
          ctx.globalAlpha = (1 - ease) / 0.28 * 0.8;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
          ctx.shadowColor = col; ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.arc(pt[0], pt[1], rr * (1.2 + (1 - ease) * 5), 0, 7); ctx.stroke();
          ctx.restore();
        }
      });

      // ---- the core, brighter the more is wired into it
      var live = mounted.filter(Boolean).length;
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.1 * live + Math.sin(t * 2.2) * 0.06;
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8 + live * 4;
      ctx.beginPath(); ctx.arc(corePt[0], corePt[1], R * 0.032, 0, 7); ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return {
      set: function (list, slots) {
        mounted = list.slice();
        if (slots != null) slotsLive = slots;
      },
      seat: function (i) { anim[i] = t; },
      eject: function (i) { anim[i] = -t; },
      slotAt: function (px, py) {
        // which hardpoint a tap landed on, in CSS pixels
        var s = size(), cx = s.w / 2, cy = s.h / 2;
        var R = Math.min(s.w * 0.46, s.h * 0.46) * (ch.scale || 1);
        for (var i = 0; i < ch.slots.length; i++) {
          var x = cx + ch.slots[i][0] * R, y = cy + ch.slots[i][1] * R;
          if (Math.hypot(px - x, py - y) < R * 0.14) return i;
        }
        return -1;
      },
      chassis: ch,
      destroy: function () { dead = true; if (raf) cancelAnimationFrame(raf); },
    };
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
