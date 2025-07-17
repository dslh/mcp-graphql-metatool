#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import * as executeGraphqlQuery from './tools/executeGraphqlQuery.js';
import * as createSavedQueryTool from './tools/createSavedQueryTool.js';
import { SavedToolConfig } from './types.js';

async function main(): Promise<void> {
  try {
    const server = new McpServer({
      name: 'graphql-metatool',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
    });

    const existingTools = new Map<string, SavedToolConfig>();

    server.registerTool(executeGraphqlQuery.name, executeGraphqlQuery.config, executeGraphqlQuery.handler);
    server.registerTool(createSavedQueryTool.name, createSavedQueryTool.config, createSavedQueryTool.createHandler(server, existingTools));

    const transport = new StdioServerTransport();
    console.log('Starting GraphQL MCP Metatool');
    await server.connect(transport);
  } catch (error) {
    console.error('Failed to start GraphQL MCP server:', error);
    process.exit(1);
  }
}

await main();
