# Phase 0 Research: Fix the Frequent False Data-Source Timeout

Every NEEDS CLARIFICATION from the Technical Context is resolved below, together with the decisions
that the spec left to the plan. Each entry records what was chosen, why, and what was rejected.

## D1. The wait budget value: 15,000 ms, not 10,000 ms

**Decision**: `DEFAULT_TIMEOUT_MS = 15000` in `src/config.js`.

**Rationale**: The bug being fixed is a *false* timeout on healthy sources, so the bar for the new
value is "no false timeouts on an ordinary mobile connection", not "fail fast". Three free public
APIs are involved and the three requests are independent, so a single slow response must not be
punished. Each request pays a DNS lookup, a TCP connect, a TLS handshake, and the response itself;
on a throttled mobile link that chain is the dominant cost, and 2,500 ms is below what it needs.
15,000 ms leaves roughly a 5x margin over a typical sub-3-second cold response while still bounding
the page: the board resolves within about one budget because the requests run in parallel.

**Evidence available for lowering it**: SC-001 asks for 30 consecutive loads on a throttled mobile
connection with all three sources healthy, and SC-003 asks for the board to resolve within the budget
plus 1 second. If a measurement shows the slowest source's 95th percentile plus cold-handshake cost
sits under 10,000 ms, 10,000 ms is defensible and the plan may be amended. Absent that measurement,
10,000 ms would be a guess that risks reintroducing the reported bug, so the default stays 15,000 ms.

**Alternatives considered**:

- *10,000 ms now, revise later.* Rejected: it optimizes the number rather than the symptom, and the
  cost of being wrong is the exact bug this feature exists to remove.
- *A larger value such as 30,000 ms.* Rejected: a 30-second wait on a phone is indistinguishable
  from a hung page, which trades a false message for a false impression of breakage.
- *Different budgets per source.* Rejected by the user's clarification on 2026-09-30: one value for
  the whole product. It also contradicts SC-002, which requires exactly one authoritative number.

## D2. How the browser receives the single value

**Decision**: the server substitutes a **non-numeric token** into the text assets it serves, and
`src/public/app.js` parses that token. If the token was not substituted, the client applies **no**
deadline rather than a fallback number.

Mechanism, in outline: `src/public/app.js` holds the literal `"__BOARD_BUDGET_MS__"`. When
`src/server.js` serves an HTML or JavaScript asset it replaces that quoted literal with the quoted
configured value. The client does `Number.parseInt` on it and uses the result only when it is a
finite positive number, otherwise it passes no signal. The repository therefore contains no second
number: the unsubsituted form is a string that parses to `NaN`, not a hidden default.

**Rationale**: FR-001 permits exactly one authoritative value and SC-002 requires exactly one prose
statement, while FR-009 requires the browser to stop waiting on that same value. A hard-coded browser
constant is the obvious implementation and it is the one thing that must not happen: it would be the
fifth copy of the number and the first one that silently diverges. A token keeps a single source of
truth while still satisfying FR-009. Making the unsubstituted case mean "no deadline" is the safe
direction: the worst outcome is the current behavior, never a wrong deadline.

**Alternatives considered**:

- *Hard-code 15,000 ms in `src/public/app.js`.* Rejected: a second copy, violating FR-001 and SC-002.
- *Send the budget in the `/api/dashboard` response body.* Rejected: the client needs the value
  *while* waiting for that response, and adding a field would change the response contract that
  FR-010 freezes.
- *Send it as a response header.* Rejected: a document's own response headers are not readable by
  the script it loaded, so the client would need a second request to learn the value.
- *Substitute into `index.html` as a `<meta>` tag.* Rejected: equivalent mechanism, but it puts the
  value in the markup the layout specs own, and a meta tag is harder to keep out of the UI review's
  way than a token in a script.
- *Substitute only in `app.js`.* Rejected: a substitution rule that special-cases one filename is a
  rule that will be forgotten when a second file needs it. One rule applied to every served text
  asset cannot drift.

