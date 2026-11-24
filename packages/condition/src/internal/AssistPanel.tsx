import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ModelSelect, Button, TextArea } from '../ui/controls.js';
import { useAxcLocale } from '../ui/provider.js';
import type { AxcAssistRequest, AxcAssistResult, AxcAssistTransport } from '../core/types.js';
import { AxcValidationError, type AxcIssue } from '../core/issues.js';
import { Issues } from './Issues.js';

interface AssistPanelProps<T> {
	transport: AxcAssistTransport;
	/** Anything whose change makes an in-flight request or candidate stale. */
	current: unknown;
	disabled?: boolean;
	label: string;
	build: (model: string, requirement: string) => AxcAssistRequest;
	parse: (value: unknown) => AxcAssistResult<T>;
	validate: (value: T) => AxcIssue[];
	preview: (value: T, onChange: (value: T) => void) => ReactNode;
	onApply: (value: T) => void;
}

type Failure = { message: string } | { issues: AxcIssue[] };

/**
 * Runs at most one request and holds at most one unapplied candidate. A request is discarded when
 * cancelled, when `current` or `disabled` changes, or on unmount; late results are ignored.
 */
export function AssistPanel<T>({
	transport,
	current,
	disabled,
	label,
	build,
	parse,
	validate,
	preview,
	onApply,
}: AssistPanelProps<T>) {
	const locale = useAxcLocale();
	const [open, setOpen] = useState(false);
	const [model, setModel] = useState<string | null>(null);
	const [requirement, setRequirement] = useState('');
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<Failure | null>(null);
	const [candidate, setCandidate] = useState<AxcAssistResult<T> | null>(null);
	const active = useRef<AbortController | null>(null);
	const cancel = () => {
		active.current?.abort();
		active.current = null;
		setBusy(false);
	};
	const currentText = JSON.stringify(current);
	useEffect(() => {
		cancel();
		setCandidate(null);
		setFailure(null);
		return () => active.current?.abort();
	}, [currentText, disabled]);
	const ready = !disabled && !busy && Boolean(requirement.trim()) && transport.models.some((item) => item.id === model);
	const generate = async () => {
		const controller = new AbortController();
		active.current = controller;
		setBusy(true);
		setFailure(null);
		setCandidate(null);
		try {
			const result = await transport.generate(build(model!, requirement), controller.signal);
			if (!controller.signal.aborted) setCandidate(parse(result));
		} catch (reason) {
			if (!controller.signal.aborted)
				setFailure(
					reason instanceof AxcValidationError
						? { issues: reason.issues }
						: { message: reason instanceof Error ? reason.message : String(reason) },
				);
		} finally {
			if (active.current === controller) {
				active.current = null;
				setBusy(false);
			}
		}
	};
	const candidateIssues = candidate ? validate(candidate.value) : [];
	return (
		<div className="axc-assist">
			<Button
				disabled={disabled}
				onClick={() => {
					if (open) {
						cancel();
						setCandidate(null);
					}
					setOpen(!open);
				}}
			>
				{open ? locale.ui.assistClose : label}
			</Button>
			{open && (
				<div className="axc-panel">
					<ModelSelect
						label={locale.ui.assistModel}
						models={transport.models}
						value={model}
						onChange={setModel}
						disabled={busy || disabled}
					/>
					<TextArea
						label={locale.ui.requirement}
						value={requirement}
						disabled={busy || disabled}
						rows={3}
						placeholder={locale.ui.requirementPlaceholder}
						onChange={setRequirement}
					/>
					<div className="axc-toolbar">
						<Button disabled={!ready} onClick={() => void generate()}>
							{locale.ui.generate}
						</Button>
						{busy && <Button onClick={cancel}>{locale.ui.cancel}</Button>}
					</div>
					<small>{locale.ui.assistHint}</small>
					{busy && <p role="status">{locale.ui.generating}</p>}
					{failure && 'message' in failure && (
						<p role="alert" className="axc-error">
							{locale.ui.assistFailed(failure.message)}
						</p>
					)}
					{failure && 'issues' in failure && (
						<div className="axc-error">
							<p role="alert">{locale.ui.assistInvalid}</p>
							<Issues issues={failure.issues} />
						</div>
					)}
					{candidate && (
						<div className="axc-panel axc-candidate">
							<strong>{locale.ui.candidate}</strong>
							<p>{candidate.explanation}</p>
							{preview(candidate.value, (value) => setCandidate({ ...candidate, value }))}
							<div className="axc-toolbar">
								<Button
									disabled={disabled || candidateIssues.length > 0}
									onClick={() => {
										onApply(candidate.value);
										setCandidate(null);
									}}
								>
									{locale.ui.apply}
								</Button>
								<Button onClick={() => setCandidate(null)}>{locale.ui.discard}</Button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
