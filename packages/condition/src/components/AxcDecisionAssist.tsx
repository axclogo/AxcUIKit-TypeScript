import { AxcDecision, type AxcDecisionProps } from './AxcDecision.js';
import { AssistPanel } from '../internal/AssistPanel.js';
import { useAxcLocale } from '../ui/provider.js';
import { decisionPlan, validateDecisionPlan } from '../core/decision.js';
import { decisionAssistRequest, parseDecisionResult } from '../core/decision-assist.js';
import type { AxcAssistTransport } from '../core/types.js';

export interface AxcDecisionAssistProps extends AxcDecisionProps {
	/** Model access for generating plans. Independent of `models`, the runtime model list. */
	assist: AxcAssistTransport;
}

/**
 * `AxcDecision` plus an assistant that generates the whole plan. The candidate is a read-only
 * preview applied as one unit; the current runtime `model` is always kept.
 */
export function AxcDecisionAssist({ assist, ...props }: AxcDecisionAssistProps) {
	const locale = useAxcLocale();
	const catalog = { fields: props.fields, maxLevels: props.maxLevels, allowNot: props.allowNot };
	return (
		<div className="axc-decision-assist">
			{!props.readOnly && (
				<AssistPanel
					transport={assist}
					current={{ value: props.value, ...catalog }}
					disabled={props.disabled || !props.onChange}
					label={locale.ui.assistDecision}
					build={(model, requirement) =>
						decisionAssistRequest(model, requirement, decisionPlan(props.value), catalog, locale)
					}
					parse={(input) => parseDecisionResult(input, catalog)}
					validate={(value) => validateDecisionPlan(value, catalog)}
					preview={(value) => (
						<AxcDecision
							{...props}
							readOnly
							conditionAssist={undefined}
							value={{ ...value, model: props.value.model }}
						/>
					)}
					onApply={(value) => props.onChange?.({ ...value, model: props.value.model })}
				/>
			)}
			<AxcDecision {...props} />
		</div>
	);
}
