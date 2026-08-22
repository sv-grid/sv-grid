/**
 * SvGrid Studio "drive the model" MCP tools.
 *
 * These expose the SAME pure, validated project model the visual designer edits
 * (a `StudioProject`), so an AI agent can build/edit a data app structurally -
 * add entities, screens, blocks, components, wire data sources, theme, auth, the
 * data layer, deploy target - then generate the runnable SvelteKit app or export
 * the `studio.config.json` the designer can Load. Every edit runs through the
 * model's own functions (and `validateProject`), so an agent can't produce an
 * invalid project the way free-text codegen can.
 *
 * The server holds one in-memory "current project" per session; `studio_get_config`
 * / `studio_generate_app` are the outputs.
 */
import {
  createProject,
  parseProject,
  serializeProject,
  validateProject,
  addEntity,
  addScreen,
  addFreestandingScreen,
  addBlock,
  addComponentBlock,
  updateBlock,
  removeBlock,
  moveBlock,
  updateScreen,
  removeScreen,
  setScreenLayout,
  setEntityForm,
  setFieldConditions,
  formPlan,
  suggestFormSections,
  setEntityDataSource,
  setJob,
  setTenancy,
  setTheme,
  setAuth,
  setDataLayer,
  setDeployTarget,
  introspectDrizzle,
  introspectJson,
  flattenBlocks,
  blockPalette,
  UI_COMPONENT_REGISTRY,
  uiComponentSpec,
  studioThemes,
  emitStudioAppBundle,
  checkLicenseKey,
  entityDataSource,
  type StudioProject,
  type EntitySchema,
  type EntityDataSource,
  type BlockKind,
  type AccessControl,
} from '@svgrid/enterprise/studio'

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean }
export type ProjectTool = { name: string; description: string; inputSchema: Record<string, unknown> }

// ---- session state --------------------------------------------------------
let project: StudioProject | null = null

function requireProject(): StudioProject {
  if (!project) throw new Error('No project loaded. Call studio_new_project or studio_load_project first.')
  return project
}
function ok(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}
function fail(text: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text }] }
}
function studioNote(): string {
  return checkLicenseKey(process.env.SVGRID_LICENSE_KEY ?? null).valid
    ? ''
    : '// SvGrid Studio is a commercial feature. Set SVGRID_LICENSE_KEY in your MCP server\n// config env for licensed use. https://svgrid.com/pricing\n\n'
}

/** A short confirmation + the current validation status, after a mutation. */
function confirm(headline: string): ToolResult {
  const issues = validateProject(project!)
  const errs = issues.filter((i) => i.level === 'error')
  const warns = issues.filter((i) => i.level !== 'error')
  const tail = issues.length
    ? `\n\nValidation: ${errs.length} error(s), ${warns.length} warning(s):\n` + issues.map((i) => `  - [${i.level}] ${i.message}`).join('\n')
    : '\n\nValidation: clean.'
  return ok(headline + tail)
}

/** A human-readable description of the current model (for the agent to reason on). */
function describe(p: StudioProject): string {
  const lines: string[] = []
  lines.push(`Project: ${JSON.stringify(p.title)}`)
  lines.push(`Default data source: ${p.dataSource}`)
  lines.push(`Entities (${p.entities.length}):`)
  for (const e of p.entities) {
    const src = entityDataSource(p, e.name)
    const srcLabel = src.kind === 'sql' ? `sql/${(src as { dialect?: string }).dialect ?? 'postgres'}` : src.kind
    lines.push(`  - ${e.name} [${e.fields.map((f) => f.field).join(', ')}] (source: ${srcLabel})`)
  }
  lines.push(`Screens (${p.screens.length}):`)
  for (const s of p.screens) {
    const kinds = flattenBlocks(s.blocks).map((b) => (b.config.kind === 'component' ? `component:${(b.config as { component: string }).component}` : b.config.kind))
    lines.push(`  - id=${s.id} route=/${s.route} title=${JSON.stringify(s.title)}${s.entity ? ` entity=${s.entity}` : ' (freestanding)'} blocks=[${kinds.join(', ')}]`)
  }
  const t = p.theme
  lines.push(`Theme: ${t?.preset ?? 'default'} (${t?.mode ?? 'light'})${t?.accent ? ` accent=${t.accent}` : ''}`)
  if (p.access?.enabled) lines.push(`Access (RBAC): on, roles=[${p.access.roles.map((r) => r.role).join(', ')}], default=${p.access.defaultRole ?? p.access.roles[0]?.role}`)
  if (p.auth?.enabled) {
    const feats = [p.auth.register && 'register', p.auth.userAdmin && 'user-admin', p.auth.twoFactor && '2FA', p.auth.email && 'email', p.auth.oauth?.length && `oauth:${p.auth.oauth.join('+')}`].filter(Boolean)
    lines.push(`Auth: on${feats.length ? ` (${feats.join(', ')})` : ''}`)
  }
  if (p.dataLayer === 'drizzle') lines.push('Data layer: Drizzle (typed schema + migrations)')
  if (p.deploy) lines.push(`Deploy target: ${p.deploy}`)
  return lines.join('\n')
}

