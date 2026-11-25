import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import {
	JsonEditorProvider,
	JsonObjectEditor,
	ParamObjectEditor,
	zhCN,
	type JsonContent,
	type JsonField,
	type JsonObject,
	type JsonValue,
	type SourceEditorProps,
} from '../src';
import { CodeMirrorSourceEditor } from '../src/codemirror';

afterEach(cleanup);

const change = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
const input = (name: string) => screen.getByRole<HTMLInputElement>('textbox', { name });
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

test('keeps nested input identity, focus and expansion during polling, edits and schema refreshes', () => {
	const fields: JsonField[] = [
		{ name: 'auth', type: 'object' },
		{ name: 'count', type: 'number' },
	];
	let value: JsonObject = { auth: { cookie: 'initial' }, count: 1 };
	const props = () => ({
		value: structuredClone(value),
		onChange: (next: JsonValue) => {
			assert.ok(next !== null && typeof next === 'object' && !Array.isArray(next));
			value = next;
		},
		fields: structuredClone(fields),
	});
	const view = render(<ParamObjectEditor {...props()} schemaMode="rows" />);
	const original = input('cookie');
	original.focus();
	for (let index = 0; index < 12; index++) {
		view.rerender(<ParamObjectEditor {...props()} schemaMode="rows" />);
		assert.equal(document.activeElement, original);
		change(original, 'typed-' + index);
		assert.equal(input('cookie'), original);
	}
	assert.deepEqual(value, { auth: { cookie: 'typed-11' }, count: 1 });
	value = { count: 2, auth: { cookie: 'external' } };
	fields.push({ name: 'added', default: 'hint' });
	view.rerender(<ParamObjectEditor {...props()} schemaMode="form" />);
	assert.equal(input('cookie'), original);
	assert.equal(document.activeElement, original);
	assert.equal(original.value, 'external');
	assert.equal(input('added').placeholder, 'hint');
	assert.equal(input('added').value, '');
	fireEvent.click(button('Collapse · auth'));
	value = { count: 2, auth: { cookie: 'updated while collapsed' } };
	view.rerender(<ParamObjectEditor {...props()} />);
	assert.equal(screen.queryByRole('textbox', { name: 'cookie' }), null);
	fireEvent.click(button('Expand · auth'));
	assert.equal(input('cookie').value, 'updated while collapsed');
});

test('unfinished nested rows stay internal, duplicate keys are reported, and explicit empties survive', () => {
	let value: JsonObject = { data: { '': '', taken: 'original' }, other: [false, 0, null, [], {}] };
	const props = () => ({
		value: structuredClone(value),
		onChange: (next: JsonValue) => {
			assert.ok(next !== null && typeof next === 'object' && !Array.isArray(next));
			value = next;
		},
		fields: [{ name: 'data', type: 'object' as const }],
	});
	const view = render(<ParamObjectEditor {...props()} />);
	fireEvent.click(button('Add · data'));
	const rowGroup = button('Add · data').parentElement;
	assert.ok(rowGroup);
	const rows = within(rowGroup);
	const newKey = rows.getAllByRole<HTMLInputElement>('textbox', { name: 'Key' }).at(-1);
	const draftInput = rows.getAllByRole<HTMLInputElement>('textbox', { name: 'Value' }).at(-1);
	assert.ok(newKey);
	assert.ok(draftInput);
	change(draftInput, 'draft');
	view.rerender(<ParamObjectEditor {...props()} />);
	assert.equal(draftInput.value, 'draft');
	assert.deepEqual(value.data, { '': '', taken: 'original' });
	change(newKey, 'taken');
	assert.equal(screen.getAllByRole('alert').length, 2);
	const issue = newKey.getAttribute('aria-describedby');
	assert.ok(issue);
	assert.equal(document.getElementById(issue)?.textContent, 'Duplicate key');
	assert.deepEqual(value.data, { '': '', taken: 'original' });
	change(newKey, ' __proto__ ');
	assert.equal(screen.queryByRole('alert'), null);
	assert.deepEqual(value, {
		data: { '': '', taken: 'original', ' __proto__ ': 'draft' },
		other: [false, 0, null, [], {}],
	});
	assert.equal(rows.getAllByRole<HTMLInputElement>('textbox', { name: 'Key' }).at(-1), newKey);
});

