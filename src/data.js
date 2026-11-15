// From monthly series (data/processed/series.json) to yearly values and trend results.
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.
import { trendTest, benjaminiHochberg, MIN_YEARS } from './stats.js?v=20261116l';

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12
const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// Monthly entry { start: 'YYYY-MM', values: [...] } -> [{ year, month, value }]
export function monthly(entry) {
  const y0 = Number(entry.start.slice(0, 4)), m0 = Number(entry.start.slice(5, 7));
  return entry.values.map((value, i) => {
    const k = m0 - 1 + i;
    return { year: y0 + Math.floor(k / 12), month: (k % 12) + 1, value };
  });
}

// Calendar months seen in at least 5 of every 6 years ("months the satellite can see").
export function observableMonths(months) {
  const years = new Set(months.map(r => r.year));
  const count = Array(12).fill(0);
  months.forEach(r => { if (r.value !== null) count[r.month - 1] += 1; });
  const need = Math.ceil(years.size * 5 / 6);
  return count.map((c, i) => (c >= need ? i + 1 : null)).filter(Boolean);
}

// Day-weighted mean over the given calendar months, only for years where all are present.
function aggregate(months, use) {
  const byYear = new Map();
  months.forEach(r => {
    if (!use.includes(r.month)) return;
    if (!byYear.has(r.year)) byYear.set(r.year, []);
    byYear.get(r.year).push(r);
  });
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, rs]) => {
    const ok = rs.filter(r => r.value !== null);
    if (ok.length !== use.length) return { year, value: null, complete: false };
    const days = ok.reduce((t, r) => t + daysIn(year, r.month), 0);
    return { year, value: ok.reduce((t, r) => t + r.value * daysIn(year, r.month), 0) / days, complete: true };
  });
}

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Yearly values for one site and variable.
// meta.annual: 'mean' | 'total' (mean daily rate x days in year); meta.scale multiplies values.
// meta.seasonal: allow falling back to observable months when complete years are too few.
export function yearly(entry, meta) {
  const months = monthly(entry);
  let season = null;
  let rows = aggregate(months, ALL);
  if (meta.seasonal && rows.filter(r => r.complete).length < MIN_YEARS) {
    const use = observableMonths(months);
    if (use.length && use.length < 12) { season = use; rows = aggregate(months, use); }
  }
  rows.forEach(r => {
    if (r.value === null) return;
    if (meta.annual === 'total' && !season) r.value *= isLeap(r.year) ? 366 : 365;
    r.value *= meta.scale ?? 1;
  });
  return { rows, season };
}

// Trend results for one variable at every site that has it, with one BH correction.
export function compare(series, variableId, meta, siteIds, alpha = 0.05) {
  const results = {};
  siteIds.forEach(id => {
    const entry = series[id]?.[variableId];
    if (!entry || (meta.notFor ?? []).includes(id)) return;
    const { rows, season } = yearly(entry, meta);
    results[id] = { rows, season, test: trendTest(rows.filter(r => r.complete)) };
  });
  const tested = Object.values(results).filter(r => r.test);
  const q = benjaminiHochberg(tested.map(r => r.test.p));
  tested.forEach((r, i) => {
    r.q = q[i];
    r.verdict = q[i] < alpha ? (r.test.s > 0 ? 'up' : 'down') : 'unsure';
  });
  Object.values(results).forEach(r => { if (!r.test) r.verdict = 'na'; });
  return results;
}

// ---------- start-year check ("Don't get fooled") ----------
// Does the answer depend on which year we start counting from? The end year stays fixed
// at the last complete year; the start moves forward one year at a time. This is an
// exploratory sensitivity check, not a new test: windows overlap heavily, p-values are
// per window (no correction across windows), and it never changes the main verdict.
// The yearly rows are passed in already built, so every window uses the same months.
export const WINDOW_MIN_YEARS = 15;   // each window: >= 15 calendar years AND >= 15 complete years
export const CHECK_MIN_RECORD = 20;   // design threshold for running the check at all

