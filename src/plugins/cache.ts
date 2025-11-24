import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { AnalyzeCacheService } from '../services/cache';

const cachePluginImpl: FastifyPluginAsync = async (app) => {
  const maxEntries = app.config?.CACHE_MAX_ENTRIES ?? 1000;
  const ttlSeconds = app.config?.CACHE_TTL_SECONDS ?? 3600;

  const cacheService = new AnalyzeCacheService(maxEntries, ttlSeconds);

  app.decorate('analyzeCache', cacheService);

  app.get('/api/cache/stats', async () => {
    return cacheService.getStats();
  });
};

export const cachePlugin = fastifyPlugin(cachePluginImpl);

declare module 'fastify' {
  interface FastifyInstance {
    analyzeCache: AnalyzeCacheService;
  }
}
