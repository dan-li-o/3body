// <ul-break-the-law>  Ch1 §4, Widget 1.1. "Try to break the law."
// One ball on a table. Push it; then add felt and soft cushions. Motion turns into warmth in the felt and
// the cushions; the total does not change unless a push from outside changes it.
// Spec: ./spec.md. Engine: ../engines/pool-table.js (claims tested in tests/engines/pool-table.test.mjs).
import { ULWidget, define, reducedMotion, el } from '../core/core.js';
import { button, row, StatusLine } from '../core/controls.js';
import { createStage } from '../core/stage.js';
import { push, total, ke } from '../engines/pool-table.js';
import { layout, toScreen, drawTable, TABLE } from './draw.js';
import { createState, setSurface, advance, moving } from './model.js';

const MAXV = 3;                          // the hardest push (speed)
const PER = 4;                           // speed per unit of drag (in table units)
const TAPV = 1.1;                        // a tap: a gentle nudge away from the finger
const SCALE0 = 0.5 * MAXV * MAXV * 1.3;  // the column fits the hardest push, so a harder push shows a higher total
const REMARK_S = 4;                      // seconds a remark stays up

class BreakTheLaw extends ULWidget {
  static strings = { en: {
    invite: 'Push the ball. Push it hard, or gently.',
    label: 'A pool table with one ball, and a column showing its energy: motion, warmth in the felt, warmth in the cushions, and the total.',
    reading: 'Motion {k}, warmth in the felt {f}, in the cushions {c}, total {t}.',
    start: 'Press on the ball and drag the way you want it to go. The longer the drag, the harder the push.',
    aim: 'Let go to push.',
    ideal: 'No table is this smooth. But this is the law with nothing in the way: the ball keeps going forever.',
    felt: 'The ball warms the felt as it rolls; the faint track is energy the ball has lost. Total unchanged.',
    cush: 'Each bounce dents a soft cushion; the dent is energy the ball has lost. Total unchanged.',
    both: 'Felt and cushions are taking the motion as warmth. Total unchanged.',
    still: 'The ball has stopped. Its energy is all in the felt and the cushions now. Total unchanged.',
    up: 'That push came from outside the table, and it added energy. The total went up.',
    down: 'That push came from outside the table, and it took energy away. The total went down.',
    miss: 'Press on the ball itself.',
    feltBtn: 'Felt', softBtn: 'Soft cushions', random: 'Push at random', reset: 'Reset', play: 'Play',
    motion: 'motion', feltWord: 'felt', cushions: 'cushions', total: 'total', energy: 'energy',
  } };

  mount() {
    const invite = el('p', { className: 'ul-invite', textContent: this.t('invite') });
    const frag = document.createDocumentFragment();
    this.stage = createStage(frag, { aspect: '12 / 5', phoneAspect: '4 / 3', label: this.t('label') });
    this.status = new StatusLine({ gap: 0, hold: REMARK_S });
    this.btn = {
      felt: button(this.t('feltBtn'), () => this.toggle('felt')),
      soft: button(this.t('softBtn'), () => this.toggle('soft')),
      random: button(this.t('random'), () => this.pushRandom(), { kind: 'quiet' }),
      reset: button(this.t('reset'), () => this.reset(), { kind: 'quiet' }),
      play: button(this.t('play'), () => this.play(), { kind: 'quiet', hidden: true }),
    };
    const b = this.btn;
    this.replaceChildren(invite, this.stage.box, this.status.el, row(b.felt, b.soft, b.random, b.reset, b.play));
    this.words = { motion: this.t('motion'), felt: this.t('feltWord'), cushions: this.t('cushions'), total: this.t('total'), energy: this.t('energy') };
    this.gesture(this.stage.canvas);
    this.c = this.colors();
    this.reset();
  }

  // ----- hooks
  resize() { this.stage.fit(); this.L = layout(this.stage.w, this.stage.h); this.draw(); }
  retune() { this.c = this.colors(); this.draw(); }
  stateChanged() { this.btn.play.hidden = this.playing || !reducedMotion() || !moving(this.st); }
  frame(dt) {
    advance(this.st, dt);
    this.draw();
    if (!moving(this.st) && !this.st.trail.length) this.pause();   // nothing left to animate
  }

