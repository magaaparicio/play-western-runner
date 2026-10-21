/**
 * WESTERN RUNNER · Controlador
 * Une mundo (lógica), render, entrada, audio y almacenamiento.
 * Bucle: simulación con paso fijo de 1/120 s, render a la frecuencia de la pantalla.
 */
(function (w, d) {
  'use strict';
  var WR = w.WR, cfg = w.WR_CONFIG;
  var $ = function (id) { return d.getElementById(id); };
  var STEP = 1 / 120;

  var app = $('app'), canvas = $('scene');
  var store = new WR.Store(cfg.storageKey);
  var sound = new WR.Sound();
  sound.enabled = store.data.sound !== false;
  sound.musicEnabled = store.data.music !== false;
  var jumpMode = store.data.jumpMode || cfg.input.jumpMode || 'tap';
  var daily = false, endless = true;  // el juego es siempre sin fin

  var renderer = new WR.Renderer(canvas, cfg);
  var world = new WR.World(cfg, { viewW: renderer.view.W, horseX: renderer.horseX });
  world.spawnIdle = true;

  var menuVideo = $('menu-video');
  if (menuVideo) {
    menuVideo.src = 'western-runner-menu.mp4';
    menuVideo.addEventListener('loadeddata', function () { app.classList.add('video-ready'); });
    menuVideo.addEventListener('error', function () { app.classList.remove('video-ready'); });
  }
  var mode = 'menu', acc = 0, last = 0, lastSec = -1, bannerTimer = 0, overTimer = 0;
  var fmtNum = function (n) { return Math.round(n).toLocaleString('es-MX'); };
  var fmtTime = function (s) { s = Math.ceil(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };

  /* ---------- HUD ---------- */
  var HEART = '<svg class="heart" viewBox="0 0 32 30" aria-hidden="true"><path class="fill" d="M16 28S2.5 19.6 2.5 10.2C2.5 5.6 6 2.5 9.8 2.5c2.8 0 4.9 1.6 6.2 3.6 1.3-2 3.4-3.6 6.2-3.6 3.8 0 7.3 3.1 7.3 7.7C29.5 19.6 16 28 16 28z" stroke="#3B2314" stroke-width="2.6" stroke-linejoin="round"/><path d="M8 7.5c-1.6.6-2.6 2-2.6 3.8" stroke="rgba(255,255,255,.75)" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>';
  var heartsEl = $('hearts'), hearts = [];
  function buildHearts(img) {
    var one = HEART;
    heartsEl.innerHTML = new Array(cfg.lives + 1).join(one);
    hearts = heartsEl.querySelectorAll('.heart');
  }
  buildHearts(null);
  var scoreEl = $('score'), timeEl = $('time'), timerBox = timeEl.parentNode;
  var multEl = $('mult'), multTime = $('mult-time'), multFill = $('mult-fill');
  multEl.querySelector('b').textContent = 'x' + cfg.scoring.multiplier;
  $('mult-hat').appendChild(WR.icon(34, 22, 17, 15, 0.62, function (x) { WR.drawHatShape(x, 0, 6, 1.2); }));

  function hudReset() {
    for (var i = 0; i < hearts.length; i++) hearts[i].classList.remove('is-lost', 'is-losing');
    scoreEl.textContent = '0';
    timeEl.textContent = endless ? '0:00' : fmtTime(cfg.durationSeconds);
    timerBox.classList.remove('is-low');
    multEl.hidden = true;
    $('streak').hidden = true;
    lastSec = -1;
  }

  function hudFrame() {
    if (endless) {
      var up = Math.floor(world.t);
      if (up !== lastSec) { lastSec = up; timeEl.textContent = fmtTime(up); }
    } else {
      var sec = Math.ceil(world.timeLeft);
      if (sec !== lastSec) {
        lastSec = sec;
        timeEl.textContent = fmtTime(world.timeLeft);
        timerBox.classList.toggle('is-low', sec <= 10 && sec > 0);
      }
    }
    if (world.mult > 0) {
      multTime.textContent = Math.ceil(world.mult) + 's';
      multFill.style.transform = 'scaleX(' + (world.mult / cfg.scoring.multiplierSeconds).toFixed(3) + ')';
    }
  }

  function banner(text) {
    var b = $('banner');
    b.textContent = text;
    b.classList.remove('is-on'); void b.offsetWidth; b.classList.add('is-on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { b.classList.remove('is-on'); }, cfg.messageSeconds * 1000);
  }

  function pulse(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  /* ---------- Eventos del mundo ---------- */
  function handle(e) {
    renderer.onEvent(e, world);
    switch (e.type) {
      case 'jump': sound.play('jump'); break;
      case 'land': sound.play('land'); break;
      case 'card':
        sound.play('card');
        scoreEl.textContent = fmtNum(world.score);
        pulse(scoreEl.parentNode, 'is-bump');
        break;
      case 'hat':
        sound.play('hat');
        if (multEl.hidden) multEl.hidden = false; else pulse(multEl, 'is-refresh');
        break;
      case 'multEnd': sound.play('multEnd'); multEl.hidden = true; break;
      case 'hit':
        sound.play('hit');
        var hEl = hearts[e.lives];
        if (hEl) { hEl.classList.add('is-lost'); pulse(hEl, 'is-losing'); }
        pulse($('flash'), 'is-on');
        if (navigator.vibrate) try { navigator.vibrate(60); } catch (_) {}
        break;
      case 'phase':
        if (e.message) { banner(e.message); sound.play('phase'); }
        sound.setTempo(cfg.music.tempo + e.index * cfg.music.tempoPerPhase);
        break;
      case 'streak':
        if (e.count >= cfg.streak.showFrom) {
          $('streak').hidden = false;
          $('streak-n').textContent = e.count;
          $('streak').classList.toggle('is-hot', e.count >= cfg.streak.every);
          pulse($('streak'), 'is-bump');
        }
        break;
      case 'streakLost': $('streak').hidden = true; break;
      case 'bonus':
        banner('¡RACHA DE ' + e.count + '! +' + e.points);
        sound.play('bonus');
        scoreEl.textContent = fmtNum(world.score);
        break;
      case 'over': finish(e.reason); break;
    }
  }

  /* ---------- Pantallas ---------- */
  var SCREENS = ['menu', 'how', 'tutorial', 'pause', 'over'];
  function show(name) {
    SCREENS.forEach(function (n) { $('screen-' + n).hidden = n !== name; });
    $('hud').hidden = !(name === 'play' || name === 'pause' || name === 'tutorial' || name === 'over');
    app.className = 'is-' + name + (menuVideo && menuVideo.readyState >= 2 ? ' video-ready' : '');
    if (menuVideo) {
      if (name === 'menu') { menuVideo.play().catch(function () {}); }
      else menuVideo.pause();
    }
    var hero = name === 'menu' || name === 'how';
    renderer.horseScaleTarget = hero ? (renderer.view.portrait ? 1.35 : 1.75) : 1;
    renderer.heroX = hero ? renderer.view.W * (renderer.view.portrait ? 0.42 : 0.24) : null;
    var first = !$('screen-' + name) ? null : $('screen-' + name).querySelector('.wood-btn');
    if (first && d.activeElement && d.activeElement !== d.body) first.focus({ preventScroll: true });
  }

  function refreshRecord() {
    var best = store.data.bestEndless || 0;
    $('record').hidden = !(best > 0);
    $('record-value').textContent = fmtNum(best);
  }

  function toMenu() {
    clearTimeout(overTimer);
    sound.stopMusic();
    mode = 'menu';
    world.reset();
    world.spawnIdle = true;
    renderer.clearFx();
    refreshRecord();
    show('menu');
  }

  function prepareRun() {
    clearTimeout(overTimer);
    world.endless = endless;
    world.reset(daily ? WR.World.dailySeed() : null);
    sound.setTempo(cfg.music.tempo);
    renderer.clearFx();
    hudReset();
    acc = 0;
  }

  function play(opts) {
    if (opts && typeof opts.daily === 'boolean') daily = opts.daily;
    if (opts && typeof opts.endless === 'boolean') endless = opts.endless;
    sound.unlock();
    prepareRun();
    if (!store.data.tutorialSeen) {
      world.spawnIdle = true;
      mode = 'tutorial';
      show('tutorial');
      return;
    }
    world.beginRun();
    mode = 'play';
    show('play');
    sound.startMusic();
  }

  function startFromTutorial() {
    store.data.tutorialSeen = true;
    store.save();
    world.beginRun();
    mode = 'play';
    show('play');
    sound.startMusic();
  }

  function pause() {
    if (mode !== 'play') return false;
    mode = 'pause';
    clearTimeout(bannerTimer);
    $('banner').classList.remove('is-on');
    sound.stopMusic();
    show('pause');
    return true;
  }
  function resume() {
    if (mode !== 'pause') return false;
    mode = 'play';
    last = 0;
    show('play');
    sound.startMusic();
    return true;
  }

  function finish(reason) {
    mode = 'over';
    multEl.hidden = true;
    sound.stopMusic();
    var key = endless ? 'bestEndless' : 'best';
    var score = world.score, best = store.data[key] || 0, record = score > best && score > 0;
    if (record) { store.data[key] = score; }
    if (daily) {
      var today = WR.World.dailySeed();
      if (store.data.daily.date !== today) store.data.daily = { date: today, best: 0 };
      if (score > store.data.daily.best) store.data.daily.best = score;
    }
    store.save();
    lastResult = { score: score, daily: daily, endless: endless, time: world.t, streak: world.stats.bestStreak };
    $('over-mode').hidden = true;
    $('over-streak').textContent = world.stats.bestStreak >= cfg.streak.showFrom ? 'Mejor racha: ' + world.stats.bestStreak + ' cartas seguidas' : '';
    $('final-score').textContent = fmtNum(score);
    $('final-best').textContent = fmtNum(store.data[key]);
    $('new-record').hidden = !record;
    $('over-reason').textContent = endless ? 'Aguantaste ' + fmtTime(Math.floor(world.t)) + ' en el camino.'
      : reason === 'lives' ? 'Te quedaste sin vidas.' : 'Se acabó el tiempo.';
    overTimer = setTimeout(function () {
      show('over');
      sound.play(record ? 'record' : 'over');
    }, 700);
  }

  /* ---------- Compartir ---------- */
  var lastResult = null;
  function share() {
    if (!lastResult) return;
    var text = (lastResult.endless ? '¡Aguanté ' + fmtTime(Math.floor(lastResult.time)) + ' y ' + fmtNum(lastResult.score) + ' puntos en el modo sin fin de Western Runner!'
      : lastResult.daily ? '¡Hice ' + fmtNum(lastResult.score) + ' puntos en el reto del día de Western Runner!'
      : '¡Hice ' + fmtNum(lastResult.score) + ' puntos en Western Runner!') + ' 🤠 ¿Me superas?';
    var url = /^https?:/.test(w.location.protocol) ? w.location.href.split('#')[0] : '';
    var btn = $('btn-share');
    function copied() { btn.textContent = '¡COPIADO!'; setTimeout(function () { btn.textContent = 'COMPARTIR PUNTAJE'; }, 1600); }
    if (navigator.share) {
      navigator.share({ title: 'Western Runner', text: text, url: url || undefined }).catch(function () {});
    } else if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      w.open('https://wa.me/?text=' + encodeURIComponent(text + (url ? ' ' + url : '')), '_blank');
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + (url ? ' ' + url : '')).then(copied, function () {});
    }
  }

  /* ---------- Modo de salto en móvil ---------- */
  function paintJump() {
    var single = jumpMode === 'tap';
    $('tut-touch').innerHTML = single ? 'TOCA<br>PARA SALTAR' : 'TOCA DOS VECES<br>PARA SALTAR';
    d.querySelector('.tut-hand').classList.toggle('is-single', single);
    $('how-tap-text').textContent = single ? 'Toca la pantalla.' : 'Toca dos veces la pantalla.';
    $('btn-jump-how').textContent = single ? 'Salto: 1 toque (cambiar)' : 'Salto: 2 toques (cambiar)';
    $('btn-jump-pause').textContent = single ? 'SALTO: 1 TOQUE' : 'SALTO: 2 TOQUES';
  }
  function toggleJump() {
    jumpMode = jumpMode === 'tap' ? 'doubletap' : 'tap';
    store.data.jumpMode = jumpMode;
    store.save();
    paintJump();
    sound.play('click');
  }

  /* ---------- Sonido ---------- */
  var SPK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';
  function paintSound() {
    var on = sound.enabled;
    $('btn-sound-menu').innerHTML = SPK + (on
      ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      : '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>');
    $('btn-sound-menu').setAttribute('aria-pressed', on);
    $('btn-sound-menu').setAttribute('aria-label', on ? 'Silenciar sonido' : 'Activar sonido');
    $('btn-sound-pause').textContent = on ? 'SONIDO: SÍ' : 'SONIDO: NO';
    $('btn-sound-pause').setAttribute('aria-pressed', on);
    var mon = sound.musicEnabled;
    $('btn-music-menu').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17V5l10-2v12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.8" fill="currentColor"/><circle cx="16.5" cy="15.5" r="2.8" fill="currentColor"/>' +
      (mon ? '' : '<path d="M3 3l18 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>') + '</svg>';
    $('btn-music-menu').setAttribute('aria-pressed', mon);
    $('btn-music-menu').setAttribute('aria-label', mon ? 'Silenciar música' : 'Activar música');
    $('btn-music-pause').textContent = mon ? 'MÚSICA: SÍ' : 'MÚSICA: NO';
    $('btn-music-pause').setAttribute('aria-pressed', mon);
  }
  function toggleMusic() {
    sound.unlock();
    sound.musicEnabled = !sound.musicEnabled;
    store.data.music = sound.musicEnabled;
    store.save();
    if (!sound.musicEnabled) sound.stopMusic();
    paintSound();
  }
  function toggleSound() {
    sound.unlock();
    sound.enabled = !sound.enabled;
    store.data.sound = sound.enabled;
    store.save();
    paintSound();
    sound.play('click');
  }

  /* ---------- Botones ---------- */
  function on(id, fn) {
    $(id).addEventListener('click', function (e) { sound.unlock(); fn(e); });
  }
  on('btn-play', function () { play({ daily: false, endless: true }); });
  on('btn-how', function () { mode = 'how'; show('how'); });
  on('btn-how-play', function () { play({ daily: false, endless: true }); });
  on('btn-music-menu', toggleMusic);
  on('btn-music-pause', toggleMusic);
  on('btn-jump-how', toggleJump);
  on('btn-jump-pause', toggleJump);
  on('btn-share', share);
  on('btn-how-back', function () { mode = 'menu'; show('menu'); });
  on('btn-resume', resume);
  on('btn-pause-menu', toMenu);
  on('btn-again', function () { play(); });
  on('btn-over-menu', toMenu);
  on('btn-sound-menu', toggleSound);
  on('btn-sound-pause', toggleSound);
  // El botón de pausa no debe contar como toque de salto.
  $('btn-pause').addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  $('btn-pause').addEventListener('click', function () { pause(); });

  /* ---------- Entrada de juego ---------- */
  var taps = $('taps');
  WR.Input(canvas, cfg, {
    mode: function () { return jumpMode; },
    jump: function (src) {
      if (mode === 'play') { world.jump(); return true; }
      if (mode === 'tutorial') { sound.unlock(); startFromTutorial(); world.jump(); return true; }
      return false;
    },
    pause: function () { return mode === 'play' ? pause() : mode === 'pause' ? resume() : false; },
    tap: function (e) {
      if (mode !== 'play' && mode !== 'tutorial') return;
      var dot = d.createElement('span');
      dot.className = 'tap-dot';
      dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px';
      taps.appendChild(dot);
      setTimeout(function () { dot.remove(); }, 420);
    }
  });

  d.addEventListener('visibilitychange', function () { if (d.hidden) pause(); });

  var resizeTimer = 0;
  w.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      renderer.resize();
      world.viewW = renderer.view.W;
      world.horseX = renderer.horseX;
      show(mode);
    }, 120);
  });

  /* ---------- Cómo jugar: iconos ---------- */
  function artImg(name, h) {
    var im = d.createElement('img');
    im.src = WR.ASSET_FILES[name]; im.alt = ''; im.style.height = h + 'px'; im.style.width = 'auto';
    return im;
  }
  function fillIcons(img) {
    var arts = d.querySelectorAll('.how-art');
    if (img) {
      for (var a = 0; a < arts.length; a++) {
        var el2 = arts[a], k2 = el2.getAttribute('data-icon');
        if (k2 === 'horse') el2.appendChild(artImg('horse-run-2', 96));
        else if (k2 === 'card') el2.appendChild(artImg('card-0', 76));
        else if (k2 === 'hat') el2.appendChild(artImg('hat', 74));
        else if (k2 === 'obstacles') { ['obs-barrel', 'obs-fence', 'obs-hay'].forEach(function (n) { el2.appendChild(artImg(n, 54)); }); }
      }
      $('mult-hat').innerHTML = ''; $('mult-hat').appendChild(artImg('hat', 24));
    }
    for (var i = 0; i < arts.length; i++) {
      var el = arts[i], k = el.getAttribute('data-icon'), c = null;
      if (img && k !== 'tap') continue;
      if (k === 'horse') c = WR.icon(150, 100, 64, 98, 0.52, function (x) { WR.drawRider(x, { phase: 0.15, air: false, k: 0, scarf: 0.3 }); });
      else if (k === 'card') c = WR.icon(60, 80, 30, 40, 1.15, function (x) { x.rotate(-0.12); WR.drawCard(x, 0, true); });
      else if (k === 'hat') c = WR.icon(110, 90, 55, 50, 1.1, function (x) { WR.drawHatShape(x, 0, 8, 1.4); });
      else if (k === 'obstacles') c = WR.icon(150, 70, 4, 66, 0.62, function (x) {
        WR.OBSTACLE_ART.barrel(x); x.translate(58, 0); WR.OBSTACLE_ART.crate(x); x.translate(64, 0); WR.OBSTACLE_ART.hay(x);
      });
      else if (k === 'tap') el.innerHTML = '<svg viewBox="0 0 80 90" width="74" height="84" aria-hidden="true"><path d="M40 6a16 16 0 0 1 16 16M40 0a22 22 0 0 1 22 22" fill="none" stroke="#3B2314" stroke-width="3" stroke-linecap="round" opacity=".6"/><path d="M30 44V20a6 6 0 0 1 12 0v20l4-1a5 5 0 0 1 6 4l1-.2a5 5 0 0 1 6 4.5l.4 1a5 5 0 0 1 4.6 5V62c0 9-7 16-16 16H40c-5 0-9-2-12-6L16 57a5.5 5.5 0 0 1 8-7.5l6 5.5z" fill="#fff" stroke="#3B2314" stroke-width="3.5" stroke-linejoin="round"/></svg>';
      if (c) el.appendChild(c);
    }
  }

  /* ---------- Bucle ---------- */
  function frame(ts) {
    w.requestAnimationFrame(frame);
    var dt = last ? Math.min(0.1, (ts - last) / 1000) : 1 / 60;
    last = ts;
    if (mode === 'pause') return; // todo congelado: tiempo, físicas y efectos

    if (mode === 'play') {
      acc += dt;
      while (acc >= STEP && mode === 'play') {
        world.step(STEP);
        acc -= STEP;
        if (world.events.length) {
          var ev = world.events; world.events = [];
          for (var i = 0; i < ev.length; i++) handle(ev[i]);
        }
      }
      hudFrame();
    } else if (mode === 'menu' || mode === 'how' || mode === 'tutorial') {
      world.step(dt);
      if (world.events.length) {
        var ev2 = world.events; world.events = [];
        for (var j = 0; j < ev2.length; j++) renderer.onEvent(ev2[j], world);
      }
    }
    renderer.update(dt, world, mode === 'play' || mode === 'menu' || mode === 'how' || mode === 'tutorial');
    renderer.draw(world);
  }

  // Acceso para pruebas automatizadas
  WR.app = {
    world: function () { return world; }, renderer: renderer, store: store, sound: sound,
    mode: function () { return mode; }, play: play, pause: pause, resume: resume, toMenu: toMenu,
    jumpMode: function () { return jumpMode; }, toggleJump: toggleJump
  };

  /* Carga las ilustraciones; si alguna falla, se usa el arte vectorial de respaldo. */
  function loadAssets(done) {
    var files = WR.ASSET_FILES || {}, names = Object.keys(files), left = names.length, img = {}, ok = true;
    if (!left) return done(null);
    names.forEach(function (n) {
      var im = new Image();
      im.onload = function () { if (--left === 0) done(ok ? img : null); };
      im.onerror = function () { ok = false; if (--left === 0) done(null); };
      im.src = files[n];
      img[n] = im;
    });
  }

  paintSound();
  paintJump();
  refreshRecord();
  show('menu');
  loadAssets(function (img) {
    renderer.setImages(img);
    buildHearts(img);
    app.classList.toggle('has-art', !!img);
    d.documentElement.classList.toggle('has-art', !!img);
    fillIcons(img);
    app.removeAttribute('data-loading');
    w.requestAnimationFrame(frame);
  });
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { renderer.resize(); });
})(window, document);
