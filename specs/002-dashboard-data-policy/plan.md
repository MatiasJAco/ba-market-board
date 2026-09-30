# Implementation Plan: BA Market Dashboard Data Policy

**Branch**: `002-dashboard-data-policy` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-dashboard-data-policy/spec.md`

## Summary

Build a single-page Node.js web app that serves a small responsive dashboard and a same-origin `GET /api/dashboard` endpoint. Each browser page load makes one dashboard request; the server fetches Open-Meteo current weather, Data912 CEDEAR quotes, and the DolarAPI MEP quote in parallel, normalizes each result independently, and renders loading, valid-data, or visible-error states without polling, persistence, authentication, Docker, or API secrets.

The fixed CEDEAR list is `AAPL`, `MSFT`, `GOOGL`, `META`, and `NVDA`. The exchange-rate widget displays the two-decimal midpoint of MEP/bolsa buy and sell values. Source timestamps are displayed when valid; otherwise a clearly labeled retrieval time is used.

## Technical Context

**Language/Version**: JavaScript with native ES modules; Node.js 24 LTS; modern browser HTML/CSS/JavaScript

**Primary Dependencies**: Node.js built-ins only: `node:http`, native `fetch`, `AbortSignal`, `URL`, and `node:test`; no runtime package dependencies

**Storage**: None; request-scoped in-memory data only

**Testing**: `node:test` executed with `node --test`. Exactly 8 tests, budgeted at a hard cap of 12, listed in Test Plan below. Two test files and no other suites, helpers, doubles, or fixture directories.

**Target Platform**: Node.js 24 LTS on Linux, macOS, or Windows; a modern browser at a local or deployed HTTP origin; responsive from 320 pixels wide

**Project Type**: Single-page web application with a small same-origin JSON API

**Performance Goals**: Show all initial widget states within 3 seconds at the 95th percentile under a normal mobile connection; apply a 2.5-second timeout to each upstream request; make three upstream requests in parallel per page load; never poll

> **Superseded**: the 2.5-second per-request timeout in this line is superseded by the single 15,000-millisecond budget defined in [`specs/004-fix-timeout-budget/contracts/wait-budget.md`](../004-fix-timeout-budget/contracts/wait-budget.md). Everything else in this line still stands.

**Constraints**: One page; public/free sources; no secrets in git; fixed five-ticker CEDEAR list; MEP/bolsa midpoint with no BNA or blue fallback; Celsius weather; explicit source or retrieval timestamp; independent visible errors; at most 12 automated tests with no forbidden test pattern; no Docker, database, build step, authentication, alerts, charts, or trading actions

**Scale/Scope**: One small server process, one browser page, three source adapters, five CEDEAR rows, no persistence, no background jobs, and no multi-user data model

## Test Plan

The suite is a budgeted safety net. It is exactly these 8 tests and nothing else; the constitutional
cap is 12, so there is room for 4 folded-in regression assertions but no additional suites.

| # | Test | File | What it pins |
|---|------|------|--------------|
| 1 | Smoke | `tests/render.test.js` | `GET /` returns the page containing all three widget regions |
| 2 | Weather adapter, happy path | `tests/adapters.test.js` | A valid current-weather response maps to a Celsius value and source observation time |
| 3 | CEDEAR adapter, happy path | `tests/adapters.test.js` | A valid quote response maps to exactly the five fixed tickers in order |
| 4 | FX adapter, happy path | `tests/adapters.test.js` | A valid MEP response maps to a two-decimal ARS-per-USD midpoint labeled MEP/bolsa |
| 5 | Weather adapter, failure | `tests/adapters.test.js` | A non-2xx response yields a typed error result and no invented value |
| 6 | CEDEAR adapter, failure | `tests/adapters.test.js` | A non-2xx response yields a typed error result and no substituted ticker |
| 7 | FX adapter, failure | `tests/adapters.test.js` | A non-2xx response yields a typed error result and no BNA or blue fallback |
| 8 | Error state | `tests/render.test.js` | A failed widget renders its visible error and no numeric value |

**Rules for this suite** (from Constitution II):

- Adapter tests use mocked HTTP passed into the adapters. No live network calls, no `tests/fixtures/`
  directory, and no shared test-helper or test-double modules.
- No per-ticker tests, contract-test suites, snapshot files, field-by-field end-to-end coverage,
  coverage-percentage targets, or one test file per function.
- Tests are written alongside the behavior they cover, not before it. There is no
  observe-the-fail-first step.
- A bug fix is asserted inside the closest existing test above. A new test requires deleting an
  equivalent number of existing ones to stay under the cap.
- Behavior not covered by this list is consciously accepted as uncovered and reviewed by hand
  against the spec, not closed with an extra test.


## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Plan evidence | Status |
|-----------|---------------|--------|
| I. Small Webapp | One page and one snapshot endpoint; no speculative routes, storage, or services | PASS |
| II. Right-Sized Tests | The Test Plan section defines exactly 8 tests in 2 files against a cap of 12, and no forbidden pattern | PASS |
| III. No API Secrets in Git | All selected sources are called without credentials; no token or secret configuration is required | PASS |
| IV. Public, Free APIs Only | Open-Meteo, Data912, and DolarAPI expose public JSON endpoints; terms and source limitations are recorded in `research.md` | PASS |
| V. One Page | Static assets and the dashboard are the only product surface | PASS |
| VI. Readable on a Phone | Responsive CSS targets a 320-pixel viewport without horizontal scrolling | PASS |
| VII. Visible API Failures | Each widget has an independent success/error union and distinct user-visible error state | PASS |

**Pre-Phase 0 gate**: PASS. The selected stack and source policy comply with all seven constitution principles.

**Post-Phase 1 gate**: PASS. `research.md`, `data-model.md`, `contracts/dashboard-api.md`, and `quickstart.md` preserve the same one-page, public/free, no-secret, phone-readable, and visible-failure constraints, and no longer prescribe a test suite beyond the Test Plan list.

## Project Structure

### Documentation (this feature)

```text
specs/002-dashboard-data-policy/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dashboard-api.md
└── tasks.md                 # Created by /speckit.tasks, not by this plan
```

### Source Code (repository root)

```text
README.md
package.json
src/
├── server.js
├── config.js
├── api/
│   └── dashboard-route.js
├── dashboard/
│   ├── service.js
│   └── normalize.js
├── lib/
│   ├── json-fetch.js
│   └── time.js
├── sources/
│   ├── open-meteo.js
│   ├── data912-cedears.js
│   └── dolarapi-mep.js
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── render.js

tests/
├── render.test.js         # 2 tests: smoke + error state
└── adapters.test.js       # 6 tests: 3 adapters x happy path + failure
```

**Structure Decision**: Use one Node.js process with no build step. `src/server.js` serves the static files from `src/public/` and routes `GET /api/dashboard`; source adapters are isolated under `src/sources/`; the dashboard service normalizes and combines independent results; `src/public/app.js` performs the one browser request and delegates display updates to `src/public/render.js`.

Adapters accept an injected `fetch` so the six adapter tests can drive them with mocked HTTP. The
renderer is a factory that accepts a document, so the two rendering tests can pass a small inline
fake written in the test file itself. No `tests/helpers/`, `tests/fixtures/`, document-double
module, or scheduler-double module exists, because nothing in the Test Plan needs one.

## Complexity Tracking

The two rejected elaborations from the previous plan version are removed, not deferred:
a normalized fetch wrapper with its own unit suite, and a browser test-seam architecture
(document and scheduler doubles) that only a forbidden per-function suite would have required.