  // ----- actions
  reset() {
    this.st = createState(); this.surface = { felt: false, soft: false }; this.pushed = false;
    this.scale = SCALE0; this.aim = null;
    this.applySurface(); this.status.reset(); this.pause(); this.draw();
  }
  toggle(which) { this.surface[which] = !this.surface[which]; this.applySurface(); this.draw(); }
  applySurface() {
    setSurface(this.st, this.surface);
    this.btn.felt.setAttribute('aria-pressed', String(this.surface.felt));
    this.btn.soft.setAttribute('aria-pressed', String(this.surface.soft));
  }
  pushRandom() { const g = Math.random() * 2 * Math.PI, sp = 0.8 + Math.random() * 1.8; this.give(Math.cos(g) * sp, Math.sin(g) * sp); }
  // A push from outside: the only thing that changes the total.
  give(vx, vy) {
    const { T, ball } = this.st, before = total(T);
    let nx = ball.vx + vx, ny = ball.vy + vy;
    const m = Math.hypot(nx, ny); if (m > MAXV) { nx *= MAXV / m; ny *= MAXV / m; }
    push(T, ball, nx, ny);
    const d = total(T) - before;
    if (this.pushed && Math.abs(d) > 0.02) this.status.remark(this.t(d > 0 ? 'up' : 'down'), now(), { force: true });
    this.pushed = true;
    if (!reducedMotion()) this.play(); else this.stateChanged();
    this.draw();
  }

  // ----- the gesture: press on the ball, drag the way it should go, let go. A tap is a gentle nudge.
  gesture(cv) {
    const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      if (!this.L) return;
      const [sx, sy] = at(e), [bx, by] = toScreen(this.L, this.st.ball.x, this.st.ball.y);
      if (Math.hypot(sx - bx, sy - by) > Math.max(28, TABLE.R * this.L.s * 3)) { this.status.remark(this.t('miss'), now(), { force: true }); return; }
      e.preventDefault(); cv.setPointerCapture(e.pointerId);
      this.aim = { sx, sy, ex: sx, ey: sy }; this.draw();
    });
    cv.addEventListener('pointermove', (e) => { if (!this.aim) return; [this.aim.ex, this.aim.ey] = at(e); this.draw(); });
    cv.addEventListener('pointerup', () => {
      if (!this.aim) return;
      const a = this.aim; this.aim = null;
      if (Math.hypot(a.ex - a.sx, a.ey - a.sy) < 8) {
        const [bx, by] = toScreen(this.L, this.st.ball.x, this.st.ball.y);
        let dx = bx - a.sx, dy = by - a.sy; const m = Math.hypot(dx, dy);
        if (m < 1e-6) { dx = 1; dy = 0; } else { dx /= m; dy /= m; }
        this.give(dx * TAPV, dy * TAPV);
      } else this.give(...this.aimVel(a));
    });
    cv.addEventListener('pointercancel', () => { this.aim = null; this.draw(); });
    cv.style.touchAction = 'none';
  }
  aimVel(a) {
    let dx = (a.ex - a.sx) / this.L.s * PER, dy = (a.ey - a.sy) / this.L.s * PER;
    const m = Math.hypot(dx, dy); if (m > MAXV) { dx *= MAXV / m; dy *= MAXV / m; }
    return [dx, dy];
  }

  // ----- the status line: a standing sentence for the state, remarks for pushes
  standing() {
    const st = this.st, { felt, soft } = this.surface;
    if (this.aim) return 'aim';
    if (!this.pushed) return 'start';
    if (!moving(st) && st.T.warmth > 0) return 'still';
    return felt && soft ? 'both' : felt ? 'felt' : soft ? 'cush' : 'ideal';
  }

  // ----- drawing
  draw() {
    if (!this.L || !this.c || !this.st) return;
    const st = this.st, k = ke(st.ball), tot = k + st.warmF + st.warmC;
    if (tot > this.scale * 0.92) this.scale = tot / 0.8;
    let aim = null;
    if (this.aim) {
      const v = this.aimVel(this.aim), m = Math.min(MAXV, Math.hypot(st.ball.vx + v[0], st.ball.vy + v[1]));
      aim = { tip: [st.ball.x + v[0] / PER, st.ball.y + v[1] / PER], preview: tot - k + 0.5 * m * m };
    }
    this.stage.clear();
    drawTable(this.stage.ctx, this.c, { L: this.L, ...st, scale: this.scale, showTotal: this.pushed || tot > 0, aim, words: this.words });
    this.status.set(this.t(this.standing()), now());
    this.stage.canvas.setAttribute('aria-label', `${this.t('label')} ${this.t('reading').replace('{k}', k.toFixed(2))
      .replace('{f}', st.warmF.toFixed(2)).replace('{c}', st.warmC.toFixed(2)).replace('{t}', tot.toFixed(2))}`);
  }
}

const now = () => performance.now() / 1000;

define('ul-break-the-law', BreakTheLaw);
