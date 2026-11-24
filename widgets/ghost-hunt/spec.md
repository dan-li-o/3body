# The ghost hunt (Ch1 §7 "The Ghost Particle", Widget 1.6): spec as built

**Status:** built 2026-11-24. `<ul-ghost-hunt>` on the shared core. From the widgets-project test page (2026-11-23/24); layout approved by Dan ("The timeline looks fine"), phone fold at Dan's request ("make it more compact or hide it unless user click to expand"). Placed beside the sentence it supports: "for twenty-six years, no one could see the thief."

**Files:** `ghost-hunt.js` (element), `model.js` (events, dates, the gap; shared with the tests and poster), `ghost-hunt.css`, `poster.js`, posters, `photos/`. Tests: `tests/widgets/ghost-hunt.test.mjs` (the gap is 26 years; events in order; each shown date covers the drawn year; nothing drawn in the empty stretch).

## The point
The conservation law was saved by a bet, not a measurement. Drawn to scale, the twenty-six years between Pauli's letter (1930) and the detection (1956) are most of the line, with nothing on them.

## What the reader sees and does
- **Wide (widget ≥ 560 px):** axis 1910–1960; dots with names for the puzzle (Chadwick, Ellis & Wooster, Bohr, Pauli, Fermi); the orange band "Twenty-six years: no one sees it"; the hunt as a row of cards above, tied to their dates by leader lines. Tap a date (or Tab + Enter) to read it in the card below. Tap a photo card to open the viewer.
- **Folded (phones):** one strip (1914 puzzle, 1930 Pauli, 1956 caught, the band) and a **Whole story** button that opens the story as a list, roughly to scale (crowded years spread out).
- **Photo viewer:** full screen; swipe or Earlier/Later (arrow keys) in date order; tap to zoom; Close or Esc returns focus.

## Sources (checked 2026-11-24)
- Chadwick 1914; Ellis & Wooster 1927 (radium E, calorimeter): neutrino-history.in2p3.fr ("Prehistory"); A. Franklin, neutrino history conference, Paris 2018 (apc.u-paris.fr).
- Bohr, energy conserved only on average, 1929–30 (Faraday Lecture, 8 May 1930): Stuewer's notes (Springer, *Science Networks* 24); arXiv hep-ph/0010098. To verify in Jensen 2000 (TODO in the chapter).
- Pauli's letter, 4 December 1930, Tübingen, "neutron," "desperate remedy": CERN Pauli Archive; Symmetry magazine, March 2007.
- Fermi's theory 1933–34 and the name: arXiv 1402.5382; CERN archive pages.
- Project Poltergeist; Herr Auge (components tested 1952; lid reads "Entombed March 12, 1953"); Hanford 1953, "probable" identification; Savannah River 1955; *Science*, 20 July 1956: LANL, "The neutrino turns 70" (lanl.gov/media/news/0902-neutrino-turns-70); Wikipedia, "Cowan–Reines neutrino experiment"; APS Historic Sites, Savannah River.

## Photos and licence
- `poltergeist.jpg`: Cowan (far left), Reines (far right) and the Project Poltergeist team. Source: LANL, cdn.lanl.gov/a6ab8cc7-7466-4a7f-8781-12e222e2abc4.jpg (on "The neutrino turns 70").
- `herr-auge.jpg`: the prototype detector "Herr Auge." Source: LANL, cdn.lanl.gov/418da5c2-54af-460d-a752-1c14772ccdf2.jpg (same page).
- Both converted to greyscale, resized to 1400 px, and cut to 360 px thumbnails.
- **Licence:** LANL's public-use notice (lanl.gov/misc/copyright.html, "For All Information"), reproduced word for word in the §7 margin note (pasted by Dan, 2026-11-24). Not covered by the book's CC BY-NC licence; credited under each photo too.
- **Wanted:** Reines and Cowan at the controls, Savannah River, 1956 (Wikimedia Commons, `File:Clyde_Cowan.jpg`, LANL). Not added yet: Wikimedia's image host was unreachable from the build session. The "Caught" card shows text until then.

## Decisions
- A widget (numbered, poster, gallery) rather than a plain figure, so it follows the house standard and folds on phones.
- No status line: the card under the plate does that job, and keeps its height so nothing jumps.
- Photos only where the licence is clear; the CERN-held Pauli letter is linked, not shown.
