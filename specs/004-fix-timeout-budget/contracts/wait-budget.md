# Contract: The Wait Budget

**Feature**: `specs/004-fix-timeout-budget` | **Date**: 2026-09-30

This is the only interface this feature changes. The `/api/dashboard` response contract defined in
[spec 002's dashboard-api.md](../../002-dashboard-data-policy/contracts/dashboard-api.md) and the
adapter contract in [spec 002's source-adapters.md](../../002-dashboard-data-policy/contracts/source-adapters.md)
are **unchanged** by this feature. See "Superseded statements" at the end.

## 1. The single value

| Property | Value |
|----------|-------|
| Name | `DEFAULT_TIMEOUT_MS` |
| Declared in | `src/config.js` |
| Exported | Yes |
| Default | `15000` (was `2500`) |
| Copies permitted | Exactly one in code, plus one prose statement in `README.md` |

```js
export const DEFAULT_TIMEOUT_MS = 15000;
```

**Contract**: the repository MUST NOT contain a second declaration of this value. The suite MUST
reference the exported constant rather than restate the number.

## 2. Configuration surface

The budget is overridable through the same surface that already carries `HOST` and `PORT`: an
environment variable read by a helper in `src/config.js`, shaped like the existing `readPort` and
`readHost`.

```text
TIMEOUT_MS=<integer milliseconds>
```

| Input | Result |
|-------|--------|
| absent, or not a string | `15000` |
| `""`, whitespace only | `15000` |
| not digits, e.g. `15s`, `abc`, `1,5` | `15000` |
| `0` or a negative number | `15000` |
| fractional, e.g. `1500.5` | `15000` |
| a positive integer | that value |

No upper bound is imposed. There is no `--timeout` flag and no configuration file; the environment
variable is the whole surface.

`loadConfig()` continues to return the resolved value under the existing `timeoutMs` key, so
`src/server.js`, `src/dashboard/service.js`, and all three adapter signatures are unaffected by this
contract.

## 3. Propagation

The value reaches the three requests without any signature change, because every layer already
accepts it:

```text
TIMEOUT_MS env  ->  readTimeoutMs(env)  ->  loadConfig().timeoutMs
  ->  createDashboardService({ timeoutMs })
    ->  adapter({ fetchImpl, now, timeoutMs })
      ->  fetchJson(url, { fetchImpl, timeoutMs })
        ->  fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
```

**Contract**: each of the three requests is bounded **independently**. The budget is not a pool
shared between them. The three requests continue to be issued in parallel, so a load's worst-case
wait is approximately one budget.

**Contract**: the single signal covers the connect phase and the body read. A source that connects
and then stalls is still bounded.

**Contract**: one load issues at most one request per source. No retry, backoff, queue, or cache is
introduced, and the existing `calls === 1` assertions continue to hold.

## 4. Failure mapping

| Runtime outcome | `name` | Resulting code | Resulting message |
|-----------------|--------|----------------|-------------------|
| The budget's own deadline elapsed | `TimeoutError` | `timeout` | "La fuente de datos tardó demasiado en responder." |
| Cancelled for any other reason | `AbortError` | `upstream_error` | "No se pudo consultar la fuente de datos." |
| Connection refused, DNS failure, TLS failure | `TypeError` | `upstream_error` | "No se pudo consultar la fuente de datos." |
| Non-success HTTP status | n/a | `upstream_error` | "No se pudo consultar la fuente de datos." |
| Body unreadable | n/a | `invalid_json` | "La fuente de datos devolvió una respuesta ilegible." |
| Body is not valid JSON | n/a | `invalid_json` | "La fuente de datos devolvió una respuesta ilegible." |
| Unexpected response shape | n/a | `invalid_schema` | "La fuente de datos devolvió una respuesta inesperada." |
| Selected value absent | n/a | `missing_ticker` | "Falta alguno de los valores seleccionados en la respuesta." |
| Value unusable | n/a | `invalid_value` | "La fuente de datos devolvió un valor no utilizable." |
| Value too old | n/a | `stale` | "El dato disponible es demasiado viejo para mostrarlo." |
| Anything else | n/a | `unknown` | "No se pudo cargar el dato." |

**Contract**: `timeout` is produced **only** on positive `TimeoutError` evidence. Every other row is
unchanged from today's behavior, except the `AbortError` row, which previously reported `timeout` and
now correctly reports `upstream_error`. The set of distinct visitor-visible messages stays at 8; no
code is added, renamed, merged, or removed.

**Contract**: a message arriving from an adapter is still accepted only if it passes the existing
safety checks, and any code outside the known set still falls back to `unknown`. Unchanged.

## 5. Browser wait

The page applies the same single value to its own request for the board response.

**Contract**: the browser MUST NOT have its own, longer deadline. When the budget elapses on the
browser side, all three cards leave the loading state and show the **existing generic load-failure
notice**:

> "No se pudo cargar el panel. Volvé a cargar la página para intentarlo de nuevo."

**Contract**: the browser MUST NOT show the source-timeout notice. It has no evidence that any source
exceeded its budget, and asserting one would violate the honesty rule in section 4.

### How the value reaches the page

`src/public/app.js` holds a **non-numeric token**. When `src/server.js` serves an HTML or JavaScript
asset it substitutes the configured value for that token. The client parses the token and applies a
deadline only when the result is a finite positive number.

| Served asset contains | Client behavior |
|-----------------------|-----------------|
| `"15000"` (substituted) | the browser waits at most 15,000 ms, then shows the generic notice |
| `"__BOARD_BUDGET_MS__"` (not substituted) | **no** deadline is applied, which degrades to today's behavior |

**Contract**: the unsubstituted token MUST NOT resolve to a number. The repository therefore contains
no hidden second default, and the failure direction is safe — the worst case is the current behavior,
never a wrong deadline.

**Contract**: the substitution applies to every served text asset through one rule, so it cannot drift
out of sync with a file added later.

## 6. What this contract explicitly does not change

- The `/api/dashboard` path, method, status codes, headers, or response body shape.
- The three source URLs, their query parameters, or the fields read from them.
- The `WidgetResult` shape: `status`, `source`, `retrievedAt`, and either `value` or `error`.
- The error code set and every message text, except the `AbortError` row of section 4.
- The three widget keys and their order: `weather`, `cedears`, `mep`.
- The staleness windows: 3 hours for weather, 7 days for market data.
- The HTML, CSS, renderer, and every visible string on the page.
- The dependency set, which stays empty.

## Superseded statements

These statements exist in spec 002's artifacts and are **superseded** by this contract. They are
recorded rather than deleted, so the history of each feature stays intact.

| Artifact | Superseded statement | Now |
|----------|----------------------|-----|
| `specs/002-dashboard-data-policy/plan.md:27` | "apply a 2.5-second timeout to each upstream request" | one 15,000-millisecond budget per request, per section 3 |
| `specs/002-dashboard-data-policy/contracts/source-adapters.md:11` | "The default timeout is 2,500 milliseconds." | `DEFAULT_TIMEOUT_MS` is 15,000; see section 1 |
| `README.md:113` | "Cada petición tiene un timeout de **2500 ms**" | one 15,000-millisecond budget |

Unchanged from spec 002 and restated here so no reader has to go looking: "Each upstream call is
bounded by a timeout and has no automatic retry" still holds, and "three upstream requests in parallel
per page load" still holds.
