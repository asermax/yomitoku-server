# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Yomitoku Server** is the backend proxy service for the Yomitoku Chrome extension. It securely proxies API requests from the extension to the Gemini 3 API, solving the critical problem that API keys cannot be stored securely in browser extensions.

This is a companion project to the **yomitoku-chrome-extension** repository.

For complete project context, see:
- **Main project README**: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/README.md`
- **Chrome extension repo**: `/home/agus/workspace/asermax/yomitoku-chrome-extension/`

## Design Documentation

Complete design documentation is available in the shin-sekai project folder:

**Location**: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/design/`

### Key Design Files

1. **server-proxy.md** - Complete server architecture specification
   - API key management and security
   - Request proxying and rate limiting
   - Caching strategy for cost optimization
   - Error handling and retry logic
   - Deployment considerations
   - Usage tracking and monitoring
   - API endpoint specifications
   - File: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/design/server-proxy.md`

2. **nodejs-server-architecture.md** - Node.js implementation architecture (APPROVED FOR IMPLEMENTATION)
   - Technology stack: Node.js + Fastify + TypeScript + @google/genai SDK
   - Complete project structure and file organization
   - TypeScript configuration and best practices
   - Environment configuration with @fastify/env
   - Plugin architecture (CORS, rate limiting, error handling, multipart)
   - Gemini service implementation patterns
   - Retry logic with exponential backoff
   - Route definitions with schema validation
   - Testing strategy with Vitest
   - Deployment configuration for Railway/Docker
   - Cost estimates and monitoring strategy
   - File: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/design/nodejs-server-architecture.md`

3. **api-integration.md** - Gemini 3 API integration details
   - Two-phase API approach (phrase identification + analysis)
   - Screenshot handling and data formats
   - Coordinate transformation algorithms
   - Error handling strategies
   - Cost optimization techniques
   - File: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/design/api-integration.md`

4. **ui-ux-design.md** - Extension UI that this server supports
   - Understanding the client-side interaction flow
   - Action types and their requirements
   - File: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/design/ui-ux-design.md`

