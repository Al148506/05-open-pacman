# SPEC 02 — Salida en dos direcciones y dispersión de los fantasmas

> **Estado:** Implemented
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-21
> **Objetivo:** Hacer que los cuatro fantasmas salgan de la pen dividiéndose hacia la izquierda y hacia la derecha, y que cada uno patrulle permanentemente una zona distinta del mapa en lugar de moverse en fila india.

## Por qué existe esta especificación

Hoy los cuatro fantasmas salen de la pen en formación 2x2, llegan al pasillo de la fila 11 y giran los cuatro a la izquierda. Medido sobre la implementación de SPEC 01, la distancia Manhattan media entre pares de fantasmas cae a 0,67–1,0 celdas durante los primeros 60 frames: van pegados, uno detrás de otro.

La causa no está en la salida. La pen solo tiene una boca, la puerta de la fila 12, columnas 13-14, así que los cuatro suben por ahí. La causa está en `shortestDirection()`, que desempata con un orden fijo `[up, left, down, right]`. Como el laberinto es simétrico respecto al eje central y Pac-Man empieza en la columna 13, la ruta por la izquierda y la ruta por la derecha empatan en longitud, y el empate se resuelve siempre hacia la izquierda. Los cuatro fantasmas comparten ese desempate, así que los cuatro toman la misma ruta.

Esta especificación rompe el empate sin tocar el orden de desempate: da a cada fantasma un destino propio en una mitad distinta del mapa.

## Alcance

**Dentro:**

- Añadir `GHOST_ZONES` a `src/js/maze.js` con una zona por rol, cada una definida por dos waypoints transitables.
- Añadir los campos `zone` y `patrolTarget` a cada fantasma de `game.ghosts` en `createGame()`.
- Añadir la constante `GHOST_ALERT_DISTANCE` con valor `6` en `src/js/game.js`.
- Partir `decideGhost()` en dos modos: patrulla de zona y alerta.
- En modo patrulla, el objetivo es el waypoint indicado por `patrolTarget`; al llegar a él, `patrolTarget` pasa al otro waypoint.
- En modo alerta, el objetivo es el que ya define SPEC 01 para cada rol.
- Reiniciar `patrolTarget` a `'a'` en `resetPositions()`.
- Entrar en modo alerta cuando la distancia Manhattan entre Pac-Man y el waypoint más cercano de la zona del fantasma sea menor o igual que `GHOST_ALERT_DISTANCE`.
- Cambiar el objetivo alternativo del `patroller`: deja de ser `(1, 1)` y pasa a ser el waypoint `a` de su propia zona.
- Mantener el orden de desempate global `[up, left, down, right]` sin cambios.
- Mantener `GHOST_STARTS` y la geometría del laberinto sin cambios.

**Fuera de alcance (para futuras especificaciones):**

- Abrir una segunda boca física en la pen o modificar cualquier muro, puerta o pasillo de `MAZE_STR`.
- Órdenes de desempate distintos por fantasma.
- Liberación escalonada con temporizador desde la pen.
- Cambios en colores, formas o animaciones de los fantasmas.
- Cambios en `src/index.html`, `src/css/style.css` o `src/js/render.js`.
- Frutas de poder, estados vulnerables o comportamiento de huida.
- Persistencia de estados o puntuaciones.

## Modelo de datos

La especificación añade una tabla de zonas en `src/js/maze.js` y un campo por fantasma en `src/js/game.js`.

```js
// src/js/maze.js — nuevo, junto a GHOST_STARTS
const GHOST_ZONES = {
  hunter: { a: { x: 1, y: 1 }, b: { x: 6, y: 5 } }, // arriba-izquierda
  ambusher: { a: { x: 26, y: 1 }, b: { x: 21, y: 5 } }, // arriba-derecha
  patroller: { a: { x: 1, y: 29 }, b: { x: 6, y: 26 } }, // abajo-izquierda
  erratic: { a: { x: 26, y: 29 }, b: { x: 21, y: 26 } }, // abajo-derecha
};
```

Cada fantasma de `game.ghosts` gana un campo `zone`:

