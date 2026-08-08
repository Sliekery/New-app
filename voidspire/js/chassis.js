/* =========================================================================
 * VOIDSPIRE — chassis.js
 * THE MODULE BAY: relics as hardware you bolt onto a real object.
 *
 * Everything here is SOLID geometry — vertices and faces, back-face culled and
 * painter-sorted — rather than the wireframe this started as. Same pipeline the
 * die uses, one step further: a face whose normal points away from the camera
 * is not drawn, so the models read as objects with a front and a back rather
 * than as see-through schematics.
 *
 * ---- why there are 14 module forms and not 105 -------------------------
 * There are 105 relics carrying 83 distinct hook keys. Modelling each one
 * separately would mean 105 shapes that share no visual language, and a player
 * would learn none of them — the screen would be noise with good lighting.
 *
 * So a module's FORM is decided by what the relic does to you: armour looks
 * like armour, an optic looks like a scope, a power cell looks like a cell.
 * Fourteen forms, every relic mapped explicitly, and the mapping is a design
 * decision per relic rather than a fallback. A build becomes readable at a
 * glance — three plates and a drum is a different silhouette from three optics
 * and a drive, and you can see that across the room.
 *
 * Tier drives scale, so a tier-3 module is visibly a bigger piece of hardware
 * than a tier-1 in the same family.
 * ========================================================================= */
