export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLElement) {
    if (target.contentEditable === 'false') return false
    if (target.isContentEditable || target.contentEditable === 'true') return true
  }

  return Boolean(
    target.closest(
      [
        'input',
        'textarea',
        'select',
        '[contenteditable="true"]',
        '[role="textbox"]',
        '[role="searchbox"]',
        '[role="combobox"]',
        '[data-ignore-global-shortcuts]',
      ].join(',')
    )
  )
}
