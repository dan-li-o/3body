# Wu's cobalt (Ch1 §8 "Through the Looking-Glass", Widget 1.7): spec as built

**Status:** built 2026-11-25 (Claude), from Dan's design in chat the same day; rebuilt the same day to the house standard. Posters generated.

**Files:** `wu-cobalt.js` (element), `draw.js` (drawing shared with the poster), `poster.js`. Model: `../engines/cobalt.js`; tests: `tests/engines/cobalt.test.mjs`.

## The point (Dan)
"The widget should just be fun… mostly for the users to experience catching electrons scrambly." No lesson line in the prose.

## What the reader sees and does
- A crystal of 18 cobalt nuclei, each a small ball with a ring round it like Saturn: the back of the ring passes behind the ball, and an arrowhead on the front shows the spin. Warm, they jiggle and tilt every which way.
- **Temperature** slider, log scale, 300 K → 0.003 K. At 0.003 K a 12-second clock starts on the figure ("Quick, we can't stay near absolute zero for long!"). When it runs out, the crystal warms by itself (about 4 s), the nuclei scatter, counting stops, and the reader may cool it again.
- **Magnet** (a switch, filled when on). Cold plus magnet: 11 of the 18 nuclei (about 60%, as in Wu's run) swing round to spin the same way, spin up; the rest stay every which way. Lining up starts only below 0.1 K.
- **Catch electrons.** Electrons fly straight up or down out of the nuclei. Tap one to count it (it turns orange, with a small ring). Keyboard: Enter or Space catches the electron that has flown furthest. **Count for me** (a switch) hands over to a detector that counts every electron, faster.
- Counts: ↑ at the top of the figure, ↓ at the bottom, where the electrons arrive (Dan: "It's just up or down on the screen").
- **A count belongs to one setup.** It starts again at the first catch after the setup changes: lined up or not, and each new cold spell. So a verdict never mixes two setups.
- Status line, in order of play: start → warm → cooler → quick → lining → tap → keep / detector → **lean** ("More fly down than up. Nature can tell the two ends apart."). Magnet off while cold: off → **even**. Warm-up: warming.

## Honesty (each sentence rests on a test)
- **Real:** 0.003 K; cold held ~15 min (compressed to 12 s); at most ~60% lined up; more electrons opposite the spin (Wu et al. 1957; SEP figure 2; NIST SP 958). Drawn: spin up, so more fly down.
- **Illustrative:** the size of the lean (a lined-up nucleus sends 75% down; 65% overall), the 0.1 K onset, the time scales.
- **Verdicts:** "more fly down" only when down − up exceeds 2√n with n ≥ 40, in a lined-up run; "even" only when |down − up| ≤ 2√n with n ≥ 40, in a run with the magnet off. Tests: disordered runs read "even" in ≥ 93% of runs; lined up, the detector reaches "more fly down" within 10 s in ≥ 95%. By hand, a cold spell yields about 30 catches, too few for a verdict: the detector is the payoff.

## Behaviour
Starts moving on view; under reduced motion it waits for the reader's first move. Canvas is a tab stop (Enter catches). Counts read to screen readers every 3 s. Fits one phone screen (about 490 px tall at 390 px).

## Dropped designs
Real or Mirror? (1.8a) cut by Ryan ("Not needed"). The curled right hand and Mirror switch (1.8b v1) dropped: confused lay readers (Dan). "Seen from above / below" and "top / bottom" labels dropped (Dan). Magnet on/off label swap replaced by a switch (house rule).
