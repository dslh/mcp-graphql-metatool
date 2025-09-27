import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerAllTools } from './dynamicToolHandler.js';
import { ensureDataDirectory } from './storage.js';
import * as deleteSavedQuery from './tools/deleteSavedQuery.js';
import * as executeGraphqlQuery from './tools/executeGraphqlQuery.js';
import * as listSavedQueries from './tools/listSavedQueries.js';
import * as saveQuery from './tools/saveQuery.js';
import * as showSavedQuery from './tools/showSavedQuery.js';

function createServer(): { server: McpServer; registeredTools: Map<string, RegisteredTool>; coreToolsStatus: string } {
  ensureDataDirectory();

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

  // Check environment variable for disabling core tools
  const disableSetting = process.env['DISABLE_CORE_TOOLS']?.toLowerCase() || 'none';
  let coreToolsStatus: string;

  // Register core tools based on settings
  if (disableSetting === 'all') {
    // Disable all core tools
    coreToolsStatus = 'all core tools disabled';
  } else if (disableSetting === 'management') {
    // Keep execute_graphql_query, disable management tools
    server.registerTool(executeGraphqlQuery.name, executeGraphqlQuery.config, executeGraphqlQuery.handler);
    coreToolsStatus = 'management tools disabled, execute_graphql_query enabled';
  } else {
    // Default: register all core tools
    server.registerTool(executeGraphqlQuery.name, executeGraphqlQuery.config, executeGraphqlQuery.handler);
    server.registerTool(saveQuery.name, saveQuery.config, saveQuery.handler);
    server.registerTool(deleteSavedQuery.name, deleteSavedQuery.config, deleteSavedQuery.handler);
    server.registerTool(listSavedQueries.name, listSavedQueries.config, listSavedQueries.handler);
    server.registerTool(showSavedQuery.name, showSavedQuery.config, showSavedQuery.handler);
    coreToolsStatus = 'all core tools enabled';
  }

  // Register all saved tools and get the registeredTools map
  const registeredTools = registerAllTools(server);

  return { server, registeredTools, coreToolsStatus };
}

const { server, registeredTools, coreToolsStatus } = createServer();

export { server, registeredTools, coreToolsStatus };