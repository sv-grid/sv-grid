/**
 * SvelteKit transport - the deep integration an agnostic grid can't ship.
 *
 * Two halves that speak one small JSON protocol over a single route:
 *
 *   - `createKitDataSource({ endpoint })` runs in the browser (or a `load`
 *     function) and returns a `ServerDataSource` that POSTs requests to your
 *     endpoint. Drop it straight into `createServerDataSource`.
 *
 *   - `createKitHandlers({ schema, source })` runs on the server and returns a
 *     `POST` handler for a `+server.ts` route. It parses the protocol, calls
 *     your backend `ServerDataSource` (in-memory, SQL, Drizzle, ...), and
 *     returns JSON.
 *
 * Example `src/routes/api/customers/+server.ts`:
 *
 *     import { createKitHandlers } from '@svgrid/enterprise'
 *     import { customerSchema, customerSource } from '$lib/customers'
 *     export const { POST } = createKitHandlers({ schema: customerSchema, source: customerSource })
 *
 * Client:
 *
 *     const source = createKitDataSource({ endpoint: '/api/customers' })
 *     const controller = createServerDataSource(source, { onChange: ... })
 */
import type {
  RowData,
  ServerDataSource,
  ServerRequest,
  ServerResult,
} from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { validateAll } from '../edit-panel'
import type { WritableDataSource } from './types'

/** Wire protocol: the single JSON body shape the client POSTs and the server dispatches on. */
export type KitMessage<TData> =
  | { kind: 'query'; request: ServerRequest }
  | { kind: 'mutate'; op: 'create'; input: Partial<TData> }
  | { kind: 'mutate'; op: 'update'; id: string; patch: Partial<TData> }
  | { kind: 'mutate'; op: 'delete'; id: string }

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// --- client ---------------------------------------------------------------

export type KitDataSourceOptions = {
  /** Route that `createKitHandlers` is mounted on, e.g. `'/api/customers'`. */
  endpoint: string
  /**
   * Fetch implementation. Pass SvelteKit's event `fetch` inside a `load` so
   * requests are same-origin and SSR-safe; defaults to the global `fetch`.
   */
  fetch?: FetchLike
}

export function createKitDataSource<TData extends RowData>(
  options: KitDataSourceOptions,
): WritableDataSource<TData> {
  const doFetch: FetchLike = options.fetch ?? ((i, init) => fetch(i, init))

  async function post<T>(body: KitMessage<TData>): Promise<T> {
    const res = await doFetch(options.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`svgrid kit: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`)
    }
    return (await res.json()) as T
  }

  return {
    getRows: (request) => post<ServerResult<TData>>({ kind: 'query', request }),
    createRow: (input) => post<TData>({ kind: 'mutate', op: 'create', input }),
    updateRow: (id, patch) => post<TData>({ kind: 'mutate', op: 'update', id, patch }),
    deleteRow: (id) => post<void>({ kind: 'mutate', op: 'delete', id }).then(() => undefined),
  }
}

// --- server ---------------------------------------------------------------

/** The CRUD action a Kit message maps to (`query` -> `read`). */
export type KitAction = 'read' | 'create' | 'update' | 'delete'
/** Context passed to the `authorize` guard before every op. */
export type KitAuthorizeContext<TData extends RowData> = {
  action: KitAction
  /** The SvelteKit request event, so you can read `locals` / session for the
   *  caller's role or user id. Only `request` is guaranteed in non-Kit callers. */
  event: { request: Request; locals?: Record<string, unknown> }
  message: KitMessage<TData>
}

/** A field-error map (`{ field: message }`); empty/undefined means valid. */
export type KitFieldErrors = Record<string, string>
/** Context passed to a custom `validate` function before a create / update. */
export type KitValidateContext<TData extends RowData> = {
  action: 'create' | 'update'
  values: Partial<TData>
  event: { request: Request; locals?: Record<string, unknown> }
}

export type KitHandlerOptions<TData extends RowData> = {
  schema: EntitySchema<TData>
  source: ServerDataSource<TData>
  /**
   * Optional server-side guard run BEFORE every op. Return `false` (or throw) to
   * reject the request with `403`. Receives the SvelteKit event, so you can read
   * `event.locals` / the session to resolve the caller's role - this is where
   * server-enforced authorization (RBAC) lives, independent of any client UI.
   */
  authorize?: (ctx: KitAuthorizeContext<TData>) => boolean | Promise<boolean>
  /**
   * Server-enforced validation, run BEFORE a create / update reaches the source.
   * - `true`: validate the payload against the `schema`'s declarative constraints
   *   (required, min/max, length, pattern, email/url, per-field + cross-field
   *   rules) via `validateAll`. Updates validate only the fields present in the
   *   patch. Defect payloads are rejected with `422 { error, fieldErrors }`.
   * - a function: your own check returning a `{ field: message }` map (non-empty
   *   -> 422).
   * Default off, so existing routes are unchanged; the Studio generator turns it
   * on. Enforcing here means a client that skips its form validation still can't
   * write bad data.
   */
  validate?: boolean | ((ctx: KitValidateContext<TData>) => KitFieldErrors | null | undefined | Promise<KitFieldErrors | null | undefined>)
  /**
   * Called AFTER a successful create / update / delete with the change details,
   * so you can write an audit record (who / what / when). Receives the SvelteKit
   * event for `locals` (the actor). Best-effort: a throw here is swallowed and
   * logged, so an audit-sink hiccup never fails the underlying write.
   */
  audit?: (entry: KitAuditEntry<TData>) => void | Promise<void>
}

