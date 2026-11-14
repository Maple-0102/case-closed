// Trend statistics for yearly series: Mann-Kendall test, Sen's slope with confidence
// interval, lag-1 autocorrelation correction (Yue & Wang 2004), Benjamini-Hochberg.
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the team.
//
// Input everywhere: an array of { year, value } with numeric values, sorted or not.
// Years may have gaps; slopes always use the real year difference.

export const ALPHA = 0.05;
export const MIN_YEARS = 10;

// ---------- normal distribution ----------
// Complementary error function, Numerical Recipes "erfcc" (fractional error < 1.2e-7).
function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const normalCdf = x => 0.5 * erfc(-x / Math.SQRT2);

// Inverse normal CDF, Acklam's rational approximation (relative error < 1.2e-9).
export function normalQuantile(p) {
  if (!(p > 0 && p < 1)) throw new RangeError('p must be in (0, 1)');
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -normalQuantile(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// ---------- building blocks ----------
const clean = rows => rows.filter(r => Number.isFinite(r?.value) && Number.isFinite(r?.year)).sort((a, b) => a.year - b.year);
const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Mann-Kendall S statistic: sum of signs of all later-minus-earlier differences.
export function kendallS(values) {
  let s = 0;
  for (let i = 0; i < values.length - 1; i++) for (let j = i + 1; j < values.length; j++) s += Math.sign(values[j] - values[i]);
  return s;
}

// Variance of S under "no trend", with the standard correction for tied values.
export function kendallVariance(values) {
  const n = values.length;
  const counts = new Map();
  values.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1));
  let ties = 0;
  counts.forEach(t => { if (t > 1) ties += t * (t - 1) * (2 * t + 5); });
  return (n * (n - 1) * (2 * n + 5) - ties) / 18;
}

// All pairwise slopes (value change per year), sorted ascending.
export function pairwiseSlopes(points) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) for (let j = i + 1; j < points.length; j++) {
    const dy = points[j].year - points[i].year;
    if (dy !== 0) out.push((points[j].value - points[i].value) / dy);
  }
  return out.sort((a, b) => a - b);
}

// Lag-1 autocorrelation using only pairs of consecutive calendar years.
export function lag1(points, scale = 1) {
  const mean = points.reduce((t, p) => t + p.value, 0) / points.length;
  let num = 0, den = 0;
  points.forEach(p => { den += (p.value - mean) ** 2; });
  // Residuals that are only floating-point noise (e.g. a perfectly straight line) carry no
  // information about year-to-year persistence.
  if (den <= 1e-20 * points.length * Math.max(scale, 1e-300)) return 0;
  for (let i = 1; i < points.length; i++) if (points[i].year - points[i - 1].year === 1) num += (points[i].value - mean) * (points[i - 1].value - mean);
  return den > 0 ? num / den : 0;
}

// Variance inflation for AR(1) dependence with coefficient rho (Yue & Wang 2004):
// n/n* = 1 + 2 * sum_{k=1}^{n-1} (1 - k/n) rho^k
export function ar1Inflation(n, rho) {
  let s = 0;
  for (let k = 1; k < n; k++) s += (1 - k / n) * rho ** k;
  return 1 + 2 * s;
}

// Value at a fractional 1-based rank in a sorted array (linear interpolation).
function atRank(sorted, rank) {
  const r = Math.min(Math.max(rank, 1), sorted.length);
  const lo = Math.floor(r), hi = Math.ceil(r);
  return sorted[lo - 1] + (sorted[hi - 1] - sorted[lo - 1]) * (r - lo);
}

// ---------- the full test ----------
// Returns null when there are fewer than MIN_YEARS usable years.
export function trendTest(rows, { alpha = ALPHA, correct = true } = {}) {
  const pts = clean(rows);
  const n = pts.length;
  if (n < MIN_YEARS) return null;
  const values = pts.map(p => p.value);
  const s = kendallS(values);
  const varRaw = kendallVariance(values);
  const slopes = pairwiseSlopes(pts);
  const slope = median(slopes);
  const intercept = median(pts.map(p => p.value - slope * p.year));

  // Autocorrelation is measured on the series with Sen's trend removed, then bias-adjusted
  // for small samples ((n*r1 + 1)/(n - 4)) and clamped to [0, 0.95]. Negative dependence is
  // not allowed to shrink the variance, which keeps the test on the cautious side.
  const meanV = values.reduce((t, v) => t + v, 0) / n;
  const scale = values.reduce((t, v) => t + (v - meanV) ** 2, 0) / n + meanV * meanV;
  const r1 = lag1(pts.map(p => ({ year: p.year, value: p.value - slope * p.year })), scale);
  const r1Adj = (n * r1 + 1) / (n - 4);
  const rho = correct ? Math.min(Math.max(r1Adj, 0), 0.95) : 0;
  const inflation = Math.max(1, ar1Inflation(n, rho));
  const variance = varRaw * inflation;

  const zOf = v => (s > 0 ? (s - 1) / Math.sqrt(v) : s < 0 ? (s + 1) / Math.sqrt(v) : 0);
  const z = zOf(variance);
  const p = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
  const pRaw = Math.min(1, 2 * (1 - normalCdf(Math.abs(zOf(varRaw)))));

  // Sen (1968) confidence interval for the slope, using the same (corrected) variance.
  const cAlpha = normalQuantile(1 - alpha / 2) * Math.sqrt(variance);
  const N = slopes.length;
  const lowRank = (N - cAlpha) / 2, highRank = (N + cAlpha) / 2 + 1;
  const ciOk = lowRank >= 1 && highRank <= N;

  return {
    n, firstYear: pts[0].year, lastYear: pts[n - 1].year, alpha,
    s, variance, varianceRaw: varRaw, inflation, r1, r1Adjusted: r1Adj, rho,
    z, p, pUncorrected: pRaw,
    slope, intercept,                       // per year
    ciLow: ciOk ? atRank(slopes, lowRank) : null,
    ciHigh: ciOk ? atRank(slopes, highRank) : null,
    significant: p < alpha,
    direction: s > 0 ? 'up' : s < 0 ? 'down' : 'flat',
  };
}

// Benjamini-Hochberg adjusted p-values (q-values), in the input order.
export function benjaminiHochberg(ps) {
  const m = ps.length;
  const order = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const q = new Array(m);
  let running = 1;
  for (let k = m - 1; k >= 0; k--) {
    running = Math.min(running, order[k].p * m / (k + 1));
    q[order[k].i] = Math.min(1, running);
  }
  return q;
}
