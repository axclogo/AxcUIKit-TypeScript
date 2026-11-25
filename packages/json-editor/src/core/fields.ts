import { JsonConfigurationError } from './errors.js';
import type { JsonFieldDefinition, JsonPath } from './types.js';

export function checkFields(field: JsonFieldDefinition | undefined, hasFileSlot: boolean, path: JsonPath = []) {
	if (!field) return;
	if (field.type === 'file' && !hasFileSlot)
		throw new JsonConfigurationError([{ code: 'missing_file_slot', path, params: { slot: 'FileInput' } }]);
	const names = new Set<string>();
	for (const child of field.fields ?? []) {
		const location = [...path, 'fields', child.name];
		if (names.has(child.name))
			throw new JsonConfigurationError([{ code: 'duplicate_field', path: location, params: { name: child.name } }]);
		names.add(child.name);
		checkFields(child, hasFileSlot, location);
	}
	if (field.items) checkFields(field.items, hasFileSlot, [...path, 'items']);
	if (typeof field.additionalProperties === 'object')
		checkFields(field.additionalProperties, hasFileSlot, [...path, 'additionalProperties']);
}
