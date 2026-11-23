// <ul-pressure-gauge>  Ch1 §5, Widget 1.3. "A gas chamber."
// Molecules fly in a box; one wall is a piston on a spring. Piston, pointer and pen show the push per
// molecule: knocks with a few molecules, a steady hum (pressure) with thousands. "The knocks become a hum."
// Spec: ./spec.md. Engine: ../engines/gas.js (claims tested in tests/engines/gas.test.mjs).
import { ULWidget, define, el, rng, reducedMotion } from '../core/core.js';
import { button, row, StatusLine } from '../core/controls.js';
import { createStage } from '../core/stage.js';
import { valueAxis, Zoom, drawStrip, drawGuide } from '../core/strip.js';
import { createGas, addBall, step, statImpulse, Dial, MEAN, bandAt } from '../engines/gas.js';
import { drawChamber } from './draw.js';

const MAX = 10000;            // molecules at the end of a run
const SIM = 400;              // simulated one by one (and drawn); the rest by the tested statistical model
const RUN_S = 22;             // seconds for a run to MAX
const STEP_UNTIL = 3;         // molecules added by hand before Run is offered
const YMAX = MEAN * 2.4;      // right end of the scale
const ZOOM = [10, 100, 1000, 10000];
const TRACE_CAP = 12000;      // points kept per line

class PressureGauge extends ULWidget {
  // status messages (at most 80 characters each; tests/widgets/strings.test.mjs)
  static status = ['start', 'one', 'two', 'ready', 'running', 'run1', 'runN', 'band'];
  static buttons = ['add', 'run', 'again', 'showBand', 'reset', 'play'];
  static strings = { en: {
    invite: 'Add molecules. Watch the piston, the pointer and the pen.',
    label: 'A box of gas. Molecules fly inside; the right wall is a piston held by a spring. The piston’s position shows the push per molecule.',
    chart: 'The push per molecule traced as molecules are added: {n} molecules, reading {v} against an average of {m}.',
    start: 'An empty chamber. Add a molecule.',
    one: 'One molecule. Each hit makes the pointer jump, then fall: a knock, then nothing.',
    two: 'The line traces the pointer as molecules are added. Add another.',
    ready: 'You get the idea. Add molecules one at a time, or let it run.',
    running: 'More and more molecules. The knocks become a hum. That hum is pressure.',
    run1: 'A few molecules knock; thousands push steadily. Can math predict this?',
    runN: 'A new run, the same shape. Each knock is random; the hum is lawful.',
    band: 'These bands were worked out in advance. Both narrow as molecules are added.',
    add: 'Add a molecule', run: 'Run', again: 'Run again', showBand: 'Show the range', reset: 'Reset', play: 'Play',
    inner: 'inner band: the pointer is here about 68% of the time', outer: 'outer band: about 95%',
    value: 'push per molecule', count: 'molecules', zero: '0', avg: 'avg',
    molecule: 'molecule', molecules: 'molecules', drawn: 'drawn', empty: 'an empty chamber',
  } };

  mount() {
    this.random = rng(this.num('seed', Date.now() % 1e9));
    const invite = el('p', { className: 'ul-invite', textContent: this.t('invite') });
    const frag = document.createDocumentFragment();
    this.top = createStage(frag, { aspect: '3 / 1', phoneAspect: '5 / 2', label: this.t('label') });
    this.bottom = createStage(frag, { aspect: '16 / 10', phoneAspect: '1 / 1', label: '' });
    this.key = el('div', { className: 'ul-key' });
    el('span', { className: 'ul-key-inner', textContent: this.t('inner') }, this.key);
    el('span', { className: 'ul-key-outer', textContent: this.t('outer') }, this.key);
    this.status = new StatusLine({ gap: 0, hold: 0 });
    this.status.reserve(this.constructor.status.map((k) => this.t(k)));   // room for every message: nothing below moves
    this.btn = {
      add: button(this.t('add'), () => this.addMolecule()),
      run: button(this.t('run'), () => this.startRun(), { hidden: true, labels: [this.t('again')] }),
      band: button(this.t('showBand'), () => this.showBand(), { kind: 'quiet', hidden: true }),
      reset: button(this.t('reset'), () => this.reset(), { kind: 'quiet' }),
      play: button(this.t('play'), () => this.play(), { kind: 'quiet', hidden: true }),
    };
    const b = this.btn;
    this.replaceChildren(invite, this.top.box, this.bottom.box, this.key, this.status.el, row(b.add, b.run, b.band, b.reset, b.play));
    this.zoom = new Zoom(ZOOM);
    this.dial = new Dial();
    this.retune();
    this.reset();
  }

  // ----- hooks
  resize() { this.top.fit(); this.bottom.fit(); this.axis = valueAxis(this.top.w, { left: 0.32, right: 0.8 }); this.draw(); }
  retune() { this.c = this.colors(); this.draw(); }
  stateChanged() { this.btn.play.hidden = this.playing || !this.N; }
  frame(dt) { this.advance(dt); this.draw(); }

