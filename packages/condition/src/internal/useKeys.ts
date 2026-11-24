import { useRef } from 'react';

/**
 * Stable React keys for a controlled list whose items carry no IDs (the protocol deliberately has none).
 * Edits made through `track` keep each key with its item, so deleting a middle row does not hand that
 * row's local state (search text, tag drafts) to its neighbour. If the host replaces the list some other
 * way, keys survive when the length is unchanged and are regenerated otherwise.
 */
export function useKeys(items: readonly unknown[]) {
	const state = useRef<{
		items: readonly unknown[];
		keys: number[];
		pending?: { items: readonly unknown[]; keys: number[] };
	}>(null);
	const counter = useRef(0);
	let current = state.current;
	if (!current || current.items !== items) {
		const pending = current?.pending;
		const keys =
			pending?.items === items
				? pending.keys
				: current?.keys.length === items.length
					? current.keys
					: items.map(() => counter.current++);
		current = state.current = { items, keys };
	}
	return {
		keys: current.keys,
		/** Records the keys for a list about to be emitted through `onChange`. */
		track: (next: readonly unknown[], keys: number[]) => {
			state.current!.pending = { items: next, keys };
		},
		fresh: () => counter.current++,
	};
}
