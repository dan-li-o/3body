// The groove engine: every sentence The Groove widget says rests on one of these.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../widgets/engines/groove.js';

const h = 1 / 480;
function slices(m, n) {   // slice angles in degrees, one per tick, as the widget draws them
  const out = [];
  for (let i = 0; i < n; i++) { const t0 = m.th; for (let k = 0; k < Math.round(G.PARAMS.tick / h); k++) G.step(m, h); out.push((m.th - t0) * 180 / Math.PI); }
  return out;
}
const spread = (a) => Math.max(...a) - Math.min(...a);

for (const laps of [G.PARAMS.minLaps, G.PARAMS.defaultLaps, G.PARAMS.maxLaps]) {
  test(`"Equal times, equal slices": round groove at ${laps} laps/s`, () => {
    const m = G.createGroove(); G.flick(m, laps);
    assert.ok(spread(slices(m, 60)) < 1e-6);
  });
}
test('"You turned the groove, and nothing changed": round groove turned while running', () => {
  const m = G.createGroove(); G.flick(m, 0.35); const L0 = G.angMom(m);
  const s = []; for (let i = 0; i < 40; i++) { m.rot += 0.07; s.push(...slices(m, 1)); }
  assert.ok(spread(s) < 1e-6);
  assert.ok(Math.abs(G.angMom(m) - L0) < 1e-9);
});
test('"Out on the bend the marble goes around more slowly": slices narrow there; speed unchanged', () => {
  const m = G.createGroove(); G.flick(m, 0.35); m.bendTarget = 1;
  const s = slices(m, 80);
  assert.equal(m.bend, 1);
  assert.ok(spread(s) > 1.5, `slice angles spread ${spread(s).toFixed(2)}°`);
  // the slowest pace is on the bend's crest
  let worst = { pace: Infinity };
  for (let i = 0; i < 400; i++) { G.step(m, 0.01); const p = G.pace(m); if (p < worst.pace) worst = { pace: p, th: m.th }; }
  assert.ok(Math.abs(G.wrap(worst.th - m.at - m.rot)) < 0.1);
  assert.ok(Math.abs(Math.abs(m.v) - 0.35 * G.TAU) < 1e-12);
});
test('bent: angular momentum is not kept', () => {
  const m = G.createGroove(); G.flick(m, 0.35); m.bendTarget = 1; slices(m, 30);
  const L = []; for (let i = 0; i < 300; i++) { G.step(m, 0.01); L.push(G.angMom(m)); }
  assert.ok(spread(L) > 0.1);
});
test('a bend is made only when the marble is away from it', () => {
  const m = G.createGroove(); G.flick(m, 0.35); m.at = m.atTarget = m.th; m.bendTarget = 1;
  G.step(m, h); assert.equal(m.bend, 0);
});
test('"Round again": equal slices again', () => {
  const m = G.createGroove(); G.flick(m, 0.35); m.bendTarget = 1; slices(m, 40); m.bendTarget = 0;
  slices(m, 40); assert.equal(m.bend, 0); assert.ok(spread(slices(m, 40)) < 1e-6);
});
test('the bend turns with the groove: the slowest pace follows it', () => {
  const m = G.createGroove(); G.flick(m, 0.35); m.bendTarget = 1; slices(m, 30); m.rot += 1.3;
  let worst = { pace: Infinity };
  for (let i = 0; i < 400; i++) { G.step(m, 0.01); const p = G.pace(m); if (p < worst.pace) worst = { pace: p, th: m.th }; }
  assert.ok(Math.abs(G.wrap(worst.th - m.at - m.rot)) < 0.1);
});
