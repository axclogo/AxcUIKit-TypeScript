import type { ConditionField, ConditionOperator } from './types.js';

const op = (name: string, valueShape: ConditionOperator['valueShape'] = 'scalar'): ConditionOperator => ({
	name,
	valueShape,
});
const empty = [op('null', 'none'), op('notNull', 'none')];
const equality = [op('='), op('!=')];
const membership = [op('in', 'list'), op('notIn', 'list')];
const ordered = [...equality, op('>'), op('>='), op('<'), op('<='), op('between', 'range'), op('notBetween', 'range')];
const text = [
	...equality,
	op('contains'),
	op('doesNotContain'),
	op('beginsWith'),
	op('endsWith'),
	op('regex'),
	op('notRegex'),
	...membership,
];

/** Operators whose scalar value must compile as a JavaScript `RegExp`. */
export const REGEX_OPERATORS: readonly string[] = ['regex', 'notRegex'];

/**
 * Operators offered for a field: `field.operators` if declared, otherwise the built-ins for its data type.
 * Built-in operators have no `label`; the UI takes labels from the locale.
 * The editor, `conditionSchema` and `parseCondition` all use this list, so they cannot drift apart.
 */
export function operatorsFor(field: ConditionField): ConditionOperator[] {
	if (field.operators) return field.operators;
	switch (field.dataType) {
		case 'number':
			return [...ordered, op('isZero', 'none'), op('isNotZero', 'none'), ...empty];
		case 'date':
		case 'datetime':
			return [...ordered, ...empty];
		case 'boolean':
			return [...equality, ...empty];
		case 'enum':
			return [...equality, ...membership, ...empty];
		case 'array':
			return field.values !== undefined
				? [op('hasAny', 'list'), op('hasAll', 'list'), op('hasNone', 'list'), ...empty]
				: [op('contains'), op('doesNotContain'), ...empty];
		default:
			return [...text, ...empty];
	}
}
