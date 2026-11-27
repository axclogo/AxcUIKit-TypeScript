import { useTableUI } from './ui/provider.js';
import type { DataColumn, DataTableProps, TableCell } from './types.js';
import { TableBody } from './BaseTable.js';
export function useCellFormatter() {
	const { types, formatters, locale } = useTableUI();
	return function formatter<Row, Cell extends TableCell<Row>>(column: DataColumn<Row, Cell>) {
		const kind = column.type ?? 'text';
		const custom = types && Object.hasOwn(types, kind) ? types[kind] : undefined;
		if (!custom && !['text', 'number', 'boolean', 'json', 'date', 'datetime'].includes(kind))
			throw new TypeError('Unregistered column type: ' + kind);
		if ((kind === 'date' || kind === 'datetime') && !formatters?.[kind])
			throw new TypeError('Missing formatter for ' + kind);
		return (cell: Cell) => {
			if (column.render) return column.render(cell);
			const { value, row, rowIndex } = cell;
			if (column.formatter) return column.formatter(value, row, rowIndex);
			if (custom) return custom(value);
			if (value === undefined || value === null) return '';
			if (kind === 'date' || kind === 'datetime') return formatters![kind]!(value);
			if (kind === 'boolean') {
				if (typeof value !== 'boolean') throw new TypeError(column.key + ' must contain a boolean');
				return value ? locale.yes : locale.no;
			}
			if (kind === 'number' && typeof value !== 'number') throw new TypeError(column.key + ' must contain a number');
			return kind === 'json' || typeof value === 'object' ? JSON.stringify(value) : String(value);
		};
	};
}
export function useDataColumns<Row>(columns: readonly DataColumn<Row>[]) {
	const format = useCellFormatter();
	return columns.map((column) => ({ ...column, render: format(column) }));
}
/** Display typed fields using the shared table engine. Unknown types and missing date formatters throw TypeError. */
export function DataTable<Row>(props: DataTableProps<Row>) {
	const columns = useDataColumns(props.columns);
	return <TableBody {...props} columns={columns} />;
}
