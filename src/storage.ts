import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

import { SavedToolConfig } from './types.js';

const DATA_DIR = './data';
const TOOLS_DIR = join(DATA_DIR, 'tools');
const TYPES_DIR = join(DATA_DIR, 'types');

export function ensureDataDirectory(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(TOOLS_DIR)) {
    mkdirSync(TOOLS_DIR, { recursive: true });
  }
  if (!existsSync(TYPES_DIR)) {
    mkdirSync(TYPES_DIR, { recursive: true });
  }
}

export function saveToolToFile(toolName: string, config: SavedToolConfig): void {
  ensureDataDirectory();
  
  const filePath = join(TOOLS_DIR, `${toolName}.json`);
  
  try {
    const jsonData = JSON.stringify(config, null, 2);
    writeFileSync(filePath, jsonData, 'utf8');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to save tool '${toolName}' to file: ${errorMessage}`);
  }
}

export function loadToolFromFile(toolName: string): SavedToolConfig | null {
  const filePath = join(TOOLS_DIR, `${toolName}.json`);
  
  if (!existsSync(filePath)) {
    return null;
  }
  
  try {
    const jsonData = readFileSync(filePath, 'utf8');
    const config = JSON.parse(jsonData) as SavedToolConfig;
    
    if (!isValidToolConfig(config)) {
      throw new Error(`Invalid tool configuration in file: ${filePath}`);
    }
    
    return config;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load tool '${toolName}' from file: ${errorMessage}`);
  }
}

export function loadAllTools(): Map<string, SavedToolConfig> {
  const tools = new Map<string, SavedToolConfig>();
  
  if (!existsSync(TOOLS_DIR)) {
    return tools;
  }
  
  try {
    const files = readdirSync(TOOLS_DIR);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const toolName = file.replace('.json', '');
        const config = loadToolFromFile(toolName);
        
        if (config) {
          tools.set(toolName, config);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load tools from directory: ${errorMessage}`);
  }
  
  return tools;
}

export function deleteToolFile(toolName: string): void {
  const filePath = join(TOOLS_DIR, `${toolName}.json`);
  
  if (!existsSync(filePath)) {
    return;
  }
  
  try {
    unlinkSync(filePath);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete tool file '${toolName}': ${errorMessage}`);
  }
}

function isValidToolConfig(config: any): config is SavedToolConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof config.name === 'string' &&
    typeof config.description === 'string' &&
    typeof config.graphql_query === 'string' &&
    typeof config.parameter_schema === 'object' &&
    Array.isArray(config.variables) &&
    config.variables.every((v: any) => typeof v === 'string')
  );
}
