import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import {
	JsonConfigurationError,
	JsonEditorProvider,
	JsonObjectEditor,
	ParamObjectEditor,
	jsonSchemaToField,
	zhCN,
	type FileInputProps,
	type InputProps,
	type JsonContent,
	type JsonFieldDefinition,
	type JsonObjectEditorProps,
	type JsonValue,
} from '../src';

afterEach(cleanup);
const change = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
const input = (name: string) => screen.getByRole<HTMLInputElement>('textbox', { name });
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
const select = (name: string) => screen.getByRole<HTMLSelectElement>('combobox', { name });

function Host({
	initial,
	onValue,
	...props
}: Omit<JsonObjectEditorProps, 'content' | 'onChange'> & {
	initial: JsonValue;
	onValue?: (content: JsonContent) => void;
}) {
	const [content, setContent] = useState<JsonContent>({ kind: 'value', value: initial });
	return (
		<JsonObjectEditor
			{...props}
			content={content}
			onChange={(next) => {
				setContent(next);
				onValue?.(next);
			}}
		/>
	);
}

for (const initial of [{ x: '' }, [], '', 0, false, null]) {
	test(`root ${JSON.stringify(initial)} edits and switches modes without losing falsy values`, () => {
		const changes: JsonContent[] = [];
		const valid: JsonValue[] = [];
		render(
			<Host
				initial={initial}
				onValue={(next) => changes.push(next)}
				onValidValueChange={(value) => valid.push(value)}
			/>,
		);
		assert.equal(screen.queryByRole('textbox', { name: 'JSON' }), null);
		fireEvent.click(button('JSON'));
		assert.equal(input('JSON').value, JSON.stringify(initial, null, 2));
		for (const text of ['null', 'false', '0', '""', '[]', '{}']) {
			change(input('JSON'), text + ' ');
			assert.deepEqual(valid.at(-1), JSON.parse(text));
			fireEvent.click(button('Parameters'));
			assert.equal(screen.queryByRole('textbox', { name: 'JSON' }), null);
			fireEvent.click(button('JSON'));
			assert.equal(input('JSON').value, text);
		}
		change(input('JSON'), '{');
		assert.equal(button('Parameters').disabled, true);
		const count = valid.length;
		change(input('JSON'), '1e999');
		assert.equal(button('Parameters').disabled, true);
		assert.equal(valid.length, count);
		change(input('JSON'), '0');
		fireEvent.click(button('Parameters'));
		change(input('Value'), '-');
		assert.equal(button('JSON').disabled, true);
		assert.deepEqual(valid.at(-1), 0);
		change(input('Value'), '2');
		assert.deepEqual(changes.at(-1), { kind: 'value', value: 2 });
		change(select('Type · Value'), 'array');
		fireEvent.click(button('Add · Value'));
		change(input('1'), 'item');
		assert.deepEqual(valid.at(-1), ['item']);
		change(select('Type · Value'), 'boolean');
		change(select('Value'), 'true');
		assert.equal(valid.at(-1), true);
		change(select('Type · Value'), 'null');
		assert.equal(valid.at(-1), null);
		assert.equal(screen.queryByRole('button', { name: 'Remove · Value' }), null);
	});

	for (const access of ['readOnly', 'disabled'] as const) {
		test(`${access} applies to root ${JSON.stringify(initial)} and its source mode`, () => {
			const edits: JsonContent[] = [];
			const view = render(<Host initial={initial} {...{ [access]: true }} onValue={(next) => edits.push(next)} />);
			if (access === 'disabled') {
				assert.equal(select('Type · Value').disabled, true);
				assert.equal(button('JSON').disabled, true);
				fireEvent.click(button('JSON'));
				view.rerender(<Host initial={initial} disabled mode="json" onValue={(next) => edits.push(next)} />);
				assert.equal(input('JSON').disabled, true);
			} else {
				assert.equal(screen.queryByRole('combobox', { name: 'Type · Value' }), null);
				fireEvent.click(button('JSON'));
				assert.equal(input('JSON').readOnly, true);
				fireEvent.click(button('Parameters'));
			}
			assert.deepEqual(edits, []);
		});
	}
}

const nestedSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		config: {
			type: 'object',
			properties: {
				rows: {
					type: 'array',
					items: {
						type: 'object',
						required: ['count'],
						properties: {
							count: { type: 'number', title: 'Count', description: 'Number of copies', default: 3 },
							choice: { enum: [null, false, 0, '', { x: 1 }, [2]], title: 'Choice' },
							date: { type: 'string', format: 'date', title: 'Day' },
						},
						additionalProperties: false,
					},
				},
			},
		},
	},
};
const nested = jsonSchemaToField(nestedSchema);
const nestedValue = { config: { rows: [{ loose: 'keep' }], free: { text: 'schema-free' } }, hidden: true };

test('generated nested metadata edits defaults, required labels, structured enums and schema-free descendants', () => {
	const values: JsonValue[] = [];
	render(<Host initial={nestedValue} rootField={nested} onValidValueChange={(value) => values.push(value)} />);
	assert.equal(input('Count').placeholder, '3');
	assert.equal(input('Count').value, '');
	assert.equal(screen.getByLabelText('Required').textContent, ' *');
	assert.equal(
		document.getElementById(input('Count').getAttribute('aria-describedby') ?? '')?.textContent,
		'Number of copies',
	);
	assert.equal(input('text').value, 'schema-free');
	assert.equal(screen.queryByRole('textbox', { name: 'loose' }), null);
	assert.deepEqual(values, []);
	fireEvent.click(button('Add · Count'));
	assert.equal(input('Count').value, '3');
	change(input('text'), 'edited');
	const choice = select('Choice');
	for (const [label, value] of [
		['null', null],
		['false', false],
		['0', 0],
		['', ''],
		['{"x":1}', { x: 1 }],
		['[2]', [2]],
	] as const) {
		change(choice, within(choice).getByRole<HTMLOptionElement>('option', { name: label }).value);
		assert.deepEqual(values.at(-1), {
			config: { rows: [{ loose: 'keep', count: 3, choice: value }], free: { text: 'edited' } },
			hidden: true,
		});
	}
	change(input('Count'), '1e');
	assert.equal(button('JSON').disabled, true);
	change(input('Count'), '4');
	fireEvent.click(button('Remove · Count'));
	assert.equal(input('Count').value, ''); // Required is a marker, not a validation gate.
	fireEvent.click(button('JSON'));
	change(input('JSON'), '{');
	assert.equal(button('Parameters').disabled, true);
	change(input('JSON'), '{"config":{"rows":[{"count":"wrong type","choice":17}]}}');
	fireEvent.click(button('Parameters'));
	assert.equal(input('Count').value, 'wrong type');
	assert.equal(within(select('Choice')).getByRole<HTMLOptionElement>('option', { name: '17' }).selected, true);
	change(input('Count'), 'still a string');
	assert.deepEqual(values.at(-1), { config: { rows: [{ count: 'still a string', choice: 17 }] } });
});

for (const access of ['readOnly', 'disabled'] as const) {
	test(`generated nested metadata honor ${access}`, () => {
		render(
			<Host
				initial={{ config: { rows: [{ count: 3, choice: null }] } }}
				rootField={nested}
				{...{ [access]: true }}
				onValue={() => assert.fail('unexpected edit')}
			/>,
		);
		assert.equal(input('Count')[access], true);
		if (access === 'readOnly') {
			assert.equal(screen.queryByRole('button', { name: 'Remove · Count' }), null);
			assert.equal(screen.getByRole('status', { name: 'Choice' }).textContent, 'null');
			fireEvent.click(button('JSON'));
			assert.equal(input('JSON').readOnly, true);
			fireEvent.click(button('Parameters'));
		} else {
			assert.equal(select('Choice').disabled, true);
			assert.equal(button('Add · rows').disabled, true);
			fireEvent.click(button('Add · rows'));
			assert.equal(button('JSON').disabled, true);
		}
	});
}

