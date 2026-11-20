// Coins engine (Ch1 §5a The Lawful Coin). Fair coins; no drawing.
// Flip n fair coins: returns an array of booleans (true = heads).
export function flip(n, rng) { const out = new Array(n); for (let i = 0; i < n; i++) out[i] = rng() < 0.5; return out; }
// Expected range for the share of heads with n fair coins: 1/2 ± 1/sqrt(n)
// (two standard deviations, about 95% of flips), clipped to [0, 1].
export function envelope(n) { const h = 1 / Math.sqrt(n); return [Math.max(0, 0.5 - h), Math.min(1, 0.5 + h)]; }
export const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
