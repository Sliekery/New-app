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
      // #vsdev is the dev console, which has its own scrolling panel
      if (e.target && e.target.closest && e.target.closest('.screen, #vsdev')) return;
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.VS = window.VS || {});
