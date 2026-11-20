# Try to Break the Law (Ch1 §4) — spec v3

**Status:** prototype, 2026-11-20. Supersedes spec v2.1 (2026-11-19) in `notes/ch1-widgets.md` of the writing project. Not merged: Ch1 is still being revised.

**Files:** `prototype.html` (self-contained test page; engine inlined), engine `../engines/pool-table.js`, tests `tests/engines/pool-table.test.mjs`. To port into a `<ul-break-the-law>` element once Ch1 settles.

## Why v3 (Dan, 2026-11-20)
v2.1's first build (five balls, slingshot) "works very well" as animation but "there's something odd": too many things at once, and it didn't drive home energy conservation. Dan: "Definitely want to start from the simplest setup." The slingshot was also unclear: "a naive player might really hit the ball (tap the screen)."

## The point
Energy changes form; the total stays the same. Only a push from outside changes it. First the ideal world (the law with nothing in the way, Galileo's move), then the real one (felt and soft cushions), where energy seems to vanish but the books still balance.

## What the reader sees
- Invitation: *"Push the ball. Push it hard, or gently."*
- **One ball** (ink dot) on a table drawn as four grey cushion lines, no panel. Fading grey trail, as on the Welcome page.
- **Energy column** (desktop/tablet: vertical, right of the table; phone < 560 px: horizontal bar under a full-width sideways table). Three parts: **motion** (ink), **felt** and **cushions** (ghost grey, separated by paper gaps); one **accent** mark: *total*.
- Phone labels sit in one row under the bar, spread apart, with thin leader lines to their parts, so motion, felt and cushions are always labelled (Dan, 2026-11-20: "Let's do off to side then"; "We want felt and motion to be labeled").
- Fixed scale sized for the hardest push, so a harder push visibly gives a higher total.

## What the reader does
1. **Push.** Press on the ball, drag the way it should go, let go; drag length = strength (capped). While dragging, a faint arrow and a dashed accent mark on the column preview the new total (Dan: "Total energy changes height as users push harder or less hard"). A tap is a gentle nudge away from the finger. Pressing off the ball: *"Press on the ball itself."*
2. **Felt** (toggle). The ball slows; it leaves a faint, **permanent** grey track until Reset; overlapping passes darken (friction takes the same energy per distance) (Dan: "Actual faint mark (but not fading)").
3. **Soft cushions** (toggle). Each bounce **dents** the cushion line where it hit; deeper for more energy lost; repeat hits deepen the same dent (Dan: "Visible dent").
4. **Reset**, **Push at random** (keyboard/screen-reader route), Play (reduced motion).

## Status line
| When | Says |
|---|---|
| Start | Press on the ball and drag the way you want it to go. The longer the drag, the harder the push. |
| Aiming | Let go to push. |
| Ideal table, moving | No table is this smooth. But this is the law with nothing in the way: the ball keeps going forever. |
| Felt on | The ball warms the felt as it rolls; the faint track is energy the ball has lost. Total unchanged. |
| Soft cushions on | Each bounce dents a soft cushion; the dent is energy the ball has lost. Total unchanged. |
| Both | Felt and cushions are taking the motion as warmth. Total unchanged. |
| Stopped | The ball has stopped. Its energy is all in the felt and the cushions now. Total unchanged. |
| Second push, total up | That push came from outside the table, and it added energy. The total went up. |
| Second push, total down | That push came from outside the table, and it took energy away. The total went down. |

## Cut from v2.1
Five balls, ball-to-ball transfer, slingshot strike, tally (*Attempts · Law broken*), Add a ball, lively/dead and smooth/rough labels. Collisions between balls could return later as a third stage.

## Honesty
The engine conserves total energy to ~1e-14 (tests). Warmth is the energy actually lost in each roll step and bounce; the felt track and dents are drawn from those same events.

## Prose that goes with it (for the writing project)
Margin note beside the widget (Dan, 2026-11-20: Galileo "either to the main text or the margin"; points to **Ch4**):
> The ideal table, where nothing slows the ball, is Galileo's trick. He imagined a ball on a perfectly smooth, level plane and argued it would roll on forever. No such plane exists. But strip away the friction in your mind and the law shows itself; add the friction back and it is still there, hidden in the warmth. Idealization is not a lie about the world. It is how physics sees through the clutter. More in Chapter 4.^[Galileo, *Two New Sciences* (1638); also the *Dialogue* (1632). TODO: verify passage and day.]

Optional main-text line before "Physics keeps its books this way": *Start with the ideal table, then add the real one: the felt, the soft cushions. The ball slows, but nothing is lost.*

## In the book
Numbered (Dan, 2026-11-20: "remember to number the widget when put in the book"): wrap the shortcode in a `::: {#wid-break-the-law}` block with a caption, so Quarto shows "Widget 1.x" in the margin. Same for every Ch1 widget.

## Open
- Dent depth and the gentle-push size, after Dan tries it on her phone.
- Margin notes fold inline below ~992 px in Quarto (upright tablets): notes must read well mid-text.
