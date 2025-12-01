/**
 * API Request and Response Types
 *
 * Shared type definitions for API endpoints to ensure consistency
 * between schema validation and TypeScript types.
 */

/**
 * Optional metadata about the webpage
 */
export interface PageMetadata {
  /** URL of the webpage */
  url?: string;
  /** Title of the webpage */
  title?: string;
}

/**
 * Request body for POST /api/identify-phrase
 */
export interface IdentifyPhraseRequest {
  /** Base64-encoded PNG screenshot (cropped to selection) */
  image: string;
  /** Optional page metadata */
  metadata?: PageMetadata;
}

/**
 * Token in an identified phrase
 */
export interface PhraseToken {
  /** Japanese word/character */
  word: string;
  /** Reading in hiragana/katakana */
  reading: string;
  /** Romanized reading */
  romaji: string;
  /** Parts of speech tags */
  partOfSpeech?: string[];
  /** Whether the word contains kanji */
  hasKanji?: boolean;
  /** Whether the word is commonly used */
  isCommon?: boolean;
}

/**
 * Translation analysis result
 */
export interface TranslationResult {
  /** Natural English translation */
  translation: string;
  /** Literal translation if significantly different from natural translation */
  literalTranslation?: string;
  /** Contextual nuances or cultural notes */
  notes?: string;
}

/**
 * Explanation analysis result
 */
export interface ExplainResult {
  /** Core meaning and usage */
  meaning: string;
  /** How it functions in this specific context */
  contextUsage: string;
  /** Common situations where this phrase appears */
  commonSituations?: string;
  /** Important nuances, connotations, or formality level */
  nuances?: string;
}

/**
 * Grammar analysis result
 */
export interface GrammarResult {
  /** Step-by-step grammatical breakdown */
  breakdown: string;
  /** Individual grammatical elements with explanations */
  elements?: Array<{
    element: string;
    type: string;
    explanation: string;
  }>;
  /** Common variations or alternative constructions */
  variations?: string;
  /** Tips for learners, common mistakes */
  learnerTips?: string;
}

/**
 * Response body for POST /api/identify-phrase
 */
export interface IdentifyPhraseResponse {
  /** Identified Japanese phrase */
  phrase: string;
  /** Romanized reading */
  romaji: string;
  /** Bounding box coordinates [y_min, x_min, y_max, x_max] (normalized 0-1000 relative to cropped image) */
  boundingBox: [number, number, number, number];
  /** Tokenized phrase */
  tokens: PhraseToken[];
  /** Pre-computed translation analysis */
  translation: TranslationResult;
  /** Pre-computed explanation analysis */
  explain: ExplainResult;
  /** Pre-computed grammar analysis */
  grammar: GrammarResult;
}

/**
 * Request body for POST /api/analyze
 */
export interface AnalyzeRequest {
  /** Japanese phrase to analyze */
  phrase: string;
  /** Analysis action type */
  action: 'translate' | 'explain' | 'grammar' | 'vocabulary' | 'conjugation';
  /** Optional context */
  context?: {
    /** Full phrase if analyzing a subset */
    fullPhrase?: string;
    /** Screenshot for visual context */
    image?: string;
  };
}

/**
 * Request body for POST /api/identify-phrases
 */
export interface IdentifyPhrasesRequest {
  /** Base64-encoded PNG screenshot (full viewport) */
  image: string;
  /** Maximum number of phrases to identify (default: 25, max: 100) */
  maxPhrases?: number;
  /** Optional page metadata */
  metadata?: PageMetadata;
}

/**
 * Phrase data in identify-phrases response
 */
export interface PhraseData {
  /** Identified Japanese phrase */
  phrase: string;
  /** Romanized reading */
  romaji: string;
  /** Bounding box coordinates [y_min, x_min, y_max, x_max] (normalized 0-1000 relative to full viewport image) */
  boundingBox: [number, number, number, number];
  /** Tokenized phrase */
  tokens: PhraseToken[];
}

/**
 * Response body for POST /api/identify-phrases
 */
export interface IdentifyPhrasesResponse {
  /** Array of identified phrases */
  phrases: PhraseData[];
}

/**
 * Response body for POST /api/analyze
 * Schema varies by action type
 */
export interface AnalyzeResponse {
  /** Analysis result (structure depends on action) */
  result: string;
}