5. **technical-architecture.md** - Chrome extension architecture
   - Client-side architecture patterns
   - Message passing and state management
   - File: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/design/technical-architecture.md`

## Architecture

### Core Responsibilities

1. **API Key Management** - Securely store and use Gemini API key
2. **Request Proxying** - Forward extension requests to Gemini 3 API
3. **Rate Limiting** - Prevent abuse and control costs
4. **Error Handling** - Graceful degradation and retry strategies
5. **Caching** - Reduce API costs by caching common requests
6. **Usage Tracking** - Monitor API usage and costs

### API Endpoints

**POST /api/identify-phrase**
- Proxies phrase identification from screenshot to Gemini 3
- Returns tokenized phrase with romaji and bounding box
- Handles image validation (PNG format, 5MB max) and size limits
- Rate limited: 50 requests per hour
- Requires: image (base64 PNG), selection (with viewportWidth/Height), optional metadata
- Type safety: `IdentifyPhraseRequest` from `src/types/api.ts`

**POST /api/analyze**
- Proxies content analysis requests (translate, explain, vocabulary, etc.)
- Supports phrase-level and word-level actions
- Returns structured analysis results

**GET /api/health**
- Health check endpoint for monitoring
- No rate limiting

### Technology Stack (DECIDED - APPROVED FOR IMPLEMENTATION)

**Framework**: Node.js + Fastify + TypeScript
- **Why chosen**: High performance, first-class TypeScript support, excellent plugin ecosystem
- **Complete spec**: See `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/design/nodejs-server-architecture.md`

**Core Dependencies**:
- `@google/genai` ^1.30.0 (NOT `@google/generative-ai` - legacy EOL Aug 2025)
- `fastify` ^5.x - Web framework
- `@fastify/cors` ^10.x - CORS support
- `@fastify/rate-limit` ^10.x - Rate limiting
- `@fastify/env` ^5.x - Environment validation
- `pino` ^9.x - Logging
- `typescript` ^5.x
- `vitest` ^2.x - Testing framework

**Database** (future): PostgreSQL for user data, Redis for caching

**Hosting**: Railway or Render (container) recommended for MVP
- Allows persistent in-memory cache
- Simple deployment and scaling
- Alternative: Vercel/Netlify (serverless) for lower cost but no persistent cache

## Development Commands

```bash
npm install             # Install dependencies
npm run dev             # Development server with hot reload (ts-node-dev)
npm run build           # Build TypeScript to JavaScript
npm start               # Start production server
npm run test            # Run tests with Vitest
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
npm run lint            # Run linting
npm run format          # Format code with Prettier
```

## Critical Implementation Patterns

#### 1. @google/genai SDK API (NOT @google/generative-ai)

**CRITICAL**: Use `@google/genai` (NOT `@google/generative-ai` which is EOL August 2025)

**API Structure**:
```typescript
await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: [{ parts: [...] }],
  config: {  // NOT generationConfig!
    responseMimeType: 'application/json',  // camelCase, NOT response_mime_type
    responseSchema: schema,                 // camelCase, NOT response_schema
    temperature: 0.2,
  },
});
```

**Key differences from REST API**:
- Property: `config` (not `generationConfig`)
- Casing: camelCase (not snake_case)
- No `media_resolution` property in SDK (use default behavior)

#### 2. Fastify Plugin Configuration Timing

**CRITICAL**: Plugins cannot access `app.config` at plugin registration time.

**Problem**:
```typescript
// ❌ WRONG - app.config is undefined at plugin load time
export const rateLimitPlugin: FastifyPluginAsync = async (app) => {
  await app.register(rateLimit, {
    max: app.config.RATE_LIMIT_MAX_REQUESTS,  // undefined!
  });
};
```

**Solution**:
```typescript
// ✅ CORRECT - Access config inside plugin function
export const rateLimitPlugin: FastifyPluginAsync = async (app) => {
  const maxRequests = app.config?.RATE_LIMIT_MAX_REQUESTS ?? 100;
  await app.register(rateLimit, { max: maxRequests });
};
```

**Why**: Even though `await app.after()` is called after envPlugin registration, plugins are evaluated at module load time before the server finishes building.

#### 3. Image Dimension Calculation

**CRITICAL**: Use full viewport dimensions, NOT selection bounds.

Client must send `viewportWidth` and `viewportHeight` in the selection object. Calculate actual image dimensions:

```typescript
const imageWidth = selection.viewportWidth * devicePixelRatio;  // Full viewport
const imageHeight = selection.viewportHeight * devicePixelRatio;
```

**Why**: Gemini API needs the full image dimensions for correct bounding box normalization.

#### 4. Base64 Image Validation

**Security Best Practice**: Validate PNG magic bytes, don't just check format string.

```typescript
const pngMagicBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
if (!imageBuffer.subarray(0, 4).equals(pngMagicBytes)) {
  throw new ApplicationError('INVALID_REQUEST', 'Image must be PNG format', 400);
}
```

#### 5. Lazy Service Initialization

**Pattern**: Initialize services inside route handlers to ensure `app.config` is available.

```typescript
export const identifyPhraseRoutes: FastifyPluginAsync = async (app) => {
  let geminiService: GeminiService | null = null;

  const getGeminiService = () => {
    if (!geminiService) {
      geminiService = new GeminiService(app.config.GEMINI_API_KEY, app.log);
    }
    return geminiService;
  };

  app.post('/identify-phrase', async (request, reply) => {
    const result = await getGeminiService().identifyPhrase(...);
  });
};
```

### Type Safety Patterns

**Shared Types**: All API types in `src/types/api.ts`
- `IdentifyPhraseRequest` - Request body type
- `SelectionRegion` - Coordinates with viewport dimensions
- `PhraseToken` - Token structure in responses
- Prevents type drift between schema and TypeScript definitions

## Key Design Principles

### Security-First Architecture

The entire purpose of this server is security:
- API keys stored in environment variables, never exposed
- Request validation on all inputs
- Rate limiting to prevent abuse
- HTTPS/TLS for all communication
- CORS restricted to extension origin only

### Cost Management

API costs are a primary concern:
- Cache analysis results (not image identification)
- Rate limiting to control usage
- Usage tracking for cost monitoring
- Efficient request validation to fail fast

### Reliability

The extension depends on this service:
- Graceful error handling with user-friendly messages
- Retry logic for transient failures
- Health checks for monitoring
- Structured error responses

## Request/Response Patterns

### Error Response Format

All errors follow consistent structure:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly message",
    "details": {}
  }
}
```

