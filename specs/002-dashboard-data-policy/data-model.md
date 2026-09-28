# Data Model: BA Market Dashboard Data Policy

## Overview

The application keeps one transient snapshot per `GET /api/dashboard` request. There is no database, cache, user account, historical series, or cross-request state. The browser keeps the last returned snapshot only until the next document load.

```text
DashboardSnapshot
├── retrievedAt: ISO-8601 string
├── weather: WeatherResult
├── cedears: CedearsResult
└── mep: MepResult
```

## Widget Result

Every widget uses the same discriminated union:

```text
WidgetSuccess<T>
├── status: "ok"
├── source: string
├── retrievedAt: ISO-8601 string
└── value: T

WidgetError
├── status: "error"
├── source: string
├── retrievedAt: ISO-8601 string
└── error: WidgetErrorDetail

WidgetErrorDetail
├── code: ErrorCode
└── message: string
```

`ErrorCode` is one of `timeout`, `upstream_error`, `invalid_json`, `invalid_schema`, `missing_ticker`, `invalid_value`, `stale`, or `unknown`. Error messages are short, user-facing strings, written in Spanish to match the page copy shown to the anonymous Argentine visitor. They never contain response bodies, stack traces, secrets, or arbitrary upstream text.

## Weather

```text
WeatherValue
├── location: "Buenos Aires"
├── temperatureC: number
├── condition: string
├── observedAt: string | null
└── timestampKind: "source" | "retrieval"
```

Rules:

- `temperatureC` is a finite number in Celsius.
- `condition` is a human-readable label mapped from the Open-Meteo WMO code.
- `observedAt` is the source time when the source supplies a valid one; otherwise it is null.
- When `observedAt` is null, the UI displays the result `retrievedAt` with a retrieval label.
- Weather older than three hours is an error and does not produce a value.

## CEDEARs

```text
CedearsValue
├── quotes: CedearQuote[5]
└── timestampKind: "retrieval"

CedearQuote
├── ticker: "AAPL" | "MSFT" | "GOOGL" | "META" | "NVDA"
├── label: string
├── priceArs: number
└── observedAt: null
```

Rules:

- The array contains exactly five quotes in this order: `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA`.
- `priceArs` is a finite positive number from the local `c` field.
- `label` comes from a fixed local mapping, not from an undocumented ranking rule.
- A missing, duplicate, malformed, non-numeric, or non-positive selected ticker makes the entire CEDEAR result an error. No ticker is substituted.
- The Data912 schema has no source quote timestamp. `observedAt` is null, `timestampKind` is `retrieval`, and the UI does not describe the quote as live.

## MEP Exchange Rate

```text
MepValue
├── rateType: "MEP/bolsa"
├── buyArs: number
├── sellArs: number
├── midpointArs: number
├── observedAt: string | null
└── timestampKind: "source" | "retrieval"
```

Rules:

- `buyArs` and `sellArs` are finite positive numbers from the source `compra` and `venta` fields.
- `midpointArs` equals `(buyArs + sellArs) / 2`, rounded to exactly two decimal places for display.
- `rateType` is always `MEP/bolsa`.
- The adapter never substitutes official BNA, blue, CCL, or another rate.
- A valid source `fechaActualizacion` becomes `observedAt`; otherwise the retrieval time is used.
- A market quote older than seven days is an error. A valid delayed quote within that window is shown with an as-of label.

## State Transitions

```text
loading -> ok
loading -> error
```

There is no `ok -> ok` timer transition, no automatic retry transition, and no `error -> loading` transition without a new browser page load. A normal browser reload creates a new client state and a new server snapshot.

## Invariants

1. Every widget result has exactly one of `status: "ok"` or `status: "error"`.
2. A successful CEDEAR result has exactly the five allowed tickers in the specified order.
3. Every successful value is finite, in the documented unit, and has an explicit display timestamp.
4. A source timestamp is never silently replaced by a retrieval timestamp.
5. A widget error never renders a zero, a blank region, or a value from a different source.
6. Sibling widget results are independent in both the API response and the rendered page.
7. No data survives the request or page load except the in-memory snapshot currently displayed.

## Security Boundaries

The API returns normalized fields only. Raw upstream payloads, request headers, credentials, and internal errors are not part of the data model. The service accepts no user-controlled upstream URL and requires no identity or secret.
