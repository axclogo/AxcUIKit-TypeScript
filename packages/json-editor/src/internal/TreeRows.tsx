import { useId } from 'react';
import type { JsonField, JsonValueType } from '../core/index.js';
import { useJsonEditorContext } from '../ui/provider.js';
import { declaredType, hasOptions, newFieldValue, ValueEditor, type Editability } from './ValueEditor.js';
import { duplicates, initialValue, newNode, toDraft, type Node } from './tree.js';

const types: readonly JsonValueType[] = ['string', 'number', 'boolean', 'null', 'object', 'array'];

type Replace = (node: Node | undefined, onlyExpansion?: boolean) => void;

interface RowProps {
	node: Node;
	access: Editability;
	onReplace: Replace;
	duplicate?: boolean;
	index?: number;
	field?: JsonField;
	fieldPresent?: boolean;
	form?: boolean;
}

export function TreeRow({ node, access, onReplace, duplicate, index, field, fieldPresent, form }: RowProps) {
	const {
		slots: { Input, Select, Button },
		locale,
	} = useJsonEditorContext();
	const issueId = useId();
	const descriptionId = useId();
	const label = field?.label ?? field?.name ?? (index === undefined ? node.key || locale.value : String(index + 1));
	const missingKey = node.key === undefined && node.origin !== undefined && index === undefined;
	const keyIssue = duplicate ? locale.duplicateKey : missingKey ? locale.missingKey : undefined;
	const present = fieldPresent ?? true;
	const { draft } = node;
	const container = draft.type === 'array' || draft.type === 'object' ? draft : undefined;
	const canToggle = present && container && !hasOptions(field, draft, present);
	const canChooseType = !field || (present && draft.type !== declaredType(field));
	const replace = (patch: Partial<Node>) => {
		onReplace({ ...node, ...patch });
	};

	return (
		<div className={form ? 'axc-json-row axc-json-field' : 'axc-json-row'}>
			<div className="axc-json-row-controls">
				{field ? (
					<span className="axc-json-field-name">
						{label}
						{field.required && (
							<span className="axc-json-required" aria-label={locale.required}>
								{' *'}
							</span>
						)}
					</span>
				) : index === undefined ? (
					<div className="axc-json-key">
						<Input
							{...access}
							label={locale.key}
							describedBy={keyIssue ? issueId : undefined}
							value={node.key ?? ''}
							invalid={Boolean(keyIssue)}
							onChange={(key) => replace({ key: key === '' ? undefined : key })}
						/>
						{keyIssue && (
							<span className="axc-json-error" id={issueId} role="alert">
								{keyIssue}
							</span>
						)}
					</div>
				) : (
					<span className="axc-json-index">{label}</span>
				)}
				{canChooseType && (
					<Select
						{...access}
						label={locale.type + ' · ' + label}
						value={draft.type}
						options={types.map((type) => ({ value: type, label: locale.types[type] }))}
						onChange={(type) => {
							const nextType = type as JsonValueType;
							if (nextType !== draft.type) replace({ draft: toDraft(initialValue(nextType)), expanded: true });
						}}
					/>
				)}
				<ValueEditor
					node={node}
					field={field}
					present={present}
					label={label}
					describedBy={field?.description ? descriptionId : undefined}
					access={access}
					onDraft={(next) => replace({ draft: next })}
					onRemove={() => {
						onReplace(undefined);
					}}
				/>
				{canToggle && (
					<Button
						label={(node.expanded ? locale.collapse : locale.expand) + ' · ' + label}
						expanded={node.expanded}
						disabled={access.disabled}
						onClick={() => {
							onReplace({ ...node, expanded: !node.expanded }, true);
						}}
					/>
				)}
				{!access.readOnly &&
					(present ? (
						<Button
							label={locale.remove + ' · ' + label}
							disabled={access.disabled}
							onClick={() => {
								onReplace(undefined);
							}}
						/>
					) : (
						field && (
							<Button
								label={locale.add + ' · ' + label}
								disabled={access.disabled}
								onClick={() => replace({ draft: toDraft(newFieldValue(field)) })}
							/>
						)
					))}
			</div>
			{field?.description && (
				<div className="axc-json-description" id={descriptionId}>
					{field.description}
				</div>
			)}
			{container && canToggle && node.expanded && (
				<TreeRows
					nodes={container.children}
					access={access}
					array={container.type === 'array'}
					scope={label}
					onChange={(children) => replace({ draft: { ...container, children } })}
					onExpand={(children) => onReplace({ ...node, draft: { ...container, children } }, true)}
				/>
			)}
		</div>
	);
}

export function TreeRows({
	nodes,
	access,
	array,
	scope,
	onChange,
	onExpand,
	repeated = duplicates(nodes),
}: {
	nodes: Node[];
	access: Editability;
	array?: boolean;
	scope: string;
	onChange: (nodes: Node[]) => void;
	onExpand: (nodes: Node[]) => void;
	repeated?: ReadonlySet<string>;
}) {
	const {
		slots: { Button },
		locale,
	} = useJsonEditorContext();
	return (
		<div className="axc-json-children">
			{nodes.map((node, index) => (
				<TreeRow
					key={node.id}
					node={node}
					access={access}
					index={array ? index : undefined}
					duplicate={!array && node.key !== undefined && repeated.has(node.key)}
					onReplace={(updated, onlyExpansion) => {
						const next = nodes.flatMap((item) => (item.id === node.id ? (updated ? [updated] : []) : [item]));
						if (onlyExpansion) onExpand(next);
						else onChange(next);
					}}
				/>
			))}
			{!access.readOnly && (
				<Button
					label={locale.add + ' · ' + scope}
					disabled={access.disabled}
					onClick={() => {
						onChange([...nodes, newNode(array ? String(nodes.length) : undefined)]);
					}}
				/>
			)}
		</div>
	);
}
