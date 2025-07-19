import { z } from 'zod';

import { client } from './client.js';
import { convertJsonSchemaToZod } from './jsonSchemaValidator.js';
import { withErrorHandling, type Logger } from './responses.js';
import type { SavedToolConfig } from './types.js';

export function createDynamicToolHandler(toolConfig: SavedToolConfig) {
  const paramSchema = convertJsonSchemaToZod(toolConfig.parameter_schema);
  
  return async (params: Record<string, any>): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> => {
    return withErrorHandling(`executing tool '${toolConfig.name}'`, async (log: Logger) => {
      log('validating parameters');
      let validatedParams;
      try {
        validatedParams = paramSchema.parse(params);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(`Parameter validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        }
        throw error;
      }
      
      log('extracting variables');
      const variables = extractVariables(toolConfig.graphql_query, validatedParams);
      
      log('executing GraphQL query');
      const result = await client.request(toolConfig.graphql_query, variables);
      return JSON.stringify(result, null, 2);
    });
  };
}

function extractVariables(query: string, params: Record<string, any>): Record<string, any> {
  const variables: Record<string, any> = {};
  
  const variableMatches = query.match(/\$(\w+)/g) || [];
  
  for (const match of variableMatches) {
    const variableName = match.slice(1);
    if (params[variableName] !== undefined) {
      variables[variableName] = params[variableName];
    }
  }
  
  return variables;
}

