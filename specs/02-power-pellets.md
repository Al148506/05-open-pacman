# SPEC 02 — Power-pellets y fantasmas comibles

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-23
> **Objetivo:** Añadir los cuatro power-pellets del laberinto y un estado temporal de poder que permite a Pac-Man comerse a los fantasmas mientras están vulnerables.

## Alcance

**Dentro:**

- Añadir un tile nuevo en `src/js/maze.js`: el caracter `o` se parsea al valor `4` en las cuatro posiciones clásicas `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`.
- Dibujar los power-pellets en `src/js/render.js` como puntos grandes, distintos de los dots.
- Puntuar 50 puntos por power-pellet y reiniciar la cadena de valor por cada activación.
- Temporizador `game.power` de 360 frames (6s a 60fps); en los últimos 90 frames los fantasmas parpadean azul/blanco como aviso.
- Mientras `game.power > 0`: los fantasmas invierten su dirección al activarse, se mueven a `POWER_SPEED` y en cada intersección eligen un giro aleatorio.
- Colisionar con un fantasma vulnerable lo "come": suma 100/200/400/800 en la cadena y lo devuelve a la casa.
- Los power-pellets cuentan dentro de `dotsRemaining` para la condición de victoria.
- Al expirar el poder, los fantasmas recuperan color, velocidad y rol normales.

**Fuera de alcance (para futuras especificaciones):**

- Animación de "ojos" del fantasma de regreso a la casa.
- Frutas o bonus adicionales.
- Sonido.
- Persistencia de estados o puntuaciones.
- Liberación escalonada de fantasmas desde la casa.
- Cambios en `src/index.html` o `src/css/style.css`.

## Modelo de datos

```js
// maze.js — parseTile nuevo
// 'o' = power-pellet (4). Las celdas (1,3),(26,3),(1,23),(26,23)
// pasan de '.' a 'o' en MAZE_STR.

// game.js — constantes
const POWER_DURATION = 360; // frames (~6s a 60fps)
const POWER_BLINK = 90; // frames de aviso final (~1.5s)
const POWER_SPEED = 0.06; // 60% de GHOST_SPEED
const GHOST_POINTS = [100, 200, 400, 800];
```

El estado de partida incorpora en el objeto devuelto por `createGame()`:

```js
power: 0,   // frames restantes de estado vulnerable; 0 = normal
ghostChain: 0, // indice en GHOST_POINTS del proximo fantasma comido
```

Cada `game.ghosts[i]` conserva `x`, `y`, `dir`, `speed`, `kind`. Su posición de la casa se toma de `GHOST_STARTS[i]`.

Reglas:

- Comer tile `4`: `grid[y][x] = 0`, `score += 50`, `power = POWER_DURATION`, `ghostChain = 0`.
- Colisión con `power > 0`: `score += GHOST_POINTS[ghostChain]`, `ghostChain = Math.min(ghostChain + 1, 3)` y el fantasma vuelve a `GHOST_STARTS[i]` con `dir = 'up'`.
- Colisión con `power === 0`: comportamiento actual (resta vida, reinicia posiciones).
- `update()` decrementa `power` hasta `0`.

## Plan de implementación

1. **`src/js/maze.js` + `src/js/render.js`:** cambiar a `o` las cuatro celdas de `MAZE_STR` y añadir en `parseTile` `if (ch === 'o') return 4;`. En `drawDots`, dibujar el valor `4` con radio mayor (punto grande). Verificación: aparecen cuatro puntos grandes y la partida funciona igual.
2. **`src/js/game.js`:** contar el tile `4` en `dotsRemaining`. En `movePacman`, comer valor `4` (suma 50, `power = POWER_DURATION`, `ghostChain = 0`). En `update`, decrementar `power` hasta 0. Verificación: comer un power-pellet suma 50 y se borra del tablero; la victoria sigue alcanzable.
3. **`src/js/game.js`:** cambiar la colisión. Si `power > 0`, Pac-Man se come al fantasma (cadena 100/200/400/800) y lo devuelve a la casa; si no, se conserva la pérdida de vida actual. Verificación: con poder activo no se pierde vida al tocar fantasmas y estos reaparecen en la casa.
4. **`src/js/game.js`:** comportamiento vulnerable. Al pasar de `power === 0` a `power > 0`, invertir `dir` de cada fantasma una vez. En `moveGhost`/`decideGhost`: mientras `power > 0`, velocidad `POWER_SPEED` y giro aleatorio en las intersecciones. Verificación: los fantasmas cambian de comportamiento al activar y lo revierten al expirar.
5. **`src/js/render.js`:** color vulnerable (azul) y parpadeo azul/blanco cuando `game.power <= POWER_BLINK`. Verificación: en los últimos 1.5s los fantasmas parpadean y al terminar recuperan su color.

