# Rhyme Lines

Rhyme Lines is a local-first lyric and poetry editor for drafting lines with syllable analysis, rhyme highlighting, rhyme suggestions, autosave, and keyboard-first navigation.

A distraction-free lyric editor with real-time syllable analysis, rhyme tools, autosave, and a keyboard-first workflow.

<!-- Future screenshot: add an editor preview asset here when the repository contains one. -->

## Overview

Rhyme Lines is built for rappers, songwriters, poets, and anyone drafting line-based writing where rhythm and rhyme matter. The app centers the writing surface and keeps assistance contextual: syllable badges and line totals are rendered as overlays, rhyme families are highlighted quietly, and suggestions can appear as either a quick assist or a docked/detached panel.

The current implementation is a browser-based Next.js app. It stores drafts and preferences in `localStorage`, generates a static rhyme database from a local CMUdict-style source, and can fall back to online rhyme providers when the local rhyme database is unavailable.

## Current Features

### Editor

- Distraction-focused editor route at `/editor` and project-specific editor route at `/editor/[id]`.
- Content-editable lyric surface with stable per-line DOM structure and line IDs.
- Current-line highlighting that follows the caret.
- Multiple local drafts with an editor sidebar, active-draft routing, draft creation, renaming, and close/discard handling.
- Workspace/dashboard launchpad for continuing recent drafts or starting new ones.
- Paste normalization for plain lyric text.
- Responsive shell with a collapsible document sidebar on large screens.

### Syllable Analysis

- Word-level syllable badges rendered in an inert overlay above the editor text.
- Line-level syllable totals stored as line data attributes and displayed by editor styling.
- Tokenization that keeps analysis deterministic from line text.
- Pronunciation overrides and a small in-code CMU-style pronunciation map for selected words.
- Heuristic fallback syllable counting for words not covered by pronunciation data.
- Web Worker analysis path with main-thread fallback when workers are unavailable.
- Debounced analysis: 250 ms for typing updates and 50 ms for caret-triggered updates.

### Rhyme Tools

- Rhyme-family decorations for matching rhyme keys, rendered separately from the editable input layer.
- Highlight modes: off, end words, focused family, and all families.
- Settings for internal rhymes, stopword highlighting, hiding colorful words, and a development-only rhyme debug overlay.
- Rhyme suggestion panel with caret-target and line-ending targets.
- Search input for explicit rhyme queries.
- Perfect and near/slant filters.
- Advanced filters for multi-syllable perfect rhymes and common-words-only results.
- Quick-assist rhyme suggestions when the full panel is hidden and a target word is available.
- Docked and detached/resizable rhyme panel state.
- Suggestion insertion into the editor by click or keyboard selection.

### Persistence and Export

- Local draft persistence in `localStorage` under versioned `rhyme-lines:persist:*` keys.
- Debounced draft persistence from the tab store and a separate autosave status flow for text edits.
- Persisted settings for theme, editor typography, badge sizing, line totals, rhyme decorations, rhyme filters, highlight options, and debounce mode.
- Persisted rhyme panel visibility, detached state, size, position, selected index, syllable filter, and multi-syllable setting.
- Local migrations from older storage keys and invalid-settings cleanup for malformed payloads.
- Plain-text export of the active draft as a `.txt` file.

### Customization and Accessibility

- Dark, light, and system theme preferences.
- Font-size, line-height, and syllable-badge size controls.
- Toggleable line totals and rhyme decorations.
- Keyboard-accessible command palette and settings dialog.
- ARIA labels, hidden instructions, live autosave announcements, and focus-visible styles on interactive controls.
- Reduced-motion handling in animated UI pieces.

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
| --- | --- | --- |
| Open command palette | `Ctrl` + `K` | `⌘` + `K` |
| Toggle theme | `Ctrl` + `J` | `⌘` + `J` |
| Export current draft as `.txt` | `Ctrl` + `S` | `⌘` + `S` |
| Create a new draft | `Ctrl` + `N` | `⌘` + `N` |
| Go to workspace | `Ctrl` + `B` | `⌘` + `B` |
| Collapse or expand editor documents sidebar | `Ctrl` + `` ` `` | `⌘` + `` ` `` |
| Toggle or focus rhyme panel | `Alt` + `R` | `Option` + `R` |
| Cycle rhyme highlight mode | `Alt` + `H` | `Option` + `H` |
| Toggle syllable overlays | `Alt` + `S` | `Option` + `S` |
| Close panels/dialogs | `Esc` | `Esc` |
| Move through command palette or rhyme suggestions | `↑` / `↓` | `↑` / `↓` |
| Run command or insert selected rhyme suggestion | `Enter` | `Enter` |

