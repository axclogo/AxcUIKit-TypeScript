# UI 适配

[English](./ui-adapters.md) | 简体中文

Axc 的所有输入框、下拉、多行文本、复选框和按钮都通过 8 个可替换的控件渲染。把其中任意几个换成你的
UI 库即可；条件树、校验和布局都不变。

[`antd-adapter.tsx`](./antd-adapter.tsx) 是一份完整可用的 Ant Design 5 适配，已在 antd 5 + React 19 下通过类型检查，
并逐项跑过下面的检查清单。适配其他 UI 库时可以照着写。

## 接入

```tsx
// condition-ui.tsx：适配器在模块顶层定义，不要写在组件内部
import type { AxcUIComponents } from '@axclogo/uikit/condition';
export const controls: Partial<AxcUIComponents> = { Select: MySelect, Button: MyButton };

// 页面
import { AxcUIProvider, zhCN } from '@axclogo/uikit/condition';
<AxcUIProvider components={controls} locale={zhCN}>
	<AxcCondition fields={fields} value={value} onChange={setValue} />
</AxcUIProvider>;
```

- 只传要替换的控件，其余保持原生。嵌套的 Provider 继承外层。
- 在 render 中创建的适配器每次渲染都会重新挂载，丢失焦点和草稿。
- 适配器需要自己的文案时，用 `useAxcLocale()` 取当前语言包。

## 所有控件的通用规则

| 属性          | 要求                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| `label`       | 作为可访问名称（`aria-label`）。`Checkbox` 同时作为可见文字。                |
| `className`   | 放在**根节点**上。Axc 用它布局（`axc-select`、`axc-input` 等）。             |
| `disabled`    | 禁用控件；禁用时绝不调用 `onChange` / `onClick`。只读编辑器也传 `disabled`。 |
| `invalid`     | 显示错误状态（如 `status="error"`），并设置 `aria-invalid`。                 |
| `describedBy` | 设为 `aria-describedby`，它是 Axc 显示错误文案的元素 id。                    |
| `onChange`    | 传**值**，不传事件对象。                                                     |

## 各控件

| 控件          | 属性                                                 | 值 / 清空时       | 必须                                                                                                                                                             |
| ------------- | ---------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`      | `children`、`label?`、`tone?`、`onClick`             | —                 | 非提交按钮（`type="button"`，antd 为 `htmlType="button"`）。`tone="danger"` 用危险样式。                                                                         |
| `Input`       | `value`、`type?: 'text' \| 'number'`、`placeholder?` | `string` / `''`   | `number` 时也给出原始文本，不要四舍五入、限制范围或转换类型；由 Axc 严格解析。                                                                                   |
| `TextArea`    | `value`、`rows?`、`placeholder?`                     | `string` / `''`   | —                                                                                                                                                                |
| `Select`      | `value`、`options`、`searchable?`                    | `string` / —      | 只给出可用选项的值。不提供清除按钮（`allowClear={false}`）；允许“未选择”时 Axc 会显式加入 `''` 选项。`searchable` 时按 `label` 过滤。                            |
| `MultiSelect` | `value`、`options`、`searchable?`                    | `string[]` / `[]` | 只给出可用选项的值。                                                                                                                                             |
| `Checkbox`    | `checked`                                            | `boolean`         | 把 `label` 显示为文字。                                                                                                                                          |
| `Tags`        | `value`                                              | `string[]` / `[]` | 回车提交草稿（输入法组字时不提交）；多行粘贴按行添加；不按空格或逗号切分；**失焦不提交**（antd `Select mode="tags"` 会在失焦时提交，所以示例改用 Input + Tag）。 |
| `DateInput`   | `value`、`kind: 'date' \| 'datetime'`                | `string` / `''`   | `date`：`YYYY-MM-DD`；`datetime`：本地 `YYYY-MM-DDTHH:mm:ss`，不带时区。与 UI 库日期对象的转换在适配器内完成。                                                   |

`options` 的每一项是 `{ value: string; label: string; disabled?: boolean }`。

## 检查清单

用你的适配器逐项验证（Ant Design 示例全部通过）：

1. 所有按钮放在 `<form>` 里点击，不会提交表单。
2. 禁用和只读的编辑器里，任何控件都改不了值。
3. `0`、`false` 和清空能正确往返（`Input` 里 `'0'` 仍是 `'0'`，清空是 `''`）。
4. 数字字段输入 `abc`，Axc 显示错误，控件被标为无效。
5. 可搜索下拉按名称过滤；多选清空后是 `[]`。
6. Tags：回车添加，输入法组字时不添加，多行粘贴按行拆分，失焦不添加。
7. 日期时间：选一个时间，存下来是 UTC ISO，再次显示仍是同一本地时间。
8. 弹窗和滚动容器里的浮层、键盘操作、窄屏、深色主题。

## 给 AI 助手的提示词

让 AI 为你的 UI 库写适配器时，直接粘贴：

```text
用 <你的 UI 库> 为 @axclogo/uikit/condition 编写控件适配器。先阅读 node_modules/@axclogo/uikit/packages/condition/docs/ui-adapters.zh-CN.md，
以 node_modules/@axclogo/uikit/packages/condition/docs/antd-adapter.tsx 为模板。
导出模块顶层定义的 `controls`，类型为 Partial<AxcUIComponents>（全部替换时为 AxcUIComponents）。
每个控件：label → aria-label；className 放在根节点；disabled 时不触发任何回调；
invalid → 错误样式 + aria-invalid；describedBy → aria-describedby；onChange 传值，不传事件。
Button 必须是非提交按钮。Input 即使 type="number" 也给出原始字符串。Select 不提供清除按钮，只给出可用选项。
Tags：回车提交（输入法组字时不提交），多行粘贴按行拆分，不按空格/逗号切分，失焦不提交。
DateInput：date 为 "YYYY-MM-DD"，datetime 为本地 "YYYY-MM-DDTHH:mm:ss"，清空为 ""。
不要改写 Axc 的值、不要加校验、不要做类型转换；这些由 Axc 负责。
```

## 模型控件

可选 `ModelSelect: ComponentType<AxcModelSelectProps>` 接收原始 `models: { id, label, provider? }[]`、`value: string | null` 和 `onChange(string | null)`，以及通用控件属性。宿主可用供应商 → 模型级联选择；不要从 label 拆供应商。只回调目录中的模型 id，清空回调 null，供应商节点不可作为模型提交。未提供此适配器时使用已配置的 Select。
