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
- Using ANY library/framework API (Fastify, @google/genai, etc.)

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
- "I already know how Fastify works" (or any standard library function)
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
