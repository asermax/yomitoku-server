/**
 * API Request and Response Types
 *
 * Shared type definitions for API endpoints to ensure consistency
 * between schema validation and TypeScript types.
 */

/**
 * Selection region coordinates on a webpage
 * All coordinates are in CSS pixels (viewport coordinates)
 */
export interface SelectionRegion {
  /** X coordinate of selection (CSS pixels) */
  x: number;
  /** Y coordinate of selection (CSS pixels) */
  y: number;
  /** Width of selection (CSS pixels) */
  width: number;
  /** Height of selection (CSS pixels) */
  height: number;
  /** Full viewport width (CSS pixels) */
  viewportWidth: number;
  /** Full viewport height (CSS pixels) */
  viewportHeight: number;
  /** Device pixel ratio for coordinate transformation */
  devicePixelRatio?: number;
}

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
  /** Base64-encoded PNG screenshot */
  image: string;
  /** Selection region coordinates */
  selection: SelectionRegion;
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
  /** Bounding box coordinates (normalized 0-1000) */
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
  action: 'translate' | 'explain' | 'grammar' | 'vocabulary';
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
