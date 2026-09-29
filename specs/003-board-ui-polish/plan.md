# Implementation Plan: Market Board UI Polish

**Branch**: `003-board-ui-polish` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/speckit.specify` output in `specs/003-board-ui-polish/spec.md`

**Approval gate**: This plan adds **no dependencies**. No CSS framework, no icon font, no
normalize.css, no build step, no third-party origin. Nothing requires the user's library approval.

## Summary

Restyle the existing three-widget page so it reads as a market board instead of an unstyled HTML
dump, without touching data, adapters, or APIs. The three widgets become three visually distinct
blocks stacked in one centered column of at most 720 pixels. Each block gains a single dominant
number with supporting text beneath it, the five CEDEARs become a compact table with an aligned
price column, and the error state becomes a muted box that is never blank.

The implementation is presentation-only and runs through three files. `src/public/index.html`
declares the block structure and every element the renderer will fill. `src/public/styles.css`
supplies the spacing scale, type scale, and card treatment. `src/public/render.js` keeps writing
text into elements by `id` and gains the ability to split one value into a primary part and
supporting parts. `src/public/app.js`, the server, the service, the adapters, and the API route are
untouched.

## Technical Context

**Language/Version**: JavaScript with native ES modules; Node.js 24 LTS; modern browser
HTML/CSS/JavaScript. No change from the existing project.

**Primary Dependencies**: Node.js built-ins only. `dependencies` in `package.json` stays empty, as
required by FR-017 and Constitution IV. Styling is hand-written CSS custom properties; markup is
semantic HTML; the browser script is the existing vanilla renderer.

**Storage**: None. No change. The page remains a transient snapshot with no persistence.

**Testing**: `node:test` executed with `node --test`. The suite stays at exactly the 8 tests defined
in [spec 002](../002-dashboard-data-policy/plan.md), in the same 2 files, with no new test, no new
test file, and no fixture directory. See Test Plan below.

**Target Platform**: Node.js 24 LTS on Linux, macOS, or Windows; a modern browser; the page is
usable from 320 pixels wide upward. Unchanged.

**Project Type**: Single-page web application with a small same-origin JSON API. Unchanged.

**Performance Goals**: Unchanged from spec 002 — widget states within 3 seconds at the 95th
percentile. This feature adds no network work, no fonts, and no images, so the initial payload does
not grow beyond the added markup and CSS rules.

**Constraints**: One page; public and free sources; no secrets in git; fixed five-ticker CEDEAR
list; MEP/bolsa midpoint with no BNA or blue fallback; Celsius weather; explicit source or retrieval
timestamp; independent visible errors; at most 12 automated tests; presentation-only change with no
new dependencies; spacing restricted to `0`, `16px`, `24px`, `32px`, `40px`, `48px`, and `auto`; no
text below 14 pixels; no new static asset.

**Scale/Scope**: One small server process, one browser page, three blocks, five CEDEAR rows, five
static `<tr>` elements, and roughly twenty new element ids. No new routes, no new modules.

## Governing constraints discovered in the existing code

These three findings shape every task and were verified by reading the code, not assumed.

1. **`src/server.js` serves a fixed allowlist of five static assets** (`/`, `/index.html`,
   `/styles.css`, `/app.js`, `/render.js`). Any new file returns `404`. Therefore this feature
   creates **no new files**; every style lives in `styles.css` and every element in `index.html`.
2. **`README.md` records that `render.js` uses only `getElementById`, `textContent`, and `hidden`,
   and creates no elements or HTML.** This plan keeps that invariant exactly. It is what makes the
   structure change safe against upstream strings, and keeping it means the README statement stays
   literally true.
3. **The current layout is a three-column grid.** `styles.css` uses
   `grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr))` at `max-width: 60rem`,
   so on desktop the three widgets sit side by side. The single stacked column required by FR-002
   and FR-005 is therefore the single largest visual change, and it is the main reason the page
   reads as an HTML dump today.

Two current measurements also fail the new requirements and are fixed as part of this work:
`widget__source` and `widget__time` render at `0.8rem` (12.8px), below the 14px floor in FR-016, and
`widget__value` renders at 24px, which is not dominant enough to satisfy the "read at a glance"
intent behind FR-008 and FR-011.

## Design system

All values below are fixed by the spec; the rationale for each choice is in
[research.md](research.md) and the decision log in [spec.md](spec.md#clarifications).

**Spacing scale** — the only values permitted by FR-015, plus `auto` for centering:

| Token | Value | Used for |
|---|---|---|
| `--space-1` | `16px` | block padding, gap between CEDEAR rows, gap inside a row |
| `--space-2` | `24px` | gap between the three blocks |
| `--space-3` | `32px` | page title to first block |
| `--space-4` | `40px` | reserved |
| `--space-5` | `48px` | page top and bottom padding on tall viewports |

**Type scale** — FR-016 floors: supporting text at 14px, titles and values at 16px:

| Token | Value | Used for |
|---|---|---|
| `--text-xs` | `14px` | timestamps, source names, company labels, error text, table header |
| `--text-sm` | `16px` | block titles, row ticker, row price, weather condition |
| `--text-lg` | `20px` | reserved |
| `--text-xl` | `28px` | page title |
| `--text-hero` | `40px` | weather temperature, MEP rate |

SC-004 is satisfied with margin: the hero is 40px against 14px supporting text, a ratio of 2.9
against a required 1.5.

**Card treatment** — one treatment shared by all three blocks, per FR-007. Surface, a 1px border, a
`16px` radius, and `16px` internal padding. The radius is deliberately taken from the approved
spacing set rather than a conventional 8px so that a mechanical scan of the stylesheet finds no
pixel value to argue about; border widths and font sizes are not spacing values under FR-015.

**Layout** — a single flex column, `max-width: 720px`, `margin-inline: auto`, `gap: 24px`. No media
query is required. The single-column layout is the base and there is no wider-screen variant to
add, so FR-003's mobile-first requirement is satisfied by the absence of breakpoints rather than by
a cascade of overrides. FR-002's measured window of 640 to 760 pixels is met by a 720px maximum
plus 16px padding on each side.

## Block structures

Element `id`s already asserted by the existing smoke test are preserved, so that test stays green
without modification. Only `class` names change. Full details are in
[contracts/view-slots.md](contracts/view-slots.md).

```text
Tablero de mercado                                   <- h1, --text-xl, no subtitle

