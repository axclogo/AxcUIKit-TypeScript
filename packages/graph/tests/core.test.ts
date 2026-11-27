import assert from 'node:assert/strict';
import test from 'node:test';
import { relationGraphRelationKey } from '../src/core/index.js';
test('relation identity includes direction, boundary lengths and relation type', () => {
	const key = relationGraphRelationKey('a', 'bc', 'x');
	assert.equal(key, 'relation:1:a2:bc1:x');
	for (const [a, b, t] of [
		['ab', 'c', 'x'],
		['bc', 'a', 'x'],
		['a', 'bc', 'y'],
	]) {
		assert.notEqual(relationGraphRelationKey(a, b, t), key);
	}
});

import { normalizeRelationGraph, RelationGraphDataError } from '../src/core/index.js';
import { relationGraphElementStates } from '../src/core/selection.js';
test('malformed records and tables report the failing path', () => {
	const row = { id: 'a', name: 'Alpha', related_id: null, relation_type: null };
	const cols = Object.keys(row);
	const fixtures: [unknown, string][] = [
		['[', '$'],
		[null, '$'],
		[{ columns: cols, rows: [], extra: true }, '$'],
		[{ columns: 0, rows: [] }, '$'],
		[{ columns: cols, rows: 3 }, '$'],
		[[null], 'rows[0]'],
		[[{ ...row, id: Infinity }], 'rows[0].id'],
		[[{ ...row, name: ' ' }], 'rows[0].name'],
		[[{ ...row, color: 'red' }], 'rows[0].color'],
		[[{ ...row, relation_type: 'edge' }], 'rows[0].relation_type'],
		[{ columns: [...cols, 'id'], rows: [] }, 'columns'],
		[{ columns: [...cols, 3], rows: [] }, 'columns'],
		[{ columns: cols, rows: [0] }, 'rows[0]'],
		[{ columns: cols, rows: [[]] }, 'rows[0]'],
		[
			[
				{ ...row, color: '#ffffff' },
				{ ...row, color: '#000000' },
			],
			'rows[1]',
		],
	];
	for (const [input, path] of fixtures)
		assert.throws(
			() => normalizeRelationGraph(input),
			(e) => e instanceof RelationGraphDataError && e.path === path,
		);
	const node = (id: string) => ({ ...row, id });
	const edge = (id: string, related_id: string, relation_type: string) => ({ ...row, id, related_id, relation_type });
	const model = normalizeRelationGraph([
		node('c'),
		{ ...node('a'), color: '#ffffff' },
		node('a'),
		edge('a', 'b', 'y'),
		edge('a', 'b', 'x'),
		edge('a', 'a', 'z'),
		edge('b', 'c', 'y'),
	]);
	assert.equal(model.nodes[0].color, '#ffffff');
	assert.deepEqual(
		model.relations.map((e) => [e.source, e.target, e.type]),
		[
			['a', 'a', 'z'],
			['a', 'b', 'x'],
			['a', 'b', 'y'],
			['b', 'c', 'y'],
		],
	);
	const states = relationGraphElementStates(model, { type: 'node', id: 'c' });
	assert.deepEqual(states['edge:' + model.relations[0].key], ['inactive']);
	assert.deepEqual(states['node:b'], ['active']);
	assert.deepEqual(
		relationGraphElementStates(model, { type: 'relation', key: 'gone', source: 'a', target: 'b', relationType: 'x' })[
			'node:a'
		],
		['inactive'],
	);
});
