# Rhyme Lines Repository Technical Audit

**Date:** 2026-07-01  
**Repository:** `/workspace/rhyme-lines`  
**Branch audited:** `work`  
**Audit type:** Full repository technical/product/QA audit  

---

## Executive Summary

Rhyme Lines is a substantial Next.js/React lyric editor implementation with many MVP pieces already present: App Router pages, a dashboard/workspace, a contenteditable editor, line and word syllable analysis, overlay measurement, rhyme decorations, a rhyme suggestions panel backed by a local rhyme database worker with provider fallback logic, local-first draft persistence, autosave, settings persistence, themes, command palette, keyboard shortcuts, TXT export, Jest tests, and Playwright E2E specs.

The repository is **not currently release-green** because `npm test -- --runInBand` fails in 3 suites / 5 tests. The failures are concentrated in rhyme highlight defaults/settings UI and dashboard project analysis metrics. The source currently sets `DEFAULT_HIGHLIGHT_MODE` to `'focus'`, while tests expect `'all'` for new users and invalid/partial persisted settings. Project analysis also returns a rhyme density different from the deterministic fixture expectation.

The build succeeds, and TypeScript is checked during `next build`; however, there is **no standalone `typecheck` script**, so `npm run typecheck` fails as a missing script. Lint passes with warnings, including React hook dependency warnings and unused debug/no-console disables. Test output also shows production-risk console noise in test runs from debug logging in rhyme suggestions and analysis code.

MVP readiness is **7/10**: the core product exists and builds, but failing tests, missing CI workflow evidence, default-settings inconsistency, debug logging, and unverified E2E status should be addressed before public MVP release.

---

## Repository Snapshot

- **Current branch inspected:** `work`.
- **Package manager:** npm, evidenced by `package-lock.json` and npm scripts.
- **Framework:** Next.js App Router.
- **Key routes found:** `/`, `/editor`, `/editor/[id]`, `/api/save`, `/api/wordnik`, `/dev/rhyme-worker-smoke`.
- **Test stack:** Jest, React Testing Library, and Playwright.
- **TypeScript:** `strict: true`, `noEmit: true`; tests are excluded from `tsconfig.json`.
- **CI/CD:** No `.github` workflow files were found from repository inspection.
- **Issue/PR metadata:** Unknown from repository evidence. Recent commit messages reference PR numbers, but issue/PR discussions were not available locally.

---

## 1. Completed Work Summary

### Feature: App Structure and Routing

**Status:** Mostly complete / operational with limitations

**Evidence:**
- `src/app/page.tsx`
- `src/app/editor/page.tsx`
- `src/app/editor/[id]/page.tsx`
- `src/app/api/save/route.ts`
- `src/app/api/wordnik/route.ts`

**Technical Summary:**
The root route renders the workspace/dashboard shell. `/editor` renders an editor redirect component, while `/editor/[id]` resolves route params and renders `EditorLayout` for the selected project ID. API routes exist for a placeholder save endpoint and a Wordnik proxy.

**Verification:**
`npm run build` succeeded and reported app routes for `/`, `/api/save`, `/api/wordnik`, `/dev/rhyme-worker-smoke`, `/editor`, and `/editor/[id]`.

**Limitations:**
The `/api/save` route accepts payloads and returns success, but actual draft persistence is localStorage-based rather than server-backed.

---

### Feature: Dashboard / Workspace Shell

**Status:** Implemented but not fully verified in this audit

**Evidence:**
- `src/app/page.tsx`
- `src/components/dashboard/dashboard-shell.tsx`
- `tests/dashboard-shell.spec.tsx`
- `tests/dashboard-topbar.spec.tsx`

**Technical Summary:**
The root page delegates to `DashboardShell`, making the dashboard the launchpad route. Dashboard components exist for hero, sidebar, topbar, manuscript list, current focus card, analysis card, and footer.

**Verification:**
Dashboard-related Jest tests passed during the full test run. The build also prerendered `/`.

**Limitations:**
One project-analysis test fails, so dashboard analysis metrics cannot be treated as release-verified.

---

### Feature: Distraction-Free Lyric Editor

**Status:** Mostly complete / operational with limitations

**Evidence:**
- `src/components/Editor.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/EditorShell.tsx`
- `src/editor/input/useEditorInput.ts`
- `src/editor/selection/useEditorSelection.ts`
- `tests/editor.spec.tsx`
- `e2e/editor-typing-regression.spec.ts`
- `e2e/editor-caret.spec.ts`

**Technical Summary:**
The editor is a client component with refs for editor DOM, overlay, text column, container, line elements, and analysis lines. It keeps local editor state for lines, overlays, active line, hovered line, line version, focus, empty state, and active rhyme family. `EditorLayout` wraps the editor in a full-height shell with a top bar, collapsible document sidebar, and main editor surface.

**Verification:**
Editor unit tests passed during Jest except unrelated failing suites. Build succeeded. E2E specs exist for typing regression, caret, paste placeholder, windowing, line totals, and refactor regression, but Playwright E2E was not run in this audit.

**Limitations:**
The editor file has lint warnings around hook dependencies and unused variables. These are maintenance risks, especially in core lifecycle code.

---

### Feature: Word-Level Syllable Counts

**Status:** Implemented and covered by tests, but full suite currently not green

**Evidence:**
- `src/lib/analysis/compute.ts`
- `src/lib/analysis/tokenize.ts`
- `src/lib/analysis/normalizeTokenForSyllables.ts`
- `src/lib/nlp/syllables.ts`
- `tests/syllables.spec.ts`
- `tests/analysis.spec.ts`
- `tests/normalizeTokenForSyllables.spec.ts`

**Technical Summary:**
`computeAnalysis` tokenizes each line, normalizes tokens for pronunciation/syllable analysis, computes syllables per token, stores word-level syllable spans per line, and stores line totals as a sum of the same token syllable array.

**Verification:**
Syllable and analysis tests passed during the Jest run. Build succeeded.

**Limitations:**
Accuracy depends on tokenizer, normalization, pronunciation data, and syllable heuristics.

---

### Feature: Line-Level Syllable Totals

**Status:** Implemented and covered by tests

**Evidence:**
- `src/lib/analysis/compute.ts`
- `src/components/editor/overlays/LineTotalsOverlay.tsx`
- `tests/lineTotals.spec.ts`
- `tests/lineTotalsOverlay.spec.tsx`
- `e2e/line-totals.spec.ts`

