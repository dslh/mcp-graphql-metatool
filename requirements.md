# GraphQL Toolkit MCP Server Requirements Document

## Executive Summary

This document outlines requirements for a standalone Model Context Protocol (MCP) server that provides AI agents with flexible access to GraphQL APIs. The server will support both direct GraphQL query execution and dynamic creation of custom tools, enabling agents to build up domain-specific functionality over time.

## Core Objectives

- **Flexibility**: Support arbitrary GraphQL APIs through configuration
- **Usability**: Provide high-level abstractions while maintaining raw GraphQL access
- **Extensibility**: Allow agents to create and manage custom tools dynamically
- **Developer Experience**: Minimize agent cognitive load through context management and type systems

## Functional Requirements

### 1. Direct GraphQL Execution

#### 1.1 Basic Query Execution
- **Tool**: `execute_graphql_query(query, variables=null)`
- **Purpose**: Execute arbitrary GraphQL queries against the configured endpoint
- **Returns**: Raw GraphQL response including data and errors
- **Requirements**:
  - Support for GraphQL queries, mutations, and subscriptions
  - Variable substitution
  - Proper error handling and propagation

#### 1.2 Query Validation
- **Tool**: `validate_graphql_query(query, variables=null)`
- **Purpose**: Validate GraphQL syntax and schema compliance without execution
- **Returns**: Validation results with detailed error messages
- **Requirements**:
  - Leverage standard GraphQL validation
  - Check syntax, schema compliance, and variable usage
  - Provide actionable error messages

#### 1.3 Schema Exploration
- **Tool**: `get_schema_info(type_name=null)`
- **Purpose**: Explore GraphQL schema structure interactively
- **Parameters**: Optional type name to get details for specific type
- **Returns**: Schema information including available types, fields, and descriptions
- **Requirements**:
  - Return all types if no type_name specified
  - Include field types, arguments, and descriptions
  - Format output for easy readability

### 2. Dynamic Tool Creation

#### 2.1 Tool Creation
- **Tool**: `create_saved_query_tool(tool_name, description, graphql_query, parameter_schema, pagination_config=null, idempotency=null)`

**Parameters**:
- `tool_name`: Snake_case name for the new tool
- `description`: Human-readable description of tool functionality
- `graphql_query`: GraphQL query with $variable placeholders
- `parameter_schema`: JSON Schema defining tool parameters
- `pagination_config`: Optional configuration for automatic pagination
- `idempotency`: Optional caching configuration

**Requirements**:
- Validate tool name uniqueness
- Support parameter validation through JSON Schema
- Reference custom types created via `create_graphql_type`
- Generate proper MCP tool definitions
- **Context Variable Injection**: Any GraphQL variable in the query that matches a context key (e.g., `$workspaceId`) gets automatically populated from context when the tool is executed

#### 2.2 Advanced Features

**Pagination Configuration**:
```json
{
  "enabled": true,
  "style": "relay|offset|cursor",
  "page_size": 100,
  "merge_strategy": "concat_nodes|concat_edges|custom"
}
```

**Idempotency**:
```json
{
  "enabled": true,
  "cache_key_params": ["param1", "param2"],
  "ttl_seconds": 300
}
```

#### 2.3 Tool Management
- **Tool**: `list_saved_tools()`
- **Tool**: `update_saved_tool(tool_name, ...parameters_to_update)`
- **Tool**: `delete_saved_tool(tool_name)`
- **Tool**: `describe_tool(tool_name)` - Returns full tool definition
- **Tool**: `test_saved_tool(tool_name, parameters)` - Execute tool for testing purposes

#### 2.4 Tool Testing
- **Purpose**: Execute saved tools with explicit testing semantics
- **Test Semantics**: 
  - Include "TEST MODE" indicator in response
  - Enhanced error details including tool definition context
  - Optional parameter validation preview before execution
  - Separate logging/metrics tracking for test vs production usage

#### 2.5 Tool Execution Error Handling
- **Requirements**:
  - Return both tool-level errors (parameter validation, configuration issues) and underlying GraphQL errors
  - Include tool definition context in error responses for debugging
  - Provide actionable error messages indicating whether issue is with tool configuration or query execution
  - Log tool execution failures with sufficient detail for troubleshooting

### 3. Context Management

#### 3.1 Setting Context
- **Tool**: `set_graphql_context(key, value)`
- **Purpose**: Set session-level variables that can be automatically injected into queries
- **Examples**: workspace IDs, user IDs, default parameters
- **Requirements**:
  - Persist context throughout the session
  - Support string, number, and boolean values
  - Allow overriding in individual tool calls

#### 3.2 Context Inspection
- **Tool**: `list_graphql_context()`
- **Purpose**: Display all currently set context variables
- **Returns**: Key-value pairs of context variables

#### 3.3 Context Management
- **Tool**: `clear_graphql_context(key=null)`
- **Purpose**: Remove specific context variable or all context if key is null
- **Requirements**: Graceful handling of non-existent keys

### 4. Dynamic Type System

#### 4.1 Type Creation
- **Tool**: `create_graphql_type(type_name, type_definition)`
- **Purpose**: Create reusable parameter types, especially enumerations
- **Parameters**:
  - `type_name`: Unique identifier for the type
  - `type_definition`: JSON Schema object defining the type
- **Requirements**:
  - Support for enum types with descriptions
  - Validation of type definitions
  - Prevention of type name conflicts

