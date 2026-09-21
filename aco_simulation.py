"""
aco_simulation.py — Versión interactiva
========================================
Mente artificial bioinspirada (ACO) con controles en vivo.

Ejecutar:  python aco_simulation.py
Requiere:  numpy, matplotlib

Controles dentro de la ventana:
  [N]      Nuevo laberinto
  [ESPACIO] Pausar / Reanudar
  [R]      Reiniciar ACO (mismo laberinto)
  [M]      Cambiar modo de ruta(corta <-> larga)
  [1-4]    Cambiar tamaño (6, 8, 12, 16)
  [Q]      Salir

También hay botones en la parte inferior de la ventana.
"""

import numpy as np
import matplotlib
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from matplotlib.widgets import Button, RadioButtons
from matplotlib.backend_bases import NavigationToolbar2
from collections import deque
import random
import sys
from matplotlib.backend_bases import NavigationToolbar2

NavigationToolbar2.toolitems = (
    ('Save', 'Guardar imagen', 'filesave', 'save_figure'),
)

# ============================================================
# 1. Generación de laberinto
# ============================================================
def generate_maze(cols, rows, loop_chance=0.12):
    W, H = 2 * cols + 1, 2 * rows + 1
    grid = np.ones((H, W), dtype=int)
    visited = np.zeros((rows, cols), dtype=bool)

    def carve(cx, cy):
        visited[cy, cx] = True
        grid[2 * cy + 1, 2 * cx + 1] = 0
        dirs = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        random.shuffle(dirs)
        for dx, dy in dirs:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < cols and 0 <= ny < rows and not visited[ny, nx]:
                grid[2 * cy + 1 + dy, 2 * cx + 1 + dx] = 0
                carve(nx, ny)

    carve(0, 0)

    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if grid[y, x] == 1:
                h = grid[y, x - 1] == 0 and grid[y, x + 1] == 0
                v = grid[y - 1, x] == 0 and grid[y + 1, x] == 0
                if (h or v) and random.random() < loop_chance:
                    grid[y, x] = 0

    return grid, (1, 1), (H - 2, W - 2)


def bfs_shortest(grid, start, end):
    H, W = grid.shape
    q = deque([start])
    prev = {}
    seen = {start}
    while q:
        y, x = q.popleft()
        if (y, x) == end:
            path, cur = [], (y, x)
            while cur in prev:
                path.append(cur)
                cur = prev[cur]
            path.append(start)
            return path[::-1]
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and grid[ny, nx] == 0 and (ny, nx) not in seen:
                seen.add((ny, nx))
                prev[(ny, nx)] = (y, x)
                q.append((ny, nx))
    return None


# ============================================================
# 2. Algoritmo ACO
# ============================================================
class ACO:
    def __init__(self, grid, entrance, exit_, params):
        self.grid = grid
        self.H, self.W = grid.shape
        self.entrance = entrance
        self.exit = exit_
        self.params = params
        self.reset()

    def reset(self):
        self.pheromone = np.full((self.H, self.W), 0.1)
        self.best_path = None
        self.best_fitness = -np.inf
        self.best_unique = 0
        self.history = []
        self.iteration = 0
        self.last_paths = []

    def neighbors(self, y, x):
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < self.H and 0 <= nx < self.W and self.grid[ny, nx] == 0:
                yield ny, nx

    def construct_path(self):
        path = [self.entrance]
        visits = {self.entrance: 1}
        current = self.entrance
        max_steps = self.H * self.W * 2
        alpha, beta = self.params['alpha'], self.params['beta']
        mode = self.params['mode']

        for _ in range(max_steps):
            if current == self.exit:
                return path, True

            nbrs = list(self.neighbors(*current))
            if not nbrs:
                break

            probs, total = [], 0.0
            for ny, nx in nbrs:
                v = visits.get((ny, nx), 0)
                penalty = 0.05 ** v if v > 0 else 1.0
                tau = (self.pheromone[ny, nx] + 1e-6) ** alpha
                if mode == 'shortest':
                    d = abs(ny - self.exit[0]) + abs(nx - self.exit[1]) + 1
                    eta = (1 / d) ** beta
                else:
                    unexplored = sum(
                        1 for yy, xx in self.neighbors(ny, nx) if (yy, xx) not in visits
                    )
                    eta = (unexplored + 1) ** beta
                p = tau * eta * penalty
                probs.append(((ny, nx), p))
                total += p

            if total <= 0:
                break

            r = random.random() * total
            chosen = probs[-1][0]
            for pos, p in probs:
                r -= p
                if r <= 0:
                    chosen = pos
                    break

            current = chosen
            path.append(current)
            visits[current] = visits.get(current, 0) + 1

        return path, False

    def evaluate(self, path, reached):
        if not reached:
            return -1, 0
        unique = len(set(path))
        if self.params['mode'] == 'shortest':
            return 1 / len(path), unique
        return float(unique), unique

    def update_pheromones(self, paths, fitnesses):
        rho = self.params['rho']
        self.pheromone *= (1 - rho)
        for p, f in zip(paths, fitnesses):
            if f <= 0:
                continue
            for (y, x) in p:
                self.pheromone[y, x] += f

    def step(self):
        paths, fits, reached_flags = [], [], []
        for _ in range(self.params['num_ants']):
            p, reached = self.construct_path()
            f, u = self.evaluate(p, reached)
            paths.append(p)
            fits.append(f)
            reached_flags.append(reached)
            if f > self.best_fitness:
                self.best_fitness = f
                self.best_path = p[:]
                self.best_unique = u

        self.update_pheromones(paths, fits)
        self.iteration += 1
        self.last_paths = [p for p, r in zip(paths, reached_flags) if r]
        self.history.append((self.best_fitness, self.best_unique))
        return self.best_path, self.best_fitness, self.best_unique

    @property
    def finished(self):
        return self.iteration >= self.params.get('iterations', 999999)


