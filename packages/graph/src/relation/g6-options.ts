import type { RelationGraphModel, RelationGraphSelection } from '../core/index.js';
import type { EdgeData, Graph, GraphOptions, NodeData } from '@antv/g6';
import type { RelationGraphTheme } from './g6-adapter.js';
import { RELATION_GRAPH_IDLE_STATE, relationGraphElementStates } from '../core/selection.js';

const RELATION_GRAPH_VIEWPORT_ANIMATION = { duration: 180 };

export function readTheme(el: HTMLElement): RelationGraphTheme {
	const css = getComputedStyle(el);
	const value = (key: string, initial: string) => css.getPropertyValue('--axc-graph-' + key).trim() || initial;
	const tone = (name: string, fill: string, stroke: string) => ({
		fill: value(name + '-fill', fill),
		stroke: value(name, stroke),
	});
	return {
		background: value('bg', '#fff'),
		border: value('border', '#d4d8de'),
		primary: value('blue', '#2563eb'),
		primarySoft: value('blue-fill', '#deebff'),
		text: value('text', '#253349'),
		textMuted: value('muted', '#536277'),
		tones: {
			blue: tone('blue', '#deebff', '#2563eb'),
			cyan: tone('cyan', '#d7f9fa', '#13868b'),
			green: tone('green', '#d9f7e7', '#228650'),
			orange: tone('orange', '#ffedd5', '#b45309'),
			purple: tone('purple', '#f3e8ff', '#9333ea'),
			red: tone('red', '#fee2e2', '#dc2626'),
			grey: tone('grey', '#edf0f4', '#586578'),
		},
	};
}
function restingNodeState(data: NodeData) {
	return {
		fill: data.style?.fill,
		fillOpacity: 1,
		halo: data.style?.halo,
		haloLineWidth: data.style?.haloLineWidth,
		haloStroke: data.style?.haloStroke,
		haloStrokeOpacity: data.style?.haloStrokeOpacity,
		iconOpacity: 1,
		labelFill: data.style?.labelFill,
		labelFillOpacity: 1,
		labelFontWeight: data.style?.labelFontWeight ?? ('normal' as const),
		lineWidth: data.style?.lineWidth,
		stroke: data.style?.stroke,
		strokeOpacity: 1,
	};
}

function restingEdgeState(data: EdgeData) {
	return {
		labelFill: data.style?.labelFill,
		labelFillOpacity: 1,
		lineWidth: data.style?.lineWidth,
		stroke: data.style?.stroke,
		strokeOpacity: 1,
	};
}

interface RelationGraphOptionsInput {
	container: HTMLElement;
	maxZoom: number;
	minZoom: number;
	nodeDraggable: boolean;
	straightEdges: boolean;
	theme: RelationGraphTheme;
}

export function createRelationGraphOptions({
	container,
	maxZoom,
	minZoom,
	nodeDraggable,
	straightEdges,
	theme,
}: RelationGraphOptionsInput): GraphOptions {
	return {
		container,
		autoResize: false,
		animation: false,
		padding: 48,
		zoomRange: [minZoom, maxZoom],
		theme: false,
		behaviors: [
			'drag-canvas',
			'zoom-canvas',
			...(nodeDraggable
				? [
						{
							type: 'drag-element' as const,
							animation: false,
							dropEffect: 'none' as const,
							hideEdge: 'none' as const,
						},
					]
				: []),
		],
		transforms: straightEdges
			? []
			: [
					{
						type: 'process-parallel-edges',
						mode: 'bundle',
						distance: 20,
						loopMode: 'spread',
					},
				],
		node: {
			state: {
				[RELATION_GRAPH_IDLE_STATE]: restingNodeState,
				selected: {
					fill: theme.primarySoft,
					fillOpacity: 1,
					halo: true,
					haloLineWidth: 18,
					haloStroke: theme.primary,
					haloStrokeOpacity: 0.34,
					iconOpacity: 1,
					labelFillOpacity: 1,
					labelFontWeight: 'bold',
					lineWidth: 4,
					stroke: theme.primary,
					strokeOpacity: 1,
				},
				active: (data: NodeData) => ({
					...restingNodeState(data),
					fillOpacity: 0.82,
					iconOpacity: 0.88,
					labelFillOpacity: 0.88,
					strokeOpacity: 0.9,
				}),
				inactive: (data: NodeData) => ({
					...restingNodeState(data),
					fillOpacity: 0.4,
					iconOpacity: 0.48,
					labelFillOpacity: 0.48,
					strokeOpacity: 0.5,
				}),
			},
		},
		edge: {
			state: {
				[RELATION_GRAPH_IDLE_STATE]: restingEdgeState,
				selected: (data: EdgeData) => ({
					labelFillOpacity: 1,
					lineWidth: Math.max(3, Number(data.style?.lineWidth ?? 0) + 1),
					stroke: theme.primary,
					strokeOpacity: 1,
				}),
				active: (data: EdgeData) => ({
					...restingEdgeState(data),
					labelFillOpacity: 0.88,
					lineWidth: Math.max(2.2, Number(data.style?.lineWidth ?? 0)),
					strokeOpacity: 0.9,
				}),
				inactive: (data: EdgeData) => ({
					...restingEdgeState(data),
					labelFillOpacity: 0.18,
					strokeOpacity: 0.18,
				}),
			},
		},
	};
}

export async function applyRelationGraphSelection(
	graph: Graph,
	model: RelationGraphModel,
	selection: RelationGraphSelection | null,
) {
	await graph.setElementState(relationGraphElementStates(model, selection), false);
}

export async function fitRelationGraphView(graph: Graph, minimumZoom?: number) {
	await graph.fitView({ when: 'always' }, RELATION_GRAPH_VIEWPORT_ANIMATION);
	if (minimumZoom !== undefined && graph.getZoom() < minimumZoom) {
		await graph.zoomTo(minimumZoom, RELATION_GRAPH_VIEWPORT_ANIMATION);
	}
}
