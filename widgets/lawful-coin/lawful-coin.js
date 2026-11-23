// <ul-lawful-coin>  Ch1 §5, Widget 1.2. "The lawful coin."
// Flip more and more coins. Tails go to the left end of a beam, heads to the right;
// the fulcrum slides to where the beam balances, which is the share of heads (law of the lever).
// Below, on the same scale, the pen records it: wild with a few coins, steady near ½ with thousands.
// Spec: ./spec.md. Engine: ../engines/coins.js (every claim tested in tests/engines/coins.test.mjs).
import { ULWidget, define, el, rng, reducedMotion } from '../core/core.js';
import { button, row, StatusLine } from '../core/controls.js';
import { createStage } from '../core/stage.js';
import { valueAxis, Zoom, drawStrip, drawGuide } from '../core/strip.js';
import { flip, band, balancePoint } from '../engines/coins.js';
import { drawBalance } from './draw.js';

const MAX = 10000;        // coins at the end of a run
const RUN_S = 20;         // seconds for a run from the current count to MAX
const FLIP_S = 0.9;       // a hand flip: spin, then drop into the pans
const LAND = 0.55;        // fraction of FLIP_S spent spinning
const STEP_UNTIL = 5;     // hand flips before Run is offered
const ZOOM = [10, 100, 1000, 10000];

class LawfulCoin extends ULWidget {
  static strings = { en: {
    invite: 'Flip coins. Watch where the beam balances.',
    label: 'A balance: tails on the left end of the beam, heads on the right. An orange fulcrum slides to where the beam balances, which is the share of heads.',
    chart: 'The share of heads traced as coins are added: {n} coins so far, latest share {s}.',
    start: 'One coin. Flip it.',
    one: 'One coin: all heads or all tails, so the beam balances at one end. The fulcrum slides to where the beam balances, like balancing a ruler on your finger: that point is the share of heads. Add a coin.',
    two: 'The line traces the balance point: across for the share of heads, down for how many coins. Add another.',
    more: 'One more coin, one more flip.',
    ready: 'You get the idea. Add coins one at a time, or let it run.',
    running: 'More and more coins, flipped again and again. Watch the fulcrum and the pen: they swing, then settle on one half.',
    run1: 'Few coins: the split swings wildly. Thousands: it holds near one half. Does the math predict this shape?',
    runN: 'A new run, the same shape. Each flip is random; the split is lawful.',
    band: 'The bands are what the math predicts, before any coin is flipped: about 68 of every 100 flips land in the inner band, about 95 in the outer. Both narrow as coins are added.',
    flipOne: 'Flip one coin', addFlip: 'Add a coin and flip', run: 'Run: up to 10,000 coins', again: 'Run again',
    showBand: 'Show the expected range', reset: 'Reset',
    inner: 'inner band: about 68 of every 100 flips', outer: 'outer band: about 95 of every 100',
    share: 'share of heads', coinsAxis: 'coins', heads: 'heads', tails: 'tails', coin: 'coin', coins: 'coins', none: 'no coins yet',
  } };

  mount() {
    this.random = rng(this.num('seed', Date.now() % 1e9));
    const invite = el('p', { className: 'ul-invite', textContent: this.t('invite') });
    const frag = document.createDocumentFragment();
    this.top = createStage(frag, { aspect: '3 / 1', phoneAspect: '2 / 1', label: this.t('label') });
    this.bottom = createStage(frag, { aspect: '16 / 10', phoneAspect: '1 / 1', label: '' });
    this.key = el('div', { className: 'ul-key' });
    el('span', { className: 'ul-key-inner', textContent: this.t('inner') }, this.key);
    el('span', { className: 'ul-key-outer', textContent: this.t('outer') }, this.key);
    this.status = new StatusLine({ gap: 0, hold: 0 });
    this.status.reserve(['start', 'one', 'two', 'more', 'ready', 'running', 'run1', 'runN', 'band'].map((k) => this.t(k)));   // room for every message: nothing below moves
    this.btn = {
      add: button(this.t('flipOne'), () => this.addCoin()),
      run: button(this.t('run'), () => this.startRun(), { hidden: true }),
      band: button(this.t('showBand'), () => this.showBand(), { hidden: true }),
      reset: button(this.t('reset'), () => this.reset(), { kind: 'quiet' }),
    };
    const b = this.btn;
    this.replaceChildren(invite, this.top.box, this.bottom.box, this.key, this.status.el, row(b.add, b.run, b.band, b.reset));
    this.zoom = new Zoom(ZOOM);
    this.retune();
    this.reset();
  }

  // ----- hooks
  resize() { this.top.fit(); this.bottom.fit(); this.axis = valueAxis(this.top.w); this.fx = this.axis.V(this.share); this.draw(); }
  retune() { this.c = this.colors(); this.draw(); }
  frame(dt) {
    this.time += dt;
    if (this.run) {
      const p = Math.min(1, (this.time - this.run.t0) / RUN_S);
      const n = Math.round(this.run.n0 * (MAX / this.run.n0) ** p);
      if (n !== this.N || p >= 1) this.flipAll(n);
      if (p >= 1) this.endRun();
    }
    const target = this.axis.V(this.share);
    this.fx += (target - this.fx) * Math.min(1, dt * (this.run ? 7 : 4));   // slow enough that the beam visibly rocks
    this.zoom.step(dt);
    this.draw();
    const settled = Math.abs(target - this.fx) < 0.3 && !this.zoom.busy && this.time - this.flipAt > FLIP_S && this.time - this.bandAt > 0.9;
    if (!this.run && settled) this.pause();
  }

