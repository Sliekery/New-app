/* =========================================================================
 * VOIDSPIRE — dieview.js
 * A real icosahedron rendered in the game's neon-vector style. Pick a face and
 * the die physically spins that face toward you.
 *
 * No libraries: 12 vertices, 20 triangles, quaternion slerp, orthographic
 * projection onto a 2D canvas. Faces are tinted by what is engraved on them,
 * so the die itself shows your build at a glance.
 * ========================================================================= */
(function (ns) {
  'use strict';

  var PHI = (1 + Math.sqrt(5)) / 2;

  // 12 vertices of a regular icosahedron.
  var VERTS = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ];
  // 20 triangular faces.
  var FACES = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  // Precompute each face's outward normal and centroid.
  var GEO = FACES.map(function (f) {
    var a = VERTS[f[0]], b = VERTS[f[1]], c = VERTS[f[2]];
    var n = norm(cross(sub(b, a), sub(c, a)));
    var ctr = norm([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
    if (dot(n, ctr) < 0) n = [-n[0], -n[1], -n[2]];   // point outward
    return { idx: f, n: n, c: ctr };
  });

  /* THE NUMBERS FOLLOW A PATH AROUND THE SOLID.
   *
   * A real d20 is numbered so opposite faces sum to 21, which is a fairness
   * convention and nothing else — on a real die, 18 is nowhere near 19.
   *
   * Ours is not a fairness device, it is the board the whole game is played on:
   * a roll fires its face and BLEEDS INTO ITS NEIGHBOURS, and the ring closes so
   * that 20 touches 1. Under the old numbering none of that was visible — the
   * die would tumble across itself to reach a "neighbour", which reads as random
   * rotation rather than as current travelling.
   *
   * So the faces are numbered along a Hamiltonian cycle of the face-adjacency
   * graph: every step from n to n+1 crosses one EDGE, and 20 sits next to 1. The
   * bleed becomes a hop to the face next door, and the ring is a real loop you
   * can watch. The solid now encodes the rules.
   *
   * This is a rendering change only. Every rule in the game addresses faces by
   * NUMBER and the number ring is unchanged, so saved dice are unaffected.
   * -------------------------------------------------------------------- */
  var FACE_NUM = (function () {
    // two faces are adjacent when they share an edge — exactly 2 vertices
    var adj = FACES.map(function (f, i) {
      var out = [];
      for (var j = 0; j < FACES.length; j++) {
        if (j === i) continue;
        var shared = 0;
        for (var k = 0; k < 3; k++) if (FACES[j].indexOf(f[k]) >= 0) shared++;
        if (shared === 2) out.push(j);
      }
      return out;
    });
    // Deterministic DFS: fixed start, neighbours in ascending index order, so
    // the numbering is identical in every session and on every machine.
    var path = [0], seen = new Array(20), found = null;
    seen[0] = true;
    (function dfs() {
      if (found) return;
      var cur = path[path.length - 1];
      if (path.length === 20) { if (adj[cur].indexOf(0) >= 0) found = path.slice(); return; }
      var nb = adj[cur].slice().sort(function (a, b) { return a - b; });
      for (var k = 0; k < nb.length && !found; k++) {
        var v = nb[k];
        if (seen[v]) continue;
        seen[v] = true; path.push(v);
        dfs();
        if (found) return;
        path.pop(); seen[v] = false;
      }
    })();
    var num = new Array(20);
    (found || path).forEach(function (faceIdx, i) { num[faceIdx] = i + 1; });
    return num;
  })();
  var NUM_FACE = {};
  FACE_NUM.forEach(function (n, i) { NUM_FACE[n] = i; });

  /* ---- quaternions ---------------------------------------------------- */
  function qMul(a, b) {
    return [
      a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
      a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
      a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
      a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    ];
  }
  function qFromAxis(ax, ang) {
    var a = norm(ax), s = Math.sin(ang / 2);
    return [Math.cos(ang / 2), a[0] * s, a[1] * s, a[2] * s];
  }
  function qNorm(q) { var l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
  function qSlerp(a, b, t) {
    var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) { b = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
    if (d > 0.9995) return qNorm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]);
    var th = Math.acos(d), s = Math.sin(th);
    var wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb];
  }
  function qRot(q, v) {   // rotate vector by quaternion
    var t = [2 * (q[2] * v[2] - q[3] * v[1]), 2 * (q[3] * v[0] - q[1] * v[2]), 2 * (q[1] * v[1] - q[2] * v[0])];
    return [
      v[0] + q[0] * t[0] + q[2] * t[2] - q[3] * t[1],
      v[1] + q[0] * t[1] + q[3] * t[0] - q[1] * t[2],
      v[2] + q[0] * t[2] + q[1] * t[1] - q[2] * t[0],
    ];
  }
  // The rotation that brings face normal `n` to face the camera (+Z).
  function qFacing(n) {
    var z = [0, 0, 1], d = dot(n, z);
    if (d > 0.9999) return [1, 0, 0, 0];
    if (d < -0.9999) return qFromAxis([0, 1, 0], Math.PI);
    return qNorm(qFromAxis(cross(n, z), Math.acos(Math.max(-1, Math.min(1, d)))));
  }

  /* ---- the view -------------------------------------------------------- */
  ns.dieViewCreate = function (canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var raf = 0, dead = false;
    var q = qFacing(GEO[NUM_FACE[opts.face || 20]].n);   // start showing a face
    var qFrom = q, qTo = q, spinT = 1, spinDur = 0.72, spinStart = 0;
    var face = opts.face || 20;
    var tint = opts.tint || function () { return null; };   // face number -> {col, flaw} | null
    // Whose die this is, said in colour. The die screen keeps the house green;
    // in combat it takes the class palette, because a Technomancer's die being
    // cyan is the same information his band labels carry.
    var COL = opts.col || '#5dff88';
    var COL_HI = opts.colHi || '#7dffa8';
    var COL_DIM = opts.colDim || '#5e8a6c';
    var COL_TXT = opts.colTxt || '#d6ffe4';
    function rgbaOf(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    var idle = 0;

    function size() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.max(80, r.width), h = Math.max(80, r.height);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      return { w: w, h: h, dpr: dpr };
    }

    function draw(now) {
      if (dead) return;
      var s = size();
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);

      // ease the spin
      if (spinT < 1) {
        spinT = Math.min(1, (now - spinStart) / (spinDur * 1000));
        var e = spinT < 0.5 ? 4 * spinT * spinT * spinT : 1 - Math.pow(-2 * spinT + 2, 3) / 2;   // easeInOutCubic
        q = qSlerp(qFrom, qTo, e);
      } else {
        idle += 0.0035;   // a slow living drift once settled
        q = qMul(qFromAxis([0.35, 1, 0.15], Math.sin(idle) * 0.05), qTo);
      }

      var cx = s.w / 2, cy = s.h / 2, R = Math.min(s.w, s.h) * 0.36;
      var P = VERTS.map(function (v) { var r = qRot(q, norm(v)); return [cx + r[0] * R, cy - r[1] * R, r[2]]; });

      // sort faces back-to-front so the near shell draws over the far one
      var order = GEO.map(function (g, i) { return { i: i, z: qRot(q, g.c)[2] }; })
                     .sort(function (a, b) { return a.z - b.z; });

      order.forEach(function (o) {
        var g = GEO[o.i], n = qRot(q, g.n), front = n[2] > 0.02;
        var num = FACE_NUM[o.i];
        var t = tint(num);
        var a = P[g.idx[0]], b = P[g.idx[1]], c = P[g.idx[2]];
        var lift = Math.max(0, n[2]);                 // how square-on the face is

        ctx.beginPath();
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();

        if (front && t) {                              // engraved faces glow in their colour
          ctx.fillStyle = t.flaw ? 'rgba(255,74,94,' + (0.10 + lift * 0.26) + ')'
                                 : rgbaOf(COL, 0.09 + lift * 0.24);
          ctx.fill();
        }
        var isSel = (num === face) && lift > 0.8;
        ctx.strokeStyle = isSel ? '#ffffff' : front ? (t ? (t.flaw ? '#ff8a99' : COL_HI) : COL_DIM)
                                                    : rgbaOf(COL_DIM, 0.22);
        ctx.lineWidth = isSel ? 2 : front ? 1.2 : 0.8;
        ctx.shadowColor = isSel ? '#ffffff' : (t && front ? (t.flaw ? '#ff4a5e' : COL) : 'transparent');
        ctx.shadowBlur = isSel ? 12 : (t && front ? 8 : 0);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // number, only on faces turned toward us
        if (front && lift > 0.28) {
          var m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
          var fs = Math.max(8, R * 0.30 * (0.55 + lift * 0.45));
          ctx.globalAlpha = Math.min(1, (lift - 0.28) / 0.4);
          ctx.font = 'bold ' + fs.toFixed(1) + 'px ui-monospace, monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = isSel ? '#ffffff' : t ? (t.flaw ? '#ffc4cc' : COL_TXT) : COL_DIM;
          ctx.fillText(String(num), m[0], m[1]);
          ctx.globalAlpha = 1;
        }
      });

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return {
      /* Spin so `n` faces the camera. `flair` adds a full tumble on the way.
       * `dur` overrides the settle time, which is what makes a trigger CHAIN
       * possible: links land 110ms apart, and at the default 600ms the die
       * would still be turning toward link 2 while the receipt printed link 5.
       * A chain hop crosses one edge, so it wants ~180ms, not a tumble. */
      setFace: function (n, flair, dur) {
        if (!NUM_FACE.hasOwnProperty(n)) return;
        face = n;
        qFrom = q;
        var target = qFacing(GEO[NUM_FACE[n]].n);
        if (flair) target = qMul(target, qFromAxis([0.2, 1, 0.1], Math.PI * 2));
        qTo = target;
        spinT = 0; spinStart = performance.now();
        spinDur = dur != null ? dur : (flair ? 0.95 : 0.6);
      },
      face: function () { return face; },
      destroy: function () { dead = true; if (raf) cancelAnimationFrame(raf); },
    };
  };

  ns.dieFaceNumbers = FACE_NUM;

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
