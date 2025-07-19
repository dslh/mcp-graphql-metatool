import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

import { createDynamicToolHandler } from '../src/dynamicToolHandler.js';
import type { SavedToolConfig } from '../src/types.js';

// Mock the client before importing the handler
vi.mock('../src/client.js', () => ({
  client: {
    request: vi.fn(),
  },
}));

// Import the mocked client
import { client } from '../src/client.js';

describe('dynamicToolHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDynamicToolHandler', () => {
    it('should execute GraphQL query successfully with valid parameters', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'get_user',
        description: 'Get user by ID',
        graphql_query: 'query GetUser($id: ID!) { user(id: $id) { name email } }',
        parameter_schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        variables: ['id'],
      };

      const mockResult = { user: { name: 'John Doe', email: 'john@example.com' } };
      vi.mocked(client.request).mockResolvedValue(mockResult);

      const handler = createDynamicToolHandler(toolConfig);
      const result = await handler({ id: '123' });

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: JSON.stringify(mockResult, null, 2),
      });
      expect(client.request).toHaveBeenCalledWith(
        'query GetUser($id: ID!) { user(id: $id) { name email } }',
        { id: '123' }
      );
    });

    it('should handle parameter validation errors', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'get_user',
        description: 'Get user by ID',
        graphql_query: 'query GetUser($id: ID!) { user(id: $id) { name } }',
        parameter_schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        variables: ['id'],
      };

      const handler = createDynamicToolHandler(toolConfig);
      const result = await handler({ id: 123 }); // Invalid type - should be string

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.text).toContain('Parameter validation error');
      expect(result.content[0]?.text).toContain('id');
      expect(client.request).not.toHaveBeenCalled();
    });

    it('should handle GraphQL execution errors', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'get_user',
        description: 'Get user by ID',
        graphql_query: 'query GetUser($id: ID!) { user(id: $id) { name } }',
        parameter_schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        variables: ['id'],
      };

      const graphqlError = new Error('GraphQL syntax error');
      vi.mocked(client.request).mockRejectedValue(graphqlError);

      const handler = createDynamicToolHandler(toolConfig);
      const result = await handler({ id: '123' });

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.text).toContain('Error executing tool');
      expect(result.content[0]?.text).toContain('GraphQL syntax error');
    });

    it('should handle missing required parameters', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'get_user',
        description: 'Get user by ID',
        graphql_query: 'query GetUser($id: ID!) { user(id: $id) { name } }',
        parameter_schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        variables: ['id'],
      };

      const handler = createDynamicToolHandler(toolConfig);
      const result = await handler({}); // Missing required id parameter

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.text).toContain('Parameter validation error');
    });

    it('should handle complex parameter schemas', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'search_users',
        description: 'Search users with filters',
        graphql_query: 'query SearchUsers($filters: UserFilters!, $limit: Int) { users(filters: $filters, limit: $limit) { id name } }',
        parameter_schema: {
          type: 'object',
          properties: {
            filters: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                active: { type: 'boolean' },
              },
            },
            limit: { type: 'integer' },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        variables: ['filters', 'limit'],
      };

      const mockResult = { users: [{ id: '1', name: 'John' }] };
      vi.mocked(client.request).mockResolvedValue(mockResult);

      const handler = createDynamicToolHandler(toolConfig);
      const result = await handler({
        filters: { name: 'John', active: true },
        limit: 10,
        tags: ['admin', 'user'],
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0]?.text).toContain('"users"');
      expect(client.request).toHaveBeenCalledWith(
        toolConfig.graphql_query,
        { filters: { name: 'John', active: true }, limit: 10 }
      );
    });
  });

  describe('variable extraction (tested indirectly)', () => {
    it('should extract single variable from GraphQL query', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'get_user',
        description: 'Get user by ID',
        graphql_query: 'query GetUser($id: ID!) { user(id: $id) { name } }',
        parameter_schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        variables: ['id'],
      };

      const mockResult = { user: { name: 'John' } };
      vi.mocked(client.request).mockResolvedValue(mockResult);

      const handler = createDynamicToolHandler(toolConfig);
      await handler({ id: '123' });

      expect(client.request).toHaveBeenCalledWith(
        toolConfig.graphql_query,
        { id: '123' }
      );
    });

    it('should extract multiple variables from GraphQL query', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'search_users',
        description: 'Search users',
        graphql_query: 'query SearchUsers($name: String!, $limit: Int, $active: Boolean) { users(name: $name, limit: $limit, active: $active) { id } }',
        parameter_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            limit: { type: 'integer' },
            active: { type: 'boolean' },
          },
        },
        variables: ['name', 'limit', 'active'],
      };

      const mockResult = { users: [] };
      vi.mocked(client.request).mockResolvedValue(mockResult);

      const handler = createDynamicToolHandler(toolConfig);
      await handler({ name: 'John', limit: 10, active: true });

      expect(client.request).toHaveBeenCalledWith(
        toolConfig.graphql_query,
        { name: 'John', limit: 10, active: true }
      );
    });

    it('should handle query with no variables', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'get_all_users',
        description: 'Get all users',
        graphql_query: 'query GetAllUsers { users { id name } }',
        parameter_schema: {
          type: 'object',
          properties: {},
        },
        variables: [],
      };

      const mockResult = { users: [] };
      vi.mocked(client.request).mockResolvedValue(mockResult);

      const handler = createDynamicToolHandler(toolConfig);
      await handler({});

      expect(client.request).toHaveBeenCalledWith(
        toolConfig.graphql_query,
        {}
      );
    });

    it('should extract all provided variables from parameters', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'partial_search',
        description: 'Search with all parameters',
        graphql_query: 'query Search($name: String, $email: String, $age: Int) { users(name: $name, email: $email, age: $age) { id } }',
        parameter_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            age: { type: 'integer' },
          },
        },
        variables: ['name', 'email', 'age'],
      };

      const mockResult = { users: [] };
      vi.mocked(client.request).mockResolvedValue(mockResult);

      const handler = createDynamicToolHandler(toolConfig);
      await handler({ name: 'John', email: 'john@example.com', age: 30 });

      expect(client.request).toHaveBeenCalledWith(
        toolConfig.graphql_query,
        { name: 'John', email: 'john@example.com', age: 30 }
      );
    });

  });

  describe('schema conversion (tested indirectly)', () => {
    it('should handle string type validation', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'string_test',
        description: 'Test string validation',
        graphql_query: 'query Test($name: String!) { test(name: $name) }',
        parameter_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
        variables: ['name'],
      };

      const handler = createDynamicToolHandler(toolConfig);
      
      // Test valid string
      vi.mocked(client.request).mockResolvedValue({});
      const validResult = await handler({ name: 'valid string' });
      expect(validResult.isError).toBeUndefined();

      // Test invalid type (number instead of string)
      const invalidResult = await handler({ name: 123 });
      expect(invalidResult.isError).toBe(true);
      expect(invalidResult.content[0]?.text).toContain('Parameter validation error');
    });

    it('should handle number type validation', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'number_test',
        description: 'Test number validation',
        graphql_query: 'query Test($score: Float!) { test(score: $score) }',
        parameter_schema: {
          type: 'object',
          properties: {
            score: { type: 'number' },
          },
        },
        variables: ['score'],
      };

      const handler = createDynamicToolHandler(toolConfig);
      
      // Test valid number
      vi.mocked(client.request).mockResolvedValue({});
      const validResult = await handler({ score: 42.5 });
      expect(validResult.isError).toBeUndefined();

      // Test invalid type (string instead of number)
      const invalidResult = await handler({ score: 'not a number' });
      expect(invalidResult.isError).toBe(true);
    });

    it('should handle integer type validation', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'integer_test',
        description: 'Test integer validation',
        graphql_query: 'query Test($count: Int!) { test(count: $count) }',
        parameter_schema: {
          type: 'object',
          properties: {
            count: { type: 'integer' },
          },
        },
        variables: ['count'],
      };

      const handler = createDynamicToolHandler(toolConfig);
      
      // Test valid integer
      vi.mocked(client.request).mockResolvedValue({});
      const validResult = await handler({ count: 42 });
      expect(validResult.isError).toBeUndefined();

      // Test invalid type (float instead of integer)
      const invalidResult = await handler({ count: 42.5 });
      expect(invalidResult.isError).toBe(true);
    });

    it('should handle boolean type validation', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'boolean_test',
        description: 'Test boolean validation',
        graphql_query: 'query Test($active: Boolean!) { test(active: $active) }',
        parameter_schema: {
          type: 'object',
          properties: {
            active: { type: 'boolean' },
          },
        },
        variables: ['active'],
      };

      const handler = createDynamicToolHandler(toolConfig);
      
      // Test valid boolean
      vi.mocked(client.request).mockResolvedValue({});
      const validResult = await handler({ active: true });
      expect(validResult.isError).toBeUndefined();

      // Test invalid type (string instead of boolean)
      const invalidResult = await handler({ active: 'true' });
      expect(invalidResult.isError).toBe(true);
    });

    it('should handle array type validation', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'array_test',
        description: 'Test array validation',
        graphql_query: 'query Test($tags: [String!]!) { test(tags: $tags) }',
        parameter_schema: {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        variables: ['tags'],
      };

      const handler = createDynamicToolHandler(toolConfig);
      
      // Test valid array
      vi.mocked(client.request).mockResolvedValue({});
      const validResult = await handler({ tags: ['tag1', 'tag2'] });
      expect(validResult.isError).toBeUndefined();

      // Test invalid type (not an array)
      const invalidResult = await handler({ tags: 'not an array' });
      expect(invalidResult.isError).toBe(true);
    });

    it('should handle array with no item schema (any type)', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'any_array_test',
        description: 'Test array with any items',
        graphql_query: 'query Test($items: [JSON!]!) { test(items: $items) }',
        parameter_schema: {
          type: 'object',
          properties: {
            items: { type: 'array' }, // No items schema - should accept any
          },
        },
        variables: ['items'],
      };

      const handler = createDynamicToolHandler(toolConfig);
      
      // Test array with mixed types (should be valid)
      vi.mocked(client.request).mockResolvedValue({});
      const validResult = await handler({ items: ['string', 123, true, { nested: 'object' }] });
      expect(validResult.isError).toBeUndefined();
    });

    it('should handle unsupported types by falling back to any', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'any_test',
        description: 'Test unsupported type fallback',
        graphql_query: 'query Test($data: JSON!) { test(data: $data) }',
        parameter_schema: {
          type: 'object',
          properties: {
            data: { type: 'unknown_type' }, // Unsupported type
          },
        },
        variables: ['data'],
      };

      const handler = createDynamicToolHandler(toolConfig);
      
      // Should accept any value since it falls back to z.any()
      vi.mocked(client.request).mockResolvedValue({});
      const result = await handler({ data: { complex: { nested: 'data' } } });
      expect(result.isError).toBeUndefined();
    });

    it('should handle non-object parameter schema', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'non_object_test',
        description: 'Test non-object schema',
        graphql_query: 'query Test { test }',
        parameter_schema: { type: 'string' }, // Not an object type
        variables: [],
      };

      const handler = createDynamicToolHandler(toolConfig);
      
      // Should create empty object schema when not an object type
      vi.mocked(client.request).mockResolvedValue({});
      const result = await handler({});
      expect(result.isError).toBeUndefined();
    });

    it('should handle schema with missing properties', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'missing_props_test',
        description: 'Test schema with no properties',
        graphql_query: 'query Test { test }',
        parameter_schema: { type: 'object' }, // No properties field
        variables: [],
      };

      const handler = createDynamicToolHandler(toolConfig);
      
      // Should create empty object schema when properties are missing
      vi.mocked(client.request).mockResolvedValue({});
      const result = await handler({});
      expect(result.isError).toBeUndefined();
    });
  });
});