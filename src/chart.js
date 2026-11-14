// Yearly chart with Sen trend line and 95% slope fan, plus the year-by-year replay.
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the team.
const W = 720, H = 260, L = 50, R = 22, T = 12, B = 28;

function niceStep(span) {
  const raw = span / 5, mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw);
}

// rows: [{year, value, complete}], test: result of trendTest. cls: 'up' | 'down' | 'unsure'.
export function chartSvg(rows, test, { cls, unit, dp, label }) {
  const pts = rows.filter(r => r.complete);
  const ys = pts.map(r => r.value);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = (hi - lo) * 0.15 || 0.5; lo -= pad; hi += pad;
  const x0 = rows[0].year, x1 = rows[rows.length - 1].year;
  const X = y => L + ((y - x0) / Math.max(1, x1 - x0)) * (W - L - R);
  const Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const step = niceStep(hi - lo), tdp = Math.max(0, -Math.floor(Math.log10(step)));
  let s = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    s += `<line class="gl" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ax" x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${v.toFixed(tdp)}</text>`;
  }
  for (let y = Math.ceil(x0 / 5) * 5; y <= x1; y += 5) s += `<text class="ax" x="${X(y).toFixed(1)}" y="${H - 8}" text-anchor="middle">${y}</text>`;
  // The connecting line breaks where a year is missing, so gaps stay visible.
  const segs = [];
  let cur = [];
  rows.forEach(r => {
    if (r.complete) cur.push(`${X(r.year).toFixed(1)},${Y(r.value).toFixed(1)}`);
    else if (cur.length) { segs.push(cur); cur = []; }
  });
  if (cur.length) segs.push(cur);
  segs.forEach(seg => { s += `<polyline class="ln" data-pts="${seg.join(' ')}" points=""/>`; });
  if (test) {
    const xm = (x0 + x1) / 2, ym = test.intercept + test.slope * xm;
    if (test.ciLow !== null) {
      const f = [[x0, test.ciLow], [x1, test.ciLow], [x1, test.ciHigh], [x0, test.ciHigh]];
      s += `<polygon class="band" points="${f.map(([y, b]) => `${X(y).toFixed(1)},${Y(ym + b * (y - xm)).toFixed(1)}`).join(' ')}"/>`;
    }
    s += `<line class="tr" x1="${X(x0).toFixed(1)}" y1="${Y(ym + test.slope * (x0 - xm)).toFixed(1)}" x2="${X(x1).toFixed(1)}" y2="${Y(ym + test.slope * (x1 - xm)).toFixed(1)}"/>`;
  }
  s += pts.map(r => `<circle class="pt" data-year="${r.year}" cx="${X(r.year).toFixed(1)}" cy="${Y(r.value).toFixed(1)}" r="4"><title>${r.year}: ${r.value.toFixed(dp)} ${unit}</title></circle>`).join('');
  s += `<text class="counter" x="${W - R - 4}" y="${T + 30}" text-anchor="end"></text>`;
  return `<svg class="chart ${cls}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${s}</svg>`;
}

// Draw points one year at a time, then reveal the trend. Calls done() at the end.
// Returns a cancel function.
export function replay(svg, { animate, onDone }) {
  const pts = [...svg.querySelectorAll('.pt')];
  const lines = [...svg.querySelectorAll('.ln')];
  const counter = svg.querySelector('.counter');
  let timer = null;
  const finish = () => {
    pts.forEach(p => p.classList.add('show'));
    lines.forEach(l => l.setAttribute('points', l.dataset.pts));
    counter.textContent = '';
    svg.classList.add('done');
    onDone?.();
  };
  if (!animate) { finish(); return () => {}; }
  svg.classList.remove('done');
  pts.forEach(p => p.classList.remove('show'));
  lines.forEach(l => l.setAttribute('points', ''));
  let i = 0;
  const tick = () => {
    if (i >= pts.length) { timer = setTimeout(finish, 350); return; }
    const p = pts[i];
    p.classList.add('show');
    const x = Number(p.getAttribute('cx'));
    lines.forEach(l => l.setAttribute('points', l.dataset.pts.split(' ').filter(q => Number(q.split(',')[0]) <= x + 0.01).join(' ')));
    counter.textContent = p.dataset.year;
    i += 1;
    timer = setTimeout(tick, 70);
  };
  tick();
  return () => clearTimeout(timer);
}
