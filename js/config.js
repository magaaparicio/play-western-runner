/**
 * WESTERN RUNNER · Configuración
 * Todos los parámetros jugables viven aquí. Unidades: segundos y "unidades de mundo"
 * (la pantalla de juego mide 540 unidades de alto en horizontal).
 */
window.WR_CONFIG = {
  version: '1.0.0',
  storageKey: 'westernRunner.v1',

  durationSeconds: 60,
  lives: 3,
  invulnerableSeconds: 1.5,

  scoring: {
    cardPoints: 10,          // puntos por carta
    multiplier: 2,           // multiplicador del sombrero
    multiplierSeconds: 5     // duración del multiplicador (se reinicia con otro sombrero)
  },

  physics: {
    jumpHeight: 170,         // altura máxima del salto
    airTime: 0.86            // segundos en el aire por salto
  },

  /* Velocidad por fases: cada fase tiene su velocidad base (phases[].speed); al cambiar
     de fase sube en phaseRamp segundos (curva suave, sin golpe) y dentro de la fase
     sigue subiendo poco a poco (drift). */
  speed: {
    start: 300,              // = velocidad de la primera fase
    max: 600,                // tope de la partida de 60 s
    drift: 1.5,              // unidades/s que sube cada segundo dentro de una fase
    phaseRamp: 2,            // segundos que tarda en llegar a la velocidad de la nueva fase
    endlessMax: 700,         // modo sin fin: tope absoluto
    endlessRamp: 90          // modo sin fin: rapidez con la que se acerca al tope en la fase final
  },

  /* Fases de dificultad. reaction = segundos mínimos entre aterrizar y volver a saltar
     que el generador garantiza. gapLoose = holgura aleatoria sobre esa distancia mínima. */
  phases: [
    { name: 'Fácil', speed: 300,   from: 0,  reaction: 0.62, gapLoose: [1.35, 2.1], obstacleChance: 0.55, comboChance: 0,    doubleChance: 0,    highCardChance: 0.2,  message: null },
    { name: 'Medio', speed: 390,   from: 15, reaction: 0.5,  gapLoose: [1.15, 1.7], obstacleChance: 0.64, comboChance: 0.12, doubleChance: 0,    highCardChance: 0.4,  message: '¡MÁS RÁPIDO, VAQUERO!' },
    { name: 'Difícil', speed: 480, from: 30, reaction: 0.4,  gapLoose: [1.0, 1.45], obstacleChance: 0.72, comboChance: 0.25, doubleChance: 0.15, highCardChance: 0.5,  message: '¡CUIDADO EN EL CAMINO!' },
    { name: 'Experto', speed: 570, from: 45, reaction: 0.32, gapLoose: [0.95, 1.25], obstacleChance: 0.78, comboChance: 0.3, doubleChance: 0.25, highCardChance: 0.55, message: '¡A TODO GALOPE!' },
    // Solo se alcanza en el modo sin fin
    { name: 'Leyenda', speed: 640, from: 90, reaction: 0.3,  gapLoose: [0.95, 1.2], obstacleChance: 0.8, comboChance: 0.32, doubleChance: 0.3, highCardChance: 0.6, message: '¡LEYENDA DEL OESTE!' }
  ],

  /* Racha: cartas seguidas sin dejar pasar ninguna ni chocar. Cada `every` cartas
     seguidas se suma un bono fijo (no altera el valor de 10/20 de cada carta). */
  streak: { every: 10, bonus: 50, showFrom: 3 },

  hats: {
    firstAfter: 6,           // primer sombrero posible
    every: [8, 13]           // segundos aleatorios entre sombreros
  },

  /* Obstáculos: w×h visibles; box = márgenes de colisión [izq, arriba, der] para
     que el impacto coincida con la forma dibujada. minPhase = fase desde la que aparece. */
  obstacles: {
    barrel: { w: 64,  h: 65, box: [10, 5, 10], minPhase: 0, combo: true },
    crate:  { w: 67,  h: 66, box: [7, 4, 7],   minPhase: 0, combo: true },
    rock:   { w: 85,  h: 49, box: [14, 9, 14], minPhase: 0, combo: true },
    fence:  { w: 89,  h: 54, box: [10, 6, 10], minPhase: 0, combo: false },
    hay:    { w: 103, h: 65, box: [9, 6, 9],   minPhase: 1, combo: false }
  },

  input: {
    jumpMode: 'tap',         // móvil: 'tap' = un toque salta · 'doubletap' = doble toque (el jugador puede cambiarlo)
    doubleTapMs: 300,        // intervalo máximo entre toques para saltar en móvil
    doubleTapMaxDistance: 70,// px máximos entre los dos toques
    mouseSingleClick: true   // en escritorio, un clic del mouse también salta
  },

  music: { tempo: 116, tempoPerPhase: 8, volume: 0.16 },

  messageSeconds: 1.8,
  seed: null                 // número para partidas reproducibles (pruebas)
};
