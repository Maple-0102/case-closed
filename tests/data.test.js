// Tests for src/data.js. Run: node --test
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the team.
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
