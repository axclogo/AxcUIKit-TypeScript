# Architecture

AxcUIKit-TypeScript is one repository of focused React components, not a complete UI framework. The root [contributor rules](../AGENTS.md) apply to each component, and each component owns the details of its contract.

## Source and distribution

- `packages/condition/src`, `packages/condition/tests`, `packages/condition/protocol`: condition components and their existing protocol. Preserve their behavior and exported names.
- `packages/json-editor/src`, `packages/json-editor/tests`: JSON object editing, tree/form controls and raw JSON drafts.
- One installable package, `@axc/uikit`, exposes explicit subpaths: `condition`, `condition/core`, `condition/styles.css`, `json-editor`, `json-editor/core`, `json-editor/styles.css`, and `json-editor/codemirror`. There is no catch-all component barrel. The package installs as a unit. Separate ESM entry graphs keep Condition and the native JSON Editor independent of CodeMirror loading.
- Node.js 22.18 and later can load the JavaScript subpaths with either `import` or `require()`. Both resolve to the same synchronous ESM build. [Node.js ESM loading from CommonJS](https://nodejs.org/download/release/v22.18.0/docs/api/modules.html#loading-ecmascript-modules-using-require)
- The root Git package builds all entry points in `prepare`, so Raven can consume this repository directly without npm publication or subdirectory Git installation.
- Root scripts own checks, builds and packaging. Condition retains its existing strict coverage and bundle budgets. JSON Editor has 18,000-byte JavaScript and 1,500-byte CSS gzip budgets. Its JavaScript budget is smaller than Condition's because it covers data editing and a source-editor adapter, with CodeMirror packages kept external. Verification leaves no process reports, coverage data or screenshots. The maintained API references in each component document the typed subpaths.

## Shared API principles

- Controlled props contain the authoritative application value. Callbacks emit updated values. Presentation state has its own API where a parent needs to control it. JSON Editor mode selects a view and is distinct from its object-or-text content.
- Parsing checks the public data contract without coercion. An empty or invalid draft can remain visible for editing. Field defaults guide presentation and explicit creation. They do not silently change saved data.
- Core issues have stable codes and paths. UI layers translate them with the active locale. Hosts can branch on issue codes and supply localized messages.
- Control slots are stable React components whose callbacks receive strings, booleans, selections, or action signals. Slots forward the public accessibility and interaction props to their controls. Where exposed, `readOnly` preserves inspection and copying while preventing edits. `disabled` makes controls and actions inert.
- Native controls are available through each provider. Scoped styles and CSS variables cover editor layout and default controls. Applications style the internals of their injected controls through their design system.
- Hosts own networking, authorization, business validation, and persistence. Condition's AI assist invokes the model callback supplied by the host after the user's Generate action.

## JSON editor contract

The core is independent of React, DOM, Raven and UI frameworks. Export `JsonValue`, `JsonObject`, `JsonContent = { kind: 'object'; value: JsonObject } | { kind: 'text'; text: string }`, `JsonField`, `parseJsonObject(value: unknown): JsonObject`, `parseJsonContent(content): JsonObject`, and `JsonValidationError` carrying structured issues. JSON values must be finite JSON data. Parsing does not repair, coerce or delete user data. Missing values and empty strings are distinct.

`JsonField`: `name`, optional `label`, `description`, `type` (string/number/boolean/null/object/array), `required`, `default`, `options` (typed string/number/boolean values plus labels), `multiline`, `multiple`. Fields are rendering metadata, not a claim of full JSON Schema validation. Defaults are not silently persisted. Required metadata must have explicitly documented validation semantics.

`ParamObjectEditor`: `value: JsonObject`, `onChange`, optional `fields`, `schemaMode: 'form' | 'rows'`, `allowExtraParams`, `emptyLabel`, `extraLabel`, `readOnly`, `disabled`, `className`. Tree editing supports nested objects and arrays, preserves identity/focus/expanded state across equal values and schemas and external changes, reports duplicate keys instead of overwriting, and retains invalid numeric drafts. Callback values contain no internal node IDs. Blank unfinished rows stay internal until named. Empty objects, arrays, strings, false and zero are preserved.

`JsonObjectEditor`: `content`, `onChange(content)`, optional `onValidObjectChange`, `mode`/`defaultMode`/`onModeChange` ('params'|'json'), `jsonHeight`, `jsonPlaceholder`, plus the parameter presentation props above excluding value/onChange. Invalid JSON stays as text and cannot enter parameter mode. onValidObjectChange reports only successfully parsed objects; schema/business validation remains separate. External content is authoritative. Switching to JSON formats once; typing does not reformat.

`JsonEditorProvider`: optional `slots`, `locale`, children; nested providers inherit. Public slot types cover Input, Select, Button and SourceEditor; add other slots only for actual rendering needs. Controls emit values, not UI-library events. Adapters are module-level stable components. Numeric drafts stay strings. readOnly permits reading/copying while preventing edits; disabled prevents edits and actions. Native controls are the default, every native button is type=button, styles are scoped and never target host body or injected control internals. English and Chinese locales are provided as en and zhCN. CodeMirrorSourceEditor is an optional subpath adapter using the existing mature React CodeMirror wrapper and official JSON language support.

## Raven integration

Raven retains only Semi slots, theme mapping, remote option loading and conversion of its input/config/ui schema into JsonField[]. No JSON tree/state implementation remains in Raven. Existing business drafts may stay object|string in Raven, with the host wrapper converting to explicit JsonContent. This is a host data representation adapter, not an old package compatibility implementation. Existing parser imports resolve to package parsing through a thin host localization adapter where needed.

Raven imports condition from @axc/uikit/condition and JSON editing from @axc/uikit/json-editor. Network and authentication remain in Raven. No repository absolute path becomes a committed dependency; integration tests may install an officially packed local artifact before the Git distribution is published.
