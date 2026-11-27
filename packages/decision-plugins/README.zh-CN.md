# 决策插件

[English](README.md)

受控 React 编辑器：可选前置条件、一个选中的插件、必填后置条件。入口为 `@axclogo/uikit/decision-plugins`；普通条件编辑仍可通过 `@axclogo/uikit/condition` 独立使用。

## 安装与接入

```sh
npm install @axclogo/uikit @axclogo/eval react react-dom
```

Eval 版本须包含 `pluginInput`、`validatePlugin`、`projectPluginOutputs`、`evaluatePlugin` 四个导出。Eval 由应用显式安装；其 npm 入口需要支持 WebAssembly 的浏览器打包器，无需单独调用初始化函数。

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
	fields: [{ name: 'minimum', label: '最低分', dataType: 'number' as const }],
};

export function RuleEditor() {
	const plugins = useMemo(() => builtinDecisionPlugins().filter((plugin) => plugin.id === 'javascript'), []);
	const [plan, setPlan] = useState<PluginPlan>(() => {
		const draft = newPluginPlan(plugins[0]);
		return {
			...draft,
			config: { code: 'return { score: input.minimum + 1 };' },
			inputs: { minimum: 'minimum' },
			outputs: [{ key: 'score', path: '$.score', type: 'number' }],
			postcondition: {
				combinator: 'and',
				not: false,
				rules: [{ field: 'plugin.score', operator: '>=', valueSource: 'field', value: 'minimum' }],
			},
		};
	});
	return (
		<PluginDecisionEditor
			language="zh-CN"
			value={plan}
			onChange={setPlan}
			catalog={catalog}
			evaluator={evaluator}
			plugins={plugins}
			samples={[{ id: 'one', label: '样本', record: { minimum: 80 } }]}
		/>
	);
}
```

`newPluginPlan` 创建包含空后置条件的草稿，执行、保存前须补全。传入 `onSave` 后显示保存操作，保存前会校验完整规则。`language` 支持 `en`、`zh-CN`。

## 五种预置插件与职责边界

`builtinDecisionPlugins({ language, ai, model, script })` 返回五个插件描述。开发者将要开放的插件传给编辑器；开放入口不代表已经接通执行能力。

| ID           | 配置                                        | 执行方式                                                   |
| ------------ | ------------------------------------------- | ---------------------------------------------------------- |
| `ai`         | `id`、`version`、`prompt`                   | 宿主 `ai.invoke` 返回 AI 原始文本字符串。                  |
| `model`      | `id`、`version`                             | 宿主 `model.invoke` 返回 JSON。                            |
| `javascript` | `code`                                      | 浏览器 Worker 执行异步 JavaScript 函数体，入参为 `input`。 |
| `http`       | `method`、`url`、`query`、`headers`、`body` | 浏览器 `fetch` 发请求，读取 JSON 返回值。                  |
| `script`     | `id`、`version`                             | 宿主 `script.invoke` 执行已有脚本并返回 JSON。             |

资源服务的结构相同：

```tsx
import type { ResourceService } from '@axclogo/uikit/decision-plugins';

