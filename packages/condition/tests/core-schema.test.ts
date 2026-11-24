import assert from 'node:assert/strict';
import test from 'node:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import {
	conditionSchema,
	decisionSchema,
	operatorsFor,
	validateCondition,
	validateDecisionPlan,
	type AxcConditionCatalog,
	type ConditionField,
	type ConditionOperator,
} from '../src/core/index.js';

// Formats are annotations here: calendar and offset checks are the parser's job (asserted below).
const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, validateFormats: false, allErrors: true });
const fields: ConditionField[] = [
	{ name: 'title', label: 'Title' },
	{ name: 'count', label: 'Count', dataType: 'number', valueSources: ['value', 'field'] },
	{ name: 'other', label: 'Other', dataType: 'number' },
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
	{
		name: 'tags',
		label: 'Tags',
		dataType: 'array',
		values: [
			{ value: 'x', label: 'X' },
			{ value: 'y', label: 'Y' },
		],
	},
	{ name: 'words', label: 'Words', dataType: 'array' },
	{ name: 'meta', label: 'Meta', dataType: 'object' },
	{ name: 'refOnly', label: 'Ref only', dataType: 'number', valueSources: ['field'] },
	{ name: 'off', label: 'Off', disabled: true },
];
const catalog: AxcConditionCatalog = { fields, maxLevels: 3 };
const group = (...rules: unknown[]) => ({ combinator: 'or', not: true, rules });

function sample(field: ConditionField, operator: ConditionOperator): unknown {
	const one: Record<string, unknown[]> = {
		number: [1, 2],
		boolean: [true, false],
		date: ['2024-01-01', '2024-01-02'],
		datetime: ['2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z'],
	};
	const items = field.values
		? field.values.filter((option) => !option.disabled).map((option) => option.value)
		: (one[field.dataType ?? ''] ?? ['p', 'q']);
	if (operator.valueShape === 'none') return null;
	if (operator.valueShape === 'scalar') return items[0];
	if (operator.valueShape === 'range') return [items[0], items[1] ?? items[0]];
	return items.slice(0, 1);
}

/** One valid rule for every enabled field × operator, generated from the same operator table. */
const validRules = fields
	.filter((field) => !field.disabled)
	.flatMap((field) =>
		operatorsFor(field).map((operator) =>
			field.valueSources?.length === 1 && operator.valueShape !== 'none'
				? { field: field.name, operator: operator.name, value: 'count', valueSource: 'field' }
				: { field: field.name, operator: operator.name, value: sample(field, operator) },
		),
	);

const schemaAccepts = (value: unknown, schema = conditionSchema(catalog)) => ajv.validate(schema, value);
const parserAccepts = (value: unknown) => validateCondition(value, catalog).length === 0;

test('schema and parser accept every generated field × operator rule', () => {
	assert.ok(validRules.length > 60);
	for (const rule of validRules) {
		const value = group(rule);
		assert.equal(parserAccepts(value), true, `parser: ${JSON.stringify(rule)}`);
		assert.equal(schemaAccepts(value), true, `schema: ${JSON.stringify(rule)} ${ajv.errorsText()}`);
	}
	assert.equal(schemaAccepts(group(...validRules, group(validRules[0], group(validRules[1])))), true);
});

