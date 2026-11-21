// Calibrate The Pressure Gauge's expected range: simulate the widget's own model (up to 400 molecules
// one by one, the rest by the statistical shortcut, read through the same Dial) for a long time at each
// count, and record quantiles of the reading. Paste the printed CALIB into widgets/engines/gas.js.
//   node tools/calibrate-gas.mjs
import * as G from '../widgets/engines/gas.js';
let s = 777; const rng = () => (s = s * 16807 % 2147483647) / 2147483647;
const SIM = 400, dt = 1 / 60, out = [];
for (const N of [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
  const g = G.createGas({ cap: SIM }), dial = new G.Dial();
  for (let i = 0; i < Math.min(N, SIM); i++) G.addBall(g, rng);
  const tick = () => dial.update(G.step(g, dt, rng) + G.statImpulse(N - g.n, dt, rng), dt, N);
  for (let i = 0; i < 120; i++) tick();
  const R = []; const samples = 6000;
  for (let r = 0; r < samples; r++) { let d; for (let i = 0; i < 15; i++) d = tick(); R.push(d); }
  R.sort((a, b) => a - b); const q = (p) => R[Math.min(R.length - 1, Math.floor(p * R.length))];
  const mean = R.reduce((a, b) => a + b) / R.length;
  out.push([N, +mean.toFixed(4), +q(0.025).toFixed(4), +q(0.16).toFixed(4), +q(0.84).toFixed(4), +q(0.975).toFixed(4)]);
  console.error(out.at(-1).join(' '));
}
console.log(JSON.stringify(out));