**Technical Summary:**
Line totals are calculated by summing canonical word syllables for each line. `LineTotalsOverlay` renders a gutter mirror with one row per line.

**Verification:**
Line totals unit/component tests passed during the Jest run. E2E coverage exists but was not run in this audit.

**Limitations:**
The gutter mirror can still be vulnerable to alignment regressions on font/layout changes.

---

### Feature: Overlay Renderer and Measurement

**Status:** Mostly complete / operational with performance-conscious architecture

**Evidence:**
- `src/hooks/useOverlayMeasurement.ts`
- `src/components/editor/SyllableOverlay.tsx`
- `src/hooks/useRhymeDecorationOverlay.ts`
- `src/components/editor/RhymeDecorationOverlay.tsx`
- `src/editor/virtualization/computeVisibleLineRange.ts`

**Technical Summary:**
Syllable overlay measurement is separated from editor input. The measurement hook uses analysis output, visible line IDs, layout keys, and geometry caching to calculate badge positions using DOM ranges. Rhyme decorations use a separate hook that measures decorated token ranges only for visible lines.

**Verification:**
Overlay and editor-visible-range tests passed. Build succeeded.

**Limitations:**
Alignment still depends on exact text-node offsets, layout, font metrics, and line wrapping.

---

### Feature: Background Syllable Analysis Worker

**Status:** Implemented with fallback

**Evidence:**
- `src/hooks/useAnalysisWorker.ts`
- `src/workers/analysis.worker.ts`
- `src/workers/createAnalysisWorker.ts`
- `src/workers/createAnalysisWorker.mock.ts`

**Technical Summary:**
The editor schedules analysis through `useAnalysisWorker`. It debounces typing requests at 250ms and caret requests at 50ms, creates a worker when available, ignores stale responses by sequence number, and falls back to in-process `computeAnalysis` when worker creation or messaging fails.

**Verification:**
Analysis tests passed, and build succeeded.

**Limitations:**
Lint warns about cleanup and unused error variables in the worker hook.

---

### Feature: Real-Time Rhyme Suggestions

**Status:** Mostly complete / operational with limitations

**Evidence:**
- `src/components/RhymePanel.tsx`
- `src/components/rhyme/RhymeSuggestionsPanel.tsx`
- `src/lib/rhyme-db/useRhymeSuggestions.ts`
- `src/workers/rhymeWorker.ts`
- `src/lib/rhyme-db/queryRhymes.ts`
- `tests/rhymePipeline.test.ts`
- `tests/rhymeSource.test.ts`
- `tests/rhymeDbCaseInsensitive.test.ts`
- `src/lib/rhyme-db/useRhymeSuggestions.test.tsx`

**Technical Summary:**
`RhymePanel` reads editor text, caret index, current line text, active line rect, and editor lane rect from the DOM, then passes that snapshot into `RhymeSuggestionsPanel`. `useRhymeSuggestions` computes caret and line-last rhyme targets, tracks request lifecycle, aborts online requests on target changes, clears timers, and handles enabled/idle/loading phases.

**Verification:**
Rhyme pipeline, source, DB case-insensitivity, local provider, and hook tests passed. Build succeeded.

**Limitations:**
The README advertises “perfect, slant, near,” but the local query mode type currently supports only perfect/near naming, not a first-class local `slant` mode.

---

### Feature: Rhyme Highlighting / Decorations

**Status:** Implemented but currently not fully verified due failing default-setting tests

**Evidence:**
- `src/lib/rhyme/rhymeDecorations.ts`
- `src/components/editor/RhymeDecorationOverlay.tsx`
- `src/hooks/useRhymeDecorationOverlay.ts`
- `src/lib/settings/rhymeHighlightSettings.ts`
- `src/store/rhymeHighlightSettingsStore.ts`
- `src/lib/rhyme/__tests__/rhymeDecorations.test.ts`
- `tests/rhymeHighlightSettingsStore.test.ts`
- `tests/settingsSheetRhymeHighlights.spec.tsx`

**Technical Summary:**
Rhyme decorations tokenize lines, resolve pronunciations, compute rhyme family keys, filter stopwords unless enabled, identify end words, compute family IDs only for repeated rhyme keys, and return a snapshot for overlay rendering. The overlay renders highlight and underline spans for tokens that pass the selected mode and active-family logic.

**Verification:**
Rhyme decoration tests passed, but rhyme highlight settings tests failed due default mode mismatch.

**Limitations:**
Default mode behavior is inconsistent between implementation and tests.

---

### Feature: Perfect / Near Rhyme Filtering

**Status:** Implemented for local rhyme DB; slant is not clearly first-class locally

**Evidence:**
- `src/lib/rhyme-db/queryRhymes.ts`
- `src/lib/rhyme-db/useRhymeSuggestions.ts`
- `src/lib/persist/schema.ts`
- `src/app/api/wordnik/route.ts`

**Technical Summary:**
The persisted rhyme filters schema has `perfect` and `near` booleans, defaulting both to true. The local query layer normalizes modes to `perfect | near`. The Wordnik proxy accepts `perfect | slant`, but that is external-provider-specific.

**Verification:**
Rhyme DB and suggestion tests passed, but the full test command still fails elsewhere.

**Limitations:**
No repository evidence shows a local persisted `slant` filter alongside perfect/near.

---

### Feature: Caret / Cursor Targeting Behavior

**Status:** Implemented with tests, but still high-risk

**Evidence:**
- `src/components/RhymePanel.tsx`
- `src/lib/rhyme/rhymeDecorations.ts`
- `src/lib/editor/plainText.ts`
- `tests/editor-selection-hooks.test.ts`
- `e2e/editor-caret.spec.ts`

**Technical Summary:**
The rhyme panel computes a plain text caret index from the current selection, resolves the current line element by walking up from `focusNode`, and falls back to the last line if no current line is found. Active rhyme family resolution chooses a token containing the caret, boundary-matching token, nearest end token, or nearest-left token.

**Verification:**
Selection-related unit tests passed. E2E caret coverage exists but was not run in this audit.

**Limitations:**
This depends on DOM selection APIs, contenteditable structure, and text-node offsets.

---

### Feature: Autosave and Local-First Draft Persistence

**Status:** Mostly complete / operational with limitations

**Evidence:**
- `src/hooks/useAutosave.ts`
- `src/store/autosaveStore.ts`
- `src/store/tabsStore.ts`
- `src/lib/persist/storage.ts`
- `src/lib/persist/schema.ts`
- `src/lib/persist/migrations.ts`
- `src/hooks/__tests__/useAutosave.test.ts`
- `tests/projects.storage.test.ts`
- `tests/persist.migrations.test.ts`

