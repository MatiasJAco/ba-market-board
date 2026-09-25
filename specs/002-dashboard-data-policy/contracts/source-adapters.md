# Source Adapter Contracts

## Shared Interface

Each source adapter is an async function or small factory that receives an injected `fetchImpl`, an injected `now` clock, and a per-request timeout. It returns a `WidgetResult` matching `data-model.md`. Adapters do not read configuration secrets, log raw payloads, or call each other.

```text
createAdapter({ fetchImpl, now, timeoutMs }) -> fetchSnapshot() -> WidgetResult
```

The default production dependency is the platform `fetch`; tests provide a deterministic function. The default timeout is 2,500 milliseconds. Adapters do not retry.

## Shared Validation

- A non-2xx response becomes `upstream_error`.
- A network rejection or aborted request becomes `upstream_error` or `timeout`.
- Invalid JSON becomes `invalid_json`.
- A valid JSON value with the wrong shape becomes `invalid_schema` or `invalid_value`.
- A timestamp that is invalid or implausibly in the future is invalid.
- A valid source time is retained; an absent or invalid source time uses the adapter retrieval time and the `retrieval` timestamp kind.
- Errors returned to the API contain a safe message and a stable code, not the raw upstream body or exception.

## Open-Meteo Adapter

### Request

```text
GET https://api.open-meteo.com/v1/forecast
  ?latitude=-34.6037
  &longitude=-58.3816
  &current=temperature_2m,weather_code
  &temperature_unit=celsius
  &timezone=America%2FArgentina%2FBuenos_Aires
```

No key, token, or user data is sent.

### Expected Input Shape

```text
{
  current: {
    time: string,
    temperature_2m: number,
    weather_code: number
  }
}
```

Additional fields are ignored. Missing `current`, a non-finite temperature, or an unknown weather code is invalid.

### Normalization

- `location` becomes `Buenos Aires`.
- `temperatureC` becomes `current.temperature_2m`.
- `condition` is selected from a fixed WMO-code map.
- `observedAt` becomes `current.time` when it passes validation.
- `timestampKind` is `source` when the observation time is valid, otherwise `retrieval`.
- Weather older than three hours is `stale`.

## Data912 CEDEAR Adapter

### Request

```text
GET https://data912.com/live/arg_cedears
```

No key, token, or user data is sent.

### Expected Input Shape

```text
[
  {
    symbol: string,
    c: number
  }
]
```

Additional fields are ignored. The source response may contain many symbols; the adapter filters to the allowlist and does not rank or substitute symbols.

### Normalization

- Allowed symbols and output order are exactly `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA`.
- `priceArs` becomes `c` and must be finite and greater than zero.
- `label` comes from a fixed local label map.
- The documented schema has no quote timestamp, so `observedAt` is null and `timestampKind` is `retrieval`.
- A missing, duplicate, malformed, or non-positive selected symbol makes the whole widget `missing_ticker` or `invalid_value`.
- The adapter does not claim that the price is live or real-time.

## DolarAPI MEP Adapter

### Request

```text
GET https://dolarapi.com/v1/dolares/bolsa
```

No key, token, or user data is sent.

### Expected Input Shape

```text
{
  compra: number,
  venta: number,
  fechaActualizacion: string
}
```

Additional fields are ignored. Both `compra` and `venta` are required even if the source later provides another midpoint field.

### Normalization

- `rateType` becomes `MEP/bolsa`.
- `buyArs` becomes `compra`.
- `sellArs` becomes `venta`.
- `midpointArs` becomes `(compra + venta) / 2`, rounded to two decimal places.
- `observedAt` becomes `fechaActualizacion` when valid.
- `timestampKind` is `source` or `retrieval` according to timestamp validation.
- A quote older than seven days is `stale`.
- No official BNA, blue, CCL, or other rate is read as a fallback.

## Service Composition

`createDashboardService` invokes the three adapters concurrently with `Promise.allSettled`. It builds a response envelope even when one or two results are errors. It does not retry, cache, persist, or make a fourth request.

```text
GET /api/dashboard
  -> three adapter calls
  -> Promise.allSettled
  -> normalized DashboardResponse
```

## Test Seams

Each adapter must be testable without a live provider by supplying:

- A fake `fetchImpl` that returns a controlled `Response`-like object or throws a controlled error.
- A fake `now` function for timestamp and staleness checks.
- A short timeout or an abort signal for timeout behavior.
- Small success, partial, malformed, and empty fixtures.

Rendering tests receive a document-like test double and a scheduler-like test double. The browser client must not schedule a recurring timer; the no-refresh test asserts that no interval is registered and that a later simulated time does not issue another API request.
