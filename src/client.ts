import { GraphQLClient } from 'graphql-request';

function createClient(): GraphQLClient {
  const graphqlEndpoint = process.env['GRAPHQL_ENDPOINT'];
  const authToken = process.env['GRAPHQL_AUTH_TOKEN'];
  const cookieHeader = process.env['GRAPHQL_COOKIE_HEADER'];

  if (graphqlEndpoint === undefined || graphqlEndpoint === '') {
    throw new Error('GRAPHQL_ENDPOINT environment variable is required');
  }

  const headers: Record<string, string> = {};
  
  if (authToken !== undefined && authToken !== '') {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  if (cookieHeader !== undefined && cookieHeader !== '') {
    headers['Cookie'] = cookieHeader;
  }
  
  return new GraphQLClient(graphqlEndpoint, {
    headers,
  });
}

export const client = createClient();
