# Feature Specification: Market Board UI Polish

**Feature Branch**: `003-board-ui-polish`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description:

> New feature: UI polish of the existing BA market board. Do not change weather, CEDEAR, or FX
> behavior or APIs. UI polish only. Same data, same APIs, same widgets. Goal: the page should look
> like a simple market board, not an unstyled HTML dump.
>
> Must: mobile-first, max-width ~720px, centered; three stacked sections with a title and a timestamp
> each; weather with big temperature, short condition, city name; CEDEARs as a compact table or
> list (ticker, price, % if you already have it); FX showing official vs blue only if the spec
> already has both, otherwise one rate as a big number; error state as a muted box with readable
> text and no blank hole; typography from system fonts or one font already in the project; spacing on
> a 16/24px rhythm, not random margins.
>
> Must not: new dependencies; charts, sparklines, maps, news feed; navbar, footer links farm, hero
> banner; rewrite adapters.
>
> Done when: desktop and phone both show 3 clear blocks and you can read the numbers at a glance.

## Scope boundary *(pre-resolved from existing artifacts)*

This feature changes **presentation only**. Two data questions raised in the input are answered by
the current artifacts and are therefore not open:

- **Exchange rate**: [spec 002 FR-008](../002-dashboard-data-policy/spec.md) states the board shows
  the **MEP/bolsa midpoint only** and MUST NOT display the official BNA or blue rate. This feature
  therefore shows **one rate, as a large number**, labeled MEP/bolsa. It does not introduce an
  official-versus-blue comparison.
- **Percentage change**: the CEDEAR payload carries ticker, company label, and local price in pesos
  only. No daily percentage is available, so **no percentage column or percentage value is shown**.
  Obtaining one would change a data source and is out of scope.

## Clarifications

### Session 2026-09-29

- Q: Should the spacing rhythm allow 8px values for tight internal spacing, or is every spacing value
  restricted to 16px and 24px steps? → A: Strict 16/24 only. The complete allowed set is
  0, 16, 24, 32, 40, and 48 pixels.
- Q: Should the page keep a page-level title above the three blocks, and if so what happens to the
  small grey line that currently sits under it? → A: Keep one slim page title above the three
  blocks, and remove the smaller grey line beneath it.
- Q: When a CEDEAR's company name is too long to fit on one line, should the name be cut off with an
  ellipsis or wrap onto a second line? → A: Cut the company name off with an ellipsis so every row
  stays exactly one line and rows keep a uniform height.
- Q: When the visitor's device is set to dark mode, should the polished board still render in dark
  colours? → A: Keep dark mode, and make sure the new block surfaces, muted error box, and timestamps
  stay readable in dark mode too.
- Q: What is the smallest text size allowed anywhere on the page, for timestamps, company names, and
  error messages? → A: 14px minimum for supporting text such as timestamps, company names and errors,
  and 16px minimum for block titles and values.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the whole board at a glance on a phone (Priority: P1)

As an anonymous visitor opening the board on a phone, I see three clearly separated blocks stacked
one after another, and I can read the temperature, the five CEDEAR prices, and the dollar rate
without zooming and without swiping sideways.

**Why this priority**: Readability on a phone is the constitutional promise of the product and the
main reason the current page reads as an unstyled HTML dump. Everything else is decoration on top of
a layout that already fits a phone.

**Independent Test**: Open the page in a 320-pixel-wide viewport and in a 1280-pixel-wide viewport
with successful data for all three widgets; verify both widths show the same three blocks in the same
top-to-bottom order, the content is centered in a single column of roughly 720 pixels or less, and no
horizontal scrolling is required.

**Acceptance Scenarios**:

1. **Given** the page is opened on a phone-sized viewport, **When** the three widgets render, **Then**
   the weather, CEDEAR, and dollar blocks appear stacked in a single column with the same content
   and order they have on a desktop screen.
2. **Given** the page is opened on a wide desktop screen, **When** the widgets render, **Then** the
   three blocks stay stacked in one centered column and do not spread into a row of three columns.
3. **Given** any viewport narrower than the board's maximum width, **When** the page is displayed,
   **Then** the board fills the available width, keeps its side padding, and never scrolls
   horizontally.

---

### User Story 2 - Take in the numbers quickly (Priority: P1)

As an anonymous visitor, I see each block with a title, one large primary value, and a small
timestamp, so my eye lands on the number first and I can tell how old it is without reading a
paragraph.

**Why this priority**: "Read the numbers at a glance" is the stated definition of done. A clear
visual hierarchy inside each block is what turns three data dumps into a board.

