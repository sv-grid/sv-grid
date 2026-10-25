/**
 * The MCP stdio transport this server needs, in place of
 * @modelcontextprotocol/sdk.
 *
 * The SDK carries HTTP transports and OAuth (Express, Hono, JOSE, AJV and
 * their dependencies), none of which a stdio server runs, and a cold
 * `npx -y @svgrid/mcp` spent its time installing them: 111 packages, 23 to 38
 * seconds to the `initialize` reply against a client's 30 second connect
 * timeout, with the server itself starting in 0.3 s.
 *
 * What MCP over stdio is: JSON-RPC 2.0, one message per line on stdin and
 * stdout. This answers `initialize` the way the SDK does (the client's
 * protocol version when it is one of SUPPORTED_PROTOCOL_VERSIONS, else the
 * latest), answers `ping`, and hands every other request to the handler
 * registered for its method. Unknown methods get -32601 and a handler that
 * throws gets -32603 with its message, as from the SDK. Notifications need no
 * reply: `notifications/initialized` and `notifications/cancelled` are
 * accepted and nothing else is sent. Requests run concurrently, as the SDK
 * runs them, so a slow first tools/call does not hold up a ping.
 */
import type { Readable, Writable } from 'node:stream'

export const LATEST_PROTOCOL_VERSION = '2025-11-25'
export const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, '2025-06-18', '2025-03-26', '2024-11-05', '2024-10-07']

export const ErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const

/** A request as a handler receives it, the same shape the SDK passed. */
export type McpRequest = { method: string; params: Record<string, any> }
type Handler = (request: McpRequest) => unknown | Promise<unknown>
type Message = { jsonrpc?: string; id?: string | number | null; method?: unknown; params?: unknown }

export class StdioMcpServer {
  private readonly handlers = new Map<string, Handler>()

  constructor(
    private readonly serverInfo: { name: string; version: string },
    private readonly options: { capabilities: Record<string, unknown>; instructions?: string },
  ) {}

  setRequestHandler(method: string, handler: Handler): void {
    this.handlers.set(method, handler)
  }

  /**
   * The reply to one message, or null when none is owed (a notification).
   * Exported for tests; connect() feeds it each line.
   */
  async handle(message: unknown): Promise<object | null> {
    const m = (message ?? {}) as Message
    const isRequest = m.id !== undefined && m.id !== null
    if (typeof m.method !== 'string') {
      return isRequest ? this.error(m.id!, ErrorCode.InvalidRequest, 'Invalid request: no method') : null
    }
    // A notification never gets a reply, whatever it is.
    if (!isRequest) return null
    const params = m.params && typeof m.params === 'object' ? (m.params as Record<string, any>) : {}
    try {
      if (m.method === 'initialize') return this.result(m.id!, this.initialize(params))
      if (m.method === 'ping') return this.result(m.id!, {})
      const handler = this.handlers.get(m.method)
      if (!handler) return this.error(m.id!, ErrorCode.MethodNotFound, `Method not found: ${m.method}`)
      return this.result(m.id!, (await handler({ method: m.method, params })) ?? {})
    } catch (err) {
      const e = err as { code?: unknown; message?: string; data?: unknown }
      const code = Number.isSafeInteger(e?.code) ? (e.code as number) : ErrorCode.InternalError
      return this.error(m.id!, code, e?.message ?? String(err), e?.data)
    }
  }

  /** Read requests from `input`, one per line, and write the replies to `output`. */
  connect(input: Readable = process.stdin, output: Writable = process.stdout): void {
    let buffer = ''
    const send = (reply: object | null) => {
      if (reply) output.write(JSON.stringify(reply) + '\n')
    }
    input.setEncoding('utf8')
    input.on('data', (chunk: string) => {
      buffer += chunk
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        if (!line.trim()) continue
        let message: unknown
        try {
          message = JSON.parse(line)
        } catch {
          send(this.error(null, ErrorCode.ParseError, 'Parse error: a line was not JSON'))
          continue
        }
        // Not awaited: each request answers when it is ready.
        void this.handle(message).then(send, (err) => process.stderr.write(`@svgrid/mcp: ${String(err)}\n`))
      }
    })
  }

  private initialize(params: Record<string, any>) {
    const requested = params.protocolVersion
    return {
      protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
      capabilities: this.options.capabilities,
      serverInfo: this.serverInfo,
      ...(this.options.instructions ? { instructions: this.options.instructions } : {}),
    }
  }

  private result(id: string | number, result: unknown) {
    return { jsonrpc: '2.0', id, result }
  }

  private error(id: string | number | null, code: number, message: string, data?: unknown) {
    return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } }
  }
}
