import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IntrospectionQuery } from 'graphql';

// Mock the GraphQL client
vi.mock('../src/client.js', () => ({
  client: {
    request: vi.fn(),
  },
}));

// Mock the responses module  
vi.mock('../src/responses.js', () => ({
  withErrorHandling: vi.fn(),
}));

// Import after mocks
import { getSchema, validateGraphQLQuery, clearSchemaCache } from '../src/schemaService.js';
import { client } from '../src/client.js';
import { withErrorHandling } from '../src/responses.js';

// Get mocked functions for manipulation in tests
const mockClient = vi.mocked(client);
const mockWithErrorHandling = vi.mocked(withErrorHandling);

// Mock introspection response for use across tests
const mockIntrospectionResponse: IntrospectionQuery = {
  __schema: {
    queryType: { name: 'Query' },
    mutationType: null,
    subscriptionType: null,
    types: [
      {
        kind: 'OBJECT',
        name: 'Query',
        description: null,
        fields: [
          {
            name: 'user',
            description: null,
            args: [
              {
                name: 'id',
                description: null,
                type: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
                defaultValue: null,
              },
            ],
            type: {
              kind: 'OBJECT',
              name: 'User',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: 'User',
        description: null,
        fields: [
          {
            name: 'id',
            description: null,
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'name',
            description: null,
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'SCALAR',
        name: 'ID',
        description: null,
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'SCALAR',
        name: 'String',
        description: null,
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
    ],
    directives: [],
  },
};

describe('schemaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSchemaCache(); // Reset cache between tests
    
    // Default mock implementation for withErrorHandling
    mockWithErrorHandling.mockImplementation((operation: string, fn: (log: (msg: string) => void) => Promise<string>) => {
      const mockLog = vi.fn();
      return fn(mockLog).then(result => ({
        content: [{ type: 'text', text: result }],
      })).catch(error => ({
        content: [{ type: 'text', text: `Error ${operation}: ${error.message}` }],
        isError: true,
      }));
    });
  });

  describe('getSchema', () => {

    it('should fetch and cache schema successfully', async () => {
      mockClient.request.mockResolvedValueOnce(mockIntrospectionResponse);

      const schema1 = await getSchema();
      const schema2 = await getSchema();

      expect(schema1).toBeTruthy();
      expect(schema2).toBe(schema1); // Should return same cached instance
      expect(mockClient.request).toHaveBeenCalledOnce(); // Should only fetch once
    });

    it('should handle network errors gracefully', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('Network error'));

      const schema1 = await getSchema();
      const schema2 = await getSchema();

      expect(schema1).toBeNull();
      expect(schema2).toBeNull();
      expect(mockClient.request).toHaveBeenCalledOnce(); // Should not retry after error
    });

    it('should handle invalid introspection response', async () => {
      mockClient.request.mockResolvedValueOnce({ invalidResponse: true });

      const schema = await getSchema();

      expect(schema).toBeNull();
      expect(mockClient.request).toHaveBeenCalledOnce();
    });

    it('should handle introspection disabled', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('GraphQL introspection is not allowed'));

      const schema = await getSchema();

      expect(schema).toBeNull();
    });
  });

  describe('validateGraphQLQuery', () => {
    const validQuery = 'query GetUser($id: ID!) { user(id: $id) { id name } }';
    const syntaxErrorQuery = 'query GetUser($id ID!) { user(id: $id) { id name }'; // Missing colon
    const validationErrorQuery = 'query GetUser($id: ID!) { user(id: $id) { invalidField } }';

    it('should validate a correct query when schema is available', async () => {
      mockClient.request.mockResolvedValueOnce(mockIntrospectionResponse);
      
      // First ensure schema is cached
      await getSchema();
      
      const result = await validateGraphQLQuery(validQuery);

      expect(result.isError).toBeFalsy();
      expect(result.content[0]?.text).toBe('GraphQL query is valid');
    });

    it('should handle GraphQL syntax errors', async () => {
      const result = await validateGraphQLQuery(syntaxErrorQuery);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('GraphQL syntax error');
    });

    it('should handle validation errors when schema is available', async () => {
      mockClient.request.mockResolvedValueOnce(mockIntrospectionResponse);
      
      // First ensure schema is cached
      await getSchema();
      
      const result = await validateGraphQLQuery(validationErrorQuery);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('GraphQL validation failed');
    });

    it('should gracefully handle missing schema', async () => {
      // Don't fetch schema, so it remains null
      mockClient.request.mockRejectedValueOnce(new Error('Introspection disabled'));
      await getSchema(); // This will fail and cache the error
      
      const result = await validateGraphQLQuery(validQuery);

      expect(result.isError).toBeFalsy();
      expect(result.content[0]?.text).toContain('Warning: Schema introspection failed');
    });

    it('should validate syntax even when schema is unavailable', async () => {
      // Don't fetch schema, so it remains null
      mockClient.request.mockRejectedValueOnce(new Error('Introspection disabled'));
      await getSchema(); // This will fail and cache the error
      
      const result = await validateGraphQLQuery(syntaxErrorQuery);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('GraphQL syntax error');
    });
  });

  describe('clearSchemaCache', () => {
    it('should clear cache and allow refetch', async () => {
      // First, fetch and cache schema
      mockClient.request.mockResolvedValueOnce(mockIntrospectionResponse);
      const schema1 = await getSchema();
      expect(schema1).toBeTruthy();
      expect(mockClient.request).toHaveBeenCalledOnce();

      // Clear cache
      clearSchemaCache();

      // Fetch again - should make another request
      mockClient.request.mockResolvedValueOnce(mockIntrospectionResponse);
      const schema2 = await getSchema();
      expect(schema2).toBeTruthy();
      expect(mockClient.request).toHaveBeenCalledTimes(2);
    });

    it('should clear error cache and allow retry', async () => {
      // First, cause an error that gets cached
      mockClient.request.mockRejectedValueOnce(new Error('Network error'));
      const schema1 = await getSchema();
      expect(schema1).toBeNull();
      expect(mockClient.request).toHaveBeenCalledOnce();

      // Try again - should not retry due to error cache
      const schema2 = await getSchema();
      expect(schema2).toBeNull();
      expect(mockClient.request).toHaveBeenCalledOnce(); // Still only called once

      // Clear cache
      clearSchemaCache();

      // Now should retry
      mockClient.request.mockResolvedValueOnce(mockIntrospectionResponse);
      const schema3 = await getSchema();
      expect(schema3).toBeTruthy();
      expect(mockClient.request).toHaveBeenCalledTimes(2);
    });
  });
});