/* =========================================================================
 * VOIDSPIRE — main.js
 * Boot, resize handling, render loop.
 * ========================================================================= */
(function (ns) {
  'use strict';

  function boot() {
    var canvas = document.getElementById('battlefield');
    ns.render.init(canvas);
    ns.ui.init();

    function refit() {
      if (ns.ui.onResize) ns.ui.onResize();
      else { ns.render.resize(); if (ns.engine.combat) ns.render.syncCombat(); }
    }
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', refit);
    document.addEventListener('fullscreenchange', refit);
    document.addEventListener('webkitfullscreenchange', refit);

    // prevent rubber-band scrolling on iOS, but allow overlay screens to scroll
    document.addEventListener('touchmove', function (e) {
      if (e.target && e.target.closest && e.target.closest('.screen')) return;
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

    var last = performance.now();
    function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ns.render.frame(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // THE DESCENT is opt-in while both navigation modes exist: ?descent=1 rolls
  // your route instead of walking a chart. A run remembers the mode it began
  // under, so switching the flag never changes a save mid-run.
  try { ns.engine.descentEnabled = /[?&]descent=1/.test(location.search); } catch (e) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.VS = window.VS || {});
