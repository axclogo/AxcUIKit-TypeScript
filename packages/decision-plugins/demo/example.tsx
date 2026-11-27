import { useEffect, useMemo, useState } from 'react';
import {
	builtinDecisionPlugins,
	PluginDecisionEditor,
	PluginTextAssist,
	newPluginPlan,
	type DecisionPlugin,
	type PluginEvaluator,
	type PluginPlan,
	type ResourceService,
} from '../src/index.js';
import type { AxcAssistTransport, AxcConditionCatalog, AxcRule, AxcConditionValue } from '@axclogo/uikit/condition';
import '../src/styles.css';
const catalog: AxcConditionCatalog = {
	fields: [
		{ name: 'min', label: '最低分', dataType: 'number' },
		{ name: 'title', label: '标题' },
	],
};
const samples = [
	{ id: 'a', label: '样本 A · 最低分 80', record: { min: 80, title: 'review' } },
	{ id: 'b', label: '样本 B · 最低分 95', record: { min: 95, title: 'other' } },
];
const group = (rule: AxcRule): AxcConditionValue => ({ combinator: 'and', not: false, rules: [rule] });
const refRule = group({ field: 'plugin.score', operator: '>=', valueSource: 'field', value: 'min' });
const assist: AxcAssistTransport = {
	models: [{ id: 'demo', label: '本地演示' }],
	async generate(request) {
		const schema = request.response_schema.properties as { value: { type?: string } };
		if (schema.value.type === 'string') {
			const { target } = JSON.parse(request.prompt) as { target: string };
			return {
				explanation: '本地示例草稿，可修改后采用。',
				value: target.includes('JavaScript') ? 'return { score: input.min + 2 };' : '请按输入生成 JSON 评分。',
			};
		}
		return { explanation: '检查原始记录的最低分。', value: group({ field: 'min', operator: '>=', value: 80 }) };
	},
};
const custom: DecisionPlugin = {
	id: 'constant',
	label: '自定义插件 · 固定文本',
	initialConfig: () => ({ text: 'review' }),
	validate(c) {
		if (typeof c.text !== 'string') throw new TypeError('请输入文本');
	},
	async execute({ config }) {
		return { text: config.text };
	},
	renderEditor(p) {
		const change = (text: string) => p.onChange({ text });
		return (
			<>
				<label>
					文本
					<input value={p.config.text as string} onChange={(e) => change(e.target.value)} />
				</label>
				{p.assist && (
					<PluginTextAssist
						assist={p.assist}
						language={p.language}
						context={{}}
						target="自定义文本"
						value={p.config.text as string}
						onApply={change}
					/>
				)}
			</>
		);
	},
};
function example(plugin: DecisionPlugin): PluginPlan {
	const plan = newPluginPlan(plugin);
	plan.inputs = { title: 'title', min: 'min' };
	plan.outputs = [{ key: 'score', path: plugin.id === 'http' ? '$.data.score' : '$.score', type: 'number' }];
	plan.postcondition = refRule;
	if (plugin.id === 'http')
		plan.config = { ...plan.config, url: new URL('fixtures/plugin-response.json', document.baseURI).href };
	if (plugin.id === 'javascript') plan.config = { code: 'return { score: input.min + 2 };' };
	if (['ai', 'model', 'script'].includes(plugin.id))
		plan.config = {
			...plan.config,
			id: 'demo',
			version: '1',
			...(plugin.id === 'ai' ? { prompt: '按标题评分，或返回 review。' } : {}),
		};
	if (plugin.id === 'ai')
		plan.postcondition = {
			combinator: 'or',
			not: false,
			rules: [{ field: 'plugin.text', operator: 'contains', value: 'review' }, ...refRule.rules],
		};
	if (plugin.id === 'constant') {
		plan.outputs = [{ key: 'text', path: '$.text', type: 'string' }];
		plan.postcondition = group({ field: 'plugin.text', operator: '=', value: 'review' });
	}
	return plan;
}
function Loaded({ evaluator }: { evaluator: PluginEvaluator }) {
	const [added, setAdded] = useState(false),
		[enableAssist, setEnableAssist] = useState(true),
		[connected, setConnected] = useState(true);
	const plugins = useMemo(() => {
		const service: ResourceService = {
			resources: [
				{ id: 'demo', version: '1', label: '示例资源' },
				...(added ? [{ id: 'extra', version: '1', label: '新增资源' }] : []),
			],
			invoke: async () => ({ score: 86 }),
		};
		return [
			...builtinDecisionPlugins({
				language: 'zh-CN',
				model: {
					...service,
					invoke: connected ? service.invoke : undefined,
					actions: (
						<button type="button" onClick={() => setAdded(true)}>
							添加示例资源
						</button>
					),
				},
				script: service,
				ai: {
					...service,
					invoke: async (_, call) => (call.input.title === 'review' ? 'review' : JSON.stringify({ score: 86 })),
				},
			}),
			custom,
		];
	}, [added, connected]);
	const [plan, setPlan] = useState(() => example(plugins.find((p) => p.id === 'http')!));
	const [saved, setSaved] = useState<PluginPlan>();
	return (
		<>
			<div className="sample-switch">
				<label>
					<input type="checkbox" checked={enableAssist} onChange={(e) => setEnableAssist(e.target.checked)} />
					AI 辅助编写
				</label>
				<label>
					<input type="checkbox" checked={connected} onChange={(e) => setConnected(e.target.checked)} />
					接入小模型执行接口
				</label>
			</div>
			<PluginDecisionEditor
				language="zh-CN"
				evaluator={evaluator}
				plugins={plugins}
				catalog={catalog}
				samples={samples}
				value={plan}
				assist={enableAssist ? assist : undefined}
				onChange={(next) =>
					setPlan(next.plugin === plan.plugin ? next : example(plugins.find((p) => p.id === next.plugin)!))
				}
				onSave={setSaved}
			/>
			{saved && (
				<details>
					<summary>已保存的规则</summary>
					<pre>{JSON.stringify(saved, null, 2)}</pre>
				</details>
			)}
		</>
	);
}
export function PluginExample() {
	const [api, setApi] = useState<PluginEvaluator>(),
		[error, setError] = useState('');
	useEffect(() => {
		let active = true;
		const entry = new URL('dist/eval/axc_eval_wasm.js', document.baseURI).href;
		void (async () => {
			const module = (await import(entry)) as PluginEvaluator & { default: () => Promise<unknown> };
			await module.default();
			if (active) setApi(module);
		})().catch((cause: unknown) => {
			if (active) setError(String(cause));
		});
		return () => {
			active = false;
		};
	}, []);
	if (error) return <p role="alert">请先用 npm run demo:eval 导入本地 Eval 的 web 构建。{error}</p>;
	return api ? <Loaded evaluator={api} /> : <p role="status">正在加载判断器…</p>;
}
