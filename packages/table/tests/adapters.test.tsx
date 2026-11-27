import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { DataTable, DataTreeTable, TableUIProvider } from '../src/index.js';
afterEach(cleanup);
test('column render wins over formatter and registered type', () => {
	const view = render(
		<TableUIProvider types={{ tag: () => 'type' }}>
			<DataTable
				rows={[{ id: 1 }]}
				rowKey="id"
				columns={[{ key: 'id', type: 'tag', formatter: () => 'formatted', render: () => 'cell' }]}
			/>
		</TableUIProvider>,
	);
	assert.ok(view.getByText('cell'));
});
test('tree expansion, explicit row selection and child counts', () => {
	interface Row {
		id: string;
		children?: Row[];
	}
	const rows: Row[] = [{ id: 'root', children: [{ id: 'leaf' }] }];
	const v = render(
		<DataTreeTable
			nodes={rows}
			rowKey="id"
			columns={[{ key: 'id' }]}
			childrenKey="children"
			childCount
			selection={{ defaultSelectedRowKeys: ['leaf'] }}
		/>,
	);
	assert.equal(v.queryByText('leaf'), null);
	fireEvent.click(v.getByRole('button', { name: 'Expand' }));
	assert.equal((v.getByRole('checkbox', { name: 'Select row leaf' }) as HTMLInputElement).checked, true);
	fireEvent.click(v.getByRole('button', { name: 'Collapse' }));
	assert.equal(v.queryByText('leaf'), null);
});

test('field renderers preserve typed values and delegate dates and custom types to the host', () => {
	const row = { id: 0, text: 'caption', qty: 12, flag: false, payload: { seq: 2 }, date: 'D', time: 'T', active: 1 };
	const v = render(
		<TableUIProvider
			types={{ status: (v) => 'status ' + v }}
			formatters={{ date: (v) => 'date ' + v, datetime: (v) => 'time ' + v }}
		>
			<DataTable
				rowKey="id"
				rows={[row]}
				columns={[
					{ key: 'text', type: 'text' },
					{ key: 'qty', type: 'number' },
					{ key: 'flag', type: 'boolean' },
					{ key: 'payload', type: 'json' },
					{ key: 'date', type: 'date' },
					{ key: 'time', type: 'datetime' },
					{ key: 'active', type: 'status' },
					{ key: 'alias', dataIndex: 'active', type: 'status', formatter: (v) => 'override ' + v },
				]}
			/>
		</TableUIProvider>,
	);
	for (const text of ['caption', '12', 'No', '{"seq":2}', 'date D', 'time T', 'status 1', 'override 1'])
		assert.ok(v.getByRole('cell', { name: text }));
	for (const type of ['date', 'datetime', 'status'])
		assert.throws(() => render(<DataTable rows={[]} rowKey={() => 1} columns={[{ key: 'v', type }]} />), {
			name: 'TypeError',
			message: new RegExp(type),
		});
});

test('tree tooltip resolves the nested data path on its record', () => {
	const view = render(
		<DataTreeTable
			nodes={[{ id: 1, info: { text: 'leaf' }, children: [] }]}
			rowKey="id"
			childrenKey="children"
			columns={[{ key: 'text', dataIndex: ['info', 'text'], ellipsis: true, tooltip: (c) => 'detail ' + c.value }]}
		/>,
	);
	fireEvent.focus(view.getByText('leaf').closest('[tabindex]')!);
	const tooltip = view.getByRole('tooltip');
	assert.equal(tooltip.textContent, 'detail leaf');
	assert.equal(tooltip.closest('.axc-table-ellipsis'), null);
});
test('tree rejects malformed children, duplicate descendant keys and conflicting expansion modes', () => {
	const props = {
		nodes: [{ id: 1, children: [] }],
		rowKey: 'id' as const,
		childrenKey: 'children' as const,
		columns: [{ key: 'id' }],
	};
	assert.throws(() => render(<DataTreeTable {...props} nodes={[{ id: 1, children: null }]} />), {
		name: 'TypeError',
		message: /childrenKey/,
	});
	assert.throws(() => render(<DataTreeTable {...props} nodes={[{ id: 1, children: [{ id: 1 }] }]} />), {
		name: 'TypeError',
		message: /rowKey/,
	});
	// @ts-expect-error Untyped consumers can submit conflicting expansion sources.
	assert.throws(() => render(<DataTreeTable {...props} expandedRowKeys={[]} defaultExpandAll />), {
		name: 'TypeError',
		message: /expansion/,
	});
});
