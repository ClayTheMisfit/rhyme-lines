import type { DraftCollection, DraftSchema } from '@/lib/persist/schema'

export const isArchivedDraft = (draft: DraftSchema): boolean =>
  draft.archived === true || typeof draft.archivedAt === 'string'

export const isTrashedDraft = (draft: DraftSchema): boolean =>
  typeof draft.deletedAt === 'string'

export const isEditorVisibleDraft = (draft: DraftSchema): boolean =>
  !isArchivedDraft(draft) && !isTrashedDraft(draft)

export const resolveActiveDraftId = (
  drafts: DraftSchema[],
  requestedId: string | null
): string | null => {
  const eligibleDrafts = drafts.filter(isEditorVisibleDraft)
  if (requestedId === null) return null
  return eligibleDrafts.find((draft) => draft.docId === requestedId)?.docId
    ?? eligibleDrafts[0]?.docId
    ?? null
}

export const normalizeDraftCollectionLifecycle = (
  collection: DraftCollection
): DraftCollection => ({
  ...collection,
  activeId: resolveActiveDraftId(collection.drafts, collection.activeId),
})