## D3. What counts as a real budget expiry

**Decision**: `isTimeoutCause` matches `name === "TimeoutError"` only. `AbortError` falls through to
`upstream_error`, which already exists in the vocabulary and already has a user-facing message.

**Rationale**: verified on the platform rather than assumed. Against a server that accepts a
connection and never answers, `fetch` with `signal: AbortSignal.timeout(120)` rejects with a
`DOMException` whose `name` is `TimeoutError`. Against the same server, a manual
`AbortController.abort()` rejects with `name === "AbortError"`, and a refused connection rejects with
`TypeError: fetch failed`. So `TimeoutError` is a positive signal that the budget elapsed, and
`AbortError` is a cancellation that says nothing about elapsed time. The current code treats both as
timeouts, which is precisely the over-reporting in the bug report. Narrowing the predicate is a
one-line change that adds no new code path, no new error code, and no new message, so SC-005's
"still 8 distinct messages" holds.

`AbortError` deliberately maps to `upstream_error` ("No se pudo consultar la fuente de datos.") rather
than to a new "cancelled" code: FR-007 freezes the vocabulary, and "we could not reach the source" is
an accurate description of a cancelled request from the visitor's point of view.

**Alternatives considered**:

- *Add a `cancelled` error code and message.* Rejected: it grows the visitor-visible message set,
  which FR-007 and SC-005 forbid, for a case a visitor cannot act on differently.
- *Keep `AbortError` as a timeout but only when the signal also reports expired.* Rejected: the abort
  signal's delay is not publicly readable, so this cannot be implemented without a private API, and
  it would still need a second code path.
- *Check the elapsed time with a clock.* Rejected: it needs a clock seam, a test double, and a
  tolerance, all to re-derive a fact the runtime already states in the error name. Principle II and
  the plan's constraints both point away from new seams.

## D4. Where the timeout applies and what it must cover

**Decision**: one 15,000-millisecond value, applied independently to each of the three parallel
source requests, covering the whole wait for that source's data.

**Rationale**: the value is passed as `signal: AbortSignal.timeout(timeoutMs)` on the `fetch` call
itself, so it covers the connection *and* the body read; a source that connects and then stalls
mid-body is still bounded, which is what FR-005 requires. The three requests already run under
`Promise.allSettled` in `src/dashboard/service.js:35-37`, so applying the budget per request rather
than as a shared pool keeps the worst-case wait at approximately one budget instead of three, which
is what the user's 2026-09-30 clarification chose.

**Alternatives considered**:

- *A board-wide deadline shared by the three sources.* Rejected: one slow source would consume the
  budget the two healthy sources have left, turning a single slow API into three failed cards. It also
  requires threading a deadline through the service, which FR-010's "no change to the service layer"
  and Principle I both argue against.
- *A separate connect timeout and a read timeout.* Rejected: that is two numbers, which FR-001
  forbids, and the single signal already covers both phases.
- *Bounding only the initial connection.* Rejected: it would let a stalled body hang forever, which
  is the case FR-005 names explicitly.

## D5. The configuration surface

**Decision**: `readTimeoutMs(env)` in `src/config.js`, reading the `TIMEOUT_MS` environment variable,
written to match the existing `readPort` and `readHost` helpers exactly. A value that is absent, not a
string, not a bare integer, or not strictly positive falls back to the 15,000-millisecond default.
`loadConfig()` keeps returning it under the existing `timeoutMs` key, so `src/server.js:84` and every
adapter signature stay untouched.

**Rationale**: FR-002 requires the budget to be overridable "through the project's existing
configuration surface, the same surface already used for the host and port", and this is literally
that surface: a reader per variable in `config.js`, with a default on malformed input. Reusing the
existing `timeoutMs` key means the wiring from `loadConfig` down to the three adapters requires no
edit at all, which is what keeps the change surface to configuration.

No upper bound is imposed. Inventing a maximum would add a second number to the product and would
have to be documented and tested, and the only realistic misuse is an operator choosing to wait
longer on purpose, which is a legitimate thing to allow for a local, single-user page.

