import { emptyCondition, type AxcConditionCatalog, type ConditionField } from '@axclogo/uikit/condition';
import type {
	DecisionPlugin,
	PluginConfig,
	PluginEvaluator,
	PluginRunEvidence,
	PluginJson,
	PluginPlan,
	PluginReply,
} from './types.js';
/** Index explicitly enabled plugins. Duplicate or blank identifiers are configuration errors. */
export function registerDecisionPlugins(plugins: readonly DecisionPlugin[]): ReadonlyMap<string, DecisionPlugin> {
	const result = new Map<string, DecisionPlugin>();
	for (const plugin of plugins) {
		if (!plugin.id.trim() || result.has(plugin.id)) throw new TypeError('Invalid or duplicate plugin ID: ' + plugin.id);
		result.set(plugin.id, plugin);
	}
	return result;
}
/** Create an editable draft. The empty postcondition must be completed before execution. */
export function newPluginPlan(plugin: DecisionPlugin): PluginPlan {
	return {
		version: 1,
		plugin: plugin.id,
		config: plugin.initialConfig(),
		inputs: {},
		outputs: [],
		precondition: null,
		postcondition: emptyCondition(),
	};
}
/** Add namespaced output fields for the postcondition, preserving the original field catalog. */
export function pluginFields(fields: ConditionField[], plan: PluginPlan): ConditionField[] {
	const outputs: ConditionField[] = plan.outputs.map((o) => ({
		name: 'plugin.' + o.key,
		label: 'plugin.' + o.key,
		dataType: o.type,
		valueSources: ['value', 'field'],
	}));
	if (plan.plugin === 'ai')
		outputs.unshift({
			name: 'plugin.text',
			label: 'plugin.text',
			dataType: 'string',
			valueSources: ['value', 'field'],
		});
	return [...fields, ...outputs];
}
/** Run one record through both Eval phases. A failed plugin emits failure evidence and preserves its cause. */
export async function runPluginDecision(options: {
	plan: PluginPlan;
	catalog: AxcConditionCatalog;
	record: PluginConfig;
	plugins: ReadonlyMap<string, DecisionPlugin>;
	evaluator: PluginEvaluator;
	signal: AbortSignal;
	onEvidence?: (snapshot: PluginRunEvidence) => void;
	sampleOutput?: { value: PluginJson };
}) {
	const { plan, catalog, record, plugins, evaluator, signal, onEvidence, sampleOutput } = options;
	const evidence: Parameters<PluginEvaluator['evaluatePlugin']>[4] = onEvidence
		? (snapshot) => onEvidence({ ...snapshot, resultSource: sampleOutput ? 'sample' : 'plugin' })
		: undefined;
	signal.throwIfAborted();
	const start = evaluator.evaluatePlugin(plan, catalog, record, undefined, evidence);
	if (start.status === 'skipped') return start;
	if (start.status !== 'needPlugin') throw new TypeError('Expected plugin request');
	let reply: PluginReply;
	let failure: { cause: unknown } | undefined;
	try {
		const plugin = plugins.get(plan.plugin);
		if (!plugin) throw new TypeError('Plugin is not enabled: ' + plan.plugin);
		plugin.validate(plan.config);
		if (!sampleOutput && plugin.unavailable) throw new TypeError(plugin.unavailable);
		const value = sampleOutput
			? sampleOutput.value
			: await plugin.execute({ config: plan.config, input: start.input, signal });
		signal.throwIfAborted();
		reply = { status: 'ok', requestId: start.requestId, result: value };
	} catch (cause) {
		if (signal.aborted) throw cause;
		failure = { cause };
		reply = {
			status: 'failed',
			requestId: start.requestId,
			error: cause instanceof Error ? { name: cause.name, message: cause.message } : String(cause),
		};
	}
	let done;
	try {
		done = evaluator.evaluatePlugin(plan, catalog, record, reply, evidence);
	} catch (error) {
		if (failure)
			throw new AggregateError([failure.cause, error], error instanceof Error ? error.message : String(error), {
				cause: failure.cause,
			});
		throw error;
	}
	if (done.status !== 'decided') throw new TypeError('Expected completed plugin decision');
	return done;
}
