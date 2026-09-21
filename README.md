# 🧠 Mente Artificial Bioinspirada — ACO

Simulación web interactiva de una **mente artificial** basada en el
comportamiento colectivo de una colonia de hormigas (*Ant Colony Optimization*).

## 🚀 Cómo ejecutar la versión web

1. Guarda todos los archivos en una misma carpeta.
2. Abre `index.html` en cualquier navegador moderno (Chrome, Firefox, Edge).
3. No requiere servidor ni instalación.

### Controles
| Control | Descripción |
|---|---|
| Tamaño | Tamaño del laberinto (4–20 celdas) |
| Hormigas | Número de agentes por iteración |
| α | Peso de la feromona |
| β | Peso de la heurística |
| ρ | Tasa de evaporación |
| Modo | Ruta más corta / más larga |
| ▶ / ⏸ / 🔄 / 🗺 | Iniciar, pausar, reiniciar, nuevo laberinto |

### Indicadores en pantalla
- Iteración actual y estado
- Longitud de la mejor ruta
- Celdas únicas visitadas
- Fitness
- Longitud de referencia por BFS (ruta más corta exacta)
- Gráfico de convergencia

## 🐍 Cómo ejecutar la versión Python

```bash
pip install numpy matplotlib
python aco_simulation.py