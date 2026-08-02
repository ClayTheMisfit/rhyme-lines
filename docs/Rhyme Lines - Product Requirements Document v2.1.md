# Rhyme Lines Product Requirements Document

## 1. Document Information

- **Product name:** Rhyme Lines
- **Document status:** Repository-aware approval draft
- **Version:** 2.1
- **Owner:** Rhyme Lines Product Owner
- **Last updated:** July 29, 2026
- **Repository:** `ClayTheMisfit/rhyme-lines`
- **Repository baseline:** `main`, reviewed through commit `116db16d78a837fcb476fb9a508424f1d9ce9abe`
- **Intended audience:** Product owner, developers, coding agents, designers, QA testers, accessibility reviewers, and future contributors
- **Purpose:** Define accepted current behavior, required release changes, missing release scope, and post-MVP boundaries
- **Precedence:** Once approved, this document controls product behavior where earlier planning documents, README descriptions, tests, and implementation disagree

### 1.1 Requirement Status Definitions

Every functional requirement uses one of these statuses:

- **Implemented — verified in repository:** Supporting implementation and tests or repository documentation were found.
- **Implemented — verification incomplete:** Supporting implementation exists, but complete runtime, browser, or E2E verification is not established.
- **Implemented — known defect:** The feature exists but has a confirmed defect or contradictory test.
- **Required change:** Current implementation conflicts with approved product behavior.
- **Missing:** Required behavior was not found in the current repository.
- **Future:** Explicitly excluded from the current release.

Repository-backed status does not guarantee that a feature has passed manual browser testing.

---

## 2. Executive Summary

Rhyme Lines is a local-first lyric and poetry development application for drafting, organizing, revising, and analyzing line-based writing.

The current application includes:

- A dashboard for starting and resuming projects
- A document-based lyric editor
- Word-level syllable badges
- Line-level syllable totals
- Rhyme-family highlighting
- Perfect and near/slant rhyme suggestions
- Meaning-based thesaurus exploration
- Document creation, renaming, pinning, reordering, and deletion
- A collapsible document sidebar
- A docked or floating rhyme panel
- Keyboard shortcuts and a command palette
- Persistent themes and editor preferences
- Local autosave and restoration
- Plain-text export

The release objective is to make the existing product internally consistent, safe against lyric loss, accessible, testable, and release-green.

The MVP does not include accounts, cloud synchronization, collaboration, version history, or public publishing.

---

## 3. Product Vision

Rhyme Lines should provide a focused writing environment in which analysis tools remain close to the lyrics without taking control away from the writer.

The product should allow a writer to:

- Capture an idea quickly
- Maintain multiple lyric drafts
- See syllable and rhyme structure without leaving the editor
- Explore alternative sounds and related meanings
- Control how much analysis is visible
- Use the product with a keyboard
- Restore work after refresh or reopening
- Export a portable copy
- Continue writing when analysis or network services fail

The writing surface is the primary product. Rhyme, syllable, dashboard, and workspace features support that surface.

---

## 4. Problem Statement

Lyric writers frequently divide their process across generic notes applications, text editors, rhyme websites, syllable counters, thesaurus tools, local files, and cloud documents.

This creates:

- Context switching
- Lost creative momentum
- Inconsistent draft organization
- Manual syllable-counting work
- Difficulty reviewing rhyme patterns
- Reliance on external services
- Risk of losing browser-based drafts
- Interfaces that display more analysis than the writer wants

Rhyme Lines addresses these problems by combining drafting, organization, sound analysis, meaning exploration, persistence, and export in one local-first workspace.

---

## 5. Target Users

### 5.1 Independent songwriter

A writer developing verses, hooks, choruses, bridges, or complete songs.

### 5.2 Rap and hip-hop lyricist

A writer who evaluates internal rhyme, end rhyme, syllable balance, and sound density at word and line level.

### 5.3 Poet or spoken-word writer

A user creating line-based writing where rhythm and sound relationships matter.

### 5.4 Keyboard-first writer

A frequent user who wants to navigate documents and tools without leaving the keyboard.

### 5.5 Accessibility-focused writer

A user who relies on visible focus, keyboard navigation, zoom, screen readers, high contrast, reduced motion, or non-color indicators.

---

## 6. User Needs and Pain Points

Users need to:

- Start or resume a draft without account friction
- Keep documents identifiable and ordered
- Rename, pin, reorder, and delete documents safely
- Delete the final document without the application creating unwanted content
- Preserve punctuation, line breaks, symbols, emojis, and Unicode
- Trust that analysis overlays will not alter lyric text
- See syllables by word and line
- Distinguish rhyme relationships
- Understand when rhyme analysis is uncertain
- Receive suggestions for the intended target word
- Avoid stale suggestions after rapid typing or caret movement
- Explore synonyms and related concepts
- Hide or reposition optional panels
- Understand save status
- Recover when local storage is unavailable
- Export the selected draft
- Use light and dark appearance modes reliably
- Complete core actions by keyboard
- Continue writing when external providers fail

---

## 7. Goals

### 7.1 Release Goals

1. Preserve all currently working core editor behavior.
2. Make document lifecycle behavior consistent across dashboard, sidebar, routes, persistence, and refresh.
3. Support a true persistent zero-document state.
4. Start the editor with the document sidebar closed on first entry.
5. Resolve the open light-theme defect.
6. Resolve the dashboard rhyme-density implementation/test conflict.
7. Add Markdown export.
8. Establish an agreed rhyme-category taxonomy.
9. Establish green automated release checks.
10. Complete accessibility and responsive verification.
11. Prevent raw lyric content from being collected by analytics.
12. Clearly communicate local-storage and online-provider behavior.

### 7.2 Product Validation Goals

Proposed post-release measurements:

- Percentage of first launches that reach a project editor
- Percentage of editor launches that result in persisted content
- Seven-day return rate using an approved privacy-preserving method
- Successful restore rate
- Save-failure rate
- Export success rate
- Rhyme-panel adoption
- Syllable-overlay adoption
- Command-palette adoption
- Fatal application error rate

These metrics remain proposed until an analytics system and privacy policy are approved.

---

## 8. Non-Goals

The following are not included in this release:

- User accounts
- Authentication
- Cloud synchronization
- Cross-device access
- Real-time collaboration
- Comments or review threads
- Version history
- Public profiles
- Social feeds
- Direct publishing to music or social platforms
- Beat production
- Audio recording
- AI-generated lyrics
- Plagiarism or copyright evaluation
- Native mobile applications
- Full mobile parity
- Rich-text document formatting
- Guaranteed pronunciation accuracy for every word
- Separate operating-system windows for detached panels
- Customizable shortcut mapping
- Automatic cloud backup

---

## 9. Product Principles

### 9.1 Writing Has Priority

Typing and selection must not wait for rhyme analysis, syllable analysis, analytics, persistence, panel animation, or network responses.

### 9.2 Lyric Content Is Authoritative

Decorations, badges, metrics, and suggestion state must never become part of copied, persisted, or exported lyric text.

### 9.3 Never Silently Lose Lyrics

The application must not claim a failed save succeeded. Destructive actions must identify their consequence.

### 9.4 Analysis Remains Optional

Users can hide syllables, line totals, rhyme decorations, or suggestions without changing lyric data.

### 9.5 Local-First by Default

Drafts and preferences remain local in the MVP.

### 9.6 Failure Isolation

Failure in rhyme services, analysis, analytics, or layout restoration must not unnecessarily prevent text editing.

### 9.7 Keyboard Parity

Every core pointer action must have a keyboard-accessible path.

### 9.8 Color Is Supplementary

Rhyme relationships, focus, uncertainty, and selection must not rely only on color.

### 9.9 Preserve Working Architecture

Changes must preserve the separation among:

- Editable input
- Serialized text
- Derived analysis
- Overlay measurement
- Overlay rendering
- Suggestion-provider state

---

## 10. Scope

### 10.1 In Scope

#### Must Have

- Dashboard project launch and resume
- Multiple local documents
- Document creation, selection, renaming, and confirmed deletion
- Final-document zero state
- Document sidebar
- Plain-text lyric editing
- Paste normalization
- Undo and redo
- Caret preservation
- Word-level syllable badges
- Line-level syllable totals
- Rhyme-family decorations
- Focus highlight mode as default
- Rhyme suggestions with accurate filter labels
- Rhyme thesaurus preservation
- Docked and floating in-app rhyme panel
- Local autosave and save status
- Persistence migrations
- Dark, light, and system theme behavior
- Command palette and current keyboard shortcuts
- TXT and Markdown export
- Storage-error behavior
- Rhyme-provider failure behavior
- Desktop and tablet support
- Core narrow-screen editing
- Accessibility release requirements
- Green lint, type, test, build, and critical E2E checks

