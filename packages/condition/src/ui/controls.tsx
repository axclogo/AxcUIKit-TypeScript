import type { ComponentType } from 'react';
import type { AxcUIComponents } from './types.js';
import { DefaultModelSelect } from './DefaultModelSelect.js';
import { useAxcComponents } from './provider.js';

/**
 * The only way code outside src/ui renders a basic control: looks up the active adapter and
 * adds a stable layout class (`axc-<name>`) in front of any caller class.
 */
function dispatch<P extends { className?: string }>(
	pick: (components: AxcUIComponents) => ComponentType<P>,
	base: string,
) {
	return function Control(props: P) {
		const Adapter = pick(useAxcComponents());
		return <Adapter {...props} className={[base, props.className].filter(Boolean).join(' ')} />;
	};
}

export const Button = dispatch((c) => c.Button, 'axc-button');
export const Input = dispatch((c) => c.Input, 'axc-input');
export const TextArea = dispatch((c) => c.TextArea, 'axc-textarea');
export const Select = dispatch((c) => c.Select, 'axc-select');
export const MultiSelect = dispatch((c) => c.MultiSelect, 'axc-select');
export const Checkbox = dispatch((c) => c.Checkbox, 'axc-checkbox');
export const Tags = dispatch((c) => c.Tags, 'axc-tags');
export const DateInput = dispatch((c) => c.DateInput, 'axc-date-input');

export const ModelSelect = dispatch((c) => c.ModelSelect ?? DefaultModelSelect, 'axc-select');
