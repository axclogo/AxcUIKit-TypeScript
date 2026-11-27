# Graphs

Import components from `@axclogo/uikit/graph` and load `@axclogo/uikit/graph/styles.css`. The React-free `@axclogo/uikit/graph/core` entry parses relation data without graph engines. See the [component reference](api/index.api.md) and [core reference](api/core.api.md).

Install the peer for each canvas you mount:

```sh
npm install @antv/g6@5.1.1                         # RelationGraph
npm install @xyflow/react@12.11.1 @dagrejs/dagre@3.1.4  # GraphWorkbench
```

Set `--axc-graph-height` and `--axc-graph-min-height` to fit the host layout. For GraphWorkbench also import `@xyflow/react/dist/style.css`. For the optional condition editor import `@axclogo/uikit/condition/styles.css`.

## RelationGraph

Pass records, JSON text containing a record array, or a table with named columns and positional rows. Each record contains `id`, `name`, `related_id` and `relation_type`, plus optional `color`. The last two relation fields are both null for a node-only declaration. Names and IDs must identify real nodes. Color is a six-digit hex color or null. Table column order is arbitrary; row width and the exact set of column names are checked.

```tsx
import { useState } from 'react';
import { RelationGraph, type RelationGraphProps, type RelationGraphSelection } from '@axclogo/uikit/graph';
import '@axclogo/uikit/graph/styles.css';

const props: RelationGraphProps = {
	data: [
		{ id: 'a', name: 'A', related_id: 'b', relation_type: 'links' },
		{ id: 'b', name: 'B', related_id: null, relation_type: null },
	],
	selected: null,
	layout: { type: 'dagre', direction: 'LR' },
};
export function Diagram() {
	const [selected, setSelected] = useState<RelationGraphSelection | null>(null);
	return <RelationGraph {...props} selected={selected} onSelectionChange={setSelected} />;
}
```

`normalizeRelationGraph(input: unknown): RelationGraphModel` validates external data. It throws a data error for malformed input, conflicting declarations, missing endpoints or duplicate relations. Parallel relation types, cycles, self-loops and isolated nodes are valid. Normalization canonicalizes finite numeric IDs to strings as specified by the protocol. Use `relationGraphRelationKey(source, target, type)` to address a relation, including when values contain delimiters. Controlled selection uses `selected` and `onSelectionChange(next)`; clearing selects null. Node and relation resolvers supply presentation. Invalid data or renderer failure is visible in the canvas. Invalid component configuration throws TypeError.

## GraphWorkbench

Use React Flow nodes, edges and change callbacks. The host owns both arrays and applies edits. In readonly mode you can inspect a node, pan and zoom. Dragging nodes, creating connections and keyboard deletion are disabled, including for nodes that allow dragging or connections in edit mode. A custom node uses GraphNodeShell; editor sections, palette and inspector content are slots. Supplied node positions remain authoritative when layout is omitted. A layout object opts into Dagre. Directions right/down map to LR/TB. In LR, columnGap is rank separation and rowGap is node separation; in TB these roles switch. Subtract half each node's dimensions from Dagre's center coordinates for React Flow. Previous positions stabilize the ordering. Topology changes trigger layout, manual coordinate changes alone do not. Apply snapToGrid when configured. Duplicate node or edge IDs and missing endpoints stop the canvas and show the offending ID. Correcting the graph data restores the canvas. If Dagre fails on a valid graph, the workbench displays the layout error and keeps the supplied node positions.

```tsx
import { useState } from 'react';
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import { GraphWorkbench, type GraphWorkbenchNode, type GraphWorkbenchEdge } from '@axclogo/uikit/graph';
import '@xyflow/react/dist/style.css';
import '@axclogo/uikit/graph/styles.css';

export function DiagramEditor() {
	const [nodes, setNodes] = useState<GraphWorkbenchNode[]>([
		{ id: 'a', position: { x: 0, y: 0 }, data: { view: { title: 'Alpha' } } },
		{ id: 'b', position: { x: 280, y: 0 }, data: { view: { title: 'Beta' } } },
	]);
	const [edges, setEdges] = useState<GraphWorkbenchEdge[]>([]);
	return (
		<GraphWorkbench
			nodes={nodes}
			edges={edges}
			layout={{ direction: 'right' }}
			onNodesChange={(changes) => setNodes((current) => applyNodeChanges(changes, current))}
			onEdgesChange={(changes) => setEdges((current) => applyEdgeChanges(changes, current))}
			onConnect={(connection) => setEdges((current) => addEdge(connection, current))}
		/>
	);
}
```