**Technical Summary:**
Tabs are converted to versioned draft collections and persisted to localStorage. `tabsStore` converts draft lines into tab snapshots and preserves previous line IDs where possible. It subscribes to state changes and writes debounced drafts after 250ms on the client. `useAutosave` maintains autosave revision state, builds the current draft collection, writes via `tryWriteVersioned('drafts', payload)`, tracks success/failure events, and exposes a debounced `markTextChanged`.

**Verification:**
Autosave hook, storage, and migration tests passed. Build succeeded.

**Limitations:**
Server-side `/api/save` is not integrated into actual persistence. LocalStorage can fail due quota/security exceptions; quota UX should be tested.

---

### Feature: Theme System / Dark Mode

**Status:** Implemented

**Evidence:**
- `src/store/settingsStore.ts`
- `src/lib/persist/schema.ts`
- `src/app/globals.css`
- `src/components/TopBarActions.tsx`
- `tests/theme-root.spec.ts`

**Technical Summary:**
The settings schema supports `theme: 'dark' | 'light' | 'system'`, defaulting to dark. `TopBarActions` toggles between dark/light, persists the setting, updates `next-themes`, tracks an event, and announces the change. Global CSS defines shell/editor colors for dark and light body classes.

**Verification:**
Theme tests passed and build succeeded.

**Limitations:**
The toggle code flips dark/light; although the schema supports `system`, the visible shortcut does not cycle system mode.

---

### Feature: Command Palette

**Status:** Implemented and covered by tests

**Evidence:**
- `src/components/CommandPalette.tsx`
- `src/components/TopBarActions.tsx`
- `src/components/CommandPalette.test.tsx`

**Technical Summary:**
The command palette uses Radix Dialog, a combobox input, listbox options, keyboard navigation for Escape/ArrowUp/ArrowDown/Enter, active descendant attributes, and focus-visible styling. `TopBarActions` opens it via Ctrl/Cmd+K and populates commands for new draft, workspace, theme, export, settings, rhyme panel, density mode, and draft switching.

**Verification:**
Command palette tests passed.

**Limitations:**
It uses a Dialog/modal primitive. A command palette is acceptable for this product direction, but accessibility should continue to be tested.

---

### Feature: Keyboard Shortcuts

**Status:** Implemented and covered by tests

**Evidence:**
- `src/components/TopBarActions.tsx`
- `src/lib/shortcuts/keyboard.ts`
- `src/lib/editor/shortcuts.ts`
- `src/lib/shortcuts/keyboard.test.ts`
- `tests/shortcuts.spec.ts`
- `tests/topBarActions.shortcuts.spec.tsx`

**Technical Summary:**
Global shortcuts include Ctrl/Cmd+K for palette, Ctrl/Cmd+J for theme, Ctrl/Cmd+S for export, Ctrl/Cmd+N for new tab, and Ctrl/Cmd+B for workspace navigation. The handler ignores editable targets. The document sidebar also supports Ctrl/Cmd+Backquote to collapse/expand.

**Verification:**
Shortcut tests passed.

**Limitations:**
Test output showed a React warning about `whileTap` being passed to a DOM element in `TopBarActions` tests, indicating mock/framer-motion handling or prop forwarding needs cleanup before stricter CI console policies.

---

### Feature: Export to TXT

**Status:** Implemented for TXT; Markdown export not implemented from repository evidence

**Evidence:**
- `src/components/TopBarActions.tsx`

**Technical Summary:**
`exportDraft` creates a `text/plain;charset=utf-8` Blob from the active tab snapshot, creates an object URL, clicks an anchor, downloads `${safeTitle}.txt`, revokes the URL, tracks events, and announces export completion. The command palette exposes “Export Draft” as `.txt`.

**Verification:**
Top bar/shortcut tests passed.

**Limitations:**
The requested MVP scope includes TXT/Markdown, but repository evidence only shows TXT export.

---

### Feature: Settings Persistence

**Status:** Implemented with some failing behavior around rhyme-highlight defaults

**Evidence:**
- `src/store/settingsStore.ts`
- `src/store/rhymeHighlightSettingsStore.ts`
- `src/lib/settings/rhymeHighlightSettings.ts`
- `src/lib/persist/schema.ts`
- `tests/settingsStore.test.ts`
- `tests/rhymeHighlightSettingsStore.test.ts`

**Technical Summary:**
General settings are persisted through `writeVersioned('settings', payload)` with a 250ms debounce. Rhyme highlight settings use a dedicated localStorage key and sanitize persisted partials/invalid values. The rhyme highlight store hydrates those values and persists on setter calls.

**Verification:**
General settings tests passed. Rhyme highlight settings tests failed due default mode mismatch.

**Limitations:**
The settings model has overlapping concepts in general settings and dedicated rhyme highlight settings, increasing drift risk.

---

## 2. Remaining Work and Identified Gaps

### Gap: Jest Suite Fails on Rhyme Highlight Default Mode

**Severity:** High  
**Category:** Bug / Testing  
**Files Involved:**
- `src/lib/persist/schema.ts`
- `src/lib/settings/rhymeHighlightSettings.ts`
- `src/store/rhymeHighlightSettingsStore.ts`
- `tests/rhymeHighlightSettingsStore.test.ts`
- `tests/settingsSheetRhymeHighlights.spec.tsx`

**Evidence:**
The schema sets `DEFAULT_HIGHLIGHT_MODE` to `'focus'`. Tests expect new users, invalid persisted mode, and partial persisted settings to default to `'all'`. The settings sheet test also expects “All” to be `aria-pressed="true"` for a new user.

**Problem:**
Implementation and tests disagree on the default highlight mode.

**Impact:**
Users may get a more restrictive `focus` highlighting experience than intended by tests, or tests may be stale. Either way, release confidence is blocked because Jest exits non-zero.

**Recommended Fix:**
Decide product default. If `'all'`, change `DEFAULT_HIGHLIGHT_MODE` to `'all'`. If `'focus'`, update tests and labels to reflect the intentional calmer default. Do not leave mismatch.

**Complexity:** Small

**Dependencies / Blockers:**
Product decision: default highlight mode should be `all` or `focus`.

---

### Gap: Project Analysis Rhyme Density Regression or Stale Fixture

