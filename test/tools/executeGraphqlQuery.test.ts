import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handler } from '../../src/tools/executeGraphqlQuery.js';

vi.mock('../../src/client.js', () => ({
  client: {
    request: vi.fn(),
  },
}));

const mockClient = vi.mocked(await import('../../src/client.js')).client;

describe('executeGraphqlQuery handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute GraphQL query successfully and return formatted result', async () => {
    const mockData = {
      user: {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
      },
    };

    mockClient.request.mockResolvedValueOnce(mockData);

    const query = `
      query GetUser {
        user(id: "1") {
          id
          name
          email
        }
      }
    `;

    const result = await handler({ query });

    expect(mockClient.request).toHaveBeenCalledWith(query);
    expect(mockClient.request).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(mockData, null, 2),
        },
      ],
    });
    expect(result.isError).toBeUndefined();
  });

  it('should handle GraphQL errors with proper error response', async () => {
    const graphqlError = new Error('GraphQL validation error: Field "invalidField" does not exist');
    mockClient.request.mockRejectedValueOnce(graphqlError);

    const query = 'query { invalidField }';

    const result = await handler({ query });

    expect(mockClient.request).toHaveBeenCalledWith(query);
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'GraphQL Error: GraphQL validation error: Field "invalidField" does not exist',
        },
      ],
      isError: true,
    });
  });

  it('should handle network errors with proper error response', async () => {
    const networkError = new Error('Network error: Failed to fetch');
    mockClient.request.mockRejectedValueOnce(networkError);

    const query = 'query { user { id } }';

    const result = await handler({ query });

    expect(mockClient.request).toHaveBeenCalledWith(query);
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'GraphQL Error: Network error: Failed to fetch',
        },
      ],
      isError: true,
    });
  });

  it('should handle unknown errors with fallback error message', async () => {
    mockClient.request.mockRejectedValueOnce('Some unknown error');

    const query = 'query { user { id } }';

    const result = await handler({ query });

    expect(mockClient.request).toHaveBeenCalledWith(query);
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'GraphQL Error: Unknown error',
        },
      ],
      isError: true,
    });
  });

  it('should handle complex GraphQL responses with nested data', async () => {
    const complexData = {
      users: [
        {
          id: '1',
          name: 'John Doe',
          posts: [
            { id: '10', title: 'First Post', createdAt: '2023-01-01' },
            { id: '11', title: 'Second Post', createdAt: '2023-01-02' },
          ],
        },
        {
          id: '2',
          name: 'Jane Smith',
          posts: [],
        },
      ],
      pagination: {
        total: 2,
        hasMore: false,
      },
    };

    mockClient.request.mockResolvedValueOnce(complexData);

    const query = `
      query GetUsersWithPosts {
        users {
          id
          name
          posts {
            id
            title
            createdAt
          }
        }
        pagination {
          total
          hasMore
        }
      }
    `;

    const result = await handler({ query });

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(complexData, null, 2),
        },
      ],
    });
    expect(result.isError).toBeUndefined();
  });

  it('should handle empty GraphQL responses', async () => {
    const emptyData = {};

    mockClient.request.mockResolvedValueOnce(emptyData);

    const query = 'query { __typename }';

    const result = await handler({ query });

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(emptyData, null, 2),
        },
      ],
    });
    expect(result.isError).toBeUndefined();
  });

  it('should handle null GraphQL responses', async () => {
    const nullData = null;

    mockClient.request.mockResolvedValueOnce(nullData);

    const query = 'query { user(id: "nonexistent") { id } }';

    const result = await handler({ query });

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(nullData, null, 2),
        },
      ],
    });
    expect(result.isError).toBeUndefined();
  });

  it('should preserve the exact query string passed to the client', async () => {
    const mockData = { test: true };
    mockClient.request.mockResolvedValueOnce(mockData);

    const queryWithWhitespace = `
      query Test {
        test
      }
    `;

    await handler({ query: queryWithWhitespace });

    expect(mockClient.request).toHaveBeenCalledWith(queryWithWhitespace);
  });
});