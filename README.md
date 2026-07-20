# eub_earn — Overtime Earnings Calculator

A small, dependency-free web app that estimates pay for reported overtime,
and can work backwards from a payment amount to the hours it implies.

Built directly from a payroll overtime-type (ВидОтПР) reference table:

| ВидОтПР | ТкстВидПрс/Отс | Время | Note |
|---|---|---|---|
| 0010 | Сверхурочные часы (Overtime) | 18:00–20:00 | max 2h/day, 12h/month |
| 0030 | Работа в вых./праздн. Отгул (Weekend/holiday work) | 09:00–17:00 | now defaults to comp-time off; cash payment, when made, is at a variable rate |
| 0040 | Ночные часы (Night hours) | 22:00–06:00 | |

## How it works

### Hourly rate

```
hourly rate = monthly gross salary / workdays in that month / daily working hours
```

Daily working hours defaults to 9 but is editable. "Workdays in month" has an
**Auto** button that counts Mon–Fri days for the selected month — override it
manually if your organization's production calendar has holidays.

### Overtime categories & rate multipliers

- **0010 — Overtime** (simple, fixed **1.0x** / straight-time): capped at
  **2h/day** and **12h/month**. Hours reported beyond either cap are shown as
  unpaid excess (flagged as a warning) rather than silently dropped.
- **0030 — Weekend/holiday work** (**variable: 1.5x or 1.0x**, default 1.5x):
  policy now grants a compensatory day off by default rather than pay, so the
  rate is a selectable toggle — pick 1.0x for straight-time cash-outs, 1.5x
  for premium pay, or set it to 0 to model the no-payment/comp-off-only case.
- **0040 — Night hours** (simple, fixed **1.0x** / straight-time).

0010 and 0040 are intentionally not editable in Settings — they're
straight-time by policy. Only 0030 stays configurable. (The reverse
calculator's rate field is still freely editable for what-if queries.)

### Entering hours

Overtime hours are entered in **30-minute steps** via a −/+ counter next to
each day (typing a value snaps it to the nearest half hour).

### Tax

A flat tax rate (default 20%, editable) is applied to total gross overtime
pay to produce a net figure:

```
net overtime = gross overtime - (gross overtime * tax rate)
```

### Reverse calculator: payment → hours

Given a payment amount, its type (gross or net), a category, and a rate
multiplier, the app grosses up net amounts (`gross = net / (1 - tax rate)`)
and divides by `hourly rate * multiplier` to estimate the implied hours.
For category 0010 it also shows how many days that is at the 2h/day cap.

### Saving & anonymized sharing

- **Autosave**: everything you enter (settings and entries) is saved to your
  browser's `localStorage` on every change and restored automatically next
  time you open the app. Nothing leaves your device for this — it's purely
  local.
- **Share anonymized link**: the "🔗 Share anonymized link" button builds a
  URL encoding your dates, categories, hours, workdays, daily hours, and tax
  rate — but **not** your salary or currency. A colleague who opens the link
  gets that same template pre-filled, with salary/currency left blank for
  them to fill in with their own. The link is copied to your clipboard
  automatically (and shown in a text box as a fallback if clipboard access
  is blocked).

## Usage

No build step or server required — open `index.html` directly in a browser,
or serve the directory statically:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

1. Fill in **Settings** (salary, workdays, daily hours, tax rate, and the
   0030 rate toggle).
2. Add day-by-day overtime entries under **Overtime → Pay** using the
   30-minute counter; totals, caps, and net pay update live.
3. Use **Payment → Hours** to reverse-calculate hours from a known payment.

## Hosting

A GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) deploys this
static site to GitHub Pages on every push to
`claude/overtime-earnings-calculator-yz5lso`, using the standard
`actions/configure-pages` + `actions/upload-pages-artifact` +
`actions/deploy-pages` flow.

**One-time manual step required:** GitHub does not let a workflow's own
token turn Pages on for a repo (the "create Pages site" API call is
rejected as "Resource not accessible by integration" even with
`pages: write` + `enablement: true`). A repo admin needs to visit
**Settings → Pages → Build and deployment → Source → "GitHub Actions"**
once. After that, every push deploys automatically to
`https://<owner>.github.io/eub_earn/`.

## Tests

Core calculation logic (`js/calc.js`) is framework-free and unit tested with
Node's built-in test runner:

```bash
npm test
```

## Project structure

```
index.html         UI markup
css/style.css       styling
js/calc.js          pure calculation logic (hourly rate, caps, summary, reverse calc)
js/state.js         local persistence + anonymized share-link encoding
js/app.js           DOM wiring / rendering
tests/calc.test.js  unit tests for js/calc.js
tests/state.test.js unit tests for js/state.js
```

## Disclaimer

This is an estimation tool, not payroll or legal advice. Verify multipliers,
caps, and tax treatment against your organization's actual policy and local
labor law before relying on the numbers.
