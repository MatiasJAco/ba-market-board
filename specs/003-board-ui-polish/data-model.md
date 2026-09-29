# Data Model: Market Board UI Polish

## No data model change

This feature introduces **no new field, no new entity, no new state, and no changed value**. The
`GET /api/dashboard` response, the three widget result unions, the eight error codes, the
normalization rules, and the three source adapters are exactly as specified in
[spec 002](../002-dashboard-data-policy/data-model.md). That document remains the authority for
all data. FR-018 forbids touching the adapters, their request shapes, their validation, their
error codes, and their error messages.

The rest of this document describes the **view model**: the mapping from an existing data value to
the element that displays it. The view model is the only thing that changes, and it is what
[contracts/view-slots.md](contracts/view-slots.md) specifies in full.

## The one place where the shape differs

The renderer currently receives a value and produces one flat string per widget:

```text
today
├── weather-value.textContent = "21,4 °C · Parcialmente nublado"
├── cedears-value.textContent = "AAPL · Apple · 27.400,1 ARS\nMSFT · Microsoft · 412.900 ARS\n…"
└── mep-value.textContent      = "1.550,15 ARS por USD · MEP/bolsa · Compra 1.549,4 ARS · Venta 1.550,894 ARS"
```

A single text node carries one font size and cannot be split for styling, aligned into columns, or
ellipsized per field. FR-008, FR-009, and FR-011 all require exactly those things, so the internal
render result becomes a **record of parts** instead of a string.

```text
after
├── weather -> { hero, condition, location, time, timeKind }
│             hero     -> "21,4 °C"          (already exists in the value)
│             condition-> "Parcialmente nublado" (already exists)
│             location -> "Buenos Aires"     (already exists, was not being displayed)
│             time     -> existing timestamp logic, unchanged
├── cedears -> { lede, rows[5], time, timeKind }
│             lede  -> derived from quotes.length
│             rows[n] -> { ticker, label, priceArs } formatted, all already existing
└── mep     -> { hero, unit, detail, time, timeKind }
              hero  -> midpointArs formatted      (already exists)
              unit  -> "ARS por USD"              (already in the string today)
              detail-> buyArs and sellArs         (already exists)
              time  -> existing timestamp logic, unchanged
```

**No new data is read.** Every part above is a value the widget already receives. Two of them are
only being *moved* out of the shared string into their own element so they can be sized
independently; one of them, `location`, was already present in the payload and simply was not being
displayed.

## View model per widget

### Weather — `WeatherValue` to elements

| Data field | Element | Id | Type | Note |
|---|---|---|---|---|
| `temperatureC` | hero | `weather-value` | `string` | `es-AR`, 2 decimals, `°C`. Was previously the first segment of a shared string |
| `condition` | lead | `weather-condition` | `string` | Short phrase, shown only when non-empty |
| `location` | meta | `weather-location` | `string` | City name. Present in the payload since spec 002, previously not rendered |
| `observedAt` or `retrievedAt` | meta | `weather-time` | `string` | Unchanged logic: `Observado:` when the source provided it, `Consultado:` otherwise |

### CEDEARs — `CedearsValue` to elements

| Data field | Element | Id pattern | Type | Note |
|---|---|---|---|---|
| `quotes.length` | lede | `cedears-value` | `string` | e.g. `"5 CEDEARs en pesos argentinos"` |
| `quotes[n].ticker` | row ticker | `cedear-{n}-ticker` | `string` | Never truncated |
| `quotes[n].label` | row label | `cedear-{n}-label` | `string` | The only field permitted an ellipsis cut |
| `quotes[n].priceArs` | row price | `cedear-{n}-price` | `string` | `es-AR`, 2 decimals |
| `retrievedAt` | meta | `cedears-time` | `string` | Unchanged: retrieval time, labeled `Consultado` |

`n` is `0` through `4`, positional. Row `n` receives quote `n`, so the display order is the adapter's
order and never a property of the markup.

**Not modeled**: `change`, `changePercent`, or any percentage column. The payload has no such
field. FR-010 forbids displaying one, and adding a source for it is out of scope.

### MEP — `MepValue` to elements

| Data field | Element | Id | Type | Note |
|---|---|---|---|---|
| `midpointArs` | hero | `mep-value` | `string` | `es-AR`, exactly 2 decimals. Now the only content of this element |
| unit | unit | `mep-unit` | `string` | `"ARS por USD"`, was previously part of the shared string |
| `buyArs`, `sellArs` | detail | `mep-detail` | `string` | `"Compra … · Venta …"`, each shown only when present |
| `rateType` | title | *(static markup)* | `string` | The block title `Dólar MEP/bolsa` carries the label FR-011 requires |
| `observedAt` or `retrievedAt` | meta | `mep-time` | `string` | Unchanged logic |

**Not modeled**: BNA official, blue, or any other rate type. Spec 002 FR-008 forbids them and FR-011
carries that forward.

## State model — unchanged, and extended by one rule

The three states per block are unchanged: loading, data, error. This feature adds no state, renames
no state, and reuses every existing message.

The one extension is a **clearing rule**. Because a block now owns several sub-slots rather than
one, the error transition must conceal all of them, not just the primary value:

```text
loading -> data   shows value sub-slots, source, time
loading -> error  shows error only; every value sub-slot concealed
data    -> error  shows error only; every value sub-slot concealed
```

A failure to clear a sub-slot would leave a stale number beside an error box. That is the
"apparently healthy page" Constitution VII forbids, so the rule is stated in
[contracts/view-slots.md](contracts/view-slots.md) and is asserted by the existing error-state test
once the in-file fake covers the new ids.

## Invariants carried forward unchanged

- One `GET /api/dashboard` request per page load. No polling, no cache, no persistence.
- Partial success: a failed widget does not affect its siblings.
- Weather in Celsius; timestamps shown with an explicit `Observado` or `Consultado` label.
- Fixed tickers `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA`, in that order.
- MEP midpoint as ARS per USD, rounded to two decimals, labeled MEP/bolsa.
- Error codes and messages are the eight already defined in `src/dashboard/normalize.js`.
- `dateStyle: "short"`, `timeStyle: "short"`, and the `es-AR` number formats are unchanged.
