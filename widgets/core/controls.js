// House-style controls, shared by every widget. Quiet, but they look like
// controls: 44 px touch areas, keyboard support, visible focus (design.md).
import { el } from './core.js';

let uid = 0;
const nextId = (p) => `ul-${p}-${++uid}`;

// A real button. kind: 'primary' (outlined) or 'quiet' (text only, kept at the
// right end of the row: Reset, Play, Push at random).
export function button(label, onClick, { kind = 'primary', hidden = false } = {}) {
  const b = el('button', { type: 'button', className: kind === 'quiet' ? 'ul-btn ul-btn-quiet' : 'ul-btn', textContent: label });
  b.hidden = hidden;
  b.addEventListener('click', onClick);
  return b;
}

// A labelled slider with a live value: slider({ label, min, max, step, value, format, onInput })
export function slider({ label, min, max, step = 1, value, format = String, onInput }) {
  const id = nextId('range');
  const wrap = el('div', { className: 'ul-field' });
  el('label', { htmlFor: id, textContent: label }, wrap);
  const input = el('input', { id, type: 'range', min, max, step, value, className: 'ul-range' }, wrap);
  const out = el('output', { htmlFor: id, textContent: format(value) }, wrap);
  input.setAttribute('aria-valuetext', format(value));
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    out.textContent = format(v); input.setAttribute('aria-valuetext', format(v));
    onInput?.(v);
  });
  return wrap;
}

// A row to hold controls.
export function row(...children) {
  // Actions (outlined) start at the column edge; quiet buttons (Reset, Play…)
  // form one group at the right end, and wrap together if the row is full.
  const r = el('div', { className: 'ul-controls' });
  const quiet = el('div', { className: 'ul-controls-quiet' });
  for (const c of children) (c.classList?.contains('ul-btn-quiet') ? quiet : r).append(c);
  r.append(quiet);
  return r;
}

// The status line: one sentence that narrates what the figure is doing,
// announced to screen readers. Two kinds of message:
//   set(msg)     the standing state ("Drifting.")
//   remark(msg)  a passing event ("A near collision."), shown for `hold`
//                seconds; at most one remark per `gap` seconds, so the
//                line never flickers.
// Times are in the widget's own clock (seconds), passed in by the caller.
//
// The line never changes height, so the buttons below it never jump: it keeps
// an invisible copy of every message it may show (pass them as `reserve`, and
// any other message is added the first time it appears), all stacked in one
// grid cell. The cell is as tall as the longest message at the current width.
export class StatusLine {
  constructor({ gap = 6, hold = 1.5, reserve = [] } = {}) {
    this.el = el('div', { className: 'ul-status' });
    this.line = el('p', { className: 'ul-status-now' }, this.el);
    this.line.setAttribute('aria-live', 'polite');
    this.held = new Set();
    this.gap = gap; this.hold = hold;
    this.reserve(reserve);
    this.reset();
  }
  // Keep room for these messages (strings), so showing one never moves the page.
  reserve(msgs) {
    for (const m of msgs) {
      if (!m || this.held.has(m)) continue;
      this.held.add(m);
      el('p', { className: 'ul-status-room', textContent: m }, this.el).setAttribute('aria-hidden', 'true');
    }
    return this;
  }
  reset() { this._remark = null; this._standing = ''; this._show(''); }
  set(msg, now) { this._standing = msg; this._render(now); }
  remark(msg, now, { hold = this.hold, force = false } = {}) {
    if (!force && this._remark && now - this._remark.at < this.gap) return;
    this._remark = { msg, at: now, hold };
    this._render(now);
  }
  // The remark currently on show, if any.
  current(now) { return this._remark && now - this._remark.at < this._remark.hold ? this._remark.msg : null; }
  _render(now) { this._show(this.current(now) ?? this._standing); }
  _show(msg) {
    if (this.line.textContent === msg) return;
    this.reserve([msg]);
    this.line.textContent = msg;
  }
}
