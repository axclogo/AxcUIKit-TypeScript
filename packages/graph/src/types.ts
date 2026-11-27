import type { RelationGraphSelection } from './core/index.js';
import type { AxcConditionValue, ConditionField } from '@axclogo/uikit/condition';
import type { ReactNode, HTMLAttributes } from 'react';
import type {
	Edge,
	FitViewOptions,
	Node,
	NodeProps,
	NodeTypes,
	OnConnect,
	OnEdgesChange,
	OnNodesChange,
} from '@xyflow/react';
import type { RelationGraphInput, RelationGraphNode, RelationGraphRelation, Locale } from './core/index.js';
export type { Edge, Node, OnConnect, OnNodesChange, OnEdgesChange } from '@xyflow/react';
export type RelationGraphTone = 'blue' | 'cyan' | 'green' | 'orange' | 'purple' | 'red' | 'grey';
export type RelationGraphNodeShape = 'card' | 'circle' | 'diamond' | 'hexagon' | 'rect';

export interface RelationGraphNodeView {
	color?: string;
	fill?: string;
	highlight?: boolean;
	iconText?: string;
	labelAlign?: 'left' | 'center';
	labelMaxLines?: number;
	labelPlacement?: 'center' | 'bottom';
	ribbon?: { text: string; background: string; foreground: string };
	shape?: RelationGraphNodeShape;
	size?: number | [number, number];
	subtitle?: string;
	tone?: RelationGraphTone;
}

export interface RelationGraphRelationView {
	color?: string;
	dashed?: boolean;
	directed?: boolean;
	label?: string;
	tone?: RelationGraphTone;
	width?: number;
}

export type RelationGraphLayout =
	| {
			type: 'force';
			chargeStrength?: number;
			iterations?: number;
			linkDistance?: number;
			nodeSpacing?: number;
	  }
	| { type: 'circular'; nodeSpacing?: number }
	| { type: 'concentric'; nodeSpacing?: number }
	| {
			type: 'dagre';
			direction?: 'LR' | 'TB';
			nodeGap?: number;
			rankGap?: number;
	  };

export interface RelationGraphProps {
	locale?: Locale;
	className?: string;
	data: RelationGraphInput;
	empty?: ReactNode;
	fitViewMinZoom?: number;
	inspector?: ReactNode;
	inspectorSize?: 'default' | 'compact';
	inspectorTitle?: ReactNode;
	layout?: RelationGraphLayout;
	nodeDraggable?: boolean;
	onSelectionChange?: (selection: RelationGraphSelection | null) => void;
	resolveNodeView?: (node: RelationGraphNode) => RelationGraphNodeView | undefined;
	resolveRelationView?: (relation: RelationGraphRelation) => RelationGraphRelationView | undefined;
	searchPlaceholder?: string;
	selected: RelationGraphSelection | null;
	selectionMode?: 'node' | 'node-and-relation';
	showToolbar?: boolean;
	straightEdges?: boolean;
	title?: ReactNode;
	toolbar?: ReactNode;
	zoomRange?: readonly [min: number, max: number];
}
export interface GraphWorkbenchLayoutOptions {
	direction?: 'right' | 'down';
	nodeWidth?: number;
	nodeHeight?: number;
	columnGap?: number;
	rowGap?: number;
	snapToGrid?: boolean;
}

export type GraphWorkbenchMode = 'edit' | 'readonly';

export interface GraphNodeViewMeta {
	title: string;
	subtitle?: string;
	icon?: ReactNode;
	color?: 'blue' | 'green' | 'orange' | 'red' | 'grey';
	showStatus?: boolean;
	badges?: string[];
	size?: 'normal' | 'wide' | 'compact' | 'hub';
	metrics?: Array<{
		label: string;
		value: ReactNode;
		tone?: 'blue' | 'green' | 'orange' | 'red' | 'grey';
	}>;
	details?: Array<{
		label: string;
		value: ReactNode;
		tone?: 'blue' | 'green' | 'orange' | 'red' | 'grey';
	}>;
	content?: ReactNode;
}

export interface GraphWorkbenchNodeData extends Record<string, unknown> {
	view: GraphNodeViewMeta;
}

export type GraphWorkbenchNode<T extends GraphWorkbenchNodeData = GraphWorkbenchNodeData> = Node<T>;
export type GraphWorkbenchEdge = Edge;

export interface GraphWorkbenchProps<T extends GraphWorkbenchNodeData = GraphWorkbenchNodeData> {
	locale?: Locale;
	nodes: GraphWorkbenchNode<T>[];
	edges: GraphWorkbenchEdge[];
	nodeTypes?: NodeTypes;
	mode?: GraphWorkbenchMode;
	layout?: GraphWorkbenchLayoutOptions;
	title?: ReactNode;
	palette?: ReactNode;
	palettePlacement?: 'left' | 'right';
	inspector?: ReactNode;
	inspectorTitle?: ReactNode;
	inspectorPlacement?: 'left' | 'right';
	rightSidebarSize?: 'default' | 'compact';
	toolbar?: ReactNode;
	empty?: ReactNode;
	className?: string;
	fitViewOptions?: FitViewOptions<GraphWorkbenchNode<T>>;
	showMiniMap?: boolean;
	onNodesChange?: OnNodesChange<GraphWorkbenchNode<T>>;
	onEdgesChange?: OnEdgesChange<GraphWorkbenchEdge>;
	onConnect?: OnConnect;
	onNodeClick?: (node: GraphWorkbenchNode<T>) => void;
	onPaneClick?: () => void;
}
export type GraphNodeShellProps<T extends GraphWorkbenchNodeData = GraphWorkbenchNodeData> = NodeProps<
	GraphWorkbenchNode<T>
>;
export interface GraphWorkspaceProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
	children: ReactNode;
	toolbar?: ReactNode;
	leftSidebar?: ReactNode;
	rightSidebar?: ReactNode;
	rightSidebarSize?: 'default' | 'compact';
}
export type GraphWorkspaceCanvasProps = HTMLAttributes<HTMLElement>;
export interface GraphWorkspaceInspectorProps {
	children?: ReactNode;
	className?: string;
}
export interface GraphWorkspaceInspectorSectionProps extends GraphWorkspaceInspectorProps {
	title?: ReactNode;
}
export type GraphWorkspaceToolbarProps = GraphWorkspaceInspectorSectionProps;
export interface GraphWorkspacePanelSectionProps {
	title: ReactNode;
	children?: ReactNode;
	defaultExpanded?: boolean;
	grow?: boolean;
}
export interface GraphWorkspaceSidePanelProps extends GraphWorkspaceInspectorSectionProps {
	empty?: ReactNode;
}
export type GraphWorkbenchEditorProps = GraphWorkspaceInspectorProps;
export type GraphWorkbenchEditorSectionProps = GraphWorkspaceInspectorSectionProps;
export interface GraphWorkbenchRightSidebarToolbarProps {
	items: readonly { key: string; label: ReactNode; onClick: () => void }[];
}
export interface ControlConditionNodeEditorProps {
	fields: ConditionField[];
	rule: AxcConditionValue;
	isDefault?: boolean;
	showDefaultSwitch?: boolean;
	maxLevels?: number;
	onChange: (next: { rule: AxcConditionValue; isDefault?: boolean }) => void;
}
