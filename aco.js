/* ============================================================
   aco.js — Algoritmo de Colonias de Hormigas (ACO)
   ============================================================ */

class ACO {
  constructor(grid, entrance, exit, params) {
    this.grid = grid;
    this.H = grid.length;
    this.W = grid[0].length;
    this.entrance = entrance;
    this.exit = exit;
    this.params = params;

    // Matriz de feromonas
    this.pheromone = Array(this.H).fill().map(() => Array(this.W).fill(0.1));

    this.bestPath = null;
    this.bestFitness = -Infinity;
    this.bestUnique = 0;
    this.iteration = 0;
    this.history = [];
    this.lastPaths = [];
  }

  isPassable(y, x) {
    return y >= 0 && y < this.H && x >= 0 && x < this.W && this.grid[y][x] === 0;
  }

  neighbors(y, x) {
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const result = [];
    for (const [dy, dx] of dirs) {
      const ny = y + dy, nx = x + dx;
      if (this.isPassable(ny, nx)) result.push([ny, nx]);
    }
    return result;
  }

  constructPath() {
    const path = [this.entrance];
    const visitCount = new Map();
    visitCount.set(this.entrance[0] * this.W + this.entrance[1], 1);
    let current = this.entrance;
    const maxSteps = this.H * this.W * 2;
    const { alpha, beta, mode } = this.params;

    for (let step = 0; step < maxSteps; step++) {
      if (current[0] === this.exit[0] && current[1] === this.exit[1]) {
        return { path, reached: true };
      }

      const nbrs = this.neighbors(current[0], current[1]);
      if (nbrs.length === 0) break;

      const probs = [];
      let sum = 0;

      for (const [ny, nx] of nbrs) {
        const key = ny * this.W + nx;
        const visits = visitCount.get(key) || 0;
        const revisitPenalty = visits > 0 ? Math.pow(0.05, visits) : 1;

        const tau = Math.pow(this.pheromone[ny][nx] + 1e-6, alpha);

        let eta;
        if (mode === 'shortest') {
          const d = Math.abs(ny - this.exit[0]) + Math.abs(nx - this.exit[1]) + 1;
          eta = Math.pow(1 / d, beta);
        } else {
          const unexplored = this.neighbors(ny, nx)
            .filter(([y2, x2]) => !visitCount.has(y2 * this.W + x2)).length;
          eta = Math.pow(unexplored + 1, beta);
        }

        const p = tau * eta * revisitPenalty;
        probs.push([ny, nx, p]);
        sum += p;
      }

      if (sum <= 0) break;

      let r = Math.random() * sum;
      let chosen = probs[probs.length - 1];
      for (const item of probs) {
        r -= item[2];
        if (r <= 0) { chosen = item; break; }
      }

      current = [chosen[0], chosen[1]];
      path.push(current);
      const key = current[0] * this.W + current[1];
      visitCount.set(key, (visitCount.get(key) || 0) + 1);
    }

    return { path, reached: false };
  }

  evaluate(path, reached) {
    if (!reached) return { fitness: -1, unique: 0 };
    const unique = new Set(path.map(([y, x]) => y * this.W + x)).size;
    let fitness;
    if (this.params.mode === 'shortest') {
      fitness = 1 / path.length;
    } else {
      fitness = unique;
    }
    return { fitness, unique };
  }

  updatePheromones(paths, fitnesses) {
    const rho = this.params.rho;
    const Q = 1.0;

    // Evaporación
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        this.pheromone[y][x] *= (1 - rho);
      }
    }

    // Depósito
    for (let i = 0; i < paths.length; i++) {
      if (fitnesses[i] <= 0) continue;
      const deposit = Q * fitnesses[i];
      for (const [y, x] of paths[i]) {
        this.pheromone[y][x] += deposit;
      }
    }
  }

  step() {
    const allPaths = [];
    const allFitnesses = [];
    const allReached = [];

    for (let i = 0; i < this.params.numAnts; i++) {
      const { path, reached } = this.constructPath();
      const { fitness, unique } = this.evaluate(path, reached);

      allPaths.push(path);
      allFitnesses.push(fitness);
      allReached.push(reached);

      if (fitness > this.bestFitness) {
        this.bestFitness = fitness;
        this.bestPath = path.slice();
        this.bestUnique = unique;
      }
    }

    this.updatePheromones(allPaths, allFitnesses);
    this.iteration++;
    this.lastPaths = allPaths.filter((p, i) => allReached[i]);

    this.history.push({
      iteration: this.iteration,
      bestFitness: this.bestFitness,
      bestLength: this.bestPath ? this.bestPath.length : 0,
      bestUnique: this.bestUnique
    });

    return this.iteration >= this.params.iterations;
  }
}