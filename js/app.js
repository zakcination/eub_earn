(function () {
  'use strict';

  var Calc = window.OvertimeCalc;
  var State = window.OvertimeState;
  var CATEGORIES = Calc.CATEGORIES;

  var entries = []; // {id, date, category, hours}
  var nextId = 1;
  var HOURS_STEP = 0.5; // 30-minute counter step

  // ---------- element refs ----------
  var el = {
    month: document.getElementById('month'),
    currency: document.getElementById('currency'),
    monthlySalary: document.getElementById('monthlySalary'),
    workdaysInMonth: document.getElementById('workdaysInMonth'),
    calcWeekdaysBtn: document.getElementById('calcWeekdaysBtn'),
    dailyHours: document.getElementById('dailyHours'),
    taxRatePercent: document.getElementById('taxRatePercent'),
    rate0030: document.getElementById('rate0030'),
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
    reverseCapHint: document.getElementById('reverseCapHint'),

    shareBtn: document.getElementById('shareBtn'),
    shareBox: document.getElementById('shareBox'),
    shareUrl: document.getElementById('shareUrl'),
    copyShareBtn: document.getElementById('copyShareBtn')
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
        '0010': CATEGORIES['0010'].defaultMultiplier,
        '0030': el.rate0030.value,
        '0040': CATEGORIES['0040'].defaultMultiplier
      }
    };
  }

  function multiplierForCategory(code) {
    var cat = CATEGORIES[code];
    if (!cat) return 0;
    if (cat.multiplierMode === 'fixed') return cat.defaultMultiplier;
    if (code === '0030') return Number(el.rate0030.value) || 0;
    return cat.defaultMultiplier;
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

  /** Replace all entries with a restored/imported list (fresh ids, no render). */
  function loadEntries(list) {
    entries = (list || []).map(function (e) {
      return {
        id: nextId++,
        date: e.date || '',
        category: e.category || '0010',
        hours: e.hours || ''
      };
    });
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
      tr.appendChild(makeCell('Hours reported (30-min steps)', makeHoursCounter(entry)));
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
    persistLocalState();
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

  function roundToStep(n) {
    return Math.round(n / HOURS_STEP) * HOURS_STEP;
  }

  function makeHoursCounter(entry) {
    var wrap = document.createElement('div');
    wrap.className = 'hours-counter';

    var minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.className = 'counter-btn';
    minusBtn.textContent = '−';
    minusBtn.setAttribute('aria-label', 'Subtract 30 minutes');

    var input = document.createElement('input');
    input.type = 'number';
    input.className = 'counter-value';
    input.min = '0';
    input.step = String(HOURS_STEP);
    input.value = entry.hours;
    input.inputMode = 'decimal';

    var plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'counter-btn';
    plusBtn.textContent = '+';
    plusBtn.setAttribute('aria-label', 'Add 30 minutes');

    function commit(value) {
      var n = Math.max(0, roundToStep(Number(value) || 0));
      entry.hours = n;
      renderEntries();
    }

    minusBtn.addEventListener('click', function () {
      commit((Number(input.value) || 0) - HOURS_STEP);
    });
    plusBtn.addEventListener('click', function () {
      commit((Number(input.value) || 0) + HOURS_STEP);
    });
    input.addEventListener('change', function () {
      commit(input.value);
    });

    wrap.appendChild(minusBtn);
    wrap.appendChild(input);
    wrap.appendChild(plusBtn);
    return wrap;
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

  // ---------- local persistence & anonymized sharing ----------
  function collectStateFields() {
    return {
      month: el.month.value,
      currency: el.currency.value,
      monthlySalary: el.monthlySalary.value,
      workdaysInMonth: el.workdaysInMonth.value,
      dailyHours: el.dailyHours.value,
      taxRatePercent: el.taxRatePercent.value,
      rate0030: el.rate0030.value,
      entries: entries
    };
  }

  function persistLocalState() {
    try {
      var state = State.buildFullState(collectStateFields());
      window.localStorage.setItem(State.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // localStorage unavailable (private browsing, quota) - saving is best-effort.
    }
  }

  function loadLocalState() {
    try {
      var raw = window.localStorage.getItem(State.STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.entries)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function applyState(state, includeSalary) {
    if (typeof state.month === 'string') el.month.value = state.month;
    if (includeSalary) {
      if (typeof state.currency === 'string') el.currency.value = state.currency;
      if (state.monthlySalary != null) el.monthlySalary.value = state.monthlySalary;
    }
    if (state.workdaysInMonth != null) el.workdaysInMonth.value = state.workdaysInMonth;
    if (state.dailyHours != null) el.dailyHours.value = state.dailyHours;
    if (state.taxRatePercent != null) el.taxRatePercent.value = state.taxRatePercent;
    if (state.rate0030 != null) el.rate0030.value = state.rate0030;
    loadEntries(state.entries);
  }

  function parseShareFromLocation() {
    var match = (window.location.hash || '').match(/[#&]s=([^&]+)/);
    if (!match) return null;
    return State.decodeState(decodeURIComponent(match[1]));
  }

  function clearShareHashFromUrl() {
    var url = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', url);
  }

  function buildShareUrl() {
    var shareable = State.buildShareableState(collectStateFields());
    var encoded = State.encodeState(shareable);
    return window.location.origin + window.location.pathname + '#s=' + encodeURIComponent(encoded);
  }

  function flashCopied(button, resetText) {
    button.textContent = 'Copied!';
    setTimeout(function () { button.textContent = resetText; }, 1500);
  }

  function copyText(text, button, resetText) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        flashCopied(button, resetText);
      }).catch(function () { /* clipboard denied - the visible field is the fallback */ });
    }
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
     el.rate0030, el.currency, el.month].forEach(function (input) {
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

  el.shareBtn.addEventListener('click', function () {
    var url = buildShareUrl();
    el.shareUrl.value = url;
    el.shareBox.hidden = false;
    el.shareUrl.focus();
    el.shareUrl.select();
    copyText(url, el.shareBtn, '🔗 Share anonymized link');
  });

  el.copyShareBtn.addEventListener('click', function () {
    el.shareUrl.select();
    copyText(el.shareUrl.value, el.copyShareBtn, 'Copy');
  });

  // ---------- init ----------
  (function init() {
    var shared = parseShareFromLocation();
    if (shared) {
      applyState(shared, false);
      clearShareHashFromUrl();
    } else {
      var saved = loadLocalState();
      if (saved) {
        applyState(saved, true);
      } else {
        var today = new Date();
        el.month.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
        el.workdaysInMonth.value = Calc.weekdaysInMonth(today.getFullYear(), today.getMonth() + 1);
        addRow({ date: '', category: '0010', hours: '' });
      }
    }

    syncReverseMultiplierDefault();
    recalcAll();
  })();
})();
