# MCP GraphQL Metatool

A Model Context Protocol (MCP) server that provides AI agents with flexible access to GraphQL APIs. This tool enables both direct GraphQL query execution and dynamic creation of custom tools that persist across sessions.

MCP servers that wrap existing APIs can be awkward for agents to use. Either they expose everything, leaving the agent to piece everything together from scratch in each new session, or they are too intentional, constraining the agent to just a few possible use-cases. This tool attempts to strike a balance, starting with just a general purpose GraphQL query tool but allowing the agent to save queries as tools to be reused in future sessions.

**Work with your agent to build and maintain tools adapted to your workflow.**

## Available Tools

- **`execute_graphql_query`** - Execute arbitrary GraphQL queries directly
- **`save_query`** - Create or update custom tools from GraphQL queries  
- **`list_saved_queries`** - List all saved custom tools
- **`show_saved_query`** - View complete definition of a saved tool
- **`delete_saved_query`** - Remove a saved tool

## Features

- **Direct GraphQL Execution** - Execute arbitrary GraphQL queries against any endpoint
- **Dynamic Tool Creation** - Create custom tools from GraphQL queries that persist across sessions
- **Configurable Headers** - Flexible header configuration via environment variables for any authentication method
- **Parameter Validation** - JSON Schema-based parameter validation for custom tools
- **Cross-Session Persistence** - Tools and configurations persist between sessions via JSON files
- **MCP Protocol Compliance** - Full support for MCP capabilities including list change notifications

## Installation

```bash
# Clone the repository
git clone https://github.com/dslh/mcp-graphql-metatool.git
cd mcp-graphql-metatool

# Install dependencies
yarn install

# Build the project
yarn build
```

## Configuration

### Environment Variables

Set up your GraphQL endpoint and headers using environment variables:

```bash
# Required: GraphQL API endpoint
export GRAPHQL_ENDPOINT="https://api.example.com/graphql"
```

### Header Configuration

Configure HTTP headers using the `GRAPHQL_HEADER_*` pattern. Environment variable names are converted to HTTP header names by:
- Removing the `GRAPHQL_HEADER_` prefix
- Converting to lowercase
- Replacing underscores with hyphens

#### Examples

**Basic Bearer Token Authentication:**
```bash
export GRAPHQL_HEADER_AUTHORIZATION="Bearer your-token-here"
```

**Cookie-based Authentication:**
```bash
export GRAPHQL_HEADER_COOKIE="sessionId=abc123; token=xyz789"
```

**API Key in Custom Header:**
```bash
export GRAPHQL_HEADER_X_API_KEY="your-api-key"
export GRAPHQL_HEADER_X_CLIENT_ID="your-client-id"
```

**Custom User Agent and Content Type:**
```bash
export GRAPHQL_HEADER_USER_AGENT="MyApp/1.0"
export GRAPHQL_HEADER_CONTENT_TYPE="application/json"
```

### Legacy Environment Variables (Still Supported)

```bash
# Legacy: Bearer token for authentication
export GRAPHQL_AUTH_TOKEN="your-bearer-token-here"

# Legacy: Cookie header for authentication
export GRAPHQL_COOKIE_HEADER="sessionId=abc123; token=xyz789"
```

**Note:** `GRAPHQL_HEADER_*` variables take precedence over legacy variables.

## Quick Start

1. **Start the server:**
   ```bash
   yarn start
   ```

2. **Execute a GraphQL query directly:**
   ```typescript
   // Use the execute_graphql_query tool
   {
     "query": "query GetUser($id: ID!) { user(id: $id) { name email } }",
     "variables": { "id": "123" }
   }
   ```

3. **Create a custom tool from a query:**
   ```typescript
   // Use the save_query tool
   {
     "tool_name": "get_user_by_id",
     "description": "Get user details by ID",
     "graphql_query": "query GetUser($id: ID!) { user(id: $id) { name email } }",
     "parameter_schema": {
       "type": "object",
       "properties": {
         "id": { "type": "string", "description": "User ID" }
       },
       "required": ["id"]
     }
   }
   ```

## Usage Examples

### Direct GraphQL Execution

Execute any GraphQL query directly:

```typescript
// Tool: execute_graphql_query
{
  "query": "{ users(first: 10) { nodes { id name email } } }"
}
```

### Creating Custom Tools

Transform frequently used queries into reusable tools:

