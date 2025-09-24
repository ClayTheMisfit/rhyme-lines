
  editDistance: number
}

export async function fetchRhymes(
  word: string, 
  type: 'perfect' | 'slant'
): Promise<AggregatedSuggestion[]> {
  if (!word.trim()) return []
  
  const normalized = word.toLowerCase().trim()
  
  try {
    // Fetch from all sources in parallel
    
    ])
    
    // Collect successful results
    const allResults: RhymeSuggestion[] = []
    
    if (datamuseResults.status === 'fulfilled') {
      allResults.push(...datamuseResults.value)
    }
    
    if (rhymeBrainResults.status === 'fulfilled') {
      allResults.push(...rhymeBrainResults.value)
    }
    
    if (localResults.status === 'fulfilled') {
      allResults.push(...localResults.value)
    }
    

    // Aggregate and deduplicate
    return aggregateAndRank(allResults, normalized, type)
    
  } catch (error) {
    console.warn('Rhyme fetching failed:', error)
    return []
  }
}

function aggregateAndRank(
  results: RhymeSuggestion[], 
  originalWord: string, 
  type: 'perfect' | 'slant'
): AggregatedSuggestion[] {
  const wordMap = new Map<string, AggregatedSuggestion>()
  
  // Group by word, tracking sources and best scores
  for (const result of results) {
    const key = result.word.toLowerCase()
    const existing = wordMap.get(key)
    

    if (existing) {
      // Update with better score and add source
      if (result.score > existing.score) {
        existing.score = result.score

        editDistance: calculateEditDistance(originalWord, result.word),
      })
    }
  }
  
  // Convert to array and filter by type
  const aggregated = Array.from(wordMap.values())
    .filter(item => item.type === type)
    .sort((a, b) => {
      // Primary sort: score (higher is better)
      if (b.score !== a.score) return b.score - a.score
      
      // Secondary sort: edit distance (lower is better)
      if (a.editDistance !== b.editDistance) return a.editDistance - b.editDistance
      
      // Tertiary sort: frequency (higher is better)
      if (a.frequency !== b.frequency) return (b.frequency || 0) - (a.frequency || 0)
      
      // Final sort: alphabetical
      return a.word.localeCompare(b.word)
    })
  
  return aggregated.slice(0, 50) // Limit to top 50 results
}


  return 'local'
}

function calculateEditDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      )
    }
  }
  
  return matrix[str2.length][str1.length]
}
