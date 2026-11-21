# The Pressure Gauge (Ch1 §5, Widget 1.3): spec as built

**Status:** built, 2026-11-21. `<ul-pressure-gauge>` on the shared core and `../core/strip.js` (the same grammar as The Lawful Coin). Supersedes spec v2.1 in the writing project's `notes/ch1-widgets.md`; design history in the widgets project's `widgets/ch1-widgets-handoff.md`.

**Files:** `pressure-gauge.js` (the element), `draw.js` (the chamber, shared with the poster), `poster.js`, posters. Engine: `../engines/gas.js`; tests: `tests/engines/gas.test.mjs`; calibration: `tools/calibrate-gas.mjs`.

## The point
One molecule knocks the piston about; thousands press on it steadily. That steady push is pressure: the law of large numbers inside physics. "The knocks become a hum."

## Model (idealization chosen from the message)
- A two-dimensional ideal gas: point molecules that never meet; Maxwell–Boltzmann speeds; a left wall at one temperature (Lambert's law); a heavy piston on a stiff, damped spring, so the box keeps its size.
- Up to 10,000 molecules. The 400 drawn are simulated one by one; the rest are added by a compound-Poisson model of independent hits (tested against a full simulation).
- The push per molecule matches the ideal-gas law, σ²/L (tested).

## What the reader sees
- **Instrument (top):** the box, its open end at the scale's zero; the accent piston slides in a short sleeve beyond it, held by a spring. The molecules fill the box up to the piston. The piston's position is the reading (push per molecule over the last quarter-second); its drawn motion has a little inertia (jolt, ring, settle) and is exaggerated: the real piston barely moves.
- **Record (below), on the same scale:** push per molecule left to right (marks *0* and *avg*), molecules downward. Pointer on the top edge, pen at the live reading. Count axis 10 → 100 → 1,000 → 10,000.
- **Expected range (on request):** inner band 16–84%, outer 2.5–97.5% of readings, from long simulations at each count (`CALIB`), never from the reader's run.

## What the reader does
*Add a molecule* (three times, then *Run: up to 10,000 molecules*, about 22 s), *Show the expected range*, *Run again*, *Reset*.

## Behaviour
The gas moves while it is on screen and the tab is visible. Reduced motion: no animation (a *Play* button appears); adding a molecule advances two seconds at once; a run completes at once. Keyboard: all actions are buttons. Screen readers: status line; the chart's label gives the count, the reading and the average.

## In the book
`::: {#wid-pressure-gauge}` in Ch1 §5, caption from the pinned draft, plus the margin note on the widget's honesty (exaggerated piston; 400 drawn; the shortcut).
