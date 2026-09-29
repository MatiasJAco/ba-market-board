# Technical Research: Market Board UI Polish

**Date**: 2026-09-29

## Decision Summary

The stack does not change. This is a presentation-only feature on a project that already has an
empty `dependencies` object, a five-asset static allowlist, and a hand-written stylesheet. The
research below therefore does not evaluate frameworks or build tooling. It answers the questions
that the spec left open, and records the constraints discovered by reading the existing code.

Nine decisions were made. Four came from the user through `/speckit.clarify` and are recorded in
[spec.md](spec.md#clarifications). Five were made here from the code and are the substance of this
document.

| # | Decision | Outcome |
|---|----------|---------|
| 1 | Where does the new structure live? | Pre-declared in `index.html`, filled by `id` |
| 2 | How does a value become "one big number"? | Split into separate elements, not a styled text blob |
| 3 | CEDEAR markup: table or grid list? | Real `<table>` with a `<thead>` |
| 4 | How is the existing test kept green? | Extend the in-file fake document |
| 5 | What counts as a "spacing value" under FR-015? | Spacing, margin, padding, and gap only |

## Constraints discovered in the existing code

These were verified by reading the files, not assumed, and they eliminate most of the usual design
options before any are considered.

### The static allowlist forbids new files

`src/server.js` maps exactly five paths to files:

```text
"/"           -> index.html
"/index.html" -> index.html
"/styles.css" -> styles.css
"/app.js"     -> app.js
"/render.js"  -> render.js
```

`resolveAsset` returns `null` for anything else and the server answers `404`. A separate
`tokens.css`, a font file, an SVG sprite, or a print stylesheet would all be unservable without
editing the server, which is out of scope for a UI polish task.

**Consequence**: every style goes in `styles.css` and every element in `index.html`. No new files
at all.

### The renderer has a deliberately narrow DOM surface

`README.md` states that `src/public/render.js` "solo usa `getElementById`, `textContent` y
`hidden`: no crea elementos ni interpola HTML". The code confirms it: the module touches no
`createElement`, no `innerHTML`, no `insertAdjacentHTML`, and no `classList`.

This is a security property, not an accident. Every string the renderer writes originates in a
third-party response — a condition label, a company name, an error message — so keeping the write
path to `textContent` makes HTML injection structurally impossible rather than merely avoided.

**Consequence**: the renderer cannot build the CEDEAR rows. They are static markup that the
renderer fills by `id`. This also means the README sentence stays literally true after the change,
so the documentation stays accurate without an edit.

### The current layout is a three-column grid

```css
.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  max-width: 60rem;
}
```

At any viewport wider than about 816 pixels the three widgets sit **side by side**, not stacked.
This is the single largest discrepancy between today's page and the requested design, and it is why
the page reads as an HTML dump on a desktop screen while being acceptable on a phone.

### Two current text sizes fail the new floor

| Selector | Current | Computed | FR-016 floor |
|---|---|---|---|
| `.widget__source` | `0.8rem` | 12.8px | 14px |
| `.widget__time` | `0.8rem` | 12.8px | 14px |
| `.board__subtitle` | `0.85rem` | 13.6px | 14px, and removed anyway |
| `.widget__value` | `1.5rem` | 24px | 16px minimum, but not dominant |

The timestamps and source names are the smallest text on the page today. Raising them to 14px is
part of this feature, not an incidental change, and it is why the type scale is defined explicitly
rather than left to inherit.

## Decision 1 — Structure lives in the HTML, not in JavaScript

**Question**: the CEDEAR block needs five individually addressable rows so the price column can
align and a long company name can be cut off with an ellipsis. Does the renderer create those rows,
or does the markup declare them?

**Chosen**: `index.html` declares five static `<tr>` elements with ids `cedear-0-*` through
`cedear-4-*`. The renderer writes ticker, label, and price into them by `id`.

**Alternatives**:

| Option | Why not |
|---|---|
| `document.createElement` in the renderer | Breaks the three-API invariant. The in-file test double would need a real DOM to model it, which is exactly the "test-seam architecture" Constitution II discourages |
| `innerHTML` with a joined string | Reintroduces injection from upstream strings. Rejected on principle |
| One `<pre>`-style text blob, as today | Cannot align a price column, cannot ellipsize one field inside a line, cannot give rows a uniform height. Fails FR-009 outright |

The fixed five-ticker list from spec 002 FR-005 makes static rows legitimate: the row count is
known at authoring time and is not data-dependent. The ticker *text* is still written by the
renderer, so the list itself still comes from one place.

## Decision 2 — A "big number" requires separate elements, not styling tricks

**Question**: FR-008 and FR-011 want a dominant primary value with smaller supporting text, and
FR-004 forbids horizontal scrolling. Today the whole value is one string, for example
`"1.550,15 ARS por USD · MEP/bolsa · Compra 1.549,40 ARS · Venta 1.550,89 ARS"`, rendered into a
single element with `white-space: pre-line`.

**Chosen**: the three value renderers return structured parts and each part is written to its own
element.

| Renderer | Parts |
|---|---|
| `renderWeather` | `hero` (temperature), `condition`, `location`, `time` |
| `renderMep` | `hero` (midpoint), `unit`, `detail` (bid and ask), `time` |
| `renderCedears` | `lede`, five `rows` of `ticker`/`label`/`price`, `time` |

**Why the split is necessary rather than cosmetic**: a single element has one font size. If the
number and its unit share an element, either the unit is unreadably large or the number is not
dominant. There is no CSS-only way to size part of a text node. The same reasoning applies to the
company label, which needs its own element so the ellipsis applies to the label and never to the
ticker or the price.

**Compatibility property**: the new elements are optional lookups. The existing `display()` and
`conceal()` helpers already no-op on `null`, so an element that is missing from the markup degrades
to "not shown" rather than throwing. The renderer stays tolerant of markup that lags behind it.

## Decision 3 — CEDEARs as a real table

**Question**: the spec permits "a compact table or list". Which?

**Chosen**: a real `<table>` with a two-row header, `Instrumento` and `Precio (ARS)`.

**Reasons**:

- `table-layout: fixed` gives column alignment with almost no CSS, which is what SC-006 measures.
- A `<th scope="col">` tells assistive technology what each column means, and the header is
  genuinely useful to a sighted visitor who does not know that CEDEAR prices are in pesos.
- Column widths are declared once in the table rather than repeated on every row, which suits
  markup that must stay static.

**Cost**, stated honestly: roughly fifteen extra static elements in `index.html`, and the widest
price in the column must be checked at a 320px viewport. The alternative, a flex or grid list, is
marginally lighter in markup but gives up the column semantics and needs per-row layout rules that
end up reimplementing what `table-layout` already does.

**Order note**: the order `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA` is positional, not embedded in the
markup. Row `n` receives quote `n`. The markup declares five rows; it does not hardcode the
ticker list, so the single source of truth for the order remains the adapter.

## Decision 4 — Extend the in-file fake document rather than weaken an assertion

**Question**: the existing error-state test asserts that `cedears-value` and `mep-value` have
non-empty `textContent`, and its fake document models only 15 flat elements with `textContent` and
`hidden`. Moving CEDEAR content into per-row cells and the MEP number into its own slot would make
those assertions fail — not because the code is wrong, but because the fake cannot see nested
content.

Three options were considered:

| Option | Verdict |
|---|---|
| Extend `createFakeDocument()` with the new ids and extend `SLOT_SUFFIXES` | **Chosen** |
| Leave the fake alone; let the new lookups return `null` in tests | Row rendering would be silently uncovered, and the "siblings byte-for-byte" guarantee would no longer include the new elements |
| Relax the assertion from "value slot has text" to "value slot or a row cell has text" | Weakens a currently meaningful check to fit the implementation |

**Why the first option is not a forbidden new fixture**: `createFakeDocument` is a plain function
that already lives inside `tests/render.test.js`, the one rendering test file the constitution
allows. Extending it adds no file, no module, no directory, and no test. The count stays at 8 in 2
files. FR-019 forbids new test files and this adds none.

**Bonus coverage, and the reason this option wins**: `SLOT_SUFFIXES` drives two existing
assertions. The visible-slot deep equal expects exactly `["error"]`, and `readSlots` compares
siblings byte for byte. Once the new ids are in `SLOT_SUFFIXES`, both assertions automatically cover
every new sub-slot. The single highest-risk change in this feature — an error path that forgets to
clear `-condition` or a row cell and leaves a stale `21,4 °C` beside an error box — becomes
detectable by a test that already exists.

**Consequence for `#cedears-value`**: because the fake does not model nesting, `cedears-value` must
receive its own non-empty text. It is given a data-derived lede line, `"<n> CEDEARs en pesos
argentinos"`, which is a genuine part of the design rather than a placeholder written to satisfy a
test. `mep-value` keeps the rate number itself, so the test's digit check continues to hold.

## Decision 5 — What FR-015's "spacing value" covers

**Question**: FR-015 restricts spacing to `0`, `16px`, `24px`, `32px`, `40px`, and `48px`, and
SC-010 makes that auditable. But a card needs a border radius, and a table needs cell padding. Are
those "spacing values"?

**Chosen interpretation**: FR-015 governs `padding`, `margin`, and `gap` only. `border-width`,
`border-radius`, `font-size`, and `line-height` are not spacing and are not restricted.

**How the ambiguity is neutralized anyway**:

- The card radius is `16px`, taken from the approved set rather than the more conventional `8px`.
  The visual difference is negligible at a 16px radius on a 720px card, and it means no reviewer has
  to win an argument about whether 8px is a spacing value.
- The only remaining non-scale pixel values in the stylesheet are the `1px` border widths, which
  cannot be expressed otherwise and which no one will mistake for spacing.
- Cell padding uses `16px 0` — 16px of vertical padding and 0 horizontally — so three columns of
  cell padding do not consume 96px of the 256px available at a 320px viewport. Separation inside a
  row comes from a 16px flex gap instead. Every value is from the approved set.
- `margin-inline: auto` is the one non-numeric value, allowed explicitly by FR-015 for centering.

## Type scale derivation

FR-016 sets the floors: 14px supporting, 16px titles and values. FR-004 forbids horizontal
scrolling. SC-004 requires the hero to be at least 1.5× the supporting text.

| Token | Value | Basis |
|---|---|---|
| `--text-xs` | `14px` | The FR-016 floor for timestamps, source names, labels, and errors |
| `--text-sm` | `16px` | The FR-016 floor for block titles, tickers, and prices |
| `--text-xl` | `28px` | Large enough to name the page without competing with a hero number |
| `--text-hero` | `40px` | 2.9× the supporting text, well past the 1.5× that SC-004 requires |

**Width check at a 320px viewport.** Content width is `320 - 16 - 16` page padding `- 16 - 16` card
padding = 256px.

- `"21,4 °C"` at 40px is roughly 150px. Fits.
- `"1.550,15"` at 40px is roughly 130px. Fits.
- The widest realistic CEDEAR price, say `"412.900,00"` at 16px, is roughly 80px. The price column is
  sized to content and the instrument column absorbs the remainder, leaving about 160px for ticker
  plus label, which is enough for the ticker and an ellipsized label.

These are estimates, not measurements, and the exact numbers are on the manual checklist in
[quickstart.md](quickstart.md). If a price turns out too wide, the fix is to let the price column
wrap its own column count or to reduce the price to `--text-sm`, never to introduce a value outside
the approved scale.

## Contrast and dark mode

FR-016 requires 4.5:1 for body and error text and, after clarification, requires this in both
appearances. SC-011 additionally requires 3:1 for the hero against the card surface.

The existing stylesheet already defines a light and a dark token set behind
`prefers-color-scheme`. The decision is to **extend** that token set with the new surfaces rather
than redesign the palette: a card surface, a muted error surface, and a muted text colour that
works for timestamps at 14px. Raising the timestamp size from 12.8px to 14px reduces the number of
failing contrast pairs to check rather than adding any.

The muted error box is the one genuinely new surface. The current error treatment is a red-tinted
box with a red border, which reads as an alarm. FR-012 asks for a muted box, so the border becomes
subdued and the surface slightly tinted, with the message text carrying the meaning rather than a
saturated background. The red hue is kept in the text and border accent so an error is still
distinguishable at a glance, which Constitution VII requires — muted must not become invisible.

## Rejected: frameworks, fonts, and build tooling

| Rejected | Reason |
|---|---|
| Tailwind, Bootstrap, or any utility framework | New dependency, needs a CDN or a build step. Violates FR-017 and needs the user's explicit approval |
| A webfont such as Inter or Roboto | The static allowlist cannot serve a font file, and a third-party stylesheet violates SC-012. FR-014 keeps the system font stack already in use |
| A CSS preprocessor | Requires a build step for a single page with one stylesheet |
| A component library or a client-side templating layer | `innerHTML`-based rendering would break the injection-safety invariant, and a component layer would be a new abstraction with nothing to componentize |
| Media-query breakpoints | The 720px single column is correct at every width from 320px up. Breakpoints would be added complexity with no layout change to apply |
| Layout, visual-regression, or snapshot tests | Forbidden by Constitution II; FR-019 forbids new test files. Visual acceptance is a manual checklist instead |
| A percentage-change column for the CEDEARs | The payload has no percentage. FR-010 forbids it and adding one would change a data source |
| Official and blue rates next to MEP | Spec 002 FR-008 forbids it and FR-011 carries that forward. The block shows one rate |

## Open items carried into the tasks

1. **The widest realistic price at 320px** must be eyeballed, not assumed. Listed on the manual
   checklist.
2. **`#cedears-value` lede wording** is a design detail; the tests require only that it is non-empty
   and derived from the quote count. The task leaves the exact Spanish phrasing to the implementer.
3. **The `Clima` block title** changes from `Clima en Buenos Aires` to `Clima`, because the city is
   now rendered from the data into `#weather-location`. This avoids printing "Buenos Aires" twice.
   If the data-driven line is ever absent, the title alone no longer names the city — acceptable,
   because the block is unambiguous in context and the value is what the visitor reads.
