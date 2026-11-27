// Consume the emitted declarations via package.json exports with no source aliases.
import type { AxcConditionValue } from '@axclogo/uikit/condition';
import type { Edge, Node, OnNodesChange } from '@xyflow/react';
import type { BaseTableProps, DataAnalysisTableProps, TreeExpansion } from '@axclogo/uikit/table';
import type {
	GraphWorkbenchProps,
	GraphWorkbenchNodeData,
	ControlConditionNodeEditorProps,
} from '@axclogo/uikit/graph';
import type { RelationGraphInput } from '@axclogo/uikit/graph/core';
import type { RowKey } from '@axclogo/uikit/table/core';

type Row = { id: number };
const rowKey: RowKey<Row> = 'id';
// @ts-expect-error A row's identity must be available independently of its page position.
export const indexKey: RowKey<Row> = (_row: Row, index: number) => index;
// @ts-expect-error An unvalidated value cannot identify a row.
export const unknownKey: RowKey<{ id: unknown }> = 'id';
const table = { rowKey, rows: [{ id: 1 }], columns: [{ key: 'id' }] } satisfies BaseTableProps<Row>;
export const grouped: BaseTableProps<Row> = { rowKey, groups: [], columns: [] };
// @ts-expect-error A table has one source of rows.
export const invalidSource: BaseTableProps<Row> = { ...table, groups: [] };
// @ts-expect-error Height is either measured from the parent or explicit.
export const invalidHeight: BaseTableProps<Row> = { ...table, fillHeight: true, height: 80 };
const conflictingSelection = { selectedRowKeys: [], defaultSelectedRowKeys: [] };
// @ts-expect-error Controlled and initial keys cannot be combined.
export const invalidSelection: BaseTableProps<Row>['selection'] = conflictingSelection;
// @ts-expect-error Controlled expansion cannot be initialized from defaultExpandAll.
export const invalidExpansion: TreeExpansion = { expandedRowKeys: [], defaultExpandAll: true };
export const condition: AxcConditionValue = { combinator: 'and', not: false, rules: [] };
export const analysis: DataAnalysisTableProps<Row> = {
	...table,
	fields: [{ name: 'tag', label: 'Tag', dataType: 'string', conditionable: true }],
	config: {
		keyword: '',
		condition: { query: condition },
		sorters: [],
		columns: { visible: ['id'], order: ['id'], widths: {}, fixed: {} },
		rowHeight: 'normal',
		colorRules: [],
	},
	onConfigChange: () => {},
};
export const editor: ControlConditionNodeEditorProps = { rule: condition, fields: [], onChange: () => {} };
export const relations: RelationGraphInput = [{ id: 'a', name: 'A', related_id: null, relation_type: null }];
export function workbench(
	nodes: Node<GraphWorkbenchNodeData>[],
	edges: Edge[],
	onNodesChange: OnNodesChange<Node<GraphWorkbenchNodeData>>,
): GraphWorkbenchProps {
	return { nodes, edges, onNodesChange, layout: { direction: 'right', snapToGrid: true } };
}
