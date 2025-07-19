import { describe, it, expect, vi, beforeEach } from 'vitest';

import { saveToolToFile } from '../../src/storage.js';
import { createHandler } from '../../src/tools/createSavedQueryTool.js';
import type { SavedToolConfig } from '../../src/types.js';

// Mock the client before importing the handler
vi.mock('../../src/client.js', () => ({
  client: {
    request: vi.fn(),
  },
}));

// Mock the storage module
vi.mock('../../src/storage.js', () => ({
  saveToolToFile: vi.fn(),
}));

describe('createSavedQueryTool', () => {
  let mockServer: { registerTool: ReturnType<typeof vi.fn> };
  let toolsMap: Map<string, SavedToolConfig>;
  let handler: ReturnType<typeof createHandler>;

  beforeEach(() => {
    mockServer = {
      registerTool: vi.fn(),
    };
    toolsMap = new Map();
    handler = createHandler(mockServer, toolsMap);
    vi.clearAllMocks();
  });

  it('should create a new tool successfully', () => {
    const params = {
      tool_name: 'get_user_by_id',
      description: 'Get user by ID',
      graphql_query: 'query GetUser($id: ID!) { user(id: $id) { name email } }',
      parameter_schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
    };

    const result = handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Successfully created tool');
    expect(saveToolToFile).toHaveBeenCalledWith(
      'get_user_by_id',
      expect.objectContaining({
        name: 'get_user_by_id',
        description: 'Get user by ID',
        graphql_query: 'query GetUser($id: ID!) { user(id: $id) { name email } }',
        parameter_schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        variables: ['id'],
      })
    );
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'get_user_by_id',
      expect.objectContaining({
        title: 'Get user by ID',
        description: 'Get user by ID',
      }),
      expect.any(Function)
    );
    expect(toolsMap.has('get_user_by_id')).toBe(true);
  });

  it('should reject duplicate tool names', () => {
    const params = {
      tool_name: 'existing_tool',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: { type: 'object', properties: {} },
    };

    toolsMap.set('existing_tool', {
      name: 'existing_tool',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: { type: 'object', properties: {} },
      variables: [],
    });

    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('already exists');
  });

  it('should allow valid tool names', () => {
    const params = {
      tool_name: 'valid_tool_name',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: { type: 'object', properties: {} },
    };

    const result = handler(params);
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Successfully created tool');
    expect(saveToolToFile).toHaveBeenCalledWith(
      'valid_tool_name',
      expect.objectContaining({
        name: 'valid_tool_name',
        description: 'Test tool',
        graphql_query: 'query { test }',
        parameter_schema: { type: 'object', properties: {} },
        variables: [],
      })
    );
  });

  it('should extract GraphQL variables correctly', () => {
    const params = {
      tool_name: 'complex_query',
      description: 'Complex query with variables',
      graphql_query:
        'query GetData($userId: ID!, $limit: Int, $filter: String) { data(userId: $userId, limit: $limit, filter: $filter) { id name } }',
      parameter_schema: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          limit: { type: 'integer' },
          filter: { type: 'string' },
        },
      },
    };

    const result = handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('3 variables');
    expect(result.content[0]?.text).toContain('userId, limit, filter');
    expect(saveToolToFile).toHaveBeenCalledWith(
      'complex_query',
      expect.objectContaining({
        variables: ['userId', 'limit', 'filter'],
      })
    );
  });

  it('should handle invalid JSON schema', () => {
    const params = {
      tool_name: 'invalid_schema',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: 'not an object',
    };

    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Invalid parameter_schema');
  });

  it('should reject malformed JSON schemas', () => {
    const invalidSchemas = [
      null,
      undefined,
      123,
      'string',
      [],
      { type: 'invalid_type' },
      { properties: 'should be object' },
    ];

    for (const invalidSchema of invalidSchemas) {
      const params = {
        tool_name: 'test_invalid',
        description: 'Test tool',
        graphql_query: 'query { test }',
        parameter_schema: invalidSchema,
      };

      const result = handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Invalid parameter_schema');
    }
  });

  it('should accept complex valid JSON schemas', () => {
    const complexSchema = {
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
            },
          },
          required: ['id'],
        },
        metadata: {
          type: 'object',
          additionalProperties: true,
        },
      },
      required: ['user'],
    };

    const params = {
      tool_name: 'complex_schema_tool',
      description: 'Tool with complex schema',
      graphql_query: 'query GetUser($user: UserInput!) { user(input: $user) { id name } }',
      parameter_schema: complexSchema,
    };

    const result = handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Successfully created tool');
    expect(saveToolToFile).toHaveBeenCalledWith(
      'complex_schema_tool',
      expect.objectContaining({
        parameter_schema: complexSchema,
      })
    );
  });

  it('should handle schemas with advanced JSON Schema features', () => {
    const advancedSchema = {
      type: 'object',
      properties: {
        status: {
          enum: ['active', 'inactive', 'pending'],
        },
        priority: {
          anyOf: [
            { type: 'string', enum: ['low', 'medium', 'high'] },
            { type: 'integer', minimum: 1, maximum: 10 },
          ],
        },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'ne', 'gt', 'lt'] },
              value: { type: 'string' },
            },
            required: ['field', 'operator', 'value'],
          },
        },
      },
    };

    const params = {
      tool_name: 'advanced_schema_tool',
      description: 'Tool with advanced schema features',
      graphql_query: 'query Search($status: String, $priority: Priority, $filters: [FilterInput!]) { search(status: $status, priority: $priority, filters: $filters) { results } }',
      parameter_schema: advancedSchema,
    };

    const result = handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Successfully created tool');
  });

  it('should handle storage errors gracefully', () => {
    vi.mocked(saveToolToFile).mockImplementation(() => {
      throw new Error('Failed to save tool to file');
    });

    const params = {
      tool_name: 'storage_error_tool',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: { type: 'object', properties: {} },
    };

    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Error creating tool');
    expect(result.content[0]?.text).toContain('Failed to save tool to file');
    expect(mockServer.registerTool).not.toHaveBeenCalled();
    expect(toolsMap.has('storage_error_tool')).toBe(false);
  });

  it('should handle server registration errors after successful storage', () => {
    mockServer.registerTool.mockImplementation(() => {
      throw new Error('Server error');
    });

    const params = {
      tool_name: 'server_error_tool',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: { type: 'object', properties: {} },
    };

    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Error creating tool');
    expect(saveToolToFile).toHaveBeenCalledWith(
      'server_error_tool',
      expect.objectContaining({
        name: 'server_error_tool',
      })
    );
    expect(toolsMap.has('server_error_tool')).toBe(false);
  });

  it('should ensure storage happens before server registration (atomicity)', () => {
    const callOrder: string[] = [];

    vi.mocked(saveToolToFile).mockImplementation(() => {
      callOrder.push('saveToolToFile');
    });

    mockServer.registerTool.mockImplementation(() => {
      callOrder.push('registerTool');
    });

    const params = {
      tool_name: 'atomicity_test',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: { type: 'object', properties: {} },
    };

    const result = handler(params);

    expect(result.isError).toBeUndefined();
    expect(callOrder).toEqual(['saveToolToFile', 'registerTool']);
  });
});
