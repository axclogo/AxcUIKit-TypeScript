import type { RowKey, TableKey } from './index.js';

/** Index the current rows without changing key types. Invalid or duplicate keys throw TypeError. */
export function indexRows<Row>(rows: readonly Row[], rowKey: RowKey<Row>): Map<TableKey, Row> {
	if (rowKey === undefined) throw new TypeError('rowKey is required, received undefined');
	const index = new Map<TableKey, Row>();
	for (const [position, row] of rows.entries()) {
		const key = typeof rowKey === 'function' ? rowKey(row) : row[rowKey];
		if (typeof key !== 'string' && typeof key !== 'number')
			throw new TypeError(`rowKey at rows[${position}] must return a string or number, received ${String(key)}`);
		if (index.has(key)) throw new TypeError(`Duplicate rowKey at rows[${position}]: ${key}`);
		index.set(key, row);
	}
	return index;
}

/** Add or remove selectable page keys, preserving off-page selection and insertion order. */
export function togglePageSelection(
	selected: readonly TableKey[],
	page: readonly TableKey[],
	checked: boolean,
): TableKey[] {
	const next = new Set(selected);
	for (const key of page) {
		if (checked) next.add(key);
		else next.delete(key);
	}
	return [...next];
}