Common error codes:
- `INVALID_REQUEST` - Malformed request
- `IMAGE_TOO_LARGE` - Image exceeds size limit
- `NO_TEXT_FOUND` - No Japanese text detected
- `API_ERROR` - Gemini API error
- `TIMEOUT` - Request timeout
- `RATE_LIMIT` - Too many requests

### Rate Limiting

**MVP (Personal Use)**:
- 100 requests per hour per IP
- 1000 requests per day per IP

**Future (Public Release)**:
- Per-user quotas based on authentication
- Different limits for different action types

## Caching Strategy

### What to Cache

**DO cache**: Analysis requests (translate, explain, vocabulary, etc.)
- Cache key: Hash of (phrase + action type)
- TTL: 1 hour for most requests, 24 hours for static content (kanji)
- High hit rate for common phrases

**DON'T cache**: Phrase identification from images
- Images vary too much for the same text
- Bounding box depends on specific screenshot

### Cache Implementation

**MVP**: In-memory LRU cache
- Max 1000 entries
- Short TTL (5-15 minutes)

**Future**: Redis for persistence
- Longer TTL (1 hour+)
- Shared across server instances
- Metrics tracking

## Mandatory Workflow Skills

Claude Code provides built-in workflow skills via the Skill tool. Use these skills to ensure consistent, high-quality work.

### Always Use Beads

**ALWAYS use** `superpowers:using-beads` skill for ALL tasks.

Every conversation starts with:
1. Invoke the `superpowers:using-beads` skill using the Skill tool
2. Follow the skill's instructions to check for local bd database and initialize if needed
3. Track ALL work with bd (questions, research, implementation, everything)

**No exceptions:**
- Questions about codebase → Track as work in beads
- Project state inquiries → Track as work in beads
- Code implementation → Track as work in beads
- Research tasks → Track as work in beads

### Code-Related Task Workflows

When ANY task involves **code-related activities**, ALSO read these skills:

**Code-related activities include:**
- Writing implementation code
- Writing tests
- Researching libraries/frameworks (before or during implementation)
- Modifying existing code
- Debugging implementation issues
- Planning code structure (architectural decisions involving libraries)
- Reviewing code

#### Pre-Work Skill Invocation Checklist

**BEFORE starting ANY task, create a todo:**

```
☐ Decide which skills I should use based on the task
```

**Then answer these questions to make the decision:**

1. Does this task involve ANY work? → YES = invoke `using-beads`
2. Does this task involve understanding code behavior? → YES = code-related
3. Will I eventually need to modify code? → YES = code-related
4. Does it involve library/framework APIs? → YES = code-related
5. Will I complete a task (any size) that modifies code? → YES = plan to invoke `requesting-code-review` after

**If question 1 is YES (it always is):**
- Invoke `superpowers:using-beads`

**If ANY of questions 2-4 are YES:**
- STOP immediately
- Invoke all three code workflow skills NOW
- THEN begin investigation

**Critical principle: "Investigation" and "implementation" are not separate phases.**

If you're investigating TO implement, invoke skills before investigating. Do not rationalize "I'll invoke skills when I start coding" - that violates the workflow.