Clima                                                <- block title, --text-sm
21,4 °C                                              <- #weather-value, --text-hero
Parcialmente nublado                                 <- #weather-condition, --text-sm
Buenos Aires                                         <- #weather-location, --text-xs
Open-Meteo · Observado 25/9 11:45                    <- source + time, --text-xs

CEDEARs                                               <- block title
5 CEDEARs en pesos argentinos                        <- #cedears-value lede, --text-xs
Instrumento                          Precio (ARS)   <- thead, --text-xs
AAPL   Apple                                      27.400,10
MSFT   Microsoft                                412.900,00   <- 5 static rows, filled by id
GOOGL  Alphabet                                 385.120,55
META   Meta                                     612.004,20
NVDA   Nvidia                                    198.000,50
Data912 · Consultado 25/9 11:45                    <- source + time, --text-xs

Dólar MEP/bolsa                                     <- block title, carries the FR-011 label
1.550,15                                             <- #mep-value, --text-hero
ARS por USD                                          <- #mep-unit, --text-sm
Compra 1.549,40 · Venta 1.550,89                     <- #mep-detail, --text-xs
DolarAPI · Observado 25/9 11:45                      <- source + time, --text-xs
```

Block order is weather, CEDEARs, dollar, matching FR-005. The dollar block is last because it is the
smallest block and reads naturally as a footnote rate beneath the two market blocks.

## Renderer changes

`render.js` keeps its three-API surface. The three value renderers stop returning one joined string
and return structured parts, and `applyResult` writes each part to its own element.

| Renderer | Returns | Written to |
|---|---|---|
| `renderWeather` | `{ hero, condition, location, time, timeKind }` | `-value`, `-condition`, `-location` |
| `renderMep` | `{ hero, unit, detail, time, timeKind }` | `-value`, `-unit`, `-detail` |
| `renderCedears` | `{ lede, rows, time, timeKind }` | `-value`, fifteen `cedear-{n}-*` cells |

Three rules make this safe:

1. **Every new element is an optional lookup.** `display()` and `conceal()` already no-op on `null`,
   so a missing element degrades silently instead of throwing. A future markup change cannot break
   the renderer.
2. **`defaultValueText` is preserved** as the fallback for any unexpected value shape, so a
   malformed result still renders a readable string rather than nothing.
3. **The error path clears every new sub-slot.** This is the highest-risk change in the feature: if
   the error path conceals `-value` but forgets `-condition` or a row cell, a stale `21,4 °C` sits
   next to an error box, which is exactly the "apparently healthy page" that Constitution VII
   forbids. The extended "exactly one visible slot" assertion in the existing error-state test is
   what guards this.

## Test Plan

The suite is a budgeted safety net. This feature changes **no test count, no test file, and no
fixture**. The eight tests below are carried over from [spec 002](../002-dashboard-data-policy/plan.md)
unchanged in purpose; the two rendering tests gain new assertions and a more complete in-file fake.

| # | Test | File | What it pins after this feature |
|---|------|------|-------------------------------|
| 1 | Smoke | `tests/render.test.js` | `GET /` returns the page containing the three widget regions **and the new sub-slot ids and the CEDEAR table** |
| 2 | Weather adapter, happy path | `tests/adapters.test.js` | unchanged — adapters are not touched |
| 3 | CEDEAR adapter, happy path | `tests/adapters.test.js` | unchanged — adapters are not touched |
| 4 | FX adapter, happy path | `tests/adapters.test.js` | unchanged — adapters are not touched |
| 5 | Weather adapter, failure | `tests/adapters.test.js` | unchanged — adapters are not touched |
| 6 | CEDEAR adapter, failure | `tests/adapters.test.js` | unchanged — adapters are not touched |
| 7 | FX adapter, failure | `tests/adapters.test.js` | unchanged — adapters are not touched |
| 8 | Error state | `tests/render.test.js` | A failed widget shows its error, shows **no value in any sub-slot including all fifteen CEDEAR cells**, and leaves siblings byte-for-byte identical |

**Rules for this feature** (Constitution II, restated for FR-019):

- `createFakeDocument()` in `tests/render.test.js` is extended with the new element ids, and
  `SLOT_SUFFIXES` is extended to match, so the **existing** assertions — the visible-slot deep equal
  and the byte-for-byte sibling comparison — automatically start covering the new elements. This is
  an extension of a double that already exists inside the one allowed rendering test file. It is not
  a new test, a new file, a new module, or a new fixture.
- No `tests/helpers/`, no `tests/fixtures/`, no shared document-double module, no snapshot files, no
  coverage targets, no per-ticker tests.
- New assertions are folded into tests 1 and 8, the closest allowed categories. The suite stays at
  8 of a constitutional cap of 12.
- **No test is written and observed to fail before the implementation exists.** The fake is extended
  in the same task that adds the ids, so the two never disagree in the committed tree.
- Remaining behavior with no assertion — exact rendered type sizes, contrast ratios, the aligned
  price column, the ellipsis cut — is verified by the manual checklist in
  [quickstart.md](quickstart.md) and consciously accepted as uncovered by automation, per
  Constitution II.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Plan evidence | Status |
|-----------|---------------|--------|
| I. Small Webapp | Presentation-only restyle of one existing page. No new route, module, service, or abstraction; no new files at all | PASS |
| II. Right-Sized Tests | Test Plan holds the suite at 8 in 2 files against a cap of 12. No new test, no new file, no fixture, no snapshot, no coverage gate, no red-green ceremony | PASS |
| III. No API Secrets in Git | No new configuration, environment variable, credential, or remote origin. The page loads no third-party asset | PASS |
| IV. Public, Free APIs Only | No adapter, endpoint, or source is added or modified. The three public sources are untouched | PASS |
| V. One Page | The same single page; no route, navigation, or multi-step flow is introduced | PASS |
| VI. Readable on a Phone | Single 720px column, no horizontal scroll below 320px, 14px text floor, no hover-only affordance | PASS |
| VII. Visible API Failures | FR-012 turns the error into a muted box and the error path is explicitly required to clear every sub-slot, so no stale value can sit beside an error | PASS |

**Pre-Phase 0 gate**: PASS.

**Post-Phase 1 gate**: PASS. `research.md`, `data-model.md`, `contracts/view-slots.md`, and
`quickstart.md` add no dependency, no data field, no source, and no test beyond the Test Plan list,
and each records a decision that the constitution permits.

**User library gate**: no library is proposed, so no approval is required. If any task later needs
one, it stops and asks first.

## Project Structure

### Documentation (this feature)

```text
specs/003-board-ui-polish/
├── spec.md                     # /speckit.specify
├── plan.md                     # This file (/speckit.plan)
├── research.md                 # Phase 0 output (/speckit.plan)
├── data-model.md               # Phase 1 output (/speckit.plan)
├── quickstart.md               # Phase 1 output (/speckit.plan)
├── checklists/
│   └── requirements.md         # /speckit.specify and /speckit.clarify
├── contracts/
│   └── view-slots.md           # Phase 1 output (/speckit.plan)
└── tasks.md                    # Phase 2 output — NOT created by this plan
```

### Source Code (repository root)

Only the five marked files change. Everything else is listed to show what is deliberately untouched.

```text
README.md                        # touched: one line describing the block structure
package.json                     # unchanged — dependencies stay empty
src/
├── server.js                    # unchanged — five-asset allowlist still correct
├── config.js                    # unchanged
├── api/
│   └── dashboard-route.js       # unchanged
├── dashboard/
│   ├── service.js               # unchanged
│   └── normalize.js             # unchanged
├── lib/
│   ├── json-fetch.js            # unchanged
│   └── time.js                  # unchanged
├── sources/
│   ├── open-meteo.js            # unchanged
│   ├── data912-cedears.js       # unchanged
│   └── dolarapi-mep.js          # unchanged
└── public/
    ├── index.html               # CHANGED — block structure, sub-slot ids, table rows
    ├── styles.css               # CHANGED — tokens, single column, card, table, error box
    ├── app.js                   # unchanged
    └── render.js                # CHANGED — structured parts, new sub-slots, error clearing

