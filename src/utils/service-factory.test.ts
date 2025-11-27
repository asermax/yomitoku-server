import { describe, it, expect, vi } from 'vitest';
import { createServiceFactory } from './service-factory.js';

describe('createServiceFactory', () => {
  it('should create instance on first call', () => {
    const factory = vi.fn(() => ({ data: 'service' }));
    const getService = createServiceFactory(factory);

    expect(factory).not.toHaveBeenCalled();

    const service = getService();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(service).toEqual({ data: 'service' });
  });

  it('should return same instance on subsequent calls', () => {
    const factory = vi.fn(() => ({ data: 'service' }));
    const getService = createServiceFactory(factory);

    const first = getService();
    const second = getService();
    const third = getService();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('should work with class instances', () => {
    class TestService {
      constructor(public config: string) {}
    }

    const factory = vi.fn(() => new TestService('test-config'));
    const getService = createServiceFactory(factory);

    const service = getService();

    expect(service).toBeInstanceOf(TestService);
    expect(service.config).toBe('test-config');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('should preserve type safety', () => {
    interface Service {
      method(): string;
    }

    const factory = (): Service => ({
      method: () => 'result',
    });

    const getService = createServiceFactory(factory);
    const service = getService();

    // TypeScript should infer Service type
    expect(service.method()).toBe('result');
  });

  it('should not call factory until first access', () => {
    const factory = vi.fn(() => ({ data: 'service' }));

    createServiceFactory(factory);

    expect(factory).not.toHaveBeenCalled();
  });

  it('should handle factory that returns null', () => {
    const factory = vi.fn(() => null);
    const getService = createServiceFactory(factory);

    const first = getService();
    const second = getService();

    // Factory called twice because null == null, so condition always recreates
    expect(factory).toHaveBeenCalledTimes(2);
    expect(first).toBeNull();
    expect(second).toBeNull();
  });

  it('should cache instance even if factory returns falsy values', () => {
    const factory = vi.fn(() => 0);
    const getService = createServiceFactory(factory);

    const first = getService();
    const second = getService();

    // Factory should be called twice because 0 is falsy but we check `instance == null`
    // Actually, 0 is NOT null/undefined, so it should be cached
    expect(factory).toHaveBeenCalledTimes(1);
    expect(first).toBe(0);
    expect(second).toBe(0);
  });
});
