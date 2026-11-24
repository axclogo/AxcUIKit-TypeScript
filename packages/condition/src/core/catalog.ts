import type { AxcConditionCatalog, ConditionField } from './types.js';

/** Default for `AxcConditionCatalog.maxLevels`. */
export const DEFAULT_MAX_LEVELS = 5;

const STRING_TYPES = ['string', 'enum', 'array'];

/** Field references require both fields to have the same `dataType` (missing means `string`). */
export const sameType = (a: ConditionField, b: ConditionField) => (a.dataType ?? 'string') === (b.dataType ?? 'string');

/** The value type a field's values must have. */
export function valueType(field: ConditionField): 'number' | 'boolean' | 'string' {
	return field.dataType === 'number' || field.dataType === 'boolean' ? field.dataType : 'string';
}

/**
 * Checks host configuration and returns the effective max depth.
 * A broken catalog is a programming error, so it throws `TypeError` instead of reporting issues.
 */
export function checkCatalog({ fields, maxLevels = DEFAULT_MAX_LEVELS }: AxcConditionCatalog): number {
	if (!Number.isSafeInteger(maxLevels) || maxLevels < 1)
		throw new TypeError(`maxLevels must be a positive integer, got ${maxLevels}`);
	const names = new Set<string>();
	for (const field of fields) {
		if (names.has(field.name)) throw new TypeError(`Duplicate field name "${field.name}"`);
		names.add(field.name);
		if (field.values !== undefined && !STRING_TYPES.includes(field.dataType ?? 'string'))
			throw new TypeError(
				`Field "${field.name}": values are strings and cannot be declared on dataType "${field.dataType}"`,
			);
	}
	return maxLevels;
}
