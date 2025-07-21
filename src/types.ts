export interface SaveQueryToolParams {
  tool_name: string;
  description: string;
  graphql_query: string;
  parameter_schema: Record<string, any>;
  overwrite?: boolean;
  pagination_config?: PaginationConfig | undefined;
  idempotency?: IdempotencyConfig | undefined;
}

export interface PaginationConfig {
  enabled: boolean;
  style: 'relay' | 'offset' | 'cursor';
  page_size: number;
  merge_strategy: 'concat_nodes' | 'concat_edges' | 'custom';
}

export interface IdempotencyConfig {
  enabled: boolean;
  cache_key_params: string[];
  ttl_seconds: number;
}

export interface SavedToolConfig {
  name: string;
  description: string;
  graphql_query: string;
  parameter_schema: Record<string, any>;
  pagination_config?: PaginationConfig | undefined;
  idempotency?: IdempotencyConfig | undefined;
  variables: string[];
}