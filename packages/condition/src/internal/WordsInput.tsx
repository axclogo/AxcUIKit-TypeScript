import { Tags } from '../ui/controls.js';
import type { AxcTagsProps } from '../ui/types.js';

/** Applies Axc's commit rule on top of any Tags adapter: drop blank words and duplicates, keep everything else verbatim. */
export function WordsInput(props: AxcTagsProps) {
	return <Tags {...props} onChange={(words) => props.onChange([...new Set(words.filter((word) => word.trim()))])} />;
}
