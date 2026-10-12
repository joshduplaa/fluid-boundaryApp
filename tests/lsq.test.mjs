// Checks the JavaScript fits against the results the MATLAB script produced.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitCell, parseMarkerCsv, cond } from '../js/lsq.js';

const root = new URL('../', import.meta.url);
const points = parseMarkerCsv(readFileSync(new URL('data/marker.csv', root), 'utf8'));
const matlabErrors = readFileSync(new URL('matlab/error_table.csv', root), 'utf8')
  .trim().split('\n').slice(1).map((line) => line.split(',').map(Number));

test('marker data has 104 points in 10 cells', () => {
  assert.equal(points.length, 104);
  assert.equal(new Set(points.map((p) => p.cell)).size, 10);
});

// In cells 48 and 55, cond(AᵀA) for the cubic is about 2e17, past what
// double precision can resolve, and MATLAB's inv()-based solve returned
// a cubic error larger than the parabola's (impossible in exact arithmetic).
// For those two fits, compare against a stable QR/SVD least squares solve
// (numpy.linalg.lstsq) instead.
const STABLE_REFERENCE = {
  48: { cubic: 1.5711732526725593e-11 },
  55: { cubic: 0.007571583185569695 },
};

for (const [cell, ...matlab] of matlabErrors) {
  test(`cell ${cell} squared errors match MATLAB`, () => {
    const fits = fitCell(points.filter((p) => p.cell === cell));
    fits.forEach((fit, i) => {
      const expected = STABLE_REFERENCE[cell]?.[fit.model.id] ?? matlab[i];
      const tolerance = Math.max(expected * 0.02, 1e-12);
      assert.ok(Math.abs(fit.sse - expected) <= tolerance,
        `${fit.model.name}: got ${fit.sse}, expected ${expected}`);
    });
  });
}

test('cond matches known values', () => {
  assert.ok(Math.abs(cond([[1, 0], [0, 1]]) - 1) < 1e-12);
  assert.ok(Math.abs(cond([[3, 0], [0, 0.5], [0, 0]]) - 6) < 1e-12);
  assert.ok(Math.abs(cond([[1, 2], [3, 4]]) - 14.933034373659268) < 1e-9);
});
