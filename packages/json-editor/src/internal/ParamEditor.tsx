import { useEffect, useState } from 'react';
import type { JsonValue } from '../core/index.js';
import type { ParamObjectEditorProps } from '../ParamObjectEditor.js';
import { useJsonEditorContext } from '../ui/provider.js';
import { TreeRow } from './TreeRows.js';
import { commit, equal, reconcileNode, validDraft, type Node } from './tree.js';

interface State {
	received: JsonValue;
	committed: JsonValue;
	node: Node;
}

export function ParamEditor({
	value,
	onChange,
	rootField: field,
	schemaMode = 'form',
	allowExtraParams,
	emptyLabel,
	extraLabel,
	disabledKeys,
	onDisabledKeysChange,
	readOnly,
	disabled,
	className,
	onDraftValidityChange,
}: Omit<ParamObjectEditorProps, 'fields'> & { onDraftValidityChange?: (valid: boolean) => void }) {
	const { locale } = useJsonEditorContext();
	const [stored, setStored] = useState<State>(() => ({
		received: value,
		committed: value,
		node: reconcileNode(undefined, '', value),
	}));
	let state = stored;
	if (!Object.is(value, stored.received)) {
		state = equal(stored.committed, value)
			? { ...stored, received: value }
			: { received: value, committed: value, node: reconcileNode(stored.node, '', value) };
		setStored(state);
	}
	useEffect(() => {
		onDraftValidityChange?.(validDraft(state.node.draft));
	}, [onDraftValidityChange, state.node]);
	const update = (node: Node) => {
		const next = commit(node);
		if (!next || equal(state.committed, next.value)) {
			setStored({ ...state, node });
			return;
		}
		setStored({ ...state, committed: next.value, node: next.node });
		onChange(next.value);
	};
	return (
		<div className={className ? 'axc-json ' + className : 'axc-json'}>
			<TreeRow
				node={state.node}
				root
				path={[]}
				field={field}
				access={{ readOnly, disabled }}
				form={schemaMode === 'form'}
				objectSettings={{
					allowExtraParams,
					scope: field?.fields?.length ? (extraLabel ?? locale.extra) : (emptyLabel ?? locale.empty),
					disabledKeys,
					onDisabledKeysChange,
				}}
				onReplace={(node, onlyExpansion) => {
					if (onlyExpansion) setStored({ ...state, node });
					else update(node);
				}}
			/>
		</div>
	);
}
