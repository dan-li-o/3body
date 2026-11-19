# Tame the Trisolaran sky

**Where:** Welcome page, between "Inside" and "Throughout the book…". Unnumbered (the Welcome page is not a chapter).
**Concept:** Ryan, 2026-11-18. Decisions: Dan, 2026-11-18/19 (recorded in the project's `book/drafts/welcome.md`).

## The point
The reader tries to impose order on three bodies and fails. A law is something *we* try to make the world keep; the three-body system won't keep it. Order exists, but it is rare and finely balanced. Previews Ch5 (Poincaré, chaos) and echoes the novel's stable and chaotic eras.

## What the reader sees and does
- Invitation above: *"Two suns circle each other. Place a third and give it a push. Can you make the system repeat itself?"*
- Two equal suns circling calmly, in ink on the page (no panel), with grey trails that fade like contrails.
- One gesture: press to place a third sun (drawn in the accent colour), drag to aim, release to launch.
- Buttons: **Show me one that works**, **Reset**; quiet links: **Try a random placement** (keyboard: Enter on the figure), **Nudge** (after one figure-eight loop), **Play** (only when reduced motion paused it).
- Closing line after the first attempt: *"Scientists have been trying since Newton."*

## Status line
| When | Says |
|---|---|
| Calm pair | Two suns, one steady orbit. Touch the sky and drag to launch a third. |
| Aiming | Release to let it go. |
| After launch, by time | Repeating? Not yet. → Drifting. → Chaotic era. |
| Suns touch (they bounce) | Two suns bounced off each other. |
| Close pass, no touch | A near collision. |
| A sun is far and fast (naive rule) | That sun looks gone for good. |
| …and then comes back | …Or not. |
| A sun has truly escaped (strict rule) | One sun has been thrown out of the system. It will never come back. |
| Figure-eight | This one repeats. Solutions like it are rare. |
| After Nudge | Nudged by a hair. It wobbles and slowly turns, but holds. A slightly bigger push would break it. |

Passing remarks (bounce, near miss) appear at most once every 6 s of sim time, so the line never flickers.

## Physics (all claims tested in `tests/engines/nbody.test.mjs`)
- Engine `widgets/engines/nbody.js`: G = 1, equal masses, velocity Verlet; softening 0.01 in free play, none for the calm pair and the figure-eight.
- Figure-eight: initial conditions by Simó, in Chenciner & Montgomery (2000). Repeats; KAM-stable (Simó).
- Nudge of 0.01 holds for 200 loops; 0.05 breaks it.
- "Never come back": no sun flagged by the strict rule returned in testing.
- Touching suns bounce elastically (Dan: "Default is bounce"). Merge exists in the engine but is not offered.

## Practical
- Fits one phone screen; square on phones, 16:9 on wide screens.
- Pauses off-screen and in hidden tabs; starts paused under reduced motion.
- Poster: `poster.js` (generated `poster-light.png`, `poster-dark.png`).
- Known: on phones, a finger on the figure places a sun instead of scrolling the page.
