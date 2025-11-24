/**
 * API Request and Response Types
 *
 * Shared type definitions for API endpoints to ensure consistency
 * between schema validation and TypeScript types.
 */

/**
 * Selection region coordinates on a webpage
 * All coordinates are in CSS pixels (viewport coordinates)
 * Image is pre-cropped to this selection on client side
 */
export interface SelectionRegion {
  /** X coordinate of selection in viewport (CSS pixels) - for coordinate reconstruction */
  x: number;
  /** Y coordinate of selection in viewport (CSS pixels) - for coordinate reconstruction */
  y: number;
  /** Width of cropped image (CSS pixels) */
  width: number;
  /** Height of cropped image (CSS pixels) */
  height: number;
  /** Device pixel ratio for calculating actual image dimensions */
  devicePixelRatio: number;
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
