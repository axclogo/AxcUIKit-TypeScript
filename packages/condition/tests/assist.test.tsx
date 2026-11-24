import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
	AxcConditionAssist,
	AxcDecisionAssist,
	AxcUIProvider,
	emptyDecision,
	zhCN,
	type AxcAssistRequest,
	type AxcAssistTransport,
	type AxcConditionValue,
	type AxcModelSelectProps,
	type AxcDecisionPlan,
	type AxcDecisionValue,
} from '../src/index.js';

afterEach(cleanup);

const fields = [{ name: 'title', label: 'Title' }];
const models = [{ id: 'assistant', label: 'Assistant' }];
const group = (value = 'old'): AxcConditionValue => ({
	combinator: 'or',
	not: false,
	rules: [{ field: 'title', operator: 'contains', value }],
});

/** A transport whose answer the test controls; records every request and signal. */
function deferred() {
	const calls: Array<{
		request: AxcAssistRequest;
		signal: AbortSignal;
		resolve: (v: unknown) => void;
		reject: (e: unknown) => void;
	}> = [];
	const transport: AxcAssistTransport = {
		models,
		generate: (request, signal) =>
			new Promise((resolve, reject) => {
				calls.push({ request, signal, resolve, reject });
			}),
	};
	return { transport, calls };
}

async function ask(open = 'Generate conditions with AI') {
	fireEvent.click(screen.getByRole('button', { name: open }));
	const generate = screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement;
	assert.equal(generate.disabled, true, 'needs a model and a requirement');
	fireEvent.change(screen.getByRole('combobox', { name: 'Assistant model' }), { target: { value: 'assistant' } });
	fireEvent.change(screen.getByRole('textbox', { name: 'What should the AI generate?' }), {
		target: { value: 'alpha' },
	});
	await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate' })));
}
const answer = async (resolve: (v: unknown) => void, value: unknown) => act(async () => resolve(value));

test('candidate is previewed and only written back on Apply', async () => {
	const { transport, calls } = deferred();
	const changes: AxcConditionValue[] = [];
	render(<AxcConditionAssist fields={fields} value={group()} onChange={(v) => changes.push(v)} assist={transport} />);
	await ask();
	assert.equal(calls[0].request.model, 'assistant');
	assert.ok(calls[0].request.prompt.includes('User requirement: alpha'));
	assert.equal(screen.getByRole('status').textContent, 'Generating…');
	await answer(calls[0].resolve, { explanation: 'Only alpha', value: group('alpha') });
	assert.ok(screen.getByText('Only alpha'));
	assert.equal(changes.length, 0);
	fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
	assert.deepEqual(changes, [group('alpha')]);
	assert.equal(screen.queryByRole('button', { name: 'Apply' }), null);
});

test('Cancel aborts the signal and ignores the late result', async () => {
	const { transport, calls } = deferred();
	render(<AxcConditionAssist fields={fields} value={group()} onChange={() => {}} assist={transport} />);
	await ask();
	fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
	assert.equal(calls[0].signal.aborted, true);
	await answer(calls[0].resolve, { explanation: 'late', value: group('late') });
	assert.equal(screen.queryByText('late'), null);
	assert.equal(screen.queryByRole('button', { name: 'Apply' }), null);
});

test('a request or candidate becomes stale when the value changes, and on unmount', async () => {
	const { transport, calls } = deferred();
	const view = render(<AxcConditionAssist fields={fields} value={group()} onChange={() => {}} assist={transport} />);
	await ask();
	view.rerender(<AxcConditionAssist fields={fields} value={group('edited')} onChange={() => {}} assist={transport} />);
	assert.equal(calls[0].signal.aborted, true);
	await answer(calls[0].resolve, { explanation: 'stale', value: group('stale') });
	assert.equal(screen.queryByText('stale'), null);
	await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate' })));
	await answer(calls[1].resolve, { explanation: 'fresh', value: group('fresh') });
	assert.ok(screen.getByText('fresh'));
	view.rerender(<AxcConditionAssist fields={fields} value={group('again')} onChange={() => {}} assist={transport} />);
	assert.equal(screen.queryByText('fresh'), null, 'unapplied candidate dropped');
	await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate' })));
	view.unmount();
	assert.equal(calls[2].signal.aborted, true);
});

test('invalid model output shows coded issues and cannot be applied', async () => {
	const { transport, calls } = deferred();
	const changes: unknown[] = [];
	render(<AxcConditionAssist fields={fields} value={group()} onChange={(v) => changes.push(v)} assist={transport} />);
	await ask();
	await answer(calls[0].resolve, {
		explanation: 'x',
		value: { ...group(), rules: [{ field: 'nope', operator: '=', value: 'a' }] },
	});
	assert.ok(screen.getByText('The model returned an invalid candidate. Try again or choose another model.'));
	assert.ok(screen.getByText('Unknown or disabled field "nope".'));
	assert.equal(screen.queryByRole('button', { name: 'Apply' }), null);
	await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate' })));
	await answer(calls[1].resolve, '```json {"explanation":"x"} ```');
	assert.ok(screen.getByText('Must be an object.'), 'strings are not unwrapped');
	assert.equal(changes.length, 0);
});

