import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { cleanup, render, fireEvent } from '@testing-library/react';
import {
	GraphWorkspace,
	GraphWorkspaceCanvas,
	GraphWorkspacePanelSection,
	normalizeRelationGraph,
} from '../src/index.js';
import { layoutNodes, layoutOptions } from '../src/layout.js';
afterEach(cleanup);
const nodes = ['a', 'b'].map((id) => ({ id, width: 40, height: 30, position: { x: 0, y: 0 } }));
const edge = { id: 'link', source: 'a', target: 'b' };
test('Dagre uses both directions, node bounds and pixel gaps, and accepts cycles', () => {
	for (const direction of ['right', 'down'] as const) {
		const o = layoutOptions({ direction, columnGap: 32, rowGap: 24, snapToGrid: false });
		const pos = layoutNodes(nodes, [edge], o);
		const a = pos.get('a')!,
			b = pos.get('b')!;
		assert.equal(direction === 'right' ? b.x - a.x : b.y - a.y, direction === 'right' ? 72 : 54);
		assert.deepEqual(layoutNodes([...nodes].reverse(), [edge], o), pos);
	}
	const o = layoutOptions({});
	for (const { x, y } of layoutNodes(nodes, [edge, { id: 'back', source: 'b', target: 'a' }], o).values()) {
		assert.equal(x % 8, 0);
		assert.equal(y % 8, 0);
	}
});
test('protocol accepts equivalent encodings and rejects conflicts, dangling edges and aliases', () => {
	const records = [
		{ id: 'a', name: 'A', related_id: 2, relation_type: 'link' },
		{ id: 2, name: 'B', related_id: null, relation_type: null },
	];
	const m = normalizeRelationGraph(records);
	assert.deepEqual(normalizeRelationGraph(JSON.stringify(records)), m);
	assert.deepEqual(
		normalizeRelationGraph({
			columns: ['related_id', 'id', 'name', 'relation_type'],
			rows: [
				[2, 'a', 'A', 'link'],
				[null, 2, 'B', null],
			],
		}),
		m,
	);
	for (const bad of [
		[records[0]],
		[...records, records[0]],
		[...records, { ...records[1], name: 'C' }],
		[{ ...records[1], extra: true }],
		'{}',
	])
		assert.throws(() => normalizeRelationGraph(bad), /expected|duplicate|conflicting|undeclared/);
});
test('workspace keeps explicit empty sidebar and collapses its own section', () => {
	const v = render(
		<GraphWorkspace rightSidebar={null}>
			<GraphWorkspaceCanvas>
				<GraphWorkspacePanelSection title="Panel">Body</GraphWorkspacePanelSection>
			</GraphWorkspaceCanvas>
		</GraphWorkspace>,
	);
	assert.equal(v.container.querySelectorAll('aside').length, 1);
	fireEvent.click(v.getByRole('button', { name: 'Panel' }));
	assert.equal(v.queryByText('Body'), null);
	fireEvent.click(v.getByRole('button', { name: 'Panel' }));
	assert.ok(v.getByText('Body'));
});
import {
	relationGraphElementStates,
	relationGraphPointerMoved,
	relationGraphSelectionForRelation,
	relationGraphRendererNodeId,
	relationGraphRendererRelationId,
	RELATION_GRAPH_IDLE_STATE,
} from '../src/core/selection.js';
test('selection distinguishes renderer node/edge identity and scopes highlighting to neighbors', () => {
	const m = {
		nodes: [
			{ id: 'a', name: 'A' },
			{ id: 'b', name: 'B' },
			{ id: 'c', name: 'C' },
		],
		relations: [{ key: 'e', source: 'a', target: 'b', type: 'link' }],
	};
	const edge = m.relations[0];
	const selected = relationGraphSelectionForRelation(edge, 'node-and-relation');
	assert.equal(relationGraphSelectionForRelation(edge, 'node'), null);
	assert.deepEqual(relationGraphElementStates(m, selected)[relationGraphRendererRelationId('e')], ['selected']);
	assert.deepEqual(relationGraphElementStates(m, { id: 'a', type: 'node' })[relationGraphRendererNodeId('c')], [
		'inactive',
	]);
	assert.deepEqual(relationGraphElementStates(m, null)['node:a'], [RELATION_GRAPH_IDLE_STATE]);
	assert.ok(relationGraphPointerMoved({ x: 0, y: 0 }, { x: 3, y: 4 }));
});
