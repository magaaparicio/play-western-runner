/**
 * Pruebas de la lógica del juego (Node, sin navegador):  node tests/logic.test.js
 */
global.window = globalThis;
require('../js/config.js');
const World = require('../js/world.js');
const cfg = WR_CONFIG;
const STEP = 1 / 120;
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('PASA  ' + name); } else { fail++; console.log('FALLA ' + name + (info ? '  (' + info + ')' : '')); } }

// Mundo sin generación aleatoria, para colocar objetos a mano.
function emptyWorld() {
  const w = new World(cfg, { seed: 1, viewW: 960, horseX: 220 });
  w.beginRun(); w.nextX = 1e12; w.minObstacleCenter = 1e12;
  return w;
}
function run(w, seconds) { for (let i = 0; i < Math.round(seconds / STEP); i++) { w.step(STEP); if (w.over) break; } }
function events(w, type) { return w.events.filter(e => e.type === type); }

// 1. Salto
let w = emptyWorld();
check('el caballo salta', w.jump() && w.horse.air);
check('no se puede saltar en el aire', w.jump() === false);
run(w, 0.3); const apexish = w.horse.y;
run(w, cfg.physics.airTime);
check('aterriza tras el tiempo de vuelo', !w.horse.air && w.horse.y === 0, 'y=' + w.horse.y);
check('altura de salto cercana a la configurada', apexish > cfg.physics.jumpHeight * 0.85, apexish.toFixed(1));

// 2. Cartas y multiplicador
w = emptyWorld();
w.cards.push({ x: w.horseAbsX() + 30, y: 92, got: false, suit: 0, bob: 0 });
run(w, 0.2);
check('una carta suma 10 puntos', w.score === 10, w.score);
w.hats.push({ x: w.horseAbsX() + 20, y: 100, got: false });
run(w, 0.1);
check('el sombrero activa x2 durante 5 s', Math.abs(w.mult - (5 - 0.1 + STEP)) < 0.12, w.mult.toFixed(2));
w.cards.push({ x: w.horseAbsX() + 30, y: 92, got: false, suit: 1, bob: 0 });
run(w, 0.2);
check('con x2 la carta suma 20 puntos', w.score === 30, w.score);
run(w, 2);
w.hats.push({ x: w.horseAbsX() + 20, y: 100, got: false });
run(w, 0.05);
check('otro sombrero reinicia la duración a 5 s', w.mult > 4.9, w.mult.toFixed(2));
check('se marca como renovación', events(w, 'hat').pop().refresh === true);
w.events.length = 0;
run(w, 5.1);
check('el multiplicador termina', w.mult === 0 && events(w, 'multEnd').length === 1);
w.cards.push({ x: w.horseAbsX() + 30, y: 92, got: false, suit: 2, bob: 0 });
const before = w.score; run(w, 0.2);
check('al terminar, la carta vuelve a valer 10', w.score - before === 10, w.score - before);

// 3. Vidas e invulnerabilidad
w = emptyWorld();
const X = w.horseAbsX();
w.obstacles.push({ type: 'barrel', x: X + 60, w: 48, h: 60, box: [5, 3, 5], hit: false });
w.obstacles.push({ type: 'crate', x: X + 200, w: 56, h: 56, box: [3, 3, 3], hit: false });
run(w, 0.3);
check('una colisión resta una sola vida', w.lives === 2, w.lives);
run(w, 0.4);
check('invulnerable 1.5 s tras el golpe: el segundo obstáculo no resta', w.lives === 2, w.lives);
run(w, 1.2);
w.obstacles.push({ type: 'rock', x: w.horseAbsX() + 40, w: 74, h: 46, box: [12, 7, 12], hit: false });
run(w, 0.4);
check('pasada la invulnerabilidad, otro choque resta', w.lives === 1, w.lives);
w = emptyWorld(); w.lives = 1;
w.obstacles.push({ type: 'barrel', x: w.horseAbsX() + 60, w: 48, h: 60, box: [5, 3, 5], hit: false });
run(w, 1);
check('sin vidas la partida termina', w.over && w.reason === 'lives');

// 4. Colisión coherente: saltar a tiempo evita el obstáculo
w = emptyWorld();
w.obstacles.push({ type: 'fence', x: w.horseAbsX() + w.speed * cfg.physics.airTime * 0.5 - 42, w: 84, h: 58, box: [6, 6, 6], hit: false });
w.jump(); run(w, 1.2);
check('saltar a tiempo supera la cerca', w.lives === 3);

