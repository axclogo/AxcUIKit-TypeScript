export interface Locale {
	empty: string;
	graph: string;
	nodes: string;
	relations: string;
	inspector: string;
	search: string;
	noMatch: string;
	zoomIn: string;
	zoomOut: string;
	fit: string;
	layout: string;
	loading: string;
	edit: string;
	readonly: string;
	condition: string;
	defaultRule: string;
	idle: string;
}
export const en: Locale = {
	empty: 'No nodes',
	graph: 'Graph',
	nodes: 'Nodes',
	relations: 'Relations',
	inspector: 'Inspector',
	search: 'Find node',
	noMatch: 'No matching node',
	zoomIn: 'Zoom in',
	zoomOut: 'Zoom out',
	fit: 'Fit view',
	layout: 'Run layout',
	loading: 'Rendering',
	edit: 'Edit',
	readonly: 'Read only',
	condition: 'Condition',
	defaultRule: 'Default condition',
	idle: 'Idle',
};
export const zhCN: Locale = {
	empty: '暂无节点',
	graph: '关系图',
	nodes: '节点',
	relations: '关系',
	inspector: '详情',
	search: '查找节点',
	noMatch: '未找到节点',
	zoomIn: '放大',
	zoomOut: '缩小',
	fit: '适配视图',
	layout: '重新布局',
	loading: '渲染中',
	edit: '编辑',
	readonly: '只读',
	condition: '条件规则',
	defaultRule: '默认条件',
	idle: '待执行',
};
