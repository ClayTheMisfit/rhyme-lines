import { getAnalyticsQueue, resetAnalyticsQueue, trackEvent } from '@/lib/analytics/events'

describe('analytics events', () => {
  beforeEach(() => {
    resetAnalyticsQueue()
  })

  it('captures tracked events with payload', () => {
    trackEvent('command_executed', { commandId: 'export' })
    const queue = getAnalyticsQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ name: 'command_executed', payload: { commandId: 'export' } })
  })

  it('caps queue size to avoid unbounded memory growth', () => {
    for (let index = 0; index < 220; index += 1) {
      trackEvent('text_activity', { index })
    }
    expect(getAnalyticsQueue()).toHaveLength(200)
  })
})