#### Should Have

- Document pinning
- Pointer and keyboard reordering
- Panel resizing and positioning
- Quick-assist rhyme suggestions
- Meaning-based rhyme thesaurus
- Font-size, line-height, and badge-size controls
- High-contrast mode
- Local rhyme fallback
- Screen-reader state announcements
- Dashboard project metrics
- Data-reset controls within the product

#### Could Have

- Search across document titles
- Export all documents
- Recently deleted document recovery
- User pronunciation overrides
- Additional export formats
- User-configurable suggestion insertion mode
- Custom keyboard mapping
- Additional themes

### 10.2 Out of Scope

All items listed in Section 8.

---

## 11. Assumptions

1. The application remains browser-based.
2. The root route remains the workspace dashboard.
3. The editor remains available at project-specific routes.
4. Plain text remains the authoritative lyric format.
5. A blank line is meaningful lyric structure.
6. Documents have stable identifiers independent of titles.
7. Duplicate titles remain allowed.
8. The document-title maximum remains 100 characters.
9. The current `focus` rhyme-highlight mode remains the default.
10. Local storage remains the authoritative MVP data store.
11. The local rhyme database remains preferred over online providers.
12. The application can send an individual target word to an online fallback when local lookup fails.
13. The floating rhyme panel remains inside the application window.
14. The current keyboard shortcuts remain the default.
15. Markdown export is required because it appears in the original MVP direction.
16. Existing working features must not be rewritten without a demonstrated reason.

---

## 12. Constraints

### 12.1 Current Technical Baseline

The current repository uses:

- Next.js 16.0.7
- React 19.1
- TypeScript 5
- Tailwind CSS 4
- Zustand
- TanStack Query
- Radix UI primitives
- Framer Motion
- React RND
- Jest
- Testing Library
- Playwright
- Local storage
- Web Workers
- A generated CMUdict-derived rhyme database

These are implementation facts, not permanent product requirements.

### 12.2 Product Constraints

- The release must not require an account.
- Core editing must work without a network.
- Full lyric documents must not be sent to online rhyme services.
- Analysis must not modify the editor’s source text.
- Optional panels must not make the editor unreachable.
- Invalid persisted UI state must not invalidate lyric documents.
- The release must not depend on an unverified one-week schedule.

### 12.3 Current Verification Constraints

- The repository has no dedicated `typecheck` script.
- Recent validation reports use `npx tsc --noEmit`.
- Playwright browser execution has not been consistently completed in recent coding environments.
- No GitHub Actions workflow currently establishes standardized release checks.
- Performance-oriented architecture exists, but a verified typing-latency benchmark does not.

---

## 13. Dependencies

| Dependency | Affected areas | Current condition |
|---|---|---|
| Tabs/document store | Dashboard, sidebar, routing, persistence | Implemented; final-document behavior must change |
| Versioned persistence schema | Documents, settings, panel state | Implemented |
| ContentEditable serialization | Editing, copy/paste, autosave, export | Implemented and regression-sensitive |
| Syllable worker | Word badges and line totals | Implemented with fallback |
| Rhyme decoration engine | Highlights and dashboard metrics | Implemented; pronunciation limitations remain |
| Local rhyme DB worker | Suggestions | Implemented |
| Online providers | Fallback suggestions and thesaurus | Implemented for selected paths |
| Overlay measurement | Badges, highlights, active line, totals | Implemented and layout-sensitive |
| Theme token system | Dark, light, system themes | Implemented; light-theme defect open |
| Browser download APIs | TXT and Markdown export | TXT implemented |
| Accessible component patterns | Dialogs, menus, panels, settings | Partially implemented |
| Playwright environment | Release E2E validation | Specs exist; execution must be standardized |
| GitHub Actions | Continuous validation | Missing |

---

## 14. User Experience Overview

### 14.1 Dashboard

The dashboard is the default application entry point. It provides a way to create a new project, resume a recent project, view project summaries, and navigate into the editor.

The dashboard must not become a second document-management system with behavior that conflicts with the editor sidebar.

### 14.2 Editor Workspace

The editor workspace contains:

1. A minimal top bar
2. A collapsible document sidebar
3. A central writing surface
4. A syllable overlay
5. A line-total gutter
6. A rhyme-decoration overlay
7. A rhyme suggestions panel or quick-assist surface
8. Settings and command interfaces
9. Save and error status

### 14.3 First Editor Entry

On the first entry into an editor workspace:

- The document sidebar is closed.
- The writing surface receives primary visual emphasis.
- The selected project is loaded.
- The user can begin typing without opening another interface.

On later entry, the approved sidebar preference may be restored. Invalid saved layout state falls back safely.

### 14.4 Zero-Document Workspace

When no documents exist:

- No replacement document is automatically created.
- No editor content surface pretends a document exists.
- A centered Create New action is displayed.
- Refreshing preserves the zero-document state.

---

## 15. Information Architecture and Data Model

### 15.1 Document

A document contains:

- Stable ID
- Title
- Plain-text lines
- Creation time
- Last-updated time
- Pinned state
- Numeric order position
- Optional selection state
- Existing archive, deletion, or folder-compatible fields where used by the repository

Default values:

- Title: `Untitled`
- Pinned: false
- Position: next available unpinned position
- Content: one empty logical line for an existing blank document

Validity rules:

- Title is trimmed.
- A whitespace-only rename does not persist a blank title.
- Title length is limited to 100 characters.
- Duplicate titles are allowed.
- ID, not title, determines document identity.

### 15.2 Selected Document

- Represents the document displayed in the editor.
- Persists when a valid document exists.
- Becomes null when the final document is deleted.
- Must not point to a missing or deleted document.
- Falls back to an adjacent valid document after deleting the selected document when other documents remain.

### 15.3 Document Order

- Pinned documents appear before unpinned documents.
- Manual order is retained inside each group.
- Reordering does not move a document between pinned and unpinned groups.
- Order persists after refresh.
- Invalid order values fall back deterministically.

### 15.4 Editor Content

- Stored and exported as plain text.
- Logical lines are separated by newlines.
- Soft wrapping does not create additional logical lines.
- Decorative content is excluded.

### 15.5 Settings

Current settings include theme, font size, line height, high contrast, rhyme filters, badge size, line-total visibility, rhyme-decoration visibility, internal-rhyme visibility, stopword highlighting, rhyme auto-refresh, debounce mode, rhyme-highlight mode, rhyme-color visibility, and development-only debug state.

Invalid individual values fall back without invalidating all settings.

### 15.6 Rhyme Panel State

Current panel state includes open/closed, docked/floating, width, height, position, filters, last target, search query, selected result index, syllable filter, and multi-syllable perfect-rhyme mode.

Invalid geometry must be clamped or reset.

### 15.7 Theme

Supported persisted values are dark, light, and system. The release must either fully support these values or explicitly revise the setting contract before removing one.

---

## 16. Core User Flows

### 16.1 Start a New Project

1. User opens the dashboard.
2. User activates New Project.
3. Exactly one project is created.
4. The application navigates to its project-specific editor route.
5. The document sidebar is closed on first editor entry.
6. Focus moves to the writing surface.
7. Typing updates the project.

### 16.2 Resume a Project

1. User selects a dashboard project.
2. The project route opens.
3. The selected project’s title and content load.
4. Saved preferences load independently.
5. Invalid optional state does not block the document.

### 16.3 Create Another Document

1. User opens the document sidebar or command palette.
2. User activates New Document.
3. One untitled document is added.
4. It becomes selected.
5. The route and last-open pointer update.
6. Focus moves to the editor.

### 16.4 Rename, Pin, and Reorder

1. User opens the document action menu or uses the keyboard.
2. Rename supports F2, Enter, Escape, and approved blur behavior.
3. Pinning moves the document into the pinned group.
4. Pointer drag or Alt+Arrow reorders within the current group.
5. Changes persist.

### 16.5 Delete a Document

1. User opens Delete.
2. A confirmation identifies the document.
3. Cancel changes nothing.
4. Confirm removes the target.
5. If other documents remain, selection moves predictably.
6. If no documents remain, the zero-document state appears.
7. Refresh does not recreate a replacement.

### 16.6 Write and Analyze

1. User types or pastes text.
2. Text updates immediately.
3. Analysis is scheduled separately.
4. Word counts, line totals, and rhyme decorations update.
5. Caret and selection remain stable.
6. Stale analysis cannot replace newer analysis.

### 16.7 Get Rhyme Suggestions

