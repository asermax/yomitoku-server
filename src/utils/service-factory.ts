/**
 * Creates a lazy initialization factory for services.
 *
 * Solves the Fastify plugin constraint: `app.config` is not available
 * at plugin registration time, only inside route handlers.
 *
 * @example
 * const getGeminiService = createServiceFactory(
 *   () => new GeminiService(app.config.GEMINI_API_KEY, app.log),
 * );
 *
 * // Later in route handler:
 * const service = getGeminiService(); // Creates instance on first call
 * const same = getGeminiService();    // Returns cached instance
 */
export const createServiceFactory = <T>(factory: () => T): (() => T) => {
  let instance: T;
  let initialized = false;

  return () => {
    if (!initialized) {
      instance = factory();
      initialized = true;
    }

    return instance;
  };
};
