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

Each category has an editable pay-rate multiplier applied to the hourly rate:

- **0010 — Overtime** (default **1.5x**): capped at **2h/day** and **12h/month**.
  Hours reported beyond either cap are shown as unpaid excess (flagged as a
  warning) rather than silently dropped.
- **0030 — Weekend/holiday work** (**variable: 1.5x or 1.0x**, default 1.5x):
  policy now grants a compensatory day off by default rather than pay, so the
  rate is a selectable toggle — pick 1.0x for straight-time cash-outs, 1.5x
  for premium pay, or set it to 0 to model the no-payment/comp-off-only case.
- **0040 — Night hours** (default **1.2x**).

All defaults are editable — they are reasonable starting points, not fixed
rules.

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

## Usage

No build step or server required — open `index.html` directly in a browser,
or serve the directory statically:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

1. Fill in **Settings** (salary, workdays, daily hours, tax rate, category
   rate multipliers).
2. Add day-by-day overtime entries under **Overtime → Pay**; totals, caps,
   and net pay update live.
3. Use **Payment → Hours** to reverse-calculate hours from a known payment.

## Tests

Core calculation logic (`js/calc.js`) is framework-free and unit tested with
Node's built-in test runner:

```bash
npm test
```

## Project structure

```
index.html        UI markup
css/style.css      styling
js/calc.js         pure calculation logic (hourly rate, caps, summary, reverse calc)
js/app.js          DOM wiring / rendering
tests/calc.test.js unit tests for js/calc.js
```

## Disclaimer

This is an estimation tool, not payroll or legal advice. Verify multipliers,
caps, and tax treatment against your organization's actual policy and local
labor law before relying on the numbers.
