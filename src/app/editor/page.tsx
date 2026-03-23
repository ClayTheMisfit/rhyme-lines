import TopBar from '@/components/TopBar'
import EditorShell from '@/components/EditorShell'

export default function EditorPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <TopBar />
      <main className="flex min-h-0 flex-1" style={{ paddingTop: 'var(--header-height, 48px)' }}>
        <EditorShell />
      </main>
    </div>
  )
}
