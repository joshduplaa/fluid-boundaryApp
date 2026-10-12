# Least Squares Fluid Boundary Approximation

Final assignment for my Numerical Analysis course (Fall 2024), written in MATLAB.

Given marker points that trace a fluid boundary through a set of mesh cells, the program fits four curves to the points in each cell with **linear least squares using the normal equations**. It compares the fits by their squared error and checks how numerically stable the normal-equations method is.

## Problem

`marker.xlsx` holds 104 boundary marker points, each with an `X` coordinate, a `Y` coordinate and the mesh cell (`elem`) it belongs to. There are 10 cells: 48, 49, 51, 52, 55, 56, 60, 61, 62 and 63. In each cell, the goal is to find a simple curve that approximates the piece of boundary passing through it.

## Method

Each model is written as an overdetermined system `A·x = b`, where each column of `A` is a basis function evaluated at the marker points. The system is solved with the normal equations:

```
x = (AᵀA)⁻¹ Aᵀb
```

| Model | Form | Columns of `A` |
|---|---|---|
| Line | `y = mx + q` | `1, x` |
| Parabola | `y = ax² + bx + c` | `1, x, x²` |
| Cubic | `y = ax³ + bx² + cx + d` | `1, x, x², x³` |
| Rotated parabola | `x = ay² + by + c` | `1, y, y²` (x and y swapped) |

The rotated parabola lets the fit follow boundary segments that are close to vertical, which a function of `x` can't represent well.

For each fit the program computes:

- **Least squares error:** the sum of squared residuals, `Σ (b − A·x)²`.
- **Condition numbers:** `cond(A)` and `cond(AᵀA)`, to judge stability. Since `cond(AᵀA) = cond(A)²`, forming `AᵀA` squares the conditioning of the problem. This is why the normal equations are numerically unstable when the points are close together, as they are here, and the code comments note it.

## Results

Squared error per cell (from `error_table.csv`, lowest in **bold**):

| Cell | Line | Parabola | Cubic | Rotated parabola |
|---:|---:|---:|---:|---:|
| 48 | 9.13e-09 | 1.84e-11 | 1.16e-10 | **9.32e-13** |
| 49 | 8.18e-03 | 1.12e-05 | **1.04e-05** | 1.26e-02 |
| 51 | 1.28e-04 | 7.13e-06 | 6.93e-06 | **1.92e-06** |
| 52 | 3.86e-05 | 3.84e-06 | 3.84e-06 | **1.20e-06** |
| 55 | 1.43e-02 | 9.71e-03 | 1.49e-02 | **3.47e-09** |
| 56 | 1.20e-04 | 5.04e-06 | 6.00e-07 | **5.22e-08** |
| 60 | 3.51e-05 | 2.75e-05 | 1.63e-05 | **7.62e-06** |
| 61 | 1.03e-05 | 7.76e-08 | **1.13e-09** | 1.19e-08 |
| 62 | 5.41e-05 | 3.12e-07 | **2.52e-08** | 4.07e-06 |
| 63 | 1.88e-03 | 9.10e-04 | **6.89e-04** | 1.68e-03 |

- The rotated parabola has the lowest error in 6 of the 10 cells, and the cubic in the other 4.
- A straight line is never the best fit.
- Cell 55 shows why rotation matters: every `y = f(x)` model leaves an error around 10⁻², while the rotated parabola gets it down to about 10⁻⁹.

The fitted equation for every model and cell is in `equation_table.csv`.

## Files

| File | Purpose |
|---|---|
| `Assignment9.m` | Main script: reads `marker.xlsx`, fits all four models for every cell, prints the results and writes the two CSV tables |
| `assignment9_Single_Cell.m` | The same analysis on one hard-coded cell (cell 48), used while developing the method |
| `linearApprox.m` | Line fit |
| `secondOrder.m` | Parabola fit |
| `higherOrder.m` | Cubic fit |
| `rotatedParabola.m` | Rotated parabola fit (called with x and y swapped) |
| `marker.xlsx` | Input marker points (`X`, `Y`, `elem`) |
| `equation_table.csv` | Output: fitted equation per cell and model |
| `error_table.csv` | Output: squared error per cell and model |

## Running it

1. Open the repository folder in MATLAB, so the function files are on the path.
2. Run `Assignment9`.

The script prints each cell's points and the two result tables, and overwrites `equation_table.csv` and `error_table.csv`.