```js
{
  x, y, dir, speed,
  kind,                                 // 'hunter' | 'ambusher' | 'patroller' | 'erratic' (SPEC 01)
  zone: { a: { x, y }, b: { x, y } },   // copia de GHOST_ZONES[ kind ]
  patrolTarget: 'a',                    // 'a' | 'b': waypoint al que se dirige patrullando
}
```

Constante nueva en `src/js/game.js`, junto a `PACMAN_SPEED` y `GHOST_SPEED`:

```js
const GHOST_ALERT_DISTANCE = 6; // celdas Manhattan entre Pac-Man y la zona del fantasma
```

Reparto de zonas y lado de salida:

| Rol         | Columna de salida | Lado      | Zona             | Waypoints             |
| ----------- | ----------------- | --------- | ---------------- | --------------------- |
| `hunter`    | 13                | izquierda | arriba-izquierda | `(1,1)` ↔ `(6,5)`     |
| `patroller` | 13                | izquierda | abajo-izquierda  | `(1,29)` ↔ `(6,26)`   |
| `ambusher`  | 14                | derecha   | arriba-derecha   | `(26,1)` ↔ `(21,5)`   |
| `erratic`   | 14                | derecha   | abajo-derecha    | `(26,29)` ↔ `(21,26)` |

Convenciones:

- Coordenadas: celda `(x, y)`, origen arriba-izquierda, igual que `MAZE`. `x` en `[0,27]`, `y` en `[0,30]`.
- Distancias: Manhattan sobre celdas redondeadas, como en SPEC 01.
- Los ocho waypoints son celdas transitables: nunca valor `1` (muro) ni `3` (puerta).
- El rectángulo de una zona es el mínimo rectángulo que contiene sus waypoints `a` y `b`.

## Plan de implementación

1. Añadir `GHOST_ZONES` a `src/js/maze.js` junto a `GHOST_STARTS` y publicarla con `window.GHOST_ZONES`. Verificación: `node --check src/js/maze.js` y `GHOST_ZONES` tiene exactamente las claves `hunter`, `ambusher`, `patroller` y `erratic`.
2. Añadir `zone: GHOST_ZONES[ g.kind ]` a cada fantasma creado en `createGame()`. Verificación: `createGame().ghosts` devuelve cuatro fantasmas y cada uno tiene `zone` con `a` y `b`. La partida sigue arrancando y los fantasmas se mueven como antes.
3. Extraer el cálculo de objetivo por rol de `decideGhost()` a una función `roleTarget( game, g )`, sin cambiar las reglas de SPEC 01 salvo el objetivo alternativo del `patroller`, que pasa de `(1, 1)` a `g.zone.a`. Verificación: `node --check src/js/game.js` y, con Pac-Man a menos de seis celdas de un fantasma, ese fantasma elige el mismo objetivo que en SPEC 01.
4. Añadir `patrolWaypoint( g )` e `isAlerted( game, g )` junto con la constante `GHOST_ALERT_DISTANCE = 6`. `patrolWaypoint` devuelve el waypoint indicado por `g.patrolTarget` y lo cambia al otro extremo cuando el fantasma ya está en él. Verificación: con un fantasma en su zona y Pac-Man en el centro del mapa, `isAlerted` devuelve `false`, y `patrolWaypoint` devuelve el waypoint de `patrolTarget` sin cambiarlo a mitad de camino.
5. Integrar los dos modos en `decideGhost()`: si `isAlerted` usa `roleTarget`, si no usa `patrolWaypoint`, y en ambos casos llama a `shortestDirection` como hasta ahora. Verificación: al arrancar, Pac-Man está a diez celdas o más de las cuatro zonas, así que los cuatro fantasmas salen en modo patrulla y se reparten entre las cuatro esquinas.

## Criterios de aceptación

