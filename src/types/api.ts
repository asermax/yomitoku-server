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
 * Response body for POST /api/analyze
 * Schema varies by action type
 */
export interface AnalyzeResponse {
  /** Analysis result (structure depends on action) */
  result: string;
}
