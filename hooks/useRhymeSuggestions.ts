import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AggregatedSuggestion } from '@/lib/rhyme/aggregate'
import { fetchRhymes } from '@/lib/rhyme/aggregate'
import { rhymeCache } from '@/lib/rhyme/cache'
import type { ActiveWord } from '@/lib/editor/getActiveWord'

interface UseRhymeSuggestionsProps {
  searchQuery: string
  activeTab: 'perfect' | 'slant'
  activeWord: ActiveWord | null
  enabled: boolean
  autoRefresh: boolean
  debounceMode: 'cursor-50' | 'typing-250'
}

export function useRhymeSuggestions({
  searchQuery,
  activeTab,
  activeWord,
  enabled,
  autoRefresh,
  debounceMode,
}: UseRhymeSuggestionsProps) {
  const [query, setQuery] = useState('')
  const searchTimeoutRef = useRef<number | null>(null)
  const caretTimeoutRef = useRef<number | null>(null)

  // Determine the actual query to use
  const actualQuery = searchQuery.trim() || activeWord?.word || ''

  const searchDelay = debounceMode === 'cursor-50' ? 50 : 250
  const caretDelay = debounceMode === 'cursor-50' ? 50 : 250

  // Debounced query updates
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    if (caretTimeoutRef.current) {
      clearTimeout(caretTimeoutRef.current)
      caretTimeoutRef.current = null
    }

    if (!autoRefresh) {
      setQuery(actualQuery)
      return
    }

    if (searchQuery.trim()) {
      searchTimeoutRef.current = window.setTimeout(() => {
        setQuery(searchQuery.trim())
      }, searchDelay)
    } else if (activeWord?.word) {
      caretTimeoutRef.current = window.setTimeout(() => {
        setQuery(activeWord.word)
      }, caretDelay)
    } else {
      setQuery('')
    }

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      if (caretTimeoutRef.current) clearTimeout(caretTimeoutRef.current)
    }
  }, [autoRefresh, searchQuery, activeWord?.word, actualQuery, searchDelay, caretDelay])

  // Fetch rhymes using React Query
  const {
    data: suggestions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['rhymes', query, activeTab],
    queryFn: () => fetchRhymes(query, activeTab),
    enabled: enabled && autoRefresh && !!query.trim(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    retryDelay: 1000,
  })

  // Manual refetch function
  const refetchSuggestions = useCallback(() => {
    refetch()
  }, [refetch])

  // Clear cache function
  const clearCache = useCallback(() => {
    rhymeCache.clear()
  }, [])

  const previousAutoRefresh = useRef(autoRefresh)

  useEffect(() => {
    if (autoRefresh && !previousAutoRefresh.current && query.trim()) {
      refetch()
    }
    previousAutoRefresh.current = autoRefresh
  }, [autoRefresh, query, refetch])

  return {
    suggestions,
    isLoading,
    error,
    query: actualQuery,
    refetchSuggestions,
    clearCache,
  }
}
