# The Lawful Coin (Ch1 §5a) — spec v3 (as built)

**Status:** prototype done, 2026-11-20, approved by Dan for the book ("Let's save this widget… so that we can synthesize it to the book when we do final pass on the texts"). Supersedes spec v2.1 in the writing project's `notes/ch1-widgets.md` ("§5 Twin widgets", §5a). Not merged: Ch1 is still being revised.

**Files:** `prototype.html` (self-contained page; engine inlined), engine `../engines/coins.js`, tests `tests/engines/coins.test.mjs`. To port into a `<ul-lawful-coin>` element at the final pass.

## The point
One coin tells you nothing. Flip more and more coins and the share of heads closes in on one half. The funnel of results comes out of the experiments; the math predicts its shape in advance.

## How it plays (ideas arrive one at a time; nothing moves until the reader clicks)
1. **Flip one coin.** The coin spins above two open-topped boxes, *heads* and *tails*, turns filled (heads) or open (tails), and flies into its box. Then the counts appear under the boxes, then one dot on the chart, at 1 or 0. *"One coin lands all heads or all tails, so the dot sits at 1 or at 0. The dot marks the share of heads. Now add a coin."*
2. **Add a coin and flip** (one click = one more coin, all flipped again, same spin–fly–count–dot sequence). The newest dot gets a ring, a dotted line down to its count, and a label (*"3 coins, 1 head"*). Second click: *"Two coins, one dot: across for how many coins, up for the share of heads. Add another."* Then *"One more coin, one more dot."*
3. The chart starts zoomed to **1–10 coins**; past 10 it widens smoothly to 20, 50, 100, 200, and dots slide to their new places.
4. After five clicks, **Run: 1 to 200 coins** appears beside *Add a coin*: *"You get the idea. Add coins one at a time, or let it run."* Run widens the axis to 200, then continues one coin at a time from where the reader stopped (about 5 s), the boxes showing each flip. End: *"Few coins: almost anything can happen. Many coins: close to half every time. Does the math predict this shape?"*
5. **Show the expected range** appears after the run. Two shaded bands fade in over the dots, each with a thin edge: **inner band = 1σ, "about 68 of every 100 flips"; outer band = 2σ, "about 95 of every 100"**, σ = 1/(2√n), with a key under the chart. *"The shaded bands are what the math predicts, before any coin is flipped: about 68 of every 100 flips land in the inner band, about 95 in the outer one. Both narrow as coins are added."* ("Inner/outer", not "dark/light": in dark mode the inner band shows lighter.)
6. **Run again** adds another sweep: *"New flips, same bands. Chance on its own is wild; in bulk it keeps a pattern."* **Reset** returns to one coin.

## Look
- Model above / left: two open-topped boxes in rule grey; heads filled ink, tails open ink; counts in grey sans under the boxes, hidden until the coins land.
- Chart: **linear** x-axis (Dan: "I want linear scales on the axis"), labels *1 coin*, the midpoint, *N coins*; y labels 0, ½, 1 and *share of heads*; ghost line at ½.
- **One dot style throughout** (Dan: "standardize the size and color and transparency of the dots, esp when axis change"): accent, radius 3 px, 45% opacity, at every zoom and count; repeats overlap and darken. The newest dot is marked only by ring, guide line and label.
- Layout: model left, chart right; phones (≤ 640 px) stacked, chart shorter. Light and dark follow the reader's setting.
- Reduced motion: no spin or fly, runs complete at once, bands appear without fading.

## Dan's decisions on 2026-11-20 (from v1 to v3)
- "Auto run would add 1 coin at a time… that's how we fill up the x-axis."
- "we shouldn't give the envelope as a given" → bands revealed after the run, by the reader.
- "We can build a darker 1sigma. With explanation of course." "Introduce them slowly."
- "I want linear scales on the axis." Maximum 200 coins (Dan considered 500; `#500` or `#1000` in the URL shows those variants).
- "The first few coin flip results should be slower… one action one visual effect" → "Ideally only proceed when users click something."
- "The axis should change if the user have more than 10 coins flipping."
- "The data dot can be light color/semi-transparent from beginning."
- "Add a flipping and flying to its box animation… to show the bins are a way to classify results."
- "show expected range is better" (bands on the reader's click, not automatic).

## Honesty (tests)
Real random flips, fair coins, seeded per page load; no smoothing. Tests: about 95 / 68 of every 100 flips land inside the outer / inner band; bands narrow with more coins; a run adds one coin at a time from 1 to N; at 1,000 coins 99% of flips are within 0.45–0.55.

## For the writing project
§5 prose says "Flip it a hundred times, a thousand": the widget goes to 200 coins on a linear axis. The Pressure Gauge (§5b) should follow this template: step by hand, run, then reveal the predicted band.

## In the book
Numbered: `::: {#wid-lawful-coin}` block with a caption, so Quarto shows "Widget 1.x" in the margin.
