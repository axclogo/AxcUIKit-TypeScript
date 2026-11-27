import { useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { ColumnGrip, VisibilityIcon } from './ui/controls.js';
import { useTableUI } from './ui/provider.js';

type Column = { key: string; title?: ReactNode; fixed?: 'left' | 'right' };
type Drop = { key: string; after: boolean };

export function ColumnSettings({
	columns,
	visible,
	onToggle,
	onOrder,
	onPin,
}: {
	columns: readonly Column[];
	visible: readonly string[];
	onToggle: (key: string) => void;
	onOrder: (order: string[]) => void;
	onPin: (key: string, side: 'left' | 'right' | undefined) => void;
}) {
	const {
		locale,
		controls: { Button, Select },
	} = useTableUI();
	const [source, setSource] = useState<string>();
	const [drop, setDrop] = useState<Drop>();
	const focus = useRef<HTMLButtonElement | null>(null);
	useLayoutEffect(() => {
		focus.current?.focus();
		focus.current = null;
	}, [columns]);
	function move(from: number, to: number, handle?: HTMLButtonElement) {
		const keys = columns.map((column) => column.key);

		if (from < 0 || to < 0 || to >= keys.length || from === to) return;
		const [key] = keys.splice(from, 1);
		keys.splice(to, 0, key);
		focus.current = handle ?? null;
		onOrder(keys);
	}
	function end() {
		setSource(undefined);
		setDrop(undefined);
	}
	function placement(event: DragEvent<HTMLLIElement>) {
		const rect = event.currentTarget.getBoundingClientRect();
		return event.clientY >= rect.top + rect.height / 2;
	}
	return (
		<ol
			className="axc-table-column-list"
			aria-label={locale.columns}
			onDragLeave={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrop(undefined);
			}}
		>
			{columns.map(({ key, title, fixed }, index) => {
				const shown = visible.includes(key);
				const name = typeof title === 'string' ? title : key;
				const visibility = (shown ? locale.hideColumn : locale.showColumn) + ' ' + name;
				return (
					<li
						key={key}
						data-shown={shown}
						data-dragging={source === key || undefined}
						data-drop={drop?.key === key && key !== source ? (drop.after ? 'after' : 'before') : undefined}
						onDragOver={(event) => {
							if (source === undefined) return;
							event.preventDefault();
							event.dataTransfer.dropEffect = 'move';
							setDrop({ key, after: placement(event) });
						}}
						onDrop={(event) => {
							if (source === undefined) return;
							event.preventDefault();
							if (source !== key) {
								const from = columns.findIndex((c) => c.key === source);
								move(from, index + Number(placement(event)) - Number(from < index));
							}
							end();
						}}
					>
						<ColumnGrip
							label={locale.moveColumn + ' ' + name}
							disabled={columns.length === 1}
							onDragStart={(event) => {
								event.dataTransfer.effectAllowed = 'move';
								event.dataTransfer.setData('application/x-axc-table-column', key);
								event.dataTransfer.setDragImage(event.currentTarget.closest('li')!, 14, 14);
								setSource(key);
							}}
							onDragEnd={end}
							onKeyDown={(event) => {
								if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
								event.preventDefault();
								move(index, index + (event.key === 'ArrowUp' ? -1 : 1), event.currentTarget);
							}}
						/>
						<span className="axc-table-column-name">{title ?? key}</span>
						<Select
							label={locale.fixed + ' ' + name}
							value={fixed || ''}
							options={[
								{ value: '', label: locale.clear },
								{ value: 'left', label: locale.left },
								{ value: 'right', label: locale.right },
							]}
							onChange={(v) => onPin(key, v === '' ? undefined : (v as 'left' | 'right'))}
						/>
						<span className="axc-table-column-eye" title={visibility}>
							<Button label={visibility} disabled={shown && visible.length === 1} onClick={() => onToggle(key)}>
								<VisibilityIcon visible={shown} />
							</Button>
						</span>
					</li>
				);
			})}
		</ol>
	);
}
