// <ul-two-pendulums angle="69" error="3" step="3">
// Ch3, "A tale of two pendulums." Nature (grey ghost) and two learned models
// drawn from one pivot, plus an energy line. step=1: nature only;
// step=2: + Newton's terms; step=3: + energy terms (default).
import { ULWidget, define, svg, useStyles, token } from '../core/core.js';
import { slider, button } from '../core/controls.js';
import { energy, stepNature, stepNewton, stepEnergy } from '../engines/pendulum.js';

useStyles(new URL('./two-pendulums.css', import.meta.url));

const T_MAX = 20;      // seconds of simulated time
const E_MAX = 4.5;     // top of the energy scale (x starting energy)
const MODELS = [
  { key: 'nat', label: 'nature', step: stepNature, cls: 'ghost', minStep: 1 },
  { key: 'newt', label: 'Newton’s terms', step: stepNewton, cls: 'accent', minStep: 2 },
  { key: 'ener', label: 'energy terms', step: stepEnergy, cls: 'ink', minStep: 3 },
];

class TwoPendulums extends ULWidget {
  mount() {
    this.stepN = Math.round(this.num('step', 3));
    this.models = MODELS.filter((m) => m.minStep <= this.stepN);
    this.angle = this.num('angle', 69);
    this.err = this.num('error', 3);

    this.figure = document.createElement('div');
    this.figure.className = 'ul-tp';
    this.svgEl = svg('svg', { role: 'img', class: 'ul-tp-svg' }, this.figure);
    this.svgEl.style.display = 'block';
    this.svgEl.style.width = '100%';

    const controls = document.createElement('div');
    controls.className = 'ul-controls';
    controls.append(
      slider({ label: 'starting angle', min: 10, max: 150, step: 1, value: this.angle, format: (v) => `${v}°`, onInput: (v) => { this.angle = v; this.reset(); } }),
    );
    if (this.stepN >= 2) {
      controls.append(slider({ label: 'learning error', min: 0, max: 10, step: 0.5, value: this.err, format: (v) => `${v}%`, onInput: (v) => { this.err = v; this.reset(); } }));
    }
    this.playBtn = button('Play', () => (this.playing ? this.pause() : (this.t >= T_MAX && this.reset(), this.play())));
    this.playBtn.setAttribute('aria-pressed', 'false');
    const resetBtn = button('Reset', () => { this.pause(); this.reset(); });
    this.readout = document.createElement('span');
    this.readout.className = 'ul-readout';
    this.readout.setAttribute('aria-live', 'polite');
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:.5rem;align-items:center';
    btns.append(this.playBtn, resetBtn, this.readout);
    controls.append(btns);

    this.replaceChildren(this.figure, controls);
    this.build(this.getBoundingClientRect().width || 640);
    this.reset();
  }

  // ----- geometry (rebuilt on resize)
  build(width) {
    const W = Math.max(280, Math.round(width));
    const wide = W >= 700;
    let L, px, py, chartTop, chartH, cx0, cx1, H;
    if (wide) {                                  // pendulum left, energy right
      L = Math.round(Math.min(W * 0.14, 130));
      px = L + 40; py = L + 24;                 // room above for swings over the top
      cx0 = px + L + 90; cx1 = W - 190;
      chartH = Math.round(L * 1.1); chartTop = py - chartH / 2 + L * 0.35;
      H = py + L + 40;
    } else {                                     // stacked, for phones
      L = Math.round(Math.min(W * 0.3, 120));
      px = Math.round(W / 2); py = L + 24;
      cx0 = 34; cx1 = W - 120;
      chartTop = py + L + 76; chartH = 72;
      H = chartTop + chartH + 30;
    }
    this.geo = { W, H, L, px, py, chartTop, chartH, cx0, cx1, lab: wide ? 17 : 15 };
    const g = this.geo, s = this.svgEl;
    s.setAttribute('viewBox', `0 0 ${W} ${H}`);
    s.replaceChildren();
    svg('line', { x1: g.px - 12, y1: g.py, x2: g.px + 12, y2: g.py, class: 'ul-stroke-ink' }, s);
    this.parts = {};
    const bobR = parseFloat(token('--ul-bob', this)) || 7;
    // draw ghost first so models sit on top
    for (const m of this.models) {
      const grp = svg('g', { class: `ul-tp-${m.cls}` }, s);
      this.parts[m.key] = {
        rod: svg('line', { x1: g.px, y1: g.py }, grp),
        bob: svg('circle', { r: bobR + (m.key === 'nat' ? 1 : 0) }, grp),
        text: svg('text', { class: 'ul-tp-label', 'font-size': g.lab }, grp),
        line: svg('polyline', { class: 'ul-tp-eline' }, grp),
        dot: svg('circle', { r: 3 }, grp),
        val: svg('text', { class: 'ul-tp-val', 'font-size': g.lab - 2 }, grp),
      };
      this.parts[m.key].text.textContent = m.label;
    }
    // energy axis: baseline at 1x, light ticks, time span
    const ax = svg('g', { class: 'ul-tp-axis', 'font-size': g.lab - 3 }, s);
    for (const e of [1, 2, 3, 4]) {
      const y = this.ey(e);
      svg('line', { x1: g.cx0, y1: y, x2: g.cx1, y2: y, class: e === 1 ? 'base' : 'tick' }, ax);
      svg('text', { x: g.cx0 - 6, y: y + 4, 'text-anchor': 'end' }, ax).textContent = `${e}×`;
    }
    svg('text', { x: g.cx0, y: g.chartTop + g.chartH + 22 }, ax).textContent = '0 s';
    svg('text', { x: g.cx1, y: g.chartTop + g.chartH + 22, 'text-anchor': 'end' }, ax).textContent = `${T_MAX} s`;
    svg('text', { x: g.cx0, y: g.chartTop - 16, class: 'title' }, ax)
      .textContent = 'energy, as a multiple of where it started';
    this.svgEl.setAttribute('aria-label', this.describe());
  }

