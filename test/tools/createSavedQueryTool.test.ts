import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createHandler } from '../../src/tools/createSavedQueryTool.js';
import type { SavedToolConfig } from '../../src/types.js';


// Mock the client before importing the handler
vi.mock('../../src/client.js', () => ({
  client: {
    request: vi.fn()
  }
}));

describe('createSavedQueryTool', () => {
  let mockServer: { registerTool: any };
  let toolsMap: Map<string, SavedToolConfig>;
  let handler: any;

  beforeEach(() => {
    mockServer = {
      registerTool: vi.fn(),
    };
    toolsMap = new Map();
    handler = createHandler(mockServer, toolsMap);
  });

  it('should create a new tool successfully', async () => {
    const params = {
      tool_name: 'get_user_by_id',
      description: 'Get user by ID',
      graphql_query: 'query GetUser($id: ID!) { user(id: $id) { name email } }',
      parameter_schema: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    };

    const result = await handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Successfully created tool');
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'get_user_by_id',
      expect.objectContaining({
        title: 'Get user by ID',
        description: 'Get user by ID'
      }),
      expect.any(Function)
    );
    expect(toolsMap.has('get_user_by_id')).toBe(true);
  });

  it('should reject duplicate tool names', async () => {
    const params = {
      tool_name: 'existing_tool',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: { type: 'object', properties: {} }
    };

    toolsMap.set('existing_tool', {
      name: 'existing_tool',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: { type: 'object', properties: {} },
      variables: []
    });

    const result = await handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('already exists');
  });

  it('should allow valid tool names', async () => {
    const params = {
      tool_name: 'valid_tool_name',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: { type: 'object', properties: {} }
    };

    const result = await handler(params);
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Successfully created tool');
  });

  it('should extract GraphQL variables correctly', async () => {
    const params = {
      tool_name: 'complex_query',
      description: 'Complex query with variables',
      graphql_query: 'query GetData($userId: ID!, $limit: Int, $filter: String) { data(userId: $userId, limit: $limit, filter: $filter) { id name } }',
      parameter_schema: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          limit: { type: 'integer' },
          filter: { type: 'string' }
        }
      }
    };

    const result = await handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('3 variables');
    expect(result.content[0]?.text).toContain('userId, limit, filter');
  });

  it('should handle invalid JSON schema', async () => {
    const params = {
      tool_name: 'invalid_schema',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: 'not an object'
    };

    const result = await handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Invalid parameter_schema');
  });

  it('should handle errors gracefully', async () => {
    mockServer.registerTool.mockImplementation(() => {
      throw new Error('Server error');
    });

    const params = {
      tool_name: 'error_tool',
      description: 'Test tool',
      graphql_query: 'query { test }',
      parameter_schema: { type: 'object', properties: {} }
    };

    const result = await handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Failed to create tool');
  });
});