import assert from 'node:assert/strict';
import test from 'node:test';
import {
	AxcValidationError,
	emptyCondition,
	parseCondition,
	validateCondition,
	type AxcConditionCatalog,
	type AxcIssue,
	type ConditionField,
} from '../src/core/index.js';

const fields: ConditionField[] = [
	{ name: 'title', label: 'Title' },
	{ name: 'count', label: 'Count', dataType: 'number' },
	{ name: 'other', label: 'Other count', dataType: 'number' },
	{ name: 'on', label: 'On', dataType: 'boolean' },
	{ name: 'day', label: 'Day', dataType: 'date' },
	{ name: 'at', label: 'At', dataType: 'datetime' },
	{
		name: 'kind',
		label: 'Kind',
		dataType: 'enum',
		values: [
			{ value: 'a', label: 'A' },
			{ value: 'b', label: 'B', disabled: true },
		],
	},
	{ name: 'tags', label: 'Tags', dataType: 'array', values: [{ value: 'x', label: 'X' }] },
	{ name: 'words', label: 'Words', dataType: 'array' },
	{ name: 'meta', label: 'Meta', dataType: 'object' },
	{ name: 'off', label: 'Off', disabled: true },
	{ name: 'ref', label: 'Ref', dataType: 'number', valueSources: ['value', 'field'] },
	{ name: 'refOnly', label: 'Ref only', dataType: 'number', valueSources: ['field'] },
	{ name: 'custom', label: 'Custom', operators: [{ name: 'near', valueShape: 'range', label: 'near' }] },
];
const catalog: AxcConditionCatalog = { fields };
const group = (...rules: unknown[]) => ({ combinator: 'and', not: false, rules });
const rule = (field: string, operator: string, value: unknown) => ({ field, operator, value });
/** Issues as `code@path` strings, so expectations stay short and readable. */
const issues = (value: unknown, options?: Parameters<typeof validateCondition>[2], at = catalog) =>
	validateCondition(value, at, options).map((issue) => `${issue.code}@${issue.path.join('.')}`);
const only = (r: unknown) => issues(group(r));

test('accepts every value type in its native JS type and returns the input unchanged', () => {
	const value = group(
		rule('title', 'contains', 'a, b'),
		rule('count', '=', 0),
		rule('count', 'between', [-1, 1.5]),
		rule('on', '=', false),
		rule('day', '=', '2024-02-29'),
		rule('at', '>', '2024-01-01T00:00:00+08:00'),
		rule('at', 'between', ['2024-01-01T00:00:00Z', '2024-01-01T00:00:00.5Z']),
		rule('kind', 'in', ['a']),
		rule('tags', 'hasAll', ['x']),
		rule('words', 'contains', 'w'),
		rule('meta', 'contains', '{"a":1}'),
		rule('title', 'null', null),
		rule('title', 'regex', '^a+$'),
		rule('custom', 'near', ['a', 'b']),
		{ field: 'ref', operator: '>', value: 'other', valueSource: 'field' },
		{ field: 'refOnly', operator: '=', value: 'count', valueSource: 'field' },
		group(rule('title', '=', 'nested')),
	);
	const frozen = structuredClone(value);
	assert.equal(parseCondition(value, catalog), value);
	assert.deepEqual(value, frozen);
});

test('group structure: object, unknown keys, combinator, not, rules, empty', () => {
	assert.deepEqual(issues('x'), ['type@']);
	assert.deepEqual(issues({ ...group(rule('title', '=', 'a')), id: 1 }), ['unknownKey@id']);
	assert.deepEqual(issues({ combinator: 'xor', not: 'no', rules: {} }), [
		'combinator@combinator',
		'type@not',
		'type@rules',
	]);
	assert.deepEqual(issues(group()), ['empty@rules']);
	assert.deepEqual(issues(group(), { allowEmpty: true }), []);
	assert.deepEqual(
		issues(group(group()), { allowEmpty: true }),
		['empty@rules.0.rules'],
		'nested groups are never empty',
	);
	assert.deepEqual(issues(emptyCondition(), { allowEmpty: true }), []);
});

