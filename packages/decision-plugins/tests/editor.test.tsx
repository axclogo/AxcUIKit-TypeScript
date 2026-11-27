import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
	PluginDecisionEditor,
	newPluginPlan,
	registerDecisionPlugins,
	runPluginDecision,
	pluginFields,
	type DecisionPlugin,
	type PluginEvaluator,
	type PluginPlan,
} from '../src/index.js';

afterEach(cleanup);
const catalog = { fields: [{ name: 'minimum', label: 'Minimum', dataType: 'number' as const }] };
const post = {
	combinator: 'and' as const,
	not: false,
	rules: [{ field: 'plugin.score', operator: '>=', valueSource: 'field' as const, value: 'minimum' }],
};
const trace = {
	matched: true,
	trace: { kind: 'skipped' as const, path: [], reason: 'andShortCircuit' as const },
	decisiveRules: [],
};
function setup() {
	const calls: string[] = [];
	const plugin: DecisionPlugin = {
		id: 'http',
		label: 'HTTP',
		initialConfig: () => ({ url: 'https://example.test' }),
		renderEditor: (p) => (
			<input
				aria-label="Endpoint"
				value={p.config.url as string}
				onChange={(e) => p.onChange({ url: e.target.value })}
			/>
		),
		validate() {
			calls.push('validate');
		},
		async execute() {
			calls.push('execute');
			return { score: 86 };
		},
		requireTest: true,
	};
	const evaluator: PluginEvaluator = {
		pluginInput: () => ({ minimum: 80 }),
		validatePlugin(plan) {
			calls.push('save');
			if (!plan.postcondition.rules.length) throw new TypeError('Postcondition is required');
		},
		projectPluginOutputs(_, outputs) {
			if (outputs.some((o) => o.path !== '$.score')) throw new TypeError('Missing output path');
			return { score: 86 };
		},
		evaluatePlugin(_p, _c, _r, reply) {
			calls.push(reply ? 'complete' : 'start');
			if (reply?.status === 'failed') throw new Error('Plugin failed');
			return reply
				? { status: 'decided', requestId: 'test', outputs: { score: 86 }, matched: true, pre: null, post: trace }
				: { status: 'needPlugin', requestId: 'test', input: { minimum: 80 }, pre: null };
		},
	};
	const plan: PluginPlan = {
		...newPluginPlan(plugin),
		inputs: { minimum: 'minimum' },
		outputs: [{ key: 'score', path: '$.score', type: 'number' }],
		postcondition: post,
	};
	return { calls, plugin, evaluator, plan };
}
function button(name: string) {
	return screen.getByRole('button', { name }) as HTMLButtonElement;
}
async function click(name: string) {
	await act(async () => fireEvent.click(button(name)));
}
function mount(set = setup()) {
	const saved: PluginPlan[] = [];
	function Host() {
		const [value, onChange] = useState(set.plan);
		return (
			<PluginDecisionEditor
				value={value}
				onChange={onChange}
				onSave={(v) => saved.push(v)}
				plugins={[set.plugin]}
				evaluator={set.evaluator}
				catalog={catalog}
				samples={[{ id: 'a', label: 'A', record: { minimum: 80 } }]}
			/>
		);
	}
	render(<Host />);
	return { ...set, saved };
}
test('HTTP requires a current successful test; mapping changes reuse response and request changes invalidate it', async () => {
	const s = mount();
	assert.equal(button('Save rule').disabled, true);
	await click('Test plugin');
	assert.equal(button('Save rule').disabled, false);
	assert.deepEqual(s.calls, ['validate', 'execute']);
	fireEvent.change(screen.getByRole('textbox', { name: 'JSONPath' }), { target: { value: '$.missing' } });
	assert.equal(button('Save rule').disabled, true);
	assert.ok(screen.getByRole('alert').textContent?.includes('Missing output path'));
	fireEvent.change(screen.getByRole('textbox', { name: 'JSONPath' }), { target: { value: '$.score' } });
	await click('Save rule');
	assert.equal(s.saved.length, 1);
	assert.equal(s.calls.filter((c) => c === 'execute').length, 1);
	fireEvent.change(screen.getByRole('textbox', { name: 'Endpoint' }), { target: { value: 'https://other.test' } });
	assert.equal(button('Save rule').disabled, true);
});
test('simulation supports controlled sample output without calling plugin; real failures are visible', async () => {
	const s = mount();
	fireEvent.change(screen.getByRole('combobox', { name: 'Result source' }), { target: { value: 'mock' } });
	fireEvent.change(screen.getByRole('textbox', { name: 'Sample output (JSON)' }), {
		target: { value: '{"score":86}' },
	});
	await click('Run decision');
	assert.ok(screen.getByRole('heading', { name: 'Matched · Use sample output' }));
	assert.ok(!s.calls.includes('execute'));
	fireEvent.change(screen.getByRole('textbox', { name: 'Sample output (JSON)' }), { target: { value: '{' } });
	await click('Run decision');
	assert.ok(screen.getByRole('alert'));
});
test('cancellation discards late plugin replies and switching configuration clears test state', async () => {
	const s = setup();
	let complete!: (v: { score: number }) => void;
	let signal!: AbortSignal;
	s.plugin.execute = (call) => {
		signal = call.signal;
		return new Promise((resolve) => {
			complete = resolve;
		});
	};
	mount(s);
	await click('Test plugin');
	assert.equal(button('Test plugin').disabled, true);
	await click('Cancel');
	assert.equal(signal.aborted, true);
	await act(async () => complete({ score: 86 }));
	assert.equal(button('Save rule').disabled, true);
	await click('Test plugin');
	fireEvent.change(screen.getByRole('textbox', { name: 'Endpoint' }), { target: { value: 'https://changed.test' } });
	assert.equal(signal.aborted, true);
	await act(async () => complete({ score: 86 }));
	assert.equal(button('Save rule').disabled, true);
});
test('enabled but unavailable plugins remain selectable and explain missing integration', () => {
	const s = setup();
	s.plugin.unavailable = 'Execution service is not connected';
	mount(s);
	assert.equal(button('Test plugin').disabled, true);
	assert.equal(button('Run decision').disabled, true);
	assert.equal(button('Save rule').disabled, true);
	assert.equal(screen.getByRole('alert').textContent, s.plugin.unavailable);
	fireEvent.change(screen.getByRole('combobox', { name: 'Result source' }), { target: { value: 'mock' } });
	assert.equal(button('Run decision').disabled, false);
});
test('runtime preserves plugin failure cause and respects precondition short circuit', async () => {
	const s = setup(),
		failure = new Error('network offline');
	s.plugin.execute = async () => {
		throw failure;
	};
	const options = {
		...s,
		catalog,
		record: { minimum: 80 },
		plugins: registerDecisionPlugins([s.plugin]),
		signal: new AbortController().signal,
	};
	await assert.rejects(
		runPluginDecision(options),
		(e) => e instanceof AggregateError && e.cause === failure && e.errors[0] === failure,
	);
	s.evaluator.evaluatePlugin = () => ({ status: 'skipped', pre: { ...trace, matched: false } });
	assert.equal((await runPluginDecision(options)).status, 'skipped');
	assert.throws(() => registerDecisionPlugins([s.plugin, s.plugin]), TypeError);
	assert.deepEqual(
		pluginFields(catalog.fields, { ...s.plan, plugin: 'ai' }).map((f) => f.name),
		['minimum', 'plugin.text', 'plugin.score'],
	);
});