/** Resolve an EntitySchema from either an explicit schema or an introspection request. */
function resolveSchema(a: { schema?: unknown; kind?: string; source?: string; rows?: unknown[]; name?: string }): EntitySchema {
  if (a.schema && typeof a.schema === 'object') return a.schema as EntitySchema
  if (a.kind === 'drizzle') {
    if (!a.source) throw new Error('source (the Drizzle schema file text) is required for kind:"drizzle"')
    return introspectDrizzle(a.source)
  }
  if (a.kind === 'json') {
    if (!Array.isArray(a.rows) || a.rows.length === 0) throw new Error('rows (a non-empty array of sample objects) is required for kind:"json"')
    return introspectJson(a.name ?? 'entity', a.rows as Array<Record<string, unknown>>)
  }
  throw new Error('Provide either `schema` (an EntitySchema) or an introspection request (`kind`: "drizzle"|"json").')
}

// ---- tool catalogue -------------------------------------------------------
export const projectTools: ProjectTool[] = [
  {
    name: 'studio_new_project',
    description: 'Start a NEW, empty SvGrid Studio project (the model the visual designer edits). Add entities/screens next. Replaces any project currently in this session.',
    inputSchema: { type: 'object', properties: { title: { type: 'string', description: 'App title.' } } },
  },
  {
    name: 'studio_load_project',
    description: 'Load an existing project from a studio.config.json string (e.g. one exported earlier or shipped with a generated app). Validates it. Use this to continue editing an app the designer produced.',
    inputSchema: { type: 'object', properties: { config: { type: 'string', description: 'The studio.config.json contents.' } }, required: ['config'] },
  },
  {
    name: 'studio_describe_project',
    description: 'Return a human-readable summary of the CURRENT project: entities (+ fields + data source), screens (+ blocks, with ids), theme, RBAC, auth, data layer, deploy target. Call this to see state before editing.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'studio_get_config',
    description: 'Return the current project model as a studio.config.json string. Write it to `studio.config.json` and the visual designer can Load it (round-trip).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'studio_capabilities',
    description: 'List what can be added: block kinds (grid/chart/kpi/board/...), UI component keys (button/badge/timeline/...), theme presets, data-source kinds, and deploy targets.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'studio_add_entity',
    description: 'Add an entity (a table/model) + its default screen. Pass either `schema` (an EntitySchema, e.g. from introspect_source) OR an introspection request (`kind`:"drizzle" with `source`, or `kind`:"json" with `rows` + `name`).',
    inputSchema: {
      type: 'object',
      properties: {
        schema: { type: 'object', description: 'An EntitySchema.' },
        kind: { type: 'string', enum: ['drizzle', 'json'], description: 'Introspect a source instead of passing a schema.' },
        source: { type: 'string', description: 'For kind:"drizzle": the schema file text.' },
        rows: { type: 'array', items: { type: 'object' }, description: 'For kind:"json": sample rows.' },
        name: { type: 'string', description: 'For kind:"json": the entity name.' },
      },
    },
  },
  {
    name: 'studio_add_screen',
    description: 'Add a screen. With `entity`, adds an entity-bound screen (default grid). Without it, adds a freestanding page (needs `title`).',
    inputSchema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Entity name to bind (omit for a freestanding page).' },
        title: { type: 'string', description: 'Title (required for a freestanding page).' },
        route: { type: 'string', description: 'Route segment (freestanding only).' },
      },
    },
  },
  {
    name: 'studio_add_block',
    description: 'Add a data block to a screen. `kind` is one of the palette kinds (grid, chart, kpi, gauge, tree, tabs, accordion, pivot, board, calendar, detail, master-detail, filter, record, lookup, dashboard). Use studio_describe_project for screen ids.',
    inputSchema: {
      type: 'object',
      properties: { screenId: { type: 'string' }, kind: { type: 'string', description: 'Block kind.' } },
      required: ['screenId', 'kind'],
    },
  },
  {
    name: 'studio_add_component',
    description: 'Add a UI component block to a screen (button, badge, alert, card, stat, timeline, sparkline, chip, ...). `props` overrides the registry defaults. See studio_capabilities for component keys.',
    inputSchema: {
      type: 'object',
      properties: { screenId: { type: 'string' }, component: { type: 'string', description: 'Registry component key.' }, props: { type: 'object', description: 'Prop overrides (incl. _content for text).' } },
      required: ['screenId', 'component'],
    },
  },
  {
    name: 'studio_update_block',
    description: 'Configure an EXISTING block: its config (columns, editing mode, export buttons, grouping, chart dimension/measure, rowLink, formatRules, ...), its width (span/colSpan), height, or CSS class. `config` is merged into the block\'s current config. Get block ids from studio_describe_project. This is how you configure a block after studio_add_block, which only adds a default one.',
    inputSchema: {
      type: 'object',
      properties: {
        screenId: { type: 'string' },
        blockId: { type: 'string' },
        config: { type: 'object', description: 'Partial BlockConfig, merged in. Grid example: { "editing": "inline", "export": { "xlsx": true }, "grouping": ["region"] }.' },
        span: { type: 'number', enum: [1, 2, 3], description: 'Legacy 3-col width.' },
        colSpan: { type: 'number', description: 'Width on the 12-column grid (1-12).' },
        height: { type: 'number', description: 'Block height in px.' },
        className: { type: 'string' },
      },
      required: ['screenId', 'blockId'],
    },
  },
  {
    name: 'studio_remove_block',
    description: 'Remove a block from a screen. Get ids from studio_describe_project.',
    inputSchema: {
      type: 'object',
      properties: { screenId: { type: 'string' }, blockId: { type: 'string' } },
      required: ['screenId', 'blockId'],
    },
  },
  {
    name: 'studio_move_block',
    description: 'Reorder a block within its screen: `dir` -1 moves it earlier, 1 later.',
    inputSchema: {
      type: 'object',
      properties: { screenId: { type: 'string' }, blockId: { type: 'string' }, dir: { type: 'number', enum: [-1, 1] } },
      required: ['screenId', 'blockId', 'dir'],
    },
  },
  {
    name: 'studio_update_screen',
    description: 'Update a screen: title, route, nav entry, CSS class, or `renderMode`. Set renderMode "ssr" to emit idiomatic SvelteKit (a +page.server.ts `load` + form `actions`, progressive enhancement) instead of the default client-fetch SPA page; it applies to memory/sql-backed screens whose blocks are a single grid or read-only blocks, and falls back to "spa" otherwise.',
    inputSchema: {
      type: 'object',
      properties: {
        screenId: { type: 'string' },
        title: { type: 'string' },
        route: { type: 'string' },
        className: { type: 'string' },
        renderMode: { type: 'string', enum: ['spa', 'ssr'], description: 'Output shape for this screen.' },
        nav: { type: 'object', description: '{ show?: boolean, label?: string }.' },
      },
      required: ['screenId'],
    },
  },
  {
    name: 'studio_remove_screen',
    description: 'Remove a screen (and its blocks) from the project.',
    inputSchema: { type: 'object', properties: { screenId: { type: 'string' } }, required: ['screenId'] },
  },
  {
    name: 'studio_set_screen_layout',
    description: 'Set how a screen arranges its blocks: grid (12-column, default) | stack (single column) | split (locked resizable panes) | dock (draggable/tabbable workspace) | canvas (free-form cell placement).',
    inputSchema: {
      type: 'object',
      properties: { screenId: { type: 'string' }, layout: { type: 'string', enum: ['grid', 'stack', 'split', 'dock', 'canvas'] } },
      required: ['screenId', 'layout'],
    },
  },
  {
    name: 'studio_set_form_layout',
    description:
      'Arrange an entity\'s create/edit form: column count and titled sections. `sections` is an array of { title?, description?, columns?: 1|2|3, fields: string[], visibleWhen?: PredicateExpr }; `fields` gives both the grouping and the order, and a field left out of every section still renders in a trailing untitled group. Omit `sections` and pass "suggest": true to have them proposed from the field names. The layout lives on the entity, so it renders the same in the edit panel, the generated app, and a server-rendered form.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: { type: 'string' },
        columns: { type: 'number', enum: [1, 2, 3] },
        sections: { type: 'array', items: { type: 'object' }, description: 'The FormSection list. Replaces the current one.' },
        suggest: { type: 'boolean', description: 'Propose sections from the field names instead of passing them.' },
      },
      required: ['entity'],
    },
  },
  {
    name: 'studio_set_field_conditions',
    description:
      'Make a form field value-driven: `visible`, `required`, and `disabled` conditions, each a PredicateExpr over the other fields, e.g. { "kind": "cmp", "column": "status", "op": "equals", "value": "cancelled" }. A field hidden by `visible` is skipped by validation and left out of the saved record; `required` REPLACES the field\'s static required flag (so it can make a required field optional too). Pass a condition as null to clear it, or omit every condition to clear all three. Conditions are data, so they generate into the app and re-run server-side.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: { type: 'string' },
        field: { type: 'string' },
        visible: { type: ['object', 'null'], description: 'PredicateExpr, or null to clear.' },
        required: { type: ['object', 'null'], description: 'PredicateExpr, or null to clear.' },
        disabled: { type: ['object', 'null'], description: 'PredicateExpr, or null to clear.' },
      },
      required: ['entity', 'field'],
    },
  },
  {
    name: 'studio_set_entity_source',
    description: 'Bind an entity to a data source. `source` is an EntityDataSource, e.g. { "kind": "sql", "table": "customers", "dialect": "postgres" } | { "kind": "memory" } | { "kind": "pglite", "table": "..." } | { "kind": "supabase", ... } | { "kind": "rest", ... }.',
    inputSchema: {
      type: 'object',
      properties: { entity: { type: 'string' }, source: { type: 'object', description: 'The EntityDataSource.' } },
      required: ['entity', 'source'],
    },
  },
  {
    name: 'studio_set_theme',
    description: 'Set the theme preset + mode + accent. Presets come from studio_capabilities.',
    inputSchema: {
      type: 'object',
      properties: { preset: { type: 'string' }, mode: { type: 'string', enum: ['light', 'dark'] }, accent: { type: 'string', description: 'Hex accent color.' } },
    },
  },
  {
    name: 'studio_set_access',
    description: 'Configure role-based access control (RBAC). `roles` is an array of { role, screens: "*"|string[], actions: "*"|("create"|"update"|"delete")[] }.',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        roles: { type: 'array', items: { type: 'object' } },
        defaultRole: { type: 'string' },
      },
      required: ['enabled'],
    },
  },
  {
    name: 'studio_set_auth',
    description: 'Configure the authentication starter. Options: enabled, protect, register, userAdmin, twoFactor, email, oauth (["github","google","oidc"]). register/userAdmin/oauth/2FA need the Drizzle data layer + a SQL entity; userAdmin also needs RBAC.',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        protect: { type: 'boolean' },
        register: { type: 'boolean' },
        userAdmin: { type: 'boolean' },
        twoFactor: { type: 'boolean' },
        email: { type: 'boolean' },
        oauth: { type: 'array', items: { type: 'string', enum: ['github', 'google', 'oidc'] } },
      },
      required: ['enabled'],
    },
  },
  {
    name: 'studio_set_data_layer',
    description: 'Turn the typed Drizzle data layer (schema.ts + typed repos + drizzle-kit migrations) on or off. Applies to SQL-bound entities.',
    inputSchema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] },
  },
  {
    name: 'studio_set_tenancy',
    description: 'Turn multi-tenancy on/off: every row is scoped to the signed-in user\'s tenant, enforced SERVER-side in each API route (reads filtered, creates stamped, update/delete ownership-checked). Requires auth + the Drizzle data layer + a SQL entity; without them it degrades to off. `sharedEntities` stay global (reference/lookup tables every tenant reads).',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        field: { type: 'string', description: "Scoping column. Default 'tenantId'." },
        sharedEntities: { type: 'array', items: { type: 'string' }, description: 'Entities to leave global.' },
      },
      required: ['enabled'],
    },
  },
  {
    name: 'studio_set_job',
    description: 'Add, replace, or remove a scheduled background job. Emits a secret-guarded /api/cron route plus the schedule config for the deploy target (vercel.json crons on Vercel, a GitHub Actions schedule elsewhere). `kind`:"email" sends a summary of `entity` to `to` (needs auth email enabled); `kind`:"code" runs a body you supply. Omit `cron` to REMOVE the job.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable job id.' },
        name: { type: 'string', description: 'Human label.' },
        cron: { type: 'string', description: "5-field cron in UTC, e.g. '0 6 * * *'. Omit to remove the job." },
        kind: { type: 'string', enum: ['email', 'code'] },
        enabled: { type: 'boolean', description: 'Default true. A disabled job keeps its handler but is skipped by the scheduled run.' },
        entity: { type: 'string', description: 'email: entity to summarize.' },
        to: { type: 'string', description: 'email: recipient address.' },
        subject: { type: 'string', description: 'email: subject line (defaults to the job name).' },
        code: { type: 'string', description: 'code: the handler body (TypeScript).' },
      },
      required: ['id'],
    },
  },
  {
    name: 'studio_set_deploy_target',
    description: 'Set the deploy target: auto | vercel | netlify | cloudflare | node. Picks the SvelteKit adapter + emits provider config + a CI/CD pipeline.',
    inputSchema: { type: 'object', properties: { target: { type: 'string', enum: ['auto', 'vercel', 'netlify', 'cloudflare', 'node'] } }, required: ['target'] },
  },
  {
    name: 'studio_validate',
    description: 'Validate the current project. Returns any errors (block codegen) + warnings.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'studio_generate_app',
    description: 'Generate the full runnable SvelteKit app from the current model - every file (routes, $lib, package.json, auth, data layer, CI/CD, studio.config.json). Returns [{ path, contents }]. Write them, then run the project\'s svelte-check to verify.',
    inputSchema: { type: 'object', properties: {} },
  },
]

