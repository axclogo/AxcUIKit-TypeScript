import { ActionLayout, useActionWidths } from './action-layout.js';
import { DragHandle } from './ui/controls.js';
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useTableUI } from './ui/provider.js';
import { indexRows, togglePageSelection } from './core/selection.js';
import { cellValue, columnWidths, positive, tableHeight } from './core/columns.js';
import type { TableKey } from './core/index.js';
import type {
	TableAction,
	TableBatchContext,
	TableSelection,
	BaseTableProps,
	DropPosition,
	TableColumn,
	TableDrop,
} from './types.js';
import { ActionButtons, BatchBar } from './actions.js';
import { useRowWindow } from './use-window.js';

const densityHeight = { compact: 30, normal: 44, spacious: 68 };
const dropPositions: DropPosition[] = ['before', 'inside', 'after'];
function id(key: TableKey) {
	return typeof key + ':' + key;
}
export function useSelection<Row, Item = Row>(
	selection: TableSelection<Row, Item> | undefined,
	index: ReadonlyMap<TableKey, Row>,
) {
	const [local, setLocal] = useState<readonly TableKey[]>(selection?.defaultSelectedRowKeys ?? []);
	if (selection?.selectedRowKeys !== undefined && selection.defaultSelectedRowKeys !== undefined)
		throw new TypeError('selection cannot combine selectedRowKeys and defaultSelectedRowKeys');
	const keys = [...new Set(selection?.selectedRowKeys ?? local)];
	const records = (values: readonly TableKey[]) => values.filter((k) => index.has(k)).map((k) => index.get(k)!);
	const change = (next: TableKey[]) => {
		if (selection?.selectedRowKeys === undefined) setLocal(next);
		selection?.onChange?.(next, records(next));
	};
	return {
		keys,
		change,
		context: {
			selectedRowKeys: keys,
			selectedRows: records(keys),
			selectedCount: keys.length,
			clearSelection: () => change([]),
		},
	};
}
function capture(
	e: PointerEvent<HTMLElement>,
	move: (event: globalThis.PointerEvent) => void,
	end: (event: globalThis.PointerEvent) => void,
	cancel: () => void,
) {
	const el = e.currentTarget;
	el.setPointerCapture(e.pointerId);
	const cleanup = () => {
		el.removeEventListener('pointermove', move);
		el.removeEventListener('pointerup', finish);
		el.removeEventListener('lostpointercapture', lost);
	};
	const finish = (event: globalThis.PointerEvent) => {
		cleanup();
		end(event);
	};
	const lost = () => {
		cleanup();
		cancel();
	};
	el.addEventListener('pointermove', move);
	el.addEventListener('pointerup', finish);
	el.addEventListener('lostpointercapture', lost);
}
type Entry<Row> =
	| { group: true; title: React.ReactNode; key: string }
	| { group: false; row: Row; rowIndex: number; rowKey: TableKey; key: string };
/** Render a keyed table. Invalid keys, widths, state modes or action configuration throw TypeError. */
export function BaseTable<Row>(props: BaseTableProps<Row>) {
	return <TableBody {...props} />;
}

