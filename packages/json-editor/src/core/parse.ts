import type { JsonContent, JsonIssue, JsonObject, JsonPath } from './types.js';

/** Contains the machine-readable issues found while parsing a JSON object. */
export class JsonValidationError extends Error {
	constructor(readonly issues: readonly JsonIssue[]) {
		super(issues[0]?.code);
		this.name = 'JsonValidationError';
	}
}

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
	const descriptors = Object.getOwnPropertyDescriptors(value);
	const keys: (string | symbol)[] = Reflect.ownKeys(descriptors);
	if (Array.isArray(value)) {
		const length = value.length;
		for (let index = 0; index < length; index++) {
			const descriptor = descriptors[index];
			if (descriptor?.enumerable && 'value' in descriptor)
				inspect(descriptor.value, [...path, index], ancestors, issues);
			else issues.push({ code: 'invalid_value', path: [...path, index], params: {} });
		}
		if (keys.length > length + 1) issues.push({ code: 'invalid_value', path, params: {} });
	} else {
		for (const key of keys) {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (typeof key === 'string' && descriptor?.enumerable && 'value' in descriptor) {
				inspect(descriptor.value, [...path, key], ancestors, issues);
			} else {
				issues.push({ code: 'invalid_value', path: [...path, String(key)], params: {} });
			}
		}
	}
	ancestors.delete(value);
}

/** Returns the input JSON object after checking all descendants. Throws JsonValidationError for invalid data. */
export function parseJsonObject(value: unknown): JsonObject {
	if (!isPlainObject(value)) throw new JsonValidationError([{ code: 'expected_object', path: [], params: {} }]);
	const issues: JsonIssue[] = [];
	inspect(value, [], new Set(), issues);
	if (issues.length > 0) throw new JsonValidationError(issues);
	return value as JsonObject;
}

/** Parses explicit object or text content. Throws JsonValidationError for malformed JSON, non-object roots, or values outside finite JSON data. */
export function parseJsonContent(content: JsonContent): JsonObject {
	if (content.kind === 'object') return parseJsonObject(content.value);
	if (content.kind !== 'text' || typeof content.text !== 'string') throw new TypeError('Invalid JsonContent');

	let value: unknown;
	try {
		value = JSON.parse(content.text);
	} catch {
		throw new JsonValidationError([{ code: 'invalid_json', path: [], params: {} }]);
	}
	return parseJsonObject(value);
}