**Severity:** Medium  
**Category:** Bug / Testing  
**Files Involved:**
- `src/lib/projects/analysis.ts`
- `tests/projects.analysis.test.ts`
- `src/lib/rhyme/rhymeDecorations.ts`

**Evidence:**
The deterministic fixture expects `rhymeDensity` close to `0.5`; the current test run received `1`.

**Problem:**
Either the metric algorithm changed and the fixture is stale, or the metric now overstates rhyme density.

**Impact:**
Dashboard/project analytics can mislead users about rhyme density, and the test suite fails.

**Recommended Fix:**
Add explicit expected intermediate assertions for `endFamilies`, `endFamilyCounts`, and `repeatedLineEndings`; decide whether density should represent repeated-line-ending coverage or normalized family diversity. Update algorithm or fixture accordingly.

**Complexity:** Small to Medium

**Dependencies / Blockers:**
Product definition of “rhyme density.”

---

### Gap: Markdown Export Missing

**Severity:** Medium  
**Category:** Missing Feature  
**Files Involved:**
- `src/components/TopBarActions.tsx`
- `src/components/CommandPalette.tsx`
- export tests to be added

**Evidence:**
The export implementation downloads only `.txt` with MIME type `text/plain;charset=utf-8`. The command description says “Download current draft as .txt.”

**Problem:**
The requested MVP scope includes export to TXT/Markdown, but repository evidence only shows TXT.

**Impact:**
Users cannot export Markdown from the app, and MVP scope is incomplete if Markdown is required.

**Recommended Fix:**
Add either a secondary “Export Markdown” command or export palette actions for TXT and Markdown.

**Complexity:** Small

**Dependencies / Blockers:**
Product decision on Markdown format.

---

### Gap: Slant Rhyme Filter Is Not First-Class in Local UI/Schema

**Severity:** Medium  
**Category:** Missing Feature / Product Inconsistency  
**Files Involved:**
- `src/lib/persist/schema.ts`
- `src/lib/rhyme-db/queryRhymes.ts`
- `src/lib/rhyme-db/useRhymeSuggestions.ts`
- `src/app/api/wordnik/route.ts`
- `README.md`

**Evidence:**
README advertises perfect, slant, near. Persisted filters only contain `perfect` and `near`. The local rhyme query mode type is `perfect | near`. Wordnik accepts `perfect | slant`, but that is provider-specific.

**Problem:**
Feature naming is inconsistent, and slant is not clearly supported as a local filter mode.

**Impact:**
Users may expect a slant toggle that does not exist, and developers may confuse near/slant semantics.

**Recommended Fix:**
Define taxonomy: rename near/slant if synonymous, add explicit `slant` if distinct, or update README until slant exists.

**Complexity:** Medium

**Dependencies / Blockers:**
Rhyme classification product definition.

---

### Gap: Missing Standalone Typecheck Script

**Severity:** Medium  
**Category:** DX / Release  
**Files Involved:**
- `package.json`
- `tsconfig.json`

**Evidence:**
`package.json` includes `lint`, `test`, and `build`, but no `typecheck` script. `tsconfig.json` has `noEmit: true`, making `tsc --noEmit` appropriate.

**Problem:**
`npm run typecheck` fails as a missing script. Type checking happens during `next build`, but there is no fast standalone command.

**Impact:**
CI and developer workflows cannot run a dedicated typecheck step.

**Recommended Fix:**
Add `"typecheck": "tsc --noEmit"` to `package.json`. Consider whether tests should be included in a separate test tsconfig because current `tsconfig.json` excludes tests.

**Complexity:** Small

**Dependencies / Blockers:**
None.

---

### Gap: No CI Workflow Evidence

**Severity:** Medium  
**Category:** CI/CD / Release  
**Files Involved:**
- `.github/workflows/*` absent from repository evidence
- `package.json`
- `playwright.config.ts`

**Evidence:**
Repository file inspection found no `.github` workflow files. Package scripts exist for lint, test, e2e, and build.

**Problem:**
There is no repository evidence that lint/test/build/e2e are enforced on pull requests.

**Impact:**
Failing tests can land unnoticed. Editor overlay regressions are especially risky without automated checks.

**Recommended Fix:**
Add GitHub Actions workflow for Node 20 with `npm ci`, lint, typecheck, Jest, build, and Playwright smoke.

**Complexity:** Small to Medium

**Dependencies / Blockers:**
Fix current failing tests first or mark initial CI as expected failing until resolved.

---

### Gap: Debug Logging and Console Noise in Tests / Runtime

**Severity:** Low to Medium  
**Category:** DX / Performance / Polish  
**Files Involved:**
- `src/components/rhyme/RhymeSuggestionsPanel.tsx`
- `src/lib/rhyme-db/useRhymeSuggestions.ts`
- `src/hooks/useAnalysisWorker.ts`
- `src/lib/dev/useSettingsClickDebug.ts`
- `src/lib/persist/storage.ts`

**Evidence:**
Search found `console.log` calls in `RhymeSuggestionsPanel`. Test output included repeated `[rhymes]` logs. Search also found eslint-disable no-console comments in debug/storage files.

**Problem:**
Debug logs pollute test output and may mask real warnings.

**Impact:**
Developer-facing noise and possible runtime console noise.

**Recommended Fix:**
Gate all debug output behind explicit `NEXT_PUBLIC_DEBUG_*` flags or test-safe logger utilities. Remove unused eslint-disable directives reported by lint.

**Complexity:** Small

**Dependencies / Blockers:**
None.

---

### Gap: ESLint Warnings Are Allowed and Present

**Severity:** Low to Medium  
**Category:** DX / Quality  
**Files Involved:**
- `src/components/Editor.tsx`
- `src/components/rhyme/RhymeSuggestionsPanel.tsx`
- `src/hooks/useAnalysisWorker.ts`
- `src/hooks/useRhymeSuggestions.ts`
- `src/lib/rhyme-db/queryRhymes.ts`
- `src/lib/persist/storage.ts`

**Evidence:**
`npm run lint` returned 0 errors but 32 warnings, including hook dependency issues, unused variables, unused eslint-disable directives, and unused constants.

**Problem:**
Warnings are not release blockers today, but several are in core editor/rhyme lifecycle code.

**Impact:**
Hook dependency issues can become stale closure bugs; unused constants can indicate incomplete refactors.

**Recommended Fix:**
Fix warnings in small PRs. Then enforce `eslint --max-warnings=0` in CI.

**Complexity:** Small to Medium

**Dependencies / Blockers:**
Fix intentional hook dependency exceptions carefully to avoid editor regressions.

