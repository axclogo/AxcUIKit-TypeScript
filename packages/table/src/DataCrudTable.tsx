import { RefreshButton } from './table-task.js';
import { tableHeight } from './core/columns.js';
import type { DataCrudTableProps, CrudMove, TableDrop, TableOption } from './types.js';
import { useDataColumns } from './DataTable.js';
import { TableBody } from './BaseTable.js';
import { useTableUI } from './ui/provider.js';

function reorder<Row>({ drag, target, position }: TableDrop<Row>): CrudMove<Row> | undefined {
	if (position === 'inside') return;
	const nextIndex = target.rowIndex + Number(position === 'after') - Number(drag.rowIndex < target.rowIndex);
	if (nextIndex !== drag.rowIndex) return { drag, target, position, nextIndex };
}
/** Compose a controlled list with explicit filters and same-page reorder. Invalid filter declarations throw TypeError. */
export function DataCrudTable<Row>(p: DataCrudTableProps<Row>) {
	const {
		controls: { Input, Select, MultiSelect, Button, Pagination },
		locale,
	} = useTableUI();
	const filters = p.filters ?? [],
		values = p.filterValues ?? {},
		keyword = p.keyword ?? '';
	const columns = useDataColumns(p.columns);
	const keys = new Set<string>();
	const controls = filters.map((f) => {
		if (keys.has(f.key)) throw new TypeError('Duplicate filter key: ' + f.key);
		keys.add(f.key);
		const { key, type } = f;
		const value = Object.hasOwn(values, key) ? values[key] : undefined;
		const change = (v: unknown) => {
			const next = { ...values, [key]: v };
			if (v === undefined) Reflect.deleteProperty(next, key);
			p.onFilterValuesChange?.(next);
		};
		let control;
		switch (f.type) {
			case 'select':
			case 'multiSelect': {
				if (!f.options?.length) throw new TypeError('Filter ' + f.key + ' requires options');
				control =
					f.type === 'select' ? (
						<Select
							clearable
							label={f.label}
							value={value as TableOption['value'] | undefined}
							options={f.options}
							onChange={change}
						/>
					) : (
						<MultiSelect
							label={f.label}
							value={(value ?? []) as readonly TableOption['value'][]}
							options={f.options}
							onChange={change}
						/>
					);
				break;
			}
			case 'custom':
				if (typeof f.render !== 'function') throw new TypeError('Custom filter ' + f.key + ' requires render');
				control = f.render(value, change);
				break;
			default:
				throw new TypeError('Unknown filter type for ' + key + ': ' + String(type));
		}
		return (
			<label key={f.key} style={{ width: f.width }}>
				{f.label}
				{control}
			</label>
		);
	});
	const search = () => p.onSearch?.(keyword.trim(), values);
	const drag = p.dragSort;
	return (
		<section
			className={'axc-table-crud ' + (p.className ?? '')}
			style={{ ...p.style, height: tableHeight(p) ?? p.style?.height }}
		>
			<div className="axc-table-tools">
				{p.primaryActions}
				{(p.keyword !== undefined || p.onKeywordChange) && (
					<span
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.nativeEvent.isComposing) search();
						}}
					>
						<Input
							label={p.searchPlaceholder ?? locale.search}
							value={keyword}
							onChange={(v) => p.onKeywordChange?.(v)}
						/>
					</span>
				)}
				{controls}
				{p.onSearch && (
					<Button label={locale.search} onClick={search}>
						{locale.search}
					</Button>
				)}
				{(filters.length > 0 || p.onResetFilters) && (
					<Button
						label={locale.reset}
						onClick={() => {
							p.onKeywordChange?.('');
							p.onFilterValuesChange?.({});
							p.onResetFilters?.();
						}}
					>
						{locale.reset}
					</Button>
				)}
				{p.onRefresh && <RefreshButton onRefresh={p.onRefresh} loading={p.refreshLoading} />}
				{p.toolbarRight}
			</div>
			<TableBody<Row>
				{...p}
				fillHeight={false}
				height={undefined}
				style={undefined}
				className={p.tableClassName}
				columns={columns}
				selectionActions={p.batchActions}
				rowDragDrop={
					drag && {
						allowedPositions: ['before', 'after'],
						columnWidth: drag.columnWidth,
						canDrag: drag.canDrag,
						canDrop: (d) => {
							const move = reorder(d);
							return !!move && (drag.canDrop?.(move) ?? true);
						},
						onDrop: (d) => drag.onMove(reorder(d)!),
					}
				}
			/>
			{p.pagination && <Pagination {...p.pagination} />}
		</section>
	);
}