test('depth counts the root and defaults to 5', () => {
	const nest = (depth: number): unknown => (depth === 1 ? group(rule('title', '=', 'a')) : group(nest(depth - 1)));
	assert.deepEqual(issues(nest(5)), []);
	assert.deepEqual(issues(nest(6)), ['tooDeep@rules.0.rules.0.rules.0.rules.0.rules.0']);
	assert.deepEqual(issues(nest(2), {}, { fields, maxLevels: 1 }), ['tooDeep@rules.0']);
	const [issue] = validateCondition(nest(2), { fields, maxLevels: 1 });
	assert.deepEqual(issue.params, { max: 1 });
});

test('allowNot: false rejects negation at any depth', () => {
	const noNot = { fields, allowNot: false };
	assert.deepEqual(issues({ ...group(rule('title', '=', 'a')), not: true }, {}, noNot), ['negationDisabled@not']);
	assert.deepEqual(issues(group({ ...group(rule('title', '=', 'a')), not: true }), {}, noNot), [
		'negationDisabled@rules.0.not',
	]);
	assert.deepEqual(issues({ ...group(rule('title', '=', 'a')), not: true }), []);
});

test('rule structure: object, unknown keys, field, operator, missing value', () => {
	assert.deepEqual(only(3), ['type@rules.0']);
	assert.deepEqual(only({ ...rule('title', '=', 'a'), id: 'x' }), ['unknownKey@rules.0.id']);
	assert.deepEqual(only(rule('nope', '=', 'a')), ['unknownField@rules.0.field']);
	assert.deepEqual(only(rule('off', '=', 'a')), ['unknownField@rules.0.field'], 'disabled fields are rejected');
	assert.deepEqual(only(rule('count', 'contains', 'a')), ['unknownOperator@rules.0.operator']);
	assert.deepEqual(only({ field: 'title', operator: '=' }), ['required@rules.0.value']);
	assert.deepEqual(validateCondition(group(rule('nope', '=', 'a')), catalog)[0].params, { field: 'nope' });
});

test('value shapes: none, scalar, list, range', () => {
	assert.deepEqual(only(rule('title', 'null', '')), ['type@rules.0.value']);
	assert.deepEqual(only(rule('title', 'in', 'a')), ['type@rules.0.value']);
	assert.deepEqual(only(rule('title', 'in', [])), ['empty@rules.0.value']);
	assert.deepEqual(only(rule('title', 'in', ['a', 'a'])), ['duplicate@rules.0.value.1']);
	assert.deepEqual(only(rule('count', 'between', [1])), ['rangeLength@rules.0.value']);
	assert.deepEqual(only(rule('count', 'between', [2, 1])), ['rangeOrder@rules.0.value']);
	assert.deepEqual(only(rule('count', 'between', [1, 1])), []);
	assert.deepEqual(only(rule('day', 'between', ['2024-02-01', '2024-01-01'])), ['rangeOrder@rules.0.value']);
	assert.deepEqual(
		only(rule('at', 'between', ['2024-01-01T08:00:00+08:00', '2024-01-01T00:00:00Z'])),
		[],
		'datetimes compare as instants, not strings',
	);
	assert.deepEqual(only(rule('at', 'between', ['2024-01-01T00:00:01Z', '2024-01-01T00:00:00Z'])), [
		'rangeOrder@rules.0.value',
	]);
});

test('value types are never coerced', () => {
	assert.deepEqual(only(rule('count', '=', '1')), ['type@rules.0.value']);
	assert.deepEqual(only(rule('count', '=', Number.NaN)), ['type@rules.0.value']);
	assert.deepEqual(only(rule('count', '=', Infinity)), ['type@rules.0.value']);
	assert.deepEqual(only(rule('on', '=', 'false')), ['type@rules.0.value']);
	assert.deepEqual(only(rule('title', '=', 1)), ['type@rules.0.value']);
	assert.deepEqual(only(rule('count', 'between', ['', 2])), ['type@rules.0.value.0']);
	assert.deepEqual(validateCondition(group(rule('count', '=', '1')), catalog)[0].params, { expected: 'number' });
});

