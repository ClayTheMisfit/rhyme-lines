export type ThesaurusRelationship = 'synonym' | 'related'
export type DatamusePartOfSpeech = 'n' | 'v' | 'adj' | 'adv' | 'u'

export interface ThesaurusConcept {
  word: string
  normalizedWord: string
  relationship: ThesaurusRelationship
  score: number
  source: 'datamuse'
  partOfSpeech?: DatamusePartOfSpeech
  frequency?: number
}

export interface ThesaurusResult {
  target: string
  concepts: ThesaurusConcept[]
  synonyms: ThesaurusConcept[]
  related: ThesaurusConcept[]
}

export type ThesaurusStatus = 'idle' | 'loading' | 'success' | 'error'
export type ThesaurusPhase = 'idle' | 'initial' | 'refreshing' | 'error'

export interface RawThesaurusConcept {
  word: string
  relationship: ThesaurusRelationship
  score?: number
  source: 'datamuse'
  partOfSpeech?: DatamusePartOfSpeech
  frequency?: number
}
