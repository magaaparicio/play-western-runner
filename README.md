# Western Runner

Runner arcade 2D del Viejo Oeste para computadora y móvil. Un vaquero a caballo galopa por el desierto durante 60 segundos: salta obstáculos, recoge cartas de póker y atrapa sombreros que duplican los puntos.

## Qué se conservó y qué cambió respecto al proyecto anterior

**Se conservó:**
- El stack: HTML, CSS y JavaScript nativos, sin frameworks ni dependencias de código.
- La configuración centralizada en un solo archivo.
- La separación entre lógica y presentación comunicada por eventos.
- El bucle con `requestAnimationFrame` y la pausa al ocultar la pestaña.
- Pointer Events para táctil y mouse.
- El respeto a `prefers-reduced-motion`.
- El enfoque de pruebas automatizadas con navegador real.

**Se eliminó:** todo lo publicitario. Eso incluye el clickTag, la salida a la URL de destino, el cupón, la marca, la capa de analítica para ad servers y el formato fijo de 300 × 250.

**Se rediseñó:**
- **Motor:** pasó de «atrapar cayendo» a runner con físicas de salto.
- **Simulación:** paso de tiempo fijo, independiente de la frecuencia de la pantalla.
- **Generador de obstáculos:** calcula las distancias a partir de la física del salto, por lo que nunca produce obstáculos imposibles.
- **Arte:** completamente nuevo, vectorial y original.
- **Interfaz:** madera y pergamino según la referencia.
- **Extras:** sonido sintetizado y récord persistente.

## Estructura

```
western-runner/
├── index.html          Pantallas: inicio, cómo jugar, tutorial, HUD, pausa, final
├── css/game.css        Interfaz western (madera, pergamino, HUD, animaciones)
├── js/
│   ├── config.js       Todos los parámetros jugables
│   ├── world.js        Lógica pura: físicas, generador, colisiones, puntos, vidas
│   ├── art.js          Ilustración vectorial: caballo, jinete, objetos, desierto
│   ├── render.js       Cámara adaptable, parallax y efectos visuales
│   ├── input.js        Teclado, doble toque y mouse
│   ├── audio.js        Efectos de sonido con Web Audio (sin archivos)
│   ├── storage.js      Récord, sonido y tutorial en localStorage
│   └── app.js          Controlador: bucle, pantallas, HUD, pausa
├── tests/
│   ├── logic.test.js   27 pruebas de reglas y equidad (Node)
│   └── ui_test.py      31 pruebas de interfaz en navegador (Playwright)
├── tools/build.py      Genera dist/western-runner.html en un solo archivo
└── dist/               Versión de un archivo lista para publicar
```

`world.js` no sabe nada de canvas ni DOM. Cada cambio de estado (salto, carta, sombrero, golpe, fase, fin) se publica como evento. El render, el HUD y el audio reaccionan a esos eventos por separado, así que se pueden cambiar sin tocar las reglas.

## Ejecutar

Abre `index.html` con doble clic en cualquier navegador moderno. Para probarlo en un teléfono de la misma red:

```bash
cd western-runner
python3 -m http.server 8080
# en el teléfono: http://IP-DE-TU-COMPUTADORA:8080
```

`dist/western-runner.html` es el mismo juego en un solo archivo, útil para subirlo a cualquier hosting estático (GitHub Pages, Netlify, Vercel). Para regenerarlo: `python3 tools/build.py`.

Las tipografías Rye y Zilla Slab se cargan de Google Fonts (licencia SIL Open Font License). Sin conexión, el juego funciona con tipografías de respaldo del sistema.

## Controles

| Acción | Computadora | Móvil |
|---|---|---|
| Saltar | Espacio, flecha arriba o clic | Un toque en cualquier parte (o doble toque, a elección del jugador) |
| Pausar / reanudar | P o Escape | Botón superior derecho |

En móvil, el jugador elige en la pausa o en Cómo jugar si salta con un toque (por defecto) o con doble toque (máximo 300 ms entre toques). La elección se recuerda. En ninguno de los dos modos hay botones de salto ni controles virtuales. El área de juego bloquea zoom, selección y desplazamiento. Tocar el botón de pausa nunca cuenta como toque de salto. Al ocultar la pestaña, el juego se pausa solo.

## Reglas

- **Cartas:** 10 puntos cada una.
- **Sombreros:** activan x2 durante 5 segundos; durante ese tiempo cada carta vale 20 puntos. Otro sombrero reinicia la cuenta a 5 segundos.
- **Vidas:** tres. Cada choque resta una sola vida y da 1.5 segundos de invulnerabilidad.
- **Fin de partida:** a los 60 segundos o al perder la tercera vida.

**El juego es siempre sin fin.** El botón JUGAR inicia la partida sin límite de tiempo (los botones SIN FIN y RETO DEL DÍA se quitaron del menú; la lógica de la partida de 60 s y del reto sigue en el código y en las pruebas). Se juega sin límite de tiempo hasta perder las tres vidas. El reloj cuenta hacia arriba. Pasados los 60 s la velocidad sigue subiendo de forma continua y se acerca a un tope (`speed.endlessMax`, 690). A los 90 s empieza la fase Leyenda («¡LEYENDA DEL OESTE!»), con menos margen de reacción. Tiene su propio récord, que el menú muestra debajo del de 60 s.

**Racha.** Atrapar cartas seguidas, sin dejar pasar ninguna ni chocar, forma una racha visible en el HUD desde la tercera carta. Cada 10 cartas seguidas se suma un bono de 50 puntos; el valor de cada carta (10, o 20 con x2) no cambia.

**Reto del día.** Desde el menú se juega un recorrido generado con la fecha como semilla: es igual para todos durante ese día. Se guarda el mejor puntaje del día y el final de partida indica que fue el reto.