Shortcuts are implemented in code and are not currently user-customizable, despite a placeholder field in the persisted settings schema.

## How Rhyme Analysis Works

Rhyme Lines has two related but separate rhyme systems:

1. **Editor decorations** tokenize each line, normalize word-like tokens, compute a pronunciation or spelling-based rhyme key, group tokens that share a key, and render eligible families through an overlay. The editable DOM remains the raw input layer; highlights are painted separately so decorative elements do not become editable text or screen-reader content.
2. **Rhyme suggestions** identify the caret word, the current line-ending word, or a user-entered query. The app prefers the local rhyme database built from `data/cmudict/cmudict.dict`. A rhyme Web Worker loads `/rhyme-db/rhyme-db.v2.json` and can fall back to v1 assets if needed. Results are cached in the worker, ranked by syllable distance, rhyme score, quality tier, frequency, and spelling rules, then filtered by the UI settings.

Syllable analysis follows a similar pipeline: editor lines are tokenized, tokens are normalized for pronunciation-only transforms, syllables are counted with pronunciation data and heuristics, and derived word/line metadata is returned to overlays.

When the preferred local rhyme source cannot initialize, suggestion lookup falls back to online providers. The implemented online providers are Datamuse and RhymeBrain. A Wordnik proxy route exists, but it requires `WORDNIK_API_KEY` and is not wired into the active provider list used by the suggestion panel.

**Limitations:** pronunciation dictionaries and spelling heuristics cannot perfectly classify every proper noun, slang term, compound word, alternate pronunciation, or human-expected rhyme family. The decoration system and suggestion system also use different data paths, so available suggestion data does not guarantee that the editor overlay will group or underline the same words.

## Architecture

```text
Dashboard / Editor Routes
    ↓
Zustand stores (drafts, settings, panel state)
    ↓
ContentEditable editor input layer
    ↓
Line normalization + serialized draft text
    ↓
Debounced syllable analysis worker
    ↓
Derived word syllables + line totals
    ↓
Inert overlay renderers for syllables, line state, and rhyme decorations

Rhyme panel
    ↓
Caret / line-ending / query target extraction
    ↓
Local rhyme DB worker preferred
    ↓                         ↘
Ranked/filterable suggestions  Online fallback via Datamuse/RhymeBrain
```

Key implementation areas:

- `src/app/` contains Next.js App Router routes, providers, and API routes.
- `src/components/Editor.tsx` coordinates the editor shell, contentEditable input, analysis scheduling, overlays, and editor shortcuts.
- `src/editor/` contains extracted editor internals for input, clipboard, selection, overlay measurement, decorations, and virtualization.
- `src/lib/analysis/` computes syllable metadata from line inputs.
- `src/lib/phonetics/` and `src/lib/nlp/` contain pronunciation and syllable heuristics.
- `src/lib/rhyme/` contains rhyme decoration, aggregation, provider, and highlight helpers.
- `src/lib/rhyme-db/` contains local rhyme database loading, querying, ranking, and worker-client code.
- `src/lib/persist/` and `src/store/` define schemas, migrations, storage access, and Zustand stores.
- `src/workers/` contains the syllable-analysis worker and rhyme-database worker.

## Technology Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16.0.7 App Router |
| Language | TypeScript 5, React 19.1 |
| Styling | Tailwind CSS 4 via `@tailwindcss/postcss`, custom CSS variables in `src/app/globals.css` |
| UI primitives | Radix Dialog and Tooltip |
| Animation | Framer Motion with reduced-motion checks |
| State | Zustand stores |
| Server/cache data | Browser `localStorage`, Cache API inside the rhyme worker, generated static JSON rhyme DB assets |
| Rhyme data | Local CMUdict-derived DB plus Datamuse/RhymeBrain online fallback; Wordnik route available with API key but not active in the panel provider list |
| Workers | Web Workers for syllable analysis and local rhyme DB querying |
| Testing | Jest + Testing Library/jsdom, Playwright for Chromium E2E tests |
| Deployment | Vercel-compatible Next.js build script (`vercel-build`) |