1. User positions the caret or searches explicitly.
2. The current target appears immediately.
3. Suggestions load from the local database.
4. Online providers may be used if local initialization fails.
5. Filters update the results.
6. Pointer or keyboard activation uses the current insertion behavior.
7. Insertion preserves editor focus and valid selection.

### 16.8 Explore the Rhyme Thesaurus

1. User expands the thesaurus section.
2. Synonyms and related concepts load.
3. User chooses a concept.
4. Rhyme suggestions are generated for that concept.
5. Stale responses cannot replace a newer concept.
6. Errors remain inside the thesaurus region.

### 16.9 Export

1. User activates export or `Ctrl/Cmd+S`.
2. User selects TXT or Markdown.
3. The selected document is serialized without overlays.
4. The browser download begins.
5. Success or failure is communicated.

---

## 17. Functional Requirements

### 17.1 Dashboard and Startup

#### DSH-001 — Display the Dashboard

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** The root route must display the Rhyme Lines workspace dashboard rather than mounting an editor with an unidentified project.
- **Acceptance criteria:**
  1. Given a new session, when the root route opens, the dashboard is displayed.
  2. The dashboard provides a keyboard-accessible New Project action.
  3. Existing valid projects are available to resume.
  4. An invalid recent-project pointer does not open the wrong document.

#### DSH-002 — Create or Resume a Project

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** Dashboard actions must create or open the intended project and navigate to the matching editor route.
- **Acceptance criteria:**
  1. New Project creates exactly one project.
  2. Resume opens the selected project ID.
  3. The route, active document ID, and last-open project ID remain consistent.
  4. Repeated activation from one input event does not create duplicates.

#### DSH-003 — Produce Deterministic Project Metrics

- **Status:** Implemented — known defect
- **Priority:** Must Have
- **Requirement:** Dashboard project metrics must use an approved, documented formula and produce deterministic results for canonical fixtures.
- **Acceptance criteria:**
  1. The formula for rhyme density is documented.
  2. Unit fixtures match the approved product definition.
  3. Dashboard metrics use the canonical rhyme-decoration path.
  4. Empty content returns zero values.
  5. Metric failure does not prevent project editing.

### 17.2 Document Management

#### DOC-001 — Create a Document

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** The user can create a local document from available workspace actions.
- **Acceptance criteria:**
  1. Exactly one document is created.
  2. It receives a stable ID.
  3. Its title is `Untitled`.
  4. It is unpinned.
  5. It is placed after existing unpinned documents.
  6. It becomes selected.
  7. Focus moves to the editor.

#### DOC-002 — Select a Document

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** Selecting a document must display that document and synchronize active state and routing.
- **Acceptance criteria:**
  1. The selected row is visually and programmatically identified.
  2. The editor displays the matching content.
  3. Route and selected ID agree.
  4. Selecting the current item does not duplicate state.

#### DOC-003 — Rename a Document

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** The user can rename a document using pointer or keyboard input.
- **Acceptance criteria:**
  1. F2 begins rename when the row is focused.
  2. Double-click may begin rename.
  3. Enter commits.
  4. Escape cancels.
  5. Approved blur behavior commits.
  6. Whitespace is trimmed.
  7. A whitespace-only value falls back to the previous title or `Untitled`.
  8. Maximum length is 100 characters.
  9. Duplicate titles are allowed.
  10. The result persists.

#### DOC-004 — Pin or Unpin

- **Status:** Implemented — verified in repository
- **Priority:** Should Have
- **Requirement:** The user can move a document between pinned and unpinned groups without changing its content.
- **Acceptance criteria:**
  1. Pinned documents render before unpinned documents.
  2. Pin state is exposed accessibly.
  3. Pin state persists.
  4. Selection remains unchanged.

#### DOC-005 — Reorder Documents

- **Status:** Implemented — verified in repository
- **Priority:** Should Have
- **Requirement:** The user can reorder documents within their current pin group through pointer and keyboard input.
- **Acceptance criteria:**
  1. Drag-and-drop reorders within the group.
  2. Alt+ArrowUp and Alt+ArrowDown provide keyboard reordering.
  3. Moving beyond a group boundary has no destructive effect.
  4. Order persists after refresh.
  5. Reordering does not change content or selection.

#### DOC-006 — Delete a Document Safely

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** Deleting a document requires an accessible confirmation identifying the target.
- **Acceptance criteria:**
  1. Cancel receives safe initial focus.
  2. Escape cancels.
  3. Confirm deletes only the named document.
  4. A non-selected deletion does not change selection.
  5. Deleting the selected document selects the next visible neighbor, then the previous neighbor if necessary.
  6. Deletion persists.

#### DOC-007 — Allow a True Zero-Document State

- **Status:** Required change
- **Priority:** Must Have
- **Requirement:** Deleting the final document must leave zero documents rather than creating a replacement.
- **Acceptance criteria:**
  1. Given exactly one document, when deletion is confirmed, the collection contains zero documents.
  2. The active document ID becomes null or an approved empty value.
  3. No default tab is created.
  4. The route resolves to the zero-document editor workspace.
  5. The state persists after refresh and reopening.
  6. Creating a new document exits the empty state.

### 17.3 Document Sidebar

#### SID-001 — Keep the Sidebar Closed on First Editor Entry

- **Status:** Required change
- **Priority:** Must Have
- **Requirement:** The document sidebar must be closed the first time a user enters the editor.
- **Acceptance criteria:**
  1. A user with no saved sidebar preference enters with the sidebar collapsed.
  2. The editor uses the available width.
  3. The sidebar can be opened by its labeled control.
  4. The setting does not prevent document creation through other actions.

#### SID-002 — Toggle and Persist Sidebar State

- **Status:** Implemented — requires adjustment
- **Priority:** Must Have
- **Requirement:** The user can collapse or expand the desktop sidebar, and the approved later-session preference persists.
- **Acceptance criteria:**
  1. The toggle exposes `aria-expanded`.
  2. `Ctrl/Cmd+\`` toggles the sidebar.
  3. Closing does not change selection.
  4. Opening does not move the lyric caret unexpectedly.
  5. First-entry behavior takes precedence over the absence of a saved preference.

#### SID-003 — Support Long Document Lists

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** The sidebar remains usable when the document list exceeds available height.
- **Acceptance criteria:**
  1. The list scrolls.
  2. New Document remains reachable.
  3. Focused items can be brought into view.
  4. Long titles truncate visually without changing stored data.

### 17.4 Lyric Editor

#### EDT-001 — Maintain a Plain-Text Authority Layer

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** The editable document must contain only lyric text and line structure.
- **Acceptance criteria:**
  1. Syllable badges are not editable.
  2. Rhyme decorations are not editable.
  3. Copying lyrics excludes overlays.
  4. Export excludes overlays.
  5. Screen readers do not treat decorative badge text as lyric content.

#### EDT-002 — Preserve Line Structure and Unicode

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** Typing, paste, persistence, restoration, and export preserve logical lines and visible characters.
- **Acceptance criteria:**
  1. Enter creates one logical line.
  2. Blank lines persist.
  3. Curly and straight punctuation persist.
  4. Emojis and Unicode persist.
  5. Backslashes and forward slashes persist.
  6. Soft wrapping does not create saved newlines.

#### EDT-003 — Normalize Rich-Text Paste

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** Pasted rich text becomes plain lyric text while preserving readable content and intended line breaks.
- **Acceptance criteria:**
  1. External formatting is removed.
  2. Hidden HTML does not become editor structure.
  3. Visible punctuation and symbols remain.
  4. Paste is undoable as a logical action where supported.

#### EDT-004 — Preserve Caret and Selection

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** Panel, overlay, analysis, and save-status interactions must not reset the caret or discard the last valid editor selection.
- **Acceptance criteria:**
  1. Opening the rhyme panel preserves the target.
  2. Activating thesaurus controls does not reset the caret to document start.
  3. Programmatic insertion restores a valid editor selection.
  4. Analysis completion does not move the caret.
  5. Theme changes do not move the caret.

#### EDT-005 — Support Undo and Redo

- **Status:** Implemented through browser editing behavior — verification incomplete
- **Priority:** Must Have
- **Requirement:** Standard undo and redo actions must work for lyric edits without treating overlay updates as content edits.
- **Acceptance criteria:**
  1. Typing can be undone.
  2. Paste can be undone.
  3. Programmatic rhyme insertion can be undone.
  4. Overlay updates create no undo entry.
  5. Undo does not apply another document’s content.

#### EDT-006 — Use Available Workspace Width

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** The editor must expand into available workspace width and shrink predictably when the rhyme panel is docked.
- **Acceptance criteria:**
  1. Wide layouts are not capped by the removed legacy writing-column limit.
  2. A docked panel reduces editor space without overlap.
  3. Closing the panel restores width.
  4. Medium viewports can shrink below the former fixed minimum.

