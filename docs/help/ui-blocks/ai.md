# AI assistant blocks

Screens for putting a language model in front of your users: a chat with
starter prompts, an ask bar over a table, and the assistant's settings page.
The blocks call the free AI helpers in `@svgrid/grid`
(`aiFilter`, `aiSummarize`, `aiFindAnomalies`) and are built from
`SvTextInput`, `SvButton`, `SvChip`, `SvGrid` and the form controls, themed
from the `--sg-*` tokens. They run offline with `mockAIProvider` until you
register your own model.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/ai"></div>

See them first with `npx @svgrid/ui try blocks/ai`. No project needed.

## Prompt suggestions

An empty chat over a 12-deal sales pipeline with four starter cards. A card
fills the input and sends it. "Unusual" questions go to `aiFindAnomalies`,
summary questions to `aiSummarize`, and the rest to `aiFilter`, which lists the
matching deals; a question `aiFilter` cannot turn into a filter falls through
to `aiSummarize`. The reply appears word by word, and Stop aborts the call and
keeps the words already shown.

<div data-docs-demo="574-block-ai-prompt-suggestions" data-height="600"></div>

`npx @svgrid/ui add ai-prompt-suggestions`

## Ask bar

An "Ask about your data" bar over 30 invoices in an `SvGrid`. A question runs
`aiFilter` with `apply: true`, so the filters and sort land on the grid, and the
answer card shows how the model read it and how many rows match. A question
that starts with "summarize" runs `aiSummarize` over the rows on screen.
Suggested queries sit in `SvChip`s, an empty question shows a field error, a
failed call shows an `SvAlert` with Try again, and Clear brings all rows back.

<div data-docs-demo="575-block-ai-ask-bar" data-height="720"></div>

`npx @svgrid/ui add ai-ask-bar`

## AI settings

The assistant's settings page: model in an `SvDropDownList`, temperature on an
`SvSlider`, reply length in an `SvNumberInput` (64 to 4,000 tokens), the system
prompt in an `SvTextArea` with a counter, and one `SvSwitchButton` per tool. The
preview card shows the request payload the settings produce, updated as you
change them. Save validates and confirms with a toast; Reset to defaults puts
the shipped values back.

<div data-docs-demo="576-block-ai-settings" data-height="840"></div>

`npx @svgrid/ui add ai-settings`

## Connecting your model

`setAIProvider` is global: every AI helper in the app calls the one provider
you register. The blocks never replace it. Before each call their cores check
`hasAIProvider()`; only when nothing is registered do they set
`mockAIProvider` for that one call and clear it afterwards. Register your
provider once and the blocks use it with no edits.

A provider is one async function. This is the type as `@svgrid/grid` defines
it:

```ts
export type AIProvider = (request: AIRequest) => Promise<string>

export type AIRequest = {
  prompt: string
  responseFormat?: 'text' | 'json'
  signal?: AbortSignal
  task: AITask
  maxOutputTokens?: number
}
```

Register it in the root layout, so it is set before any page mounts. It posts
to an endpoint in your own app and never sees the API key:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { setAIProvider, type AIProvider } from '@svgrid/grid'

  let { children } = $props()

  const provider: AIProvider = async ({ prompt, responseFormat, task, maxOutputTokens, signal }) => {
    const r = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, responseFormat, task, maxOutputTokens }),
      signal,
    })
    if (!r.ok) throw new Error(`AI request failed (${r.status})`)
    return r.text()
  }
  setAIProvider(provider)
</script>

{@render children()}
```

The endpoint holds the key in a private environment variable and forwards the
prompt to your model. Return the model's text as the response body:

```ts
// src/routes/api/ai/+server.ts
import { error, text } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
  // Check the user's session here before spending tokens on the request.
  const { prompt, responseFormat, maxOutputTokens } = await request.json()
  const r = await fetch(env.MODEL_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.MODEL_API_KEY}` },
    body: JSON.stringify({ prompt, max_tokens: maxOutputTokens ?? 600, json: responseFormat === 'json' }),
  })
  if (!r.ok) error(502, 'The model did not answer')
  const data = await r.json()
  return text(data.output)
}
```

Map the body and the response to whatever your model's API expects; the
shape above is a placeholder. Never put an API key in client code or in a
`PUBLIC_` variable: anything the browser loads, a user can read.

What each block sends:

- The helpers (`aiFilter`, `aiSummarize`, `aiFindAnomalies`) always ask for
  `responseFormat: 'json'` and parse the reply with `JSON.parse`, so tell the
  model to return strict JSON for those. If other code in your app calls the
  provider for free text, branch on `responseFormat` in your endpoint, not on
  `task`.
- The prompt suggestions block has no grid on screen, so its core passes the
  helpers an `AIRowSource`, a plain `{ getData: () => rows }` object. Pass
  your own rows as `createPromptChat({ deals })`. The ask bar's core takes the
  grid's api instead (`onApiReady={(a) => (bar.api = a)}`), because `aiFilter`
  with `apply: true` sets the grid's filters and sort.
- The settings block saves through `createAISettings({ onSave })`, which gets
  the settings object once the fields validate; the core copies it into `saved`
  when `onSave` resolves. Store it through your API and read it in
  `+server.ts` to pick the model, temperature, system prompt and tools for
  each request.

## Headless

Each block is a styled render of the core in its `<script module>`:
`createPromptChat()`, `createAskBar()` and `createAISettings()`. The chat and
ask bar cores hold the AI calls and the provider check
above, so a bare render keeps the same behaviour. Take one alone with
`npx @svgrid/ui add ai-prompt-suggestions --headless` (it writes
`ai-prompt-suggestions.svelte.ts`) and draw your own markup:

```svelte
<script lang="ts">
  import { createPromptChat } from './ai-prompt-suggestions.svelte.js'

  const chat = createPromptChat({ onStop: () => console.info('reply stopped') })
</script>

{#if chat.messages.length === 0}
  {#each chat.starters as s (s.title)}
    <button type="button" onclick={() => chat.useStarter(s)}>{s.title}</button>
  {/each}
{/if}
{#each chat.messages as m (m.id)}
  <p class={m.role}>{chat.thinking(m) ? 'Thinking...' : chat.visible(m)}</p>
{/each}
<form {...chat.formProps()}>
  <input aria-label="Message" bind:value={chat.draft} />
  {#if chat.busy}
    <button type="button" onclick={() => chat.stop()}>Stop</button>
  {:else}
    <button disabled={!chat.draft.trim()}>Send</button>
  {/if}
</form>
```

## See also

- [UI blocks overview](./index.md)
- [AI assistant helpers](../ai.md)
- [SvTextInput](../ui-components/sv-text-input.md)
- [SvSlider](../ui-components/sv-slider.md)
