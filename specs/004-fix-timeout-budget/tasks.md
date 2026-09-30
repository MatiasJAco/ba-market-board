# Tasks: Fix the Frequent False Data-Source Timeout

**Input**: Design documents from `/specs/004-fix-timeout-budget/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/wait-budget.md, quickstart.md

**Tests**: One test task, T002. It edits the existing `tests/adapters.test.js` only: no new test
file, no new test case, suite stays at 8 tests in 2 files (FR-014, FR-016, SC-007).

**Task count**: 2. This is a hard cap set by the user on 2026-09-30. All four user stories are
delivered by T001, because they share one mechanism: the single wait budget and the rule for when it
may be reported as a failure. Splitting them across four phases would produce four edits to the same
constant for one behavior change.

**Organization deviation**: the standard per-story phase structure is collapsed into two sequential
tasks. The story-to-requirement trace is preserved in the table below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies) — **none apply**, the two tasks are sequential
- **[Story]**: `US1-US4` marks the single task that delivers all four stories
- File paths are exact; line numbers refer to the code as it stands before the edit

---

## Phase 1: The wait budget (T001)

- [x] T001 [US1-US4] Set the single wait budget to 15000 ms in `src/config.js:5`, add the `TIMEOUT_MS` override via a `readTimeoutMs(env)` helper beside `readPort`/`readHost` and use it at `src/config.js:38`, delete the duplicate `DEFAULT_TIMEOUT_MS` at `src/lib/json-fetch.js:1` and import the one from `../config.js` instead, narrow `isTimeoutCause` at `src/lib/json-fetch.js:14-16` to `cause?.name === "TimeoutError"` only, bound the browser wait in `src/public/app.js:15-29` from the token `src/server.js` substitutes into served `.html`/`.js` assets at `src/server.js:121-124`, and update `README.md:113` to state 15,000 ms once

**Goal**: one authoritative 15,000-millisecond budget that no healthy source can trip by accident, and
a timeout notice that appears only when that budget actually elapsed.

**Requirements**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010,
FR-011, FR-012, FR-013.

### Sub-steps, in order

1. **`src/config.js:5`** — change `export const DEFAULT_TIMEOUT_MS = 2500;` to
   `export const DEFAULT_TIMEOUT_MS = 15000;`. This is the only numeric declaration in the repository
   after this task.
2. **`src/config.js`** — add `readTimeoutMs(env)` next to `readPort` and `readHost`, following their
   exact shape. Trim the raw value; accept it only when it matches `/^\d+$/` **and** parses to a
   number greater than zero; otherwise return `DEFAULT_TIMEOUT_MS`. No upper bound. Then change
   `src/config.js:38` from `timeoutMs: DEFAULT_TIMEOUT_MS` to `timeoutMs: readTimeoutMs(env)`.
3. **`src/lib/json-fetch.js:1`** — delete `const DEFAULT_TIMEOUT_MS = 2500;` and add
   `import { DEFAULT_TIMEOUT_MS } from "../config.js";` above `MESSAGES`. Keep the existing default
   parameter at line 20.
4. **`src/lib/json-fetch.js:14-16`** — reduce `isTimeoutCause` to `cause?.name === "TimeoutError"`.
   `AbortError` then falls through to the existing `upstream_error`. Do not add an error code, a
   message, or a branch; the predicate is the whole fix.
5. **`src/public/app.js:15-29`** — in `readSnapshot`, pass a `signal` built from
   `AbortSignal.timeout(budget)` to `fetchImpl`, where `budget` is
   `Number.parseInt("__BOARD_BUDGET_MS__", 10)` and is used **only** when it is finite and greater
   than zero; otherwise pass no signal, which preserves today's behavior. The existing `catch` then
   already produces the generic load-failure notice, so the error branch needs no change.
6. **`src/server.js:121-124`** — when serving an asset whose extension is `.html` or `.js`, replace
   the quoted literal `"__BOARD_BUDGET_MS__"` with the quoted value of `loadConfig().timeoutMs`
   before sending. Apply the rule to every served text asset through one code path. Do not special-case
   a filename, and do not alter the byte length of any response that contains no token.
7. **`README.md:113`** — change "Cada petición tiene un timeout de **2500 ms**" to state the single
   15,000-millisecond budget. Keep the "no se reintenta" clause.
8. **`specs/002-dashboard-data-policy/plan.md:27`** and
   **`specs/002-dashboard-data-policy/contracts/source-adapters.md:11`** — append a supersession note
   pointing at `specs/004-fix-timeout-budget/contracts/wait-budget.md`. Do not rewrite the surrounding
   text of the completed feature.

### Do not touch

`src/dashboard/service.js`, `src/sources/open-meteo.js`, `src/sources/data912-cedears.js`,
`src/sources/dolarapi-mep.js`, `src/api/dashboard-route.js`, `src/dashboard/normalize.js`,
`src/lib/time.js`, `src/public/render.js`, `src/public/index.html`, `src/public/styles.css`,
`package.json`. Every one of them already accepts or ignores `timeoutMs` correctly, and FR-010 plus
the out-of-scope list forbid changing them.

### Independent test

```bash
npm test                                    # 8 tests still pass: the suite injects its own timeoutMs
grep -rn "2500" src/ README.md              # no output outside tests/, which T002 clears
TIMEOUT_MS=abc npm start                    # starts, falls back to 15000
TIMEOUT_MS=20000 npm start                  # starts, uses 20000
```

Then the behavioral checks in [quickstart.md](./quickstart.md) steps 2, 3, 4, 5, 6, 7, 8 and 9. The
decisive manual check is step 6: with the board response unreachable, the cards leave the loading
state at the budget and show "No se pudo cargar el panel. Volvé a cargar la página para intentarlo de
nuevo.", never the source-timeout notice.

**Checkpoint**: the bug is fixed and the board is usable. T002 is still required to close the last
copy of the number and to assert the regression.

---

## Phase 2: The one test task (T002)

- [x] T002 [US1-US4] Assert the 15,000 ms budget and the honest timeout mapping inside the three existing adapter-failure tests in `tests/adapters.test.js`, and delete the local `const TIMEOUT_MS = 2500` at line 19 in favour of the imported `DEFAULT_TIMEOUT_MS`

**Goal**: the regression cannot come back, without adding a ninth test.

**Requirements**: FR-014, FR-015, FR-016, FR-017. SC-002, SC-004, SC-005, SC-007.

### Sub-steps, in order

1. **`tests/adapters.test.js:19`** — delete `const TIMEOUT_MS = 2500;` and import
   `DEFAULT_TIMEOUT_MS` from `../src/config.js`. Replace the ten uses of `timeoutMs: TIMEOUT_MS` with
   the imported constant, so the suite stops restating the number.
2. **Inside the weather adapter failure test (`tests/adapters.test.js:165`)** — add four assertions to
   the test body that already exists, never a new test:
   - `DEFAULT_TIMEOUT_MS` equals `15000`, which is "the code uses the documented budget".
   - An adapter built **without** a `timeoutMs` argument still receives a `signal` on its fetch call,
     proving the value is wired from configuration rather than ignored.
   - With a deliberately tiny `timeoutMs` and a `fetchImpl` that never settles, the result code is
     `timeout`, proving the notice fires when the abort actually fires. This costs milliseconds
     because the budget under test is the injected one, not a real 15-second wait.
   - With a `fetchImpl` that rejects with `Object.assign(new Error("aborted"), { name: "AbortError" })`,
     the result code is `upstream_error` and **not** `timeout`. This is the regression in the bug
     report, asserted without any real waiting.
3. **Principle VIII cleanup in the same file** — remove the `specs/002-dashboard-data-policy/plan.md`
   citation at `tests/adapters.test.js:8` and reduce the multi-line essay comments to at most one short
   line each, or delete them. Tests must not cite Spec Kit artifact paths and must not restate what
   the code does. The constitution lists both as outstanding follow-ups on this file.
4. Leave `tests/render.test.js` untouched.

### Do not touch

No new test file, no new test case, no `tests/fixtures/`, no shared test helper, no test-double
module, no scheduler or clock double, and no assertion against stylesheet source text. The suite must
report **8 tests in 2 files** when finished.

### Independent test

```bash
npm test                                    # 8 tests, 2 files, all passing
grep -rn "2500" src/ tests/ README.md      # no output anywhere
grep -rn "specs/00" tests/                  # no output
```

**Checkpoint**: feature complete. Run every step of [quickstart.md](./quickstart.md) as the final
gate.

---

## Dependencies & Execution Order

Strictly sequential. T002 depends on T001 because the assertions read the constant T001 defines.

```text
T001 (the budget)  ->  @tester  ->  T002 (the one test task)  ->  @tester  ->  done
```

No `[P]` tasks exist. The two tasks share no parallel opportunity: T002 imports the symbol T001
creates.

## Requirement coverage

| Requirement | Task | Note |
|---|---|---|
| FR-001 one value, 15,000 ms | T001 | sub-steps 1, 3 |
| FR-002 `TIMEOUT_MS` override with fallback | T001 | sub-step 2 |
| FR-003 one documented statement | T001 | sub-steps 7, 8 |
| FR-004 per source, in parallel | T001 | unchanged wiring, verified by quickstart 4 |
| FR-005 budget covers the body read | T001 | single signal already covers connect and read |
| FR-006 notice only on real expiry | T001, T002 | sub-step 4; asserted in T002 |
| FR-007 other messages unchanged | T001, T002 | sub-step 4 adds no code; asserted in T002 |
| FR-008 one failure, one card | T001 | unchanged, verified by quickstart 7 |
| FR-009 browser bound, generic notice | T001 | sub-steps 5, 6 |
| FR-010 no change to sources or UI | T001 | "Do not touch" list; verified by quickstart 9 |
| FR-011 no retry, backoff, queue, cache | T001 | nothing added; verified by quickstart 8 |
| FR-012 no new dependency | T001 | `package.json` untouched |
| FR-013 no new page, route, widget | T001 | nothing added |
| FR-014 no new test file or case | T002 | suite stays 8 |
| FR-015 budget asserted in existing tests | T002 | sub-step 2 |
| FR-016 suite within the cap of 12 | T002 | 8 tests |
| FR-017 regression verifiable | T002 | sub-step 2 |
| SC-001, SC-003, SC-006, SC-009 | T001 | quickstart 4, 5, 8, 6 |
| SC-002, SC-004, SC-005, SC-007 | T002 | quickstart 2, 7, 7, 1 |
| SC-008 zero dependencies | T001 | `package.json` untouched |

## Notes

- **[P]**: none. Both tasks are sequential by construction.
- **[Story]**: `US1-US4` — T001 delivers all four stories at once, because the stories differ only in
  which budget behavior they exercise, not in which code they need. T002 asserts the same behaviors.
- **T002 is the "optionally one test" the user allowed.** It is still required: skipping it leaves a
  fourth copy of the old number in `tests/adapters.test.js`, leaves SC-002 unmet, and leaves the
  `AbortError` regression unasserted.
- **Constitution**: Principle II is respected — 8 tests, inside the eight-category inventory, no
  forbidden pattern. Principle VIII is respected and additionally repaired on the one test file this
  feature edits. No principle is violated, so Complexity Tracking stays empty.
- Stop after T002 and run the full quickstart. Do not add a third task; anything discovered that
  falls outside these two tasks is a new feature and needs its own spec.
