// Copy a locally built wasm-bindgen web target for the interactive plugin decision example.
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const input = process.argv[2];
if (!input) throw new Error('Pass the directory produced by wasm-pack build --target web for AxcEval 0.4.');
const destination = new URL('../demo/dist/eval/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ['axc_eval_wasm.js', 'axc_eval_wasm_bg.wasm'])
	await copyFile(resolve(input, name), new URL(name, destination));