// ---- dispatch -------------------------------------------------------------
/** Handle a studio_* project tool. Returns undefined if `name` isn't one of ours. */
export function handleProjectTool(name: string, args: Record<string, unknown>): ToolResult | undefined {
  try {
    switch (name) {
      case 'studio_new_project': {
        project = createProject([], { title: typeof args.title === 'string' ? args.title : 'My Studio App' })
        return ok(`New project "${project.title}" created (0 entities). Add entities with studio_add_entity.`)
      }
      case 'studio_load_project': {
        if (typeof args.config !== 'string') return fail('config (a studio.config.json string) is required.')
        project = parseProject(args.config)
        return ok('Project loaded.\n\n' + describe(project))
      }
      case 'studio_describe_project':
        return ok(describe(requireProject()))
      case 'studio_get_config':
        return ok(serializeProject(requireProject()))
      case 'studio_capabilities':
        return ok(JSON.stringify({
          blockKinds: blockPalette.map((b) => ({ kind: b.kind, label: b.label, needs: b.needs })),
          components: UI_COMPONENT_REGISTRY.map((c) => ({ key: c.key, label: c.label, category: c.category })),
          themePresets: studioThemes.map((t) => ({ id: t.id, name: t.name })),
          dataSourceKinds: ['memory', 'sql', 'supabase', 'rest', 'pglite'],
          deployTargets: ['auto', 'vercel', 'netlify', 'cloudflare', 'node'],
        }, null, 2))

      case 'studio_add_entity': {
        const p = requireProject()
        const schema = resolveSchema(args as Parameters<typeof resolveSchema>[0])
        project = addEntity(p, schema)
        const screen = project.screens.find((s) => s.entity === schema.name)
        return confirm(`Added entity "${schema.name}" (${schema.fields.length} fields) + screen id=${screen?.id ?? '?'}.`)
      }
      case 'studio_add_screen': {
        const p = requireProject()
        const before = new Set(p.screens.map((s) => s.id))
        if (typeof args.entity === 'string' && args.entity) {
          project = addScreen(p, args.entity)
        } else {
          if (typeof args.title !== 'string' || !args.title) return fail('A freestanding screen needs a `title` (or pass `entity`).')
          project = addFreestandingScreen(p, { title: args.title, route: typeof args.route === 'string' ? args.route : undefined })
        }
        if (project === p) return fail(`Could not add the screen (unknown entity "${String(args.entity)}"?).`)
        const added = project.screens.find((s) => !before.has(s.id))
        return confirm(`Added screen id=${added?.id ?? '?'} (/${added?.route ?? '?'}).`)
      }
      case 'studio_add_block': {
        const p = requireProject()
        const screenId = String(args.screenId ?? '')
        const kind = String(args.kind ?? '') as BlockKind
        const screen = p.screens.find((s) => s.id === screenId)
        if (!screen) return fail(`No screen id=${screenId}. Call studio_describe_project.`)
        const before = new Set(flattenBlocks(screen.blocks).map((b) => b.id))
        project = addBlock(p, screenId, kind)
        const now = project.screens.find((s) => s.id === screenId)!
        const added = flattenBlocks(now.blocks).find((b) => !before.has(b.id))
        if (!added) return fail(`Could not add a "${kind}" block (needs a bound entity, or unknown kind).`)
        return confirm(`Added ${kind} block id=${added.id} to screen ${screenId}.`)
      }
      case 'studio_add_component': {
        const p = requireProject()
        const screenId = String(args.screenId ?? '')
        const component = String(args.component ?? '')
        if (!p.screens.some((s) => s.id === screenId)) return fail(`No screen id=${screenId}.`)
        const spec = uiComponentSpec(component)
        if (!spec) return fail(`Unknown component "${component}". See studio_capabilities.`)
        const defaults: Record<string, unknown> = {}
        for (const pr of spec.props) if (pr.default != null) defaults[pr.key] = pr.default
        if (spec.hasContent) defaults._content = spec.contentDefault ?? spec.label
        const merged = { ...defaults, ...((args.props as Record<string, unknown>) ?? {}) }
        project = addComponentBlock(p, screenId, component, merged)
        return confirm(`Added component "${component}" to screen ${screenId}.`)
      }
      case 'studio_update_block': {
        const p = requireProject()
        const screenId = String(args.screenId ?? '')
        const blockId = String(args.blockId ?? '')
        const screen = p.screens.find((s) => s.id === screenId)
        if (!screen) return fail(`No screen id=${screenId}. Call studio_describe_project.`)
        const block = flattenBlocks(screen.blocks).find((b) => b.id === blockId)
        if (!block) return fail(`No block id=${blockId} on screen ${screenId}.`)
        const patch: Parameters<typeof updateBlock>[3] = {}
        if (args.config && typeof args.config === 'object') patch.config = args.config as Parameters<typeof updateBlock>[3]['config']
        if (typeof args.span === 'number') patch.span = args.span as 1 | 2 | 3
        if (typeof args.colSpan === 'number') patch.colSpan = args.colSpan
        if (typeof args.height === 'number') patch.height = args.height
        if (typeof args.className === 'string') patch.className = args.className
        if (Object.keys(patch).length === 0) return fail('Nothing to update - pass config, span, colSpan, height, or className.')
        project = updateBlock(p, screenId, blockId, patch)
        return confirm(`Updated ${block.config.kind} block ${blockId} (${Object.keys(patch).join(', ')}).`)
      }
      case 'studio_remove_block': {
        const p = requireProject()
        const screenId = String(args.screenId ?? '')
        const blockId = String(args.blockId ?? '')
        const screen = p.screens.find((s) => s.id === screenId)
        if (!screen) return fail(`No screen id=${screenId}.`)
        if (!flattenBlocks(screen.blocks).some((b) => b.id === blockId)) return fail(`No block id=${blockId} on screen ${screenId}.`)
        project = removeBlock(p, screenId, blockId)
        return confirm(`Removed block ${blockId} from screen ${screenId}.`)
      }
      case 'studio_move_block': {
        const p = requireProject()
        const screenId = String(args.screenId ?? '')
        const blockId = String(args.blockId ?? '')
        const dir = args.dir === -1 ? -1 : args.dir === 1 ? 1 : null
        if (dir === null) return fail('dir must be -1 (earlier) or 1 (later).')
        const screen = p.screens.find((s) => s.id === screenId)
        if (!screen) return fail(`No screen id=${screenId}.`)
        if (!flattenBlocks(screen.blocks).some((b) => b.id === blockId)) return fail(`No block id=${blockId} on screen ${screenId}.`)
        project = moveBlock(p, screenId, blockId, dir)
        return confirm(`Moved block ${blockId} ${dir === -1 ? 'earlier' : 'later'}.`)
      }
      case 'studio_update_screen': {
        const p = requireProject()
        const screenId = String(args.screenId ?? '')
        if (!p.screens.some((s) => s.id === screenId)) return fail(`No screen id=${screenId}.`)
        const patch: Parameters<typeof updateScreen>[2] = {}
        if (typeof args.title === 'string') patch.title = args.title
        if (typeof args.route === 'string') patch.route = args.route
        if (typeof args.className === 'string') patch.className = args.className
        if (args.renderMode === 'ssr' || args.renderMode === 'spa') patch.renderMode = args.renderMode
        if (args.nav && typeof args.nav === 'object') patch.nav = args.nav as Parameters<typeof updateScreen>[2]['nav']
        if (Object.keys(patch).length === 0) return fail('Nothing to update - pass title, route, className, renderMode, or nav.')
        project = updateScreen(p, screenId, patch)
        // renderMode is a request, not a guarantee: the emitter falls back to the
        // SPA page when a screen's blocks or source don't fit the SSR shape.
        const ssrNote = patch.renderMode === 'ssr'
          ? ' SSR applies to memory/sql screens whose blocks are a single grid or read-only blocks; other screens still emit the SPA page.'
          : ''
        return confirm(`Updated screen ${screenId} (${Object.keys(patch).join(', ')}).${ssrNote}`)
      }
      case 'studio_remove_screen': {
        const p = requireProject()
        const screenId = String(args.screenId ?? '')
        if (!p.screens.some((s) => s.id === screenId)) return fail(`No screen id=${screenId}.`)
        project = removeScreen(p, screenId)
        return confirm(`Removed screen ${screenId}.`)
      }
      case 'studio_set_screen_layout': {
        const p = requireProject()
        const screenId = String(args.screenId ?? '')
        const layout = String(args.layout ?? '')
        const allowed = ['grid', 'stack', 'split', 'dock', 'canvas']
        if (!p.screens.some((s) => s.id === screenId)) return fail(`No screen id=${screenId}.`)
        if (!allowed.includes(layout)) return fail(`layout must be one of: ${allowed.join(' | ')}.`)
        project = setScreenLayout(p, screenId, layout as Parameters<typeof setScreenLayout>[2])
        return confirm(`Screen ${screenId} now uses the ${layout} layout.`)
      }
      case 'studio_set_form_layout': {
        const p = requireProject()
        const entity = String(args.entity ?? '')
        const schema = p.entities.find((e) => e.name === entity)
        if (!schema) return fail(`No entity "${entity}".`)
        const columns = args.columns === undefined ? schema.form?.columns : (Number(args.columns) as 1 | 2 | 3)
        if (columns !== undefined && ![1, 2, 3].includes(columns)) return fail('columns must be 1, 2, or 3.')
        let sections = schema.form?.sections
        if (args.suggest) {
          sections = suggestFormSections(schema)
          if (!sections.length) return fail(`Nothing to suggest for "${entity}" - too few form fields to be worth grouping.`)
        } else if (args.sections !== undefined) {
          if (!Array.isArray(args.sections)) return fail('sections must be an array of FormSection objects.')
          sections = args.sections as NonNullable<typeof sections>
        }
        // Plan before storing: a name that resolves to nothing (a typo, or a
        // field since renamed) is dropped here rather than persisted into
        // `studio.config.json` for a later reader to puzzle over. The reply
        // reports the plan, so the agent sees what actually landed.
        const plan = formPlan(schema, sections)
        project = setEntityForm(p, entity, { columns, sections: plan.sections })
        const placed = plan.sections.map((s) => `${s.title ?? '(untitled)'}: ${s.fields.join(', ') || '(empty)'}`)
        return confirm(
          `"${entity}" form: ${columns ?? 2} columns, ${plan.sections.length} section(s).` +
            (placed.length ? `\n${placed.join('\n')}` : '') +
            (plan.unassigned.length ? `\nUnsectioned (render last): ${plan.unassigned.join(', ')}` : ''),
        )
      }
      case 'studio_set_field_conditions': {
        const p = requireProject()
        const entity = String(args.entity ?? '')
        const field = String(args.field ?? '')
        const schema = p.entities.find((e) => e.name === entity)
        if (!schema) return fail(`No entity "${entity}".`)
        if (!schema.fields.some((f) => f.field === field)) return fail(`No field "${field}" on "${entity}".`)
        const current = schema.fields.find((f) => f.field === field)!.when ?? {}
        const keys = ['visible', 'required', 'disabled'] as const
        // Absent = leave as it was; null = clear it. Without that distinction an
        // agent setting one condition would silently drop the other two.
        const given = keys.filter((k) => args[k] !== undefined)
        const when = given.length
          ? Object.fromEntries(keys.map((k) => [k, args[k] === undefined ? current[k] : (args[k] || undefined)]))
          : undefined
        const next = setFieldConditions(p, entity, field, when)
        project = next
        const set = keys.filter((k) => next.entities.find((e) => e.name === entity)!.fields.find((f) => f.field === field)!.when?.[k])
        return confirm(set.length ? `"${entity}.${field}" is now conditional on: ${set.join(', ')}.` : `Cleared the conditions on "${entity}.${field}".`)
      }
      case 'studio_set_entity_source': {
        const p = requireProject()
        const entity = String(args.entity ?? '')
        if (!p.entities.some((e) => e.name === entity)) return fail(`No entity "${entity}".`)
        if (!args.source || typeof args.source !== 'object') return fail('source (an EntityDataSource object) is required.')
        project = setEntityDataSource(p, entity, args.source as EntityDataSource)
        return confirm(`Bound "${entity}" to ${(args.source as { kind?: string }).kind} source.`)
      }
      case 'studio_set_theme': {
        const p = requireProject()
        const mode: 'light' | 'dark' | undefined = args.mode === 'dark' ? 'dark' : args.mode === 'light' ? 'light' : undefined
        const theme = {
          ...(p.theme ?? {}),
          ...(typeof args.preset === 'string' ? { preset: args.preset } : {}),
          ...(mode ? { mode } : {}),
          ...(typeof args.accent === 'string' ? { accent: args.accent } : {}),
        }
        project = setTheme(p, theme)
        return confirm(`Theme set: preset=${theme.preset ?? 'default'} mode=${theme.mode ?? 'light'}.`)
      }
      case 'studio_set_access': {
        const p = requireProject()
        if (!args.enabled) { const { access: _drop, ...rest } = p; project = rest as StudioProject; return confirm('RBAC disabled.') }
        const roles = Array.isArray(args.roles) && args.roles.length ? (args.roles as AccessControl['roles']) : [{ role: 'admin', screens: '*' as const, actions: '*' as const }, { role: 'viewer', screens: '*' as const, actions: [] }]
        project = { ...p, access: { enabled: true, roles, ...(typeof args.defaultRole === 'string' ? { defaultRole: args.defaultRole } : {}) } }
        return confirm(`RBAC enabled with roles [${roles.map((r) => r.role).join(', ')}].`)
      }
      case 'studio_set_auth': {
        const p = requireProject()
        project = setAuth(p, {
          enabled: args.enabled !== false,
          ...(typeof args.protect === 'boolean' ? { protect: args.protect } : {}),
          ...(typeof args.register === 'boolean' ? { register: args.register } : {}),
          ...(typeof args.userAdmin === 'boolean' ? { userAdmin: args.userAdmin } : {}),
          ...(typeof args.twoFactor === 'boolean' ? { twoFactor: args.twoFactor } : {}),
          ...(typeof args.email === 'boolean' ? { email: args.email } : {}),
          ...(Array.isArray(args.oauth) ? { oauth: args.oauth as ('github' | 'google' | 'oidc')[] } : {}),
        })
        return confirm(project.auth?.enabled ? 'Auth enabled.' : 'Auth disabled.')
      }
      case 'studio_set_data_layer': {
        project = setDataLayer(requireProject(), args.enabled !== false)
        return confirm(project.dataLayer === 'drizzle' ? 'Drizzle data layer enabled.' : 'Data layer disabled.')
      }
      case 'studio_set_tenancy': {
        const p = requireProject()
        const enabled = args.enabled === true
        if (!enabled) {
          project = setTenancy(p, null)
          return confirm('Multi-tenancy off.')
        }
        const shared = Array.isArray(args.sharedEntities) ? (args.sharedEntities as unknown[]).map(String) : undefined
        const unknown = (shared ?? []).filter((e) => !p.entities.some((x) => x.name === e))
        if (unknown.length) return fail(`Unknown entities in sharedEntities: ${unknown.join(', ')}.`)
        project = setTenancy(p, {
          enabled: true,
          ...(typeof args.field === 'string' && args.field ? { field: args.field } : {}),
          ...(shared?.length ? { sharedEntities: shared } : {}),
        })
        // Tenancy silently no-ops without its prerequisites, so say so here rather
        // than letting the agent believe an unscoped app is scoped.
        const missing = [
          p.auth?.enabled === true ? null : 'auth (studio_set_auth)',
          p.dataLayer === 'drizzle' ? null : 'the Drizzle data layer (studio_set_data_layer)',
          p.entities.some((e) => entityDataSource(p, e.name).kind === 'sql') ? null : 'a SQL-bound entity (studio_set_entity_source)',
        ].filter(Boolean)
        const note = missing.length
          ? ` NOT YET ENFORCED - still needs: ${missing.join(', ')}.`
          : ' Enforced server-side on every SQL route.'
        return confirm(`Multi-tenancy on (column "${typeof args.field === 'string' && args.field ? args.field : 'tenantId'}").${note}`)
      }
      case 'studio_set_job': {
        const p = requireProject()
        const id = String(args.id ?? '')
        if (!id) return fail('id is required.')
        // No cron = remove. Keeps one tool for the whole lifecycle.
        if (!args.cron) {
          if (!(p.jobs ?? []).some((j) => j.id === id)) return fail(`No job "${id}" to remove.`)
          project = setJob(p, id, null)
          return confirm(`Removed job "${id}".`)
        }
        const kind = args.kind === 'email' ? 'email' : 'code'
        if (kind === 'email') {
          if (!args.to) return fail('An email job needs `to`.')
          if (!args.entity || !p.entities.some((e) => e.name === args.entity)) {
            return fail(`An email job needs a known \`entity\`${args.entity ? ` (no entity "${String(args.entity)}")` : ''}.`)
          }
          if (p.auth?.email !== true) {
            return fail('An email job needs the email layer: call studio_set_auth with { enabled: true, email: true } first.')
          }
        }
        project = setJob(p, id, {
          name: String(args.name ?? id),
          cron: String(args.cron),
          kind,
          ...(args.enabled === false ? { enabled: false } : {}),
          ...(typeof args.entity === 'string' ? { entity: args.entity } : {}),
          ...(typeof args.to === 'string' ? { to: args.to } : {}),
          ...(typeof args.subject === 'string' ? { subject: args.subject } : {}),
          ...(typeof args.code === 'string' ? { code: args.code } : {}),
        })
        return confirm(`Job "${id}" scheduled at ${String(args.cron)} (${kind}).`)
      }
      case 'studio_set_deploy_target': {
        const t = String(args.target ?? 'auto') as 'auto' | 'vercel' | 'netlify' | 'cloudflare' | 'node'
        project = setDeployTarget(requireProject(), t)
        return confirm(`Deploy target: ${t}.`)
      }
      case 'studio_validate': {
        const issues = validateProject(requireProject())
        if (!issues.length) return ok('Valid: no errors or warnings.')
        return ok(issues.map((i) => `[${i.level}] ${i.message}`).join('\n'))
      }
      case 'studio_generate_app': {
        const p = requireProject()
        if (p.entities.length === 0) return fail('Add at least one entity before generating (studio_add_entity).')
        const errs = validateProject(p).filter((i) => i.level === 'error')
        if (errs.length) return fail('Fix these errors first:\n' + errs.map((e) => '  - ' + e.message).join('\n'))
        const files = emitStudioAppBundle(p)
        return ok(studioNote() + `// ${files.length} files. Write them all, then run svelte-check.\n\n` + JSON.stringify(files.map((f) => ({ path: f.path, contents: f.contents })), null, 2))
      }
      default:
        return undefined
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
}