### 17.5 Syllable Analysis

#### SYL-001 — Calculate Word-Level Syllables

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** Each analyzable word receives a syllable count derived from pronunciation data or documented heuristics.
- **Acceptance criteria:**
  1. Tokenization is deterministic for unchanged text.
  2. Pronunciation data is preferred where available.
  3. Heuristics are used as fallback.
  4. Analysis can run in a worker.
  5. Main-thread fallback remains available.

#### SYL-002 — Render Word Badges

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** Enabled word counts appear as inert badges associated with the correct word.
- **Acceptance criteria:**
  1. One badge appears per eligible token.
  2. Badges do not intercept editor input.
  3. Badges realign after resize, zoom, font, line-height, or panel changes.
  4. Badges do not overlap the preceding line within supported settings.
  5. Hidden badges do not change content.

#### SYL-003 — Represent Uncertain Counts

- **Status:** Missing or incomplete
- **Priority:** Should Have
- **Requirement:** The interface must distinguish dictionary-supported counts from heuristic or unknown results where confidence data is available.
- **Acceptance criteria:**
  1. Unsupported words are not presented as guaranteed pronunciation facts.
  2. Uncertainty is not represented only by color.
  3. Screen-reader text explains uncertainty.
  4. Line totals identify when they include estimates.

### 17.6 Line Totals

#### LIN-001 — Calculate One Total per Logical Line

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** Each logical lyric line displays no more than one total derived from canonical word counts.
- **Acceptance criteria:**
  1. Total equals the sum of that line’s word counts.
  2. Blank lines do not display a false non-zero value.
  3. Soft wrapping does not create duplicate totals.
  4. Re-analysis does not duplicate a total.

#### LIN-002 — Keep Totals Aligned

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** The line-total gutter stays aligned with editor lines during scrolling and layout changes.
- **Acceptance criteria:**
  1. Scrolling remains synchronized.
  2. Font changes trigger realignment.
  3. Panel resizing triggers realignment.
  4. Browser resizing triggers realignment.
  5. Virtualization does not assign a total to the wrong line.

### 17.7 Rhyme Decorations

#### RHY-001 — Build Deterministic Rhyme Families

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** The decoration engine must group repeated eligible rhyme keys deterministically.
- **Acceptance criteria:**
  1. Identical text and settings produce the same family IDs.
  2. A family is displayed only when its eligibility rules are satisfied.
  3. Stopword and internal-rhyme settings are respected.
  4. Unsupported pronunciation cases fail without damaging content.

#### RHY-002 — Preserve `focus` as the Default Highlight Mode

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** New and invalid settings use `focus` as the default rhyme-highlight mode.
- **Acceptance criteria:**
  1. New users receive `focus`.
  2. Invalid persisted modes fall back to `focus`.
  3. Valid `off`, `end`, `focus`, and `all` settings persist.
  4. Mode cycling follows the approved order.

#### RHY-003 — Render Every Eligible Decoration Token

- **Status:** Implemented — regression-sensitive
- **Priority:** Must Have
- **Requirement:** Every token included by the current highlight mode must receive its approved visual indicator.
- **Acceptance criteria:**
  1. Valid family data is not discarded by an unrelated rendering flag.
  2. Underlines remain visible when rhyme colors are hidden.
  3. Main writing mode does not cover words with opaque blocks.
  4. Geometry updates when the editor surface resizes.
  5. Decorations never enter lyric text.

Renderer fixtures:

- `mat / cat / rat`
- `glow / snow / show`
- `light / night / sight`
- `stone / alone / phone`
- `keep / deep / sleep`

#### RHY-004 — Separate Renderer and Engine Quality Tests

- **Status:** Partially implemented
- **Priority:** Must Have
- **Requirement:** Rendering tests must use confirmed or injected family data, while pronunciation-quality tests must evaluate family generation separately.
- **Acceptance criteria:**
  1. A renderer failure means eligible data was not painted.
  2. An engine failure means expected family data was not generated.
  3. `test / rest / best` is included in engine-quality testing.
  4. A failed engine expectation is not misreported as a renderer defect.

### 17.8 Rhyme Suggestions

#### SUG-001 — Resolve the Active Target

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** Suggestions must target the caret word, current line-ending word, or explicit search query according to the current mode.
- **Acceptance criteria:**
  1. The active target updates immediately.
  2. Moving the caret invalidates stale results.
  3. Typing a new word invalidates older in-flight requests.
  4. Outside-editor selection does not erase the last valid editor target.

#### SUG-002 — Prefer Local Suggestions

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** The local generated rhyme database is the preferred suggestion source.
- **Acceptance criteria:**
  1. Core lookup does not require an account.
  2. Local worker responses are cached.
  3. Versioned database assets fall back according to supported loader behavior.
  4. Local failure does not block editing.

#### SUG-003 — Use Online Fallback Safely

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** When local initialization fails, the application may send only the target query needed by approved online providers.
- **Acceptance criteria:**
  1. Full lyrics are never sent.
  2. Stale requests are canceled or ignored.
  3. Provider responses are validated and deduplicated.
  4. Failure is localized to the panel.
  5. Provider use is disclosed.

#### SUG-004 — Define Rhyme Filters Accurately

- **Status:** Implemented — product decision required
- **Priority:** Must Have
- **Requirement:** Filter names must accurately represent the categories produced by the current engine.
- **Current behavior:** Persisted filters are `perfect` and `near`; slant is not a separate first-class local mode.
- **Acceptance criteria:**
  1. The UI must not present three independent categories unless the engine supports them.
  2. If near and slant remain combined, the label must state that relationship clearly.
  3. Filter state persists.
  4. Filter state is exposed programmatically.

#### SUG-005 — Rank and Deduplicate Results

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** Results must be deterministically ranked and duplicate entries removed.
- **Acceptance criteria:**
  1. The target word is not returned as an accidental duplicate.
  2. Case variants are normalized.
  3. Result limits are enforced.
  4. A non-positive limit produces no results.

#### SUG-006 — Insert a Selected Suggestion

- **Status:** Implemented — exact product semantics need documentation
- **Priority:** Must Have
- **Requirement:** Pointer or keyboard activation inserts the selected suggestion using the approved editor insertion contract.
- **Acceptance criteria:**
  1. Enter activates the keyboard-selected result.
  2. Pointer activation produces the same content result.
  3. The last valid editor selection is restored.
  4. The insertion becomes an editor change and autosaves.
  5. The operation is undoable.
  6. It does not reset the caret to document start.

### 17.9 Rhyme Thesaurus

#### THS-001 — Explore Related Concepts

- **Status:** Implemented — verified in repository
- **Priority:** Should Have
- **Requirement:** The full rhyme panel may expose a collapsible thesaurus section with synonyms and related concepts.
- **Acceptance criteria:**
  1. The section exposes expanded state.
  2. Synonyms and related concepts are grouped.
  3. Results are normalized and deduplicated.
  4. Invalid multiword or punctuation-only entries are excluded according to current rules.
  5. Escape collapses the section.

#### THS-002 — Protect Request Lifecycle

- **Status:** Implemented — verified in repository
- **Priority:** Must Have for retained feature
- **Requirement:** Thesaurus requests must be debounced, abortable, cache-aware, and latest-request-wins.
- **Acceptance criteria:**
  1. New targets invalidate prior results.
  2. Disabled state cancels pending work.
  3. Same-target refresh remains possible.
  4. Strict Mode does not leak stale requests.
  5. Error and retry states remain inside the section.

#### THS-003 — Generate Rhymes for a Concept

- **Status:** Implemented — verification incomplete
- **Priority:** Should Have
- **Requirement:** Selecting a concept reuses the existing rhyme-suggestion pipeline.
- **Acceptance criteria:**
  1. Current rhyme filters are respected.
  2. Concept results do not overwrite the editor’s original target without an explicit state change.
  3. Inserted results use the same safe insertion path.
  4. Parent panel shortcuts do not hijack controls inside the thesaurus.

### 17.10 Rhyme Panel and Workspace Layout

#### PNL-001 — Toggle the Rhyme Panel

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** The user can open, close, or focus the rhyme panel using pointer input, command palette, or `Alt/Option+R`.
- **Acceptance criteria:**
  1. Panel state is accessible.
  2. Closing does not clear lyrics.
  3. Reopening refreshes current target state.
  4. Shortcut does not insert text.

#### PNL-002 — Dock or Float the Panel

- **Status:** Implemented — verification incomplete
- **Priority:** Should Have
- **Requirement:** The panel can be docked or detached as a floating panel within the Rhyme Lines application.
- **Acceptance criteria:**
  1. Detached does not mean a separate browser window.
  2. Position and size persist.
  3. Invalid geometry is corrected.
  4. Panel movement does not change editor selection.

