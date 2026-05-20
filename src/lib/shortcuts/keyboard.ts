export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toLowerCase()

  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true
  }

  if (target.isContentEditable) {
    return true
  }

  if (target.contentEditable === 'true') {
    return true
  }


  if (target.closest('[role="textbox"]')) {
    return true
  }

  return false
}
