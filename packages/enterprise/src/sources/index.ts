/**
 * Data-source adapters + introspection. Each adapter implements the grid's
 * `ServerDataSource` over a specific backend, so the grid, edit form, sorting,
 * filtering, and paging work identically regardless of where the data lives.
 */
export { normalizeFilters, type NormalizedFilter, type NormalizedPredicate } from './filters'
export {
  buildEntitySchema,
  pickLabelField,
  linkRelationLabels,
  type IntrospectedColumn,
  type ColumnReference,
} from './schema-from-columns'
export { createSupabaseDataSource, type SupabaseDataSourceConfig, type SupabaseClientLike } from './supabase'
export { createRestDataSource, type RestDataSourceConfig } from './rest'
export {
  offsetLimitAdapter,
  dummyJsonAdapter,
  jsonServerAdapter,
  type RestAdapter,
  type OffsetLimitOptions,
} from './rest-adapters'
export { introspectSupabaseTable, listSupabaseTables, type IntrospectSupabaseOptions } from './introspect-supabase'
export {
  createSupabaseRealtime,
  type SupabaseRealtimeConfig,
  type SupabaseRealtimeClientLike,
  type SupabaseRealtimeHandle,
  type RealtimeChannelLike,
  type RealtimeChange,
} from './realtime-supabase'
export {
  createRelationLookup,
  type RelationLookup,
  type RelationLookupConfig,
  type RelationOption,
} from './relation-lookup'
export {
  createSupabaseAuth,
  type SupabaseAuthConfig,
  type SupabaseAuthController,
  type SupabaseAuthClientLike,
  type AuthState,
  type AuthUser,
} from './auth-supabase'
export {
  aggregateRows,
  chartFieldsFromSchema,
  type AggregateReduce,
  type AggregateRequest,
  type AggregateBucket,
  type AggregateSource,
} from './aggregate'
export { withEntityRules } from './with-entity-rules'
export { withRelationLabels, type RelationLabelConfig } from './with-relation-labels'
export {
  reduceValue,
  kpiSeries,
  sparklinePoints,
  seriesDelta,
  formatKpiValue,
  dashboardFromSchema,
  type DashboardSpec,
  type DashboardWidget,
  type KpiWidget,
  type ChartWidget,
} from './dashboard'
