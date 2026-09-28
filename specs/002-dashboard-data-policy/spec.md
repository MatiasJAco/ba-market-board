# Feature Specification: BA Market Dashboard Data Policy

**Feature Branch**: Not created by this command

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description:

> Resolve: official BNA peso vs blue/MEP; which 5 CEDEAR tickers;
> weather source; refresh on load only vs interval.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View a predictable dashboard snapshot (Priority: P1)

As an anonymous visitor, I open the dashboard and see one clearly labeled snapshot of Buenos Aires
weather, five selected CEDEAR prices, and one financial peso rate without waiting for background
updates or signing in.

**Why this priority**: A predictable snapshot is the core behavior that makes the dashboard easy
to scan and prevents changing values from being mistaken for live updates.

**Independent Test**: Load the page with valid responses for all three widgets, wait for the
initial states to settle, and verify that the three values and timestamps are visible and remain
unchanged until the page is reloaded.

**Acceptance Scenarios**:

1. **Given** the page is opened without an account, **When** the initial data requests complete,
   **Then** the page shows weather, the five fixed CEDEARs, and the MEP rate on one page.
2. **Given** all initial requests have completed, **When** time passes without a browser reload,
   **Then** no automatic interval refresh changes the displayed values.
3. **Given** the visitor reloads the page, **When** the new page load begins, **Then** each widget
   requests a fresh snapshot and displays its new result or a visible error state.

---

### User Story 2 - Check the selected Buenos Aires weather (Priority: P1)

As an anonymous visitor, I want current Buenos Aires weather from a consistent public source so I
can interpret the dashboard snapshot consistently.

**Why this priority**: Weather is a primary dashboard signal and the source choice removes
ambiguity about where the displayed conditions come from.

**Independent Test**: Provide a valid Open-Meteo current-weather response and verify the weather
widget shows Celsius temperature, condition, and source as-of time; provide a failed response
and verify a visible error state.

**Acceptance Scenarios**:

1. **Given** Open-Meteo returns current weather for Buenos Aires, **When** the page loads,
   **Then** the weather widget shows temperature in degrees Celsius, condition, and the source
   observation time.
2. **Given** the weather response is unavailable or incomplete, **When** the page loads, **Then**
   the weather widget shows a clear error and does not invent or reuse a weather value.

---

### User Story 3 - Review the five selected CEDEARs (Priority: P1)

As an anonymous visitor, I want a stable list of five familiar CEDEAR instruments so I can compare
prices without the list changing according to an undocumented ranking rule.

**Why this priority**: A fixed list is deterministic, easy to test, and avoids presenting a
changing selection as “top” instruments.

**Independent Test**: Provide valid local quotes for `AAPL`, `MSFT`, `GOOGL`, `META`, and `NVDA`
and verify that exactly those five appear in that order with local prices and a quote timestamp.

**Acceptance Scenarios**:

1. **Given** all five selected CEDEARs have valid local quotes, **When** the page loads, **Then**
   the widget shows exactly `AAPL`, `MSFT`, `GOOGL`, `META`, and `NVDA` in that order.
2. **Given** one selected CEDEAR has no valid quote, **When** the page loads, **Then** the CEDEAR
   widget shows a visible error state and does not substitute a different ticker or claim a
   complete five-item result.
3. **Given** the CEDEAR source is down, **When** the page loads, **Then** the other widgets remain
   usable and the CEDEAR widget identifies the failure visibly.

---

### User Story 4 - Check the MEP peso rate (Priority: P2)

As an anonymous visitor, I want one clearly labeled MEP/bolsa peso rate so I can compare the
financial dollar with the selected CEDEAR prices.

**Why this priority**: A single labeled financial rate avoids confusing official BNA, blue, and
MEP quotations while keeping the market snapshot focused.

**Independent Test**: Provide valid MEP buy and sell values and verify the widget displays their
midpoint as ARS per USD, labels it as MEP/bolsa, and shows its as-of time; provide a failure and
verify it does not fall back to another rate type.

**Acceptance Scenarios**:

1. **Given** a valid MEP/bolsa quotation is available, **When** the page loads, **Then** the
   widget shows the MEP midpoint in Argentine pesos per US dollar and labels the rate type.
2. **Given** the MEP source is unavailable or invalid, **When** the page loads, **Then** the
   widget shows a visible error and does not substitute the official BNA or blue rate.

---

### Edge Cases

- The visitor keeps the page open for an extended period; the displayed snapshot remains
  unchanged until a browser reload, and its timestamp makes the age visible.
- A source returns a value but no observation time; the widget displays a labeled retrieval time
  rather than presenting it as source time.
- A source returns a stale quote, malformed number, missing ticker, or incomplete MEP value.
- The source provides only MEP buy and sell values; the displayed midpoint is their average,
  rounded to two decimal places.
- The market is closed or quotes are delayed; the widget shows the quote's as-of time and does
  not label the value as live.
- One widget fails while the other two succeed; each widget must retain an independent state.
- The page is viewed at a narrow phone width or with a long source error message.
- The browser is offline at initial load; all three widgets show visible errors rather than blank
  regions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide weather, CEDEAR, and exchange-rate information on one page
  accessible without login, account creation, or authentication.
- **FR-002**: On each page load, the system MUST request one current snapshot for each widget and
  MUST show a loading, data, or error state for every widget.
- **FR-003**: The system MUST NOT poll or refresh any widget on a timer. A normal browser reload
  MUST start a new snapshot for all three widgets.