#### PNL-003 — Preserve Editor Geometry

- **Status:** Implemented — regression-sensitive
- **Priority:** Must Have
- **Requirement:** Opening, closing, resizing, docking, or floating the panel must invalidate affected overlay geometry.
- **Acceptance criteria:**
  1. Rhyme indicators remeasure.
  2. Syllable badges remeasure.
  3. Active-line geometry remeasures.
  4. No polling or synchronous typing-path measurement is introduced.

### 17.11 Commands and Keyboard Shortcuts

#### CMD-001 — Provide the Command Palette

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** `Ctrl/Cmd+K` opens a keyboard-operable command palette.
- **Acceptance criteria:**
  1. Search filters commands.
  2. Arrow keys navigate.
  3. Enter activates.
  4. Escape closes.
  5. Focus returns logically.
  6. Disabled commands cannot execute.

#### CMD-002 — Preserve Current Default Shortcuts

- **Status:** Implemented — verified in repository
- **Priority:** Must Have

| Action | Windows/Linux | macOS |
|---|---|---|
| Command palette | `Ctrl+K` | `Cmd+K` |
| Theme toggle | `Ctrl+J` | `Cmd+J` |
| Export current draft | `Ctrl+S` | `Cmd+S` |
| New draft | `Ctrl+N` | `Cmd+N` |
| Go to workspace | `Ctrl+B` | `Cmd+B` |
| Toggle document sidebar | `Ctrl+\`` | `Cmd+\`` |
| Toggle or focus rhymes | `Alt+R` | `Option+R` |
| Cycle highlight mode | `Alt+H` | `Option+H` |
| Toggle syllables | `Alt+S` | `Option+S` |
| Close active panel/dialog | `Escape` | `Escape` |

#### CMD-003 — Avoid Shortcut Conflicts

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** Global shortcuts must not fire while the user is typing in an input-like control unless that control explicitly supports the shortcut.
- **Acceptance criteria:**
  1. Inputs, textareas, selects, contenteditable regions, searchboxes, comboboxes, and marked ignore regions are protected.
  2. Copy, paste, undo, and redo are never overridden.
  3. Every shortcut action has a pointer-accessible alternative.

### 17.12 Themes and Settings

#### SET-001 — Support Dark Theme

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** Dark theme must render all editor and workspace surfaces with readable controls, focus states, overlays, and text.

#### SET-002 — Repair Light Theme

- **Status:** Implemented — known defect
- **Priority:** Must Have
- **Requirement:** Light theme must be visually and functionally complete if it remains a supported setting.
- **Acceptance criteria:**
  1. Editor background and lyric text meet contrast requirements.
  2. Sidebar, toolbar, panels, dialogs, and menus use light-theme tokens.
  3. Syllable badges remain readable.
  4. Rhyme decorations remain distinguishable.
  5. Focus rings remain visible.
  6. No dark-only surface obscures content.
  7. Theme persists after refresh.

#### SET-003 — Support System Preference

- **Status:** Implemented — verification incomplete
- **Priority:** Should Have
- **Requirement:** System mode follows the operating-system preference and updates without corrupting the saved setting.
- **Acceptance criteria:**
  1. Saved value remains `system`.
  2. Effective theme follows system changes.
  3. No incorrect theme flash occurs beyond approved limitations.

#### SET-004 — Adjust Typography and Badge Size

- **Status:** Implemented — verification incomplete
- **Priority:** Should Have
- **Requirement:** The user can change supported font size, line height, and badge size.
- **Acceptance criteria:**
  1. Values remain within tested limits.
  2. Overlays remeasure.
  3. Preferences persist.
  4. Invalid values fall back independently.

#### SET-005 — Reset Preferences Safely

- **Status:** Partially implemented
- **Priority:** Should Have
- **Requirement:** A user-facing reset action must distinguish preference reset from lyric-data deletion.
- **Acceptance criteria:**
  1. Preference reset does not delete documents.
  2. Full data deletion requires separate confirmation.
  3. Legacy keys are also cleared where appropriate.
  4. Consequences are stated before confirmation.

### 17.13 Saving and Persistence

#### PER-001 — Autosave Lyric Changes

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** Lyric and document metadata changes are persisted locally without manual save.
- **Acceptance criteria:**
  1. Typing triggers persistence.
  2. Rename, pin, order, and deletion trigger persistence.
  3. Rapid changes are debounced without losing the latest state.
  4. Refresh restores successful saves.

#### PER-002 — Display Accurate Save Status

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** The interface distinguishes active saving, successful save, and failure.
- **Acceptance criteria:**
  1. Failed storage is never labeled saved.
  2. Routine success is subtle.
  3. Failure remains visible until resolved or acknowledged.
  4. Important failures are announced accessibly.

#### PER-003 — Restore Versioned Data

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** Current and supported legacy document, settings, and panel records are read through version-aware migration.
- **Acceptance criteria:**
  1. Missing pin state defaults false.
  2. Missing position receives a deterministic fallback.
  3. Invalid settings are corrected individually.
  4. Legacy keys do not continue overriding current values after migration.
  5. One invalid preference does not prevent valid documents from loading.

#### PER-004 — Handle Unavailable or Full Storage

- **Status:** Partially implemented
- **Priority:** Must Have
- **Requirement:** The application remains usable in a clearly identified unsaved state when local persistence is unavailable.
- **Acceptance criteria:**
  1. Editing remains possible where safe.
  2. The interface explains that changes are not being preserved.
  3. Export remains available as a recovery path.
  4. Retry is available when meaningful.
  5. Invalid data is not silently deleted.

#### PER-005 — Preserve Zero-Document Persistence

- **Status:** Required change
- **Priority:** Must Have
- **Requirement:** An empty document collection is valid persisted data and must not be normalized into a replacement draft.
- **Acceptance criteria:**
  1. Empty collections hydrate to zero tabs.
  2. Active ID is null or empty according to the approved schema.
  3. Startup displays the zero-document state.
  4. Old non-empty collections continue migrating correctly.

### 17.14 Export

#### EXP-001 — Export TXT

- **Status:** Implemented — verified in repository
- **Priority:** Must Have
- **Requirement:** The selected document can be exported as UTF-8 `.txt`.
- **Acceptance criteria:**
  1. Only lyric text is included.
  2. Line breaks are preserved.
  3. Unicode is preserved.
  4. The filename is sanitized.
  5. `Ctrl/Cmd+S` does not invoke browser page-save behavior.

#### EXP-002 — Export Markdown

- **Status:** Missing
- **Priority:** Must Have
- **Requirement:** The selected document can be exported as UTF-8 `.md`.
- **Acceptance criteria:**
  1. Lyric lines are preserved.
  2. No analysis markup is added.
  3. Existing Markdown-like lyric characters are not escaped unnecessarily.
  4. The filename uses `.md`.
  5. The user can identify the chosen format.

#### EXP-003 — Communicate Export Result

- **Status:** Verification incomplete
- **Priority:** Must Have
- **Requirement:** Export success or failure is communicated without moving editor focus unnecessarily.
- **Acceptance criteria:**
  1. Success produces brief feedback.
  2. Browser-blocked export produces an actionable failure.
  3. No selected document disables export.

### 17.15 Empty, Loading, and Error States

#### STA-001 — Zero-Document Empty State

- **Status:** Missing
- **Priority:** Must Have
- **Requirement:** A valid no-document workspace displays a centered creation action.
- **Acceptance criteria:**
  1. The workspace displays Create New with a plus icon.
  2. The action has an accessible label.
  3. Sidebar shows no placeholder document.
  4. Rename, delete, and export are unavailable.
  5. Refresh preserves the state.

#### STA-002 — Blank-Document State

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** A selected document with empty content displays an editable surface rather than the zero-document state.
- **Acceptance criteria:**
  1. Placeholder text is not stored.
  2. Analysis does not display fabricated values.
  3. Typing removes placeholder guidance.
  4. Blank and no-document states remain distinct.

#### STA-003 — Localize Feature Failures

- **Status:** Partially implemented
- **Priority:** Must Have
- **Requirement:** Errors appear in the feature they affect.
- **Acceptance criteria:**
  1. Rhyme errors appear in the rhyme panel.
  2. Thesaurus errors appear in its section.
  3. Save errors appear near save status.
  4. Export errors appear near export feedback.
  5. One feature error does not replace the entire editor.

### 17.16 Responsive Behavior

#### RSP-001 — Desktop Layout

