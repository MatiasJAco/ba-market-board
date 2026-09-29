# View Slot Contract

## Purpose

This is the contract between `src/public/index.html` and `src/public/render.js`. It replaces nothing
and adds no endpoint. It specifies which element ids the markup must declare, which the renderer
writes to, and which of them are optional.

It exists because this feature is the first change that splits one value across several elements.
Without a written list, the natural failure is a sub-slot that the error path forgets to clear,
leaving a stale number beside an error box.

## Renderer DOM surface — unchanged

The renderer may use **only** these three DOM members:

| Member | Use |
|---|---|
| `getElementById(id)` | Locate a slot |
| `element.textContent = string` | Write a value |
| `element.hidden = boolean` | Show or hide a slot |

It must **not** use `createElement`, `innerHTML`, `insertAdjacentHTML`, `classList`,
`appendChild`, `removeChild`, or `querySelector`. This is the invariant already recorded in
`README.md` and it is what makes writing upstream-controlled strings safe. A future task that needs
a fourth member must amend this contract and the README together, and must justify why
`textContent` is insufficient.

## Slot inventory

Widget keys are `weather`, `cedears`, and `mep`. Suffixes are appended with a hyphen.

### Required slots — present today, must keep working

If any of these is missing, `slots()` returns `null` and the widget silently does nothing, exactly
as today.

| Id | Written by | Content |
|---|---|---|
| `{key}-loading` | `renderLoading` | The static Spanish "Cargando…" text already in the markup |
| `{key}-value` | `applyResult` | The **primary** value. Must be non-empty on success |
| `{key}-time` | `applyResult` | `Observado: …` or `Consultado: …` |
| `{key}-source` | `applyResult` | The source name, e.g. `Open-Meteo` |
| `{key}-error` | `applyResult` | The error message from the result, unmodified |

`{key}-value` is the element the existing error-state test asserts against for `weather`,
`cedears`, and `mep`. It stays non-empty on success in all three blocks, so the assertion continues
to hold without weakening it.

### Optional slots — new in this feature

A missing optional slot is not an error. `display()` and `conceal()` already no-op on `null`, so the
renderer degrades to "not shown" rather than throwing. This is deliberate: the renderer must not
break when the markup lags behind it.

| Id | Written by | Content | Optional because |
|---|---|---|---|
| `weather-condition` | `renderWeather` | Short condition phrase | A source may omit a condition |
| `weather-location` | `renderWeather` | City name | The value already carries `location`, but a fallback payload may not |
| `mep-unit` | `renderMep` | `ARS por USD` | Fixed text, not data |
| `mep-detail` | `renderMep` | `Compra … · Venta …` | Bid and ask may each be absent |
| `cedear-{n}-ticker` | `renderCedears` | Ticker text | Fixed five rows; row `n` is matched positionally |
| `cedear-{n}-label` | `renderCedears` | Company or instrument label | A quote may carry no label |
| `cedear-{n}-price` | `renderCedears` | Local price in pesos | Should not happen, but must not blank the row |

`n` ranges from `0` to `4`. Fifteen ids in total, declared statically in the markup.

### Unchanged ids

`weather-widget`, `cedears-widget`, and `mep-widget` are the section elements asserted by the
smoke test. They keep their ids. Only their `class` values change.

## Clearing rules

### Loading

`renderLoading(key)` conceals **every** slot belonging to that widget: value, all optional value
subslots, time, source, and error. A block never shows a loading message beside a stale number.

### Success

`applyResult` with a success result conceals the error slot, then writes:

1. the primary value to `{key}-value`, and un-hides it;
2. each optional part to its own slot, and un-hides it **only when its content is non-empty**;
3. the source name to `{key}-source`, and un-hides it when non-empty;
4. the timestamp to `{key}-time`, and un-hides it when the timestamp parses.

Writing an empty string must leave the element hidden. This is the existing `display()` behavior and
it is what keeps an absent condition from showing an empty line.

### Error

`applyResult` with an error result writes the message to `{key}-error` and un-hides it, and conceals
**all** of the following:

```text
{key}-value
{key}-time
{key}-source
every optional value subslot belonging to that widget
```

Concretely, for `weather` that means `-value`, `-condition`, `-location`, `-time`, `-source`; for
`mep`, `-value`, `-unit`, `-detail`, `-time`, `-source`; for `cedears`, `-value` and all fifteen
`cedear-{n}-*` cells, plus `-time` and `-source`. The error slot itself is the one slot that becomes
visible.

**This is the highest-risk rule in the contract.** Forgetting one sub-slot leaves, for example,
`21,4 °C` sitting beside `No se pudo consultar la fuente de datos.` — a page that looks healthy
while showing a failure, which Constitution VII and FR-012 both forbid.

The rule is verifiable: after an error, exactly one slot belonging to that widget is visible.

## Fallback behavior

`defaultValueText` is retained as the fallback for any value shape the specific renderer does not
recognize. When it is used, the result is written to `{key}-value` alone, every optional subslot for
that widget is concealed, and the timestamp uses `retrievedAt`. A malformed result therefore still
produces a readable string in the block rather than an empty block.

## Markup obligations

`index.html` must declare, for the contract to be fully exercised:

- the three `*-widget` sections, unchanged ids;
- the five required slots per section, unchanged ids;
- a `Clima`, a `CEDEARs`, and a `Dólar MEP/bolsa` block title, with the MEP title carrying the
  rate-type label FR-011 requires;
- the optional slots listed above, so the renderer has somewhere to write;
- a `<table>` for the CEDEARs with a `<thead>` naming the ticker and price columns, and a `<tbody>`
  holding exactly five `<tr>` elements;
- no element that requires script to be visible.

The board title is a single `<h1>`. The grey descriptive line is removed per FR-005.

## What this contract does not cover

- No CSS. Class names are free for the implementer to choose; only the ids above are contractual.
  This is what lets `styles.css` be restyled without touching the renderer.
- No HTTP. The `GET /api/dashboard` contract in
  [spec 002](../../002-dashboard-data-policy/contracts/dashboard-api.md) is unchanged.
- No data shape. See [data-model.md](../data-model.md), which records that no field changes.
- No new files. `server.js` serves five static paths and that list is not extended by this feature.
