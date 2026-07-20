'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var State = require('../js/state.js');

var sampleFields = {
  year: 2026,
  month: 6, // 0-indexed: July
  currency: '₸',
  monthlySalary: 396000,
  workdaysInMonth: 22,
  dailyHours: 9,
  taxRatePercent: 20,
  rate0030: '1.5',
  entries: [
    { id: 1, date: '2026-07-06', category: '0010', hours: 2 },
    { id: 2, date: '2026-07-04', category: '0030', hours: 4, rate: 1.0 }
  ]
};

test('buildFullState keeps salary and currency', function () {
  var full = State.buildFullState(sampleFields);
  assert.equal(full.monthlySalary, 396000);
  assert.equal(full.currency, '₸');
  assert.equal(full.entries.length, 2);
});

test('buildShareableState strips salary and currency but keeps everything else', function () {
  var shareable = State.buildShareableState(sampleFields);
  assert.equal('monthlySalary' in shareable, false);
  assert.equal('currency' in shareable, false);
  assert.equal(shareable.taxRatePercent, 20);
  assert.equal(shareable.workdaysInMonth, 22);
  assert.equal(shareable.dailyHours, 9);
  assert.equal(shareable.rate0030, '1.5');
  assert.deepEqual(shareable.entries, [
    { date: '2026-07-06', category: '0010', hours: 2 },
    { date: '2026-07-04', category: '0030', hours: 4, rate: 1.0 }
  ]);
});

test('encodeState/decodeState round-trips', function () {
  var shareable = State.buildShareableState(sampleFields);
  var encoded = State.encodeState(shareable);
  assert.ok(typeof encoded === 'string' && encoded.length > 0);
  var decoded = State.decodeState(encoded);
  assert.deepEqual(decoded, shareable);
});

test('decodeState returns null for garbage input', function () {
  assert.equal(State.decodeState('not-valid-base64!!!'), null);
  assert.equal(State.decodeState(''), null);
  assert.equal(State.decodeState(null), null);
  assert.equal(State.decodeState(State.encodeState({ notEntries: true })), null);
});
