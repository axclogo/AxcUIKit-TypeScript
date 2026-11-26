# UI adapters

English | [简体中文](./ui-adapters.zh-CN.md)

Axc renders every input, select, textarea, checkbox and button through eight replaceable controls.
Replace any of them with your UI library; the condition tree, validation and layout stay the same.

A complete, working adapter for Ant Design 5 is in [`antd-adapter.tsx`](./antd-adapter.tsx). It was type-checked
against antd 5 + React 19 and run through the checklist below. Use it as a template for other libraries.

## Setup

```tsx
// condition-ui.tsx: define adapters at module level, never inside a component
import type { AxcUIComponents } from '@axclogo/uikit/condition';
export const controls: Partial<AxcUIComponents> = { Select: MySelect, Button: MyButton };

// app
import { AxcUIProvider, zhCN } from '@axclogo/uikit/condition';
<AxcUIProvider components={controls} locale={zhCN}>
	<AxcCondition fields={fields} value={value} onChange={setValue} />
</AxcUIProvider>;
```

- Pass only what you replace; the rest stays native. Nested providers inherit from outer ones.
- An adapter created during render remounts on every render and loses focus and drafts.
- `useAxcLocale()` gives adapters the active locale if they need their own text.

## Rules for every control

| Prop          | What to do                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `label`       | Use as the accessible name (`aria-label`). For `Checkbox`, also show it as the visible text.                   |
| `className`   | Put it on the **root** element. Axc uses it for layout (`axc-select`, `axc-input`, …).                         |
| `disabled`    | Disable the control. Never call `onChange` / `onClick` while disabled. Read-only editors also pass `disabled`. |
| `invalid`     | Show the error state (e.g. `status="error"`) and set `aria-invalid`.                                           |
| `describedBy` | Set `aria-describedby` to it. It is the id of the element where Axc shows the error text.                      |
| `onChange`    | Call with the **value**, never with an event.                                                                  |

## Each control

| Control       | Props                                                | Value / cleared   | Must                                                                                                                                                                                                                           |
| ------------- | ---------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`      | `children`, `label?`, `tone?`, `onClick`             | —                 | Render a non-submit button (`type="button"`, antd: `htmlType="button"`). `tone="danger"` → danger style.                                                                                                                       |
| `Input`       | `value`, `type?: 'text' \| 'number'`, `placeholder?` | `string` / `''`   | For `number`, emit the raw text. Do not round, clamp or convert; Axc parses it strictly.                                                                                                                                       |
| `TextArea`    | `value`, `rows?`, `placeholder?`                     | `string` / `''`   | —                                                                                                                                                                                                                              |
| `Select`      | `value`, `options`, `searchable?`                    | `string` / —      | Emit only enabled option values. No clear button (`allowClear={false}`); Axc adds an explicit `''` option where "none" is allowed. Filter by `label` when `searchable`.                                                        |
| `MultiSelect` | `value`, `options`, `searchable?`                    | `string[]` / `[]` | Emit only enabled option values.                                                                                                                                                                                               |
| `Checkbox`    | `checked`                                            | `boolean`         | Show `label` as text.                                                                                                                                                                                                          |
| `Tags`        | `value`                                              | `string[]` / `[]` | Enter adds the draft (not while an IME is composing). A multi-line paste adds one word per line. Never split on spaces or commas. **Do not commit on blur** (antd `Select mode="tags"` does, so the example uses Input + Tag). |
| `DateInput`   | `value`, `kind: 'date' \| 'datetime'`                | `string` / `''`   | `date`: `YYYY-MM-DD`. `datetime`: local `YYYY-MM-DDTHH:mm:ss`, no zone. Convert to/from your library's date objects inside the adapter.                                                                                        |

`options` items are `{ value: string; label: string; disabled?: boolean }`.

## Checklist

Run these against your adapters (the Ant Design example passes all of them):

1. Every button inside a `<form>`: clicking does not submit.
2. Disabled and read-only editors: no control can change the value.
3. `0`, `false` and cleared values round-trip (`'0'` stays `'0'` in `Input`; cleared `Input` is `''`).
4. A number field with text like `abc` shows Axc's error and the control is marked invalid.
5. Searchable selects filter by label; multi-selects clear to `[]`.
6. Tags: Enter adds, IME composition does not, multi-line paste splits by line, blur does not add.
7. Datetime: pick a time, the stored value is UTC ISO, and it shows the same local time again.
8. Popups inside modals and scroll containers, keyboard navigation, narrow screens, dark theme.

## Prompt for an AI assistant

Paste this when asking an AI to write adapters for your UI library:

```text
Write adapters for @axclogo/uikit/condition using <your UI library>. Read node_modules/@axclogo/uikit/packages/condition/docs/ui-adapters.md
and use node_modules/@axclogo/uikit/packages/condition/docs/antd-adapter.tsx as the template.
Export `controls` typed as Partial<AxcUIComponents> (or AxcUIComponents for all eight), defined at module level.
For every control: label → aria-label; className on the root element; disabled blocks all callbacks;
invalid → error state + aria-invalid; describedBy → aria-describedby; onChange receives values, not events.
Button: non-submit. Input: emit raw strings, even for type="number". Select: no clear button, only enabled options.
Tags: Enter commits (not during IME composition), multi-line paste splits by line, never split on spaces/commas,
never commit on blur. DateInput: date "YYYY-MM-DD", datetime local "YYYY-MM-DDTHH:mm:ss", cleared "".
Do not change Axc's values, add validation, or coerce types; Axc does that.
```

## Model control

Optional `ModelSelect: ComponentType<AxcModelSelectProps>` receives original `models: { id, label, provider? }[]`, `value: string | null`, `onChange(string | null)` and common control props. Hosts may use provider → model cascading controls without parsing labels. Emit only a listed model id, or null when cleared; provider nodes are not selectable model values. When omitted, the configured Select is used.
