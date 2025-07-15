import { GraphQLClient } from 'graphql-request';

function createClient(): GraphQLClient {
  const graphqlEndpoint = process.env.GRAPHQL_ENDPOINT;
  const authToken = process.env.GRAPHQL_AUTH_TOKEN;

  if (!graphqlEndpoint) {
    throw new Error('GRAPHQL_ENDPOINT environment variable is required');
  }
  
  return new GraphQLClient(graphqlEndpoint, {
    headers: authToken ? {
      'Authorization': `Bearer ${authToken}`
    } : {},
  });
}

export const client = createClient();