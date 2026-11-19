// <ul-tuner>: live design dials, for the gallery only. Writes token overrides
// on <body>; widgets redraw through their retune() hook. Chosen values go into
// tokens.css by hand. Defaults are the values locked on 2026-11-19.
import { define, el } from './core.js';
import { slider, button, row } from './controls.js';

const ACCENTS = {
  light: { cinnabar: '#a63d2a', 'deep blue': '#2a4f9a' },
  dark: { cinnabar: '#e07a5f', 'deep blue': '#7fa2ea' },
};

class Tuner extends HTMLElement {
  connectedCallback() {
    if (this._done) return; this._done = true;
    this.v = { line: 1.75, bob: 6.5, trail: 0.55, accent: 'cinnabar' };
    const set = (k, unit = '') => ({ value: this.v[k], format: (x) => `${x}${unit}`, onInput: (x) => { this.v[k] = x; this.apply(); } });
    const acc = el('select', { className: 'ul-btn', ariaLabel: 'accent' });
    for (const k of Object.keys(ACCENTS.light)) acc.add(new Option(k, k));
    acc.addEventListener('change', () => { this.v.accent = acc.value; this.apply(); });
    const theme = button('', () => {
      document.body.classList.toggle('quarto-dark'); document.body.classList.toggle('quarto-light');
      label(); this.apply();
    });
    const label = () => { theme.textContent = document.body.classList.contains('quarto-dark') ? 'Light mode' : 'Dark mode'; };
    label();
    this.summary = el('p', { className: 'ul-readout' });
    this.replaceChildren(row(
      slider({ label: 'line weight', min: 1, max: 3.5, step: 0.25, ...set('line', ' px') }),
      slider({ label: 'ball size', min: 3, max: 12, step: 0.5, ...set('bob', ' px') }),
      slider({ label: 'trail', min: 0.2, max: 0.9, step: 0.05, ...set('trail') }),
      acc, theme,
    ), this.summary);
    this.apply();
  }
  apply() {
    const mode = document.body.classList.contains('quarto-dark') ? 'dark' : 'light';
    const b = document.body.style;
    b.setProperty('--ul-line', `${this.v.line}px`);
    b.setProperty('--ul-bob', `${this.v.bob}px`);
    b.setProperty('--ul-trail', String(this.v.trail));
    b.setProperty('--ul-accent', ACCENTS[mode][this.v.accent]);
    this.summary.textContent = `Send me these: line ${this.v.line} px · ball ${this.v.bob} px · trail ${this.v.trail} · accent ${this.v.accent}`;
  }
}
define('ul-tuner', Tuner);