function FormatInput({ label, value, onChange, format, readOnly, disabled }: InputProps) {
	return (
		<input
			aria-label={label}
			data-format={format}
			value={value}
			readOnly={readOnly}
			disabled={disabled}
			onChange={(event) => onChange(event.currentTarget.value)}
		/>
	);
}

test('root array item defaults and formats reach replaceable controls without date normalization', () => {
	const values: JsonContent[] = [];
	const rootField = jsonSchemaToField({
		type: 'array',
		items: { type: 'string', format: 'date-time', default: '2026-11-25T13:00:00+08:00' },
	});
	render(
		<JsonEditorProvider slots={{ Input: FormatInput }}>
			<Host initial={[]} rootField={rootField} onValue={(next) => values.push(next)} />
		</JsonEditorProvider>,
	);
	fireEvent.click(button('Add · Value'));
	assert.equal(input('1').dataset.format, 'date-time');
	assert.deepEqual(values.at(-1), { kind: 'value', value: ['2026-11-25T13:00:00+08:00'] });
	change(input('1'), 'host validates dates');
	fireEvent.click(button('JSON'));
	fireEvent.click(button('Parameters'));
	assert.equal(input('1').value, 'host validates dates');
});

const files = new Map<string, File>();
function FileSlot({ label, describedBy, value, path, onChange, readOnly, disabled }: FileInputProps) {
	if (readOnly)
		return (
			<output aria-label={label} aria-describedby={describedBy}>
				{value === undefined ? '' : files.get(value)?.name}
			</output>
		);
	return (
		<input
			aria-label={label}
			aria-describedby={describedBy}
			data-path={JSON.stringify(path)}
			type="file"
			disabled={disabled}
			onChange={(event) => {
				const file = event.currentTarget.files?.[0];
				if (!file) return;
				const reference = 'host:' + file.name;
				files.set(reference, file);
				onChange(reference);
			}}
		/>
	);
}
const fileField: JsonFieldDefinition = {
	type: 'object',
	fields: [{ name: 'docs', type: 'array', items: { type: 'file', label: 'Document', description: 'Pick a document' } }],
};

test('file slot stores references, inherits providers, displays names read-only, and follows source edits', () => {
	const values: JsonContent[] = [];
	const props = {
		initial: { docs: ['host:old'] },
		rootField: fileField,
		onValue: (next: JsonContent) => values.push(next),
	};
	const tree = (access = {}) => (
		<JsonEditorProvider slots={{ FileInput: FileSlot }}>
			<JsonEditorProvider>
				<Host {...props} {...access} />
			</JsonEditorProvider>
		</JsonEditorProvider>
	);
	const view = render(tree());
	const picker = screen.getByLabelText<HTMLInputElement>('Document');
	assert.equal(picker.type, 'file');
	assert.equal(picker.dataset.path, '["docs",0]');
	assert.equal(document.getElementById(picker.getAttribute('aria-describedby') ?? '')?.textContent, 'Pick a document');
	const file = new File(['hello'], 'report.txt');
	fireEvent.change(picker, { target: { files: [file] } });
	assert.equal(files.get('host:report.txt'), file);
	assert.deepEqual(values.at(-1), { kind: 'value', value: { docs: ['host:report.txt'] } });
	fireEvent.click(button('JSON'));
	assert.match(input('JSON').value, /host:report.txt/);
	change(input('JSON'), '{');
	assert.equal(button('Parameters').disabled, true);
	change(input('JSON'), '{"docs":[42]}');
	fireEvent.click(button('Parameters'));
	assert.equal(input('Document').value, '42'); // Host owns type validation.
	change(select('Type · Document'), 'string');
	assert.equal(screen.getByLabelText<HTMLInputElement>('Document').type, 'file');
	fireEvent.change(screen.getByLabelText('Document'), { target: { files: [file] } });
	view.rerender(tree({ readOnly: true }));
	assert.equal(screen.getByRole('status', { name: 'Document' }).textContent, 'report.txt');
	assert.ok(screen.getByText('host:report.txt'));
	assert.equal(screen.queryByDisplayValue('host:report.txt'), null);
	assert.equal(view.container.querySelector('input[type=file]'), null);
	const count = values.length;
	fireEvent.click(button('JSON'));
	assert.equal(input('JSON').readOnly, true);
	fireEvent.click(button('Parameters'));
	view.rerender(tree({ disabled: true }));
	assert.equal(screen.getByLabelText<HTMLInputElement>('Document').disabled, true);
	assert.equal(button('Remove · Document').disabled, true);
	fireEvent.click(button('Remove · Document'));
	assert.equal(button('JSON').disabled, true);
	assert.equal(values.length, count);
});

