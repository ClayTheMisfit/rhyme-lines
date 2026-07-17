# Rhyme Lines

Rhyme Lines is a distraction-free lyric and poetry editor for drafting with line-aware syllable analysis, rhyme highlighting, rhyme suggestions, autosave, and keyboard-first controls.

A distraction-free lyric editor with real-time syllable analysis, rhyme tools, local autosave, and a keyboard-first workflow.

<!-- Future screenshot: add a committed editor screenshot here when a stable preview asset exists. -->

## Overview

Rhyme Lines is built for rappers, songwriters, poets, and other writers who want a focused writing surface with lightweight musical feedback. The editor is the center of the product: it keeps the editable text surface separate from syllable and rhyme overlays, so derived analysis can be shown without turning the draft itself into a heavy annotated document.

The app currently runs as a local-first Next.js web application. Drafts, settings, rhyme-panel state, and the last opened project are stored in browser storage; rhyme suggestions prefer a generated local rhyme database and can fall back to online providers when the local database is unavailable.

## Current Features

### Workspace and Editor

- Workspace launchpad at `/` with project summaries, recent work, archive/trash flows, folders, and project search/filtering.
- Full-screen editor routes at `/editor` and `/editor/[id]`.
- Multiple draft tabs with create, select, close, and inline rename behavior.
- Stable line-based draft model: persisted drafts store line IDs, text, timestamps, title, folder/archive/trash metadata, and optional selection metadata.
- Contenteditable lyric editor with plain-text paste normalization, selection restoration, current-line behavior, and line virtualization for long documents.
- Collapsible editor sidebar with a dedicated keyboard shortcut.
- Autosave status surface in the editor shell.

### Syllable Analysis

- Word-level syllable badges and line-level totals.
- Analysis runs through a Web Worker when available and falls back to main-thread computation if worker setup fails.
- Typing analysis is debounced separately from caret-driven analysis.
- Syllable counting combines token normalization, small pronunciation overrides, a small built-in pronunciation map, year handling, compound-word heuristics, and spelling heuristics.
- The editor keeps raw input separate from visual overlays (`SyllableOverlay`, `LineTotalsOverlay`, and measurement hooks).

### Rhyme Tools

- Rhyme-family highlighting for repeated rhyme keys, with modes for off, end words, active/focus family, and all families.
- Optional internal-rhyme and stopword highlighting controls.
- Rhyme decorations are measured as overlay rectangles instead of mutating the editor text.
- Rhyme suggestions panel with caret-word and line-ending targeting.
- Perfect and near rhyme filters, common-words-only filtering, syllable filtering, multi-syllable-perfect toggle, debug information, keyboard navigation, and insertion of highlighted suggestions.
- Docked, hidden, and detached panel behavior; detached panels use resizable/draggable `react-rnd` UI.
- Rhyme thesaurus section powered by Datamuse-related terms.
- Local rhyme database worker with generated static JSON assets in `public/rhyme-db` and a v1 fallback path.
- Online fallback providers: Datamuse, RhymeBrain, a small local provider, and a server-side Wordnik route when `WORDNIK_API_KEY` is configured.

### Persistence and Export

- Versioned localStorage persistence for settings, drafts, and rhyme panel state.
- Migration support for current and legacy storage keys.
- Invalid stored settings payloads are discarded instead of crashing hydration; broader app-state loading falls back to defaults on migration/read errors.
- Draft autosave is debounced, with an explicit save runner in the autosave store.
- Current draft export downloads a plain-text `.txt` file.
- Last opened project ID is persisted separately in localStorage.
- Local rhyme-source fallback status is stored in sessionStorage.

### Customization and Accessibility

- Theme preference supports dark, light, and system modes through `next-themes`; default theme is dark.
- Font size, line height, badge size, line totals, rhyme decorations, internal rhymes, stopword highlighting, debounce mode, high contrast, rhyme filters, and rhyme highlight modes are user-configurable.
- Command palette, settings dialog, tooltips, and dialogs use accessible Radix primitives where applicable.
- Interactive controls include focus-visible styling and ARIA attributes in core editor controls, top-bar actions, settings, and panel UI.
- Reduced-motion preferences are respected in motion-enabled controls.

