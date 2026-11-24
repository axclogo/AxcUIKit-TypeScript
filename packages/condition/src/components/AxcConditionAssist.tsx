import { AxcCondition, type AxcConditionProps } from './AxcCondition.js';
import { AssistPanel } from '../internal/AssistPanel.js';
import { useAxcLocale } from '../ui/provider.js';
import { conditionAssistRequest, parseConditionResult } from '../core/assist.js';
import { validateCondition } from '../core/condition.js';
import type { AxcAssistTransport } from '../core/types.js';

export interface AxcConditionAssistProps extends AxcConditionProps {
	/** Host-side model access. Axc adds no SDK, endpoint or credentials. */
	assist: AxcAssistTransport;
}

/**
 * `AxcCondition` plus a design-time AI assistant. A candidate is previewed (and editable) first;
 * only "Apply" calls `onChange`. Candidates must be non-empty even if `allowEmpty` is set.
 * The assistant is hidden when `readOnly` and disabled without `onChange`.
 */
export function AxcConditionAssist({ assist, ...props }: AxcConditionAssistProps) {
	const locale = useAxcLocale();
	const catalog = { fields: props.fields, maxLevels: props.maxLevels, allowNot: props.allowNot };
	return (
		<div className="axc-condition-assist">
			{!props.readOnly && (
				<AssistPanel
					transport={assist}
					current={{ value: props.value, ...catalog }}
					disabled={props.disabled || !props.onChange}
					label={locale.ui.assistCondition}
					build={(model, requirement) => conditionAssistRequest(model, requirement, props.value, catalog, locale)}
					parse={(input) => parseConditionResult(input, catalog)}
					validate={(value) => validateCondition(value, catalog)}
					preview={(value, onChange) => <AxcCondition {...catalog} value={value} onChange={onChange} />}
					onApply={(value) => props.onChange?.(value)}
				/>
			)}
			<AxcCondition {...props} />
		</div>
	);
}
