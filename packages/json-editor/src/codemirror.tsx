import { json } from '@codemirror/lang-json';
import { CodeEditor } from '@axclogo/uikit/code-editor';
import type { SourceEditorProps } from './ui/types.js';
export type { SourceEditorProps } from './ui/types.js';
const language = json();

export interface CodeMirrorSourceEditorProps extends SourceEditorProps {
	theme?: 'light' | 'dark' | 'none';
}
/** Render the shared code editor with the JSON language and wrapped lines. */
export function CodeMirrorSourceEditor(props: CodeMirrorSourceEditorProps) {
	return <CodeEditor {...props} language={language} wordWrap />;
}
