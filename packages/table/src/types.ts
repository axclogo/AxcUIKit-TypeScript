import type { AxcConditionValue, ConditionField, ConditionDataType } from '@axclogo/uikit/condition';
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import type { Locale, RowKey, TableKey } from './core/index.js';

export type TableHeight = { fillHeight: true; height?: never } | { height?: string | number; fillHeight?: false };
export type TableDensity = 'compact' | 'normal' | 'spacious';
export type TableSource<Row> =
	| { rows: readonly Row[]; groups?: never }
	| { groups: readonly { key: TableKey; title: ReactNode; rows: readonly Row[] }[]; rows?: never };
export type TableSelection<Row, Item = Row> = (
	| {
			selectedRowKeys: readonly TableKey[];
			defaultSelectedRowKeys?: never;
	  }
	| { selectedRowKeys?: never; defaultSelectedRowKeys?: readonly TableKey[] }
) & {
	canSelect?: (row: Item, index: number) => boolean;
	onChange?: (keys: TableKey[], rows: Row[]) => void;
	columnWidth?: number;
};
export interface TableBatchContext<Row> {
	selectedRowKeys: readonly TableKey[];
	selectedRows: readonly Row[];
	selectedCount: number;
	clearSelection: () => void;
}
export type ActionContent<T> = ReactNode | ((item: T) => ReactNode);
export interface TableAction<T> {
	key: string;
	label: ActionContent<T>;
	icon?: ActionContent<T>;
	type?: 'primary' | 'danger' | 'tertiary' | 'warning';
	confirm?: ActionContent<T>;
	confirmTitle?: ActionContent<T>;
	visible?: (item: T) => boolean;
	disabled?: boolean | ((item: T) => boolean);
	onClick: (item: T) => void | Promise<void>;
}
export interface TableCell<Row> {
	value: unknown;
	row: Row;
	rowIndex: number;
}
export interface TableColumn<Row, Cell = TableCell<Row>> {
	key: string;
	title?: ReactNode;
	dataIndex?: string | number | readonly (string | number)[];
	width?: number;
	minWidth?: number;
	maxWidth?: number;
	fixed?: 'left' | 'right';
	resizable?: boolean;
	align?: 'left' | 'center' | 'right';
	ellipsis?: boolean;
	tooltip?: boolean | ((cell: Cell) => ReactNode);
	actionLayout?: boolean;
	className?: string | ((row: Row, index: number) => string);
	headerClassName?: string;
	render?: (cell: Cell) => ReactNode;
}
export interface DataColumn<Row, Cell = TableCell<Row>> extends TableColumn<Row, Cell> {
	type?: string;
	formatter?: (value: unknown, row: Row, index: number) => ReactNode;
}
export interface DragLocation<Row> {
	row: Row;
	rowKey: TableKey;
	rowIndex: number;
}
export type DropPosition = 'before' | 'inside' | 'after';
export interface TableDrop<Row> {
	drag: DragLocation<Row>;
	target: DragLocation<Row>;
	position: DropPosition;
}
export interface TableRowDrag<Row> {
	allowedPositions?: readonly DropPosition[];
	columnWidth?: number;
	canDrag?: (item: DragLocation<Row>) => boolean;
	canDrop?: (drop: TableDrop<Row>) => boolean;
	onDrop: (drop: TableDrop<Row>) => void | Promise<void>;
}
export interface TablePresentation<Row> {
	rowKey: RowKey<Row>;
	actions?: readonly TableAction<Row>[];
	actionColumnFixed?: 'left' | 'right' | false;
	selection?: TableSelection<Row>;
	density?: TableDensity;
	rowHeight?: number;
	virtualized?: boolean;
	loading?: boolean;
	empty?: ReactNode;
	showHeader?: boolean;
	className?: string;
	style?: CSSProperties;
	onRowClick?: (row: Row, index: number, event: React.MouseEvent<Element>) => void;
	columnSizing?: {
		widths?: Record<string, number>;
		onResizeEnd?: (key: string, width: number, widths: Record<string, number>) => void;
	};
}
export type BaseTableProps<Row> = TableSource<Row> &
	TableHeight &
	TablePresentation<Row> & { columns: readonly TableColumn<Row>[]; rowDragDrop?: TableRowDrag<Row> };
