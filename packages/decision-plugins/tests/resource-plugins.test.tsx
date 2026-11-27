import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { builtinDecisionPlugins } from '../src/ui/presets.js';
import type { PluginConfig, PluginInvocation, ResourceService } from '../src/types.js';

afterEach(cleanup);
const kinds = ['ai', 'model', 'script'] as const;
const resources = [
	{ id: 'classifier', version: '1', label: 'Classifier' },
	{ id: 'classifier', version: '2', label: 'Classifier' },
];
const config: PluginConfig = { id: 'classifier', version: '1', prompt: 'Keep the original words.' };
const call: PluginInvocation = { config, input: { title: 'Example', count: 0 }, signal: new AbortController().signal };
function preset(kind: (typeof kinds)[number], service?: ResourceService) {
	return builtinDecisionPlugins({ [kind]: service }).find((plugin) => plugin.id === kind)!;
}

test('resource plugins distinguish missing catalog, missing invoker and empty catalog', async () => {
	for (const kind of kinds) {
		const missing = preset(kind);
		assert.equal(missing.unavailable, 'Resource catalog is not connected');
		assert.throws(() => missing.validate(config), /Resource catalog is not connected/);
		await assert.rejects(missing.execute(call), /Resource catalog is not connected/);
		const noInvoker = preset(kind, { resources });
		assert.equal(noInvoker.unavailable, 'Execution service is not connected');
		await assert.rejects(noInvoker.execute(call), /Execution service is not connected/);
		const empty = preset(kind, { resources: [], invoke: async () => 'result' });
		assert.equal(empty.unavailable, undefined);
		assert.throws(() => empty.validate(config), /Select an available resource/);
	}
});

test('resource invokers receive exact selection, input, configuration and cancellation signal', async () => {
	for (const kind of kinds) {
		let calls = 0;
		const result = kind === 'ai' ? ' score: 0 ' : { score: 0, active: false };
		const plugin = preset(kind, {
			resources,
			async invoke(resource, invocation) {
				calls++;
				assert.deepEqual(resource, { id: 'classifier', version: '1' });
				assert.equal(invocation, call);
				return result;
			},
		});
		plugin.validate(config);
		assert.equal(await plugin.execute(call), result);
		assert.equal(calls, 1);
		const failure = new Error('Host model failed');
		const broken = preset(kind, {
			resources,
			invoke: async () => {
				throw failure;
			},
		});
		await assert.rejects(broken.execute(call), (error) => error === failure);
	}
});

test('AI preserves raw text and rejects a parsed JSON substitute', async () => {
	const plugin = preset('ai', { resources, invoke: async () => '{"score":0}' });
	assert.equal(await plugin.execute(call), '{"score":0}');
	await assert.rejects(preset('ai', { resources, invoke: async () => ({ score: 0 }) }).execute(call), /raw AI text/);
	assert.throws(() => plugin.validate({ ...config, prompt: '' }), /prompt/);
	assert.throws(() => plugin.validate({ ...config, version: 'missing' }), /Select an available resource/);
});

test('catalog refresh keeps the selected version, prompt and mounted editor while host actions stay usable', () => {
	let current = { ...config };
	let uploads = 0;
	const actions = (
		<button type="button" onClick={() => uploads++}>
			Upload resource
		</button>
	);
	const props = () => ({
		config: current,
		onChange: (next: PluginConfig) => {
			current = next;
		},
		inputs: {},
		outputs: [],
	});
	const initial = preset('ai', { resources, actions, invoke: async () => '' });
	const view = render(initial.renderEditor(props()));
	const selector = view.getByRole('combobox', { name: 'Model or script' }) as HTMLSelectElement;
	assert.equal(selector.value, '0');
	fireEvent.change(selector, { target: { value: '1' } });
	assert.deepEqual(current, { ...config, version: '2' });
	view.rerender(initial.renderEditor(props()));
	const prompt = view.getByRole('textbox', { name: 'Prompt' }) as HTMLTextAreaElement;
	fireEvent.change(prompt, { target: { value: 'New prompt' } });
	prompt.focus();
	fireEvent.click(view.getByRole('button', { name: 'Upload resource' }));
	assert.equal(uploads, 1);
	const refreshed = preset('ai', {
		resources: [resources[1], resources[0], { id: 'new', version: '1', label: 'Uploaded' }],
		actions,
		invoke: async () => '',
	});
	view.rerender(refreshed.renderEditor(props()));
	assert.equal(view.getByRole('textbox', { name: 'Prompt' }), prompt);
	assert.equal(document.activeElement, prompt);
	assert.equal(prompt.value, 'New prompt');
	assert.equal(selector.value, '0');
	assert.equal(view.getByRole('option', { name: 'Uploaded · 1' }).textContent, 'Uploaded · 1');
	fireEvent.change(selector, { target: { value: '2' } });
	assert.deepEqual(current, { id: 'new', version: '1', prompt: 'New prompt' });
});

