import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock the imported modules
vi.mock('../src/dynamicToolHandler.js', () => ({
  registerAllTools: vi.fn(() => new Map()),
}));

vi.mock('../src/storage.js', () => ({
  ensureDataDirectory: vi.fn(),
}));

// Mock the tool modules
vi.mock('../src/tools/executeGraphqlQuery.js', () => ({
  name: 'execute_graphql_query',
  config: { title: 'Execute GraphQL Query' },
  handler: vi.fn(),
}));

vi.mock('../src/tools/saveQuery.js', () => ({
  name: 'save_query',
  config: { title: 'Save Query' },
  handler: vi.fn(),
}));

vi.mock('../src/tools/deleteSavedQuery.js', () => ({
  name: 'delete_saved_query',
  config: { title: 'Delete Saved Query' },
  handler: vi.fn(),
}));

vi.mock('../src/tools/listSavedQueries.js', () => ({
  name: 'list_saved_queries',
  config: { title: 'List Saved Queries' },
  handler: vi.fn(),
}));

vi.mock('../src/tools/showSavedQuery.js', () => ({
  name: 'show_saved_query',
  config: { title: 'Show Saved Query' },
  handler: vi.fn(),
}));

describe('server', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let registeredTools: string[];

  // Mock McpServer.registerTool to track registered tools
  const mockRegisterTool = vi.fn((name: string) => {
    registeredTools.push(name);
  });

  beforeEach(() => {
    originalEnv = { ...process.env };
    registeredTools = [];
    vi.clearAllMocks();

    // Mock McpServer constructor and methods
    vi.spyOn(McpServer.prototype, 'registerTool').mockImplementation(mockRegisterTool);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('DISABLE_CORE_TOOLS environment variable', () => {
    it('should register all core tools when DISABLE_CORE_TOOLS is not set', async () => {
      delete process.env.DISABLE_CORE_TOOLS;

      // Clear module cache and re-import to apply env changes
      vi.resetModules();
      const { server, coreToolsStatus } = await import('../src/server.js');

      expect(coreToolsStatus).toBe('all core tools enabled');
      expect(registeredTools).toContain('execute_graphql_query');
      expect(registeredTools).toContain('save_query');
      expect(registeredTools).toContain('delete_saved_query');
      expect(registeredTools).toContain('list_saved_queries');
      expect(registeredTools).toContain('show_saved_query');
      expect(registeredTools).toHaveLength(5);
    });

    it('should register all core tools when DISABLE_CORE_TOOLS is "none"', async () => {
      process.env.DISABLE_CORE_TOOLS = 'none';

      vi.resetModules();
      const { server, coreToolsStatus } = await import('../src/server.js');

      expect(coreToolsStatus).toBe('all core tools enabled');
      expect(registeredTools).toContain('execute_graphql_query');
      expect(registeredTools).toContain('save_query');
      expect(registeredTools).toContain('delete_saved_query');
      expect(registeredTools).toContain('list_saved_queries');
      expect(registeredTools).toContain('show_saved_query');
      expect(registeredTools).toHaveLength(5);
    });

    it('should only register execute_graphql_query when DISABLE_CORE_TOOLS is "management"', async () => {
      process.env.DISABLE_CORE_TOOLS = 'management';

      vi.resetModules();
      const { server, coreToolsStatus } = await import('../src/server.js');

      expect(coreToolsStatus).toBe('management tools disabled, execute_graphql_query enabled');
      expect(registeredTools).toContain('execute_graphql_query');
      expect(registeredTools).not.toContain('save_query');
      expect(registeredTools).not.toContain('delete_saved_query');
      expect(registeredTools).not.toContain('list_saved_queries');
      expect(registeredTools).not.toContain('show_saved_query');
      expect(registeredTools).toHaveLength(1);
    });

    it('should register no core tools when DISABLE_CORE_TOOLS is "all"', async () => {
      process.env.DISABLE_CORE_TOOLS = 'all';

      vi.resetModules();
      const { server, coreToolsStatus } = await import('../src/server.js');

      expect(coreToolsStatus).toBe('all core tools disabled');
      expect(registeredTools).not.toContain('execute_graphql_query');
      expect(registeredTools).not.toContain('save_query');
      expect(registeredTools).not.toContain('delete_saved_query');
      expect(registeredTools).not.toContain('list_saved_queries');
      expect(registeredTools).not.toContain('show_saved_query');
      expect(registeredTools).toHaveLength(0);
    });

    it('should handle uppercase DISABLE_CORE_TOOLS values', async () => {
      process.env.DISABLE_CORE_TOOLS = 'MANAGEMENT';

      vi.resetModules();
      const { server, coreToolsStatus } = await import('../src/server.js');

      expect(coreToolsStatus).toBe('management tools disabled, execute_graphql_query enabled');
      expect(registeredTools).toContain('execute_graphql_query');
      expect(registeredTools).toHaveLength(1);
    });

    it('should handle mixed case DISABLE_CORE_TOOLS values', async () => {
      process.env.DISABLE_CORE_TOOLS = 'All';

      vi.resetModules();
      const { server, coreToolsStatus } = await import('../src/server.js');

      expect(coreToolsStatus).toBe('all core tools disabled');
      expect(registeredTools).toHaveLength(0);
    });

    it('should default to all tools enabled for invalid DISABLE_CORE_TOOLS values', async () => {
      process.env.DISABLE_CORE_TOOLS = 'invalid';

      vi.resetModules();
      const { server, coreToolsStatus } = await import('../src/server.js');

      expect(coreToolsStatus).toBe('all core tools enabled');
      expect(registeredTools).toHaveLength(5);
    });
  });
});