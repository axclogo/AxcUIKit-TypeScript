# AxcUIKit-TypeScript

[English](./README.md) | 简体中文

[![CI](https://github.com/axclogo/AxcUIKit-TypeScript/actions/workflows/ci.yml/badge.svg)](https://github.com/axclogo/AxcUIKit-TypeScript/actions/workflows/ci.yml)

面向应用数据的 React / TypeScript 编辑组件集合。用于搭建查询筛选和条件树、配置 AI 判断规则，以及通过树形界面、参数表单和源码编辑任意 JSON 值。本仓库不是一套完整的 UI 框架或设计系统。应用继续使用自己的设计系统、业务逻辑与存储。

## 组件目录

| 模块                                              | 功能                                                                                                          | 导入                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ |
| [Condition](./packages/condition/README.zh-CN.md) | 查询构建器、筛选条件编辑器、嵌套规则与判断流程、严格校验、用于大模型结构化输出的 JSON Schema 和 AI 辅助草稿。 | `@axc/uikit/condition`   |
| [JSON Editor](./packages/json-editor/README.md)   | 任意 JSON 根值、嵌套字段元数据、JSON Schema 转换、宿主文件控件、属性开关，以及可选的 CodeMirror 源码编辑器。  | `@axc/uikit/json-editor` |

## 安装

```sh
npm install github:axclogo/AxcUIKit-TypeScript
```

从 Git 安装时会构建包。需要可复现安装时请固定发布标签或提交。支持 React 18.3 和 19。

按模块子路径导入组件与样式。校验和协议工具可脱离 React 使用。

```ts
import { AxcCondition } from '@axc/uikit/condition';
import { parseCondition } from '@axc/uikit/condition/core';
import '@axc/uikit/condition/styles.css';

import { JsonObjectEditor } from '@axc/uikit/json-editor';
import { parseJsonValue } from '@axc/uikit/json-editor/core';
import '@axc/uikit/json-editor/styles.css';
```

CodeMirror 适配器位于 `@axc/uikit/json-editor/codemirror`。

## 共同设计原则

- 编辑器接收受控数据，通过回调传出值。数据存储、规则执行、联网和鉴权由宿主应用负责。
- 核心模块独立于 React，负责解析、校验并提供可本地化的结构化错误。
- 默认提供原生控件和中英文语言包。宿主可通过 Provider 注入自己的设计系统控件。组件样式限定在各模块内部。
- 各模块维护自己的公开 API、测试和文档。数据契约与适配示例见组件指南。

[仓库架构](./docs/architecture.md) · [贡献规则](./AGENTS.md) · [更新记录](./CHANGELOG.md)

## 开发

使用 Node.js 22.18 或更新版本。运行 `npm ci` 安装并构建，运行 `npm run verify` 检查格式、类型、架构边界、Lint、未使用代码、React 18/19 兼容性、公开 API 和打包体积。运行 `npm run dev` 可在 [localhost:5178](http://127.0.0.1:5178) 查看 Condition 示例。

[MIT 许可证](./LICENSE)
