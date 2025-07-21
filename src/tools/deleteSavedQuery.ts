import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { withErrorHandling, type Logger } from '../responses.js';
import { deleteToolFile } from '../storage.js';
import type { DeleteSavedQueryToolParams } from '../types.js';

export const name = 'delete_saved_query';

export const config = {
  title: 'Delete Saved Query',
  description: 'Remove a saved query tool from the system',
  inputSchema: {
    tool_name: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case starting with a letter')
      .describe('The name of the saved query tool to delete'),
  },
};

// Core tools that cannot be deleted
const PROTECTED_TOOLS = new Set(['execute_graphql_query', 'save_query', 'delete_saved_query']);

export function createHandler(server: McpServer, registeredTools: Map<string, RegisteredTool>) {
  return (params: DeleteSavedQueryToolParams): { content: { type: 'text'; text: string }[]; isError?: boolean } => {
    return withErrorHandling(`deleting tool '${params.tool_name}'`, (log: Logger) => {
      // Check if it's a protected core tool
      if (PROTECTED_TOOLS.has(params.tool_name)) {
        throw new Error(`Cannot delete core tool '${params.tool_name}'`);
      }

      // Check if tool exists in registered tools
      const registeredTool = registeredTools.get(params.tool_name);
      if (!registeredTool) {
        throw new Error(`Saved query '${params.tool_name}' not found`);
      }

      // Remove from MCP server first (for atomicity - if this fails, we don't delete the file)
      log('removing tool from MCP server');
      registeredTool.remove();

      // Remove from our registered tools map
      registeredTools.delete(params.tool_name);

      // Delete the file from storage
      log('deleting tool file from storage');
      deleteToolFile(params.tool_name);

      return `Successfully deleted saved query '${params.tool_name}'`;
    });
  };
}
