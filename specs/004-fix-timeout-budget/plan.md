# Implementation Plan: Fix the Frequent False Data-Source Timeout

**Branch**: `fix/upstream-timeout` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-fix-timeout-budget/spec.md`

**Note**: `.specify/scripts/bash/setup-plan.sh` reports `BRANCH=004-fix-timeout-budget`. That value is
derived from the feature directory because `.specify/feature.json` carries no branch field. The real
checked-out branch is `fix/upstream-timeout`, and this plan targets that branch. Per
`.specify/memory/constitution.md`, the spec directory name and the branch name are independent.

## The file and the current constant

The user asked for these by name. There is exactly one constant, and it is duplicated.

| What | Where | Current value |
|------|-------|---------------|
| **The authoritative constant** | `src/config.js:5` — `export const DEFAULT_TIMEOUT_MS` | `2500` |
| Duplicate private copy | `src/lib/json-fetch.js:1` — `const DEFAULT_TIMEOUT_MS` (module-local, not imported) | `2500` |
| Fourth copy, in a test | `tests/adapters.test.js:19` — `const TIMEOUT_MS` | `2500` |
| Prose copy | `README.md:113` — "Cada petición tiene un timeout de **2500 ms**" | `2500 ms` |
| Superseded Spec Kit copies | `specs/002-dashboard-data-policy/plan.md:27`, `specs/002-dashboard-data-policy/contracts/source-adapters.md:11` | `2.5 s` / `2,500 ms` |

Wiring of the constant, end to end, today:

```text
src/config.js:5            DEFAULT_TIMEOUT_MS = 2500
  -> src/config.js:38      loadConfig().timeoutMs
    -> src/server.js:84-96 createServer reads it, passes it to createDashboardService
      -> src/dashboard/service.js:28-30   dependencies = { fetchImpl, now, timeoutMs }
        -> src/sources/open-meteo.js:79-85       adapter({ timeoutMs }) -> fetchJson(url, { timeoutMs })
        -> src/sources/data912-cedears.js:77-83  adapter({ timeoutMs }) -> fetchJson(url, { timeoutMs })
        -> src/sources/dolarapi-mep.js:40-46     adapter({ timeoutMs }) -> fetchJson(url, { timeoutMs })
          -> src/lib/json-fetch.js:25      fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
```

Two facts established by running the platform, not by reading it:

1. `AbortSignal.timeout(ms)` makes `fetch` reject with a `DOMException` whose `name` is
   **`TimeoutError`** (verified on Node v22.22.0 against a server that accepts and never answers).
2. A manual `AbortController.abort()` makes `fetch` reject with `name === "AbortError"`, and a
   refused connection rejects with `TypeError: fetch failed`.

Therefore `src/lib/json-fetch.js:14-16`, `isTimeoutCause(cause)`, currently returns `true` for
`AbortError`. `AbortError` never means "the budget expired" in this runtime, so every non-timeout
cancellation is reported to the visitor as `timeout` — the false message in the bug report. The fix
is to match `TimeoutError` only; `AbortError` then falls through to `upstream_error`, which already
exists in the vocabulary, so no new code and no new message are introduced.

## Summary

Replace the tight 2,500-millisecond per-request budget and its four scattered copies with one
15,000-millisecond value owned by `src/config.js`, reachable from the environment through the same
surface that already carries `HOST` and `PORT`, and documented once in the README. Reserve the
timeout notice for a real budget expiry by matching the runtime's actual `TimeoutError` and nothing
else. Bound the browser's wait with the same single value so a response that never arrives leaves
the loading state instead of spinning forever, delivering that value to the page by substituting a
non-numeric token in the served text assets so the repository still contains exactly one number for
this budget. No new dependency, no retry loop, no new test file, no new test case, no UI change.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js — `package.json` declares `engines.node >=24`;
the toolchain present in this workspace is Node v22.22.0. Both provide `AbortSignal.timeout`,
`Promise.allSettled`, and the built-in `node:test` runner the project already uses.

**Primary Dependencies**: None. `package.json` `dependencies` is `{}` and stays `{}` (FR-012, SC-008).
Only Node built-ins are used: `node:http`, `node:fs/promises`, `node:url`, `node:assert/strict`,
`node:test`.

**Storage**: None. No database, no files written at runtime. Configuration comes from environment
variables and constants.

**Testing**: `node:test` via `npm test` (`node --test`). 8 tests exist across
`tests/adapters.test.js` (6) and `tests/render.test.js` (2). The suite stays at 8 (FR-014, FR-015,
SC-007). No new test file, no new test case, no live network call, no coverage target.

**Target Platform**: A single-page local web app served by `node src/server.js` on
`http://127.0.0.1:3000/` by default, read on a phone-sized viewport. Browser side is plain ES modules
with no build step and no bundler.

