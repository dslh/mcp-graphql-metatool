import { z } from 'zod';

import { client } from '../client.js';
import { withErrorHandling, type Logger } from '../responses.js';

export const name = 'execute_graphql_query';

export const config = {
  title: 'Execute GraphQL query',
  description: 'Execute arbitrary GraphQL queries against the configured endpoint',
  inputSchema: {
    query: z.string().describe('The GraphQL query to execute'),
  },
};

export const handler = ({
  query,
}: {
  query: string;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> => {
  return withErrorHandling('executing GraphQL query', async () => {
    const result = await client.request(query);
    return JSON.stringify(result, null, 2);
  });
};
