// Claims of The Lawful Coin's status line rest on these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flip, band, sweep } from '../../widgets/engines/coins.js';
const seeded = (s = 1) => () => (s = s * 16807 % 2147483647) / 2147483647;
const share = a => a.filter(Boolean).length / a.length;

function inside(k, rng) {
  let hit = 0, all = 0;
  for (const n of [100, 200, 500, 1000]) { const [lo, hi] = band(n, k);
    for (let r = 0; r < 1500; r++) { const s = share(flip(n, rng)); all++; if (s >= lo && s <= hi) hit++; } }
  return hit / all;
}
test('light band: about 95 of every 100 flips land inside', () => { const f = inside(2, seeded(3)); assert.ok(f > 0.93 && f < 0.98, f); });
test('dark band: about 68 of every 100 flips land inside', () => { const f = inside(1, seeded(9)); assert.ok(f > 0.64 && f < 0.74, f); });
test('the bands narrow as coins are added', () => { const w = n => band(n, 2)[1] - band(n, 2)[0]; assert.ok(w(10) > w(100) && w(100) > w(1000)); });
test('a run sweeps from 1 to 1,000 coins without repeats', () => { const s = sweep(); assert.equal(s[0], 1); assert.equal(s.at(-1), 1000); assert.equal(new Set(s).size, s.length); });
test('"Many coins: close to half": at 1,000 coins, 99% of flips are within 0.45–0.55', () => {
  const rng = seeded(5); let ok = 0; for (let k = 0; k < 2000; k++) if (Math.abs(share(flip(1000, rng)) - 0.5) < 0.05) ok++; assert.ok(ok / 2000 > 0.99);
});
