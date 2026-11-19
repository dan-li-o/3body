// Every sentence the widgets say about three bodies rests on one of these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  system, advance, energy, momentum, toRestFrame, bounce, merge, distance,
  hasEscaped, looksGone, distanceFromPair, calmPair, figureEight, FIGURE_EIGHT_PERIOD,
} from '../../widgets/engines/nbody.js';
import { rng } from './rng.mjs';

const EXACT = { eps: 0 };
const maxPosError = (a, b) => Math.max(...[0, 1, 2].map((i) => Math.hypot(a.s[4 * i] - b.s[4 * i], a.s[4 * i + 1] - b.s[4 * i + 1])));
const sides = (sys) => [distance(sys, 0, 1), distance(sys, 1, 2), distance(sys, 0, 2)];
// Range of the triangle's side lengths over a run: a rotation-free picture of its shape.
function sideRange(sys, periods, opts = EXACT) {
  let lo = Infinity, hi = 0;
  for (let k = 0; k < periods * 200; k++) {
    advance(sys, FIGURE_EIGHT_PERIOD / 200, opts);
    for (const d of sides(sys)) { lo = Math.min(lo, d); hi = Math.max(hi, d); }
  }
  return [lo, hi];
}
// Same random launches as the widget's "Try a random placement".
function randomLaunch(r) {
  const a = r() * 2 * Math.PI, d = 0.9 + r() * 0.6, sp = 0.2 + r() * 0.9, b = r() * 2 * Math.PI;
  const p = calmPair();
  return toRestFrame(system([...p.s, d * Math.cos(a), d * Math.sin(a), sp * Math.cos(b), sp * Math.sin(b)]));
}

test('calm pair keeps its separation of 1 (the "law" the reader sees first)', () => {
  const p = calmPair();
  for (let k = 0; k < 50; k++) { advance(p, 1, EXACT); assert.ok(Math.abs(distance(p, 0, 1) - 1) < 1e-5); }  // bounded wobble ~4e-6, no drift
});

test('figure-eight returns to its start after each period (10 periods)', () => {
  const start = figureEight(), sys = figureEight();
  for (let k = 0; k < 10; k++) advance(sys, FIGURE_EIGHT_PERIOD, EXACT);
  assert.ok(maxPosError(sys, start) < 1e-3, `drifted ${maxPosError(sys, start)}`);
});

test('energy is conserved along the figure-eight (to one part in a million)', () => {
  const sys = figureEight(), E0 = energy(sys, EXACT);
  for (let k = 0; k < 20; k++) {
    advance(sys, FIGURE_EIGHT_PERIOD / 2, EXACT);
    assert.ok(Math.abs(energy(sys, EXACT) / E0 - 1) < 1e-6);
  }
});

test('Nudge copy: a 0.01 nudge holds the figure-eight for 200 loops', () => {
  const ref = sideRange(figureEight(), 5);
  const sys = figureEight(); sys.s[0] += 0.01;
  const got = sideRange(sys, 200);
  assert.ok(got[0] > ref[0] * 0.8 && got[1] < ref[1] * 1.15, `shape ${got} vs ${ref}`);
});

test('Nudge copy: "a slightly bigger push would break it" (0.05 breaks it)', () => {
  const ref = sideRange(figureEight(), 5);
  const sys = figureEight(); sys.s[0] += 0.05;
  const got = sideRange(sys, 200, {});
  assert.ok(got[1] > ref[1] * 1.5, `still holds: ${got} vs ${ref}`);
});

test('bounce keeps momentum and kinetic energy, and never acts on separating bodies', () => {
  const sys = system([0, 0, 1, 0.2, 0.1, 0, -0.5, 0, 5, 5, 0, 0], [1, 2, 1]);
  const p0 = momentum(sys), ke = (q) => 0.5 * [...q.m].reduce((t, mi, i) => t + mi * (q.s[4 * i + 2] ** 2 + q.s[4 * i + 3] ** 2), 0);
  const k0 = ke(sys);
  assert.equal(bounce(sys, 0, 1), true);
  const p1 = momentum(sys);
  assert.ok(Math.abs(p1[0] - p0[0]) < 1e-12 && Math.abs(p1[1] - p0[1]) < 1e-12);
  assert.ok(Math.abs(ke(sys) - k0) < 1e-12);
  assert.equal(bounce(sys, 0, 1), false, 'bounced twice');
});

test('merge keeps total mass and momentum', () => {
  const sys = system([0, 0, 1, 0, 1, 0, -1, 0.5, 3, 0, 0, 0.5]);
  const p0 = momentum(sys), out = merge(sys, 0, 1);
  assert.deepEqual([...out.m], [2, 1]);
  const p1 = momentum(out);
  assert.ok(Math.abs(p1[0] - p0[0]) < 1e-12 && Math.abs(p1[1] - p0[1]) < 1e-12);
});

test('"It will never come back": no sun flagged as escaped ever returns (40 launches)', () => {
  const r = rng(7);
  let flagged = 0;
  for (let n = 0; n < 40; n++) {
    const sys = randomLaunch(r);
    let who = -1;
    for (let t = 0; t < 60 && who < 0; t += 0.05) { advance(sys, 0.05); who = [0, 1, 2].find((i) => hasEscaped(sys, i)) ?? -1; }
    if (who < 0) continue;
    flagged++;
    for (let t = 0; t < 200; t += 0.05) { advance(sys, 0.05); assert.ok(distanceFromPair(sys, who) > 2, `launch ${n}: it came back`); }
  }
  assert.ok(flagged >= 10, `only ${flagged} escapes to test`);
});

test('the naive "looks gone" rule is fooled sometimes (so the "…Or not." joke can happen)', () => {
  const r = rng(7);
  let fooled = 0;
  for (let n = 0; n < 40 && !fooled; n++) {
    const sys = randomLaunch(r);
    let gone = -1;
    for (let t = 0; t < 60; t += 0.05) {
      advance(sys, 0.05);
      if (gone < 0) gone = [0, 1, 2].find((i) => looksGone(sys, i) && !hasEscaped(sys, i)) ?? -1;
      else if (distanceFromPair(sys, gone) < 1.5) { fooled++; break; }
    }
  }
  assert.ok(fooled > 0);
});

test('same launch, same result (runs are reproducible)', () => {
  const a = randomLaunch(rng(3)), b = randomLaunch(rng(3));
  advance(a, 20); advance(b, 20);
  assert.deepEqual([...a.s], [...b.s]);
});