test('numeric drafts survive unrelated external changes and use the original field control', () => {
	let value: JsonObject = { other: true };
	const props = () => ({
		value: structuredClone(value),
		onChange: (next: JsonValue) => {
			assert.ok(next !== null && typeof next === 'object' && !Array.isArray(next));
			value = next;
		},
		fields: [{ name: 'count', type: 'number' as const, required: true }],
	});
	const view = render(<ParamObjectEditor {...props()} />);
	const count = input('count');
	count.focus();
	change(count, '-');
	assert.equal(input('count'), count);
	assert.equal(count.value, '-');
	assert.equal(count.getAttribute('aria-invalid'), 'true');
	assert.deepEqual(value, { other: true });
	value = { other: false };
	view.rerender(<ParamObjectEditor {...props()} />);
	assert.equal(input('count'), count);
	assert.equal(document.activeElement, count);
	assert.equal(count.value, '-');
	change(count, '1e');
	assert.equal(count.value, '1e');
	change(count, '-1.5e2');
	assert.deepEqual(value, { count: -150, other: false });
	view.rerender(<ParamObjectEditor {...props()} />);
	assert.equal(count.value, '-1.5e2');
	value = { count: 42, other: false };
	view.rerender(<ParamObjectEditor {...props()} />);
	assert.equal(count.value, '42');
	assert.equal(document.activeElement, count);
});

test('array editing retains the focused child when an external refresh inserts or replaces entries', () => {
	let value: JsonObject = { list: ['first', 'second'] };
	const props = () => ({
		value: structuredClone(value),
		onChange: (next: JsonValue) => {
			assert.ok(next !== null && typeof next === 'object' && !Array.isArray(next));
			value = next;
		},
		fields: [{ name: 'list', type: 'array' as const }],
	});
	const view = render(<ParamObjectEditor {...props()} />);
	const original = input('2');
	original.focus();
	change(original, 'edited');
	value = { list: ['incoming', 'first', 'edited'] };
	view.rerender(<ParamObjectEditor {...props()} />);
	assert.equal(input('3'), original);
	assert.equal(document.activeElement, original);
	assert.equal(original.value, 'edited');
	fireEvent.click(button('Add · list'));
	assert.deepEqual(value.list, ['incoming', 'first', 'edited', '']);
	const type = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Type · 4' });
	change(type, 'object');
	assert.deepEqual(value.list, ['incoming', 'first', 'edited', {}]);
	fireEvent.click(button('Remove · 4'));
	assert.deepEqual(value.list, ['incoming', 'first', 'edited']);
});

test('typed select options distinguish empty strings, zero, false and missing values', () => {
	let value: JsonObject = { noExtraEdits: {}, flags: [] };
	const options = [
		{ value: '', label: 'empty' },
		{ value: 0, label: 'zero' },
		{ value: false, label: 'false' },
	];
	const fields: JsonField[] = [
		{ name: 'mode', options },
		{ name: 'flags', options, multiple: true },
		{ name: 'empty', default: '' },
	];
	const props = () => ({
		value: structuredClone(value),
		onChange: (next: JsonValue) => {
			assert.ok(next !== null && typeof next === 'object' && !Array.isArray(next));
			value = next;
		},
		fields,
	});
	const view = render(<ParamObjectEditor {...props()} allowExtraParams={false} />);
	const mode = screen.getByRole<HTMLSelectElement>('combobox', { name: 'mode' });
	const flags = screen.getByRole<HTMLSelectElement>('listbox', { name: 'flags' });
	change(mode, within(mode).getByRole<HTMLOptionElement>('option', { name: 'empty' }).value);
	assert.deepEqual(value, { mode: '', noExtraEdits: {}, flags: [] });
	view.rerender(<ParamObjectEditor {...props()} allowExtraParams={false} />);
	within(flags).getByRole<HTMLOptionElement>('option', { name: 'zero' }).selected = true;
	within(flags).getByRole<HTMLOptionElement>('option', { name: 'false' }).selected = true;
	fireEvent.change(flags);
	assert.deepEqual(value, { mode: '', noExtraEdits: {}, flags: [0, false] });
	change(mode, '');
	fireEvent.click(button('Add · empty'));
	assert.deepEqual(value, { noExtraEdits: {}, flags: [0, false], empty: '' });
});

