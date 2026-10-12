// Least squares polynomial fitting with the normal equations.
// A JavaScript port of the MATLAB functions in ../matlab/.

// The four models from Assignment9.m. A rotated model fits x as a function
// of y (MATLAB calls rotatedParabola(b, A) with the columns swapped).
export const MODELS = [
  { id: 'line', name: 'Line', degree: 1, rotated: false },
  { id: 'parabola', name: 'Parabola', degree: 2, rotated: false },
  { id: 'cubic', name: 'Cubic', degree: 3, rotated: false },
  { id: 'rotated', name: 'Rotated parabola', degree: 2, rotated: true },
];

// Build the design matrix [1, t, t^2, ..., t^degree]. Powers use repeated
// multiplication rather than ** so every JavaScript engine rounds them the
// same way; the cubic system is so ill-conditioned that a last-bit
// difference visibly changes its coefficients.
function designMatrix(t, degree) {
  return t.map((v) => {
    const row = [1];
    for (let p = 1; p <= degree; p++) row.push(row[p - 1] * v);
    return row;
  });
}

function transposeTimes(A, B) {
  const rows = A[0].length;
  const cols = B[0].length;
  const out = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let k = 0; k < A.length; k++) {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) out[i][j] += A[k][i] * B[k][j];
    }
  }
  return out;
}

// Solve M x = v with Gaussian elimination and partial pivoting.
function solve(M, v) {
  const n = M.length;
  const a = M.map((row, i) => [...row, v[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / a[col][col];
      for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = a[r][n];
    for (let c = r + 1; c < n; c++) s -= a[r][c] * x[c];
    x[r] = s / a[r][r];
  }
  return x;
}

// 2-norm condition number (largest / smallest singular value), the same
// quantity as MATLAB's cond(). Singular values come from a one-sided Jacobi SVD.
export function cond(A) {
  const m = A.length;
  const n = A[0].length;
  const U = A.map((row) => [...row]);
  for (let sweep = 0; sweep < 60; sweep++) {
    let rotated = false;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        let alpha = 0, beta = 0, gamma = 0;
        for (let i = 0; i < m; i++) {
          alpha += U[i][p] ** 2;
          beta += U[i][q] ** 2;
          gamma += U[i][p] * U[i][q];
        }
        if (Math.abs(gamma) <= 1e-15 * Math.sqrt(alpha * beta)) continue;
        rotated = true;
        const zeta = (beta - alpha) / (2 * gamma);
        const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = c * t;
        for (let i = 0; i < m; i++) {
          const up = U[i][p];
          U[i][p] = c * up - s * U[i][q];
          U[i][q] = s * up + c * U[i][q];
        }
      }
    }
    if (!rotated) break;
  }
  const sigma = Array.from({ length: n }, (_, j) =>
    Math.sqrt(U.reduce((sum, row) => sum + row[j] ** 2, 0)));
  return Math.max(...sigma) / Math.min(...sigma);
}

// Fit b ≈ c0 + c1·t + ... + cd·t^d with x = (AᵀA)⁻¹ Aᵀb.
// Returns the coefficients (lowest power first), the sum of squared
// residuals, and the condition numbers of A and AᵀA.
export function polyfit(t, b, degree) {
  const A = designMatrix(t, degree);
  const AtA = transposeTimes(A, A);
  const Atb = transposeTimes(A, b.map((v) => [v])).map((row) => row[0]);
  const coef = solve(AtA, Atb);
  const sse = t.reduce((sum, v, i) => sum + (b[i] - evaluate(coef, v)) ** 2, 0);
  return { coef, sse, condA: cond(A), condAtA: cond(AtA) };
}

export function evaluate(coef, t) {
  return coef.reduceRight((acc, c) => acc * t + c, 0);
}

// Fit every model to one cell's points.
export function fitCell(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return MODELS.map((model) => ({
    model,
    ...(model.rotated ? polyfit(ys, xs, model.degree) : polyfit(xs, ys, model.degree)),
  }));
}

// Equation text in the same form and precision as the MATLAB output,
// e.g. "y = 23.4352x² − 9.8788x + 0.9778".
export function formatEquation(model, coef) {
  const [dep, ind] = model.rotated ? ['x', 'y'] : ['y', 'x'];
  const sup = ['', '', '²', '³'];
  const terms = [];
  for (let p = coef.length - 1; p >= 0; p--) {
    const mag = Math.abs(coef[p]).toFixed(4);
    const body = p === 0 ? mag : `${mag}${ind}${sup[p]}`;
    if (terms.length === 0) terms.push(coef[p] < 0 ? `−${body}` : body);
    else terms.push(coef[p] < 0 ? `− ${body}` : `+ ${body}`);
  }
  return `${dep} = ${terms.join(' ')}`;
}

export function parseMarkerCsv(text) {
  return text.trim().split(/\r?\n/).slice(1).map((line) => {
    const [x, y, cell] = line.split(',').map(Number);
    return { x, y, cell };
  });
}
