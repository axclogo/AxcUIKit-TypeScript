# AxcUIKit-TypeScript

English | [简体中文](./README.zh-CN.md)

[![CI](https://github.com/axclogo/AxcUIKit-TypeScript/actions/workflows/ci.yml/badge.svg)](https://github.com/axclogo/AxcUIKit-TypeScript/actions/workflows/ci.yml)

Focused React and TypeScript editors for application data. Build query filters and condition trees, configure AI decision rules, or edit any JSON value through a tree, parameter form, and raw JSON source. AxcUIKit-TypeScript is a component collection, not a complete UI framework or design system. Applications supply their own design system, business logic, and persistence.

## Component catalog

| Module                                          | Includes                                                                                                                                        | Import                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| [Condition](./packages/condition/README.md)     | Query builder, condition and decision editors, strict validation, AI-assisted drafts, and sample simulation through `@axc/eval`.                | `@axc/uikit/condition`   |
| [JSON Editor](./packages/json-editor/README.md) | Any JSON root, recursive field metadata, JSON Schema conversion, host file controls, property switches, and optional CodeMirror source editing. | `@axc/uikit/json-editor` |

## Install

```sh
npm install github:axclogo/AxcUIKit-TypeScript
```

Install from Git. The repository builds the package during installation. Pin a release tag or commit for reproducible installs. React 18.3 and 19 are supported.

Import each component and its stylesheet from its own subpath. Validation and protocol helpers are also available independently of React.

```ts
import { AxcCondition } from '@axc/uikit/condition';
import { parseCondition } from '@axc/uikit/condition/core';
import '@axc/uikit/condition/styles.css';

import { JsonObjectEditor } from '@axc/uikit/json-editor';
import { parseJsonValue } from '@axc/uikit/json-editor/core';
import '@axc/uikit/json-editor/styles.css';
```

The CodeMirror adapter is available at `@axc/uikit/json-editor/codemirror`.

## Shared design principles

- Editors take controlled data and emit changes as values. Applications own persistence, execution, network requests, and authorization; the optional simulator delegates to the evaluator function supplied by the application.
- Core modules parse and validate data independently of React. Validation errors have structured issues suitable for localization.
- Native controls and English and Chinese locales are available by default. Providers let applications supply controls from their design system. Module styles are scoped.
- Each module owns its public API, tests, and documentation. See the component guide for data contracts and adapter examples.

[Repository architecture](./docs/architecture.md) · [Release process](./docs/releasing.md) · [Contributor rules](./AGENTS.md) · [Changelog](./CHANGELOG.md)

## Contributing

Use Node.js 22.18 or later. Run `npm ci` to install and build, and `npm run verify` to run formatting, type, boundary, lint, unused-code, React 18/19, API, and bundle checks. Use `npm run dev` to open the Condition demo at [localhost:5178](http://127.0.0.1:5178).

[MIT license](./LICENSE)
