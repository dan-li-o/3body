import { test } from 'node:test';
import assert from 'node:assert/strict';
import { energy, stepNature, stepNewton, stepEnergy } from '../../widgets/engines/pendulum.js';

const start = [1.2, 0];
const run = (step, opts, T, dt = 1 / 60) => {
  let s = start; const out = [];
  for (let t = 0; t < T; t += dt) { s = step(s, dt, opts); out.push(s); }
  return out;
};

test('nature conserves energy within 0.01% over 20 s', () => {
  const E0 = energy(start);
  for (const s of run(stepNature, {}, 20)) assert.ok(Math.abs(energy(s) / E0 - 1) < 1e-4);
});

test('energy-terms model stays within a few percent, forever (60 s)', () => {
  const E0 = energy(start);
  for (const s of run(stepEnergy, { err: 0.03 }, 60)) assert.ok(Math.abs(energy(s) / E0 - 1) < 0.08);
});

test("Newton's-terms model gains energy: over 2x by 10 s at 3% error", () => {
  const s = run(stepNewton, { err: 0.03 }, 10).at(-1);
  assert.ok(energy(s) / energy(start) > 2);
});

test('with zero learning error, both models match nature', () => {
  const a = run(stepNature, {}, 5).at(-1);
  const b = run(stepNewton, { err: 0 }, 5).at(-1);
  const c = run(stepEnergy, { err: 0 }, 5).at(-1);
  assert.ok(Math.abs(a[0] - b[0]) < 1e-6);
  assert.ok(Math.abs(a[0] - c[0]) < 1e-3);
});
