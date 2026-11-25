import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	JsonConfigurationError,
	JsonValidationError,
	jsonSchemaToField,
	parseJsonValue,
	parseJsonContent,
	type JsonIssue,
	type JsonValue,
} from '../src/core';
import { en, zhCN } from '../src';

function schemaIssue(schema: unknown, issue: JsonIssue) {
	assert.throws(
		() => jsonSchemaToField(schema),
		(error) => {
			assert.ok(error instanceof TypeError);
			assert.ok(error instanceof JsonConfigurationError);
			assert.deepEqual(error.issues, [issue]);
			assert.match(error.message, new RegExp(issue.code));
			assert.ok(en.issues[issue.code]);
			assert.ok(zhCN.issues[issue.code]);
			return true;
		},
	);
}

test('all JSON roots preserve values and identity, while non-JSON roots have structured issues', () => {
	const values: JsonValue[] = [{}, [], '', 'text', 0, -0, 12, false, true, null];
	for (const value of values) {
		assert.equal(parseJsonValue(value), value);
		assert.equal(parseJsonContent({ kind: 'value', value }), value);
		assert.deepEqual(
			parseJsonContent({ kind: 'text', text: Object.is(value, -0) ? '-0' : JSON.stringify(value) }),
			value,
		);
	}
	const cycle: unknown[] = [];
	cycle.push(cycle);
	for (const value of [undefined, NaN, Infinity, 1n, () => 0, Symbol(), new Date(), cycle]) {
		assert.throws(
			() => parseJsonValue(value),
			(error) => {
				assert.ok(error instanceof JsonValidationError);
				assert.deepEqual(error.issues, [{ code: 'invalid_value', path: value === cycle ? [0] : [], params: {} }]);
				return true;
			},
		);
	}
});

test('schema conversion recursively maps object, array, required, defaults, all enum values and annotations', () => {
	const schema = {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		type: 'object',
		title: 'Request',
		description: 'Request body',
		additionalProperties: false,
		required: ['records', 'undeclared'],
		properties: {
			records: {
				type: 'array',
				items: {
					type: 'object',
					required: ['date'],
					properties: {
						date: { type: 'string', title: 'Date', description: 'Calendar day', format: 'date', default: '2026-11-25' },
						time: { type: 'string', format: 'date-time' },
						choice: { enum: [null, false, 0, '', { x: 1 }, [2]] },
					},
					additionalProperties: { type: 'integer', default: 2 },
				},
			},
		},
	};
	const before = structuredClone(schema);
	assert.deepEqual(jsonSchemaToField(schema), {
		type: 'object',
		label: 'Request',
		description: 'Request body',
		additionalProperties: false,
		fields: [
			{
				name: 'records',
				type: 'array',
				required: true,
				items: {
					type: 'object',
					fields: [
						{
							name: 'date',
							type: 'string',
							label: 'Date',
							description: 'Calendar day',
							format: 'date',
							default: '2026-11-25',
							required: true,
						},
						{ name: 'time', type: 'string', format: 'date-time' },
						{ name: 'choice', options: [null, false, 0, '', { x: 1 }, [2]].map((value) => ({ value })) },
					],
					additionalProperties: { type: 'number', default: 2 },
				},
			},
			{ name: 'undeclared', required: true },
		],
	});
	assert.deepEqual(schema, before);
	assert.deepEqual(jsonSchemaToField(true), {});
	assert.deepEqual(jsonSchemaToField({}), {});
	assert.deepEqual(jsonSchemaToField({ type: 'number', default: 'host validates this' }), {
		type: 'number',
		default: 'host validates this',
	});
	assert.deepEqual(jsonSchemaToField({ additionalProperties: { type: 'boolean' }, required: ['x'] }), {
		additionalProperties: { type: 'boolean' },
		fields: [{ name: 'x', type: 'boolean', required: true }],
	});
	assert.deepEqual(
		jsonSchemaToField({ properties: { ['__proto__']: true, '': { type: 'null' } }, additionalProperties: true }),
		{
			fields: [{ name: '__proto__' }, { name: '', type: 'null' }],
			additionalProperties: true,
		},
	);
});

test('every unsupported keyword is rejected at its exact schema path, including nested and expanded-reference leftovers', () => {
	for (const keyword of [
		'$ref',
		'$dynamicRef',
		'$id',
		'$defs',
		'$anchor',
		'$dynamicAnchor',
		'$vocabulary',
		'$comment',
		'oneOf',
		'anyOf',
		'allOf',
		'not',
		'if',
		'then',
		'else',
		'const',
		'prefixItems',
		'contains',
		'minContains',
		'maxContains',
		'unevaluatedItems',
		'unevaluatedProperties',
		'patternProperties',
		'propertyNames',
		'dependentSchemas',
		'dependentRequired',
		'minimum',
		'maximum',
		'exclusiveMinimum',
		'exclusiveMaximum',
		'multipleOf',
		'minLength',
		'maxLength',
		'pattern',
		'minItems',
		'maxItems',
		'uniqueItems',
		'minProperties',
		'maxProperties',
		'examples',
		'readOnly',
		'writeOnly',
		'deprecated',
		'contentEncoding',
		'contentMediaType',
		'contentSchema',
		'custom',
	]) {
		schemaIssue(
			{ type: 'object', properties: { list: { items: { [keyword]: {} } } } },
			{
				code: 'unsupported_schema_keyword',
				path: ['properties', 'list', 'items', keyword],
				params: { keyword },
			},
		);
	}
	schemaIssue(
		{ additionalProperties: { oneOf: [] } },
		{ code: 'unsupported_schema_keyword', path: ['additionalProperties', 'oneOf'], params: { keyword: 'oneOf' } },
	);
	// Data annotations may legitimately contain names that are schema keywords.
	assert.deepEqual(jsonSchemaToField({ default: { oneOf: [] }, enum: [{ $ref: 'literal' }] }), {
		default: { oneOf: [] },
		options: [{ value: { $ref: 'literal' } }],
	});
});

test('malformed schemas and unsupported keyword forms fail without silently changing their meaning', () => {
	for (const [schema, path] of [
		[null, []],
		[[], []],
		['text', []],
		[{ properties: [] }, ['properties']],
		[{ properties: { x: 1 } }, ['properties', 'x']],
		[{ title: 1 }, ['title']],
		[{ description: false }, ['description']],
		[{ required: 'x' }, ['required']],
		[{ required: [1] }, ['required']],
		[{ required: ['x', 'x'] }, ['required']],
		[{ enum: [] }, ['enum']],
		[{ enum: null }, ['enum']],
		[{ items: [] }, ['items']],
		[{ additionalProperties: null }, ['additionalProperties']],
		[{ default: NaN }, ['default']],
	] as const)
		schemaIssue(schema, { code: 'invalid_schema', path, params: {} });
	for (const [schema, keyword] of [
		[{ type: ['string', 'null'] }, 'type'],
		[{ type: 'file' }, 'type'],
		[{ format: 'email' }, 'format'],
		[{ $schema: 'older-draft' }, '$schema'],
	] as const)
		schemaIssue(schema, { code: 'unsupported_schema_value', path: [keyword], params: { keyword } });
	schemaIssue({ items: false }, { code: 'unsupported_schema_value', path: ['items'], params: { value: 'false' } });
	schemaIssue(false, { code: 'unsupported_schema_value', path: [], params: { value: 'false' } });
	const cycle: Record<string, unknown> = {};
	cycle.items = cycle;
	schemaIssue(cycle, { code: 'invalid_schema', path: ['items'], params: {} });
});
