/**
 * WESTERN RUNNER · Entrada
 * Teclado: Espacio / Flecha arriba = saltar · P / Escape = pausa.
 * Táctil: un toque o doble toque (según el modo) en cualquier parte del área de juego.
 * Mouse: un clic salta (configurable).
 */
(function (w, d) {
  'use strict';
  var WR = w.WR;

  WR.Input = function (area, cfg, h) {
    var last = 0, lx = 0, ly = 0, ic = cfg.input;
    var now = function () { return w.performance ? w.performance.now() : Date.now(); };

    area.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      if (e.pointerType === 'mouse') {
        if (ic.mouseSingleClick) h.jump('mouse');
        return;
      }
      if ((h.mode ? h.mode() : 'doubletap') === 'tap') { h.jump('tap', e); if (h.tap) h.tap(e); return; }
      var t = now();
      var near = Math.abs(e.clientX - lx) <= ic.doubleTapMaxDistance && Math.abs(e.clientY - ly) <= ic.doubleTapMaxDistance;
      if (last && t - last <= ic.doubleTapMs && near) {
        last = 0;                     // un tercer toque empieza un par nuevo
        h.jump('doubletap', e);
      } else {
        last = t; lx = e.clientX; ly = e.clientY;
        if (h.tap) h.tap(e);
      }
    });

    // Sin zoom, selección, menú contextual ni desplazamiento en el área de juego.
    area.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    area.addEventListener('touchend', function (e) { e.preventDefault(); }, { passive: false });
    area.addEventListener('dblclick', function (e) { e.preventDefault(); });
    area.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    d.addEventListener('gesturestart', function (e) { e.preventDefault(); });

    w.addEventListener('keydown', function (e) {
      var k = e.key;
      if (e.code === 'Space' || k === ' ' || k === 'ArrowUp') {
        if (h.jump('key') !== false) e.preventDefault();
        return;
      }
      if (k === 'p' || k === 'P' || k === 'Escape') {
        if (h.pause() !== false) e.preventDefault();
      }
    });
  };
})(window, document);
