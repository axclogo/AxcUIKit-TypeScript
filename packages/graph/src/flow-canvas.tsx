import { useEffect, useMemo, useState, useRef } from 'react';
import {
	Background,
	Controls,
	Handle,
	MiniMap,
	Panel,
	Position,
	ReactFlow,
	ReactFlowProvider,
	useNodesInitialized,
	useReactFlow,
} from '@xyflow/react';
import type {
	GraphWorkbenchProps,
	GraphWorkbenchNodeData,
	GraphNodeShellProps,
	GraphWorkbenchNode,
	GraphWorkbenchLayoutOptions,
} from './types.js';
import { layoutNodes, layoutOptions } from './layout.js';
import { useGraphLocale } from './graph-locale.js';

export function NodeShell<T extends GraphWorkbenchNodeData>({ data, selected, isConnectable }: GraphNodeShellProps<T>) {
	const v = data.view,
		locale = useGraphLocale();
	return (
		<div className="axc-graph-node" data-selected={selected} data-tone={v.color} data-size={v.size}>
			<Handle isConnectable={isConnectable} type="target" position={Position.Left} />
			<header>
				{v.icon}
				<div>
					<strong>{v.title}</strong>
					{v.subtitle && <small>{v.subtitle}</small>}
				</div>
			</header>
			{v.showStatus !== false && <span>{locale.idle}</span>}
			{v.badges?.slice(0, 4).map((b, i) => (
				<span key={i}>{b}</span>
			))}
			{[v.metrics, v.details].map((group, i) =>
				group?.length ? (
					<dl key={i}>
						{group.map((d, i) => (
							<div key={i} data-tone={d.tone}>
								<dt>{d.label}</dt>
								<dd>{d.value}</dd>
							</div>
						))}
					</dl>
				) : null,
			)}
			{v.content}
			<Handle isConnectable={isConnectable} type="source" position={Position.Right} />
		</div>
	);
}
type InputNode = {
	id: string;
	position: { x: number; y: number };
	measured?: { width?: number; height?: number };
	width?: number;
	height?: number;
};
function topologyIssue(nodes: readonly InputNode[], edges: GraphWorkbenchProps['edges']) {
	const ids = new Set<string>();
	for (const node of nodes) {
		if (ids.has(node.id)) return 'Duplicate node id: ' + node.id;
		ids.add(node.id);
	}
	const edgeIds = new Set<string>();
	for (const edge of edges) {
		if (edgeIds.has(edge.id)) return 'Duplicate edge id: ' + edge.id;
		if (!ids.has(edge.source) || !ids.has(edge.target)) return 'Missing endpoint for edge ' + edge.id;
		edgeIds.add(edge.id);
	}
}
function compute(
	nodes: readonly InputNode[],
	edges: GraphWorkbenchProps['edges'],
	options: ReturnType<typeof layoutOptions> | undefined,
	prior?: ReadonlyMap<string, { x: number; y: number }>,
	explicit?: GraphWorkbenchLayoutOptions,
) {
	const original = new Map(nodes.map((n) => [n.id, n.position]));
	if (!options) return { original };
	const input = nodes.map((n) => ({
		...n,
		position: prior?.get(n.id) ?? n.position,
		width: explicit?.nodeWidth ?? n.width ?? n.measured?.width ?? options.nodeWidth,
		height: explicit?.nodeHeight ?? n.height ?? n.measured?.height ?? options.nodeHeight,
	}));
	try {
		return { original, positions: layoutNodes(input, edges, options) };
	} catch (e) {
		return { original, error: e instanceof Error ? e.message || e.name : String(e) };
	}
}
function useLayout<T extends GraphWorkbenchNodeData>(
	nodes: GraphWorkbenchNode<T>[],
	edges: GraphWorkbenchProps['edges'],
	layout?: GraphWorkbenchLayoutOptions,
) {
	const options = layout && layoutOptions(layout);
	const key = JSON.stringify([
		options,
		nodes
			.map((n) => [n.id, n.width ?? n.measured?.width, n.height ?? n.measured?.height])
			.sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
		edges.map((e) => [e.id, e.source, e.target]).sort((a, b) => a[0].localeCompare(b[0])),
	]);
	const [cache, setCache] = useState(() => ({ key, result: compute(nodes, edges, options, undefined, layout) }));
	let result = cache.result;
	if (cache.key !== key) {
		const prior = new Map(cache.result.positions);
		for (const n of nodes) {
			const old = cache.result.original.get(n.id);
			if (old && (old.x !== n.position.x || old.y !== n.position.y)) prior.set(n.id, n.position);
		}
		result = compute(nodes, edges, options, prior, layout);
		setCache({ key, result });
	}
	return {
		key,
		error: result.error,
		nodes: result.positions
			? nodes.map((n) => {
					const original = result.original.get(n.id)!,
						position = result.positions!.get(n.id)!;
					return n.position.x === original.x && n.position.y === original.y ? { ...n, position } : n;
				})
			: nodes,
	};
}
function Canvas<T extends GraphWorkbenchNodeData>(p: GraphWorkbenchProps<T>) {
	const locale = useGraphLocale(),
		locked = p.mode === 'readonly';
	const arranged = useLayout(p.nodes, p.edges, p.layout);
	const types = useMemo(() => ({ default: NodeShell, ...p.nodeTypes }), [p.nodeTypes]);
	const instance = useReactFlow(),
		ready = useNodesInitialized();
	const layoutKey = p.layout && arranged.error === undefined ? arranged.key : undefined;
	const focusId =
		p.inspector !== undefined || p.palette !== undefined ? arranged.nodes.find((n) => n.selected)?.id : undefined;
	const canvas = useRef<HTMLDivElement>(null);
	const fittedLayout = useRef<string | undefined>(undefined);
	const viewport = useRef(p.fitViewOptions);
	viewport.current = p.fitViewOptions;
	useEffect(() => {
		if (!ready || !layoutKey || !canvas.current) {
			fittedLayout.current = undefined;
			return;
		}
		const changed = fittedLayout.current !== layoutKey;
		fittedLayout.current = layoutKey;
		const selected = focusId === undefined ? undefined : instance.getNode(focusId);
		if (!selected) {
			if (changed) void instance.fitView(viewport.current);
			return;
		}
		const center = {
			x: selected.position.x + (selected.measured?.width ?? 0) / 2,
			y: selected.position.y + (selected.measured?.height ?? 0) / 2,
		};
		const point = instance.flowToScreenPosition(center);
		const bounds = canvas.current.getBoundingClientRect();
		if (changed || point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom)
			void instance.setCenter(center.x, center.y, { zoom: instance.getZoom() });
	}, [instance, layoutKey, ready, focusId]);
	return (
		<ReactFlow
			ref={canvas}
			nodes={
				locked ? arranged.nodes.map((node) => ({ ...node, draggable: false, connectable: false })) : arranged.nodes
			}
			edges={p.edges}
			nodeTypes={types}
			onNodesChange={p.onNodesChange}
			onEdgesChange={p.onEdgesChange}
			onConnect={locked ? undefined : p.onConnect}
			onNodeClick={(_, n) => p.onNodeClick?.(n)}
			onPaneClick={p.onPaneClick}
			elementsSelectable={!locked || !!p.onNodeClick}
			nodesDraggable={!locked}
			nodesConnectable={!locked}
			edgesReconnectable={!locked}
			deleteKeyCode={locked ? null : ['Backspace', 'Delete']}
			fitView
			fitViewOptions={p.fitViewOptions}
		>
			<Background />
			<Controls showInteractive={false} />
			{p.showMiniMap !== false && <MiniMap pannable zoomable />}
			{arranged.error !== undefined && (
				<Panel position="top-center">
					<div role="alert">{arranged.error}</div>
				</Panel>
			)}
			{!p.nodes.length && <Panel position="top-center">{p.empty ?? locale.empty}</Panel>}
		</ReactFlow>
	);
}
export function FlowCanvas<T extends GraphWorkbenchNodeData>(p: GraphWorkbenchProps<T>) {
	const issue = useMemo(() => topologyIssue(p.nodes, p.edges), [p.nodes, p.edges]);
	if (issue) return <div role="alert">{issue}</div>;
	return (
		<ReactFlowProvider>
			<Canvas {...p} />
		</ReactFlowProvider>
	);
}
