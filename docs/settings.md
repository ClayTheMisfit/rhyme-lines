# Settings system

The settings sheet is backed by a persisted Zustand store located in [`store/settingsStore.ts`](../store/settingsStore.ts). The store keeps the canonical values for theme, typography, syllable overlays, and rhyme helper behavior and writes them to `localStorage` under the key `rhyme-lines:settings`.

## Defaults

```ts
const SETTINGS_DEFAULTS = {
  theme: 'dark',
  fontSize: 18,
  lineHeight: 1.6,
  badgeSize: 'sm',
  showLineTotals: true,
  rhymeAutoRefresh: true,
  debounceMode: 'typing-250',
}
```

The editor and overlay listen to the store and apply changes immediately by syncing CSS custom properties (`--editor-font-size`, `--editor-line-height`) and recomputing the overlay geometry on demand. The rhyme suggestions hook also reads `rhymeAutoRefresh` and `debounceMode` to determine how aggressively it fetches data.

## Adding new settings

1. Extend `SettingsState` in `store/settingsStore.ts` with the new value and update `SETTINGS_DEFAULTS`.
2. Add the corresponding setter inside the store initializer so updates persist automatically.
3. Wire the control into the settings sheet (`components/settings/SettingsSheet.tsx`). Follow the existing grid layout and include accessible labels/aria descriptions.
4. If the new setting affects runtime behavior, consume it via `useSettingsStore` inside the relevant component or hook. Use `useEffect` to mirror the value into DOM state (CSS variables, attributes, etc.) as needed.
5. Update this document with the additional field and any notes about side effects.

All controls auto-save on change; the Save button simply closes the sheet. Cancel restores the snapshot captured when the sheet was opened, and Reset to defaults pushes `SETTINGS_DEFAULTS` back into the store.
