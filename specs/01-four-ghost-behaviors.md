# SPEC 01 — Cuatro fantasmas con comportamientos distintos

> **Estado:** Approved
> **Depende de:** Ninguna
> **Fecha:** 2026-09-16
> **Objetivo:** Incorporar cuatro fantasmas con roles de movimiento distintos, incluido un cazador agresivo que persiga a Pac-Man mediante la ruta más corta.

## Alcance

**Dentro:**

- Ampliar `GHOST_STARTS` en `src/js/maze.js` a cuatro posiciones fijas dentro de la casa de fantasmas.
- Definir los roles `hunter`, `ambusher`, `patroller` y `erratic`.
- Mantener la velocidad de todos los fantasmas en `0.1` celdas por frame.
- Permitir cambios de dirección únicamente cuando un fantasma esté alineado con una celda.
- Usar una búsqueda de ruta más corta para seleccionar el siguiente movimiento hacia el objetivo de cada rol.
- Usar el orden fijo arriba, izquierda, abajo, derecha para desempatar movimientos equivalentes.
- Corregir objetivos que sean muros, puertas o posiciones fuera del laberinto hacia la celda transitable más cercana.

**Fuera de alcance (para futuras especificaciones):**

- Cambios en los colores, las formas o las animaciones de los fantasmas.
- Temporizadores o reglas de liberación escalonada desde la casa.
- Persistencia de estados o puntuaciones.
- Cambios en `src/index.html`, `src/css/style.css` o `src/js/render.js`.
- Frutas de poder, estados vulnerables o comportamiento de huida.

## Modelo de datos

La funcionalidad reutiliza el estado de partida existente y añade dos roles y dos posiciones a `GHOST_STARTS`.

```js
const GHOST_STARTS = [
  { x: 13, y: 14, kind: "hunter" },
  { x: 14, y: 14, kind: "ambusher" },
  { x: 13, y: 13, kind: "patroller" },
  { x: 14, y: 13, kind: "erratic" },
];
```

Cada fantasma conserva `x`, `y`, `dir`, `speed` y `kind` dentro de `game.ghosts`.

- `hunter`: objetivo igual a la posición actual de Pac-Man.
- `ambusher`: objetivo cuatro celdas delante de Pac-Man según `pacman.dir`.
- `patroller`: objetivo dos celdas delante de Pac-Man según `pacman.dir`; si ese objetivo no es válido, usa la esquina superior izquierda `(1, 1)`.
- `erratic`: si la distancia Manhattan a Pac-Man es de al menos ocho celdas, usa la posición de Pac-Man; si es menor que ocho, usa la esquina inferior derecha `(26, 29)`.

## Plan de implementación

1. Actualizar `GHOST_STARTS` en `src/js/maze.js` con las cuatro posiciones y los roles definidos. Verificación: `createGame()` devuelve cuatro fantasmas en esas coordenadas.
2. Añadir en `src/js/game.js` las utilidades para calcular objetivos válidos y rutas más cortas respetando paredes, puertas, túneles y el orden de desempate definido. Verificación: una ruta entre dos celdas transitables devuelve solo movimientos legales.
3. Sustituir la decisión genérica de `decideGhost` por las reglas de los cuatro roles. Verificación: cada fantasma cambia de dirección en una intersección según su objetivo y no gira en mitad de un pasillo.
4. Integrar la decisión de movimiento con el ciclo existente de `moveGhost` sin cambiar colisiones, vidas, puntuación, túneles, victoria ni derrota. Verificación: la partida sigue cargando y los cuatro fantasmas pueden moverse y colisionar con Pac-Man.

## Criterios de aceptación

- [ ] `src/js/maze.js` define exactamente cuatro entradas en `GHOST_STARTS`.
- [ ] Las entradas usan los roles `hunter`, `ambusher`, `patroller` y `erratic` una sola vez cada uno.
- [ ] Los cuatro fantasmas comienzan en `(13, 14)`, `(14, 14)`, `(13, 13)` y `(14, 13)`, respectivamente.
- [ ] Los cuatro fantasmas usan una velocidad de `0.1` celdas por frame.
- [ ] El cazador selecciona una ruta más corta hacia la posición de Pac-Man.
- [ ] El emboscador calcula su objetivo a cuatro celdas delante de Pac-Man.
- [ ] El patrullero calcula su objetivo a dos celdas delante de Pac-Man y usa `(1, 1)` como objetivo alternativo.
- [ ] El errático persigue a Pac-Man con distancia Manhattan mayor o igual a ocho y patrulla `(26, 29)` por debajo de ese umbral.
- [ ] Ningún fantasma elige una dirección bloqueada por una pared o por una puerta no transitable.
- [ ] Los empates de ruta se resuelven siempre en orden arriba, izquierda, abajo, derecha.
- [ ] Los cambios de dirección ocurren únicamente cuando el fantasma está alineado con una celda.
- [ ] Los fantasmas conservan el wrapping del túnel.
- [ ] Las colisiones siguen restando una vida y reiniciando posiciones hasta llegar a `lost`.
- [ ] La partida puede llegar a `won` al recoger todos los puntos.
- [ ] Los cuatro archivos JavaScript pasan `node --check`.
- [ ] Una prueba manual en navegador confirma el overlay inicial, movimiento con flechas, recogida de puntos, túnel, colisiones, victoria y derrota.

## Decisiones

- **Sí:** cuatro roles clásicos con objetivos deterministas. Permiten diferencias observables sin introducir estados adicionales.
- **Sí:** ruta más corta para el cazador. Es el comportamiento agresivo solicitado.
- **Sí:** misma velocidad para todos. Aísla la diferencia de dificultad en la estrategia de movimiento.
- **Sí:** decisiones en intersecciones. Conserva el movimiento por celdas del juego actual.
- **Sí:** posiciones fijas `(13, 14)`, `(14, 14)`, `(13, 13)` y `(14, 13)`. Son las cuatro celdas transitables de la casa.
- **Sí:** desempate fijo arriba, izquierda, abajo, derecha. Hace el comportamiento reproducible.
- **Sí:** colores existentes sin leyenda. Evita ampliar el alcance visual.
- **No:** comportamiento aleatorio como rol principal. Haría menos reproducible la verificación de las estrategias.
- **No:** liberación escalonada, persistencia y power-ups. Requieren estados y reglas que pertenecen a otras especificaciones.

## Riesgos

| Riesgo                                                                 | Mitigación                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| La búsqueda de rutas puede elegir caminos inesperados cerca del túnel. | Tratar las salidas del túnel como vecinos válidos y verificar los casos de borde manualmente. |
| Un objetivo proyectado puede caer fuera del laberinto o en una pared.  | Normalizarlo antes de buscar la ruta y seleccionar la celda transitable más cercana.          |
| Cuatro fantasmas pueden provocar colisiones inmediatas al iniciar.     | Verificar las posiciones iniciales y conservar el reinicio existente después de una colisión. |

## Lo que **no** está incluido en esta especificación

- Cambios visuales en los fantasmas.
- Liberación temporizada desde la casa.
- Persistencia, power-ups o estados vulnerables.
- Modificaciones de HTML o CSS.
