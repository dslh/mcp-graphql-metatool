#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import * as executeGraphqlQuery from './tools/executeGraphqlQuery.js';
import * as createSavedQueryTool from './tools/createSavedQueryTool.js';
import { createZodSchemaFromJsonSchema } from './tools/createSavedQueryTool.js';
import { loadAllTools } from './storage.js';
import { createDynamicToolHandler } from './dynamicToolHandler.js';
import { SavedToolConfig } from './types.js';

function registerAllTools(server: McpServer): Map<string, SavedToolConfig> {
  const existingTools = loadAllTools();

  // Register all loaded saved tools
  for (const [toolName, toolConfig] of existingTools) {
    const dynamicHandler = createDynamicToolHandler(toolConfig);
    
    const dynamicToolConfig = {
      title: toolConfig.description,
      description: toolConfig.description,
      inputSchema: createZodSchemaFromJsonSchema(toolConfig.parameter_schema),
    };
    
    server.registerTool(toolName, dynamicToolConfig, dynamicHandler);
  }

  return existingTools;
}

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

    // Register core tools
    server.registerTool(executeGraphqlQuery.name, executeGraphqlQuery.config, executeGraphqlQuery.handler);

    // Register all saved tools and get the existingTools map
    const existingTools = registerAllTools(server);

    // Register the create saved query tool (needs existingTools for validation)
    server.registerTool(createSavedQueryTool.name, createSavedQueryTool.config, createSavedQueryTool.createHandler(server, existingTools));

    const transport = new StdioServerTransport();
    console.log(`Starting GraphQL MCP Metatool with ${existingTools.size} saved tools`);
    await server.connect(transport);
  } catch (error) {
    console.error('Failed to start GraphQL MCP server:', error);
    process.exit(1);
  }
}

await main();
