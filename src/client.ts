import { GraphQLClient } from 'graphql-request';

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  // Scan for GRAPHQL_HEADER_* environment variables
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('GRAPHQL_HEADER_') && value) {
      // Convert GRAPHQL_HEADER_USER_AGENT -> user-agent
      const headerName = key
        .replace('GRAPHQL_HEADER_', '')
        .toLowerCase()
        .replace(/_/g, '-');
      
      headers[headerName] = value;
    }
  }

  // Support legacy environment variables
  const authToken = process.env['GRAPHQL_AUTH_TOKEN'];
  if (authToken && authToken.trim() !== '') {
    headers['authorization'] = `Bearer ${authToken}`;
  }

  const cookieHeader = process.env['GRAPHQL_COOKIE_HEADER'];
  if (cookieHeader && cookieHeader.trim() !== '') {
    headers['cookie'] = cookieHeader;
  }

  // Add minimal default headers if none are set
  if (Object.keys(headers).length === 0) {
    headers['content-type'] = 'application/json';
    headers['accept'] = '*/*';
    headers['user-agent'] = 'GraphQL-MCP-Server/1.0.0';
  }

  return headers;
}

function createClient(): GraphQLClient {
  const graphqlEndpoint = process.env['GRAPHQL_ENDPOINT'];
  
  if (!graphqlEndpoint || graphqlEndpoint.trim() === '') {
    throw new Error('GRAPHQL_ENDPOINT environment variable is required');
  }

  const headers = buildHeaders();
  
  return new GraphQLClient(graphqlEndpoint, {
    headers,
  });
}

export const client = createClient();
