import { Graph, layout } from '@dagrejs/dagre';
import type { GraphWorkbenchLayoutOptions } from './types.js';
type Point = { x: number; y: number };
interface LayoutNode {
	id: string;
	width: number;
	height: number;
	position: Point;
}
export function layoutOptions(options: GraphWorkbenchLayoutOptions) {
	const result = {
		direction: options.direction ?? 'right',
		nodeWidth: options.nodeWidth ?? 268,
		nodeHeight: options.nodeHeight ?? 136,
		columnGap: options.columnGap ?? 144,
		rowGap: options.rowGap ?? 40,
		snapToGrid: options.snapToGrid ?? true,
	};
	if (!['right', 'down'].includes(result.direction))
		throw new TypeError('Unknown layout.direction: ' + result.direction);
	for (const k of ['nodeWidth', 'nodeHeight', 'columnGap', 'rowGap'] as const)
		if (!Number.isFinite(result[k]) || result[k] < (k.endsWith('Gap') ? 0 : Number.MIN_VALUE))
			throw new TypeError('Invalid layout.' + k + ': ' + result[k]);
	return result;
}
export function layoutNodes(
	nodes: readonly LayoutNode[],
	edges: readonly { id: string; source: string; target: string }[],
	o: ReturnType<typeof layoutOptions>,
) {
	const horizontal = o.direction === 'right';
	const g = new Graph({ multigraph: true })
		.setGraph({
			rankdir: horizontal ? 'LR' : 'TB',
			nodesep: horizontal ? o.rowGap : o.columnGap,
			ranksep: horizontal ? o.columnGap : o.rowGap,
		})
		.setDefaultEdgeLabel(() => ({}));
	for (const n of [...nodes].sort(
		(a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id),
	)) {
		g.setNode(n.id, { width: n.width, height: n.height });
	}
	for (const e of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
		g.setEdge(e.source, e.target, {}, e.id);
	}
	layout(g);
	const positions = new Map<string, Point>();
	for (const n of nodes) {
		const p = g.node(n.id),
			x = p.x - n.width / 2,
			y = p.y - n.height / 2;
		positions.set(n.id, o.snapToGrid ? { x: Math.round(x / 8) * 8, y: Math.round(y / 8) * 8 } : { x, y });
	}
	return positions;
}