test('string content: blank, options, dates, datetimes, regex', () => {
	assert.deepEqual(only(rule('title', '=', '  ')), ['required@rules.0.value']);
	assert.deepEqual(only(rule('kind', '=', 'z')), ['option@rules.0.value']);
	assert.deepEqual(only(rule('kind', '=', 'b')), ['option@rules.0.value'], 'disabled options are rejected');
	assert.deepEqual(only(rule('tags', 'hasAny', ['x', 'y'])), ['option@rules.0.value.1']);
	assert.deepEqual(only(rule('day', '=', '2023-02-29')), ['date@rules.0.value']);
	assert.deepEqual(only(rule('day', '=', '2023-1-1')), ['date@rules.0.value']);
	assert.deepEqual(only(rule('at', '=', '2024-01-01T00:00:00')), ['datetime@rules.0.value'], 'offset is required');
	assert.deepEqual(only(rule('at', '=', '2024-01-01T24:00:00Z')), ['datetime@rules.0.value']);
	assert.deepEqual(only(rule('at', '=', '2024-01-01T00:00Z')), ['datetime@rules.0.value'], 'seconds are required');
	assert.deepEqual(only(rule('title', 'regex', '(')), ['regex@rules.0.value']);
	assert.deepEqual(only(rule('title', 'notRegex', '[')), ['regex@rules.0.value']);
	assert.deepEqual(only(rule('title', 'contains', '(')), [], 'only regex operators compile the value');
});

test('field references', () => {
	const ref = (field: string, operator: string, value: unknown, valueSource: unknown = 'field') => ({
		field,
		operator,
		value,
		valueSource,
	});
	assert.deepEqual(only(ref('ref', '>', 'other')), []);
	assert.deepEqual(only(ref('count', '>', 'other')), ['fieldRefInvalid@rules.0.valueSource'], 'not declared on field');
	assert.deepEqual(only(ref('ref', '>', 'other', 'value')), ['fieldRefInvalid@rules.0.valueSource']);
	assert.deepEqual(only(ref('ref', 'null', 'other')), ['fieldRefInvalid@rules.0.valueSource'], 'unary operators');
	assert.deepEqual(only(ref('ref', '>', 'title')), ['fieldRefInvalid@rules.0.value'], 'type mismatch');
	assert.deepEqual(only(ref('ref', '>', 'nope')), ['fieldRefInvalid@rules.0.value']);
	assert.deepEqual(only(ref('ref', 'between', 'other')), []);
	assert.deepEqual(only(rule('refOnly', '=', 1)), ['fieldRefRequired@rules.0.value']);
	assert.deepEqual(only(rule('refOnly', 'null', null)), [], 'unary operators need no reference');
	assert.deepEqual(only(ref('ref', '>', 'off')), ['fieldRefInvalid@rules.0.value'], 'disabled target');
});

test('reports every issue, not just the first', () => {
	const list = issues(group(rule('count', '=', 'x'), rule('nope', '=', 1), group(rule('title', '=', ''))));
	assert.deepEqual(list, ['type@rules.0.value', 'unknownField@rules.1.field', 'required@rules.2.rules.0.value']);
});

test('parseCondition throws AxcValidationError with issues and a language-neutral message', () => {
	try {
		parseCondition(group(rule('count', '=', 'x')), catalog);
		assert.fail('should throw');
	} catch (error) {
		assert.ok(error instanceof AxcValidationError);
		assert.deepEqual(error.issues, [
			{ code: 'type', path: ['rules', 0, 'value'], params: { expected: 'number' } },
		] satisfies AxcIssue[]);
		assert.equal(error.message, '$.rules[0].value: type');
	}
});

test('a broken catalog is a TypeError, not a validation issue', () => {
	const value = group(rule('n', '=', 1));
	assert.throws(() => validateCondition(value, { fields, maxLevels: 0 }), TypeError);
	assert.throws(() => validateCondition(value, { fields, maxLevels: 1.5 }), TypeError);
	assert.throws(() => validateCondition(value, { fields: [fields[0], fields[0]] }), /Duplicate field/);
	// Regression #4: options are strings, so a number field with values could never validate.
	const numberWithValues = { name: 'n', label: 'N', dataType: 'number', values: [{ value: '1', label: 'one' }] };
	assert.throws(() => validateCondition(value, { fields: [numberWithValues as ConditionField] }), /cannot be declared/);
	for (const dataType of ['boolean', 'date', 'datetime', 'object'])
		assert.throws(
			() => validateCondition(value, { fields: [{ ...numberWithValues, dataType } as ConditionField] }),
			TypeError,
		);
	// @ts-expect-error values are not allowed on number fields at the type level either
	const typed: ConditionField = { name: 'n', label: 'N', dataType: 'number', values: [] };
	void typed;
});
