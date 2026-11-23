# Widgets for *Unlawful Laws*

Interactive figures for the book. Plain JavaScript (ES modules), no build step,
no runtime dependencies. Plans and decisions live in the widgets project
(`widgets/guideline.md`, `widgets/design.md`); this file is the working manual.

## Layout

```
widgets/
  core/          shared by every widget
    core.js        ULWidget base class + small helpers (el, svg, rng, colors)
    controls.js    button, slider, row, StatusLine
    stage.js       HiDPI canvas with reserved space (no layout shift)
    tokens.css     design tokens + house styles (colours, line, ball, trail)
    tuner.js       live design dials (gallery only)
    strip.js       the strip chart shared by Ch1 §5 (instrument on top, record below, one scale)
  engines/       pure math: no DOM, no drawing, unit-tested
    nbody.js       gravity, bounce, merge, escape tests, figure-eight
    pendulum.js    Ch3 pendulums
    pool-table.js  one ball on a table: felt, cushions, exact energy books
    coins.js       fair coins, the bands (1σ, 2σ), the law of the lever
    gas.js         2D ideal gas, piston on a spring, statistical shortcut, the dial, calibrated bands
  <name>/        one folder per widget
    <name>.js      the custom element <ul-name>
    <name>.css     widget-only styles (rare; prefer tokens)
    draw.js        drawing shared by the widget and its poster (if canvas)
    poster.js      draws the still image; poster-light.png / poster-dark.png
    spec.md        what the reader does, sees, and the point
  gallery/       every widget outside the book; poster renderer
_extensions/widget/   the Quarto shortcode
tests/engines/        engine unit tests (node --test)
tools/                posters.mjs, smoke.mjs (headless browser)
```

## Using a widget in the book

Numbered (chapters), caption in the margin:

```markdown
::: {#wid-coin-flip}
{{< widget coin-flip p=0.5 alt="What the poster shows, in words." >}}
Caption text.
:::
```

Refer to it as `@wid-coin-flip` ("Widget 1.2"). Leave the `:::` block out for
an unnumbered widget, as on the Welcome page. The shortcode puts the poster
inside the tag (shown until the widget starts, and if it fails) and loads the
script once per page. PDF/EPUB get the poster and a link to the live book.

## Adding a widget

1. Write `widgets/<name>/spec.md` from the chapter's `::: {.widget-idea}` block.
2. Put any physics or maths in `widgets/engines/`, with a test in
   `tests/engines/` for **every claim the widget's words make**.
3. Write `<name>.js`: `class X extends ULWidget`, fill in the hooks, and
   `define('ul-<name>', X)`. Strings go in `static strings = { en: {...} }`.
4. Write `poster.js` (`size`, `drawPoster(ctx, colors)`), then `npm run posters <name>`.
5. Add it to `gallery/index.html`, run `npm test` and `npm run smoke`, and check
   the screenshots in `tests/screens/`.

The hooks (all optional): `mount()` build once on first view · `frame(dt)`
advance and draw · `resize(width)` · `retune()` theme or tokens changed ·
`stateChanged()` play/pause changed. Call `this.autoplay()` to start moving
(it stays paused under reduced motion).

## The standard (every widget, before it ships)

Set by *Tame the Trisolaran sky* (Welcome page), 2026-11-19.

**Look** — ink on paper, no panel or box; grey for context; one accent for the
thing the reader must notice (often "yours"); trails and ghosts fade rather
than cut off; colours and weights only from `tokens.css`; controls quiet but
real, 44 px touch areas, visible focus.

**Words** — one invitation line above; a status line that narrates in plain
words (`StatusLine`: standing state + passing remarks, never flickering);
one closing line. Dry wit is welcome where it makes the argument.

**Fits one screen** (Dan, 2026-11-23) — invitation, figure, status line and
buttons fit one phone screen (about 700 px tall at 390 px wide); the caption
may fall just below.
- Status messages: at most **80 characters** (two lines on a phone). List
  their keys in `static status`; the line keeps the height of the longest, so
  nothing below it moves. Anything longer goes into the caption or the prose.
- Buttons: at most **three on show at once**, in **one row** at 360 px, labels
  of at most **14 characters** (keys in `static buttons`). A button keeps one
  width: give `button()` every label it may show (`labels`) and change it with
  `b.label`. Switches fill with ink when on. Reset, Play and other side
  actions are quiet and sit at the right.
- Caption: the widget's **name in bold**, then one sentence; at most
  **160 characters** in all. Every widget has a name, numbered or not, so it
  can be shared.
- `npm test` checks the status and label limits (`tests/widgets/strings.test.mjs`).

**Honest** — our own engines, checked against published values; a test for
each sentence the widget says. If the physics doesn't support a sentence,
change the sentence, and flag it to the writing project.

**Behaviour** — mounts lazily; zero cost off-screen or in a hidden tab;
respects reduced motion; keyboard alternative to any drag; screen-reader
status; works with one thumb on a phone and fits one screen; many instances
per page (no global IDs).

**Checked** — `npm test` and `npm run smoke` pass; gallery screenshots
reviewed in light and dark, phone and desktop; poster generated.

## Commands

```
npm test              engine unit tests (no install needed; runs in CI)
npm run posters       regenerate posters (needs playwright-core: npm install)
npm run smoke         browser smoke test + screenshots (same)
```

The tools use a headless Chromium. Run `npx playwright-core install chromium`
once, or set `CHROME=/path/to/chrome`.
