# Tally (eub_earn) — Overtime Earnings Calculator

A small, dependency-free web app that estimates pay for reported overtime,
and can work backwards from a payment amount to the hours it implies.
"Tally" is the app's working name; `eub_earn` is the repo.

UI is a phone-first, dark ("Nocturne") three-tab app — **Настройки**
(Settings) · **Расчёт** (Earn) · **Обратный** (Reverse) — navigated via a
bottom nav bar, in Russian to match the source payroll table's own language.

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
manually if your organization's production calendar has holidays. Month is
navigated with prev/next arrows in Settings.

### Overtime categories & rate multipliers

- **0010 — Сверхурочные** (fixed **1.0×**, straight-time): capped at
  **2h/day** and **12h/month**. Hours reported beyond either cap are shown
  inline on that day's card as an unpaid-excess note, rather than silently
  dropped.
- **0030 — Выходные и праздники** (**variable: 1.5× or 1.0×**): policy now
  grants a compensatory day off by default rather than pay, so the rate is a
  toggle — **per entry**, not just a single global switch. Settings holds
  the *default* rate applied to newly added days; each day's own card can
  then be flipped independently between 1.5× and 1.0× without affecting any
  other day.
- **0040 — Ночные часы** (fixed **1.0×**, straight-time).

0010 and 0040 show as a locked "1.0× фикс." badge in Settings — not
editable, since they're straight-time by policy. (The reverse calculator's
rate toggle is still freely adjustable for what-if queries, regardless of
category.)

### Entering hours

Overtime hours are entered in **30-minute steps** via a −/+ counter on each
day's card (typing a value snaps it to the nearest half hour).

### Tax

A flat tax rate (default 20%, editable) is applied to total gross overtime
pay to produce a net figure:

```
net overtime = gross overtime - (gross overtime * tax rate)
```

### Reverse calculator: payment → hours

Given a payment amount, its type (gross or net), a category, and a rate
toggle, the app grosses up net amounts (`gross = net / (1 - tax rate)`) and
divides by `hourly rate * multiplier` to estimate the implied hours. For
category 0010 it also shows how many days that is at the 2h/day cap.

### Saving & anonymized sharing

- **Autosave**: everything you enter (settings and entries) is saved to your
  browser's `localStorage` on every change and restored automatically next
  time you open the app. Nothing leaves your device for this — it's purely
  local.
- **Share anonymized link**: the "🔗 Поделиться (аноним.)" button builds a
  URL encoding your dates, categories, hours, per-entry rates, workdays,
  daily hours, and tax rate — but **not** your salary or currency. A
  colleague who opens the link gets that same set of days pre-filled, with
  salary/currency left blank for them to fill in with their own. The link is
  copied to your clipboard automatically (and shown in a text box as a
  fallback if clipboard access is blocked).
- **Hide amounts**: the eye icon in the top bar (fintech-app style) masks
  every money figure — hourly rate, net/gross/tax, per-entry pay, the
  reverse-calculator breakdown — behind "•• •••" placeholders, and switches
  the salary field to a password-style input, so nothing sensitive is
  readable over your shoulder on a shared screen or office desktop. Hours,
  dates, and categories stay visible since they aren't sensitive on their
  own. The on/off state is remembered in `localStorage` (separately from
  your data) so it stays off — or on — the way you left it.

## Usage

No build step or server required — open `index.html` directly in a browser,
or serve the directory statically:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

1. In **Настройки**, fill in salary, workdays, daily hours, tax rate, and
   the default 0030 rate.
2. In **Расчёт**, add day-by-day overtime entries using the 30-minute
   counter; totals, caps, and net pay update live, with filter chips per
   category.
3. Use **Обратный** to reverse-calculate hours from a known payment.

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

Core calculation logic (`js/calc.js`) and persistence/sharing (`js/state.js`)
are framework-free and unit tested with Node's built-in test runner:

```bash
npm test
```

## Project structure

```
index.html         UI markup (3-tab shell + bottom nav)
css/style.css       Nocturne dark theme + component styles
js/calc.js          pure calculation logic (hourly rate, caps, summary, reverse calc)
js/state.js         local persistence + anonymized share-link encoding
js/app.js           tab/state management, DOM rendering, animated hero numbers
tests/calc.test.js  unit tests for js/calc.js
tests/state.test.js unit tests for js/state.js
```

## Disclaimer

This is an estimation tool, not payroll or legal advice. Verify multipliers,
caps, and tax treatment against your organization's actual policy and local
labor law before relying on the numbers.
