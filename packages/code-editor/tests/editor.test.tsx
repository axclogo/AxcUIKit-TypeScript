import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { CodeEditor } from '../src/index.js';
import { json } from '@codemirror/lang-json';
afterEach(cleanup);
test('external text, accessibility and extension changes update the existing source control', () => {
	const onChange = () => assert.fail('external updates must not emit');
	const view = render(<CodeEditor label="Source" value="{}" describedBy="error" invalid onChange={onChange} />);
	const textbox = view.getByRole('textbox', { name: 'Source' });
	assert.equal(textbox.getAttribute('aria-invalid'), 'true');
	assert.equal(textbox.getAttribute('aria-describedby'), 'error');
	view.rerender(<CodeEditor label="Source" value="[0]" language={json()} readOnly onChange={onChange} />);
	assert.equal(view.getByRole('textbox'), textbox);
	assert.equal(textbox.textContent, '[0]');
	assert.equal(textbox.getAttribute('aria-readonly'), 'true');
	view.rerender(<CodeEditor label="Source" value="[0]" disabled />);
	assert.equal(textbox.getAttribute('tabindex'), '-1');
	assert.equal(textbox.getAttribute('contenteditable'), 'false');
});

test('registered shortcuts deliver one event to the latest callback', () => {
	const calls: string[] = [];
	const view = render(<CodeEditor label="SQL" value="select 1" onRun={() => calls.push('old')} />);
	const textbox = view.getByRole('textbox', { name: 'SQL' });
	view.rerender(
		<CodeEditor label="SQL" value="select 2" onRun={() => calls.push('run')} onSave={() => calls.push('save')} />,
	);
	fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });
	fireEvent.keyDown(textbox, { key: 's', ctrlKey: true });
	assert.deepEqual(calls, ['run', 'save']);
	view.rerender(<CodeEditor label="SQL" value="select 2" />);
	const save = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
	fireEvent(textbox, save);
	assert.equal(save.defaultPrevented, false);
	assert.deepEqual(calls, ['run', 'save']);
});
