import { z } from 'zod';

import { withErrorHandling } from '../responses.js';
import { registeredTools } from '../server.js';
import { loadToolFromFile } from '../storage.js';
import type { ShowSavedQueryToolParams } from '../types.js';

export const name = 'show_saved_query';

export const config = {
  title: 'Show Saved Query',
  description: 'Returns full tool definition for a saved query',
  inputSchema: {
    tool_name: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case starting with a letter')
      .describe('The name of the saved query tool to show'),
  },
};

export function handler(params: ShowSavedQueryToolParams): { content: { type: 'text'; text: string }[]; isError?: boolean } {
  return withErrorHandling(`showing saved query '${params.tool_name}'`, () => {
    // Check if tool exists in registered tools
    if (!registeredTools.has(params.tool_name)) {
      throw new Error(`Saved query '${params.tool_name}' not found`);
    }

    // Load tool configuration from storage
    const toolConfig = loadToolFromFile(params.tool_name);
    if (!toolConfig) {
      throw new Error(`Tool configuration for '${params.tool_name}' could not be loaded`);
    }

    // Return formatted tool definition
    const toolDefinition = {
      name: toolConfig.name,
      description: toolConfig.description,
      graphql_query: toolConfig.graphql_query,
      parameter_schema: toolConfig.parameter_schema,
      variables: toolConfig.variables,
      ...(toolConfig.pagination_config && { pagination_config: toolConfig.pagination_config }),
      ...(toolConfig.idempotency && { idempotency: toolConfig.idempotency }),
    };

    return `Tool definition for '${params.tool_name}':\n\n\`\`\`json\n${JSON.stringify(toolDefinition, null, 2)}\n\`\`\``;
  });
}