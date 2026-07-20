(function () {
  'use strict';

  var Calc = window.OvertimeCalc;
  var State = window.OvertimeState;
  var CATEGORIES = Calc.CATEGORIES;

  var MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var FILTER_LABELS = { all: 'Все', '0010': 'Сверхур.', '0030': 'Выходные', '0040': 'Ночные' };
  var HOURS_STEP = 0.5;
  var HOURS_MAX = 24;

  var nextId = 1;
  var state = {
    tab: 'earn',
    filter: 'all',
    settings: {
      year: 0, month: 0,
      currency: '₸',
      monthlySalary: '',
      workdaysInMonth: '',
      dailyHours: '9',
      taxRatePercent: '20',
      rate0030: 1.5
    },
    entries: [],
    reverse: { amount: '', basis: 'net', category: '0030', rate: 1.5 },
    netDisp: 0,
    hoursDisp: 0
  };

  // ---------- element refs ----------
  var el = {
    sectionLabel: document.getElementById('sectionLabel'),
    scrollArea: document.getElementById('scrollArea'),

    shareBtn: document.getElementById('shareBtn'),
    shareBox: document.getElementById('shareBox'),
    shareUrl: document.getElementById('shareUrl'),
    copyShareBtn: document.getElementById('copyShareBtn'),

    tabSettings: document.getElementById('tab-settings'),
    tabEarn: document.getElementById('tab-earn'),
    tabReverse: document.getElementById('tab-reverse'),
    navSettingsBtn: document.getElementById('navSettingsBtn'),
    navEarnBtn: document.getElementById('navEarnBtn'),
    navReverseBtn: document.getElementById('navReverseBtn'),

    hourlyHero: document.getElementById('hourlyHero'),
    formulaStr: document.getElementById('formulaStr'),
    prevMonthBtn: document.getElementById('prevMonthBtn'),
    nextMonthBtn: document.getElementById('nextMonthBtn'),
    monthLabel: document.getElementById('monthLabel'),
    monthlySalary: document.getElementById('monthlySalary'),
    salaryCurSuffix: document.getElementById('salaryCurSuffix'),
    workdaysInMonth: document.getElementById('workdaysInMonth'),
    autoWorkdaysBtn: document.getElementById('autoWorkdaysBtn'),
    autoCount: document.getElementById('autoCount'),
    dailyHours: document.getElementById('dailyHours'),
    taxRatePercent: document.getElementById('taxRatePercent'),
    currency: document.getElementById('currency'),
    defaultRate0030Seg: document.getElementById('defaultRate0030Seg'),

    earnMonthLabel: document.getElementById('earnMonthLabel'),
    needsSalaryWarn: document.getElementById('needsSalaryWarn'),
    netHero: document.getElementById('netHero'),
    grossStat: document.getElementById('grossStat'),
    taxStat: document.getElementById('taxStat'),
    chipsRow: document.getElementById('chipsRow'),
    subtotalBar: document.getElementById('subtotalBar'),
    subtotalStr: document.getElementById('subtotalStr'),
    entriesList: document.getElementById('entriesList'),
    addDayBtn: document.getElementById('addDayBtn'),
    emptyState: document.getElementById('emptyState'),
    emptyAddBtn: document.getElementById('emptyAddBtn'),

    hoursHero: document.getElementById('hoursHero'),
    revSubline: document.getElementById('revSubline'),
    reverseAmount: document.getElementById('reverseAmount'),
    reverseCurSuffix: document.getElementById('reverseCurSuffix'),
    basisSeg: document.getElementById('basisSeg'),
    revCatName: document.getElementById('revCatName'),
    reverseCategory: document.getElementById('reverseCategory'),
    reverseRateSeg: document.getElementById('reverseRateSeg'),
    breakdownCard: document.getElementById('breakdownCard'),
    hrUsed: document.getElementById('hrUsed'),
    revGrossStr: document.getElementById('revGrossStr'),
    revNetStr: document.getElementById('revNetStr'),
    hoursSettled: document.getElementById('hoursSettled'),
    daysHint: document.getElementById('daysHint'),
    daysHintText: document.getElementById('daysHintText'),
    noAmountHint: document.getElementById('noAmountHint')
  };

  // ---------- formatting ----------
  function groupThousands(intVal) {
    return String(intVal).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function fmtMoney(n, dec) {
    if (dec === undefined) dec = 2;
    if (!isFinite(n)) n = 0;
    var neg = n < 0;
    n = Math.abs(n);
    var cur = state.settings.currency ? ' ' + state.settings.currency : '';
    if (dec === 0) return (neg ? '−' : '') + groupThousands(Math.round(n)) + cur;
    var parts = n.toFixed(dec).split('.');
    return (neg ? '−' : '') + groupThousands(parts[0]) + '.' + parts[1] + cur;
  }

  function fmtHours(h) {
    return (Math.round(h * 10) / 10).toFixed(1) + ' ч';
  }

  function rateLabel(r) {
    return Number(r) === 1.5 ? '1.5' : '1.0';
  }

  function dateLabel(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (isNaN(d.getTime())) return iso;
    return WEEKDAY_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()];
  }

  function monthLabelStr() {
    return MONTHS[state.settings.month] + ' ' + state.settings.year;
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ---------- calc bridge ----------
  function multipliersForCalc() {
    return {
      '0010': CATEGORIES['0010'].defaultMultiplier,
      '0030': Number(state.settings.rate0030) || CATEGORIES['0030'].defaultMultiplier,
      '0040': CATEGORIES['0040'].defaultMultiplier
    };
  }

  function hourlyRate() {
    return Calc.computeHourlyRate(state.settings.monthlySalary, state.settings.workdaysInMonth, state.settings.dailyHours);
  }

  function computeSummary() {
    return Calc.computeSummary(state.entries, {
      monthlySalary: state.settings.monthlySalary,
      workdaysInMonth: state.settings.workdaysInMonth,
      dailyHours: state.settings.dailyHours,
      taxRatePercent: state.settings.taxRatePercent,
      multipliers: multipliersForCalc()
    });
  }

  function reverseResult() {
    return Calc.reverseCalculate(
      state.reverse.amount, state.reverse.basis, hourlyRate(), state.reverse.rate, state.settings.taxRatePercent
    );
  }

  // ---------- animated hero numbers ----------
  var tweenRaf = {}, tweenTimeout = {};
  function tween(key, target, onFrame) {
    cancelAnimationFrame(tweenRaf[key]);
    clearTimeout(tweenTimeout[key]);
    var start = state[key];
    var t0 = performance.now(), dur = 480;
    function tick(now) {
      var p = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      state[key] = start + (target - start) * eased;
      onFrame(state[key]);
      if (p < 1) tweenRaf[key] = requestAnimationFrame(tick);
    }
    tweenRaf[key] = requestAnimationFrame(tick);
    tweenTimeout[key] = setTimeout(function () {
      state[key] = target;
      onFrame(target);
    }, dur + 60);
  }

  function popCounter(entryId) {
    var wrap = document.querySelector('.entry-card[data-id="' + entryId + '"] .counter-value-wrap');
    if (!wrap) return;
    wrap.classList.add('pop');
    setTimeout(function () { wrap.classList.remove('pop'); }, 190);
  }

  // ---------- tab switching ----------
  var TAB_LABELS = { settings: 'Настройки', earn: 'Расчёт', reverse: 'Обратный' };
  function setTab(tab) {
    state.tab = tab;
    el.tabSettings.hidden = tab !== 'settings';
    el.tabEarn.hidden = tab !== 'earn';
    el.tabReverse.hidden = tab !== 'reverse';
    el.sectionLabel.textContent = TAB_LABELS[tab];
    [el.navSettingsBtn, el.navEarnBtn, el.navReverseBtn].forEach(function (btn) {
      btn.classList.toggle('on', btn.dataset.tab === tab);
    });
    el.scrollArea.scrollTop = 0;
  }

  // ---------- entries ----------
  function sortedEntries() {
    return state.entries.slice().sort(function (a, b) {
      if (a.date === b.date) return a.id - b.id;
      return a.date < b.date ? -1 : 1;
    });
  }

  function addEntry() {
    var s = state.settings;
    var daysInMonth = new Date(s.year, s.month + 1, 0).getDate();
    var day = Math.min(new Date().getDate(), daysInMonth);
    var date = s.year + '-' + String(s.month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    state.entries.push({ id: nextId++, category: '0010', hours: 1.0, rate: 1.0, date: date });
    renderAll();
  }

  function removeEntry(id) {
    state.entries = state.entries.filter(function (e) { return e.id !== id; });
    renderAll();
  }

  function stepEntry(id, dir) {
    state.entries = state.entries.map(function (e) {
      if (e.id !== id) return e;
      var v = Math.round((e.hours + dir * HOURS_STEP) * 2) / 2;
      v = Math.max(0, Math.min(HOURS_MAX, v));
      return Object.assign({}, e, { hours: v });
    });
    renderAll();
    popCounter(id);
  }

  function typeHours(id, val) {
    var v = Number(val);
    if (!isFinite(v)) v = 0;
    v = Math.max(0, Math.min(HOURS_MAX, Math.round(v * 2) / 2));
    state.entries = state.entries.map(function (e) { return e.id === id ? Object.assign({}, e, { hours: v }) : e; });
    renderAll();
  }

  function setEntryCategory(id, code) {
    state.entries = state.entries.map(function (e) {
      if (e.id !== id) return e;
      var cfg = CATEGORIES[code];
      var rate = cfg.multiplierMode === 'fixed' ? cfg.defaultMultiplier : (Number(state.settings.rate0030) || 1.5);
      return Object.assign({}, e, { category: code, rate: rate });
    });
    renderAll();
  }

  function setEntryRate(id, rate) {
    state.entries = state.entries.map(function (e) { return e.id === id ? Object.assign({}, e, { rate: rate }) : e; });
    renderAll();
  }

  function setEntryDate(id, date) {
    state.entries = state.entries.map(function (e) { return e.id === id ? Object.assign({}, e, { date: date }) : e; });
    renderAll();
  }

  // ---------- rendering: settings tab ----------
  function renderSettingsTab() {
    var s = state.settings;
    var hr = hourlyRate();
    el.hourlyHero.textContent = hr > 0 ? fmtMoney(hr) : '—';
    el.formulaStr.textContent =
      fmtMoney(Number(s.monthlySalary) || 0, 0) + '  ÷  ' + (Number(s.workdaysInMonth) || 0) +
      ' раб. дн.  ÷  ' + (Number(s.dailyHours) || 0) + ' ч';
    el.monthLabel.textContent = monthLabelStr();
    el.autoCount.textContent = String(Calc.weekdaysInMonth(s.year, s.month + 1));
    el.salaryCurSuffix.textContent = s.currency;
    el.reverseCurSuffix.textContent = s.currency;

    if (document.activeElement !== el.monthlySalary) el.monthlySalary.value = s.monthlySalary;
    if (document.activeElement !== el.workdaysInMonth) el.workdaysInMonth.value = s.workdaysInMonth;
    if (document.activeElement !== el.dailyHours) el.dailyHours.value = s.dailyHours;
    if (document.activeElement !== el.taxRatePercent) el.taxRatePercent.value = s.taxRatePercent;
    if (document.activeElement !== el.currency) el.currency.value = s.currency;

    Array.prototype.forEach.call(el.defaultRate0030Seg.querySelectorAll('.seg-btn'), function (btn) {
      btn.classList.toggle('on', Number(btn.dataset.rate) === Number(s.rate0030));
    });
  }

  // ---------- rendering: earn tab ----------
  function makeEntryCard(row, entry) {
    var cfg = CATEGORIES[entry.category];
    var card = document.createElement('div');
    card.className = 'entry-card';
    card.setAttribute('data-id', entry.id);

    var head = document.createElement('div');
    head.className = 'entry-head';

    var catWrap = document.createElement('div');
    catWrap.style.minWidth = '0';
    var catInner = document.createElement('div');
    catInner.className = 'entry-cat-wrap';
    var catName = document.createElement('span');
    catName.className = 'entry-cat-name';
    catName.textContent = cfg.nameRu;
    var chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('class', 'entry-cat-chevron');
    chevron.setAttribute('width', '11'); chevron.setAttribute('height', '11'); chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none'); chevron.setAttribute('stroke', 'var(--color-neutral-500)');
    chevron.setAttribute('stroke-width', '2.4'); chevron.setAttribute('stroke-linecap', 'round'); chevron.setAttribute('stroke-linejoin', 'round');
    chevron.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
    var catSelect = document.createElement('select');
    catSelect.className = 'entry-cat-select';
    catSelect.setAttribute('aria-label', 'category');
    Object.keys(CATEGORIES).forEach(function (code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = CATEGORIES[code].nameRu;
      if (code === entry.category) opt.selected = true;
      catSelect.appendChild(opt);
    });
    catSelect.addEventListener('change', function () { setEntryCategory(entry.id, catSelect.value); });
    catInner.appendChild(catName);
    catInner.appendChild(chevron);
    catInner.appendChild(catSelect);
    catWrap.appendChild(catInner);

    var meta = document.createElement('div');
    meta.className = 'entry-meta';
    var metaTime = document.createElement('span');
    metaTime.className = 'entry-meta-time';
    metaTime.textContent = cfg.window;
    meta.appendChild(metaTime);
    var codeBadge = document.createElement('span');
    codeBadge.className = 'code-badge';
    codeBadge.textContent = entry.category;
    meta.appendChild(codeBadge);
    catWrap.appendChild(meta);

    var payCol = document.createElement('div');
    payCol.className = 'entry-pay-col';
    var payEl = document.createElement('div');
    payEl.className = 'entry-pay';
    payEl.textContent = fmtMoney(row.pay);
    var multEl = document.createElement('div');
    multEl.className = 'entry-mult';
    multEl.textContent = fmtHours(row.payableHours) + ' × ' + rateLabel(row.multiplier);
    payCol.appendChild(payEl);
    payCol.appendChild(multEl);

    head.appendChild(catWrap);
    head.appendChild(payCol);
    card.appendChild(head);

    var controls = document.createElement('div');
    controls.className = 'entry-controls';

    var counter = document.createElement('div');
    counter.className = 'counter';
    var decBtn = document.createElement('button');
    decBtn.type = 'button'; decBtn.className = 'counter-btn dec'; decBtn.setAttribute('aria-label', 'decrease 30 minutes');
    decBtn.textContent = '−';
    decBtn.addEventListener('click', function () { stepEntry(entry.id, -1); });
    var valueWrap = document.createElement('div');
    valueWrap.className = 'counter-value-wrap';
    var valueInput = document.createElement('input');
    valueInput.className = 'counter-value';
    valueInput.value = String(entry.hours);
    valueInput.inputMode = 'decimal';
    valueInput.setAttribute('aria-label', 'hours');
    valueInput.addEventListener('change', function () { typeHours(entry.id, valueInput.value); });
    var unit = document.createElement('span');
    unit.className = 'counter-unit';
    unit.textContent = 'ч';
    valueWrap.appendChild(valueInput);
    valueWrap.appendChild(unit);
    var incBtn = document.createElement('button');
    incBtn.type = 'button'; incBtn.className = 'counter-btn inc'; incBtn.setAttribute('aria-label', 'increase 30 minutes');
    incBtn.textContent = '+';
    incBtn.addEventListener('click', function () { stepEntry(entry.id, 1); });
    counter.appendChild(decBtn);
    counter.appendChild(valueWrap);
    counter.appendChild(incBtn);
    controls.appendChild(counter);

    var rateSlot = document.createElement('div');
    rateSlot.className = 'entry-rate-slot';
    if (cfg.multiplierMode === 'variable') {
      var seg = document.createElement('div');
      seg.className = 'seg';
      cfg.rateOptions.forEach(function (r) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'seg-btn' + (Number(row.multiplier) === r ? ' on' : '');
        btn.textContent = rateLabel(r) + '×';
        btn.addEventListener('click', function () { setEntryRate(entry.id, r); });
        seg.appendChild(btn);
      });
      rateSlot.appendChild(seg);
    } else {
      var badge = document.createElement('span');
      badge.className = 'fixed-badge';
      badge.innerHTML =
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' +
        rateLabel(cfg.defaultMultiplier) + '× фикс.';
      rateSlot.appendChild(badge);
    }
    controls.appendChild(rateSlot);
    card.appendChild(controls);

    var footer = document.createElement('div');
    footer.className = 'entry-footer';
    var dateWrap = document.createElement('div');
    dateWrap.className = 'entry-date-wrap';
    dateWrap.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-500)" stroke-width="1.8">' +
      '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="9.5" x2="21" y2="9.5"/>' +
      '<line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/></svg>';
    var dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'entry-date';
    dateInput.value = entry.date;
    dateInput.addEventListener('change', function () { setEntryDate(entry.id, dateInput.value); });
    dateWrap.appendChild(dateInput);
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'entry-remove';
    removeBtn.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
      '<path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/></svg>Удалить';
    removeBtn.addEventListener('click', function () { removeEntry(entry.id); });
    footer.appendChild(dateWrap);
    footer.appendChild(removeBtn);
    card.appendChild(footer);

    if (row.excessHours > 0) {
      var parts = [];
      if (row.excessDaily > 0) parts.push(fmtHours(row.excessDaily) + ' сверх лимита 2 ч/день');
      if (row.excessMonthly > 0) parts.push(fmtHours(row.excessMonthly) + ' сверх лимита 12 ч/месяц');
      var note = document.createElement('div');
      note.className = 'entry-note';
      note.innerHTML =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 3 2 20h20L12 3Z"/><line x1="12" y1="10" x2="12" y2="14.2"/><circle cx="12" cy="17.4" r=".7" fill="currentColor"/></svg>' +
        '<span>' + escapeHtml(dateLabel(entry.date) + ' · ' + parts.join(' + ') + ' — не оплачивается') + '</span>';
      card.appendChild(note);
    }

    return card;
  }

  function renderEarnTab() {
    var summary = computeSummary();
    var rowsById = {};
    summary.rows.forEach(function (r) { rowsById[r.id] = r; });

    el.earnMonthLabel.textContent = monthLabelStr();
    el.needsSalaryWarn.hidden = hourlyRate() > 0;
    el.grossStat.textContent = fmtMoney(summary.totalGrossOvertime, 0);
    el.taxStat.textContent = '− ' + fmtMoney(summary.taxAmount, 0);
    tween('netDisp', summary.netOvertime, function (v) { el.netHero.textContent = fmtMoney(v, 0); });

    var list = sortedEntries().map(function (e) { return { entry: e, row: rowsById[e.id] }; });

    el.emptyState.hidden = list.length > 0;
    el.addDayBtn.hidden = list.length === 0;
    el.chipsRow.hidden = list.length === 0;
    el.subtotalBar.hidden = list.length === 0;
    el.entriesList.hidden = list.length === 0;

    if (list.length === 0) return;

    // chips
    el.chipsRow.innerHTML = '';
    ['all', '0010', '0030', '0040'].forEach(function (key) {
      var count = key === 'all' ? list.length : list.filter(function (x) { return x.entry.category === key; }).length;
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (state.filter === key ? ' on' : '');
      chip.innerHTML = escapeHtml(FILTER_LABELS[key]) + ' <span class="chip-count">' + count + '</span>';
      chip.addEventListener('click', function () { state.filter = key; renderEarnTab(); });
      el.chipsRow.appendChild(chip);
    });

    var scope = state.filter === 'all' ? list : list.filter(function (x) { return x.entry.category === state.filter; });
    var scopePayable = scope.reduce(function (a, x) { return a + x.row.payableHours; }, 0);
    var scopePay = scope.reduce(function (a, x) { return a + x.row.pay; }, 0);
    el.subtotalStr.textContent = scope.length + ' дн. · ' + fmtHours(scopePayable) + ' к оплате · ' + fmtMoney(scopePay);

    el.entriesList.innerHTML = '';
    scope.forEach(function (x) {
      el.entriesList.appendChild(makeEntryCard(x.row, x.entry));
    });
  }

  // ---------- rendering: reverse tab ----------
  function renderReverseTab() {
    var r = state.reverse;
    var cfg = CATEGORIES[r.category];
    var result = reverseResult();
    var amt = Number(r.amount) || 0;

    el.revCatName.textContent = cfg.nameRu;
    if (document.activeElement !== el.reverseCategory) el.reverseCategory.value = r.category;
    if (document.activeElement !== el.reverseAmount) el.reverseAmount.value = r.amount;

    Array.prototype.forEach.call(el.basisSeg.querySelectorAll('.seg-btn'), function (btn) {
      btn.classList.toggle('on', btn.dataset.basis === r.basis);
    });
    Array.prototype.forEach.call(el.reverseRateSeg.querySelectorAll('.seg-btn'), function (btn) {
      btn.classList.toggle('on', Number(btn.dataset.rate) === Number(r.rate));
    });

    el.revSubline.textContent = amt > 0
      ? ('из ' + fmtMoney(amt) + ' · ' + (r.basis === 'net' ? 'на руки (после налога)' : 'начислено'))
      : 'Введите сумму выплаты ниже';

    tween('hoursDisp', result.hours, function (v) { el.hoursHero.textContent = fmtHours(v); });

    el.breakdownCard.hidden = amt <= 0;
    el.noAmountHint.hidden = amt > 0;
    if (amt > 0) {
      el.hrUsed.textContent = fmtMoney(hourlyRate());
      el.revGrossStr.textContent = fmtMoney(result.grossPayment);
      el.revNetStr.textContent = fmtMoney(result.netPayment);
      el.hoursSettled.textContent = fmtHours(result.hours);
      var isCapped = cfg.dailyCapHours != null;
      el.daysHint.hidden = !isCapped;
      if (isCapped) {
        el.daysHintText.textContent = '≈ ' + (result.hours / cfg.dailyCapHours).toFixed(1) + ' дн. при лимите ' + cfg.dailyCapHours + ' ч/день';
      }
    }
  }

  // ---------- persistence & sharing ----------
  function collectStateFields() {
    return {
      year: state.settings.year,
      month: state.settings.month,
      currency: state.settings.currency,
      monthlySalary: state.settings.monthlySalary,
      workdaysInMonth: state.settings.workdaysInMonth,
      dailyHours: state.settings.dailyHours,
      taxRatePercent: state.settings.taxRatePercent,
      rate0030: state.settings.rate0030,
      entries: state.entries
    };
  }

  function persistLocalState() {
    try {
      var full = State.buildFullState(collectStateFields());
      window.localStorage.setItem(State.STORAGE_KEY, JSON.stringify(full));
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

  function applyState(saved, includeSalary) {
    var s = state.settings;
    if (saved.year != null) s.year = Number(saved.year);
    if (saved.month != null) s.month = Number(saved.month);
    if (includeSalary) {
      if (typeof saved.currency === 'string') s.currency = saved.currency;
      if (saved.monthlySalary != null) s.monthlySalary = saved.monthlySalary;
    }
    if (saved.workdaysInMonth != null) s.workdaysInMonth = saved.workdaysInMonth;
    if (saved.dailyHours != null) s.dailyHours = saved.dailyHours;
    if (saved.taxRatePercent != null) s.taxRatePercent = saved.taxRatePercent;
    if (saved.rate0030 != null) s.rate0030 = saved.rate0030;

    state.entries = (saved.entries || []).map(function (e) {
      return { id: nextId++, date: e.date || '', category: e.category || '0010', hours: e.hours != null ? e.hours : 1, rate: e.rate != null ? e.rate : 1.5 };
    });
  }

  function parseShareFromLocation() {
    var match = (window.location.hash || '').match(/[#&]s=([^&]+)/);
    if (!match) return null;
    return State.decodeState(decodeURIComponent(match[1]));
  }

  function clearShareHashFromUrl() {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function buildShareUrl() {
    var shareable = State.buildShareableState(collectStateFields());
    var encoded = State.encodeState(shareable);
    return window.location.origin + window.location.pathname + '#s=' + encodeURIComponent(encoded);
  }

  function flashCopied(button, resetText) {
    button.textContent = 'Скопировано!';
    setTimeout(function () { button.textContent = resetText; }, 1500);
  }

  function copyText(text, button, resetText) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        flashCopied(button, resetText);
      }).catch(function () { /* clipboard denied - the visible field is the fallback */ });
    }
  }

  // ---------- top-level render ----------
  function renderAll() {
    renderSettingsTab();
    renderEarnTab();
    renderReverseTab();
    persistLocalState();
  }

  // ---------- wiring: settings ----------
  function bindSettingsField(input, key, transform) {
    input.addEventListener('input', function () {
      state.settings[key] = transform ? transform(input.value) : input.value;
      renderAll();
    });
  }
  bindSettingsField(el.monthlySalary, 'monthlySalary');
  bindSettingsField(el.workdaysInMonth, 'workdaysInMonth');
  bindSettingsField(el.dailyHours, 'dailyHours');
  bindSettingsField(el.taxRatePercent, 'taxRatePercent');
  bindSettingsField(el.currency, 'currency');

  el.prevMonthBtn.addEventListener('click', function () { changeMonth(-1); });
  el.nextMonthBtn.addEventListener('click', function () { changeMonth(1); });
  function changeMonth(dir) {
    var s = state.settings;
    var m = s.month + dir, y = s.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    s.month = m; s.year = y;
    renderAll();
  }

  el.autoWorkdaysBtn.addEventListener('click', function () {
    state.settings.workdaysInMonth = String(Calc.weekdaysInMonth(state.settings.year, state.settings.month + 1));
    renderAll();
  });

  Array.prototype.forEach.call(el.defaultRate0030Seg.querySelectorAll('.seg-btn'), function (btn) {
    btn.addEventListener('click', function () {
      state.settings.rate0030 = Number(btn.dataset.rate);
      renderAll();
    });
  });

  // ---------- wiring: earn ----------
  el.addDayBtn.addEventListener('click', addEntry);
  el.emptyAddBtn.addEventListener('click', addEntry);

  // ---------- wiring: reverse ----------
  el.reverseAmount.addEventListener('input', function () {
    state.reverse.amount = el.reverseAmount.value.replace(/[^0-9.]/g, '');
    renderAll();
  });
  el.reverseCategory.addEventListener('change', function () {
    var code = el.reverseCategory.value;
    var cfg = CATEGORIES[code];
    state.reverse.category = code;
    state.reverse.rate = cfg.multiplierMode === 'fixed' ? cfg.defaultMultiplier : (Number(state.settings.rate0030) || 1.5);
    renderAll();
  });
  Array.prototype.forEach.call(el.basisSeg.querySelectorAll('.seg-btn'), function (btn) {
    btn.addEventListener('click', function () { state.reverse.basis = btn.dataset.basis; renderAll(); });
  });
  Array.prototype.forEach.call(el.reverseRateSeg.querySelectorAll('.seg-btn'), function (btn) {
    btn.addEventListener('click', function () { state.reverse.rate = Number(btn.dataset.rate); renderAll(); });
  });

  // ---------- wiring: nav ----------
  [el.navSettingsBtn, el.navEarnBtn, el.navReverseBtn].forEach(function (btn) {
    btn.addEventListener('click', function () { setTab(btn.dataset.tab); });
  });

  // ---------- wiring: share ----------
  el.shareBtn.addEventListener('click', function () {
    var url = buildShareUrl();
    el.shareUrl.value = url;
    el.shareBox.hidden = false;
    el.shareUrl.focus();
    el.shareUrl.select();
    copyText(url, el.shareBtn, '🔗 Поделиться (аноним.)');
  });
  el.copyShareBtn.addEventListener('click', function () {
    el.shareUrl.select();
    copyText(el.shareUrl.value, el.copyShareBtn, 'Копир.');
  });

  // ---------- init ----------
  (function init() {
    var today = new Date();
    state.settings.year = today.getFullYear();
    state.settings.month = today.getMonth();
    state.settings.workdaysInMonth = String(Calc.weekdaysInMonth(state.settings.year, state.settings.month + 1));

    var shared = parseShareFromLocation();
    if (shared) {
      applyState(shared, false);
      clearShareHashFromUrl();
    } else {
      var saved = loadLocalState();
      if (saved) {
        applyState(saved, true);
      } else {
        addEntry();
      }
    }

    setTab('earn');
    renderAll();
  })();
})();
