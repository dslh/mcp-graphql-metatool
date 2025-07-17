import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { createDynamicToolHandler } from '../dynamicToolHandler.js';
import type { CreateSavedQueryToolParams, SavedToolConfig } from '../types.js';

export const name = 'create_saved_query_tool';

export const config = {
  title: 'Create Saved Query Tool',
  description: 'Create an MCP tool from a GraphQL query',
  inputSchema: {
    tool_name: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case starting with a letter'),
    description: z.string().min(1, 'Description is required'),
    graphql_query: z.string().min(1, 'GraphQL query is required'),
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

export function createHandler(server: McpServer, existingTools: Map<string, SavedToolConfig>) {
  return async (params: CreateSavedQueryToolParams): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> => {
    try {
      if (existingTools.has(params.tool_name)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Tool with name '${params.tool_name}' already exists`,
            },
          ],
          isError: true,
        };
      }

      if (!isValidJsonSchema(params.parameter_schema)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Invalid parameter_schema: must be a valid JSON Schema object',
            },
          ],
          isError: true,
        };
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

      const dynamicHandler = createDynamicToolHandler(toolConfig);
      
      const dynamicToolConfig = {
        title: params.description,
        description: params.description,
        inputSchema: createZodSchemaFromJsonSchema(params.parameter_schema),
      };

      server.registerTool(params.tool_name, dynamicToolConfig, dynamicHandler);
      
      existingTools.set(params.tool_name, toolConfig);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Successfully created tool '${params.tool_name}' with ${variables.length} variables: ${variables.join(', ')}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to create tool: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  };
}

function extractGraphQLVariables(query: string): string[] {
  const variableMatches = query.match(/\$(\w+)/g) ?? [];
  return [...new Set(variableMatches.map(match => match.slice(1)))];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidJsonSchema(schema: any): boolean {
  if (!schema || typeof schema !== 'object') return false;
  
  if (schema['type'] === 'object') {
    return Boolean(schema['properties']) && typeof schema['properties'] === 'object';
  }
  
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createZodSchemaFromJsonSchema(jsonSchema: Record<string, any>): Record<string, z.ZodSchema> {
  const schemaFields: Record<string, z.ZodSchema> = {};
  
  if (jsonSchema['type'] === 'object' && Boolean(jsonSchema['properties'])) {
     
    for (const [key, value] of Object.entries(jsonSchema['properties'])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const propSchema = value as Record<string, any>;
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
      const itemSchema = jsonSchema['items'] ? createZodFieldFromJsonSchema(jsonSchema['items']) : z.any();
      return z.array(itemSchema);
    }
    default: {
      return z.any();
    }
  }
}
