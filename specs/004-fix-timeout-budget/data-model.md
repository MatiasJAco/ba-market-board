# Phase 1 Data Model: Fix the Frequent False Data-Source Timeout

This feature introduces no stored data, no schema, and no persistence. It changes one number, the
rules that decide when that number is reported as a failure, and the state machine a card moves
through. The entities below are the whole model.

## Wait budget

The single maximum time the board is willing to wait for data. One value for the whole product: not
one per source, not one per layer.

| Field | Type | Value today | Value after | Rule |
|-------|------|-------------|-------------|------|
| `DEFAULT_TIMEOUT_MS` | integer milliseconds | `2500` | `15000` | Declared once, in `src/config.js`, and exported. The only authoritative value (FR-001). |
| `timeoutMs` (config key) | integer milliseconds | `2500` via the constant | resolved value | `loadConfig()` keeps returning it under the existing key, so no caller changes. |
| `TIMEOUT_MS` (env var) | string | absent | optional override | Read by `readTimeoutMs(env)`, shaped like `readPort` and `readHost` (FR-002). |

**Validation rules for the override** (FR-002): the raw value must be a string of digits after
trimming and must parse to a strictly positive integer. Anything else — absent, empty, non-numeric,
negative, zero, fractional — falls back to the 15,000-millisecond default. No upper bound is imposed;
see [research.md](./research.md) D5.

**Uniqueness rules** (FR-001, FR-003, SC-002): exactly one declaration in code and one prose
statement in the documentation. Today the number appears in four code locations and one README line;
after this feature it appears in exactly one code location (`src/config.js`) and one README line. The
test suite references the exported constant rather than restating it.

**Relationships**: the budget is applied to each `Source request` independently, and reused verbatim
by the `Browser wait`.

## Source request

One outbound request to one of the three fixed public sources. Unchanged in shape by this feature
(FR-010): same URLs, same query parameters, same injected fetch function.

| Field | Type | Notes |
|-------|------|-------|
| `source` | enum | `Open-Meteo`, `Data912`, `DolarApi` — unchanged |
| `budget` | Wait budget | Bound applied to this request independently of the other two (FR-004) |
| `coverage` | enum | The single signal covers the connect phase and the body read alike (FR-005) |
| `outcome` | Failure kind or a value | Determined by the rules below |

**Relationships**: three `Source request` entities are issued in parallel inside one board load, so
the load's worst-case wait is approximately one budget, not three. Exactly one request per source per
load; no retry, no second source, no fallback request (FR-011, and the existing suite already asserts
`calls === 1`).

## Budget expiry

The event in which the wait budget actually elapses. It is the **only** condition permitted to
produce the timeout notice (FR-006).

| Aspect | Rule |
|--------|------|
| Positive evidence | The failure reports a `TimeoutError`, which is what the runtime raises when the budget's own deadline elapses. Verified on the platform; see [research.md](./research.md) D3. |
| Negative evidence | A cancellation that is not a budget expiry — a manually aborted request, a request torn down because the process is shutting down — reports `AbortError` and MUST NOT produce the timeout notice. |
| Unrelated failures | A refused connection reports a `TypeError` and MUST NOT produce the timeout notice. |

## Failure kind

The reason a source request ended, and the single existing error code and message it maps to. The
vocabulary is frozen by FR-007: no code is added, renamed, merged, or removed, and the
visitor-visible message count stays at **8** (SC-005).

| Failure kind | Existing code | Existing message | Changed by this feature |
|--------------|---------------|------------------|------------------------|
| Budget actually elapsed | `timeout` | "La fuente de datos tardó demasiado en responder." | **Yes** — now reachable *only* on positive `TimeoutError` evidence (FR-006) |
| Request cancelled for another reason | `upstream_error` | "No se pudo consultar la fuente de datos." | **Yes** — was previously misreported as `timeout` (FR-006, FR-007) |
| Source unreachable or non-success status | `upstream_error` | "No se pudo consultar la fuente de datos." | No |
| Body unreadable | `invalid_json` | "La fuente de datos devolvió una respuesta ilegible." | No |
| Response shape unexpected | `invalid_schema` | "La fuente de datos devolvió una respuesta inesperada." | No |
| Selected value absent | `missing_ticker` | "Falta alguno de los valores seleccionados en la respuesta." | No |
| Value unusable | `invalid_value` | "La fuente de datos devolvió un valor no utilizable." | No |
| Value too old to show | `stale` | "El dato disponible es demasiado viejo para mostrarlo." | No |
| Anything else | `unknown` | "No se pudo cargar el dato." | No |

The `cancelled` case reuses `upstream_error` deliberately: a visitor cannot act on "cancelled"
differently from "could not reach the source", and a new code would break FR-007 and SC-005.

## Card state

What one of the three cards shows. The set of states is unchanged — no new state, no new copy
(FR-010, and the out-of-scope list).

```text
                 board response arrives
   loading  ─────────────────────────────────────►  value
      │                                             (error state, per-card, for a failed source)
      │
      │  browser wait budget elapses, or the fetch fails outright
      ▼
   error   (existing generic load-failure notice:
           "No se pudo cargar el panel. Volvé a cargar la página para intentarlo de nuevo.")
```

| Transition | Guard | Requirement |
|------------|-------|-------------|
| `loading` → `value` or per-source `error` | the board response arrives in time | existing behavior, unchanged |
| `loading` → `error` (generic) | the browser wait budget elapses | **new** — this transition does not exist today and is the fix for the endless-loading case (FR-009) |
| `loading` → `error` (generic) | the fetch rejects for any reason | existing behavior, already caught |
| per-source `error` shows the timeout notice | and only if that source's budget actually elapsed | **new** — the honesty fix (FR-006) |

**Invariant**: a card always leaves `loading`. Today, a response that never arrives leaves all three
cards in `loading` indefinitely, which is the Principle VII violation recorded in the spec's findings.

## Browser wait

The deadline the page applies to its own request for the board response. New in this feature.

| Field | Type | Notes |
|-------|------|-------|
| `budget` | Wait budget | The same single value, reused verbatim; the browser gets **no** longer deadline of its own (FR-001, FR-009) |
| `source of the value` | substituted token in the served text assets | The repository contains no second number; if the token was not substituted, no deadline is applied, which degrades to today's behavior rather than to a wrong one ([research.md](./research.md) D2) |
| `notice on expiry` | the existing generic load-failure notice | **Not** the timeout notice: the browser has no evidence that any source exceeded its budget, and claiming one would violate FR-006 (FR-009) |

**Relationships**: the browser's wait begins before the server's per-source wait, so the browser bound
is reached first. A source that would have answered a fraction of a second later yields the generic
notice. This trade is accepted rather than compensated, because compensating would require a second
number, which FR-001 forbids.

## Invariants

1. Exactly one number describes the wait budget anywhere in the repository (FR-001, SC-002).
2. The timeout notice requires positive evidence that the budget elapsed (FR-006).
3. Every non-timeout failure keeps its existing code and message, and the visitor-visible message set
   stays at 8 (FR-007, SC-005).
4. A card always leaves `loading` (FR-009).
5. One load issues at most one request per source; no retry, backoff, queue, or cache exists
   (FR-011, SC-006).
6. The declared dependency count stays at 0 (FR-012, SC-008).
