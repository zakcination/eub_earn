'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var Calc = require('../js/calc.js');

test('computeHourlyRate divides salary by workdays then daily hours', function () {
  var rate = Calc.computeHourlyRate(300000, 22, 9);
  assert.equal(rate, 300000 / 22 / 9);
});

test('computeHourlyRate returns 0 for missing/invalid inputs', function () {
  assert.equal(Calc.computeHourlyRate(0, 22, 9), 0);
  assert.equal(Calc.computeHourlyRate(300000, 0, 9), 0);
  assert.equal(Calc.computeHourlyRate(300000, 22, 0), 0);
});

test('weekdaysInMonth counts only Mon-Fri', function () {
  // July 2026: 1st is a Wednesday, 31 days, 23 weekdays.
  assert.equal(Calc.weekdaysInMonth(2026, 7), 23);
});

test('0010 daily cap limits payable hours to 2h/day and flags excess', function () {
  var entries = [{ id: 1, date: '2026-07-06', category: '0010', hours: 3 }];
  var result = Calc.processEntries(entries, { '0010': 1.5 }, 1000);
  assert.equal(result.rows[0].payableHours, 2);
  assert.equal(result.rows[0].excessHours, 1);
  assert.equal(result.warnings.length, 1);
});

test('0010 monthly cap limits total payable hours to 12h across days', function () {
  var entries = [
    { id: 1, date: '2026-07-01', category: '0010', hours: 2 },
    { id: 2, date: '2026-07-02', category: '0010', hours: 2 },
    { id: 3, date: '2026-07-03', category: '0010', hours: 2 },
    { id: 4, date: '2026-07-06', category: '0010', hours: 2 },
    { id: 5, date: '2026-07-07', category: '0010', hours: 2 },
    { id: 6, date: '2026-07-08', category: '0010', hours: 2 },
    { id: 7, date: '2026-07-09', category: '0010', hours: 2 }
  ];
  var result = Calc.processEntries(entries, { '0010': 1.5 }, 1000);
  var totalPayable = result.rows.reduce(function (sum, r) { return sum + r.payableHours; }, 0);
  assert.equal(totalPayable, 12);
  var lastRow = result.rows[result.rows.length - 1];
  assert.equal(lastRow.payableHours, 0);
  assert.equal(lastRow.excessHours, 2);
});

test('0030 and 0040 are not capped', function () {
  var entries = [
    { id: 1, date: '2026-07-04', category: '0030', hours: 8 },
    { id: 2, date: '2026-07-05', category: '0040', hours: 6 }
  ];
  var result = Calc.processEntries(entries, { '0030': 1.5, '0040': 1.2 }, 1000);
  assert.equal(result.rows[0].payableHours, 8);
  assert.equal(result.rows[1].payableHours, 6);
  assert.equal(result.warnings.length, 0);
});

test('0030 multiplier is variable: 1.5x vs 1.0x changes pay', function () {
  var entries = [{ id: 1, date: '2026-07-04', category: '0030', hours: 4 }];
  var premium = Calc.processEntries(entries, { '0030': 1.5 }, 1000);
  var straight = Calc.processEntries(entries, { '0030': 1.0 }, 1000);
  assert.equal(premium.rows[0].pay, 4 * 1000 * 1.5);
  assert.equal(straight.rows[0].pay, 4 * 1000 * 1.0);
});

test('computeSummary totals pay across categories and applies tax', function () {
  var entries = [
    { id: 1, date: '2026-07-01', category: '0010', hours: 2 },
    { id: 2, date: '2026-07-04', category: '0030', hours: 4 },
    { id: 3, date: '2026-07-05', category: '0040', hours: 3 }
  ];
  var settings = {
    monthlySalary: 396000,
    workdaysInMonth: 22,
    dailyHours: 9,
    taxRatePercent: 20,
    multipliers: { '0010': 1.5, '0030': 1.5, '0040': 1.2 }
  };
  var summary = Calc.computeSummary(entries, settings);
  var hourlyRate = 396000 / 22 / 9; // = 2000
  assert.equal(hourlyRate, 2000);
  var expectedGross = 2 * hourlyRate * 1.5 + 4 * hourlyRate * 1.5 + 3 * hourlyRate * 1.2;
  assert.ok(Math.abs(summary.totalGrossOvertime - expectedGross) < 1e-9);
  assert.ok(Math.abs(summary.taxAmount - expectedGross * 0.2) < 1e-9);
  assert.ok(Math.abs(summary.netOvertime - expectedGross * 0.8) < 1e-9);
});

test('reverseCalculate grosses up a net payment before dividing by pay-per-hour', function () {
  var result = Calc.reverseCalculate(1200, 'net', 1000, 1.5, 20);
  // net 1200 -> gross 1500 -> hours = 1500 / (1000*1.5) = 1
  assert.ok(Math.abs(result.grossPayment - 1500) < 1e-9);
  assert.ok(Math.abs(result.hours - 1) < 1e-9);
});

test('reverseCalculate treats a gross payment directly', function () {
  var result = Calc.reverseCalculate(3000, 'gross', 1000, 1.5, 20);
  assert.ok(Math.abs(result.grossPayment - 3000) < 1e-9);
  assert.ok(Math.abs(result.netPayment - 2400) < 1e-9);
  assert.ok(Math.abs(result.hours - 2) < 1e-9);
});

test('forward and reverse calculations round-trip', function () {
  var settings = {
    monthlySalary: 396000,
    workdaysInMonth: 22,
    dailyHours: 9,
    taxRatePercent: 20,
    multipliers: { '0010': 1.5 }
  };
  var hourlyRate = Calc.computeHourlyRate(settings.monthlySalary, settings.workdaysInMonth, settings.dailyHours);
  var entries = [{ id: 1, date: '2026-07-01', category: '0010', hours: 2 }];
  var summary = Calc.computeSummary(entries, settings);

  var reversed = Calc.reverseCalculate(summary.netOvertime, 'net', hourlyRate, 1.5, 20);
  assert.ok(Math.abs(reversed.hours - 2) < 1e-9);
});
