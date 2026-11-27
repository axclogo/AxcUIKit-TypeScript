import { RefreshButton } from './table-task.js';
import { useMemo, useState } from 'react';
import { useTableUI } from './ui/provider.js';
import { TableBody } from './BaseTable.js';
import { useCellFormatter } from './DataTable.js';
import { ColumnSettings } from './column-settings.js';
import { ConditionDialog, conditionCatalog } from './analysis-dialogs.js';
import { ColorsDialog } from './color-rules-dialog.js';
import { columnWidths, cellValue, matchesColor, tableHeight } from './core/columns.js';
import type { AnalysisConfig, DataAnalysisTableProps, TableDensity } from './types.js';
/** Compose a controlled analysis view. Invalid field catalogs, duplicate keys and invalid widths throw TypeError. */
export function DataAnalysisTable<Row>(p: DataAnalysisTableProps<Row>) {
	const { config, fields, columns, onConfigChange: emit } = p;
	const {
		controls: { Button, Select, Modal, Input, Pagination },
		locale,
	} = useTableUI();
	const [dialog, open] = useState<'filters' | 'columns' | 'colors'>(),
		[term, setTerm] = useState(config.keyword),
		[previous, setPrevious] = useState(config.keyword);
	if (config.keyword !== previous) {
		setTerm(config.keyword);
		setPrevious(config.keyword);
	}
	const [sortDraft, setSortDraft] = useState<string>();
	const options = useMemo(() => conditionCatalog(fields), [fields]),
		format = useCellFormatter();
	const all = columns.map((c) => c.key),
		map = new Map(columns.map((c) => [c.key, c]));
	const ordered = [...config.columns.order, ...all.filter((k) => !config.columns.order.includes(k))];
	for (const list of [ordered, config.columns.visible]) {
		if (new Set(list).size !== list.length || list.some((k) => !map.has(k)))
			throw new TypeError('Invalid columns.order or columns.visible');
	}
	const visible = config.columns.visible.length ? config.columns.visible : all;
	const defaults = p.defaultColumnKeys?.length ? p.defaultColumnKeys : all;
	const byName = new Map(fields.map((f) => [f.name, f]));
	const effective = columns.map((c) => ({
		...c,
		width: c.width ?? byName.get(c.key)?.width,
		fixed: Object.hasOwn(config.columns.fixed, c.key) ? config.columns.fixed[c.key] : c.fixed,
	}));
	const measuredWidths = columnWidths(effective, config.columns.widths);
	const resetColumns = () =>
		setColumns({
			visible: defaults,
			order: defaults,
			widths: Object.fromEntries(
				effective
					.filter((c) => c.fixed && !c.actionLayout && c.width === undefined)
					.map((c) => [c.key, measuredWidths[c.key]]),
			),
		});
	const display = new Map(effective.map((c) => [c.key, c]));
	const rendered = ordered
		.filter((k) => visible.includes(k))
		.map((k) => {
			const c = display.get(k)!;
			return { ...c, render: format(c) };
		});
	const setColumns = (change: Partial<AnalysisConfig['columns']>) =>
		emit({ ...config, columns: { ...config.columns, ...change } });
	const sortables = fields.filter((f) => f.sortable),
		colors = fields.filter((f) => f.colorable || f.conditionable);
	const primary = config.sorters[0],
		sort = (field: string | undefined, direction: 'asc' | 'desc') =>
			emit({ ...config, sorters: field === undefined ? [] : [{ field, direction }] });
	const commands = {
		openFilter: () => open('filters'),
		openColumnSettings: () => open('columns'),
		openColorRules: () => open('colors'),
	};
	const submit = () => {
		const keyword = (p.searchMode === 'submit' ? term : config.keyword).trim();
		if (p.searchMode === 'submit' && keyword !== config.keyword) emit({ ...config, keyword });
		p.onSearch?.(keyword);
	};
	const directions = [
		{ value: 'asc', label: locale.asc },
		{ value: 'desc', label: locale.desc },
	];
	const rowColor = (row: Row) =>
		config.colorRules.find((rule) =>
			matchesColor(cellValue(row, map.get(rule.field)?.dataIndex ?? rule.field), rule.operator, rule.value),
		)?.color;
	return (
		<section className={'axc-table-analysis ' + (p.className ?? '')} style={{ height: tableHeight(p) }}>
			{p.title}
			{p.summary}
			{typeof p.savedViewTabs === 'function' ? p.savedViewTabs(commands) : p.savedViewTabs}
			<div className="axc-table-tools">
				{p.toolbarStart}
				{p.searchBefore}
				<span
					onKeyDown={(e) => {
						if (e.key === 'Enter') submit();
					}}
				>
					<Input
						label={p.searchPlaceholder ?? locale.search}
						value={p.searchMode === 'submit' ? term : config.keyword}
						onChange={(keyword) => {
							setTerm(keyword);
							if (p.searchMode !== 'submit') emit({ ...config, keyword });
						}}
					/>
				</span>
				{(p.searchMode === 'submit' || p.onSearch) && (
					<Button label={locale.search} onClick={submit}>
						{locale.search}
					</Button>
				)}
				{p.enableAdvancedFilter !== false && options.length > 0 && (
					<Button label={locale.filters} onClick={commands.openFilter}>
						{locale.filters}
					</Button>
				)}
				{sortables.length > 0 &&
					(p.sortControl === 'cascader' ? (
						<details
							onToggle={(e) => {
								if (e.currentTarget.open) setSortDraft(primary?.field);
							}}
						>
							<summary>{locale.sort}</summary>
							{sortables.map((f) => (
								<Button key={f.name} label={f.label} onClick={() => setSortDraft(f.name)}>
									{f.label}
								</Button>
							))}
							{sortDraft &&
								directions.map((d) => (
									<Button key={d.value} label={d.label} onClick={() => sort(sortDraft, d.value as 'asc' | 'desc')}>
										{d.label}
									</Button>
								))}
							<Button label={locale.clear} onClick={() => sort(undefined, 'asc')}>
								{locale.clear}
							</Button>
						</details>
					) : (
						<>
							<Select
								label={locale.sort}
								value={primary?.field}
								options={[
									{ value: '', label: locale.clear },
									...sortables.map((f) => ({ value: f.name, label: f.label })),
								]}
								onChange={(v) => sort(v === '' ? undefined : (v as string | undefined), primary?.direction ?? 'desc')}
							/>
							<Select
								label={locale.direction}
								options={directions}
								disabled={!primary}
								value={primary?.direction}
								onChange={(v) => sort(primary.field, v as 'asc' | 'desc')}
							/>
						</>
					))}
				<Select
					label={locale.density}
					value={config.rowHeight}
					options={(['compact', 'normal', 'spacious'] as const).map((v) => ({ value: v, label: locale[v] }))}
					onChange={(v) => emit({ ...config, rowHeight: v as TableDensity })}
				/>
				<Button label={locale.columns} onClick={commands.openColumnSettings}>
					{locale.columns}
				</Button>
				{p.enableColorRules !== false && colors.length > 0 && (
					<Button label={locale.colors} onClick={commands.openColorRules}>
						{locale.colors}
					</Button>
				)}
				{p.toolbarLeft}
				{p.onRefresh && <RefreshButton onRefresh={p.onRefresh} />}
				{p.toolbarRight}
			</div>
			{p.notice}
			<TableBody
				rows={p.rows}
				rowKey={p.rowKey}
				columns={rendered}
				density={config.rowHeight}
				actions={p.actions}
				selection={p.selection}
				selectionActions={p.batchActions}
				loading={p.loading}
				virtualized={p.virtualized}
				onRowClick={p.onRowClick}
				className={p.tableClassName}
				columnSizing={{
					widths: config.columns.widths,
					onResizeEnd: (_k, _w, widths) => setColumns({ widths: { ...config.columns.widths, ...widths } }),
				}}
				rowColor={rowColor}
			/>
			{p.pagination && <Pagination {...p.pagination} />}
			{dialog === 'filters' && (
				<ConditionDialog
					fields={options}
					value={config.condition}
					onApply={(condition) => emit({ ...config, condition })}
					onClose={() => open(undefined)}
				/>
			)}
			{dialog === 'colors' && (
				<ColorsDialog
					fields={colors}
					rules={config.colorRules}
					onChange={(colorRules) => emit({ ...config, colorRules })}
					onClose={() => open(undefined)}
				/>
			)}
			{dialog === 'columns' && (
				<Modal title={locale.columns} onClose={() => open(undefined)}>
					<Button label={locale.allColumns} onClick={() => setColumns({ visible: all })}>
						{locale.allColumns}
					</Button>
					<ColumnSettings
						columns={ordered.map((k) => display.get(k)!)}
						visible={visible}
						onOrder={(order) => setColumns({ order })}
						onToggle={(k) =>
							setColumns({ visible: visible.includes(k) ? visible.filter((v) => v !== k) : [...visible, k] })
						}
						onPin={(key, side) =>
							setColumns({
								fixed: { ...config.columns.fixed, [key]: side },
								widths: { ...config.columns.widths, [key]: measuredWidths[key] },
							})
						}
					/>
					<Button label={locale.reset} onClick={resetColumns}>
						{locale.reset}
					</Button>
					<Button label={locale.confirm} onClick={() => open(undefined)}>
						{locale.confirm}
					</Button>
				</Modal>
			)}
		</section>
	);
}
