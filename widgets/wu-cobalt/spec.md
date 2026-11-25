# Wu's cobalt (Ch1 §8 "Through the Looking-Glass", Widget 1.7): spec as built

**Status:** built 2026-11-25 (Claude), from Dan's design in chat the same day; rebuilt the same day to the house standard. Posters generated.

**Files:** `wu-cobalt.js` (element), `draw.js` (drawing shared with the poster), `poster.js`. Model: `../engines/cobalt.js`; tests: `tests/engines/cobalt.test.mjs`.

## The point (Dan)
"The widget should just be fun… mostly for the users to experience catching electrons scrambly." No lesson line in the prose.

## What the reader sees and does
- A crystal of 18 cobalt nuclei, each a small ball with a ring round it like Saturn: the back of the ring passes behind the ball, and an arrowhead on the front shows the spin. Warm, they jiggle and tilt every which way.
- **Temperature** slider, log scale, 300 K → 0.003 K. At 0.003 K a 12-second clock starts on the figure ("Quick, we can't stay near absolute zero for long!"). When it runs out, the crystal warms by itself (about 4 s), the nuclei scatter, counting stops, and the reader may cool it again.
- **Magnet** (a switch, filled when on). Cold plus magnet: 11 of the 18 nuclei (about 60%, as in Wu's run) swing round to spin the same way, spin up; the rest stay every which way. Lining up starts only below 0.1 K.
- **Catch electrons.** Electrons fly straight up or down out of the nuclei. Tap one to count it (it turns orange, with a small ring). Keyboard: Enter or Space catches the electron that has flown furthest. **Detector** (a switch; first named "Count for me", renamed so the three buttons fit one row at 360 px) hands the counting to a detector that counts every electron, faster.
- Counts: ↑ at the top of the figure, ↓ at the bottom, where the electrons arrive (Dan: "It's just up or down on the screen"), in the accent: your catches and your tallies are one thing (Dan, 2026-11-25).
- **Slower, with room to catch** (Dan, 2026-11-25: "the electrons fly too fast across a short window. I couldn't possibly capture them manually"). The nuclei sit in a compact block in the middle; open sky above and below. By hand an electron takes 1.4 s to cross the sky (was about 0.3 s); the detector's take 0.35 s. Tap target 36 px.
- **Flying down meter** under the figure (Dan asked for the ratio and the expected range): the share flying down as an orange mark and a percentage on a 0–100% track, with a grey band labelled "fair coin" (50% ± 2 standard deviations) once there are 40 counts: the expected range revealed only after the reader has made the data, as in The Lawful Coin. Inside the band ⇔ the status says "even" (tested). Dan's other idea, the ratio in the caption, was not taken: on phones the caption sits below the buttons, and captions stay one fixed sentence.
- **A count belongs to one setup.** It starts again at the first catch after the setup changes: lined up or not, and each new cold spell. So a verdict never mixes two setups.
- Status line, in order of play: start → warm → cooler → quick → lining → tap → keep / detector → **lean** ("More fly down than a fair coin allows. Nature can tell the two ends apart."). Magnet off while cold: off → **even**. Warm-up: warming.

## Honesty (each sentence rests on a test)
- **Real:** 0.003 K; cold held ~15 min (compressed to 12 s); at most ~60% lined up; more electrons opposite the spin (Wu et al. 1957; SEP figure 2; NIST SP 958). Drawn: spin up, so more fly down.
- **Illustrative:** the size of the lean (a lined-up nucleus sends 75% down; 65% overall), the 0.1 K onset, the time scales.
- **Verdicts:** "more fly down" only when down − up exceeds 2√n with n ≥ 40, in a lined-up run; "even" only when |down − up| ≤ 2√n with n ≥ 40, in a run with the magnet off. Tests: disordered runs read "even" in ≥ 93% of runs; lined up, the detector reaches "more fly down" within 10 s in ≥ 95%. By hand, a cold spell yields about 30 catches, too few for a verdict: the detector is the payoff.

## Behaviour
Starts moving on view; under reduced motion it waits for the reader's first move. Canvas is a tab stop (Enter catches). Counts read to screen readers every 3 s. Fits one phone screen (about 640 px tall at 360–390 px).

## Dropped designs
Real or Mirror? (1.8a) cut by Ryan ("Not needed"). The curled right hand and Mirror switch (1.8b v1) dropped: confused lay readers (Dan). "Seen from above / below" and "top / bottom" labels dropped (Dan). Magnet on/off label swap replaced by a switch (house rule). A vertical up/down gauge at the figure's right edge (tried 2026-11-25): no room for words beside it, so it became the labelled meter row. "Count for me" became "Detector": the row overflowed at 360 px.
