import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { act, render, cleanup, fireEvent } from '@testing-library/react';
import { DataCrudTable, TableUIProvider } from '../src/index.js';
afterEach(cleanup);
const props = { rowKey: 'id' as const, rows: [{ id: 1 }], columns: [{ key: 'id' }] };
test('filters independent of displayed columns preserve typed option values and other filters', () => {
	let result: unknown;
	const v = render(
		<DataCrudTable
			{...props}
			filters={[{ type: 'select', key: 'flag', label: 'Flag', options: [{ value: false, label: 'Off' }] }]}
			filterValues={{ a: 1 }}
			onFilterValuesChange={(v) => {
				result = v;
			}}
		/>,
	);
	fireEvent.change(v.getByRole('combobox', { name: 'Flag' }), { target: { value: '0' } });
	assert.deepEqual(result, { a: 1, flag: false });
});
test('duplicate and incomplete filter declarations fail visibly', () => {
	const f = { type: 'select' as const, key: 'tag', label: 'Tag', options: [{ label: 'First', value: 1 }] };
	assert.throws(() => render(<DataCrudTable {...props} filters={[f, f]} />), /Duplicate filter key/);
	assert.throws(() => render(<DataCrudTable {...props} filters={[{ ...f, options: [] }]} />), /requires options/);
});

test('CRUD search, clearing one filter and full-key batch operations use the current controlled view', () => {
	let search: unknown,
		change: unknown,
		batch: unknown,
		page = 0;
	const v = render(
		<TableUIProvider
			onActionError={(e) => {
				throw e;
			}}
		>
			<DataCrudTable
				{...props}
				keyword="term"
				filters={[{ type: 'select', key: 'flag', label: 'Flag', options: [{ label: 'Off', value: false }] }]}
				filterValues={{ flag: false, other: 2 }}
				onFilterValuesChange={(next) => {
					change = next;
				}}
				onSearch={(kw, values) => {
					search = [kw, values];
				}}
				pagination={{
					page: 1,
					pageSize: 1,
					total: 3,
					onPageChange: (n) => {
						page = n;
					},
					onPageSizeChange: () => {},
				}}
				selection={{ selectedRowKeys: ['earlier', 1, 'earlier'] }}
				batchActions={[
					{
						key: 'take',
						label: 'Take',
						onClick: (ctx) => {
							batch = [ctx.selectedRowKeys, ctx.selectedRows, ctx.selectedCount];
						},
					},
				]}
			/>
		</TableUIProvider>,
	);
	fireEvent.click(v.getByRole('button', { name: 'Take' }));
	assert.deepEqual(batch, [['earlier', 1], props.rows, 2]);
	fireEvent.click(v.getByRole('button', { name: 'Search' }));
	assert.deepEqual(search, ['term', { flag: false, other: 2 }]);
	fireEvent.change(v.getByRole('combobox', { name: 'Flag' }), { target: { value: '-1' } });
	assert.deepEqual(change, { other: 2 });
	fireEvent.click(v.getByRole('button', { name: 'Next page' }));
	assert.equal(page, 2);
});
test('CRUD rejects unsupported and incomplete filters and batch action configuration', () => {
	// @ts-expect-error Unsupported filter declaration.
	assert.throws(() => render(<DataCrudTable {...props} filters={[{ type: 'text', key: 'x', label: 'X' }]} />), {
		name: 'TypeError',
		message: /filter type/,
	});
	// @ts-expect-error Missing custom renderer.
	assert.throws(() => render(<DataCrudTable {...props} filters={[{ type: 'custom', key: 'x', label: 'X' }]} />), {
		name: 'TypeError',
		message: /render/,
	});
	assert.throws(
		() => render(<DataCrudTable {...props} batchActions={[{ key: 'go', label: 'Go', onClick: () => {} }]} />),
		{ name: 'TypeError', message: /onActionError/ },
	);
});

