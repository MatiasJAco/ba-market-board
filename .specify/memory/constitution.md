<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0 (MAJOR)
- Reason: Principle II redefined. "Test-First" (TDD, tests-before-implementation, mandatory
  red-green ceremony) is replaced by "Right-Sized Tests" (hard cap of 12 automated tests for the
  whole app, fixed allowed inventory, explicit forbidden patterns). Redefining a non-negotiable
  principle requires MAJOR per the Governance section.
- Modified principles: II. Test-First → II. Right-Sized Tests (NON-NEGOTIABLE)
- Added sections: Testing Scope and Budget (within Core Principles, as Principle II)
- Unchanged principles: I, III, IV, V, VI, VII. Note: VII (Visible API Failures) keeps its
  user-visible requirement; only its *test* obligation is now bounded by Principle II.
- Removed sections: none (the TDD red-green obligation is removed, not relocated)
- Downstream artifacts requiring regeneration (not yet updated by this amendment):
  specs/002-dashboard-data-policy/tasks.md (T007-T018, T020-T026, T031-T050 mandate per-function
  and per-field test files and failing-first ceremony), specs/002-dashboard-data-policy/spec.md
  (FR-014, SC-005, SC-008 and line ~191 test-count language),
  specs/002-dashboard-data-policy/plan.md, specs/002-dashboard-data-policy/contracts/*,
  specs/002-dashboard-data-policy/checklists/requirements.md
- Migration impact: the existing suite has 150 passing tests across 8 files, all of which are
  outside the allowed inventory. They must be deleted or folded down to the budget. The 8
  prescribed tests target code that does not exist yet (src/sources/, src/api/, and the
  dashboard service are empty), so the suite cannot be rebuilt until the remaining tasks land.
- Follow-up TODOs: regenerate tasks.md/spec.md against Principle II before resuming implementation
-->

# BA Market Board Constitution

## Core Principles

### I. Small Webapp (NON-NEGOTIABLE)

The product MUST remain a small webapp with only the functionality defined by the current
specification, plan, and tasks. Do not add speculative features, services, or abstractions.
Keep the implementation as small as the requirements allow.

### II. Right-Sized Tests (NON-NEGOTIABLE)

This is a tiny one-page dashboard. The test suite is a **budgeted safety net, not a quality
scorecard**. Total suite size is a constitutional constraint.

**Hard cap**: the whole app MUST have **at most 12 automated tests**. A 13th test is a
constitutional violation even if it passes.

**Allowed tests** — only these categories may exist:

| # | Test | Purpose |
|---|------|---------|
| 1 | Smoke | The page renders three widgets |
| 2 | Weather adapter (happy path) | Mocked HTTP, valid response maps to a weather value |
| 3 | CEDEAR adapter (happy path) | Mocked HTTP, valid response maps to five CEDEAR quotes |
| 4 | FX adapter (happy path) | Mocked HTTP, valid response maps to a peso rate |
| 5 | Weather adapter (failure) | HTTP error / API failure yields a typed error result |
| 6 | CEDEAR adapter (failure) | HTTP error / API failure yields a typed error result |
| 7 | FX adapter (failure) | HTTP error / API failure yields a typed error result |
| 8 | Error state | A failed widget shows the visible error state |

Adapter tests MUST use mocked HTTP. Live network calls in tests are forbidden.

**Forbidden** — these MUST NOT exist, and existing ones MUST be deleted or folded into the
budget above:

- Contract-test folders (dedicated per-endpoint / per-contract test directories)
- Per-ticker tests (a test file or case per CEDEAR symbol)
- Snapshot forests (recorded DOM/snapshot fixtures asserted field by field)
- E2E for every field
- Coverage percentage targets or gates
- TDD red-green ceremony (tests MUST NOT be required to be written and observed to fail
  before implementation code exists)
- A test file per function (one file for a helper, a guard, a clock, a document double, a
  scheduler double, or a config loader is forbidden)

**Budget rules**: tests are folded into the closest allowed category rather than added.
A bug fix is verified inside the existing allowed test whenever that test can express the
regression. New tests require removing an equivalent number of existing ones to stay under
the cap. Unused test helpers, doubles, and fixtures MUST be deleted along with the tests
that needed them.

**What the suite is still for**: a change is not done until the whole suite passes
(`npm test` green) and the new behavior is either covered by an allowed test or consciously
accepted as uncovered. Principle VII's user-visible error requirement stands on its own and
is not weakened by the removal of the TDD ceremony.

### III. No API Secrets in Git (NON-NEGOTIABLE)

API keys, tokens, passwords, private credentials, and other secrets MUST NOT be committed to
the repository, source files, configuration files, logs, test fixtures, or documentation. If a
future integration requires a secret, keep it outside git and document only the variable name.

### IV. Public, Free APIs Only (NON-NEGOTIABLE)

External data sources MUST be public and free to use. Do not introduce paid, private,
authenticated, or usage-restricted APIs without an explicit constitution amendment.

### V. One Page (NON-NEGOTIABLE)

The product MUST be delivered as one simple page. Product functionality MUST NOT require
additional pages, routes, or a multi-step navigation flow unless this constitution is amended.

### VI. Readable on a Phone (NON-NEGOTIABLE)

The page MUST remain legible and usable on a phone-sized viewport. Text, controls, status
messages, and data MUST fit without relying on desktop-only interactions or horizontal scrolling.

### VII. Visible API Failures (NON-NEGOTIABLE)

If an API is unavailable, times out, returns an invalid response, or otherwise fails, the page
MUST display a clear, user-visible error state for that data. Do not silently show missing data,
false zero values, or an apparently healthy page.

## Product and Security Constraints

- The product scope is one page showing current Buenos Aires weather, the top 5 CEDEAR prices,
  and the Argentine peso versus USD rate. The current specification decides whether the
  exchange-rate value is official or blue.
- Use public, free APIs only and keep all API secrets out of git.
- API failures MUST be visible and distinguishable from valid empty or zero data.

## Development Workflow and Quality Gates

- Follow the Spec Kit order: constitution, specification, clarification, plan, tasks, then
  implementation.
- Implement one task at a time. A tester MUST verify each task after implementation.
- Do not implement features that are absent from the current specification, plan, and tasks.
- Every review MUST check the test budget (total count and the allowed inventory), the one-page
  constraint, phone readability, public free API usage, secret exclusion, and visible API
  failure handling.
- A task is not complete until the whole suite passes and the task's behavior is covered by an
  allowed test or consciously accepted as uncovered.
- Task lists MUST NOT mandate test files or test cases that Principle II forbids, and MUST NOT
  require a test to be written and observed to fail before implementation.
- Adding a helper module for testability is optional, not a reason to add a test. Prefer code
  that can be exercised from the eight allowed tests; do not build a test-seam architecture
  (document doubles, scheduler doubles, clock injection) that has no allowed test to justify it.

## Governance

This constitution is the project-wide source of truth for the principles above. Amendments
MUST document the reason, affected principles, migration or compatibility impact, required
constitution and test changes, and approval in the project workflow.

Use semantic versioning: increment MAJOR for removing or redefining a principle, MINOR for
adding a principle or materially expanding governance guidance, and PATCH for clarifications that
do not change governance meaning. Every amendment MUST update the version and amendment date.
Reviews and implementation work MUST verify compliance before completion.

**Version**: 2.0.0 | **Ratified**: 2026-09-25 | **Last Amended**: 2026-09-28
