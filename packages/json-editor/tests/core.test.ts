import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JsonValidationError, parseJsonContent, parseJsonObject, type JsonIssue } from '../src/core';

function issues(run: () => void, expected: JsonIssue[]) {
	assert.throws(run, (error) => {
		assert.ok(error instanceof JsonValidationError);
		assert.deepEqual(error.issues, expected);
		return true;
	});
}

test('object parsing preserves structure, empty values, literal keys and shared finite data', () => {
	const shared = { zero: 0, false: false, emptyArray: [], emptyObject: {}, '': '', nil: null };
	const value = { ['__proto__']: shared, ' spaced ': shared, list: [1, { a: 'b' }] };
	assert.equal(parseJsonObject(value), value);
	assert.deepEqual(parseJsonContent({ kind: 'text', text: JSON.stringify(value) }), value);
	assert.equal(parseJsonContent({ kind: 'object', value }), value);
});

test('source parsing distinguishes empty and malformed text from non-object JSON', () => {
	for (const text of ['', ' ', '{', '{"a":}', '{"a":1,}']) {
		issues(() => parseJsonContent({ kind: 'text', text }), [{ code: 'invalid_json', path: [], params: {} }]);
	}
	for (const text of ['null', '[]', 'false', '0', '""']) {
		issues(() => parseJsonContent({ kind: 'text', text }), [{ code: 'expected_object', path: [], params: {} }]);
	}
	issues(() => parseJsonObject('{}'), [{ code: 'expected_object', path: [], params: {} }]);
	issues(
		() => parseJsonContent({ kind: 'text', text: '{"a":[1e999]}' }),
		[{ code: 'invalid_value', path: ['a', 0], params: {} }],
	);
	assert.deepEqual(parseJsonContent({ kind: 'text', text: '{"a":1,"a":2}' }), { a: 2 });
});

test('object parsing reports values JSON.stringify would silently coerce or omit', () => {
	const cycle: Record<string, unknown> = {};
	cycle.self = cycle;
	const candidates = {
		nested: [NaN, Infinity, undefined, new Date(), BigInt(10)],
		cycle,
		get getter() {
			throw new Error('must not invoke the accessor');
		},
		sparse: Array(1),
		[Symbol('name')]: 0,
	};
	const paths = [
		['nested', 0],
		['nested', 1],
		['nested', 2],
		['nested', 3],
		['nested', 4],
		['cycle', 'self'],
		['getter'],
		['sparse', 0],
		['Symbol(name)'],
	];
	issues(
		() => parseJsonObject(candidates),
		paths.map((path) => ({ code: 'invalid_value', path, params: {} })),
	);
});