test('missing and empty catalogs preserve existing configuration and show their own localized placeholders', () => {
	for (const kind of kinds) {
		let changes = 0;
		const props = { config, onChange: () => changes++, inputs: {}, outputs: [] };
		const missing = preset(kind);
		const view = render(missing.renderEditor(props));
		const selector = view.getByRole('combobox') as HTMLSelectElement;
		assert.equal(selector.disabled, true);
		assert.equal(view.getByRole('option').textContent, 'classifier · 1');
		view.rerender(missing.renderEditor({ ...props, config: missing.initialConfig() }));
		assert.equal(view.getByRole('option').textContent, 'Resource catalog is not connected');
		const empty = preset(kind, { resources: [] });
		view.rerender(empty.renderEditor({ ...props, config: empty.initialConfig() }));
		assert.equal(view.getByRole('option').textContent, 'No resources available');
		const ready = preset(kind, { resources });
		view.rerender(ready.renderEditor({ ...props, config: ready.initialConfig() }));
		assert.equal(selector.disabled, false);
		assert.equal(selector.value, '-1');
		assert.equal(view.getByRole('option', { name: 'Select an available resource' }).getAttribute('value'), '-1');
		view.rerender(ready.renderEditor({ ...props, config: { ...config, version: 'retired' } }));
		assert.equal(selector.value, '-1');
		assert.equal(view.getByRole('option', { name: 'classifier · retired' }).textContent, 'classifier · retired');
		assert.equal(changes, 0);
		view.unmount();
	}
	const plugin = builtinDecisionPlugins({ language: 'zh-CN' })[0];
	const view = render(
		plugin.renderEditor({
			config: plugin.initialConfig(),
			onChange: () => {},
			inputs: {},
			outputs: [],
			language: 'zh-CN',
		}),
	);
	assert.equal(view.getByRole('option').textContent, '未接入资源目录');
	assert.equal(plugin.unavailable, '未接入资源目录');
});

test('HTTP controls preserve configuration while editing explicit query and header bindings', () => {
	const plugin = builtinDecisionPlugins().find((p) => p.id === 'http')!;
	let current = plugin.initialConfig();
	const props = () => ({
		config: current,
		onChange: (next: PluginConfig) => {
			current = next;
		},
		inputs: { amount: '$.amount' },
		outputs: [],
	});
	const view = render(plugin.renderEditor(props()));
	fireEvent.change(view.getByRole('combobox', { name: 'Method' }), { target: { value: 'POST' } });
	view.rerender(plugin.renderEditor(props()));
	fireEvent.change(view.getByRole('textbox', { name: 'URL' }), { target: { value: 'https://example.test' } });
	view.rerender(plugin.renderEditor(props()));
	fireEvent.change(view.getByRole('textbox', { name: 'JSON body' }), { target: { value: '{"ok":true}' } });
	view.rerender(plugin.renderEditor(props()));
	fireEvent.click(view.getAllByRole('button', { name: 'Add' })[0]);
	view.rerender(plugin.renderEditor(props()));
	fireEvent.change(view.getByRole('textbox', { name: 'Parameter key' }), { target: { value: 'total' } });
	view.rerender(plugin.renderEditor(props()));
	fireEvent.change(view.getByRole('textbox', { name: 'Value' }), { target: { value: 'literal' } });
	view.rerender(plugin.renderEditor(props()));
	fireEvent.change(view.getByRole('combobox', { name: 'Result source' }), { target: { value: 'input' } });
	view.rerender(plugin.renderEditor(props()));
	assert.equal((view.getByRole('combobox', { name: 'Value' }) as HTMLSelectElement).value, '');
	fireEvent.change(view.getByRole('combobox', { name: 'Value' }), { target: { value: 'amount' } });
	view.rerender(plugin.renderEditor(props()));
	fireEvent.click(view.getAllByRole('button', { name: 'Add' })[1]);
	view.rerender(plugin.renderEditor(props()));
	assert.deepEqual(current, {
		method: 'POST',
		url: 'https://example.test',
		body: '{"ok":true}',
		query: [{ key: 'total', source: 'input', value: 'amount' }],
		headers: [{ key: '', source: 'literal', value: '' }],
	});
	fireEvent.click(view.getAllByRole('button', { name: 'Remove' })[0]);
	assert.deepEqual(current.query, []);
});
