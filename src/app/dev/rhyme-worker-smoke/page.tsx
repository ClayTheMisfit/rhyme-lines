"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

import { createRhymeWorkerClient } from '@/lib/rhyme-db/rhymeWorkerClient'
import type { Mode } from '@/lib/rhyme-db/queryRhymes'

const sampleQuery = {
  targets: { caret: 'blue', lineLast: 'time' },
  mode: 'perfect' as Mode,
  max: 20,
}

type InitStatus = 'Idle' | 'Initializing' | 'Ready' | 'Error'

type DeterminismStatus = 'Idle' | 'Running' | 'PASS' | 'FAIL'

type DiffInfo = {
  label: 'caret' | 'lineLast'
  index: number
  aValue: string
  bValue: string
}

const compareArrays = (label: 'caret' | 'lineLast', a: string[] = [], b: string[] = []) => {
  const maxIndex = Math.max(a.length, b.length)
  for (let index = 0; index < maxIndex; index += 1) {
    const aValue = a[index]
    const bValue = b[index]
    if (aValue !== bValue) {
      return {
        label,
        index,
        aValue: aValue ?? '∅',
        bValue: bValue ?? '∅',
      }
    }
  }

  return null
}

const formatDuration = (value: number | null) => {
  if (value === null) {
    return '—'
  }
  return `${Math.round(value)} ms`
}

export default function RhymeWorkerSmokePage() {
  const isProduction = process.env.NODE_ENV === 'production'
  const workerRef = useRef<ReturnType<typeof createRhymeWorkerClient> | null>(null)
  const [initStatus, setInitStatus] = useState<InitStatus>('Idle')
  const [initError, setInitError] = useState<string | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [initDurationMs, setInitDurationMs] = useState<number | null>(null)
  const [queryDurationMs, setQueryDurationMs] = useState<number | null>(null)
  const [caretResults, setCaretResults] = useState<string[]>([])
  const [lineLastResults, setLineLastResults] = useState<string[]>([])
  const [determinismStatus, setDeterminismStatus] = useState<DeterminismStatus>('Idle')
  const [determinismDiff, setDeterminismDiff] = useState<DiffInfo | null>(null)

  const getClient = useCallback(() => {
    if (isProduction) {
      return null
    }
    if (!workerRef.current) {
      workerRef.current = createRhymeWorkerClient()
    }
    return workerRef.current
  }, [isProduction])

  const resetResults = useCallback(() => {
    setCaretResults([])
    setLineLastResults([])
  }, [])

  const handleInit = useCallback(async () => {
    const client = getClient()
    if (!client) {
      return
    }
    setInitStatus('Initializing')
    setInitError(null)
    setQueryError(null)
    setDeterminismStatus('Idle')
    setDeterminismDiff(null)
    resetResults()

    const start = performance.now()
    try {
      await client.init()
      setInitDurationMs(performance.now() - start)
      setInitStatus('Ready')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setInitDurationMs(performance.now() - start)
      setInitStatus('Error')
      setInitError(
        `${message}. Verify public/rhyme-db/rhyme-db.v1.json exists. Run: npm run build:rhyme-db`,
      )
    }
  }, [getClient, resetResults])

  const runSampleQuery = useCallback(async () => {
    const client = getClient()
    if (!client || initStatus !== 'Ready') {
      setQueryError('Worker not initialized')
      return
    }

    setQueryError(null)
    setDeterminismStatus('Idle')
    setDeterminismDiff(null)

    const start = performance.now()
    try {
      const results = await client.getRhymes(sampleQuery)
      setQueryDurationMs(performance.now() - start)
      setCaretResults(results.caret ?? [])
      setLineLastResults(results.lineLast ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setQueryDurationMs(performance.now() - start)
      setQueryError(message)
    }
  }, [getClient, initStatus])

  const runDeterminismCheck = useCallback(async () => {
    const client = getClient()
    if (!client || initStatus !== 'Ready') {
      setQueryError('Worker not initialized')
      return
    }

    setQueryError(null)
    setDeterminismStatus('Running')
    setDeterminismDiff(null)

    try {
      const first = await client.getRhymes(sampleQuery)
      const second = await client.getRhymes(sampleQuery)

      const caretDiff = compareArrays('caret', first.caret ?? [], second.caret ?? [])
      const lineLastDiff = compareArrays('lineLast', first.lineLast ?? [], second.lineLast ?? [])
      const diff = caretDiff ?? lineLastDiff

      if (diff) {
        setDeterminismStatus('FAIL')
        setDeterminismDiff(diff)
      } else {
        setDeterminismStatus('PASS')
        setDeterminismDiff(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setDeterminismStatus('FAIL')
      setDeterminismDiff({
        label: 'caret',
        index: 0,
        aValue: 'Error',
        bValue: message,
      })
    }
  }, [getClient, initStatus])

  const handleTerminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    setInitStatus('Idle')
    setInitError(null)
    setQueryError(null)
    setInitDurationMs(null)
    setQueryDurationMs(null)
    setDeterminismStatus('Idle')
    setDeterminismDiff(null)
    resetResults()
  }, [resetResults])

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  if (isProduction) {
    return <div>Dev-only page disabled in production.</div>
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Rhyme Worker Smoke Test</h1>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Status</h2>
        <p>Init status: {initStatus}</p>
        {initError ? <p style={{ color: 'crimson' }}>{initError}</p> : null}
        {queryError ? <p style={{ color: 'crimson' }}>{queryError}</p> : null}
        <p>Init duration: {formatDuration(initDurationMs)}</p>
        <p>Query duration: {formatDuration(queryDurationMs)}</p>
        <p>Determinism: {determinismStatus}</p>
        {determinismDiff ? (
          <p style={{ color: 'crimson' }}>
            Diff at {determinismDiff.label}[{determinismDiff.index}]:
            {' '}
            {determinismDiff.aValue} ≠ {determinismDiff.bValue}
          </p>
        ) : null}
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Controls</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleInit}>
            Init Worker
          </button>
          <button type="button" onClick={runSampleQuery}>
            Run Sample Query
          </button>
          <button type="button" onClick={runDeterminismCheck}>
            Run Determinism Check
          </button>
          <button type="button" onClick={handleTerminate}>
            Terminate Worker
          </button>
        </div>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Sample Query</h2>
        <ul>
          <li>caret = "{sampleQuery.targets.caret}"</li>
          <li>lineLast = "{sampleQuery.targets.lineLast}"</li>
          <li>mode = "{sampleQuery.mode}"</li>
          <li>max = {sampleQuery.max}</li>
        </ul>
      </section>

      <section style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <div>
          <h2>Caret Results</h2>
          {caretResults.length === 0 ? (
            <p>—</p>
          ) : (
            <ol>
              {caretResults.map((result) => (
                <li key={`caret-${result}`}>{result}</li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h2>LineLast Results</h2>
          {lineLastResults.length === 0 ? (
            <p>—</p>
          ) : (
            <ol>
              {lineLastResults.map((result) => (
                <li key={`lineLast-${result}`}>{result}</li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </main>
  )
}