test('missing file slots and duplicate nested field names produce structured TypeErrors even in source mode', () => {
	for (const access of [{}, { readOnly: true }, { disabled: true }]) {
		assert.throws(
			() =>
				render(
					<JsonObjectEditor
						{...access}
						content={{ kind: 'text', text: '{}' }}
						mode="json"
						rootField={fileField}
						onChange={() => {}}
					/>,
				),
			(error) => {
				assert.ok(error instanceof JsonConfigurationError);
				assert.ok(error instanceof TypeError);
				assert.deepEqual(error.issues, [
					{ code: 'missing_file_slot', path: ['fields', 'docs', 'items'], params: { slot: 'FileInput' } },
				]);
				return true;
			},
		);
	}
	assert.throws(
		() =>
			render(
				<ParamObjectEditor
					value={{}}
					onChange={() => {}}
					fields={[{ name: 'x', fields: [{ name: 'same' }, { name: 'same' }] }]}
				/>,
			),
		(error) => {
			assert.ok(error instanceof JsonConfigurationError);
			assert.deepEqual(error.issues, [
				{ code: 'duplicate_field', path: ['fields', 'x', 'fields', 'same'], params: { name: 'same' } },
			]);
			return true;
		},
	);
});

test('root toggles are controlled, retain absent names, and never edit data across rename, deletion or mode switches', () => {
	const changes: JsonContent[] = [];
	const keys: string[][] = [];
	const props = {
		initial: { a: 'keep', nested: { a: 'child' } },
		disabledKeys: ['ghost', 'a', 'ghost'],
		onDisabledKeysChange: (next: string[]) => keys.push(next),
		onValue: (next: JsonContent) => changes.push(next),
	};
	const view = render(<Host {...props} />);
	assert.equal(screen.getAllByText('Inactive').length, 1);
	assert.equal(screen.getAllByRole('button', { name: 'Enable · a' }).length, 1);
	fireEvent.click(button('Enable · a'));
	assert.deepEqual(keys, [['ghost', 'ghost']]);
	assert.equal(changes.length, 0);
	assert.ok(button('Enable · a')); // Host has not accepted the new controlled list.
	view.rerender(<Host {...props} disabledKeys={keys[0]} />);
	fireEvent.click(button('Deactivate · nested'));
	assert.deepEqual(keys.at(-1), ['ghost', 'ghost', 'nested']);
	const rootKey = screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Key' })[0];
	change(rootKey, 'renamed');
	fireEvent.click(button('Remove · renamed'));
	assert.deepEqual(changes.at(-1), { kind: 'value', value: { nested: { a: 'child' } } });
	assert.equal(keys.length, 2);
	fireEvent.click(button('JSON'));
	change(input('JSON'), 'invalid');
	assert.equal(button('Parameters').disabled, true);
	change(input('JSON'), '[1]');
	fireEvent.click(button('Parameters'));
	assert.equal(screen.queryByRole('button', { name: /Deactivate|Enable/ }), null);
	fireEvent.click(button('JSON'));
	change(input('JSON'), '{"a":"returned"}');
	fireEvent.click(button('Parameters'));
	view.rerender(<Host {...props} readOnly />);
	assert.ok(screen.getByText('Inactive'));
	assert.equal(screen.queryByRole('button', { name: /Deactivate|Enable/ }), null);
	view.rerender(<Host {...props} disabled />);
	assert.equal(button('Enable · a').disabled, true);
	fireEvent.click(button('Enable · a'));
	assert.equal(keys.length, 2);
	view.rerender(
		<JsonEditorProvider locale={zhCN}>
			<ParamObjectEditor
				value={{ a: 1 }}
				onChange={() => assert.fail('unexpected edit')}
				disabledKeys={['a']}
				fields={[{ name: 'a', label: 'A' }]}
				onDisabledKeysChange={(next) => keys.push(next)}
			/>
		</JsonEditorProvider>,
	);
	assert.ok(screen.getByText('已停用'));
	fireEvent.click(button('启用 · A'));
	assert.deepEqual(keys.at(-1), []);
});

