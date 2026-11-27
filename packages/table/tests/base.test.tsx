import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { BaseTable, TableUIProvider } from '../src/index.js';
afterEach(cleanup);
const props = { rows: [{ id: 1 }, { id: 2 }], rowKey: 'id' as const, columns: [{ key: 'id' }] };
test('table style height applies when no height option is set', () => {
	const view = render(<BaseTable {...props} style={{ height: 240 }} />);
	const root = view.container.querySelector<HTMLElement>('.axc-table')!;
	assert.equal(root.style.height, '240px');
	view.rerender(<BaseTable {...props} style={{ height: 240 }} height={300} />);
	assert.equal(root.style.height, '300px');
});

test('header selection preserves other pages and skips disabled rows', () => {
	let keys: readonly (string | number)[] = [];
	const view = render(
		<BaseTable
			{...props}
			selection={{
				selectedRowKeys: ['hidden'],
				canSelect: (r) => r.id === 1,
				onChange: (value) => {
					keys = value;
				},
			}}
		/>,
	);
	fireEvent.click(view.getByRole('checkbox', { name: 'Select page' }));
	assert.deepEqual(keys, ['hidden', 1]);
	assert.equal(view.getByRole('checkbox', { name: 'Select row 2' }).hasAttribute('disabled'), true);
});
test('action confirmation and the original rejection reach the host', async () => {
	const failure = Error('failed');
	let caught: unknown;
	const view = render(
		<TableUIProvider
			onActionError={(e) => {
				caught = e;
			}}
		>
			<BaseTable
				{...props}
				actions={[{ key: 'run', label: 'Run', confirm: 'Proceed?', onClick: () => Promise.reject(failure) }]}
			/>
		</TableUIProvider>,
	);
	fireEvent.click(view.getAllByText('Run')[0]);
	await act(async () => {
		fireEvent.click(view.getByRole('button', { name: 'Confirm' }));
	});
	assert.equal(caught, failure);
});
test('invalid fixed width, source, key and density fail at the component boundary', () => {
	assert.throws(() => render(<BaseTable {...props} columns={[{ key: 'id', fixed: 'left' }]} />), /width/);
	assert.throws(() => render(<BaseTable {...props} columns={[{ key: '__drag' }]} />), /column key/);
});

test('configuration errors identify conflicting or invalid options', () => {
	const throws = (fn: () => unknown, key: RegExp) => assert.throws(fn, { name: 'TypeError', message: key });
	// @ts-expect-error Externally supplied source has two row catalogs.
	throws(() => render(<BaseTable {...props} groups={[]} />), /rows.*groups/);
	// @ts-expect-error Unknown density from an untyped consumer.
	throws(() => render(<BaseTable {...props} density="other" />), /density/);
	throws(
		// @ts-expect-error Controlled and uncontrolled selection are exclusive.
		() => render(<BaseTable {...props} selection={{ selectedRowKeys: [], defaultSelectedRowKeys: [] }} />),
		/selectedRowKeys/,
	);
	throws(
		// @ts-expect-error Invalid position from an untyped consumer.
		() => render(<BaseTable {...props} rowDragDrop={{ allowedPositions: ['top'], onDrop: () => {} }} />),
		/allowedPositions/,
	);
	throws(() => render(<BaseTable {...props} rowHeight={0} />), /rowHeight/);
	throws(() => render(<BaseTable {...props} selection={{ columnWidth: -4 }} />), /columnWidth/);
	throws(
		() => render(<BaseTable {...props} actions={[{ key: 'go', label: 'Go', onClick: () => {} }]} />),
		/onActionError/,
	);
});
test('groups preserve row indices and the event comes only from a noninteractive cell', () => {
	const seen: number[] = [];
	const v = render(
		<BaseTable
			rowKey="id"
			groups={[
				{ key: 'a', title: 'First', rows: [{ id: 8 }] },
				{ key: 'b', title: 'Second', rows: [{ id: 5 }] },
			]}
			columns={[{ key: 'id' }, { key: 'link', render: () => <a href="#test">Link</a> }]}
			onRowClick={(_, i) => seen.push(i)}
		/>,
	);
	fireEvent.click(v.getByRole('cell', { name: '5' }));
	fireEvent.click(v.getAllByRole('link')[0]);
	assert.deepEqual(seen, [1]);
});