test('transport failures show the host message', async () => {
	const { transport, calls } = deferred();
	render(<AxcConditionAssist fields={fields} value={group()} onChange={() => {}} assist={transport} />);
	await ask();
	await act(async () => calls[0].reject(new Error('quota exceeded')));
	assert.equal(screen.getByRole('alert').textContent, 'Generation failed: quota exceeded');
});

test('editing the candidate into an invalid state disables Apply', async () => {
	const { transport, calls } = deferred();
	render(<AxcConditionAssist fields={fields} value={group()} onChange={() => {}} assist={transport} />);
	await ask();
	await answer(calls[0].resolve, { explanation: 'e', value: group('ok') });
	const preview = document.querySelector('.axc-candidate') as HTMLElement;
	fireEvent.click(preview.querySelector('button.axc-native-danger')!);
	assert.equal((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled, true);
});

test('readOnly hides the assistant; no onChange disables it', () => {
	const { transport } = deferred();
	render(<AxcConditionAssist fields={fields} value={group()} readOnly onChange={() => {}} assist={transport} />);
	assert.equal(screen.queryByRole('button', { name: 'Generate conditions with AI' }), null);
	cleanup();
	render(<AxcConditionAssist fields={fields} value={group()} assist={transport} />);
	assert.equal(
		(screen.getByRole('button', { name: 'Generate conditions with AI' }) as HTMLButtonElement).disabled,
		true,
	);
});

test('decision assist applies the whole plan and keeps the runtime model', async () => {
	const { transport, calls } = deferred();
	const changes: AxcDecisionValue[] = [];
	const value = { ...emptyDecision(), model: 'runtime' };
	render(
		<AxcDecisionAssist
			fields={fields}
			models={[{ id: 'runtime', label: 'Runtime' }]}
			value={value}
			onChange={(v) => changes.push(v)}
			assist={transport}
		/>,
	);
	await ask('Generate decision flow with AI');
	assert.ok(!('model' in JSON.parse(calls[0].request.prompt.split('Current configuration: ')[1].split('\n')[0])));
	const plan: AxcDecisionPlan = {
		precondition: group('alpha'),
		input_fields: ['title'],
		instruction: 'Judge',
		outputs: [],
		postcondition: { combinator: 'and', not: false, rules: [{ field: 'ai.matched', operator: '=', value: true }] },
	};
	await answer(calls[0].resolve, { explanation: 'plan', value: plan });
	fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
	assert.deepEqual(changes, [{ ...plan, model: 'runtime' }]);
});

test('the assistant uses the provider locale for its prompt and text', async () => {
	const { transport, calls } = deferred();
	render(
		<AxcUIProvider locale={zhCN}>
			<AxcConditionAssist fields={fields} value={group()} onChange={() => {}} assist={transport} />
		</AxcUIProvider>,
	);
	fireEvent.click(screen.getByRole('button', { name: 'AI 辅助生成条件' }));
	fireEvent.change(screen.getByRole('combobox', { name: '辅助生成模型' }), { target: { value: 'assistant' } });
	fireEvent.change(screen.getByRole('textbox', { name: 'AI 辅助需求' }), { target: { value: '示例' } });
	await act(async () => fireEvent.click(screen.getByRole('button', { name: '生成候选' })));
	assert.ok(calls[0].request.prompt.includes('用户需求：示例'));
});

test('custom model control selects an opaque id for the assist request', async () => {
	const { transport, calls } = deferred();
	const models = [{ id: 'provider/model-id', label: 'Label', provider: 'Provider' }];
	function ModelSelect(props: AxcModelSelectProps) {
		return (
			<button type="button" disabled={props.disabled} onClick={() => props.onChange(models[0].id)}>
				Choose host model
			</button>
		);
	}
	render(
		<AxcUIProvider components={{ ModelSelect }}>
			<AxcConditionAssist fields={fields} value={group()} onChange={() => {}} assist={{ ...transport, models }} />
		</AxcUIProvider>,
	);
	fireEvent.click(screen.getByRole('button', { name: 'Generate conditions with AI' }));
	fireEvent.click(screen.getByRole('button', { name: 'Choose host model' }));
	fireEvent.change(screen.getByRole('textbox', { name: 'What should the AI generate?' }), {
		target: { value: 'alpha' },
	});
	await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate' })));
	assert.equal(calls[0].request.model, 'provider/model-id');
	await answer(calls[0].resolve, { explanation: 'Only alpha', value: group('alpha') });
});
