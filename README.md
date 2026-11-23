# Unlawful Laws — A Philosopher’s Footnotes to *The Three-Body Problem*

A digital book blending philosophy of science, interactive simulations, and literary imagination, inspired by Liu Cixin’s *The Three-Body Problem*.  
Written for curious readers, science enthusiasts, and anyone interested in how knowledge breaks — and sometimes rebuilds — under chaos.

---

## 📖 Read Online

👉 [dan-li-o.github.io/3body](https://dan-li-o.github.io/3body/)

---

## 🧠 What’s This Book About?

Science once promised order, law, and prediction. But what happens when those promises collapse?

Guided by *The Three-Body Problem* and grounded in philosophy of science, this book journeys through:

- Epistemic breakdowns (e.g., replication crisis, induction failures)
- Chaotic systems and unpredictable futures
- Fragility and antifragility of scientific models
- Strategies for living with radical uncertainty

Each chapter includes interactive elements — from coin flips with drifting probabilities to chaotic orbits and AI classifier demos — to explore how science works when predictability fails.

---

## 🧭 Book Overview

The book is structured into three parts:

### Part I — When Laws Fail
- The illusion of stable laws
- Hume’s induction problem
- Machine learning’s unresolved models

### Part II — Modeling the Unlawful
- Astronomy and Trisolaran chaos
- Simulation vs. explanation
- Chaos, computation, and climate

### Part III — Living Beyond Law
- Fragility and antifragility
- Feyerabend and epistemic pluralism
- Strategies to live with radical uncertainty

📚 Read full chapter outline → [`index.qmd`](index.qmd)

---

## 🎮 Interactive Features

Built so far (each has a spec, a poster and engine tests; see [`widgets/README.md`](widgets/README.md)):

- 🪐 *Tame the Trisolaran sky*: three-body chaos and the figure-eight (Welcome page)
- 🎱 *Try to break the law*: energy on a pool table, with felt and soft cushions (Ch1)
- ⚖️ *The lawful coin*: the law of large numbers on a balance beam (Ch1)
- 🫧 *The pressure gauge*: molecules on a piston, from knocks to a steady push (Ch1)
- 🔷 *Find the symmetries* and 🌀 *The groove* (Ch1)

Planned:

- 🎲 Coin-flip simulator (with drifting probabilities)  
- 🎯 Induction paradox visualizations  
- 🤖 ML classifier toggle  
- 🌌 Ptolemaic vs. Copernican models  
- 🪐 Three-body chaos demos  
- 🧬 Replication fragility simulator  
- ⚖️ Feyerabend’s “debate toggle”  

All built with Quarto and plain JavaScript widgets (no runtime dependencies). Try every widget outside the book in the gallery: serve the repo and open `/widgets/gallery/`.

---

## 🛠️ Tech Requirements

- [Quarto](https://quarto.org/) 1.11.9 (the version CI uses)
- Node.js 22 for the widget tests and tools (`npm test`; `npm install` for posters and smoke tests)
- Git

> **Note:** If you don’t have Quarto, [see installation guide](https://quarto.org/docs/get-started/).

---

## 🚀 How to Clone and Build Locally

```bash
git clone https://github.com/dan-li-o/3body.git
cd 3body
quarto render
```

The site is built in `_book/` (not committed). Merging into `main` publishes it: GitHub Actions renders the book and pushes it to the `gh-pages` branch.  
To preview locally:

```bash
quarto preview                  # the site as readers see it
quarto preview --profile draft  # also shows the TODO notes (orange)
npm test                        # widget engine tests
```

---

## 📂 Project Structure

- `index.qmd`, `intro.qmd`: Welcome page and Preface
- `chapters/`: Book chapters
- `widgets/`: interactive figures (shared core, physics engines, one folder per widget, gallery)
- `_extensions/widget/`: the `{{< widget >}}` shortcode
- `theme/`, `css/`, `assets/`: typography, colours, self-hosted fonts, icons
- `filters/hide-todo.lua`: keeps `.todo` notes off the site
- `tests/`, `tools/`: widget tests; poster and smoke-test scripts
- `data/`: References and bibliography
- `_quarto.yml`: Book configuration

---

## ✍️ Author

Dan Li (李丹)  
Ph.D. in Informatics & Philosophy of Science  
Exploring how knowledge is shaped — and sometimes shaken — by complexity and uncertainty.

---

## 🤝 Contributing

Pull requests and suggestions welcome!  
Got a philosophical idea or simulation you want to build? Fork the repo or open an issue.  
[Open an issue](https://github.com/dan-li-o/3body/issues) or contact via [danlibp0913@gmail.com](mailto:danlibp0913@gmail.com).

---

## 📜 License

[![License: CC BY-NC 4.0](https://licensebuttons.net/l/by-nc/4.0/88x31.png)](https://creativecommons.org/licenses/by-nc/4.0/)

This book is licensed under a [Creative Commons Attribution-NonCommercial 4.0 International License](https://creativecommons.org/licenses/by-nc/4.0/).

---

## 📡 Stay Connected

Follow the GitHub repo to track updates, chapter releases, and new interactive features.