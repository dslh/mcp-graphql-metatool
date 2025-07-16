import { z } from 'zod';

import { client } from '../client.js';

export const name = 'execute_graphql_query';

export const config = {
  title: 'Execute GraphQL query',
  description: 'Execute arbitrary GraphQL queries against the configured endpoint',
  inputSchema: {
    query: z.string().describe('The GraphQL query to execute'),
  },
};

export const handler = async ({ query }: { query: string }): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> => {
  try {
    const result = await client.request(query);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text' as const,
          text: `GraphQL Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
};