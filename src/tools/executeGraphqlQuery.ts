import { z } from 'zod';

import { client } from '../client.js';
import { withErrorHandling } from '../responses.js';

export const name = 'execute_graphql_query';

export const config = {
  title: 'Execute GraphQL query',
  description: 'Execute arbitrary GraphQL queries against the configured endpoint',
  inputSchema: {
    query: z.string().describe('The GraphQL query to execute'),
    variables: z
      .string()
      .optional()
      .describe('JSON-encoded variables object for the query (e.g. {"id": "123"})'),
  },
};

export const handler = ({
  query,
  variables,
}: {
  query: string;
  variables?: string | undefined;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> => {
  return withErrorHandling('executing GraphQL query', async () => {
    let parsedVariables: Record<string, unknown> | undefined;
    if (variables !== undefined && variables !== '') {
      try {
        parsedVariables = JSON.parse(variables) as Record<string, unknown>;
      } catch {
        throw new TypeError(`Invalid JSON in variables parameter: ${variables}`);
      }
    }
    const result = await client.request(query, parsedVariables);
    return JSON.stringify(result, null, 2);
  });
};
