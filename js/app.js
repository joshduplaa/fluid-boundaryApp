import { MODELS, fitCell, evaluate, formatEquation, parseMarkerCsv } from './lsq.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GRID = 0.125; // mesh spacing the marker cells sit on
const DOUBLE_LIMIT = 1 / Number.EPSILON; // ≈ 4.5e15
const SERIES = { line: 1, parabola: 2, cubic: 3, rotated: 4 };

const state = {
  points: [],
  cells: [], // [{ id, points, fits, best, col, row }]
  selected: null,
  visible: new Set(MODELS.map((m) => m.id)),
};

const tooltip = document.getElementById('tooltip');

// ---------- helpers ----------

function svg(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
}

const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

// 0.00971 stays plain; 9.32e-13 becomes "9.32 × 10⁻¹³".
function sci(value, digits = 2) {
  if (value === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp >= -2 && exp <= 3) return String(Number(value.toPrecision(digits + 1)));
  const mantissa = (value / 10 ** exp).toFixed(digits);
  return `${mantissa} × 10${String(exp).replace(/./g, (c) => SUPERSCRIPT[c])}`;
}

function niceTicks(lo, hi, count = 5) {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    ticks.push(Number(v.toPrecision(12)));
  }
  return { ticks, step };
}

function formatTick(v, step) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return v.toFixed(decimals);
}

// Equal-aspect scale: one unit of x is the same length on screen as one unit of y,
// so the boundary keeps its true shape. The shorter domain is widened to fill the box.
function equalScale(xDom, yDom, width, height, margin) {
  const pw = width - margin.left - margin.right;
  const ph = height - margin.top - margin.bottom;
  const k = Math.min(pw / (xDom[1] - xDom[0]), ph / (yDom[1] - yDom[0]));
  const xc = (xDom[0] + xDom[1]) / 2;
  const yc = (yDom[0] + yDom[1]) / 2;
  const x0 = xc - pw / k / 2;
  const y0 = yc - ph / k / 2;
  return {
    x: (v) => margin.left + (v - x0) * k,
    y: (v) => margin.top + ph - (v - y0) * k,
    xDom: [x0, x0 + pw / k],
    yDom: [y0, y0 + ph / k],
    plot: { left: margin.left, top: margin.top, width: pw, height: ph },
  };
}

// Independent x and y scales that fill the box. Used for the single-cell view,
// where a cell's points can span 0.005 in x but 0.1 in y.
function fillScale(xDom, yDom, width, height, margin) {
  const pw = width - margin.left - margin.right;
  const ph = height - margin.top - margin.bottom;
  return {
    x: (v) => margin.left + ((v - xDom[0]) / (xDom[1] - xDom[0])) * pw,
    y: (v) => margin.top + ph - ((v - yDom[0]) / (yDom[1] - yDom[0])) * ph,
    xDom,
    yDom,
    plot: { left: margin.left, top: margin.top, width: pw, height: ph },
  };
}

// Sample a fitted curve across the cell's own data range (no extrapolation).
function curvePoints(fit, points, samples = 120) {
  const t = points.map((p) => (fit.model.rotated ? p.y : p.x));
  const lo = Math.min(...t);
  const hi = Math.max(...t);
  return Array.from({ length: samples + 1 }, (_, i) => {
    const ti = lo + ((hi - lo) * i) / samples;
    const v = evaluate(fit.coef, ti);
    return fit.model.rotated ? [v, ti] : [ti, v];
  });
}

