'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { g, cityWith, eastRoad } = require('./helpers.js');

const ids = a => a.live.map(e => e.k).sort();

test('roads are traced from the western entrance', () => {
  const a = g.analyze(cityWith({ ...eastRoad(3), '20,20': 'road', '21,20': 'road' }));
  assert.deepEqual([...a.roads].sort(), ['2,14', '3,14', '4,14', '5,14']);
  assert.ok(!a.roads.has('20,20'));
  assert.equal(a.access([4, 13]), true);
  assert.equal(a.access([20, 19]), false);
});

test('no entrance road means no road network', () => {
  const s = cityWith(eastRoad(3));
  delete s.cells[g.ENTRANCE];
  assert.equal(g.analyze(s).roads.size, 0);
});

test('a gap in the road cuts off everything beyond it', () => {
  const cells = eastRoad(6);
  delete cells['5,14'];
  const a = g.analyze(cityWith(cells));
  assert.ok(a.roads.has('4,14'));
  assert.ok(!a.roads.has('6,14'));
});

test('the plant runs only with a road-connected coal mine and its own road access', () => {
  const road = eastRoad(4); // 3..6,14
  // Plant and mine both next to the road: powered.
  let a = g.analyze(cityWith({ ...road, '4,13': 'plant', '6,13': 'coal' }));
  assert.deepEqual(ids(a), ['4,13']);
  assert.equal(a.powered([4, 10]), true);
  assert.equal(a.powered([4, 9]), false);

  // No coal mine.
  a = g.analyze(cityWith({ ...road, '4,13': 'plant' }));
  assert.equal(a.live.length, 0);

  // Coal mine without road access.
  a = g.analyze(cityWith({ ...road, '4,13': 'plant', '20,20': 'coal' }));
  assert.equal(a.live.length, 0);

  // Plant without road access.
  a = g.analyze(cityWith({ ...road, '4,11': 'plant', '6,13': 'coal' }));
  assert.equal(a.live.length, 0);
  assert.equal(a.powered([4, 11]), false);
});

test('poles chain power outward from the plant', () => {
  const base = { ...eastRoad(4), '4,13': 'plant', '6,13': 'coal' };
  // plant 4,13 (range 3) -> wood 7,13 -> wood 10,13 -> wood 13,13
  let a = g.analyze(cityWith({ ...base, '7,13': 'poleWood', '10,13': 'poleWood', '13,13': 'poleWood', '22,22': 'poleWood' }));
  assert.deepEqual(ids(a), ['10,13', '13,13', '4,13', '7,13']);
  assert.equal(a.powered([16, 13]), true);
  assert.equal(a.powered([22, 22]), false); // isolated pole stays dark
  assert.equal(a.powered([17, 13]), false);

  // Remove the middle pole: the chain breaks.
  a = g.analyze(cityWith({ ...base, '7,13': 'poleWood', '13,13': 'poleWood' }));
  assert.deepEqual(ids(a), ['4,13', '7,13']);
  assert.equal(a.powered([13, 13]), false);

  // Two poles link when either reaches the other: a pylon (8) links to a wood pole 8 tiles away.
  a = g.analyze(cityWith({ ...base, '7,13': 'pylon', '15,13': 'poleWood' }));
  assert.deepEqual(ids(a), ['15,13', '4,13', '7,13']);
});

test('unpowered and unconnected buildings produce less', () => {
  const road = eastRoad(4);
  const lit = g.analyze(cityWith({ ...road, '4,13': 'plant', '6,13': 'coal', '5,15': 'condo' }));
  const dark = g.analyze(cityWith({ ...road, '5,15': 'condo' }));
  const lost = g.analyze(cityWith({ ...road, '20,20': 'condo' }));
  assert.equal(lit.capacity, 88);
  assert.equal(dark.capacity, Math.floor(88 * .35));
  assert.equal(lost.capacity, Math.floor(88 * .08));
});
