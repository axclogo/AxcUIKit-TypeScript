# JSON editor

A controlled React editor for any JSON value: object, array, string, number, boolean or null. `ParamObjectEditor` renders a tree; `JsonObjectEditor` adds JSON source mode. The component names remain unchanged. Import the stylesheet explicitly.

```tsx
import { useState } from 'react';
import { JsonEditorProvider, JsonObjectEditor, zhCN, type JsonContent, type JsonField } from '@axc/uikit/json-editor';
import '@axc/uikit/json-editor/styles.css';

const fields: JsonField[] = [
	{ name: 'enabled', label: 'Enabled', type: 'boolean' },
	{ name: 'timeouts', type: 'object', fields: [{ name: 'seconds', type: 'number', default: 3, required: true }] },
	{ name: 'tags', type: 'array', items: { type: 'string', description: 'A tag', default: 'new' } },
];

export function Settings() {
	const [content, setContent] = useState<JsonContent>({ kind: 'value', value: { enabled: false, timeouts: {} } });
	const [disabledKeys, setDisabledKeys] = useState<string[]>([]);
	return (
		<JsonEditorProvider locale={zhCN}>
			<JsonObjectEditor
				content={content}
				onChange={setContent}
				fields={fields}
				disabledKeys={disabledKeys}
				onDisabledKeysChange={setDisabledKeys}
			/>
		</JsonEditorProvider>
	);
}
```

## Tree editing

`ParamObjectEditor` takes `value: JsonValue` and `onChange(value: JsonValue)`. Every root type supports tree editing and changing its type. The root cannot be removed. A blank new object row is local until named. An unfinished rename, duplicate key or invalid number stays in the tree and delays emission until fixed. Existing empty-string keys are preserved; use source mode to create new empty-string keys. Empty containers, empty strings, zero, false and null are preserved.

`JsonFieldDefinition` is rendering metadata for any value. `JsonField` adds `name` for an object property. `fields` describes root object properties. `rootField` describes any root, including arrays and primitives; explicit `fields` overrides `rootField.fields`. For example, `rootField={{ type: 'array', items: { type: 'number', default: 0 } }}` edits an array of numbers. No metadata is required for schema-free editing.

Definitions recursively support:

- `fields`: named properties of an object. Missing declared fields appear without being persisted.
- `items`: one definition for every array element, including object or array elements.
- `label`, `description`, `type`, `required`, `options`, `default`, `multiline`, `multiple`, and `format` at each level.
- `additionalProperties`: `true` or omitted permits schema-free extra properties; `false` hides their tree controls while preserving data; a definition applies metadata to every extra property.

`required` only displays a marker. Type mismatches remain editable with their actual JSON type. Hosts own required/type/enum/format/business validation. `options` accepts any JSON value (including null and structured values); labels are optional. Existing out-of-list values remain selectable. `multiple` selects an array of option values. Defaults appear as primitive placeholders and are applied only through explicit Add actions, including adding array elements. Refreshing values or metadata never writes defaults.

`format: 'date' | 'date-time'` is passed to the Input slot. Native controls remain text inputs, preserving full date-time offsets, fractional seconds and invalid strings without normalization. Hosts can supply date pickers that preserve the same string contract.

`schemaMode="form"` displays field labels and extra-group labels; `"rows"` uses compact rows. `allowExtraParams` overrides root `additionalProperties` visibility only; it never deletes hidden values. `emptyLabel` names the schema-free root add group; `extraLabel` names the root extras group. Nested metadata controls its own extra properties. Identity, focus and expansion survive equal-value refreshes and ordinary external updates.

## JSON source

`JsonContent = { kind: 'value'; value: JsonValue } | { kind: 'text'; text: string }` distinguishes values from source text, including a string root from its JSON-encoded source. Keep the entire `onChange` result, including invalid text. `onValidValueChange(value, content)` follows `onChange` for user edits producing any valid JSON value. Mode switches alone do not call it.

`defaultMode` sets the initial mode; `mode` controls it. `onModeChange` reports allowed switches. Invalid source displays in JSON mode and blocks parameters. An invalid tree draft blocks an editable switch to JSON. Switching to JSON formats once with two-space indentation. Switching to parameters preserves the original source until the tree is edited. These rules apply equally to every root type.

`readOnly` permits reading, copying, expansion and mode switches without emitting changes. `disabled` stops editing and actions, including mode switches. `jsonHeight` and `jsonPlaceholder` configure the source control. Typed host props are trusted; use core parsers for unknown input.

## Root property switches

`disabledKeys?: readonly string[]` and `onDisabledKeysChange?: (keys: string[]) => void` are controlled presentation state. Supplying a callback shows enable/deactivate buttons for existing root object properties; the list alone can display inactive state. Buttons never change `value` or call `onChange`. Inactive properties remain editable; hosts decide their execution, persistence or validation semantics.

