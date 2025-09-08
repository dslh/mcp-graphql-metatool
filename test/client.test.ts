import { GraphQLClient } from 'graphql-request';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';


// Mock graphql-request
vi.mock('graphql-request', () => ({
  GraphQLClient: vi.fn().mockImplementation((endpoint: string, options?: any) => ({
    endpoint,
    options,
  })),
}));

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

    it('should create client with default headers when no auth tokens provided', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      delete process.env.GRAPHQL_AUTH_TOKEN;
      delete process.env.GRAPHQL_COOKIE_HEADER;

      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'content-type': 'application/json',
          'accept': '*/*',
          'user-agent': 'GraphQL-MCP-Server/1.0.0',
        },
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
          'authorization': 'Bearer test-bearer-token',
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
          'cookie': 'sessionId=abc123; token=xyz789',
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
          'authorization': 'Bearer test-bearer-token',
          'cookie': 'sessionId=abc123; token=xyz789',
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
          'cookie': 'sessionId=abc123',
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
          'authorization': 'Bearer test-bearer-token',
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
        headers: {
          'content-type': 'application/json',
          'accept': '*/*',
          'user-agent': 'GraphQL-MCP-Server/1.0.0',
        },
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
          'cookie': 'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9; path=/; secure; httpOnly; sameSite=strict',
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
          'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
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
          'authorization': 'Bearer different-token',
        },
      });
    });

    it('should handle GRAPHQL_HEADER_* environment variables', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_HEADER_USER_AGENT = 'Custom-User-Agent/1.0';
      process.env.GRAPHQL_HEADER_X_API_VERSION = 'v2';
      delete process.env.GRAPHQL_AUTH_TOKEN;
      delete process.env.GRAPHQL_COOKIE_HEADER;

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'user-agent': 'Custom-User-Agent/1.0',
          'x-api-version': 'v2',
        },
      });
    });

    it('should combine GRAPHQL_HEADER_* with legacy auth tokens', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_HEADER_X_CLIENT_VERSION = '1.2.3';
      process.env.GRAPHQL_AUTH_TOKEN = 'bearer-token';
      process.env.GRAPHQL_COOKIE_HEADER = 'session=abc123';

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'x-client-version': '1.2.3',
          'authorization': 'Bearer bearer-token',
          'cookie': 'session=abc123',
        },
      });
    });

    it('should ignore empty GRAPHQL_HEADER_* values', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_HEADER_CUSTOM = 'value';
      process.env.GRAPHQL_HEADER_EMPTY = '';
      delete process.env.GRAPHQL_AUTH_TOKEN;
      delete process.env.GRAPHQL_COOKIE_HEADER;

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'custom': 'value',
        },
      });
    });

    it('should convert header names from GRAPHQL_HEADER_* format correctly', async () => {
      process.env.GRAPHQL_ENDPOINT = 'https://api.example.com/graphql';
      process.env.GRAPHQL_HEADER_CONTENT_TYPE = 'application/graphql';
      process.env.GRAPHQL_HEADER_X_FORWARDED_FOR = '127.0.0.1';
      process.env.GRAPHQL_HEADER_ACCEPT_ENCODING = 'gzip';
      delete process.env.GRAPHQL_AUTH_TOKEN;
      delete process.env.GRAPHQL_COOKIE_HEADER;

      vi.resetModules();
      const { client } = await import('../src/client.js');

      expect(GraphQLClient).toHaveBeenCalledWith('https://api.example.com/graphql', {
        headers: {
          'content-type': 'application/graphql',
          'x-forwarded-for': '127.0.0.1',
          'accept-encoding': 'gzip',
        },
      });
    });
  });
});