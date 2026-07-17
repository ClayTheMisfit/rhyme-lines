export type AnalyticsEventName =
  | 'app_loaded'
  | 'draft_created'
  | 'draft_opened'
  | 'text_activity'
  | 'rhyme_panel_toggled'
  | 'rhyme_requested'
  | 'rhyme_results_shown'
  | 'rhyme_error'
  | 'rhyme_filter_changed'
  | 'rhyme_thesaurus_opened'
  | 'rhyme_thesaurus_closed'
  | 'rhyme_thesaurus_concept_selected'
  | 'rhyme_thesaurus_rhyme_inserted'
  | 'rhyme_thesaurus_request_failed'
  | 'theme_switched'
  | 'command_palette_opened'
  | 'command_executed'
  | 'export_started'
  | 'export_completed'
  | 'autosave_succeeded'
  | 'autosave_failed'

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>

const MAX_EVENTS = 200
const queue: Array<{ name: AnalyticsEventName; payload?: AnalyticsPayload; ts: number }> = []

const emitDebugEvent = (name: AnalyticsEventName, payload?: AnalyticsPayload) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('rhyme:analytics', { detail: { name, payload, ts: Date.now() } }))
}

export function trackEvent(name: AnalyticsEventName, payload?: AnalyticsPayload) {
  const entry = { name, payload, ts: Date.now() }
  queue.push(entry)
  if (queue.length > MAX_EVENTS) {
    queue.splice(0, queue.length - MAX_EVENTS)
  }

  if (process.env.NODE_ENV !== 'production') {
    emitDebugEvent(name, payload)
  }
}

export function getAnalyticsQueue() {
  return queue.slice()
}

export function resetAnalyticsQueue() {
  queue.length = 0
}
