'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { g, tileOf } = require('./helpers.js');

const save = (over = {}) => ({ ...g.newCity(), ...over });

test('newCity starts fully powered and road-connected', () => {
  const s = g.newCity();
  assert.equal(s.v, 1);
  assert.equal(s.cells[g.ENTRANCE], 'road');
  const a = g.analyze(s);
  assert.equal(a.coverage, 100);
  assert.ok(a.live.some(e => e.id === 'plant'));
});

test('sanitizeCity returns a fresh city for invalid saves', () => {
  const fresh = g.newCity();
  for (const bad of [null, undefined, 'x', 42, [], {}, { v: 2, cells: {} }, { v: '1', cells: {} },
    { v: 1 }, { v: 1, cells: null }, { v: 1, cells: [] }, { v: 1, cells: 'road' }]) {
    assert.deepEqual(g.sanitizeCity(bad), fresh, JSON.stringify(bad));
  }
});

test('sanitizeCity round-trips a valid save', () => {
  const s = g.newCity();
  assert.deepEqual(g.sanitizeCity(JSON.parse(JSON.stringify(s))), s);
});

test('sanitizeCity drops malformed keys, unknown ids and out-of-range tiles', () => {
  const land = tileOf('land');
  const out = g.sanitizeCity(save({ cells: {
    [land]: 'wood',
    '-1,5': 'wood', '26,12': 'wood', '12,26': 'wood', '5,-1': 'road',
    'abc': 'road', '1,2,3': 'road', '1.5,12': 'road', ' 4,12': 'road',
    '6,12': 'castle', '7,12': 42, '8,12': null, '9,12': '__proto__', '10,12': 'toString',
  } }));
  assert.deepEqual(out.cells, { [land]: 'wood', [g.ENTRANCE]: 'road' });
});

test('sanitizeCity keeps bridges but drops buildings on water', () => {
  const water = tileOf('water');
  const [i] = water.split(',').map(Number);
  let other; // a second water tile for the road
  for (let j = 0; j < g.N && !other; j++) if (g.terrain(i + 1, j) === 'water') other = g.key(i + 1, j);
  const out = g.sanitizeCity(save({ cells: { [water]: 'wood', [other]: 'road' } }));
  assert.equal(out.cells[water], undefined);
  assert.equal(out.cells[other], 'road');
});

test('sanitizeCity always restores the entrance road', () => {
  assert.equal(g.sanitizeCity(save({ cells: {} })).cells[g.ENTRANCE], 'road');
  assert.equal(g.sanitizeCity(save({ cells: { [g.ENTRANCE]: 'mall' } })).cells[g.ENTRANCE], 'road');
});

test('sanitizeCity replaces non-numbers with defaults and clamps ranges', () => {
  const base = g.newCity();
  const out = g.sanitizeCity(save({
    cash: 'abc', pop: NaN, approval: Infinity, tax: 99, services: '3', month: -4,
    level: 99, wins: 1.6, trust: -100, influence: null, party: '', rival: 5,
    speed: 7.4, debt: -50, campaign: 1e9, actionMonth: 'soon',
  }));
  assert.equal(out.cash, base.cash);
  assert.equal(out.pop, base.pop);
  assert.equal(out.approval, base.approval);
  assert.equal(out.tax, 22);
  assert.equal(out.services, 3);
  assert.equal(out.month, 0);
  assert.equal(out.level, g.roles.length - 1);
  assert.equal(out.wins, 2);
  assert.equal(out.trust, -20);
  assert.equal(out.influence, 0);
  assert.equal(out.party, 4000);
  assert.equal(out.rival, 20);
  assert.equal(out.speed, 2);
  assert.equal(out.debt, 0);
  assert.equal(out.campaign, 500);
  assert.equal(out.actionMonth, -1);
  for (const [k, v] of Object.entries(out)) if (typeof v === 'number') assert.ok(Number.isFinite(v), k);

  assert.equal(g.sanitizeCity(save({ tax: -5, approval: -3 })).tax, 2);
  assert.equal(g.sanitizeCity(save({ approval: 250 })).approval, 100);
});

test('sanitizeCity cleans the remaining fields', () => {
  const out = g.sanitizeCity(save({
    opposition: 'true', news: 'x'.repeat(500), month: 30, loanMonth: 99,
    hist: [1, 'nope', 200, -5, 2, 3, 4, 5, NaN],
  }));
  assert.equal(out.opposition, false);
  assert.equal(out.news.length, 240);
  assert.equal(out.loanMonth, 30); // a loan cannot be taken in the future
  assert.deepEqual(out.hist, [100, 0, 2, 3, 4, 5]);
  assert.equal(g.sanitizeCity(save({ opposition: true })).opposition, true);
  assert.equal(g.sanitizeCity(save({ news: 7 })).news, g.newCity().news);
});
