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

**Testing**: `node:test` executed with `node --test`; unit tests for source adapters and normalization, HTTP integration tests using an ephemeral port, and client rendering/no-refresh tests using injected document and scheduler test doubles

**Target Platform**: Node.js 24 LTS on Linux, macOS, or Windows; a modern browser at a local or deployed HTTP origin; responsive from 320 pixels wide

**Project Type**: Single-page web application with a small same-origin JSON API

**Performance Goals**: Show all initial widget states within 3 seconds at the 95th percentile under a normal mobile connection; apply a 2.5-second timeout to each upstream request; make three upstream requests in parallel per page load; never poll

**Constraints**: One page; public/free sources; no secrets in git; fixed five-ticker CEDEAR list; MEP/bolsa midpoint with no BNA or blue fallback; Celsius weather; explicit source or retrieval timestamp; independent visible errors; no Docker, database, build step, authentication, alerts, charts, or trading actions

**Scale/Scope**: One small server process, one browser page, three source adapters, five CEDEAR rows, no persistence, no background jobs, and no multi-user data model

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Plan evidence | Status |
|-----------|---------------|--------|
| I. Small Webapp | One page and one snapshot endpoint; no speculative routes, storage, or services | PASS |
| II. Test-First | Adapter, normalization, HTTP, rendering, failure, and no-interval tests are defined before implementation | PASS |
| III. No API Secrets in Git | All selected sources are called without credentials; no token or secret configuration is required | PASS |
| IV. Public, Free APIs Only | Open-Meteo, Data912, and DolarAPI expose public JSON endpoints; terms and source limitations are recorded in `research.md` | PASS |
| V. One Page | Static assets and the dashboard are the only product surface | PASS |
| VI. Readable on a Phone | Responsive CSS targets a 320-pixel viewport without horizontal scrolling | PASS |
| VII. Visible API Failures | Each widget has an independent success/error union and distinct user-visible error state | PASS |

**Pre-Phase 0 gate**: PASS. The selected stack and source policy comply with all seven constitution principles.

**Post-Phase 1 gate**: PASS. `research.md`, `data-model.md`, `contracts/dashboard-api.md`, and `quickstart.md` preserve the same one-page, public/free, no-secret, test-first, phone-readable, and visible-failure constraints.

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
│   ├── time.js
│   └── validation.js
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
├── fixtures/
│   ├── open-meteo.json
│   ├── data912-cedears.json
│   └── dolarapi-mep.json
├── unit/
│   ├── json-fetch.test.js
│   ├── sources/
│   ├── dashboard/
│   └── render/
└── integration/
    └── dashboard-route.test.js
```

**Structure Decision**: Use one Node.js process with no build step. `src/server.js` serves the static files from `src/public/` and routes `GET /api/dashboard`; source adapters are isolated under `src/sources/`; the dashboard service normalizes and combines independent results; `src/public/app.js` performs the one browser request and delegates display updates to `src/public/render.js`. Tests inject `fetch`, a document, and a scheduler so production adapters and timer behavior remain mockable without network access.

## Complexity Tracking

No constitution violations are required for this design.
