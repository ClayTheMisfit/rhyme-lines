# Hydration risk scan

- components/TopBar.tsx:255 — Header layout previously depended on render-time dock measurements, yielding SSR/CSR diffs; replaced with CSS variables updated after mount. (Addressed.)
- components/Editor.tsx:679 — Scroll container margin/max-width once pulled panel width during render; now bound to the shared CSS variable so server/client markup match. (Addressed.)
- app/layout.tsx:19 — Body theme classes were only applied by client effects, producing a flash on hydrate; default dark skin now ships in SSR with `suppressHydrationWarning` and theme provider. (Addressed.)
- lib/editor/getActiveWord.ts:14 — `Date.now()` throttling inside caret helpers; safe because helpers run in client-only effects but worth monitoring for deterministic SSR output.
- lib/editor/getActiveWord.ts:21 & components/Editor.tsx:94 — `window.getSelection()` usages; all are wrapped in client components/effects, but they must stay outside server-rendered modules.
- src/store/settings.ts:14-40 — `window.localStorage` reads during store initialization guarded with `typeof window` checks; safe but they must remain client-only.
- components/editor/overlays/LineTotalsOverlay.tsx:26 — Reads `window.devicePixelRatio` with an SSR guard; current fallback keeps hydration stable.
- lib/rhyme/cache.ts:21 — `Date.now()` used to expire cached rhyme responses; deterministic per request but note that server rendering should avoid sharing cache across users.
