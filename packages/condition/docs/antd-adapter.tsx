// Complete adapter for Ant Design 5 (type-checked against antd 5, React 19).
// Copy into your app, e.g. src/condition-ui.tsx, then wrap pages with <AxcUIProvider components={antdControls}>.
import { useState } from 'react';
import { Button, Checkbox, DatePicker, Input, InputNumber, Select, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import type { AxcTagsProps, AxcUIComponents } from '@axc/uikit/condition';

const DATE = 'YYYY-MM-DD';
const DATETIME = 'YYYY-MM-DDTHH:mm:ss';
// Only enabled options may be emitted; antd already blocks picking disabled ones.
const toOptions = (options: { value: string; label: string; disabled?: boolean }[]) => options;
// `invalid` / `describedBy` link the control to Axc's error text.
const aria = (p: { label: string; invalid?: boolean; describedBy?: string }) => ({
	'aria-label': p.label,
	'aria-invalid': p.invalid || undefined,
	'aria-describedby': p.describedBy,
});

/**
 * Free words. antd's Select mode="tags" commits the draft on blur, which the contract forbids,
 * so this is a small Input + Tag list: Enter commits (not during IME composition), a multi-line
 * paste adds one word per line, nothing splits on spaces or commas. Axc removes blanks and duplicates.
 */
function AntdTags(p: AxcTagsProps) {
	const [draft, setDraft] = useState('');
	const add = (words: string[]) => {
		p.onChange([...p.value, ...words]);
		setDraft('');
	};
	return (
		<div className={p.className} role="group" aria-label={p.label}>
			<Space wrap size={4}>
				{p.value.map((word) => (
					<Tag key={word} closable={!p.disabled} onClose={() => p.onChange(p.value.filter((item) => item !== word))}>
						{word}
					</Tag>
				))}
			</Space>
			<Input
				{...aria(p)}
				status={p.invalid ? 'error' : undefined}
				disabled={p.disabled}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onPressEnter={(event) => {
					if (!event.nativeEvent.isComposing) add([draft]);
				}}
				onPaste={(event) => {
					const text = event.clipboardData.getData('text/plain');
					if (!/[\r\n]/.test(text)) return;
					event.preventDefault();
					add(text.split(/\r\n|\r|\n/));
				}}
			/>
		</div>
	);
}

export const antdControls: AxcUIComponents = {
	Button: (p) => (
		<Button
			htmlType="button" // never submit a surrounding form
			className={p.className}
			aria-label={p.label}
			disabled={p.disabled}
			danger={p.tone === 'danger'}
			onClick={p.onClick}
		>
			{p.children}
		</Button>
	),
	Input: (p) =>
		p.type === 'number' ? (
			// Axc parses the string itself; stringMode keeps the raw draft (no rounding, '' when cleared).
			<InputNumber<string>
				stringMode
				className={p.className}
				{...aria(p)}
				status={p.invalid ? 'error' : undefined}
				disabled={p.disabled}
				placeholder={p.placeholder}
				value={p.value === '' ? null : p.value}
				onChange={(value) => p.onChange(value ?? '')}
			/>
		) : (
			<Input
				className={p.className}
				{...aria(p)}
				status={p.invalid ? 'error' : undefined}
				disabled={p.disabled}
				placeholder={p.placeholder}
				value={p.value}
				onChange={(event) => p.onChange(event.target.value)}
			/>
		),
	TextArea: (p) => (
		<Input.TextArea
			className={p.className}
			{...aria(p)}
			status={p.invalid ? 'error' : undefined}
			disabled={p.disabled}
			rows={p.rows}
			placeholder={p.placeholder}
			value={p.value}
			onChange={(event) => p.onChange(event.target.value)}
		/>
	),
	Select: (p) => (
		<Select<string>
			className={p.className}
			{...aria(p)}
			status={p.invalid ? 'error' : undefined}
			disabled={p.disabled}
			showSearch={p.searchable}
			optionFilterProp="label"
			allowClear={false} // "nothing selected" is an explicit '' option when Axc allows it
			options={toOptions(p.options)}
			value={p.value}
			onChange={p.onChange}
		/>
	),
	MultiSelect: (p) => (
		<Select<string[]>
			mode="multiple"
			className={p.className}
			{...aria(p)}
			status={p.invalid ? 'error' : undefined}
			disabled={p.disabled}
			showSearch={p.searchable}
			optionFilterProp="label"
			options={toOptions(p.options)}
			value={p.value}
			onChange={p.onChange}
		/>
	),
	Checkbox: (p) => (
		<Checkbox
			className={p.className}
			aria-invalid={p.invalid || undefined}
			aria-describedby={p.describedBy}
			disabled={p.disabled}
			checked={p.checked}
			onChange={(event) => p.onChange(event.target.checked)}
		>
			{p.label}
		</Checkbox>
	),
	Tags: AntdTags,
	DateInput: (p) => {
		const format = p.kind === 'date' ? DATE : DATETIME;
		return (
			<DatePicker
				className={p.className}
				{...aria(p)}
				status={p.invalid ? 'error' : undefined}
				disabled={p.disabled}
				showTime={p.kind === 'datetime'}
				value={p.value ? dayjs(p.value, format) : null}
				// Local wall-clock string; Axc converts datetimes to UTC ISO for the protocol.
				onChange={(value) => p.onChange(value ? value.format(format) : '')}
			/>
		);
	},
};
