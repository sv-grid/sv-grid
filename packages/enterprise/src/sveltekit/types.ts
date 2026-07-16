import type { RowData, ServerDataSource } from '@svgrid/grid'

/**
 * A `ServerDataSource` that implements the full CRUD contract - the optional
 * `createRow` / `updateRow` / `deleteRow` are required here. Sources that
 * always support writes (the in-memory reference source, the SvelteKit client)
 * return this so callers get the methods without a null check.
 */
export type WritableDataSource<TData extends RowData> = Required<
  Pick<ServerDataSource<TData>, 'getRows' | 'createRow' | 'updateRow' | 'deleteRow'>
>