test('replacing an executor clears a previous decision trace', async () => {
	const s = setup();
	const props = {
		value: s.plan,
		onChange: () => {},
		plugins: [s.plugin],
		evaluator: s.evaluator,
		catalog,
		samples: [{ id: 'a', label: 'A', record: { minimum: 80 } }],
	};
	const view = render(<PluginDecisionEditor {...props} />);
	await click('Run decision');
	assert.ok(screen.getByRole('heading', { name: 'Matched · Run plugin' }));
	view.rerender(<PluginDecisionEditor {...props} plugins={[{ ...s.plugin }]} />);
	assert.equal(screen.queryByRole('heading', { name: 'Matched · Run plugin' }), null);
});

test('sample evidence is tagged and callback failures remain observable', async () => {
	const s = setup();
	const original = s.evaluator.evaluatePlugin;
	s.evaluator.evaluatePlugin = (plan, catalog, record, reply, evidence) => {
		evidence?.({ kind: 'plugin', snapshotId: 'one', input: {}, outcome: {} });
		return original(plan, catalog, record, reply);
	};
	const sources: string[] = [];
	const options = {
		...s,
		catalog,
		record: { minimum: 80 },
		plugins: registerDecisionPlugins([s.plugin]),
		signal: new AbortController().signal,
		sampleOutput: { value: { score: 86 } },
	};
	await runPluginDecision({ ...options, onEvidence: (e) => sources.push(e.resultSource) });
	assert.deepEqual(sources, ['sample', 'sample']);
	const failure = new Error('snapshot store failed');
	await assert.rejects(
		runPluginDecision({
			...options,
			onEvidence: () => {
				throw failure;
			},
		}),
		(e) => e === failure,
	);
});
