import { ActionLayout } from './action-layout.js';
import { useTableTask } from './table-task.js';
import { useState, type ReactNode } from 'react';
import type { ActionContent, TableAction, TableBatchContext } from './types.js';
import { useTableUI } from './ui/provider.js';

function content<T>(part: ActionContent<T>, item: T) {
	return typeof part === 'function' ? part(item) : part;
}
function ActionButton<T>({ action, item }: { action: TableAction<T>; item: T }) {
	const {
		controls: { Button, Modal },
		confirm,
		locale,
	} = useTableUI();
	const { busy, run } = useTableTask();
	const [request, setRequest] = useState<{
		title: ReactNode;
		message: ReactNode;
		execute: () => void | Promise<void>;
	}>();
	const label = content(action.label, item);
	const activate = () => {
		const execute = () => action.onClick(item);
		if (action.confirm === undefined) return execute();
		const title = content(action.confirmTitle, item),
			message = content(action.confirm, item);
		if (!confirm) {
			setRequest({ title, message, execute });
			return;
		}
		return Promise.resolve(confirm({ title, message })).then((approved) => {
			if (approved) return execute();
		});
	};
	return (
		<>
			<span data-tone={action.type}>
				<Button
					label={typeof label === 'string' ? label : action.key}
					disabled={busy || (typeof action.disabled === 'function' ? action.disabled(item) : action.disabled)}
					onClick={() => void run(activate)}
				>
					{content(action.icon, item)}
					{label}
				</Button>
			</span>
			{request && (
				<Modal title={request.title ?? locale.confirm} onClose={() => setRequest(undefined)}>
					<p>{request.message}</p>
					<Button label={locale.cancel} onClick={() => setRequest(undefined)}>
						{locale.cancel}
					</Button>
					<Button
						label={locale.confirm}
						onClick={() => {
							setRequest(undefined);
							void run(request.execute);
						}}
					>
						{locale.confirm}
					</Button>
				</Modal>
			)}
		</>
	);
}
export function ActionButtons<T>({
	actions,
	item,
	column,
}: {
	actions: readonly TableAction<T>[];
	item: T;
	column?: string;
}) {
	return (
		<ActionLayout column={column}>
			{actions
				.filter((a) => !a.visible || a.visible(item))
				.map((action) => (
					<ActionButton key={action.key} action={action} item={item} />
				))}
		</ActionLayout>
	);
}
export function mapRowAction<Row, Item>(a: TableAction<Row>, unwrap: (item: Item) => Row): TableAction<Item> {
	const { disabled } = a;
	return {
		key: a.key,
		type: a.type,
		label: (i) => content(a.label, unwrap(i)),
		icon: (i) => content(a.icon, unwrap(i)),
		confirm: a.confirm === undefined ? undefined : (i) => content(a.confirm, unwrap(i)),
		confirmTitle: (i) => content(a.confirmTitle, unwrap(i)),
		visible: a.visible ? (i) => a.visible!(unwrap(i)) : undefined,
		disabled: typeof disabled === 'function' ? (i) => disabled(unwrap(i)) : disabled,
		onClick: (i) => a.onClick(unwrap(i)),
	};
}

export function BatchBar<Row>({
	actions,
	context,
}: {
	actions?: readonly TableAction<TableBatchContext<Row>>[];
	context: TableBatchContext<Row>;
}) {
	const {
		controls: { Button },
		locale,
		onActionError,
	} = useTableUI();
	if (actions?.length && !onActionError) throw new TypeError('batchActions require onActionError');
	return actions?.length && context.selectedCount ? (
		<div className="axc-table-batch">
			<span>{context.selectedCount}</span>
			<Button label={locale.clear} onClick={context.clearSelection}>
				{locale.clear}
			</Button>
			<ActionButtons actions={actions} item={context} />
		</div>
	) : null;
}