const service: ResourceService = {
	resources: [{ id: 'classifier', version: '1', label: '分类器' }],
	actions: (
		<button type="button" onClick={openUploadDialog}>
			上传模型
		</button>
	),
	invoke: (resource, { config, input, signal }) => invokeHostModel(resource, config, input, signal),
};
```

`openUploadDialog`、`invokeHostModel` 是应用自己的函数。上传、加载、权限、密钥、模型运行时、脚本存储和远端协议均由宿主负责。UIKit 提供类型化回调，将所选资源的 ID 和版本保存在规则中；目录内每个 ID 与版本组合须唯一。

上传成功后，宿主获取新目录，用更新后的 `resources` 重新创建插件描述。预置编辑器保持原有控件实例和配置；资源被移除或版本下线时，保留原选择并提示用户重新选择，不自动替换。`actions` 可放宿主自己的上传、管理按钮，目录缺失或为空时仍可展示。服务和目录未变化时，应保持插件描述引用稳定，避免无关的父组件渲染使正在执行的操作失效。

缺少目录显示“未接入资源目录”，缺少调用函数显示“未接入执行接口”，空目录显示“暂无可选资源”。这三种状态有明确区别。调用失败直接报告，不替换模型、不编造结果、不自动选择默认资源。

## 入参、JSONPath 与后置条件

`inputs` 把插件参数名映射到原始字段的准确名称，例如 `{ minimum: 'minimum' }`。插件的 `input` 只包含映射的值；后置条件仍能使用原始记录字段。

假设插件返回 `{ data: { score: 92 } }`，配置 `{ key: 'score', path: '$.data.score', type: 'number' }`，后置条件便可选择 `plugin.score`。它既能比较固定值，也能通过 `valueSource: 'field'` 比较原始字段，例如 `plugin.score >= minimum`。

路径支持根 `$`、点号连接的 ASCII 标识符和非负数组下标，例如 `$.items[0].score`。每条路径只取一个值，不支持通配符、过滤表达式和递归查找。输出类型为字符串、有限数字或布尔值；路径不存在、结果为 null、类型错误均明确报错。输出名须为唯一标识符。整个 `plugin.*` 命名空间保留给插件输出，原始字段名不能以 `plugin.` 开头。

AI 始终提供 `plugin.text`，内容为原始回答。如果完整回答可解析为 JSON，声明的输出路径从解析结果中取值；解析失败则不产生这些映射输出，仍可用原文做关键词等条件判断。不会猜测片段或自动剥离 Markdown 代码围栏。已成功解析的 JSON 必须满足声明的输出映射。AI 的 `text` 输出名保留给原文。

前置条件可选；前置未通过时跳过插件调用。所有插件，包括 AI，均必须配置至少一条有效后置规则。只选择插件不会自动判定命中。

## HTTP 测试与 JavaScript 执行

HTTP 支持 GET、POST、PUT、PATCH、DELETE。查询参数和请求头每行格式为 `{ key, source: 'literal' | 'input', value }`；`value` 是固定文本或入参名。JSON 请求体中可以用完整值 `{ "$input": "参数名" }` 插入有类型的入参，包括嵌套对象、数组。GET 不接受请求体。请求遵循浏览器 CORS、CSP 限制；不要把密钥保存在规则配置中。

HTTP 保存前必须成功点击一次“测试插件”。测试会使用所选样本直接调用插件，下方只读 JSON 编辑区展示返回结果，再下方定义输出路径并预览提取值。这个操作不执行前置、后置条件。修改请求配置、输入映射、样本或接入服务后须重新测试。非 2xx、网络错误、无效 JSON 都会报错。“使用样例输出”的模拟判断不能替代真实 HTTP 测试。

“模拟判断”会执行前后置条件，并实际调用插件，或使用用户明确选择的样例输出。结果展示跳过、命中或未命中及条件轨迹。AI 样例输出须填 JSON 字符串，例如 `"需要复核"`。

JavaScript 填写函数体，例如 `return { score: input.minimum + 1 };`，支持 `await`。不包含编译器、转译器、包解析器或其他语言运行时。每次调用使用独立 Worker，结束、取消时终止，超过五秒报超时。结果必须为有限值组成的普通 JSON；undefined、自定义对象、循环引用会报错。Worker 用于避免阻塞界面，不是安全沙箱；仅对可信代码开启，并按需配置允许 Worker 的 CSP。其他执行环境通过自定义插件接入。

## 自定义插件与可选 AI 辅助

`DecisionPlugin` 定义 `id`、`label`、`initialConfig`、`renderEditor`、`validate`、`execute`。ID 非空且唯一。`validate` 对错误配置抛错，`execute` 返回 JSON 或拒绝调用。接入未就绪时通过 `unavailable` 提供原因；`requireTest` 可启用与 HTTP 相同的测试后保存要求。

`renderEditor(props)` 是渲染回调，不是 React 组件：返回稳定组件元素，在该组件内部使用 hooks。`props` 包含 `config`、`onChange`、`inputs`、`outputs`，以及可选的 `assist`、`language`。仅持久化 JSON 配置；临时编辑状态、执行函数、凭据不放入规则。

`assist` 使用 Condition 入口的 `AxcAssistTransport`，不传则关闭辅助功能。`models` 目录和 `generate(request, signal)` 均由宿主提供；`generate` 返回符合请求 schema 的已解析 JSON。这个辅助编写接口与返回原始文本的 AI 判断插件执行接口分开。

辅助功能可生成前置条件、后置条件、AI 提示词和 JavaScript 源码。自定义插件也可使用 `PluginTextAssist`，传入 `assist`、`context`、`value`、`target`、`language`、`onApply`。文本草稿格式为 `{ explanation: string, value: string }`，用户审核并明确采用后才写回配置。辅助生成不自动执行代码，也不代替条件判断。

## 运行与留证

`registerDecisionPlugins` 创建注册表；`runPluginDecision` 接受 `plan`、`catalog`、`record`、`plugins`、`evaluator`、`signal` 和可选 `onEvidence`。它先由 Eval 判断前置并生成插件入参，再调用选中插件，将关联的结果交回 Eval 提取输出并判断后置。Eval 本身不发 HTTP 请求、不执行模型或脚本。

编辑器同样接受 `onEvidence`。快照包含本次规则与判断结果，宿主自行决定是否保存。失败结果和错误保持可见；留证回调抛错不会被静默吞掉。持久化 `PluginPlan`，不要把临时测试结果、请求 ID 或 UI 状态写进协议。详细协议和结构化校验错误请查阅配套 AxcEval API 文档。

运行编排回调会在每条快照加入 `resultSource: "plugin" | "sample"`，外部保存时可明确区分实际执行和样例模拟。
