import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerAllTools } from './dynamicToolHandler.js';
import { ensureDataDirectory } from './storage.js';
import * as deleteSavedQuery from './tools/deleteSavedQuery.js';
import * as executeGraphqlQuery from './tools/executeGraphqlQuery.js';
import * as listSavedQueries from './tools/listSavedQueries.js';
import * as saveQuery from './tools/saveQuery.js';
import * as showSavedQuery from './tools/showSavedQuery.js';

function createServer(): { server: McpServer; registeredTools: Map<string, RegisteredTool> } {
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

  // Register core tools
  server.registerTool(executeGraphqlQuery.name, executeGraphqlQuery.config, executeGraphqlQuery.handler);
  server.registerTool(saveQuery.name, saveQuery.config, saveQuery.handler);
  server.registerTool(deleteSavedQuery.name, deleteSavedQuery.config, deleteSavedQuery.handler);
  server.registerTool(listSavedQueries.name, listSavedQueries.config, listSavedQueries.handler);
  server.registerTool(showSavedQuery.name, showSavedQuery.config, showSavedQuery.handler);

  // Register all saved tools and get the registeredTools map
  const registeredTools = registerAllTools(server);

  return { server, registeredTools };
}

const { server, registeredTools } = createServer();

export { server, registeredTools };