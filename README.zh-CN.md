# AxcUIKit-TypeScript

[English](./README.md) | 简体中文

[![CI](https://github.com/axclogo/AxcUIKit-TypeScript/actions/workflows/ci.yml/badge.svg)](https://github.com/axclogo/AxcUIKit-TypeScript/actions/workflows/ci.yml)

面向应用数据的 React / TypeScript 编辑组件集合。用于搭建查询筛选和条件树、配置 AI 判断规则，以及通过树形界面、参数表单和源码编辑任意 JSON 值。本仓库不是一套完整的 UI 框架或设计系统。应用继续使用自己的设计系统、业务逻辑与存储。

## 组件目录

| 模块                                              | 功能                                                                                                         | 导入                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------ |
| [Condition](./packages/condition/README.zh-CN.md) | 查询构建器、条件与判断流程编辑器、严格校验、AI 辅助草稿，以及通过 `@axc/eval` 执行的样本模拟。               | `@axc/uikit/condition`   |
| [JSON Editor](./packages/json-editor/README.md)   | 任意 JSON 根值、嵌套字段元数据、JSON Schema 转换、宿主文件控件、属性开关，以及可选的 CodeMirror 源码编辑器。 | `@axc/uikit/json-editor` |

## 安装

```sh
npm install @axc/uikit
```

要求 Node.js 22.18 或更新版本，支持 React 18.3 和 React 19。React 与 React DOM 是 peer dependency；应用尚未
安装时可以一次安装：

```sh
npm install @axc/uikit react react-dom
```

需要严格控制升级时请固定 npm 版本，例如 `npm install @axc/uikit@0.6.0`。包内自带 TypeScript 类型。
`@axc/uikit` 不提供根入口，必须使用下表中的显式子路径，避免未使用的编辑器或 CodeMirror 进入应用包。

| 用途                       | 导入路径                            |
| -------------------------- | ----------------------------------- |
| Condition React 组件与契约 | `@axc/uikit/condition`              |
| 无 React 的条件解析        | `@axc/uikit/condition/core`         |
| Condition 样式             | `@axc/uikit/condition/styles.css`   |
| JSON Editor React 组件     | `@axc/uikit/json-editor`            |
| 无 React 的 JSON 解析      | `@axc/uikit/json-editor/core`       |
| JSON Editor 样式           | `@axc/uikit/json-editor/styles.css` |
| 可选 CodeMirror 源码控件   | `@axc/uikit/json-editor/codemirror` |

只有测试尚未发布的提交时才从 Git 安装。必须固定 tag 或 commit，因为 Git 安装会执行仓库构建：

```sh
npm install github:axclogo/AxcUIKit-TypeScript#COMMIT_SHA
```

## 基本使用

Condition 使用受控状态。在应用入口或组件包中导入一次样式，并在持久化草稿前显式解析：

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
	{ name: 'title', label: '标题' },
	{ name: 'price', label: '价格', dataType: 'number' },
];

export function FilterEditor({ onSave }: { onSave: (value: AxcConditionValue) => void }) {
	const [value, setValue] = useState(emptyCondition);
	return (
		<>
			<AxcCondition fields={fields} value={value} onChange={setValue} />
			<button type="button" onClick={() => onSave(parseCondition(value, { fields }))}>
				保存
			</button>
		</>
	);
}
```

JSON Editor 同样使用受控状态，并支持任意 JSON 根值：

```tsx
import { useState } from 'react';
import { JsonObjectEditor, type JsonContent } from '@axc/uikit/json-editor';
import '@axc/uikit/json-editor/styles.css';

export function SettingsEditor() {
	const [content, setContent] = useState<JsonContent>({ kind: 'value', value: { enabled: true } });
	return <JsonObjectEditor content={content} onChange={setContent} />;
}
```

标准 JSON 编辑器不会加载 CodeMirror。需要 CodeMirror 源码模式时，从
`@axc/uikit/json-editor/codemirror` 导入 `CodeMirrorSourceEditor` 并通过 `JsonEditorProvider` 注入。
Condition 模拟器也不内置执行逻辑，应用必须显式传入兼容的 `@axc/eval` 函数。完整契约与适配示例见上方组件文档。

## 共同设计原则

- 编辑器接收受控数据，通过回调传出值。数据存储、执行、联网和鉴权由宿主应用负责；可选模拟组件只调用应用传入的执行器函数。
- 核心模块独立于 React，负责解析、校验并提供可本地化的结构化错误。
- 默认提供原生控件和中英文语言包。宿主可通过 Provider 注入自己的设计系统控件。组件样式限定在各模块内部。
- 各模块维护自己的公开 API、测试和文档。数据契约与适配示例见组件指南。

[仓库架构](./docs/architecture.md) · [发包流程](./docs/releasing.md) · [贡献规则](./AGENTS.md) · [更新记录](./CHANGELOG.md)

## 开发

使用 Node.js 22.18 或更新版本。运行 `npm ci` 安装并构建，运行 `npm run verify` 检查格式、类型、架构边界、Lint、未使用代码、React 18/19 兼容性、公开 API 和打包体积。运行 `npm run dev` 可在 [localhost:5178](http://127.0.0.1:5178) 查看 Condition 示例。

[MIT 许可证](./LICENSE)
