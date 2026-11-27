import { useSyncExternalStore } from 'react';
/** Gallery color theme: the stored preference and the light/dark value it resolves to. */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
const storageKey = 'axc-gallery-theme';
const query = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();
function readPreference(): ThemePreference {
	const stored = window.localStorage.getItem(storageKey);
	return stored === 'light' || stored === 'dark' ? stored : 'system';
}
let preference = readPreference();
function resolve(): ResolvedTheme {
	return preference === 'system' ? (query.matches ? 'dark' : 'light') : preference;
}
let resolved = resolve();
function apply() {
	resolved = resolve();
	document.documentElement.dataset.theme = resolved;
	listeners.forEach((listener) => listener());
}
apply();
query.addEventListener('change', apply);
/** Stores the preference and re-applies the theme to the document. */
export function setThemePreference(next: ThemePreference) {
	preference = next;
	if (next === 'system') window.localStorage.removeItem(storageKey);
	else window.localStorage.setItem(storageKey, next);
	apply();
}
function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
/** Current gallery preference, for the theme switcher. */
export function useThemePreference(): ThemePreference {
	return useSyncExternalStore(subscribe, () => preference);
}
/** Current light/dark value, for examples that pass a theme to their component. */
export function useTheme(): ResolvedTheme {
	return useSyncExternalStore(subscribe, () => resolved);
}
