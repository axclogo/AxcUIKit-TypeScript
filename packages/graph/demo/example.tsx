import { useState } from 'react';
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import {
	GraphWorkbench,
	RelationGraph,
	zhCN,
	type GraphWorkbenchNode,
	type GraphWorkbenchEdge,
	type RelationGraphSelection,
} from '../src/index.js';
import '@xyflow/react/dist/style.css';
import '../src/styles.css';

const nodesAtStart: GraphWorkbenchNode[] = ['起草', '复核', '发布'].map((title, i) => ({
	id: String(i),
	position: { x: i * 260, y: 0 },
	data: { view: { title, showStatus: false } },
}));
const edgesAtStart = [{ id: 'review', source: '0', target: '1' }];
const data = [
	{ id: 'guide', name: '设计指南', related_id: 'color', relation_type: '引用' },
	{ id: 'guide', name: '设计指南', related_id: 'type', relation_type: '引用' },
	{ id: 'color', name: '色彩规范', related_id: null, relation_type: null },
	{ id: 'type', name: '排版规范', related_id: null, relation_type: null },
];
export function GraphExample() {
	const [tab, setTab] = useState<'relation' | 'workbench'>('relation');
	const [selected, setSelected] = useState<RelationGraphSelection | null>(null);
	const [nodes, setNodes] = useState(nodesAtStart);
	const [edges, setEdges] = useState<GraphWorkbenchEdge[]>(edgesAtStart);
	return (
		<>
			<div className="sample-switch">
				<button type="button" aria-pressed={tab === 'relation'} onClick={() => setTab('relation')}>
					关系图
				</button>
				<button type="button" aria-pressed={tab === 'workbench'} onClick={() => setTab('workbench')}>
					节点编辑器
				</button>
			</div>
			{tab === 'relation' ? (
				<RelationGraph
					locale={zhCN}
					title="文档引用关系"
					data={data}
					selected={selected}
					onSelectionChange={setSelected}
					layout={{ type: 'dagre', direction: 'LR' }}
				/>
			) : (
				<GraphWorkbench
					locale={zhCN}
					title="文档流程"
					nodes={nodes}
					edges={edges}
					layout={{ direction: 'right' }}
					onNodesChange={(changes) => setNodes((current) => applyNodeChanges(changes, current))}
					onEdgesChange={(changes) => setEdges((current) => applyEdgeChanges(changes, current))}
					onConnect={(connection) => setEdges((current) => addEdge(connection, current))}
				/>
			)}
		</>
	);
}
