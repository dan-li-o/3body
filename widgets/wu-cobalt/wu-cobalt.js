// <ul-wu-cobalt>  Ch1 §8 "Through the Looking-Glass", Widget 1.7. "Wu's cobalt."
// A simplified Wu experiment, as a game (Dan, 2026-11-25): cool the crystal, switch on the
// magnet, then catch electrons by tapping them before the crystal warms up again.
// "Count for me" hands the counting to a detector. The counts are just ↑ and ↓, on the figure.
// A count belongs to one setup: it starts again at the first catch after the setup changes
// (lined up or not; each cold spell and each warm-up), so a verdict never mixes two setups.
// Spec: ./spec.md. Model: ../engines/cobalt.js (tests/engines/cobalt.test.mjs).
import { ULWidget, define, el, rng } from '../core/core.js';
import { button, slider, row, StatusLine } from '../core/controls.js';
import { createStage } from '../core/stage.js';
import { PARAMS, tempAt, sliderFor, isCold, jiggle, alignTarget, ranks, linedUp, pDownOne, verdict, fairRange, warmStep } from '../engines/cobalt.js';
import { COLS, ROWS, layout, drawCobalt } from './draw.js';

const HIT = 36;        // px: how close a tap must land to an electron's head
const POP = 0.5;       // s: a catch's ring
const SAY_EVERY = 3;   // s: how often screen readers hear the counts

class WuCobalt extends ULWidget {
  // status messages (at most 80 characters each; tests/widgets/strings.test.mjs)
  static status = ['start', 'warm', 'cooler', 'quick', 'lining', 'tap', 'keep', 'detector', 'lean', 'off', 'even', 'warming'];
  static buttons = ['magnet', 'auto', 'reset'];
  static strings = { en: {
    invite: 'Cool the crystal. Line up the nuclei. Catch the electrons.',
    label: 'Cobalt nuclei in a crystal, drawn as small balls with a spinning ring. Electrons fly up or down out of them; the counts are at the top and the bottom, and a meter below shows the share flying down against the range a fair coin gives.',
    keys: 'Keys: Enter catches an electron.',
    start: 'Drag the slider to cool the crystal.',
    warm: 'Too warm: the nuclei jiggle every which way. Keep cooling.',
    cooler: 'Colder… almost there.',
    quick: "Quick, we can't stay near absolute zero for long! Switch on the magnet.",
    lining: 'The magnet pulls, and the nuclei swing round…',
    tap: 'Most of the nuclei now spin the same way. Tap the electrons to count them.',
    keep: 'Keep tapping, or let the detector count for you.',
    detector: 'The detector never gets bored…',
    lean: 'More fly down than a fair coin allows. Nature can tell the two ends apart.',
    off: 'Magnet off: the nuclei drift every which way. Count again and compare.',
    even: 'Inside the fair-coin range: nothing picks out an end.',
    warming: 'Warming up. The nuclei scatter. Cool it again to keep counting.',
    magnet: 'Magnet', auto: 'Detector', reset: 'Reset',
    share: 'Flying down', fair: 'fair coin',
    temp: 'Temperature', cold: '{s} s of cold', counts: 'Up {up}, down {down}.',
  } };

