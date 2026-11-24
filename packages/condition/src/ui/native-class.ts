/** Class list for default controls. Only `.axc-native-control` gets Axc's control styling. */
export const nativeClass = (...names: Array<string | false | undefined>) =>
	['axc-native-control', ...names].filter(Boolean).join(' ');
