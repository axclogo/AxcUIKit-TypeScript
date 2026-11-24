import type { ComponentType, ReactNode } from 'react';
import type { AxcModelOption, ConditionOption } from '../core/types.js';

/**
 * Contract shared by every control. An adapter must:
 * - use `label` as the accessible name (`aria-label` or a visible `<label>`);
 * - put `className` on its root element (Axc uses it for layout);
 * - when `disabled`, never call `onChange` / `onClick`;
 * - when `invalid`, mark the control invalid (`aria-invalid`) and point `aria-describedby` at `describedBy`,
 *   the id of the element where Axc renders the error text.
 *
 * Controls have no `readOnly` prop: a read-only Axc editor passes `disabled` and hides
 * structural buttons. Callbacks receive values, never DOM or UI-library events.
 */
export interface AxcControlProps {
	label: string;
	disabled?: boolean;
	className?: string;
	/** The current value has a validation issue. */
	invalid?: boolean;
	/** Id of the element describing the issue. Set whenever `invalid` is true. */
	describedBy?: string;
}

/** Single-line text. Value is the raw string draft (also for `type="number"`); cleared is `''`. Axc parses numbers. */
export interface AxcInputProps extends AxcControlProps {
	value: string;
	onChange: (value: string) => void;
	type?: 'text' | 'number';
	placeholder?: string;
}

/** Multi-line text. Cleared is `''`. */
export interface AxcTextAreaProps extends AxcControlProps {
	value: string;
	onChange: (value: string) => void;
	rows?: number;
	placeholder?: string;
}

/**
 * Single choice. `onChange` must only emit a `value` from `options` that is not disabled.
 * There is no clear action; "nothing selected" is an explicit `''` option when Axc offers one.
 */
export interface AxcSelectProps extends AxcControlProps {
	value: string;
	options: ConditionOption[];
	onChange: (value: string) => void;
	/** Let the user filter options by label. */
	searchable?: boolean;
}

/** Model picker. Keep model ids opaque; emit a listed id or null when cleared.
 * Receives the original provider metadata for grouped or cascading host controls.
 */
export interface AxcModelSelectProps extends AxcControlProps {
	models: AxcModelOption[];
	value: string | null;
	onChange: (value: string | null) => void;
}

/** Multiple choice. Emits values from enabled `options` only; cleared is `[]`. */
export interface AxcMultiSelectProps extends AxcControlProps {
	value: string[];
	options: ConditionOption[];
	onChange: (value: string[]) => void;
	searchable?: boolean;
}

/** A checkbox or switch. `label` is also its visible text. */
export interface AxcCheckboxProps extends AxcControlProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
}

/**
 * A button. It must not submit a surrounding form (render `type="button"`).
 * `children` is the visible content; `label`, when set, is the accessible name.
 */
export interface AxcButtonProps {
	children: ReactNode;
	label?: string;
	disabled?: boolean;
	className?: string;
	tone?: 'default' | 'danger';
	onClick: () => void;
}

/**
 * A list of free-text words. Each word is one whole string: Enter commits the draft (but not during
 * IME composition), a multi-line paste adds one word per line, and nothing splits on spaces or commas.
 * Do not commit on blur. Axc removes duplicates and blank words. Cleared is `[]`.
 */
export interface AxcTagsProps extends AxcControlProps {
	value: string[];
	onChange: (value: string[]) => void;
}

/**
 * Date or local wall-clock datetime. `date`: `YYYY-MM-DD`; `datetime`: `YYYY-MM-DDTHH:mm:ss` without
 * a zone. Cleared is `''`. Convert to and from your library's Date/dayjs objects inside the adapter;
 * Axc converts local time to UTC ISO strings for the protocol.
 */
export interface AxcDateInputProps extends AxcControlProps {
	value: string;
	kind: 'date' | 'datetime';
	onChange: (value: string) => void;
}

/**
 * The full set of basic controls. Axc renders every input, select, textarea and button through
 * these, so swapping them restyles all four components. Define adapters at module level: a
 * component created during render remounts on every render and loses focus and drafts.
 */
export interface AxcUIComponents {
	/** Optional model-specific control; when omitted, models use the configured Select. */
	ModelSelect?: ComponentType<AxcModelSelectProps>;
	Button: ComponentType<AxcButtonProps>;
	Input: ComponentType<AxcInputProps>;
	TextArea: ComponentType<AxcTextAreaProps>;
	Select: ComponentType<AxcSelectProps>;
	MultiSelect: ComponentType<AxcMultiSelectProps>;
	Checkbox: ComponentType<AxcCheckboxProps>;
	Tags: ComponentType<AxcTagsProps>;
	DateInput: ComponentType<AxcDateInputProps>;
}
