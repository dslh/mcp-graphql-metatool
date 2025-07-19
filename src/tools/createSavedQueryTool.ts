import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { createDynamicToolHandler } from '../dynamicToolHandler.js';
import { withErrorHandling, type Logger } from '../responses.js';
import { saveToolToFile } from '../storage.js';
import type { CreateSavedQueryToolParams, SavedToolConfig } from '../types.js';

export const name = 'create_saved_query_tool';

export const config = {
  title: 'Create Saved Query Tool',
  description: 'Create an MCP tool from a GraphQL query',
  inputSchema: {
    tool_name: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case starting with a letter').describe('The unique name for this tool in snake_case format'),
    description: z.string().min(1, 'Description is required').describe('A human-readable description of what this tool does'),
    graphql_query: z.string().min(1, 'GraphQL query is required').describe('The GraphQL query that this tool will execute'),
    parameter_schema: z.record(z.any()).describe('JSON Schema defining tool parameters'),
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
  server: McpServer,
  toolName: string,
  toolConfig: SavedToolConfig,
  existingTools: Map<string, SavedToolConfig>
): void {
  const dynamicHandler = createDynamicToolHandler(toolConfig);

  const dynamicToolConfig = {
    title: toolConfig.description,
    description: toolConfig.description,
    inputSchema: createZodSchemaFromJsonSchema(toolConfig.parameter_schema),
  };

  server.registerTool(toolName, dynamicToolConfig, dynamicHandler);
  existingTools.set(toolName, toolConfig);
}

export function createHandler(server: McpServer, existingTools: Map<string, SavedToolConfig>) {
  return (params: CreateSavedQueryToolParams): { content: { type: 'text'; text: string }[]; isError?: boolean } => {
    return withErrorHandling(`creating tool '${params.tool_name}'`, (log: Logger) => {
      if (existingTools.has(params.tool_name)) {
        throw new Error(`Tool with name '${params.tool_name}' already exists`);
      }

      log('parsing params');
      if (!isValidJsonSchema(params.parameter_schema)) {
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

      // Then register with server
      log('registering tool in MCP server');
      registerToolWithServer(server, params.tool_name, toolConfig, existingTools);

      return `Successfully created tool '${params.tool_name}' with ${variables.length} variables: ${variables.join(', ')}`;
    });
  };
}

function extractGraphQLVariables(query: string): string[] {
  const variableMatches = query.match(/\$(\w+)/g) ?? [];
  return [...new Set(variableMatches.map(match => match.slice(1)))];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidJsonSchema(schema: any): boolean {
  if (schema === null || schema === undefined || typeof schema !== 'object') return false;

  if (schema['type'] === 'object') {
    return Boolean(schema['properties']) && typeof schema['properties'] === 'object';
  }

  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createZodSchemaFromJsonSchema(jsonSchema: Record<string, any>): Record<string, z.ZodSchema> {
  const schemaFields: Record<string, z.ZodSchema> = {};

  if (jsonSchema['type'] === 'object' && Boolean(jsonSchema['properties'])) {
    for (const [key, value] of Object.entries(jsonSchema['properties'])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const propSchema = value as Record<string, any>;
      // eslint-disable-next-line security/detect-object-injection
      schemaFields[key] = createZodFieldFromJsonSchema(propSchema);
    }
  }

  return schemaFields;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createZodFieldFromJsonSchema(jsonSchema: Record<string, any>): z.ZodSchema {
  switch (jsonSchema['type']) {
    case 'string': {
      return z.string();
    }
    case 'number': {
      return z.number();
    }
    case 'integer': {
      return z.number().int();
    }
    case 'boolean': {
      return z.boolean();
    }
    case 'array': {
      const itemSchema =
        jsonSchema['items'] === undefined ? z.any() : createZodFieldFromJsonSchema(jsonSchema['items']);
      return z.array(itemSchema);
    }
    default: {
      return z.any();
    }
  }
}