**BEFORE writing, editing, or planning ANY code (including tests), you MUST:**

1. **Stop and ask:** "Am I about to write/edit code or use library APIs?"
2. **If YES → Invoke ALL three code workflow skills** (no exceptions):
   - `superpowers:using-live-documentation` - Fetch current docs for ANY library/framework
   - `superpowers:requesting-code-review` - Plan to use after completing implementation
   - `superpowers:self-maintaining-claude-md` - Add CLAUDE.md reflection todo BEFORE starting

3. **If NO** (only reading/answering questions) → Just use beads

**"About to write code" includes:**
- Implementing features or bug fixes
- Writing or modifying tests
- Editing existing functions
- Using ANY library/framework API (FastAPI, Express, Gemini SDK, etc.)

**It does NOT include:**
- Reading files to answer questions
- Explaining how existing code works
- Performing grep/glob searches
- Discussing architecture without implementation

**Hard stop before tool use:**
- Before using Edit/Write tools, verify: "Did I invoke the three code workflow skills?"
- If NO → STOP. Invoke them now. Then proceed.

### Workflow Compliance Requirements

**You MUST:**
1. **Invoke skills ONE AT A TIME** - Never invoke multiple skills in the same message, as this causes loading conflicts. Wait for each skill to load completely before invoking the next one.
2. Invoke each applicable skill using the Skill tool
3. Announce you've invoked each skill and are following it
4. Create TodoWrite todos for checklists in those skills
5. Then begin work

### Common Rationalization Traps

**You may NOT skip workflows because:**

| Excuse | Reality |
|--------|---------|
| "This is just a question, no beads needed" | ALL tasks require beads tracking, including questions |
| "Not writing code yet, skip code workflows" | Correct - beads only until code tasks start |
| "Simple code change, skip research" | Library involvement = mandatory documentation fetch |
| "Code review is overkill for small fixes" | Review catches issues before they compound |
| "I'll update CLAUDE.md later" | "Later" means "forgotten" - add todo before starting |
| "Time pressure means skip workflows" | Time pressure makes proper workflows MORE important |

### Task Classification Examples

| User Request | Required Workflows |
|--------------|-------------------|
| "How does the server proxy work?" | Beads only |
| "What's the caching strategy?" | Beads only |
| "Explain the rate limiting logic" | Beads only |
| "Plan the FastAPI endpoint structure" | Beads + live documentation |
| "Implement the identify-phrase endpoint" | Beads + all code workflows |
| "Fix the CORS configuration bug" | Beads + all code workflows |
| "Add tests for rate limiting" | Beads + all code workflows |
| "Research Gemini API integration patterns" (before implementing) | Beads + live documentation |

### You Cannot Negotiate Workflows

**NEVER offer to skip workflows as a user choice.**

Forbidden patterns:
- "Option A: Follow workflows, Option B: Skip workflows - which do you prefer?"
- "I could skip workflows if you're in a hurry"
- "Would you like me to do this properly or quickly?"

**Why:** Workflows are non-negotiable project practices. Your role is to follow them, not offer shortcuts.

**Correct approach:** If time constrained, explain time needed for proper workflows and suggest appropriate scheduling.

### Red Flags - STOP

If you're thinking:
- "This task is straightforward, skip the workflows"
- "I already know what these skills say"
- "Only some workflows apply here"
- "Let me offer skipping workflows as an option"
- "This is just a bug fix, not a feature"
- "The change is only 10 lines"
- "I already know how FastAPI works" (or any standard library function)
- "This doesn't affect architecture"
- "Code review is overkill for small fixes"
- "I'll update CLAUDE.md later"

**STOP. Invoke applicable workflow skills using the Skill tool. Then proceed.**

### Why This Matters

**Workflow skills exist because:**
- They prevent error classes that seem "unlikely" but happen anyway
- Beads tracks ALL work, preventing forgotten tasks
- Live documentation prevents outdated implementation patterns
- Code review catches issues before they cascade
- Self-maintaining CLAUDE.md preserves architectural knowledge

