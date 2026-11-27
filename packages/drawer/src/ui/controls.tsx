export function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button type="button" className="axc-drawer-close" aria-label={label} onClick={onClick}>
			<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
				<path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
			</svg>
		</button>
	);
}