## Criterios de aceptación

- [ ] `MAZE[3][1]`, `MAZE[3][26]`, `MAZE[23][1]` y `MAZE[23][26]` valen `4`.
- [ ] Los power-pellets se dibujan como puntos grandes, distintos de los dots normales.
- [ ] Comer un power-pellet suma 50 puntos y lo elimina de la cuadrícula.
- [ ] Al comerlo, `game.power` toma el valor `POWER_DURATION` (360).
- [ ] Mientras `game.power > 0`, colisionar con un fantasma no resta vidas y lo devuelve a su posición en la casa.
- [ ] La cadena valora 100, 200, 400 y 800, se reinicia con cada power-pellet y se mantiene en 800 después del cuarto fantasma.
- [ ] Al activarse el poder, cada fantasma invierte su dirección una vez.
- [ ] Mientras son vulnerables, los fantasmas se mueven a `POWER_SPEED` y eligen giros aleatorios en las intersecciones.
- [ ] En los últimos 90 frames los fantasmas parpadean entre azul y blanco.
- [ ] Al expirar el poder, los fantasmas recuperan su color, velocidad y rol anteriores.
- [ ] La victoria exige haber comido también los cuatro power-pellets.
- [ ] Los cuatro archivos JavaScript pasan `node --check`.
- [ ] Prueba manual en navegador: overlay, movimiento con flechas, dots, túnel, power-pellets, comer fantasmas, parpadeo, victoria y derrota.

## Decisiones

- **Sí:** nuevo tile `4` con el caracter `o`. Coherente con el parseo por tiles existente; sin estructuras adicionales.
- **Sí:** temporizador global `game.power` en frames. Un único contador simplifica fin del estado y parpadeo.
- **Sí:** 50 puntos por pellet y cadena 100/200/400/800 con tope en 800. Clásico; la cadena se reinicia con cada activación.
- **Sí:** velocidad vulnerable `0.06` y giros aleatorios en intersecciones. Reconocible y de bajo costo sobre el `decideGhost` de SPEC 01.
- **Sí:** el fantasma comido reaparece en la casa con la puerta ya transitable para fantasmas. Evita la animación de ojos.
- **Sí:** parpadeo final de 1.5s. Aviso suficiente sin añadir HUD.
- **No:** animación de ojos de regreso. Requiere un estado extra fuera del alcance.
- **No:** frutas, sonido, persistencia o liberación escalonada. Pertenecen a futuras especificaciones.

## Riesgos

| Riesgo                                                                                           | Mitigación                                                                                                           |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| El temporizador en frames se acorta en pantallas de alta refrescancia.                           | Aceptado por consistencia con el modelo de velocidad por frame actual; documentado para un futuro paso a delta-time. |
| Un fantasma vulnerable devuelto a casa podría no volver a ser útil antes de que expire el poder. | Al expirar `game.power` todos vuelven al comportamiento normal; Pac-Man no puede entrar a la casa.                   |
| Renovar un pellet activo reinicia la cadena, lo que puede sorprender.                            | Dejarlo documentado: la cadena siempre se reinicia al comer cualquier power-pellet.                                  |

## Lo que **no** está incluido en esta especificación

- Animación de "ojos" del fantasma de vuelta a la casa.
- Frutas, sonido, persistencia y liberación escalonada.
- Modificaciones de HTML o CSS.

Cada uno de esos, si llega, va en su propia especificación.
