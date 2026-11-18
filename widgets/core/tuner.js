// <ul-tuner>: live design dials for tuning "the least that does the job
// properly". Writes token overrides on <body>, then asks widgets to redraw.
// Used in the gallery only; the chosen values go into tokens.css.
import { define, useStyles } from './core.js';

const MODES = {
  light: { ink: [31, 33, 36], bg: [251, 251, 248], accents: { cinnabar: '#B8402A', vermilion: '#D2462E', 'deep blue': '#2A4F9A' } },
  dark: { ink: [230, 228, 223], bg: [31, 34, 38], accents: { cinnabar: '#E8735C', vermilion: '#F0644A', 'deep blue': '#7FA2EA' } },
};
const mix = (a, b, f) => `rgb(${a.map((v, i) => Math.round(v * f + b[i] * (1 - f))).join(',')})`;

class Tuner extends HTMLElement {
  connectedCallback() {
    if (this._done) return; this._done = true;
    this.v = { line: 1.75, ghost: 0.4, bob: 7, accent: 'cinnabar' };
    this.innerHTML = '';
    const mk = (label, key, min, max, step, unit) => {
      const row = document.createElement('div'); row.className = 'ul-field';
      const id = `tune-${key}`;
      row.innerHTML = `<label for="${id}">${label}</label><input id="${id}" class="ul-range" type="range" min="${min}" max="${max}" step="${step}" value="${this.v[key]}"><output for="${id}"></output>`;
      const input = row.querySelector('input'), out = row.querySelector('output');
      const show = () => { out.textContent = `${this.v[key]}${unit}`; };
      input.addEventListener('input', () => { this.v[key] = parseFloat(input.value); show(); this.apply(); });
      show(); return row;
    };
    const acc = document.createElement('div'); acc.className = 'ul-field';
    acc.innerHTML = '<label for="tune-accent">accent</label>';
    const sel = document.createElement('select'); sel.id = 'tune-accent'; sel.className = 'ul-btn';
    for (const k of Object.keys(MODES.light.accents)) sel.add(new Option(k, k));
    sel.addEventListener('change', () => { this.v.accent = sel.value; this.apply(); });
    acc.append(sel);
    const theme = document.createElement('button'); theme.type = 'button'; theme.className = 'ul-btn';
    const setLabel = () => { theme.textContent = document.body.classList.contains('quarto-dark') ? 'Light mode' : 'Dark mode'; };
    theme.addEventListener('click', () => { document.body.classList.toggle('quarto-dark'); document.body.classList.toggle('quarto-light'); setLabel(); this.apply(); });
    setLabel();
    this.summary = document.createElement('p'); this.summary.className = 'ul-readout';
    const box = document.createElement('div'); box.className = 'ul-controls';
    box.append(mk('line weight', 'line', 1, 3.5, 0.25, ' px'), mk('ghost strength', 'ghost', 0.15, 0.8, 0.05, ''), mk('bob size', 'bob', 4, 11, 0.5, ' px'), acc, theme);
    this.append(box, this.summary);
    this.apply();
  }
  apply() {
    const m = document.body.classList.contains('quarto-dark') ? MODES.dark : MODES.light;
    const b = document.body.style;
    b.setProperty('--ul-line', `${this.v.line}px`);
    b.setProperty('--ul-bob', `${this.v.bob}px`);
    b.setProperty('--ul-ghost', mix(m.ink, m.bg, this.v.ghost));
    b.setProperty('--ul-accent', m.accents[this.v.accent]);
    this.summary.textContent = `Send me these: line ${this.v.line} px · ghost ${this.v.ghost} · bob ${this.v.bob} px · accent ${this.v.accent}`;
    document.querySelectorAll('.ul-widget').forEach((w) => w.retune?.());
  }
}
define('ul-tuner', Tuner);
