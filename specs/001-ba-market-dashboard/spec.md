# Feature Specification: BA Market Dashboard

**Feature Branch**: Not created by this command

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description:

> Build a simple web dashboard that on load shows:
> 1) latest weather for Buenos Aires (temp, condition, as-of time)
> 2) prices for the top 5 CEDEARs (define ranking in the spec: volume or a fixed ticker list)
> 3) Argentine peso exchange rate vs USD
>
> Acceptance:
> - one page, no login
> - each widget has a timestamp and an error state
> - automated tests for rendering and for API adapters with mocked responses
> - README how to run locally
>
> Out of scope: auth, alerts, historical charts, trading.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View the market dashboard (Priority: P1)

As an anonymous visitor, I open one page and see a concise overview of Buenos Aires weather,
the top CEDEAR prices, and the Argentine peso exchange rate without creating an account.

**Why this priority**: A single overview is the core product value and is required before any
individual widget can be useful to a visitor.

**Independent Test**: Open the page with valid data for all three sources and verify that the
three widgets, their values, and their timestamps are visible in one view without a login flow.

**Acceptance Scenarios**:

1. **Given** all three data sources return valid current data, **When** the page loads,
   **Then** the page shows the weather, five CEDEAR prices, and the exchange rate with a
   timestamp in each widget.
2. **Given** one data source is unavailable, **When** the page loads, **Then** only that widget
   shows its visible error state while the other widgets continue to show available data.
3. **Given** a visitor has no account, **When** the visitor opens the page, **Then** all
   dashboard information is available without a login or account-creation step.

---

### User Story 2 - Check Buenos Aires weather (Priority: P1)

As an anonymous visitor, I want to see the latest Buenos Aires temperature and condition so I
can understand current local conditions at a glance.

**Why this priority**: Current local weather is a primary dashboard signal and should be
available independently of the market data widgets.

**Independent Test**: Supply a valid weather response and verify that the weather widget shows
temperature, condition, and the data's as-of time; supply a failed response and verify a clear
error state.

**Acceptance Scenarios**:

1. **Given** current Buenos Aires weather data is available, **When** the page loads, **Then**
   the weather widget shows the temperature in degrees Celsius, the condition, and the source
   as-of time.
2. **Given** the weather source times out or returns an invalid response, **When** the page
   loads, **Then** the weather widget shows a clear error message and does not display a false
   temperature or condition.

---

### User Story 3 - Review the top CEDEAR prices (Priority: P1)

As an anonymous visitor, I want to compare the five most actively traded CEDEAR prices so I can
scan the market leaders quickly.

**Why this priority**: The CEDEAR list is a primary market signal and defines the ranking that
makes “top 5” understandable and repeatable.

**Independent Test**: Provide CEDEAR quotes with volume data for more than five instruments and
verify that exactly five are listed in descending volume order with ticker, price in Argentine
pesos, and a widget timestamp.

**Acceptance Scenarios**:

1. **Given** at least five eligible CEDEARs have valid quotes and volume for the latest completed
   trading session, **When** the page loads, **Then** the widget lists exactly five CEDEARs,
   highest volume first, with each ticker and price visible.
2. **Given** fewer than five eligible CEDEARs have valid data, **When** the page loads, **Then**
   the widget shows all available entries and visibly explains that fewer than five were
   available.
3. **Given** volume or quote data is invalid, **When** the page loads, **Then** the widget shows
   a clear error state rather than an incomplete or misleading ranking.

---

### User Story 4 - Check the Argentine peso rate (Priority: P2)

As an anonymous visitor, I want to see the current Argentine peso value for one US dollar so I
can compare the local currency with the market information.

**Why this priority**: The exchange rate completes the requested dashboard and is valuable as a
standalone reference.

**Independent Test**: Supply a valid rate response and verify that the widget shows the official
rate as Argentine pesos per US dollar with its as-of time; supply a failed response and verify a
clear error state.

**Acceptance Scenarios**:

1. **Given** a valid exchange-rate response is available, **When** the page loads, **Then** the
   widget shows the official ARS-per-USD rate and the data's as-of time.
2. **Given** the exchange-rate source is unavailable or invalid, **When** the page loads,
   **Then** the widget shows a clear error message and does not display a stale or invented rate.

---

### Edge Cases

- A data source is down, times out, returns malformed data, or omits a required value.
- One widget fails while the other two succeed; widgets must fail independently.
- A source does not provide an as-of time; the widget must identify a retrieval time instead of
  presenting it as source data.
