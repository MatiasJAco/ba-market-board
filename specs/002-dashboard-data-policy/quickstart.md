# Quickstart: BA Market Dashboard

## Prerequisites

- Node.js 24 LTS
- A modern browser
- Internet access for the live dashboard; automated tests do not need internet access

Docker is not required.

## Run locally

From the repository root:

```bash
node --version
npm test
npm start
```

Open `http://127.0.0.1:3000/` in a browser. The page shows Buenos Aires weather, the five fixed CEDEARs, and the MEP/bolsa rate in one snapshot. A browser reload starts a new snapshot.

The server uses Node.js standard-library modules only, so there is no runtime dependency installation step. If the project has not yet been implemented, these commands describe the interface that the implementation tasks must provide.

## Run without the npm script

```bash
node src/server.js
```

The default host is `127.0.0.1` and the default port is `3000`. A different port can be selected with a non-secret environment variable:

```bash
PORT=3100 node src/server.js
```

Open `http://127.0.0.1:3100/` after starting it.

## Run tests

```bash
npm test
```

The equivalent native command is:

```bash
node --test
```

The test suite covers:

- Open-Meteo success, timeout, malformed, and stale responses.
- Data912 CEDEAR success, missing-ticker, malformed-value, and non-real-time timestamp behavior.
- DolarAPI MEP midpoint, missing-side, invalid-value, and source-timestamp behavior.
- Independent partial failure at the service and HTTP-route levels.
- Fixed CEDEAR ordering and MEP labeling.
- Client loading, data, and error rendering.
- Proof that the client does not install an interval or automatic retry.

Tests use injected fetch implementations, fixtures, and fake browser document/scheduler objects. They do not contact live providers.

## Inspect the API locally

```bash
curl http://127.0.0.1:3000/api/dashboard
```

The endpoint returns JSON with `weather`, `cedears`, and `mep` results. A failed provider is represented inside its widget with `status: "error"`; successful sibling widgets remain visible.

## Source behavior

- Weather uses Open-Meteo current conditions for Buenos Aires in Celsius.
- CEDEAR prices use the fixed symbols `AAPL`, `MSFT`, `GOOGL`, `META`, and `NVDA` from Data912.
- The exchange rate is the two-decimal midpoint of DolarAPI’s MEP/bolsa buy and sell values.
- The page does not show a value as live when a source supplies only a retrieval time.
- No API keys or secret environment variables are needed.

## Troubleshooting

- **A widget shows an error**: inspect the widget message and the local API response; one source failure does not blank the other widgets.
- **Port is already in use**: start the server with a different `PORT` value.
- **Live values differ from expectations**: market data can be delayed, cached, or unavailable; the displayed timestamp and error state are intentional.
- **Tests attempt network access**: run `node --test` and confirm the test fixtures and injected fetch clients are being used.
