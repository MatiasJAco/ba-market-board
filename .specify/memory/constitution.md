<!--
Sync Impact Report
- Version change: unversioned scaffold → 1.0.0
- Modified principles: placeholder principles → seven named principles
- Added sections: Product and Security Constraints; Development Workflow and Quality Gates
- Removed sections: none
- Follow-up TODOs: none
-->

# BA Market Board Constitution

## Core Principles

### I. Small Webapp (NON-NEGOTIABLE)

The product MUST remain a small webapp with only the functionality defined by the current
specification, plan, and tasks. Do not add speculative features, services, or abstractions.
Keep the implementation as small as the requirements allow.

### II. Test-First (NON-NEGOTIABLE)

Write tests before implementation for every task. Tests MUST fail for the intended reason
before production code is written, and the implementation MUST pass the relevant tests before
the task is complete. Test behavior and user-visible outcomes, not implementation details.

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
- API failures MUST be visible, distinguishable from valid empty or zero data, and covered by
  tests for the affected state.

## Development Workflow and Quality Gates

- Follow the Spec Kit order: constitution, specification, clarification, plan, tasks, then
  implementation.
- Implement one task at a time. A tester MUST verify each task after implementation.
- Do not implement features that are absent from the current specification, plan, and tasks.
- Every review MUST check test coverage, the one-page constraint, phone readability, public
  free API usage, secret exclusion, and visible API failure handling.
- A task is not complete until its relevant tests pass and its quality-gate requirements are
  satisfied.

## Governance

This constitution is the project-wide source of truth for the principles above. Amendments
MUST document the reason, affected principles, migration or compatibility impact, required
constitution and test changes, and approval in the project workflow.

Use semantic versioning: increment MAJOR for removing or redefining a principle, MINOR for
adding a principle or materially expanding governance guidance, and PATCH for clarifications that
do not change governance meaning. Every amendment MUST update the version and amendment date.
Reviews and implementation work MUST verify compliance before completion.

**Version**: 1.0.0 | **Ratified**: 2026-09-25 | **Last Amended**: 2026-09-25
