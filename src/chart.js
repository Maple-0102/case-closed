// Yearly chart with the Sen trend line and a fan of trend lines whose slopes are in the
// 95% range, plus the year-by-year replay.
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.
const W = 720, H = 260, L = 50, R = 22, T = 12, B = 28;

function niceStep(span) {
  const raw = span / 5, mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw);
}

// rows: [{year, value, complete}], test: result of trendTest. cls: 'up' | 'down' | 'unsure'.
// Options: still = draw everything at once (no replay);
// win = { start, test } highlights the years from start on and draws that window's trend.
export function chartSvg(rows, test, { cls, unit, dp, label, still = false, win = null }) {
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
  if (win) s += `<rect class="dim" x="${L}" y="${T}" width="${Math.max(0, X(win.start - 0.5) - L).toFixed(1)}" height="${H - T - B}"/>`;
  segs.forEach(seg => { s += `<polyline class="ln" data-pts="${seg.join(' ')}" points="${still ? seg.join(' ') : ''}"/>`; });
  if (test) {
    const xm = (x0 + x1) / 2, ym = test.intercept + test.slope * xm;
    // Fan = every trend line whose slope is inside the 95% range, pivoting at the middle year.
    // It shows how steep the trend could be, not a range for each year's value.
    if (test.ciLow !== null) {
      const f = [[x0, test.ciLow], [xm, test.slope], [x1, test.ciLow], [x1, test.ciHigh], [xm, test.slope], [x0, test.ciHigh]];
      s += `<polygon class="band${win ? ' faded' : ''}" points="${f.map(([y, b]) => `${X(y).toFixed(1)},${Y(ym + b * (y - xm)).toFixed(1)}`).join(' ')}"/>`;
    }
    s += `<line class="tr${win ? ' faded' : ''}" x1="${X(x0).toFixed(1)}" y1="${Y(ym + test.slope * (x0 - xm)).toFixed(1)}" x2="${X(x1).toFixed(1)}" y2="${Y(ym + test.slope * (x1 - xm)).toFixed(1)}"/>`;
  }
  if (win?.test) {
    const w = win.test, a = win.start, xm = (a + x1) / 2, ym = w.intercept + w.slope * xm;
    const wc = w.p < 0.05 ? (w.slope > 0 ? 'up' : 'down') : 'unsure';
    s += `<line class="tr-win ${wc}" x1="${X(a).toFixed(1)}" y1="${Y(ym + w.slope * (a - xm)).toFixed(1)}" x2="${X(x1).toFixed(1)}" y2="${Y(ym + w.slope * (x1 - xm)).toFixed(1)}"/>`;
  }
  s += pts.map(r => `<circle class="pt${still ? ' show' : ''}${win && r.year < win.start ? ' out' : ''}" data-year="${r.year}" cx="${X(r.year).toFixed(1)}" cy="${Y(r.value).toFixed(1)}" r="4"><title>${r.year}: ${r.value.toFixed(dp)} ${unit}</title></circle>`).join('');
  s += `<text class="counter" x="${W - R - 4}" y="${T + 30}" text-anchor="end"></text>`;
  return `<svg class="chart ${cls}${still ? ' done' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${s}</svg>`;
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

// Start-year check at a glance: one dot per start year = that window's slope per decade,
// with its 95% range. Filled = p < 0.05 for that window alone; hollow = not enough evidence.
export function startYearSvg(check, { dp, unit, current, label }) {
  const W2 = 720, H2 = 190, L2 = 58, R2 = 34, T2 = 14, B2 = 30;
  const ws = check.windows;
  const vals = ws.flatMap(w => [w.test.slope, w.test.ciLow ?? w.test.slope, w.test.ciHigh ?? w.test.slope, 0]).map(x => x * 10);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.1 || 0.5; lo -= pad; hi += pad;
  const a = ws[0].start, b = ws[ws.length - 1].start;
  const X = y => L2 + ((y - a) / Math.max(1, b - a)) * (W2 - L2 - R2);
  const Y = v => T2 + (1 - (v - lo) / (hi - lo)) * (H2 - T2 - B2);
  const step = niceStep(hi - lo), tdp = Math.max(0, -Math.floor(Math.log10(step)));
  let s = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    s += `<line class="gl" x1="${L2}" x2="${W2 - R2}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ax" x="${L2 - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${v.toFixed(tdp)}</text>`;
  }
  s += `<line class="zero" x1="${L2}" x2="${W2 - R2}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>`;
  for (let y = a; y <= b; y++) if (y % 5 === 0 ? (y - a >= 2 || y === a) && (b - y >= 2 || y === b) : y === a || y === b) s += `<text class="ax" x="${X(y).toFixed(1)}" y="${H2 - 10}" text-anchor="middle">${y}</text>`;
  if (current != null) s += `<rect class="cur" x="${(X(current) - 9).toFixed(1)}" y="${T2}" width="18" height="${H2 - T2 - B2}" rx="4"/>`;
  ws.forEach(w => {
    const k = w.significant ? (w.test.slope > 0 ? 'up' : 'down') : 'ns';
    const x = X(w.start).toFixed(1);
    if (w.test.ciLow !== null) s += `<line class="ci ${k}" x1="${x}" x2="${x}" y1="${Y(w.test.ciLow * 10).toFixed(1)}" y2="${Y(w.test.ciHigh * 10).toFixed(1)}"/>`;
    s += `<circle class="rb-dot ${k}${w.start === current ? ' on' : ''}" data-start="${w.start}" cx="${x}" cy="${Y(w.test.slope * 10).toFixed(1)}" r="${w.start === current ? 7 : 5}" tabindex="0" role="button"><title>${w.start}–${w.end}: ${(w.test.slope * 10).toFixed(dp + 1)} ${unit}/decade, p = ${w.test.p.toPrecision(2)}</title></circle>`;
  });
  return `<svg class="rb-chart" viewBox="0 0 ${W2} ${H2}" role="img" aria-label="${label}">${s}</svg>`;
}
