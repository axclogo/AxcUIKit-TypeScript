import type { AxcConditionCatalog, AxcSchema, ConditionField } from './types.js';
import { operatorsFor } from './operators.js';
import { checkCatalog, sameType } from './catalog.js';
import { fieldRefOnly } from './condition.js';

/** Builds an object schema that requires every listed property and forbids extra ones. */
export function closedObject(properties: Record<string, unknown>, required = Object.keys(properties)): AxcSchema {
	return { type: 'object', properties, required, additionalProperties: false };
}

const NON_BLANK = { type: 'string', pattern: '\\S' };

const optionSchema = (field: ConditionField): AxcSchema => {
	const values = (field.values ?? []).filter((option) => !option.disabled).map((option) => option.value);
	return values.length ? { type: 'string', enum: values } : { not: {} };
};

function itemSchema(field: ConditionField): AxcSchema {
	if (field.values !== undefined) return optionSchema(field);
	switch (field.dataType) {
		case 'number':
			return { type: 'number' };
		case 'boolean':
			return { type: 'boolean' };
		case 'date':
			return { type: 'string', format: 'date' };
		case 'datetime':
			return { type: 'string', format: 'date-time' };
		default:
			return NON_BLANK;
	}
}

/**
 * `$defs` entries `<prefix>1` … `<prefix>N`, one group schema per depth (JSON Schema has no depth counter).
 * Each depth accepts `rule` or the next depth's group; the deepest accepts only `rule`.
 */
export function groupDefs(prefix: string, catalog: AxcConditionCatalog, rule: AxcSchema): Record<string, AxcSchema> {
	const maxLevels = checkCatalog(catalog);
	const defs: Record<string, AxcSchema> = {};
	for (let depth = 1; depth <= maxLevels; depth++)
		defs[`${prefix}${depth}`] = closedObject({
			combinator: { enum: ['and', 'or'] },
			not: catalog.allowNot === false ? { const: false } : { type: 'boolean' },
			rules: {
				type: 'array',
				minItems: 1,
				items: { anyOf: [rule, ...(depth < maxLevels ? [{ $ref: `#/$defs/${prefix}${depth + 1}` }] : [])] },
			},
		});
	return defs;
}

/**
 * JSON Schema (2020-12) for conditions over `catalog`, built from the same operator list as the parser.
 * It is meant for constraining model output. It cannot express range order, regex syntax, calendar
 * validity or datetime offsets, so a schema-valid value must still go through `parseCondition`.
 * Throws `TypeError` for a broken catalog.
 */
export function conditionSchema(catalog: AxcConditionCatalog): AxcSchema {
	const enabled = catalog.fields.filter((field) => !field.disabled);
	const variants = enabled.flatMap((field) =>
		operatorsFor(field).flatMap((operator) => {
			const item = itemSchema(field);
			const shape = operator.valueShape;
			const value: AxcSchema =
				shape === 'none'
					? { type: 'null' }
					: shape === 'scalar'
						? item
						: shape === 'range'
							? { type: 'array', items: item, minItems: 2, maxItems: 2 }
							: { type: 'array', items: item, minItems: 1, uniqueItems: true };
			const props = { field: { const: field.name }, operator: { const: operator.name }, value };
			const result = fieldRefOnly(field, operator) ? [] : [closedObject(props)];
			if (field.valueSources?.includes('field') && shape !== 'none') {
				const targets = enabled.filter((other) => sameType(other, field)).map((other) => other.name);
				result.push(closedObject({ ...props, valueSource: { const: 'field' }, value: { enum: targets } }));
			}
			return result;
		}),
	);
	const $defs = {
		rule: variants.length ? { anyOf: variants } : false,
		...groupDefs('group', catalog, { $ref: '#/$defs/rule' }),
	};
	return { $schema: 'https://json-schema.org/draft/2020-12/schema', $ref: '#/$defs/group1', $defs };
}
