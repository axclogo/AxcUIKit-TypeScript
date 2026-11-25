import { useId } from 'react';
import type { JsonField, JsonFieldDefinition, JsonPath, JsonValueType } from '../core/index.js';
import { useJsonEditorContext } from '../ui/provider.js';
import { hasOptions, ValueEditor, type Editability } from './ValueEditor.js';
import { declaredType, duplicates, initialValue, newFieldValue, newNode, toDraft, type Node } from './tree.js';

const types: readonly JsonValueType[] = ['string', 'number', 'boolean', 'null', 'object', 'array'];

interface ObjectSettings {
	allowExtraParams?: boolean;
	scope: string;
	disabledKeys?: readonly string[];
	onDisabledKeysChange?: (keys: string[]) => void;
}

interface RowProps {
	node: Node;
	access: Editability;
	onReplace: (node: Node, onlyExpansion?: boolean) => void;
	onRemove?: () => void;
	duplicate?: boolean;
	index?: number;
	field?: JsonFieldDefinition;
	fieldName?: string;
	fieldPresent?: boolean;
	form?: boolean;
	root?: boolean;
	objectSettings?: ObjectSettings;
	path?: JsonPath;
	inactive?: boolean;
	onToggle?: () => void;
}

export function TreeRow({
	node,
	access,
	onReplace,
	onRemove,
	duplicate,
	index,
	field,
	fieldName,
	fieldPresent,
	form,
	root,
	objectSettings,
	path,
	inactive,
	onToggle,
}: RowProps) {
	const {
		slots: { Input, Select, Button },
		locale,
	} = useJsonEditorContext();
	const issueId = useId();
	const descriptionId = useId();
	const label =
		field?.label ??
		fieldName ??
		(root ? locale.value : index === undefined ? node.key || locale.value : String(index + 1));
	const missingKey = !root && node.key === undefined && node.origin !== undefined && index === undefined;
	const keyIssue = duplicate ? locale.duplicateKey : missingKey ? locale.missingKey : undefined;
	const present = fieldPresent ?? true;
	const { draft } = node;
	const container = draft.type === 'array' || draft.type === 'object' ? draft : undefined;
	const canToggle = present && container && !hasOptions(field, draft, present);
	const canChooseType = !field?.type || (present && draft.type !== declaredType(field));
	const replace = (patch: Partial<Node>) => onReplace({ ...node, ...patch });

	return (
		<div
			className={form ? 'axc-json-row axc-json-field' : 'axc-json-row'}
			data-inactive={inactive || undefined}
			data-root={root || undefined}
		>
			<div className="axc-json-row-controls">
				{(fieldName !== undefined || root || index !== undefined || field) && (
					<span className="axc-json-field-name">
						{label}
						{field?.required && (
							<span className="axc-json-required" aria-label={locale.required}>
								{' *'}
							</span>
						)}
					</span>
				)}
				{fieldName === undefined && !root && index === undefined && (
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
				)}
				{inactive && <span className="axc-json-description">{locale.inactive}</span>}
				{onToggle && !access.readOnly && (
					<Button
						label={(inactive ? locale.enable : locale.deactivate) + ' · ' + label}
						pressed={!inactive}
						disabled={access.disabled}
						onClick={onToggle}
					/>
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
					path={path}
					describedBy={field?.description ? descriptionId : undefined}
					access={access}
					onDraft={(next) => replace({ draft: next })}
					onRemove={onRemove}
				/>
				{canToggle && (
					<Button
						label={(node.expanded ? locale.collapse : locale.expand) + ' · ' + label}
						expanded={node.expanded}
						disabled={access.disabled}
						onClick={() => onReplace({ ...node, expanded: !node.expanded }, true)}
					/>
				)}
				{!access.readOnly &&
					(present
						? onRemove && <Button label={locale.remove + ' · ' + label} disabled={access.disabled} onClick={onRemove} />
						: field && (
								<Button
									label={locale.add + ' · ' + label}
									disabled={access.disabled}
									onClick={() => replace({ draft: toDraft(newFieldValue(field)) })}
								/>
							))}
			</div>
			{field?.description && (
				<div className="axc-json-description" id={descriptionId}>
					{field.description}
				</div>
			)}
			{container &&
				canToggle &&
				node.expanded &&
				(container.type === 'object' ? (
					<ObjectRows
						nodes={container.children}
						access={access}
						fields={field?.fields}
						additionalProperties={field?.additionalProperties}
						form={form}
						path={path}
						settings={objectSettings ?? { scope: label }}
						onChange={(children) => replace({ draft: { ...container, children } })}
						onExpand={(children) => onReplace({ ...node, draft: { ...container, children } }, true)}
					/>
				) : (
					<TreeRows
						nodes={container.children}
						access={access}
						array
						field={field?.items}
						scope={label}
						path={path}
						form={form}
						onChange={(children) => replace({ draft: { ...container, children } })}
						onExpand={(children) => onReplace({ ...node, draft: { ...container, children } }, true)}
					/>
				))}
		</div>
	);
}

interface RowsProps {
	nodes: Node[];
	access: Editability;
	scope: string;
	onChange: (nodes: Node[]) => void;
	onExpand: (nodes: Node[]) => void;
	path: JsonPath | undefined;
	form?: boolean;
}

function toggles(node: Node, settings: ObjectSettings) {
	const key = node.origin?.key;
	if (key === undefined) return {};
	const keys = settings.disabledKeys ?? [];
	const inactive = keys.includes(key);
	return {
		inactive,
		onToggle: settings.onDisabledKeysChange
			? () => settings.onDisabledKeysChange?.(inactive ? keys.filter((item) => item !== key) : [...keys, key])
			: undefined,
	};
}

function ObjectRows({
	nodes,
	access,
	fields = [],
	additionalProperties,
	form,
	path,
	settings,
	onChange,
	onExpand,
}: Omit<RowsProps, 'scope'> & {
	fields?: readonly JsonField[];
	additionalProperties?: boolean | JsonFieldDefinition;
	settings: ObjectSettings;
}) {
	const grouped = new Map(fields.map((field) => [field.name, field]));
	const fieldsByName = new Map<string, Node>();
	const extras: Node[] = [];
	for (const node of nodes) {
		const key = node.origin?.key ?? node.fieldName;
		if (key !== undefined && grouped.has(key)) fieldsByName.set(key, node);
		else extras.push(node);
	}
	const repeated = duplicates(nodes);
	return (
		<div className="axc-json-object">
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
						const next = current
							? nodes.flatMap((node) => (node === current ? (updated ? [updated] : []) : [node]))
							: updated
								? [...nodes, { ...updated, id: newNode(field.name).id, fieldName: field.name }]
								: nodes;
						if (onlyExpansion) onExpand(next);
						else onChange(next);
					};
					return (
						<TreeRow
							key={field.name}
							node={row}
							field={field}
							fieldName={field.name}
							fieldPresent={current !== undefined}
							form={form}
							access={access}
							path={path && [...path, field.name]}
							{...toggles(row, settings)}
							onReplace={replace}
							onRemove={() => replace(undefined)}
						/>
					);
				})}
			</div>
			{(settings.allowExtraParams ?? additionalProperties !== false) && (
				<div className="axc-json-extra">
					{fields.length > 0 && form && <div className="axc-json-extra-label">{settings.scope}</div>}
					<TreeRows
						nodes={extras}
						access={access}
						scope={settings.scope}
						path={path}
						form={form}
						repeated={repeated}
						field={typeof additionalProperties === 'object' ? additionalProperties : undefined}
						settings={settings}
						onChange={(next) => onChange([...nodes.filter((node) => !extras.includes(node)), ...next])}
						onExpand={(next) => onExpand([...nodes.filter((node) => !extras.includes(node)), ...next])}
					/>
				</div>
			)}
		</div>
	);
}