  ey(e) { const g = this.geo; return g.chartTop + g.chartH * (1 - (Math.min(e, E_MAX) - 1) / (E_MAX - 1)); }
  ex(t) { const g = this.geo; return g.cx0 + (g.cx1 - g.cx0) * (t / T_MAX); }

  resize(width) {
    if (!this.geo || Math.abs(width - this.geo.W) < 4) return;
    this.build(width);
    this.draw(true);
  }

  retune() { if (this.geo) { this.build(this.geo.W); this.draw(true); } }

  // ----- simulation
  reset() {
    this.t = 0;
    const th0 = (this.angle * Math.PI) / 180;
    this.E0 = energy([th0, 0]);
    this.state = {}; this.hist = {};
    for (const m of this.models) { this.state[m.key] = [th0, 0]; this.hist[m.key] = [[0, 1]]; }
    this.draw(true);
  }

  frame(dt) {
    const opts = { err: this.err / 100 };
    for (const m of this.models) {
      this.state[m.key] = m.step(this.state[m.key], dt, opts);
      this.hist[m.key].push([this.t + dt, energy(this.state[m.key]) / this.E0]);
    }
    this.t += dt;
    if (this.t >= T_MAX) this.pause();
    this.draw(false);
  }

  stateChanged() { this.playBtn.textContent = this.playing ? 'Pause' : 'Play'; this.playBtn.setAttribute('aria-pressed', String(this.playing)); }

  draw(full) {
    const g = this.geo;
    for (const m of this.models) {
      const p = this.parts[m.key];
      const [th] = this.state[m.key];
      const x = g.px + g.L * Math.sin(th), y = g.py + g.L * Math.cos(th);
      p.rod.setAttribute('x2', x.toFixed(1)); p.rod.setAttribute('y2', y.toFixed(1));
      p.bob.setAttribute('cx', x.toFixed(1)); p.bob.setAttribute('cy', y.toFixed(1));
      if (m.key === 'nat') {                    // one fixed label, under the swing
        p.text.setAttribute('x', g.px); p.text.setAttribute('y', g.py + g.L + 30);
        p.text.setAttribute('text-anchor', 'middle');
        p.text.textContent = this.models.length > 1 ? 'grey: nature' : 'nature';
      } else {
        p.text.textContent = '';                 // models are named on their energy lines
      }
      if (m.key === 'nat' && this.models.length > 1) { p.line.setAttribute('points', ''); p.dot.setAttribute('r', 0); p.val.textContent = ''; continue; }
      const h = this.hist[m.key];
      p.line.setAttribute('points', h.map(([t, e]) => `${this.ex(t).toFixed(1)},${this.ey(e).toFixed(1)}`).join(' '));
      const [tl, el] = h[h.length - 1];
      p.dot.setAttribute('r', 3);
      p.dot.setAttribute('cx', this.ex(tl).toFixed(1)); p.dot.setAttribute('cy', this.ey(el).toFixed(1));
      p.val.setAttribute('x', (this.ex(tl) + 7).toFixed(1)); p.val.setAttribute('y', (this.ey(el) - 6).toFixed(1));
      p.val.textContent = `${m.label}  ${el.toFixed(el >= 10 ? 0 : 1)}×`;
      if (m.key === 'ener' && this.hist.newt) p.val.setAttribute('y', (this.ey(el) + 18).toFixed(1));
    }
    this.readout.textContent = `${this.t.toFixed(1)} s`;
  }

  describe() {
    const parts = ['A pendulum drawn as a grey ghost (nature)'];
    if (this.stepN >= 2) parts.push('a model learned in Newton’s terms, whose energy creeps up until it swings over the top');
    if (this.stepN >= 3) parts.push('and a model learned in energy terms, slightly off in rhythm but with steady energy');
    return parts.join(', ') + '. A line below tracks each model’s energy over 20 seconds.';
  }
}

define('ul-two-pendulums', TwoPendulums);
