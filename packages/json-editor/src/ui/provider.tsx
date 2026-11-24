import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { en, type JsonEditorLocale } from '../core/locales/en.js';
import { native } from './native.js';
import type { JsonEditorSlots } from './types.js';

interface JsonEditorContext {
	slots: JsonEditorSlots;
	locale: JsonEditorLocale;
}

const Context = createContext<JsonEditorContext>({ slots: native, locale: en });

export interface JsonEditorProviderProps {
	children: ReactNode;
	slots?: Partial<JsonEditorSlots>;
	locale?: JsonEditorLocale;
}

/** Supplies control replacements and messages, inheriting unspecified settings from the nearest provider. */
export function JsonEditorProvider({ children, slots, locale }: JsonEditorProviderProps) {
	const parent = useContext(Context);
	const settings = useMemo(
		() => ({ slots: slots ? { ...parent.slots, ...slots } : parent.slots, locale: locale ?? parent.locale }),
		[parent, slots, locale],
	);
	return <Context.Provider value={settings}>{children}</Context.Provider>;
}

export function useJsonEditorContext() {
	return useContext(Context);
}
