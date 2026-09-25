# Technical Research: BA Market Dashboard Data Policy

**Date**: 2026-09-25

## Decision Summary

The feature uses a small, boring JavaScript stack: Node.js 24 LTS, native `node:http`, native `fetch`, plain HTML/CSS/JavaScript, and the built-in `node:test` runner. The browser calls one same-origin endpoint, `GET /api/dashboard`, on each page load. The server calls three public sources in parallel, converts each result into a small widget result, and returns partial success with independent errors.

The selected sources are:

- Open-Meteo current conditions for Buenos Aires weather.
- Data912 `GET /live/arg_cedears` for the five fixed CEDEARs.
- DolarAPI `GET /v1/dolares/bolsa` for the MEP/bolsa quote.

## Stack Decision

### Selected

- Node.js 24 LTS as the only server/runtime dependency.
- Native `node:http` for the server and route handling.
- Native `fetch` with `AbortSignal.timeout` for upstream requests.
- Plain browser JavaScript with no bundler, framework, or transpiler.
- `node:test` and `node --test` for unit and integration tests.
- Dependency injection for `fetch`, the clock, and the browser document/scheduler seams.

### Reasons

- The product is one page with three read-only widgets, so a framework, database, build pipeline, and container runtime would add surface without serving a requirement.
- Same-origin API access keeps the browser independent of upstream CORS behavior and gives the server one place to normalize errors.
- A single request per page load makes the no-interval requirement easy to verify.
- A native stack can be run with Node.js alone and does not require Docker.

## Data Source Evaluation

### Weather: Open-Meteo — selected

- Documentation: `https://open-meteo.com/en/docs`
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Request shape: Buenos Aires coordinates, `current=temperature_2m,weather_code`, `temperature_unit=celsius`, and `timezone=America/Argentina/Buenos_Aires`.
- Required fields: current temperature, WMO weather code, and current observation time.
- The documentation describes current conditions as model-based and states that an API key is only required for commercial reserved resources. This feature assumes non-commercial use, as required by the public/free constitution.
- The response includes a source time that can be displayed directly.

### CEDEARs: Data912 — selected

- Documentation: `https://data912.apidocs.ar/operations/getliveargcedears`
- Endpoint: `https://data912.com/live/arg_cedears`
- Response shape: an array of objects with `symbol`, `c` (current ARS price), volume, bid, ask, and change fields.
- The adapter reads only the five allowed symbols and rejects the whole widget if any selected symbol is missing, duplicated, malformed, or non-positive.
- The documented response has no source quote timestamp. The adapter records a retrieval timestamp and labels it as such in the UI.
- The source describes the API as educational and not real-time and documents approximate Cloudflare caching. The UI must not label the value as live.
- No API key or account is documented for this endpoint.

### MEP/bolsa: DolarAPI — selected

- Documentation: `https://dolarapi.com/docs/argentina/operations/get-dolar-bolsa`
- Endpoint: `https://dolarapi.com/v1/dolares/bolsa`
- Response fields used: `compra`, `venta`, and `fechaActualizacion`.
- The adapter calculates `(compra + venta) / 2` and rounds to two decimal places. It does not use or display BNA, blue, or another rate as a fallback.
- A direct request to the documented endpoint succeeded without credentials during research. The project still treats the no-secret behavior as an adapter assumption that must be covered by tests and reviewed before a production release.
- The documentation identifies DolarHoy as the upstream data source. The service is informational and can be interrupted; failures must be visible.

### Rejected sources

- **BYMA official market-data API**: research indicated paid commercial products, so it conflicts with the public/free constraint.
- **Oanor gateway**: the current documentation requires an API key, so it conflicts with the no-secret constraint.
- **Data912 `GET /live/mep`**: a live request returned rows with `panel: "cedear"` and ticker values such as `AAPL`, rather than a distinct MEP quote. It is not used for the exchange-rate widget.
- **DolarBlu and other aggregators**: they expose MEP values but are unnecessary once the documented DolarAPI endpoint satisfies the contract. Adding another provider would increase failure and maintenance paths.

## Request, Timeout, and Failure Policy

- The browser performs one `GET /api/dashboard` request after the page loads.
- The service starts all three source calls together and resolves them with `Promise.allSettled`.
- Each upstream call has a 2.5-second timeout. There is no automatic retry loop.
- Non-2xx responses, network errors, timeouts, invalid JSON, schema failures, missing selected tickers, and invalid values become typed widget errors.
- A source failure never removes or falsifies a sibling widget’s data.
- The API returns HTTP 200 for a completed partial snapshot; widget status communicates failure.
- A server-level failure is represented as a generic safe error and never includes an upstream stack trace or credential.

## Timestamp and Staleness Policy

- A valid source timestamp is shown as the source/quote/observation time.
- If a source omits a usable timestamp, the adapter records the retrieval time and the UI labels it `Retrieved at` rather than presenting it as source time.
- Weather observations older than three hours are rejected as stale because the selected endpoint represents current conditions.
- Market quotes older than seven days are rejected as stale; market closure and ordinary delay remain valid when the quote is within that window, and the UI uses an as-of label.
- A timestamp in the future beyond normal clock skew is invalid.
- Data912 CEDEAR rows use retrieval time because their documented schema has no source timestamp; the UI must not claim the quote is live.

## Alternatives Considered

### Full frontend framework plus separate API

Rejected. A framework adds a build step and dependency surface that the one-page requirement does not justify.

### Direct browser calls to each upstream API

Rejected. Upstream CORS, schema changes, and cross-origin error handling would leak into the page. A same-origin adapter boundary makes the contract stable and testable.

### Docker-based service

Rejected. The user explicitly does not require Docker, and a native Node process is sufficient for local development and a small deployment.

### Database, cache, or background scheduler

Rejected. The feature is a load-only snapshot and explicitly excludes persistence and history. A request-scoped object keeps the data model small.

## Open Risks and Mitigations

- **Source availability**: adapters isolate each source; `Promise.allSettled` prevents a total page failure; tests use fixtures rather than live calls.
- **Schema drift**: adapters validate only the fields required by the contract and return `invalid_schema` for malformed payloads.
- **Source terms**: `research.md` records the free/public assumptions; a release review must confirm that the intended deployment remains non-commercial and acceptable to each source.
- **Non-real-time CEDEAR data**: the UI uses retrieval time and the source’s quote wording; it does not claim real-time status.
