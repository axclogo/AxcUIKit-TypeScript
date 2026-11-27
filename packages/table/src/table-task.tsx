import { useState } from 'react';
import { useTableUI } from './ui/provider.js';

export function useTableTask() {
	const { onActionError } = useTableUI();
	const [busy, setBusy] = useState(false);
	const run = async (task: () => void | Promise<void>) => {
		try {
			const result = task();
			if (result) {
				setBusy(true);
				await result;
			}
		} catch (error) {
			if (!onActionError) throw error;
			onActionError(error);
		} finally {
			setBusy(false);
		}
	};
	return { busy, run };
}

export function RefreshButton({ onRefresh, loading }: { onRefresh: () => void | Promise<void>; loading?: boolean }) {
	const {
		controls: { Button },
		locale,
	} = useTableUI();
	const { busy, run } = useTableTask();
	return (
		<Button label={locale.refresh} disabled={busy || loading} onClick={() => void run(onRefresh)}>
			{locale.refresh}
		</Button>
	);
}