**Independent Test**: Render the page with successful data for all three widgets and verify each
block has a visible title, a primary value that is visually larger than its surrounding text, and a
visible timestamp line.

**Acceptance Scenarios**:

1. **Given** the weather widget has valid data, **When** the block renders, **Then** the
   temperature is the largest element in the block, the condition is shown as a short phrase
   beneath or beside it, and the city name is visible in the block.
2. **Given** the dollar widget has valid data, **When** the block renders, **Then** the peso value
   is the largest element in that block and the rate type stays visible next to it.
3. **Given** any widget has valid data, **When** the block renders, **Then** the block shows both a
   title and the observation or retrieval timestamp already required by spec 002.

---

### User Story 3 - Compare the five CEDEAR prices (Priority: P1)

As an anonymous visitor, I see the five CEDEARs as one compact list or table with a row per
instrument, so I can compare the prices down a column instead of parsing a paragraph of text.

**Why this priority**: Five prices are the densest block on the board and the one that degrades
worst when rendered as flowing text. Compaction is what makes them comparable.

**Independent Test**: Render the page with valid quotes for the five fixed tickers and verify five
rows appear in the fixed order `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA`, each row showing its ticker
and its local price, with prices aligned in a consistent column.

**Acceptance Scenarios**:

1. **Given** the five fixed CEDEARs have valid quotes, **When** the block renders, **Then** it shows
   one row per instrument in the order `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA`, each row with the
   ticker and the local price in Argentine pesos.
2. **Given** the five CEDEARs are shown, **When** the visitor scans the block, **Then** the five
   prices sit in a consistent aligned column, and the spacing between CEDEAR rows is smaller than
   the spacing between the three blocks.
3. **Given** a company label is available for a ticker, **When** the row renders, **Then** the label
   is shown on the same single line as the ticker and price, is cut off with an ellipsis rather than
   wrapped when it does not fit, and never displaces or hides the ticker or the price.
4. **Given** no percentage change value exists for a quote, **When** the block renders, **Then** no
   percentage value, dash, or placeholder percentage column is shown.

---

### User Story 4 - Understand a failure instead of seeing a hole (Priority: P2)

As an anonymous visitor whose data source is failing, I see a readable muted box explaining that
the block could not be loaded, and the other two blocks keep working, so the page never looks
broken or empty.

**Why this priority**: Visible API failure is a constitutional principle, and restyling an error is
exactly where a polish pass can silently delete the error. The error must survive the redesign.

**Independent Test**: Fail the weather source while the other two succeed and verify the weather
block shows a visible, readable message inside a muted box, that the other two blocks show their
data, and that no block is left as an empty region.

**Acceptance Scenarios**:

1. **Given** a widget's source fails, **When** the block renders its error state, **Then** the
   block shows the existing error message as readable text inside a muted box, and the rest of the
   block layout stays intact.
2. **Given** one widget fails and the others succeed, **When** the page renders, **Then** the
   failed block shows its error and the other two blocks show their values and timestamps.
3. **Given** a widget is still loading, **When** the page first renders, **Then** the block shows a
   visible loading state inside the same block frame, not an empty block.

---

### User Story 5 - See a consistent, restrained board (Priority: P2)

As an anonymous visitor, the board looks like one deliberate page: one type family, one spacing
rhythm, one card treatment for the three blocks, and no decorative furniture competing with the
numbers.

**Why this priority**: This is what separates "a market board" from "unstyled HTML", and it is a
one-page product where restraint is the design.

**Independent Test**: Review the rendered page and verify that all text uses the single system font
family, that spacing comes from a small repeating scale, and that the page contains no charts,
maps, navigation bar, hero banner, link farm, or news content.

**Acceptance Scenarios**:

1. **Given** the page renders on any device, **When** the visitor looks at it, **Then** all text
   uses the single font family already used by the project and no additional font is downloaded.
2. **Given** the three blocks are laid out, **When** the visitor compares them, **Then** they share
   the same card treatment, the same internal spacing scale, and the same heading style.
3. **Given** the page renders, **When** the visitor scrolls it, **Then** there is no navigation bar,
   hero banner, footer link list, chart, sparkline, map, or news feed.

### Edge Cases

- A company label too long for its column: the label is cut off with an ellipsis on a single line;
  the ticker and price stay fully visible on that same line.
- A long source error message inside a block: it wraps inside the block and never widens the board
  or forces horizontal scrolling.