- **Status:** Implemented — verification incomplete
- **Priority:** Must Have
- **Requirement:** Desktop layouts support sidebar, editor, docked/floating rhyme panel, line totals, and overlays without overlap.

#### RSP-002 — Tablet and Narrow-Window Layout

- **Status:** Partially implemented
- **Priority:** Must Have
- **Requirement:** At reduced width, optional surfaces collapse or overlay rather than compressing the writing surface below a usable width.
- **Acceptance criteria:**
  1. The editor remains reachable.
  2. Controls do not cover the caret.
  3. Panel geometry adapts.
  4. Content and selection survive orientation or resize.

#### RSP-003 — Mobile-Core Behavior

- **Status:** Future/partial
- **Priority:** Should Have
- **Requirement:** Supported phone-width layouts must at minimum allow project selection, text editing, local saving, and access to suggestions.
- **Not required:** Free-position panel dragging, desktop gutter parity, or full dashboard parity.

---

## 18. User Stories and Acceptance Criteria

### US-001 — Start a Project

> As a songwriter, I want to start a project from the dashboard so that I can begin a new lyric without configuring the workspace.

1. Given the dashboard, when New Project is activated, one project is created.
2. The project editor route opens.
3. The sidebar is initially closed.
4. Focus moves to the writing surface.
5. The project persists after the first successful save.

### US-002 — Organize Documents

> As a songwriter, I want to rename, pin, and reorder documents so that important drafts remain easy to find.

1. Rename supports pointer and keyboard.
2. Titles are trimmed and limited to 100 characters.
3. Pinning moves a document into the pinned group.
4. Reordering works by pointer and Alt+Arrow.
5. All changes persist.

### US-003 — Delete the Final Document

> As a songwriter, I want to delete the last remaining document so that I can intentionally return the workspace to an empty state.

1. Deletion requires confirmation.
2. No replacement is created.
3. The active ID becomes empty.
4. The centered Create New action appears.
5. Refresh preserves the empty state.
6. Creating a document restores the editor.

### US-004 — Preserve Lyric Content

> As a lyricist, I want punctuation, spacing, Unicode, emojis, and line breaks preserved so that Rhyme Lines never changes the meaning or structure of my lyrics.

1. Typed and pasted content remains plain text.
2. Blank lines persist.
3. Unicode persists.
4. Overlays are excluded from copy and export.
5. Reloaded content matches the last successful save.

### US-005 — Review Syllables

> As a songwriter, I want word counts and line totals so that I can compare cadence.

1. One badge appears per eligible word.
2. One total appears per logical line.
3. Wrapped lines do not create extra totals.
4. Overlays stay aligned after layout changes.
5. Counts can be hidden.

### US-006 — Review Rhyme Structure

> As a songwriter, I want rhyme families highlighted so that I can see repeated sound patterns.

1. `focus` is the default mode.
2. Eligible tokens render their indicator.
3. Hidden colors retain a non-color indicator.
4. Decorations do not enter lyric content.
5. Renderer tests are independent of pronunciation tests.

### US-007 — Get Current Suggestions

> As a songwriter, I want suggestions to follow my caret so that I do not see results for an older word.

1. Current target updates immediately.
2. Superseded requests cannot commit results.
3. Local lookup is preferred.
4. Online failure does not block editing.
5. Keyboard and pointer insertion preserve selection.

### US-008 — Explore Related Meaning

> As a songwriter, I want synonyms and related concepts so that I can find a word that fits both meaning and rhyme.

1. Thesaurus groups are labeled.
2. Results are deduplicated.
3. Selecting a concept loads its rhymes.
4. Stale results cannot replace the current concept.
5. Errors are retryable.

### US-009 — Trust Autosave

> As a songwriter, I want an accurate save indicator so that I know whether closing the browser will preserve my lyrics.

1. Saving, saved, and failed states are distinguishable.
2. Failed saves are not labeled successful.
3. Successfully saved text restores after refresh.
4. Storage failure provides an export recovery path.

### US-010 — Use Light or Dark Appearance

> As a writer, I want supported themes to render correctly so that I can write in different lighting conditions.

1. Dark theme passes visual requirements.
2. Light theme passes the same functional requirements.
3. System mode follows the operating-system preference.
4. Focus and analysis indicators remain visible.

### US-011 — Export a Draft

> As a writer, I want TXT and Markdown exports so that I can use my lyrics outside Rhyme Lines.

1. Both formats preserve lyric content.
2. No overlay data is included.
3. Filenames are valid.
4. Export result is communicated.

### US-012 — Work by Keyboard

> As a keyboard-first writer, I want complete access to documents, settings, rhymes, and export without relying on a mouse.

1. Core controls are reachable.
2. Focus is visible.
3. Dialogs restore focus.
4. Shortcuts do not fire in protected inputs.
5. Every shortcut has an alternate control.

---

## 19. Accessibility Requirements

### ACC-001 — Keyboard Operation

- Every core action must be keyboard-operable.
- Drag-and-drop must have a keyboard alternative.
- No interface may create an unintended focus trap.

### ACC-002 — Visible and Logical Focus

- Focus must be visible in dark and light themes.
- Opening an overlay moves focus according to its pattern.
- Closing restores focus to the invoker or editor.
- Deleting a focused document moves focus predictably.

### ACC-003 — Semantic States

Buttons, dialogs, menus, filters, selected documents, pinned documents, and panel toggles must expose programmatic names and states.

### ACC-004 — Accessible Destructive Confirmation

- Confirmation identifies the target.
- Cancel receives safe focus.
- Escape cancels.
- Focus returns to the appropriate document row or empty-state action.

### ACC-005 — Non-Color Indicators

- Rhyme families must retain underline, pattern, label, or another non-color distinction.
- Uncertain counts require a non-color cue.
- Active and selected states must remain understandable without hue.

### ACC-006 — Contrast

Recommended target: WCAG 2.2 AA.

Text, focus rings, controls, badges, and decorations must meet approved contrast requirements.

### ACC-007 — Screen-Reader Announcements

- Save failure, document creation, deletion, and active feature failure must be announced.
- Routine successful autosave must not announce on every keystroke.

### ACC-008 — Zoom and Reduced Motion

- The application must remain usable at 200% browser zoom.
- Overlays must realign.
- Non-essential motion must respect reduced-motion preferences.

### ACC-009 — Screen-Reader Release Testing

Before release, complete manual testing with at least:

- NVDA or JAWS with a supported Windows browser
- VoiceOver with Safari on macOS

Document known limitations.

---

## 20. Performance Requirements

### PERF-001 — Non-Blocking Typing

Text entry must not wait for analysis or network work.

Proposed target: typical editor processing attributable to a keystroke below 10 milliseconds on an approved reference device. The target is not confirmed until a benchmark method and result are documented.

### PERF-002 — Debounced Analysis

- Typing analysis default: 250 milliseconds.
- Caret-triggered refresh default: 50 milliseconds.
- Stale work must be canceled or ignored.

### PERF-003 — Avoid Duplicate Visual Output

- One badge per word.
- One total per logical line.
- One active indicator per enabled decoration layer.
- Newer analysis always wins over stale analysis.

### PERF-004 — Large Documents

Recommended baseline: 10,000 words.

Text editing must remain available if analysis is deferred. Viewport-aware measurement may be used. Partial analysis must not be represented as complete.

### PERF-005 — Layout Invalidation

- ResizeObserver and existing measurement invalidation paths should be reused.
- No polling should be added.
- Expensive synchronous layout measurement must not be added to the typing path.

---

## 21. Reliability and Data-Persistence Requirements

### REL-001 — Content Integrity

A successfully persisted document must restore with equivalent plain-text content and logical line boundaries.

### REL-002 — Feature-Failure Isolation

- Rhyme failure does not stop editing.
- Thesaurus failure does not stop ordinary suggestions.
- Analytics failure does not stop saving.
- Invalid panel geometry does not invalidate documents.
- Light-theme styling failure must not hide or destroy text.

### REL-003 — Schema Compatibility

- Persisted records include a supported version.
- Migrations preserve valid lyrics.
- Unsupported records produce recovery behavior.
- Original data is not silently overwritten after a failed migration.

### REL-004 — Destructive-Action Policy

For this release:

- Individual deletion requires confirmation.
- Final-document deletion is allowed.
- No automatic replacement is created.
- Deleted sidebar documents are permanent unless a separate trash workflow is explicitly selected.

### REL-005 — Release-Green Baseline

Release is blocked until:

- Lint exits successfully.
- Type checking exits successfully.
- Jest exits successfully.
- Production build exits successfully.
- Critical Playwright flows execute successfully in a supported browser.
- No known fatal data-loss defect remains.

---

## 22. Privacy and Security Considerations

