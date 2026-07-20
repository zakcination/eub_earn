/**
 * Overtime earnings calculation core.
 * Pure functions, no DOM dependency, usable from the browser (as a plain
 * <script>, attaches window.OvertimeCalc) or from Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OvertimeCalc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ВидОтПР categories, per the source payroll table.
  var CATEGORIES = {
    '0010': {
      code: '0010',
      nameRu: 'Сверхурочные часы',
      nameEn: 'Overtime',
      window: '18:00–20:00',
      defaultMultiplier: 1.5,
      dailyCapHours: 2,
      monthlyCapHours: 12,
      fixedRateOptions: null
    },
    '0030': {
      code: '0030',
      nameRu: 'Работа в вых./праздн. (Отгул)',
      nameEn: 'Weekend / holiday work',
      window: '09:00–17:00',
      defaultMultiplier: 1.5,
      dailyCapHours: null,
      monthlyCapHours: null,
      // Company policy now grants comp-time off by default; cash payment,
      // when it happens, is at either premium (1.5x) or straight (1.0x) rate.
      fixedRateOptions: [1.5, 1.0]
    },
    '0040': {
      code: '0040',
      nameRu: 'Ночные часы',
      nameEn: 'Night hours',
      window: '22:00–06:00',
      defaultMultiplier: 1.2,
      dailyCapHours: null,
      monthlyCapHours: null,
      fixedRateOptions: null
    }
  };

  function toNumber(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }

  /** Monthly salary / workdays in month / daily working hours. */
  function computeHourlyRate(monthlySalary, workdaysInMonth, dailyHours) {
    var salary = toNumber(monthlySalary);
    var workdays = toNumber(workdaysInMonth);
    var hours = toNumber(dailyHours);
    if (salary <= 0 || workdays <= 0 || hours <= 0) return 0;
    return salary / workdays / hours;
  }

  /** Count Mon-Fri days in a given calendar month. month is 1-12. */
  function weekdaysInMonth(year, month) {
    var count = 0;
    var d = new Date(year, month - 1, 1);
    while (d.getMonth() === month - 1) {
      var day = d.getDay();
      if (day !== 0 && day !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  /**
   * Apply the 0010 daily (2h) / monthly (12h) caps and price every entry.
   * entries: [{id, date, category, hours}], processed in date order so caps
   * are consumed chronologically.
   */
  function processEntries(entries, multipliers, hourlyRate) {
    var sorted = entries.slice().sort(function (a, b) {
      if (a.date === b.date) return 0;
      return a.date < b.date ? -1 : 1;
    });

    var dailyUsed = {}; // date -> hours already consumed against 0010 daily cap
    var monthlyUsed = 0; // hours already consumed against 0010 monthly cap
    var warnings = [];
    var rows = [];

    sorted.forEach(function (entry) {
      var cat = CATEGORIES[entry.category];
      var reportedHours = toNumber(entry.hours);
      var multiplier = toNumber(multipliers[entry.category]);
      var payableHours = reportedHours;
      var excessHours = 0;

      if (cat && cat.code === '0010') {
        var usedToday = dailyUsed[entry.date] || 0;
        var dailyRemaining = Math.max(cat.dailyCapHours - usedToday, 0);
        var afterDailyCap = Math.min(reportedHours, dailyRemaining);
        var excessDaily = reportedHours - afterDailyCap;
        dailyUsed[entry.date] = usedToday + afterDailyCap;

        var monthlyRemaining = Math.max(cat.monthlyCapHours - monthlyUsed, 0);
        payableHours = Math.min(afterDailyCap, monthlyRemaining);
        var excessMonthly = afterDailyCap - payableHours;
        monthlyUsed += payableHours;

        excessHours = excessDaily + excessMonthly;

        if (excessDaily > 0) {
          warnings.push(
            entry.date + ': ' + excessDaily.toFixed(2) +
            'h over the 2h/day cap for 0010 (unpaid).'
          );
        }
        if (excessMonthly > 0) {
          warnings.push(
            entry.date + ': ' + excessMonthly.toFixed(2) +
            'h over the 12h/month cap for 0010 (unpaid).'
          );
        }
      }

      var pay = payableHours * hourlyRate * multiplier;

      rows.push({
        id: entry.id,
        date: entry.date,
        category: entry.category,
        reportedHours: reportedHours,
        payableHours: payableHours,
        excessHours: excessHours,
        multiplier: multiplier,
        pay: pay
      });
    });

    return { rows: rows, warnings: warnings };
  }

  /**
   * Full forward summary: hourly rate, priced entries, totals, tax split.
   * settings: {monthlySalary, workdaysInMonth, dailyHours, taxRatePercent,
   *            multipliers: {'0010':n,'0030':n,'0040':n}}
   */
  function computeSummary(entries, settings) {
    var hourlyRate = computeHourlyRate(
      settings.monthlySalary, settings.workdaysInMonth, settings.dailyHours
    );
    var processed = processEntries(entries, settings.multipliers, hourlyRate);

    var totalsByCategory = {};
    Object.keys(CATEGORIES).forEach(function (code) {
      totalsByCategory[code] = { hours: 0, pay: 0 };
    });

    var totalGrossOvertime = 0;
    processed.rows.forEach(function (row) {
      totalsByCategory[row.category].hours += row.payableHours;
      totalsByCategory[row.category].pay += row.pay;
      totalGrossOvertime += row.pay;
    });

    var taxRate = toNumber(settings.taxRatePercent) / 100;
    var taxAmount = totalGrossOvertime * taxRate;
    var netOvertime = totalGrossOvertime - taxAmount;

    return {
      hourlyRate: hourlyRate,
      rows: processed.rows,
      warnings: processed.warnings,
      totalsByCategory: totalsByCategory,
      totalGrossOvertime: totalGrossOvertime,
      taxRate: taxRate,
      taxAmount: taxAmount,
      netOvertime: netOvertime
    };
  }

  /**
   * Reverse calculation: from a payment amount (gross or net) back to the
   * number of overtime hours it implies, given an hourly rate and multiplier.
   */
  function reverseCalculate(paymentAmount, amountType, hourlyRate, multiplier, taxRatePercent) {
    var amount = toNumber(paymentAmount);
    var taxRate = toNumber(taxRatePercent) / 100;
    var gross, net;

    if (amountType === 'net') {
      net = amount;
      gross = taxRate < 1 ? amount / (1 - taxRate) : amount;
    } else {
      gross = amount;
      net = gross * (1 - taxRate);
    }

    var rate = toNumber(hourlyRate);
    var mult = toNumber(multiplier);
    var payPerHour = rate * mult;
    var hours = payPerHour > 0 ? gross / payPerHour : 0;

    return {
      grossPayment: gross,
      netPayment: net,
      payPerHour: payPerHour,
      hours: hours
    };
  }

  return {
    CATEGORIES: CATEGORIES,
    computeHourlyRate: computeHourlyRate,
    weekdaysInMonth: weekdaysInMonth,
    processEntries: processEntries,
    computeSummary: computeSummary,
    reverseCalculate: reverseCalculate
  };
});
