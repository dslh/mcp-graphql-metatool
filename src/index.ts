#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { client } from './client.js';

async function main() {
  try {
    const server = new McpServer({
      name: 'graphql-metatool',
      version: '1.0.0',
    });

    server.registerTool(
      'execute_graphql_query',
      {
        title: 'Execute GraphQL query',
        description: 'Execute arbitrary GraphQL queries against the configured endpoint',
        inputSchema: {
          query: z.string().describe('The GraphQL query to execute'),
          variables: z.record(z.any()).optional().describe('Optional variables for the query'),
        },
      },
      async ({ query, variables }) => {
      try {
        const result = await client.request(query, variables);
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
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error('Failed to start GraphQL MCP server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