# ============================================================
# 3. Aplicación interactiva
# ============================================================
class ACOApp:
    def __init__(self):
        self.size = 8
        self.mode = 'shortest'
        self.paused = False
        self.base_params = dict(
            num_ants=20, alpha=1.0, beta=2.0, rho=0.5, iterations=999999
        )

        # --- Figura y ejes ---
        self.fig = plt.figure(figsize=(13, 7.5))
        self.fig.suptitle('🧠 Mente Artificial Bioinspirada — ACO interactivo',
                          fontsize=13, fontweight='bold')

        self.ax_maze = self.fig.add_axes([0.05, 0.22, 0.55, 0.66])
        self.ax_conv = self.fig.add_axes([0.65, 0.55, 0.32, 0.38])
        self.ax_stats = self.fig.add_axes([0.65, 0.22, 0.32, 0.28])
        self.ax_stats.axis('off')

        # --- Botones ---
        btn_w, btn_h = 0.11, 0.045
        y_b = 0.08
        ax_btn_new     = self.fig.add_axes([0.05, y_b, btn_w, btn_h])
        ax_btn_reset   = self.fig.add_axes([0.17, y_b, btn_w, btn_h])
        ax_btn_pause   = self.fig.add_axes([0.29, y_b, btn_w, btn_h])
        ax_btn_mode    = self.fig.add_axes([0.41, y_b, btn_w, btn_h])

        self.b_new   = Button(ax_btn_new,   'Nuevo laberinto\n[N]')
        self.b_reset = Button(ax_btn_reset, 'Reiniciar ACO\n[R]')
        self.b_pause = Button(ax_btn_pause, 'Pausar\n[ESPACIO]')
        self.b_mode  = Button(ax_btn_mode,  'Modo: corta\n[M]')

        self.b_new.on_clicked(lambda e: self.new_maze())
        self.b_reset.on_clicked(lambda e: self.reset_aco())
        self.b_pause.on_clicked(lambda e: self.toggle_pause())
        self.b_mode.on_clicked(lambda e: self.toggle_mode())

        # --- Radio buttons para tamaño ---
        ax_radio = self.fig.add_axes([0.55, 0.05, 0.18, 0.13])
        ax_radio.set_title('Tamaño', fontsize=9)
        self.radio = RadioButtons(ax_radio, ('4x4', '8x8', '12x12', '16x16'), active=1)
        self.radio.on_clicked(self.change_size)

        # --- Ayuda ---
        self.fig.text(0.75, 0.14,
                      'Atajos:  [N]uevo  [ESPACIO]pausa\n'
                      '[R]einiciar  [M]odo  [Q]uit',
                      fontsize=8.5, color='#555')

        # --- Eventos teclado ---
        self.fig.canvas.mpl_connect('key_press_event', self.on_key)

        # --- Estado interno ---
        self.maze_data = None
        self.aco = None
        self.bfs_len = None
        self.new_maze()

        # --- Animación ---
        self.anim = animation.FuncAnimation(
            self.fig, self.update, interval=90, blit=False,
            cache_frame_data=False
        )

    # -------- Acciones --------
    def new_maze(self):
        self.maze_data = generate_maze(self.size, self.size)
        grid, entrance, exit_ = self.maze_data
        path = bfs_shortest(grid, entrance, exit_)
        self.bfs_len = len(path) if path else None
        self.reset_aco()

    def reset_aco(self):
        grid, entrance, exit_ = self.maze_data
        params = dict(self.base_params)
        params['mode'] = self.mode
        self.aco = ACO(grid, entrance, exit_, params)
        self.paused = False
        self.b_pause.label.set_text('Pausar\n[ESPACIO]')
        self.draw_static()

    def toggle_pause(self):
        self.paused = not self.paused
        self.b_pause.label.set_text(
            'Reanudar\n[ESPACIO]' if self.paused else 'Pausar\n[ESPACIO]'
        )

    def toggle_mode(self):
        self.mode = 'longest' if self.mode == 'shortest' else 'shortest'
        label = 'Modo: larga' if self.mode == 'longest' else 'Modo: corta'
        self.b_mode.label.set_text(f'{label}\n[M]')
        self.reset_aco()

    def change_size(self, label):
        self.size = int(label.split('x')[0])
        self.new_maze()

    def on_key(self, event):
        k = event.key
        if k == 'n':
            self.new_maze()
        elif k == ' ':
            self.toggle_pause()
        elif k == 'r':
            self.reset_aco()
        elif k == 'm':
            self.toggle_mode()
        elif k in ('1', '2', '3', '4'):
            sizes = {'1': 4, '2': 8, '3': 12, '4': 16}
            self.size = sizes[k]
            self.new_maze()
        elif k in ('q', 'escape'):
            plt.close(self.fig)
            sys.exit(0)

    # -------- Dibujo --------
    def draw_static(self):
        grid, entrance, exit_ = self.maze_data
        self.ax_maze.clear()
        self.ax_maze.imshow(grid, cmap='gray_r', vmin=0, vmax=1)
        self.ax_maze.plot(entrance[1], entrance[0], 'go', ms=12,
                          markeredgecolor='white', markeredgewidth=1.5)
        self.ax_maze.plot(exit_[1], exit_[0], 'ro', ms=12,
                          markeredgecolor='white', markeredgewidth=1.5)
        self.ax_maze.axis('off')

    def update(self, frame):
        if self.aco is None:
            return

        if not self.paused:
            for _ in range(2):
                self.aco.step()
                if self.aco.iteration > 2000:
                    self.paused = True
                    break

        self.render_maze()
        self.render_conv()
        self.render_stats()

    def render_maze(self):
        grid, entrance, exit_ = self.maze_data
        aco = self.aco
        self.ax_maze.clear()
        self.ax_maze.imshow(grid, cmap='gray_r', vmin=0, vmax=1)

        # Overlay de feromonas
        maxp = aco.pheromone.max() or 1
        norm = np.clip(aco.pheromone / maxp, 0, 1)
        overlay = np.zeros((*grid.shape, 4))
        overlay[..., 0] = norm                       # R
        overlay[..., 2] = 1 - norm                   # B
        overlay[..., 3] = np.where(grid == 0, norm * 0.75, 0)
        self.ax_maze.imshow(overlay)

        # Últimas rutas (semáforos)
        for path in aco.last_paths[:25]:
            ys = [p[0] for p in path]
            xs = [p[1] for p in path]
            self.ax_maze.plot(xs, ys, color='white', alpha=0.08, lw=1)

        # Mejor ruta
        if aco.best_path:
            ys = [p[0] for p in aco.best_path]
            xs = [p[1] for p in aco.best_path]
            self.ax_maze.plot(xs, ys, color='gold', lw=3,
                              solid_capstyle='round', zorder=5)

        # Entrada / salida
        self.ax_maze.plot(entrance[1], entrance[0], 'go', ms=12,
                          markeredgecolor='white', markeredgewidth=1.5, zorder=6)
        self.ax_maze.plot(exit_[1], exit_[0], 'ro', ms=12,
                          markeredgecolor='white', markeredgewidth=1.5, zorder=6)

        mode_txt = 'CORTA' if self.mode == 'shortest' else 'LARGA'
        self.ax_maze.set_title(
            f'Iteración {aco.iteration}  ·  Modo: {mode_txt}',
            fontsize=11
        )
        self.ax_maze.axis('off')

    def render_conv(self):
        self.ax_conv.clear()
        self.ax_conv.set_title('Convergencia', fontsize=10)
        hist = self.aco.history
        if hist:
            fits = [h[0] for h in hist]
            self.ax_conv.plot(fits, color='#1f77b4', lw=1.8)
            self.ax_conv.set_xlabel('Iteración', fontsize=8)
            self.ax_conv.set_ylabel('Fitness', fontsize=8)
            self.ax_conv.tick_params(labelsize=7)
            self.ax_conv.grid(alpha=0.3)

    def render_stats(self):
        aco = self.aco
        self.ax_stats.clear()
        self.ax_stats.axis('off')

        best_len = len(aco.best_path) if aco.best_path else '-'
        best_fit = f'{aco.best_fitness:.4f}' if aco.best_fitness > -np.inf else '-'
        unique = aco.best_unique if aco.best_unique else '-'
        bfs = self.bfs_len if self.bfs_len else 'N/A'
        state = '⏸ Pausado' if self.paused else '▶ Ejecutando'

        lines = [
            f'Estado:            {state}',
            f'Iteración:         {aco.iteration}',
            f'Longitud mejor:    {best_len}',
            f'Celdas únicas:     {unique}',
            f'Fitness:           {best_fit}',
            f'BFS (referencia):  {bfs}',
            '',
            f'Hormigas:          {aco.params["num_ants"]}',
            f'α = {aco.params["alpha"]}   β = {aco.params["beta"]}   ρ = {aco.params["rho"]}',
        ]

        y = 0.92
        for line in lines:
            self.ax_stats.text(0.0, y, line, transform=self.ax_stats.transAxes,
                               fontsize=9.5, family='monospace', va='top')
            y -= 0.11


# ============================================================
# 4. Punto de entrada
# ============================================================
if __name__ == '__main__':
    # Deja la barra por defecto (toolbar2), pero vaciada más abajo
    plt.rcParams['toolbar'] = 'toolbar2'
    app = ACOApp()
    plt.show()