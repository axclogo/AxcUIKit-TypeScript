import { useMemo, useState } from 'react';
import { TableBody, useSelection } from './BaseTable.js';
import { useCellFormatter } from './DataTable.js';
import { useTableUI } from './ui/provider.js';
import type { TableKey } from './core/index.js';
import { mapRowAction, BatchBar } from './actions.js';
import { tableHeight } from './core/columns.js';
import { indexRows } from './core/selection.js';
import type { DataTreeTableProps, TreeLocation, TreeMove, TableDrop, TableColumn } from './types.js';

interface Branch<Row> extends TreeLocation<Row> {
	children?: readonly Row[];
	subtreeHeight: number;
}
function treeModel<Row>(
	nodes: readonly Row[],
	rowKey: DataTreeTableProps<Row>['rowKey'],
	childrenKey: DataTreeTableProps<Row>['childrenKey'],
) {
	const byKey = new Map<TableKey, Branch<Row>>();
	const rows = new Map<TableKey, Row>();
	const visit = (siblings: readonly Row[], path: readonly TableKey[]) => {
		const keys = indexRows(siblings, rowKey);
		let height = 0,
			index = 0;
		for (const [key, row] of keys) {
			if (byKey.has(key)) throw new TypeError('Duplicate tree rowKey: ' + key);
			const children: unknown = typeof childrenKey === 'function' ? childrenKey(row) : row[childrenKey];
			if (children !== undefined && !Array.isArray(children))
				throw new TypeError('childrenKey must return an array or undefined at ' + key);
			const item: Branch<Row> = {
				row,
				rowKey: key,
				rowIndex: byKey.size,
				depth: path.length,
				parentKey: path.at(-1),
				index: index++,
				path: [...path, key],
				expanded: false,
				hasChildren: !!children?.length,
				children,
				subtreeHeight: 0,
			};
			byKey.set(key, item);
			rows.set(key, row);
			if (children?.length) item.subtreeHeight = 1 + visit(children, item.path);
			height = Math.max(height, item.subtreeHeight);
		}
		return height;
	};
	visit(nodes, []);
	return { byKey, rows };
}
/** Render a tree through BaseTable. Duplicate keys, non-array children and conflicting expansion inputs throw TypeError. */
export function DataTreeTable<Row>(props: DataTreeTableProps<Row>) {
	const { nodes, rowKey, childrenKey, dragDrop, columns } = props;
	const model = useMemo(() => treeModel(nodes, rowKey, childrenKey), [nodes, rowKey, childrenKey]);
	if (
		(props.expandedRowKeys !== undefined &&
			(props.defaultExpandAll !== undefined || props.defaultExpandedRowKeys !== undefined)) ||
		(props.defaultExpandAll && props.defaultExpandedRowKeys !== undefined)
	)
		throw new TypeError('Conflicting controlled/default tree expansion');
	const [initial, setInitial] = useState<readonly TableKey[]>(() =>
		props.defaultExpandAll
			? [...model.byKey.values()].filter((n) => n.hasChildren).map((n) => n.rowKey)
			: (props.defaultExpandedRowKeys ?? []),
	);
	const keys = new Set(props.expandedRowKeys ?? initial);
	const locations = new Map([...model.byKey].map(([k, n]) => [k, { ...n, expanded: n.hasChildren && keys.has(k) }]));
	const visible = [...locations.values()].filter((n) => n.path.slice(0, -1).every((k) => keys.has(k)));
	const toggle = (n: Branch<Row>) => {
		const next = new Set(keys);
		if (next.has(n.rowKey)) next.delete(n.rowKey);
		else next.add(n.rowKey);
		const value = [...next];
		if (props.expandedRowKeys === undefined) setInitial(value);
		props.onExpandedRowKeysChange?.(
			value,
			value.filter((k) => model.rows.has(k)).map((k) => model.rows.get(k)!),
		);
	};
	const format = useCellFormatter(),
		{
			controls: { Button },
			locale,
		} = useTableUI();
	const expansion = props.expandColumnKey ?? columns[0]?.key;
	const adapted: TableColumn<Branch<Row>>[] = columns.map((c) => {
		const render = format(c);
		const { className, tooltip } = c;
		return {
			...c,
			dataIndex: ['row', ...(typeof c.dataIndex === 'object' ? c.dataIndex : [c.dataIndex ?? c.key])],
			className: typeof className === 'function' ? (n) => className(n.row, n.rowIndex) : className,
			tooltip: typeof tooltip === 'function' ? (cell) => tooltip({ ...cell.row, value: cell.value }) : tooltip,
			render: ({ row: n, value }) => {
				const content = render({ ...n, value });
				if (c.key !== expansion) return content;
				return (
					<span style={{ paddingInlineStart: n.depth * (props.indentSize ?? 16) }}>
						{n.hasChildren && (
							<Button label={n.expanded ? locale.collapse : locale.expand} onClick={() => toggle(n)}>
								{n.expanded ? '▾' : '▸'}
							</Button>
						)}
						{content}
						{n.children && props.childCount && (
							<> ({typeof props.childCount === 'function' ? props.childCount(n.row, n.children) : n.children.length})</>
						)}
					</span>
				);
			},
		};
	});
	const s = props.selection;
	const selection = useSelection<Row, TreeLocation<Row>>(s, model.rows);
	const move = ({ drag, target, position }: TableDrop<Branch<Row>>): TreeMove<Row> | undefined => {
		const source = drag.row,
			dest = target.row;
		if (dest.path.includes(source.rowKey)) return;
		const inside = position === 'inside';
		const parent = inside ? dest.rowKey : dest.parentKey;
		let index = inside ? (dest.children?.length ?? 0) : dest.index + Number(position === 'after');
		const depth = dest.depth + Number(inside);
		if (parent === source.parentKey) {
			if (source.index < index) index--;
			if (source.index === index) return;
		}
		if (dragDrop?.maxDepth !== undefined && depth + source.subtreeHeight > dragDrop.maxDepth) return;
		return { drag: source, target: dest, position, nextParentKey: parent, nextDepth: depth, nextIndex: index };
	};
	const actions = props.actions?.map((a) => mapRowAction(a, (item: Branch<Row>) => item.row));
	return (
		<section
			className={'axc-table-tree ' + (props.className ?? '')}
			style={{ ...props.style, height: tableHeight(props) ?? props.style?.height }}
		>
			<BatchBar actions={props.batchActions} context={selection.context} />
			<TableBody<Branch<Row>>
				resolveTreeDrop
				{...props}
				rows={visible}
				rowKey="rowKey"
				columns={adapted}
				actions={actions}
				className={undefined}
				style={undefined}
				fillHeight={false}
				height={undefined}
				selection={
					s && {
						selectedRowKeys: selection.keys,
						columnWidth: s.columnWidth,
						canSelect: (n) => s.canSelect?.(n, n.rowIndex) ?? true,
						onChange: selection.change,
					}
				}
				rowDragDrop={
					dragDrop && {
						allowedPositions: dragDrop.allowedPositions ?? ['before', 'inside', 'after'],
						columnWidth: dragDrop.columnWidth,
						canDrag: (n) => dragDrop.canDrag?.(n.row) ?? true,
						canDrop: (drop) => {
							const m = move(drop);
							return !!m && (dragDrop.canDrop?.(m) ?? true);
						},
						onDrop: (drop) => dragDrop.onMove(move(drop)!),
					}
				}
				onRowClick={(n, _i, e) => {
					if (n.hasChildren && props.expandOnRowClick !== false) toggle(n);
					props.onRowClick?.(n.row, n.rowIndex, e);
				}}
			/>
		</section>
	);
}
