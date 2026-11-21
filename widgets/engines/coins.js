// Coins engine (Ch1 §5a The Lawful Coin). Fair coins; no drawing.
// Flip n fair coins: returns an array of booleans (true = heads).
export function flip(n, rng) { const out = new Array(n); for (let i = 0; i < n; i++) out[i] = rng() < 0.5; return out; }
// Band for the share of heads with n fair coins: 1/2 ± k·σ, σ = 1/(2√n), clipped to [0, 1].
// k = 1: about 68 of every 100 flips land inside; k = 2: about 95.
export function band(n, k) { const h = k / (2 * Math.sqrt(n)); return [Math.max(0, 0.5 - h), Math.min(1, 0.5 + h)]; }
// The counts one run sweeps: every count from 1 to 1,000, one coin added at a time.
export function sweep(max = 1000) { return Array.from({ length: max }, (_, i) => i + 1); }

// The law of the lever. Tails sit at 0 and heads at 1 on a light beam; the beam
// balances where the moments cancel: tails·(0 − p) + heads·(1 − p) = 0, so p = heads / (heads + tails).
// The Lawful Coin's fulcrum slides to this point: it IS the share of heads.
export function balancePoint(heads, tails) { const n = heads + tails; return n ? heads / n : 0.5; }