**Cost of reading skills: ~2 minutes**
**Cost of skipping: hours of rework**

### Foundational Principle

**Skipping mandatory workflows based on your assessment of task type, complexity, or time pressure is NEVER acceptable.**

If task requires beads (all tasks), use beads. If task is code-related, use all code workflows. No assessment. No negotiation. No exceptions.

## Research Documentation

This project shares research documentation with the Chrome extension in the **shin-sekai** vault at:
`/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/`

### Research Folder Structure

```
shin-sekai/01_Projects/yomitoku/
├── research/                                # Active research notes
│   ├── chrome-manifest-v3-architecture.md   # Service workers, content scripts, message passing, permissions
│   ├── typescript-chrome-extensions.md      # TypeScript config, type definitions, build setup, type-safe messaging
│   ├── chrome-extension-tooling-research.md # Build frameworks (WXT, Plasmo, CRXJS), bundlers, testing tools
│   ├── react-chrome-extensions-guide.md     # React setup, Shadow DOM, state management, styling, performance
│   ├── gemini-api-research.md               # Image analysis, phrase identification, cost optimization, API patterns
│   ├── google-genai-sdk-research.md         # Google Generative AI SDK patterns and best practices
│   ├── drag-select-screenshot-research.md   # Drag-to-select UI, screenshot capture, coordinate handling
│   ├── overlay-ui-best-practices.md         # Shadow DOM, CSS isolation, z-index, event handling, accessibility
│   └── fastify-framework-research.md        # Fastify server framework patterns (for yomitoku-server)
└── design/                                  # Design decisions and specifications
```

### Key Research Files

1. **gemini-api-research.md** - Comprehensive Gemini API integration guide
   - Image analysis capabilities and OCR
   - Bounding box detection and coordinate systems
   - Context-aware text analysis strategies
   - Cost optimization patterns
   - Authentication and security best practices
   - Complete implementation examples
   - File: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/research/gemini-api-research.md`

2. **google-genai-sdk-research.md** - Google Gen AI Node.js SDK documentation
   - **CRITICAL**: Use `@google/genai` (NOT `@google/generative-ai` - EOL August 31, 2025)
   - SDK installation and setup
   - API patterns for phrase identification and analysis
   - Error handling and retry strategies
   - Cost tracking and monitoring
   - File: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/research/google-genai-sdk-research.md`

3. **fastify-framework-research.md** - Fastify framework research
   - High-performance Node.js framework selection
   - Plugin architecture and best practices
   - Schema validation with Ajv
   - Rate limiting and CORS configuration
   - Production deployment patterns
   - File: `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/research/fastify-framework-research.md`

### Research Workflow

**When dispatching documentation-searcher subagent (via `using-live-documentation` skill):**

Include in your subagent prompt that existing research documentation is available at:
- `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/research/`

Instruct the subagent to:
1. Check if research already exists for the library/framework in that directory
2. Only fetch external documentation via Context7 if shin-sekai doesn't have coverage
3. Report back with either existing research findings OR freshly fetched documentation

**After receiving subagent's response:**
- Use the synthesized information for implementation
- **Add todo:** "Register research findings in shin-sekai" (if new external research was fetched)

**When processing the shin-sekai registration todo:**
- Check if research file exists for this library/framework in `shin-sekai/01_Projects/yomitoku/research/`
- If exists: Append new findings
- If new: Create new research file
- Include: API patterns, gotchas, version-specific notes, code examples
- Commit changes to shin-sekai repo

**Why this matters:**
- Avoids duplicate research effort (saves time and token budget)
- Reuses validated patterns and solutions already proven in this project
- Prevents re-discovering the same gotchas multiple times
- Research accumulated during development becomes institutional knowledge
- Subagent handles shin-sekai check, reducing main agent context usage

## Design Documentation

This project shares design documentation with the Chrome extension in the **shin-sekai** vault at:
`/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/`

