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
}

const SEARCH_DEBOUNCE_MS = 250
const CARET_DEBOUNCE_MS = 50

export function useRhymeSuggestions({
  searchQuery,
  activeTab,
  activeWord,
  enabled,
}: UseRhymeSuggestionsProps) {
  const [query, setQuery] = useState('')
  const searchTimeoutRef = useRef<number | null>(null)
  const caretTimeoutRef = useRef<number | null>(null)

  // Determine the actual query to use
  const actualQuery = searchQuery.trim() || activeWord?.word || ''

  // Debounced query updates
  useEffect(() => {
    if (searchQuery.trim()) {
      // User is typing in search - use search query with debounce
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      
      searchTimeoutRef.current = window.setTimeout(() => {
        setQuery(searchQuery.trim())
      }, SEARCH_DEBOUNCE_MS)
    } else if (activeWord?.word) {
      // No search query - use active word with shorter debounce
      if (caretTimeoutRef.current) {
        clearTimeout(caretTimeoutRef.current)
      }
      
      caretTimeoutRef.current = window.setTimeout(() => {
        setQuery(activeWord.word)
      }, CARET_DEBOUNCE_MS)
    } else {
      // No query at all
      setQuery('')
    }

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      if (caretTimeoutRef.current) clearTimeout(caretTimeoutRef.current)
    }
  }, [searchQuery, activeWord?.word])

  // Fetch rhymes using React Query
  const {
    data: suggestions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['rhymes', query, activeTab],
    queryFn: () => fetchRhymes(query, activeTab),
    enabled: enabled && !!query.trim(),
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

  return {
    suggestions,
    isLoading,
    error,
    query: actualQuery,
    refetchSuggestions,
    clearCache,
  }
}
