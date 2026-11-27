import type { RelationGraphModel, RelationGraphNode, RelationGraphRelation } from '../core/index.js';
import { relationGraphRendererNodeId, relationGraphRendererRelationId } from '../core/selection.js';
import type { EdgeData, LayoutOptions, NodeData } from '@antv/g6';
import type {
	RelationGraphLayout,
	RelationGraphNodeView,
	RelationGraphRelationView,
	RelationGraphTone,
} from '../types.js';

export interface RelationGraphTheme {
	background: string;
	border: string;
	primary: string;
	primarySoft: string;
	text: string;
	textMuted: string;
	tones: Record<RelationGraphTone, { fill: string; stroke: string }>;
}

export interface RelationGraphAdapterOptions {
	resolveNodeView?: (node: RelationGraphNode) => RelationGraphNodeView | undefined;
	resolveRelationView?: (relation: RelationGraphRelation) => RelationGraphRelationView | undefined;
	theme: RelationGraphTheme;
}

interface WrappedLabel {
	lineCount: number;
	maxLineCharacters: number;
	text: string;
}

function wrapLabel(text: string, maxCharacters: number): WrappedLabel {
	const lines: string[] = [];
	for (const sourceLine of text.split(/\r?\n/)) {
		const characters = Array.from(sourceLine);
		if (characters.length === 0) {
			lines.push('');
			continue;
		}
		for (let index = 0; index < characters.length; index += maxCharacters) {
			lines.push(characters.slice(index, index + maxCharacters).join(''));
		}
	}
	return {
		lineCount: lines.length,
		maxLineCharacters: Math.max(...lines.map((line) => Array.from(line).length)),
		text: lines.join('\n'),
	};
}

function centeredLabelSize(label: WrappedLabel) {
	const estimatedWidth = label.maxLineCharacters * 12;
	const estimatedHeight = label.lineCount * 16;
	return Math.max(76, Math.ceil(Math.hypot(estimatedWidth, estimatedHeight) + 24));
}

function isHexColor(value: string | undefined): value is string {
	return value !== undefined && /^#[0-9a-fA-F]{6}$/.test(value);
}

const CARD_SIZE: [number, number] = [220, 64];
export const RELATION_GRAPH_CARD_NODE_TYPE = 'axc-graph-card';

function cardNodeData(
	node: RelationGraphNode,
	view: RelationGraphNodeView,
	options: RelationGraphAdapterOptions,
): NodeData {
	const tone = options.theme.tones[view.tone ?? 'blue'];
	const highlight = view.highlight ?? false;
	const size = view.size ?? CARD_SIZE;
	const width = Array.isArray(size) ? size[0] : size;
	const labelAlign = view.labelAlign ?? 'center';
	return {
		id: relationGraphRendererNodeId(node.id),
		type: RELATION_GRAPH_CARD_NODE_TYPE,
		style: {
			size,
			radius: 8,
			cursor: 'pointer',
			fill: view.fill ?? options.theme.background,
			stroke: tone.stroke,
			lineWidth: highlight ? 3 : 1.4,
			halo: highlight,
			haloLineWidth: highlight ? 12 : undefined,
			haloStroke: tone.stroke,
			haloStrokeOpacity: highlight ? 0.32 : undefined,
			labelText: view.subtitle ? `${node.name}\n${view.subtitle}` : node.name,
			labelPlacement: 'center',
			labelOffsetX: labelAlign === 'left' ? -(width / 2) + 18 : 0,
			labelTextAlign: labelAlign,
			labelTextBaseline: 'middle',
			labelFill: options.theme.text,
			labelFontSize: 12,
			labelLineHeight: 18,
			labelFontWeight: highlight ? 'bold' : 'normal',
			labelMaxWidth: width - 24,
			labelMaxLines: view.labelMaxLines ?? (view.subtitle ? 2 : 1),
			labelWordWrap: true,
			labelTextOverflow: 'ellipsis',
			ribbonText: view.ribbon?.text,
			ribbonBackground: view.ribbon?.background,
			ribbonForeground: view.ribbon?.foreground,
			cornerText: view.iconText,
			cornerPlacement: 'left-top',
			cornerColor: tone.stroke,
		},
	} as NodeData;
}

