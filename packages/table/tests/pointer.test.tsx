import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { BaseTable, DataTreeTable } from '../src/index.js';

afterEach(cleanup);
function drop(handle: HTMLElement, target: HTMLElement, y: number) {
	const pointer = { pointerId: 1, clientX: 10, clientY: y };
	handle.setPointerCapture = () => {};
	target.getBoundingClientRect = () => new DOMRect(0, 0, 100, 90);
	const descriptor = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
	Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => target });
	try {
		fireEvent.pointerDown(handle, pointer);
		fireEvent.pointerMove(handle, pointer);
		fireEvent.pointerUp(handle, pointer);
	} finally {
		if (descriptor) Object.defineProperty(document, 'elementFromPoint', descriptor);
		else Reflect.deleteProperty(document, 'elementFromPoint');
	}
}
test('a rejected flat drop preserves input order and does not switch to an approved adjacent position', async () => {
	const rows = Object.freeze([{ id: 'a' }, { id: 'b' }]);
	const moves: string[] = [];
	const view = render(
		<BaseTable
			rows={rows}
			rowKey="id"
			columns={[{ key: 'id' }]}
			rowDragDrop={{
				allowedPositions: ['before', 'after'],
				canDrop: (d) => d.position === 'after',
				onDrop: (d) => {
					moves.push(d.position);
				},
			}}
		/>,
	);
	const target = view.getByRole('cell', { name: 'b' }).closest('tr')!,
		handle = view.getByRole('button', { name: 'Move row a' });
	drop(handle, target, 2);
	await Promise.resolve();
	assert.deepEqual(moves, []);
	drop(handle, target, 85);
	await Promise.resolve();
	assert.deepEqual(moves, ['after']);
	assert.deepEqual(
		rows.map((r) => r.id),
		['a', 'b'],
	);
});
test('tree before, inside and after describe sibling index, parent and depth without mutating the tree', async () => {
	type Item = { id: string; children?: Item[] };
	const nodes: Item[] = [{ id: 'A', children: [{ id: 'B' }] }, { id: 'C' }, { id: 'D' }];
	const moves: unknown[] = [];
	const view = render(
		<DataTreeTable
			nodes={nodes}
			childrenKey="children"
			rowKey="id"
			columns={[{ key: 'id' }]}
			defaultExpandAll
			dragDrop={{
				maxDepth: 1,
				onMove: (m) => {
					moves.push([m.position, m.nextParentKey, m.nextDepth, m.nextIndex]);
				},
			}}
		/>,
	);
	const handle = (key: string) => view.getByRole('button', { name: 'Move row ' + key });
	const row = (key: string) => handle(key).closest('tr')!;
	for (const y of [5, 45, 85]) {
		drop(handle('D'), row('A'), y);
		await Promise.resolve();
	}
	assert.deepEqual(moves, [
		['before', undefined, 0, 0],
		['inside', 'A', 1, 1],
		['after', undefined, 0, 1],
	]);
	drop(handle('A'), row('B'), 45);
	await Promise.resolve();
	assert.equal(moves.length, 3);
	assert.deepEqual(
		nodes.map((n) => n.id),
		['A', 'C', 'D'],
	);
});
test('resize previews locally, clamps to the column bounds and reports only public columns', () => {
	const commits: unknown[] = [];
	const view = render(
		<BaseTable
			rows={[{ id: 'A' }]}
			rowKey="id"
			selection={{}}
			columns={[{ key: 'id', width: 60, minWidth: 50, maxWidth: 80 }]}
			columnSizing={{ onResizeEnd: (...args) => commits.push(args) }}
		/>,
	);
	const handle = view.getByRole('separator', { name: 'Resize column id' });
	handle.setPointerCapture = () => {};
	fireEvent.pointerDown(handle, { pointerId: 1, clientX: 5 });
	fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100 });
	assert.deepEqual(commits, []);
	fireEvent.pointerUp(handle, { pointerId: 1, clientX: 100 });
	assert.deepEqual(commits, [['id', 80, { id: 80 }]]);
});