/** The change details handed to the `audit` hook after a successful mutation. */
export type KitAuditEntry<TData extends RowData> = {
  action: 'create' | 'update' | 'delete'
  /** The affected row's id. */
  id: string | null
  /** Submitted values: create input / update patch. Undefined for delete. */
  values?: Partial<TData>
  /** The row the source returned (create / update). Undefined for delete. */
  result?: TData
  event: { request: Request; locals?: Record<string, unknown> }
}

export type KitHandlers = {
  /** SvelteKit `+server.ts` route handler. Export it as `export const { POST } = ...`. */
  POST: (event: { request: Request; locals?: Record<string, unknown> }) => Promise<Response>
  /** Lower-level dispatcher over a raw `Request`, for custom wiring or tests. */
  handle: (request: Request, event?: { locals?: Record<string, unknown> }) => Promise<Response>
}

const actionOf = <TData extends RowData>(msg: KitMessage<TData>): KitAction =>
  msg.kind === 'query' ? 'read' : msg.op

export function createKitHandlers<TData extends RowData>(
  options: KitHandlerOptions<TData>,
): KitHandlers {
  const { source, authorize, validate, audit } = options
  const idField = options.schema.idField ?? options.schema.fields.find((f) => f.primaryKey)?.field ?? 'id'
  const rowId = (row: unknown): string | null => {
    const v = (row as Record<string, unknown> | null)?.[idField]
    return v == null ? null : String(v)
  }
  // Best-effort: never let an audit-sink error fail the write it's recording.
  const fireAudit = async (entry: KitAuditEntry<TData>) => {
    if (!audit) return
    try { await audit(entry) } catch (err) { console.error('svgrid kit: audit hook failed', err) }
  }

  async function handle(request: Request, event?: { locals?: Record<string, unknown> }): Promise<Response> {
    let msg: KitMessage<TData>
    try {
      msg = (await request.json()) as KitMessage<TData>
    } catch {
      return jsonResponse({ error: 'invalid JSON body' }, 400)
    }

    // Authorize BEFORE touching the source. A thrown guard is treated as a deny.
    if (authorize) {
      let allowed: boolean
      try {
        allowed = await authorize({ action: actionOf(msg), event: { request, locals: event?.locals }, message: msg })
      } catch (err) {
        return jsonResponse({ error: err instanceof Error ? err.message : 'forbidden' }, 403)
      }
      if (!allowed) return jsonResponse({ error: 'forbidden' }, 403)
    }

    // Validate create / update payloads BEFORE the source. 422 on field errors.
    if (validate && msg.kind === 'mutate' && (msg.op === 'create' || msg.op === 'update')) {
      const values = (msg.op === 'create' ? msg.input : msg.patch) as Partial<TData>
      let errors: KitFieldErrors | null | undefined
      if (validate === true) {
        const all = await validateAll(options.schema, values as Record<string, unknown>)
        // On update, only the supplied fields are validated (a patch omits the rest).
        errors = msg.op === 'update'
          ? Object.fromEntries(Object.keys(values).filter((k) => all[k]).map((k) => [k, all[k]!]))
          : all
      } else {
        errors = await validate({ action: msg.op, values, event: { request, locals: event?.locals } })
      }
      if (errors && Object.keys(errors).length) {
        return jsonResponse({ error: 'validation failed', fieldErrors: errors }, 422)
      }
    }

    try {
      if (msg.kind === 'query') {
        const result = await source.getRows(msg.request)
        return jsonResponse(result)
      }
      if (msg.kind === 'mutate') {
        const evt = { request, locals: event?.locals }
        if (msg.op === 'create') {
          if (!source.createRow) return jsonResponse({ error: 'create not supported' }, 405)
          const row = await source.createRow(msg.input)
          await fireAudit({ action: 'create', id: rowId(row), values: msg.input, result: row, event: evt })
          return jsonResponse(row)
        }
        if (msg.op === 'update') {
          if (!source.updateRow) return jsonResponse({ error: 'update not supported' }, 405)
          const row = await source.updateRow(msg.id, msg.patch)
          await fireAudit({ action: 'update', id: msg.id, values: msg.patch, result: row, event: evt })
          return jsonResponse(row)
        }
        if (msg.op === 'delete') {
          if (!source.deleteRow) return jsonResponse({ error: 'delete not supported' }, 405)
          await source.deleteRow(msg.id)
          await fireAudit({ action: 'delete', id: msg.id, event: evt })
          return jsonResponse({ ok: true })
        }
      }
      return jsonResponse({ error: 'unknown message kind' }, 400)
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500)
    }
  }

  return {
    handle,
    POST: (event) => handle(event.request, event),
  }
}
