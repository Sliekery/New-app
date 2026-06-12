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

    window.addEventListener('resize', function () {
      ns.render.resize();
      if (ns.engine.combat) ns.render.syncCombat();
    });

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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.VS = window.VS || {});
