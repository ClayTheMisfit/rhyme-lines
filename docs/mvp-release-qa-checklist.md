# MVP Release Candidate QA Checklist

## Core loop
- [ ] Open workspace, create a new draft, and confirm focus lands in editor after open.
- [ ] Type multiple lines and verify status bar transitions `Unsaved changes` -> `Saving…` -> `Saved`.
- [ ] Reload app and confirm the same draft content is restored.
- [ ] Export current draft and validate downloaded filename/content match active draft.

## Rhyme + overlays
- [ ] Toggle rhyme panel with `Alt+R` and toolbar button; verify focus lands in panel when opened.
- [ ] Confirm rhyme suggestions load for active word and update for query changes.
- [ ] Toggle filters (perfect, near, slant/multi-syllable/common words) and verify suggestion list refreshes.
- [ ] Verify offline/degraded provider state shows non-crashing fallback state.

## Command palette + keyboard-first flow
- [ ] Open command palette via `Cmd/Ctrl+K` and execute: New Draft, Switch Theme, Export Draft.
- [ ] Confirm palette closes after command run and focus returns to trigger on close.
- [ ] Verify keyboard-only navigation for palette results (arrow keys + enter + escape).

## Theme + layout
- [ ] Switch dark/light theme and confirm persistence after refresh.
- [ ] Verify smaller laptop width (≈1280x720) has no clipping/trapped controls.

## Edge/state checks
- [ ] Paste long multi-line content (200+ lines) and verify typing/editing remain responsive.
- [ ] Verify blank lines/punctuation-heavy lines still render syllable/line overlays correctly.
- [ ] Simulate localStorage failure (private mode/quota) and confirm autosave error state is explicit.

## Observability sanity
- [ ] In devtools, verify analytics debug events emit for: app load, draft open/create, text activity, rhyme request/results/errors, command execution, theme switch, export, autosave success/failure.