  mount() {
    this.random = rng(this.num('seed', Date.now() % 1e9));
    const invite = el('p', { className: 'ul-invite', textContent: this.t('invite') });
    this.stage = createStage(document.createDocumentFragment(), { aspect: '3 / 2', phoneAspect: '1 / 1', label: `${this.t('label')} ${this.t('keys')}`, focusable: true });
    this.temp = slider({ label: this.t('temp'), min: 0, max: 100, step: 1, value: 0, format: (v) => fmtK(tempAt(v)),
      onInput: (v) => { if (!this.warming) { this.T = tempAt(v); this.go(); } } });
    this.tempInput = this.temp.querySelector('input'); this.tempOut = this.temp.querySelector('output');
    this.meter = shareMeter(this.t('share'), this.t('fair'));
    this.status = new StatusLine({ gap: 0, hold: 0 });
    this.status.reserve(this.constructor.status.map((k) => this.t(k)));
    this.sr = el('p', { className: 'ul-sr' }); this.sr.setAttribute('aria-live', 'polite');
    Object.assign(this.sr.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' });
    this.btn = {   // two switches (filled with ink when on) and a quiet Reset
      magnet: button(this.t('magnet'), () => this.setMagnet(!this.magnet)),
      auto: button(this.t('auto'), () => this.setAuto(!this.auto)),
      reset: button(this.t('reset'), () => this.reset(), { kind: 'quiet' }),
    };
    const cv = this.stage.canvas;
    cv.addEventListener('pointerdown', (e) => this.tap(e));
    cv.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.catchOldest(); } });
    this.replaceChildren(invite, this.stage.box, this.meter.el, this.temp, this.status.el, row(this.btn.magnet, this.btn.auto, this.btn.reset), this.sr);
    this.c = this.colors();
    this.reset();
  }

  // ----- hooks
  resize() { this.stage.fit(); this.L = layout(this.stage.w, this.stage.h); this.draw(); }
  retune() { this.c = this.colors(); this.draw(); }
  frame(dt) {
    dt = Math.max(0, dt);   // the first frame's dt can come out a hair below zero (core.js)
    if (!this.L) return;    // not measured yet (resize() comes from a ResizeObserver)
    this.time += dt;
    // the cold window, then the warm-up
    const cold = isCold(this.T);
    if (cold && !this.wasCold) this.serial++;   // each cold spell starts a new run
    this.wasCold = cold;
    if (cold && !this.warming) {
      this.coldFor += dt;
      if (this.coldFor >= PARAMS.coldSeconds) { this.warming = true; this.serial++; }
    }
    if (this.warming) {
      this.T = warmStep(this.T, dt); this.setSlider(sliderFor(this.T));
      if (this.T >= PARAMS.rewarmK) { this.warming = false; this.coldFor = 0; }
    }
    // the nuclei: lined-up ones swing to spin up; the rest drift to their own tilt; heat jiggles all
    const jig = jiggle(this.T), k = Math.min(1, dt * 2.5);
    this.align += (alignTarget(this.T, this.magnet) - this.align) * Math.min(1, dt * 2);
    for (const n of this.nuclei) {
      const target = linedUp(n.rank, this.align) ? 0 : n.home;
      n.base += wrapAngle(target - n.base) * k;
      n.wob = ou(n.wob, jig * 1.6, dt, this.random); n.jx = ou(n.jx, jig, dt, this.random); n.jy = ou(n.jy, jig, dt, this.random);
    }
    // electrons
    if (this.random() < dt * (this.auto ? PARAMS.detectorRate : PARAMS.handRate)) this.emit();
    const speed = this.L.sky / (this.auto ? PARAMS.flightDetector : PARAMS.flightHand);   // px per second
    for (const s of this.shots) s.l += dt * speed;
    this.shots = this.shots.filter((s) => { const y = s.y + s.d * s.l; return y > this.L.top * 0.6 && y < this.L.h - this.L.band * 0.6; });
    this.pops = this.pops.filter((p) => (p.t += dt) < POP);
    if (this.time - this.saidAt > SAY_EVERY && this.up + this.down !== this.saidN) this.speakCounts();
    this.say(); this.draw();
  }

  // ----- actions
  reset() {
    this.T = tempAt(0); this.time = 0; this.coldFor = 0; this.warming = false; this.align = 0; this.serial = 0; this.wasCold = false;
    this.up = 0; this.down = 0; this.key = null; this.leaned = false; this.shots = []; this.pops = [];
    this.magnetUsed = false; this.saidAt = 0; this.saidN = 0;
    this.setMagnet(false, true); this.setAuto(false, true); this.setSlider(0);
    const r = ranks(COLS * ROWS, this.random);
    this.nuclei = [];
    for (let k = 0; k < ROWS; k++) for (let c = 0; c < COLS; c++) {
      const home = (this.random() - 0.5) * 2 * Math.PI;
      this.nuclei.push({ c, k, rank: r[k * COLS + c], home, base: home, wob: 0, jx: 0, jy: 0 });
    }
    this.status.reset(); this.say(); this.draw();
    this.autoplay();   // under reduced motion it waits; the reader's first move starts it (go)
  }
  setMagnet(on, quiet) {
    this.magnet = on; if (on) this.magnetUsed = true;
    this.btn.magnet.setAttribute('aria-pressed', String(on));
    if (!quiet) this.go();
  }
  setAuto(on, quiet) {
    this.auto = on; this.btn.auto.setAttribute('aria-pressed', String(on));
    if (!quiet) this.go();
  }
  go() { this.play(); this.say(); this.draw(); }
  setSlider(v) {   // move the slider without it calling back (the crystal warming by itself)
    this.tempInput.value = String(v);
    const txt = fmtK(tempAt(v)); this.tempOut.textContent = txt; this.tempInput.setAttribute('aria-valuetext', txt);
  }

  // which setup a count belongs to: this cold spell, lined up or not
  get aligned() { return this.align >= PARAMS.maxAlign / 2; }
  runKey() { return `${this.serial}:${this.aligned ? 'a' : 'u'}`; }

  emit() {
    const n = this.nuclei[Math.floor(this.random() * this.nuclei.length)], p = this.place(n);
    const d = this.random() < pDownOne(linedUp(n.rank, this.align)) ? 1 : -1;
    const s = { x: p.x, y: p.y, d, l: this.L.r * 1.2, mine: false, counted: false };
    this.shots.push(s);
    if (this.auto) this.count(s, false);
  }
  count(s, mine) {
    if (this.warming || s.counted) return false;
    const key = this.runKey();
    if (key !== this.key) { this.key = key; this.up = 0; this.down = 0; this.leaned = false; }
    s.counted = true; s.mine = mine;
    s.d > 0 ? this.down++ : this.up++;
    return true;
  }
  catchIt(s) {
    if (!this.count(s, true)) return;
    this.pops.push({ x: s.x, y: s.y + s.d * s.l, t: 0 });
    this.go();
  }
  tap(e) {
    if (this.auto || !this.L) return;
    const b = this.stage.canvas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    let best = null, bd = HIT;
    for (const s of this.shots) {
      if (s.counted) continue;
      const dd = Math.hypot(s.x - x, s.y + s.d * s.l - y);
      if (dd < bd) { bd = dd; best = s; }
    }
    if (best) this.catchIt(best); else this.go();
  }
  catchOldest() {   // keyboard: catch the electron that has flown furthest
    if (this.auto) return this.go();
    const free = this.shots.filter((s) => !s.counted);
    if (!free.length) return this.go();
    this.catchIt(free.reduce((a, s) => (s.l > a.l ? s : a)));
  }

  // ----- words
  standing() {
    if (this.warming) return 'warming';
    const cold = isCold(this.T), mine = this.key === this.runKey(), tot = mine ? this.up + this.down : 0;
    const v = mine ? verdict(this.up, this.down) : null;
    if (this.aligned) {
      if (this.leaned || v === 'lean') { this.leaned = true; return 'lean'; }
      if (this.auto) return 'detector';
      return tot < 10 ? 'tap' : 'keep';
    }
    if (cold && this.magnet) return 'lining';
    if (cold) return !this.magnetUsed ? 'quick' : v === 'even' ? 'even' : 'off';
    if (this.tempInput.value === '0') return 'start';
    return this.T > 1 ? 'warm' : 'cooler';
  }
  say() { this.status.set(this.t(this.standing()), this.time); }
  speakCounts() {
    this.saidAt = this.time; this.saidN = this.up + this.down;
    this.sr.textContent = this.t('counts').replace('{up}', this.up).replace('{down}', this.down);
  }

  // ----- drawing
  place(n) {
    const L = this.L, p = L.at(n.c, n.k), j = L.r * 0.5;
    return { x: p.x + n.jx * j, y: p.y + n.jy * j };
  }
  draw() {
    const n = this.up + this.down;
    this.meter?.set(n ? this.down / n : null, n >= PARAMS.minCount ? fairRange(n) : null);
    if (!this.c || !this.L || !this.stage.w) return;
    this.stage.clear();
    const cold = isCold(this.T) && !this.warming;
    drawCobalt(this.stage.ctx, this.c, this.L, {
      nuclei: this.nuclei.map((n) => ({ ...this.place(n), tilt: n.base + n.wob })),
      shots: this.shots, pops: this.pops, up: this.up, down: this.down, frozen: this.warming,
      clock: cold ? this.t('cold').replace('{s}', Math.max(0, Math.ceil(PARAMS.coldSeconds - this.coldFor))) : null,
    });
  }
}

