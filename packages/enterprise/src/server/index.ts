/**
 * `@svgrid/enterprise/server` - the Server-Side Row Model.
 *
 * The free grid owns the datasource contract and the flat controller
 * (`createServerDataSource`: sort, filter, paging, CRUD). This entry point adds
 * everything above flat rows: lazy server-side GROUPING and TREE data through
 * the same one `getRows` call, per-group aggregation, subtotal footers,
 * skeleton placeholders, intra-group paging, and the group chrome
 * (`SvGroupCell`, `SvRowGroupPanel`).
 *
 * Importing from the package root works too; this subpath exists so an app
 * that only wants the row model does not pull the whole Enterprise barrel.
 */
export {
  createServerRowModel,
  serverRowModelRows,
  serverRowModelNav,
  serverGroupText,
  GRAND_TOTAL_ROW_ID,
  GROUP_TOTAL_ROW_ID_PREFIX,
  type ServerRowModel,
  type ServerRowModelOptions,
  type ServerRowModelState,
  type ServerRowModelGridRow,
  type ServerRowModelDisplayRow,
  type ServerLevelParams,
  type ServerLevelState,
  type RefreshOptions,
  type ServerTransaction,
  type ServerTransactionResult,
  type ServerTransactionStatus,
  type ServerRowModelPaginationOptions,
  type ServerRowModelPagination,
} from './server-row-model'
export {
  adaptCallbackDatasource,
  toCallbackDatasource,
  fromCallbackRequest,
  toCallbackRequest,
  fromCallbackFilterModel,
  toCallbackFilterModel,
  fromCallbackSelectionState,
  toCallbackSelectionState,
  isCallbackSelectionState,
  type CallbackSelectionState,
  type CallbackGroupSelectionState,
  type SelectionStateMapping,
  type CallbackServerRequest,
  type CallbackColumnFilter,
  type CallbackGetRowsParams,
  type CallbackDatasource,
} from './svgrid-adapter'
// The previous model: block-append with a "Load N more" button. Still
// supported; `createServerRowModel` above is the one to reach for.
export {
  createServerGroupModel,
  serverGroupRows,
  serverGroupNav,
  type ServerGroupController,
  type ServerGroupControllerOptions,
  type ServerGroupState,
  type ServerGroupGridRow,
} from './server-group-model'
export {
  createServerSelectionModel,
  type ServerSelectionModel,
  type ServerSelectionModelOptions,
  type ServerSelectionState,
  type ServerGroupSelectionNode,
  type ServerSelectionGroupMode,
} from './server-selection'
export {
  buildPivotResultColumns,
  type PivotResultColumnOptions,
} from './server-pivot'
export { enableServerRowModel } from './enable'
export {
  defaultServerGroupMessages,
  resolveServerGroupMessages,
  type ServerGroupMessages,
} from './messages'
export { default as SvGroupCell } from './SvGroupCell.svelte'
export { default as SvRowGroupPanel } from './SvRowGroupPanel.svelte'
