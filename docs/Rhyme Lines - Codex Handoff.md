# Rhyme Lines — Coding-Agent Handoff

## Objective

Bring the existing Rhyme Lines repository to the approved release behavior without rebuilding working systems or introducing unrelated features.

Use `docs/Rhyme Lines - Product Requirements Document v2.1.md` as the product-behavior source of truth after approval.

## Implementation Boundaries

The coding agent must:

- Inspect the existing implementation and tests before editing.
- Reference applicable PRD requirement IDs in the task summary and final report.
- Preserve the content/overlay separation.
- Preserve stale-request and caret-protection logic.
- Preserve local-first behavior.
- Avoid broad refactors during behavior fixes.
- Keep PRs small and vertical.
- Never collect raw lyrics or document titles in analytics.
- Never send full documents to rhyme providers.
- Avoid accounts, cloud sync, collaboration, and unrelated roadmap work.
- Report skipped tests accurately and never claim browser verification when Playwright did not execute.

## Highest-Priority Requirements

1. **DOC-007, PER-005, STA-001:** Implement the true zero-document state.
2. **SID-001, SID-002:** Make first editor entry start with the sidebar collapsed while preserving later user preference.
3. **SET-002:** Repair and verify light theme.
4. **DSH-003:** Resolve the dashboard rhyme-density definition and test mismatch.
5. **EXP-002:** Add Markdown export.
6. **REL-005:** Establish a release-green validation pipeline and CI.
7. **ACC-001 through ACC-009:** Complete accessibility verification.
8. **SUG-004 and SUG-006:** Implement approved rhyme taxonomy and insertion behavior after the product decisions are confirmed.

## Critical Behaviors That Must Not Regress

- Plain-text extraction
- Stable line IDs
- Paste normalization
- Caret and selection preservation
- Undo behavior
- Autosave
- Existing local migrations
- Pinned and reordered document persistence
- Route and active-document synchronization
- Word syllable badges
- Line totals
- Overlay resize invalidation
- Rhyme underline rendering
- `focus` highlight default
- Stale request rejection
- Local rhyme database lookup
- Online fallback isolation
- Thesaurus cancellation and caching
- Keyboard shortcut guards
- TXT export

## Required Repository Inspection Before Changes

Inspect at minimum:

- `src/store/tabsStore.ts`
- `src/lib/persist/schema.ts`
- `src/lib/persist/migrations.ts`
- `src/lib/persist/storage.ts`
- `src/components/EditorLayout.tsx`
- `src/components/EditorShell.tsx`
- `src/components/Editor.tsx`
- Dashboard project creation and selection code
- Editor route handling
- Last-open project helpers
- Zero/blank editor rendering
- Theme provider and CSS tokens
- `src/lib/projects/analysis.ts`
- `tests/projects.analysis.test.ts`
- Export commands and utilities
- Rhyme filter schema and panel controls
- Suggestion insertion implementation
- Current Jest and Playwright configuration

## Testing Expectations

For every PR:

1. State the affected requirement IDs.
2. Describe current behavior.
3. Describe intended behavior.
4. Add a failing regression test before or with the fix.
5. Run targeted Jest tests.
6. Run the full Jest suite.
7. Run lint.
8. Run type checking.
9. Run the production build.
10. Run affected Playwright specs.
11. Report any skipped validation precisely.
12. Do not claim completion if required browser tests did not execute.

## Recommended PR Sequence

### PR 1 — Zero-document lifecycle

Scope:

- Permit empty document collections.
- Remove automatic replacement creation after final deletion.
- Update active-document typing and routing.
- Add the centered Create New empty state.
- Preserve empty state across refresh.
- Add unit, component, integration, and Playwright tests.

Primary requirements:

- DOC-007
- PER-005
- STA-001

### PR 2 — First-entry sidebar behavior

Scope:

- Distinguish no saved preference from an explicit expanded preference.
- Default first editor entry to collapsed.
- Preserve later user choice.
- Add browser coverage.

Primary requirements:

- SID-001
- SID-002

### PR 3 — Light-theme repair

Scope:

- Audit editor, dashboard, sidebar, panel, menu, dialog, badge, highlight, and focus tokens.
- Repair contrast and dark-only styling leaks.
- Add visual and Playwright coverage.
- Resolve GitHub issue #117 only after verification.

Primary requirements:

- SET-002
- ACC-005
- ACC-006

### PR 4 — Dashboard metric definition

Scope:

- Approve and document the rhyme-density formula.
- Update the implementation and deterministic fixture together.
- Confirm all dashboard analysis tests are green.

Primary requirement:

- DSH-003

### PR 5 — Markdown export

Scope:

- Reuse the plain-text serializer.
- Add format selection.
- Preserve exact lyric text.
- Add `.md` filename behavior and tests.

Primary requirements:

- EXP-002
- EXP-003

### PR 6 — CI release gate

Scope:

- Add a `typecheck` script.
- Add GitHub Actions.
- Build and validate the rhyme DB.
- Run lint, typecheck, Jest, build, and critical Playwright tests.
- Install Chromium in CI.
- Make required checks release-blocking.

Primary requirement:

- REL-005

### PR 7 — Rhyme terminology and insertion behavior

Start only after OQ-001 and OQ-002 in the PRD are approved.

Scope may include:

- Rename Near to Near/Slant, or add a third independent Slant category.
- Add persistence migration if the schema changes.
- Document and test insert-versus-replace behavior.
- Update UI, tests, README, and PRD references together.

Primary requirements:

- SUG-004
- SUG-006

## Final Report Format

At completion of each task, report:

- Objective
- Requirement IDs
- Current behavior found
- Root cause
- Files changed
- Behavior implemented
- Tests added or updated
- Commands run and results
- Known limitations
- Remaining risks
- Recommended next PR