- **FR-004**: The weather source MUST be Open-Meteo, and the weather widget MUST show current
  Buenos Aires temperature in degrees Celsius, condition, and the source observation time.
- **FR-005**: The CEDEAR widget MUST use the fixed ordered list `AAPL`, `MSFT`, `GOOGL`, `META`,
  `NVDA` and MUST NOT dynamically rank or substitute tickers.
- **FR-006**: Each selected CEDEAR entry MUST show its ticker, company or instrument label, local
  price in Argentine pesos, and a quote timestamp.
- **FR-007**: The exchange-rate widget MUST show the MEP/bolsa midpoint as Argentine pesos per one
  US dollar, rounded to two decimal places, and MUST label the rate as MEP/bolsa.
- **FR-008**: The exchange-rate widget MUST NOT display the official BNA rate or the blue rate in
  place of MEP/bolsa, including when MEP data is unavailable.
- **FR-009**: Every widget MUST display an observation or quote timestamp. If a source omits that
  time, the widget MUST display a clearly labeled retrieval time instead.
- **FR-010**: Every widget MUST have a distinct, user-visible error state for unavailable,
  timed-out, malformed, incomplete, or stale responses; an error MUST NOT appear as zero, a false
  value, or an apparently successful result.
- **FR-011**: A widget failure MUST NOT prevent the other widgets from rendering valid data or
  their own errors.
- **FR-012**: The page MUST remain legible and usable on a phone-sized viewport without horizontal
  scrolling or desktop-only interaction.
- **FR-013**: The project MUST use public, free data sources only and MUST keep API secrets out of
  the repository.
- **FR-014**: The project MUST include automated tests for user-visible rendering and data-source
  adapter behavior, using mocked successful and failed responses, including fixed-ticker,
  MEP-rate, timestamp, and no-interval-refresh behavior. The suite MUST contain at most 12
  automated tests in total, MUST cover the failed-widget error state, and MUST NOT include
  per-ticker tests, dedicated contract-test suites, recorded snapshot fixtures, field-by-field
  end-to-end coverage, coverage-percentage targets, or one test file per function. A test MUST
  NOT be required to be written and observed to fail before the corresponding implementation
  exists.
- **FR-015**: The project MUST include a README that explains how to run the dashboard locally
  and how to run its automated tests.
- **FR-016**: The feature MUST exclude authentication, alerts, historical charts, trading
  actions, and any scope not listed in this specification.

### Key Entities

- **Weather observation**: Open-Meteo source, Buenos Aires location, Celsius temperature,
  condition, observation time, and retrieval time when needed.
- **CEDEAR quote**: fixed ticker, company or instrument label, local price in Argentine pesos,
  quote time, and validity state.
- **MEP exchange-rate quote**: MEP/bolsa buy value, sell value or midpoint, ARS-per-USD display
  value, observation time, and retrieval time when needed.
- **Widget state**: loading, valid data, or visible error; the displayed timestamp; and the
  snapshot load that produced the state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of initial page loads with valid or failed responses, all three widgets
  show a visible loading, data, or error state rather than a blank region.
- **SC-002**: In 100% of successful CEDEAR responses, the widget shows exactly the five fixed
  tickers in the order `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA`.
- **SC-003**: In 100% of successful MEP responses, the displayed value is the two-decimal MEP
  midpoint in ARS per USD and is labeled as MEP/bolsa.
- **SC-004**: After initial requests settle, 100% of observed page sessions show no automatic
  value changes before a browser reload.
- **SC-005**: In 100% of single-widget failure scenarios, the failed widget shows a clear error
  while the other two widgets retain valid data or their own independent states.
- **SC-006**: At a 320-pixel-wide phone viewport, all three widgets, values, timestamps, and error
  messages remain readable without horizontal scrolling.
- **SC-007**: Under a normal mobile connection, at least 95% of visits show the initial widget
  states within 3 seconds of opening the page.
- **SC-008**: The automated suite contains at most 12 tests, uses mocked responses only, covers
  rendering and adapter success/failure behavior including the four resolved policies, and all
  tests pass before release.
- **SC-009**: A developer starting from a clean checkout can follow the README to run the
  dashboard locally and execute the automated tests without undocumented setup steps.

## Assumptions

- The exchange-rate choice is the financial MEP/bolsa rate, represented by its midpoint; official
  BNA and blue rates are intentionally excluded from this version.
- The selected CEDEAR list is fixed, not volume-ranked, and its order is the order stated in
  FR-005. A missing selected ticker is an error rather than permission to replace it.
- Weather comes from Open-Meteo and represents current conditions, not a forecast or historical
  observation.
- Temperature is shown in Celsius and timestamps are shown in the user's local context with an
  explicit source or retrieval label.
- A page load is the only refresh trigger. There is no background interval, live stream, or
  automatic retry loop in this version.
- The test suite is deliberately small because the product is a tiny one-page dashboard. A test
  is added only by folding it into an existing one or by removing an equivalent number of
  existing tests, and behavior that no test covers is accepted consciously rather than closed
  with an extra test.
- The weather dependency is Open-Meteo; the CEDEAR and MEP widgets depend on public, free sources
  that provide the required fields, and a missing dependency produces a visible widget error.
- Data is not persisted as a historical series. The dashboard shows the current snapshot only.
- The target user is an anonymous visitor with a modern web browser and internet access; no login
  or account is required.
