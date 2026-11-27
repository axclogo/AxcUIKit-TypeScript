import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PluginTextAssist } from '../src/index.js';
import type { AxcAssistRequest } from '@axclogo/uikit/condition';
afterEach(cleanup);
test('plugin assistance previews editable text and rejects invalid responses without applying', async () => {
	let response: unknown = { explanation: 'Draft', value: 'return 1;' };
	let request!: AxcAssistRequest;
	const applied: string[] = [];
	render(
		<PluginTextAssist
			value="old"
			context={{ inputs: ['min'] }}
			target="JavaScript"
			onApply={(v) => applied.push(v)}
			assist={{
				models: [{ id: 'a', label: 'A' }],
				async generate(r) {
					request = r;
					return response;
				},
			}}
		/>,
	);
	fireEvent.click(screen.getByRole('button', { name: 'Help me write' }));
	fireEvent.change(screen.getByRole('combobox', { name: 'Assistant model' }), { target: { value: 'a' } });
	fireEvent.change(screen.getByRole('textbox', { name: 'What should the AI generate?' }), {
		target: { value: 'return a score' },
	});
	await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate' })));
	assert.equal(JSON.parse(request.prompt).target, 'JavaScript');
	assert.deepEqual(applied, []);
	fireEvent.change(screen.getByRole('textbox', { name: 'JavaScript' }), { target: { value: 'return 2;' } });
	fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
	assert.deepEqual(applied, ['return 2;']);
	response = { value: 22 };
	await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate' })));
	assert.ok(screen.getByRole('alert').textContent?.includes('Expected'));
	assert.deepEqual(applied, ['return 2;']);
});