test('schema and parser reject the same structural mistakes', () => {
	const ok = { field: 'title', operator: '=', value: 'a' };
	const nest = (depth: number): unknown => (depth === 1 ? group(ok) : group(nest(depth - 1)));
	const cases: Record<string, unknown> = {
		'empty group': group(),
		'empty nested group': group(group()),
		'too deep': nest(4),
		'bad combinator': { ...group(ok), combinator: 'xor' },
		'extra group key': { ...group(ok), id: 1 },
		'extra rule key': group({ ...ok, id: 1 }),
		'missing value': group({ field: 'title', operator: '=' }),
		'unknown field': group({ ...ok, field: 'nope' }),
		'disabled field': group({ ...ok, field: 'off' }),
		'operator from another type': group({ field: 'count', operator: 'contains', value: 'a' }),
		'string for number': group({ field: 'count', operator: '=', value: '1' }),
		'string for boolean': group({ field: 'on', operator: '=', value: 'true' }),
		'blank text': group({ ...ok, value: '   ' }),
		'unknown option': group({ field: 'kind', operator: '=', value: 'z' }),
		'disabled option': group({ field: 'kind', operator: '=', value: 'b' }),
		'non-null unary': group({ field: 'title', operator: 'null', value: '' }),
		'scalar for list': group({ field: 'title', operator: 'in', value: 'a' }),
		'empty list': group({ field: 'title', operator: 'in', value: [] }),
		'duplicate list': group({ field: 'tags', operator: 'hasAny', value: ['x', 'x'] }),
		'range of one': group({ field: 'count', operator: 'between', value: [1] }),
		'reference without permission': group({ field: 'other', operator: '=', value: 'count', valueSource: 'field' }),
		'reference of another type': group({ field: 'count', operator: '=', value: 'title', valueSource: 'field' }),
		'fixed value where only references are allowed': group({ field: 'refOnly', operator: '=', value: 1 }),
	};
	for (const [name, value] of Object.entries(cases)) {
		assert.equal(parserAccepts(value), false, `parser accepted ${name}`);
		assert.equal(schemaAccepts(value), false, `schema accepted ${name}`);
	}
	const noNot = { fields, allowNot: false };
	assert.equal(ajv.validate(conditionSchema(noNot), group(ok)), false);
	assert.notEqual(validateCondition(group(ok), noNot).length, 0);
});

test('semantic checks the schema cannot express are parser-only (documented)', () => {
	const parserOnly = {
		'range order': group({ field: 'count', operator: 'between', value: [2, 1] }),
		'regex syntax': group({ field: 'title', operator: 'regex', value: '(' }),
		'calendar date': group({ field: 'day', operator: '=', value: '2023-02-29' }),
		'datetime offset': group({ field: 'at', operator: '=', value: '2024-01-01T00:00:00' }),
	};
	for (const [name, value] of Object.entries(parserOnly)) {
		assert.equal(schemaAccepts(value), true, name);
		assert.equal(parserAccepts(value), false, name);
	}
});

test('empty catalogs produce a valid schema that accepts nothing', () => {
	for (const schema of [conditionSchema({ fields: [] }), decisionSchema({ fields: [] })]) {
		assert.ok(ajv.compile(schema));
		assert.equal(ajv.validate(schema, group({ field: 'a', operator: '=', value: 'a' })), false);
	}
	const noOptions = { fields: [{ name: 'k', label: 'K', dataType: 'enum' as const, values: [] }] };
	assert.equal(ajv.validate(conditionSchema(noOptions), group({ field: 'k', operator: '=', value: '' })), false);
});

test('decision schema and parser agree on plans', () => {
	const plan = {
		precondition: group(validRules[0]),
		input_fields: ['title', 'count'],
		instruction: 'Judge',
		outputs: [{ name: 'category', label: 'Category', type: 'enum', options: ['a', 'b'] }],
		postcondition: group(
			{ field: 'ai.category', operator: '=', value: 'a' },
			{ field: 'ai.matched', operator: '=', value: true },
		),
	};
	const schema = decisionSchema(catalog);
	assert.equal(ajv.validate(schema, plan), true, ajv.errorsText());
	assert.deepEqual(validateDecisionPlan(plan, catalog), []);
	const broken = {
		'model in plan': { ...plan, model: 'm' },
		'no input fields': { ...plan, input_fields: [] },
		'unknown input field': { ...plan, input_fields: ['nope'] },
		'bad output name': { ...plan, outputs: [{ name: 'Bad', label: 'x', type: 'string', options: [] }] },
		'blank instruction': { ...plan, instruction: ' ' },
		'empty precondition': { ...plan, precondition: group() },
	};
	for (const [name, value] of Object.entries(broken)) {
		assert.equal(ajv.validate(schema, value), false, `schema accepted ${name}`);
		assert.notEqual(validateDecisionPlan(value, catalog).length, 0, `parser accepted ${name}`);
	}
});