export function startYearCheck(rows, { minYears = WINDOW_MIN_YEARS, minRecord = CHECK_MIN_RECORD, alpha = 0.05 } = {}) {
  const ok = rows.filter(r => r.complete);
  if (ok.length < minRecord) return { skipped: 'short', n: ok.length, minRecord };
  const end = ok[ok.length - 1].year;
  const windows = [], excluded = [];
  for (let start = ok[0].year; end - start + 1 >= minYears; start++) {
    const startRow = rows.find(r => r.year === start);
    // A missing start year is excluded, never quietly replaced by the next complete year.
    if (!startRow?.complete) { excluded.push({ start, reason: 'missing-start' }); continue; }
    const use = ok.filter(r => r.year >= start);
    if (use.length < minYears) { excluded.push({ start, reason: 'too-few-years', n: use.length }); continue; }
    const test = trendTest(use, { alpha });
    if (!test) { excluded.push({ start, reason: 'too-few-years', n: use.length }); continue; }
    windows.push({ start, end, n: use.length, test, significant: test.p < alpha });
  }
  if (!windows.length) return { skipped: 'no-windows', n: ok.length, excluded };
  return { windows, excluded, end, ...summarize(windows) };
}

// Summary of a set of windows, using each window's `significant` flag.
function summarize(windows) {
  const full = windows[0];
  const slopes = windows.map(w => w.test.slope);
  const nSig = windows.filter(w => w.significant).length;
  const hasUp = slopes.some(s => s > 0), hasDown = slopes.some(s => s < 0);
  // Checked in this order, so noisy series that are never significant are not called "flipping".
  let kind;
  if (nSig === 0) kind = 'none-significant';
  else if (hasUp && hasDown) kind = 'direction-changes';
  else if (nSig === windows.length && windows.every(w => w.test.direction === windows[0].test.direction)) kind = 'robust';
  else kind = 'same-direction-partial';
  // Fixed rule for the report: the start whose slope differs most from the full-period slope.
  const farthest = windows.reduce((a, w) => (Math.abs(w.test.slope - full.test.slope) > Math.abs(a.test.slope - full.test.slope) ? w : a), full);
  return {
    kind, full, farthest, count: windows.length, nSig,
    slopeMin: Math.min(...slopes), slopeMax: Math.max(...slopes),
    direction: hasUp && !hasDown ? 'up' : hasDown && !hasUp ? 'down' : 'mixed',
  };
}

// Apply the same rule as the official answer to every window: for each start year, the
// windows of all places that have it get one Benjamini-Hochberg correction together.
// The full-record window takes the official q-value, so it always matches the main answer.
// checks: { site: startYearCheck result }, officialQ: { site: q }.
export function correctAcrossSites(checks, officialQ, alpha = 0.05) {
  const byStart = new Map();
  Object.entries(checks).forEach(([site, c]) => {
    if (c.skipped) return;
    c.windows.forEach((w, i) => {
      if (i === 0) { w.q = officialQ[site]; return; }
      if (!byStart.has(w.start)) byStart.set(w.start, []);
      byStart.get(w.start).push(w);
    });
  });
  byStart.forEach(ws => { benjaminiHochberg(ws.map(w => w.test.p)).forEach((q, i) => { ws[i].q = q; }); });
  Object.values(checks).forEach(c => {
    if (c.skipped) return;
    c.windows.forEach(w => { w.significant = w.q < alpha; });
    Object.assign(c, summarize(c.windows), { corrected: true });
  });
  return checks;
}

// Why a result is "not proven" (q >= alpha), so the page never blames year-to-year swings by default.
// 'range-includes-zero': the 95% slope range still includes no change;
// 'multiple-testing': the test alone passes (p < alpha) but not after the correction across places;
// 'test': the range excludes zero, but the (autocorrelation-corrected) test does not pass.
export function unsureReason(test, q, alpha = 0.05) {
  if (!test || q < alpha) return null;
  if (test.ciLow === null || (test.ciLow <= 0 && test.ciHigh >= 0)) return 'range-includes-zero';
  return test.p < alpha ? 'multiple-testing' : 'test';
}
