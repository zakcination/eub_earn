# eub_earn — Design Brief

**What this is:** a technical/functional spec of a working app, handed off for
visual/UX design. The logic is built and live; nothing here needs to be
re-engineered — the design pass is about layout, hierarchy, and styling on
top of the flows and data described below.

**Live reference (current, unstyled/default look):**
https://zakcination.github.io/eub_earn/ — GitHub Pages, auto-deployed by
`.github/workflows/deploy-pages.yml` on every push. **Requires a one-time
manual step**: repo Settings → Pages → Build and deployment → Source →
"GitHub Actions" (the deploy workflow's token can't flip this on itself —
GitHub rejects that API call from a workflow-scoped token). Until that's
set, read the code directly or run `python3 -m http.server` locally.

**Repo:** `zakcination/eub_earn` — `index.html` / `css/style.css` /
`js/app.js` / `js/calc.js`

---

## 1. What the app does

A single-page tool, used by one person (an employee) to:

1. Estimate pay for overtime they've worked, day by day, across three
   categories with different rules.
2. Work backwards from a payment amount they received to how many overtime
   hours it implies.

No accounts, no backend, no database — pure client-side calculator. State
lives only in memory for the current session (resets on reload).

## 2. Primary users & context

- Single user, self-service. Likely checking/logging this on their phone in
  the evening after a shift, or once a month when reconciling a payslip.
- **Design for mobile-first**, since day-by-day logging is the highest-
  frequency interaction and most plausible on a phone. Desktop should still
  work well for the monthly review use case.
- No visual identity constraints yet — this is a personal/small-team
  utility, not a branded product. Clean, calm, numbers-forward. Optimize for
  fast daily entry and at-a-glance trust in the totals.

## 3. Domain model (source of truth)

Three overtime categories, from a payroll reference table (ВидОтПР codes):

| Code | Name | Time window | Rate | Caps |
|---|---|---|---|---|
| **0010** | Overtime (Сверхурочные) | 18:00–20:00 | **fixed 1.0x** (straight time), not editable | 2h/day, 12h/month — excess is flagged, unpaid |
| **0030** | Weekend/holiday work (Работа в вых./праздн.) | 09:00–17:00 | **variable, user-selectable: 1.5x or 1.0x** | none |
| **0040** | Night hours (Ночные часы) | 22:00–06:00 | **fixed 1.0x** (straight time), not editable | none |

Only 0030 needs an interactive rate control (a toggle/select). 0010 and 0040
should read as fixed, informational values in the UI (e.g. a static badge),
not editable form fields — this is a deliberate simplification from an
earlier version, so the design should visually reinforce "these two are
locked, this one is a choice."

### Hourly rate (derived, always visible)

```
hourly rate = monthly gross salary ÷ workdays in the month ÷ daily working hours
```

Inputs: monthly gross salary, workdays in month (with a one-click "Auto"
helper that counts Mon–Fri for the selected month — still user-editable
after, for holidays), daily working hours (default 9).

### Tax

A flat, editable tax rate (default 20%) converts gross overtime pay to net:
`net = gross − gross × taxRate`.

### Reverse calculator

Given a payment amount + whether it's gross or net + a category (defaulting
to that category's rate, but overridable), compute the implied hours. For
0010, also surface "≈ X days at the 2h/day cap" as a sanity-check hint.

## 4. Screens / sections

The current build is three stacked sections on one page. Design is free to
restructure (tabs, wizard, accordion, bottom-nav — whatever reads best on
mobile) as long as all of the following content survives:

### A. Settings (shared inputs, used by both flows below)
- Month (for the Auto-workdays helper)
- Currency label (free text, e.g. "₸", "$" — optional, purely cosmetic)
- Monthly gross salary
- Workdays in month (+ Auto button)
- Daily working hours (default 9)
- Tax rate % (default 20)
- 0030 rate: **1.5x / 1.0x** toggle
- 0010 rate: static "1.0x" badge
- 0040 rate: static "1.0x" badge
- Computed hourly rate, shown prominently — this number anchors trust in
  everything downstream, treat it as a hero value.

### B. Overtime → Pay (forward flow, the daily-use screen)
- A list/table of entries, each: **date**, **category** (0010/0030/0040),
  **hours** (entered via a **−/+ counter stepping in 30-minute / 0.5h
  increments** — this is the core, most-repeated interaction; typing a raw
  number is a secondary path and should snap to the nearest 0.5h), a remove
  action.
- Per-entry computed output: payable hours (after caps), multiplier applied,
  pay.
- "Add day" action.
- Warnings, shown only when triggered: e.g. "2026-07-06: 1.00h over the
  2h/day cap for 0010 (unpaid)." Needs a distinct, noticeable-but-not-scary
  treatment (amber/caution, not error-red) since it's an expected edge case,
  not a failure.
- Totals by category (hours + pay).
- Summary: total gross overtime, tax amount, **net overtime** (the
  headline number the user came for).

### C. Payment → Hours (reverse flow, occasional use)
- Inputs: payment amount, gross/net toggle, category, rate multiplier
  (prefilled from the category, editable).
- Outputs: hourly rate used, gross equivalent, net equivalent, **implied
  hours** (headline number here), and the 0010 day-count hint when relevant.

## 5. Interaction notes for design

- **Live recalculation**: every input change recomputes everything
  downstream immediately — no "Calculate" button anywhere. Design should
  support this (e.g. avoid patterns that imply a submit step).
- **30-minute counter** is the one interaction worth a custom, polished
  component — it will be touched the most. Should feel good to tap
  repeatedly on a phone (adequate hit target size, clear increment
  feedback).
- **Fixed vs. variable rate** needs a clear visual distinction (badge/chip
  vs. an actual control) so it's obvious at a glance which categories are
  configurable.
- Two "headline numbers" exist (net overtime in the forward flow, implied
  hours in the reverse flow) — each should read as the clear focal point of
  its section, like a receipt total.
- Currency/number formatting: 2 decimal places on money, "h" suffix on
  hours; currency symbol is user-supplied and optional (may be blank).

## 6. Technical constraints

- Plain HTML/CSS/JS, no framework, no build step, no dependencies — keep it
  that way; design should be implementable with hand-written CSS (utility
  classes or plain CSS both fine), not something that requires a bundler.
- Hosted as a static site on GitHub Pages — no server-side rendering, no
  API calls, no auth.
- No persistence yet (state resets on reload) — not in scope to design
  around, but worth flagging if a future iteration wants local storage.
- Must be responsive: phone-first, usable down to ~360px wide, and fine on
  desktop up to a centered max-width layout (current build caps at 960px).
- Light/dark mode: not currently implemented (single light theme). Open
  question for design — see below.

## 7. Open questions for the design pass

1. Single scrolling page (current) vs. tabs/wizard vs. bottom nav on mobile?
2. Should the 0010/0040 "fixed 1.0x" values be de-emphasized (small text)
   or still given visual weight since they're part of the mental model?
3. Light/dark mode — support both, or commit to one look?
4. Any branding (name/logo/color) beyond "a personal overtime calculator,"
   or should it stay utilitarian/neutral?
