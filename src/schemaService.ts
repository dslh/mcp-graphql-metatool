import { buildClientSchema, getIntrospectionQuery, type GraphQLSchema, parse, validate, type IntrospectionQuery } from 'graphql';

import { client } from './client.js';
import { withErrorHandling, type Logger } from './responses.js';

let cachedSchema: GraphQLSchema | null = null;
let schemaFetchError: string | null = null;

/**
 * Fetches the GraphQL schema using introspection and caches it.
 * Returns null if the schema cannot be fetched (e.g., introspection disabled).
 */
export async function getSchema(): Promise<GraphQLSchema | null> {
  if (cachedSchema) {
    return cachedSchema;
  }

  if (schemaFetchError) {
    // Don't retry if we've already failed
    return null;
  }

  try {
    const introspectionQuery = getIntrospectionQuery();
    const result = await client.request<IntrospectionQuery>(introspectionQuery);
    
    if (result.__schema) {
      cachedSchema = buildClientSchema(result);
      return cachedSchema;
    } else {
      schemaFetchError = 'Invalid introspection response: missing __schema';
      return null;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    schemaFetchError = `Failed to fetch schema: ${errorMessage}`;
    return null;
  }
}

/**
 * Validates a GraphQL query string against the cached schema.
 * Returns validation errors or null if valid.
 */
export async function validateGraphQLQuery(queryString: string): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  return withErrorHandling('validating GraphQL query', async (log: Logger) => {
    log('parsing query');
    let parsedQuery;
    try {
      parsedQuery = parse(queryString);
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      throw new Error(`GraphQL syntax error: ${errorMessage}`);
    }

    log('fetching schema for validation');
    const schema = await getSchema();
    
    if (!schema) {
      // If we can't get the schema, we'll skip validation but warn
      return 'Warning: Schema introspection failed or is disabled. Query syntax validated but field validation skipped.';
    }

    log('validating query against schema');
    const validationErrors = validate(schema, parsedQuery);
    
    if (validationErrors.length > 0) {
      const errorMessages = validationErrors.map(error => error.message).join('; ');
      throw new Error(`GraphQL validation failed: ${errorMessages}`);
    }

    return 'GraphQL query is valid';
  });
}

/**
 * Clears the cached schema, forcing a refetch on next use.
 * Useful for testing or when schema changes are expected.
 */
export function clearSchemaCache(): void {
  cachedSchema = null;
  schemaFetchError = null;
}