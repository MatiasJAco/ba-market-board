# Quickstart: Validating the Wait-Budget Fix

**Feature**: `specs/004-fix-timeout-budget` | **Date**: 2026-09-30

A runnable guide to prove the feature works end to end. It contains no implementation code; the
contract details live in [contracts/wait-budget.md](./contracts/wait-budget.md) and the entity
definitions in [data-model.md](./data-model.md).

## Prerequisites

- Node.js 24 or newer, as `package.json` declares. No install step: `dependencies` is empty.
- Nothing else. No API keys, no accounts, no configuration file.

## 1. The suite passes and stayed at 8 tests

```bash
npm test
```

Expected: all tests pass, and the run reports **8** tests across **2** files. If the count is 9 or
more, FR-014 has been broken. If a third test file appears, FR-014 has been broken.

## 2. Exactly one number describes the budget

```bash
grep -rn "2500\|2,500\|2\.5 s\|15000\|15,000" src/ tests/ README.md
```

Expected, and this is the SC-002 check:

- `src/config.js` holds the only numeric declaration, and it is `15000`.
- `README.md` states `15,000` **once**, in the data-sources section.
- `src/lib/json-fetch.js` no longer declares its own copy.
- `tests/adapters.test.js` no longer declares `TIMEOUT_MS = 2500`.
- `2500` appears **nowhere** in `src/`, `tests/`, or `README.md`.

## 3. The value is overridable, and bad input falls back

```bash
TIMEOUT_MS=20000 npm start          # expect the page to wait longer
TIMEOUT_MS=abc npm start            # expect the 15,000 ms default
TIMEOUT_MS=0 npm start              # expect the 15,000 ms default
TIMEOUT_MS=-5 npm start             # expect the 15,000 ms default
```

Expected: the server starts in every case and never hangs on a bad value. To observe the resolved
value rather than infer it, run step 2 and confirm `src/config.js` still holds the single default, or
start the server and load the page, then confirm the browser stopped waiting at the expected moment
(step 5).

## 4. The page loads with all three sources healthy

```bash
npm start
```

Then open `http://127.0.0.1:3000/`.

Expected: three cards, each with a value and a timestamp. **No card shows "La fuente de datos tardó
demasiado en responder."** This is the SC-001 check: repeat the load while the three sources are
healthy and the notice must never appear.

## 5. A source that exceeds the budget shows the timeout notice

Point one source at something that never answers, without changing any code, by blocking its host at
the network level, or by running the adapter directly with a deliberately tiny budget:

```bash
TIMEOUT_MS=1 npm start
```

Then load the page.

Expected: with a 1-millisecond budget, the affected cards show exactly "La fuente de datos tardó
demasiado en responder." and the page still resolves — it does not hang. Unset the variable and the
default of 15,000 ms returns. This is the SC-003 check for the mechanism: the notice appears because
the budget elapsed, and the page resolves within the budget plus a second.

## 6. The browser never stays in the loading state

Serve the page while making the board response unreachable — for example, stop the server after the
page's HTML and `app.js` have loaded, so the fetch for the board data cannot complete.

Expected: within the 15,000 ms budget plus about a second, all three cards leave the loading state and
show the existing generic notice:

> "No se pudo cargar el panel. Volvé a cargar la página para intentarlo de nuevo."

**Not** the source-timeout notice. This is the SC-009 and FR-009 check, and it is the behavior that
does not exist before this feature, where the cards would spin forever.

## 7. Other failures keep their own messages

Stop a source, or make it return a non-success status, an unreadable body, an unexpected shape, a
payload missing a selected ticker, an unusable value, or a stale value.

Expected, per [contracts/wait-budget.md](./contracts/wait-budget.md) section 4:

- Each failure shows **its own** existing message.
- None of them shows "La fuente de datos tardó demasiado en responder."
- The other two cards are unaffected and keep showing their values.

This is the SC-004 check, and the honest-timeout rule: the notice is reserved for a budget that
actually elapsed.

## 8. One request per source, no retries

Load the page once and watch the server's outbound activity, or read the assertions in the suite.

Expected: exactly one request per source per load, three in total. A load that hits the budget issues
**no** additional request, and reloading issues a fresh set of three, not a continuation of the old
one. This is the SC-006 check and FR-011.

## 9. Nothing else moved

```bash
git diff --stat
```

Expected: changes confined to `src/config.js`, `src/lib/json-fetch.js`, `src/public/app.js`,
`src/server.js`, `README.md`, `tests/adapters.test.js`, and the supersession notes in spec 002's
`plan.md` and `contracts/source-adapters.md`. No file added under `src/` or `tests/`. In particular
`src/dashboard/service.js`, the three adapters, `src/api/dashboard-route.js`,
`src/dashboard/normalize.js`, `src/lib/time.js`, `src/public/render.js`, `src/public/index.html`, and
`src/public/styles.css` are untouched — this is the FR-010 and no-UI-change check.

```bash
cat package.json
```

Expected: `dependencies` is still `{}` (FR-012, SC-008).

## 10. Source and test hygiene

Expected, per Principle VIII:

- No essay comments in any touched source file; at most one short line per non-obvious invariant.
- No comment restating a specification, a plan, or a variable name.
- `tests/adapters.test.js` no longer cites any Spec Kit artifact path, and no test asserts against
  stylesheet source text.

```bash
grep -rn "specs/00" tests/
```

Expected: no output.

## Summary of the checks

| Step | Requirement | Criterion |
|------|-------------|-----------|
| 1 | FR-014, FR-015, FR-016 | 8 tests, 2 files, suite green |
| 2 | FR-001, FR-003 | one number in code, one in prose, no `2500` anywhere |
| 3 | FR-002 | override works, malformed input falls back |
| 4 | FR-001, FR-004, SC-001 | three values, no notice on healthy sources |
| 5 | FR-005, FR-006, SC-003 | notice only when the budget elapsed; page still resolves |
| 6 | FR-009, SC-009 | cards always leave loading, generic notice |
| 7 | FR-007, FR-008, SC-004, SC-005 | other messages unchanged, 8 messages total |
| 8 | FR-011, SC-006 | one request per source, no retries |
| 9 | FR-010, FR-012, SC-008 | no other file touched, zero dependencies |
| 10 | Principle VIII | no essay comments, no Spec Kit citation in tests |