// 5. Tiempo y dificultad
w = new World(cfg, { seed: 5 }); w.beginRun();
let phases = [], prev = w.speed, mono = true, maxJump = 0;
while (!w.over) {
  w.autopilot(); w.step(STEP);
  if (w.speed < prev - 1e-9) mono = false;
  maxJump = Math.max(maxJump, w.speed - prev); prev = w.speed;
  for (const e of w.events) if (e.type === 'phase') phases.push([e.index, +w.t.toFixed(2)]);
  w.events.length = 0;
}
check('la partida dura 60 s', w.reason === 'time' && Math.abs(w.t - 60) < 0.02, w.t.toFixed(3));
check('la velocidad nunca baja', mono);
check('la velocidad sube sin saltos bruscos', maxJump < 1, maxJump.toFixed(3) + ' u/s por paso');
check('la velocidad no supera el máximo', w.speed <= cfg.speed.max);
const sp = t => new World(cfg, { seed: 1 }).speedAt(t);
check('cada cambio de fase sube la velocidad de forma notable (+65 u/s en 3 s)', [[14, 17.5], [29, 32.5], [44, 47.5]].every(([a, b]) => sp(b) - sp(a) >= 65), [14, 17.5, 29, 32.5, 44, 47.5].map(t => Math.round(sp(t))).join(' '));
check('las fases cambian a los 15, 30 y 45 s', JSON.stringify(phases.map(p => p[0])) === '[1,2,3]' && phases.every((p, i) => Math.abs(p[1] - [15, 30, 45][i]) < 0.02), JSON.stringify(phases));
check('los mensajes de dificultad se emiten', cfg.phases.slice(1).every(p => p.message));

// 6. Obstáculos siempre superables + disponibilidad de cartas y sombreros
let hits = 0, runs = 0, hatCounts = [], gaps = 0, livesOk = true, cardTotals = [];
for (let seed = 1; seed <= 400; seed++) {
  for (const vw of [600, 960, 1400]) {
    const g = new World(cfg, { seed, viewW: vw, horseX: Math.max(150, Math.min(300, vw * 0.24)) });
    g.beginRun();
    const cardTimes = new Set();
    while (!g.over) {
      g.autopilot(); g.step(STEP);
      for (const c of g.cards) if (!c.seen && c.x - g.dist < vw) { c.seen = 1; cardTimes.add(Math.floor(g.t / 5)); }
      g.events.length = 0;
    }
    runs++; hits += g.stats.hits; hatCounts.push(g.stats.hats); cardTotals.push(g.stats.cards);
    for (let k = 0; k < 12; k++) if (!cardTimes.has(k)) { gaps++; if (gaps < 4) console.log('   tramo sin cartas', k, 'semilla', seed, 'ancho', vw); }
  }
}
check('todos los obstáculos son superables (' + runs + ' partidas, piloto perfecto)', hits === 0, hits + ' golpes');
check('siempre hay cartas disponibles (cada tramo de 5 s)', gaps === 0, gaps + ' tramos sin cartas');
const avgCards = cardTotals.reduce((a, b) => a + b, 0) / cardTotals.length;
check('cantidad moderada de cartas (40 a 75 recogidas por partida perfecta)', avgCards >= 40 && avgCards <= 75, avgCards.toFixed(1));
const avgHats = hatCounts.reduce((a, b) => a + b, 0) / hatCounts.length;
check('los sombreros son poco frecuentes (2 a 7 por partida)', avgHats >= 2 && avgHats <= 7, avgHats.toFixed(2));

// 7. Independencia de la frecuencia de refresco (acumulador de paso fijo)
function simulate(hz) {
  const g = new World(cfg, { seed: 42 }); g.beginRun();
  let acc = 0;
  const frame = 1 / hz;
  let steps = 0;
  const total = 20 * 120;
  for (let i = 0; i < 20 * hz && steps < total; i++) {
    acc += frame;
    while (acc >= STEP && steps < total) { g.autopilot(); g.step(STEP); acc -= STEP; steps++; g.events.length = 0; }
  }
  while (steps < total) { g.autopilot(); g.step(STEP); steps++; g.events.length = 0; } // redondeo de punto flotante
  return [g.score, g.stats.jumps, Math.round(g.dist)];
}
const r60 = simulate(60), r144 = simulate(144), r30 = simulate(30);
check('mismo resultado a 30, 60 y 144 Hz', JSON.stringify(r30) === JSON.stringify(r60) && JSON.stringify(r60) === JSON.stringify(r144), JSON.stringify([r30, r60, r144]));

