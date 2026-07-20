/**
 * Local persistence (localStorage) and anonymized share-link encoding.
 * Pure, DOM-free logic — usable from the browser (attaches
 * window.OvertimeState) or from Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OvertimeState = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'eub_earn_state_v1';
  var STATE_VERSION = 1;

  // Never leaves the device via a share link — reveals personal pay.
  var SHARE_EXCLUDED_FIELDS = ['monthlySalary', 'currency'];

  function toPlainEntries(entries) {
    return (entries || []).map(function (e) {
      return { date: e.date, category: e.category, hours: e.hours };
    });
  }

  /** Everything, for this device's own local save. */
  function buildFullState(fields) {
    return {
      version: STATE_VERSION,
      month: fields.month,
      currency: fields.currency,
      monthlySalary: fields.monthlySalary,
      workdaysInMonth: fields.workdaysInMonth,
      dailyHours: fields.dailyHours,
      taxRatePercent: fields.taxRatePercent,
      rate0030: fields.rate0030,
      entries: toPlainEntries(fields.entries)
    };
  }

  /** Same, minus anything that reveals pay — safe to hand to a colleague. */
  function buildShareableState(fields) {
    var full = buildFullState(fields);
    SHARE_EXCLUDED_FIELDS.forEach(function (key) { delete full[key]; });
    return full;
  }

  function encodeState(stateObj) {
    try {
      var json = JSON.stringify(stateObj);
      if (typeof btoa === 'function') return btoa(json);
      return Buffer.from(json, 'utf-8').toString('base64');
    } catch (e) {
      return null;
    }
  }

  function decodeState(encoded) {
    if (!encoded) return null;
    try {
      var json = typeof atob === 'function' ? atob(encoded) : Buffer.from(encoded, 'base64').toString('utf-8');
      var obj = JSON.parse(json);
      if (!obj || typeof obj !== 'object' || !Array.isArray(obj.entries)) return null;
      return obj;
    } catch (e) {
      return null;
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    STATE_VERSION: STATE_VERSION,
    SHARE_EXCLUDED_FIELDS: SHARE_EXCLUDED_FIELDS,
    buildFullState: buildFullState,
    buildShareableState: buildShareableState,
    encodeState: encodeState,
    decodeState: decodeState
  };
});