test('standalone roots retain numeric drafts and array identity across external refreshes', () => {
	let value: JsonValue = ['first', 'second'];
	const props = () => ({
		value: structuredClone(value),
		onChange: (next: JsonValue) => {
			value = next;
		},
	});
	const view = render(<ParamObjectEditor {...props()} />);
	const second = input('2');
	second.focus();
	change(second, 'edited');
	value = ['inserted', 'first', 'edited'];
	view.rerender(<ParamObjectEditor {...props()} />);
	assert.equal(input('3'), second);
	assert.equal(document.activeElement, second);
	value = 0;
	view.rerender(<ParamObjectEditor {...props()} />);
	change(input('Value'), '-');
	assert.equal(value, 0);
	assert.ok(screen.getByRole('alert'));
	view.rerender(<ParamObjectEditor {...props()} />);
	assert.equal(input('Value').value, '-');
	change(input('Value'), '-0');
	assert.ok(Object.is(value, -0));
	value = false;
	view.rerender(<ParamObjectEditor {...props()} />);
	change(select('Value'), 'true');
	assert.equal(value, true);
	value = null;
	view.rerender(<ParamObjectEditor {...props()} />);
	assert.ok(screen.getByText('Null', { selector: 'span' }));
});

test('manual metadata and schema additionalProperties apply at every object depth without dropping extras', () => {
	const metadata: JsonFieldDefinition = {
		type: 'object',
		additionalProperties: false,
		fields: [
			{
				name: 'outer',
				type: 'object',
				additionalProperties: {
					type: 'object',
					label: 'Extra',
					required: true,
					fields: [{ name: 'note', label: 'Note', multiline: true, default: 'hint' }],
					additionalProperties: false,
				},
			},
		],
	};
	let value: JsonValue = { outer: { dynamic: { hidden: 5 } }, rootExtra: true };
	const props = () => ({
		value,
		rootField: metadata,
		onChange: (next: JsonValue) => {
			value = next;
		},
	});
	const view = render(<ParamObjectEditor {...props()} />);
	assert.equal(input('Note').tagName, 'TEXTAREA');
	assert.equal(input('Note').placeholder, 'hint');
	assert.ok(screen.getByLabelText('Required'));
	assert.equal(screen.queryByRole('combobox', { name: 'rootExtra' }), null);
	fireEvent.click(button('Add · Note'));
	assert.deepEqual(value, { outer: { dynamic: { hidden: 5, note: 'hint' } }, rootExtra: true });
	view.rerender(<ParamObjectEditor {...props()} allowExtraParams />);
	assert.equal(select('rootExtra').value, 'true');
	assert.equal(screen.queryByRole('textbox', { name: 'hidden' }), null);
	view.rerender(<ParamObjectEditor {...props()} readOnly />);
	assert.equal(input('Note').readOnly, true);
	view.rerender(<ParamObjectEditor {...props()} disabled />);
	assert.equal(input('Note').disabled, true);
	const schemaMetadata = jsonSchemaToField({ type: 'object', additionalProperties: { type: 'number', default: 7 } });
	view.rerender(
		<ParamObjectEditor
			value={{}}
			onChange={(next) => {
				value = next;
			}}
			rootField={schemaMetadata}
		/>,
	);
	fireEvent.click(button('Add · Parameters'));
	change(input('Key'), 'extra');
	assert.deepEqual(value, { extra: 7 });
	change(input('extra'), '-');
	assert.deepEqual(value, { extra: 7 });
	assert.ok(screen.getByRole('alert'));
});

