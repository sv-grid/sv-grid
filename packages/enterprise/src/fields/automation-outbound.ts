/**
 * Automation actions that leave the base: call a webhook, send an email.
 *
 * Both fill `{Field name}` tokens from the record. A webhook may also name
 * secrets, `{secret:SLACK_TOKEN}`, which only the server runner reads (from
 * its `secrets` option): in the browser such a webhook fails and says to run
 * the automation on the server, so a key never has to live in the page.
 */

type Row = Record<string, unknown>

/** POST (or PUT, PATCH) to a URL; `body` is a template, JSON by default. */
export type WebhookAction = {
  type: 'webhook'
  url: string
  method?: 'POST' | 'PUT' | 'PATCH'
  /** `Name: value` pairs; values may name fields and secrets. */
  headers?: Record<string, string>
  /** The request body. Empty: `{ automation, table, record }` with every field as text. */
  body?: string
}

/** An email, sent by the server runner's `sendEmail`. */
export type EmailAction = { type: 'email'; to: string; subject: string; body: string }

export type OutboundContext = {
  automation: string
  table: string
  record: Row | null
  /** A template with `{Field name}` filled in from the record. */
  fill: (template: string) => string
  /** Every field of the record as its cell shows it, by field name. */
  fields: () => Record<string, string>
  /** A secret by name; the browser runner has none. */
  secret?: (name: string) => string | undefined
  fetch?: typeof fetch
}

const SECRET = /\{secret:([A-Za-z0-9_.-]+)\}/g

function withSecrets(text: string, ctx: OutboundContext): string {
  return text.replace(SECRET, (_m, name: string) => {
    if (!ctx.secret) throw new Error(`{secret:${name}} is read on the server only; run this automation on the server`)
    const value = ctx.secret(name)
    if (value == null) throw new Error(`No secret named ${name}`)
    return value
  })
}

/** Fill a JSON body template: a field's text is escaped so the JSON stays valid. */
function fillJson(template: string, ctx: OutboundContext): string {
  const escaped = (s: string) => JSON.stringify(s).slice(1, -1)
  return template.replace(/\{([^{}\n]+)\}/g, (m, name: string) => (name.startsWith('secret:') ? m : escaped(ctx.fill(`{${name}}`))))
}

export async function callWebhook(action: WebhookAction, ctx: OutboundContext): Promise<string> {
  const doFetch = ctx.fetch ?? globalThis.fetch
  if (!doFetch) throw new Error('No fetch here to call the webhook with')
  const url = withSecrets(action.url.replace(/\{([^{}\n]+)\}/g, (m, name: string) => (name.startsWith('secret:') ? m : encodeURIComponent(ctx.fill(`{${name}}`)))), ctx)
  if (!/^https?:\/\//i.test(url)) throw new Error('A webhook URL starts with https:// or http://')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  for (const [k, v] of Object.entries(action.headers ?? {})) headers[k.toLowerCase()] = withSecrets(ctx.fill(v), ctx)
  const json = (headers['content-type'] ?? '').includes('json')
  const body = action.body?.trim()
    ? withSecrets(json ? fillJson(action.body, ctx) : ctx.fill(action.body), ctx)
    : JSON.stringify({ automation: ctx.automation, table: ctx.table, record: ctx.record ? { id: ctx.record.id ?? null, ...ctx.fields() } : null })
  const method = action.method ?? 'POST'
  const res = await doFetch(url, { method, headers, body })
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return url
    }
  })()
  if (!res.ok) throw new Error(`${method} ${host} answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`)
  return `${method} ${host}: ${res.status}`
}

export type OutgoingEmail = { to: string[]; subject: string; text: string }

export async function sendEmailAction(action: EmailAction, ctx: OutboundContext, send: ((email: OutgoingEmail) => Promise<unknown> | unknown) | undefined): Promise<string> {
  if (!send) throw new Error('Email is sent by the server runner; give createAutomationServer a sendEmail')
  const to = ctx.fill(action.to).split(/\s*[,;]\s*/).filter(Boolean)
  if (!to.length) throw new Error('No address to send to')
  await send({ to, subject: ctx.fill(action.subject), text: ctx.fill(action.body) })
  return `To ${to.join(', ')}: ${ctx.fill(action.subject)}`
}
