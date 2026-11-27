import { useState, useCallback, useLayoutEffect, useReducer, type RefObject } from 'react';
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset } from '@tanstack/virtual-core';
export function useRowWindow(
	container: RefObject<HTMLDivElement | null>,
	keys: readonly string[],
	height: number,
	enabled: boolean,
) {
	const [, update] = useReducer((i: number) => i + 1, 0);
	const getItemKey = useCallback((i: number) => keys[i], [keys]);
	const options = {
		count: keys.length,
		getScrollElement: () => container.current,
		estimateSize: () => height,
		getItemKey,
		enabled,
		onChange: () => update(),
		scrollToFn: elementScroll,
		observeElementRect,
		observeElementOffset,
		overscan: 5,
	};
	const [engine] = useState(() => new Virtualizer<HTMLDivElement, HTMLTableRowElement>(options));
	engine.setOptions(options);
	useLayoutEffect(() => engine._didMount(), [engine]);
	useLayoutEffect(() => engine._willUpdate());
	useLayoutEffect(() => {
		engine.measure();
		engine.elementsCache.forEach(engine.measureElement);
	}, [engine, height]);
	return engine;
}
