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
  setEntityDataSource,
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
