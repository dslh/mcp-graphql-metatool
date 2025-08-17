import { type McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { saveToolToFile } from '../../src/storage.js';
import { handler } from '../../src/tools/saveQuery.js';

// Create mock objects at module level
const mockRegisteredTool = { update: vi.fn() };
const mockServer = { registerTool: vi.fn(() => mockRegisteredTool) };
const mockRegisteredTools = new Map();

// Mock modules before imports
vi.mock('../../src/client.js', () => ({
  client: {
    request: vi.fn(),
  },
}));

vi.mock('../../src/storage.js', () => ({
  saveToolToFile: vi.fn(),
  ensureDataDirectory: vi.fn(),
}));

vi.mock('../../src/dynamicToolHandler.js', () => ({
  createDynamicToolHandler: vi.fn(() => vi.fn()),
  registerAllTools: vi.fn(() => new Map()),
}));

vi.mock('../../src/server.js', () => ({
  get server(): McpServer { return mockServer; },
  get registeredTools(): Map<string, RegisteredTool> { return mockRegisteredTools; },
}));

vi.mock('../../src/schemaService.js', () => ({
  validateGraphQLQuery: vi.fn(() => Promise.resolve({ content: [{ type: 'text', text: 'Valid query' }] })),
}));

describe('saveQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegisteredTools.clear();
  });

  it('should create a new tool successfully', async () => {
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

    const result = await handler(params);

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
    expect(mockRegisteredTools.has('get_user_by_id')).toBe(true);
  });

  it('should reject duplicate tool names when overwrite is false', async () => {
    const params = {
      tool_name: 'existing_tool',
      description: 'An existing tool',
      graphql_query: 'query Test { test }',
      parameter_schema: { type: 'object' },
    };

    mockRegisteredTools.set('existing_tool', {
      update: vi.fn(),
    });

    const result = await handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('already exists');
    expect(result.content[0]?.text).toContain('Set overwrite=true');
  });

  it('should update existing tool when overwrite is true', async () => {
    const mockUpdate = vi.fn();
    mockRegisteredTools.set('existing_tool', {
      update: mockUpdate,
    });

    const params = {
      tool_name: 'existing_tool',
      description: 'Updated description',
      graphql_query: 'query UpdatedTest { updatedTest }',
      parameter_schema: { type: 'object' },
      overwrite: true,
    };

    const result = await handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Successfully updated tool');
    expect(result.content[0]?.text).toContain('existing_tool');
    expect(mockUpdate).toHaveBeenCalledWith({
      title: 'Updated description',
      description: 'Updated description',
      paramsSchema: expect.anything(),
      callback: expect.any(Function),
    });
  });

  it('should create new tool when overwrite is true but tool does not exist', async () => {
    const params = {
      tool_name: 'new_tool',
      description: 'A new tool',
      graphql_query: 'query NewTest { newTest }',
      parameter_schema: { type: 'object' },
      overwrite: true,
    };

    const result = await handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Successfully created tool');
    expect(result.content[0]?.text).toContain('new_tool');
  });

  it('should default overwrite to false when not specified', async () => {
    const params = {
      tool_name: 'existing_tool',
      description: 'An existing tool',
      graphql_query: 'query Test { test }',
      parameter_schema: { type: 'object' },
      // overwrite not specified - should default to false
    };

    mockRegisteredTools.set('existing_tool', {
      update: vi.fn(),
    });

    const result = await handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('already exists');
    expect(result.content[0]?.text).toContain('Set overwrite=true');
  });

  it('should allow valid tool names', async () => {
    const params = {
      tool_name: 'get_user_by_id_123',
      description: 'Valid tool name',
      graphql_query: 'query Test { test }',
      parameter_schema: { type: 'object' },
    };

    const result = await handler(params);
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Successfully created tool');
    expect(saveToolToFile).toHaveBeenCalledWith(
      'get_user_by_id_123',
      expect.objectContaining({
        name: 'get_user_by_id_123',
      })
    );
  });

  it('should extract GraphQL variables correctly', async () => {
    const params = {
      tool_name: 'complex_query',
      description: 'Complex query with variables',
      graphql_query: `
        query GetUserPosts($userId: ID!, $limit: Int, $filter: String) {
          user(id: $userId) {
            posts(limit: $limit, filter: $filter) {
              title
              content
            }
          }
        }
      `,
      parameter_schema: { type: 'object' },
    };

    const result = await handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('3 variables');
    expect(result.content[0]?.text).toContain('userId, limit, filter');
  });

  it('should handle invalid JSON schema', async () => {
    const params = {
      tool_name: 'invalid_schema',
      description: 'Tool with invalid schema',
      graphql_query: 'query Test { test }',
      parameter_schema: 'not an object' as unknown as Record<string, unknown>,
    };

    const result = await handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Invalid parameter_schema');
  });

  it('should reject malformed JSON schemas', async () => {
    const params = {
      tool_name: 'test_invalid',
      description: 'Test invalid schema',
      graphql_query: 'query Test { test }',
      parameter_schema: {
        type: 'invalid_type',  // not a valid JSON Schema type
        properties: {
          field: { type: 'also_invalid' },
        },
      } as unknown as Record<string, unknown>,
    };

    const result = await handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Invalid parameter_schema');
  });

  it('should accept complex valid JSON schemas', async () => {
    const params = {
      tool_name: 'complex_schema',
      description: 'Tool with complex schema',
      graphql_query: 'query Test { test }',
      parameter_schema: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              age: { type: 'number', minimum: 0 },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['id'],
          },
          options: {
            type: 'object',
            additionalProperties: true,
          },
        },
        required: ['user'],
      },
    };

    const result = await handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Successfully created tool');
  });

  it('should handle schemas with advanced JSON Schema features', async () => {
    const params = {
      tool_name: 'advanced_schema',
      description: 'Tool with advanced schema features',
      graphql_query: 'query Test { test }',
      parameter_schema: {
        type: 'object',
        properties: {
          data: {
            oneOf: [
              { type: 'string' },
              { type: 'number' },
              {
                type: 'object',
                properties: {
                  nested: { type: 'boolean' },
                },
              },
            ],
          },
          metadata: {
            allOf: [
              { type: 'object' },
              {
                properties: {
                  version: { type: 'string' },
                },
              },
            ],
          },
        },
      },
    };

    const result = await handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Successfully created tool');
  });

  it('should handle storage errors gracefully', async () => {
    vi.mocked(saveToolToFile).mockImplementation(() => {
      throw new Error('Failed to save tool to file: disk full');
    });

    const params = {
      tool_name: 'storage_error_tool',
      description: 'Tool that will fail to save',
      graphql_query: 'query Test { test }',
      parameter_schema: { type: 'object' },
    };

    const result = await handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Error saving tool');
    expect(result.content[0]?.text).toContain('Failed to save tool to file');
    expect(mockServer.registerTool).not.toHaveBeenCalled();
    expect(mockRegisteredTools.has('storage_error_tool')).toBe(false);
  });

  it('should handle server registration errors after successful storage', async () => {
    mockServer.registerTool.mockImplementation(() => {
      throw new Error('Server registration failed');
    });

    const params = {
      tool_name: 'server_error_tool',
      description: 'Tool that will fail to register',
      graphql_query: 'query Test { test }',
      parameter_schema: { type: 'object' },
    };

    const result = await handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Error saving tool');
    expect(saveToolToFile).toHaveBeenCalledWith(
      'server_error_tool',
      expect.objectContaining({
        name: 'server_error_tool',
      })
    );
    expect(mockRegisteredTools.has('server_error_tool')).toBe(false);
  });

  it('should ensure storage happens before server registration (atomicity)', async () => {
    const callOrder: string[] = [];

    vi.mocked(saveToolToFile).mockImplementation(() => {
      callOrder.push('saveToolToFile');
    });

    mockServer.registerTool.mockImplementation(() => {
      callOrder.push('registerTool');
      return mockRegisteredTool;
    });

    const params = {
      tool_name: 'atomicity_test',
      description: 'Test atomicity',
      graphql_query: 'query Test { test }',
      parameter_schema: { type: 'object' },
    };

    const result = await handler(params);

    expect(result.isError).toBeUndefined();
    expect(callOrder).toEqual(['saveToolToFile', 'registerTool']);
  });
});
