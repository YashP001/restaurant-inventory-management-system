import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api';

describe('API Client Error Handling and Expiration Dispatch', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('dispatches ub_auth_expired event and purges storage on 401 response', async () => {
    localStorage.setItem('ub_token', 'test_expired_token');
    localStorage.setItem('ub_user', JSON.stringify({ role: 'ADMIN' }));

    const expiredListener = vi.fn();
    window.addEventListener('ub_auth_expired', expiredListener);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: false,
        error: { message: 'Authentication token expired', code: 'TOKEN_EXPIRED' }
      })
    });

    await expect(api.get('/inventory')).rejects.toThrow();

    expect(expiredListener).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('ub_token')).toBeNull();
    expect(localStorage.getItem('ub_user')).toBeNull();

    window.removeEventListener('ub_auth_expired', expiredListener);
  });

  it('extracts structured error message from API response body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: false,
        error: 'Cannot decrease stock. Batch has insufficient quantity.',
        code: 'INSUFFICIENT_BATCH_STOCK'
      })
    });

    try {
      await api.post('/inventory/adjustments', { batch_id: 1, quantity: 999 });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err.status).toBe(400);
      expect(err.message).toContain('Cannot decrease stock');
    }
  });

  it('includes bearer token in request Authorization header when present in storage', async () => {
    localStorage.setItem('ub_token', 'my_saved_token');

    let capturedHeaders = null;
    global.fetch = vi.fn().mockImplementation((url, config) => {
      capturedHeaders = config.headers;
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: [] })
      });
    });

    await api.get('/orders');

    expect(capturedHeaders['Authorization']).toBe('Bearer my_saved_token');
  });
});
