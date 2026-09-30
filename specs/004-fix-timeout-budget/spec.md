# Feature Specification: Fix the Frequent False Data-Source Timeout

**Feature Branch**: `fix/upstream-timeout`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description:

> New bugfix feature only. Do not replace the board spec.
> Bug: frequent "La fuente de datos tardó demasiado en responder."
> Acceptance:
> - find the current timeout (server fetch and/or client)
> - set a single documented timeout, default 15s (or 10s if the plan justifies)
> - the same message only when the abort actually fires
> - other errors stay as they are
> Out of scope: UI, new sources, retries storm, extra widgets
> Test budget: 0 new files; at most 1 extra test that a 15s budget is what the code uses

## Scope boundary *(pre-resolved from existing artifacts)*

This is a **bugfix for the data-acquisition wait budget only**. It does not replace, reopen, or
re-specify the board. Three existing artifacts stay in force and are untouched except for the one
number this feature changes:

- [spec 002](../002-dashboard-data-policy/spec.md) remains the data-policy source of truth: the same
  three sources, the same three values, parallel requests, no retries, no caching, one request per
  page load, and the same typed-error vocabulary. This feature does not add, remove, reorder, or
  re-fetch anything.
- [spec 003](../003-board-ui-polish/spec.md) remains the presentation source of truth: the three
  cards, the one column, the loading, value, and error states. This feature changes no styling, no
  layout, and no copy **except** the conditions under which the existing timeout copy appears.
- The **only** pre-existing decision this feature amends is the wait budget itself. Spec 002's
  documentation records a 2,500-millisecond per-request timeout in its plan, its source-adapter
  contract, and the project README. That number is superseded by the single budget defined below.
  Everything else in those documents stands.

## Current behavior *(findings from the code, for the plan)*

Recorded here so the plan starts from facts rather than assumptions.

1. **There is exactly one wait budget today, and it lives on the server.** `src/config.js:5` defines
   `DEFAULT_TIMEOUT_MS = 2500`. `src/server.js:84-96` reads it and passes it to the dashboard
   service, which hands the same value to all three adapters
   (`src/dashboard/service.js:28-30`), which pass it to the shared fetch helper
   (`src/sources/open-meteo.js:79-85`, `src/sources/data912-cedears.js:77-83`,
   `src/sources/dolarapi-mep.js:40-46`). Every upstream request is bounded by
   `AbortSignal.timeout(timeoutMs)` at `src/lib/json-fetch.js:25`.
2. **The number is defined twice.** `src/lib/json-fetch.js:1` declares a *second, private*
   `DEFAULT_TIMEOUT_MS = 2500`, independent of the one in `src/config.js`. They agree today and can
   silently drift apart tomorrow. It is also written a third time in prose in the README
   (`README.md:113`: "Cada petición tiene un timeout de **2500 ms**").
3. **2,500 ms is below what these three free public APIs need on an ordinary mobile connection**, and
   the three run in parallel, so a single cold DNS plus TLS handshake plus response on a slow mobile
   link exceeds it. That is the frequency driver behind the bug report: the message is correct in
   isolation and wrong in practice, because the budget is unrealistically tight.
4. **The timeout message is not reserved for a real timeout.** `src/lib/json-fetch.js:14-16` treats
   *any* `AbortError` as a timeout, so a request cancelled for any other reason (a cancelled
   request, a shutdown, a body read interrupted for a cause other than the budget) is reported to
   the visitor as "La fuente de datos tardó demasiado en responder." even though the wait budget
   never expired. The message therefore over-promises what it knows.
5. **The browser has no wait budget at all.** `src/public/app.js:15-29` awaits the board response
   with no abort and no deadline. A response that never arrives leaves all three cards in the
   loading state indefinitely, which violates the constitutional promise that a failure is visible
   (Principle VII) as surely as a wrong message does.

## Clarifications

### Session 2026-09-30