export type DataTableProps<Row> = TablePresentation<Row> &
	TableHeight &
	TableSource<Row> & { columns: readonly DataColumn<Row>[]; rowDragDrop?: TableRowDrag<Row> };
export interface TreeLocation<Row> extends DragLocation<Row> {
	depth: number;
	parentKey?: TableKey;
	index: number;
	path: readonly TableKey[];
	expanded: boolean;
	hasChildren: boolean;
}
export interface TreeMove<Row> {
	drag: TreeLocation<Row>;
	target: TreeLocation<Row>;
	position: DropPosition;
	nextIndex: number;
	nextParentKey?: TableKey;
	nextDepth: number;
}
export type TreeExpansion =
	| { expandedRowKeys: readonly TableKey[]; defaultExpandAll?: never; defaultExpandedRowKeys?: never }
	| { expandedRowKeys?: never; defaultExpandAll: true; defaultExpandedRowKeys?: never }
	| { expandedRowKeys?: never; defaultExpandAll?: false; defaultExpandedRowKeys?: readonly TableKey[] };
export type DataTreeTableProps<Row> = Omit<TablePresentation<Row>, 'selection'> &
	TableHeight &
	TreeExpansion & {
		nodes: readonly Row[];
		childrenKey: keyof Row | ((row: Row) => readonly Row[] | undefined);
		columns: readonly DataColumn<Row, TableCell<Row> & TreeLocation<Row>>[];
		selection?: TableSelection<Row, TreeLocation<Row>>;
		onExpandedRowKeysChange?: (keys: TableKey[], nodes: Row[]) => void;
		expandColumnKey?: string;
		indentSize?: number;
		expandOnRowClick?: boolean;
		childCount?: boolean | ((row: Row, children: readonly Row[]) => ReactNode);
		batchActions?: readonly TableAction<TableBatchContext<Row>>[];
		dragDrop?: {
			allowedPositions?: readonly DropPosition[];
			columnWidth?: number;
			maxDepth?: number;
			canDrag?: (item: TreeLocation<Row>) => boolean;
			canDrop?: (move: TreeMove<Row>) => boolean;
			onMove: (move: TreeMove<Row>) => void | Promise<void>;
		};
	};
export interface TableOption {
	label: string;
	value: string | number | boolean;
	disabled?: boolean;
}
export interface TablePagination {
	page: number;
	pageSize: number;
	total: number;
	pageSizeOptions?: readonly number[];
	totalLabel?: ReactNode;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
}
export interface DataAnalysisField {
	name: string;
	label: string;
	dataType: ConditionDataType;
	options?: readonly TableOption[];
	conditionable?: boolean;
	conditionField?: ConditionField;
	sortable?: boolean;
	colorable?: boolean;
	width?: number;
}
export interface AnalysisConfig {
	keyword: string;
	condition: { query: AxcConditionValue } | null;
	sorters: readonly { field: string; direction: 'asc' | 'desc' }[];
	columns: {
		visible: readonly string[];
		order: readonly string[];
		widths: Record<string, number>;
		fixed: Record<string, 'left' | 'right' | undefined>;
	};
	rowHeight: TableDensity;
	colorRules: readonly {
		id: string;
		name: string;
		field: string;
		operator: '=' | '!=' | 'contains';
		value: TableOption['value'];
		color: 'red' | 'orange' | 'green' | 'blue' | 'grey';
	}[];
}
export interface AnalysisCommands {
	openFilter: () => void;
	openColumnSettings: () => void;
	openColorRules: () => void;
}
export type DataAnalysisTableProps<Row> = TableHeight &
	Pick<
		TablePresentation<Row>,
		'rowKey' | 'actions' | 'selection' | 'loading' | 'onRowClick' | 'className' | 'virtualized'
	> & {
		rows: readonly Row[];
		columns: readonly DataColumn<Row>[];
		fields: readonly DataAnalysisField[];
		config: AnalysisConfig;
		onConfigChange: (value: AnalysisConfig) => void;
		batchActions?: readonly TableAction<TableBatchContext<Row>>[];
		savedViewTabs?: ReactNode | ((commands: AnalysisCommands) => ReactNode);
		title?: ReactNode;
		summary?: ReactNode;
		toolbarStart?: ReactNode;
		toolbarLeft?: ReactNode;
		toolbarRight?: ReactNode;
		notice?: ReactNode;
		tableClassName?: string;
		defaultColumnKeys?: readonly string[];
		searchBefore?: ReactNode;
		searchPlaceholder?: string;
		searchMode?: 'change' | 'submit';
		sortControl?: 'separate' | 'cascader';
		enableAdvancedFilter?: boolean;
		enableColorRules?: boolean;
		onSearch?: (keyword: string) => void;
		onRefresh?: () => void | Promise<void>;
		pagination?: TablePagination;
	};
