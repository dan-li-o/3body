// Coins engine (Ch1 §5a The Lawful Coin). Fair coins; no drawing.
// Flip n fair coins: returns an array of booleans (true = heads).
export function flip(n, rng) { const out = new Array(n); for (let i = 0; i < n; i++) out[i] = rng() < 0.5; return out; }
// Band for the share of heads with n fair coins: 1/2 ± k·σ, σ = 1/(2√n), clipped to [0, 1].
// k = 1: about 68 of every 100 flips land inside; k = 2: about 95.
export function band(n, k) { const h = k / (2 * Math.sqrt(n)); return [Math.max(0, 0.5 - h), Math.min(1, 0.5 + h)]; }
// The counts one run sweeps: 1 to 1,000, spaced evenly on a log scale, no repeats.
export function sweep(points = 260) {
  const out = []; for (let i = 0; i < points; i++) { const n = Math.round(Math.pow(10, 3 * i / (points - 1))); if (n !== out[out.length - 1]) out.push(n); }
  return out;
}
