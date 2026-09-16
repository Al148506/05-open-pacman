// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
const GHOST_TIE_BREAK = [ 'up', 'left', 'down', 'right' ];

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function nextCell( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return null;

  let nx = x + d.x;
  const ny = y + d.y;
  if ( ny === TUNNEL_ROW && ( nx < 0 || nx >= grid[ 0 ].length ) ) {
    nx = nx < 0 ? grid[ 0 ].length - 1 : 0;
  }
  if ( !canMove( grid, x, y, dir, actor ) ) return null;
  return { x: nx, y: ny };
}

function nearestTraversable( grid, target, actor ) {
  const tx = Math.round( target.x );
  const ty = Math.round( target.y );
  const isTargetValid = ( x, y ) => (
    y >= 0 && y < grid.length && x >= 0 && x < grid[ 0 ].length &&
    grid[ y ][ x ] !== 1 && grid[ y ][ x ] !== 3
  );
  if ( isTargetValid( tx, ty ) ) return { x: tx, y: ty };

  let nearest = null;
  let nearestDistance = Infinity;
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let x = 0; x < grid[ 0 ].length; x++ ) {
      if ( !isTargetValid( x, y ) ) continue;
      const distance = Math.abs( x - tx ) + Math.abs( y - ty );
      if ( distance < nearestDistance ) {
        nearest = { x, y };
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}

function shortestDirection( grid, start, target, actor ) {
  const goal = nearestTraversable( grid, target, actor );
  if ( !goal ) return null;
  if ( start.x === goal.x && start.y === goal.y ) return null;

  const queue = [ { x: start.x, y: start.y, firstDir: null } ];
  const visited = new Set( [ `${ start.x },${ start.y }` ] );
  let index = 0;

  while ( index < queue.length ) {
    const current = queue[ index++ ];
    for ( const dir of GHOST_TIE_BREAK ) {
      const cell = nextCell( grid, current.x, current.y, dir, actor );
      if ( !cell ) continue;
      const key = `${ cell.x },${ cell.y }`;
      if ( visited.has( key ) ) continue;
      const firstDir = current.firstDir || dir;
      if ( cell.x === goal.x && cell.y === goal.y ) return firstDir;
      visited.add( key );
      queue.push( { x: cell.x, y: cell.y, firstDir } );
    }
  }
  return null;
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const distance = g.kind === 'ambusher' ? 4 : 2;
  const ahead = ( amount ) => {
    const d = DIRS[ p.dir ];
    return { x: px + d.x * amount, y: py + d.y * amount };
  };

  let target;
  if ( g.kind === 'hunter' ) {
    target = { x: px, y: py };
  } else if ( g.kind === 'ambusher' ) {
    target = ahead( distance );
  } else if ( g.kind === 'patroller' ) {
    target = ahead( distance );
    if ( grid[ target.y ]?.[ target.x ] === 1 || grid[ target.y ]?.[ target.x ] === 3 ||
      target.x < 0 || target.x >= grid[ 0 ].length || target.y < 0 || target.y >= grid.length ) {
      target = { x: 1, y: 1 };
    }
  } else {
    target = Math.abs( px - Math.round( g.x ) ) + Math.abs( py - Math.round( g.y ) ) >= 8
      ? { x: px, y: py }
      : { x: 26, y: 29 };
  }

  const direction = shortestDirection( grid, g, target, 'ghost' );
  if ( direction ) g.dir = direction;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
