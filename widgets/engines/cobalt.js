// Wu's cobalt (Ch1 §8, Widget 1.7): a toy model of Wu's experiment. No DOM, no drawing.
// Real anchors (NIST SP 958; Wu et al., Phys. Rev. 105, 1413, 1957):
//   - the crystal was cooled to about 0.003 K, and held that cold only about fifteen minutes;
//   - at most about 60% of the nuclei lined up;
//   - the electrons came out more often opposite to the nuclei's spin (drawn here: spin up,
//     so more electrons fly down).
// Illustrative, not measured: the size of the lean (LEAN), the temperature at which lining up
// begins (alignK), and the time scales (compressed for play, Dan 2026-11-25).
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export const PARAMS = {
  roomK: 300,          // where the slider starts
  coldK: 0.003,        // Wu's working temperature, about 0.003 K
  alignK: 0.1,         // illustrative: above this, the magnet lines up nothing
  coldSeconds: 12,     // the cold window (Wu: ~15 minutes; compressed, Dan 2026-11-25)
  rewarmK: 5,          // once warmed past this, the reader may cool it again
  maxAlign: 0.6,       // at most ~60% of the nuclei line up
  LEAN: 0.5,           // illustrative: a lined-up nucleus sends 75% of its electrons down
  handRate: 3.5,       // electrons per second while the reader taps
  detectorRate: 18,    // electrons per second once the detector counts
  minCount: 40,        // the widget passes no verdict on fewer electrons than this
  sigmas: 2,           // how far from even counts as "more fly down" (in coin-flip standard deviations)
};

// Slider position 0..100 <-> temperature, on a log scale from room temperature to 0.003 K.
export const tempAt = (v) => PARAMS.roomK * (PARAMS.coldK / PARAMS.roomK) ** (v / 100);
export const sliderFor = (T) => Math.round(100 * Math.log(T / PARAMS.roomK) / Math.log(PARAMS.coldK / PARAMS.roomK)) + 0;
// At the working temperature (allowing for rounding in tempAt).
export const isCold = (T) => T <= PARAMS.coldK * (1 + 1e-9);

// How hard the nuclei jiggle: 1 at room temperature, 0 at the working temperature.
export const jiggle = (T) => clamp01(Math.log(T / PARAMS.coldK) / Math.log(PARAMS.roomK / PARAMS.coldK));

// Fraction of nuclei the magnet lines up at temperature T: none without the magnet, none above
// alignK, rising to maxAlign at the working temperature.
export const alignTarget = (T, magnet) => {
  if (!magnet) return 0;
  const f = clamp01(Math.log(PARAMS.alignK / T) / Math.log(PARAMS.alignK / PARAMS.coldK));
  return PARAMS.maxAlign * f * f;
};

// Each nucleus gets a rank in (0, 1), evenly spread and shuffled; a nucleus lines up when its rank
// is below the fraction lined up. So at full alignment 11 of 18 nuclei line up (61%).
export function ranks(n, random) {
  const r = Array.from({ length: n }, (_, k) => (k + 0.5) / n);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
export const linedUp = (rank, align) => rank < align;

// Chance that one nucleus's electron flies down: a lined-up nucleus (spin up) leans down;
// a nucleus pointing every which way sends as many up as down.
export const pDownOne = (lined) => (lined ? 0.5 + 0.5 * PARAMS.LEAN : 0.5);
// The same, averaged over the crystal, given the fraction lined up.
export const pDown = (align) => 0.5 + 0.5 * PARAMS.LEAN * clamp01(align);

// What the counts say: null (too few to tell), 'lean' (clearly more down than up),
// 'even' (within the spread a fair coin gives), or 'uneven' (lopsided, but not down-heavy).
export function verdict(up, down) {
  const n = up + down;
  if (n < PARAMS.minCount) return null;
  const spread = PARAMS.sigmas * Math.sqrt(n);
  if (down - up > spread) return 'lean';
  return Math.abs(down - up) <= spread ? 'even' : 'uneven';
}

// The crystal warming once the cold window closes: from 0.003 K back past rewarmK in about 4 s.
export const warmStep = (T, dt) => Math.min(PARAMS.roomK, T * 1.9 ** (dt * 3));
