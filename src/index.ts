#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { server, registeredTools } from './server.js';
import * as deleteSavedQuery from './tools/deleteSavedQuery.js';
import * as saveQuery from './tools/saveQuery.js';

async function main(): Promise<void> {
  try {
    // Register tool management tools
    server.registerTool(saveQuery.name, saveQuery.config, saveQuery.handler);
    server.registerTool(deleteSavedQuery.name, deleteSavedQuery.config, deleteSavedQuery.handler);

    const transport = new StdioServerTransport();
    console.error(`"Starting GraphQL MCP Metatool with ${registeredTools.size} saved tools"`);
    await server.connect(transport);
  } catch (error) {
    console.error('Failed to start GraphQL MCP server:', error);
    process.exit(1);
  }
}

await main();