function pathData(pts, scale) {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${scale.x(x).toFixed(2)},${scale.y(y).toFixed(2)}`).join('');
}

function residual(fit, p) {
  return fit.model.rotated ? p.x - evaluate(fit.coef, p.y) : p.y - evaluate(fit.coef, p.x);
}

function showTooltip(target, html) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const r = target.getBoundingClientRect();
  const t = tooltip.getBoundingClientRect();
  let left = r.left + r.width / 2 + 12;
  if (left + t.width > window.innerWidth - 8) left = r.left - t.width - 12;
  const top = Math.min(Math.max(8, r.top + r.height / 2 - t.height / 2), window.innerHeight - t.height - 8);
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function bindTooltip(node, html) {
  node.addEventListener('pointerenter', () => showTooltip(node, html()));
  node.addEventListener('pointerleave', hideTooltip);
  node.addEventListener('focus', () => showTooltip(node, html()));
  node.addEventListener('blur', hideTooltip);
}

const fmt = (v) => v.toFixed(4);
const swatch = (id) => `<span class="key key-line" style="--key: var(--series-${SERIES[id]})"></span>`;

// ---------- overview: the whole boundary ----------

function drawOverview() {
  const wrap = document.getElementById('overview');
  wrap.replaceChildren();
  const xDom = [0, 3 * GRID];
  const yDom = [0, 4 * GRID];
  const margin = { top: 8, right: 8, bottom: 36, left: 44 };
  const width = wrap.clientWidth || 360;
  const height = margin.top + margin.bottom + ((width - margin.left - margin.right) * (yDom[1] - yDom[0])) / (xDom[1] - xDom[0]);
  const s = equalScale(xDom, yDom, width, height, margin);
  const root = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': 'All 104 marker points with the best-fitting curve in each cell, tracing the fluid boundary.',
  }, wrap);

  // Mesh gridlines double as axis ticks.
  for (let v = 0; v <= xDom[1] + 1e-9; v += GRID) {
    svg('line', { class: 'grid-line', x1: s.x(v), x2: s.x(v), y1: s.y(yDom[0]), y2: s.y(yDom[1]) }, root);
    svg('text', { class: 'tick', x: s.x(v), y: s.y(yDom[0]) + 16, 'text-anchor': 'middle' }, root).textContent = String(v);
  }
  for (let v = 0; v <= yDom[1] + 1e-9; v += GRID) {
    svg('line', { class: 'grid-line', x1: s.x(xDom[0]), x2: s.x(xDom[1]), y1: s.y(v), y2: s.y(v) }, root);
    svg('text', { class: 'tick', x: s.x(xDom[0]) - 6, y: s.y(v) + 4, 'text-anchor': 'end' }, root).textContent = String(v);
  }
  svg('text', { class: 'axis-title', x: s.x(xDom[1]), y: height - 4, 'text-anchor': 'end' }, root).textContent = 'x';

  for (const cell of state.cells) {
    const selected = cell === state.selected;
    const x0 = cell.col * GRID;
    const y0 = cell.row * GRID;
    const square = svg('rect', {
      class: `cell-square${selected ? ' selected' : ''}`,
      x: s.x(x0), y: s.y(y0 + GRID), width: s.x(x0 + GRID) - s.x(x0), height: s.y(y0) - s.y(y0 + GRID),
    }, root);
    svg('title', {}, square).textContent = `Cell ${cell.id}`;
    square.addEventListener('click', () => select(cell));
    // Put the label in whichever corner of the square is farthest from the points.
    const corners = [
      { x: x0, y: y0 + GRID, dx: 5, dy: 14, anchor: 'start' },
      { x: x0 + GRID, y: y0 + GRID, dx: -5, dy: 14, anchor: 'end' },
      { x: x0, y: y0, dx: 5, dy: -6, anchor: 'start' },
      { x: x0 + GRID, y: y0, dx: -5, dy: -6, anchor: 'end' },
    ];
    const clearance = (c) => Math.min(...state.points.map((p) => Math.hypot(p.x - c.x, p.y - c.y)));
    const corner = corners.reduce((a, b) => (clearance(b) > clearance(a) ? b : a));
    svg('text', {
      class: `cell-label${selected ? ' selected' : ''}`,
      x: s.x(corner.x) + corner.dx, y: s.y(corner.y) + corner.dy, 'text-anchor': corner.anchor,
    }, root).textContent = cell.id;
  }

  for (const cell of state.cells) {
    svg('path', { class: 'curve', stroke: 'var(--series-1)', d: pathData(curvePoints(cell.best, cell.points), s) }, root);
  }

  for (const cell of state.cells) {
    const selected = cell === state.selected;
    for (const p of cell.points) {
      svg('circle', { class: `point ${selected ? 'active' : 'muted'}`, cx: s.x(p.x), cy: s.y(p.y), r: 4 }, root);
      const hit = svg('circle', { class: 'hit', cx: s.x(p.x), cy: s.y(p.y), r: 9 }, root);
      hit.addEventListener('click', () => select(cell));
      bindTooltip(hit, () => `<div class="tt-title">Cell ${cell.id}</div>
        <div class="tt-row">x<span>${fmt(p.x)}</span></div>
        <div class="tt-row">y<span>${fmt(p.y)}</span></div>
        <div class="tt-row">Best fit<span>${cell.best.model.name}</span></div>`);
    }
  }
}

// ---------- detail: one cell, all four models ----------

function drawDetail() {
  const cell = state.selected;
  const wrap = document.getElementById('detail');
  wrap.replaceChildren();

  const xs = cell.points.map((p) => p.x);
  const ys = cell.points.map((p) => p.y);
  const pad = (lo, hi) => {
    const span = Math.max(hi - lo, 1e-6);
    return [lo - span * 0.12, hi + span * 0.12];
  };
  const width = wrap.clientWidth || 640;
  const height = Math.round(Math.min(400, Math.max(260, width * 0.6)));
  const margin = { top: 12, right: 12, bottom: 40, left: 52 };
  const s = fillScale(pad(Math.min(...xs), Math.max(...xs)), pad(Math.min(...ys), Math.max(...ys)), width, height, margin);

  const root = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': `Cell ${cell.id}: ${cell.points.length} marker points with the fitted curves. Values are in the table below.`,
  }, wrap);

  const clipId = `clip-${cell.id}`;
  const clip = svg('clipPath', { id: clipId }, svg('defs', {}, root));
  svg('rect', { x: s.plot.left, y: s.plot.top, width: s.plot.width, height: s.plot.height }, clip);

  const xt = niceTicks(...s.xDom, width < 480 ? 4 : 6);
  const yt = niceTicks(...s.yDom, 5);
  for (const v of xt.ticks) {
    svg('line', { class: 'grid-line', x1: s.x(v), x2: s.x(v), y1: s.plot.top, y2: s.plot.top + s.plot.height }, root);
    svg('text', { class: 'tick', x: s.x(v), y: s.plot.top + s.plot.height + 16, 'text-anchor': 'middle' }, root).textContent = formatTick(v, xt.step);
  }
  for (const v of yt.ticks) {
    svg('line', { class: 'grid-line', x1: s.plot.left, x2: s.plot.left + s.plot.width, y1: s.y(v), y2: s.y(v) }, root);
    svg('text', { class: 'tick', x: s.plot.left - 6, y: s.y(v) + 4, 'text-anchor': 'end' }, root).textContent = formatTick(v, yt.step);
  }
  svg('line', {
    class: 'axis-line', x1: s.plot.left, x2: s.plot.left + s.plot.width,
    y1: s.plot.top + s.plot.height, y2: s.plot.top + s.plot.height,
  }, root);
  svg('text', { class: 'axis-title', x: s.plot.left + s.plot.width, y: height - 4, 'text-anchor': 'end' }, root).textContent = 'x';
  svg('text', { class: 'axis-title', x: 4, y: s.plot.top + 10 }, root).textContent = 'y';

  const curves = svg('g', { 'clip-path': `url(#${clipId})` }, root);
  for (const fit of cell.fits) {
    if (!state.visible.has(fit.model.id)) continue;
    svg('path', {
      class: 'curve',
      stroke: `var(--series-${SERIES[fit.model.id]})`,
      d: pathData(curvePoints(fit, cell.points), s),
    }, curves);
  }

  const visibleFits = cell.fits.filter((f) => state.visible.has(f.model.id));
  for (const p of cell.points) {
    svg('circle', { class: 'point active', cx: s.x(p.x), cy: s.y(p.y), r: 4 }, root);
    const hit = svg('circle', { class: 'hit', cx: s.x(p.x), cy: s.y(p.y), r: 10, tabindex: 0 }, root);
    bindTooltip(hit, () => `<div class="tt-title">x ${fmt(p.x)}, y ${fmt(p.y)}</div>
      ${visibleFits.length ? '<div class="tt-row" style="margin-top:4px">Residual</div>' : ''}
      ${visibleFits.map((f) => `<div class="tt-row">${swatch(f.model.id)}${f.model.name}<span>${sci(residual(f, p))}</span></div>`).join('')}`);
  }
}

function drawToggles() {
  const list = document.getElementById('model-toggles');
  list.replaceChildren(...MODELS.map((model) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state.visible.has(model.id)));
    button.innerHTML = `${swatch(model.id)}${model.name}`;
    button.addEventListener('click', () => {
      if (state.visible.has(model.id)) state.visible.delete(model.id);
      else state.visible.add(model.id);
      drawToggles();
      drawDetail();
    });
    li.appendChild(button);
    return li;
  }));
}

