import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { CommandPalette } from '@/components/CommandPalette'

describe('CommandPalette', () => {
  it('filters commands by query and runs selected command on Enter', () => {
    const openSettings = jest.fn()
    const newDraft = jest.fn()

    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        commands={[
          { id: 'new-draft', title: 'New Draft', keywords: ['create'], run: newDraft },
          { id: 'settings', title: 'Open Settings', keywords: ['preferences'], run: openSettings },
        ]}
      />
    )

    const input = screen.getByLabelText('Search commands')
    fireEvent.change(input, { target: { value: 'settings' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(openSettings).toHaveBeenCalledTimes(1)
    expect(newDraft).not.toHaveBeenCalled()
  })

  it('closes on Escape', () => {
    const onOpenChange = jest.fn()
    render(
      <CommandPalette
        open
        onOpenChange={onOpenChange}
        commands={[{ id: 'settings', title: 'Open Settings', run: () => {} }]}
      />
    )

    const input = screen.getByLabelText('Search commands')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('notifies when command is executed', () => {
    const onCommandRun = jest.fn()
    const run = jest.fn()
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        onCommandRun={onCommandRun}
        commands={[{ id: 'export', title: 'Export Draft', run }]}
      />
    )

    fireEvent.click(screen.getByRole('option', { name: /export draft/i }))
    expect(run).toHaveBeenCalledTimes(1)
    expect(onCommandRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'export' }))
  })
})
