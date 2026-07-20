(function () {
  'use strict';

  var Calc = window.OvertimeCalc;
  var CATEGORIES = Calc.CATEGORIES;

  var entries = []; // {id, date, category, hours}
  var nextId = 1;

  // ---------- element refs ----------
  var el = {
    month: document.getElementById('month'),
    currency: document.getElementById('currency'),
    monthlySalary: document.getElementById('monthlySalary'),
    workdaysInMonth: document.getElementById('workdaysInMonth'),
    calcWeekdaysBtn: document.getElementById('calcWeekdaysBtn'),
    dailyHours: document.getElementById('dailyHours'),
    taxRatePercent: document.getElementById('taxRatePercent'),
    rate0010: document.getElementById('rate0010'),
    rate0030: document.getElementById('rate0030'),
    rate0040: document.getElementById('rate0040'),
    hourlyRateOut: document.getElementById('hourlyRateOut'),

    entriesBody: document.getElementById('entriesBody'),
    addRowBtn: document.getElementById('addRowBtn'),
    warningsBox: document.getElementById('warningsBox'),
    categoryTotalsBody: document.getElementById('categoryTotalsBody'),
    totalGrossOut: document.getElementById('totalGrossOut'),
    taxAmountOut: document.getElementById('taxAmountOut'),
    netOvertimeOut: document.getElementById('netOvertimeOut'),

    reverseAmount: document.getElementById('reverseAmount'),
    reverseCategory: document.getElementById('reverseCategory'),
    reverseMultiplier: document.getElementById('reverseMultiplier'),
    reverseHourlyRateOut: document.getElementById('reverseHourlyRateOut'),
    reverseGrossOut: document.getElementById('reverseGrossOut'),
    reverseNetOut: document.getElementById('reverseNetOut'),
    reverseHoursOut: document.getElementById('reverseHoursOut'),
    reverseCapHint: document.getElementById('reverseCapHint')
  };

  // ---------- helpers ----------
  function currency() {
    return el.currency.value.trim();
  }

  function fmtMoney(n) {
    var c = currency();
    var num = (Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    return c ? num + ' ' + c : num;
  }

  function fmtHours(n) {
    return (Math.round((n + Number.EPSILON) * 100) / 100) + ' h';
  }

  function currentSettings() {
    return {
      monthlySalary: el.monthlySalary.value,
      workdaysInMonth: el.workdaysInMonth.value,
      dailyHours: el.dailyHours.value,
      taxRatePercent: el.taxRatePercent.value,
      multipliers: {
        '0010': el.rate0010.value,
        '0030': el.rate0030.value,
        '0040': el.rate0040.value
      }
    };
  }

  function multiplierForCategory(code) {
    if (code === '0010') return Number(el.rate0010.value) || 0;
    if (code === '0030') return Number(el.rate0030.value) || 0;
    if (code === '0040') return Number(el.rate0040.value) || 0;
    return 0;
  }

  function categoryLabel(code) {
    var cat = CATEGORIES[code];
    return code + ' — ' + cat.nameEn;
  }

  // ---------- entries table ----------
  function addRow(prefill) {
    var entry = {
      id: nextId++,
      date: (prefill && prefill.date) || '',
      category: (prefill && prefill.category) || '0010',
      hours: (prefill && prefill.hours) || ''
    };
    entries.push(entry);
    renderEntries();
  }

  function removeRow(id) {
    entries = entries.filter(function (e) { return e.id !== id; });
    renderEntries();
  }

  function renderEntries() {
    el.entriesBody.innerHTML = '';

    var settings = currentSettings();
    var hourlyRate = Calc.computeHourlyRate(settings.monthlySalary, settings.workdaysInMonth, settings.dailyHours);
    var processed = Calc.processEntries(entries, settings.multipliers, hourlyRate);
    var rowsById = {};
    processed.rows.forEach(function (r) { rowsById[r.id] = r; });

    entries.forEach(function (entry) {
      var tr = document.createElement('tr');
      var computed = rowsById[entry.id];

      tr.appendChild(makeCell('Date', makeDateInput(entry)));
      tr.appendChild(makeCell('Category', makeCategorySelect(entry)));
      tr.appendChild(makeCell('Hours reported', makeHoursInput(entry)));
      tr.appendChild(makeCell('Hours payable', document.createTextNode(
        computed ? fmtHours(computed.payableHours) : '—'
      )));
      tr.appendChild(makeCell('Multiplier', document.createTextNode(
        computed ? computed.multiplier + 'x' : '—'
      )));
      tr.appendChild(makeCell('Pay', document.createTextNode(
        computed ? fmtMoney(computed.pay) : '—'
      )));

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'row-remove-btn';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove day';
      removeBtn.addEventListener('click', function () { removeRow(entry.id); });
      tr.appendChild(makeCell('', removeBtn));

      el.entriesBody.appendChild(tr);
    });

    renderWarnings(processed.warnings);
    renderTotals(settings, hourlyRate, processed);
  }

  function makeCell(label, contentOrNode) {
    var td = document.createElement('td');
    td.setAttribute('data-label', label);
    if (contentOrNode instanceof Node) {
      td.appendChild(contentOrNode);
    } else {
      td.textContent = contentOrNode;
    }
    return td;
  }

  function makeDateInput(entry) {
    var input = document.createElement('input');
    input.type = 'date';
    input.value = entry.date;
    input.addEventListener('input', function () {
      entry.date = input.value;
      renderEntries();
    });
    return input;
  }

  function makeCategorySelect(entry) {
    var select = document.createElement('select');
    Object.keys(CATEGORIES).forEach(function (code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = categoryLabel(code);
      if (code === entry.category) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', function () {
      entry.category = select.value;
      renderEntries();
    });
    return select;
  }

  function makeHoursInput(entry) {
    var input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = 'any';
    input.value = entry.hours;
    input.addEventListener('input', function () {
      entry.hours = input.value;
      renderEntries();
    });
    return input;
  }

  function renderWarnings(warnings) {
    if (!warnings.length) {
      el.warningsBox.hidden = true;
      el.warningsBox.innerHTML = '';
      return;
    }
    el.warningsBox.hidden = false;
    var html = '<strong>Caps applied:</strong><ul>' +
      warnings.map(function (w) { return '<li>' + escapeHtml(w) + '</li>'; }).join('') +
      '</ul>';
    el.warningsBox.innerHTML = html;
  }

  function renderTotals(settings, hourlyRate, processed) {
    el.hourlyRateOut.textContent = hourlyRate > 0 ? fmtMoney(hourlyRate) + ' / h' : '—';

    var summary = Calc.computeSummary(entries, settings);

    el.categoryTotalsBody.innerHTML = '';
    Object.keys(CATEGORIES).forEach(function (code) {
      var t = summary.totalsByCategory[code];
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(categoryLabel(code)) + '</td>' +
        '<td>' + fmtHours(t.hours) + '</td>' +
        '<td>' + fmtMoney(t.pay) + '</td>';
      el.categoryTotalsBody.appendChild(tr);
    });

    el.totalGrossOut.textContent = fmtMoney(summary.totalGrossOvertime);
    el.taxAmountOut.textContent = fmtMoney(summary.taxAmount);
    el.netOvertimeOut.textContent = fmtMoney(summary.netOvertime);
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ---------- reverse calculator ----------
  function reverseAmountType() {
    var checked = document.querySelector('input[name="reverseAmountType"]:checked');
    return checked ? checked.value : 'net';
  }

  function syncReverseMultiplierDefault() {
    el.reverseMultiplier.value = multiplierForCategory(el.reverseCategory.value);
  }

  function renderReverse() {
    var settings = currentSettings();
    var hourlyRate = Calc.computeHourlyRate(settings.monthlySalary, settings.workdaysInMonth, settings.dailyHours);
    var result = Calc.reverseCalculate(
      el.reverseAmount.value,
      reverseAmountType(),
      hourlyRate,
      el.reverseMultiplier.value,
      settings.taxRatePercent
    );

    el.reverseHourlyRateOut.textContent = hourlyRate > 0 ? fmtMoney(hourlyRate) + ' / h' : '—';
    el.reverseGrossOut.textContent = fmtMoney(result.grossPayment);
    el.reverseNetOut.textContent = fmtMoney(result.netPayment);
    el.reverseHoursOut.textContent = fmtHours(result.hours);

    var cat = CATEGORIES[el.reverseCategory.value];
    if (cat && cat.dailyCapHours) {
      var days = result.hours / cat.dailyCapHours;
      el.reverseCapHint.textContent =
        '≈ ' + (Math.round(days * 100) / 100) + ' day(s) at the ' + cat.dailyCapHours + 'h/day cap for ' + cat.code + '.';
    } else {
      el.reverseCapHint.textContent = '';
    }
  }

  // ---------- wiring ----------
  function recalcAll() {
    renderEntries();
    renderReverse();
  }

  ['input', 'change'].forEach(function (evt) {
    [el.monthlySalary, el.workdaysInMonth, el.dailyHours, el.taxRatePercent,
     el.rate0010, el.rate0030, el.rate0040, el.currency, el.month].forEach(function (input) {
      input.addEventListener(evt, recalcAll);
    });
  });

  el.calcWeekdaysBtn.addEventListener('click', function () {
    if (!el.month.value) return;
    var parts = el.month.value.split('-');
    var year = Number(parts[0]);
    var monthNum = Number(parts[1]);
    el.workdaysInMonth.value = Calc.weekdaysInMonth(year, monthNum);
    recalcAll();
  });

  el.addRowBtn.addEventListener('click', function () { addRow(); });

  el.reverseCategory.addEventListener('change', function () {
    syncReverseMultiplierDefault();
    renderReverse();
  });
  el.reverseMultiplier.addEventListener('input', renderReverse);
  el.reverseAmount.addEventListener('input', renderReverse);
  document.querySelectorAll('input[name="reverseAmountType"]').forEach(function (r) {
    r.addEventListener('change', renderReverse);
  });

  // ---------- init ----------
  (function init() {
    var today = new Date();
    el.month.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    el.workdaysInMonth.value = Calc.weekdaysInMonth(today.getFullYear(), today.getMonth() + 1);

    addRow({ date: '', category: '0010', hours: '' });
    syncReverseMultiplierDefault();
    recalcAll();
  })();
})();