## Keyboard Shortcuts

Application shortcuts are fixed in code; there is a `keyboardShortcuts` field in the persisted settings schema for compatibility, but no UI currently customizes shortcuts.

| Action | Windows/Linux | macOS |
| ------ | ------------- | ----- |
| Open/close command palette | `Ctrl` + `K` | `⌘` + `K` |
| Create new draft | `Ctrl` + `N` | `⌘` + `N` |
| Go to workspace | `Ctrl` + `B` | `⌘` + `B` |
| Toggle theme | `Ctrl` + `J` | `⌘` + `J` |
| Export current draft as `.txt` | `Ctrl` + `S` | `⌘` + `S` |
| Open/focus rhyme panel | `Alt` + `R` | `Option` + `R` |
| Cycle rhyme highlight mode | `Alt` + `H` | `Option` + `H` |
| Toggle editor sidebar | `Ctrl` + `` ` `` | `⌘` + `` ` `` |
| Cycle syllable badge mode | `Alt` + `B` | `Option` + `B` |
| Cycle syllable badge variant | `Alt` + `Shift` + `B` | `Option` + `Shift` + `B` |
| Increase syllable badge scale | `Alt` + `=` / `Alt` + `+` | `Option` + `=` / `Option` + `+` |
| Decrease syllable badge scale | `Alt` + `-` | `Option` + `-` |
| Close command palette, settings, or panel interactions | `Esc` | `Esc` |
| Filter rhyme suggestions by syllable count when panel is focused | `0`–`5` | `0`–`5` |
| Insert highlighted rhyme suggestion when panel is focused | `Enter` | `Enter` |
| Navigate rhyme suggestions when panel is focused | `Arrow Up` / `Arrow Down` | `Arrow Up` / `Arrow Down` |

Global primary-modifier shortcuts are intentionally ignored while focus is inside editable text targets, so editor typing is not interrupted.

## How Rhyme and Syllable Analysis Works

```text
Editor text
    ↓
Line model with stable IDs
    ↓
Debounced analysis request
    ↓
Analysis Web Worker or main-thread fallback
    ↓
Token syllable metadata + line totals
    ↓
Overlay measurement and rendering

Caret/line target word
    ↓
Local rhyme worker and generated rhyme DB
    ↓
Provider fallback when local DB fails
    ↓
Ranking, filters, and suggestion panel
```

### Syllables

1. Editor text is represented as line inputs with stable IDs.
2. Lines are tokenized by `src/lib/analysis/tokenize.ts`.
3. Tokens are normalized for pronunciation-specific cases such as numbers and time-like text.
4. `countSyllables` checks overrides and pronunciation data, then falls back to compound and spelling heuristics.
5. The analysis response contains word spans and syllable counts plus line totals.
6. Overlay components measure the rendered editor text and paint badges/totals without changing the editable text.

### Rhyme highlighting

1. Rhyme decoration input is tokenized independently from the syllable analysis response.
2. Words are normalized through the pronunciation module.
3. Each word receives a rhyme key from override/CMU-like phones or spelling-based fallback rules.
4. Repeated rhyme keys form rhyme families; families smaller than two tokens are not highlighted.
5. Highlight mode and active caret family determine which family tokens render.
6. Overlay geometry is measured from text ranges and painted by `RhymeDecorationOverlay`.

### Rhyme suggestions

1. The suggestion hook targets the caret word and/or the current line's last word unless a panel search query overrides the target.
2. The local worker loads `public/rhyme-db/rhyme-db.v2.json` from generated CMUdict-derived data; if v2 is missing it can fall back to v1.
3. Local worker lookups use indexed perfect, two-syllable perfect, vowel, and coda keys where present.
4. Results are filtered by perfect/near mode, optional syllable target, common-word settings, quality tier, and usage context, then sorted.
5. If local initialization fails, the UI marks the local source as failed for the session and uses online providers.