export type CrudFilter = { key: string; label: string; width?: number } & (
	| { type: 'select' | 'multiSelect'; options: readonly TableOption[] }
	| { type: 'custom'; render: (value: unknown, onChange: (value: unknown) => void) => ReactNode }
);
export type CrudMove<Row> = Omit<TableDrop<Row>, 'position'> & { position: 'before' | 'after'; nextIndex: number };
export type DataCrudTableProps<Row> = TableHeight &
	TablePresentation<Row> & {
		rows: readonly Row[];
		columns: readonly DataColumn<Row>[];
		batchActions?: readonly TableAction<TableBatchContext<Row>>[];
		dragSort?: {
			columnWidth?: number;
			canDrag?: (item: DragLocation<Row>) => boolean;
			canDrop?: (move: CrudMove<Row>) => boolean;
			onMove: (move: CrudMove<Row>) => void | Promise<void>;
		};
		keyword?: string;
		searchPlaceholder?: string;
		onKeywordChange?: (value: string) => void;
		filters?: readonly CrudFilter[];
		filterValues?: Record<string, unknown>;
		onFilterValuesChange?: (values: Record<string, unknown>) => void;
		onSearch?: (keyword: string, values: Record<string, unknown>) => void;
		onResetFilters?: () => void;
		onRefresh?: () => void | Promise<void>;
		refreshLoading?: boolean;
		primaryActions?: ReactNode;
		toolbarRight?: ReactNode;
		pagination?: TablePagination;
		tableClassName?: string;
	};
export interface TableControl<Value> {
	value: Value;
	onChange: (value: Value) => void;
	label: string;
	disabled?: boolean;
}
export interface TableControls {
	Input: ComponentType<TableControl<string> & { type?: 'text' | 'date' | 'datetime-local' }>;
	NumberInput: ComponentType<TableControl<number | undefined>>;
	Checkbox: ComponentType<TableControl<boolean> & { indeterminate?: boolean }>;
	Select: ComponentType<
		TableControl<TableOption['value'] | undefined> & { clearable?: boolean; options: readonly TableOption[] }
	>;
	Button: ComponentType<{ children: ReactNode; onClick: () => void; disabled?: boolean; label: string }>;
	MultiSelect: ComponentType<TableControl<readonly TableOption['value'][]> & { options: readonly TableOption[] }>;
	Tooltip: ComponentType<{ children: ReactNode; content: ReactNode }>;
	Empty: ComponentType<{ children: ReactNode }>;
	Loading: ComponentType<{ label: string }>;
	Modal: ComponentType<{ children: ReactNode; title: ReactNode; onClose: () => void }>;
	Pagination: ComponentType<TablePagination>;
}
export interface TableUIProviderProps {
	children: ReactNode;
	locale?: Locale;
	controls?: Partial<TableControls>;
	confirm?: (request: { title?: ReactNode; message: ReactNode }) => boolean | Promise<boolean>;
	onActionError?: (error: unknown) => void;
	formatters?: Partial<Record<'date' | 'datetime', (value: unknown) => ReactNode>>;
	types?: Record<string, (value: unknown) => ReactNode>;
}
