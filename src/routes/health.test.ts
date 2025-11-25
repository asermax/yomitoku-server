import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../app.js';

describe('Health endpoint', () => {
  let app: Awaited<ReturnType<typeof build>>;

  beforeAll(async () => {
    // Set API_KEY environment variable for tests
    process.env.API_KEY = 'test-api-key';
    app = await build();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.API_KEY;
  });

  it('should return 200 status code', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
  });

  it('should return health status with required fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    const body = JSON.parse(response.body);

    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptime');
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('number');
    expect(typeof body.uptime).toBe('number');
  });
});
