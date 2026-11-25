'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { g, tileOf, cityWith } = require('./helpers.js');

test('takeLoan only works while the treasury is in the red', () => {
  const s = g.newCity();
  const before = structuredClone(s);
  assert.notEqual(g.takeLoan(s), '');
  s.cash = 0;
  assert.notEqual(g.takeLoan(s), '');
  assert.equal(s.cash, 0);
  assert.equal(s.debt, before.debt);
});

test('takeLoan pays out LOAN, adds debt with interest and costs approval', () => {
  const s = { ...g.newCity(), cash: -500, month: 5, approval: 50 };
  assert.equal(g.takeLoan(s), '');
  assert.equal(s.cash, -500 + g.LOAN);
  assert.equal(s.debt, Math.round(g.LOAN * g.LOAN_RATE));
  assert.equal(s.loanMonth, 5);
  assert.equal(s.approval, 44);
});

test('takeLoan is allowed once per 12 months', () => {
  const s = { ...g.newCity(), cash: -500, month: 5 };
  assert.equal(g.takeLoan(s), '');
  s.cash = -1;
  for (const m of [5, 10, 16]) {
    s.month = m;
    assert.equal(g.takeLoan(s), 'กู้ฉุกเฉินได้ปีละครั้ง', 'month ' + m);
  }
  s.month = 17;
  assert.equal(g.takeLoan(s), '');
  assert.equal(s.debt, 2 * Math.round(g.LOAN * g.LOAN_RATE));
});

test('takeLoan is refused in opposition', () => {
  const s = { ...g.newCity(), cash: -500, opposition: true };
  assert.equal(g.takeLoan(s), 'ฝ่ายค้านกู้เงินในนามเทศบาลไม่ได้');
  assert.equal(s.cash, -500);
  assert.equal(s.debt, 0);
});

test('sellTile removes the building and refunds half its cost', () => {
  const s = g.newCity();
  const cash = s.cash;
  assert.equal(s.cells['8,13'], 'wood');
  assert.equal(g.sellTile(s, '8,13', 'wood'), true);
  assert.equal(s.cells['8,13'], undefined);
  assert.equal(s.cash, cash + g.catalog.wood.cost / 2);
  assert.equal(g.saleValue('wood', 8, 13), 400);
});

test('selling a bridge refunds half the bridge price', () => {
  const water = tileOf('water');
  const s = cityWith({ [water]: 'road' });
  const cash = s.cash;
  const [i, j] = water.split(',').map(Number);
  assert.equal(g.buildCost('road', i, j), g.BRIDGE_COST);
  assert.equal(g.sellTile(s, water, 'road'), true);
  assert.equal(s.cash, cash + g.BRIDGE_COST / 2);
});

test('sellTile never sells the entrance', () => {
  const s = g.newCity();
  const cash = s.cash;
  assert.equal(g.sellTile(s, g.ENTRANCE, 'road'), false);
  assert.equal(s.cells[g.ENTRANCE], 'road');
  assert.equal(s.cash, cash);
});

test('sellTile refuses stale or bogus requests and opposition sales', () => {
  const s = g.newCity();
  const cash = s.cash;
  assert.equal(g.sellTile(s, '8,13', 'mall'), false); // tile holds something else
  assert.equal(g.sellTile(s, '0,0', 'wood'), false); // empty tile
  assert.equal(g.sellTile(s, '8,13', 'castle'), false); // unknown id
  s.opposition = true;
  assert.equal(g.sellTile(s, '8,13', 'wood'), false);
  assert.equal(s.cells['8,13'], 'wood');
  assert.equal(s.cash, cash);
});

test('catalog groups and costs are consistent', () => {
  for (const [id, item] of Object.entries(g.catalog)) {
    assert.equal(item.id, id);
    assert.ok(Number.isInteger(item.cost) && item.cost > 0, id);
    assert.equal(g.buildCost(id), item.cost);
  }
  assert.ok(g.catalog.condo.capacity > g.catalog.wood.capacity);
});
