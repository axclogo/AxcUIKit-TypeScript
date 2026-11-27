export type TableKey = string | number;
export type RowKey<Row> =
	{ [K in keyof Row]-?: Row[K] extends TableKey ? K : never }[keyof Row] | ((row: Row) => TableKey);
export { en, zhCN, type Locale } from './locales/index.js';