---

### Gap: README Contains Outdated / Unsupported Claims

**Severity:** Low  
**Category:** Documentation  
**Files Involved:**
- `README.md`
- `package.json`

**Evidence:**
README lists Prisma and PostgreSQL as tech stack/planned cloud storage, but neither appears in `package.json` dependencies. README also says screenshots and live demo are coming soon. README advertises slant rhymes, while local filters evidence shows perfect/near only.

**Problem:**
Documentation mixes implemented, planned, and outdated claims.

**Impact:**
New contributors and product stakeholders can misunderstand current scope.

**Recommended Fix:**
Split README into current implemented features, experimental/partial features, and planned features.

**Complexity:** Small

**Dependencies / Blockers:**
Resolve slant/near taxonomy.

---

### Gap: LocalStorage-Only Persistence Has No IndexedDB Fallback

**Severity:** Medium  
**Category:** Reliability / Architecture  
**Files Involved:**
- `src/hooks/useAutosave.ts`
- `src/store/tabsStore.ts`
- `src/lib/persist/storage.ts`

**Evidence:**
Autosave writes versioned drafts through localStorage persistence. Tabs also persist debounced state to localStorage.

**Problem:**
localStorage is synchronous, quota-limited, and not ideal for long writing sessions or many drafts.

**Impact:**
Users with large drafts may hit quota or blocking writes. Local-first MVP can work, but reliability risk grows with usage.

**Recommended Fix:**
For MVP, add quota/error UX and tests. Post-MVP or soon after, migrate draft bodies to IndexedDB/localForage while preserving current schema migration path.

**Complexity:** Medium

**Dependencies / Blockers:**
Do not change persistence shape casually; migration plan required.

---

### Gap: API Save Route Is Placeholder-Like and Not Product-Integrated

**Severity:** Low for local-first MVP; High if server save is expected  
**Category:** Architecture / Missing Feature  
**Files Involved:**
- `src/app/api/save/route.ts`
- `src/hooks/useAutosave.ts`

**Evidence:**
`/api/save` accepts JSON and returns success without durable persistence. `useAutosave` writes locally via `tryWriteVersioned`, not the API route.

**Problem:**
The route may imply server persistence that does not exist.

**Impact:**
Developer confusion; not user-facing if local-first is intended.

**Recommended Fix:**
Either remove the route until cloud sync exists, mark it explicitly as dev/mock, or integrate it behind a future cloud-sync feature flag.

**Complexity:** Small

**Dependencies / Blockers:**
Cloud sync roadmap decision.

---

### Gap: E2E Suite Exists but Was Not Verified in Required Command Run

**Severity:** Medium  
**Category:** Testing  
**Files Involved:**
- `e2e/*.spec.ts`
- `playwright.config.ts`
- `package.json`

**Evidence:**
The repo has E2E specs for editor typing, caret, line totals, windowing, autosave status, rhyme panel, settings panel, and header regressions. `package.json` exposes `test:e2e`.

**Problem:**
Core editor UX depends heavily on browser layout and selection APIs. Unit tests alone do not prove overlay/caret behavior.

**Impact:**
Release risk remains for browser-only regressions.

**Recommended Fix:**
After fixing Jest failures, run `npm run test:e2e`. Add CI smoke subset if full E2E is slow.

**Complexity:** Small to Medium

**Dependencies / Blockers:**
Jest failures should be fixed first to restore baseline confidence.

---

### Gap: Dependency Audit Reports Vulnerabilities

**Severity:** Medium  
**Category:** Security / DX  
**Files Involved:**
- `package.json`
- `package-lock.json`

**Evidence:**
`npm install` reported 13 vulnerabilities: 2 low, 4 moderate, 6 high, 1 critical.

**Problem:**
Dependencies need audit triage.

**Impact:**
Potential security exposure and release review blocker.

**Recommended Fix:**
Run `npm audit`, classify whether vulnerabilities affect production/client/server/dev-only paths, and update dependencies safely. Avoid blind `npm audit fix --force` unless breakage is reviewed.

**Complexity:** Medium

**Dependencies / Blockers:**
May require dependency updates and retesting.

---

## 3. Optimal Path Forward

### 3.1 MVP Readiness Assessment

```md
MVP Readiness: 7/10
```

**What is already strong**
- The main app architecture exists and builds with Next App Router.
- The editor separates raw contenteditable input from overlay measurement/rendering.
- Syllable analysis is deterministic and line totals are derived from word syllables.
- Rhyme suggestions and rhyme highlighting are substantially implemented.
- Autosave and local-first persistence are implemented with migration-aware storage.
- Command palette, keyboard shortcuts, themes, and TXT export exist.

**What is blocking release**
1. Jest is failing in 3 suites / 5 tests.
2. Default rhyme highlight behavior is inconsistent between implementation and tests.
3. Project analysis metric fixture is failing.
4. No standalone typecheck script.
5. No CI workflow evidence.
6. Dependency audit vulnerabilities need triage.

**What can be safely deferred**
- Auth
- Cloud sync
- Collaboration
- Analytics/observability
- Version history
- IndexedDB migration if localStorage error UX is acceptable for MVP
- Storybook/Ladle unless component-level visual review becomes necessary

**What must be fixed before public use**
1. Green Jest baseline.
2. Run and stabilize Playwright smoke specs for editor/caret/overlay/autosave.
3. Add CI enforcement.
4. Clean obvious debug console noise.
5. Decide and document rhyme mode taxonomy: perfect/near/slant.

---

### 3.2 Priority Roadmap

#### Phase 1: Stabilize Core Editor

- Run E2E specs for typing, caret, paste, windowing, and line totals.
- Add failure screenshots/traces to CI.
- Fix hook dependency warnings in editor/analysis paths carefully.
- Validate overlay badge and underline alignment under dark/light themes and different font sizes.
- Preserve current contenteditable + overlay architecture.

#### Phase 2: Fix Rhyme and Syllable Accuracy

- Resolve `DEFAULT_HIGHLIGHT_MODE` mismatch.
- Resolve project analysis `rhymeDensity` expectation.
- Define perfect/near/slant taxonomy.
- Add corpus tests for human-expected rhymes and edge cases.
- Keep local rhyme DB worker as the primary fast path; use providers as fallback.

#### Phase 3: Complete MVP Product Features

- Add Markdown export if required for MVP.
- Ensure autosave error UX is visible and test-covered.
- Add basic onboarding/help shortcuts text.
- Confirm settings persistence and migration behavior.
- Align README with actual implemented features.

