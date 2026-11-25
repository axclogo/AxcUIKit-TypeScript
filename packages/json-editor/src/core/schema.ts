import { JsonConfigurationError, JsonValidationError } from './errors.js';
import { parseJsonValue } from './parse.js';
import type { JsonFieldDefinition, JsonIssueCode, JsonObject, JsonPath, JsonValue } from './types.js';

function fail(code: JsonIssueCode, path: JsonPath, params: Record<string, string | number> = {}): never {
	throw new JsonConfigurationError([{ code, path, params }]);
}

function object(value: JsonValue | undefined, path: JsonPath): JsonObject {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('invalid_schema', path);
	return value;
}

function convert(value: JsonValue, path: JsonPath): JsonFieldDefinition {
	if (value === true) return {};
	if (value === false) fail('unsupported_schema_value', path, { value: 'false' });
	const schema = object(value, path);
	const field: JsonFieldDefinition = {};
	let required: string[] | undefined;
	for (const [keyword, item] of Object.entries(schema)) {
		const location = [...path, keyword];
		switch (keyword) {
			case '$schema':
				if (item !== 'https://json-schema.org/draft/2020-12/schema')
					fail('unsupported_schema_value', location, { keyword });
				break;
			case 'type':
				if (item === 'integer') field.type = 'number';
				else if (
					item === 'string' ||
					item === 'number' ||
					item === 'boolean' ||
					item === 'null' ||
					item === 'object' ||
					item === 'array'
				)
					field.type = item;
				else fail('unsupported_schema_value', location, { keyword });
				break;
			case 'title':
			case 'description':
				if (typeof item !== 'string') fail('invalid_schema', location);
				if (keyword === 'title') field.label = item;
				else field.description = item;
				break;
			case 'default':
				field.default = item;
				break;
			case 'format':
				if (item !== 'date' && item !== 'date-time') fail('unsupported_schema_value', location, { keyword });
				field.format = item;
				break;
			case 'enum':
				if (!Array.isArray(item) || !item.length) fail('invalid_schema', location);
				field.options = item.map((value) => ({ value }));
				break;
			case 'properties':
				field.fields = Object.entries(object(item, location)).map(([name, child]) => ({
					...convert(child, [...location, name]),
					name,
				}));
				break;
			case 'required':
				if (
					!Array.isArray(item) ||
					!item.every((name) => typeof name === 'string') ||
					new Set(item).size !== item.length
				)
					fail('invalid_schema', location);
				required = item;
				break;
			case 'items':
				field.items = convert(item, location);
				break;
			case 'additionalProperties':
				field.additionalProperties = typeof item === 'boolean' ? item : convert(item, location);
				break;
			default:
				fail('unsupported_schema_keyword', location, { keyword });
		}
	}
	if (required) {
		const fields = [...(field.fields ?? [])];
		for (const name of required) {
			const existing = fields.find((child) => child.name === name);
			if (existing) existing.required = true;
			else
				fields.push({
					...(typeof field.additionalProperties === 'object' ? field.additionalProperties : {}),
					name,
					required: true,
				});
		}
		field.fields = fields;
	}
	return field;
}

/** Converts an expanded draft 2020-12 schema to root rendering metadata, without validating instance data.
 * Throws JsonConfigurationError with schema paths for malformed data, unsupported keywords or unsupported keyword forms.
 */
export function jsonSchemaToField(schema: unknown): JsonFieldDefinition {
	let value: JsonValue;
	try {
		value = parseJsonValue(schema);
	} catch (error) {
		if (!(error instanceof JsonValidationError)) throw error;
		throw new JsonConfigurationError(error.issues.map((issue) => ({ ...issue, code: 'invalid_schema' })));
	}
	return convert(value, []);
}
