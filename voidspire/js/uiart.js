/* =========================================================================
 * VOIDSPIRE — uiart.js
 * A registry of NAMED UI ART SLOTS, so a shape drawn in tools/artist.html can
 * be dropped into the interface by name without touching the code that draws
 * it.
 *
 * WHY A REGISTRY RATHER THAN EDITING EACH CALL SITE. The HUD already renders
 * this exact polyline format through artSVG() in 28 places, but every one of
 * them names its art inline — so changing an icon meant finding the literal
 * and editing it, which is a code change for what is an art decision. Here the
 * art direction lives in one file with names on it.
 *
 * HOW IT WORKS. Everything in UI_ART is an OVERRIDE. An empty registry changes
 * nothing; the game draws exactly what it drew before. Fill in a slot and the
 * matching piece of interface picks it up on the next render. That means this
 * file can never break the game by omission, only by a bad shape.
 *
 * THE FORMAT is the same one enemies and engravings use — { p: [[x,y,...]],
 * e: [[x,y]] } in a -1..1 box — so anything the artist exports is already
 * legal here.
 *
 * FRAMES ARE NOT ONE PICTURE. A frame has to fit a dock whose width changes
 * with the viewport, and a single asset stretched to fit gets uneven line
 * weight — a 4:1 stretch leaves the horizontals a quarter the thickness of the
 * verticals, which is glaring on neon linework. So frames are stored as PARTS:
 * a corner drawn once and placed four times at a fixed size, and an optional
 * edge motif repeated along the run. This is what the card frame already does
 * in CSS with its four corner brackets; this is the same idea with art you can
 * draw. See ns.frameSlot below.
 * ========================================================================= */
(function (ns) {
  'use strict';

  /* The slots the interface asks for. Names are `kind.where.part` so they sort
   * together and read as a path. Everything here is optional. */
  ns.UI_SLOTS = [
    { name: 'icon.draw', what: 'the draw pile card face' },
    { name: 'icon.discard', what: 'the discard pile card face' },
    { name: 'icon.energy', what: 'the energy pip' },
    { name: 'icon.potion', what: 'an empty potion slot' },
    { name: 'icon.endTurn', what: 'beside the END TURN button' },
    { name: 'frame.dock.corner', what: 'one corner of the bottom bar, drawn top-left; mirrored for the other three' },
    { name: 'frame.dock.edge', what: 'an optional motif repeated along the bar between corners' },
    { name: 'frame.panel.corner', what: 'one corner of an overlay panel' },
    { name: 'frame.panel.edge', what: 'an optional motif repeated along a panel edge' },
  ];

  // Empty by default: the game looks exactly as it did until a slot is filled.
  ns.UI_ART = {};

  /* Look a slot up. Returns null when nothing has been drawn for it, which
   * every caller treats as "use what you always used". */
  ns.uiArt = function (name) {
    var a = ns.UI_ART[name];
    if (!a || !a.p || !a.p.length) return null;
    return a;
  };

  /* A frame's parts, or null if the corner has not been drawn. The edge is
   * optional — four corner brackets with nothing between them is a complete
   * look in this game, and is what the cards already do. */
  ns.frameSlot = function (which) {
    var corner = ns.uiArt('frame.' + which + '.corner');
    if (!corner) return null;
    return { corner: corner, edge: ns.uiArt('frame.' + which + '.edge') };
  };

  /* Lay a frame out at a given size, in the drawing space the caller works in.
   * Returns a list of placements rather than drawing anything, so the same
   * geometry serves a canvas, an SVG, or the layout tool's preview.
   *
   * Corners keep their size at every width — that is the entire point — and
   * the edge motif repeats to fill what is left, never stretching to cover it.
   */
  ns.frameLayout = function (which, w, h, cornerPx) {
    var f = ns.frameSlot(which);
    if (!f) return null;
    var c = Math.max(6, Math.min(cornerPx || 18, Math.min(w, h) / 2));
    var out = [];
    // top-left, then the other three as reflections of it
    [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]].forEach(function (q) {
      out.push({ art: f.corner, x: q[0], y: q[1], sx: q[2] * c, sy: q[3] * c });
    });
    if (f.edge) {
      var runW = w - c * 2, runH = h - c * 2;
      var n = Math.max(0, Math.floor(runW / (c * 1.6)));
      for (var i = 0; i < n; i++) {
        var x = c + (runW / n) * (i + 0.5);
        out.push({ art: f.edge, x: x, y: 0, sx: c * 0.7, sy: c * 0.7 });
        out.push({ art: f.edge, x: x, y: h, sx: c * 0.7, sy: -c * 0.7 });
      }
      var m = Math.max(0, Math.floor(runH / (c * 1.6)));
      for (var j = 0; j < m; j++) {
        var y = c + (runH / m) * (j + 0.5);
        out.push({ art: f.edge, x: 0, y: y, sx: c * 0.7, sy: c * 0.7, rot: -Math.PI / 2 });
        out.push({ art: f.edge, x: w, y: y, sx: -c * 0.7, sy: c * 0.7, rot: -Math.PI / 2 });
      }
    }
    return out;
  };
})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
