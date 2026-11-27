import { useState } from 'react';
import {
	DataAnalysisTable,
	TableUIProvider,
	zhCN,
	type AnalysisConfig,
	type DataColumn,
	type DataAnalysisField,
} from '../src/index.js';
import '../src/styles.css';

const records = [
	{ id: 'D-1048', title: '界面设计指南', category: '设计', owner: '林溪', status: '待复核', updated: '2026-11-26' },
	{ id: 'D-1047', title: '组件命名约定', category: '开发', owner: '陈简', status: '已完成', updated: '2026-11-25' },
	{ id: 'D-1046', title: '可访问性检查清单', category: '质量', owner: '沈月', status: '进行中', updated: '2026-11-24' },
	{ id: 'D-1045', title: '颜色与对比度', category: '设计', owner: '林溪', status: '已完成', updated: '2026-11-23' },
	{ id: 'D-1044', title: '发布前检查项', category: '质量', owner: '陈简', status: '待复核', updated: '2026-11-22' },
	{ id: 'D-1043', title: '键盘交互规范', category: '开发', owner: '沈月', status: '进行中', updated: '2026-11-21' },
	{ id: 'D-1042', title: '图标绘制规范', category: '设计', owner: '林溪', status: '已完成', updated: '2026-11-20' },
	{ id: 'D-1041', title: '文档维护手册', category: '开发', owner: '陈简', status: '待复核', updated: '2026-11-19' },
];
type RecordRow = (typeof records)[number];
const columns = [
	{ key: 'title', title: '标题', width: 210 },
	{ key: 'category', title: '分类', width: 85 },
	{ key: 'owner', title: '负责人', width: 95 },
	{ key: 'status', title: '状态', width: 100 },
	{ key: 'updated', title: '更新时间', width: 138 },
	{ key: 'id', title: '编号', width: 100 },
] satisfies (DataColumn<RecordRow> & { key: keyof RecordRow; title: string })[];
const fields: DataAnalysisField[] = [
	{
		name: 'status',
		label: '状态',
		dataType: 'enum',
		colorable: true,
		options: ['待复核', '已完成', '进行中'].map((value) => ({ value, label: value })),
	},
	...columns
		.filter((c) => c.key !== 'status')
		.map((c) => ({ name: c.key, label: c.title, dataType: 'string' as const, colorable: true })),
];
const initial: AnalysisConfig = {
	keyword: '',
	condition: null,
	sorters: [],
	columns: { visible: ['title', 'category', 'owner', 'status', 'updated'], order: [], fixed: {}, widths: {} },
	rowHeight: 'normal',
	colorRules: [
		{ id: 'review', name: '状态 = 待复核', field: 'status', operator: '=', value: '待复核', color: 'orange' },
	],
};
export function TableExample() {
	const [config, setConfig] = useState(initial);
	const rows = records.filter((row) =>
		Object.values(row).some((value) => value.toLowerCase().includes(config.keyword.trim().toLowerCase())),
	);
	return (
		<TableUIProvider locale={zhCN}>
			<DataAnalysisTable
				title={
					<header className="sample-header">
						<h2>文档目录</h2>
						<span>{rows.length} 条记录</span>
					</header>
				}
				rows={rows}
				columns={columns}
				fields={fields}
				rowKey="id"
				config={config}
				onConfigChange={setConfig}
				searchPlaceholder="搜索文档"
			/>
		</TableUIProvider>
	);
}
