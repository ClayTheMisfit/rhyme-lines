/**
 * @jest-environment node
 */

import { renderToString } from 'react-dom/server.node'
import { ConflictResolutionDialog } from './cloud-sync/ConflictResolutionDialog'
import { VersionHistoryDialog } from './history/VersionHistoryDialog'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'

describe('rendering error SSR boundaries', () => {
  it('renders the conflict dialog without browser persistence or navigator access', () => {
    expect(() => renderToString(
      <ConflictResolutionDialog
        documentId="server-conflict"
        open
        onOpenChange={() => {}}
      />
    )).not.toThrow()
  })

  it('renders version history without browser persistence or eligibility access', () => {
    expect(() => renderToString(
      <VersionHistoryDialog
        documentId="server-history"
        open
        onOpenChange={() => {}}
      />
    )).not.toThrow()
  })

  it('renders the theme provider without browser APIs', () => {
    expect(() => renderToString(
      <ThemeProvider>
        <div>Server theme boundary</div>
      </ThemeProvider>
    )).not.toThrow()
  })
})
