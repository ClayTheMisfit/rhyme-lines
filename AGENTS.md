# AGENTS.md — Rhyme Lines

## Product intent
Rhyme Lines is a distraction-free lyric-writing app for rappers, songwriters, and poets.

The product should feel:
- creative-tool-first
- calm
- premium
- keyboard-first
- minimal
- fast for long writing sessions

The editor is the main event.
Everything around it should support writing, not compete with it.

## Core UX principles
- Prefer editor focus over chrome.
- Prefer spacing and hierarchy over heavy borders.
- Prefer subtle feedback over flashy motion.
- Prefer contextual assistance over permanently loud side UI.
- Avoid generic SaaS/admin-dashboard patterns.
- Keep the interface purpose-built for lyric writing.

## Non-negotiable product rules
- Do not make the dashboard/workspace feel like an enterprise admin tool.
- Do not add clutter around the writing surface.
- Do not let side panels dominate the layout.
- Do not add modal-heavy flows when an inline, drawer, or palette solution works.
- Do not regress keyboard-first workflows.
- Do not regress accessibility.
- Do not regress perceived typing performance.

## Current product priorities
1. Editor shell quality
2. Syllable engine presentation
3. Rhyme suggestion UX
4. Theme quality
5. Keyboard-first workflows
6. Accessibility and polish

## Architecture expectations
- Preserve the separation between the raw editor input surface and the visual overlay renderer.
- Keep derived visual systems deterministic from editor state + analysis output.
- Keep heavy analysis off the hot typing path when possible.
- Avoid DOM-heavy per-keystroke work.
- Prefer scoped, reviewable changes over broad rewrites.

## UI direction
### Dashboard / workspace
- Treat the workspace as a writing launchpad.
- Emphasize:
  - Resume Last Project / Continue Writing
  - New Project
- De-emphasize:
  - folder creation
  - archive/trash management
  - admin-like controls
  - busy card actions

### Editor
- The editor should feel locked-in, calm, and precise.
- Readable width matters.
- Overlays should be useful but visually quiet.
- Default writing mode should not feel over-annotated.

### Rhyme assistance
- Rhyme help should feel fast, helpful, and non-intrusive.
- Prefer contextual suggestion UI first.
- Persistent rhyme panels should be collapsible and secondary.

### Themes
- Dark mode should feel intentional, not simply inverted.
- Light mode should avoid harsh pure white.
- Use soft neutrals and restrained accent usage.

## Visual rules
- Prefer subtle surfaces over many outlined boxes.
- Use accent color sparingly and intentionally.
- Strongest emphasis should go to:
  - current writing action
  - active selection
  - primary CTA
  - focus-visible state
- Reduce unnecessary all-caps utility styling.
- Avoid overusing shadows, glows, and decorative gradients.

## Accessibility rules
- Every interactive control must have a visible keyboard focus state.
- Preserve keyboard navigation across dashboard, editor, panels, and settings.
- Do not rely on color alone for meaning.
- Keep hit targets comfortable on desktop and touch layouts.
- Decorative overlays should not pollute screen-reader output.
- Preserve readable contrast in both themes.
- Respect reduced-motion preferences.

## Performance rules
- Protect typing responsiveness above all.
- Avoid expensive layout thrash in the editor.
- Keep animations subtle and cheap.
- Prefer opacity/color transitions over heavy transforms when possible.
- Do not add dependencies casually for simple UI work.

## Repo areas to inspect first
When working on a task, inspect the smallest relevant area before coding.

Likely areas:
- `src/app/**` or `app/**` for routes/pages/layout
- `src/components/**` for workspace/dashboard UI
- `src/components/editor/**` for editor presentation and overlays
- `src/lib/rhyme/**` for rhyme logic and decorations
- `src/lib/phonetics/**` for syllable/pronunciation logic
- `src/store/**` or equivalent for UI/editor state
- `src/hooks/**` for workspace/editor behavior
- `src/styles/**` or theme tokens if present

## Commands
Use the repo’s existing package manager and scripts.
Default assumptions unless the repo clearly says otherwise:

- install: `npm install`
- dev: `npm run dev`
- build: `npm run build`
- test: `npm test`
- lint: `npm run lint`
- typecheck: `npm run typecheck`

If a command does not exist, inspect `package.json` and use the closest valid equivalent.
Do not invent scripts.

## Working style
- Start by inspecting the current implementation.
- Prefer the smallest clean implementation path.
- Reuse existing patterns and components where sensible.
- Keep diffs scoped and reviewable.
- Preserve existing behavior unless the task explicitly changes it.
- If a task is large, plan first, then implement in phases.

## Change safety rules
Do not casually change these without being explicitly asked:
- editor overlay architecture
- autosave behavior
- keyboard shortcuts
- rhyme filter behavior
- persistence shape / saved settings keys
- document model / line identity behavior

## Task execution expectations
For implementation tasks:
1. Inspect relevant files first
2. Briefly state the plan
3. Make the smallest correct change set
4. Run the most relevant verification commands available
5. Summarize exactly what changed

## Response format for coding tasks
When finishing a task, return:
1. Summary of changes
2. Files changed
3. Why the change solves the problem
4. What was intentionally left untouched
5. Verification steps run
6. Suggested next step

## Definition of done
A task is done when:
- the requested UX problem is actually addressed
- the change matches Rhyme Lines product intent
- existing core flows still work
- accessibility is preserved or improved
- performance is preserved
- code changes are scoped and understandable
- relevant build/lint/test checks were run when available

## Review priorities
When reviewing or generating code, pay extra attention to:
- typing performance
- visual clutter
- keyboard usability
- overlay alignment
- theme readability
- accidental admin/dashboard feel
- regression risk in editor behavior

## Good defaults for Rhyme Lines tasks
- minimal chrome
- subtle motion
- clean hierarchy
- strong focus states
- contextual assistance
- premium but restrained styling