function drawTable() {
  const cell = state.selected;
  let anyUnstable = false;
  document.getElementById('results-body').replaceChildren(...cell.fits.map((fit) => {
    const unstable = fit.condAtA > DOUBLE_LIMIT;
    anyUnstable ||= unstable;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <th scope="row"><span class="model-cell">${swatch(fit.model.id)}${fit.model.name}
        ${fit === cell.best ? '<span class="badge">Lowest error</span>' : ''}</span></th>
      <td class="eq" data-label="Equation">${formatEquation(fit.model, fit.coef)}</td>
      <td class="num" data-label="Squared error">${sci(fit.sse)}</td>
      <td class="num" data-label="cond(A)">${sci(fit.condA)}</td>
      <td class="num${unstable ? ' warn' : ''}" data-label="cond(AᵀA)">${unstable ? '⚠ ' : ''}${sci(fit.condAtA)}</td>`;
    return tr;
  }));
  document.getElementById('precision-note').hidden = !anyUnstable;
}

function drawChips() {
  const chips = document.getElementById('cell-chips');
  chips.replaceChildren(...state.cells.map((cell) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = cell.id;
    b.setAttribute('aria-pressed', String(cell === state.selected));
    b.setAttribute('aria-label', `Cell ${cell.id}`);
    b.addEventListener('click', () => select(cell));
    return b;
  }));
}

function select(cell) {
  state.selected = cell;
  history.replaceState(null, '', `#cell-${cell.id}`);
  document.getElementById('detail-title').textContent = `Cell ${cell.id}`;
  document.getElementById('detail-summary').textContent =
    `${cell.points.length} points · lowest error: ${cell.best.model.name} (${sci(cell.best.sse)})`;
  hideTooltip();
  drawChips();
  drawOverview();
  drawDetail();
  drawTable();
}

async function main() {
  const res = await fetch('data/marker.csv');
  state.points = parseMarkerCsv(await res.text());
  const ids = [...new Set(state.points.map((p) => p.cell))].sort((a, b) => a - b);
  state.cells = ids.map((id) => {
    const points = state.points.filter((p) => p.cell === id);
    const fits = fitCell(points);
    const mean = (k) => points.reduce((s, p) => s + p[k], 0) / points.length;
    return {
      id,
      points,
      fits,
      best: fits.reduce((a, b) => (b.sse < a.sse ? b : a)),
      col: Math.floor(mean('x') / GRID),
      row: Math.floor(mean('y') / GRID),
    };
  });
  const fromHash = Number(location.hash.replace('#cell-', ''));
  drawToggles();
  select(state.cells.find((c) => c.id === fromHash) ?? state.cells[0]);
  window.addEventListener('scroll', hideTooltip, { passive: true });
  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { drawOverview(); drawDetail(); }, 100);
  });
}

main().catch((err) => {
  document.querySelector('main').insertAdjacentHTML('afterbegin',
    `<p class="card">Could not load the marker data (${err.message}). Serve this folder over HTTP, for example with <code>npm start</code>.</p>`);
});
