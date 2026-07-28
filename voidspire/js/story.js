/* =========================================================================
 * VOIDSPIRE — story.js
 * The overarching narrative, and the cutscenes that carry it.
 *
 * REGISTER — everything written here follows one rule: the game never explains
 * itself. What the Spire is, why you are in it, and what you are counting
 * toward are never stated. They are implied by ruins, by habits, by what the
 * dying half-remember. Speakers are mad, wrong, or talking to someone else.
 * The player's own motive is never named. Concrete images do the work that
 * exposition would otherwise do.
 *
 * The thing being implied, for whoever maintains this:
 *
 *   The Spire goes DOWN, and everything that falls into it is COUNTED. At the
 *   bottom is the UNMAKER, which is not a guardian but a tally — killing it
 *   does not end the count, it rolls it over. That is the Recurrence.
 *   Before the Spire fell it was a HEART. Someone broke it. The Spire has been
 *   trying to finish the sum ever since.
 *   Everyone who descends carries a DIE. Nobody remembers being given one.
 *   The die is how the Spire reads you: engravings are answers, Flaws are its
 *   corrections.
 *   The three factions are three wrong answers to the same question. The
 *   Hierarchy decided the unmaking is a grace and descend to receive it. The
 *   Rust Legion came to measure the Spire and were measured instead; nobody
 *   told them to stop. The Voidspawn are what comes back up.
 *   You have done this before. Everything down here half-recognises you.
 *
 * None of the above is ever said out loud in-game. Keep it that way.
 * ========================================================================= */
