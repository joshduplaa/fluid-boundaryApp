# Fluid Boundary Approximator

An interactive web demo of my Numerical Analysis final project. 104 marker points trace a fluid boundary through 10 mesh cells. In each cell, four curves are fitted with **linear least squares using the normal equations**, and the lowest-error curve from each cell is stitched together to reconstruct the boundary.

**Live demo:** https://joshduplaa.github.io/fluid-boundaryApp/

## What the app shows

- **Reconstructed boundary:** all marker points on the 0.125 mesh, with the best-fitting curve in each cell. Click a cell to inspect it.
- **Cell view:** the cell's points with all four fitted curves, which can be toggled on and off. Hover a point to see its residual under each model.
- **Results:** for each model, the fitted equation, squared error, `cond(A)` and `cond(AᵀA)`. A warning marks fits whose `AᵀA` is too ill-conditioned for double precision.

All fitting runs in the browser. `js/lsq.js` is a JavaScript port of the original MATLAB functions in [`matlab/`](matlab/).

## The models

| Model | Form |
|---|---|
| Line | `y = mx + q` |
| Parabola | `y = ax² + bx + c` |
| Cubic | `y = ax³ + bx² + cx + d` |
| Rotated parabola | `x = ay² + by + c` |

Each is solved as `x = (AᵀA)⁻¹Aᵀb`, where the columns of `A` are the model's basis functions evaluated at the cell's points. The rotated parabola swaps x and y, so it can follow stretches of the boundary that are close to vertical. It has the lowest error in 6 of the 10 cells.

## A numerical stability finding

Forming `AᵀA` squares the condition number (`cond(AᵀA) = cond(A)²`). Within one small cell, the cubic's columns `1, x, x², x³` are nearly parallel, and `cond(AᵀA)` reaches about 2 × 10¹⁷. That is beyond what double precision can resolve (about 4.5 × 10¹⁵).

The effect shows up in the original MATLAB results. In cells 48 and 55, `inv(AᵀA)` produced a cubic error larger than the parabola's, which is impossible in exact arithmetic because every parabola is also a cubic:

| Cell | Parabola error | Cubic error (MATLAB `inv`) | Cubic error (stable QR) | Cubic error (this app) |
|---:|---:|---:|---:|---:|
| 48 | 1.84 × 10⁻¹¹ | 1.16 × 10⁻¹⁰ | 1.571 × 10⁻¹¹ | 1.571 × 10⁻¹¹ |
| 55 | 9.71 × 10⁻³ | 1.49 × 10⁻² | 7.572 × 10⁻³ | 7.575 × 10⁻³ |

The app still uses the normal equations, but solves them with Gaussian elimination and partial pivoting instead of an explicit inverse, and lands within 0.05% of a stable QR solve. The cubic's coefficients themselves remain unreliable in those cells, and the app flags them.

## Running locally

The page loads its data with `fetch`, so it needs to be served over HTTP rather than opened as a file:

```sh
npm start        # serves the folder at http://localhost:8000 (uses python3)
```

Any static file server works too. There are no dependencies and no build step.

## Tests

```sh
npm test
```

`tests/lsq.test.mjs` checks the JavaScript fits against `matlab/error_table.csv` for every cell and model. For the two ill-conditioned cubic fits above, it checks against the stable QR reference values instead.

## Project structure

| Path | Contents |
|---|---|
| `index.html`, `css/`, `js/app.js` | The web app and its SVG charts |
| `js/lsq.js` | Least squares fitting, condition numbers and equation formatting |
| `data/marker.csv` | Marker points (`x`, `y`, `cell`), converted from `matlab/marker.xlsx` |
| `tests/` | Tests against the MATLAB results |
| `matlab/` | The original MATLAB implementation and its output tables |

### Running the MATLAB version

Open the `matlab/` folder in MATLAB and run `Assignment9`. It reads `marker.xlsx`, prints the fits for each cell, and writes `equation_table.csv` and `error_table.csv`.