### PRI-001 — Local Lyric Storage

Documents remain in browser local storage for the MVP.

### PRI-002 — Online Query Minimization

Only the minimum target word or concept query may be sent to approved providers. Full documents and titles must not be sent.

### PRI-003 — No Lyric Analytics

Analytics must not include:

- Lyric text
- Document titles
- Clipboard contents
- Search text where it contains user lyrics
- Rhyme target words
- Exported contents

### PRI-004 — External-Service Disclosure

The product must disclose that online fallback or thesaurus behavior may send an individual query word to an external provider.

### PRI-005 — Secrets

Provider secrets must not be shipped in client code. Proxy routes must validate inputs and responses.

### PRI-006 — Data Deletion

Preference reset and lyric deletion must remain separate. Full local-data deletion requires explicit confirmation.

---

## 23. Analytics and Success Metrics

### 23.1 Current State

No configured third-party analytics service is currently part of the repository. Existing analytics-style events should be treated as instrumentation hooks, not proof that metrics are being collected.

### 23.2 Proposed Events

- Dashboard opened
- New project created
- Project resumed
- Editor loaded
- First persisted edit
- Document created, renamed, pinned, reordered, or deleted
- Final document deleted
- Rhyme panel opened
- Rhyme filter changed
- Thesaurus opened
- Theme changed
- Export completed
- Save failed
- Rhyme provider failed
- Fatal error occurred

### 23.3 Prohibited Properties

No event may contain raw lyric or title content.

### 23.4 Proposed Success Measures

- Activation: first persisted edit
- Reliability: successful restoration after reload
- Retention: seven-day return rate
- Feature adoption: rhyme, syllable, command, thesaurus, and export use
- Quality: save failures, provider failures, fatal errors, and E2E regression rates

---

## 24. Testing Strategy

### 24.1 Unit Tests

Required coverage:

- Empty document collection
- Final-document deletion
- Adjacent selection after deletion
- Title normalization and 100-character limit
- Pin and order logic
- Migration of pin and order metadata
- Theme fallback
- Syllable tokenization
- Line-total aggregation
- Rhyme-family generation
- Renderer eligibility
- Filter taxonomy
- Stale request protection
- Thesaurus normalization and request lifecycle
- TXT and Markdown serialization
- Dashboard metric formula
- Filename sanitation

### 24.2 Integration Tests

Required coverage:

- Dashboard New Project to project route
- Route ID to selected document
- Editor changes to persistence
- Persistence to restoration
- Document actions to persisted order
- Final deletion to zero-document UI
- Caret to suggestion target
- Panel interaction to preserved selection
- Theme to complete editor rendering
- Settings changes to overlay realignment
- Storage errors to failed-save status

### 24.3 Critical Playwright Flows

1. Create a project from the dashboard.
2. Verify first editor entry has a closed sidebar.
3. Type punctuation, Unicode, emojis, and multiple lines.
4. Refresh and verify exact content.
5. Create, rename, pin, reorder, and delete documents.
6. Delete the final document.
7. Refresh and verify the zero-document state.
8. Create a document from the empty state.
9. Toggle syllables and line totals.
10. Verify rhyme indicators with confirmed families.
11. Move the caret rapidly and verify current suggestions.
12. Insert a suggestion by keyboard.
13. Open and use the rhyme thesaurus.
14. Dock, float, resize, and reopen the rhyme panel.
15. Switch dark, light, and system themes.
16. Export TXT.
17. Export Markdown.
18. Simulate storage failure.
19. Simulate local rhyme DB failure and online fallback.
20. Complete core actions by keyboard only.

### 24.4 Regression-Sensitive Fixtures

Editor fidelity fixture must include uppercase and lowercase, numbers, straight and curly quotes, apostrophes, grouping punctuation, hyphens, en/em dashes, ellipses, slashes, symbols, emojis, blank lines, long lines, and unusual whitespace.

Renderer fixtures:

- `mat cat rat`
- `glow snow show`
- `light night sight`
- `stone alone phone`
- `keep deep sleep`

Engine-quality fixtures:

- `test rest best`
- Multi-syllable words
- Proper nouns
- Slang
- Compounds
- Alternate pronunciations

### 24.5 Accessibility Testing

- Automated scan
- Keyboard-only pass
- Screen-reader pass
- 200% zoom
- Reduced motion
- Light and dark contrast review
- Forced-colors review where supported
- Touch-target review on supported narrow layouts

### 24.6 Continuous Integration

A GitHub Actions workflow must run, at minimum:

1. Dependency installation
2. Rhyme DB build and validation
3. ESLint
4. `tsc --noEmit` or an equivalent typecheck script
5. Jest
6. Production build
7. Critical Playwright tests with installed Chromium

A failing required check must block release.

---

## 25. Release Criteria

The release is complete only when:

1. Every Must Have requirement is implemented or formally removed.
2. The final document can be deleted without creating a replacement.
3. The zero-document state survives refresh.
4. The sidebar begins closed on first editor entry.
5. Light theme is repaired or formally removed through an approved scope decision.
6. Dashboard rhyme-density behavior and tests agree.
7. TXT export passes content-fidelity tests.
8. Markdown export is implemented and tested.
9. Rhyme filters use accurate terminology.
10. Renderer and pronunciation tests are separated.
11. Save failures are visible and accurate.
12. Invalid local data cannot silently erase valid lyrics.
13. Core keyboard flows pass.
14. Screen-reader testing is completed.
15. Desktop, tablet, and approved narrow-width layouts pass.
16. Lint passes.
17. Type checking passes.
18. Jest passes.
19. Production build passes.
20. Critical Playwright flows pass in CI.
21. No open release-blocking issue remains.
22. No analytics payload contains lyrics or titles.
23. Known limitations are documented.
24. The deployment and rollback process is documented.

---

## 26. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Final deletion recreates a document | High | High | Change empty-collection normalization and add E2E coverage |
| Sidebar first state conflicts with intended UX | High | Medium | Define first-entry state separately from restored preference |
| Light theme hides or misstyles editor UI | High | High | Resolve issue #117 and add visual tests |
| Rhyme decorations disagree with suggestions | High | Medium | Separate systems in UI copy and improve shared pronunciation coverage |
| Dashboard metrics remain inconsistent | High | Medium | Approve metric formula and update implementation/tests together |
| Overlay geometry becomes stale | Medium | High | Reuse resize invalidation and visual regression tests |
| Badges overlap neighboring lines | Medium | Medium | Test typography bounds and zoom |
| Stale suggestions appear | Low | High | Preserve request-version, abort, and request-key protections |
| Local storage reaches quota | Medium | High | Accurate failed-save state and export recovery |
| Markdown export changes lyric syntax | Medium | Medium | Export raw plain text with `.md` extension unless formatting is approved |
| E2E specs remain unexecuted | High | High | Install browsers in CI and block release on critical flows |
| No CI permits regression merges | High | High | Add required GitHub Actions checks |
| Online providers expose query words | Medium | Medium | Query minimization and disclosure |
| Mobile UI compresses desktop panels | High | Medium | Use alternate panel presentation and limit parity claims |
| Accessibility appears complete from ARIA alone | High | High | Require manual screen-reader and keyboard testing |
| Large drafts degrade overlay performance | Medium | Medium | Viewport processing, profiling, and non-blocking analysis |
| Ambiguous suggestion insertion surprises users | Medium | Medium | Document current behavior and resolve insertion-mode decision |

---

## 27. Open Questions and Decisions Needed

### OQ-001 — Suggestion Insertion Behavior

- **Question:** Does activation insert at the caret, replace the target word, or provide both?
- **Recommended default:** Replace the detected target when valid; otherwise insert at the caret, with undo support.
- **Other options:** Always insert; explicit Insert and Replace actions.

### OQ-002 — Rhyme Taxonomy

- **Question:** Should the release expose Perfect plus Near/Slant, or separate Perfect, Near, and Slant?
- **Recommended default:** Use Perfect and Near/Slant for this release; separate slant only after independent scoring is implemented.

### OQ-003 — Light and System Themes

- **Question:** Should all three current theme settings remain?
- **Recommended default:** Keep dark, light, and system and fix the defect.
- **Other option:** Make the product intentionally dark-only.

### OQ-004 — Sidebar Preference After First Entry

- **Question:** After the first editor entry, should open/closed state persist?
- **Recommended default:** Yes. First entry defaults closed; later entries restore the user’s choice.

### OQ-005 — Deleted-Document Recovery

- **Question:** Is sidebar deletion permanently destructive?
- **Recommended default:** Keep confirmation-based permanent deletion for MVP.

### OQ-006 — Markdown Semantics

