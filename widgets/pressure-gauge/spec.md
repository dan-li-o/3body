# The Pressure Gauge (Ch1 §5b) — prototype notes (2026-11-20)

**Status:** prototype, in progress with Dan. Supersedes spec v2.1 (§5b) in the writing project's `notes/ch1-widgets.md`. Not merged.

**Files:** `prototype.html` (engine inlined), engine `../engines/gas.js`, tests `tests/engines/gas.test.mjs`, calibration `tools/calibrate-gas.mjs`.

## The point
One molecule knocks the piston about; thousands press on it steadily. That steady push is pressure: the law of large numbers inside physics. "The knocks become a hum" (Dan: "a very good phrase").

## Idealization (chosen from the message)
- Molecules: a 2D ideal gas (points that don't collide with each other), Maxwell–Boltzmann speeds.
- Left wall at one temperature (molecules leave with a fresh thermal velocity, Lambert's law).
- Piston: heavy, on a stiff damped spring; the chamber keeps its size (so the push per molecule doesn't drift: one point per widget).
- Up to 10,000 molecules. The 400 drawn are simulated one by one; the rest by a compound-Poisson model of independent hits (tested against full simulation). Dan: "follow a simpler model (like drawing from a statistical distribution rather than do the physics)".
- Push per molecule matches the ideal-gas law (σ²/L) in the tests.

## What the reader sees and does
- Piston (accent), pointer (on the chart's value axis) and pen (dot at the head of the line) all show the **push per molecule** over the last quarter-second, and all three sit on **one shared axis**:
  - wide screens: the push runs upward; chamber (slim, 30% width) beside the chart; the piston's height is the chart's height for that push;
  - phones: the whole thing turns 90°: the push runs left to right; the piston slides sideways above the chart, and the line grows downward.
- The piston's motion is drawn to show the reading (the real piston barely moves); the caption must say so.
- *Add a molecule* (by hand), then *Run: up to 10,000 molecules* (≈22 s, paced by the clock), then *Show the expected range* (inner 16–84%, outer 2.5–97.5%, from simulation). *Run again* keeps earlier lines faint.
- Status lines name **pressure**: "…the knocks become a hum. That hum is pressure."

## Fixed on 2026-11-20
- Run crawled on slow phones (paced by simulation time) → paced by the clock.
- Reading 5% low during runs (the dial divided by the current count while the count grew) → divide by the count averaged the same way.

## To do
- **Test for the dial lag** (Dan: "Yes mark a test for dial lag for future"): a growing count must not bias the dial; move the averaging into the engine and test it.
- Caption for the book (numbered `::: {#wid-pressure-gauge}`): "A gas chamber. The dots are molecules; the top wall is a piston on a spring. Piston, pointer and pen show the push per molecule; the piston's motion is exaggerated."
- Coin to be rebuilt as a matching scale with a pointer and a continuous line (Dan's idea: "weigh the bins of heads or tails on two sides of the scale and have a pointer… continuity").
