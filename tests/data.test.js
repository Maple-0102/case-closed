// Tests for src/data.js. Run: node --test
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.
import test from 'node:test';
import assert from 'node:assert/strict';
import { monthly, observableMonths, yearly, compare } from '../src/data.js';

const entry = (start, values) => ({ start, values });

test('monthly expands the calendar across year boundaries', () => {
  const m = monthly(entry('1999-11', [1, 2, 3]));
  assert.deepEqual(m.map(r => [r.year, r.month]), [[1999, 11], [1999, 12], [2000, 1]]);
});

test('yearly mean is day-weighted and needs all 12 months', () => {
  const vals = Array(24).fill(1);
  vals[0] = 32; // January 2001 (31 days)
  vals[13] = null; // February 2002 missing
  const { rows } = yearly(entry('2001-01', vals), { annual: 'mean' });
  assert.ok(Math.abs(rows[0].value - (32 * 31 + 334) / 365) < 1e-12);
  assert.equal(rows[1].complete, false);
  assert.equal(rows[1].value, null);
});

test('totals multiply the mean daily rate by days in the year (leap years too)', () => {
  const { rows } = yearly(entry('2000-01', Array(24).fill(2)), { annual: 'total' });
  assert.equal(rows[0].value, 2 * 366);
  assert.equal(rows[1].value, 2 * 365);
});

