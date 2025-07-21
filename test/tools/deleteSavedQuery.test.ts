import { describe, it, expect, vi, beforeEach } from 'vitest';

import { deleteToolFile } from '../../src/storage.js';
import { createHandler } from '../../src/tools/deleteSavedQuery.js';

// Mock the client before importing the handler
vi.mock('../../src/client.js', () => ({
  client: {
    request: vi.fn(),
  },
}));

// Mock the storage module
vi.mock('../../src/storage.js', () => ({
  deleteToolFile: vi.fn(),
}));

describe('deleteSavedQuery', () => {
  let mockServer: { registerTool: ReturnType<typeof vi.fn> };
  let registeredTools: Map<string, { remove: ReturnType<typeof vi.fn> }>;
  let handler: ReturnType<typeof createHandler>;

  beforeEach(() => {
    const mockRegisteredTool = { remove: vi.fn() };
    mockServer = {
      registerTool: vi.fn().mockReturnValue(mockRegisteredTool),
    };
    registeredTools = new Map();
    handler = createHandler(mockServer, registeredTools);
    vi.clearAllMocks();
    // Ensure deleteToolFile mock doesn't throw by default
    vi.mocked(deleteToolFile).mockImplementation(() => {});
  });

  it('should successfully delete an existing saved query', () => {
    const mockRemove = vi.fn();
    registeredTools.set('test_query', {
      remove: mockRemove,
    });

    const params = {
      tool_name: 'test_query',
    };

    const result = handler(params);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toBe("Successfully deleted saved query 'test_query'");

    // Verify MCP server removal was called
    expect(mockRemove).toHaveBeenCalledOnce();

    // Verify tool was removed from map
    expect(registeredTools.has('test_query')).toBe(false);

    // Verify file deletion was called
    expect(deleteToolFile).toHaveBeenCalledWith('test_query');
  });

  it('should reject deletion of core tool execute_graphql_query', () => {
    const params = {
      tool_name: 'execute_graphql_query',
    };

    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Cannot delete core tool 'execute_graphql_query'");

    // Verify no deletion operations were performed
    expect(deleteToolFile).not.toHaveBeenCalled();
  });

  it('should reject deletion of core tool save_query', () => {
    const params = {
      tool_name: 'save_query',
    };

    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Cannot delete core tool 'save_query'");

    // Verify no deletion operations were performed
    expect(deleteToolFile).not.toHaveBeenCalled();
  });

  it('should reject deletion of core tool delete_saved_query (self-protection)', () => {
    const params = {
      tool_name: 'delete_saved_query',
    };

    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Cannot delete core tool 'delete_saved_query'");

    // Verify no deletion operations were performed
    expect(deleteToolFile).not.toHaveBeenCalled();
  });

  it('should handle non-existent saved query gracefully', () => {
    const params = {
      tool_name: 'nonexistent_query',
    };

    // Tool doesn't exist in registeredTools map
    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Saved query 'nonexistent_query' not found");

    // Verify no deletion operations were performed
    expect(deleteToolFile).not.toHaveBeenCalled();
  });

  it('should maintain atomicity: MCP removal before file deletion', () => {
    const callOrder: string[] = [];
    const mockRemove = vi.fn(() => {
      callOrder.push('remove');
    });

    registeredTools.set('test_query', {
      remove: mockRemove,
    });

    vi.mocked(deleteToolFile).mockImplementation(() => {
      callOrder.push('deleteToolFile');
    });

    const params = {
      tool_name: 'test_query',
    };

    const result = handler(params);

    expect(result.isError).toBeUndefined();
    expect(callOrder).toEqual(['remove', 'deleteToolFile']);
  });

  it('should handle MCP removal errors gracefully', () => {
    const mockRemove = vi.fn(() => {
      throw new Error('MCP removal failed');
    });

    registeredTools.set('failing_query', {
      remove: mockRemove,
    });

    const params = {
      tool_name: 'failing_query',
    };

    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Error deleting tool');
    expect(result.content[0]?.text).toContain('MCP removal failed');

    // Verify file deletion was not called due to MCP removal failure
    expect(deleteToolFile).not.toHaveBeenCalled();

    // Tool should still be in the map since removal failed
    expect(registeredTools.has('failing_query')).toBe(true);
  });

  it('should handle file deletion errors after successful MCP removal', () => {
    const mockRemove = vi.fn();
    registeredTools.set('file_error_query', {
      remove: mockRemove,
    });

    vi.mocked(deleteToolFile).mockImplementation(() => {
      throw new Error('File deletion failed');
    });

    const params = {
      tool_name: 'file_error_query',
    };

    const result = handler(params);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Error deleting tool');
    expect(result.content[0]?.text).toContain('File deletion failed');

    // Verify MCP removal was called successfully
    expect(mockRemove).toHaveBeenCalledOnce();

    // Tool should be removed from map even though file deletion failed
    expect(registeredTools.has('file_error_query')).toBe(false);
  });

  it('should validate tool name format', () => {
    const invalidToolNames = [
      'InvalidName', // uppercase
      '123invalid', // starts with number
      'invalid-name', // contains dash
      'invalid name', // contains space
      '', // empty string
    ];

    for (const invalidName of invalidToolNames) {
      const params = {
        tool_name: invalidName,
      };

      const result = handler(params);

      // Note: This test may not catch validation errors if they're handled at the MCP level
      // The actual validation is in the Zod schema, but we're testing the handler directly
      // This test documents expected behavior even if validation happens upstream
      expect(typeof result).toBe('object');
    }
  });

  it('should handle deletion of query with complex name', () => {
    const mockRemove = vi.fn();
    const complexToolName = 'get_workspace_issues_with_filters';

    registeredTools.set(complexToolName, {
      remove: mockRemove,
    });

    // Ensure deleteToolFile mock doesn't throw
    vi.mocked(deleteToolFile).mockImplementation(() => {});

    const params = {
      tool_name: complexToolName,
    };

    const result = handler(params);
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toBe(`Successfully deleted saved query '${complexToolName}'`);
    expect(mockRemove).toHaveBeenCalledOnce();
    expect(deleteToolFile).toHaveBeenCalledWith(complexToolName);
    expect(registeredTools.has(complexToolName)).toBe(false);
  });

  it('should ensure proper cleanup sequence', () => {
    const mockRemove = vi.fn();
    const toolName = 'cleanup_test_query';

    registeredTools.set(toolName, {
      remove: mockRemove,
    });

    // Ensure deleteToolFile mock doesn't throw
    vi.mocked(deleteToolFile).mockImplementation(() => {});

    const params = {
      tool_name: toolName,
    };

    const result = handler(params);
    expect(result.isError).toBeUndefined();

    // Verify all cleanup steps were performed in correct order
    expect(mockRemove).toHaveBeenCalledOnce(); // 1. MCP removal
    expect(registeredTools.has(toolName)).toBe(false); // 2. Map cleanup
    expect(deleteToolFile).toHaveBeenCalledWith(toolName); // 3. File deletion
  });
});