**Project Type**: Single Node web service that also serves its own static front end. No framework,
no transpiler, no package manager install step.

**Performance Goals**: One 15,000-millisecond wait budget, applied independently to each of the
three parallel source requests, so the board's worst-case wait is approximately one budget, not
three. The board reaches a fully resolved state within the budget plus 1 second (SC-003, SC-009).

**Constraints**: One page (Principle V). Three fixed public free sources, unchanged (Principle IV,
FR-010). No secrets (Principle III). Failures always visible and never silently empty (Principle
VII). At most one number anywhere in the repository may describe this budget (FR-001, FR-003, SC-002).
No new dependency (FR-012). No retry, backoff, queue, or cache (FR-011). No UI, layout, typography,
colour, or copy change (FR-010, and the out-of-scope list). No new test file or case (FR-014).

**Scale/Scope**: Three widgets, three sources, one request per source per page load, one HTML page,
roughly 600 lines of source across 12 files. This is a bugfix: the expected diff is small and
localized, and the plan deliberately adds no abstraction the project does not already have.

## Change surface

The user's constraint is a **config-only change surface** with all approved spec FRs kept. That means
the only *configuration* touched is the wait budget — no other setting, no refactor of the service,
adapters, route, or renderer — while the behavior changes already approved in the spec (FR-006's
honest timeout notice, FR-009's browser bound) stay in scope. Concretely:

| File | Change | Requirement |
|------|--------|-------------|
| `src/config.js` | `DEFAULT_TIMEOUT_MS` 2500 → 15000; add `readTimeoutMs(env)` reading `TIMEOUT_MS` with the same shape as `readPort`/`readHost` | FR-001, FR-002 |
| `src/lib/json-fetch.js` | delete the private duplicate constant at line 1 and import the one from `../config.js`; narrow `isTimeoutCause` to `TimeoutError` only | FR-001, FR-003, FR-006 |
| `src/public/app.js` | pass a deadline to the board fetch, read from a token the server substitutes; no hard-coded number | FR-001, FR-009 |
| `src/server.js` | substitute the token with the configured value when serving a text asset | FR-001, FR-009 |
| `README.md` | the single prose statement becomes 15,000 ms | FR-003, SC-002 |
| `tests/adapters.test.js` | drop the local `TIMEOUT_MS = 2500` copy; assert the documented budget and the honest mapping inside the three existing failure tests | FR-014, FR-015, FR-017 |
| `specs/002-dashboard-data-policy/plan.md`, `.../contracts/source-adapters.md` | record that 2,500 ms is superseded by this feature's single budget | spec assumption |

Nothing else is touched. In particular `src/dashboard/service.js`, the three adapters,
`src/api/dashboard-route.js`, `src/dashboard/normalize.js`, `src/lib/time.js`, and
`src/public/render.js` keep their current behavior; they receive the new value through the
parameters they already accept.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Verdict |
|-----------|------|---------|
| I. Small Webapp | No speculative feature, service, or abstraction beyond the spec | **PASS** — one constant, one env reader matching two existing readers, one predicate narrowed, one token substitution. No new module, no new class, no new layer. The token substitution is the minimum mechanism that lets FR-001 and FR-009 both hold; see [research.md](./research.md) decision D3. |
| II. Right-Sized Tests | ≤12 tests, fixed allowed inventory, no forbidden pattern, no test file per helper | **PASS** — suite stays at 8, inside the 8-category inventory. FR-014 adds no file and no case; FR-015 folds the budget assertion into the three existing adapter-failure tests. No scheduler double, clock double, or config-loader test is created. |
| III. No API Secrets in Git | No key, token, or credential | **PASS** — `TIMEOUT_MS` is a duration, not a credential. Nothing is logged. |
| IV. Public, Free APIs Only | No new or changed external source | **PASS** — the same three sources with the same URLs and request shapes; FR-010 and FR-011 forbid any addition. |
| V. One Page | No new page, route, or flow | **PASS** — no route is added; the only new server behavior is a substitution inside the existing static-asset path. |
| VI. Readable on a Phone | No layout or type change | **PASS** — the feature changes when a card resolves, not how it looks. No stylesheet edit. |
| VII. Visible API Failures | Failure always visible, distinguishable from valid data | **PASS, strengthened** — FR-006 removes the false timeout notice, FR-009 guarantees the loading state is always left, FR-007 keeps every other failure's message intact. |
| VIII. Lean Source and Honest Tests | No essay comments; no test citing a Spec Kit path; no stylesheet assertions | **PASS with cleanup** — no new comments beyond at most one short line per non-obvious invariant. Because this feature edits `tests/adapters.test.js`, the pre-existing violations the constitution flagged as follow-up TODOs in that file (the header citing `specs/002-dashboard-data-policy/plan.md`, and the multi-line essay comments) are removed in the same pass. No test is added against stylesheet source text. |

**Post-design re-check (after Phase 1)**: all eight verdicts unchanged. The Phase 1 artifacts add one
contract document and no interface that widens the product surface: the `/api/dashboard` response
shape, the error vocabulary, and the card states are all untouched, which keeps Principles I, V, and
VII satisfied on the same terms as the pre-design check.

**Complexity Tracking**: no violations to justify. The table is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-timeout-budget/
├── spec.md                  # approved specification (source of truth)
├── plan.md                  # This file (/speckit-plan output)
├── research.md              # Phase 0 output: decisions D1-D5
├── data-model.md            # Phase 1 output: budget, expiry, failure kinds, states
├── quickstart.md            # Phase 1 output: runnable validation guide
├── contracts/
│   └── wait-budget.md       # Phase 1 output: the single budget, its config surface, its token
├── checklists/
│   └── requirements.md      # specification quality checklist, 22/22 passing
└── tasks.md                 # Phase 2 output (/speckit-tasks) - NOT created here
```

### Source Code (repository root)

The repository keeps its existing single-project layout. Only the seven files in the change-surface
table above are modified; no file is added to `src/` or `tests/`.

```text
src/
├── config.js                # the one wait budget: DEFAULT_TIMEOUT_MS, readTimeoutMs(env)
├── server.js                # static asset path also substitutes the budget token
├── lib/
│   ├── json-fetch.js        # imports the one constant; isTimeoutCause matches TimeoutError only
│   └── time.js              # unchanged
├── dashboard/
│   ├── service.js           # unchanged - already threads timeoutMs through
│   └── normalize.js         # unchanged - the 8 error codes and messages stay as they are
├── sources/                 # all three unchanged - they already accept timeoutMs
│   ├── open-meteo.js
│   ├── data912-cedears.js
│   └── dolarapi-mep.js
├── api/
│   └── dashboard-route.js   # unchanged - response shape unchanged
└── public/
    ├── index.html           # unchanged
    ├── app.js               # browser wait bound, read from the substituted token
    ├── render.js            # unchanged
    └── styles.css           # unchanged

tests/
├── adapters.test.js         # 6 tests, unchanged count; local 2500 copy removed, assertions folded in
└── render.test.js           # 2 tests, unchanged
```

**Structure Decision**: keep the existing single-project structure. The feature is a bugfix to one
constant and one predicate; introducing a new directory, a config module, a timeout helper, or a
retry/backoff module would violate Principle I and the out-of-scope list. The three adapters, the
service, the route, and the renderer are deliberately left alone because each already accepts the
value this feature changes, which is the cheapest possible blast radius.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The table is empty by design: every requirement in this plan is satisfiable inside the
structures the project already has.