## Public prop audit

| Surface                      | Supported API                                                                                                                                                                                                                                                                                                                                                                                                                                | Remove from the public surface                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RelationGraph                | Keep data, className, empty, fitViewMinZoom, inspector, inspectorTitle, compact inspector sizing, layout, nodeDraggable, selected, selectionMode, onSelectionChange, both view resolvers, searchPlaceholder, showToolbar, straightEdges, title and zoomRange. Keep the shared toolbar slot.                                                                                                                                                  | Remove showSearch as an independent switch. Remove the implicit uncontrolled selection path; pass null for no selection.                                             |
| Relation data and appearance | Keep force/circular/concentric/dagre from the layout specification. Force strength, iterations, distance and spacing, and Dagre direction, nodeGap and rankGap are used in layout configurations. Keep node fill, highlight, iconText, label alignment/lines/placement, ribbon, shape, size, subtitle, tone and color, plus relation color, dashed, directed, label, tone and width. Keep optional protocol color independently of the view. | Drop iconPlacement override. Renderer registration, search state and theme adapters remain internal.                                                                 |
| GraphWorkbench               | Keep nodes, edges, mode, className, title, toolbar, palette, inspector, placement of both sidebars, fitViewOptions, showMiniMap, onNodesChange, onEdgesChange, onConnect, onNodeClick and onPaneClick. The design also requires layout, nodeTypes and empty. Sidebar sizing/title follow the shared shell.                                                                                                                                   | Consolidate readOnly into mode. Drop debug mode, independent fitView, minZoom/maxZoom, showToolbar and onInit. Remove layout.engine.                                 |
| Workbench geometry           | Keep direction, nodeWidth, nodeHeight, columnGap, rowGap and snapToGrid. The node shell receives React Flow NodeProps and its view data. Keep title, subtitle, icon, color, showStatus, badges, size, metrics, details and content from node model builders.                                                                                                                                                                                 | Drop status/statusText overrides without a direct node-view consumer. Previous positions, graph signature and engine handle are internal.                            |
| Workspace                    | Both renderers use the same root, toolbar, canvas, side panel, panel section, inspector and inspector section. Keep children, className, toolbar and left/right slots, compact right sidebar, section title, defaultExpanded, grow and panel empty content. Canvas/root forward native attributes. An undefined sidebar omits the column; null preserves its space.                                                                          | Drop mainClassName, sidebarClassName, left/rightSidebarClassName and titleClassName hooks for internal elements.                                                     |
| Editor helpers               | Keep GraphNodeShell, GraphWorkbenchEditor, GraphWorkbenchEditorSection, GraphWorkbenchRightSidebarToolbar and ControlConditionNodeEditor. Editors accept children/className, sections add title, toolbar items supply key/label/onClick. The optional condition helper uses fields, rule, isDefault, showDefaultSwitch, maxLevels and onChange; a host may replace the inspector completely.                                                 | Drop unused helper class and item icon/disabled overrides where absent from the reference. PalettePanel, InspectorPanel, CanvasToolbar and EmptyCanvas are internal. |

## Engines and styling contract

G6 5.1.1, React Flow 12.11.1 and Dagre 3.1.4 are exact optional peers and development fixtures. RelationGraph loads G6 with dynamic import and checks the runtime version. GraphWorkbench uses React Flow and synchronous Dagre. Import React Flow's base stylesheet from the host once when using the workbench. Import the UIKit graph stylesheet for shared layout and component styles. Tokens use `--axc-graph-*`.

The build probe exercises imports, version checks, type identity and a two-node Dagre layout. Browser acceptance in the component phases covers canvas startup and teardown, G6 selection/search/zoom, React Flow drag/connect, inspector interaction, viewport fitting and side-by-side LR/TB layout with real node dimensions.
