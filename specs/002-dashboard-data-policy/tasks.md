---
description: "Task list for 002-dashboard-data-policy (regenerated 2026-09-28 against Constitution 2.0.0)"
---

# Tasks: BA Market Dashboard Data Policy

**Input**: Design documents from `/specs/002-dashboard-data-policy/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dashboard-api.md,
contracts/source-adapters.md, quickstart.md

**Tests**: Exactly **4 testing tasks** in this list, T020 through T023. They write the 8 tests in the
plan.md Test Plan, against a constitutional hard cap of 12. No other task may create a test file, a
test case, a fixture, a test helper, or a test double. There is no write-tests-first step.

**Organization**: Tasks are grouped by user story (US1-US4) so each story can be implemented and
manually verified independently. Automated coverage is no longer a per-story gate; see the Testing
Budget section for what that costs and what replaces it.

**Constitution gates applied**: I. Small Webapp; II. Right-Sized Tests; III. No API Secrets in Git;
IV. Public/Free APIs Only; V. One Page; VI. Readable on a Phone (320px); VII. Visible API Failures.

## Regeneration note (2026-09-28)

This file replaces the pre-amendment list. The previous version contained roughly 80 test tasks:
per-function suites for `config`, `time`, `validation`, `json-fetch`, and `normalize`; contract-test
suites under `tests/integration/`; separate suites per widget renderer; a no-refresh proof built on
a document double and a scheduler double; fixture files for each source; and remediation tasks
T053-T059 that hardened those test doubles. All of it is gone.

Two consequences drive the new list:

1. `src/lib/validation.js` and most of `src/lib/time.js` were built to be unit-tested per function.
   With those tests deleted, they are speculative abstractions under Principle I. Phase 1 folds them
   into the code that actually uses them.
2. `tests/fixtures/`, `tests/helpers/`, and `tests/unit/`, `tests/integration/` were removed when
   the old suite was deleted. Only the two files in the plan.md Test Plan come back.

## Existing Work (do not redo)

| File | State |
|------|-------|
| `package.json` | Done: ES modules, Node >= 24, empty `dependencies`, `start` and `test` scripts |
| `src/config.js` | Done: host, port, `PORT`/`HOST` only, 2500 ms timeout, the three fixed source URLs |
| `src/server.js` | Static file serving from `src/public/` with 404/405 and traversal protection. Exports `createServer({ fetchImpl, now })` and `startServer()`. **No `/api/dashboard` route yet.** |
| `src/lib/json-fetch.js` | Done: injected `fetchImpl`, abort-signal timeout, typed errors, no retries |
| `src/dashboard/normalize.js` | Done: `okResult`, `errorResult`, `ERROR_CODES`, safe default messages |
| `src/lib/time.js` | Built for per-function tests. Trim in T002. |
| `src/lib/validation.js` | Built for per-function tests. Delete in T001. |
| `src/public/index.html` | Placeholder: an empty `<main id="app">` with no widget regions |
| `src/public/app.js`, `render.js`, `styles.css` | 1-line placeholders |
| `src/sources/`, `src/api/` | Empty |
| `tests/` | Empty |

## Testing Budget (read before writing any test)

- 4 testing tasks, 8 tests, hard cap 12. Headroom for 4 folded-in regression assertions.
- Files: `tests/render.test.js` (2 tests) and `tests/adapters.test.js` (6 tests). Nothing else.
- Adapter tests inject a `fetchImpl` that returns a small response literal written inline in the
  test file. No `tests/fixtures/`, no shared helpers, no test-double modules.
- Forbidden: per-ticker tests, contract-test folders, snapshot files, field-by-field end-to-end
  coverage, coverage-percentage targets, one test file per function.
- A new test requires deleting an equivalent number of existing ones.
- Per-story independent testing is no longer automated. Each story's "Independent Test" in
  spec.md is now performed by hand against a live or hand-mocked source response, and the result
  is recorded in the task's checkpoint. Only the 8 tests in T020-T023 are automated.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1..US4)
- Include exact file paths in descriptions

## Path Conventions

Single project at repository root: `src/` for code, `src/public/` for browser assets, `tests/` for
the two test files. Node.js 24 LTS, native ES modules, Node built-ins only (`node:http`, native
`fetch`, `AbortSignal`, `URL`, `node:test`). No runtime package dependencies, no build step, no
TypeScript.

---

## Phase 1: Reconcile the Trim Fallout

**Purpose**: Remove the abstractions that only the deleted per-function tests justified, before new
code is layered on top of them.

- [x] T001 Delete `src/lib/validation.js`. `isFiniteNumber`, `isNonEmptyString`, `isPositiveNumber`,
  and `isIsoTimestamp` had exactly one consumer: their own unit test. The three adapters need a
  finite-number check and a positive-number check inline. Confirmed with `grep -rn "validation" src/`
  that nothing imported it; deleted.
- [x] T002 [P] Reduce `src/lib/time.js` to the helpers the three adapters actually call. Removed
  `CLOCK_SKEW_MS`, `isFutureBeyondSkew`, and `timestampMs`; kept `parseZonedTimestamp`,
  `parseTimestamp`, `isStale`, `WEATHER_MAX_AGE_MS`, and `MARKET_MAX_AGE_MS`. **Result: 140 lines,
  not the <80 originally targeted.** `zoneOffsetMs`, `zoneFields`, and the `ZONED_FORMATTERS` cache
  are load-bearing for `parseZonedTimestamp` and were kept; removing them would break the one
  function this task marks CRITICAL, and behavior preservation outranks the line target. Verified
  by diffing a 43-case behavioral baseline before and after: all 41 surviving cases identical.
  **Consequence**: rejecting an implausibly-future timestamp now belongs to each adapter, since
  `isFutureBeyondSkew` was its only implementation — see T011 and T017.
- [x] T003 [P] Confirm `src/lib/json-fetch.js` and `src/dashboard/normalize.js` are the only shared
  modules the adapters need, and that no other module in `src/` imports a deleted file. Leave both
  in place: `fetchJson` carries the timeout and the typed `upstream_error` / `timeout` mapping the
  failure tests assert, and `normalize` carries the result union the renderer consumes. Confirmed
  `src/lib/` holds exactly these two modules, both leaf modules with zero imports, and that
  `src/server.js` is the only file in `src/` with a relative import.

**Checkpoint**: `src/lib/` holds two modules, both with a named consumer. `grep -rn "from \"\\.\\./" src/`
resolves cleanly.

---

## Phase 2: User Story 1 - View a predictable dashboard snapshot (Priority: P1) MVP

**Goal**: One page load produces one `GET /api/dashboard` request returning independent `weather`,
`cedears`, and `mep` widget results; the client renders loading, data, or error state per widget and
never changes the snapshot until a browser reload.

**Independent Test (manual)**: Start the server with a `fetchImpl` stubbed per source, load the page,
confirm the three values appear and do not change on their own, then reload and confirm a fresh
snapshot.

**Requirements covered**: FR-001, FR-002, FR-003, FR-011, FR-012, SC-001, SC-004, SC-005, SC-007.

- [x] T004 [P] [US1] Implement `createDashboardService({ adapters, now })` in
  `src/dashboard/service.js`. Call the three adapters concurrently with `Promise.allSettled`, build
  the envelope `{ retrievedAt, weather, cedears, mep }`, convert any adapter rejection into a typed
  widget error via `errorResult`, and add no retry, cache, persist, or extra request.
- [x] T005 [US1] Implement the `GET /api/dashboard` handler in `src/api/dashboard-route.js` that calls
  the service once and sets `Content-Type: application/json; charset=utf-8` and
  `Cache-Control: no-store`. Return `200 OK` whenever the envelope builds, including partial source
  failure. Return a generic `500` body with no stack trace or upstream text otherwise.
- [x] T006 [US1] Wire the route into `src/server.js` so `GET /api/dashboard` dispatches to
  `src/api/dashboard-route.js`, other methods on that path return `405 Method Not Allowed`, and the
  default `fetchImpl` is the platform `fetch` with the same `timeoutMs` from `src/config.js`.
- [x] T007 [US1] Implement the core renderer in `src/public/render.js` as a factory taking the
  injected `document`. Export a `renderLoading` / `applyResult` pair that renders a visible
  placeholder, then the value plus a visible timestamp, or the error message accessibly with **no**
  numeric value. Applying a result to one widget must not touch its siblings. Per-widget value
  formatting is added in Phases 3-5.
- [x] T008 [US1] Implement the client bootstrap in `src/public/app.js`. Render loading placeholders
  for all three widgets, perform exactly one `GET /api/dashboard`, apply the response per widget
  independently, and register no interval, retry loop, or polling timer (FR-003). It must not
  re-invoke itself.
- [x] T009 [P] [US1] Write `src/public/index.html` with three labelled widget regions
  (`id="weather-widget"`, `id="cedears-widget"`, `id="mep-widget"`), each with a heading, a loading
  container, a value container, and an error container carrying `role="alert"` / `aria-live="polite"`.
  Load `styles.css` and `app.js` as a module. No login, account, or auth UI.
- [x] T010 [P] [US1] Write `src/public/styles.css`: mobile-first, legible at a 320px viewport with no
  horizontal scrolling, distinct visible loading/data/error states, card-per-widget grid/flex layout
  with `min-width: 0` on value containers so long error text wraps.

**Checkpoint**: One page, one request, three widget states, no polling. Verify by hand per the
Independent Test above.

---

## Phase 3: User Story 2 - Check the selected Buenos Aires weather (Priority: P1)

**Goal**: The weather widget shows current Buenos Aires temperature in Celsius, a readable condition
label, and the source observation time, or a distinct visible error.

**Independent Test (manual)**: Stub the weather response with a valid current-weather payload and
confirm the widget shows Celsius temperature, condition, and the source as-of time. Stub a failure
and confirm a visible error and no invented or reused value.

**Requirements covered**: FR-004, FR-009, FR-010, SC-001, SC-005.

- [x] T011 [US2] Implement `createOpenMeteoAdapter({ fetchImpl, now, timeoutMs })` in
  `src/sources/open-meteo.js`, returning `fetchSnapshot()`. Map WMO codes to a fixed local
  condition-label table, set `location` to the literal `"Buenos Aires"`, and ignore extra payload
  fields. Because the request sets `timezone=America%2FArgentina%2FBuenos_Aires`, `current.time`
  arrives offset-less; call `parseZonedTimestamp(current.time, "America/Argentina/Buenos_Aires")` and
  feed the resulting UTC instant into the 3-hour staleness check. Reject an observation that is
  invalid **or implausibly in the future** (`contracts/source-adapters.md:19`) with an inline check —
  T002 removed the shared `isFutureBeyondSkew`, so this rule is now the adapter's own. Return a typed
  error rather than any invented or reused value on failure.
- [x] T012 [US2] Add the `renderWeather` hook to `src/public/render.js`: `temperatureC` as a finite
  number with a `°C` suffix, the mapped condition, and an observation-time line. When `observedAt`
  is null, show the result `retrievedAt` with a retrieval label.
- [x] T013 [P] [US2] Register the Open-Meteo adapter in the service factory and add the weather
  success/error/loading copy to `src/public/index.html` and `src/public/styles.css`.

**Checkpoint**: US1 and US2 both work, verified by hand.

---

## Phase 4: User Story 3 - Review the five selected CEDEARs (Priority: P1)

**Goal**: The CEDEAR widget shows exactly `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA` in that order with
local ARS prices and a retrieval-labeled timestamp, or a distinct visible error with no substitution.

**Independent Test (manual)**: Stub valid local quotes for all five and confirm exactly those five
appear in that order. Omit one and confirm a visible error rather than a substitute or a partial list.

**Requirements covered**: FR-005, FR-006, FR-009, FR-010, FR-011, SC-002, SC-005.

- [x] T014 [US3] Implement `createData912CedearsAdapter({ fetchImpl, now, timeoutMs })` in
  `src/sources/data912-cedears.js`, returning `fetchSnapshot()`. Hardcode the allowlist and output
  order `["AAPL", "MSFT", "GOOGL", "META", "NVDA"]` and the fixed local label map
  (`Apple`, `Microsoft`, `Alphabet`, `Meta`, `Nvidia`); take `priceArs` from the payload's `c` field
  and never from a label field. Set `observedAt` to null and `timestampKind` to `"retrieval"`. Never
  rank, sort, or substitute symbols. Fail the whole widget rather than returning a partial list.
- [x] T015 [US3] Add the `renderCedears` hook to `src/public/render.js`: one row per quote in array
  order with no client-side re-sorting, each showing ticker, label, and `priceArs` as pesos, plus a
  **retrieval** timestamp label derived from the result `retrievedAt`. Never a live or real-time
  label. **Constraint from T012**: the renderer may only use `getElementById`, `textContent`, and
  `hidden` — no `innerHTML`, no element creation — so the five rows must be a single `\n`-joined text
  node. Return the same `{ text, time, timeKind }` view model the weather hook uses, with
  `timeKind: "retrieval"` so the label reads `Consultado: `.
- [x] T016 [P] [US3] Register the Data912 adapter by adding one line to the `adapters` map in
  `src/server.js` (the factory form). Add `white-space: pre-line` to `.widget__value` in
  `src/public/styles.css` so the `\n`-joined rows from T015 render as separate lines, plus the CEDEAR
  list and error styling, including wrap behavior for long error text at 320px.

**Checkpoint**: US1, US2, and US3 work, verified by hand.

---

## Phase 5: User Story 4 - Check the MEP peso rate (Priority: P2)

**Goal**: The exchange-rate widget shows the MEP/bolsa midpoint in ARS per USD rounded to two
decimals, labeled `MEP/bolsa`, with an as-of time, and never falls back to BNA or blue.

**Independent Test (manual)**: Stub valid MEP buy and sell values and confirm the widget shows their
midpoint as ARS per USD labeled MEP/bolsa with an as-of time. Stub a failure and confirm no fallback
to another rate type.

**Requirements covered**: FR-007, FR-008, FR-009, FR-010, SC-003, SC-005.

- [x] T017 [US4] Implement `createDolarApiMepAdapter({ fetchImpl, now, timeoutMs })` in
  `src/sources/dolarapi-mep.js`, returning `fetchSnapshot()`. Set `rateType` to the literal
  `"MEP/bolsa"`, compute `midpointArs` as `(compra + venta) / 2` rounded to exactly two decimals,
  apply the 7-day staleness window, and require both `compra` and `venta` to be positive numbers.
  Reject a quote that is invalid **or implausibly in the future** (`contracts/source-adapters.md:19`)
  with an inline check — T002 removed the shared `isFutureBeyondSkew`, so this rule is now the
  adapter's own. Return a typed error instead of any substitute rate when the source is unavailable.
  No code path reads, defaults to, or reports a BNA, blue, or CCL rate.
- [x] T018 [US4] Add the `renderMep` hook to `src/public/render.js`: `midpointArs` to two decimals
  with an `ARS per USD` unit, the `MEP/bolsa` label, the buy and sell values, and the
  `timestampKind`-appropriate time label. An error result renders the message and no numeric rate.
- [x] T019 [P] [US4] Register the DolarAPI adapter and add the rate and error styling.

---

## Phase 6: Testing (4 tasks, 8 tests, cap 12)

**Purpose**: Write the only 8 tests the product is allowed to have. Each task below owns a file; no
task adds a second file, a fixture, a helper, or a double.

- [x] T020 [TEST] Create `tests/render.test.js` with exactly **2 tests**:
    1. *Smoke* — start `createServer()` on an ephemeral port, `GET /`, and assert the returned HTML
       contains all three widget regions (`weather-widget`, `cedears-widget`, `mep-widget`).
    2. *Error state* — build a small inline fake `document` in this file, apply an
       `{ status: "error" }` result to one widget, and assert the error message is visible and no
       numeric value is rendered, while the sibling widgets are untouched.

    This is the first and only time a test file, a fake document, or a test runner import is
    created. Nothing in T001-T019 may add one.
- [x] T021 [TEST] Add exactly **3 happy-path tests** to `tests/adapters.test.js`, one per adapter,
    each injecting a `fetchImpl` that returns a small response literal written inline in this file:
    1. Weather: a valid current-weather payload maps to `status: "ok"` with a Celsius temperature,
       a condition label, and a source observation time resolved through `parseZonedTimestamp`.
    2. CEDEAR: a valid quotes payload maps to exactly `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA` in that
       order with positive `priceArs` values, with extra payload symbols filtered out.
    3. FX: a valid MEP payload maps to a two-decimal ARS-per-USD midpoint labeled `MEP/bolsa`.

    Use `node:test` and `node:assert`. Import the adapter factories from `src/sources/`. No network.
- [x] T022 [TEST] Add exactly **3 failure tests** to `tests/adapters.test.js`, each injecting a
    `fetchImpl` that returns a non-2xx response:
    1. Weather: yields `status: "error"` with an `upstream_error` code and no invented value.
    2. CEDEAR: yields `status: "error"` and no substituted ticker.
    3. FX: yields `status: "error"` and no BNA, blue, or CCL fallback.

    Assert the error object has no `value` key and no upstream response text or stack trace.
- [x] T023 [TEST] Verify the suite budget and run it. Confirm `npm test` is green, reports exactly
    **8 tests**, that `find tests -type f` returns only `tests/render.test.js` and
    `tests/adapters.test.js`, and that no `tests/fixtures/`, `tests/helpers/`, `tests/unit/`, or
    `tests/integration/` directory exists. If any of this fails, fold or delete the offending test
    until it holds — do not raise the cap. Record the count in the completion report.

**Checkpoint**: 8 passing tests, 2 files, under the cap of 12. This is the whole automated suite.

---

## Phase 7: Polish and Cross-Cutting Gates

- [ ] T024 [P] Write `README.md`: prerequisites (Node.js 24 LTS, a modern browser, internet access;
  **no Docker**), how to run locally (`npm start`, `http://127.0.0.1:3000/`,
  `PORT=3100 node src/server.js`), how to run the tests (`npm test` / `node --test`), what each
  widget shows, the resolved data policy (fixed `AAPL, MSFT, GOOGL, META, NVDA`; MEP/bolsa midpoint
  with no BNA or blue fallback; Celsius from Open-Meteo; refresh on page load only), and the note
  that no API keys or secrets are required.
