# AxcUIKit-TypeScript

English | [简体中文](./README.zh-CN.md)

[![CI](https://github.com/axclogo/AxcUIKit-TypeScript/actions/workflows/ci.yml/badge.svg)](https://github.com/axclogo/AxcUIKit-TypeScript/actions/workflows/ci.yml)

Focused React and TypeScript editors for application data. Build query filters and condition trees, configure AI decision rules, or edit any JSON value through a tree, parameter form, and raw JSON source. AxcUIKit-TypeScript is a component collection, not a complete UI framework or design system. Applications supply their own design system, business logic, and persistence.

## Component catalog

| Module                                          | Includes                                                                                                                                        | Import                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| [Condition](./packages/condition/README.md)     | Query builder, condition and decision editors, strict validation, AI-assisted drafts, and sample simulation through `@axc/eval`.                | `@axc/uikit/condition`   |
| [JSON Editor](./packages/json-editor/README.md) | Any JSON root, recursive field metadata, JSON Schema conversion, host file controls, property switches, and optional CodeMirror source editing. | `@axc/uikit/json-editor` |

## Installation

```sh
npm install @axc/uikit
```

The package requires Node.js 22.18 or later and supports React 18.3 and React 19. React and React DOM are peer
dependencies; an application that does not already provide them can install all three together:

```sh
npm install @axc/uikit react react-dom
```

Pin an exact npm version when the application needs controlled upgrades, for example
`npm install @axc/uikit@0.6.0`. TypeScript declarations are included. There is intentionally no `@axc/uikit` root
entry: import only the explicit subpaths below so unused editors and the CodeMirror adapter stay out of the application.

| Use                                      | Import                              |
| ---------------------------------------- | ----------------------------------- |
| Condition React components and contracts | `@axc/uikit/condition`              |
| React-free condition parsing             | `@axc/uikit/condition/core`         |
| Condition styles                         | `@axc/uikit/condition/styles.css`   |
| JSON Editor React components             | `@axc/uikit/json-editor`            |
| React-free JSON parsing                  | `@axc/uikit/json-editor/core`       |
| JSON Editor styles                       | `@axc/uikit/json-editor/styles.css` |
| Optional CodeMirror source control       | `@axc/uikit/json-editor/codemirror` |

Install from Git only when testing an unpublished commit. Pin the tag or commit because Git installation runs the
repository build:

```sh
npm install github:axclogo/AxcUIKit-TypeScript#COMMIT_SHA
```

## Basic usage

Condition values are controlled application state. Import the stylesheet once in the application's entry or component
bundle, and parse a draft before persisting it:

```tsx
import { useState } from 'react';
import {
	AxcCondition,
	emptyCondition,
	parseCondition,
	type AxcConditionValue,
	type ConditionField,
} from '@axc/uikit/condition';
import '@axc/uikit/condition/styles.css';

const fields: ConditionField[] = [
	{ name: 'title', label: 'Title' },
	{ name: 'price', label: 'Price', dataType: 'number' },
];

export function FilterEditor({ onSave }: { onSave: (value: AxcConditionValue) => void }) {
	const [value, setValue] = useState(emptyCondition);
	return (
		<>
			<AxcCondition fields={fields} value={value} onChange={setValue} />
			<button type="button" onClick={() => onSave(parseCondition(value, { fields }))}>
				Save
			</button>
		</>
	);
}
```

JSON Editor also uses controlled state and accepts any JSON root value:

```tsx
import { useState } from 'react';
import { JsonObjectEditor, type JsonContent } from '@axc/uikit/json-editor';
import '@axc/uikit/json-editor/styles.css';

export function SettingsEditor() {
	const [content, setContent] = useState<JsonContent>({ kind: 'value', value: { enabled: true } });
	return <JsonObjectEditor content={content} onChange={setContent} />;
}
```

The standard JSON editor loads without CodeMirror. To use CodeMirror for source mode, import
`CodeMirrorSourceEditor` from `@axc/uikit/json-editor/codemirror` and supply it through `JsonEditorProvider`. The
Condition simulator similarly does not bundle evaluation; applications explicitly supply the compatible `@axc/eval`
function. Complete contracts and adapter examples live in the component guides above.

## Shared design principles

- Editors take controlled data and emit changes as values. Applications own persistence, execution, network requests, and authorization; the optional simulator delegates to the evaluator function supplied by the application.
- Core modules parse and validate data independently of React. Validation errors have structured issues suitable for localization.
- Native controls and English and Chinese locales are available by default. Providers let applications supply controls from their design system. Module styles are scoped.
- Each module owns its public API, tests, and documentation. See the component guide for data contracts and adapter examples.

[Repository architecture](./docs/architecture.md) · [Release process](./docs/releasing.md) · [Contributor rules](https://github.com/axclogo/AxcUIKit-TypeScript/blob/main/AGENTS.md) · [Changelog](./CHANGELOG.md)

## Contributing

Use Node.js 22.18 or later. Run `npm ci` to install and build, and `npm run verify` to run formatting, type, boundary, lint, unused-code, React 18/19, API, and bundle checks. Use `npm run dev` to open the Condition demo at [localhost:5178](http://127.0.0.1:5178).

[MIT license](./LICENSE)