  // ----- actions
  reset() {
    this.N = 0; this.heads = 0; this.share = 0.5; this.time = 0; this.flipAt = -9; this.bandAt = -9;
    this.trace = []; this.old = []; this.runs = 0; this.run = null; this.bands = false;
    this.zoom.reset(); this.key.hidden = true;
    Object.assign(this.btn.add, { hidden: false, textContent: this.t('flipOne') });
    this.btn.run.hidden = true; this.btn.band.hidden = true; this.btn.run.textContent = this.t('run'); this.btn.run.disabled = false;
    this.fx = this.axis ? this.axis.V(0.5) : 0;
    this.say('start'); this.pause(); this.draw();
  }
  flipAll(n) {
    this.N = n; this.zoom.need(n, reducedMotion());
    this.heads = flip(n, this.random).filter(Boolean).length;
    this.share = balancePoint(this.heads, n - this.heads);
    this.trace.push(n, this.share);
  }
  addCoin() {
    if (this.run) return;
    this.flipAll(this.N + 1);
    this.flipAt = reducedMotion() ? -9 : this.time;
    this.btn.add.textContent = this.t('addFlip');
    this.say(this.N === 1 ? 'one' : this.N === 2 ? 'two' : this.N < STEP_UNTIL ? 'more' : 'ready');
    if (this.N >= STEP_UNTIL) this.btn.run.hidden = false;
    this.go();
  }
  startRun() {
    if (this.run) return;
    if (this.runs > 0) { this.old.push(this.trace); this.trace = []; this.N = 0; this.zoom.reset(); }
    if (!this.N) this.flipAll(1);
    this.btn.add.hidden = true; this.btn.run.disabled = true; this.say('running');
    if (reducedMotion()) {                                 // no motion: the whole run at once
      for (let n = this.N + 1; n <= MAX; n = Math.max(n + 1, Math.ceil(n * 1.01))) this.flipAll(n);
      this.flipAll(MAX); this.fx = this.axis.V(this.share); this.endRun(); this.draw(); return;
    }
    this.run = { t0: this.time, n0: this.N };
    this.go();
  }
  endRun() {
    this.run = null; this.runs++;
    this.btn.run.disabled = false; this.btn.run.textContent = this.t('again');
    this.say(this.runs === 1 ? 'run1' : 'runN');
    if (!this.bands) this.btn.band.hidden = false;
  }
  showBand() {
    this.bands = true; this.bandAt = reducedMotion() ? -9 : this.time;
    this.btn.band.hidden = true; this.key.hidden = false; this.say('band'); this.go();
  }
  go() { this.play(); this.draw(); }               // animate until settled (frame() pauses again)
  say(key) { this.status.set(this.t(key), this.time); }

  // ----- drawing
  draw() {
    if (!this.axis || !this.c || !this.top.w) return;
    const { c, axis } = this, age = (this.time - this.flipAt) / FLIP_S;
    const spinning = this.N <= 60 && age >= 0 && age < LAND;
    this.top.clear(); this.bottom.clear();
    const trackY = drawBalance(this.top.ctx, c, this.top.w, this.top.h, {
      V: axis.V, fx: this.fx, target: axis.V(this.share), N: this.N, heads: this.heads, landed: !spinning,
      air: spinning ? { k: this.N, age: age / LAND } : null,
      words: { heads: this.t('heads'), tails: this.t('tails'), coin: this.t('coin'), coins: this.t('coins'), none: this.t('none') },
    });
    if (this.N) drawGuide(this.top.ctx, c, this.fx, trackY, this.top.h);
    const f = (this.fx - axis.v0) / (axis.v1 - axis.v0);   // where the fulcrum is now: the pointer follows it
    drawStrip(this.bottom.ctx, c, this.bottom.w, this.bottom.h, {
      axis, xMax: this.zoom.x, mean: 0.5, valueName: this.t('share'), countName: this.t('coinsAxis'),
      traces: [...this.old.map((d) => ({ data: d, alpha: 0.25 })), { data: spinning ? this.trace.slice(0, -2) : this.trace, alpha: 0.85 }],
      pen: this.N && !spinning ? { n: this.N, f: this.share } : null,
      pointer: this.N && !spinning ? f : null,
      bands: this.bands ? (n) => ({ inner: band(n, 1), outer: band(n, 2) }) : null,
      bandFade: this.bands ? Math.min(1, (this.time - this.bandAt) / 0.9) : 0,
    });
    this.bottom.canvas.setAttribute('aria-label', this.t('chart').replace('{n}', this.N.toLocaleString('en')).replace('{s}', this.share.toFixed(3)));
  }
}

define('ul-lawful-coin', LawfulCoin);