- [ ] T025 [P] Run a repository hygiene scan for API keys, tokens, `.env` files, and secret
  environment variables across `src/`, `tests/`, `README.md`, and `package.json`, and confirm none
  exist (FR-013, Constitution III).
- [ ] T026 Confirm scope exclusions hold: no authentication, alerts, historical charts, trading
  actions, database, cache, background scheduler, Docker, or build step exists in `src/`
  (FR-016, Constitution I and V).
- [ ] T027 Review `src/public/app.js` by hand and confirm it registers no interval, retry loop, or
  polling timer, and that loading the page and waiting does not change the displayed snapshot
  (FR-003, SC-004). This replaces the deleted no-refresh test and is a review item, not a test.
- [ ] T028 Run every command in `specs/002-dashboard-data-policy/quickstart.md` as written and
  confirm each behaves as documented (SC-009).
- [ ] T029 Manually walk the per-story Independent Test in Phases 2-5 and record the result for each
  story in the completion report, since no per-story automated test exists.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Reconcile (Phase 1)**: No dependencies.
- **US1 (Phase 2)**: Depends on Phase 1. Blocks all other stories.
- **US2 / US3 / US4 (Phases 3-5)**: Each depends on Phase 2. Independent of each other; they share
  `src/public/render.js` and the service factory, so coordinate those edits or run sequentially.
  Recommended order: US2, US3, US4.