### Limitations

Pronunciation dictionaries and spelling fallbacks cannot perfectly classify every proper noun, slang term, compound, abbreviation, or expected artist-specific rhyme. The highlighting and suggestion systems also use separate pipelines: valid suggestion data does not guarantee a matching overlay family, and similar-looking words can be separated by the current pronunciation-key rules.

## Architecture

| Area | Current implementation |
| ---- | ---------------------- |
| Framework and routes | Next.js App Router with `src/app/page.tsx`, `/editor`, `/editor/[id]`, API routes, and providers in `src/app/providers.tsx`. |
| Editor input layer | Custom contenteditable editor in `src/components/Editor.tsx`, with extracted helpers under `src/editor`. |
| Overlay layer | Syllable, line-total, and rhyme-decoration overlays under `src/components/editor` and measurement hooks under `src/hooks` / `src/editor/overlay`. |
| State | Zustand stores in `src/store` and `src/lib/state`; React Query provider is configured for async client data. |
| Persistence | Versioned localStorage schemas/migrations in `src/lib/persist`; last-open project localStorage key in `src/lib/projects/storage.ts`; sessionStorage for rhyme-source status. |
| Analysis | `src/workers/analysis.worker.ts` plus `src/lib/analysis` and `src/lib/nlp`. |
| Rhyme data | Generated static rhyme DB assets in `public/rhyme-db`, build scripts in `scripts`, CMUdict source expected at `data/cmudict/cmudict.dict`, online providers under `src/lib/rhyme/providers`, and Wordnik proxy at `src/app/api/wordnik/route.ts`. |
| Testing | Jest with jsdom/ts-jest for unit and component tests; Playwright for Chromium end-to-end tests. |
| Deployment | Vercel-compatible build script is present, but no `vercel.json` or verified production URL is committed. |

## Technology Stack

| Area | Technology |
| ---- | ---------- |
| Framework | Next.js `16.0.7` App Router |
| Language | TypeScript `^5`, React `19.1.0` |
| Styling | Tailwind CSS `^4.1.14`, `@tailwindcss/postcss`, CSS custom properties in `src/app/globals.css` |
| UI primitives | Radix Dialog and Tooltip, small local UI wrappers, Framer Motion |
| State | Zustand `^4.4.0`, React Query `^5.0.0` |
| Editor | Custom contenteditable editor and overlay system |
| Rhyme data | Generated CMUdict-derived JSON DB, local Web Worker, Datamuse/RhymeBrain/local online-provider aggregation, optional Wordnik API proxy |
| Persistence | Browser localStorage and sessionStorage with versioned migrations |
| Testing | Jest `^29.7.0`, ts-jest, Testing Library, Playwright `^1.51.1` |
| Package manager | npm, using `package-lock.json` |
| Deployment | Standard Next.js/Vercel-compatible scripts |

## Getting Started

### Prerequisites

- Node.js `>=20`.
- npm, as indicated by `package-lock.json`.
- A Chromium-compatible browser for Playwright E2E tests.
- A CMUdict-style pronunciation file at `data/cmudict/cmudict.dict` for `npm run build:rhyme-db`, `npm run dev`, `npm run build`, and `npm run vercel-build`.

This repository includes `data/cmudict/README.md` documenting the expected dictionary path. The build script does not download CMUdict automatically.

### Installation

```bash
git clone https://github.com/ClayTheMisfit/rhyme-lines.git
cd rhyme-lines
npm install
npm run dev
```

Open the application at:

```text
http://localhost:3000
```

The dev script first regenerates the rhyme database and then starts `next dev --turbopack` on Next.js's default development port.

### Environment variables

Core local development does not require environment variables when the generated local rhyme DB is available.

Optional variables:

| Variable | Purpose |
| -------- | ------- |
| `WORDNIK_API_KEY` | Enables the server-side `/api/wordnik` proxy for Wordnik-backed suggestions. Without it, that route returns an error, but the local rhyme DB and other providers can still be used. |
| `PLAYWRIGHT_TEST_BASE_URL` | Overrides Playwright's base URL. Defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_DEBUG_STORAGE` | Logs persistence debug information when set to `1`. |
| `NEXT_PUBLIC_DEBUG_SYLLABLE_TOTALS` | Logs syllable total mismatch diagnostics in development when set to `1`. |

No `.env.example` file is currently committed.

## Available Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Builds the rhyme DB, then starts the Next.js development server with Turbopack. |
| `npm run build` | Builds the rhyme DB, then creates a production Next.js build. |
| `npm run build:rhyme-db` | Generates `public/rhyme-db/rhyme-db.v2.json` and `public/rhyme-db/manifest.json` from `data/cmudict/cmudict.dict`. |
| `npm run vercel-build` | Builds the rhyme DB, validates it with `scripts/check-rhyme-db.mjs`, then runs `next build`. |
| `npm run start` | Starts the production Next.js server after a successful build. |
| `npm run lint` | Runs ESLint. |
| `npm test` | Runs the Jest test suite. |
| `npm run test:watch` | Runs Jest in watch mode. |
| `npm run test:e2e` | Runs Playwright E2E tests. |
| `npm run test:e2e:ui` | Opens Playwright UI mode. |
| `npm run test:e2e:headed` | Runs Playwright in headed mode. |

There is no `npm run typecheck` script at the time of writing.

## Testing

- **Jest** covers analysis, syllables, persistence migrations, stores, editor behavior, overlays, rhyme suggestions, settings, dashboard UI, shortcuts, and rhyme DB utilities.
- **Playwright** covers browser-level editor and settings flows, autosave status, layout regressions, caret behavior, line totals, panel behavior, and typing/windowing regressions in Chromium.
- **ESLint** uses the Next core-web-vitals and TypeScript flat-config setup.

Useful validation commands:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

Playwright can install browsers with:

```bash
npx playwright install
```

The build and dev scripts require `data/cmudict/cmudict.dict`; if that file is missing, `npm run build:rhyme-db` exits before Next.js starts.

## Project Structure

```text
src/
├── app/                # Next.js routes, providers, API routes, global CSS
├── components/         # Dashboard, top bar, editor shell, settings, panels, UI primitives
├── components/editor/  # Syllable, line-total, and rhyme overlay renderers
├── components/rhyme/   # Suggestion panel, suggestion items, thesaurus section
├── editor/             # Extracted editor selection, input, clipboard, overlay, and virtualization helpers
├── hooks/              # Autosave, workers, overlay measurement, viewport/windowing, suggestions
├── lib/analysis/       # Tokenization and syllable-analysis response construction
├── lib/nlp/            # Syllable counting, year handling, stopwords
├── lib/phonetics/      # Pronunciation normalization and rhyme-key generation
├── lib/persist/        # Versioned storage schemas, migrations, app-state hydration
├── lib/projects/       # Local project/document/folder/archive/trash operations
├── lib/rhyme/          # Rhyme aggregation, providers, decorations, quality filters
├── lib/rhyme-db/       # Local rhyme DB loading, querying, worker client, common-word data
├── store/              # Zustand stores for settings, tabs, autosave, panels, density/highlights
└── workers/            # Analysis worker and local rhyme database worker

data/cmudict/           # Expected local CMUdict-style source file and source README
public/rhyme-db/        # Generated/static rhyme database assets used by the browser worker
scripts/                # Rhyme DB build/query/check scripts and tests
tests/                  # Jest unit and component tests
e2e/                    # Playwright browser tests
docs/                   # Internal audits, architecture notes, and QA docs
```

## Data and Privacy

