// Claims of The Lawful Coin's status line rest on these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flip, envelope } from '../../widgets/engines/coins.js';
const seeded = (s = 1) => () => (s = s * 16807 % 2147483647) / 2147483647;
const share = a => a.filter(Boolean).length / a.length;

test('about 95% of flips land inside the expected range, at every count', () => {
  const rng = seeded(11);
  for (const n of [10, 50, 100, 500, 1000]) {
    const [lo, hi] = envelope(n); let inside = 0;
    for (let k = 0; k < 4000; k++) { const s = share(flip(n, rng)); if (s >= lo && s <= hi) inside++; }
    assert.ok(inside / 4000 > 0.93, `n=${n}: ${inside / 4000}`);
  }
});
test('the range narrows as coins are added', () => {
  const w = n => envelope(n)[1] - envelope(n)[0];
  assert.ok(w(10) > w(100) && w(100) > w(1000));
});
test('"However often you flip, it lands near half": 1,000 coins stay within 0.45–0.55 in 99% of flips', () => {
  const rng = seeded(5); let ok = 0;
  for (let k = 0; k < 2000; k++) { const s = share(flip(1000, rng)); if (Math.abs(s - 0.5) < 0.05) ok++; }
  assert.ok(ok / 2000 > 0.99);
});