- **Testing (Phase 6)**: T020 depends on Phase 2. T021 and T022 depend on Phases 3-5. T023 depends
  on T020-T022.
- **Polish (Phase 7)**: Depends on Phase 6.

### Critical Path

`T001 -> T004 -> T005 -> T006 -> T007 -> T008 -> T011 -> T014 -> T017 -> T021 -> T022 -> T023`

### Within Each User Story

- Adapter and renderer before the service wiring that registers it.
- Core renderer before widget-specific renderers.
- Renderer before client wiring.
- Story complete before moving to the next priority.

### Parallel Opportunities

- T002, T003 in Phase 1
- T009, T010 in Phase 2
- T013, T016, T019, T024, T025

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: reconcile the trim fallout
2. Phase 2: US1
3. **STOP and VALIDATE by hand**: start the server, confirm one page load shows three
   loading-to-data-or-error states, one request, no polling
4. Ship the page shell as a deployable increment

### Incremental Delivery

1. Phase 1 + US1: one page, one request, three widget states, no polling
2. US2: real Celsius Buenos Aires weather
3. US3: the five fixed CEDEARs in fixed order
4. US4: the MEP/bolsa midpoint with no fallback
5. Phase 6: the 8 tests
6. Phase 7: README, secret scan, 320px check, quickstart validation

## Notes

- Constitution Principle II is non-negotiable: at most 12 tests, 4 testing tasks, and none of the
  forbidden patterns. T023 fails the plan if the count is higher.
- No task in this list may be satisfied by adding a test that is not in the plan.md Test Plan.
- Behavior with no test is reviewed by hand against spec.md and consciously accepted, not closed
  with an extra test.
- Stop at any checkpoint to validate the story independently.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence, a build
  step or runtime dependency, and any scope listed in FR-016.
