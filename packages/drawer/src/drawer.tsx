import { useId, useLayoutEffect, useRef, type ReactNode, type MouseEvent } from 'react';
import { en } from './core/locales/index.js';
import { CloseButton } from './ui/controls.js';

export type DrawerSize = 'small' | 'medium' | 'large' | 'full';
export interface DrawerProps {
	open: boolean;
	size: DrawerSize;
	title: ReactNode;
	children: ReactNode;
	headerActions?: ReactNode;
	footer?: ReactNode;
	className?: string;
	closeLabel?: string;
	onClose: () => void;
	afterClose?: () => void;
}
function outside(e: MouseEvent<HTMLDialogElement>) {
	if (e.target !== e.currentTarget) return false;
	const box = e.currentTarget.getBoundingClientRect();
	return e.clientX < box.left || e.clientX >= box.right || e.clientY < box.top || e.clientY >= box.bottom;
}
/** Display a controlled right-side modal. Closing requests go to onClose; afterClose runs after an accepted exit.
 * A title labels the dialog. An unknown size throws TypeError. */
export function Drawer({
	open,
	size,
	title,
	children,
	headerActions,
	footer,
	className,
	closeLabel = en.close,
	onClose,
	afterClose,
}: DrawerProps) {
	if (!['small', 'medium', 'large', 'full'].includes(size)) throw new TypeError('Unknown Drawer size: ' + size);
	const id = useId();
	const dialog = useRef<HTMLDialogElement>(null);
	const backdropPress = useRef(false);
	const finished = useRef(afterClose);
	useLayoutEffect(() => {
		finished.current = afterClose;
	}, [afterClose]);
	useLayoutEffect(() => {
		const el = dialog.current!;
		return () => {
			if (el.open) el.close();
		};
	}, []);
	useLayoutEffect(() => {
		const el = dialog.current!;
		el.inert = !open;
		if (open) {
			if (!el.open) el.showModal();
			return;
		}
		if (!el.open) return;
		const close = () => {
			el.close();
			finished.current?.();
		};
		const slide = el.getAnimations().find((a) => 'transitionProperty' in a && a.transitionProperty === 'transform');
		if (!slide) {
			close();
			return;
		}
		slide.addEventListener('finish', close);
		slide.addEventListener('cancel', close);
		return () => {
			slide.removeEventListener('finish', close);
			slide.removeEventListener('cancel', close);
		};
	}, [open]);
	return (
		<dialog
			ref={dialog}
			aria-labelledby={id}
			className={['axc-drawer', className].filter(Boolean).join(' ')}
			data-size={size}
			data-closing={!open || undefined}
			onCancel={(e) => {
				e.preventDefault();
				e.stopPropagation();
				if (open) onClose();
			}}
			onPointerDown={(e) => {
				backdropPress.current = outside(e);
			}}
			onClick={(e) => {
				if (open && backdropPress.current && outside(e)) onClose();
				backdropPress.current = false;
			}}
		>
			<header className="axc-drawer-header">
				<div className="axc-drawer-title" id={id} title={typeof title === 'string' ? title : undefined}>
					{title}
				</div>
				{headerActions && <div className="axc-drawer-header-actions">{headerActions}</div>}
				<CloseButton label={closeLabel} onClick={onClose} />
			</header>
			<div className="axc-drawer-body">{children}</div>
			{footer != null && typeof footer !== 'boolean' && <footer className="axc-drawer-footer">{footer}</footer>}
		</dialog>
	);
}
