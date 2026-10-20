/**
 * WESTERN RUNNER · Persistencia local (récord, sonido, tutorial visto).
 * Si el navegador bloquea localStorage, el juego sigue funcionando sin guardar.
 */
(function (w) {
  'use strict';
  w.WR.Store = function (key) {
    var data = { best: 0, bestEndless: 0, sound: true, music: true, jumpMode: null, tutorialSeen: false, daily: { date: 0, best: 0 } };
    try {
      var raw = w.localStorage.getItem(key);
      if (raw) { var o = JSON.parse(raw); for (var k in data) if (k in o) data[k] = o[k]; }
    } catch (e) { /* almacenamiento no disponible */ }
    this.data = data;
    this.save = function () { try { w.localStorage.setItem(key, JSON.stringify(data)); } catch (e) {} };
  };
})(window);
