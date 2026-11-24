import type { AxcConditionCatalog, AxcConditionValue, ConditionField, ConditionOperator } from './types.js';
import { REGEX_OPERATORS, operatorsFor } from './operators.js';
import { checkCatalog, sameType, valueType } from './catalog.js';
import { timestamp, validDate } from './date-time.js';
import { checkObject, collect, ensureValid, isObject, type AxcIssue, type AxcPath, type Report } from './issues.js';

export interface AxcConditionOptions {
	/** Accept a root group with no rules. Nested groups must never be empty. Default false. */
	allowEmpty?: boolean;
}

/** An empty root group. It is a valid draft for the editor but fails validation unless `allowEmpty` is set. */
export const emptyCondition = (): AxcConditionValue => ({ combinator: 'and', not: false, rules: [] });

/** True when the field accepts only field references for operators that take a value. */
export const fieldRefOnly = (field: ConditionField, operator: ConditionOperator) =>
	operator.valueShape !== 'none' && field.valueSources?.length === 1 && field.valueSources[0] === 'field';

function checkItem(item: unknown, field: ConditionField, operator: ConditionOperator, path: AxcPath, report: Report) {
	const expected = valueType(field);
	if (typeof item !== expected || (typeof item === 'number' && !Number.isFinite(item)))
		return (report({ code: 'type', path, params: { expected } }), false);
	if (typeof item !== 'string') return true;
	if (!item.trim()) return (report({ code: 'required', path }), false);
	if (field.values !== undefined && !field.values.some((option) => !option.disabled && option.value === item))
		return (report({ code: 'option', path, params: { value: item } }), false);
	if (field.dataType === 'date' && !validDate(item)) return (report({ code: 'date', path }), false);
	if (field.dataType === 'datetime' && !Number.isFinite(timestamp(item)))
		return (report({ code: 'datetime', path }), false);
	if (REGEX_OPERATORS.includes(operator.name))
		try {
			new RegExp(item);
		} catch {
			return (report({ code: 'regex', path }), false);
		}
	return true;
}

function checkValue(value: unknown, field: ConditionField, operator: ConditionOperator, path: AxcPath, report: Report) {
	const shape = operator.valueShape;
	if (shape === 'none') {
		if (value !== null) report({ code: 'type', path, params: { expected: 'null' } });
		return;
	}
	if (shape === 'scalar') return void checkItem(value, field, operator, path, report);
	if (!Array.isArray(value)) return report({ code: 'type', path, params: { expected: 'array' } });
	if (!value.length) return report({ code: 'empty', path });
	if (shape === 'range' && value.length !== 2) return report({ code: 'rangeLength', path });
	let valid = true;
	value.forEach((item, index) => {
		if (!checkItem(item, field, operator, [...path, index], report)) valid = false;
		else if (shape === 'list' && value.indexOf(item) !== index)
			report({ code: 'duplicate', path: [...path, index], params: { value: String(item) } });
	});
	if (shape === 'range' && valid) {
		const [from, to] = field.dataType === 'datetime' ? value.map((item) => timestamp(item)) : value;
		if (from > to) report({ code: 'rangeOrder', path });
	}
}

/**
 * Returns every problem in `value` (an empty array means valid). Never throws for bad values;
 * throws `TypeError` only for a broken catalog. Use this to show errors while editing.
 *
 * Checked: group shape, depth (`maxLevels`), `allowNot`, empty groups, known and enabled fields,
 * operators from `operatorsFor`, value shape and type, option membership, calendar dates,
 * datetimes with an explicit offset, range order, regex syntax, and field references.
 * Not checked: anything about evaluation; that belongs to the host.
 */
export function validateCondition(
	value: unknown,
	catalog: AxcConditionCatalog,
	options: AxcConditionOptions = {},
): AxcIssue[] {
	const maxLevels = checkCatalog(catalog);
	const fields = new Map(catalog.fields.map((field) => [field.name, field]));
	const [issues, report] = collect();
	const rule = (node: unknown, path: AxcPath) => {
		if (!checkObject(node, ['field', 'operator', 'value', 'valueSource'], path, report)) return;
		const field = typeof node.field === 'string' ? fields.get(node.field) : undefined;
		if (!field || field.disabled)
			return report({ code: 'unknownField', path: [...path, 'field'], params: { field: String(node.field) } });
		const operator = operatorsFor(field).find((item) => item.name === node.operator);
		if (!operator)
			return report({
				code: 'unknownOperator',
				path: [...path, 'operator'],
				params: { operator: String(node.operator) },
			});
		if (!Object.hasOwn(node, 'value')) return report({ code: 'required', path: [...path, 'value'] });
		if (!Object.hasOwn(node, 'valueSource')) {
			if (fieldRefOnly(field, operator)) report({ code: 'fieldRefRequired', path: [...path, 'value'] });
			else checkValue(node.value, field, operator, [...path, 'value'], report);
			return;
		}
		if (node.valueSource !== 'field' || !field.valueSources?.includes('field') || operator.valueShape === 'none')
			return report({ code: 'fieldRefInvalid', path: [...path, 'valueSource'] });
		const target = typeof node.value === 'string' ? fields.get(node.value) : undefined;
		if (!target || target.disabled || !sameType(field, target))
			report({ code: 'fieldRefInvalid', path: [...path, 'value'] });
	};
	const group = (node: unknown, depth: number, path: AxcPath) => {
		if (!checkObject(node, ['combinator', 'not', 'rules'], path, report)) return;
		if (depth > maxLevels) return report({ code: 'tooDeep', path, params: { max: maxLevels } });
		if (node.combinator !== 'and' && node.combinator !== 'or')
			report({ code: 'combinator', path: [...path, 'combinator'] });
		if (typeof node.not !== 'boolean')
			report({ code: 'type', path: [...path, 'not'], params: { expected: 'boolean' } });
		else if (node.not && catalog.allowNot === false) report({ code: 'negationDisabled', path: [...path, 'not'] });
		if (!Array.isArray(node.rules))
			return report({ code: 'type', path: [...path, 'rules'], params: { expected: 'array' } });
		if (!node.rules.length && !(options.allowEmpty && depth === 1)) report({ code: 'empty', path: [...path, 'rules'] });
		node.rules.forEach((child, index) =>
			isObject(child) && 'rules' in child
				? group(child, depth + 1, [...path, 'rules', index])
				: rule(child, [...path, 'rules', index]),
		);
	};
	group(value, 1, []);
	return issues;
}

/**
 * The only way external data (storage, API, model output) should become an `AxcConditionValue`.
 * Returns `value` unchanged when valid; otherwise throws `AxcValidationError` with every issue.
 * The editor allows incomplete drafts, so hosts must call this before saving.
 */
export function parseCondition(
	value: unknown,
	catalog: AxcConditionCatalog,
	options?: AxcConditionOptions,
): AxcConditionValue {
	return ensureValid(value, validateCondition(value, catalog, options));
}
