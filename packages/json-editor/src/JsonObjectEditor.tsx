import { useId, useMemo, useState } from 'react';
import { JsonValidationError, parseJsonContent, type JsonContent, type JsonObject } from './core/index.js';
import { ParamObjectEditorView, type ParamObjectEditorProps } from './ParamObjectEditor.js';
import { useJsonEditorContext } from './ui/provider.js';

export type JsonObjectEditorMode = 'params' | 'json';

export interface JsonObjectEditorProps extends Omit<ParamObjectEditorProps, 'value' | 'onChange'> {
	content: JsonContent;
	onChange: (content: JsonContent) => void;
	onValidObjectChange?: (value: JsonObject, content: JsonContent) => void;
	mode?: JsonObjectEditorMode;
	defaultMode?: JsonObjectEditorMode;
	onModeChange?: (mode: JsonObjectEditorMode) => void;
	jsonHeight?: number | string;
	jsonPlaceholder?: string;
}

function tryParse(content: JsonContent) {
	try {
		return { value: parseJsonContent(content) };
	} catch (error) {
		if (error instanceof JsonValidationError) return { error };
		throw error;
	}
}

/** Edits a JSON object as a parameter tree or source text, retaining malformed source as text. */
export function JsonObjectEditor({
	content,
	onChange,
	onValidObjectChange,
	mode,
	defaultMode = 'params',
	onModeChange,
	jsonHeight = 220,
	jsonPlaceholder = '{}',
	className,
	...paramProps
}: JsonObjectEditorProps) {
	const {
		slots: { SourceEditor, Button },
		locale,
	} = useJsonEditorContext();
	const issuesId = useId();
	const [paramsValid, setParamsValid] = useState(true);
	const parsed = useMemo(() => tryParse(content), [content]);
	const [localMode, setLocalMode] = useState<JsonObjectEditorMode>(defaultMode);
	const showing = parsed.error ? 'json' : (mode ?? localMode);
	if (mode === undefined && localMode === 'params' && parsed.error) setLocalMode('json');

	const source = content.kind === 'text' ? content.text : parsed.value ? JSON.stringify(parsed.value, null, 2) : '';
	const editable = !paramProps.disabled && !paramProps.readOnly;
	const changeMode = (next: JsonObjectEditorMode) => {
		if (next === showing || paramProps.disabled || !parsed.value) return;
		if (next === 'json' && editable) {
			if (!paramsValid) return;
			const text = JSON.stringify(parsed.value, null, 2);
			if (content.kind !== 'text' || text !== content.text) onChange({ kind: 'text', text });
		}
		if (mode === undefined) setLocalMode(next);
		onModeChange?.(next);
	};

	return (
		<div className={className ? 'axc-json ' + className : 'axc-json'}>
			<div className="axc-json-modes">
				<Button
					label={locale.params}
					pressed={showing === 'params'}
					disabled={paramProps.disabled || Boolean(parsed.error)}
					onClick={() => changeMode('params')}
				/>
				<Button
					label={locale.json}
					pressed={showing === 'json'}
					disabled={paramProps.disabled || (showing === 'params' && editable && !paramsValid)}
					onClick={() => changeMode('json')}
				/>
			</div>
			{showing === 'params' && parsed.value ? (
				<ParamObjectEditorView
					onDraftValidityChange={setParamsValid}
					{...paramProps}
					value={parsed.value}
					onChange={(value) => {
						const next: JsonContent = { kind: 'object', value };
						onChange(next);
						onValidObjectChange?.(value, next);
					}}
				/>
			) : (
				<div className="axc-json-source">
					<SourceEditor
						label={locale.json}
						describedBy={parsed.error ? issuesId : undefined}
						value={source}
						height={jsonHeight}
						placeholder={jsonPlaceholder}
						disabled={paramProps.disabled}
						readOnly={paramProps.readOnly}
						invalid={Boolean(parsed.error)}
						onChange={(text) => {
							if (!editable) return;
							const next: JsonContent = { kind: 'text', text };
							onChange(next);
							if (onValidObjectChange) {
								const value = tryParse(next).value;
								if (value) onValidObjectChange(value, next);
							}
						}}
					/>
					{parsed.error && (
						<div id={issuesId}>
							{parsed.error.issues.map((issue, index) => (
								<div className="axc-json-error" key={index} role="alert">
									{locale.issues[issue.code]}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