// 8. Reinicio completo
w = new World(cfg, { seed: 3 }); w.beginRun(); run(w, 20); w.jump(); w.mult = 3; w.lives = 1;
w.reset(); w.beginRun();
check('el reinicio limpia puntos, vidas, tiempo y multiplicador',
  w.score === 0 && w.lives === 3 && w.timeLeft === 60 && w.mult === 0 && !w.horse.air && w.obstacles.length === 0 && w.speed === cfg.speed.start);


// 9. Racha
w = emptyWorld();
for (let i = 0; i < 10; i++) w.cards.push({ x: w.horseAbsX() + 30 + i * 30, y: 92, got: false, suit: 0, bob: 0 });
run(w, 1.5);
check('10 cartas seguidas dan el bono de racha', w.score === 10 * 10 + cfg.streak.bonus && w.stats.bonuses === 1, w.score);
w.cards.push({ x: w.horseAbsX() + 60, y: 300, got: false, suit: 0, bob: 0 }); // carta alta que no se alcanza sin saltar
run(w, 0.8);
check('dejar pasar una carta rompe la racha', w.streak === 0);
w.cards.push({ x: w.horseAbsX() + 30, y: 92, got: false, suit: 0, bob: 0 });
run(w, 0.3);
w.obstacles.push({ type: 'barrel', x: w.horseAbsX() + 40, w: 63, h: 69, box: [10, 5, 10], hit: false });
run(w, 0.4);
check('chocar rompe la racha', w.streak === 0 && w.lives === 2);

// 10. Reto del día
const a = new World(cfg, { seed: World.dailySeed(new Date(2026, 9, 19)) }), b = new World(cfg, { seed: World.dailySeed(new Date(2026, 9, 19)) });
a.beginRun(); b.beginRun(); run(a, 20); run(b, 20);
check('el reto del día genera el mismo recorrido para todos', a.obstacles.map(o => o.type + Math.round(o.x)).join() === b.obstacles.map(o => o.type + Math.round(o.x)).join() && a.obstacles.length > 0);
check('la semilla cambia cada día', World.dailySeed(new Date(2026, 9, 19)) !== World.dailySeed(new Date(2026, 9, 20)));

// 11. Modo sin fin
w = new World(cfg, { seed: 9, endless: true }); w.beginRun();
let maxS = 0, prevS = w.speed, smooth = true, phase4 = false;
for (let i = 0; i < 180 * 120; i++) {
  w.autopilot(); w.step(STEP);
  if (w.speed < prevS - 1e-9 || w.speed - prevS > 1) smooth = false;
  prevS = w.speed; maxS = Math.max(maxS, w.speed);
  for (const e of w.events) if (e.type === 'phase' && e.index === 4) phase4 = true;
  w.events.length = 0;
}
check('sin fin: no termina por tiempo (3 min jugados)', !w.over && w.t > 179);
check('sin fin: la velocidad sigue subiendo sin saltos tras los 60 s', smooth && w.speedAt(120) > w.speedAt(60) && w.speedAt(179) > w.speedAt(120));
check('sin fin: nunca supera el tope', maxS <= cfg.speed.endlessMax);
check('sin fin: aparece la fase Leyenda a los 90 s', phase4);
while (w.horse.air) w.step(STEP);
w.lives = 1; w.invuln = 0; w.obstacles.push({ type: 'barrel', x: w.horseAbsX() + 30, w: 63, h: 69, box: [10, 5, 10], hit: false });
run(w, 0.5);
check('sin fin: termina al perder las vidas', w.over && w.reason === 'lives');
const timed = new World(cfg, { seed: 9 }); timed.beginRun(); run(timed, 30);
check('la partida de 60 s no cambia con el modo sin fin', timed.speedAt(200) === timed.speedAt(60));
let ehits = 0;
for (let seed = 1; seed <= 60; seed++) {
  const g = new World(cfg, { seed, endless: true, viewW: seed % 2 ? 600 : 1280, horseX: seed % 2 ? 150 : 300 }); g.beginRun();
  for (let i = 0; i < 240 * 120; i++) { g.autopilot(); g.step(STEP); g.events.length = 0; if (g.over) break; }
  ehits += g.stats.hits;
}
check('sin fin: todos los obstáculos superables en 60 partidas de 4 min', ehits === 0, ehits + ' golpes');

console.log(`\n${pass}/${pass + fail} pruebas de lógica superadas`);
process.exit(fail ? 1 : 0);
