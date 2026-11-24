// The ghost hunt (Ch1 §7): the timeline's words rest on these checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, GAP, START, END, gapYears } from '../../widgets/ghost-hunt/model.js';

test('the gap label says twenty-six years: Pauli 1930 to detection 1956', () => {
  assert.equal(gapYears(), 26);
  assert.equal(Math.floor(GAP[0]), 1930);
  assert.equal(Math.floor(GAP[1]), 1956);
  assert.equal(EVENTS.find((e) => e.id === 'pauli').y, GAP[0]);
  assert.equal(EVENTS.find((e) => e.id === 'caught').y, GAP[1]);
});

test('events are in date order and on the axis', () => {
  for (let i = 1; i < EVENTS.length; i++) assert.ok(EVENTS[i].y > EVENTS[i - 1].y, EVENTS[i].id);
  for (const e of EVENTS) assert.ok(e.y >= START && e.y <= END, e.id);
});

test('each shown date contains the year the event is drawn at', () => {
  for (const e of EVENTS) {
    const years = (e.date.match(/\d{4}|\d{2}$/g) || []).map((s) => (s.length === 2 ? Number(e.date.slice(0, 2) + s) : Number(s)));
    const lo = Math.min(...years), hi = Math.max(...years);
    assert.ok(Math.floor(e.y) >= lo && Math.floor(e.y) <= hi, `${e.id}: ${e.date} vs ${e.y}`);
  }
});

test('nothing in the empty stretch between Fermi and the hunt', () => {
  const inside = EVENTS.filter((e) => e.y > 1934 && e.y < 1952);
  assert.deepEqual(inside, []);
});
