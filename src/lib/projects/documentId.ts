export const createDocumentId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `tab-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`
}