function TreeRows({
	nodes,
	access,
	array,
	field,
	scope,
	path,
	form,
	settings,
	onChange,
	onExpand,
	repeated = duplicates(nodes),
}: RowsProps & {
	array?: boolean;
	field?: JsonFieldDefinition;
	settings?: ObjectSettings;
	repeated?: ReadonlySet<string>;
}) {
	const {
		slots: { Button },
		locale,
	} = useJsonEditorContext();
	return (
		<div className="axc-json-children">
			{nodes.map((node, index) => {
				const key = array ? index : node.key;
				const replace = (updated: Node | undefined, onlyExpansion?: boolean) => {
					const next = nodes.flatMap((item) => (item.id === node.id ? (updated ? [updated] : []) : [item]));
					if (onlyExpansion) onExpand(next);
					else onChange(next);
				};
				return (
					<TreeRow
						key={node.id}
						node={node}
						access={access}
						index={array ? index : undefined}
						field={field}
						form={form}
						path={path === undefined || key === undefined ? undefined : [...path, key]}
						{...(settings ? toggles(node, settings) : {})}
						duplicate={!array && node.key !== undefined && repeated.has(node.key)}
						onReplace={replace}
						onRemove={() => replace(undefined)}
					/>
				);
			})}
			{!access.readOnly && (
				<Button
					label={locale.add + ' · ' + scope}
					disabled={access.disabled}
					onClick={() =>
						onChange([...nodes, newNode(array ? String(nodes.length) : undefined, field ? newFieldValue(field) : '')])
					}
				/>
			)}
		</div>
	);
}