test('missing and root file values use the slot without coercion and round-trip as strings', () => {
	const values: JsonContent[] = [];
	const view = render(
		<JsonEditorProvider slots={{ FileInput: FileSlot }}>
			<Host initial={{}} fields={[{ name: 'upload', type: 'file' }]} onValue={(next) => values.push(next)} />
		</JsonEditorProvider>,
	);
	assert.equal(values.length, 0);
	fireEvent.change(screen.getByLabelText('upload'), { target: { files: [new File(['data'], 'new.txt')] } });
	assert.deepEqual(values.at(-1), { kind: 'value', value: { upload: 'host:new.txt' } });
	view.unmount();
	render(
		<JsonEditorProvider slots={{ FileInput: FileSlot }}>
			<Host initial="host:new.txt" rootField={{ type: 'file' }} onValue={(next) => values.push(next)} />
		</JsonEditorProvider>,
	);
	fireEvent.change(screen.getByLabelText('Value'), { target: { files: [new File(['root'], 'root.txt')] } });
	assert.deepEqual(values.at(-1), { kind: 'value', value: 'host:root.txt' });
	fireEvent.click(button('JSON'));
	assert.equal(input('JSON').value, '"host:root.txt"');
	fireEvent.click(button('Parameters'));
	assert.equal(screen.getByLabelText<HTMLInputElement>('Value').type, 'file');
});

test('file slots distinguish unnamed draft paths from existing empty-string property names', () => {
	const changes: JsonValue[] = [];
	render(
		<JsonEditorProvider slots={{ FileInput: FileSlot }}>
			<ParamObjectEditor
				value={{ '': 'host:empty' }}
				onChange={(value) => changes.push(value)}
				rootField={{ type: 'object', additionalProperties: { type: 'file', label: 'Attachment' } }}
			/>
		</JsonEditorProvider>,
	);
	assert.equal(screen.getByLabelText<HTMLInputElement>('Attachment').dataset.path, '[""]');
	fireEvent.click(button('Add · Parameters'));
	const unnamed = screen.getAllByLabelText<HTMLInputElement>('Attachment')[1];
	assert.equal(unnamed.dataset.path, undefined);
	fireEvent.change(unnamed, { target: { files: [new File(['draft'], 'draft.txt')] } });
	assert.equal(changes.length, 0);
	change(screen.getAllByRole('textbox', { name: 'Key' })[1], 'named');
	assert.equal(unnamed.dataset.path, '["named"]');
	assert.deepEqual(changes, [{ '': 'host:empty', named: 'host:draft.txt' }]);
});

test('empty select placeholders preserve missing values and roots have no clear action', () => {
	const changes: JsonValue[] = [];
	const view = render(
		<ParamObjectEditor
			value={{}}
			onChange={(value) => changes.push(value)}
			fields={[{ name: 'choice', default: '', options: [{ value: '', label: 'Empty string' }] }]}
		/>,
	);
	const choice = select('choice');
	assert.equal(within(choice).getByRole<HTMLOptionElement>('option', { name: '' }).selected, true);
	assert.equal(changes.length, 0);
	change(choice, '0');
	assert.deepEqual(changes.at(-1), { choice: '' });
	change(choice, '');
	assert.deepEqual(changes.at(-1), {});
	view.rerender(
		<ParamObjectEditor
			value={false}
			onChange={(value) => changes.push(value)}
			rootField={{ options: [{ value: null }, { value: false }, { value: 0 }] }}
		/>,
	);
	assert.equal(within(select('Value')).queryByRole('option', { name: 'Choose a value' }), null);
	change(select('Value'), '0');
	assert.equal(changes.at(-1), null);
});
