// Every claim the status line makes ("Total unchanged") rests on these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pt from '../../widgets/engines/pool-table.js';

function seeded(s = 1) { return () => (s = s * 16807 % 2147483647) / 2147483647; }

for (const [name, e, mu] of [['ideal table', 1, 0], ['felt + soft cushions', 0.7, 0.35], ['rough', 0.6, 0.7]]) {
  test(`total stays equal to the energy pushed in: ${name}`, () => {
    const t = pt.createTable(2, 1, 0.032); t.e = e; t.mu = mu;
    const rng = seeded(7);
    for (let i = 0; i < 6; i++) pt.addBall(t, null, null, rng);
    pt.push(t, t.balls[0], 2.4, 1.3);
    for (let i = 0; i < 60 * 60; i++) {
      pt.step(t, 1 / 60);
      assert.ok(Math.abs(pt.total(t) - t.external) < 1e-9 * t.external);
    }
  });
}

test('ideal table: the ball never slows', () => {
  const t = pt.createTable(2, 1, 0.032); const b = pt.addBall(t, 0.5, 0.5);
  pt.push(t, b, 1.7, 0.9); const k0 = pt.ke(b);
  for (let i = 0; i < 60 * 120; i++) pt.step(t, 1 / 60);
  assert.ok(Math.abs(pt.ke(b) - k0) < 1e-12);
  assert.equal(t.warmth, 0);
});

test('with felt the ball stops and all energy is warmth', () => {
  const t = pt.createTable(2, 1, 0.032); t.mu = 0.35; t.e = 0.7; const b = pt.addBall(t, 0.5, 0.5);
  pt.push(t, b, 2, 1);
  for (let i = 0; i < 60 * 60; i++) pt.step(t, 1 / 60);
  assert.equal(pt.ke(b), 0);
  assert.ok(Math.abs(t.warmth - t.external) < 1e-9);
});

test('a push from outside changes the total by exactly the energy it adds', () => {
  const t = pt.createTable(2, 1, 0.032); const b = pt.addBall(t, 0.5, 0.5);
  pt.push(t, b, 1, 0); const before = pt.total(t);
  pt.push(t, b, 2, 0);
  assert.ok(Math.abs(pt.total(t) - before - 1.5) < 1e-12);
});
