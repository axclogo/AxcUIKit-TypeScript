import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { ControlConditionNodeEditor, GraphWorkbench, GraphWorkbenchRightSidebarToolbar } from '../src/index.js';
afterEach(cleanup);
test('condition default switch emits original rule and sidebar commands retain identity', () => {
	const rule = { combinator: 'and' as const, not: false, rules: [] };
	let change: unknown,
		clicked = 0;
	const v = render(
		<>
			<ControlConditionNodeEditor
				rule={rule}
				fields={[]}
				isDefault
				onChange={(value) => {
					change = value;
				}}
			/>
			<GraphWorkbenchRightSidebarToolbar
				items={[
					{
						key: 'add',
						label: 'Add item',
						onClick: () => {
							clicked++;
						},
					},
				]}
			/>
		</>,
	);
	fireEvent.click(v.getByRole('checkbox'));
	assert.deepEqual(change, { rule, isDefault: false });
	fireEvent.click(v.getByRole('button', { name: 'Add item' }));
	assert.equal(clicked, 1);
});

test('readonly locks explicit node editing flags while preserving inspection', async () => {
	const nodes = [
		{ id: 'a', position: { x: 0, y: 0 }, draggable: true, connectable: true, data: { view: { title: 'Alpha' } } },
	];
	let inspected = '';
	const props = {
		nodes,
		edges: [],
		onNodeClick: (node: { id: string }) => {
			inspected = node.id;
		},
	};
	const view = render(<GraphWorkbench {...props} mode="readonly" />);
	const node = (await view.findByText('Alpha')).closest('.react-flow__node')!;
	assert.equal(node.classList.contains('draggable'), false);
	assert.equal(node.querySelectorAll('.react-flow__handle').length, 2);
	assert.equal(node.querySelectorAll('.connectable').length, 0);
	fireEvent.click(node);
	assert.equal(inspected, 'a');
	view.rerender(<GraphWorkbench {...props} mode="edit" />);
	assert.ok(node.classList.contains('draggable'));
	assert.equal(node.querySelectorAll('.connectable').length, 2);
});

test('invalid topology stops the canvas and corrected input restores it', async () => {
	const node = { id: 'a', position: { x: 0, y: 0 }, data: { view: { title: 'Alpha' } } };
	const edge = { id: 'loop', source: 'a', target: 'a' };
	const v = render(<GraphWorkbench nodes={[node, node]} edges={[]} />);
	assert.equal((await v.findByRole('alert')).textContent, 'Duplicate node id: a');
	assert.equal(v.container.querySelector('.react-flow'), null);
	v.rerender(<GraphWorkbench nodes={[node]} edges={[edge, edge]} layout={{}} />);
	assert.equal(v.getByRole('alert').textContent, 'Duplicate edge id: loop');
	v.rerender(<GraphWorkbench nodes={[node]} edges={[{ ...edge, target: 'missing' }]} />);
	assert.equal(v.getByRole('alert').textContent, 'Missing endpoint for edge loop');
	assert.equal(v.container.querySelector('.react-flow'), null);
	v.rerender(<GraphWorkbench nodes={[node]} edges={[edge]} />);
	assert.ok(await v.findByText('Alpha'));
	assert.equal(v.queryByRole('alert'), null);
});