#### Phase 4: Testing and Release Hardening

- Add `typecheck` script.
- Add GitHub Actions.
- Enforce lint max warnings after existing warnings are cleaned.
- Run Jest, build, and Playwright smoke in CI.
- Add accessibility checks for command palette, settings, sidebar, and rhyme panel.
- Add performance budget tests for typing latency if feasible.

#### Phase 5: Post-MVP Improvements

- Auth.
- Cloud sync.
- Version history.
- Collaboration.
- IndexedDB/localForage migration.
- Mobile optimization.
- Sentry/PostHog/OpenTelemetry if release traffic warrants it.

---

### 3.3 Step-by-Step Action Plan

#### Task 1: Resolve Rhyme Highlight Default Mode

**Goal:**  
Make implementation and tests agree on the default rhyme highlight mode.

**Files Likely Involved:**
- `src/lib/persist/schema.ts`
- `src/lib/settings/rhymeHighlightSettings.ts`
- `tests/rhymeHighlightSettingsStore.test.ts`
- `tests/settingsSheetRhymeHighlights.spec.tsx`

**Implementation Steps:**
1. Decide whether default should be `'all'` or `'focus'`.
2. If `'all'`, change `DEFAULT_HIGHLIGHT_MODE` to `'all'`.
3. If `'focus'`, update tests and labels to reflect the intentional calmer default.
4. Verify legacy persisted settings are not overwritten.

**Tests Required:**
- Unit test: rhyme highlight settings default/hydration.
- Component test: settings sheet active mode.
- E2E test: optional settings persistence smoke.

**Acceptance Criteria:**
- New user default is deterministic.
- Invalid persisted mode falls back to product-approved default.
- Existing saved user mode remains preserved.
- Jest failures for rhyme highlight settings are resolved.

**Risk Level:** Low

---

#### Task 2: Fix Project Analysis Rhyme Density Metric

**Goal:**  
Make dashboard/project analysis metrics deterministic and product-meaningful.

**Files Likely Involved:**
- `src/lib/projects/analysis.ts`
- `tests/projects.analysis.test.ts`
- possibly `src/lib/rhyme/rhymeDecorations.ts`

**Implementation Steps:**
1. Add temporary local assertions/logging in the test to inspect `endFamilies` and counts.
2. Define density formula: repeated line coverage vs repeated family ratio.
3. Update algorithm or test fixture.
4. Add edge-case tests for no rhymes, all lines rhyming, mixed rhymes.

**Tests Required:**
- Unit test: project analysis deterministic sample.
- Unit test: empty content.
- Unit test: dense reference block.

**Acceptance Criteria:**
- `tests/projects.analysis.test.ts` passes.
- Metric meaning is documented in code comments or test names.
- No unrelated rhyme decoration behavior changes.

**Risk Level:** Medium

---

#### Task 3: Add Standalone Typecheck Script

**Goal:**  
Provide a fast typecheck command for local and CI workflows.

**Files Likely Involved:**
- `package.json`
- optional `tsconfig.test.json`

**Implementation Steps:**
1. Add `"typecheck": "tsc --noEmit"`.
2. Run `npm run typecheck`.
3. Decide whether tests should be typechecked separately because current `tsconfig` excludes tests.

**Tests Required:**
- Command check: `npm run typecheck`.

**Acceptance Criteria:**
- `npm run typecheck` exits 0.
- Command can be used in CI independently of `next build`.

**Risk Level:** Low

---

#### Task 4: Clean Release-Blocking Console Noise and Lint Warnings

**Goal:**  
Reduce false positives and stale closure risks before CI enforcement.

**Files Likely Involved:**
- `src/components/Editor.tsx`
- `src/components/rhyme/RhymeSuggestionsPanel.tsx`
- `src/hooks/useAnalysisWorker.ts`
- `src/hooks/useRhymeSuggestions.ts`
- `src/lib/rhyme-db/queryRhymes.ts`
- `src/lib/persist/storage.ts`
- `src/lib/dev/useSettingsClickDebug.ts`

**Implementation Steps:**
1. Remove or gate unconditional `console.log` calls in rhyme panel rendering.
2. Remove unused eslint-disable comments.
3. Address unused variables/constants.
4. Review hook dependency warnings one by one.
5. Re-run lint.

**Tests Required:**
- Unit tests: existing suites.
- Lint: `npm run lint`.

**Acceptance Criteria:**
- Lint has 0 warnings or documented intentional exceptions.
- Test output no longer includes repeated debug logs.
- No editor typing behavior changes.

**Risk Level:** Medium

---

#### Task 5: Define and Implement Rhyme Mode Taxonomy

**Goal:**  
Resolve perfect/near/slant inconsistency.

**Files Likely Involved:**
- `src/lib/persist/schema.ts`
- `src/lib/rhyme-db/queryRhymes.ts`
- `src/lib/rhyme-db/useRhymeSuggestions.ts`
- `src/components/rhyme/RhymeSuggestionsPanel.tsx`
- `README.md`

**Implementation Steps:**
1. Decide if “near” and “slant” are synonyms.
2. If synonyms, update README/UI wording to one term.
3. If distinct, add `slant` filter to schema and scoring.
4. Add tests for each filter mode.

**Tests Required:**
- Unit test: query mode classification.
- Component test: filters UI.
- Integration test: suggestions shown/hidden by mode.

**Acceptance Criteria:**
- README, schema, UI, and query code use consistent terms.
- Users can understand and control rhyme type filtering.
- Existing perfect/near behavior does not regress.

**Risk Level:** Medium

---

#### Task 6: Add Markdown Export

**Goal:**  
Complete MVP export requirement if Markdown is in scope.

**Files Likely Involved:**
- `src/components/TopBarActions.tsx`
- `src/components/CommandPalette.tsx`
- tests for export behavior

**Implementation Steps:**
1. Extract export helper for generating safe filename and Blob.
2. Add `exportTxt` and `exportMarkdown`.
3. Add command palette action for Markdown.
4. Add tests for filename, MIME type, and content.

**Tests Required:**
- Unit test: export content helper.
- Component test: command palette item exists and runs.
- Optional E2E: download event.

**Acceptance Criteria:**
- TXT export remains unchanged.
- Markdown export downloads `.md`.
- Command palette exposes both options clearly.

**Risk Level:** Low

---

#### Task 7: Add GitHub Actions CI

**Goal:**  
Prevent regressions from landing.