## Getting Started

### Prerequisites

- Node.js `>=20`.
- npm, using the committed `package-lock.json`.
- A modern Chromium-compatible browser for local use and Playwright E2E tests.
- `data/cmudict/cmudict.dict` must exist before running `npm run build:rhyme-db`, `npm run dev`, `npm run build`, or `npm run vercel-build`. The repository currently includes this file.

### Installation

```bash
git clone https://github.com/ClayTheMisfit/rhyme-lines.git
cd rhyme-lines
npm install
npm run dev
```

The package metadata does not currently declare a repository field, but the configured Git remote points to `https://github.com/ClayTheMisfit/rhyme-lines.git`.

### Open the application

```text
http://localhost:3000
```

The dev script runs `next dev --turbopack`, which uses port 3000 unless that port is already occupied.

### Environment variables

No environment variables are required for the core local editor, local draft persistence, syllable analysis, or local rhyme DB suggestions.

Optional variables used by the codebase:

| Variable | Purpose |
| --- | --- |
| `WORDNIK_API_KEY` | Enables the `/api/wordnik` proxy route. This route is not part of the active suggestion provider list used by the current panel. |
| `PLAYWRIGHT_TEST_BASE_URL` | Overrides the Playwright base URL. |
| `NEXT_PUBLIC_DEBUG_EDITOR` | Enables editor debug logging. |
| `NEXT_PUBLIC_DEBUG_ACTIVE_LINE` | Enables active-line debug overlay/logging. |
| `NEXT_PUBLIC_DEBUG_SYLLABLE_TOTALS` | Logs syllable total mismatches in development. |
| `NEXT_PUBLIC_DEBUG_STORAGE` | Logs persisted storage diagnostics. |
| `NEXT_PUBLIC_DEBUG_RHYME_TARGET` | Logs rhyme target extraction diagnostics. |

There is no `.env.example` file in the repository at this time.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Builds the rhyme DB, then starts the Next.js dev server with Turbopack. |
| `npm run build` | Builds the rhyme DB, then creates a production Next.js build. |
| `npm run build:rhyme-db` | Generates static rhyme DB JSON assets from `data/cmudict/cmudict.dict`. |
| `npm run vercel-build` | Builds the rhyme DB, validates it, then runs `next build`. |
| `npm run start` | Starts the production Next.js server after a build. |
| `npm run lint` | Runs ESLint. |
| `npm test` | Runs the Jest test suite. |
| `npm run test:watch` | Runs Jest in watch mode. |
| `npm run test:e2e` | Runs Playwright E2E tests. |
| `npm run test:e2e:ui` | Opens Playwright UI mode. |
| `npm run test:e2e:headed` | Runs Playwright with a visible browser. |

## Testing

- **Jest** covers analysis, persistence migrations, storage helpers, editor serialization/selection utilities, rhyme DB querying, rhyme decoration logic, stores, settings, and component behavior with jsdom and Testing Library.
- **Playwright** covers Chromium E2E flows such as autosave status, editor caret behavior, editor layout width, paste behavior, typing regressions, line totals, rhyme panel behavior, and settings storage.
- **ESLint** uses `next/core-web-vitals` and `next/typescript` flat config.

Typical validation sequence:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

There is no `typecheck` script in `package.json`; `next build` performs the project’s production TypeScript/Next validation.

## Project Structure

```text
src/
├── app/              # Next.js routes, root layout/providers, and API routes
├── components/       # Editor shell, dashboard, panels, settings, tabs, and shared UI
├── editor/           # Editor internals for input, selection, clipboard, overlays, and virtualization
├── hooks/            # Autosave, worker, overlay, resize, debounce, and suggestion hooks
├── lib/              # Analysis, persistence, rhyme/rhyme-db, phonetics, NLP, theme, shortcuts, utilities
├── store/            # Zustand stores for drafts, settings, density, autosave, and panels
└── workers/          # Syllable-analysis and rhyme-database workers

data/cmudict/         # Local CMUdict-style source for generated rhyme DB assets
public/rhyme-db/      # Generated static rhyme DB JSON assets served to the browser
docs/                 # Internal architecture, QA, settings, and audit notes
e2e/                  # Playwright tests
tests/                # Jest tests outside src
scripts/              # Rhyme DB build/check scripts and script tests
```