- **Question:** Is Markdown export simply lyric text saved as `.md`, or should it add a title heading or section formatting?
- **Recommended default:** Preserve raw lyric content exactly and change only the extension.

### OQ-007 — Dashboard Metric Formula

- **Question:** What exactly does rhyme density measure?
- **Recommended default:** Number of eligible rhyming line endings divided by eligible non-empty line endings.

### OQ-008 — Mobile Support Floor

- **Question:** What minimum viewport and mobile browser set are supported?
- **Recommended default:** Core editing support on current iOS Safari and Android Chrome; no full panel-dragging parity.

### OQ-009 — Analytics Integration

- **Question:** Should a third-party analytics service ship in the MVP?
- **Recommended default:** Defer until after core release stability unless launch metrics are essential.

### OQ-010 — Product Branding

- **Question:** Is the official display name “Rhyme Lines” or “RhymeLines”?
- **Recommended default:** Rhyme Lines, matching the repository.

---

## 28. Future Considerations

- Authentication
- Cloud synchronization
- Cross-device restoration
- Version history
- Trash and restore
- Collaboration
- Comments
- CRDT-based shared editing
- Custom rhyme dictionaries
- Pronunciation overrides
- Expanded offline rhyme database
- First-class slant scoring
- Meter and stress analysis
- Song-section labels
- Document folders
- Cross-document search
- Import formats
- Export all projects
- PDF export
- Progressive web application support
- Encrypted cloud backup
- Audio or beat alignment
- Optional AI assistance under explicit privacy controls
- Full mobile authoring parity

---

## 29. Requirement Traceability Matrix

| ID | Feature | Current status | Priority | Primary tests |
|---|---|---|---|---|
| DSH-001 | Dashboard | Implemented, verify | Must | Integration, E2E |
| DSH-002 | Start/resume project | Implemented, verify | Must | Integration, E2E |
| DSH-003 | Project metrics | Known defect | Must | Unit, integration |
| DOC-001 | Create document | Implemented | Must | Store, E2E |
| DOC-002 | Select document | Implemented | Must | Integration, E2E |
| DOC-003 | Rename document | Implemented | Must | Component, E2E |
| DOC-004 | Pin document | Implemented | Should | Store, E2E |
| DOC-005 | Reorder documents | Implemented | Should | Store, E2E |
| DOC-006 | Confirm deletion | Implemented | Must | Component, E2E |
| DOC-007 | Zero-document state | Required change | Must | Store, integration, E2E |
| SID-001 | First-entry closed state | Required change | Must | Component, E2E |
| SID-002 | Sidebar toggle | Adjust existing | Must | Component, E2E |
| SID-003 | Long document list | Verify | Must | E2E, exploratory |
| EDT-001 | Plain-text authority | Implemented | Must | Unit, integration |
| EDT-002 | Content fidelity | Verify | Must | Integration, E2E |
| EDT-003 | Paste normalization | Implemented | Must | Integration, E2E |
| EDT-004 | Caret preservation | Implemented | Must | Unit, integration |
| EDT-005 | Undo/redo | Verify | Must | E2E |
| EDT-006 | Fluid layout | Implemented, verify | Must | E2E |
| SYL-001 | Syllable calculation | Implemented | Must | Unit |
| SYL-002 | Badge rendering | Verify | Must | Visual, E2E |
| SYL-003 | Uncertainty | Missing/incomplete | Should | Unit, accessibility |
| LIN-001 | Line totals | Implemented | Must | Unit, E2E |
| LIN-002 | Gutter alignment | Verify | Must | Visual, E2E |
| RHY-001 | Rhyme families | Implemented | Must | Unit, corpus |
| RHY-002 | Focus default | Implemented | Must | Store, settings |
| RHY-003 | Decoration rendering | Regression-sensitive | Must | Renderer, visual |
| RHY-004 | Test separation | Partial | Must | Unit suites |
| SUG-001 | Current target | Implemented | Must | Hook, E2E |
| SUG-002 | Local lookup | Implemented | Must | Worker, integration |
| SUG-003 | Online fallback | Verify | Must | Integration |
| SUG-004 | Filter taxonomy | Decision needed | Must | Unit, UI |
| SUG-005 | Ranking/deduplication | Implemented, verify | Must | Unit |
| SUG-006 | Suggestion insertion | Implemented, clarify | Must | Integration, E2E |
| THS-001 | Thesaurus concepts | Implemented | Should | Unit, component |
| THS-002 | Thesaurus lifecycle | Implemented | Must if retained | Hook |
| THS-003 | Concept rhymes | Verify | Should | Integration |
| PNL-001 | Toggle panel | Implemented | Must | Component, E2E |
| PNL-002 | Dock/float | Implemented, verify | Should | E2E |
| PNL-003 | Geometry update | Implemented | Must | Hook, visual |
| CMD-001 | Command palette | Implemented | Must | Component, E2E |
| CMD-002 | Shortcuts | Implemented | Must | Unit, E2E |
| CMD-003 | Shortcut guards | Implemented | Must | Unit, accessibility |
| SET-001 | Dark theme | Implemented | Must | Visual |
| SET-002 | Light theme | Known defect | Must | Visual, E2E |
| SET-003 | System theme | Verify | Should | Integration |
| SET-004 | Typography settings | Implemented, verify | Should | Visual |
| SET-005 | Safe reset | Partial | Should | Integration |
| PER-001 | Autosave | Implemented | Must | Integration, E2E |
| PER-002 | Save status | Verify | Must | Component, E2E |
| PER-003 | Migrations | Implemented | Must | Unit |
| PER-004 | Storage failure | Partial | Must | Integration, E2E |
| PER-005 | Empty collection | Required change | Must | Unit, E2E |
| EXP-001 | TXT export | Implemented | Must | Unit, E2E |
| EXP-002 | Markdown export | Missing | Must | Unit, E2E |
| EXP-003 | Export feedback | Verify | Must | Integration |
| STA-001 | Zero-document UI | Missing | Must | Component, E2E |
| STA-002 | Blank document | Implemented, verify | Must | Integration |
| STA-003 | Localized errors | Partial | Must | Integration |
| RSP-001 | Desktop | Implemented, verify | Must | E2E |
| RSP-002 | Tablet/narrow | Partial | Must | Responsive E2E |
| RSP-003 | Mobile core | Partial/future | Should | Mobile E2E |
| ACC-001–009 | Accessibility | Partial | Must | Automated and manual |
| PERF-001–005 | Performance | Partial/implemented | Must | Benchmarks, regression |
| REL-001–005 | Reliability | Partial | Must | CI and E2E |
| PRI-001–006 | Privacy/security | Partial | Must | Review and integration |

---

## 30. Glossary

- **Active document:** The document currently displayed and edited.
- **Analysis overlay:** A non-editable visual layer containing syllable badges, line totals, rhyme decorations, or active-line visuals.
- **Autosave:** Automatic local persistence after document or supported metadata changes.
- **Blank document:** An existing selected document containing no visible lyric text.
- **Dashboard:** The root workspace used to create and resume projects.
- **Detached panel:** A floating rhyme panel inside the application window, not a separate browser window.
- **Document:** A local lyric project or draft identified by a stable ID.
- **Document order:** The saved sequence of documents within pinned and unpinned groups.
- **End word:** The last eligible word-like token in a logical line.
- **Focus rhyme mode:** The default highlight mode that emphasizes the family associated with the current editor context.
- **Line total:** The sum of analyzed syllables for one logical line.
- **Logical line:** Text between explicit newline boundaries. Visual wrapping does not create another logical line.
- **Near/slant rhyme:** The current broader suggestion category for non-perfect sound similarity until separate near and slant scoring is approved.
- **Perfect rhyme:** A rhyme classified by the approved terminal stressed-vowel and ending-sound rules.
- **Pinned document:** A document displayed before the unpinned group.
- **Project:** The dashboard-level representation of a locally stored lyric document.
- **Quick assist:** A compact suggestion surface available when the full rhyme panel is hidden.
- **Rhyme decoration:** A non-editable visual indicator attached to an eligible rhyming token.
- **Rhyme family:** A group of repeated eligible tokens that share a decoration rhyme key.
- **Rhyme suggestion:** A ranked candidate generated for the caret, line-ending, search, or thesaurus-concept target.
- **Rhyme thesaurus:** The panel section that retrieves synonyms and related concepts and then uses the rhyme pipeline for a selected concept.
- **Selected document:** The document whose content is currently loaded in the editor.
- **Syllable badge:** An inert word-level count displayed above or near an editor token.
- **Target word:** The word or query currently driving rhyme suggestions.
- **Untitled:** The default valid document title.
- **Zero-document state:** A valid persisted workspace with no documents and no selected document.