(function (ns) {
  'use strict';

  /* ---- solid model builders ---------------------------------------------
   * Faces are index loops wound counter-clockwise seen from OUTSIDE, which is
   * what lets the renderer cull them by the sign of the projected normal. */
  function Model() { return { v: [], f: [] }; }
  function add(m, verts, faces) {
    var b = m.v.length;
    verts.forEach(function (p) { m.v.push(p); });
    faces.forEach(function (fc) { m.f.push(fc.map(function (i) { return b + i; })); });
    return b;
  }
  function box(m, x0, y0, z0, x1, y1, z1) {
    add(m, [
      [x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
      [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],
    ], [
      [4,5,6,7],   // +z
      [1,0,3,2],   // -z
      [5,1,2,6],   // +x
      [0,4,7,3],   // -x
      [3,7,6,2],   // +y
      [0,1,5,4],   // -y
    ]);
  }
  // prism along an axis: two n-gons joined by side quads. axis 0=x,1=y,2=z
  function prism(m, axis, a0, a1, r, n, c1, c2, rot) {
    c1 = c1 || 0; c2 = c2 || 0; rot = rot || 0;
    var vs = [], fs = [], i;
    for (i = 0; i < n; i++) {
      var t = rot + i / n * Math.PI * 2;
      var u = Math.cos(t) * r + c1, w = Math.sin(t) * r + c2;
      if (axis === 0) { vs.push([a0, u, w]); vs.push([a1, u, w]); }
      else if (axis === 1) { vs.push([u, a0, w]); vs.push([u, a1, w]); }
      else { vs.push([u, w, a0]); vs.push([u, w, a1]); }
    }
    for (i = 0; i < n; i++) {
      var p = i * 2, q = ((i + 1) % n) * 2;
      fs.push([p, q, q + 1, p + 1]);
    }
    var capA = [], capB = [];
    for (i = 0; i < n; i++) { capA.push(i * 2); capB.push((n - 1 - i) * 2 + 1); }
    fs.push(capA.slice().reverse(), capB.slice().reverse());
    add(m, vs, fs);
  }
  function pyramid(m, r, y0, y1, n, rot) {
    var vs = [], fs = [], i;
    for (i = 0; i < n; i++) {
      var t = (rot || 0) + i / n * Math.PI * 2;
      vs.push([Math.cos(t) * r, y0, Math.sin(t) * r]);
    }
    vs.push([0, y1, 0]);
    for (i = 0; i < n; i++) fs.push([i, (i + 1) % n, n]);
    var cap = []; for (i = n - 1; i >= 0; i--) cap.push(i);
    fs.push(cap);
    add(m, vs, fs);
  }
  function plateQuad(m, x0, y0, x1, y1, z, thick) {
    box(m, x0, y0, z - thick, x1, y1, z + thick);
  }

  /* ====================== THE MODULE FORMS ============================
   * Built in a canonical space: the mounting face is at -Y, the module grows
   * toward +Y (outward from the chassis surface), roughly within a unit box. */
  var FORMS = {};
  function form(id, name, fn) { FORMS[id] = { id: id, name: name, build: fn }; }

  form('plate', 'ARMOUR PLATE', function () {          // block / shield / plating
    var m = Model();
    box(m, -0.52, -0.10, -0.34, 0.52, 0.16, 0.34);
    box(m, -0.34, 0.16, -0.20, 0.34, 0.30, 0.20);
    box(m, -0.12, 0.30, -0.08, 0.12, 0.38, 0.08);
    return m;
  });
  form('cell', 'POWER CELL', function () {             // energy / reactor
    var m = Model();
    prism(m, 1, -0.10, 0.56, 0.28, 6, 0, 0, 0.26);
    box(m, -0.10, 0.56, -0.10, 0.10, 0.70, 0.10);
    return m;
  });
  form('barrel', 'MUZZLE DEVICE', function () {        // flat damage / damage mult
    var m = Model();
    prism(m, 1, -0.10, 0.34, 0.26, 8);
    prism(m, 1, 0.34, 0.72, 0.17, 8);
    box(m, -0.30, 0.20, -0.05, 0.30, 0.28, 0.05);
    return m;
  });
  form('optic', 'OPTIC', function () {                 // crit / aim / roll bonus
    var m = Model();
    prism(m, 0, -0.46, 0.46, 0.20, 8, 0.30, 0);
    prism(m, 0, 0.46, 0.60, 0.26, 8, 0.30, 0);
    box(m, -0.16, -0.12, -0.10, 0.16, 0.12, 0.10);
    return m;
  });
  form('drum', 'FEED DRUM', function () {              // draw / card flow
    var m = Model();
    prism(m, 2, -0.22, 0.22, 0.36, 10, 0, 0.26);
    prism(m, 2, -0.26, 0.26, 0.12, 6, 0, 0.26);
    return m;
  });
  form('governor', 'BAND GOVERNOR', function () {      // band shift / bleed / relay
    var m = Model();
    box(m, -0.40, -0.10, -0.24, 0.40, 0.14, 0.24);
    prism(m, 1, 0.14, 0.44, 0.22, 6);
    prism(m, 1, 0.44, 0.52, 0.32, 6);
    return m;
  });
  form('phial', 'BLOOD PHIAL', function () {           // hploss / lifesteal / heal
    var m = Model();
    prism(m, 1, -0.08, 0.44, 0.22, 8);
    pyramid(m, 0.22, 0.44, 0.68, 8);
    box(m, -0.26, -0.10, -0.08, 0.26, -0.02, 0.08);
    return m;
  });
  form('censer', 'HEX CENSER', function () {           // burn / taint / rot
    var m = Model();
    pyramid(m, 0.34, 0.06, -0.12, 6);
    prism(m, 1, 0.06, 0.34, 0.34, 6);
    pyramid(m, 0.34, 0.34, 0.66, 6);
    return m;
  });
  form('spike', 'MIGHT SPIKE', function () {           // strength
    var m = Model();
    prism(m, 1, -0.10, 0.16, 0.30, 4, 0, 0, 0.78);
    pyramid(m, 0.30, 0.16, 0.78, 4, 0.78);
    return m;
  });
  form('pod', 'CONSTRUCT POD', function () {           // turret / salvo / echo
    var m = Model();
    box(m, -0.34, -0.10, -0.34, 0.34, 0.26, 0.34);
    prism(m, 1, 0.26, 0.48, 0.16, 6);
    box(m, -0.46, 0.02, -0.08, -0.34, 0.14, 0.08);
    box(m, 0.34, 0.02, -0.08, 0.46, 0.14, 0.08);
    return m;
  });
  form('lens', 'PSI LENS', function () {               // psi focus
    var m = Model();
    pyramid(m, 0.30, 0.24, 0.66, 8);
    pyramid(m, 0.30, 0.24, -0.10, 8);
    return m;
  });
  form('ward', 'WARD RING', function () {              // rerolls / scar wards / saves
    var m = Model();
    prism(m, 2, -0.10, 0.10, 0.44, 10, 0, 0.26);
    prism(m, 2, -0.16, 0.16, 0.16, 6, 0, 0.26);
    return m;
  });
  form('yoke', 'BURDEN YOKE', function () {            // pure-cost / world power
    var m = Model();
    box(m, -0.50, -0.08, -0.12, 0.50, 0.04, 0.12);
    box(m, -0.50, 0.04, -0.12, -0.34, 0.40, 0.12);
    box(m, 0.34, 0.04, -0.12, 0.50, 0.40, 0.12);
    return m;
  });
  form('core', 'CORNERSTONE', function () {            // the cornerstone
    var m = Model();
    pyramid(m, 0.36, 0.10, 0.74, 6);
    pyramid(m, 0.36, 0.10, -0.28, 6);
    prism(m, 1, 0.04, 0.16, 0.42, 6);
    return m;
  });

  ns.MODULE_FORMS = FORMS;

  /* ---- which form a relic wears ------------------------------------------
   * Keyed on the relic's primary hook. Every one of the 83 hook keys in the
   * pool is listed, so nothing falls through to a default by accident — an
   * unmapped relic shows up loudly as a plain plate and can be assigned. */
  var HOOK_FORM = {
    // armour
    blockStart:'plate', plate:'plate', reactivePlate:'plate', breakerBlock:'plate',
    surgeShield:'plate', shieldThorns:'plate', reshuffleShield:'plate', thorns:'plate',
    blockStartTechMul:'plate', shieldPingPct:'plate', shieldWeak:'plate',
    // power
    energyEveryTurn:'cell', energyTurn1:'cell', energyCarry:'cell', sagEnergy:'cell',
    critDie1Energy:'cell', firstCardFree:'cell', firstPowerFree:'cell',
    // offence
    flatDmg:'barrel', dmgMult:'barrel', attackVuln:'barrel', executeBonus:'barrel',
    firstSplash:'barrel', aoeTurnStart:'barrel', critVuln:'barrel', enemyHpScale:'barrel',
    // optics
    critBonus:'optic', aimStart:'optic', rollBonus:'optic', critWiden:'optic',
    rollAdv:'optic', lowCrit:'optic', misfireWiden:'optic', critStr:'optic',
    critRelay:'optic', critDraw:'optic',
    // feed
    drawStart:'drum', killDraw:'drum', hungerDraw:'drum', firstPowerDraw:'drum',
    momentumKeep:'drum',
    // the die's own geography
    bandShift:'governor', bandFloor:'governor', parityBand:'governor', hpBand:'governor',
    lowWiden:'governor', bleedSpan:'governor', bleedPct:'governor', bleedEnds:'governor',
    relayAll:'governor', bleedReach:'governor', extremeRelay:'governor', faceEcho:'governor', evenMirror:'governor',
    bankRoll:'governor', bareRefund:'governor', lowMight:'governor', everyThird:'governor',
    // blood
    hplossDmg:'phial', hplossPsi:'phial', lifestealPct:'phial', bloodrageStart:'phial',
    lowHeal:'phial', healOnKill:'phial', sectorHeal:'phial',
    // rot
    burnGrow:'censer', attackBurn:'censer', hexweaver:'censer', taintMight:'censer',
    ravenousEcho:'censer', weakStart:'censer',
    // might
    strStart:'spike', strOnKill:'spike',
    // constructs
    turretStart:'pod', salvoStart:'pod', echoStart:'pod',
    // psi
    psiPowStart:'lens',
    // wards
    rerollOnes:'ward', rerollSag:'ward', taintWard:'ward', weldWard:'ward',
    // burdens
    worldPower:'yoke', maxHpPct:'yoke', dmgTakenMult:'yoke', noCredits:'yoke', noShield:'yoke',
  };

  ns.moduleFormFor = function (id) {
    var a = ns.ARTIFACTS && ns.ARTIFACTS[id];
    if (!a) return FORMS.plate;
    if (a.cornerstone) return FORMS.core;
    var k = a.k || (a.hooks && a.hooks[0] && a.hooks[0].k);
    // a relic whose FIRST hook is a cost reads by its second — a yoke that also
    // gives damage is a barrel with a price, not a burden
    if (a.hooks && a.hooks.length > 1 && HOOK_FORM[k] === 'yoke') {
      for (var i = 1; i < a.hooks.length; i++) {
        if (HOOK_FORM[a.hooks[i].k] && HOOK_FORM[a.hooks[i].k] !== 'yoke') { k = a.hooks[i].k; break; }
      }
    }
    return FORMS[HOOK_FORM[k]] || FORMS.plate;
  };

  /* ====================== THE CHASSIS ================================= */
  function buildRifle() {
    var m = Model();
    box(m, -0.58, -0.02, -0.09, 0.26, 0.16, 0.09);
    prism(m, 0, 0.26, 0.86, 0.052, 8, 0.07, 0);
    box(m, -0.52, -0.10, -0.05, 0.24, -0.02, 0.05);
    box(m, -0.92, 0.03, -0.06, -0.58, 0.22, 0.06);
    box(m, -0.26, 0.16, -0.05, -0.12, 0.50, 0.05);
    box(m, 0.00, 0.16, -0.045, 0.18, 0.56, 0.045);
    box(m, 0.30, 0.16, -0.03, 0.44, 0.30, 0.03);
    box(m, 0.80, -0.06, -0.02, 0.84, 0.02, 0.02);
    return {
      m: m,
      // p = where, n = which way is OUT (so a module seats flush and upright)
      slots: [
        { p: [-0.44, -0.10, 0], n: [0, -1, 0] },
        { p: [-0.10, -0.10, 0], n: [0, -1, 0] },
        { p: [ 0.20, -0.10, 0], n: [0, -1, 0] },
        { p: [ 0.56,  0.07, 0.052], n: [0, 0, 1] },
        { p: [-0.75,  0.03, 0], n: [0, -1, 0] },
        { p: [ 0.09,  0.56, 0], n: [0, 1, 0] },
      ],
      core: [-0.16, 0.07, 0],
    };
  }
  function buildFrame() {
    var m = Model();
    prism(m, 2, -0.10, 0.10, 0.72, 6, 0, 0, Math.PI / 2);
    prism(m, 2, -0.17, 0.17, 0.26, 6, 0, 0, Math.PI / 2);
    prism(m, 2, -0.05, 0.05, 0.10, 6, 0, 0, Math.PI / 2);
    var slots = [];
    for (var k = 0; k < 6; k++) {
      var a = Math.PI / 2 + k / 6 * Math.PI * 2;
      var c = Math.cos(a), s2 = Math.sin(a);
      slots.push({ p: [c * 0.72, s2 * 0.72, 0], n: [c, s2, 0] });
    }
    return { m: m, slots: slots, core: [0, 0, 0] };
  }
  function buildReliquary() {
    var m = Model();
    // a cage: crown, belly, waist, tip — as solid bands
    prism(m, 1, -0.68, -0.56, 0.24, 6);
    prism(m, 1, -0.14, 0.02, 0.50, 6);
    prism(m, 1, 0.30, 0.42, 0.34, 6);
    // ribs
    for (var k = 0; k < 6; k++) {
      var a = k / 6 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a);
      var mm = Model();
      box(mm, -0.03, -0.62, -0.03, 0.03, 0.36, 0.03);
      // lean the rib outward by shearing its verts along the radial
      mm.v.forEach(function (p) {
        var t = (p[1] + 0.62) / 0.98;
        var bulge = Math.sin(t * Math.PI) * 0.5 + 0.24;
        p[0] += c * bulge; p[2] += s2 * bulge;
      });
      add(m, mm.v, mm.f);
    }
    pyramid(m, 0.30, 0.42, 0.86, 6);
    // the thing inside
    pyramid(m, 0.15, -0.06, 0.20, 6);
    pyramid(m, 0.15, -0.06, -0.32, 6);
    var slots = [];
    for (var k2 = 0; k2 < 6; k2++) {
      var a2 = k2 / 6 * Math.PI * 2, c2 = Math.cos(a2), s3 = Math.sin(a2);
      var crown = k2 % 2 === 0;
      slots.push({ p: [c2 * (crown ? 0.26 : 0.54), crown ? -0.62 : -0.06, s3 * (crown ? 0.26 : 0.54)],
                   n: [c2, crown ? -0.4 : 0, s3] });
    }
    return { m: m, slots: slots, core: [0, -0.06, 0] };
  }

  var BUILT = null;
  function built() {
    if (BUILT) return BUILT;
    BUILT = {
      vanguard:     { name: 'THE RIFLE', col: '#ffb02e', scale: 1.04,
                      sub: 'Modules seat along the rail.', geo: buildRifle() },
      technomancer: { name: 'THE FRAME', col: '#41d8ff', scale: 0.84,
                      sub: 'Modules seat in the ring.', geo: buildFrame() },
      voidadept:    { name: 'THE RELIQUARY', col: '#c86bff', scale: 0.76,
                      sub: 'Modules seat in the settings.', geo: buildReliquary() },
    };
    return BUILT;
  }
  ns.CHASSIS = {};
  ns.chassisFor = function (cls) {
    var B = built(), c = B[cls] || B.vanguard;
    return { name: c.name, col: c.col, sub: c.sub, slots: c.geo.slots, scale: c.scale };
  };

  /* ---- maths ------------------------------------------------------------ */
  function norm3(v) { var l = Math.hypot(v[0],v[1],v[2]) || 1; return [v[0]/l,v[1]/l,v[2]/l]; }
  function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function qMul(a, b) {
    return [a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
            a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
            a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
            a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
  }
  function qFromAxis(ax, ang) {
    var a = norm3(ax), s = Math.sin(ang/2);
    return [Math.cos(ang/2), a[0]*s, a[1]*s, a[2]*s];
  }
  function qRot(q, v) {
    var t = [2*(q[2]*v[2]-q[3]*v[1]), 2*(q[3]*v[0]-q[1]*v[2]), 2*(q[1]*v[1]-q[2]*v[0])];
    return [v[0]+q[0]*t[0]+q[2]*t[2]-q[3]*t[1],
            v[1]+q[0]*t[1]+q[3]*t[0]-q[1]*t[2],
            v[2]+q[0]*t[2]+q[1]*t[1]-q[2]*t[0]];
  }
  // rotate the module's canonical +Y onto the slot's outward normal
  function qAlignY(n) {
    var up = [0,1,0], d = up[0]*n[0]+up[1]*n[1]+up[2]*n[2];
    if (d > 0.9999) return [1,0,0,0];
    if (d < -0.9999) return qFromAxis([1,0,0], Math.PI);
    return qFromAxis(cross(up, n), Math.acos(Math.max(-1, Math.min(1, d))));
  }

  /* ---- the live view --------------------------------------------------- */
  ns.chassisCreate = function (canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var B = built(), ch = B[opts.cls] || B.vanguard;
    var geo = ch.geo, col = ch.col;
    var raf = 0, dead = false, t0 = performance.now(), t = 0;
    var mounted = opts.mounted || [];
    var slotsLive = opts.slots || geo.slots.length;
    var anim = [];
    var yaw = -0.55, pitch = -0.32, spin = 0.16, drag = null;
    var proj = [];
    var formCache = {};

    function formOf(id) {
      if (!formCache[id]) formCache[id] = ns.moduleFormFor(id).build();
      return formCache[id];
    }
    function tierOf(id) {
      var a = ns.ARTIFACTS && ns.ARTIFACTS[id];
      return (a && a.tier) || 1;
    }

    function size() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.max(120, r.width), h = Math.max(120, r.height);
      if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {
        canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
      }
      return { w: w, h: h, dpr: dpr };
    }
    function rgba(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n>>16)&255) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')';
    }

    function draw(now) {
      if (dead) return;
      var dt = Math.min(0.05, (now - t0)/1000 - t);
      t = (now - t0)/1000;
      if (!drag) yaw += spin * dt;
      var s = size();
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);
      var cx = s.w/2, cy = s.h/2;
      var R = Math.min(s.w*0.40, s.h*0.62) * (ch.scale || 1);
      var q = qMul(qFromAxis([1,0,0], pitch), qFromAxis([0,1,0], yaw));
      function P(v) { var r = qRot(q, v); return [cx + r[0]*R, cy + r[1]*R, r[2]]; }

      /* Collect every face in the scene — chassis and modules alike — then cull
       * the ones facing away and paint what is left back to front. Doing it in
       * one pass is what lets a module correctly occlude the chassis behind it
       * and be occluded by the part of the chassis in front of it. */
      var polys = [];
      function emit(model, xform, tint, alphaMul) {
        var V = model.v.map(function (p) { return P(xform ? xform(p) : p); });
        model.f.forEach(function (fc) {
          var a = V[fc[0]], b = V[fc[1]], c = V[fc[2]];
          // winding in screen space: positive area == facing us
          var area = (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
          if (area >= 0) return;                       // BACK-FACE CULL
          var z = 0; for (var i = 0; i < fc.length; i++) z += V[fc[i]][2];
          polys.push({ pts: fc.map(function (i2) { return V[i2]; }), z: z/fc.length,
                       tint: tint || col, am: alphaMul == null ? 1 : alphaMul });
        });
      }

      emit(geo.m, null, col, 1);

      var corePt = P(geo.core);
      proj = [];
      geo.slots.forEach(function (sp, i) {
        var pt = P(sp.p);
        proj[i] = pt;
        if (!mounted[i]) return;
        var a = anim[i], k = 1;
        if (a != null) {
          var el = t - Math.abs(a), dur = 0.55;
          if (el >= dur) { anim[i] = null; k = 1; }
          else k = a >= 0 ? el/dur : 1 - el/dur;
          k = k < 0 ? 0 : k > 1 ? 1 : k;
        }
        var ease = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k+2, 3)/2;
        var mq = qAlignY(norm3(sp.n));
        var sc = (0.155 + tierOf(mounted[i]) * 0.032) * (0.55 + ease * 0.45);
        var lift = (1 - ease) * 0.9;                    // flies in along the normal
        emit(formOf(mounted[i]), function (p) {
          var r = qRot(mq, [p[0]*sc, p[1]*sc, p[2]*sc]);
          return [sp.p[0] + r[0] + sp.n[0]*lift,
                  sp.p[1] + r[1] + sp.n[1]*lift,
                  sp.p[2] + r[2] + sp.n[2]*lift];
        }, col, 0.35 + 0.65 * ease);
      });

      polys.sort(function (a, b) { return a.z - b.z; });

      ctx.save();
      polys.forEach(function (pl) {
        var k = (pl.z + 1) / 2;                        // 0 far .. 1 near
        ctx.beginPath();
        ctx.moveTo(pl.pts[0][0], pl.pts[0][1]);
        for (var i = 1; i < pl.pts.length; i++) ctx.lineTo(pl.pts[i][0], pl.pts[i][1]);
        ctx.closePath();
        // a faint solid fill occludes what is behind it; the stroke is the art
        ctx.fillStyle = rgba('#05080a', 0.86);
        ctx.fill();
        ctx.fillStyle = rgba(pl.tint, (0.05 + k * 0.10) * pl.am);
        ctx.fill();
        ctx.strokeStyle = pl.tint;
        ctx.globalAlpha = (0.30 + k * 0.62) * pl.am;
        ctx.lineWidth = 0.7 + k * 0.9;
        ctx.shadowColor = pl.tint; ctx.shadowBlur = 2 + k * 6;
        ctx.stroke();
      });
      ctx.restore();

      // empty sockets, over the top so they are always findable
      ctx.save();
      geo.slots.forEach(function (sp, i) {
        if (mounted[i]) return;
        var pt = proj[i], open = i < slotsLive;
        var depth = (pt[2] + 1) / 2;
        ctx.strokeStyle = open ? col : 'rgba(120,140,150,0.6)';
        ctx.globalAlpha = (open ? 0.5 : 0.25) * (0.35 + depth * 0.65);
        ctx.lineWidth = 1.1; ctx.setLineDash([3, 3]); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(pt[0], pt[1], R*0.075*(0.7+depth*0.3), 0, 7); ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();

      // the seat flash
      geo.slots.forEach(function (sp, i) {
        var a = anim[i]; if (a == null || a < 0) return;
        var el = t - a, dur = 0.55;
        if (el < dur * 0.72 || el > dur) return;
        var f = 1 - (el - dur*0.72) / (dur*0.28);
        ctx.save();
        ctx.globalAlpha = f * 0.85;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.shadowColor = col; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(proj[i][0], proj[i][1], R*0.09*(1 + (1-f)*2.4), 0, 7); ctx.stroke();
        ctx.restore();
      });

      var live = mounted.filter(Boolean).length;
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.08*live + Math.sin(t*2.2)*0.05;
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8 + live*4;
      ctx.beginPath(); ctx.arc(corePt[0], corePt[1], R*0.026, 0, 7); ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

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
      set: function (list, slots) { mounted = list.slice(); if (slots != null) slotsLive = slots; },
      seat: function (i) { anim[i] = t; },
      eject: function (i) { anim[i] = -t; },
      dragged: function () { return !!(drag && drag.moved); },
      formName: function (id) { return ns.moduleFormFor(id).name; },
      slotAt: function (px, py) {
        var s = size(), R = Math.min(s.w*0.40, s.h*0.62) * (ch.scale || 1);
        var best = -1, bestD = R * 0.18;
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
