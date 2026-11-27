# Decision plugins

[简体中文](README.zh-CN.md)

A controlled React editor for an optional precondition, one selected plugin, and a required postcondition. The editor belongs to `@axclogo/uikit/decision-plugins`; ordinary condition editing remains available independently through `@axclogo/uikit/condition`.

## Install and connect

```sh
npm install @axclogo/uikit @axclogo/eval react react-dom
```

Use an Eval release that exports `pluginInput`, `validatePlugin`, `projectPluginOutputs`, and `evaluatePlugin`. Eval is an explicit application dependency. Its npm entry requires a browser bundler with WebAssembly support; it needs no separate initialization call.

```tsx
import { useMemo, useState } from 'react';
import * as evaluator from '@axclogo/eval';
import {
	PluginDecisionEditor,
	builtinDecisionPlugins,
	newPluginPlan,
	type PluginPlan,
} from '@axclogo/uikit/decision-plugins';
import '@axclogo/uikit/condition/styles.css';
import '@axclogo/uikit/decision-plugins/styles.css';

const catalog = {
	fields: [{ name: 'minimum', label: 'Minimum', dataType: 'number' as const }],
};

export function RuleEditor() {
	const plugins = useMemo(() => builtinDecisionPlugins().filter((plugin) => plugin.id === 'javascript'), []);
	const [plan, setPlan] = useState<PluginPlan>(() => {
		const draft = newPluginPlan(plugins[0]);
		return {
			...draft,
			config: { code: 'return { score: input.minimum + 1 };' },
			inputs: { minimum: 'minimum' },
			outputs: [{ key: 'score', path: '$.score', type: 'number' as const }],
			postcondition: {
				combinator: 'and' as const,
				not: false,
				rules: [{ field: 'plugin.score', operator: '>=', valueSource: 'field' as const, value: 'minimum' }],
			},
		};
	});
	return (
		<PluginDecisionEditor
			value={plan}
			onChange={setPlan}
			catalog={catalog}
			evaluator={evaluator}
			plugins={plugins}
			samples={[{ id: 'one', label: 'Sample', record: { minimum: 80 } }]}
		/>
	);
}
```

`newPluginPlan` creates an editable draft with an empty postcondition; complete it before execution or saving. Pass `onSave` to expose the validated save action. `language` accepts `en` or `zh-CN`.

## Presets and application responsibilities

`builtinDecisionPlugins({ language, ai, model, script })` returns five descriptors. Pass only the descriptors your application enables to the editor. Enabling a mode does not create a working integration.

| ID           | Configuration                               | Execution                                                           |
| ------------ | ------------------------------------------- | ------------------------------------------------------------------- |
| `ai`         | `id`, `version`, `prompt`                   | Host `ai.invoke` returns original AI text as a string.              |
| `model`      | `id`, `version`                             | Host `model.invoke` returns JSON.                                   |
| `javascript` | `code`                                      | Browser Worker runs an async JavaScript function body with `input`. |
| `http`       | `method`, `url`, `query`, `headers`, `body` | Browser `fetch` sends the configured request and reads JSON.        |
| `script`     | `id`, `version`                             | Host `script.invoke` returns JSON for an existing script.           |

Each resource service uses this shape:

```tsx
import type { ResourceService } from '@axclogo/uikit/decision-plugins';

const service: ResourceService = {
	resources: [{ id: 'classifier', version: '1', label: 'Classifier' }],
	actions: (
		<button type="button" onClick={openUploadDialog}>
			Upload model
		</button>
	),
	invoke: (resource, { config, input, signal }) => invokeHostModel(resource, config, input, signal),
};
```

`openUploadDialog` and `invokeHostModel` are application functions. Uploading, loading, permissions, credentials, model runtimes, script storage and remote protocols belong to the application. UIKit supplies the typed callback and preserves the selected resource ID and version in the rule. Resource IDs and versions identify exact selections; provide each pair once.

After an upload, fetch the new catalog and rebuild the descriptors with the updated `resources`. The stable preset editor preserves its mounted controls and configuration. A missing or retired selection remains visible until the user chooses another; it is not replaced automatically. `actions` is an optional host-owned slot, including when the catalog is missing or empty. Memoize descriptors until services or catalogs change so active execution is not invalidated by unrelated parent renders.

An absent catalog reports “Resource catalog is not connected”; an absent invoker reports “Execution service is not connected”. An empty catalog displays no selectable resources. These are distinct states. Invocation errors propagate; no replacement model, mock answer or default selection is inferred.

## Inputs, output paths and postconditions

`inputs` maps plugin argument names to exact original field names: `{ minimum: 'minimum' }`. Plugins receive only those mapped values in `input`. The original record remains available to the postcondition.

