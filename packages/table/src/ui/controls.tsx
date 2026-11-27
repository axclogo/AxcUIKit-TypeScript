import { useId, useState, useRef, useLayoutEffect } from 'react';
import type { Locale } from '../core/index.js';
import type { AnalysisConfig, TableControls } from '../types.js';

const Tooltip: TableControls['Tooltip'] = ({ children, content }) => {
	const [open, setOpen] = useState(false);
	const id = useId();
	return (
		<span
			className="axc-table-tooltip"
			tabIndex={0}
			aria-describedby={open ? id : undefined}
			onFocus={() => setOpen(true)}
			onBlur={() => setOpen(false)}
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
		>
			{children}
			{open && (
				<span id={id} role="tooltip">
					{content}
				</span>
			)}
		</span>
	);
};
const Modal: TableControls['Modal'] = ({ title, children, onClose }) => {
	const ref = useRef<HTMLDialogElement>(null);
	const id = useId();
	useLayoutEffect(() => {
		const dialog = ref.current!;
		dialog.showModal();
		return () => dialog.close();
	}, []);
	return (
		<dialog
			ref={ref}
			aria-labelledby={id}
			className="axc-table-backdrop"
			data-interactive=""
			onCancel={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onClose();
			}}
		>
			<section>
				<header id={id}>{title}</header>
				{children}
			</section>
		</dialog>
	);
};
export const nativeControls: Omit<TableControls, 'Pagination'> = {
	Input: ({ value, onChange, label, disabled, type }) => (
		<input
			type={type}
			aria-label={label}
			placeholder={label}
			disabled={disabled}
			value={value}
			onChange={(e) => onChange(e.target.value)}
		/>
	),
	NumberInput: ({ value, onChange, label, disabled }) => (
		<input
			type="number"
			aria-label={label}
			disabled={disabled}
			value={value ?? ''}
			onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
		/>
	),
	Checkbox: ({ value, onChange, label, disabled, indeterminate }) => (
		<input
			type="checkbox"
			aria-label={label}
			disabled={disabled}
			checked={value}
			ref={(el) => {
				if (el) el.indeterminate = !!indeterminate;
			}}
			onChange={(e) => onChange(e.target.checked)}
		/>
	),
	Select: ({ value, options, onChange, label, disabled, clearable }) => (
		<select
			aria-label={label}
			disabled={disabled}
			value={options.findIndex((o) => o.value === value)}
			onChange={(e) => {
				const index = e.currentTarget.selectedIndex;
				onChange(index === 0 ? undefined : options[index - 1].value);
			}}
		>
			<option value={-1} disabled={!clearable}>
				{label}
			</option>
			{options.map((o, i) => (
				<option value={i} disabled={o.disabled} key={i}>
					{o.label}
				</option>
			))}
		</select>
	),
	MultiSelect: ({ value, options, onChange, label, disabled }) => (
		<select
			multiple
			aria-label={label}
			disabled={disabled}
			value={options.flatMap((o, i) => (value.includes(o.value) ? [String(i)] : []))}
			onChange={(e) => onChange(Array.from(e.target.selectedOptions, (o) => options[Number(o.value)].value))}
		>
			{options.map((o, i) => (
				<option value={i} disabled={o.disabled} key={i}>
					{o.label}
				</option>
			))}
		</select>
	),
	Button: ({ label, onClick, disabled, children }) => (
		<button type="button" aria-label={label} onClick={onClick} disabled={disabled}>
			{children}
		</button>
	),
	Tooltip,
	Empty: ({ children }) => <div className="axc-table-empty">{children}</div>,
	Loading: ({ label }) => <div role="status">{label}</div>,
	Modal,
};
export function DragHandle({
	label,
	...props
}: {
	label: string;
	disabled?: boolean;
	onPointerDown: React.PointerEventHandler<HTMLButtonElement>;
}) {
	return (
		<button type="button" aria-label={label} className="axc-table-handle" {...props}>
			⠿
		</button>
	);
}

export function ColumnGrip({
	label,
	...events
}: {
	label: string;
	disabled: boolean;
	onDragStart: React.DragEventHandler<HTMLButtonElement>;
	onDragEnd: React.DragEventHandler<HTMLButtonElement>;
	onKeyDown: React.KeyboardEventHandler<HTMLButtonElement>;
}) {
	return (
		<button
			type="button"
			draggable={!events.disabled}
			className="axc-table-column-grip"
			title={label}
			aria-label={label}
			aria-keyshortcuts="ArrowUp ArrowDown"
			{...events}
		>
			<svg aria-hidden="true" width="16" height="20" viewBox="0 0 16 20" fill="currentColor">
				{[5, 10, 15].map((y) => (
					<g key={y}>
						<circle cx="5" cy={y} r="1.4" />
						<circle cx="11" cy={y} r="1.4" />
					</g>
				))}
			</svg>
		</button>
	);
}

export function VisibilityIcon({ visible }: { visible: boolean }) {
	return (
		<svg
			aria-hidden="true"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{visible ? (
				<>
					<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
					<circle cx="12" cy="12" r="3" />
				</>
			) : (
				<>
					<path d="m3 3 18 18M9.5 5.4A12 12 0 0 1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3 3.9M6.4 6.5A21 21 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 5-1.2M10 10a3 3 0 0 0 4 4" />
				</>
			)}
		</svg>
	);
}

type RuleColor = AnalysisConfig['colorRules'][number]['color'];
const ruleColors: readonly RuleColor[] = ['red', 'orange', 'green', 'blue', 'grey'];
export function ColorPicker({
	value,
	onChange,
	locale,
}: {
	value: RuleColor;
	onChange: (color: RuleColor) => void;
	locale: Locale;
}) {
	const name = useId();
	return (
		<fieldset className="axc-table-palette">
			<legend>{locale.color}</legend>
			{ruleColors.map((color) => (
				<label key={color} title={locale[color]}>
					<input
						type="radio"
						name={name}
						aria-label={locale[color]}
						checked={value === color}
						onChange={() => onChange(color)}
					/>
					<span className="axc-table-swatch" data-color={color} aria-hidden="true" />
				</label>
			))}
		</fieldset>
	);
}