test('source mode formats once, tracks invalid edits and preserves external or unfixed text', () => {
	const changes: JsonContent[] = [];
	const valid: { value: JsonValue; content: JsonContent }[] = [];
	const host = (initial: JsonContent) => {
		function Host() {
			const [content, setContent] = useState(initial);
			return (
				<JsonObjectEditor
					content={content}
					onChange={(next) => {
						changes.push(next);
						setContent(next);
					}}
					onValidValueChange={(value, content) => {
						valid.push({ value, content });
					}}
				/>
			);
		}
		return Host;
	};
	const Host = host({ kind: 'value', value: { nested: {}, zero: 0 } });
	render(<Host />);
	const zero = input('zero');
	change(zero, '-');
	assert.equal(button('JSON').disabled, true);
	change(zero, '0');
	assert.equal(button('JSON').disabled, false);
	fireEvent.click(button('JSON'));
	assert.deepEqual(changes, [{ kind: 'text', text: '{\n  "nested": {},\n  "zero": 0\n}' }]);
	const source = input('JSON');
	change(source, '{');
	assert.equal(source.value, '{');
	assert.equal(button('Parameters').disabled, true);
	assert.equal(screen.getByRole('alert').textContent, 'Enter valid JSON');
	assert.equal(valid.length, 0);
	const text = '{"nested":{},"zero":0,"s":""}  ';
	change(source, text);
	assert.equal(source.value, text);
	assert.deepEqual(valid, [{ value: { nested: {}, zero: 0, s: '' }, content: { kind: 'text', text } }]);
	fireEvent.click(button('Parameters'));
	assert.equal(input('s').value, '');
	assert.equal(changes.length, 3);
	change(input('s'), 'tree edit');
	assert.deepEqual(valid.at(-1)?.content, { kind: 'value', value: { nested: {}, zero: 0, s: 'tree edit' } });
});

test('externally controlled mode and content override presentation and switches respect readOnly and disabled', () => {
	const modes: string[] = [];
	const changes: JsonContent[] = [];
	const props = {
		onChange: (content: JsonContent) => changes.push(content),
		onModeChange: (mode: string) => modes.push(mode),
		readOnly: true,
	};
	const view = render(<JsonObjectEditor {...props} content={{ kind: 'value', value: { x: 'first' } }} mode="params" />);
	assert.equal(input('x').readOnly, true);
	fireEvent.click(button('JSON'));
	assert.deepEqual(modes, ['json']);
	assert.deepEqual(changes, []);
	assert.equal(input('x').value, 'first');
	view.rerender(<JsonObjectEditor {...props} content={{ kind: 'text', text: '[' }} mode="params" />);
	assert.equal(input('JSON').value, '[');
	assert.equal(input('JSON').readOnly, true);
	assert.equal(button('Parameters').disabled, true);
	view.rerender(
		<JsonObjectEditor {...props} content={{ kind: 'text', text: '{"x":"external"}' }} mode="json" disabled />,
	);
	assert.equal(input('JSON').value, '{"x":"external"}');
	assert.equal(input('JSON').disabled, true);
	assert.equal(button('Parameters').disabled, true);
	fireEvent.click(button('Parameters'));
	assert.deepEqual(modes, ['json']);
});

function SourceSlot({ label, value, onChange }: SourceEditorProps) {
	return <input aria-label={label} value={value} onChange={(event) => onChange(event.currentTarget.value)} />;
}

test('nested providers inherit stable source slots and locale independently', () => {
	const changed: JsonContent[] = [];
	const props = {
		content: { kind: 'text' as const, text: 'invalid' },
		onChange: (next: JsonContent) => changed.push(next),
	};
	render(
		<JsonEditorProvider slots={{ SourceEditor: SourceSlot }}>
			<JsonEditorProvider locale={zhCN}>
				<JsonObjectEditor {...props} />
			</JsonEditorProvider>
		</JsonEditorProvider>,
	);
	assert.equal(input('JSON').tagName, 'INPUT');
	assert.equal(button('参数').disabled, true);
	assert.equal(screen.getByRole('alert').textContent, '请输入有效的 JSON');
	change(input('JSON'), '{}');
	assert.deepEqual(changed, [{ kind: 'text', text: '{}' }]);
});

test('the optional CodeMirror adapter exposes source, accessible labeling and access controls', () => {
	const props = {
		label: 'JSON data',
		value: '{"key":"value"}',
		onChange: () => assert.fail('unexpected edit'),
		height: 160,
	};
	const view = render(<CodeMirrorSourceEditor {...props} theme="dark" readOnly />);
	const source = () => screen.getByRole('textbox', { name: props.label });
	assert.equal(source().textContent, props.value);
	assert.equal(source().getAttribute('aria-readonly'), 'true');
	view.rerender(<CodeMirrorSourceEditor {...props} disabled />);
	assert.equal(source().getAttribute('aria-disabled'), 'true');
	assert.equal(source().getAttribute('tabindex'), '-1');
});
