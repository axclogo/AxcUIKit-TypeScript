import { JsonValidationError } from './errors.js';
import type { JsonContent, JsonIssue, JsonValue, JsonPath } from './types.js';

function isPlainObject(value: unknown): value is object {
	if (value === null || typeof value !== 'object') return false;
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function inspect(value: unknown, path: JsonPath, ancestors: Set<object>, issues: JsonIssue[]): void {
	if (value === null || typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value)) return;
	if (typeof value !== 'object' || ancestors.has(value) || (!Array.isArray(value) && !isPlainObject(value))) {
		issues.push({ code: 'invalid_value', path, params: {} });
		return;
	}

	ancestors.add(value);
	if (Array.isArray(value)) {
		for (const [index, item] of value.entries()) inspect(item, [...path, index], ancestors, issues);
	} else {
		for (const [key, item] of Object.entries(value)) inspect(item, [...path, key], ancestors, issues);
	}
	ancestors.delete(value);
}

/** Returns the input JSON value after checking all descendants. Throws JsonValidationError for invalid data. */
export function parseJsonValue(value: unknown): JsonValue {
	const issues: JsonIssue[] = [];
	inspect(value, [], new Set(), issues);
	if (issues.length > 0) throw new JsonValidationError(issues);
	return value as JsonValue;
}

/** Parses explicit value or text content. Throws JsonValidationError for malformed JSON or values outside finite JSON data. */
export function parseJsonContent(content: JsonContent): JsonValue {
	if (content.kind === 'value') return parseJsonValue(content.value);

	let value: unknown;
	try {
		value = JSON.parse(content.text);
	} catch (error) {
		if (!(error instanceof SyntaxError)) throw error;
		throw new JsonValidationError([{ code: 'invalid_json', path: [], params: {} }]);
	}
	return parseJsonValue(value);
}
