import assert from 'node:assert/strict';
import test from 'node:test';
import { indexRows, togglePageSelection } from '../src/core/selection.js';

test('page selection preserves hidden keys, identity and order', () => {
	const first = ['hidden', '1'];
	const page = [1, '1', 2];
	assert.deepEqual(togglePageSelection(first, page, true), ['hidden', '1', 1, 2]);
	assert.deepEqual(togglePageSelection(first, page, false), ['hidden']);
	assert.deepEqual(first, ['hidden', '1']);
});
test('row identity is explicit and unique across the current dataset', () => {
	const rows = [{ id: '1' }, { id: 1 }];
	// @ts-expect-error A missing key is invalid even when the dataset is empty.
	assert.throws(() => indexRows([]), /rowKey is required/);
	assert.deepEqual([...indexRows(rows, 'id').values()], rows);
	assert.throws(() => indexRows(rows, () => 'same'), /Duplicate rowKey/);
	for (const value of [undefined, {}]) {
		// @ts-expect-error Invalid key returned by an untyped consumer.
		assert.throws(() => indexRows(rows, () => value), TypeError);
	}
});

import { columnWidths, cellValue, tableHeight } from '../src/core/columns.js';
test('column bounds, explicit widths and numeric path segments', () => {
	const columns = [
		{ key: 'a', minWidth: 20, maxWidth: 100 },
		{ key: 'b', width: 80, fixed: 'left' as const },
		{ key: 'c', minWidth: 190 },
		{ key: 'd', maxWidth: 25 },
		{ key: 'e', actionLayout: true, fixed: 'right' as const },
	];
	assert.deepEqual({ ...columnWidths(columns, { a: 64 }) }, { a: 64, b: 80, c: 190, d: 25, e: 160 });
	assert.equal(columnWidths([{ key: 'e', fixed: 'right' }], { e: 10 }).e, 10);
	for (const c of [
		{ width: -1 },
		{ width: NaN },
		{ minWidth: Infinity },
		{ minWidth: 21, maxWidth: 20 },
		{ minWidth: 80, width: 70 },
		{ width: 80, maxWidth: 70 },
	])
		assert.throws(() => columnWidths([{ key: 'col', ...c }], {}), { name: 'TypeError', message: /col/ });
	assert.throws(() => columnWidths([{ key: 'col' }, { key: 'col' }], {}), { name: 'TypeError', message: /column key/ });
	assert.equal(cellValue({ items: [{ v: false }] }, ['items', 0, 'v']), false);
	assert.equal(cellValue({ items: null }, ['items', 0]), undefined);
	assert.equal(cellValue([42], 0), 42);
	assert.equal(tableHeight({ fillHeight: true }), '100%');
	assert.equal(tableHeight({ height: 12 }), 12);
	assert.throws(() => tableHeight({ fillHeight: true, height: 72 }), { name: 'TypeError', message: /fillHeight/ });
});
