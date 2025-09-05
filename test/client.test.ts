import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock graphql-request
vi.mock('graphql-request', () => ({
  GraphQLClient: vi.fn().mockImplementation((endpoint: string, options?: any) => ({
    endpoint,
    options,
  })),
}));

import { GraphQLClient } from 'graphql-request';

describe('client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  describe('createClient', () => {
    it('should throw error when GRAPHQL_ENDPOINT is undefined', async () => {
      delete process.env.GRAPHQL_ENDPOINT;
      
      // Re-import the module to trigger client creation with new env
      await expect(async () => {
        await import('../src/client.js');
      }).rejects.toThrow('GRAPHQL_ENDPOINT environment variable is required');
    });

    it('should throw error when GRAPHQL_ENDPOINT is empty string', async () => {
      process.env.GRAPHQL_ENDPOINT = '';
      
      await expect(async () => {
        await import('../src/client.js');
      }).rejects.toThrow('GRAPHQL_ENDPOINT environment variable is required');
    });

    it('should create client with no headers when no auth tokens provided', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      delete process.env.GRAPHQL_AUTH_TOKEN;
      delete process.env.GRAPHQL_COOKIE_HEADER;

      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {},
      });
    });

    it('should create client with Authorization header when GRAPHQL_AUTH_TOKEN provided', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_AUTH_TOKEN = 'test-bearer-token';
      delete process.env.GRAPHQL_COOKIE_HEADER;

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'Authorization': 'Bearer test-bearer-token',
        },
      });
    });

    it('should create client with Cookie header when GRAPHQL_COOKIE_HEADER provided', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_COOKIE_HEADER = 'sessionId=abc123; token=xyz789';
      delete process.env.GRAPHQL_AUTH_TOKEN;

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'Cookie': 'sessionId=abc123; token=xyz789',
        },
      });
    });

    it('should create client with both Authorization and Cookie headers when both tokens provided', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_AUTH_TOKEN = 'test-bearer-token';
      process.env.GRAPHQL_COOKIE_HEADER = 'sessionId=abc123; token=xyz789';

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'Authorization': 'Bearer test-bearer-token',
          'Cookie': 'sessionId=abc123; token=xyz789',
        },
      });
    });

    it('should ignore empty GRAPHQL_AUTH_TOKEN', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_AUTH_TOKEN = '';
      process.env.GRAPHQL_COOKIE_HEADER = 'sessionId=abc123';

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'Cookie': 'sessionId=abc123',
        },
      });
    });

    it('should ignore empty GRAPHQL_COOKIE_HEADER', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_AUTH_TOKEN = 'test-bearer-token';
      process.env.GRAPHQL_COOKIE_HEADER = '';

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'Authorization': 'Bearer test-bearer-token',
        },
      });
    });

    it('should ignore both empty auth tokens', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_AUTH_TOKEN = '';
      process.env.GRAPHQL_COOKIE_HEADER = '';

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {},
      });
    });

    it('should handle complex cookie strings', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_COOKIE_HEADER = 'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9; path=/; secure; httpOnly; sameSite=strict';
      delete process.env.GRAPHQL_AUTH_TOKEN;

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'Cookie': 'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9; path=/; secure; httpOnly; sameSite=strict',
        },
      });
    });

    it('should handle special characters in bearer token', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      delete process.env.GRAPHQL_COOKIE_HEADER;

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        },
      });
    });

    it('should use different GraphQL endpoints', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://different-api.example.com/v2/graphql';
      process.env.GRAPHQL_AUTH_TOKEN = 'different-token';

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://different-api.example.com/v2/graphql', {
        headers: {
          'Authorization': 'Bearer different-token',
        },
      });
    });
  });
});