- [x] `src/js/maze.js` define `GHOST_ZONES` con las cuatro claves `hunter`, `ambusher`, `patroller` y `erratic`.
- [x] Los ocho waypoints son celdas transitables: ninguno vale `1` ni `3` en `MAZE`.
- [x] `createGame()` devuelve cuatro fantasmas y cada uno tiene `zone` igual a `GHOST_ZONES[ kind ]`.
- [x] `GHOST_ALERT_DISTANCE` vale `6`.
- [x] Con Pac-Man a más de seis celdas del waypoint más cercano de la zona, el fantasma patrulla su zona y su objetivo es el waypoint indicado por `patrolTarget`.
- [x] Al llegar a un waypoint, `patrolTarget` cambia al otro waypoint de la zona.
- [x] `patrolTarget` no cambia a mitad de camino entre los dos waypoints.
- [x] Con Pac-Man a seis celdas o menos del waypoint más cercano de la zona, el fantasma usa la lógica de rol de SPEC 01.
- [x] Los fantasmas que salen por la columna `x = 13` (`hunter` y `patroller`) giran a la izquierda al llegar al pasillo de la fila 11.
- [x] Los fantasmas que salen por la columna `x = 14` (`ambusher` y `erratic`) giran a la derecha al llegar al pasillo de la fila 11.
- [x] El `hunter` patrulla entre `(1, 1)` y `(6, 5)`.
- [x] El `ambusher` patrulla entre `(26, 1)` y `(21, 5)`.
- [x] El `patroller` patrulla entre `(1, 29)` y `(6, 26)`.
- [x] El `erratic` patrulla entre `(26, 29)` y `(21, 26)`.
- [x] El objetivo alternativo del `patroller` ya no es `(1, 1)`.
- [x] Cada fantasma alcanza su zona y, mientras no esté en modo alerta, permanece dentro del rectángulo definido por sus dos waypoints.
- [x] Cuando los cuatro fantasmas están en modo patrulla, la distancia Manhattan media entre todos los pares es de al menos 10 celdas.
- [x] El `erratic` en modo alerta se dirige a `(26, 29)`.
- [x] `MAZE_STR` no cambia y la pen conserva una sola boca.
- [x] Las colisiones siguen restando una vida y reiniciando posiciones hasta llegar a `lost`.
- [x] `resetPositions()` deja `patrolTarget` en `'a'`.
- [x] La partida puede llegar a `won` al recoger todos los puntos.
- [x] Los cuatro archivos JavaScript pasan `node --check`.
- [ ] Prueba manual con teclado en el navegador: flechas, recogida de puntos, túnel, colisiones, victoria y derrota. Pendiente porque el navegador en modo headless no ejecuta `requestAnimationFrame`, así que el bucle real de `main.js` no se pudo conducir automáticamente.

## Verificación realizada

Los 22 criterios marcados se comprobaron con dos arneses, ninguno de los cuales forma parte de la aplicación.

- **Simulación en Node** cargando `maze.js` y `game.js` reales: 28 comprobaciones, todas en verde. Incluye una regresión explícita del fallo descrito en la sección de decisiones.
- **Navegador real (Chrome headless) sirviendo `src/` con `python -m http.server`**: la página carga sin errores, `window.GHOST_ZONES` resuelve antes de que `game.js` lo use, el botón Start funciona y el canvas se dibuja. Con Pac-Man fijo en `(13, 23)`, tras 1500 frames los fantasmas salen por su lado (`hunter` y `patroller` a la izquierda, `ambusher` y `erratic` a la derecha) y acaban en `(2,1)`, `(25,1)`, `(4,26)` y `(23,26)`, con una distancia media entre pares de 30,71 celdas.

Antes del cambio, esa misma medición daba 0,67–1,0 celdas de distancia media: los cuatro fantasmas iban pegados.

## Decisiones