**Files Likely Involved:**
- `.github/workflows/ci.yml`
- `package.json`

**Implementation Steps:**
1. Add Node 20 CI workflow.
2. Use `npm ci`.
3. Run lint, typecheck, test, build.
4. Add Playwright smoke after base tests are green.

**Tests Required:**
- CI validation on pull request.
- Local dry run not required but commands should pass locally.

**Acceptance Criteria:**
- PRs fail on lint/type/test/build failures.
- Playwright traces are available for E2E failures.

**Risk Level:** Low to Medium

---

#### Task 8: Run Playwright E2E and Fix Browser-Only Regressions

**Goal:**  
Verify real browser behavior for editor/caret/overlay/autosave.

**Files Likely Involved:**
- `e2e/editor-typing-regression.spec.ts`
- `e2e/editor-caret.spec.ts`
- `e2e/line-totals.spec.ts`
- `e2e/rhyme-panel.spec.ts`
- `e2e/autosave-status.spec.ts`

**Implementation Steps:**
1. Run `npm run test:e2e`.
2. Triage any failing specs.
3. Add screenshots/traces to bug reports.
4. Fix minimal scoped issues.

**Tests Required:**
- E2E: existing Playwright suite.
- Unit: only where fixes touch logic.

**Acceptance Criteria:**
- Core editor E2E specs pass in Chromium.
- No obvious overlay/caret alignment regressions.
- Autosave status behaves as expected.

**Risk Level:** Medium

---

### 3.4 Recommended Tools, Libraries, and Patterns

| Tool / Pattern | Recommendation | Why Needed | Add Now or Defer | Migration Risk |
|---|---:|---|---|---|
| Jest | Keep | Already configured and has broad coverage. | Now | Low |
| React Testing Library | Keep | Already used for components/settings/topbar. | Now | Low |
| Playwright | Keep and enforce smoke subset | Browser layout/selection is core to editor risk. | Now | Low-Medium |
| TypeScript strictness | Keep; add typecheck script | `strict` is already true; missing script is DX gap. | Now | Low |
| ESLint max warnings | Add after cleanup | Existing lint warnings include hook dependencies in core files. | Now, after cleanup | Medium |
| Prettier | Optional | No evidence of Prettier config; add only if formatting churn is controlled. | Defer | Medium |
| GitHub Actions | Add | No workflow evidence; needed to enforce green baseline. | Now | Low |
| Storybook / Ladle | Optional | Could help overlay/settings visual review, but not essential for MVP. | Defer | Medium |
| Visual regression testing | Add lightweight Playwright screenshots for overlays | Overlay alignment is high risk. | Soon | Medium |
| Web Workers | Keep | Analysis and rhyme DB workers already exist. | Already | Low |
| Zustand | Keep | Existing state stores use Zustand. | Already | Medium if replaced |
| TanStack Query | Keep if used; do not expand casually | Dependency exists; verify actual usage before expanding. | Defer | Low |
| IndexedDB/localForage | Consider for post-MVP persistence durability | localStorage is synchronous/quota-limited for long drafts. | Defer or Phase 4 | Medium |
| Sentry | Useful before public beta | Captures client errors, worker failures, quota exceptions. | Soon | Low-Medium |
| PostHog | Defer | Analytics useful after MVP; avoid privacy/product distraction now. | Post-MVP | Low |
| OpenTelemetry | Defer | Overkill for local-first MVP unless backend grows. | Post-MVP | Medium |
| Feature flags | Lightweight constants only | Could gate experimental rhyme providers/debug modes. | Defer | Low |

---

### 3.5 Risk Mitigation Strategy

#### Risk: Editor Typing Latency

**Why It Matters:**  
The product promise is fast, distraction-free writing.

**Mitigation:**  
Keep analysis off the hot path, avoid per-keystroke full-document DOM measurement, preserve viewport windowing, and profile long drafts.

**Test Coverage Needed:**  
- Playwright typing regression with long document.
- Unit test for debounce scheduling.
- Performance smoke threshold in CI if stable.

---

#### Risk: Caret-Word Targeting Accuracy

**Why It Matters:**  
Rhyme suggestions depend on correct caret and current-line targeting.

**Mitigation:**  
Add E2E tests for caret at word start/end, punctuation boundaries, empty lines, selected ranges, and after paste.

**Test Coverage Needed:**  
- `editor-caret` E2E expansion.
- Unit tests for plain-text index serialization.
- Rhyme panel target tests.

---

#### Risk: Overlay Rendering Alignment

**Why It Matters:**  
Syllable badges and rhyme underlines are only useful if aligned with visible words.

**Mitigation:**  
Add screenshot-based checks for multiple font sizes, line heights, long wrapped lines, and theme modes.

**Test Coverage Needed:**  
- Playwright screenshot tests for overlay positions.
- Unit tests for visible line range.
- Component tests for overlay filtering.

---

#### Risk: Syllable Badge Overlap

**Why It Matters:**  
Badges can clutter the writing surface.

**Mitigation:**  
Validate badge mode defaults, active-line display, and line-height/font-size combinations. Keep default subtle.

**Test Coverage Needed:**  
- Visual regression at min/max font size.
- Component test for badge mode filtering.
- E2E for toggling badge display settings.

---

#### Risk: Rhyme-Key Quality

**Why It Matters:**  
Rhyme highlighting and suggestions depend on pronunciation/rhyme keys.

**Mitigation:**  
Maintain a curated corpus of expected rhyme families and edge cases, especially rap/poetry common words.

**Test Coverage Needed:**  
- Unit corpus tests for rhyme keys.
- Regression tests for known commits/issues.
- Tests for heuristic fallback source behavior.

---

#### Risk: Slant Rhyme Scoring

**Why It Matters:**  
Users expect near/slant rhymes to feel musically useful, not random.

**Mitigation:**  
Define slant vs near semantics, thresholds, and scoring. Validate with human-readable examples.

**Test Coverage Needed:**  
- Unit tests for perfect/near/slant classification.
- Snapshot of top suggestions for sample words.
- UI filter tests.

---

#### Risk: Local Storage Reliability

**Why It Matters:**  
Draft loss is catastrophic.

**Mitigation:**  
Show persistent error state on quota/write failure, allow manual export despite save failure, and consider IndexedDB migration.

**Test Coverage Needed:**  
- Unit test for `tryWriteVersioned` failure.
- Component/E2E autosave error display.
- Migration tests for schema versions.

---

#### Risk: API / Provider Failure