export function TableBody<Row>(
	props: BaseTableProps<Row> & {
		rowColor?: (row: Row) => string | undefined;
		resolveTreeDrop?: boolean;
		selectionActions?: readonly TableAction<TableBatchContext<Row>>[];
	},
) {
	const { columns, selection, rowDragDrop: drag, columnSizing, actions } = props;
	const {
		controls: { Checkbox, Empty, Loading, Tooltip },
		locale,
		onActionError,
	} = useTableUI();
	if ((props.rows === undefined) === (props.groups === undefined))
		throw new TypeError('Supply exactly one of rows and groups');
	const density = props.density ?? 'normal';
	if (!Object.hasOwn(densityHeight, density)) throw new TypeError('Unknown density: ' + density);
	positive('rowHeight', props.rowHeight);
	positive('selection.columnWidth', selection?.columnWidth);
	positive('rowDragDrop.columnWidth', drag?.columnWidth);
	if (drag?.allowedPositions?.some((p) => !dropPositions.includes(p)))
		throw new TypeError('Invalid rowDragDrop.allowedPositions');
	if (actions?.length && !onActionError) throw new TypeError('actions require onActionError');
	const height = props.rowHeight ?? densityHeight[density];
	const model = useMemo(() => {
		const rows = props.rows ?? props.groups!.flatMap((g) => g.rows);
		const index = indexRows(rows, props.rowKey);
		const items = Array.from(index, ([rowKey, row], rowIndex) => ({
			group: false as const,
			row,
			rowKey,
			rowIndex,
			key: id(rowKey),
		}));
		let offset = 0;
		const entries: Entry<Row>[] = props.groups
			? props.groups.flatMap<Entry<Row>>((g) => {
					const start = offset;
					offset += g.rows.length;
					return [{ group: true, title: g.title, key: 'group:' + id(g.key) }, ...items.slice(start, offset)];
				})
			: items;
		return { index, items, entries, keys: entries.map((e) => e.key) };
	}, [props.rows, props.groups, props.rowKey]);
	const state = useSelection(selection, model.index);
	const selected = new Set(state.keys);
	const selectable = model.items
		.filter((i) => !selection?.canSelect || selection.canSelect(i.row, i.rowIndex))
		.map((i) => i.rowKey);
	const selectableSet = new Set(selectable);
	const count = selectable.filter((k) => selected.has(k)).length;
	const [localWidths, setWidths] = useState<Record<string, number>>({});
	const [preview, setPreview] = useState<{ key: string; width: number }>();
	const widths = columnWidths(columns, columnSizing?.widths ?? localWidths);
	if (preview) widths[preview.key] = preview.width;
	const scroll = useRef<HTMLDivElement>(null);
	const intrinsic = useActionWidths(scroll, !!props.virtualized);
	const actionWidth = intrinsic.get('__actions') ?? 80;
	for (const c of columns) if (c.actionLayout) widths[c.key] = intrinsic.get(c.key) ?? 64;
	const engine = useRowWindow(scroll, model.keys, height, !!props.virtualized);
	const items = props.virtualized ? engine.getVirtualItems() : undefined;
	const commit = (key: string, width: number) => {
		const next = { ...widths, [key]: width };
		setPreview(undefined);
		if (!columnSizing?.widths) setWidths(next);
		columnSizing?.onResizeEnd?.(key, width, next);
	};
	const resize = (e: PointerEvent<HTMLElement>, c: TableColumn<Row>) => {
		e.preventDefault();
		const initial = e.clientX,
			start = widths[c.key];
		const value = (x: number) => Math.max(c.minWidth ?? 1, Math.min(c.maxWidth ?? Infinity, start + x - initial));
		capture(
			e,
			(p) => setPreview({ key: c.key, width: value(p.clientX) }),
			(p) => commit(c.key, value(p.clientX)),
			() => setPreview(undefined),
		);
	};
	const [hover, setHover] = useState<{ key: TableKey; position: DropPosition }>();
	const startDrag = (e: PointerEvent<HTMLElement>, source: (typeof model.items)[number]) => {
		e.preventDefault();
		const locate = (event: globalThis.PointerEvent): TableDrop<Row> | undefined => {
			const tr = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-axc-row]');
			if (!tr || tr.closest('.axc-table') !== scroll.current) return;
			const target = model.items[Number(tr.dataset.axcRow)];
			if (target.rowKey === source.rowKey) return;
			const rect = tr.getBoundingClientRect(),
				fraction = (event.clientY - rect.top) / rect.height;
			const preferred: DropPosition[] =
				fraction < 1 / 3
					? ['before', 'inside', 'after']
					: fraction > 2 / 3
						? ['after', 'inside', 'before']
						: ['inside', fraction < 0.5 ? 'before' : 'after', fraction < 0.5 ? 'after' : 'before'];
			for (const position of preferred) {
				const drop = { drag: source, target, position };
				if (!(drag!.allowedPositions ?? ['before', 'after']).includes(position)) continue;
				if (!drag!.canDrop || drag!.canDrop(drop)) return drop;
				if (!props.resolveTreeDrop) return;
			}
		};
		capture(
			e,
			(p) => {
				const next = locate(p);
				setHover(next && { key: next.target.rowKey, position: next.position });
			},
			(p) => {
				setHover(undefined);
				const next = locate(p);
				if (next) {
					void Promise.resolve()
						.then(() => drag!.onDrop(next))
						.catch((error) => {
							if (onActionError) onActionError(error);
							else throw error;
						});
				}
			},
			() => setHover(undefined),
		);
	};
	const fixedAction = props.actionColumnFixed === undefined ? 'right' : props.actionColumnFixed;
	const left = columns.filter((c) => c.fixed === 'left'),
		right = columns.filter((c) => c.fixed === 'right');
	const ordered = [...left, ...columns.filter((c) => !c.fixed), ...right];
	const selectionWidth = selection?.columnWidth ?? 40,
		dragWidth = drag?.columnWidth ?? 32;
	const leftBase =
		(selection ? selectionWidth : 0) +
		(drag ? dragWidth : 0) +
		(actions?.length && fixedAction === 'left' ? actionWidth : 0);
	const style = (c: TableColumn<Row>): CSSProperties => {
		const i = (c.fixed === 'left' ? left : right).indexOf(c);
		const offset =
			c.fixed === 'left'
				? leftBase + left.slice(0, i).reduce((v, k) => v + widths[k.key], 0)
				: (actions?.length && fixedAction === 'right' ? actionWidth : 0) +
					right.slice(i + 1).reduce((v, k) => v + widths[k.key], 0);
		return {
			width: widths[c.key],
			textAlign: c.align,
			...(c.fixed && { position: 'sticky', [c.fixed]: offset, zIndex: 1 }),
		};
	};
	const extra = (width: number, offset: number): CSSProperties => ({
		width,
		minWidth: width,
		position: 'sticky',
		left: offset,
		zIndex: 1,
	});
	const acStyle: CSSProperties = fixedAction
		? {
				position: 'sticky',
				[fixedAction]: fixedAction === 'left' ? (drag ? dragWidth : 0) + (selection ? selectionWidth : 0) : 0,
				zIndex: 1,
			}
		: {};
	const main = (entry: Entry<Row>, i: number) => {
		const measure = props.virtualized ? engine.measureElement : undefined;
		if (entry.group)
			return (
				<tr key={entry.key} data-index={i} ref={measure}>
					<th colSpan={columns.length + Number(!!selection) + Number(!!drag) + Number(!!actions?.length)}>
						{entry.title}
					</th>
				</tr>
			);
		const { row, rowIndex, rowKey } = entry;
		const action = actions?.length ? (
			<td style={acStyle}>
				<ActionButtons column="__actions" item={row} actions={actions} />
			</td>
		) : null;
		return (
			<tr
				key={entry.key}
				data-index={i}
				ref={measure}
				data-axc-row={rowIndex}
				data-color={props.rowColor?.(row)}
				data-drop={hover?.key === rowKey ? hover.position : undefined}
				style={{ height }}
				onClick={(e) => {
					if (
						!(e.target as Element).closest('button,a,input,select,textarea,[role="button"],[data-interactive]') &&
						!window.getSelection()?.toString()
					)
						props.onRowClick?.(row, rowIndex, e);
				}}
			>
				{selection && (
					<td data-interactive="" style={extra(selectionWidth, 0)}>
						<Checkbox
							label={locale.select + ' ' + rowKey}
							value={selected.has(rowKey)}
							disabled={!selectableSet.has(rowKey)}
							onChange={(checked) => state.change(togglePageSelection(state.keys, [rowKey], checked))}
						/>
					</td>
				)}
				{drag && (
					<td style={extra(dragWidth, selection ? selectionWidth : 0)}>
						<DragHandle
							label={locale.drag + ' ' + rowKey}
							disabled={drag.canDrag && !drag.canDrag(entry)}
							onPointerDown={(e) => startDrag(e, entry)}
						/>
					</td>
				)}
				{fixedAction === 'left' && action}
				{ordered.map((c) => {
					const value = cellValue(row, c.dataIndex ?? c.key),
						ctx = { value, row, rowIndex };
					const content = c.render ? c.render(ctx) : value == null ? '' : String(value);
					const cell = c.actionLayout ? <ActionLayout column={c.key}>{content}</ActionLayout> : content;
					const label = c.ellipsis ? <span className="axc-table-ellipsis">{cell}</span> : cell;
					return (
						<td
							key={c.key}
							style={style(c)}
							className={typeof c.className === 'function' ? c.className(row, rowIndex) : c.className}
						>
							{c.tooltip ? (
								<Tooltip content={typeof c.tooltip === 'function' ? c.tooltip(ctx) : cell}>{label}</Tooltip>
							) : (
								label
							)}
						</td>
					);
				})}
				{fixedAction !== 'left' && action}
			</tr>
		);
	};
	const actionHead = actions?.length ? <th style={acStyle}>{locale.actions}</th> : null;
	const table = (
		<div
			ref={scroll}
			className={['axc-table', props.className].filter(Boolean).join(' ')}
			style={{ ...props.style, height: tableHeight(props) ?? props.style?.height }}
			aria-busy={props.loading}
		>
			<table
				style={{
					width:
						Object.values(widths).reduce((total, width) => total + width, 0) +
						(drag ? dragWidth : 0) +
						(selection ? selectionWidth : 0) +
						(actions?.length ? actionWidth : 0),
				}}
			>
				<colgroup>
					{selection && <col style={{ width: selectionWidth }} />}
					{drag && <col style={{ width: dragWidth }} />}
					{fixedAction === 'left' && actions?.length ? <col style={{ width: actionWidth }} /> : null}
					{ordered.map((c) => (
						<col key={c.key} style={{ width: widths[c.key] }} />
					))}
					{fixedAction !== 'left' && actions?.length ? <col style={{ width: actionWidth }} /> : null}
				</colgroup>
				{props.showHeader !== false && (
					<thead>
						<tr>
							{selection && (
								<th style={extra(selectionWidth, 0)}>
									<Checkbox
										label={locale.selectAll}
										value={count > 0 && count === selectable.length}
										indeterminate={count > 0 && count < selectable.length}
										disabled={!selectable.length}
										onChange={(v) => state.change(togglePageSelection(state.keys, selectable, v))}
									/>
								</th>
							)}
							{drag && <th style={extra(dragWidth, selection ? selectionWidth : 0)} />}
							{fixedAction === 'left' && actionHead}
							{ordered.map((c) => (
								<th key={c.key} style={style(c)} className={c.headerClassName}>
									{c.title ?? c.key}
									{!c.actionLayout && c.resizable !== false && (
										<span
											role="separator"
											aria-orientation="vertical"
											aria-label={locale.resize + ' ' + c.key}
											className="axc-table-resize"
											onPointerDown={(e) => resize(e, c)}
										/>
									)}
								</th>
							))}
							{fixedAction !== 'left' && actionHead}
						</tr>
					</thead>
				)}
				<tbody>
					{items?.length ? <tr aria-hidden="true" style={{ height: items[0].start }} /> : null}
					{items ? items.map((v) => main(model.entries[v.index], v.index)) : model.entries.map(main)}
					{items?.length ? (
						<tr aria-hidden="true" style={{ height: engine.getTotalSize() - items[items.length - 1].end }} />
					) : null}
				</tbody>
			</table>
			{props.loading ? (
				<Loading label={locale.loading} />
			) : (
				!model.items.length && <Empty>{props.empty ?? locale.empty}</Empty>
			)}
		</div>
	);
	return (
		<>
			{props.selectionActions && <BatchBar actions={props.selectionActions} context={state.context} />}
			{table}
		</>
	);
}
