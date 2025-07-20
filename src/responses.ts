/**
 * Shared response utilities for MCP tools
 * Provides consistent response formatting and error handling across all tools
 */

export interface MCPResponse {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(message: string): MCPResponse {
  return {
    content: [{
      type: 'text' as const,
      text: message,
    }],
  };
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(operation: string, error: unknown): MCPResponse {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Failed ${operation}: ${errorMessage}`);

  return {
    content: [{
      type: 'text' as const,
      text: `Error ${operation}: ${errorMessage}`,
    }],
    isError: true,
  };
}

export type Logger = (msg: string) => void;
type HandledFn = (log: Logger) => string;
type AsyncHandledFn = (log: Logger) => Promise<string>;

/**
 * Wraps arbitrary code to return responses in MCP format.
 *
 * Provides a logger that also enhances error messages sent back to the agent.
 */
export function withErrorHandling(operation: string, fn: HandledFn): MCPResponse;
export function withErrorHandling(operation: string, fn: AsyncHandledFn): Promise<MCPResponse>;
export function withErrorHandling(operation: string, fn: HandledFn | AsyncHandledFn): MCPResponse | Promise<MCPResponse> {
  console.error(`Started ${operation}`);

  let stage = '';
  const log = (msg: string) => {
    console.error(msg);
    stage = ` while ${msg}`;
  }

  try {
    const result = fn(log);
    
    // Check if the result is a Promise
    if (result instanceof Promise) {
      return result
        .then(value => createSuccessResponse(value))
        .catch(error => createErrorResponse(`${operation}${stage}`, error))
        .finally(() => console.error(`Finished ${operation}`));
    }
    
    // Synchronous case
    console.error(`Finished ${operation}`);
    return createSuccessResponse(result);
  } catch (error) {
    console.error(`Finished ${operation}`);
    return createErrorResponse(`${operation}${stage}`, error);
  }
}
