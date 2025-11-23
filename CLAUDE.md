# CLAUDE.md

This file provides guidance to Claude Code when working with this codebase.

## Project Overview

**Yomitoku Server** is the backend proxy for the Yomitoku Chrome extension. It securely proxies API requests to the Gemini 3 API, solving the problem that API keys cannot be stored securely in browser extensions.

**Related Projects**:
- Chrome extension: `/home/agus/workspace/asermax/yomitoku-chrome-extension/`
- Design docs: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/design/`
- Research docs: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/research/`

## Architecture

### Core Responsibilities

1. **API Key Management** - Store and use Gemini API key securely
2. **Request Proxying** - Forward extension requests to Gemini API
3. **Rate Limiting** - Control costs and prevent abuse
4. **Error Handling** - Graceful failures with user-friendly messages
5. **Validation** - Input validation and security checks

### Technology Stack

**Framework**: Fastify + TypeScript
- High performance, first-class TypeScript support
- Plugin ecosystem for CORS, rate limiting, validation

**Key Dependencies**:
- `@google/genai` - Gemini API SDK (NOT `@google/generative-ai` - EOL Aug 2025)
- `@fastify/env` - Environment validation
- `@fastify/rate-limit` - Rate limiting
- `pino` - Structured logging

**Hosting**: Railway or Render recommended for MVP

## API Endpoints

### POST /api/identify-phrase
- Identifies Japanese text from screenshots
- PNG validation, size limits, rate limiting
- Returns tokenized phrase with readings and bounding box

### POST /api/analyze
- Analyzes Japanese phrases (translate, explain, grammar, vocabulary)
- **MVP: 4 action types** (future: kanji, conjugation, related)
- Optional fullPhrase context and image
- Input validation: max 1000 chars, fullPhrase must differ from phrase

### GET /api/health
- Health check for monitoring

## Key Patterns

### 1. SDK Configuration

Use `@google/genai` SDK with:
- Property: `config` (not `generationConfig`)
- Casing: camelCase (not snake_case)
- No `media_resolution` property in SDK

### 2. Plugin Configuration

Plugins cannot access `app.config` at registration time. Use lazy initialization or access config inside route handlers.

### 3. Image Validation

Validate full viewport dimensions for bounding box calculations:
```
imageWidth = viewportWidth * devicePixelRatio
imageHeight = viewportHeight * devicePixelRatio
```

Check PNG magic bytes for security, not just format string.

### 4. Error Handling

Categorize errors by type:
- Gemini API errors (auth, quota, content filtering) → hide details, return 503
- Network errors → user-friendly messages
- Validation errors → specific feedback
- Generic errors → sanitize in production (hide `originalError`)

Never expose API authentication errors to clients.

### 5. Lazy Service Initialization

Initialize services inside route handlers to ensure `app.config` is available:
```
let service: Service | null = null;
const getService = () => {
  if (!service) service = new Service(app.config.KEY, app.log);
  return service;
};
```

### 6. Configuration Access

Plugins must be wrapped with `fastify-plugin` to expose decorators. Call `app.ready()` before accessing `app.config` in server startup.

## Development

```bash
npm install          # Install dependencies
npm run build        # Build TypeScript
npm start            # Start production server
npm run test         # Run tests
```

## Environment Variables

See `.env.example` for required configuration:
- `GEMINI_API_KEY` - Gemini API key
- `PORT` - Server port
- `NODE_ENV` - Environment (development/production)
- `RATE_LIMIT_MAX_REQUESTS` - Requests per hour
- `MAX_IMAGE_SIZE` - Image size limit

## Design Decisions

### Action Type Scope
MVP implements 4 analysis actions (translate, explain, grammar, vocabulary). Design spec includes 7 total; remaining 3 (kanji, conjugation, related) planned for future.

### Response Schema
MVP uses generic response object for flexibility. Future: action-specific structured schemas per design spec.

### Rate Limiting
MVP: 50 requests/hour per endpoint. Future: per-user quotas, different limits by action type.

## Design Documentation

Complete design documentation is available in the shin-sekai project folder:

**Location**: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/design/`

```
shin-sekai/01_Projects/yomitoku/
└── design/
    ├── nodejs-server-architecture.md  # Node.js + Fastify + TypeScript architecture (APPROVED)
    ├── server-proxy.md                # Server architecture, API key management, rate limiting
    ├── api-integration.md             # Gemini API integration, screenshot handling, coordinates
    ├── ui-ux-design.md                # Extension UI that this server supports
    └── technical-architecture.md      # Chrome extension architecture, message passing
```

## Research Documentation

Research documentation is shared with the Chrome extension in shin-sekai:

**Location**: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/research/`

```
shin-sekai/01_Projects/yomitoku/
└── research/
    ├── gemini-api-research.md         # Gemini API capabilities, bounding boxes, cost optimization
    ├── google-genai-sdk-research.md   # SDK patterns (use @google/genai, NOT @google/generative-ai)
    └── fastify-framework-research.md  # Fastify patterns, plugins, schema validation
```

**Research Workflow**: When using `superpowers:using-live-documentation` skill, check shin-sekai research folder first. Only fetch external docs if not covered. Register new findings in shin-sekai.

## Workflow Skills

This project uses mandatory workflow skills. See global `~/.claude/CLAUDE.md` for:
- `superpowers:using-beads` - Issue tracking (ALWAYS use)
- `superpowers:using-live-documentation` - Fetch current library docs
- `superpowers:requesting-code-review` - Review before merging
- `superpowers:self-maintaining-claude-md` - Keep this file updated
