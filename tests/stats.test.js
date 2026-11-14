// Tests for src/stats.js. Run: node --test
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the team.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalCdf, normalQuantile, kendallS, kendallVariance, pairwiseSlopes, ar1Inflation, trendTest, benjaminiHochberg } from '../src/stats.js';

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('normal distribution helpers', () => {
  close(normalCdf(0), 0.5, 1e-7);
  close(normalCdf(1.959963985), 0.975, 1e-6);
  close(normalQuantile(0.975), 1.959963985, 1e-6);
  close(normalQuantile(0.01), -2.326347874, 1e-6);
  for (const p of [0.001, 0.2, 0.5, 0.8, 0.999]) close(normalCdf(normalQuantile(p)), p, 1e-6);
});

test('Mann-Kendall S and variance', () => {
  assert.equal(kendallS([1, 2, 3, 4, 5]), 10);
  assert.equal(kendallS([5, 4, 3, 2, 1]), -10);
  close(kendallVariance([1, 2, 3, 4, 5]), 5 * 4 * 15 / 18);
  // one pair tied: subtract 2*1*9 = 18, then /18
  close(kendallVariance([1, 2, 2, 4, 5]), (5 * 4 * 15 - 18) / 18);
});

test('pairwise slopes use real year gaps', () => {
  assert.deepEqual(pairwiseSlopes([{ year: 2000, value: 0 }, { year: 2002, value: 4 }]), [2]);
});

test('AR(1) inflation is 1 without autocorrelation and grows with it', () => {
  close(ar1Inflation(30, 0), 1);
  assert.ok(ar1Inflation(30, 0.5) > ar1Inflation(30, 0.2));
});

test('exact linear trend: slope recovered, significant, CI brackets it', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ year: 1991 + i, value: 10 + 0.03 * i }));
  const r = trendTest(rows);
  close(r.slope, 0.03, 1e-12);
  assert.equal(r.direction, 'up');
  assert.ok(r.significant);
  assert.ok(r.ciLow <= 0.03 && r.ciHigh >= 0.03);
});

test('too few years returns null; missing years are skipped', () => {
  assert.equal(trendTest(Array.from({ length: 9 }, (_, i) => ({ year: 2000 + i, value: i }))), null);
  const rows = Array.from({ length: 12 }, (_, i) => ({ year: 2000 + i, value: i === 3 ? null : i }));
  assert.equal(trendTest(rows).n, 11);
});

test('Benjamini-Hochberg matches a hand calculation', () => {
  const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.2]);
  // sorted 0.01,0.03,0.04,0.2 -> 0.04, 0.0533, 0.0533, 0.2
  close(q[0], 0.04); close(q[2], 0.04 * 4 / 3); close(q[1], 0.04 * 4 / 3); close(q[3], 0.2);
});
