import { fireEvent, render } from '@testing-library/react'
import TopBarActions from '@/components/TopBarActions'

const push = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: () => 'div',
    }
  ),
  useReducedMotion: () => true,
}))
jest.mock('@/hooks/useClickOutside', () => ({ useClickOutside: jest.fn() }))
jest.mock('@/components/settings/SettingsSheet', () => () => null)
jest.mock('@/components/CommandPalette', () => ({ CommandPalette: () => null }))
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipContent: ({ children }: { children: ReactNode }) => children,
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
}))
jest.mock('@/lib/analytics/events', () => ({ trackEvent: jest.fn() }))
jest.mock('@/lib/state/rhymePanel', () => ({ useRhymePanel: () => 'hidden' }))
jest.mock('@/store/rhymePanelStore', () => ({
  useRhymePanelStore: (selector: (state: { togglePanel: () => void }) => unknown) => selector({ togglePanel: jest.fn() }),
}))
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: (
    selector: (state: { showRhymeDecorations: boolean; setShowRhymeDecorations: () => void }) => unknown
  ) => selector({ showRhymeDecorations: true, setShowRhymeDecorations: jest.fn() }),
}))
jest.mock('@/store/editorDensityStore', () => ({
  useEditorDensityStore: (selector: (state: { mode: string; setMode: () => void }) => unknown) =>
    selector({ mode: 'draft', setMode: jest.fn() }),
}))
jest.mock('@/store/tabsStore', () => ({
  useTabsStore: (
    selector: (state: { tabs: Array<{ id: string; title: string; snapshot: { text: string }; updatedAt: number }>; activeTabId: string; actions: { newTab: () => void; setActive: () => void } }) => unknown
  ) =>
    selector({
      tabs: [{ id: 'a', title: 'A', snapshot: { text: 'x' }, updatedAt: 1 }],
      activeTabId: 'a',
      actions: { newTab: jest.fn(), setActive: jest.fn() },
    }),
}))

describe('TopBarActions shortcuts', () => {
  beforeEach(() => {
    push.mockReset()
  })

  it('fires global shortcut from shell target', () => {
    render(<TopBarActions />)
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true, target: document.body })
    expect(push).toHaveBeenCalledWith('/')
  })

  it('does not fire global shortcuts from text-entry targets', () => {
    render(
      <>
        <input aria-label="title" />
        <div role="searchbox" aria-label="search" />
        <textarea aria-label="settings" />
        <div role="textbox" aria-label="textbox" />
        <TopBarActions />
      </>
    )

    for (const target of ['title', 'search', 'settings', 'textbox']) {
      const node = document.querySelector(`[aria-label=\"${target}\"]`) as HTMLElement
      const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true })
      Object.defineProperty(event, 'target', { value: node })
      window.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }

    expect(push).not.toHaveBeenCalled()
  })
})
