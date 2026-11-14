// From monthly series (data/processed/series.json) to yearly values and trend results.
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the team.
import { trendTest, benjaminiHochberg, MIN_YEARS } from './stats.js';

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