#### 4.2 Type Management
- **Tool**: `list_graphql_types()`
- **Purpose**: List all created custom types
- **Returns**: Type names with their definitions

- **Tool**: `delete_graphql_type(type_name)`
- **Purpose**: Remove a custom type
- **Requirements**: Prevent deletion if type is referenced by existing tools

## Technical Requirements

### 1. Server Configuration

#### 1.1 Startup Configuration
```yaml
graphql_endpoint: "https://api.example.com/graphql"
authentication:
  type: "bearer|api_key|header"
  value: "${ENV_VAR_NAME}"
  header_name: "Authorization" # for header auth

# Pre-configured context variables
context_variables:
  WORKSPACE_ID: "workspace_123"
  CURRENT_USER: "john_doe"

# Pre-configured enumerations
enumerations:
  workspace_users:
    - {name: "John Doe", value: "john_doe"}
    - {name: "Jane Smith", value: "jane_smith"}

# Pre-configured mappings
mappings:
  pipeline_name_to_id:
    "Backlog": "pipeline_1"
    "In Progress": "pipeline_2"
```

#### 1.2 Schema Introspection
- Cache GraphQL schema on startup
- Support schema refresh without restart
- Use schema for query validation

### 2. Data Persistence

#### 2.1 Cross-Session Persistence
- Custom tools persist across sessions
- Custom types persist across sessions  
- Storage implementation: JSON files in configurable directory for MVP
- Future enhancement: Configurable datastore adapters

#### 2.2 Context Persistence
- Context variables persist within session by default
- Optional configuration for cross-session context persistence
- Configurable per context variable or global setting

#### 2.3 File Structure (MVP)
```
data/
├── tools/
│   ├── tool_name_1.json
│   └── tool_name_2.json
├── types/
│   ├── type_name_1.json
│   └── type_name_2.json
└── context/
    └── persistent_context.json (if enabled)
```

### 3. Error Handling

#### 3.1 GraphQL Errors
- Return both GraphQL and HTTP errors
- Include query and variables in error context
- Provide actionable error messages

#### 3.2 Tool Creation Errors
- Validate tool definitions before creation
- Provide specific validation error messages
- Prevent creation of invalid tools

## Non-Functional Requirements

### 1. Performance
- Query response time under 5 seconds for typical queries
- Pagination should handle large result sets efficiently
- Schema caching to avoid repeated introspection calls

### 2. Security
- Support standard GraphQL authentication methods
- Validate all user inputs
- Prevent GraphQL injection attacks
- Rate limiting for query execution

### 3. Reliability
- Graceful handling of network failures
- Proper connection management
- Retry logic for transient failures

### 4. Usability
- Clear, descriptive error messages
- Consistent naming conventions
- Intuitive parameter structures
- Comprehensive tool descriptions

### 5. MCP Protocol Compliance
- **Tool Capability Declaration**: Server must declare `listChanged: true` in capabilities
- **List Change Notifications**: Emit list changed notifications when:
  - Tools are created via `create_saved_query_tool`
  - Tools are updated via `update_saved_tool`
  - Tools are deleted via `delete_saved_tool`
- **Requirements**: Ensure MCP clients receive immediate updates about tool availability changes

## User Workflows

### 1. Initial Setup Workflow
1. Agent calls `list_graphql_context()` to understand available context
2. Agent sets additional context via `set_graphql_context()` if needed
3. Agent explores API via `execute_graphql_query()` with introspection queries
4. Agent creates custom types via `create_graphql_type()` for common enumerations

### 2. Tool Creation Workflow
1. Agent develops and tests query using `execute_graphql_query()`
2. Agent optionally validates query using `validate_graphql_query()`
3. Agent creates tool using `create_saved_query_tool()` with appropriate configuration
4. Agent tests new tool and updates if necessary

### 3. Daily Usage Workflow
1. Agent uses saved tools for common operations
2. Agent creates new tools for novel requirements
3. Agent manages tool library via list/delete operations
4. Agent exports useful tools for sharing or backup

## MVP vs Future Features

### Preliminary implementation (Phase 0)
- Basic GraphQL execution (`execute_graphql_query`)
- Bearer token authentication

### MVP Features (Phase 1)
- Basic tool creation (`create_saved_query_tool` with core parameters)
- Cross-session persistence (JSON file storage)
- MCP list change notifications

### Version 1.0 (Phase 2)
- Context management (`set_graphql_context`, `list_graphql_context`, `clear_graphql_context`)
- Tool management (`list_saved_tools`, `delete_saved_tool`, `describe_tool`)

### Subsequent development (Phase 3)
- Custom type system (`create_graphql_type`, etc.)
- Query validation (`validate_graphql_query`)
- Schema exploration (`get_schema_info`)

### Future Features (Phase 4+)
- Advanced pagination configuration
- Idempotency and caching
- Tool testing capabilities (`test_saved_tool`)
- Tool update capabilities (`update_saved_tool`)
- Enhanced error handling and debugging tools
- Configurable datastore adapters
- Query complexity analysis and execution timeouts
- Support for other authentication methods

## Success Criteria

1. **Functionality**: Agent can successfully execute arbitrary GraphQL queries
2. **Usability**: Agent can create and use custom tools without friction
3. **Flexibility**: System supports multiple GraphQL APIs through configuration
4. **Extensibility**: Agent can build up domain-specific tool libraries over time
5. **Reliability**: System handles errors gracefully and provides useful feedback
