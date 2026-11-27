import { useEffect, useMemo, useRef, useState } from 'react';
import type { Graph, IElementEvent } from '@antv/g6';
import { normalizeRelationGraph, RelationGraphDataError, en } from './core/index.js';
import {
	relationGraphPointerMoved,
	relationGraphRendererNodeId,
	relationGraphRendererRelationId,
	relationGraphSelectionForRelation,
} from './core/selection.js';
import {
	GraphWorkspace,
	GraphWorkspaceToolbar,
	GraphWorkspacePanelSection,
	GraphWorkspaceCanvas,
} from './workspace.js';
import { GraphButton, GraphSearch } from './ui/controls.js';
import { loadRuntime } from './relation/g6-runtime.js';
import {
	readTheme,
	createRelationGraphOptions,
	fitRelationGraphView,
	applyRelationGraphSelection,
} from './relation/g6-options.js';
import { relationGraphToG6Data, relationGraphToG6Layout } from './relation/g6-adapter.js';
import type { RelationGraphProps, RelationGraphLayout } from './types.js';

const force: RelationGraphLayout = { type: 'force' };
function checkConfig(p: RelationGraphProps) {
	const [min, max] = p.zoomRange ?? [0.25, 3];
	if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || min > max)
		throw new TypeError('Invalid zoomRange: ' + min + ', ' + max);
	if (
		p.fitViewMinZoom !== undefined &&
		(!Number.isFinite(p.fitViewMinZoom) || p.fitViewMinZoom < min || p.fitViewMinZoom > max)
	)
		throw new TypeError('fitViewMinZoom must be inside zoomRange');
	const l = p.layout;
	if (!l) return;
	if (!['force', 'circular', 'concentric', 'dagre'].includes(l.type))
		throw new TypeError('Unknown relation layout: ' + l.type);
	if (l.type === 'dagre' && l.direction !== undefined && !['LR', 'TB'].includes(l.direction))
		throw new TypeError('Invalid layout.direction: ' + l.direction);
	for (const [k, v] of Object.entries(l)) {
		if (
			k !== 'type' &&
			k !== 'direction' &&
			v !== undefined &&
			(!Number.isFinite(v) || (k !== 'chargeStrength' && Number(v) < 0))
		)
			throw new TypeError('Invalid layout.' + k + ': ' + v);
	}
}
interface Session {
	graph: Graph;
	enqueue: (fn: () => Promise<void>) => void;
	signature?: string;
}

