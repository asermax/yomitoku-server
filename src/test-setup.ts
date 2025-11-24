/**
 * Vitest global setup
 * Runs once before all tests
 */

import { EventEmitter } from 'events';

// Increase max listeners to prevent warnings
// Each Fastify app instance adds an exit listener
// env.test.ts creates 10 instances, other test files add more
// Setting to 30 provides headroom for future test expansion
EventEmitter.defaultMaxListeners = 30;
