import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { createDynamicToolHandler } from '../dynamicToolHandler.js';
import { validateJsonSchema, convertJsonSchemaToMcpZod } from '../jsonSchemaValidator.js';
import { withErrorHandling, type Logger } from '../responses.js';
import { server, registeredTools } from '../server.js';
import { saveToolToFile } from '../storage.js';
import type { SaveQueryToolParams, SavedToolConfig } from '../types.js';

export const name = 'save_query';

export const config = {
  title: 'Save Query Tool',
  description: 'Create or update an MCP tool from a GraphQL query',
  inputSchema: {
    tool_name: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case starting with a letter')
      .describe('The unique name for this tool in snake_case format'),
    description: z
      .string()
      .min(1, 'Description is required')
      .describe('A human-readable description of what this tool does'),
    graphql_query: z
      .string()
      .min(1, 'GraphQL query is required')
      .describe('The GraphQL query that this tool will execute'),
    parameter_schema: z.record(z.any()).describe('JSON Schema defining tool parameters'),
    overwrite: z.boolean().default(false).describe('Whether to overwrite an existing tool with the same name'),
    // To be implemented:
    // pagination_config: z.object({
    //   enabled: z.boolean(),
    //   style: z.enum(['relay', 'offset', 'cursor']),
    //   page_size: z.number().int().positive(),
    //   merge_strategy: z.enum(['concat_nodes', 'concat_edges', 'custom']),
    // }).optional(),
    // idempotency: z.object({
    //   enabled: z.boolean(),
    //   cache_key_params: z.array(z.string()),
    //   ttl_seconds: z.number().int().positive(),
    // }).optional(),
  },
};

function registerToolWithServer(
  toolName: string,
  toolConfig: SavedToolConfig
): RegisteredTool {
  const dynamicHandler = createDynamicToolHandler(toolConfig);

  const dynamicToolConfig = {
    title: toolConfig.description,
    description: toolConfig.description,
    inputSchema: convertJsonSchemaToMcpZod(toolConfig.parameter_schema),
  };

  const registeredTool = server.registerTool(toolName, dynamicToolConfig, dynamicHandler);
  registeredTools.set(toolName, registeredTool);
  return registeredTool;
}

function updateExistingTool(
  toolName: string,
  toolConfig: SavedToolConfig
): void {
  const existingTool = registeredTools.get(toolName);
  if (!existingTool) {
    throw new Error(`Registered tool '${toolName}' not found for update`);
  }

  const dynamicHandler = createDynamicToolHandler(toolConfig);

  existingTool.update({
    title: toolConfig.description,
    description: toolConfig.description,
    paramsSchema: convertJsonSchemaToMcpZod(toolConfig.parameter_schema),
    callback: dynamicHandler,
  });
}

export function handler(params: SaveQueryToolParams): { content: { type: 'text'; text: string }[]; isError?: boolean } {
  return withErrorHandling(`saving tool '${params.tool_name}'`, (log: Logger) => {
    // Check if tool already exists
    const toolExists = registeredTools.has(params.tool_name);
    const isUpdate = toolExists && (params.overwrite ?? false);
    const isCreate = !toolExists;

    if (toolExists && !(params.overwrite ?? false)) {
      throw new Error(`Tool with name '${params.tool_name}' already exists. Set overwrite=true to update it.`);
    }

    log('parsing params');
    if (!validateJsonSchema(params.parameter_schema)) {
      throw new Error('Invalid parameter_schema: must be a valid JSON Schema object');
    }

    const variables = extractGraphQLVariables(params.graphql_query);

    const toolConfig: SavedToolConfig = {
      name: params.tool_name,
      description: params.description,
      graphql_query: params.graphql_query,
      parameter_schema: params.parameter_schema,
      pagination_config: params.pagination_config,
      idempotency: params.idempotency,
      variables,
    };

    // Persist first for atomicity
    log('persisting file');
    saveToolToFile(params.tool_name, toolConfig);

    // Then register or update with server
    if (isCreate) {
      log('registering new tool in MCP server');
      registerToolWithServer(params.tool_name, toolConfig);
      return `Successfully created tool '${params.tool_name}' with ${variables.length} variables: ${variables.join(', ')}`;
    } else if (isUpdate) {
      log('updating existing tool in MCP server');
      updateExistingTool(params.tool_name, toolConfig);
      return `Successfully updated tool '${params.tool_name}' with ${variables.length} variables: ${variables.join(', ')}`;
    }

    // This should never happen due to the logic above, but keeping for safety
    throw new Error('Unexpected state in save_query handler');
  });
}

function extractGraphQLVariables(query: string): string[] {
  const variableMatches = query.match(/\$(\w+)/g) ?? [];
  return [...new Set(variableMatches.map(match => match.slice(1)))];
}
