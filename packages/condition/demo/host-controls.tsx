import type { AxcUIComponents, AxcButtonProps } from '../src/index.js';

/** Demonstrates control injection only; this is not a third-party UI library adapter. */
function ProjectButton({ label, children, disabled, tone, onClick, className }: AxcButtonProps) {
	return (
		<button
			type="button"
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			className={`demo-host-button ${className ?? ''}`}
			data-tone={tone}
		>
			{children}
		</button>
	);
}
export const hostControls = { Button: ProjectButton } satisfies Partial<AxcUIComponents>;