**Compartir.** El final de partida tiene un botón para compartir el puntaje: usa el menú nativo del teléfono, abre WhatsApp si ese menú no existe, o copia el texto en computadora.

**Música.** Tema western sintetizado con Web Audio (bajo, cascos y melodía silbada). Se acelera en cada fase de dificultad. Se activa y desactiva aparte de los efectos de sonido.

**Dificultad.** Cada fase tiene su propia velocidad: 300, 390, 480 y 570 unidades por segundo (640 en la fase Leyenda del modo sin fin). Al cambiar de fase, la velocidad sube en unos 2 segundos con una curva suave, para que se note sin sentirse como un golpe. Dentro de cada fase sigue subiendo poco a poco. A partir de unas 400 unidades por segundo aparecen líneas de viento, que se intensifican con la velocidad. A los 15, 30 y 45 segundos cambian las fases (Fácil, Medio, Difícil, Experto) y aparece un letrero:

- **15 s:** «¡MÁS RÁPIDO, VAQUERO!»
- **30 s:** «¡CUIDADO EN EL CAMINO!»
- **45 s:** «¡A TODO GALOPE!»

En cada fase cambian:
- la frecuencia de obstáculos,
- las combinaciones que se saltan de una vez (desde Medio),
- los pares que exigen precisión (desde Difícil),
- y la altura de las cartas.

La dificultad no se reinicia al perder una vida.

**Cómo se garantiza que todo sea superable.** Cada obstáculo se coloca usando la velocidad prevista en el momento en que el caballo lo alcanzará. La separación mínima entre dos obstáculos es la distancia que el caballo recorre durante un salto completo más el tiempo de reacción de la fase. Las combinaciones solo se generan si caben dentro de la ventana en que el caballo va más alto que ellas.

## Configuración

Todo está en `js/config.js`:

- **Partida:** duración, vidas, invulnerabilidad.
- **Puntos:** valor de carta, multiplicador y su duración.
- **Salto:** altura y tiempo en el aire.
- **Velocidad:** por fase, subida dentro de cada fase, duración del cambio entre fases y topes.
- **Fases:** inicio, tiempo de reacción garantizado, holgura, probabilidades y mensaje.
- **Sombreros:** frecuencia.
- **Obstáculos:** tamaño, caja de colisión y fase en que aparecen.
- **Doble toque:** intervalo y distancia máxima.
- **Semilla:** para partidas reproducibles.

Si cambias la física o la velocidad, vuelve a correr `node tests/logic.test.js`. La prueba de 1,200 partidas te dirá si algún obstáculo dejó de ser superable.

## Arte

Los personajes, obstáculos y coleccionables vienen de `art/atlas.png` (lámina con transparencia real). `python3 tools/extract_atlas.py art/atlas.png --upscale` separa cada pieza por transparencia, la entrega al doble de resolución (Lanczos + nitidez suave), calcula el punto de apoyo del caballo y genera `js/assets.js`. Si la lámina cambia de distribución, se ajustan `ROWS` y los nombres en ese script.

Los 11 cuadros del galope se reproducen en el orden que forma el ciclo más fluido, calculado comparando la pose de las patas (`RUN_ORDER` en `js/render.js`). El escenario (cielo, mesas, desierto, suelo) y la interfaz (madera, pergamino, corazones) se dibujan en vectores y CSS, por eso se ven nítidos en cualquier pantalla. Los sprites son raster: se ven limpios hasta cerca de su tamaño real; en pantallas muy grandes o de alta densidad conviene exportar la lámina a mayor resolución.

## Rendimiento

- **Sprites:** los objetos pequeños se pre-renderizan una vez a la resolución de la pantalla.
- **Escenario:** usa Path2D en unidades de mundo, nítido a cualquier tamaño sin gastar memoria en imágenes.
- **Caballo:** se dibuja en vectores cada frame.
- **Peso:** el build convierte las imágenes a WebP; el juego completo pesa poco más de 1 MB.
- **Dispositivos lentos:** si se detectan frames lentos de forma sostenida, el juego reduce partículas, brillos y resolución.

## Pruebas

```bash
node tests/logic.test.js                          # 41 pruebas: reglas, dificultad, equidad, modo sin fin
pip install playwright && playwright install chromium
python3 tests/ui_test.py                          # 42 pruebas de interfaz en index.html
python3 tools/build.py && python3 tests/ui_test.py dist/western-runner.html
```

**Las pruebas de lógica comprueban:**
- el salto y que no se pueda saltar en el aire;
- 10 puntos por carta y 20 con x2;
- la duración y el reinicio del multiplicador;
- una vida por choque y la invulnerabilidad;
- el fin a los 60 segundos o sin vidas;
- que la velocidad sube sin cortes y respeta el máximo;
- que las fases cambian a los 15, 30 y 45 segundos;
- 1,200 partidas sin un solo obstáculo imposible, en tres anchos de pantalla;
- que siempre hay cartas disponibles;
- la frecuencia de los sombreros;
- el mismo resultado a 30, 60 y 144 Hz;
- el reinicio completo del estado.

**Las pruebas de interfaz comprueban:**
- el tutorial en la primera partida;
- el doble toque, y que un toque o dos toques lentos no salten;
- que el botón de pausa no genere saltos;
- Espacio, flecha arriba, P y Escape;
- que la pausa congela el temporizador;
- el indicador x2;
- el récord en localStorage y en el menú tras recargar;
- que «Volver a jugar» deja todo limpio;
- la opción de sonido;
- que no haya errores de JavaScript.

Las pruebas automáticas no sustituyen probar en un teléfono real. Comprueba sobre todo la sensación del doble toque en iOS Safari y en Chrome para Android.
