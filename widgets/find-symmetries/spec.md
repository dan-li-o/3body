# Find the Symmetries (Ch1 §1.5 "Three Names, One Bet", Widget 1.4): spec as built

**Status:** built 2026-11-23. `<ul-find-symmetries>` on the shared core. From Ryan's redesign log (2026-11-21, writing project `notes/ch1-widget-1.6a.md`; drafting label "1.6a") and the test page prototype 2 (widgets project).

**Files:** `find-symmetries.js` (element), `model.js` (shapes, the fit rule; shared with the tests), `draw.js` (figure, ghost outline, ring, compare view; shared with the poster), `find-symmetries.css`, `poster.js`, posters. Tests: `tests/widgets/find-symmetries.test.mjs` (the drawn shapes really have 2 / 6 / endless symmetries; moves count by result).

## The point
A symmetry is a move that leaves a shape looking as it did. Most shapes allow only jumps (a flower in a pot: 2; an equilateral triangle: 6). The circle allows every turn: its symmetry is continuous, the kind physics cares about.

## What the reader sees and does
- One shape per round: flower in a pot → triangle → circle. A dashed outline shows where it started; small grey numbers ride on the shape so different results look different.
- Drag around the shape to turn it; **Flip** flips it across the vertical; letting go checks the fit (within 9°: it snaps and outlines in orange).
- A ring records results: outer ring = turned, inner ring = flipped, a tick per result; orange dot = where the shape is now.
- Tally "found n of 2 / 6 / ?"; "as it is" is found at the start. The circle's tally turns to "of ∞" after four new finds and its ring fills.
- A strip of results found, labelled ("turn 120°", "flip + 240°").
- **Compare →** at the end: three rings side by side, "in jumps" vs "continuous".
- Keys: arrows turn (Shift: 1°), F flips.

## Decisions
- Counted by result, not by path (Ryan's 720° question): a duplicate says it lands every point just as an earlier result does. Provisional until verify rows #126/#127 are checked.
- Tracking numbers on the shapes; "as it is" logged at the start (provisional, from Claude's proposal, adopted for publishing 2026-11-23).
- House rules (README): status ≤80 characters, ≤3 buttons, one row at 360 px; fits one phone screen (≈820 px with caption at 390 px wide).
