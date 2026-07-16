/**
 * `@svgrid/enterprise/studio` - the pure, Svelte-free Studio core. Introspect a
 * data source into an `EntitySchema`, then scaffold runnable SvelteKit code
 * from it. Importable from Node (the MCP generator) as well as bundlers (the
 * visual designer), since nothing here touches Svelte or the DOM.
 */
export { inferType, introspectJson, introspectDrizzle, introspectDrizzleAll } from './introspect.js'
export { introspectPrisma, introspectPrismaAll } from './introspect-prisma.js'
export {
  introspectDatabase,
  listDatabaseTables,
  mapSqlType,
  type SqlDialectName,
  type DbExecute,
  type IntrospectDbOptions,
} from './introspect-db.js'
export {
  scaffold,
  mergeManaged,
  MANAGED_START,
  MANAGED_END,
  type GeneratedFile,
  type ScaffoldOptions,
} from './scaffold.js'
export { scaffoldApp, type ScaffoldAppOptions } from './scaffold-app.js'
export { emitStudioApp, emitEntityModules, entityScreenPage, prepareEntities } from './emit-schema.js'
export { emitStudioProject, emitStudioAppBundle } from './emit-project.js'
export { sampleApps, getSampleApp, type SampleApp } from './samples/index.js'
export { generateValue, generateRows } from './sample-data.js'
export { studioThemes, defaultStudioTheme, getStudioTheme, resolveThemeTokens, isDarkTheme, themeStyleString, type StudioTheme } from './themes.js'
export {
  createProject,
  defaultScreenFor,
  defaultBlockConfig,
  gridColumns,
  entityOf,
  blockPalette,
  addBlock,
  addBlockAt,
  removeBlock,
  duplicateBlock,
  moveBlock,
  reorderBlock,
  updateBlock,
  addEntity,
  removeEntity,
  updateEntity,
  addScreen,
  removeScreen,
  updateScreen,
  setDataSource,
  defaultEntitySource,
  setEntityDataSource,
  entityDataSource,
  setTheme,
  setThemePreset,
  setShell,
  sanitizeProject,
  screenFromTemplate,
  addScreenFromTemplate,
  serializeProject,
  parseProject,
  validateProject,
  isProjectValid,
  blockColumns,
  roleCanScreen,
  roleCanAction,
  CRUD_ACTIONS,
  type CrudAction,
  type RoleAccess,
  type AccessControl,
  type I18nConfig,
  type StudioProject,
  type Screen,
  type ScreenNav,
  type Block,
  type BlockKind,
  type BlockConfig,
  type GridConfig,
  type GridColumnConfig,
  type RowLink,
  type RowAction,
  type RowActionKind,
  type FormatOp,
  type FormatRule,
  type GridEditing,
  type GridDensity,
  type GridAlign,
  type PagerPosition,
  type FormConfig,
  type ChartConfig,
  type KpiConfig,
  type DashboardConfig,
  type MasterDetailConfig,
  type LookupConfig,
  type PivotConfig,
  type FilterPanelConfig,
  type RecordConfig,
  type Reduce,
  type DataSourceKind,
  type EntityDataSource,
  type MemorySource,
  type RestSource,
  type SqlSource,
  type SupabaseSource,
  type RestMethod,
  type ParamLocation,
  type ParamType,
  type RequestParam,
  type SqlDialectKind,
  type ProjectTheme,
  type ShellConfig,
  type ShellStyle,
  type ScreenTemplate,
  type PaletteItem,
  type ProjectIssue,
} from './project.js'
export {
  verifyScaffold,
  summarizeVerify,
  type VerifyResult,
  type VerifyIssue,
  type VerifySeverity,
} from './verify.js'
export {
  runStudioAdd,
  runStudioAddApp,
  resolveSchema,
  resolveSchemas,
  type StudioIO,
  type AddOptions,
  type AddResult,
  type AddAppResult,
} from './cli.js'

// Re-export the schema surface so consumers get everything from one entry.
export {
  resolveIdField,
  schemaToColumns,
  schemaToFormFields,
  linkRelationLabels,
  pickLabelField,
  type EntitySchema,
  type EntityField,
  type EntityFieldType,
} from '../schema.js'

// Pure license classification, so the Node/MCP generator can soft-gate with the
// same rules as the browser (see license-core.ts). No DOM, safe in Node.
export { checkLicenseKey, type LicenseInfo, type LicenseStatus } from '../license-core.js'
