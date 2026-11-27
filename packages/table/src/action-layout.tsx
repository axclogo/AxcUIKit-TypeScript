import { Children, Fragment, isValidElement, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
function items(children: ReactNode): ReactNode[] {
	return Children.toArray(children).flatMap((node) =>
		isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment ? items(node.props.children) : [node],
	);
}
export function ActionLayout({ column, children }: { column?: string; children: ReactNode }) {
	const actions = items(children);
	return (
		<span
			data-axc-action-column={column}
			className="axc-table-actions"
			style={{
				gridTemplateColumns:
					'repeat(' +
					Math.max(1, actions.length > 3 ? Math.ceil(actions.length / 2) : actions.length) +
					',max-content)',
			}}
		>
			{actions}
		</span>
	);
}
export function useActionWidths(root: RefObject<HTMLElement | null>, virtual: boolean) {
	const [widths, set] = useState<ReadonlyMap<string, number>>(() => new Map());
	useLayoutEffect(() => {
		const elements = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-axc-action-column]') ?? []);
		const measure = () => {
			const next = new Map(virtual ? widths : []);
			for (const el of elements) {
				const key = el.dataset.axcActionColumn!,
					width = el.getBoundingClientRect().width;
				if (width) next.set(key, Math.max(next.get(key) ?? 64, Math.ceil(width) + 16));
			}
			if (next.size !== widths.size || [...next].some(([k, w]) => widths.get(k) !== w)) set(next);
		};
		measure();
		if (!elements.length) return;
		const observer = new ResizeObserver(measure);
		elements.forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	});
	return widths;
}
