#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { server, registeredTools } from './server.js';

async function main(): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    console.error(`"Starting GraphQL MCP Metatool with ${registeredTools.size} saved tools"`);
    await server.connect(transport);
  } catch (error) {
    console.error('Failed to start GraphQL MCP server:', error);
    process.exit(1);
  }
}

await main();