test('seasonal fallback keeps only months seen in at least 5 of 6 years', () => {
  // 12 years; winter months (Nov-Feb) missing every year.
  const vals = [];
  for (let y = 0; y < 12; y++) for (let m = 1; m <= 12; m++) vals.push([11, 12, 1, 2].includes(m) ? null : y + m / 100);
  const months = monthly(entry('2001-01', vals));
  assert.deepEqual(observableMonths(months), [3, 4, 5, 6, 7, 8, 9, 10]);
  const { rows, season } = yearly(entry('2001-01', vals), { annual: 'mean', seasonal: true });
  assert.deepEqual(season, [3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(rows.filter(r => r.complete).length, 12);
});

test('compare: one BH correction, verdicts and not-applicable sites', () => {
  const up = Array.from({ length: 20 * 12 }, (_, i) => 10 + i / 120 + ((i * 7919) % 13) / 100);
  const flat = Array.from({ length: 20 * 12 }, (_, i) => 10 + ((i * 7919) % 13) / 100);
  const series = { a: { X: entry('2001-01', up) }, b: { X: entry('2001-01', flat) }, c: { X: entry('2001-01', up) } };
  const r = compare(series, 'X', { annual: 'mean', notFor: ['c'] }, ['a', 'b', 'c', 'd']);
  assert.equal(r.a.verdict, 'up');
  assert.ok(['unsure', 'up', 'down'].includes(r.b.verdict));
  assert.equal(r.c, undefined);
  assert.equal(r.d, undefined);
  assert.ok(r.a.q >= r.a.test.p);
});

// ---------- start-year check ----------
import { startYearCheck } from '../src/data.js';
const series = (y0, values) => values.map((value, i) => ({ year: y0 + i, value, complete: value !== null }));
// Small deterministic wiggle so tests are not only perfect straight lines.
const wiggle = i => [0.3, -0.2, 0.1, -0.35, 0.25, -0.1, 0.05, -0.3][i % 8];

test('35 years with 15-year minimum gives 21 start years (1991..2011)', () => {
  const c = startYearCheck(series(1991, Array.from({ length: 35 }, (_, i) => i * 0.1)));
  assert.equal(c.count, 21);
  assert.equal(c.windows[0].start, 1991);
  assert.equal(c.windows.at(-1).start, 2011);
  assert.equal(c.kind, 'robust');
  assert.equal(c.direction, 'up');
});

test('the full-period window is the same test as the main answer', () => {
  const rows = series(1991, Array.from({ length: 35 }, (_, i) => i * 0.03 + wiggle(i)));
  const c = startYearCheck(rows);
  assert.equal(c.full.start, 1991);
  assert.equal(c.full.n, 35);
});

test('steady rise whose short windows are not significant is not called a reversal', () => {
  // Clear rise over the whole record, but noisy enough that late short windows lose significance.
  const rows = series(1991, Array.from({ length: 35 }, (_, i) => i * 0.04 + wiggle(i) * 3));
  const c = startYearCheck(rows);
  assert.ok(c.windows[0].significant, 'full period should be significant');
  assert.ok(c.windows.some(w => !w.significant), 'some short windows should be unsure');
  assert.ok(c.windows.every(w => w.test.slope > 0));
  assert.equal(c.kind, 'same-direction-partial');
});

test('rise then fall is flagged as depending on the start year', () => {
  const rows = series(1991, Array.from({ length: 35 }, (_, i) => (i < 15 ? i * 0.3 : 4.5 - (i - 15) * 0.15) + wiggle(i) * 0.1));
  const c = startYearCheck(rows);
  assert.equal(c.kind, 'direction-changes');
  assert.equal(c.direction, 'mixed');
  assert.ok(c.farthest.start > 1991);
});

test('a constant series is "none significant", never "robust"', () => {
  const c = startYearCheck(series(1991, Array(35).fill(5)));
  assert.equal(c.kind, 'none-significant');
  assert.equal(c.nSig, 0);
});

test('missing years: start years with no data are excluded, windows need 15 complete years', () => {
  const vals = Array.from({ length: 35 }, (_, i) => i * 0.1);
  vals[1] = null;  // 1992 missing -> excluded as a start, not replaced by 1993
  vals[30] = null; // 2021 missing -> the 2011 window (2011-2025) has only 14 complete years
  const c = startYearCheck(series(1991, vals));
  assert.ok(c.excluded.some(e => e.start === 1992 && e.reason === 'missing-start'));
  assert.ok(c.excluded.some(e => e.start === 2011 && e.reason === 'too-few-years'));
  assert.ok(!c.windows.some(w => w.start === 1992 || w.start === 2011));
  assert.ok(c.windows.every(w => w.n >= 15 && w.end - w.start + 1 >= 15));
});

test('records shorter than 20 complete years are skipped with a reason', () => {
  const c = startYearCheck(series(2006, Array.from({ length: 19 }, (_, i) => i)));
  assert.equal(c.skipped, 'short');
  assert.equal(c.n, 19);
});

test('seasonal data: windows reuse the same yearly rows (same months) as the main answer', () => {
  const vals = [];
  for (let y = 0; y < 24; y++) for (let m = 1; m <= 12; m++) vals.push([11, 12, 1, 2].includes(m) ? null : y * 0.1 + m / 100);
  const { rows, season } = yearly(entry('2001-01', vals), { annual: 'mean', seasonal: true });
  assert.deepEqual(season, [3, 4, 5, 6, 7, 8, 9, 10]);
  const c = startYearCheck(rows);
  // Each window's values are exactly the main rows for those years.
  const w = c.windows.at(-1);
  const main = rows.filter(r => r.complete && r.year >= w.start);
  assert.equal(w.n, main.length);
  assert.equal(w.test.lastYear, main.at(-1).year);
});

// ---------- same rule as the official answer ----------
import { correctAcrossSites } from '../src/data.js';

test('cross-site correction: the full-record window takes the official q, others get one BH per start year', () => {
  const a = series(1991, Array.from({ length: 35 }, (_, i) => i * 0.05 + wiggle(i)));
  const b = series(1991, Array.from({ length: 35 }, (_, i) => wiggle(i) * 2));
  const res = compare({ A: { X: null }, B: { X: null } }, 'X', {}, []); // empty: only for shape
  assert.deepEqual(res, {});
  const checks = { A: startYearCheck(a), B: startYearCheck(b) };
  const pBefore = checks.A.windows[5].test.p;
  correctAcrossSites(checks, { A: 0.001, B: 0.9 });
  assert.equal(checks.A.windows[0].q, 0.001);
  assert.equal(checks.B.windows[0].q, 0.9);
  // BH with two places: q >= p for every window, and significance follows q.
  assert.ok(checks.A.windows[5].q >= pBefore);
  checks.A.windows.forEach(w => assert.equal(w.significant, w.q < 0.05));
  assert.ok(checks.A.corrected);
});

test('cross-site correction: a window can lose significance it had on p alone', () => {
  // Two places with borderline p in the same window -> BH pushes at least one above 0.05.
  const c1 = { windows: [{ start: 2000, test: { p: 0.01, slope: 1, direction: 'up' } }, { start: 2001, test: { p: 0.04, slope: 1, direction: 'up' } }] };
  const c2 = { windows: [{ start: 2000, test: { p: 0.5, slope: 1, direction: 'up' } }, { start: 2001, test: { p: 0.6, slope: 1, direction: 'up' } }] };
  correctAcrossSites({ a: c1, b: c2 }, { a: 0.01, b: 0.5 });
  assert.equal(c1.windows[1].q, 0.08);
  assert.equal(c1.windows[1].significant, false);
  assert.equal(c1.kind, 'same-direction-partial');
});
