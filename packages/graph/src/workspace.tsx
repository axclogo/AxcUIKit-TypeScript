import { useState } from 'react';
import type {
	GraphWorkspaceProps,
	GraphWorkspaceToolbarProps,
	GraphWorkspaceCanvasProps,
	GraphWorkspaceInspectorProps,
	GraphWorkspaceInspectorSectionProps,
	GraphWorkspacePanelSectionProps,
	GraphWorkspaceSidePanelProps,
} from './types.js';
import { PanelToggle } from './ui/controls.js';
/** Compose a canvas with optional sidebars. An explicitly empty sidebar retains its column. */
export function GraphWorkspace({
	children,
	className,
	toolbar,
	leftSidebar,
	rightSidebar,
	rightSidebarSize,
	...html
}: GraphWorkspaceProps) {
	return (
		<div {...html} className={'axc-graph ' + (className ?? '')} data-sidebar-size={rightSidebarSize}>
			{toolbar}
			<div className="axc-graph-main" data-left={leftSidebar !== undefined} data-right={rightSidebar !== undefined}>
				{leftSidebar !== undefined && <aside>{leftSidebar}</aside>}
				{children}
				{rightSidebar !== undefined && <aside>{rightSidebar}</aside>}
			</div>
		</div>
	);
}
/** Render the common toolbar with host title and actions. */
export function GraphWorkspaceToolbar({ title, className, children }: GraphWorkspaceToolbarProps) {
	return (
		<header className={'axc-graph-toolbar ' + (className ?? '')}>
			<strong>{title}</strong>
			{children}
		</header>
	);
}
/** Render the grid's canvas item and forward native section attributes. */
export function GraphWorkspaceCanvas({ className, ...props }: GraphWorkspaceCanvasProps) {
	return <section {...props} className={'axc-graph-canvas ' + (className ?? '')} />;
}
/** Group inspector content in a scrollable sidebar. */
export function GraphWorkspaceInspector({ children, className }: GraphWorkspaceInspectorProps) {
	return <div className={'axc-graph-inspector ' + (className ?? '')}>{children}</div>;
}
/** Display a titled inspector section. */
export function GraphWorkspaceInspectorSection({ title, className, children }: GraphWorkspaceInspectorSectionProps) {
	return (
		<section className={'axc-graph-section ' + (className ?? '')}>
			{title && <strong>{title}</strong>}
			{children}
		</section>
	);
}
/** Render an independently collapsible panel; defaultExpanded is read on mount. */
export function GraphWorkspacePanelSection({
	title,
	children,
	grow,
	defaultExpanded = true,
}: GraphWorkspacePanelSectionProps) {
	const [expanded, set] = useState(defaultExpanded);
	return (
		<section className="axc-graph-panel" data-grow={grow && expanded}>
			<PanelToggle expanded={expanded} onClick={() => set(!expanded)}>
				{title}
			</PanelToggle>
			{expanded && <div>{children}</div>}
		</section>
	);
}
/** Render a standalone side panel, displaying empty content while children are absent. */
export function GraphWorkspaceSidePanel({ title, children, empty, className }: GraphWorkspaceSidePanelProps) {
	return (
		<aside className={'axc-graph-side ' + (className ?? '')}>
			<strong>{title}</strong>
			{children ?? empty}
		</aside>
	);
}