- Lyrics/drafts are stored in browser localStorage under `rhyme-lines:persist:drafts`.
- Settings are stored in localStorage under `rhyme-lines:persist:settings`.
- Rhyme panel state is stored in localStorage under `rhyme-lines:persist:panel`.
- The last opened project ID is stored in localStorage under `rhyme-lines:last-open-project-id`.
- Rhyme-source status is stored in sessionStorage under `rhyme-lines:rhyme-source`.
- No authentication, accounts, collaboration, server database, or cloud sync is implemented.
- When the local rhyme DB is available, rhyme suggestions can be served from browser-loaded static JSON and a Web Worker.
- If local rhyme DB initialization fails, online providers may receive target words for suggestions. The Wordnik route requires `WORDNIK_API_KEY`; Datamuse/RhymeBrain provider code uses public HTTP APIs from the browser-side aggregation path.
- Users can clear app data by clearing site data/localStorage/sessionStorage in their browser. The repository also exposes `clearPersistedState()` in code, but no end-user reset button for all persisted data is documented in the UI.

## Performance Notes

Implemented performance-oriented choices include:

- Debounced autosave and debounced analysis requests.
- Separate typing (`250ms`) and caret (`50ms`) analysis debounce timings.
- Web Worker for syllable analysis with fallback if Worker creation fails.
- Web Worker for local rhyme DB loading/querying, with Cache API use inside the worker and an in-memory LRU for query results.
- Line virtualization and visible-range checks for overlay measurement.
- Separation of raw editor input from derived overlay rendering.
- Memoized/derived state in React hooks and stores where hot editor paths need stable inputs.

The README does not claim a measured typing-latency number; current performance claims are architectural rather than benchmarked.

## Known Limitations

- `data/cmudict/cmudict.dict` must exist before build/dev scripts regenerate the rhyme DB; it is not downloaded automatically.
- The built-in pronunciation map is intentionally small, and heuristic syllable/rhyme logic can miss slang, proper nouns, compounds, alternate pronunciations, and artist-intended rhymes.
- Rhyme highlighting and rhyme suggestions are separate systems; they can disagree because overlays use pronunciation keys while suggestions query a generated DB and provider pipeline.
- Online provider fallback means target words may leave the browser when the local DB is unavailable.
- Export is currently plain text only; Markdown/PDF/structured export is not implemented.
- No import flow is implemented.
- No formal license file is currently committed.
- No production deployment URL is verified in repository metadata.

## Roadmap

Future work should remain separate from implemented features. Based on the current codebase, likely next areas include:

- Larger and more accurate pronunciation/rhyme datasets.
- Better slant-rhyme and multi-syllable scoring.
- More robust overlay behavior for very large documents and browser-specific selection edge cases.
- Import and richer export formats.
- Better user-facing controls for clearing local data.
- Mobile layout refinements.
- Accessibility audits and additional keyboard/screen-reader coverage.
- Authentication, cloud sync, version history, and collaboration, if the project chooses to move beyond local-first storage.
- Deployment documentation once a production target is configured and verified.

## Contributing

1. Create a focused branch from the current main development branch.
2. Install dependencies with `npm install`.
3. Ensure `data/cmudict/cmudict.dict` exists before running dev/build scripts.
4. Run the smallest relevant validation first, then broaden to `npm run lint`, `npm test`, `npm run test:e2e`, and/or `npm run build` as appropriate.
5. Add or update tests when changing editor behavior, persistence, analysis, rhyme logic, or keyboard interaction.
6. Keep changes scoped. Avoid changing editor overlay architecture, autosave behavior, shortcut behavior, persistence keys, or document identity unless the task explicitly requires it.
7. Open a pull request with a clear summary, validation results, and any known limitations.

No commitlint or formal Conventional Commits enforcement is currently configured.

## Deployment

The repository includes Vercel-oriented scripts through `npm run vercel-build`, but there is no committed `vercel.json`, production URL, or deployment badge. A typical deployment should run the rhyme DB build/check step before `next build`, which `vercel-build` already does.

## License

No license is currently specified in the repository. Without a license file, reuse rights are not explicitly granted.