test('reset clears controlled inputs before notifying the host, and search trims the submitted keyword', () => {
	const events: unknown[] = [];
	const f = { type: 'select' as const, key: 'category', label: 'Category', options: [{ value: 2, label: 'Two' }] };
	const v = render(
		<DataCrudTable
			{...props}
			keyword="  word  "
			filters={[f]}
			filterValues={{ category: 2 }}
			onKeywordChange={(k) => events.push(k)}
			onFilterValuesChange={(f) => events.push(f)}
			onResetFilters={() => events.push('reset')}
			onSearch={(k, f) => events.push([k, f])}
		/>,
	);
	fireEvent.click(v.getByRole('button', { name: 'Search' }));
	fireEvent.click(v.getByRole('button', { name: 'Reset' }));
	assert.deepEqual(events, [['word', { category: 2 }], '', {}, 'reset']);
});

test('Enter commits the search only after input composition finishes', () => {
	const searches: string[] = [];
	const v = render(<DataCrudTable {...props} keyword="标题" onSearch={(text) => searches.push(text)} />);
	const input = v.getByRole('textbox');
	fireEvent.compositionStart(input);
	fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
	assert.deepEqual(searches, []);
	fireEvent.compositionEnd(input);
	fireEvent.keyDown(input, { key: 'Enter' });
	assert.deepEqual(searches, ['标题']);
});

function pending<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

test('pending approval and mutation block repeat clicks only on their own action and recover on failure', async () => {
	const approval = pending<boolean>(),
		mutation = pending<undefined>();
	const failure = Error('write failed');
	let confirmations = 0,
		writes = 0,
		reported: unknown;
	const v = render(
		<TableUIProvider
			confirm={() => {
				confirmations++;
				return approval.promise;
			}}
			onActionError={(e) => {
				reported = e;
			}}
		>
			<DataCrudTable
				{...props}
				rows={[{ id: 1 }, { id: 2 }]}
				actions={[
					{
						key: 'remove',
						label: 'Delete',
						confirm: 'Delete this row?',
						onClick: () => {
							writes++;
							return mutation.promise;
						},
					},
				]}
			/>
		</TableUIProvider>,
	);
	const [first, second] = v.getAllByRole('button', { name: 'Delete' });
	fireEvent.click(first);
	assert.equal(first.hasAttribute('disabled'), true);
	assert.equal(second.hasAttribute('disabled'), false);
	fireEvent.click(first);
	assert.equal(confirmations, 1);
	await act(async () => approval.resolve(true));
	fireEvent.click(first);
	assert.equal(writes, 1);
	await act(async () => mutation.reject(failure));
	assert.equal(reported, failure);
	assert.equal(first.hasAttribute('disabled'), false);
});

test('batch confirmation submits the same keys shown when the prompt opened', () => {
	let removed: readonly (number | string)[] = [];
	const view = (keys: number[]) => (
		<TableUIProvider
			onActionError={(e) => {
				throw e;
			}}
		>
			<DataCrudTable
				{...props}
				selection={{ selectedRowKeys: keys }}
				batchActions={[
					{
						key: 'remove',
						label: 'Delete',
						confirm: ({ selectedRowKeys }) => 'Delete ' + selectedRowKeys.join(',') + '?',
						onClick: ({ selectedRowKeys }) => {
							removed = selectedRowKeys;
						},
					},
				]}
			/>
		</TableUIProvider>
	);
	const v = render(view([1]));
	fireEvent.click(v.getByRole('button', { name: 'Delete' }));
	v.rerender(view([1, 2]));
	assert.ok(v.getByText('Delete 1?'));
	fireEvent.click(v.getByRole('button', { name: 'Confirm' }));
	assert.deepEqual(removed, [1]);
});

test('a failed refresh reports the original error and allows retry', async () => {
	const request = pending<undefined>();
	let tries = 0,
		reported: unknown;
	const failure = Error('read failed');
	const v = render(
		<TableUIProvider
			onActionError={(e) => {
				reported = e;
			}}
		>
			<DataCrudTable
				{...props}
				onRefresh={() => {
					if (++tries === 1) return request.promise;
				}}
			/>
		</TableUIProvider>,
	);
	const refresh = v.getByRole('button', { name: 'Refresh' });
	fireEvent.click(refresh);
	assert.equal(refresh.hasAttribute('disabled'), true);
	fireEvent.click(refresh);
	assert.equal(tries, 1);
	await act(async () => request.reject(failure));
	assert.equal(reported, failure);
	assert.equal(refresh.hasAttribute('disabled'), false);
	fireEvent.click(refresh);
	assert.equal(tries, 2);
});
