// Claims of The Pressure Gauge rest on these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../widgets/engines/gas.js';
const seeded = (s = 1) => () => (s = s * 16807 % 2147483647) / 2147483647;
function dial(N, samples, seed) {
  const rng = seeded(seed), g = G.createGas(), dt = 1 / 60; for (let i = 0; i < N; i++) G.addBall(g, rng);
  for (let i = 0; i < 120; i++) G.updateDial(g, G.step(g, dt, rng), dt);
  const R = []; for (let r = 0; r < samples; r++) { let d; for (let i = 0; i < 15; i++) d = G.updateDial(g, G.step(g, dt, rng), dt); R.push(d); }
  return R;
}
const avg = a => a.reduce((x, y) => x + y) / a.length;
const sd = a => { const m = avg(a); return Math.sqrt(avg(a.map(x => (x - m) ** 2))); };

test('the push per molecule matches the ideal-gas law, with few or many molecules', () => {
  for (const [N, n] of [[10, 3000], [1000, 400], [10000, 120]]) { const m = avg(dial(N, n, 5 + N)); assert.ok(Math.abs(m / G.MEAN - 1) < 0.08, `N=${N}: ${m}`); }
});
test('"The knocks become a hum": the dial shakes far less with 10,000 molecules than with 3', () => {
  assert.ok(sd(dial(3, 2000, 7)) > 20 * sd(dial(10000, 120, 8)));
});
test('bands: about 68 and 95 of every 100 moments land inside', () => {
  for (const [N, n] of [[20, 2500], [500, 800]]) { const R = dial(N, n, 99 + N);
    const f = k => { const [lo, hi] = G.bandAt(N, k); return R.filter(r => r >= lo && r <= hi).length / R.length; };
    assert.ok(f(1) > 0.6 && f(1) < 0.76, `N=${N} inner ${f(1)}`); assert.ok(f(2) > 0.9 && f(2) < 0.99, `N=${N} outer ${f(2)}`); }
});
test('speeds follow Maxwell–Boltzmann: mean square velocity component is SIGMA²', () => {
  const rng = seeded(3), g = G.createGas(); for (let i = 0; i < 10000; i++) G.addBall(g, rng);
  let s = 0; for (let i = 0; i < g.n; i++) s += g.vy[i] ** 2; assert.ok(Math.abs(s / g.n / G.SIGMA ** 2 - 1) < 0.04);
});
test('the piston barely moves: the chamber keeps its size', () => {
  const rng = seeded(4), g = G.createGas(); for (let i = 0; i < 10000; i++) G.addBall(g, rng);
  for (let i = 0; i < 300; i++) G.step(g, 1 / 60, rng); assert.ok(Math.abs(g.px - g.x0) < 0.01 * g.L);
});

test('the statistical shortcut gives the same dial as simulating every molecule', () => {
  const dt = 1 / 60, N = 2000, shown = 200;
  const full = dial(N, 300, 21);
  const rng = seeded(22), g = G.createGas(); for (let i = 0; i < shown; i++) G.addBall(g, rng);
  const R = []; let rate = 0;
  for (let i = 0; i < 120 + 300 * 15; i++) {
    const imp = G.step(g, dt, rng) + G.statImpulse(N - shown, dt, rng);
    rate += (imp / dt - rate) * Math.min(1, dt / G.TAU);
    if (i >= 120 && (i - 120) % 15 === 14) R.push(rate / N);
  }
  assert.ok(Math.abs(avg(R) / avg(full) - 1) < 0.04, `mean ${avg(R)} vs ${avg(full)}`);
  assert.ok(Math.abs(sd(R) / sd(full) - 1) < 0.25, `spread ${sd(R)} vs ${sd(full)}`);
});