  // ----- the model
  advance(dt) {
    this.time += dt;
    this.zoom.step(dt);
    if (this.run) {
      const p = Math.min(1, (this.time - this.run.t0) / RUN_S);
      this.grow(Math.round(this.run.n0 * (MAX / this.run.n0) ** p));
    }
    if (!this.N) return;
    const imp = step(this.g, dt, this.random) + statImpulse(this.N - this.g.n, dt, this.random);
    const v = this.dial.update(imp, dt, this.N);
    // the drawn piston has inertia: knocks jolt it, it rings a little and settles (pointer and pen follow it)
    const w = 2 * Math.PI * 4, z = 0.45;
    this.vel += (w * w * (Math.min(v, YMAX) - this.disp) - 2 * z * w * this.vel) * dt; this.disp += this.vel * dt;
    if ((this.run || this.trace.length < TRACE_CAP)) this.trace.push(this.N, Math.min(v, YMAX) / YMAX);
    if (this.run && this.time - this.run.t0 >= RUN_S) this.endRun();
  }
  grow(n) {
    this.N = Math.max(this.N, Math.min(MAX, n));
    while (this.g.n < Math.min(this.N, SIM)) addBall(this.g, this.random);
    this.zoom.need(this.N, reducedMotion());
  }

  // ----- actions
  reset() {
    this.g = createGas({ cap: SIM }); this.N = 0; this.time = 0; this.disp = 0; this.vel = 0; this.dial.reset();
    this.trace = []; this.old = []; this.runs = 0; this.run = null; this.bands = false; this.bandAt = -9;
    this.zoom.reset(); this.key.hidden = true;
    this.btn.add.hidden = false; this.btn.run.hidden = true; this.btn.run.disabled = false; this.btn.run.label = this.t('run');
    this.btn.band.hidden = true;
    this.say('start'); this.pause(); this.draw();
  }
  addMolecule() {
    if (this.run) return;
    this.grow(this.N + 1);
    this.say(this.N === 1 ? 'one' : this.N === 2 ? 'two' : 'ready');
    if (this.N >= STEP_UNTIL) this.btn.run.hidden = false;
    this.start();
  }
  startRun() {
    if (this.run) return;
    if (this.runs > 0) { this.old.push(this.trace); this.trace = []; this.g = createGas({ cap: SIM }); this.N = 0; this.dial.reset(); this.zoom.reset(); }
    if (!this.N) this.grow(1);
    this.run = { t0: this.time, n0: this.N };
    this.btn.add.hidden = true; this.btn.run.disabled = true; this.say('running');
    if (reducedMotion()) { while (this.run) this.advance(1 / 60); this.draw(); return; }   // no motion: the whole run at once
    this.start();
  }
  endRun() {
    this.run = null; this.runs++;
    this.btn.run.disabled = false; this.btn.run.label = this.t('again');
    this.say(this.runs === 1 ? 'run1' : 'runN');
    if (!this.bands) this.btn.band.hidden = false;
  }
  showBand() { this.bands = true; this.bandAt = this.time; this.btn.band.hidden = true; this.key.hidden = false; this.say('band'); this.draw(); }
  // The gas keeps moving while it is on screen (the base class stops it off screen); reduced motion waits for Play.
  start() { if (reducedMotion()) { for (let i = 0; i < 120; i++) this.advance(1 / 60); this.stateChanged(); } else this.play(); this.draw(); }
  say(key) { this.status.set(this.t(key), this.time); }

  // ----- drawing
  draw() {
    if (!this.axis || !this.c || !this.top.w) return;
    const { c, axis } = this, f = this.disp / YMAX;
    this.top.clear(); this.bottom.clear();
    const p = drawChamber(this.top.ctx, c, this.top.w, this.top.h, {
      V: axis.V, f, g: this.g, N: this.N,
      words: { molecule: this.t('molecule'), molecules: this.t('molecules'), drawn: this.t('drawn'), empty: this.t('empty') },
    });
    if (this.N) drawGuide(this.top.ctx, c, p.x, p.y, this.top.h);
    drawStrip(this.bottom.ctx, c, this.bottom.w, this.bottom.h, {
      axis, xMax: this.zoom.x, mean: MEAN / YMAX, valueName: this.t('value'), countName: this.t('count'),
      ticks: [[0, this.t('zero')], [MEAN / YMAX, this.t('avg')]],
      traces: [...this.old.map((d) => ({ data: d, alpha: 0.25 })), { data: this.trace, alpha: 0.85 }],
      pen: this.N ? { n: this.N, f } : null, pointer: this.N ? f : null,
      bands: this.bands ? (n) => ({ inner: bandAt(n, 1).map((v) => v / YMAX), outer: bandAt(n, 2).map((v) => v / YMAX) }) : null,
      bandFade: this.bands ? (reducedMotion() ? 1 : Math.min(1, (this.time - this.bandAt) / 0.9)) : 0,
    });
    this.bottom.canvas.setAttribute('aria-label', this.t('chart').replace('{n}', this.N.toLocaleString('en'))
      .replace('{v}', this.dial.value.toFixed(2)).replace('{m}', MEAN.toFixed(2)));
  }
}

define('ul-pressure-gauge', PressureGauge);
