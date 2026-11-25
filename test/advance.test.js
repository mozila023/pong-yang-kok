'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { g, cityWith } = require('./helpers.js');

// Every test pins Math.random so elections and the rival's drift are deterministic.
const pinRandom = (t, v) => t.mock.method(Math, 'random', () => v);

test('a normal month moves time, money, population and approval', t => {
  pinRandom(t, 0.5);
  const s = g.newCity();
  const before = structuredClone(s), a = g.analyze(s);
  assert.equal(g.advance(s), null);
  assert.equal(s.month, 1);
  assert.equal(s.cash, before.cash + a.income - a.expense);
  assert.equal(s.party, before.party + 100);
  assert.equal(s.approval, Math.round((before.approval + a.target) * 5) / 10);
  assert.deepEqual(s.hist, [s.approval]);
  assert.ok(s.pop > before.pop, 'the starter town has room to grow');
});

test('population shrinks when there are too few homes', t => {
  pinRandom(t, 0.5);
  const s = g.newCity();
  s.pop = 5000;
  g.advance(s);
  assert.ok(s.pop < 5000);
  const empty = cityWith({}, { pop: 100 });
  g.advance(empty);
  assert.ok(empty.pop < 100);
});

test('history keeps the last six approvals', t => {
  pinRandom(t, 0.5);
  const s = g.newCity();
  for (let n = 0; n < 9; n++) g.advance(s);
  assert.equal(s.hist.length, 6);
  assert.equal(s.hist.at(-1), s.approval);
});

test('debt is repaid monthly, at most DEBT_PAYMENT', t => {
  pinRandom(t, 0.5);
  const s = g.newCity();
  s.debt = 300;
  g.advance(s);
  assert.equal(s.debt, 300 - g.DEBT_PAYMENT);
  g.advance(s);
  assert.equal(s.debt, 0);
});

test('elections happen every 12 months, and only then', t => {
  pinRandom(t, 0.5);
  const s = g.newCity();
  const results = [];
  for (let n = 1; n <= 36; n++) { const r = g.advance(s); if (r) results.push(s.month); }
  assert.deepEqual(results, [12, 24, 36]);
});

const favourite = () => ({ ...g.newCity(), month: 11, approval: 90, hist: [90, 90, 90, 90, 90] });
const underdog = () => ({ ...g.newCity(), month: 11, approval: 10, hist: [10, 10, 10, 10, 10], trust: 0 });

test('a win counts toward promotion; two wins promote and reset the count', t => {
  pinRandom(t, 0.5);
  const s = favourite();
  let r = g.advance(s);
  assert.equal(r.won, true);
  assert.equal(r.promoted, false);
  assert.equal(s.wins, 1);
  assert.equal(s.level, 0);
  assert.equal(s.opposition, false);

  s.month = 23; s.hist = [90, 90, 90, 90, 90]; s.approval = 90;
  r = g.advance(s);
  assert.equal(r.won, true);
  assert.equal(r.promoted, true);
  assert.equal(s.level, 1);
  assert.equal(s.wins, 0);
  assert.equal(r.role, g.roles[1]);
});

test('promotion stops at the top role', t => {
  pinRandom(t, 0.5);
  const s = { ...favourite(), level: g.roles.length - 1, wins: 1 };
  const r = g.advance(s);
  assert.equal(r.won, true);
  assert.equal(r.promoted, false);
  assert.equal(s.level, g.roles.length - 1);
});

test('losing an election sends you to the opposition', t => {
  pinRandom(t, 0.5);
  const s = { ...underdog(), wins: 1 };
  const r = g.advance(s);
  assert.equal(r.won, false);
  assert.equal(r.opposition, true);
  assert.equal(s.opposition, true);
  assert.equal(s.wins, 0);
  assert.ok(s.rival >= 50 && s.rival <= 62);
  assert.ok(r.score < 50);
});

test('in opposition the rival drifts, party funds grow faster, and a weak rival can be beaten', t => {
  pinRandom(t, 0.5); // no random drift: only the pull toward 50 and the wear of office
  const s = { ...g.newCity(), opposition: true, rival: 30, month: 3 };
  const party = s.party;
  assert.equal(g.advance(s), null);
  assert.equal(s.party, party + 180);
  assert.ok(Math.abs(s.rival - (30 + 3 - 0.35)) < 1e-9);

  s.month = 11;
  const r = g.advance(s);
  assert.equal(r.wasOpposition, true);
  assert.equal(r.won, true);
  assert.equal(s.opposition, false);
});

test('vote buying adds to the score when it is not caught', t => {
  pinRandom(t, 0.99);
  const s = { ...underdog(), influence: 48 };
  const r = g.advance(s);
  assert.equal(r.caught, false);
  assert.equal(r.won, true);
  assert.equal(s.influence, 0, 'influence is spent at the election');
});

test('vote buying that is caught zeroes the vote and wrecks trust', t => {
  pinRandom(t, 0);
  const s = { ...favourite(), influence: 6 };
  const r = g.advance(s);
  assert.equal(r.caught, true);
  assert.equal(r.score, 0);
  assert.equal(r.won, false);
  assert.equal(s.opposition, true);
  assert.equal(s.trust, -8);
  assert.equal(s.influence, 0);
  assert.equal(s.campaign, 0);
});

test('politics: one action per month, paid from party funds', () => {
  const s = g.newCity();
  s.party = 1000;
  assert.match(g.politics(s, 'meet'), /สภาชุมชน/);
  assert.equal(s.party, 820);
  assert.equal(s.campaign, 2);
  assert.equal(s.trust, 3);
  assert.equal(g.politics(s, 'meet'), 'เดือนนี้ลงพื้นที่แล้ว');
  s.month++;
  assert.equal(g.politics(s, 'buy'), 'เงินพรรคไม่พอ');
  s.party = 900;
  g.politics(s, 'buy');
  assert.equal(s.influence, 6);
  assert.equal(s.party, 0);
});
