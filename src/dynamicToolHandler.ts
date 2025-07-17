import { z } from 'zod';
import { client } from './client.js';
import { SavedToolConfig } from './types.js';

export function createDynamicToolHandler(toolConfig: SavedToolConfig) {
  const paramSchema = createZodSchemaFromJsonSchema(toolConfig.parameter_schema);
  
  return async (params: Record<string, any>): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> => {
    try {
      const validatedParams = paramSchema.parse(params);
      
      const variables = extractVariables(toolConfig.graphql_query, validatedParams);
      
      const result = await client.request(toolConfig.graphql_query, variables);
      
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Parameter validation error in tool '${toolConfig.name}': ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
            },
          ],
          isError: true,
        };
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const isGraphQLError = error instanceof Error && (
        error.message.includes('GraphQL') || 
        error.message.includes('query') || 
        error.message.includes('syntax')
      );
      
      const errorType = isGraphQLError ? 'GraphQL query execution error' : 'Tool execution error';
      
      return {
        content: [
          {
            type: 'text' as const,
            text: `${errorType} in tool '${toolConfig.name}': ${errorMessage}\n\nTool definition:\n- Query: ${toolConfig.graphql_query}\n- Variables: ${toolConfig.variables.join(', ')}`,
          },
        ],
        isError: true,
      };
    }
  };
}

function extractVariables(query: string, params: Record<string, any>): Record<string, any> {
  const variables: Record<string, any> = {};
  
  const variableMatches = query.match(/\$(\w+)/g) || [];
  
  for (const match of variableMatches) {
    const variableName = match.substring(1);
    if (params[variableName] !== undefined) {
      variables[variableName] = params[variableName];
    }
  }
  
  return variables;
}

function createZodSchemaFromJsonSchema(jsonSchema: Record<string, any>): z.ZodSchema {
  const schemaFields: Record<string, z.ZodSchema> = {};
  
  if (jsonSchema['type'] === 'object' && jsonSchema['properties']) {
    for (const [key, value] of Object.entries(jsonSchema['properties'])) {
      const propSchema = value as Record<string, any>;
      schemaFields[key] = createZodFieldFromJsonSchema(propSchema);
    }
  }
  
  return z.object(schemaFields);
}

function createZodFieldFromJsonSchema(jsonSchema: Record<string, any>): z.ZodSchema {
  switch (jsonSchema['type']) {
    case 'string':
      return z.string();
    case 'number':
      return z.number();
    case 'integer':
      return z.number().int();
    case 'boolean':
      return z.boolean();
    case 'array':
      const itemSchema = jsonSchema['items'] ? createZodFieldFromJsonSchema(jsonSchema['items']) : z.any();
      return z.array(itemSchema);
    default:
      return z.any();
  }
}