- A viewport narrower than 320 pixels: the board still stacks and stays readable.
- A user with a large default text size or a dark color preference: the board remains readable and
  the three blocks remain distinguishable.
- A widget in loading state, a widget with data, and a widget with an error appearing at the same
  time: all three blocks keep identical frame size and alignment.
- A viewport zoomed to 200%: the board reflows into one column and stays legible.
- A source returns a value without an observation time: the block still shows the labeled retrieval
  timestamp that spec 002 already requires.

## Requirements *(mandatory)*

### Presentation requirements

- **FR-001**: The page MUST keep its existing single-page structure, its three widgets, and its
  existing data, and MUST NOT change which values are shown, which sources provide them, or how they
  are requested. Removing the static descriptive line beneath the page title is permitted because it
  is fixed explanatory copy, not a market value.
- **FR-002**: The page MUST use a single-column layout whose content column is centered and whose
  maximum width is 720 pixels, with a measured width between 640 and 760 pixels accepted as meeting
  that intent, and the column MUST shrink to the available viewport width on narrower screens.
- **FR-003**: The page MUST be designed mobile-first: the base layout applies at narrow widths and
  any wider-screen refinements MUST be additive, not the source of the default layout.
- **FR-004**: The page MUST NOT require horizontal scrolling at any viewport width down to 320
  pixels.
- **FR-005**: The page MUST present exactly three content blocks — weather, CEDEARs, and the dollar
  rate — stacked in that top-to-bottom order beneath a single slim page-level title, and MUST NOT
  add navigation, a hero banner, or a footer link list. The small grey descriptive line that
  currently sits under the page title MUST be removed, because it describes refresh mechanics rather
  than a market value.
- **FR-006**: Each of the three blocks MUST display a visible title and the observation or retrieval
  timestamp already produced by the existing rendering behavior.
- **FR-007**: All three blocks MUST share one card treatment: the same surface, border, corner
  radius, and internal padding, so the page reads as three matching blocks.
- **FR-008**: The weather block MUST show the temperature as its visually dominant element, the
  condition as a short phrase, and the city name.
- **FR-009**: The CEDEAR block MUST show one compact row per instrument for the fixed list `AAPL`,
  `MSFT`, `GOOGL`, `META`, `NVDA`, in that order, each row showing the ticker and the local price in
  Argentine pesos, with prices aligned in a consistent column. Every row MUST stay exactly one line
  tall, and a company label that does not fit MUST be cut off with an ellipsis rather than wrapped.
- **FR-010**: The CEDEAR block MUST NOT display a percentage change value or a percentage column,
  because no such value is available from the current data.
- **FR-011**: The dollar block MUST show a single large value for the MEP/bolsa midpoint in
  Argentine pesos per US dollar, two decimal places, with the MEP/bolsa rate label visible, and
  MUST NOT show the official or blue rate.
- **FR-012**: The error state MUST be rendered as a readable muted box inside the affected block,
  using the existing error message text, and MUST NOT leave the block visually empty.
- **FR-013**: The loading state MUST be visible inside the block frame, in the same position the
  data will occupy.
- **FR-014**: Typography MUST use a single font family that is already available to the project or
  provided by the platform; the feature MUST NOT download, bundle, or introduce a new font.
- **FR-015**: Text sizes MUST follow a small named scale, and every spacing, margin, padding, and
  gap value MUST be one of `0`, `16px`, `24px`, `32px`, `40px`, or `48px`. The single exception is
  `auto` used for horizontal centering of the board column. No other spacing value is permitted
  anywhere on the page; the stylesheet MUST NOT introduce arbitrary one-off spacing. Tight internal
  spacing is achieved by using 16px inside a block while using 24px or more between blocks, never
  by introducing a smaller value.
- **FR-016**: The page MUST render in both a light and a dark appearance, following the visitor's
  device preference, and MUST keep the dark appearance the page already supports. No text may render
  below `14px`; supporting text such as timestamps, company names, and error messages MUST be at
  least `14px`, and block titles and primary values MUST be at least `16px`. Error text MUST reach a
  contrast ratio of at least 4.5:1 against its muted background in **both** appearances. Every new
  surface introduced by this feature — the block background, the muted error box, and the timestamp
  text — MUST be legible in both appearances rather than satisfying the contrast minimum in light
  mode only.
- **FR-017**: The feature MUST NOT introduce new runtime or build dependencies; the project's
  dependency set MUST stay empty.
- **FR-018**: The feature MUST NOT change the data-source adapters, their request shapes, their
  validation, their error codes, or their error messages.

