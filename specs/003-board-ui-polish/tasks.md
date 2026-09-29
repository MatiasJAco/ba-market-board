---

description: "Task list for 003-board-ui-polish — presentation-only, 3 tasks, no new tests, no new files"

---

# Tasks: Market Board UI Polish

**Input**: Design documents from `/specs/003-board-ui-polish/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/view-slots.md,
quickstart.md

**Tests**: This list creates **no new automated test** and **no new test file**. The suite stays at
the 8 tests already defined in [spec 002](../002-dashboard-data-policy/plan.md), in the same 2
files, against the constitutional cap of 12. T002 and T003 extend the fake document that already
lives inside `tests/render.test.js` and fold new assertions into the two existing rendering tests.
FR-019 forbids new test files. There is no write-tests-first step and no red-green ceremony.

**Organization**: Three sequential tasks, one per reviewer hand-off. They are **not parallel** — T002
and T003 both edit `index.html`, `render.js`, `styles.css`, and `tests/render.test.js`, and both
depend on the tokens T001 introduces. Per `AGENTS.md`, implement one task, then hand to `@tester`,
then return to `@coder` on that same task only if it fails.

**Constitution gates applied**: I. Small Webapp; II. Right-Sized Tests; III. No API Secrets in Git;
IV. Public/Free APIs Only; V. One Page; VI. Readable on a Phone (320px); VII. Visible API Failures.

**Libraries**: none. Every task uses the platform's CSS, the semantic HTML already in use, and the
existing vanilla renderer. If a task appears to need a dependency, it stops and asks first.

## Already implemented — do not redo

Spec 002 delivered the whole data layer. It is complete, tested, and **frozen** for this feature.
There is deliberately no task for any of it, and FR-018 forbids touching it.

| Area | Files | State |
|------|-------|-------|
| Server and static serving | `src/server.js`, `src/config.js` | Done. Five-asset allowlist — **not extended** by this feature |
| API route | `src/api/dashboard-route.js` | Done. `GET /api/dashboard` with the `{retrievedAt, weather, cedears, mep}` envelope |
| Service and normalization | `src/dashboard/service.js`, `normalize.js` | Done. Ok/error union, eight error codes, Spanish messages |
| HTTP and time helpers | `src/lib/json-fetch.js`, `src/lib/time.js` | Done. Timeout, typed errors, staleness |
| Source adapters | `src/sources/open-meteo.js`, `data912-cedears.js`, `dolarapi-mep.js` | Done. Open-Meteo, Data912, DolarAPI. **Not rewritten** |
| Browser bootstrap | `src/public/app.js` | Done. One request per page load |
| Automated suite | `tests/render.test.js` (2), `tests/adapters.test.js` (6) | Done. 8 tests, green |
| Documentation | `README.md` | Done. One line added by T003 |

**Verification of the freeze**, run after every task:

```bash
git diff --name-only | grep -E '^src/(sources|dashboard|api|lib)/|^src/(config|server)\.js|^package\.json$|^tests/adapters\.test\.js$|^src/public/app\.js$'
```

Expected: no output.

## Testing budget (read before writing any test)

- 8 tests, 2 files, hard cap 12. This feature adds **0** tests and **0** files.
- Allowed edits to `tests/render.test.js`: extend `createFakeDocument()` with new element ids,
  extend `SLOT_SUFFIXES` to match, and add assertions inside the two existing tests. Nothing else.
- Forbidden: a new test file, a `tests/helpers/` or `tests/fixtures/` directory, a shared
  document-double module, a snapshot file, a layout or visual-regression test, a per-ticker test, a
  coverage target, or a red-green ceremony.
- Layout acceptance is the manual checklist in [quickstart.md](quickstart.md), not an automated
  test. That is deliberate and constitutional, not an omission.

---

## Task 1 — Page skeleton: one stacked column, tokens, and card treatment

**ID**: T001–T005 · **Stories**: US1, US5 · **Files**: `src/public/styles.css`,
`src/public/index.html` · **New files**: none · **New tests**: none

**Goal**: The page stops being a three-column grid of unstyled boxes and becomes three matching
cards in one centered column. After this task the page already reads as a market board on a phone
and on a desktop; only the numbers inside are still flat.

**Independent test**: Run `npm test` (expect 8/8, unchanged) and open the page at 320px and 1280px.
Three cards appear stacked in the same order at both widths, in one centered column.

- [ ] **T001** Replace the `auto-fit` three-column grid and the `60rem` maximum width with a single
  flex column in `src/public/styles.css`: `max-width: 720px`, `margin-inline: auto`, `padding:
  16px`, `gap: 24px`, `flex-direction: column`. Remove `grid-template-columns`,
  `grid-column`, and the `auto-fit` sizing entirely.
- [ ] **T002** Add the spacing tokens `--space-1` through `--space-5` (16, 24, 32, 40, 48px) and
  the type tokens `--text-xs` 14px, `--text-sm` 16px, `--text-lg` 20px, `--text-xl` 28px,
  `--text-hero` 40px to `:root` in `src/public/styles.css`. Add a `--radius` of `16px`. Retain the
  existing `prefers-color-scheme: dark` block and extend both token sets with every new colour the
  card and state treatments need.
- [ ] **T003** Give `.widget` one shared card treatment in `src/public/styles.css`: surface colour,
  `1px` border, `var(--radius)`, and `16px` internal padding, with a `16px` gap between its own
  children. Rename the block classes to a `board__block` family; class names are free, **element
  `id`s are not** (see contracts/view-slots.md).
- [ ] **T004** Restyle the three visible states on top of the card in `src/public/styles.css`:
  `.widget__error` becomes the muted box FR-012 requires — subdued border, lightly tinted surface,
  message text carrying the meaning rather than a saturated background, with the red hue retained in
  the text and border accent so a failure is still distinguishable (Constitution VII); loading text
  is a `--text-xs` line inside the card; source and time move from `0.8rem` (12.8px) to
  `var(--text-xs)` so nothing renders below the 14px floor.
- [ ] **T005** In `src/public/index.html`, keep the `h1` as a single slim page title at
  `var(--text-xl)` and **delete** the `.board__subtitle` paragraph. Add no navigation, hero, or
  footer. Keep the three `*-widget` section ids and all fifteen existing slot ids exactly as they
  are.

**Acceptance for this task**

- [ ] `npm test` still reports 8 passing, 0 failing. No test file changed.
- [ ] At 1280px the three cards are stacked, not side by side, in one column.
- [ ] The column measures 640–760px at 1200px+ and is centered within 20px. (SC-003)
- [ ] No horizontal scroll at 320px, 768px, or 1280px. (SC-002)
- [ ] One `h1` above the blocks; the grey descriptive line is gone. (SC-001)
- [ ] The smallest text on the page is 14px, in both appearances. (SC-014)
- [ ] Every `padding`, `margin`, and `gap` in `styles.css` is `0`, `16px`, `24px`, `32px`, `40px`,
  `48px`, or `auto`. (SC-010)
- [ ] The error box is a visible muted box with a non-transparent surface, readable in light and
  dark, in all three blocks. (SC-009, SC-011)
- [ ] The No third-party request appears in the Network panel. (SC-012)
- [ ] `git diff --name-only` lists only `src/public/styles.css` and `src/public/index.html`.

**Notes for the implementer**

- SC-010 is an audit a reviewer will run mechanically, so do not introduce a `8px` radius or a
  `12px` gap as a one-off. The radius is `16px` from the approved set on purpose.
- The three-column grid is the reason the page reads as a dump on desktop. Removing it is the
  point of this task, not a side effect.
- No new element `id` is introduced here, so the smoke test passes without modification. That is
  the check that the id contract was respected.

---

## Task 2 — Weather and dollar: one dominant number per block

**ID**: T006–T011 · **Stories**: US2, US4 · **Files**: `src/public/index.html`,
`src/public/render.js`, `src/public/styles.css`, `tests/render.test.js` · **New files**: none ·
**New tests**: none

**Goal**: The weather temperature and the MEP rate become the largest thing in their block, with
the condition, city, unit, and bid/ask as smaller supporting text. A visitor can read the two numbers
that matter without reading a sentence.

**Independent test**: Run `npm test` (expect 8/8) and open the page. Each of the two blocks shows
one large number, a smaller condition or unit beneath it, the city name in the weather block, and
the MEP/bolsa label. Disconnect the network, reload, and confirm no stale number survives beside an
error box in either block.

- [ ] **T006** In `src/public/index.html`, add the four optional slots inside the weather and dollar
  sections: `weather-condition`, `weather-location`, `mep-unit`, `mep-detail`. Each starts `hidden`.
  Change the weather `h2` from `Clima en Buenos Aires` to `Clima`, because the city is now
  rendered from the data and would otherwise appear twice. Do not change any existing `id`.
- [ ] **T007** In `src/public/render.js`, change `renderWeather` to return
  `{ hero, condition, location, time, timeKind }` and `renderMep` to return
  `{ hero, unit, detail, time, timeKind }`. `hero` is the temperature and the midpoint respectively.
  `renderCedears` is **not** touched in this task. Keep `defaultValueText` as the fallback for any
  unrecognised value shape.
- [ ] **T008** In `src/public/render.js`, extend `applyResult` to write each part to its own element
  through the existing `display()` and `conceal()` helpers, which already no-op on `null`, so a
  missing optional slot degrades to "not shown" instead of throwing. An empty string must leave the
  element hidden.
- [ ] **T009** In `src/public/render.js`, extend the **error** transition so it conceals
  `-value`, `-condition`, `-location`, `-unit`, `-detail`, `-time`, and `-source` for the affected
  widget, leaving exactly one visible slot. This is the highest-risk change in the feature: a missed
  sub-slot leaves a stale number beside an error box, which Constitution VII and FR-012 forbid.
  The CEDEAR cells are added in Task 3.
- [ ] **T010** In `src/public/styles.css`, style the hero at `var(--text-hero)`, the condition and
  rate unit at `var(--text-sm)`, and the city and bid/ask lines at `var(--text-xs)`. `mep-unit` is
  16px, not 14px: quickstart.md requires the bid/ask line to be "smaller still" than the unit, which
  only holds when the two differ. The MEP
  block title `Dólar MEP/bolsa` stays visible, since it carries the label FR-011 requires.
- [ ] **T011** In `tests/render.test.js`, add the four new ids to `createFakeDocument()` and to
  `SLOT_SUFFIXES` so the **existing** assertions — the visible-slot deep equal and the byte-for-byte
  sibling comparison — automatically cover them. Add assertions inside the two existing tests: the
  smoke test checks the served HTML contains the new sub-slot ids, and the error-state test checks
  that `weather-value` and `mep-value` hold the hero values and that no sub-slot survives an error.
  Do not add a test case, a fixture, or a file.

**Acceptance for this task**

- [ ] `npm test` still reports 8 passing, 0 failing, in 2 files. (SC-013)
- [ ] The temperature and the rate are the largest text in their blocks, at least 1.5× the
  supporting text. (SC-004)
- [ ] The weather block shows the temperature, the condition, and `Buenos Aires`. (FR-008)
- [ ] The dollar block shows one number, `ARS por USD` smaller beneath it, and the MEP/bolsa label.
  The strings `blue` and `oficial` appear nowhere on the page. (FR-011, SC-008)
- [ ] With the network disconnected, no temperature, condition, city, rate, unit, or bid/ask text
  remains visible in either failed block. (FR-012, Constitution VII)
- [ ] `render.js` still uses only `getElementById`, `textContent`, and `hidden` — no
  `createElement`, no `innerHTML`, no `classList`. The README statement at line 157 stays true.
- [ ] `git diff --name-only` lists only the four files named above.

**Notes for the implementer**

- A single text node has one font size, so the number and its unit cannot share an element. The
  split into separate elements is what makes the hierarchy possible, not a stylistic preference.
- T009 is the whole point of T011. If you write the renderer change without extending the fake, the
  stale-sub-slot bug ships silently.
- `mep-value` must keep the rate number itself, because the existing error-state test asserts that
  element holds a digit. Do not move the number into `mep-unit`.

---

## Task 3 — CEDEAR table, and the final error sweep

**ID**: T012–T017 · **Stories**: US3, US4, US5 · **Files**: `src/public/index.html`,
`src/public/render.js`, `src/public/styles.css`, `tests/render.test.js`, `README.md` ·
**New files**: none · **New tests**: none

**Goal**: The five CEDEARs become a compact table with a right-aligned price column, uniform row
heights, and company names that cut off with an ellipsis instead of wrapping. The error clearing rule
is then completed for all three widgets.

**Independent test**: Run `npm test` (expect 8/8) and open the page. Five rows appear in the order
`AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA`, the prices align down one column, and no percentage appears
anywhere. Disconnect the network and confirm no table cell survives in the failed block.

- [ ] **T012** In `src/public/index.html`, replace the CEDEAR value area with a `<table>` holding a
  `<thead>` that names the ticker and price columns and a `<tbody>` with **exactly five** static
  `<tr>` elements. Give each row the ids `cedear-0-ticker`, `cedear-0-label`, `cedear-0-price`
  through `cedear-4-price`. The ticker order is positional: row `n` receives quote `n`, so do not
  hardcode ticker text into the markup. The price header carries the `ARS` unit.
- [ ] **T013** In `src/public/render.js`, change `renderCedears` to return
  `{ lede, rows, time, timeKind }` where `rows` is an array of
  `{ ticker, label, priceArs }` in the adapter's order, and `lede` is a Spanish count-and-unit line
  derived from the quotes, such as `5 CEDEARs en pesos argentinos`. Apply each part to
  `cedears-value` and the fifteen row cells.
- [ ] **T014** In `src/public/render.js`, extend the error transition from T009 to also conceal
  `cedears-value` and all fifteen `cedear-{n}-*` cells. After an error, exactly one slot belonging
  to that widget is visible. This completes the clearing rule for every widget.
- [ ] **T015** In `src/public/styles.css`, style the table so the five prices align and the rows
  stay one line tall: a fixed column layout, cell padding of `16px 0` with separation coming from a
  `16px` flex gap inside the instrument cell, right-aligned tabular numerals in the price column, a
  ticker that never shrinks, and a label that flexes and cuts off with an ellipsis. The row gap
  between CEDEARs must be visibly smaller than the `24px` between blocks.
- [ ] **T016** In `tests/render.test.js`, add the fifteen CEDEAR ids to `createFakeDocument()` and
  to `SLOT_SUFFIXES`. Fold into the two existing tests: the smoke test checks the served HTML
  contains the table and the fifteen ids, and the error-state test checks that the five tickers and
  five prices are non-empty in order and that no cell survives an error. Do not add a test case, a
  fixture, or a file.
- [ ] **T017** In `README.md`, extend the `Cómo está armado` section with one line describing the
  three-block layout and the split of one value across a primary element and its supporting
  elements. Do not change the sentence recording that `render.js` uses only `getElementById`,
  `textContent`, and `hidden` — it remains true.

**Acceptance for this task**

- [ ] `npm test` still reports 8 passing, 0 failing, in 2 files. (SC-013)
- [ ] Five rows in the order `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA`, ticker and price on the same
  line, all five rows the same height, all five prices starting at the same horizontal offset.
  (FR-009, SC-006)
- [ ] A long company name is cut with an ellipsis and never covers the ticker or the price.
- [ ] No percentage value, dash, or placeholder percentage column anywhere on the page.
  (FR-010, SC-007)
- [ ] At a 320px viewport, the widest realistic price such as `412.900,00` still fits on one line.
  (SC-005)
- [ ] With the network disconnected, no ticker, label, price, or lede text remains visible in the
  failed CEDEAR block. (FR-012, Constitution VII)
- [ ] The error box is readable in both the light and the dark appearance. (SC-011)
- [ ] `git diff --name-only` lists only the five files named above. No new file exists.
- [ ] The freeze check in this file's "Already implemented" table produces no output.

**Notes for the implementer**

- `cedears-value` must receive its own non-empty text, because the existing error-state test
  asserts it is non-empty and the fake document does not model nested content. That is what the
  lede line is for; it is a real part of the design, not a placeholder written to satisfy a test.
- The price column is what will break at 320px first. If a price does not fit, let the price column
  size to content and give the remainder to the instrument column, or drop the price to
  `var(--text-sm)`. Do **not** introduce a pixel value outside the approved scale.
- Do not add a percentage column even as a placeholder. The payload has no such field and FR-010
  forbids it.

---

## Dependencies and execution order

| Task | Depends on | Blocks |
|---|---|---|
| T001 (task 1) | nothing | Task 2, Task 3 |
| Task 2 | Task 1 | Task 3 |
| Task 3 | Task 1, Task 2 | — |

Strictly sequential. No task carries a `[P]` marker because all three edit `styles.css` and
`index.html`, and tasks 2 and 3 also share `render.js` and `tests/render.test.js`.

**Per the `AGENTS.md` workflow, do not batch these.** Implement one task, hand it to `@tester`,
and only return to `@coder` on that same task if the tester fails it.

## Traceability

| Requirement | Task |
|---|---|
| FR-001 presentation only, adapters frozen | enforced by the freeze check in every task |
| FR-002 720px centered single column | Task 1 |
| FR-003 mobile-first, additive refinements only | Task 1 (no breakpoints are needed) |
| FR-004 no horizontal scroll to 320px | Task 1, verified in Task 3 |
| FR-005 three blocks, slim title, subtitle removed | Task 1 |
| FR-006 visible title and timestamp per block | Task 1 |
| FR-007 one shared card treatment | Task 1 |
| FR-008 big temperature, condition, city | Task 2 |
| FR-009 compact CEDEAR rows, aligned, ellipsis | Task 3 |
| FR-010 no percentage anywhere | Task 3 |
| FR-011 one big MEP rate, labeled, no official or blue | Task 2 |
| FR-012 error as a muted box, never blank | Task 1 (styling), Tasks 2 and 3 (clearing) |
| FR-013 loading visible in the frame | Task 1 |
| FR-014 system font, no new font | Task 1 |
| FR-015 spacing scale | Task 1, audited in Tasks 2 and 3 |
| FR-016 dark mode, 14px floor, contrast both appearances | Task 1 (tokens), Tasks 2 and 3 (new surfaces) |
| FR-017 no new dependency | every task; verify with the dependency count check |
| FR-018 adapters, requests, validation, errors unchanged | freeze check in every task |
| FR-019 no new test file, suite stays at 12 or below | Tasks 2 and 3 |

| Success criterion | Task |
|---|---|
| SC-001, SC-002, SC-003 layout at both widths | Task 1 |
| SC-004 value at least 1.5× supporting text | Task 2 (weather, FX), Task 3 (CEDEAR) |
| SC-005 readable at 320px, only the label cut | Task 1, Task 3 |
| SC-006 five aligned uniform rows in order | Task 3 |
| SC-007 no percentage | Task 3 |
| SC-008 one labeled rate, no blue or official | Task 2 |
| SC-009 error in a styled, non-blank box | Task 1 |
| SC-010 every spacing value in the approved set | Task 1, audited in Tasks 2 and 3 |
| SC-011 contrast in both appearances | Task 1 (tokens), Tasks 2 and 3 (new surfaces) |
| SC-012 no third-party asset, zero dependencies | Task 1, rechecked after every task |
| SC-013 suite green, no test file added | Tasks 2 and 3 |
| SC-014 nothing below 14px | Task 1, rechecked in Tasks 2 and 3 |

All 19 functional requirements and all 14 success criteria are covered. No requirement is left
unassigned.

## Definition of done

- [ ] All three tasks checked off, in order, each verified by `@tester`.
- [ ] `npm test` green at 8 of 8 in 2 files.
- [ ] Three stacked blocks at 320px and at 1280px, in one centered column.
- [ ] No horizontal scroll from 320 to 1920px.
- [ ] Nothing below 14px; readable in both light and dark.
- [ ] No percentage, and no official or blue rate, anywhere.
- [ ] No stale value beside an error box, in any of the three blocks.
- [ ] Every spacing value in the approved set.
- [ ] Zero dependencies; no third-party request.
- [ ] The freeze check produces no output.

## Notes

- Three tasks, seventeen checkbox lines. The checkbox IDs are the `T0xx` lines only; the Acceptance
  sections use **square brackets without `T` or `-`** (`[ ]`) on purpose, so a task line can never be
  grepped or misread alongside the `test(...)` IDs that already exist in `tests/render.test.js`.
- A task is not complete until the whole suite passes and its behavior is either asserted inside an
  existing test or consciously accepted as uncovered, per Constitution II.
- The layout, type, contrast, and alignment criteria are verified by the manual checklist in
  [quickstart.md](quickstart.md). That is a constitutional constraint, not a shortcut.
- Commit after each task or logical group, staging only the files that task names.

---

## Phase 4: Convergence

Remaining work found by `/speckit-converge` after T001–T017 were implemented and verified. Ordered
CRITICAL first. Nothing here changes the data layer, the API, the adapters, or the test budget.

- [ ] **T018** CRITICAL Set an explicit `font-weight` on `.board__block__cell-label` in
  `src/public/styles.css` so the company name is not the boldest text in its row. The span inherits
  `font-weight: 700` from the UA stylesheet via its parent `<th scope="row">`, and the stylesheet
  has no `th`/`span` weight reset, so the label currently renders bolder than the ticker that
  `styles.css` explicitly sets to `600`. Keep the value at or below the ticker's weight; do not
  introduce a spacing or type value outside the approved scale. (Constitution VII, SC-005 —
  contradicts)
- [ ] **T019** Resolve the inoperative error/loading suppression rule in `src/public/styles.css`. The
  rule at `styles.css:221-224` is outranked by the reveal rule at `styles.css:217` — identical
  specificity, so the earlier rule loses on source order — and therefore does nothing. Either give
  it precedence so it genuinely suppresses the table during an error or a load, or delete it and
  correct the comment above it so the CSS states what it actually does. Leaving dead code that
  claims to protect the error state is a trap for the next change. (Constitution VII — contradicts)
- [ ] **T020** Raise the dark-mode `--danger-border` contrast against `--surface` to at least 3:1 in
  the `prefers-color-scheme: dark` block of `src/public/styles.css`. It currently measures 2.74:1,
  below the non-text minimum, so the error box outline is not reliably distinguishable. The error
  *text* already passes at 9.77:1, so this is a border adjustment only and must not degrade the
  muted, non-alarming treatment T004 established. (SC-011, Constitution VII — partial)
- [ ] **T021** Reconcile `specs/003-board-ui-polish/plan.md` and
  `specs/003-board-ui-polish/quickstart.md` with what shipped. Two items: the plan's block mockup
  annotates the `#cedears-value` lede as `--text-xs` where the implementation uses
  `var(--text-sm)`, and the same mockup draws a three-cell CEDEAR row where the implementation uses
  a two-column row with the ticker and label as a flex line inside one `<th scope="row">`. The
  quickstart CEDEAR width stress test does not mention that two-column structure. Edit the
  documentation to describe the shipped design; do not change code to match a stale sketch.
  (plan.md block mockup, quickstart.md — partial)
- [ ] **T022** Record as consciously uncovered, or pin with an assertion inside an existing test, the
  two load-bearing `width: 0` declarations on `.board__block__cell-label` and
  `.board__block__cell-price` in `src/public/styles.css`. They are what stop the label and price
  columns from absorbing leftover width; removing them re-breaks the 320-pixel fit while the suite
  stays green. A served-CSS text assertion inside the existing smoke test is the mechanism already
  used for the table reveal rules, and it costs no test budget. If left uncovered, state so
  explicitly under Constitution II. (Constitution II — unrequested)
- [ ] **T023** Stage `specs/003-board-ui-polish/` so it is tracked in git. The directory is currently
  untracked, which makes the `git status --short` freeze check in
  [quickstart.md](quickstart.md) ambiguous — it cannot distinguish a new spec directory from a new
  product file, and FR-001 and FR-018 both rest on that check being unambiguous. No product file
  changes. (FR-017, quickstart.md freeze check — partial)
