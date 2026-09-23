# MEMORY — 05-open-pacman

Notas duraderas del proyecto. Complementan a `AGENTS.md`, no lo sustituyen.

## Flujo de trabajo con specs

- Los specs viven en `specs/NN-slug.md`, en español, numerados a dos dígitos.
- Estados usados: `Draft` → `Approved` → `Implemented`.
- `.agents/skills/spec/SKILL.md` define el comando `/spec` (diseño guiado, cuatro fases). `.agents/skills/spec/template.md` es la plantilla de secciones.
- `specs/.spec-config.yml` define `AutoCreateBranch` (por defecto `true`): la implementación crea y cambia a la rama `spec-NN-slug`.
- `/spec-impl` **ya existe**: fork local de `klerith/fernando-skills` con una extensión propia (modo de ejecución por argumento). Copia en `.agents/skills/spec-impl/SKILL.md` y en `~/.workbuddy-ai/skills/spec-impl/SKILL.md`; las dos deben ser idénticas.
  - **Motivo de la doble copia:** WorkBuddy no carga `.agents/skills/` (esa carpeta es de otros agentes), así que la copia de `~/.workbuddy-ai/skills/` es la que hace que el comando funcione aquí. Sin ella, `/spec-impl` llega como texto plano.
  - **Modo:** `/spec-impl NN-slug step` (para tras cada paso del plan) o `/spec-impl NN-slug auto` (todo de una vez). Sin token de modo, el skill pregunta. Deliberadamente **no** hay clave en `.spec-config.yml`: `AutoCreateBranch` es del repo, el modo es de la ejecución.
  - El skill no commitea ni cambia el estado de la spec: eso lo hace la persona.
- Convención observada en git: implementar en `spec-NN-slug` y luego abrir un pull request contra `main`.
- `skills-lock.json` registra la skill `spec` como instalada desde `klerith/fernando-skills`. El fork local de `spec-impl` **no** está en ese lockfile a propósito: su hash no coincidiría con el de upstream.

## Verificación

No hay gestor de paquetes, build, lint ni tests. Verificación usada:

- `node --check src/js/{maze,game,render,main}.js`.
- Arnés en Node que carga los ficheros reales por `eval` indirecto y llama a `createGame()` / `update()`. Detalles que importan:
  - Las declaraciones `const` de ámbito global no son visibles desde el código de módulo de Node. Si el arnés necesita una constante, hay que republicarla en `window` desde el propio arnés, no tocar el código de la app.
  - Los fantasmas se alinean con la celda cada 10 frames y se mueven 0,1 celda/frame, así que muestrear posiciones después de `update()` **no** captura la celda donde se tomó la decisión. Para ver qué dirección eligió un fantasma, o bien instrumentar `decideGhost`, o bien derivarla del delta de posición del frame siguiente.
- Navegador real: `python -m http.server 8000 --directory src` y Chrome headless con `--dump-dom` / `--screenshot`.
  - **`requestAnimationFrame` no se ejecuta en headless** (`--dump-dom` ni con `--virtual-time-budget`). El bucle de `main.js` no avanza: hay que conducir `update()` a mano.
  - Los `const` de nivel superior en scripts clásicos comparten el mismo ámbito léxico global. Redefinir un nombre que ya usa `main.js` (`canvas`, `ctx`, `game`, `frame`, …) rompe el script entero con un `SyntaxError` silencioso. En páginas de prueba, prefijar todos los nombres.
  - `--screenshot` necesita ruta de Windows (`C:\...`), no `/tmp/...`.

## Arquitectura

- Scripts clásicos cargados en orden por `index.html`: `maze.js` → `game.js` → `render.js` → `main.js`. Se comunican por globals en `window`.
- `maze.js` es el dueño del laberinto pristino y de la geometría de inicio (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`, `GHOST_ZONES`).
- `game.js` copia el laberinto por partida y gobierna movimiento, colisiones, puntuación, vidas y estados.
- `render.js` solo dibuja; `main.js` solo bucle, teclado y overlays.
- La pen de fantasmas tiene **una sola boca**: la puerta de la fila 12, columnas 13-14. Cualquier idea de "salir por los dos lados" tiene que resolverse sin abrir el laberinto, porque abrir los laterales dejaría a Pac-Man entrar en la pen.
- `shortestDirection()` desempata con el orden fijo `[up, left, down, right]`. Como el laberinto es simétrico respecto al eje central, **cualquier empate se resuelve hacia la izquierda**. Si dos fantasmas comparten objetivo, comparten ruta y acaban en fila india. La forma de separarlos es darles destinos distintos, no cambiar el desempate.
