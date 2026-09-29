# Quickstart: Market Board UI Polish

## Prerequisites

- Node.js 24 LTS
- A modern browser
- Internet access for the live board; the automated tests do not need internet access

No new dependency is installed by this feature. `dependencies` in `package.json` stays empty, so
there is no `npm install` step.

## Run locally

From the repository root:

```bash
node --version
npm test
npm start
```

Open `http://127.0.0.1:3000/` in a browser. The page shows Buenos Aires weather, the five fixed
CEDEARs, and the MEP/bolsa rate as three stacked blocks in one centered column. A browser reload
starts a new snapshot.

Without the npm script:

```bash
node src/server.js
```

A different port, using a non-secret environment variable:

```bash
PORT=3100 node src/server.js
```

## Run the tests

```bash
npm test
```

Expected: **8 passing, 0 failing**, unchanged from before this feature. The suite is still 2 files.
This feature adds no test file and no test case; it extends the fake document that already lives
inside `tests/render.test.js` and folds a few assertions into the two existing rendering tests.

A green run proves the structure contract and the error-clearing rule. It does **not** prove the
layout. Layout is verified by the manual checklist below, which is deliberate: Constitution II
forbids layout, visual-regression, and snapshot tests.

## Manual verification checklist

This is how the visual acceptance criteria in `spec.md` are checked. Nothing here adds an automated
test.

### Viewports

| Check | Expected |
|---|---|
| 320px wide | No horizontal scrollbar. Three blocks stacked. Nothing clipped. |
| 768px wide | Same three blocks, same order, same content |
| 1280px wide | Same three blocks, **still stacked**, one centered column — not three side-by-side columns |
| DevTools ruler at 1280px | Column measures 640–760px, centered within a 20px tolerance |
| 200% browser zoom | Reflows to one column and stays legible |

### Per block

| Check | Expected |
|---|---|
| Block order | Clima, then CEDEARs, then Dólar |
| Above the blocks | One slim `h1`. No grey descriptive line under it |
| Block titles | `Clima`, `CEDEARs`, `Dólar MEP/bolsa` |
| Weather | Temperature is the largest text in its block; condition below it; `Buenos Aires` visible |
| CEDEARs | Five rows, order `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA` |
| CEDEAR prices | All five start at the same horizontal offset; right-aligned |
| CEDEAR rows | Uniform height; ticker and price on one line; no percentage column or dash anywhere |
| Dollar | One large number, `ARS por USD` smaller beneath it, `Compra`/`Venta` smaller still |
| Timestamps | Visible in all three blocks, prefixed `Observado:` or `Consultado:` |

### Typography and spacing

| Check | Expected |
|---|---|
| Smallest text | Nothing below 14px. Inspect the timestamp and company-name text specifically — today it renders at 12.8px |
| Hero ratio | The big number is at least 1.5× the supporting text in its block |
| Font | System font stack only. No webfont request in the Network panel |
| Spacing audit | Every `padding`, `margin`, and `gap` in `styles.css` is `0`, `16px`, `24px`, `32px`, `40px`, `48px`, or `auto` |
| Rhythm | Spacing between CEDEAR rows is visibly smaller than spacing between blocks |

### Failure states

Force a failure by disconnecting the network, or by pointing `PORT` at a machine without internet,
then reload:

| Check | Expected |
|---|---|
| Failing block | A muted box with a readable message. Not blank. Not a zero. Not a `—` |
| Error text | At least 14px, and readable against the muted background |
| Siblings | The other two blocks keep their values and timestamps |
| Stale data | No number, condition, unit, or table cell left visible beside the error box. **This is the highest-risk regression in the feature — check it explicitly in all three blocks** |
| All three failing | Three muted boxes, no blank region anywhere |

### Dark mode

Toggle the OS or DevTools color scheme to dark and reload:

| Check | Expected |
|---|---|
| All three blocks | Readable, still three distinguishable blocks |
| Error box | Readable, not washed out |
| Timestamps and source names | Readable, not dimmer than the body text |
| No white flashes | Surfaces and text both switch together |

### CEDEAR width stress test

The narrowest layout is the most likely to break.

| Check | Expected |
|---|---|
| Widest realistic price at 320px | e.g. `412.900,00` fits on one line with room to spare |
| Long company name | Cut off with an ellipsis, never wrapped, never covering the ticker or price |
| Row height | Identical across all five rows |

If a price does not fit, the fix is to let the price column size to content and give the remainder
to the instrument column, or to reduce the price to the 16px size. **Do not** introduce a pixel
value outside the approved scale to make it fit — SC-010 will catch it.

## Confirming the scope was respected

```bash
git diff --stat
git status --short
```

Expected: `src/public/index.html`, `src/public/styles.css`, `src/public/render.js`,
`tests/render.test.js`, and `README.md` only. **No new files**, and no change to `src/sources/`,
`src/dashboard/`, `src/api/`, `src/lib/`, `src/config.js`, `src/server.js`, or `package.json`.

```bash
git diff --name-only | grep -E '^src/(sources|dashboard|api|lib)/|^src/(config|server)\.js|^package\.json$'
```

Expected: no output. Any match means an adapter, the service, or a dependency was touched, which
FR-001, FR-017, and FR-018 forbid.

```bash
node -e "console.log(Object.keys(require('./package.json').dependencies).length)"
```

Expected: `0`.

## Definition of done

- `npm test` green at 8 of 8, in 2 files.
- Three blocks at 320px and at 1280px, stacked in both, in one centered column.
- No horizontal scroll at any width from 320 to 1920px.
- Nothing below 14px.
- No percentage anywhere; no official or blue rate anywhere.
- Error boxes readable in light and dark, with no stale value beside them.
- Every spacing value in the approved set.
- Zero dependencies; no third-party asset requested.
