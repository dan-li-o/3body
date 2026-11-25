// Every claim Widget 1.7 (Wu's cobalt) makes, checked against its model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARAMS, awaySide, tempAt, sliderFor, isCold, jiggle, alignTarget, ranks, linedUp, pAwayOne, pAway, verdict, fairRange, warmStep } from '../../widgets/engines/cobalt.js';
import { rng } from './rng.mjs';

test('the slider runs from room temperature to 0.003 K, and its far end counts as cold', () => {
  assert.equal(Math.round(tempAt(0)), 300);
  assert.ok(Math.abs(tempAt(100) - 0.003) < 1e-12);
  assert.ok(isCold(tempAt(100)));
  assert.ok(!isCold(tempAt(99)));
  for (const v of [0, 37, 81, 100]) assert.equal(sliderFor(tempAt(v)), v);
});

test('warm nuclei jiggle; at 0.003 K they are still', () => {
  assert.equal(jiggle(300), 1);
  assert.equal(jiggle(tempAt(100)), 0);
});

test('no magnet, no lining up; nothing lines up above 0.1 K; at most about 60% at 0.003 K', () => {
  for (const T of [300, 1, 0.003]) assert.equal(alignTarget(T, false), 0);
  for (const T of [300, 5, 1, 0.1]) assert.equal(alignTarget(T, true), 0);
  assert.ok(Math.abs(alignTarget(tempAt(100), true) - 0.6) < 1e-9);
  assert.ok(alignTarget(0.01, true) < 0.6);
});

test('"most of the nuclei" line up: 11 of the 18 drawn, at full alignment', () => {
  const r = ranks(18, rng(3));
  const n = r.filter((u) => linedUp(u, PARAMS.maxAlign)).length;
  assert.equal(n, 11);
  assert.ok(n / 18 > 0.5 && Math.abs(n / 18 - 0.6) < 0.03);
  assert.equal(r.filter((u) => linedUp(u, 0)).length, 0);
});

test('the lean follows the spin: reversing the magnet swaps the favoured plate', () => {
  assert.equal(awaySide(1), 1); assert.equal(awaySide(-1), -1);
});

test('per nucleus and on average, the lean agrees', () => {
  const r = ranks(18, rng(5)), a = PARAMS.maxAlign;
  const avg = r.reduce((s, u) => s + pAwayOne(linedUp(u, a)), 0) / r.length;
  assert.ok(Math.abs(avg - pAway(11 / 18)) < 1e-12);
  assert.equal(pAway(0), 0.5);
  assert.equal(pAwayOne(false), 0.5);
});

// One run of n electrons from a crystal with the given fraction lined up.
function run(random, n, align) {
  const r = ranks(18, random); let up = 0, down = 0;
  for (let i = 0; i < n; i++) {
    const u = r[Math.floor(random() * r.length)];
    random() < pAwayOne(linedUp(u, align)) ? down++ : up++;
  }
  return verdict(up, down);
}

test('too few electrons: no verdict', () => {
  assert.equal(verdict(15, 20), null);
});

test('disordered nuclei: "even" in at least 93% of runs, and almost never "more fly down"', () => {
  const random = rng(11); let even = 0, lean = 0; const N = 4000;
  for (let i = 0; i < N; i++) { const v = run(random, 60 + (i % 200), 0); if (v === 'even') even++; if (v === 'lean') lean++; }
  assert.ok(even / N > 0.93, `even ${even / N}`);
  assert.ok(lean / N < 0.035, `lean ${lean / N}`);
});

test('lined up, a full Run (10,000 electrons) ends outside the fair coin\'s outer band every time', () => {
  const random = rng(13); let lean = 0; const N = 60;
  for (let i = 0; i < N; i++) if (run(random, PARAMS.runCount, PARAMS.maxAlign) === 'lean') lean++;
  assert.equal(lean, N);
});

test('even a Run cut to 1 s by the warm-up shows the lean in at least 99% of runs', () => {
  const random = rng(17); let lean = 0; const N = 600;
  for (let i = 0; i < N; i++) if (run(random, PARAMS.detectorRate, PARAMS.maxAlign) === 'lean') lean++;
  assert.ok(lean / N > 0.99, `lean ${lean / N}`);
});

test('the cold window is 12 seconds (Dan, 2026-11-25); the crystal warms back within 5 s', () => {
  assert.equal(PARAMS.coldSeconds, 12);
  let T = tempAt(100), t = 0; while (T < PARAMS.rewarmK) { T = warmStep(T, 1 / 60); t += 1 / 60; }
  assert.ok(t > 2 && t < 5, `${t} s`);
});

test('the fair-coin band on the gauge: the share down lands inside it as often as "even" says', () => {
  const [lo, hi] = fairRange(100);
  assert.ok(Math.abs(lo - 0.4) < 1e-12 && Math.abs(hi - 0.6) < 1e-12);
  // inside the band <=> verdict "even" (same 2-sigma rule), for every split of 100
  for (let down = 0; down <= 100; down++) {
    const inside = down / 100 >= lo && down / 100 <= hi;
    assert.equal(inside, verdict(100 - down, down) === 'even', `down ${down}`);
  }
  assert.ok(fairRange(400)[1] - fairRange(400)[0] < hi - lo);   // more counts, narrower band
});

test('a Run fits in one cold spell: 10,000 electrons at the detector rate take about 8 s', () => {
  const s = PARAMS.runCount / PARAMS.detectorRate;
  assert.ok(s < PARAMS.coldSeconds && s > 6);
});

test('by hand, an electron stays catchable for over a second', () => {
  assert.ok(PARAMS.flightHand >= 1.2 && PARAMS.flightDetector < PARAMS.flightHand / 3 && PARAMS.drawnRate < PARAMS.detectorRate / 10);
});

test('warm or jumbled, a full Run stays inside the outer band in at least 93% of runs (the control; a fair coin: about 95%)', () => {
  const random = rng(19); let even = 0; const N = 1500;
  for (let i = 0; i < N; i++) if (run(random, PARAMS.runCount, 0) === 'even') even++;
  assert.ok(even / N > 0.93, `even ${even / N}`);
});

test('warmed mid-run: the new electrons stop leaning, and the running share drifts back toward half', () => {
  const random = rng(23), R = ranks(12, random), share = (cold, warm) => {
    let away = 0;
    for (let i = 0; i < cold + warm; i++) { const u = R[Math.floor(random() * 12)]; if (random() < pAwayOne(linedUp(u, i < cold ? PARAMS.maxAlign : alignTarget(5, true)))) away++; }
    return away / (cold + warm);
  };
  assert.equal(alignTarget(5, true), 0);                       // warm: nothing lined up, so no lean
  const full = share(10000, 0), half = share(5000, 5000);
  assert.ok(full > 0.6 && half < full - 0.05 && half > 0.5);   // bent back toward half, not snapped to it
});