- Q: The browser applies no wait budget today, so a response that never arrives leaves all three
  cards loading forever. Should the browser stop waiting on the same single budget, and if so which
  notice does the visitor see? → A: Yes. The browser stops waiting on the same single budget, and
  the visitor sees the **existing generic load-failure notice** ("No se pudo cargar el panel. Volvé
  a cargar la página para intentarlo de nuevo."), not the source-timeout notice. The timeout notice
  therefore keeps its narrow, honest meaning: a *source* blew its budget.
- Q: Principle II lists eight allowed test categories and requires a new test to be paid for by
  removing an equivalent existing one. Should the 15-second budget be asserted inside the existing
  adapter-failure tests, or should one dedicated budget test grow the suite from 8 to 9? → A: No new
  test. The budget is asserted inside the three existing adapter-failure tests, so the suite stays at
  8 tests, no test file is added, and no constitutional note is needed.
- Q: Where does the wait budget live, and is it one value or one per source? → A: **One value of
  15 seconds, owned by the server configuration, applied to each of the three source requests
  independently, with the browser reusing that same 15-second value.** The three sources keep being
  requested in parallel, so the board's worst-case wait is approximately one budget rather than
  three budgets added up. The browser does **not** get its own, longer deadline, so the product
  still contains exactly one number for this budget.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a board instead of a timeout notice (Priority: P1)

As an anonymous visitor on a phone, I open the board on an ordinary mobile connection and I get
weather, CEDEAR prices, and the dollar rate — not a "the data source took too long" notice,
because none of the three free public sources is actually being too slow.

**Why this priority**: This is the reported bug. A board that shows a timeout notice on a healthy
network is a board that looks broken, and the notice is the single most frequent thing visitors
see. Nothing else about the product matters until this is right.

**Independent Test**: Load the board repeatedly on a throttled mobile connection with all three
sources healthy and slow-but-within-budget, and verify that all three cards show values and that
the timeout notice appears zero times.

**Acceptance Scenarios**:

1. **Given** all three sources are healthy and each answers within the documented budget,
   **When** a visitor loads the board on a phone, **Then** all three cards show their values and
   none of them shows a timeout notice.
2. **Given** a source that is slow but answers before the budget expires, **When** the board
   renders, **Then** that card shows its real value and no card shows a timeout notice.
3. **Given** all three sources are healthy but slow, **When** the visitor waits, **Then** the page
   resolves on its own without the visitor reloading, and no card is left showing a timeout
   notice.

---

### User Story 2 - Trust the timeout notice (Priority: P1)

As an anonymous visitor, when I do see "La fuente de datos tardó demasiado en responder.", I know
it is true: the board genuinely gave up waiting after a stated amount of time, and it is not
covering up some other kind of failure.

**Why this priority**: An honest failure message is worth more than a fast wrong one. The current
build over-reports timeouts, so the message carries no information; fixing only the budget would
leave a message that still lies in the rarer cases.

**Independent Test**: Make one source exceed the budget and verify that exactly that card shows the
timeout notice; then cancel a request for a non-timeout reason and verify the notice does not
appear.

**Acceptance Scenarios**:

1. **Given** a source stops responding and the budget expires, **When** the card renders,
   **Then** that card shows exactly "La fuente de datos tardó demasiado en responder." and the
   other two cards are unaffected.
2. **Given** a request is cancelled or fails for a reason other than the budget expiring,
   **When** the card renders, **Then** it does **not** show the timeout notice and keeps its own
   existing failure message.
3. **Given** a source returns a non-success status, an unreadable body, a missing value, or a
   stale value, **When** the card renders, **Then** the message and code for that failure are
   byte-for-byte what they are today, and the timeout notice does not appear.

---

### User Story 3 - Always get an answer, never an endless spinner (Priority: P2)

As an anonymous visitor on a bad connection, I always end up looking at three resolved cards —
values or a real error — and I am never left staring at a loading state that never resolves. When
the board itself never answers, I am told plainly that the panel could not be loaded, which is a
different and more honest thing to be told than that a data source was too slow.

**Why this priority**: This is the constitutional failure-visibility promise, and it is currently
unguarded on the browser side. It is P2 only because it is rarer than the P1 frequency bug.

**Independent Test**: Make the board's own response never arrive, load the page, and verify the
cards leave the loading state within a bounded time and show the existing generic load-failure
notice rather than spinning forever.

**Acceptance Scenarios**:

1. **Given** the board's response never arrives, **When** the visitor loads the page, **Then**
   every card leaves the loading state within the documented wait budget plus a small allowance and
   shows the existing generic load-failure notice, not the source-timeout notice.
2. **Given** the board's response arrives after a long but finite delay and the sources answered
   within their budget, **When** the page renders, **Then** the visitor sees the real values
   instead of a failure state.
3. **Given** the board's own response failed for a reason other than waiting too long, **When** the
   page renders, **Then** the visitor sees the same generic load-failure notice, because the
   browser cannot tell the two apart and MUST NOT claim a source timeout it cannot prove.

---

### User Story 4 - Know what the wait budget is (Priority: P2)

As a maintainer of this one-page board, I can read the single wait budget the product uses, find it
documented in exactly one place, and change it in exactly one place without hunting for a second
copy of the number.

**Why this priority**: Two private copies of the same constant plus a third copy in prose is how a
"documented timeout" becomes a lie. The duplication is a direct cause of the class of bug being
fixed here.

**Independent Test**: Change the budget in one place, confirm the behavior and the documentation
both follow, and search the project for any second occurrence of a different number.

**Acceptance Scenarios**:

1. **Given** a maintainer looks for the wait budget, **When** they search the project, **Then**
   exactly one authoritative value and one prose statement of it exist, and no second number
   describes the same budget.
2. **Given** a maintainer changes the budget, **When** the board runs, **Then** every data request
   uses the new value and the documented value matches what the code uses.
3. **Given** the budget is left unset, **When** the board runs, **Then** it uses the documented
   default of 15 seconds.

### Edge Cases

- A source answers at 14.9 seconds with a valid body: the card shows the real value; the notice
  does not appear.
- A source sends headers quickly and then stalls mid-body: the budget still applies to the whole
  read, so the card shows the timeout notice rather than hanging.
- One source stalls past the budget while the other two are instant: exactly one card shows the
  timeout notice and the other two show values; the visit is not lost.
- All three sources stall past the budget: all three cards resolve at roughly the same moment, no
  card is left loading, and the page does not wait for a second round of requests.
- A request cancelled for a reason unrelated to the budget, including a cancelled client request
  and a server shutting down mid-request: the timeout notice does not appear.
- A non-success HTTP status, an unreadable body, a schema mismatch, a missing ticker, an unusable
  value, and a stale value: each keeps its existing code and message, unchanged.
- The budget set to an invalid or non-positive value: the board falls back to the documented
  default instead of failing or waiting forever.
- The budget raised above 15 seconds, or lowered to 10 seconds: the same single value governs every
  data request and the documentation follows it.
- The board response delayed by a slow upstream, but within budget: the page shows real values.
- Two visitors loading the page at the same time while one source is timing out: neither visitor
  sees an error they did not cause, and no additional requests are issued.
- The visitor reloads while a previous load is still waiting: the new load is not blocked or
  poisoned by the old one, and no retry storm is created.
- The browser's wait starts before the server's per-source wait begins, so in the narrow window
  where the board would have answered a fraction of a second after the browser stopped waiting, the
  visitor sees the generic load-failure notice. This is accepted rather than compensated, because
  compensating would require a second number and FR-001 permits only one.

## Requirements *(mandatory)*

### Functional requirements

- **FR-001**: The product MUST have exactly **one** wait budget for acquiring board data, with a
  single value of **15 seconds**. The authoritative value MUST be owned by the server configuration
  and MUST be stated in exactly one place in the code, MUST NOT be duplicated as a second private
  copy, and MUST default to **15,000 milliseconds**. It is one value for the whole product, not one
  per source and not one per layer.
- **FR-002**: The budget MUST be overridable through the project's existing configuration surface,
  the same surface already used for the host and port, so changing it requires no code edit; a
  missing, malformed, or out-of-range value MUST fall back to the 15,000-millisecond default.
- **FR-003**: The budget MUST be written down in the project documentation as a single statement,
  and the number in the documentation MUST be the number the code uses. No second document, code
  comment, or default parameter may state a different value for the same budget.
- **FR-004**: Each of the three source requests MUST be bounded by that one budget
  **independently** — the budget is applied per source, not as a single pool shared between them —
  and the three requests MUST continue to be issued in parallel as required by spec 002, so the
  board's worst-case wait is approximately one budget rather than three budgets added up.
- **FR-005**: The budget MUST cover the whole wait for a source's data, not only the initial
  connection, so a source that connects and then stalls is still bounded.
- **FR-006**: The message "La fuente de datos tardó demasiado en responder." MUST be shown **only**
  when the wait was actually cut short because the budget expired. A request that ends for any
  other reason MUST NOT be reported with that message.
- **FR-007**: Every other failure MUST keep its current error code and its current message text,
  byte for byte: unreachable or non-success source, unreadable response, unexpected response
  shape, missing selected value, unusable value, stale value, and unknown failure. The set of
  distinct failure messages a visitor can see MUST NOT grow, and the existing codes MUST NOT be
  renamed, merged, or removed.
- **FR-008**: A source that fails MUST continue to affect only its own card. The other two cards
  MUST keep showing their values, and a page MUST still resolve when some or all sources fail.
- **FR-009**: The page MUST always leave the loading state. The browser MUST stop waiting on the
  same single budget from FR-001 — no second, longer browser deadline — and when the board's own
  response has not arrived by then, every card MUST show the **existing generic load-failure
  notice** and MUST NOT show the source-timeout notice, because the browser has no evidence that any
  source exceeded its budget. This is a wait bound, not a user-interface change: no new state, no
  new copy, and no visual difference from the notice the page already shows.
- **FR-010**: The feature MUST NOT change the sources, the values shown, the request shapes, the
  validation rules, the error vocabulary, the parallel-request behavior, the one-request-per-load
  policy, or the visible layout and copy of spec 003, except for the conditions under which the
  existing timeout copy appears.
- **FR-011**: The feature MUST NOT add retries, retry budgets, backoff, request queuing, caching,
  polling, or any mechanism that issues additional upstream requests. One page load MUST continue to
  mean at most one request per source.
- **FR-012**: The feature MUST NOT introduce new runtime or build dependencies; the project's
  dependency set MUST stay empty.
- **FR-013**: The feature MUST NOT add a new page, route, widget, card, or data field.

### Test requirements

- **FR-014**: The feature MUST add **no new test files** and **no new test cases**. The suite stays
  at its current size of 8 tests. Verification MUST be folded into the existing tests: the three
  adapter-failure tests, the smoke test, and the error-state test.
- **FR-015**: The 15-second budget MUST be asserted inside the three existing adapter-failure tests
  that already exercise a failing source, so the number the code uses is verified without a new test
  and without removing an existing one. This is the cheapest category that can express the
  assertion, and it keeps the suite inside the constitution's allowed inventory with no amendment.
- **FR-016**: The total suite MUST stay at or below the constitutionally capped budget of 12 tests,
  and no test may assert against stylesheet source text or cite a Spec Kit artifact path.
- **FR-017**: The regression MUST be verifiable from the existing allowed tests: a source that
  exceeds the budget yields the timeout notice, and a non-timeout failure yields its own message and
  not the timeout notice.

### Out of scope *(explicitly excluded)*

- Any user-interface, layout, typography, colour, or copy change, including restyling the error
  box and changing the loading state.
- New, replacement, or additional data sources, and any new field on an existing source.
- Retries, retry budgets, backoff, circuit breakers, or any "retry storm" mitigation.
- Extra widgets, extra cards, extra rows, or extra comparisons such as an official-versus-blue rate.
- Caching, prefetching, background refresh, live updates, or historical data.
- A second page, route, or navigation flow.
- Changing the other failure messages, the error codes, or the data-policy decisions of spec 002.

### Key Entities

- **Wait budget**: the single maximum time the board is willing to wait for data, default 15 seconds,
  stated once in code and once in prose. One value for the whole product, owned by the server
  configuration and reused by the browser; applied independently to each of the three parallel
  source requests, so the worst-case board wait is about one budget.
- **Budget expiry**: the event where the wait budget actually elapses. Only this event may produce
  the timeout notice.
- **Failure kind**: the reason a data request ended — budget expiry, unreachable or non-success
  source, unreadable response, unexpected shape, missing selected value, unusable value, stale value,
  or unknown. Each kind maps to exactly one existing code and one existing message.
- **Card state**: the visible state of one of the three cards — loading, value, or error. The
  feature guarantees a card always leaves loading.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Over 30 consecutive board loads on a throttled mobile connection with all three
  sources healthy and answering within the budget, the timeout notice appears in **0 of 30** loads.
- **SC-002**: A search of the project finds exactly **one** authoritative wait-budget value and
  exactly **one** prose statement of it, and no other number is described as this budget.
- **SC-003**: With one source that never answers, that card shows the timeout notice, the other two
  cards show their values, and the page reaches a fully resolved state within the budget plus
  **1 second**.
- **SC-004**: Across every failure a visitor can observe other than budget expiry, the timeout notice
  appears **0 times**, and each such failure shows its pre-existing message unchanged.
- **SC-005**: The number of distinct failure messages a visitor can see is unchanged from today at
  **8**, and no existing error code is renamed, merged, or removed.
- **SC-006**: A load of the board issues at most **one** request per source, with no additional
  request caused by a timeout, a cancellation, or a reload.
- **SC-007**: The full automated suite passes, the test count is at most **12**, and this feature
  adds **no** test file and **no** test case.
- **SC-008**: The project's declared dependency count remains **0**.
- **SC-009**: In a 20-load check where the board's own response never arrives, every card leaves the
  loading state in **100%** of loads within the budget plus **1 second**, each showing the existing
  generic load-failure notice, compared with today's behavior of loading indefinitely. The
  source-timeout notice appears in **0 of 20** of those loads.

## Assumptions

- The three sources keep their current per-request shape and remain free, public, and
  unauthenticated; this feature changes only how long the board waits for them.
- The three sources are requested in parallel, so the worst-case wait is one budget, not three.
- A 15-second default is chosen over 10 seconds because the failure being fixed is a *false* timeout
  on healthy sources, and 10 seconds still leaves little headroom for a cold DNS lookup, a TLS
  handshake, and a slow mobile response from three free public APIs. The plan MAY lower the default
  to 10,000 milliseconds only if it records measured evidence — a percentile of real response times
  or a measured false-timeout rate — that 10 seconds is sufficient. Whatever value is chosen, it
  MUST be the single documented value required by FR-001 through FR-003.
- The board remains a snapshot: one request per source per page load, no automatic refresh, no
  live updates, no history.
- "The same message only when the abort actually fires" is read as: the timeout notice requires
  positive evidence that the budget expired, and no other reason may be reported as a timeout.
- The browser reuses the same single budget rather than a longer deadline of its own, so there is
  still exactly one number in the product. Because the browser's wait begins before the server's
  per-source wait, the browser bound is reached first and a source that would have answered just
  after it yields the generic load-failure notice. This trade is accepted to keep one documented
  value.
- The project documentation is the README, which currently states the old 2,500-millisecond value
  and is the prose that FR-003 updates.
- Spec 002's plan and source-adapter contract documents still state 2,500 milliseconds; this
  feature supersedes that number and the plan MUST record the supersession rather than leaving two
  contradictory numbers in the Spec Kit artifacts.
- Principle VII still governs: a failure is always visible and never silently rendered as empty or
  healthy data.
