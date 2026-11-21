# Try to Break the Law (Ch1 §4, Widget 1.1): spec as built

**Status:** built, 2026-11-21. `<ul-break-the-law>` on the shared core. Supersedes spec v3 (the prototype, 2026-11-20) and spec v2.1 in the writing project's `notes/ch1-widgets.md`; the design history is in `widgets/ch1-widgets-handoff.md` (widgets project).

**Files:** `break-the-law.js` (the element), `model.js` (where the warmth went, from the engine's events; shared with the poster), `draw.js` (table, trail, felt track, dents, energy column; shared with the poster), `poster.js`, posters. Engine: `../engines/pool-table.js`; tests: `tests/engines/pool-table.test.mjs`.

## The point
Energy changes form; the total stays the same. Only a push from outside changes it. First the ideal world (the law with nothing in the way, Galileo's move), then the real one (felt and soft cushions), where energy seems to vanish but the books still balance.

## What the reader sees
- Invitation: *Push the ball. Push it hard, or gently.*
- **One ball** (ink) on a table drawn as four grey cushion lines, no panel. A fading grey trail, as on the Welcome page.
- **Energy column.** Wide stages (12 : 5): vertical, right of the table, labels to its left. Phone stages (4 : 3): a bar under the table, labelled in one row below with thin leader lines. Three parts: **motion** (ink), **felt** and **cushions** (ghost, separated by paper gaps); one **accent** mark: *total*. The scale fits the hardest push, so a harder push shows a higher total.
- **Felt** leaves a faint, permanent track until Reset; overlapping passes darken (friction takes the same energy per distance).
- **Soft cushions** dent where the ball hit, deeper for more energy lost; nearby hits deepen the same dent.

## What the reader does
1. **Push.** Press on the ball, drag the way it should go, let go; the drag length sets the strength (capped). While dragging, a faint arrow and a dashed accent mark on the column preview the new total. A tap is a gentle nudge away from the finger. Pressing off the ball: *Press on the ball itself.*
2. **Felt** and **Soft cushions**: toggles (`aria-pressed`).
3. **Push at random** (the keyboard and screen-reader route), **Reset**, **Play** (reduced motion only).

## Status lines
In `static strings` of `break-the-law.js`. Standing: start, aim, ideal, felt, cush, both, still. Remarks (4 s): up and down after a later push changes the total; miss.

## Behaviour
Animates only while the ball moves or its trail fades, then pauses (and off screen or in a hidden tab, as every widget). On the ideal table the ball never stops, as the status line says. Reduced motion: a push waits for Play. Screen readers: the status line is announced; the canvas label states motion, felt, cushions and total.

## Honesty
The engine conserves the total to about 1e-14 (tests): kinetic + warmth = energy pushed in from outside. The felt track and the dents are drawn from the engine's own felt and cushion events, so what you see lost is what was lost. Checked in the rendered chapter: after a push with felt and cushions on, total = energy pushed in.

## In the book
`::: {#wid-break-the-law}` in Ch1 §4 (numbered Widget 1.1), with the caption from the pinned draft; the Galileo margin note beside it points to Ch4.
