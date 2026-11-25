'use strict';
const g = require('../game-core.js');

// First tile on the map with the given terrain type, as a "i,j" key.
function tileOf(type) {
  for (let i = 0; i < g.N; i++) for (let j = 0; j < g.N; j++) if (g.terrain(i, j) === type) return g.key(i, j);
  throw new Error('no ' + type + ' tile');
}

// A city with only the given cells (the entrance road is always added).
function cityWith(cells, extra = {}) {
  return { ...g.newCity(), cells: { [g.ENTRANCE]: 'road', ...cells }, ...extra };
}

// A straight road heading east from the entrance along row 14: 3,14 .. (3+len-1),14.
function eastRoad(len) {
  const cells = {};
  for (let i = 3; i < 3 + len; i++) cells[g.key(i, 14)] = 'road';
  return cells;
}

module.exports = { g, tileOf, cityWith, eastRoad };
