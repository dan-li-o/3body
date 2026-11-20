# The Lawful Coin (Ch1 §5a) — prototype notes

**Spec:** v2.1, agreed 2026-11-20, in the writing project (`notes/ch1-widgets.md`, "§5 Twin widgets"). Built as specified; this file records only what the build decided.

**Files:** `prototype.html` (self-contained test page), engine `../engines/coins.js`, tests `tests/engines/coins.test.mjs` (≈95% of flips inside the expected range at every count; the range narrows; at 1,000 coins 99% of flips land within 0.45–0.55, which backs "However often you flip, it lands near half").

**v2 (2026-11-20), after Dan's review of v1** ("This current version is not satisfying to me"): v1 added coins in steps (1, 2, 5 … 1,000) and drew the envelope from the start; same-count dots were spread sideways, which read as a bug; the steps left the x-axis empty; the envelope was "given" instead of coming out of repeated experiments. Dan: "Auto run would add 1 coin at a time… that's how we fill up the x-axis"; "we should account for same number of coins but repeated experiments (that's how the envelope shade forms) maybe we shouldn't give the envelope as a given"; "We can build a darker 1sigma. With explanation of course"; "this is a lot of information and concept in a graph. So introduce them slowly."

**v2 design: ideas arrive one at a time.**
1. *Flip one coin.* One dot at 1 or 0. "One coin lands all heads or all tails, so the dot sits at 1 or at 0. The dot marks the share of heads."
2. *Run: 1 to 1,000 coins.* Sweeps ~250 counts spaced evenly on the log axis (about 7 s), one flip and one dot per count; the coin piles show the latest flip. "Each dot is one flip of that many coins." Then: "Few coins: almost anything can happen. Many coins: close to half every time."
3. *Run again* (adds to the cloud). "New flips, same shape. Chance on its own is wild; in bulk it keeps a pattern."
4. After two runs, *Show the expected range*: two shaded bands, dark = 1σ (about 68 of every 100 flips), light = 2σ (about 95), σ = 1/(2√n), with a key in plain words (no "σ" on screen). "The math drew these bands before any coin was flipped. Most dots land in them, and they narrow as coins are added."
- Dots: small, semi-transparent, each at its exact count; repeats overlap and darken. No sideways shifting.
- Reduced motion: a run completes at once.

**Tests** back each band's "about 68 / about 95", the narrowing, the sweep, and "close to half every time".

**Changes to spec v2.1 (for the writing project):** single flips with Add coins → guided sequence with sweeps; envelope given at the start → revealed after repeated runs; two hairlines → two shaded bands (1σ, 2σ). The Pressure Gauge should follow the same template.

**In the book:** numbered, `::: {#wid-lawful-coin}` block with caption.