```typescript
// Tool: save_query
{
  "tool_name": "list_recent_users",
  "description": "List recently created users",
  "graphql_query": "query ListUsers($limit: Int!, $since: DateTime) { users(first: $limit, createdAfter: $since) { nodes { id name email createdAt } } }",
  "parameter_schema": {
    "type": "object",
    "properties": {
      "limit": {
        "type": "integer",
        "description": "Number of users to return",
        "default": 10,
        "minimum": 1,
        "maximum": 100
      },
      "since": {
        "type": "string",
        "description": "ISO datetime to filter users created after",
        "format": "date-time"
      }
    },
    "required": ["limit"]
  }
}
```

### Managing Saved Tools

```typescript
// List all saved tools
// Tool: list_saved_queries

// View a specific tool definition
// Tool: show_saved_query
{ "tool_name": "get_user_by_id" }

// Delete a tool
// Tool: delete_saved_query
{ "tool_name": "old_tool_name" }
```

## API Reference

### Core Tools

#### `execute_graphql_query`
Execute arbitrary GraphQL queries.

**Parameters:**
- `query` (string, required) - The GraphQL query to execute
- `variables` (object, optional) - Variables for the query

#### `save_query`
Create or update a custom tool from a GraphQL query.

**Parameters:**
- `tool_name` (string, required) - Snake_case name for the tool
- `description` (string, required) - Human-readable description
- `graphql_query` (string, required) - GraphQL query with $variable placeholders
- `parameter_schema` (object, required) - JSON Schema defining tool parameters
- `overwrite` (boolean, optional) - Whether to overwrite existing tools (default: false)

#### `list_saved_queries`
List all saved custom tools.

#### `show_saved_query`
View the complete definition of a saved tool.

**Parameters:**
- `tool_name` (string, required) - Name of the tool to show

#### `delete_saved_query`
Remove a saved tool.

**Parameters:**
- `tool_name` (string, required) - Name of the tool to delete

## Architecture Overview

The server is built with a modular architecture:

- **Server Entry Point** (`src/index.ts`) - MCP server setup and tool registration
- **GraphQL Client** (`src/client.ts`) - Singleton GraphQL client with authentication
- **Dynamic Tool Handler** (`src/dynamicToolHandler.ts`) - Runtime tool creation from saved configurations
- **Storage System** (`src/storage.ts`) - JSON file-based persistence for tools
- **Type Validation** (`src/jsonSchemaValidator.ts`) - JSON Schema to Zod conversion for parameter validation

### Data Persistence

Tools are persisted as individual JSON files in the `data/tools/` directory:

```
data/
├── tools/
│   ├── get_user_by_id.json
│   ├── list_recent_users.json
│   └── ...
└── types/
    └── (reserved for future custom type definitions)
```

## Development

### Commands

```bash
# Development mode with hot reload
yarn dev

# Build for production
yarn build

# Run production server
yarn start

# Linting and formatting
yarn lint
yarn lint:fix
yarn format
yarn format:check

# Testing
yarn test
yarn test:watch
yarn test:coverage
yarn test:ui
```

### Project Standards

- **TypeScript** with strict configuration
- **ESLint** with comprehensive rules for security and code quality
- **Prettier** for consistent code formatting
- **Vitest** for testing with coverage reporting
- **No default exports** - All exports must be named
- **Single quotes** and **semicolons required**

## Environment Variables

| Variable                | Required    | Description                           |
|-------------------------|-------------|---------------------------------------|
| `GRAPHQL_ENDPOINT`      | Yes         | GraphQL API endpoint URL              |
| `GRAPHQL_HEADER_*`      | No          | HTTP headers (see Header Configuration) |
| `GRAPHQL_AUTH_TOKEN`    | No          | Legacy: Bearer token for authentication |
| `GRAPHQL_COOKIE_HEADER` | No          | Legacy: Cookie header for authentication |

## Implementation Status

This project implements Phase 0-1 of the requirements:

- ✅ **Basic GraphQL execution** (`execute_graphql_query`)
- ✅ **Tool creation** (`save_query`)
- ✅ **Cross-session persistence** (JSON files)
- ✅ **MCP list change notifications**
- ⏳ **Context management** (planned)
- ⏳ **Schema exploration** (planned)

See `requirements.md` for the complete roadmap.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `yarn test`
5. Ensure linting passes: `yarn lint`
6. Submit a pull request

## Author

Doug Hammond <d.lakehammond@gmail.com>
