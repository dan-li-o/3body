# The Lawful Coin (Ch1 §5a) — prototype notes

**Spec:** v2.1, agreed 2026-11-20, in the writing project (`notes/ch1-widgets.md`, "§5 Twin widgets"). Built as specified; this file records only what the build decided.

**Files:** `prototype.html` (self-contained test page), engine `../engines/coins.js`, tests `tests/engines/coins.test.mjs` (≈95% of flips inside the expected range at every count; the range narrows; at 1,000 coins 99% of flips land within 0.45–0.55, which backs "However often you flip, it lands near half").

**Build decisions (2026-11-20):**
- Model: before a flip, one block of open grey coins; on Flip all, each coin squeezes (a flip) and slides into its pile: heads filled ink on the left, tails open ink on the right, a rule between, counts below. The piles share a width, so their heights compare like bars. Reduced motion: no animation.
- Count steps 1 → 2 → 5 → 10 → 20 → 50 → 100 → 200 → 500 → 1,000; Add coins disables at 1,000. Adding coins clears the model (no flip yet) but keeps the dots.
- Chart: x log, labels *1 coin* and *1,000 coins*; y labels 0, ½, 1; ghost line at ½; envelope ½ ± 1/√n as two ghost hairlines, *expected range* at the right end; accent dots. **Deviation:** identical results at one count sit side by side (toward the chart's middle), not stacked vertically, so a dot never moves off its true value (e.g. 1 coin can only give 0 or 1).
- Layout: model left, chart right; phones (≤ 640 px) stacked, chart shorter.

**In the book:** numbered, `::: {#wid-lawful-coin}` block with caption.
