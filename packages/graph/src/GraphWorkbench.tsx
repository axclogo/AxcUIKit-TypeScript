import { useEffect, useState } from 'react';
import type * as CanvasModule from './flow-canvas.js';
import {
	GraphWorkspace,
	GraphWorkspaceCanvas,
	GraphWorkspaceToolbar,
	GraphWorkspacePanelSection,
	GraphWorkspaceInspector,
	GraphWorkspaceInspectorSection,
} from './workspace.js';
import { GraphLocale, useGraphLocale } from './graph-locale.js';
import { en } from './core/index.js';
import { AxcCondition } from '@axclogo/uikit/condition';
import { GraphButton, GraphSwitch } from './ui/controls.js';
import type {
	ControlConditionNodeEditorProps,
	GraphWorkbenchProps,
	GraphWorkbenchNodeData,
	GraphNodeShellProps,
	GraphWorkbenchEditorProps,
	GraphWorkbenchEditorSectionProps,
	GraphWorkbenchRightSidebarToolbarProps,
} from './types.js';

function useCanvas() {
	const [state, set] = useState<{ module?: typeof CanvasModule; error?: string }>({});
	useEffect(() => {
		let active = true;
		void import('./flow-canvas.js').then(
			(module) => {
				if (active) set({ module });
			},
			(e: unknown) => {
				if (active) set({ error: e instanceof Error ? e.message : String(e) });
			},
		);
		return () => {
			active = false;
		};
	}, []);
	return state;
}
/** Render a controlled React Flow canvas. Invalid layout options throw TypeError; rendering and topology errors are visible in the canvas. */
export function GraphWorkbench<T extends GraphWorkbenchNodeData = GraphWorkbenchNodeData>(p: GraphWorkbenchProps<T>) {
	const locale = p.locale ?? en,
		{ module, error } = useCanvas();
	const panels = (side: 'left' | 'right') => {
		const palette = p.palette !== undefined && (p.palettePlacement ?? 'left') === side,
			inspect = p.inspector !== undefined && (p.inspectorPlacement ?? 'left') === side;
		if (!palette && !inspect) return undefined;
		return (
			<>
				{palette && (
					<GraphWorkspacePanelSection title={locale.nodes} grow={!inspect}>
						{p.palette}
					</GraphWorkspacePanelSection>
				)}
				{inspect && (
					<GraphWorkspacePanelSection title={p.inspectorTitle ?? locale.inspector} grow>
						{p.inspector}
					</GraphWorkspacePanelSection>
				)}
			</>
		);
	};
	return (
		<GraphLocale.Provider value={locale}>
			<GraphWorkspace
				className={p.className}
				leftSidebar={panels('left')}
				rightSidebar={panels('right')}
				rightSidebarSize={p.rightSidebarSize}
				toolbar={
					<GraphWorkspaceToolbar title={p.title ?? locale.graph}>
						<span>{locale[p.mode ?? 'edit']}</span>
						{p.toolbar}
					</GraphWorkspaceToolbar>
				}
			>
				<GraphWorkspaceCanvas>
					{error !== undefined ? (
						<div role="alert">{error}</div>
					) : module ? (
						<module.FlowCanvas {...p} />
					) : (
						<div role="status">{locale.loading}</div>
					)}
				</GraphWorkspaceCanvas>
			</GraphWorkspace>
		</GraphLocale.Provider>
	);
}
/** Render the standard node view and connection handles inside a React Flow node. */
export function GraphNodeShell<T extends GraphWorkbenchNodeData = GraphWorkbenchNodeData>(p: GraphNodeShellProps<T>) {
	const { module, error } = useCanvas();
	return error !== undefined ? <div role="alert">{error}</div> : module ? <module.NodeShell {...p} /> : null;
}
/** Group editor controls inside the common inspector. */
export function GraphWorkbenchEditor(p: GraphWorkbenchEditorProps) {
	return <GraphWorkspaceInspector {...p} />;
}
/** Render an editor section with an optional heading. */
export function GraphWorkbenchEditorSection(p: GraphWorkbenchEditorSectionProps) {
	return <GraphWorkspaceInspectorSection {...p} />;
}
/** Display host-owned sidebar commands in declaration order. */
export function GraphWorkbenchRightSidebarToolbar({ items }: GraphWorkbenchRightSidebarToolbarProps) {
	return (
		<div className="axc-graph-sidebar-actions">
			{items.map((i) => (
				<GraphButton key={i.key} onClick={i.onClick}>
					{i.label}
				</GraphButton>
			))}
		</div>
	);
}
/** Edit a controlled condition and optional default switch. The condition editor emits intermediate drafts. */
export function ControlConditionNodeEditor({
	fields,
	rule,
	isDefault = false,
	showDefaultSwitch = true,
	maxLevels = 6,
	onChange,
}: ControlConditionNodeEditorProps) {
	const locale = useGraphLocale();
	return (
		<GraphWorkbenchEditorSection title={locale.condition}>
			{showDefaultSwitch && (
				<GraphSwitch
					label={locale.defaultRule}
					checked={isDefault}
					onChange={(v) => onChange({ rule, isDefault: v })}
				/>
			)}
			{(!showDefaultSwitch || !isDefault) && (
				<AxcCondition
					fields={fields}
					value={rule}
					maxLevels={maxLevels}
					allowEmpty
					onChange={(rule) => onChange(showDefaultSwitch ? { rule, isDefault } : { rule })}
				/>
			)}
		</GraphWorkbenchEditorSection>
	);
}