## Data and Privacy

- Lyrics are stored locally in the browser’s `localStorage` as versioned draft collections.
- Settings and rhyme-panel UI state are also stored in `localStorage`.
- The local rhyme DB is served as static JSON from `public/rhyme-db/` and cached by the browser Cache API inside the rhyme worker.
- Core editing, syllable analysis, autosave, and local rhyme suggestions do not require an account or cloud storage.
- If local rhyme DB initialization fails, the active suggestion hook can send target words to Datamuse and RhymeBrain for online fallback suggestions.
- The `/api/wordnik` route can send words to Wordnik when called and configured with `WORDNIK_API_KEY`, but it is not currently part of the active rhyme-panel provider list.
- No authentication, cloud sync, collaboration, analytics service integration, or version history storage is currently implemented. Analytics events are local no-op/console-style app events in code, not a configured third-party service.
- Users can clear app data by clearing site data in the browser or removing the `rhyme-lines:persist:settings`, `rhyme-lines:persist:drafts`, and `rhyme-lines:persist:panel` localStorage keys.

## Performance Notes

Implemented performance-oriented design choices include:

- Separation between the editable input layer and inert overlay layers.
- Debounced syllable analysis for typing and caret movement.
- Web Worker offload for syllable analysis with fallback computation.
- Web Worker loading/querying for the local rhyme DB.
- LRU caching in the rhyme worker and pronunciation cache.
- Viewport-aware line virtualization for overlay measurement.
- Batched overlay measurement through `requestAnimationFrame`.
- Decoration diffing to reduce unnecessary overlay churn.

The repository contains performance-conscious architecture and regression tests, but it does not include benchmark evidence for a specific typing-latency number.

## Known Limitations

- Rhyme-family highlighting uses a compact pronunciation/heuristic path that can differ from the larger local rhyme suggestion DB.
- Words with valid rhyme suggestions may still fail to share an editor decoration family if pronunciation-key generation separates them.
- Slang, proper nouns, uncommon compounds, contractions, alternate pronunciations, and spelling variants are inherently imperfect with the current dictionaries and heuristics.
- Local storage has browser quota limits and is not a backup or sync solution.
- Online fallback providers mean target words can leave the browser when the local rhyme DB is unavailable.
- The live deployment URL, license, and screenshot assets are not currently defined in repository metadata.

## Roadmap

The following are future or ongoing directions, not claims about completed functionality:

- Improve pronunciation coverage and slant-rhyme scoring.
- Expand and tune the offline rhyme database.
- Continue large-document editor and overlay performance work.
- Add import/export formats beyond plain text.
- Improve mobile layout and touch ergonomics.
- Complete accessibility audits and screen-reader review.
- Add authentication, cloud sync, version history, or collaboration if the product direction requires them.
- Clarify deployment metadata, license, and public preview assets.

## Contributing

1. Create a focused branch from the current mainline.
2. Install dependencies with `npm install`.
3. Make a scoped change that preserves the editor/overlay separation and local-first behavior unless intentionally changing those areas.
4. Add or update Jest/Playwright coverage when behavior changes.
5. Run relevant validations before opening a pull request, usually `npm run lint`, `npm test`, and `npm run build`; run Playwright for UI flows.
6. Keep pull requests focused and explain any known validation failures or skipped checks.

No commitlint or formal conventional-commit enforcement is configured. Conventional-style commit messages are still helpful for maintainers, for example:

```text
docs(readme): document current Rhyme Lines implementation
fix(rhymes): render underline for eligible rhyme tokens
test(editor): cover persisted highlight settings
```

## Deployment

The project is compatible with Vercel-style builds through `npm run vercel-build`, which builds the rhyme DB, checks the generated DB, and runs `next build`. There is no `vercel.json`, public production URL, or deployment badge in the repository.

## License

No license file or package-level license field is currently specified. Until a license is added, redistribution and reuse terms are undefined.