Only the toggled name is added or removed. Missing names, order and unrelated duplicates remain as supplied. Renaming/deleting a property, changing the root type or switching modes does not clean up the list. Nested properties and array elements have no switches. Read-only mode shows inactive state without switch actions; disabled mode disables actions. Source mode edits JSON only; the host retains the separate list.

## JSON Schema conversion

```tsx
import { jsonSchemaToField } from '@axc/uikit/json-editor/core';

const rootField = jsonSchemaToField({
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: {
		entries: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					day: { type: 'string', format: 'date', title: 'Day' },
				},
				required: ['day'],
				additionalProperties: false,
			},
		},
	},
	additionalProperties: false,
});
// <JsonObjectEditor rootField={rootField} content={content} onChange={setContent} />
// For property definitions alone: rootField.fields.
```

`jsonSchemaToField(schema: unknown): JsonFieldDefinition` is a React-free, synchronous structural conversion for an expanded [JSON Schema draft 2020-12](https://json-schema.org/draft/2020-12/json-schema-core). It checks supported schema shapes, not instance data or business constraints. It never resolves references, fetches resources, applies defaults to data or validates defaults against type/enum. The returned definition covers the root so that root arrays, scalar annotations and additionalProperties are retained.

Supported keywords/forms:

| Keyword                | Conversion                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$schema`              | Optional exact `https://json-schema.org/draft/2020-12/schema` dialect declaration; no version field is emitted.                                           |
| `type`                 | Single `object`, `array`, `string`, `number`, `integer`, `boolean`, or `null`. `integer` uses a number control; integer validation remains with the host. |
| `properties`           | Object mapping names to recursively converted schemas, returned as `fields`. Literal names are preserved.                                                 |
| `required`             | Unique string array, mapped to property markers. Names absent from properties receive definitions (using additionalProperties metadata when supplied).    |
| `items`                | One recursively converted schema for all elements.                                                                                                        |
| `enum`                 | Nonempty array of any finite JSON values, mapped to options without coercion.                                                                             |
| `title`, `description` | String label/description annotations.                                                                                                                     |
| `default`              | Any finite JSON value, preserved as metadata.                                                                                                             |
| `format`               | `date` or `date-time`, retained for Input adapters.                                                                                                       |
| `additionalProperties` | Boolean or recursively converted schema, controlling extra-property presentation only.                                                                    |

An empty schema or boolean `true` produces unconstrained metadata. Boolean `false` schemas are unsupported (except `additionalProperties: false`), because the editor does not represent an always-rejecting validator.

**Every keyword outside the table throws; none are silently ignored.** Unsupported keywords include:

- References and resource/vocabulary metadata: `$ref`, `$dynamicRef`, `$defs`, `$id`, `$anchor`, `$dynamicAnchor`, `$vocabulary`, `$comment`. Expand references and remove unused definition/resource scaffolding before conversion.
- Composition/conditionals: `oneOf`, `anyOf`, `allOf`, `not`, `if`, `then`, `else`.
- Other applicators: `prefixItems`, `contains`, `minContains`, `maxContains`, `unevaluatedItems`, `unevaluatedProperties`, `patternProperties`, `propertyNames`, `dependentSchemas`, `dependentRequired`.
- Other assertions: `const`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`, `minLength`, `maxLength`, `pattern`, `minItems`, `maxItems`, `uniqueItems`, `minProperties`, `maxProperties`.
- Other annotations/content: `examples`, `readOnly`, `writeOnly`, `deprecated`, `contentEncoding`, `contentMediaType`, `contentSchema`, and custom keywords.

Unsupported forms include type arrays/unions, other format names/dialects, tuple `items` arrays, and false schemas. Malformed supported structures also throw. Unsupported names inside default/enum **data** are ordinary literal keys, not schema keywords.

Failures throw `JsonConfigurationError extends TypeError` with `issues: readonly JsonIssue[]`. Each issue has `{ code, path, params }`; paths identify schema locations (for example `['properties', 'rows', 'items', 'oneOf']`). `unsupported_schema_keyword` includes `params.keyword`; `unsupported_schema_value` identifies unsupported forms; `invalid_schema` identifies malformed/non-JSON schema data. The converter stops at the first conversion failure; non-JSON input can contain multiple parser issues.

## File fields

`type: 'file'` stores an opaque string reference. File objects, uploading, lifetime management and display names belong to the host. Supply `JsonEditorProvider.slots.FileInput`; there is no native or text-input fallback for this field. Missing slots throw `JsonConfigurationError` with `missing_file_slot`, a metadata path, and `{ slot: 'FileInput' }`, including read-only, disabled and source views.

The exported slot interface is:

```ts
interface FileInputProps {
	label: string;
	describedBy?: string;
	path?: readonly (string | number)[];
	value: string | undefined;
	onChange: (reference: string) => void;
	readOnly?: boolean;
	disabled?: boolean;
}
```

`value: undefined` means a missing field, distinct from an empty reference. `path` is the current JSON value path; it is undefined while this value or an ancestor belongs to an unnamed object draft. An unnamed draft is never reported as an empty-string property. The adapter calls `onChange` only when it has a reference string. It must honor disabled and readOnly. In read-only mode the editor renders the reference and the slot renders the host's display name without a picker. A value of another JSON type is displayed as that actual type for host correction, not coerced into a reference.

This host example keeps files in memory. A persistent application should replace the map with its own file service and durable references, handling upload errors within the slot.

```tsx
import { useState } from 'react';
import { JsonEditorProvider, ParamObjectEditor, type FileInputProps, type JsonValue } from '@axc/uikit/json-editor';

const files = new Map<string, File>();

function HostFileInput({ label, describedBy, value, onChange, readOnly, disabled }: FileInputProps) {
	const file = value === undefined ? undefined : files.get(value);
	if (readOnly) {
		return (
			<output aria-label={label} aria-describedby={describedBy}>
				{file?.name}
			</output>
		);
	}
	return (
		<label>
			{label}
			{file?.name}
			<input
				type="file"
				aria-label={label}
				aria-describedby={describedBy}
				disabled={disabled}
				onChange={(event) => {
					const selected = event.currentTarget.files?.[0];
					if (!selected) return;
					const reference = crypto.randomUUID();
					files.set(reference, selected);
					onChange(reference);
				}}
			/>
		</label>
	);
}

export function AttachmentEditor() {
	const [value, setValue] = useState<JsonValue>({});
	return (
		<JsonEditorProvider slots={{ FileInput: HostFileInput }}>
			<ParamObjectEditor value={value} onChange={setValue} fields={[{ name: 'attachment', type: 'file' }]} />
		</JsonEditorProvider>
	);
}
```

## Replacing controls

`JsonEditorProvider` accepts a subset of Input, Select, Button, SourceEditor and FileInput. Nested providers inherit remaining slots and locale. Define replacements at module scope to preserve identity. Callbacks receive typed values, not DOM/library events; select option IDs are opaque strings. Select adapters emit only supplied option IDs; a single select may emit undefined only when a placeholder is offered. Adapters forward label/describedBy and honor readOnly/disabled. Native buttons have `type="button"`. Both `en` and `zhCN` cover all UI and issue messages.

```tsx
import { JsonEditorProvider } from '@axc/uikit/json-editor';
import { CodeMirrorSourceEditor } from '@axc/uikit/json-editor/codemirror';

const slots = { SourceEditor: CodeMirrorSourceEditor };
export function Editors({ children }: { children: React.ReactNode }) {
	return <JsonEditorProvider slots={slots}>{children}</JsonEditorProvider>;
}
```

The optional CodeMirror slot supports `theme="light"`, `"dark"` or `"none"` through a wrapper. Theme native UI with `--axc-json-text`, `--axc-json-muted`, `--axc-json-border`, `--axc-json-error`, `--axc-json-highlight`, and `--axc-json-surface`. Styling remains scoped to the editor.

## Parsing outside React

```ts
import { JsonValidationError, parseJsonContent, parseJsonValue } from '@axc/uikit/json-editor/core';

const value = parseJsonValue([false, null, 0, '']);
try {
	parseJsonContent({ kind: 'text', text: '{"timeouts":[1e999]}' });
} catch (error) {
	if (!(error instanceof JsonValidationError)) throw error;
	// { code: 'invalid_value', path: ['timeouts', 0], params: {} }
}
```

`parseJsonValue` accepts finite JSON data at any root and preserves input identity. `parseJsonContent` additionally parses source with JavaScript JSON.parse; repeated source names have last-value semantics. `invalid_json` reports syntax errors; `invalid_value` reports non-JSON values, cycles, sparse entries or non-finite numbers. Empty source is invalid; the JSON string `""` is valid. Incorrect configuration uses structured TypeErrors: `duplicate_field` identifies repeated sibling field names; `missing_file_slot` identifies missing file adapters. These join the three Schema issue codes above. No version field or editor-only state is persisted.

## Migrating from 0.4

Use `kind: 'value'` instead of `kind: 'object'`, `parseJsonValue` instead of `parseJsonObject`, and `onValidValueChange` instead of `onValidObjectChange`. Callbacks now accept `JsonValue`. The old names/discriminant and `expected_object` issue are removed, without aliases or compatibility branches. `JsonObject` remains available as the ordinary JSON object type.
