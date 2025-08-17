import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { SavedToolConfig } from '../../src/types.js';

// Mock the client
vi.mock('../../src/client.js', () => ({
  client: {
    request: vi.fn(),
  },
}));

// Mock the storage module
const mockLoadToolFromFile = vi.fn();
vi.mock('../../src/storage.js', () => ({
  loadToolFromFile: mockLoadToolFromFile,
  ensureDataDirectory: vi.fn(),
}));

// Mock the dynamic tool handler
vi.mock('../../src/dynamicToolHandler.js', () => ({
  createDynamicToolHandler: vi.fn(() => vi.fn()),
  registerAllTools: vi.fn(() => new Map()),
}));

// Mock the server module
const mockRegisteredTools = new Map();
vi.mock('../../src/server.js', () => ({
  registeredTools: mockRegisteredTools,
}));

// Import after mocks
const { handler } = await import('../../src/tools/showSavedQuery.js');

describe('showSavedQuery', () => {
  beforeEach(() => {
    mockRegisteredTools.clear();
    vi.clearAllMocks();
  });

  it('should display a saved query with basic configuration', () => {
    const toolConfig: SavedToolConfig = {
      name: 'get_user_by_id',
      description: 'Get user by ID',
      graphql_query: 'query GetUser($id: ID!) { user(id: $id) { name email } }',
      parameter_schema: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      variables: ['id']
    };

    mockRegisteredTools.set('get_user_by_id', {});
    mockLoadToolFromFile.mockReturnValue(toolConfig);

    const params = { tool_name: 'get_user_by_id' };
    const result = handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain("Tool definition for 'get_user_by_id':");
    expect(result.content[0]?.text).toContain('```json');
    expect(result.content[0]?.text).toContain('"name": "get_user_by_id"');
    expect(result.content[0]?.text).toContain('"description": "Get user by ID"');
    expect(result.content[0]?.text).toContain('"graphql_query"');
    expect(result.content[0]?.text).toContain('"parameter_schema"');
    expect(result.content[0]?.text).toContain('"variables"');
    expect(result.content[0]?.text).toContain('"id"');
    
    expect(mockLoadToolFromFile).toHaveBeenCalledWith('get_user_by_id');
  });

  it('should display a saved query with pagination and idempotency configuration', () => {
    const toolConfig: SavedToolConfig = {
      name: 'complex_query',
      description: 'Complex query with advanced features',
      graphql_query: 'query ComplexQuery($workspaceId: ID!, $first: Int) { workspace(id: $workspaceId) { issues(first: $first) { edges { node { id title } } } } }',
      parameter_schema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          first: { type: 'number', default: 10 }
        }
      },
      variables: ['workspaceId', 'first'],
      pagination_config: {
        enabled: true,
        style: 'relay',
        page_size: 100,
        merge_strategy: 'concat_edges'
      },
      idempotency: {
        enabled: true,
        cache_key_params: ['workspaceId'],
        ttl_seconds: 300
      }
    };

    mockRegisteredTools.set('complex_query', {});
    mockLoadToolFromFile.mockReturnValue(toolConfig);

    const params = { tool_name: 'complex_query' };
    const result = handler(params);

    expect(result.isError).toBeUndefined();
    const text = result.content[0]?.text;
    expect(text).toContain("Tool definition for 'complex_query':");
    expect(text).toContain('"pagination_config"');
    expect(text).toContain('"enabled": true');
    expect(text).toContain('"style": "relay"');
    expect(text).toContain('"idempotency"');
    expect(text).toContain('"cache_key_params"');
    expect(text).toContain('"workspaceId"');
    expect(text).toContain('"ttl_seconds": 300');
  });

  it('should handle tool not found in registered tools', () => {
    const params = { tool_name: 'nonexistent_tool' };
    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Saved query 'nonexistent_tool' not found");
    expect(mockLoadToolFromFile).not.toHaveBeenCalled();
  });

  it('should handle tool configuration loading failure', () => {
    mockRegisteredTools.set('failing_tool', {});
    mockLoadToolFromFile.mockReturnValue(null);

    const params = { tool_name: 'failing_tool' };
    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Tool configuration for 'failing_tool' could not be loaded");
    expect(mockLoadToolFromFile).toHaveBeenCalledWith('failing_tool');
  });

  it('should handle storage errors gracefully', () => {
    mockRegisteredTools.set('error_tool', {});
    mockLoadToolFromFile.mockImplementation(() => {
      throw new Error('Storage access failed');
    });

    const params = { tool_name: 'error_tool' };
    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Error showing saved query');
    expect(result.content[0]?.text).toContain('Storage access failed');
  });

  it('should format JSON output correctly', () => {
    const toolConfig: SavedToolConfig = {
      name: 'simple_query',
      description: 'Simple test query',
      graphql_query: 'query Simple { test }',
      parameter_schema: { type: 'object', properties: {} },
      variables: []
    };

    mockRegisteredTools.set('simple_query', {});
    mockLoadToolFromFile.mockReturnValue(toolConfig);

    const params = { tool_name: 'simple_query' };
    const result = handler(params);

    const text = result.content[0]?.text;
    expect(text).toMatch(/```json\n\{[\s\S]*\}\n```/);
    
    // Extract and validate the JSON structure
    const jsonMatch = text?.match(/```json\n(\{[\s\S]*\})\n```/);
    expect(jsonMatch).toBeTruthy();
    
    if (jsonMatch) {
      const parsedJson = JSON.parse(jsonMatch[1]);
      expect(parsedJson).toHaveProperty('name', 'simple_query');
      expect(parsedJson).toHaveProperty('description', 'Simple test query');
      expect(parsedJson).toHaveProperty('graphql_query', 'query Simple { test }');
      expect(parsedJson).toHaveProperty('parameter_schema');
      expect(parsedJson).toHaveProperty('variables', []);
      expect(parsedJson).not.toHaveProperty('pagination_config');
      expect(parsedJson).not.toHaveProperty('idempotency');
    }
  });

  it('should exclude undefined optional fields from output', () => {
    const toolConfig: SavedToolConfig = {
      name: 'minimal_query',
      description: 'Minimal configuration',
      graphql_query: 'query Minimal { field }',
      parameter_schema: { type: 'object' },
      variables: ['param1'],
      // pagination_config and idempotency are undefined
    };

    mockRegisteredTools.set('minimal_query', {});
    mockLoadToolFromFile.mockReturnValue(toolConfig);

    const params = { tool_name: 'minimal_query' };
    const result = handler(params);

    const text = result.content[0]?.text;
    expect(text).not.toContain('pagination_config');
    expect(text).not.toContain('idempotency');
    expect(text).toContain('"variables"');
    expect(text).toContain('"param1"');
  });

  it('should handle tool with empty variables array', () => {
    const toolConfig: SavedToolConfig = {
      name: 'no_vars_query',
      description: 'Query with no variables',
      graphql_query: 'query NoVars { staticField }',
      parameter_schema: { type: 'object', properties: {} },
      variables: []
    };

    mockRegisteredTools.set('no_vars_query', {});
    mockLoadToolFromFile.mockReturnValue(toolConfig);

    const params = { tool_name: 'no_vars_query' };
    const result = handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('"variables": []');
  });

  it('should handle complex parameter schema', () => {
    const toolConfig: SavedToolConfig = {
      name: 'complex_params_query',
      description: 'Query with complex parameter schema',
      graphql_query: 'query Complex($filter: FilterInput!, $sort: SortInput) { items(filter: $filter, sort: $sort) { id } }',
      parameter_schema: {
        type: 'object',
        required: ['filter'],
        properties: {
          filter: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['open', 'closed'] },
              assignee: { type: 'string' }
            }
          },
          sort: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              direction: { type: 'string', enum: ['asc', 'desc'] }
            }
          }
        }
      },
      variables: ['filter', 'sort']
    };

    mockRegisteredTools.set('complex_params_query', {});
    mockLoadToolFromFile.mockReturnValue(toolConfig);

    const params = { tool_name: 'complex_params_query' };
    const result = handler(params);

    expect(result.isError).toBeUndefined();
    const text = result.content[0]?.text;
    expect(text).toContain('"required"');
    expect(text).toContain('"filter"');
    expect(text).toContain('"enum"');
    expect(text).toContain('"open"');
    expect(text).toContain('"closed"');
    expect(text).toContain('"asc"');
    expect(text).toContain('"desc"');
  });

  it('should maintain consistent response structure', () => {
    const toolConfig: SavedToolConfig = {
      name: 'test_query',
      description: 'Test query',
      graphql_query: 'query Test { test }',
      parameter_schema: { type: 'object' },
      variables: []
    };

    mockRegisteredTools.set('test_query', {});
    mockLoadToolFromFile.mockReturnValue(toolConfig);

    const params = { tool_name: 'test_query' };
    const result = handler(params);

    // Verify response structure matches MCP expectations
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0]).toHaveProperty('text');
    expect(typeof result.content[0]?.text).toBe('string');
    expect(result.isError).toBeUndefined();
  });
});