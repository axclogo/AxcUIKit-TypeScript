import type { AxcRule, ConditionField, ConditionOperator } from '../core/types.js';
import type { AxcLocale } from '../core/locale.js';
import { operatorsFor } from '../core/operators.js';
import { fieldRefOnly } from '../core/condition.js';

/** Draft value after picking a field or operator. Numbers start blank (not 0); booleans start false. */
export function initialValue(field: ConditionField, operator: ConditionOperator): unknown {
	if (operator.valueShape === 'none') return null;
	if (operator.valueShape === 'list') return [];
	if (operator.valueShape === 'range') return ['', ''];
	return field.dataType === 'boolean' ? false : '';
}

/** A fresh rule for `field` using its first operator, as a draft. */
export function ruleFor(field: ConditionField, operator = operatorsFor(field)[0]): AxcRule {
	return fieldRefOnly(field, operator)
		? { field: field.name, operator: operator.name, value: '', valueSource: 'field' }
		: { field: field.name, operator: operator.name, value: initialValue(field, operator) };
}

export function operatorLabel(field: ConditionField, operator: ConditionOperator, locale: AxcLocale): string {
	return (
		operator.label ??
		(field.dataType === 'array' ? locale.operators[`array.${operator.name}`] : undefined) ??
		locale.operators[operator.name] ??
		operator.name
	);
}
