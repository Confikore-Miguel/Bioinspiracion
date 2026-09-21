/* ============================================================
   maze.js — Generación de laberintos (recursive backtracking)
   ============================================================ */

function generateMaze(cols, rows, loopChance = 0.12) {
  const W = 2 * cols + 1;
  const H = 2 * rows + 1;
  const grid = Array(H).fill().map(() => Array(W).fill(1)); // 1 = pared
  const visited = Array(rows).fill().map(() => Array(cols).fill(false));

  function carve(cx, cy) {
    visited[cy][cx] = true;
    grid[2 * cy + 1][2 * cx + 1] = 0;

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) {
        grid[2 * cy + 1 + dy][2 * cx + 1 + dx] = 0;
        carve(nx, ny);
      }
    }
  }

  carve(0, 0);

  // Añadir bucles (elimina algunas paredes interiores)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (grid[y][x] === 1) {
        const h = grid[y][x - 1] === 0 && grid[y][x + 1] === 0;
        const v = grid[y - 1][x] === 0 && grid[y + 1][x] === 0;
        if ((h || v) && Math.random() < loopChance) grid[y][x] = 0;
      }
    }
  }

  return {
    grid, W, H,
    entrance: [1, 1],
    exit: [H - 2, W - 2]
  };
}

/* BFS — Ruta más corta exacta (referencia de validación) */
function bfsShortestPath(grid, start, end) {
  const H = grid.length, W = grid[0].length;
  const queue = [[start[0], start[1]]];
  const prev = new Map();
  const visited = new Set();
  visited.add(start[0] * W + start[1]);

  while (queue.length > 0) {
    const [y, x] = queue.shift();
    if (y === end[0] && x === end[1]) {
      const path = [];
      let curr = [y, x];
      while (curr) {
        path.unshift(curr);
        curr = prev.get(curr[0] * W + curr[1]);
      }
      return path;
    }
    for (const [dy, dx] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const ny = y + dy, nx = x + dx;
      if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue;
      if (grid[ny][nx] !== 0) continue;
      const key = ny * W + nx;
      if (visited.has(key)) continue;
      visited.add(key);
      prev.set(key, [y, x]);
      queue.push([ny, nx]);
    }
  }
  return null;
}