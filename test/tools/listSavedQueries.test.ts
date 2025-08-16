import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the client
vi.mock('../../src/client.js', () => ({
  client: {
    request: vi.fn(),
  },
}));

// Mock the storage module
const mockSavedTools = new Map();
vi.mock('../../src/storage.js', () => ({
  loadAllTools: () => mockSavedTools,
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
const { handler } = await import('../../src/tools/listSavedQueries.js');

describe('listSavedQueries', () => {
  beforeEach(() => {
    mockRegisteredTools.clear();
    mockSavedTools.clear();
    vi.clearAllMocks();
  });

  it('should return "no saved queries" when no tools exist', () => {
    const result = handler();
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]?.type).toBe('text');
    expect(result.content[0]?.text).toBe('No saved queries found.');
  });

  it('should list saved queries with descriptions', () => {
    // Set up mock data
    mockRegisteredTools.set('get_user_by_id', {});
    mockRegisteredTools.set('complex_query', {});
    
    mockSavedTools.set('get_user_by_id', {
      name: 'get_user_by_id',
      description: 'Get user by ID',
      graphql_query: 'query GetUser($id: ID!) { user(id: $id) { name email } }',
      parameter_schema: {},
      variables: ['id'],
    });
    
    mockSavedTools.set('complex_query', {
      name: 'complex_query',
      description: 'A complex GraphQL query',
      graphql_query: 'query Complex { ... }',
      parameter_schema: {},
      variables: [],
    });

    const result = handler();
    const text = result.content[0]?.text;
    
    expect(text).toBeDefined();
    expect(text).toMatch(/Found 2 saved queries:/);
    expect(text).toContain('**get_user_by_id**: Get user by ID');
    expect(text).toContain('**complex_query**: A complex GraphQL query');
  });

  it('should handle single saved query correctly', () => {
    mockRegisteredTools.set('single_query', {});
    mockSavedTools.set('single_query', {
      name: 'single_query',
      description: 'Single test query',
      graphql_query: 'query Single { test }',
      parameter_schema: {},
      variables: [],
    });

    const result = handler();
    const text = result.content[0]?.text;
    
    expect(text).toMatch(/Found 1 saved query:/);
    expect(text).toContain('**single_query**: Single test query');
  });

  it('should handle missing descriptions gracefully', () => {
    mockRegisteredTools.set('no_description', {});
    mockSavedTools.set('no_description', {
      name: 'no_description',
      // description is missing
      graphql_query: 'query Test { test }',
      parameter_schema: {},
      variables: [],
    });

    const result = handler();
    const text = result.content[0]?.text;
    
    expect(text).toContain('**no_description**: No description');
  });
});