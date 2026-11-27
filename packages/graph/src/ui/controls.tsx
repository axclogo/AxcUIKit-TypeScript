import type { ReactNode } from 'react';
export function PanelToggle({
	children,
	expanded,
	onClick,
}: {
	children: ReactNode;
	expanded: boolean;
	onClick: () => void;
}) {
	return (
		<button type="button" aria-expanded={expanded} onClick={onClick}>
			{children}
		</button>
	);
}
export function GraphButton({
	children,
	onClick,
	disabled,
}: {
	children: ReactNode;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button type="button" onClick={onClick} disabled={disabled}>
			{children}
		</button>
	);
}
export function GraphSearch({
	label,
	value,
	onChange,
	onSubmit,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	onSubmit: () => void;
}) {
	return (
		<input
			aria-label={label}
			placeholder={label}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === 'Enter') onSubmit();
			}}
		/>
	);
}
export function GraphSwitch({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<label>
			<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			{label}
		</label>
	);
}
