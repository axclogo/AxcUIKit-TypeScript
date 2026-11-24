# JSON editor

A controlled React editor for JSON objects. Use `ParamObjectEditor` for the parameter tree alone, or `JsonObjectEditor` to switch between the tree and JSON source. Import the stylesheet explicitly for the standard layout and native controls.

```tsx
import { useState } from 'react';
import { JsonEditorProvider, JsonObjectEditor, zhCN, type JsonContent, type JsonField } from '@axc/uikit/json-editor';
import '@axc/uikit/json-editor/styles.css';

const fields: JsonField[] = [
	{ name: 'enabled', label: 'Enabled', type: 'boolean' },
	{ name: 'timeouts', label: 'Timeouts', type: 'object' },
	{ name: 'retries', label: 'Retries', type: 'number', default: 3 },
];

export function Settings() {
	const [content, setContent] = useState<JsonContent>({
		kind: 'object',
		value: { enabled: false, timeouts: {}, retries: 0 },
	});

	return (
		<JsonEditorProvider locale={zhCN}>
			<JsonObjectEditor content={content} onChange={setContent} fields={fields} />
		</JsonEditorProvider>
	);
}
```

## Tree editing

`ParamObjectEditor` takes a `JsonObject` value and emits the edited object through `onChange`. Nested arrays and objects are editable. A blank new object row is local until named. An unfinished rename, repeated key, or invalid number stays in the tree and delays the next emission until the issue is fixed. Existing empty-string keys are preserved. Use JSON source to create a new empty-string key.

`fields` presents metadata for root properties. Given a field name, `label`, `description`, `type`, `multiline`, `options`, and `multiple` shape the control. Primitive options preserve the difference between a string, a number and a boolean. `required` displays a required marker. The host validates required fields and other business constraints. A default can appear as a placeholder or be applied explicitly with the field's Add button. Refreshing a value or field definition never applies a default.

`schemaMode="form"` displays field labels in a form layout and labels the extra-parameter group. `schemaMode="rows"` presents compact field rows. `allowExtraParams={false}` hides editing for undeclared root properties and preserves their values in the emitted object. `emptyLabel` names the add group in a schema-free editor, and `extraLabel` names the extras group when fields are supplied.

## JSON source

`JsonContent` explicitly distinguishes object values from source text. Keep the whole value from `onChange`, including invalid text. `onValidObjectChange(object, content)` runs after `onChange` for user edits that produce a JSON object. Switching modes alone does not call it.

`defaultMode` sets the initial mode and `mode` controls it. `onModeChange` receives a user's allowed switch. Invalid source displays in JSON mode and prevents switching to parameters. An incomplete parameter draft blocks an editable switch to JSON. Switching to JSON formats the object once with two-space indentation. Switching from JSON to parameters preserves the current source until a parameter is edited.

Both editors support `readOnly` for reading and copying and `disabled` to stop interaction. `jsonHeight` and `jsonPlaceholder` configure the source control.

## Replacing controls

`JsonEditorProvider` accepts any subset of `Input`, `Select`, `Button` and `SourceEditor`. Nested providers inherit the remaining controls and locale. Define replacements at module scope to preserve input identity. Callbacks receive strings or selection values. Select option values are opaque strings. Adapters should use `label`, `describedBy`, `readOnly` and `disabled` to preserve accessibility and interaction behavior. The default `en` locale and `zhCN` can also serve as a starting point for other translations.

```tsx
import { JsonEditorProvider } from '@axc/uikit/json-editor';
import { CodeMirrorSourceEditor } from '@axc/uikit/json-editor/codemirror';

const slots = { SourceEditor: CodeMirrorSourceEditor };

export function Editors({ children }: { children: React.ReactNode }) {
	return <JsonEditorProvider slots={slots}>{children}</JsonEditorProvider>;
}
```

The optional CodeMirror source supports `theme="light"`, `"dark"` or `"none"` through a slot wrapper. Set `--axc-json-text`, `--axc-json-muted`, `--axc-json-border`, `--axc-json-error`, `--axc-json-highlight`, and `--axc-json-surface` on the editor or an ancestor to theme the native UI.

## Parsing outside React

```ts
import { JsonValidationError, parseJsonContent, parseJsonObject } from '@axc/uikit/json-editor/core';

const object = parseJsonObject({ enabled: false });
try {
	parseJsonContent({ kind: 'text', text: '{"timeouts":[1e999]}' });
} catch (error) {
	if (!(error instanceof JsonValidationError)) throw error;
	// error.issues contains { code: 'invalid_value', path: ['timeouts', 0], params: {} }
}
```

`parseJsonObject` accepts plain objects containing finite JSON values. `parseJsonContent` also parses explicit text with the standard JavaScript JSON parser. Repeated names in source text have the parser's last-value semantics. Structured issues distinguish invalid source syntax, a non-object root and unsupported values. An empty text draft is invalid, while an empty object and empty strings inside it are valid JSON data.
