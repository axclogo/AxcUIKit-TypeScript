import { useEffect, useState } from 'react';
import type { JsonField, JsonObject } from './core/index.js';
import { TreeRow, TreeRows } from './internal/TreeRows.js';
import { declaredType } from './internal/ValueEditor.js';
import {
	commit,
	duplicates,
	equal,
	initialValue,
	newNode,
	reconcileObject,
	toDraft,
	validObject,
	type Node,
} from './internal/tree.js';
import { useJsonEditorContext } from './ui/provider.js';

export interface ParamObjectEditorProps {
	value: JsonObject;
	onChange: (value: JsonObject) => void;
	fields?: readonly JsonField[];
	schemaMode?: 'form' | 'rows';
	allowExtraParams?: boolean;
	emptyLabel?: string;
	extraLabel?: string;
	readOnly?: boolean;
	disabled?: boolean;
	className?: string;
}

interface State {
	received: JsonObject;
	committed: JsonObject;
	nodes: Node[];
}

/** Edits a JSON object as a tree. Only complete, valid changes are emitted. */
export function ParamObjectEditor(props: ParamObjectEditorProps) {
	return <ParamObjectEditorView {...props} />;
}

export function ParamObjectEditorView({
	value,
	onChange,
	fields = [],
	schemaMode = 'form',
	allowExtraParams = true,
	emptyLabel,
	extraLabel,
	readOnly,
	disabled,
	className,
	onDraftValidityChange,
}: ParamObjectEditorProps & { onDraftValidityChange?: (valid: boolean) => void }) {
	const { locale } = useJsonEditorContext();
	const [stored, setStored] = useState<State>(() => ({
		received: value,
		committed: value,
		nodes: reconcileObject([], value),
	}));
	let state = stored;
	if (value !== stored.received) {
		state = equal(stored.committed, value)
			? { ...stored, received: value }
			: { received: value, committed: value, nodes: reconcileObject(stored.nodes, value) };
		setStored(state);
	}

	useEffect(() => {
		onDraftValidityChange?.(validObject(state.nodes));
	}, [onDraftValidityChange, state.nodes]);

	const update = (nodes: Node[]) => {
		const next = commit(nodes);
		if (!next || equal(state.committed, next.value)) {
			setStored({ ...state, nodes });
			return;
		}
		setStored({ ...state, committed: next.value, nodes: next.nodes });
		onChange(next.value);
	};

	const grouped = new Map(fields.map((field) => [field.name, field]));
	if (grouped.size !== fields.length) throw new TypeError('JsonField names must be unique');

	const access = { readOnly, disabled };
	const fieldsByName = new Map<string, Node>();
	const extras: Node[] = [];
	for (const node of state.nodes) {
		const key = node.origin?.key ?? node.fieldName;
		if (key !== undefined && grouped.has(key)) fieldsByName.set(key, node);
		else extras.push(node);
	}
	const repeated = duplicates(state.nodes);
	const extraScope = fields.length ? (extraLabel ?? locale.extra) : (emptyLabel ?? locale.empty);

	return (
		<div className={className ? 'axc-json ' + className : 'axc-json'}>
			<div className="axc-json-fields">
				{fields.map((field) => {
					const current = fieldsByName.get(field.name);
					const row: Node = current ?? {
						id: 0,
						key: field.name,
						draft: toDraft(initialValue(declaredType(field))),
						expanded: true,
					};
					const replace = (updated: Node | undefined, onlyExpansion?: boolean) => {
						const nodes = current
							? state.nodes.flatMap((node) => (node === current ? (updated ? [updated] : []) : [node]))
							: updated
								? [...state.nodes, { ...updated, id: newNode(field.name).id, fieldName: field.name }]
								: state.nodes;
						if (onlyExpansion) {
							setStored({ ...state, nodes });
						} else {
							update(nodes);
						}
					};
					return (
						<TreeRow
							key={field.name}
							node={row}
							field={field}
							fieldPresent={current !== undefined}
							form={schemaMode === 'form'}
							access={access}
							onReplace={replace}
						/>
					);
				})}
			</div>
			{allowExtraParams && (
				<div className="axc-json-extra">
					{fields.length > 0 && schemaMode === 'form' && <div className="axc-json-extra-label">{extraScope}</div>}
					<TreeRows
						nodes={extras}
						access={access}
						scope={extraScope}
						repeated={repeated}
						onChange={(next) => update([...state.nodes.filter((node) => !extras.includes(node)), ...next])}
						onExpand={(next) =>
							setStored({ ...state, nodes: [...state.nodes.filter((node) => !extras.includes(node)), ...next] })
						}
					/>
				</div>
			)}
		</div>
	);
}