(function (ns) {
  'use strict';

  /* ---- scene art -----------------------------------------------------
   * Same vector language as the rest of the game — polylines in a box,
   * stroked and glowing — but composed in LAYERS so a scene can drift with
   * parallax. x runs -1..1, y runs -0.6..0.6 (a wide cinematic panel).
   * `d` is depth: 0 = far and slow, 1 = near and fast.
   * ------------------------------------------------------------------ */
  function ring(cy, rx, ry, n) {          // an ellipse, as a closed polyline
    var p = [];
    for (var i = 0; i <= (n || 28); i++) {
      var a = (i / (n || 28)) * Math.PI * 2;
      p.push(+(Math.cos(a) * rx).toFixed(3), +(cy + Math.sin(a) * ry).toFixed(3));
    }
    return p;
  }
  function arc(cx, cy, r, a0, a1, n) {    // an open arc
    var p = [];
    for (var i = 0; i <= (n || 18); i++) {
      var a = a0 + (a1 - a0) * (i / (n || 18));
      p.push(+(cx + Math.cos(a) * r).toFixed(3), +(cy + Math.sin(a) * r).toFixed(3));
    }
    return p;
  }
  function tallies(x0, y0, rows, per, dx, dy) {   // scratched count marks
    var out = [];
    for (var r = 0; r < rows; r++) {
      for (var i = 0; i < per; i++) {
        var x = x0 + i * dx, y = y0 + r * dy;
        // every fifth mark is the stroke that crosses the other four
        if (i % 5 === 4) out.push([x - dx * 3.6, y + 0.032, x + dx * 0.5, y - 0.032]);
        else out.push([x, y - 0.036, x + dx * 0.18, y + 0.036]);
      }
    }
    return out;
  }
  function teeth(cy, r, n, len) {          // gear teeth around a ring
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      out.push([+(Math.cos(a) * r).toFixed(3), +(cy + Math.sin(a) * r * 0.42).toFixed(3),
                +(Math.cos(a) * (r + len)).toFixed(3), +(cy + Math.sin(a) * (r + len) * 0.42).toFixed(3)]);
    }
    return out;
  }
  // The Spire seen down its own throat: concentric rings receding to a point,
  // with ribs joining them so the eye reads depth rather than a flat target.
  function tunnel(cy, n, rx, shrink, ribs) {
    var out = [], r = rx, i;
    for (i = 0; i < n; i++) { out.push(ring(cy, r, r * 0.34, 26)); r *= shrink; }
    var inner = r / shrink;
    for (i = 0; i < (ribs || 0); i++) {
      var a = (i / ribs) * Math.PI * 2 + 0.3;
      out.push([+(Math.cos(a) * rx).toFixed(3), +(cy + Math.sin(a) * rx * 0.34).toFixed(3),
                +(Math.cos(a) * inner).toFixed(3), +(cy + Math.sin(a) * inner * 0.34).toFixed(3)]);
    }
    return out;
  }
  // A circle drawn as `n` arcs with gaps between them — the more gaps, the more
  // of it is missing. Rings of increasing brokenness read as a shape ending.
  function broken(cx, cy, r, n, keep, phase) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var a0 = (i / n) * Math.PI * 2 + (phase || 0);
      out.push(arc(cx, cy, r, a0, a0 + (Math.PI * 2 / n) * keep, 10));
    }
    return out;
  }
  // A run of short strokes along a path — used for edges that are crumbling,
  // or for a shape in the act of being deleted.
  function dashes(x0, y0, x1, y1, n, len) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      var dx = (x1 - x0), dy = (y1 - y0), m = Math.sqrt(dx * dx + dy * dy) || 1;
      var l = len * (0.25 + t * 0.75);   // sparser and shorter toward the start
      out.push([+(x - dx / m * l).toFixed(3), +(y - dy / m * l).toFixed(3),
                +(x + dx / m * l).toFixed(3), +(y + dy / m * l).toFixed(3)]);
    }
    return out;
  }
  ns.SCENES = {
    /* --- it does not stop when it dies ------------------------------- */
    corpse: { layers: [
      { d: 0, p: [[-1, 0.5, 1, 0.5], [-0.96, 0.5, -0.96, -0.22], [-0.84, 0.5, -0.84, 0.04],
                  [0.88, 0.5, 0.88, -0.14], [0.98, 0.5, 0.98, 0.08], [-1, 0.08, -0.96, 0.08]] },
      { d: 0.45, p: [
        // a big thing down on its side: back, flank and the deck it is lying on
        [-0.82, 0.5, -0.76, 0.2, -0.56, 0.02, -0.24, -0.08, 0.1, -0.06, 0.4, 0.06, 0.62, 0.26, 0.74, 0.5],
        [-0.82, 0.5, -0.48, 0.42, -0.04, 0.44, 0.36, 0.42, 0.74, 0.5],
        // the head plate, and the socket that is still lit
        [-0.78, 0.28, -0.7, 0.04, -0.46, -0.04, -0.32, 0.12, -0.4, 0.36, -0.78, 0.28],
        [-0.66, 0.34, -0.42, 0.26],
        // spines out of the back, rooted where the back line bends
        [-0.56, 0.02, -0.66, -0.3], [-0.66, -0.3, -0.6, -0.36],
        [-0.24, -0.08, -0.24, -0.42], [-0.24, -0.42, -0.17, -0.47],
        [0.1, -0.06, 0.22, -0.38], [0.22, -0.38, 0.29, -0.42],
        // a limb folded under it
        [0.4, 0.06, 0.56, 0.2, 0.44, 0.34, 0.5, 0.48],
      ] },
      { d: 1, p: [arc(-0.56, 0.16, 0.11, 0, Math.PI * 2, 16), arc(-0.56, 0.16, 0.05, 0, Math.PI * 2, 12),
                  // it is still venting, slower than it was
                  [0.16, -0.12, 0.24, -0.28, 0.16, -0.42, 0.24, -0.56]],
        s: [[-0.56, 0.16]] },
    ] },

    /* --- you look for the floor -------------------------------------- */
    descent: { layers: [
      { d: 0, p: tunnel(0.04, 7, 0.94, 0.72, 8) },
      { d: 0.5, p: [ring(0.04, 0.2, 0.068, 20), ring(0.04, 0.14, 0.048, 16)] },
      { d: 1, p: [], s: [[-0.4, 0.14], [0.3, -0.1], [0.52, 0.2], [-0.22, -0.16], [0.1, 0.26]] },
    ] },

    /* --- something is cut into your die that you did not cut ---------- */
    die: { layers: [
      { d: 0, p: tunnel(-0.42, 4, 0.26, 0.66, 5).concat([[-1, 0.5, 1, 0.5]]) },
      { d: 0.6, p: [
        [0, -0.44, 0.46, -0.19, 0.46, 0.31, 0, 0.56, -0.46, 0.31, -0.46, -0.19, 0, -0.44],
        [0, -0.44, 0, 0.0], [-0.46, -0.19, 0, 0.0], [0.46, -0.19, 0, 0.0],
        [0, 0.0, -0.46, 0.31], [0, 0.0, 0.46, 0.31], [0, 0.0, 0, 0.56],
      ] },
      // three old marks worn into the left face; one on the right, freshly cut
      { d: 1, p: [
        [-0.3, 0.14, -0.26, 0.3], [-0.22, 0.1, -0.18, 0.26], [-0.14, 0.06, -0.1, 0.22],
        [0.12, 0.08, 0.2, 0.3, 0.32, 0.12],
      ], s: [[0.2, 0.3]] },
    ] },

    /* --- someone kept count here ------------------------------------- */
    marks: { layers: [
      { d: 0, p: [[-1, -0.46, 1, -0.46], [-1, 0.5, 1, 0.5], [-0.5, -0.46, -0.5, 0.5], [0.56, -0.46, 0.56, 0.5],
                  [-1, -0.32, -0.5, -0.32], [0.56, -0.32, 1, -0.32]] },
      { d: 0.4, p: tallies(-0.9, -0.16, 4, 15, 0.055, 0.19) },
      // the count runs off the plate and keeps going into the weld
      { d: 0.9, p: tallies(0.64, -0.16, 4, 6, 0.055, 0.19).concat([[0.98, -0.16, 1.02, -0.16], [0.98, 0.22, 1.02, 0.22]]) },
    ] },

    /* --- the armour is yours ----------------------------------------- */
    other: { layers: [
      { d: 0, p: [[-1, 0.5, 1, 0.5], [-0.66, 0.5, -0.66, -0.6], [0.66, 0.5, 0.66, -0.6], [-0.66, -0.02, 0.66, -0.02],
                  [-0.66, 0.26, -0.5, 0.26], [0.5, 0.26, 0.66, 0.26]] },
      { d: 0.5, p: [
        // seated, head fallen to the shoulder, faceplate turned to the wall
        [-0.3, -0.32, -0.16, -0.44, 0.0, -0.4, 0.04, -0.24, -0.06, -0.16, -0.24, -0.2, -0.3, -0.32],
        [-0.26, -0.28, -0.08, -0.24],
        [-0.06, -0.2, 0.02, -0.1],
        [-0.26, -0.1, 0.26, -0.1],
        [-0.22, -0.1, -0.18, 0.28, 0.2, 0.28, 0.24, -0.1],
        [-0.26, -0.1, -0.42, 0.12, -0.3, 0.32], [0.26, -0.1, 0.42, 0.1, 0.3, 0.3],
        [-0.18, 0.28, -0.32, 0.5], [0.2, 0.28, 0.34, 0.5],
        [-0.09, 0.02, 0.11, 0.02], [-0.05, 0.1, 0.07, 0.1],
      ] },
      // the same die, out of the hand and lying where it stopped
      { d: 1, p: [[-0.54, 0.36, -0.44, 0.3, -0.34, 0.36, -0.34, 0.48, -0.44, 0.54, -0.54, 0.48, -0.54, 0.36],
                  [-0.44, 0.3, -0.44, 0.42], [-0.54, 0.36, -0.44, 0.42], [-0.34, 0.36, -0.44, 0.42]] },
    ] },

    /* --- there are rings above you too -------------------------------- */
    above: { layers: [
      { d: 0, p: tunnel(-0.34, 5, 0.62, 0.7, 6) },
      { d: 0.55, p: tunnel(0.36, 5, 0.62, 0.7, 6) },
      { d: 1, p: [[-1, 0.01, -0.16, 0.01], [0.16, 0.01, 1, 0.01]], s: [[0, 0.01]] },
    ] },

    /* --- a machine for being sure ------------------------------------ */
    engine: { layers: [
      { d: 0, p: [ring(0, 0.92, 0.4, 34)].concat(teeth(0, 0.92, 26, 0.09)) },
      { d: 0.5, p: [ring(0, 0.56, 0.24, 28)].concat(teeth(0, 0.56, 18, 0.08)) },
      { d: 1, p: [ring(0, 0.22, 0.1, 20), [-0.22, 0, 0.22, 0], [0, -0.1, 0, 0.1]], s: [[0, 0]] },
    ] },

    /* --- your number is here, and it is not new ----------------------- */
    ledger: { layers: [
      { d: 0, p: [[-0.8, -0.56, -0.8, 0.56], [-0.28, -0.56, -0.28, 0.56], [0.24, -0.56, 0.24, 0.56], [0.76, -0.56, 0.76, 0.56]] },
      { d: 0.4, p: (function () {
        var o = [];
        for (var c = 0; c < 4; c++) for (var r = 0; r < 9; r++) {
          var x = -0.96 + c * 0.52, y = -0.46 + r * 0.115;
          o.push([x, y, x + 0.3, y]);
        }
        return o;
      })() },
      // one entry, boxed — and struck through, and struck through again
      { d: 1, p: [
        [-0.5, 0.005, -0.5, 0.11, -0.16, 0.11, -0.16, 0.005, -0.5, 0.005],
        [-0.52, 0.1, -0.14, 0.015], [-0.52, 0.02, -0.14, 0.105], [-0.52, 0.058, -0.14, 0.058],
      ] },
    ] },

    /* --- the floor has been waiting to open --------------------------- */
    aperture: { layers: [
      { d: 0, p: [ring(0, 0.94, 0.42, 30), ring(0, 0.72, 0.32, 28)] },
      { d: 0.5, p: (function () {
        var o = [];
        for (var i = 0; i < 9; i++) {
          var a = (i / 9) * Math.PI * 2;
          o.push([+(Math.cos(a) * 0.7).toFixed(3), +(Math.sin(a) * 0.3).toFixed(3),
                  +(Math.cos(a + 0.5) * 0.24).toFixed(3), +(Math.sin(a + 0.5) * 0.1).toFixed(3)]);
        }
        return o;
      })() },
      { d: 1, p: [ring(0, 0.2, 0.085, 20)] },
    ] },

    /* --- it does not die, it finishes --------------------------------- */
    unmade: { layers: [
      // its outline, intact at the edge and less of it the further in you look
      { d: 0, p: broken(0, 0, 0.5, 7, 0.82, 0.2).concat(broken(0, 0, 0.42, 7, 0.6, 0.6)) },
      { d: 0.5, p: broken(0, 0, 0.3, 6, 0.42, 0.1).concat(broken(0, 0, 0.2, 5, 0.26, 0.9)) },
      { d: 1, p: [ring(0, 0.04, 0.04, 12)].concat(
          dashes(-0.56, -0.34, -0.1, -0.06, 5, 0.028))
          .concat(dashes(0.56, 0.34, 0.1, 0.06, 5, 0.028))
          .concat(dashes(0.5, -0.4, 0.09, -0.07, 5, 0.028))
          .concat(dashes(-0.5, 0.4, -0.09, 0.07, 5, 0.028)),
        s: [[0, 0]] },
    ] },

    /* --- far under everything: the Heart ------------------------------ */
    heart: { layers: [
      { d: 0, p: tunnel(-0.44, 4, 0.3, 0.66, 5) },
      { d: 0.5, p: [
        // a core broken open at the top and cold a long time — shells inside shells
        arc(0, 0.14, 0.4, -Math.PI * 0.35, Math.PI * 1.35, 28),
        [-0.181, -0.216, -0.1, -0.09, -0.02, -0.185, 0.06, -0.07, 0.14, -0.165, 0.181, -0.216],
        arc(0, 0.14, 0.26, -Math.PI * 0.4, Math.PI * 1.4, 22),
        arc(0, 0.14, 0.13, -Math.PI * 0.45, Math.PI * 1.45, 16),
      ] },
      // hairline cracks across the shell, going nowhere
      { d: 1, p: [[-0.38, 0.06, -0.29, 0.16], [0.36, 0.1, 0.27, 0.19], [-0.08, 0.53, -0.03, 0.44],
                  [0.16, 0.5, 0.21, 0.41], [-0.3, 0.4, -0.24, 0.32]] },
    ] },

    /* --- the die rolls, and comes up a face you have not seen ---------- */
    rollover: { layers: [
      { d: 0, p: tunnel(-0.4, 4, 0.34, 0.68, 5) },
      { d: 0.5, p: [[-1, 0.46, 1, 0.46], [-0.6, 0.46, -0.5, 0.34], [0.62, 0.46, 0.52, 0.34]] },
      { d: 1, p: [
        [-0.24, 0.46, -0.24, 0.14, 0, 0.0, 0.24, 0.14, 0.24, 0.46, 0, 0.6, -0.24, 0.46],
        [0, 0.0, 0, 0.3], [-0.24, 0.14, 0, 0.3], [0.24, 0.14, 0, 0.3],
        [-0.16, 0.36, -0.08, 0.44], [0.08, 0.44, 0.16, 0.36],
      ], s: [[0, 0.3]] },
    ] },
  };

  /* ---- the cutscenes -------------------------------------------------
   * One per sector boss. `panels` are shown in order, each a scene plus its
   * narration; the player taps through them.
   * ------------------------------------------------------------------ */
  ns.CUTSCENES = [
    { id: 'upper', title: 'THE UPPER WORKS', color: '#9fe8c0', panels: [
      { scene: 'corpse',
        text: 'It does not stop when it dies. Whatever it was doing, it goes on doing — slower, and without much interest in you.' },
      { scene: 'descent',
        text: 'You look for the floor. There are rings under the rings, and lights on them, moving the way you move.' },
      { scene: 'die',
        text: 'There is a mark on your die that you did not cut. You go on down. It seems to be the arrangement.' },
    ] },
    { id: 'mark', title: 'THE MARK', color: '#6fd0ff', panels: [
      { scene: 'marks',
        text: 'Someone kept count on this plate. The marks run off the edge of it, into the weld, into the dark past the weld.' },
      { scene: 'other',
        text: 'The armour is yours. The face is turned away, and you have the good sense to leave it turned away.' },
      { scene: 'above',
        text: 'You look up, out of habit. There are rings above you as well. You do not remember coming past them.' },
    ] },
    { id: 'count', title: 'THE COUNT', color: '#ffb02e', panels: [
      { scene: 'engine',
        text: 'It is not a machine for making anything. It is a machine for being sure.' },
      { scene: 'ledger',
        text: 'Your number is here, and it is not new. It has been struck through. It has been struck through a great many times.' },
      { scene: 'aperture',
        text: 'The floor was never a floor. It has been waiting the way a mouth waits.' },
    ] },
    { id: 'floor', title: 'THE FLOOR', color: '#b8ecff', panels: [
      { scene: 'unmade',
        text: 'It does not die. It finishes. There is a difference, and you feel it go out of you as well.' },
      { scene: 'heart',
        text: 'Under everything, cold a long time: the thing the Spire was before it learned to fall. Whatever is still being counted is counted toward that.' },
      { scene: 'rollover',
        text: 'The die rolls, and rests on a face you have not seen. Somewhere far above, a first floor. Somewhere, someone begins.' },
    ] },
  ];

  // Cutscene for the boss of a given sector (1-based). Sector 4 is the finale.
  ns.cutsceneFor = function (sector) { return ns.CUTSCENES[Math.min(sector, ns.CUTSCENES.length) - 1] || null; };

  /* ---- the descent, named --------------------------------------------
   * Shown on the sector card. Depth, not geography — the factions are shuffled
   * each run, so a sector cannot be a place. It can only be a distance.
   * ------------------------------------------------------------------ */
  ns.SECTORS = [
    { name: 'THE APPROACH', line: 'The last of it that still remembers being anywhere.' },
    { name: 'THE FALL', line: 'Nothing down here is level. Gravity is a rumour the walls repeat.' },
    { name: 'THE WORKINGS', line: 'Something has been running a long time, and it was not built for you.' },
    { name: 'THE FLOOR', line: 'There is no further down. That is not the same as being the end.' },
    { name: 'BELOW THE FLOOR', line: 'You are past the part that was measured.' },
  ];
  ns.sectorLore = function (n) { return ns.SECTORS[Math.min(n, ns.SECTORS.length) - 1] || ns.SECTORS[ns.SECTORS.length - 1]; };

  /* ---- who else is down here ------------------------------------------
   * Three wrong answers to the same question. None of them says so.
   * ------------------------------------------------------------------ */
  ns.FACTION_LORE = {
    hierarchy: 'They came down to be taken apart, and call it a kindness. They sing on the way.',
    rust:      'They were sent to measure the Spire. They are still measuring. No one came to tell them the survey ended.',
    voidspawn: 'These are the ones that came back up.',
  };

  // Title-screen epigraph. Never explains; only sets the rule.
  ns.EPIGRAPH = 'Everything that falls in is counted.';

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