/** Display a controlled read-only relationship graph. Bad data is displayed in the canvas; invalid settings throw TypeError. */
export function RelationGraph(p: RelationGraphProps) {
	checkConfig(p);
	const locale = p.locale ?? en;
	const parsed = useMemo(() => {
		try {
			return { model: normalizeRelationGraph(p.data) };
		} catch (e) {
			if (!(e instanceof RelationGraphDataError)) throw e;
			return { error: e.message };
		}
	}, [p.data]);
	const model = parsed.model;
	const mount = useRef<HTMLDivElement>(null),
		latest = useRef(p),
		modelRef = useRef(model);
	latest.current = p;
	modelRef.current = model;
	const [session, setSession] = useState<Session>(),
		[error, setError] = useState<string>(),
		[busy, setBusy] = useState(false),
		[term, setTerm] = useState(''),
		[miss, setMiss] = useState(false);
	const hasData = !!model?.nodes.length;
	const [min, max] = p.zoomRange ?? [0.25, 3];
	const draggable = p.nodeDraggable ?? true,
		straight = p.straightEdges ?? false;
	useEffect(() => {
		const el = mount.current;
		if (!hasData || !el) return;
		let stopped = false,
			graph: Graph | undefined,
			observer: ResizeObserver | undefined,
			queue = Promise.resolve();
		let start: { x: number; y: number } | undefined,
			moved = false;
		const down = (e: PointerEvent) => {
				start = { x: e.clientX, y: e.clientY };
				moved = false;
			},
			move = (e: PointerEvent) => {
				if (start && relationGraphPointerMoved(start, { x: e.clientX, y: e.clientY })) moved = true;
			};
		el.addEventListener('pointerdown', down);
		el.addEventListener('pointermove', move);
		setBusy(true);
		setError(undefined);
		const showError = (error: unknown) => {
			if (stopped) return;
			setError(error instanceof Error ? error.message || error.name : String(error));
			setBusy(false);
		};
		void loadRuntime()
			.then((api) => {
				if (stopped) return;
				const g = new api.Graph(
					createRelationGraphOptions({
						container: el,
						minZoom: min,
						maxZoom: max,
						nodeDraggable: draggable,
						straightEdges: straight,
						theme: readTheme(el),
					}),
				);
				graph = g;
				g.on(api.NodeEvent.CLICK, (e: IElementEvent) => {
					const n = modelRef.current?.nodes.find((n) => relationGraphRendererNodeId(n.id) === e.target.id);
					if (n && !moved) latest.current.onSelectionChange?.({ id: n.id, type: 'node' });
				});
				g.on(api.EdgeEvent.CLICK, (e: IElementEvent) => {
					const r = modelRef.current?.relations.find((r) => relationGraphRendererRelationId(r.key) === e.target.id);
					if (r && !moved)
						latest.current.onSelectionChange?.(
							relationGraphSelectionForRelation(r, latest.current.selectionMode ?? 'node-and-relation'),
						);
				});
				g.on(api.CanvasEvent.CLICK, () => {
					if (!moved) latest.current.onSelectionChange?.(null);
				});
				observer = new ResizeObserver(() => g.resize());
				observer.observe(el);
				setSession({
					graph: g,
					enqueue: (fn) => {
						queue = queue
							.then(async () => {
								if (!stopped) await fn();
							})
							.catch(showError);
					},
				});
			})
			.catch(showError);
		return () => {
			stopped = true;
			setSession(undefined);
			observer?.disconnect();
			el.removeEventListener('pointerdown', down);
			el.removeEventListener('pointermove', move);
			void queue.then(() => graph?.destroy());
		};
	}, [hasData, min, max, draggable, straight]);
	const layout = p.layout ?? force,
		signature = JSON.stringify([model?.nodes.map((n) => n.id), model?.relations.map((r) => r.key), layout]);
	const { resolveNodeView, resolveRelationView, fitViewMinZoom } = p;
	useEffect(() => {
		if (!session || !model || !mount.current) return;
		const container = mount.current;
		let stale = false;
		session.enqueue(async () => {
			if (stale) return;
			const data = relationGraphToG6Data(model, { theme: readTheme(container), resolveNodeView, resolveRelationView });
			const g = session.graph,
				changed = session.signature !== signature;
			setError(undefined);
			setBusy(true);
			g.setLayout(relationGraphToG6Layout(layout));
			if (!changed)
				for (const n of data.nodes) {
					const [x, y] = g.getElementPosition(n.id);
					n.style = { ...n.style, x, y };
				}
			g.setData(data);
			if (changed) {
				await g.render();
				session.signature = signature;
				if (!stale) await fitRelationGraphView(g, fitViewMinZoom);
			} else await g.draw();
			if (!stale) {
				await applyRelationGraphSelection(g, model, latest.current.selected);
				setBusy(false);
			}
		});
		return () => {
			stale = true;
		};
	}, [session, model, signature, layout, resolveNodeView, resolveRelationView, fitViewMinZoom]);
	useEffect(() => {
		if (!model || !session) return;
		session.enqueue(() => applyRelationGraphSelection(session.graph, model, p.selected));
	}, [session, model, p.selected]);
	useEffect(() => {
		if (!p.selected) return;
		const clear = (e: KeyboardEvent) => {
			if (e.key === 'Escape') latest.current.onSelectionChange?.(null);
		};
		document.addEventListener('keydown', clear);
		return () => document.removeEventListener('keydown', clear);
	}, [p.selected]);
	const search = () => {
		const q = term.trim().toLowerCase();
		if (!q) return;
		const matches =
			model?.nodes.filter((n) => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) ?? [];
		setMiss(!matches.length);
		if (!matches.length) return;
		const selected = p.selected;
		const i = selected?.type === 'node' ? matches.findIndex((n) => n.id === selected.id) : -1;
		const n = matches[(i + 1) % matches.length];
		p.onSelectionChange?.({ id: n.id, type: 'node' });
		session?.enqueue(() => session.graph.focusElement(relationGraphRendererNodeId(n.id), false));
	};
	return (
		<GraphWorkspace
			className={p.className}
			rightSidebarSize={p.inspectorSize}
			rightSidebar={
				p.inspector !== undefined ? (
					<GraphWorkspacePanelSection grow title={p.inspectorTitle ?? locale.inspector}>
						{p.inspector}
					</GraphWorkspacePanelSection>
				) : undefined
			}
			toolbar={
				p.showToolbar === false ? undefined : (
					<GraphWorkspaceToolbar title={p.title ?? locale.graph}>
						<span>
							{model?.nodes.length ?? 0} {locale.nodes} · {model?.relations.length ?? 0} {locale.relations}
						</span>
						<GraphSearch
							label={p.searchPlaceholder ?? locale.search}
							value={term}
							onChange={(v) => {
								setTerm(v);
								setMiss(false);
							}}
							onSubmit={search}
						/>
						{miss && <span role="status">{locale.noMatch}</span>}
						{p.toolbar}
					</GraphWorkspaceToolbar>
				)
			}
		>
			<GraphWorkspaceCanvas>
				<div className="axc-graph-mount" ref={mount} />
				{parsed.error !== undefined || (hasData && error !== undefined) ? (
					<div role="alert">{parsed.error ?? error}</div>
				) : !hasData ? (
					<div>{p.empty ?? locale.empty}</div>
				) : (
					busy && <div role="status">{locale.loading}</div>
				)}
				{hasData && session && (
					<div className="axc-graph-controls">
						{(
							[
								[locale.zoomIn, () => session.graph.zoomBy(1.2, false)],
								[locale.zoomOut, () => session.graph.zoomBy(0.8, false)],
								[locale.fit, () => fitRelationGraphView(session.graph, fitViewMinZoom)],
								[
									locale.layout,
									async () => {
										await session.graph.layout(relationGraphToG6Layout(layout));
										await fitRelationGraphView(session.graph, fitViewMinZoom);
									},
								],
							] as const
						).map(([label, fn]) => (
							<GraphButton key={label} onClick={() => session.enqueue(fn)}>
								{label}
							</GraphButton>
						))}
					</div>
				)}
			</GraphWorkspaceCanvas>
		</GraphWorkspace>
	);
}
