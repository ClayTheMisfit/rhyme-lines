# Editor architecture

## Discovery snapshot (pre-refactor clusters in `Editor.tsx`)

- **Selection + active line highlight**: selection probing, caret-to-line lookup, and highlight state scheduling were concentrated in a large middle section of the component.
- **Input and IME handling**: `beforeinput`, `input`, `keydown`, composition, focus/blur were all wired inline.
- **Clipboard handling**: paste normalization and insertion were inline in the JSX event props.
- **Overlay measurement**: token/rhyme overlay geometry reads were delegated but orchestrated directly from `Editor.tsx`.
- **Viewport/windowing**: visible-range computation and active line windows were previously provided by a standalone hook and consumed in the component.
- **Decoration churn**: decoration snapshots were rebuilt in component scope and pushed directly into overlay rendering.

## Module boundaries

- `src/editor/types.ts`
  - Shared editor-internal types (selection snapshots, decoration maps, rect shapes, visible ranges).
- `src/editor/selection/*`
  - Selection serialization/restoration and selection listener ownership.
- `src/editor/input/*`
  - Input/IME lifecycle with composition-aware scheduling.
- `src/editor/clipboard/*`
  - Paste normalization and paste handler.
- `src/editor/overlay/measurement/*`
  - Token rect measurement with rAF scheduling and cache key support.
- `src/editor/virtualization/*`
  - Visible window computation and hook for active line ids.
- `src/editor/decorations/*`
  - Decoration diffing + patch stream to reduce churn.

## Data flow

1. DOM edits happen in contentEditable.
2. Input hook routes events and defers expensive work while IME is active.
3. Commit path normalizes DOM line structure and emits line inputs.
4. Virtualization computes active lines for overlay work.
5. Overlay measurement runs batched in rAF.
6. Decoration diffing emits only minimal line-level updates.
7. Selection hook snapshots/restores caret/selection through re-renders.

## Where to change what

- **Caret or selection bugs**: `src/editor/selection/`
- **Typing/IME or shortcut behavior**: `src/editor/input/`
- **Paste quirks**: `src/editor/clipboard/`
- **Badge/rhyme geometry glitches**: `src/editor/overlay/measurement/`
- **Visible-range tuning/overscan**: `src/editor/virtualization/`
- **Decoration render churn**: `src/editor/decorations/`
