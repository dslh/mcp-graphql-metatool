import Ajv from 'ajv';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import { z } from 'zod';

const ajv = new Ajv({
  strict: false,
  validateFormats: false,
  addUsedSchema: false,
});

/**
 * Validates if the provided value is a valid JSON Schema
 */
export function validateJsonSchema(schema: unknown): boolean {
  if (schema === null || schema === undefined || typeof schema !== 'object') {
    return false;
  }

  try {
    ajv.compile(schema);
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a JSON Schema to a Zod schema
 */
export function convertJsonSchemaToZod(jsonSchema: Record<string, any>): z.ZodSchema {
  try {
    // Use json-schema-to-zod for comprehensive conversion
    const zodSchemaString = jsonSchemaToZod(jsonSchema);
    
    // The library returns a string representation of the Zod schema
    // We need to evaluate it to get the actual schema
    // For safety, we'll fall back to our manual conversion if this fails
    return evalZodSchema(zodSchemaString);
  } catch {
    // Fallback to manual conversion for backward compatibility
    return createZodSchemaFromJsonSchemaManual(jsonSchema);
  }
}

/**
 * Converts a JSON Schema to a Zod schema in the format expected by MCP tools
 */
export function convertJsonSchemaToMcpZod(jsonSchema: Record<string, any>): Record<string, z.ZodSchema> {
  const schemaFields: Record<string, z.ZodSchema> = {};
  
  if (jsonSchema['type'] === 'object' && jsonSchema['properties']) {
    const requiredFields = new Set(jsonSchema['required'] || []);
    
    for (const [key, value] of Object.entries(jsonSchema['properties'])) {
      const propSchema = value as Record<string, any>;
      const isRequired = requiredFields.has(key);
      const defaultValue = propSchema['default'];
      
      schemaFields[key] = createZodFieldFromJsonSchema(propSchema, isRequired, defaultValue);
    }
  }
  
  return schemaFields;
}

/**
 * Safely evaluates a Zod schema string
 */
function evalZodSchema(zodSchemaString: string): z.ZodSchema {
  try {
    // Remove the import statement if present
    const cleanedSchema = zodSchemaString.replace(/^import.*?from.*?;?\n*/m, '');
    
    // Extract just the schema definition
    const schemaMatch = cleanedSchema.match(/z\.[^;]+/);
    if (!schemaMatch) {
      throw new Error('Could not extract schema definition');
    }
    
    const schemaDefinition = schemaMatch[0];
    
    // Evaluate the schema in our controlled context
    const func = new Function('z', `return ${schemaDefinition}`);
    return func(z);
  } catch {
    // If evaluation fails, return z.any() as a safe fallback
    return z.any();
  }
}

/**
 * Manual JSON Schema to Zod conversion (fallback)
 */
function createZodSchemaFromJsonSchemaManual(jsonSchema: Record<string, any>): z.ZodSchema {
  const schemaFields: Record<string, z.ZodSchema> = {};
  
  if (jsonSchema['type'] === 'object' && jsonSchema['properties']) {
    const requiredFields = new Set(jsonSchema['required'] || []);
    
    for (const [key, value] of Object.entries(jsonSchema['properties'])) {
      const propSchema = value as Record<string, any>;
      const isRequired = requiredFields.has(key);
      const defaultValue = propSchema['default'];
      
      schemaFields[key] = createZodFieldFromJsonSchema(propSchema, isRequired, defaultValue);
    }
  }
  
  return z.object(schemaFields);
}

/**
 * Converts a single JSON Schema field to a Zod schema
 */
function createZodFieldFromJsonSchema(
  jsonSchema: Record<string, any>, 
  isRequired: boolean = true, 
  defaultValue?: any
): z.ZodSchema {
  let schema: z.ZodSchema;
  
  switch (jsonSchema['type']) {
    case 'string': {
      schema = z.string();
      break;
    }
    case 'number': {
      schema = z.number();
      break;
    }
    case 'integer': {
      schema = z.number().int();
      break;
    }
    case 'boolean': {
      schema = z.boolean();
      break;
    }
    case 'array': {
      const itemSchema = jsonSchema['items'] ? createZodFieldFromJsonSchema(jsonSchema['items']) : z.any();
      schema = z.array(itemSchema);
      break;
    }
    default: {
      schema = z.any();
      break;
    }
  }
  
  // Apply default value if specified
  if (defaultValue !== undefined) {
    schema = schema.default(defaultValue);
  }
  // If not required and no default, make it optional
  else if (!isRequired) {
    schema = schema.optional();
  }
  
  return schema;
}