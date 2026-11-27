import { PluginExample } from '../packages/decision-plugins/demo/example.js';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConditionExample } from '../packages/condition/demo/example.js';
import { JsonExample } from '../packages/json-editor/demo/example.js';
import { GraphExample } from '../packages/graph/demo/example.js';
import { CrudExample } from '../packages/table/demo/crud.js';
import { TableExample } from '../packages/table/demo/example.js';
import { setThemePreference, useTheme, useThemePreference, type ThemePreference } from './theme.js';
import './style.css';

import { DrawerExample } from '../packages/drawer/demo/example.js';
import { CodeExample } from '../packages/code-editor/demo/example.js';

const examples = {
	'decision-plugins': {
		name: 'Condition · Plugins',
		title: '插件判断',
		description: '配置前置条件、测试插件，再用输出字段和原始数据判断。模型、已有脚本和辅助生成使用本地演示回调。',
		component: PluginExample,
		icon: 'M3 5h18v5H3zM3 14h18v5H3z',
	},
	drawer: {
		name: 'Drawer',
		title: '详情抽屉',
		description: '打开详情，滚动长正文，或从详情继续查看历史版本。',
		component: DrawerExample,
		icon: 'M3 4h18v16H3zM12 4v16',
	},
	'code-editor': {
		name: 'Code Editor',
		title: '代码编辑器',
		description: '切换语言并编辑文本。在 SQL 示例中输入 SELECT * FROM 后按 Ctrl+Space 可查看表名补全。',
		component: CodeExample,
		icon: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-14-3 18',
	},
	condition: {
		name: 'Condition',
		title: '条件选择器',
		description: '组合条件、切换决策模式，展开当前值查看生成的规则。',
		component: ConditionExample,
		icon: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
	},
	'json-editor': {
		name: 'JSON Editor',
		title: 'JSON 编辑器',
		description: '在参数和 JSON 源码之间切换，编辑同一份数据。',
		component: JsonExample,
		icon: 'M9 4H7v5l-3 3 3 3v5h2M15 4h2v5l3 3-3 3v5h-2',
	},
	table: {
		name: 'Table',
		title: '分析表格',
		description: '打开「列设置」拖动字段、切换显隐；打开「填色规则」选择色块，查看命中行的变化。',
		component: TableExample,
		icon: 'M3 4h18v16H3zM3 9h18M9 9v11M3 14h18',
	},
	'table-crud': {
		name: 'Table · CRUD',
		title: '文档管理列表',
		description: '新建、编辑或删除文档，也可以跨页勾选后批量删除。示例数据仅保存在当前页面。',
		component: CrudExample,
		icon: 'M3 4h18v16H3zM3 9h18M9 9v11M3 14h18',
	},
	graph: {
		name: 'Graph',
		title: '图画布',
		description: '在关系图中搜索节点；切换到节点编辑器，拖动节点或从右侧连接点拉线到下一节点。',
		component: GraphExample,
		icon: 'M6 7l10 8M7 17l8-10M3 4h5v5H3zM15 3h5v5h-5zM15 15h5v5h-5zM3 15h5v5H3z',
	},
};
const themeChoices: { value: ThemePreference; label: string; icon: string }[] = [
	{
		value: 'light',
		label: '浅色',
		icon: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
	},
	{ value: 'system', label: '跟随系统', icon: 'M3 5h18v11H3zM8 20h8M12 16v4' },
	{ value: 'dark', label: '深色', icon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z' },
];
function ThemeSwitch() {
	const current = useThemePreference();
	return (
		<div className="theme-switch" role="group" aria-label="颜色主题">
			{themeChoices.map(({ value, label, icon }) => (
				<button
					type="button"
					key={value}
					title={label}
					aria-label={label}
					aria-pressed={current === value}
					onClick={() => setThemePreference(value)}
				>
					<svg
						viewBox="0 0 24 24"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d={icon} />
					</svg>
				</button>
			))}
		</div>
	);
}
type Page = keyof typeof examples;
const pages: Page[] = [
	'condition',
	'decision-plugins',
	'json-editor',
	'table',
	'table-crud',
	'graph',
	'drawer',
	'code-editor',
];
function pageFromHash(): Page {
	const id = window.location.hash.slice(1);
	return pages.find((key) => key === id) ?? 'table';
}
function Gallery() {
	const [page, setPage] = useState(pageFromHash);
	const theme = useTheme();
	useEffect(() => {
		const navigate = () => setPage(pageFromHash());
		window.addEventListener('hashchange', navigate);
		return () => window.removeEventListener('hashchange', navigate);
	}, []);
	const { component: Example, name, title, description } = examples[page];
	useEffect(() => {
		document.title = name + ' · AxcUIKit 组件示例';
	}, [name]);
	return (
		<div className="gallery">
			<aside className="gallery-sidebar">
				<div className="gallery-brand">
					<svg width="31" height="31" viewBox="0 0 32 32" fill="none" aria-hidden="true">
						<rect width="32" height="32" rx="9" fill="url(#brand)" />
						<defs>
							<linearGradient id="brand" x1="0" y1="0" x2="32" y2="32">
								<stop stopColor="#818cf8" />
								<stop offset="1" stopColor="#6366f1" />
							</linearGradient>
						</defs>
						<path d="m6 23 8-15h4l8 15h-5l-5-10-5 10z" fill="#fff" />
					</svg>
					AxcUIKit
				</div>
				<nav aria-label="组件示例">
					<h2>组件示例</h2>
					{pages.map((key) => (
						<a key={key} href={'#' + key} aria-current={key === page ? 'page' : undefined}>
							<svg
								viewBox="0 0 24 24"
								width="18"
								height="18"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d={examples[key].icon} />
							</svg>
							{examples[key].name}
						</a>
					))}
				</nav>
			</aside>
			<main className="gallery-main">
				<header className="gallery-intro">
					<div className="gallery-intro-top">
						<code>@axclogo/uikit/{page === 'table-crud' ? 'table' : page}</code>
						<ThemeSwitch />
					</div>
					<h1>{title}</h1>
					<p>{description}</p>
				</header>
				{/* The G6 canvas reads its colors from CSS variables when it mounts, so it remounts on theme change. */}
				<div className="gallery-preview" key={page === 'graph' ? page + theme : page}>
					<Example />
				</div>
			</main>
		</div>
	);
}
createRoot(document.getElementById('root')!).render(<Gallery />);