- The latest completed CEDEAR session has fewer than five eligible instruments.
- Two CEDEARs have equal volume; the displayed order must be stable and explicitly documented.
- The page is viewed at a narrow phone width, with long conditions, company labels, or error
  messages.
- The market is closed or there is no completed session; the widget must either use the latest
  available completed-session data or show its defined error state, never imply live data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide the weather, CEDEAR, and exchange-rate information on one
  page accessible without login, account creation, or authentication.
- **FR-002**: On initial page load, the system MUST attempt to obtain current data for all three
  widgets and MUST show a loading, data, or error state for each widget.
- **FR-003**: The weather widget MUST show Buenos Aires temperature in degrees Celsius, condition,
  and an as-of timestamp from the weather data.
- **FR-004**: The CEDEAR widget MUST rank eligible CEDEARs by descending reported trading volume
  for the latest completed trading session and MUST show the first five when at least five are
  available.
- **FR-005**: Each displayed CEDEAR entry MUST show its ticker, company or instrument label, and
  price in Argentine pesos; the widget MUST show the ranking session timestamp.
- **FR-006**: The exchange-rate widget MUST show the official Argentine peso rate for one US
  dollar, expressed as ARS per USD, with an as-of timestamp.
- **FR-007**: Every widget MUST display a timestamp that describes when its displayed data was
  observed; a retrieval time MUST be labeled as such when a source omits an observation time.
- **FR-008**: Every widget MUST have a distinct, user-visible error state for unavailable,
  timed-out, malformed, or incomplete responses, and an error MUST NOT be represented as zero,
  an empty successful result, or stale data.
- **FR-009**: A widget failure MUST NOT prevent independent widgets from rendering valid data.
- **FR-010**: The page MUST remain legible and usable on a phone-sized viewport without requiring
  horizontal scrolling or desktop-only interaction.
- **FR-011**: The project MUST use public, free data sources only and MUST keep API secrets out of
  the repository.
- **FR-012**: The project MUST include automated tests for user-visible rendering and for data
  adapter behavior, using mocked responses for successful and failed requests.
- **FR-013**: The project MUST include a README that explains how to run the dashboard locally
  and how to run its automated tests.
- **FR-014**: The feature MUST exclude authentication, alerts, historical charts, trading actions,
  and any other scope not listed in this specification.

### Key Entities

- **Weather snapshot**: Buenos Aires, temperature in Celsius, condition, observation time, and
  retrieval time when needed.
- **CEDEAR quote**: ticker, company or instrument label, price in Argentine pesos, trading
  volume, and trading-session time.
- **Exchange-rate quote**: official ARS-per-USD value, observation time, and retrieval time when
  needed.
- **Widget state**: the data or visible error associated with one widget, its displayed
  timestamp, and its loading or readiness status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of initial page loads with valid or failed source responses, all three
  widgets show a visible loading, data, or error state rather than a blank region.
- **SC-002**: When at least five CEDEARs have valid volume data, 100% of displayed lists contain
  exactly five entries ordered from highest to lowest volume.
- **SC-003**: In mocked and integration checks, 100% of single-widget failures leave the other
  two widgets able to show their valid results and show a clear error in the failed widget.
- **SC-004**: At a 320-pixel-wide phone viewport, all three widgets, values, timestamps, and
  error messages remain readable without horizontal scrolling.
- **SC-005**: Under a normal mobile connection, at least 95% of visits show the initial widget
  states within 3 seconds of opening the page.
- **SC-006**: In a check with at least five representative visitors, at least four can locate
  all three requested values and their timestamps on their first attempt.
- **SC-007**: The automated test suite covers rendering and data-adapter success and failure
  behavior with mocked responses, and all tests pass before the feature is released.
- **SC-008**: A developer starting from a clean checkout can follow the README to run the
  dashboard locally and execute the automated tests without undocumented setup steps.

## Assumptions

- The target user is an anonymous visitor with a modern web browser and an internet connection;
  no account or login is required.
- Temperature is shown in degrees Celsius.
- The exchange-rate widget uses the official ARS-per-USD rate. The blue rate is not included in
  this version.
- CEDEAR ranking uses reported volume from the latest completed trading session, not intraday
  volume. If volumes tie, entries are ordered alphabetically by ticker to keep the list stable.
- A source's observation time is preferred. If it is unavailable, the widget shows and labels the
  retrieval time.
- If fewer than five eligible CEDEARs have valid data, the page shows the available entries and
  a visible explanation rather than padding the list with unknown instruments.
- Data is read for the current dashboard view; historical storage and historical charts are not
  part of this feature.
- All data sources are public and free to use, and no API secret is stored in the repository.