**Alternatives considered**:

- *Hard-code 15,000 ms with no override.* Rejected: FR-002 requires the override, and it is the
  cheapest possible escape hatch for an operator whose sources are unusually slow.
- *A `--timeout` command-line flag.* Rejected: the project has no flag parsing today and adding it
  would be a new configuration surface, not the existing one.
- *A separate configuration file.* Rejected: a new file and a new parsing path for one duration, and
  it would break the "environment variables" convention the README already documents.
- *An upper bound such as 60,000 ms.* Rejected: a second documented number, for no benefit.

## D6. How the regression is verified without a new test

**Decision**: fold every new assertion into the three existing adapter-failure tests in
`tests/adapters.test.js`. Delete the local `const TIMEOUT_MS = 2500` at line 19 and import the single
constant from `src/config.js` instead. Suite stays at 8 tests in 2 files.

**Rationale**: FR-014 forbids a new test file *and* a new test case, and FR-015 requires the budget
assertion to live in those three tests. Those tests already build a failing-source scenario per
adapter, already assert the exact error code, and already assert `calls === 1` with the message "the
adapter must not retry" — so they are the closest allowed category, exactly as the user's 2026-09-30
answer chose. Four assertions are available there without any new test:

1. The single exported constant equals 15,000 — this is "the code uses the documented budget".
2. An adapter built with no `timeoutMs` argument still receives an abort signal on its fetch call,
   which proves the value is wired from configuration rather than ignored.
3. With a deliberately tiny budget, a fetch that never settles produces the `timeout` code — this is
   "the notice fires when the abort actually fires", and it costs milliseconds because the budget,
   not the clock, is what is under test.
4. A fetch that rejects with a non-timeout `AbortError` produces `upstream_error` and **not**
   `timeout` — this is the actual regression in the bug report, asserted without a real 15-second
   wait.

The `isTimeoutCause` narrowing is verified with a two-line local double inside the existing test, not
a new test file, consistent with the suite's existing "no shared helper, no test-double module" rule.

**Alternatives considered**:

- *A ninth test named "the code uses a 15s budget".* Rejected by the user's 2026-09-30 answer: it
  would sit outside the constitution's eight-category inventory and need a constitutional note.
- *Verifying the real 15-second expiry end to end.* Rejected: it would make the suite take 15 seconds
  and would depend on a live or hanging socket, which the constitution forbids.
- *Asserting against the served HTML for the number.* Rejected: that is the same class of
  source-text assertion Principle VIII forbids, just aimed at a script instead of a stylesheet.

## D7. Documentation supersession

**Decision**: update `README.md:113` to state 15,000 ms once, and record the supersession in
`specs/002-dashboard-data-policy/plan.md:27` and
`specs/002-dashboard-data-policy/contracts/source-adapters.md:11` rather than editing their history.

**Rationale**: FR-003 requires the documented number to equal the number the code uses, and the spec's
Assumptions require the plan to record that 2,500 ms is superseded rather than leave two contradictory
numbers in the Spec Kit artifacts. Rewriting the older feature's plan and contract in place would
falsify what that feature decided at the time; a supersession note preserves both facts and matches
how specs 002 and 003 already coexist. Spec 003 needs no edit: it never stated a duration.

**Alternatives considered**:

- *Editing the 002 artifacts in place to say 15,000 ms.* Rejected: it rewrites a completed feature's
  record instead of superseding it, and any reviewer comparing 002 against git history would see an
  unexplained change.
- *Documenting the budget in all three artifacts.* Rejected: three copies of one number is what
  created this bug; SC-002 requires one.
- *Leaving 002 untouched.* Rejected: two contradictory numbers would remain in the repository, which
  FR-003 forbids in the same spirit as SC-002.

## Resolved clarifications

No `NEEDS CLARIFICATION` markers remain in the Technical Context or in this plan. Every open item
from the specification and from the user's instructions is closed by D1 through D7.