### Design Folder Structure

```
shin-sekai/01_Projects/yomitoku/
├── design/                                  # Design decisions and specifications
│   ├── ui-ux-design.md                      # UI/UX specification, single panel interface, action system
│   ├── technical-architecture.md            # Build system (WXT), component structure, message passing, state mgmt
│   ├── api-integration.md                   # Gemini 3 API integration, screenshot capture, error handling
│   ├── server-proxy.md                      # Backend proxy design (deprecated in favor of nodejs-server-architecture.md)
│   └── nodejs-server-architecture.md        # Node.js server architecture (Fastify + Google GenAI SDK) - CURRENT
└── research/                                # Technical research notes
```

### Design Workflow

**When working on architectural or design tasks:**

Design documentation is located at:
- `/home/agus/workspace/asermax/shin-sekai/01_Projects/yomitoku/design/`

**Before implementing features:**
1. Read relevant design documentation for context and patterns
2. Verify implementation aligns with documented design decisions
3. Note any deviations or discoveries during implementation

**After completing features or making architectural changes:**
- **Add todo:** "Update design documentation in shin-sekai" (if patterns changed or new patterns emerged)

**When processing the shin-sekai design update todo:**
- Check which design file(s) are affected in `shin-sekai/01_Projects/yomitoku/design/`
- Update with: new patterns, revised decisions, implementation learnings, gotchas discovered
- Keep design docs synchronized with actual implementation
- Commit changes to shin-sekai repo

**Why this matters:**
- Design docs reflect actual implementation, not just initial plans
- Future work references accurate patterns and decisions
- Lessons learned during implementation are preserved
- Prevents design drift between documentation and code

## Related Projects

### Yomitoku Chrome Extension

**Repository**: `/home/agus/workspace/asermax/yomitoku-chrome-extension/`

The client-side Chrome extension that this server supports. Understanding the extension's interaction patterns is important when implementing server endpoints.

Key files to reference:
- `CLAUDE.md` - Extension architecture and patterns
- `api/` - Client-side API integration (shows expected request/response formats)
- `types/messages.ts` - Type definitions for API communication

## Environment Variables

Required configuration for running the server:

```bash
# Gemini API
GEMINI_API_KEY=<api-key>
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1

# Server
PORT=3000
NODE_ENV=production  # or development

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000  # 1 hour
RATE_LIMIT_MAX_REQUESTS=100

# Caching
CACHE_TTL_SECONDS=3600
CACHE_MAX_ENTRIES=1000

# Logging
LOG_LEVEL=info

# CORS (Chrome extension origin)
ALLOWED_ORIGINS=chrome-extension://<extension-id>
```

## Testing Strategy

### Unit Tests

Focus areas:
- Request validation logic
- Error handling and response formatting
- Cache key generation and retrieval
- Rate limiting calculations

### Integration Tests

Test scenarios:
- End-to-end API endpoint calls
- Gemini API integration (use mocks for cost control)
- Cache behavior under various conditions
- Rate limiting enforcement

### Load Testing

Goals:
- Determine maximum requests per second
- Identify performance bottlenecks
- Validate rate limiting under load
- Monitor resource usage (memory, CPU)

Tools: Artillery or k6 for load generation

## Deployment Considerations

### MVP Deployment

**Recommended**: Vercel or Netlify (serverless)
- Easy deployment with git push
- Auto-scaling for variable load
- Low cost for personal use
- Note: Serverless means no persistent in-memory cache

**Alternative**: Railway or Render (container)
- Always-on server allows in-memory cache
- Good for moderate traffic
- Simple pricing and deployment

### Production Scaling

**Horizontal scaling** considerations:
- Multiple server instances behind load balancer
- Shared Redis cache across instances
- No session affinity required

**Monitoring** essentials:
- Health check endpoint (`/api/health`)
- Error rate tracking
- API cost monitoring with alerts
- Response time percentiles (P50, P95, P99)