- **Sí:** dividir la salida usando el destino de cada fantasma en lugar de una regla explícita de salida. Los fantasmas de la columna 13 van a zonas de la mitad izquierda y los de la columna 14 a zonas de la mitad derecha. La geometría ya hace que la ruta por su propio lado sea más corta, así que la división es consecuencia del destino y no necesita código adicional.
- **Sí:** una zona por rol con dos waypoints. Da un patrullaje determinista y repetible sin añadir temporizadores.
- **Sí:** `patrolTarget` con latch en lugar de elegir en cada celda el waypoint más lejano. La regla sin estado parecía más simple, pero al implementarla se midió que el fantasma se da la vuelta al cruzar la mediatriz del segmento `a`-`b`: el `hunter` oscilaba entre `(5,1)` y `(6,1)` y nunca llegaba a `(1,1)`. Con el latch cada fantasma recorre su zona entera. Cambio detectado y corregido durante la implementación.
- **Sí:** patrullar siempre, con alerta por proximidad. Es lo pedido: dispersión permanente y persecución solo cuando Pac-Man se acerca.
- **Sí:** medir la alerta contra la zona y no contra el fantasma. Un fantasma en el extremo lejano de su zona también debe reaccionar cuando Pac-Man entra en ella.
- **Sí:** umbral de alerta de `6` celdas. Al arrancar, Pac-Man está a 10 celdas o más de las cuatro zonas, así que los cuatro empiezan patrullando y la dispersión se ve desde el primer segundo.
- **Sí:** cambiar el objetivo alternativo del `patroller` de `(1, 1)` a su waypoint `a`. `(1, 1)` es ahora la esquina del `hunter`, y mandar ahí al `patroller` rompería la dispersión.
- **Sí:** conservar el orden de desempate global `[up, left, down, right]`. Los destinos ya son distintos, así que el empate deja de producirse en la práctica.
- **No:** abrir una segunda boca en la pen. Obligaría a tocar `MAZE_STR` y dejaría a Pac-Man entrar en la pen, que hoy es zona segura.
- **No:** desempate propio por fantasma. Es un cambio válido pero innecesario si los destinos ya difieren; se reserva para otra especificación si la dispersión medida no basta.
- **No:** liberación escalonada. SPEC 01 ya la dejó fuera y requiere estado temporal nuevo.
- **No:** un `erratic` agresivo. Con `GHOST_ALERT_DISTANCE = 6`, el umbral interno de 8 de SPEC 01 hace que el `erratic` en modo alerta siempre caiga en su rama de retirada a `(26, 29)`, que es su propio waypoint `a`. Se acepta: el objetivo de esta especificación es la dispersión, no la agresividad, y el `erratic` conserva su patrulla de esquina.

## Riesgos

| Riesgo                                                                                            | Mitigación                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El `hunter` y el `patroller` comparten la columna de salida 13 y podrían ir pegados al principio. | Sus zonas están en esquinas opuestas: el `hunter` gira hacia arriba en la columna 12 y el `patroller` sigue hasta la columna 9 y baja.                        |
| Un waypoint puede caer sobre un muro si el laberinto cambia.                                      | Criterio de aceptación explícito: los ocho waypoints deben ser celdas transitables, nunca `1` ni `3`.                                                         |
| Con un umbral de alerta alto los fantasmas perseguirían casi siempre y la dispersión no se vería. | El valor vive en la única constante `GHOST_ALERT_DISTANCE` y se ajusta sin tocar la lógica.                                                                   |
| `shortestDirection()` devuelve `null` si el fantasma ya está en su objetivo.                      | `patrolWaypoint` cambia de waypoint en cuanto el fantasma llega, así que el objetivo nunca es la celda actual. Los waypoints `a` y `b` son celdas distintas. |
| Los fantasmas pueden quedar dispersos pero no llegar nunca a su zona.                             | Criterio de aceptación: cada fantasma debe alcanzar su zona y permanecer dentro del rectángulo de sus dos waypoints mientras no esté en alerta.               |
| "Simplificar" el patrullaje volviendo a elegir en cada celda el waypoint más lejano.               | Reintroduce la oscilación medida a mitad de camino. El criterio "`patrolTarget` no cambia a mitad de camino" lo detecta.                                      |

## Lo que **no** está incluido en esta especificación

- Una segunda boca física en la pen.
- Cambios en la geometría de `MAZE_STR`.
- Desempate propio por fantasma.
- Liberación escalonada con temporizador.
- Cambios visuales en los fantasmas.
- Persistencia, power-ups o estados vulnerables.
- Modificaciones de HTML o CSS.

Cada uno de esos puntos, si llega, va en su propia especificación.