**Why It Matters:**  
Rhyme suggestions should degrade gracefully if local DB or external providers fail.

**Mitigation:**  
Prefer local DB, cache provider results, expose non-intrusive error/empty state, and test provider failures.

**Test Coverage Needed:**  
- API route tests for missing key/rate limit/fetch failure.
- Hook tests for local unavailable fallback.
- UI tests for empty/error suggestions.

---

#### Risk: Small-Screen Layout

**Why It Matters:**  
The editor is desktop-first but users may write on smaller screens.

**Mitigation:**  
Run responsive Playwright checks. Ensure side panels collapse and do not dominate.

**Test Coverage Needed:**  
- Playwright mobile/tablet viewport smoke.
- Screenshot tests for editor and rhyme panel.
- Accessibility navigation tests without sidebar.

---

#### Risk: Accessibility Issues

**Why It Matters:**  
Keyboard-first and accessible UX are core product rules.

**Mitigation:**  
Add accessibility smoke tests, ensure focus-visible states, and prevent overlays from entering screen-reader output.

**Test Coverage Needed:**  
- axe or Playwright accessibility checks.
- Keyboard navigation tests for palette/settings/rhyme panel.
- Focus restoration tests.

---

#### Risk: Regression from UI Refactors

**Why It Matters:**  
Editor behavior is tightly coupled to DOM structure, selection, overlays, and persistence.

**Mitigation:**  
Use small PRs, avoid broad rewrites, preserve raw input vs overlay separation, and require E2E for editor DOM changes.

**Test Coverage Needed:**  
- Editor refactor regression E2E.
- Unit tests for serialization/selection.
- Visual overlay tests.

---

## Evidence Appendix

### Key Source Evidence Reviewed

- App routes: `src/app/page.tsx`, `src/app/editor/page.tsx`, `src/app/editor/[id]/page.tsx`
- API routes: `src/app/api/save/route.ts`, `src/app/api/wordnik/route.ts`
- Editor: `src/components/Editor.tsx`, `src/components/EditorLayout.tsx`, `src/components/EditorShell.tsx`
- Syllable analysis: `src/lib/analysis/compute.ts`, `src/lib/analysis/tokenize.ts`, `src/lib/nlp/syllables.ts`
- Analysis worker: `src/hooks/useAnalysisWorker.ts`, `src/workers/analysis.worker.ts`
- Overlays: `src/hooks/useOverlayMeasurement.ts`, `src/hooks/useRhymeDecorationOverlay.ts`, `src/components/editor/SyllableOverlay.tsx`, `src/components/editor/RhymeDecorationOverlay.tsx`
- Rhyme logic: `src/lib/rhyme/rhymeDecorations.ts`, `src/lib/rhyme-db/queryRhymes.ts`, `src/lib/rhyme-db/useRhymeSuggestions.ts`, `src/workers/rhymeWorker.ts`
- Persistence/autosave: `src/hooks/useAutosave.ts`, `src/store/tabsStore.ts`, `src/store/settingsStore.ts`, `src/lib/persist/*`
- UI/product shell: `src/components/TopBarActions.tsx`, `src/components/CommandPalette.tsx`, `src/components/RhymePanel.tsx`, `src/components/dashboard/*`
- Tests: `tests/*`, `src/**/*.test.ts`, `src/**/*.test.tsx`, `e2e/*`
- Config: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `playwright.config.ts`, `next.config.ts`
- Docs: `README.md`, `AGENTS.md`

### GitHub Issues / PRs

Issue tracker verification was unavailable from repository evidence. Recent commit messages reference PR numbers such as `#137`, `#135`, `#114`, `#110`, `#105`, and others, but no GitHub issue/PR metadata was available locally beyond commit subjects.

---

## Command Results

- ✅ `git status --short`  
  Initial status was clean. After `npm install` and `npm run build`, generated/tooling changes appeared in `package-lock.json` and `public/rhyme-db/manifest.json`; those generated changes were reverted during audit cleanup.

- ✅ `git branch --show-current`  
  Returned `work`.

- ✅ `git log --oneline -n 30`  
  Showed recent commits including stale rhyme suggestion lifecycle/caret sync, dashboard route work, rhyme highlighting fixes, pronunciation pipeline work, autosave refactors, and offline rhyme worker integration.

- ⚠️ `npm install`  
  Completed successfully, but reported 13 vulnerabilities: 2 low, 4 moderate, 6 high, 1 critical.

- ✅ `npm run lint`  
  Exited 0, but reported 32 warnings, including React hook dependency warnings, unused variables, and unused eslint-disable directives.

- ❌ `npm run typecheck`  
  Failed because `package.json` has no `typecheck` script.

- ❌ `npm test -- --runInBand`  
  Failed: 3 failed suites, 51 passed suites, 5 failed tests, 296 passed tests, 301 total tests.

  Failing areas:
  - `tests/rhymeHighlightSettingsStore.test.ts`: expected highlight mode `'all'`, received `'focus'`.
  - `tests/settingsSheetRhymeHighlights.spec.tsx`: expected “All” button `aria-pressed="true"`, received false.
  - `tests/projects.analysis.test.ts`: expected `rhymeDensity` close to `0.5`, received `1`.

- ✅ `npm run build`  
  Succeeded. It generated the rhyme DB, compiled successfully, ran TypeScript as part of Next build, generated static pages, and listed routes for `/`, `/api/save`, `/api/wordnik`, `/dev/rhyme-worker-smoke`, `/editor`, and `/editor/[id]`.

- ✅ `rg -n "TODO|FIXME|HACK|BUG|temporary|workaround|console\\.log|eslint-disable|@ts-ignore|@ts-expect-error" src tests scripts e2e -g '!node_modules'`  
  Found no source TODO/FIXME/HACK items in the focused search, but found debug/logging and eslint-disable entries, including no-console disables in storage/dev debug code and console logs in rhyme suggestions.

---

## Assumptions and Unknowns

- **GitHub issues/PR metadata:** Unknown from repository evidence.
- **Production deployment status:** Unknown from repository evidence.
- **E2E current status:** Unknown from this audit because Playwright was not run.
- **Product decision on default rhyme highlight mode:** Unknown. Tests expect `all`; schema currently sets `focus`.
- **Product definition of “near” vs “slant”:** Unknown.
- **Markdown export format:** Unknown from repository evidence; TXT export exists.
- **Cloud sync/auth/database:** Planned from README, but not implemented in package dependencies or source evidence.
