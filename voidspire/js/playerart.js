/* =========================================================================
 * VOIDSPIRE — playerart.js
 * The three player figures: polylines in a -1..1 box, the same format as every
 * other piece of art in the game.
 *
 * It lived inside render.js, which meant it was the ONLY art in the game the
 * artist tool could not see: `tools/build-assets.js` gathers art off `ns`, and
 * this was a local `var` in a closure. Every enemy, engraving and card icon was
 * loadable and editable; the character you look at all game was not.
 *
 * THE RIG POINTS TRAVEL WITH THE ART and are in the SAME COORDINATE SPACE:
 * `muzzle` is where a shot leaves the barrel, `atk.pivot` is what the weapon
 * swings about, `orb` and `ferrule` are the ends of the staff. Move the gun in
 * a drawing and these have to move with it, or the muzzle flash fires out of
 * the wrong place — which has happened once already and took a while to see.
 * ========================================================================= */
(function (ns) {
  'use strict';

  /* A toothed ring, as a polyline. It came across from render.js with the art
   * that is its only caller: geometry that exists to BE art belongs beside the
   * art, and leaving it behind was what stopped this file loading at all. */
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

  ns.CLASS_ART = {
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

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