### Test requirements

- **FR-019**: The project MUST add no new automated test files for this feature. Layout and
  presentation changes MUST be verified inside the existing smoke and error-state tests, and the
  total suite MUST stay at or below the constitutionally capped budget of 12 tests.

### Out of scope *(explicitly excluded)*

- Charts, sparklines, maps, or any time-series visualization.
- A news feed, ticker tape, or scrolling marquee.
- A navigation bar, mega-menu, footer link farm, or hero banner.
- New data sources, new fields, percentage change, historical data, or persistence.
- Any change to refresh behavior, caching, or the one-request-per-page-load policy.
- Rewriting the data-source adapters, the service layer, or the API route.

### Key Entities

- **Board block**: one of the three stacked regions; carries a title, a timestamp, and exactly one
  visible state — loading, value, or error.
- **Widget versus block**: the same component seen two ways. "Widget" names the existing data
  component and its loading, data, and error states. "Block" names how that component is presented on
  the page as one of the three stacked regions. The three widgets and the three blocks are the same
  three things in the same order.
- **Board column**: the single centered content area, capped at approximately 720 pixels wide.
- **Type scale**: the named text sizes shared by titles, primary values, and supporting text.
- **Spacing scale**: the 16/24-pixel rhythm used for all block padding, gaps, and offsets.
- **Value emphasis**: the visual treatment that makes one number the dominant element of its block.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At a 320-pixel viewport width and at a 1280-pixel viewport width, a reviewer sees one
  page title followed by three visually distinct blocks in the same top-to-bottom order, with the
  desktop view showing the same title and three blocks as the phone view, and with exactly one
  title-like line above the blocks.
- **SC-002**: At no viewport width from 320 to 1920 pixels does the page require horizontal
  scrolling.
- **SC-003**: The content column measures between 640 and 760 pixels on a viewport of 1200 pixels or
  more, and is horizontally centered within a 20-pixel tolerance.
- **SC-004**: In each block, the primary value's rendered font size is at least 1.5 times the
  rendered font size of that block's supporting text.
- **SC-005**: At a 320-pixel viewport, every block title, ticker, price, rate value, city name,
  timestamp, and error message is fully readable with nothing clipped, overlapped, wrapped
  awkwardly, or cut off, and the page does not scroll horizontally. The only text permitted to be cut
  off is a CEDEAR company label, which shows an ellipsis and never a bare cut.
- **SC-006**: For each of the five CEDEAR rows, the ticker and price are on the same line, every row
  has the same rendered height, the rows appear in the fixed order `AAPL`, `MSFT`, `GOOGL`, `META`,
  `NVDA`, and the five prices start at the same horizontal offset.
- **SC-007**: The page renders no percentage value and no percentage column in the CEDEAR block.
- **SC-008**: The dollar block shows exactly one rate value, labeled MEP/bolsa, and the string "blue"
  or "oficial" does not appear in that block.
- **SC-009**: For a failed widget, the error message text is present in the page inside a styled box
  with a non-transparent background, and the block is not blank.
- **SC-010**: Every spacing, margin, padding, and gap value in the page resolves to one of `0`,
  `16px`, `24px`, `32px`, `40px`, `48px`, or `auto` for horizontal centering, with zero values
  outside that set.
- **SC-011**: Body and error text contrast against their backgrounds is at least 4.5:1, and large
  primary values contrast against their block surface is at least 3:1, measured separately in the
  light appearance and the dark appearance.
- **SC-012**: The page loads no external font, stylesheet, or script from a third-party origin, and
  the project's declared dependency count remains zero.
- **SC-013**: The full automated suite passes, the test count is at most 12, and no test file was
  added, removed, or split by this feature.
- **SC-014**: The smallest rendered text anywhere on the page is at least `14px`, and every block
  title and primary value renders at `16px` or larger, with no text falling below the minimum in
  either the light or the dark appearance.

## Assumptions

- The board's visible language, currency formatting, and units are unchanged from the current page.
- Dark-mode support is retained as decided in Clarifications and is now covered by FR-016; the colour
  palette itself is not being redesigned, only extended with the new surfaces this feature adds.
- The weather city name is already part of the data the page receives, so showing it is a
  presentation change and does not require a new data source.
- The existing loading, data, and error states and their messages are reused; this feature restyles
  them and does not add a new state.
- Scope is limited to the board page. No new page, route, or navigation is introduced.
- The board remains a snapshot: no automatic refresh, no live updates, and no history.
