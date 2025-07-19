import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { validateJsonSchema, convertJsonSchemaToZod } from '../src/jsonSchemaValidator.js';

describe('jsonSchemaValidator', () => {
  describe('validateJsonSchema', () => {
    it('should accept valid JSON Schema objects', () => {
      const validSchemas = [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'array', items: { type: 'string' } },
        {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
        {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                profile: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      ];

      for (const schema of validSchemas) {
        expect(validateJsonSchema(schema)).toBe(true);
      }
    });

    it('should reject invalid JSON Schema values', () => {
      const invalidSchemas = [
        null,
        undefined,
        'not an object',
        123,
        true,
        [],
        { type: 'invalid_type' },
        { properties: 'should be object' },
      ];

      for (const schema of invalidSchemas) {
        expect(validateJsonSchema(schema)).toBe(false);
      }
    });

    it('should handle complex JSON Schema features', () => {
      const complexSchemas = [
        {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1 },
            age: { type: 'integer', minimum: 0 },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['name'],
        },
        {
          type: 'object',
          properties: {
            status: { enum: ['active', 'inactive'] },
          },
        },
        {
          anyOf: [{ type: 'string' }, { type: 'number' }],
        },
      ];

      for (const schema of complexSchemas) {
        expect(validateJsonSchema(schema)).toBe(true);
      }
    });
  });

  describe('convertJsonSchemaToZod', () => {
    it('should convert basic types correctly', () => {
      const stringSchema = { type: 'string' };
      const numberSchema = { type: 'number' };
      const booleanSchema = { type: 'boolean' };
      const integerSchema = { type: 'integer' };

      const stringZod = convertJsonSchemaToZod(stringSchema);
      const numberZod = convertJsonSchemaToZod(numberSchema);
      const booleanZod = convertJsonSchemaToZod(booleanSchema);
      const integerZod = convertJsonSchemaToZod(integerSchema);

      // Test that they parse valid values correctly
      expect(() => stringZod.parse('test')).not.toThrow();
      expect(() => numberZod.parse(42.5)).not.toThrow();
      expect(() => booleanZod.parse(true)).not.toThrow();
      expect(() => integerZod.parse(42)).not.toThrow();

      // Test that they reject invalid values
      expect(() => stringZod.parse(123)).toThrow();
      expect(() => numberZod.parse('not a number')).toThrow();
      expect(() => booleanZod.parse('not a boolean')).toThrow();
      expect(() => integerZod.parse(42.5)).toThrow();
    });

    it('should convert object schemas correctly', () => {
      const objectSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          active: { type: 'boolean' },
        },
      };

      const zodSchema = convertJsonSchemaToZod(objectSchema);

      const validData = { name: 'John', age: 30, active: true };
      const invalidData = { name: 123, age: 'not a number', active: 'not a boolean' };

      expect(() => zodSchema.parse(validData)).not.toThrow();
      expect(() => zodSchema.parse(invalidData)).toThrow();
    });

    it('should convert array schemas correctly', () => {
      const arraySchema = {
        type: 'array',
        items: { type: 'string' },
      };

      const zodSchema = convertJsonSchemaToZod(arraySchema);

      const validData = ['item1', 'item2', 'item3'];
      const invalidData = ['item1', 123, 'item3'];

      expect(() => zodSchema.parse(validData)).not.toThrow();
      expect(() => zodSchema.parse(invalidData)).toThrow();
    });

    it('should handle nested object schemas', () => {
      const nestedSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              profile: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  age: { type: 'number' },
                },
              },
            },
          },
        },
      };

      const zodSchema = convertJsonSchemaToZod(nestedSchema);

      const validData = {
        user: {
          id: '123',
          profile: {
            email: 'test@example.com',
            age: 25,
          },
        },
      };

      const invalidData = {
        user: {
          id: 123, // Should be string
          profile: {
            email: 'test@example.com',
            age: 'not a number', // Should be number
          },
        },
      };

      expect(() => zodSchema.parse(validData)).not.toThrow();
      expect(() => zodSchema.parse(invalidData)).toThrow();
    });

    it('should handle arrays with complex item types', () => {
      const arraySchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            value: { type: 'number' },
          },
        },
      };

      const zodSchema = convertJsonSchemaToZod(arraySchema);

      const validData = [
        { id: 'item1', value: 10 },
        { id: 'item2', value: 20 },
      ];

      const invalidData = [
        { id: 'item1', value: 10 },
        { id: 123, value: 'not a number' }, // Invalid types
      ];

      expect(() => zodSchema.parse(validData)).not.toThrow();
      expect(() => zodSchema.parse(invalidData)).toThrow();
    });

    it('should handle unsupported types gracefully', () => {
      const unsupportedSchema = { type: 'unknown_type' };
      const zodSchema = convertJsonSchemaToZod(unsupportedSchema);

      // Should fallback to z.any() and accept anything
      expect(() => zodSchema.parse('any value')).not.toThrow();
      expect(() => zodSchema.parse(123)).not.toThrow();
      expect(() => zodSchema.parse({ complex: 'object' })).not.toThrow();
    });

    it('should handle empty or malformed schemas', () => {
      const emptySchema = {};
      const malformedSchema = { properties: 'should be object' };

      const emptyZodSchema = convertJsonSchemaToZod(emptySchema);
      const malformedZodSchema = convertJsonSchemaToZod(malformedSchema);

      // Should handle gracefully without throwing
      expect(() => emptyZodSchema.parse({})).not.toThrow();
      expect(() => malformedZodSchema.parse({})).not.toThrow();
    });

    it('should handle schemas with no properties', () => {
      const schemaWithoutProperties = { type: 'object' };
      const zodSchema = convertJsonSchemaToZod(schemaWithoutProperties);

      // Should create empty object schema
      expect(() => zodSchema.parse({})).not.toThrow();
      expect(() => zodSchema.parse({ any: 'property' })).not.toThrow();
    });

    it('should handle arrays without item schema', () => {
      const arraySchemaNoItems = { type: 'array' };
      const zodSchema = convertJsonSchemaToZod(arraySchemaNoItems);

      // Should accept arrays with any items
      expect(() => zodSchema.parse([])).not.toThrow();
      expect(() => zodSchema.parse(['string', 123, true, { object: 'value' }])).not.toThrow();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle conversion errors gracefully', () => {
      // Test with a schema that might cause json-schema-to-zod to fail
      const problematicSchema = {
        type: 'object',
        properties: {
          circular: { $ref: '#' }, // Circular reference
        },
      };

      // Should not throw, but fall back to manual conversion
      const zodSchema = convertJsonSchemaToZod(problematicSchema);
      expect(zodSchema).toBeDefined();
    });

    it('should validate the converted schemas work correctly', () => {
      const testSchema = {
        type: 'object',
        properties: {
          stringField: { type: 'string' },
          numberField: { type: 'number' },
          booleanField: { type: 'boolean' },
          arrayField: {
            type: 'array',
            items: { type: 'string' },
          },
          objectField: {
            type: 'object',
            properties: {
              nestedString: { type: 'string' },
            },
          },
        },
      };

      const zodSchema = convertJsonSchemaToZod(testSchema);

      const validTestData = {
        stringField: 'test',
        numberField: 42,
        booleanField: true,
        arrayField: ['item1', 'item2'],
        objectField: {
          nestedString: 'nested',
        },
      };

      const result = zodSchema.parse(validTestData);
      expect(result).toEqual(validTestData);
    });
  });
});