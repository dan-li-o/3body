# The Groove (Ch1 §1.5 "Three Names, One Bet", Widget 1.5): spec as built

**Status:** built 2026-11-23. `<ul-groove>` on the shared core. From Ryan's hand-off spec v6 (2026-11-23, writing project `notes/ch1-widget-1.6b.md`; drafting label "1.6b"), with one change chosen by Dan the same day: **the groove itself bends** (v6 had a dip in its floor), so the picture shows plainly that the groove is no longer a perfect circle. Ryan's dip version is kept as a test page in the widgets project.

**Files:** `groove.js` (element), `draw.js` (shared with the poster), `poster.js`, posters. Engine: `../engines/groove.js`; tests: `tests/engines/groove.test.mjs`.

## The point
Rotational symmetry and the conservation of angular momentum are one idea seen twice. In a round groove the marble sweeps equal slices in equal times (a steady pace around), however the groove is turned. Bend it: the groove is no longer a perfect circle, and out on the bend the marble goes around more slowly. Make it round: equal slices again.

## What the reader sees and does
- Groove seen from above (two grey lines), a dashed perfect circle along it, the marble (ink), slim slices of pie cut every 0.13 s that fade in 0.9 s; only the crust of the slice being swept is orange.
- **Flick:** drag the marble along the groove (longer drag, faster; 0.30–0.45 laps/s), or the Flick button. **Turn:** drag anywhere else (readout "groove turned 43°"; a first-time "drag to turn" hint). **Bend:** tap; tap the bend again or **Make it round**.
- Keys: Enter flicks, arrows turn the groove, B bends it opposite the marble. A screen reader hears the last few slice angles.

## Physics (simulated, never scripted)
Bead on a level, frictionless groove r(θ) = 1 + 0.2·g(θ − A). Speed never changes (energy kept exactly); pace θ' = v/√(r² + r'²); angular momentum r²θ' is kept only while the groove is round. A bend is made or smoothed only while the marble is on the far side. Simplification: turning a bent groove while the marble is on the bend moves the marble with the groove at unchanged speed (a real groove would push it).
