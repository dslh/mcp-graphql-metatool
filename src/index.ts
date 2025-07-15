#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GraphQLClient } from 'graphql-request';
import { z } from 'zod';

interface Config {
  graphqlEndpoint: string;
  authToken?: string;
}

function loadConfig(): Config {
  const graphqlEndpoint = process.env.GRAPHQL_ENDPOINT;
  const authToken = process.env.GRAPHQL_AUTH_TOKEN;

  if (!graphqlEndpoint) {
    throw new Error('GRAPHQL_ENDPOINT environment variable is required');
  }

  return {
    graphqlEndpoint,
    authToken,
  };
}

async function main() {
  try {
    const config = loadConfig();
    
    const server = new McpServer({
      name: 'graphql-metatool',
      version: '1.0.0',
    });

    const client = new GraphQLClient(config.graphqlEndpoint, {
      headers: config.authToken ? {
        'Authorization': `Bearer ${config.authToken}`
      } : {},
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