function nodeData(node: RelationGraphNode, options: RelationGraphAdapterOptions): NodeData {
	const view = options.resolveNodeView?.(node) ?? {};
	if (view.color !== undefined && !isHexColor(view.color)) throw new TypeError('Invalid node color: ' + view.color);
	if (view.shape === 'card') return cardNodeData(node, view, options);
	const customColor = isHexColor(view.color ?? node.color) ? (view.color ?? node.color) : undefined;
	const tone = options.theme.tones[view.tone ?? 'blue'];
	const highlight = view.highlight ?? false;
	const labelPlacement = view.labelPlacement ?? 'bottom';
	const centeredLabel = wrapLabel(node.name, 5);
	const nodeSize = view.size ?? (labelPlacement === 'center' ? centeredLabelSize(centeredLabel) : 52);
	const nodeWidth = Array.isArray(nodeSize) ? nodeSize[0] : nodeSize;
	return {
		id: relationGraphRendererNodeId(node.id),
		type: view.shape ?? 'circle',
		style: {
			size: nodeSize,
			cursor: 'pointer',
			fill: customColor ?? tone.fill,
			fillOpacity: customColor ? 0.24 : 1,
			stroke: customColor ?? tone.stroke,
			lineWidth: highlight ? 3.5 : 2,
			halo: highlight,
			haloLineWidth: highlight ? 16 : undefined,
			haloStroke: customColor ?? tone.stroke,
			haloStrokeOpacity: highlight ? 0.42 : undefined,
			labelText:
				labelPlacement === 'center' ? centeredLabel.text : view.subtitle ? `${node.name}\n${view.subtitle}` : node.name,
			labelPlacement,
			labelTextBaseline: labelPlacement === 'center' ? 'middle' : undefined,
			labelTextAlign: labelPlacement === 'center' ? 'center' : undefined,
			labelOffsetY: labelPlacement === 'center' ? 0 : 6,
			labelFill: options.theme.text,
			labelFontSize: 12,
			labelLineHeight: 16,
			labelFontWeight: highlight ? 'bold' : 'normal',
			labelMaxWidth: labelPlacement === 'center' ? Math.max(64, nodeWidth - 18) : 132,
			labelMaxLines: labelPlacement === 'center' ? centeredLabel.lineCount : 1,
			labelWordWrap: labelPlacement === 'center',
			labelTextOverflow: 'ellipsis',
			iconText: view.iconText,
			iconFill: tone.stroke,
			iconFontSize: 14,
		},
	};
}

function relationData(relation: RelationGraphRelation, options: RelationGraphAdapterOptions): EdgeData {
	const view = options.resolveRelationView?.(relation) ?? {};
	const tone = options.theme.tones[view.tone ?? 'grey'];
	if (view.color !== undefined && !isHexColor(view.color)) throw new TypeError('Invalid relation color: ' + view.color);
	const color = view.color ?? tone.stroke;
	return {
		id: relationGraphRendererRelationId(relation.key),
		source: relationGraphRendererNodeId(relation.source),
		target: relationGraphRendererNodeId(relation.target),
		type: 'line',
		style: {
			stroke: color,
			lineWidth: view.width ?? 1.6,
			lineDash: view.dashed ? [6, 5] : undefined,
			endArrow: view.directed ?? true,
			labelText: view.label ?? relation.type,
			labelFill: options.theme.textMuted,
			labelFontSize: 11,
			labelMaxLines: 1,
			labelMaxWidth: '60%',
			labelTextOverflow: 'ellipsis',
			labelWordWrap: true,
			labelBackground: true,
			labelBackgroundFill: options.theme.background,
			labelBackgroundRadius: 4,
			labelPadding: [2, 4],
		},
	};
}

export function relationGraphToG6Data(model: RelationGraphModel, options: RelationGraphAdapterOptions) {
	return {
		nodes: model.nodes.map((node) => nodeData(node, options)),
		edges: model.relations.map((relation) => relationData(relation, options)),
	};
}

export function relationGraphToG6Layout(layout: RelationGraphLayout): Exclude<LayoutOptions, readonly unknown[]> {
	if (layout.type === 'circular') {
		return {
			type: 'circular',
			nodeSpacing: layout.nodeSpacing ?? 56,
			animation: false,
		};
	}
	if (layout.type === 'concentric') {
		return {
			type: 'concentric',
			nodeSpacing: layout.nodeSpacing ?? 52,
			animation: false,
		};
	}
	if (layout.type === 'dagre') {
		return {
			type: 'antv-dagre',
			rankdir: layout.direction || 'LR',
			nodesep: layout.nodeGap ?? 36,
			ranksep: layout.rankGap ?? 96,
			animation: false,
		};
	}
	return {
		type: 'd3-force',
		animation: false,
		iterations: layout.iterations ?? 280,
		link: { distance: layout.linkDistance ?? 148, strength: 0.72 },
		manyBody: { strength: layout.chargeStrength ?? -360 },
		preventOverlap: true,
		nodeSpacing: layout.nodeSpacing ?? 58,
		collideStrength: 1,
		collideIterations: 4,
	};
}