tests/
├── render.test.js               # CHANGED — extended in-file fake, folded assertions, still 2 tests
└── adapters.test.js             # unchanged
```

**Structure Decision**: Keep the existing single-project layout with no build step. The change is
confined to the browser presentation layer plus one line of documentation. No directory is created
and no module is added, because `server.js`'s static allowlist makes a new file unservable without
editing the server, and the constitution prefers the smallest change that satisfies the spec.

## Rejected alternatives

No constitution violation is claimed, so nothing here is a tracked violation. These were
considered and rejected; the reasoning is in [research.md](research.md).

| Rejected | Why rejected |
|---|---|
| Tailwind, Bootstrap, or any utility CSS framework | New dependency, needs a build or CDN, contradicts FR-017 and the user's approval gate |
| A webfont such as Inter | New asset the static allowlist cannot serve, plus a render-blocking third-party request; FR-014 and SC-012 forbid it |
| Building CEDEAR rows with `createElement` in the renderer | Breaks the `getElementById`/`textContent`/`hidden` invariant recorded in the README and would need a test double with a real DOM |
| Building rows with `innerHTML` | Reintroduces an injection path from upstream strings. Rejected on principle, not convenience |
| Media-query breakpoints for wider screens | The 720px single column is correct at every width; breakpoints would add code with nothing to change |
| A CSS grid list instead of a `<table>` for the CEDEARs | Loses the column semantics a table gives for free to assistive technology; the table also gives alignment and ellipsis without extra CSS |
| Relaxing the existing error-state assertion | Weakens a meaningful check to suit the implementation. Extending the in-file fake is free and covers more |
| Adding layout or snapshot tests | Forbidden by Constitution II, and FR-019 forbids new test files |
| Showing a percentage column for the CEDEARs | The data does not contain one; FR-010 forbids it and adding it would change a data source |
| Showing official and blue rates beside MEP | Spec 002 FR-008 forbids it; FR-011 and the scope boundary carry that forward |

## Complexity Tracking

No constitution violation, therefore no justified exception. The rejected alternatives above are
recorded so that a later task does not reintroduce them.