// The share meter: the share of electrons flying down (orange marker) on a 0–100% track, with the
// range a fair coin gives (grey band, labelled) once there are enough counts to judge.
// Built from house pieces: .ul-field and .ul-range's look; colours only from tokens.
function shareMeter(label, fairLabel) {
  const wrap = el('div', { className: 'ul-field' });
  el('span', { className: 'ul-field-label', textContent: label }, wrap);
  const track = el('div', {}, wrap), band = el('div', {}, track), tag = el('span', { textContent: fairLabel }, track);
  const mid = el('div', {}, track), mark = el('div', {}, track);
  const out = el('output', { textContent: '–' }, wrap);
  Object.assign(wrap.style, { marginTop: '.25rem' });
  Object.assign(wrap.firstChild.style, { fontFamily: 'var(--ul-serif)', fontStyle: 'italic', fontSize: '1.05rem', color: 'var(--ul-grey)', whiteSpace: 'nowrap' });
  Object.assign(track.style, { position: 'relative', flex: '1 1 auto', minWidth: '6rem', height: '44px' });
  track.setAttribute('aria-hidden', 'true');
  const line = el('div', {}, track);
  Object.assign(line.style, { position: 'absolute', left: 0, right: 0, top: '21px', height: '2px', background: 'var(--ul-rule)' });
  Object.assign(band.style, { position: 'absolute', top: '15px', height: '14px', background: 'color-mix(in srgb, var(--ul-ghost) 45%, transparent)', display: 'none' });
  Object.assign(tag.style, { position: 'absolute', top: '-1px', transform: 'translateX(-50%)', fontFamily: 'var(--ul-sans)', fontSize: '.7rem', color: 'var(--ul-grey)', whiteSpace: 'nowrap', display: 'none' });
  Object.assign(mid.style, { position: 'absolute', left: '50%', top: '15px', width: '1.5px', height: '14px', background: 'var(--ul-grey)' });
  Object.assign(mark.style, { position: 'absolute', top: '13px', width: '4px', height: '18px', marginLeft: '-2px', borderRadius: '1px', background: 'var(--ul-accent)', display: 'none' });
  out.style.color = 'var(--ul-accent)'; out.style.fontWeight = '600';
  let last = '';
  return { el: wrap, set(share, range) {
    const key = `${share}|${range}`; if (key === last) return; last = key;
    mark.style.display = share == null ? 'none' : 'block';
    if (share != null) mark.style.left = `${share * 100}%`;
    out.textContent = share == null ? '–' : `${Math.round(share * 100)}%`;
    band.style.display = tag.style.display = range ? 'block' : 'none';
    if (range) { band.style.left = `${range[0] * 100}%`; band.style.width = `${(range[1] - range[0]) * 100}%`; tag.style.left = '50%'; }
  } };
}

// a small random wander that stays near 0, with spread s (Ornstein–Uhlenbeck, relaxing in ~0.4 s)
const ou = (x, s, dt, random) => x + (-x / 0.4) * dt + s * Math.sqrt(2 * dt / 0.4) * (random() + random() + random() - 1.5) * 2;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fmtK = (t) => (t >= 1 ? `${Math.round(t)} K` : t >= 0.1 ? `${t.toFixed(1)} K` : `${t.toFixed(3)} K`);

define('ul-wu-cobalt', WuCobalt);
