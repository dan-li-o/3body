# The Lawful Coin (Ch1 §5, Widget 1.2): spec as built

**Status:** built, 2026-11-21. `<ul-lawful-coin>` on the shared core. Supersedes spec v2.1 in the writing project's `notes/ch1-widgets.md`; the design history is in `widgets/ch1-widgets-handoff.md` (widgets project).

**Files:** `lawful-coin.js` (the element), `draw.js` (the balance, shared with the poster), `poster.js`, posters. Shared: `../core/strip.js` (the record below the instrument, also used by The Pressure Gauge). Engine: `../engines/coins.js`; tests: `tests/engines/coins.test.mjs`.

## The point
One coin tells you nothing. Flip more and more coins and the share of heads closes in on one half. The funnel comes out of the flips; the math predicts its shape in advance.

## What the reader sees
- **Instrument (top):** a beam with *tails* on its left end (0) and *heads* on its right end (1). Coins (ghost grey) stack on the pans; above 60 coins, each pan shows a stack in proportion to its count. An accent **fulcrum** slides on a scale marked 0, ½, 1 to where the beam balances: by the law of the lever, the share of heads (`balancePoint`, tested). While it slides, the beam rocks toward the heavier side (bounded, never into the scale). Dan: like balancing a ruler with coins at both ends on your finger.
- **Record (below), on the same horizontal scale:** share of heads left to right, number of coins downward. The pointer sits on the top edge under the fulcrum; the pen at the head of the line. The count axis grows 10 → 100 → 1,000 → 10,000. Ghost line at ½.
- **Expected range (on request):** inner band 1σ, "about 68 of every 100 flips"; outer band 2σ, "about 95" (σ = 1/(2√n); never named σ on screen), with a key.

## What the reader does
1. *Flip one coin*: it spins above the beam, drops into its pan, the fulcrum slides to 0 or 1.
2. *Add a coin and flip* (one more coin, all flipped again). After five, *Run: up to 10,000 coins* appears (about 20 s, one fresh flip per new count).
3. *Show the expected range* after a run. *Run again* adds a faint earlier line. *Reset*.

## Status lines
In `static strings` of `lawful-coin.js`: start, one (ruler on a finger), two (how to read the record), more, ready, running, run1, runN, band.

## Behaviour
Animates only while something moves (a flip, the fulcrum settling, a run, the bands fading in), then pauses. Reduced motion: no spin, runs complete at once. Keyboard: all actions are buttons. Screen readers: status line announced; the chart's label states the count and the latest share.

## In the book
`::: {#wid-lawful-coin}` in Ch1 §5, with the caption from the pinned draft.
