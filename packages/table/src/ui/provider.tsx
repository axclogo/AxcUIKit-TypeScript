import { createContext, useContext } from 'react';
import { en } from '../core/index.js';
import type { TableUIProviderProps, TableControls } from '../types.js';
import { nativeControls } from './controls.js';

const Pagination: TableControls['Pagination'] = ({
	page,
	pageSize,
	total,
	totalLabel,
	pageSizeOptions,
	onPageChange,
	onPageSizeChange,
}) => {
	const {
		controls: { Button, Select },
		locale,
	} = useTableUI();
	return (
		<nav className="axc-table-pages">
			<span>{totalLabel ?? total}</span>
			<Button label={locale.previous} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
				‹
			</Button>
			<span>{page}</span>
			<Button label={locale.next} disabled={page * pageSize >= total} onClick={() => onPageChange(page + 1)}>
				›
			</Button>
			{pageSizeOptions && (
				<Select
					label={locale.pageSize}
					value={pageSize}
					options={pageSizeOptions.map((value) => ({ label: String(value), value }))}
					onChange={(value) => onPageSizeChange(value as number)}
				/>
			)}
		</nav>
	);
};
type TableUI = Omit<TableUIProviderProps, 'children' | 'controls' | 'locale'> & {
	controls: TableControls;
	locale: typeof en;
};
const context = createContext<TableUI>({ controls: { ...nativeControls, Pagination }, locale: en });
export const useTableUI = () => useContext(context);
/** Supplies localized controls, formatters and action handlers to descendant tables. */
export function TableUIProvider({ children, ...props }: TableUIProviderProps) {
	const parent = useTableUI();
	return (
		<context.Provider
			value={{
				...parent,
				...props,
				controls: { ...parent.controls, ...props.controls },
				locale: props.locale ?? parent.locale,
				types: { ...parent.types, ...props.types },
				formatters: { ...parent.formatters, ...props.formatters },
			}}
		>
			{children}
		</context.Provider>
	);
}
