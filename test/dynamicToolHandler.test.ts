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
      
      // Should handle the schema conversion gracefully - the converted schema expects a string
      vi.mocked(client.request).mockResolvedValue({});
      const result = await handler('valid string'); // Pass a string since schema expects string
      expect(result.isError).toBeUndefined();
    });

    it('should handle json-schema-to-zod conversion for complex schemas', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'complex_conversion_test',
        description: 'Test complex schema conversion',
        graphql_query: 'query Test($data: ComplexInput!) { test(data: $data) }',
        parameter_schema: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    profile: {
                      type: 'object',
                      properties: {
                        email: { type: 'string', format: 'email' },
                        age: { type: 'integer', minimum: 0 },
                        tags: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                      required: ['email'],
                    },
                  },
                  required: ['id', 'profile'],
                },
                metadata: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                },
              },
              required: ['user'],
            },
          },
          required: ['data'],
        },
        variables: ['data'],
      };

      const handler = createDynamicToolHandler(toolConfig);

      const validComplexData = {
        data: {
          user: {
            id: 'user123',
            profile: {
              email: 'test@example.com',
              age: 25,
              tags: ['developer', 'javascript'],
            },
          },
          metadata: {
            source: 'api',
            version: '1.0',
          },
        },
      };

      vi.mocked(client.request).mockResolvedValue({ success: true });
      const result = await handler(validComplexData);
      expect(result.isError).toBeUndefined();
      expect(client.request).toHaveBeenCalledWith(
        toolConfig.graphql_query,
        validComplexData
      );
    });

    it('should handle schema validation errors with improved error messages', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'validation_error_test',
        description: 'Test validation error handling',
        graphql_query: 'query Test($user: UserInput!) { test(user: $user) }',
        parameter_schema: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string', format: 'email' },
                age: { type: 'integer', minimum: 0 },
              },
              required: ['id', 'email'],
            },
          },
          required: ['user'],
        },
        variables: ['user'],
      };

      const handler = createDynamicToolHandler(toolConfig);

      // Test with missing required fields
      const invalidData = {
        user: {
          // Missing id and email (required fields)
          age: 25,
        },
      };

      const result = await handler(invalidData);
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Parameter validation error');
      expect(client.request).not.toHaveBeenCalled();
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

  describe('MCP tool parameter requirements', () => {
    it('should handle missing optional parameters successfully', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'optional_params_test',
        description: 'Test optional parameter handling',
        graphql_query: 'query Test($required: String!, $optional: String, $withDefault: Int) { test(required: $required, optional: $optional, withDefault: $withDefault) }',
        parameter_schema: {
          type: 'object',
          properties: {
            required: { type: 'string' },
            optional: { type: 'string' },
            withDefault: { type: 'integer', default: 42 },
          },
          required: ['required'],
        },
        variables: ['required', 'optional', 'withDefault'],
      };

      const mockResult = { test: 'success' };
      vi.mocked(client.request).mockResolvedValue(mockResult);

      const handler = createDynamicToolHandler(toolConfig);
      
      // Should succeed with only required parameter
      const result = await handler({ required: 'test' });
      expect(result.isError).toBeUndefined();
      expect(client.request).toHaveBeenCalledWith(
        toolConfig.graphql_query,
        { required: 'test', withDefault: 42 } // Default value is applied
      );
    });

    it('should fail when required parameters are missing', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'required_missing_test',
        description: 'Test missing required parameter',
        graphql_query: 'query Test($required: String!) { test(required: $required) }',
        parameter_schema: {
          type: 'object',
          properties: {
            required: { type: 'string' },
            optional: { type: 'string' },
          },
          required: ['required'],
        },
        variables: ['required', 'optional'],
      };

      const handler = createDynamicToolHandler(toolConfig);
      
      // Should fail when required parameter is missing
      const result = await handler({ optional: 'present' });
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Parameter validation error');
      expect(client.request).not.toHaveBeenCalled();
    });

    it('should apply default values for optional parameters', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'default_values_test',
        description: 'Test default value handling',
        graphql_query: 'query Test($id: String!, $limit: Int) { test(id: $id, limit: $limit) }',
        parameter_schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            limit: { type: 'integer', default: 25 },
          },
          required: ['id'],
        },
        variables: ['id', 'limit'],
      };

      const mockResult = { test: 'success' };
      vi.mocked(client.request).mockResolvedValue(mockResult);

      const handler = createDynamicToolHandler(toolConfig);
      
      // Should apply default value when limit is not provided
      const result = await handler({ id: 'test123' });
      expect(result.isError).toBeUndefined();
      
      // Default value should be applied automatically by Zod
      expect(client.request).toHaveBeenCalledWith(
        toolConfig.graphql_query,
        { id: 'test123', limit: 25 }
      );
    });

    it('should handle the exact get_pipeline_issues scenario', async () => {
      // This matches the exact saved tool configuration from the bug
      const toolConfig: SavedToolConfig = {
        name: 'get_pipeline_issues',
        description: 'Get issues from a specific pipeline with optional filtering by repository',
        graphql_query: `
query GetPipelineIssues($pipelineId: ID!, $workspaceId: ID!, $limit: Int!, $repositoryIds: [ID!]) {
  searchIssuesByPipeline(
    pipelineId: $pipelineId
    first: $limit
    filters: {
      repositoryIds: $repositoryIds
    }
  ) {
    nodes {
      id
      number
      title
      state
      pipelineIssue(workspaceId: $workspaceId) {
        pipeline {
          id
          name
          stage
        }
      }
      repository {
        id
        name
      }
      assignees {
        nodes {
          login
        }
      }
    }
    totalCount
  }
}
`,
        parameter_schema: {
          type: 'object',
          required: ['pipelineId', 'workspaceId'],
          properties: {
            limit: {
              type: 'integer',
              default: 10,
              description: 'Maximum number of issues to return',
            },
            pipelineId: {
              type: 'string',
              description: 'The ID of the pipeline to search',
            },
            workspaceId: {
              type: 'string',
              description: 'The ID of the workspace',
            },
            repositoryIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional array of repository IDs to filter by',
            },
          },
        },
        variables: ['pipelineId', 'workspaceId', 'limit', 'repositoryIds'],
      };

      const mockResult = {
        searchIssuesByPipeline: {
          nodes: [{ id: 'issue1', title: 'Test Issue' }],
          totalCount: 1,
        },
      };
      vi.mocked(client.request).mockResolvedValue(mockResult);

      const handler = createDynamicToolHandler(toolConfig);
      
      // Should succeed with only required parameters
      const result1 = await handler({ 
        pipelineId: 'pipeline123', 
        workspaceId: 'workspace456' 
      });
      expect(result1.isError).toBeUndefined();
      
      // Should succeed with optional parameters
      const result2 = await handler({
        pipelineId: 'pipeline123',
        workspaceId: 'workspace456',
        limit: 20,
        repositoryIds: ['repo1', 'repo2'],
      });
      expect(result2.isError).toBeUndefined();
      
      // Should fail if required parameters are missing
      const result3 = await handler({ pipelineId: 'pipeline123' });
      expect(result3.isError).toBe(true);
      expect(result3.content[0]?.text).toContain('Parameter validation error');
    });

    it('should handle tools with all optional parameters', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'all_optional_test',
        description: 'Test tool with all optional parameters',
        graphql_query: 'query Test($search: String, $limit: Int) { test(search: $search, limit: $limit) }',
        parameter_schema: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            limit: { type: 'integer', default: 50 },
          },
          // No required array - all optional
        },
        variables: ['search', 'limit'],
      };

      const mockResult = { test: 'success' };
      vi.mocked(client.request).mockResolvedValue(mockResult);

      const handler = createDynamicToolHandler(toolConfig);
      
      // Should succeed with no parameters
      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(client.request).toHaveBeenCalledWith(
        toolConfig.graphql_query,
        { limit: 50 } // Default value is applied
      );
    });

    it('should handle multiple default values and types', async () => {
      const toolConfig: SavedToolConfig = {
        name: 'multiple_defaults_test',
        description: 'Test multiple default values',
        graphql_query: 'query Test($id: String!, $page: Int, $size: Int, $active: Boolean, $tags: [String!]) { test }',
        parameter_schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            page: { type: 'integer', default: 1 },
            size: { type: 'integer', default: 20 },
            active: { type: 'boolean', default: true },
            tags: { type: 'array', items: { type: 'string' }, default: [] },
          },
          required: ['id'],
        },
        variables: ['id', 'page', 'size', 'active', 'tags'],
      };

      const mockResult = { test: 'success' };
      vi.mocked(client.request).mockResolvedValue(mockResult);

      const handler = createDynamicToolHandler(toolConfig);
      
      // Should succeed with only required parameter
      const result = await handler({ id: 'test123' });
      expect(result.isError).toBeUndefined();
      
      // All default values should be applied automatically
      expect(client.request).toHaveBeenCalledWith(
        toolConfig.graphql_query,
        { 
          id: 'test123',
          page: 1,
          size: 20,
          active: true,
          tags: []
        }
      );
    });
  });
});