A returned JSON object such as `{ data: { score: 92 } }` can declare `{ key: 'score', path: '$.data.score', type: 'number' }`. The postcondition then sees `plugin.score` alongside original fields, allowing a literal comparison or `plugin.score >= minimum` with `valueSource: 'field'`.

Paths support `$`, dot-separated ASCII identifier keys and nonnegative array indices, for example `$.items[0].score`. Each path selects one value. Wildcards, filters and recursive descent are not supported. Outputs are scalar strings, finite numbers or booleans; a missing path, null or wrong type is an explicit error. Keys must be unique identifiers. The entire `plugin.*` namespace is reserved: original field names must not start with `plugin.`.

AI always exposes `plugin.text`, containing the unchanged raw answer. If the entire answer parses as JSON, configured output paths select from that parsed value. If parsing fails, mapped outputs are absent and conditions can use the original text, such as a keyword check. JSON extraction does not strip Markdown fences or guess fragments. A successfully parsed JSON value must satisfy its declared mappings. The `text` output key is reserved for AI.

The precondition is optional. A false precondition skips invocation. The postcondition is mandatory for every plugin, including AI, and must contain at least one valid rule. Selecting a plugin alone never decides that a record matches.

## HTTP testing and JavaScript execution

HTTP supports GET, POST, PUT, PATCH and DELETE. Query and header rows contain `{ key, source: 'literal' | 'input', value }`; `value` is literal text or an input argument name. JSON body text can use `{ "$input": "argumentName" }` as an entire value to insert a typed input, including nested objects and arrays. GET does not accept a body. Requests use the browser's CORS and CSP rules. Do not store secrets in persisted rule configuration.

A successful **Test plugin** is required before HTTP can be saved. Testing executes the plugin directly on the selected sample and shows its read-only JSON response, followed by output-path definitions and the mapped preview. It does not run the precondition or postcondition. Changing request configuration, inputs, sample or integration invalidates the test. A non-2xx response, network error or invalid JSON remains an error. A mock decision result does not satisfy this test requirement.

**Run decision** executes both gates and the plugin, or uses an explicitly selected sample output. The result shows skipped, matched or unmatched together with condition traces. Sample AI output is a JSON string literal, for example `"review required"`.

The JavaScript preset accepts a function body such as `return { score: input.minimum + 1 };`; `await` is supported. It has no compiler, transpiler, package resolver or other language runtime. Each invocation uses a dedicated Worker, terminates on completion or cancellation, and rejects after five seconds. Results must be finite plain JSON; undefined, custom objects and cycles fail. Worker execution avoids blocking the UI, but is not a security sandbox. Enable it only for trusted code and configure CSP to permit the required Worker. Other execution environments belong in custom plugins.

## Custom plugins and optional AI assistance

A `DecisionPlugin` defines `id`, `label`, `initialConfig`, `renderEditor`, `validate` and `execute`. Its ID must be nonempty and unique. `validate` throws on incorrect configuration; `execute` returns JSON or rejects. `unavailable` supplies a reason when an integration is disconnected. `requireTest` enables the same successful-test-before-save gate used by HTTP.

`renderEditor(props)` is a render callback, not a React component: return a stable component element, and place hooks inside that component. `props` supplies `config`, `onChange`, `inputs`, `outputs`, optional `assist` and `language`. Keep editor-only state out of `config`. Persist only JSON; execution functions and credentials belong outside the rule.

The optional `assist` prop uses `AxcAssistTransport` from the Condition entry. Omit it to disable assistance. Its `models` list and `generate(request, signal)` callback are host-owned; `generate` returns parsed JSON matching the requested response schema. This authoring callback is separate from the AI decision plugin, whose invocation returns raw text.

Assistance can draft preconditions, postconditions, AI prompts and JavaScript source. Custom editors can reuse `PluginTextAssist` with `assist`, `context`, `value`, `target`, `language` and `onApply`. Text drafts have `{ explanation: string, value: string }`; the user reviews and explicitly adopts a draft before configuration changes. Assistance does not execute generated code or decide a match.

## Runtime and evidence

`registerDecisionPlugins` builds a registry; `runPluginDecision` accepts `plan`, `catalog`, `record`, `plugins`, `evaluator`, `signal` and optional `onEvidence`. It asks Eval for precondition evaluation and mapped inputs, invokes the selected plugin, then returns the correlated result to Eval for output extraction and postcondition evaluation. Eval itself performs no HTTP, model or script execution.

The editor also accepts `onEvidence`. Evidence snapshots include the attempted plan and evaluation outcome; the host decides whether to persist them. Errors and failed replies remain visible, and evidence callbacks are not silently swallowed. Persist `PluginPlan`, not transient test responses, request IDs or UI state. For protocol details and structured validation errors, consult the matching AxcEval API reference.

The runtime callback adds `resultSource: "plugin" | "sample"` to each snapshot so stored sample simulations remain distinguishable from live execution.
