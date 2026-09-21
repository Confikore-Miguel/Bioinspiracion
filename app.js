/* ============================================================
   app.js — Interfaz, animación y visualización
   ============================================================ */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const chart = document.getElementById('chart');
const cctx = chart.getContext('2d');

let maze = null;
let aco = null;
let running = false;
let animId = null;
let bfsLen = null;

// ---------- Helpers de UI ----------
const $ = id => document.getElementById(id);

function bindSlider(id, outId, decimals = 0) {
  const el = $(id), out = $(outId);
  const update = () => {
    out.textContent = decimals > 0 ? parseFloat(el.value).toFixed(decimals) : el.value;
  };
  el.addEventListener('input', update);
  update();
  return el;
}

const sizeEl = bindSlider('size', 'sizeVal');
const antsEl = bindSlider('ants', 'antsVal');
const alphaEl = bindSlider('alpha', 'alphaVal', 1);
const betaEl = bindSlider('beta', 'betaVal', 1);
const rhoEl = bindSlider('rho', 'rhoVal', 2);
const iterEl = bindSlider('iter', 'iterVal');

// ---------- Inicialización ----------
function newMaze() {
  stop();
  const size = parseInt(sizeEl.value);
  maze = generateMaze(size, size);
  bfsLen = bfsShortestPath(maze.grid, maze.entrance, maze.exit)?.length || null;
  $('statBFS').textContent = bfsLen ? `${bfsLen} pasos` : 'N/A';
  resetACO();
  render();
}

function resetACO() {
  const params = {
    numAnts: parseInt(antsEl.value),
    alpha: parseFloat(alphaEl.value),
    beta: parseFloat(betaEl.value),
    rho: parseFloat(rhoEl.value),
    iterations: parseInt(iterEl.value),
    mode: $('mode').value
  };
  aco = new ACO(maze.grid, maze.entrance, maze.exit, params);
  updateStats();
  drawChart();
}

// ---------- Animación ----------
function start() {
  if (running) return;
  if (aco.iteration >= aco.params.iterations) resetACO();
  running = true;
  $('statState').textContent = 'Ejecutando…';
  loop();
}

function stop() {
  running = false;
  if (animId) cancelAnimationFrame(animId);
  animId = null;
  $('statState').textContent = 'Detenido';
}

function loop() {
  if (!running) return;

  // Ejecutar varias iteraciones por frame (velocidad)
  const stepsPerFrame = 2;
  for (let i = 0; i < stepsPerFrame; i++) {
    const finished = aco.step();
    if (finished) {
      running = false;
      $('statState').textContent = '✅ Completado';
      break;
    }
  }

  render();
  updateStats();
  drawChart();

  if (running) animId = requestAnimationFrame(loop);
}

// ---------- Render principal ----------
function render() {
  if (!aco) return;
  const cell = canvas.width / Math.max(aco.W, aco.H);

  // Fondo
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Max feromona
  let maxP = 0.001;
  for (let y = 0; y < aco.H; y++)
    for (let x = 0; x < aco.W; x++)
      if (aco.pheromone[y][x] > maxP) maxP = aco.pheromone[y][x];

  // Celdas
  for (let y = 0; y < aco.H; y++) {
    for (let x = 0; x < aco.W; x++) {
      const px = x * cell, py = y * cell;
      if (aco.grid[y][x] === 1) {
        ctx.fillStyle = '#05070d';
        ctx.fillRect(px, py, cell, cell);
      } else {
        const t = Math.min(1, aco.pheromone[y][x] / maxP);
        const r = Math.floor(20 + 235 * t);
        const g = Math.floor(80 + 100 * (1 - t) * (1 - t));
        const b = Math.floor(180 * (1 - t) + 30);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(px, py, cell, cell);
      }
    }
  }

  // Rutas de la última iteración (semi-transparentes)
  ctx.lineWidth = Math.max(1, cell * 0.15);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  for (const path of aco.lastPaths) {
    if (!path || path.length < 2) continue;
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const [y, x] = path[i];
      const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Mejor ruta
  if (aco.bestPath) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = Math.max(2, cell * 0.28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < aco.bestPath.length; i++) {
      const [y, x] = aco.bestPath[i];
      const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Entrada (verde) y salida (roja)
  drawDot(aco.entrance, cell, '#3fb950');
  drawDot(aco.exit, cell, '#f85149');
}

function drawDot([y, x], cell, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x * cell + cell / 2, y * cell + cell / 2, cell * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ---------- Estadísticas ----------
function updateStats() {
  if (!aco) return;
  $('statIter').textContent = `${aco.iteration} / ${aco.params.iterations}`;
  $('statLength').textContent = aco.bestPath ? aco.bestPath.length : '-';
  $('statUnique').textContent = aco.bestUnique || '-';
  $('statFitness').textContent = aco.bestFitness > -Infinity ? aco.bestFitness.toFixed(3) : '-';
}

// ---------- Gráfico de convergencia ----------
function drawChart() {
  if (!aco || aco.history.length === 0) {
    cctx.clearRect(0, 0, chart.width, chart.height);
    return;
  }
  const w = chart.width, h = chart.height, pad = 24;
  cctx.fillStyle = '#0d1117';
  cctx.fillRect(0, 0, w, h);

  // Ejes
  cctx.strokeStyle = '#30363d';
  cctx.lineWidth = 1;
  cctx.beginPath();
  cctx.moveTo(pad, h - pad); cctx.lineTo(w - pad, h - pad);
  cctx.moveTo(pad, pad); cctx.lineTo(pad, h - pad);
  cctx.stroke();

  const hist = aco.history;
  const fitnesses = hist.map(d => d.bestFitness);
  const minF = Math.min(...fitnesses);
  const maxF = Math.max(...fitnesses);
  const range = maxF - minF || 1;
  const maxIter = Math.max(1, aco.params.iterations);

  cctx.strokeStyle = '#58a6ff';
  cctx.lineWidth = 2;
  cctx.beginPath();
  hist.forEach((d, i) => {
    const x = pad + (d.iteration / maxIter) * (w - 2 * pad);
    const y = h - pad - ((d.bestFitness - minF) / range) * (h - 2 * pad);
    if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
  });
  cctx.stroke();

  // Etiquetas
  cctx.fillStyle = '#8b949e';
  cctx.font = '11px monospace';
  cctx.fillText(`min: ${minF.toFixed(3)}`, pad + 4, pad + 12);
  cctx.fillText(`max: ${maxF.toFixed(3)}`, pad + 4, h - pad - 4);
  cctx.fillText(`iteración ${aco.iteration}`, w - 110, h - 8);
}

// ---------- Eventos ----------
$('btnStart').addEventListener('click', start);
$('btnPause').addEventListener('click', stop);
$('btnReset').addEventListener('click', () => { stop(); resetACO(); render(); });
$('btnNewMaze').addEventListener('click', newMaze);
$('mode').addEventListener('change', () => { stop(); resetACO(); render(); });
['ants', 'alpha', 'beta', 'rho', 'iter'].forEach(id => {
  $(id).addEventListener('change', () => { stop(); resetACO(); render(); });
});

// ---------- Arranque ----------
newMaze();