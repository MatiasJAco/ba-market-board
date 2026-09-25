# Dashboard API Contract

## Purpose

`GET /api/dashboard` is the only data endpoint. It creates one snapshot for the calling page load and returns independent results for weather, CEDEARs, and the MEP/bolsa exchange rate.

## Request

```http
GET /api/dashboard HTTP/1.1
Host: localhost:3000
Accept: application/json
```

- No authentication, cookies, query parameters, or request body are required.
- The endpoint is same-origin with the static page.
- The server does not accept a caller-provided upstream URL.

## Response

- Success, including partial source failure: `200 OK`
- Invalid route or method: `404 Not Found` or `405 Method Not Allowed`
- Unhandled server failure: `500 Internal Server Error`
- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: no-store`

The endpoint returns `200 OK` when it can build the snapshot envelope, even if one or more widgets failed. A source failure is represented by that widget’s `status: "error"` result so the page can show the other widgets.

## Response Shape

```text
DashboardResponse
├── retrievedAt: ISO-8601 string
├── weather: WeatherResult
├── cedears: CedearsResult
└── mep: MepResult
```

Each result is either a success object or an error object. `value` is present only for `status: "ok"`. `error` is present only for `status: "error"`.

### Successful Response

```json
{
  "retrievedAt": "2026-09-25T14:58:00.000Z",
  "weather": {
    "status": "ok",
    "source": "Open-Meteo",
    "retrievedAt": "2026-09-25T14:58:00.100Z",
    "value": {
      "location": "Buenos Aires",
      "temperatureC": 18.4,
      "condition": "Partly cloudy",
      "observedAt": "2026-09-25T14:45:00.000Z",
      "timestampKind": "source"
    }
  },
  "cedears": {
    "status": "ok",
    "source": "Data912",
    "retrievedAt": "2026-09-25T14:58:00.200Z",
    "value": {
      "quotes": [
        {
          "ticker": "AAPL",
          "label": "Apple",
          "priceArs": 27480,
          "observedAt": null
        },
        {
          "ticker": "MSFT",
          "label": "Microsoft",
          "priceArs": 27880,
          "observedAt": null
        },
        {
          "ticker": "GOOGL",
          "label": "Alphabet",
          "priceArs": 9655,
          "observedAt": null
        },
        {
          "ticker": "META",
          "label": "Meta",
          "priceArs": 50925,
          "observedAt": null
        },
        {
          "ticker": "NVDA",
          "label": "Nvidia",
          "priceArs": 15240,
          "observedAt": null
        }
      ],
      "timestampKind": "retrieval"
    }
  },
  "mep": {
    "status": "ok",
    "source": "DolarAPI",
    "retrievedAt": "2026-09-25T14:58:00.300Z",
    "value": {
      "rateType": "MEP/bolsa",
      "buyArs": 1549.4,
      "sellArs": 1550.9,
      "midpointArs": 1550.15,
      "observedAt": "2026-09-25T14:58:00.000Z",
      "timestampKind": "source"
    }
  }
}
```

### Partial-Failure Response

```json
{
  "retrievedAt": "2026-09-25T14:58:00.000Z",
  "weather": {
    "status": "error",
    "source": "Open-Meteo",
    "retrievedAt": "2026-09-25T14:58:00.100Z",
    "error": {
      "code": "timeout",
      "message": "Weather data is temporarily unavailable."
    }
  },
  "cedears": {
    "status": "ok",
    "source": "Data912",
    "retrievedAt": "2026-09-25T14:58:00.200Z",
    "value": {
      "quotes": [
        {
          "ticker": "AAPL",
          "label": "Apple",
          "priceArs": 27480,
          "observedAt": null
        },
        {
          "ticker": "MSFT",
          "label": "Microsoft",
          "priceArs": 27880,
          "observedAt": null
        },
        {
          "ticker": "GOOGL",
          "label": "Alphabet",
          "priceArs": 9655,
          "observedAt": null
        },
        {
          "ticker": "META",
          "label": "Meta",
          "priceArs": 50925,
          "observedAt": null
        },
        {
          "ticker": "NVDA",
          "label": "Nvidia",
          "priceArs": 15240,
          "observedAt": null
        }
      ],
      "timestampKind": "retrieval"
    }
  },
  "mep": {
    "status": "error",
    "source": "DolarAPI",
    "retrievedAt": "2026-09-25T14:58:00.300Z",
    "error": {
      "code": "upstream_error",
      "message": "MEP data is temporarily unavailable."
    }
  }
}
```

## Widget Rules

- All three widgets start in a client-side loading state.
- The client makes one request per document load and does not poll, retry automatically, or use a streaming endpoint.
- A successful CEDEAR value has exactly the five allowed symbols in the order `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA`.
- A successful MEP value is labeled `MEP/bolsa` and is denominated in ARS per USD.
- A successful weather value uses Celsius and a readable condition label.
- A timestamp with `timestampKind: "source"` is displayed as source/quote/observation time.
- A timestamp with `timestampKind: "retrieval"` is displayed with a retrieval label.
- An error result has no numeric value in the rendered widget.

## Client Behavior Contract

1. Render loading placeholders for all three widgets immediately.
2. Fetch `/api/dashboard` once.
3. Apply the response to each widget independently.
4. Keep the displayed snapshot unchanged until the browser reloads.
5. Render any error message visibly and accessibly in the affected widget.

## Security and Reliability

- Upstream calls use fixed source URLs and require no credentials.
- Upstream bodies are normalized and discarded after validation.
- Errors exposed to the browser are safe messages, not raw exceptions.
- Each upstream call is bounded by a timeout and has no automatic retry.
