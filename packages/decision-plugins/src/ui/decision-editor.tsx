import { useEffect, useRef, useState } from 'react';
import {
	AxcCondition,
	AxcConditionAssist,
	AxcUIProvider,
	emptyCondition,
	en,
	zhCN,
	type AxcAssistTransport,
	type AxcConditionCatalog,
	type AxcConditionValue,
} from '@axclogo/uikit/condition';
import { words } from '../core/locales/index.js';
import type {
	DecisionPlugin,
	PluginConfig,
	PluginEvaluator,
	PluginRunEvidence,
	PluginJson,
	PluginPlan,
} from '../types.js';
import { newPluginPlan, pluginFields, registerDecisionPlugins, runPluginDecision } from '../runtime.js';
import { JsonView } from './editors.js';
import { InputBindings, OutputBindings } from './mappings.js';
export interface PluginDecisionEditorProps {
	value: PluginPlan;
	onChange: (plan: PluginPlan) => void;
	onSave?: (plan: PluginPlan) => void;
	catalog: AxcConditionCatalog;
	plugins: readonly DecisionPlugin[];
	evaluator: PluginEvaluator;
	samples: readonly { id: string; label: string; record: PluginConfig }[];
	assist?: AxcAssistTransport;
	language?: 'en' | 'zh-CN';
	onEvidence?: (snapshot: PluginRunEvidence) => void;
}
function message(e: unknown) {
	return e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
}
function project(evaluator: PluginEvaluator, plan: PluginPlan, raw: PluginJson) {
	try {
		return { outputs: evaluator.projectPluginOutputs(plan.plugin, plan.outputs, raw) };
	} catch (e) {
		return { error: message(e) };
	}
}
type TestResult = { key: string; raw: PluginJson };
type RunResult = Awaited<ReturnType<typeof runPluginDecision>>;
function Editor(p: PluginDecisionEditorProps) {
	const { value: plan, onChange, assist, catalog, evaluator, language } = p,
		l = words(language);
	const registry = registerDecisionPlugins(p.plugins),
		plugin = registry.get(plan.plugin);
	const [sampleId, setSample] = useState(p.samples[0]?.id ?? '');
	const sample = p.samples.find((s) => s.id === sampleId);
	const [tested, setTested] = useState<TestResult>(),
		[report, setReport] = useState<{ key: string; value: RunResult }>(),
		[feedback, setFeedback] = useState(''),
		[error, setError] = useState('');
	const [source, setSource] = useState<'live' | 'mock'>('live'),
		[mock, setMock] = useState('null');
	const [busy, setBusy] = useState(false);
	const pending = useRef<AbortController | null>(null);
	const testKey = JSON.stringify([plan.plugin, plan.config, plan.inputs, sampleId, sample?.record, catalog]);
	const runKey = JSON.stringify([
		testKey,
		plan.outputs,
		plan.precondition,
		plan.postcondition,
		source,
		source === 'mock' ? mock : null,
	]);
	useEffect(() => {
		setBusy(false);
		setFeedback('');
		setError('');
		setReport(undefined);
		return () => {
			pending.current?.abort();
			pending.current = null;
		};
	}, [runKey, plugin, evaluator]);
	useEffect(() => {
		setTested(undefined);
	}, [testKey, plugin, evaluator]);
	const patch = (next: Partial<PluginPlan>) => onChange({ ...plan, ...next });
	const testedNow = tested?.key === testKey ? tested : undefined;
	const preview = testedNow ? project(evaluator, plan, testedNow.raw) : undefined;
	const postFields = pluginFields(catalog.fields, plan).map((field, index) => ({
		...field,
		label: (index < catalog.fields.length ? l.field : l.outputs) + ' / ' + field.label,
	}));
	const names = new Set<string>();
	const invalidNames =
		plan.outputs.some((o) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(o.key)) ||
		postFields.some((f) => names.has(f.name) || !names.add(f.name));
	function condition(value: AxcConditionValue, part: 'precondition' | 'postcondition') {
		const props = {
			...catalog,
			fields: part === 'precondition' ? catalog.fields : postFields,
			value,
			onChange: (v: AxcConditionValue) => patch({ [part]: v }),
		};
		return assist ? <AxcConditionAssist {...props} assist={assist} /> : <AxcCondition {...props} />;
	}
	async function task(simulate: boolean) {
		const controller = new AbortController();
		pending.current = controller;
		setBusy(true);
		setError('');
		setFeedback('');
		setReport(undefined);
		if (!simulate) setTested(undefined);
		try {
			if (simulate) {
				const value = await runPluginDecision({
					plan,
					catalog,
					record: sample!.record,
					plugins: registry,
					evaluator,
					signal: controller.signal,
					onEvidence: p.onEvidence,
					sampleOutput: source === 'mock' ? { value: JSON.parse(mock) } : undefined,
				});
				if (!controller.signal.aborted) setReport({ key: runKey, value });
			} else {
				plugin!.validate(plan.config);
				const input = evaluator.pluginInput(plan.inputs, catalog, sample!.record);
				const raw = await plugin!.execute({ config: plan.config, input, signal: controller.signal });
				if (!controller.signal.aborted) setTested({ key: testKey, raw });
			}
		} catch (e) {
			if (!controller.signal.aborted) setError(message(e));
		} finally {
			if (pending.current === controller) {
				pending.current = null;
				setBusy(false);
			}
		}
	}
	function save() {
		setError('');
		setFeedback('');
		try {
			plugin!.validate(plan.config);
			evaluator.validatePlugin(plan, catalog);
		} catch (e) {
			setError(message(e));
			return;
		}
		p.onSave!(plan);
		setFeedback(l.saved);
	}
	return (
		<section className="axc-plugin-editor">
			<label>
				{l.mode}
				<select value={plan.plugin} onChange={(e) => onChange(newPluginPlan(registry.get(e.target.value)!))}>
					{!plugin && (
						<option value={plan.plugin} disabled>
							{plan.plugin}
						</option>
					)}
					{p.plugins.map((v) => (
						<option key={v.id} value={v.id}>
							{v.label}
						</option>
					))}
				</select>
			</label>
			{!plugin ? (
				<p role="alert">
					{l.missing} · {plan.plugin}
				</p>
			) : (
				<>
					<fieldset>
						<legend>
							<label>
								<input
									type="checkbox"
									checked={plan.precondition !== null}
									onChange={(e) => patch({ precondition: e.target.checked ? emptyCondition() : null })}
								/>
								{l.pre}
							</label>
						</legend>
						{plan.precondition && condition(plan.precondition, 'precondition')}
					</fieldset>
					<fieldset>
						<legend>{plugin.label}</legend>
						<InputBindings
							plan={plan}
							fields={catalog.fields}
							change={(inputs) => patch({ inputs })}
							language={language}
						/>
						{plugin.renderEditor({
							config: plan.config,
							onChange: (config) => patch({ config }),
							inputs: plan.inputs,
							outputs: plan.outputs,
							assist,
							language,
						})}
						{plugin.unavailable && <p role="alert">{plugin.unavailable}</p>}
						<label>
							{l.sample}
							<select value={sampleId} onChange={(e) => setSample(e.target.value)}>
								<option value="" disabled>
									{l.sample}
								</option>
								{p.samples.map((s) => (
									<option key={s.id} value={s.id}>
										{s.label}
									</option>
								))}
							</select>
						</label>
						<button type="button" disabled={!sample || busy || !!plugin.unavailable} onClick={() => void task(false)}>
							{l.test}
						</button>
						{testedNow && (
							<>
								<h4>{l.response}</h4>
								<JsonView value={testedNow.raw} label={l.response} />
							</>
						)}
						<OutputBindings outputs={plan.outputs} change={(outputs) => patch({ outputs })} language={language} />
						{preview &&
							(preview.error === undefined ? (
								<JsonView value={preview.outputs} label={l.preview} />
							) : (
								<p role="alert">{preview.error}</p>
							))}
					</fieldset>
					<fieldset>
						<legend>{l.post}</legend>
						{invalidNames ? <p role="alert">{l.outputNames}</p> : condition(plan.postcondition, 'postcondition')}
					</fieldset>
					<div className="axc-plugin-row">
						<label>
							{l.source}
							<select value={source} onChange={(e) => setSource(e.target.value as 'live' | 'mock')}>
								<option value="live">{l.live}</option>
								<option value="mock">{l.mock}</option>
							</select>
						</label>
						<button
							type="button"
							disabled={busy || !sample || (source === 'live' && !!plugin.unavailable) || invalidNames}
							onClick={() => void task(true)}
						>
							{l.run}
						</button>
						{busy && (
							<button
								type="button"
								onClick={() => {
									pending.current?.abort();
									pending.current = null;
									setBusy(false);
								}}
							>
								{l.cancel}
							</button>
						)}
						{p.onSave && (
							<button
								type="button"
								disabled={
									!!plugin.unavailable || invalidNames || busy || !!preview?.error || (plugin.requireTest && !testedNow)
								}
								onClick={save}
							>
								{l.save}
							</button>
						)}
					</div>
					{plugin.requireTest && !testedNow && <small>{l.tested}</small>}
					{source === 'mock' && (
						<label>
							{l.raw}
							<textarea value={mock} onChange={(e) => setMock(e.target.value)} />
						</label>
					)}
					{busy && <p role="status">{l.pending}</p>}
					{error && <p role="alert">{error}</p>}
					{feedback && <p role="status">{feedback}</p>}
					{report?.key === runKey && (
						<>
							<h4>
								{report.value.status === 'skipped' ? l.skipped : report.value.matched ? l.matched : l.unmatched} ·{' '}
								{source === 'mock' ? l.mock : l.live}
							</h4>
							<JsonView value={report.value} label={l.result} />
						</>
					)}
				</>
			)}
		</section>
	);
}
/** Edit a controlled version-one plan. Save validates the complete rule. Standalone tests do not invoke either gate. */
export function PluginDecisionEditor(props: PluginDecisionEditorProps) {
	return (
		<AxcUIProvider locale={props.language === 'zh-CN' ? zhCN : en}>
			<Editor {...props} />
		</AxcUIProvider>
	);
}
