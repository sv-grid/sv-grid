/**
 * Copilot backend for the CLI designer (`svgrid-studio designer --ai`): calls
 * Anthropic's Messages API with the request built by the tested enterprise core
 * and returns the validated, serialized project. Dependency-free by design -
 * a plain fetch, no SDK - so the CLI keeps running on bare Node. The API key
 * stays server-side (read from ANTHROPIC_API_KEY by the designer server).
 */
import { buildCopilotMessages, projectFromModelText, parseProject, serializeProject } from '@svgrid/enterprise/studio'

const API_URL = 'https://api.anthropic.com/v1/messages'
/** Overridable for teams pinning a model (SVGRID_COPILOT_MODEL). */
const DEFAULT_MODEL = 'claude-sonnet-5'

export type CopilotOptions = {
  apiKey: string
  model?: string
  /** Injectable for tests - no live calls in CI. */
  fetchImpl?: typeof fetch
}

/** One copilot round: instruction + current project JSON -> updated project JSON. */
export async function runCopilot(prompt: string, projectJson: string, opts: CopilotOptions): Promise<string> {
  const project = parseProject(projectJson)
  const { system, messages } = buildCopilotMessages(prompt, project)
  const doFetch = opts.fetchImpl ?? fetch
  const res = await doFetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.model ?? process.env.SVGRID_COPILOT_MODEL ?? DEFAULT_MODEL,
      max_tokens: 32000,
      system,
      messages,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`)
  }
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = (body.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
  if (!text) throw new Error('Anthropic API returned no text content.')
  return serializeProject(projectFromModelText(text))
}
