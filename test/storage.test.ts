import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SavedToolConfig } from '../src/types.js';

// Mock Node.js fs and path modules
vi.mock('node:fs', async (importOriginal) => {
  const mocks = {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(),
  };
  return {
    ...mocks,
    default: mocks,
  };
});

vi.mock('node:path', async (importOriginal) => {
  const mocks = {
    join: vi.fn((...paths: string[]) => paths.join('/')),
  };
  return {
    ...mocks,
    default: mocks,
  };
});

// Import the mocked modules
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Import the functions to test
import {
  ensureDataDirectory,
  saveToolToFile,
  loadToolFromFile,
  loadAllTools,
  deleteToolFile,
} from '../src/storage.js';

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validToolConfig: SavedToolConfig = {
    name: 'test_tool',
    description: 'Test tool description',
    graphql_query: 'query Test($id: ID!) { test(id: $id) { name } }',
    parameter_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
    },
    variables: ['id'],
  };

  describe('ensureDataDirectory', () => {
    it('should use custom data directory from environment variable', async () => {
      vi.stubEnv('MCP_GRAPHQL_DATA_DIR', '/custom/data');
      vi.mocked(existsSync).mockReturnValue(false);

      // Clear module cache and re-import
      vi.resetModules();
      const { ensureDataDirectory: ensureDataDirectoryWithEnv } = await import('../src/storage.js');

      ensureDataDirectoryWithEnv();

      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('/custom/data');
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('/custom/data/tools');
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('/custom/data/types');
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('/custom/data', { recursive: true });
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('/custom/data/tools', { recursive: true });
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('/custom/data/types', { recursive: true });
    });

    it('should create all directories when they do not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      ensureDataDirectory();

      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('./data');
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('./data/tools');
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('./data/types');
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('./data', { recursive: true });
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('./data/tools', { recursive: true });
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('./data/types', { recursive: true });
    });

    it('should not create directories when they already exist', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      ensureDataDirectory();

      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('./data');
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('./data/tools');
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('./data/types');
      expect(vi.mocked(mkdirSync)).not.toHaveBeenCalled();
    });

    it('should create only missing directories', () => {
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === './data') return true;
        if (path === './data/tools') return false;
        if (path === './data/types') return true;
        return false;
      });

      ensureDataDirectory();

      expect(vi.mocked(mkdirSync)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('./data/tools', { recursive: true });
    });
  });

  describe('saveToolToFile', () => {
    it('should save tool config to correct file path', () => {
      vi.mocked(existsSync).mockReturnValue(true); // Directories exist

      saveToolToFile('test_tool', validToolConfig);

      expect(vi.mocked(join)).toHaveBeenCalledWith('./data/tools', 'test_tool.json');
      expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith(
        './data/tools/test_tool.json',
        JSON.stringify(validToolConfig, null, 2),
        'utf8'
      );
    });

    it('should ensure data directory exists before saving', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      saveToolToFile('test_tool', validToolConfig);

      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('./data', { recursive: true });
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('./data/tools', { recursive: true });
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('./data/types', { recursive: true });
    });

    it('should handle special characters in tool names', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      saveToolToFile('tool-with_special.chars', validToolConfig);

      expect(vi.mocked(join)).toHaveBeenCalledWith('./data/tools', 'tool-with_special.chars.json');
      expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith(
        './data/tools/tool-with_special.chars.json',
        expect.any(String),
        'utf8'
      );
    });

    it('should throw error with helpful message on write failure', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => saveToolToFile('test_tool', validToolConfig)).toThrow(
        "Failed to save tool 'test_tool' to file: Permission denied"
      );
    });

    it('should handle non-Error exceptions', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw 'String error';
      });

      expect(() => saveToolToFile('test_tool', validToolConfig)).toThrow(
        "Failed to save tool 'test_tool' to file: Unknown error"
      );
    });

    it('should format JSON with proper indentation', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFileSync).mockReturnValue(undefined); // Ensure writeFileSync doesn't throw

      saveToolToFile('test_tool', validToolConfig);

      const expectedJson = JSON.stringify(validToolConfig, null, 2);
      expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expectedJson,
        'utf8'
      );
    });
  });

  describe('loadToolFromFile', () => {
    const validJsonData = JSON.stringify(validToolConfig, null, 2);

    it('should load valid tool config from existing file', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(validJsonData);

      const result = loadToolFromFile('test_tool');

      expect(vi.mocked(join)).toHaveBeenCalledWith('./data/tools', 'test_tool.json');
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('./data/tools/test_tool.json');
      expect(vi.mocked(readFileSync)).toHaveBeenCalledWith('./data/tools/test_tool.json', 'utf8');
      expect(result).toEqual(validToolConfig);
    });

    it('should return null for non-existent files', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = loadToolFromFile('nonexistent_tool');

      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('./data/tools/nonexistent_tool.json');
      expect(readFileSync).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw error for invalid JSON syntax', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('{ invalid json }');

      expect(() => loadToolFromFile('invalid_tool')).toThrow(
        "Failed to load tool 'invalid_tool' from file:"
      );
    });

    it('should throw error for invalid tool config structure', () => {
      const invalidConfig = { name: 'test', missing: 'fields' };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(invalidConfig));

      expect(() => loadToolFromFile('invalid_tool')).toThrow(
        "Failed to load tool 'invalid_tool' from file:"
      );
    });

    it('should throw error with helpful message on read failure', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => loadToolFromFile('test_tool')).toThrow(
        "Failed to load tool 'test_tool' from file: Permission denied"
      );
    });

    it('should handle non-Error exceptions', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw 'String error';
      });

      expect(() => loadToolFromFile('test_tool')).toThrow(
        "Failed to load tool 'test_tool' from file: Unknown error"
      );
    });

    it('should validate required fields are present', () => {
      const configMissingName = { ...validToolConfig };
      delete (configMissingName as any).name;
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configMissingName));

      expect(() => loadToolFromFile('test_tool')).toThrow(
        "Invalid tool configuration in file:"
      );
    });

    it('should validate variables array contains only strings', () => {
      const configWithInvalidVariables = {
        ...validToolConfig,
        variables: ['valid', 123, 'another_valid'] // Mixed types
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configWithInvalidVariables));

      expect(() => loadToolFromFile('test_tool')).toThrow(
        "Invalid tool configuration in file:"
      );
    });
  });

  describe('loadAllTools', () => {
    const tool1Config: SavedToolConfig = {
      name: 'tool1',
      description: 'First tool',
      graphql_query: 'query Tool1 { test }',
      parameter_schema: { type: 'object', properties: {} },
      variables: [],
    };

    const tool2Config: SavedToolConfig = {
      name: 'tool2',
      description: 'Second tool',
      graphql_query: 'query Tool2($id: ID!) { test(id: $id) }',
      parameter_schema: { type: 'object', properties: { id: { type: 'string' } } },
      variables: ['id'],
    };

    it('should return empty Map when TOOLS_DIR does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = loadAllTools();

      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('./data/tools');
      expect(vi.mocked(readdirSync)).not.toHaveBeenCalled();
      expect(result).toEqual(new Map());
    });

    it('should load all valid .json files from tools directory', () => {
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === './data/tools') return true;
        if (path === './data/tools/tool1.json') return true;
        if (path === './data/tools/tool2.json') return true;
        return false;
      });
      vi.mocked(readdirSync).mockReturnValue(['tool1.json', 'tool2.json'] as any);
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (path === './data/tools/tool1.json') return JSON.stringify(tool1Config);
        if (path === './data/tools/tool2.json') return JSON.stringify(tool2Config);
        return '';
      });

      const result = loadAllTools();

      expect(vi.mocked(readdirSync)).toHaveBeenCalledWith('./data/tools');
      expect(result.size).toBe(2);
      expect(result.get('tool1')).toEqual(tool1Config);
      expect(result.get('tool2')).toEqual(tool2Config);
    });

    it('should skip non-.json files', () => {
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === './data/tools') return true;
        if (path === './data/tools/tool1.json') return true;
        return false;
      });
      vi.mocked(readdirSync).mockReturnValue(['tool1.json', 'readme.txt', 'config.yaml'] as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(tool1Config));

      const result = loadAllTools();

      expect(result.size).toBe(1);
      expect(result.get('tool1')).toEqual(tool1Config);
      expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(1);
    });

    it('should throw error when encountering invalid tool configs', () => {
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === './data/tools') return true;
        if (path === './data/tools/valid_tool.json') return true;
        if (path === './data/tools/invalid_tool.json') return true;
        return false;
      });
      vi.mocked(readdirSync).mockReturnValue(['valid_tool.json', 'invalid_tool.json'] as any);
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (path === './data/tools/valid_tool.json') return JSON.stringify(tool1Config);
        if (path === './data/tools/invalid_tool.json') return '{ "invalid": true }';
        return '';
      });

      expect(() => loadAllTools()).toThrow(
        'Failed to load tools from directory:'
      );
    });

    it('should handle empty tools directory', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([] as any);

      const result = loadAllTools();

      expect(result.size).toBe(0);
      expect(result).toEqual(new Map());
    });

    it('should throw error on directory read failure', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => loadAllTools()).toThrow(
        'Failed to load tools from directory: Permission denied'
      );
    });

    it('should handle non-Error exceptions', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        throw 'String error';
      });

      expect(() => loadAllTools()).toThrow(
        'Failed to load tools from directory: Unknown error'
      );
    });

    it('should use correct tool name from filename', () => {
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === './data/tools') return true;
        if (path === './data/tools/my-special_tool.json') return true;
        return false;
      });
      vi.mocked(readdirSync).mockReturnValue(['my-special_tool.json'] as any);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        ...tool1Config,
        name: 'my-special_tool'
      }));

      const result = loadAllTools();

      expect(result.has('my-special_tool')).toBe(true);
      expect(result.get('my-special_tool')?.name).toBe('my-special_tool');
    });
  });

  describe('deleteToolFile', () => {
    it('should delete existing tool file', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      deleteToolFile('test_tool');

      expect(vi.mocked(join)).toHaveBeenCalledWith('./data/tools', 'test_tool.json');
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('./data/tools/test_tool.json');
      expect(vi.mocked(unlinkSync)).toHaveBeenCalledWith('./data/tools/test_tool.json');
    });

    it('should not throw when file does not exist (graceful)', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      expect(() => deleteToolFile('nonexistent_tool')).not.toThrow();

      expect(vi.mocked(existsSync)).toHaveBeenCalledWith('./data/tools/nonexistent_tool.json');
      expect(vi.mocked(unlinkSync)).not.toHaveBeenCalled();
    });

    it('should throw error with helpful message on delete failure', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(unlinkSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => deleteToolFile('test_tool')).toThrow(
        "Failed to delete tool file 'test_tool': Permission denied"
      );
    });

    it('should handle non-Error exceptions', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(unlinkSync).mockImplementation(() => {
        throw 'String error';
      });

      expect(() => deleteToolFile('test_tool')).toThrow(
        "Failed to delete tool file 'test_tool': Unknown error"
      );
    });

    it('should handle special characters in tool names', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(unlinkSync).mockReturnValue(undefined); // Ensure unlinkSync doesn't throw

      deleteToolFile('tool-with_special.chars');

      expect(vi.mocked(join)).toHaveBeenCalledWith('./data/tools', 'tool-with_special.chars.json');
      expect(vi.mocked(unlinkSync)).toHaveBeenCalledWith('./data/tools/tool-with_special.chars.json');
    });
  });

  describe('isValidToolConfig (internal function)', () => {
    it('should validate valid complete tool config', () => {
      // We can't directly test the internal function, but we can test it indirectly
      // through loadToolFromFile which uses it
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validToolConfig));

      const result = loadToolFromFile('test_tool');

      expect(result).toEqual(validToolConfig);
    });

    it('should reject null input', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('null');

      expect(() => loadToolFromFile('test_tool')).toThrow(
        'Invalid tool configuration in file:'
      );
    });

    it('should reject missing name field', () => {
      const configMissingName = { ...validToolConfig };
      delete (configMissingName as any).name;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configMissingName));

      expect(() => loadToolFromFile('test_tool')).toThrow(
        'Invalid tool configuration in file:'
      );
    });

    it('should reject missing description field', () => {
      const configMissingDescription = { ...validToolConfig };
      delete (configMissingDescription as any).description;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configMissingDescription));

      expect(() => loadToolFromFile('test_tool')).toThrow(
        'Invalid tool configuration in file:'
      );
    });

    it('should reject missing graphql_query field', () => {
      const configMissingQuery = { ...validToolConfig };
      delete (configMissingQuery as any).graphql_query;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configMissingQuery));

      expect(() => loadToolFromFile('test_tool')).toThrow(
        'Invalid tool configuration in file:'
      );
    });

    it('should reject missing parameter_schema field', () => {
      const configMissingSchema = { ...validToolConfig };
      delete (configMissingSchema as any).parameter_schema;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configMissingSchema));

      expect(() => loadToolFromFile('test_tool')).toThrow(
        'Invalid tool configuration in file:'
      );
    });

    it('should reject missing variables field', () => {
      const configMissingVariables = { ...validToolConfig };
      delete (configMissingVariables as any).variables;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configMissingVariables));

      expect(() => loadToolFromFile('test_tool')).toThrow(
        'Invalid tool configuration in file:'
      );
    });

    it('should reject wrong type for name field', () => {
      const configWrongNameType = { ...validToolConfig, name: 123 };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configWrongNameType));

      expect(() => loadToolFromFile('test_tool')).toThrow(
        'Invalid tool configuration in file:'
      );
    });

    it('should reject wrong type for variables field', () => {
      const configWrongVariablesType = { ...validToolConfig, variables: 'not-an-array' };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configWrongVariablesType));

      expect(() => loadToolFromFile('test_tool')).toThrow(
        'Invalid tool configuration in file:'
      );
    });

    it('should reject variables array with non-string elements', () => {
      const configInvalidVariableElements = {
        ...validToolConfig,
        variables: ['valid', 123, null, 'another_valid']
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configInvalidVariableElements));

      expect(() => loadToolFromFile('test_tool')).toThrow(
        'Invalid tool configuration in file:'
      );
    });

    it('should accept config with optional fields', () => {
      const configWithOptionalFields: SavedToolConfig = {
        ...validToolConfig,
        pagination_config: {
          enabled: true,
          style: 'relay',
          page_size: 20,
          merge_strategy: 'concat_nodes'
        },
        idempotency: {
          enabled: true,
          cache_key_params: ['id'],
          ttl_seconds: 300
        }
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configWithOptionalFields));

      const result = loadToolFromFile('test_tool');

      expect(result).toEqual(configWithOptionalFields);
    });
  });
});