import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp } from '../helper.js';

describe('GET /api/health - Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 and valid health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      status: 'ok',
      timestamp: expect.any(Number),
      uptime: expect.any(Number),
    });
  });

  it('should have correct content-type header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.headers['content-type']).toContain('application/json');
  });

  it('should not require authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    // Health endpoint should always return 200, no auth required
    expect(response.statusCode).toBe(200);
  });

  it('should return increasing uptime on subsequent calls', async () => {
    const response1 = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));

    const response2 = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    const body1 = JSON.parse(response1.body);
    const body2 = JSON.parse(response2.body);

    expect(body2.uptime).toBeGreaterThanOrEqual(body1.uptime);
  });
});
