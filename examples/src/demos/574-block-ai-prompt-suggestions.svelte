<script lang="ts" module>
  /**
   * Prompt suggestions block - an empty assistant chat over a sales pipeline
   * with four starter prompt cards. A card fills the SvTextInput and sends it;
   * the question runs through the kit's AI helpers (aiFindAnomalies for
   * "unusual", aiFilter for list questions, aiSummarize for summaries and for
   * anything aiFilter cannot turn into a filter) and the reply is revealed
   * word by word with a Stop SvButton that cancels the call. SvBadge shows
   * whether a real model is connected. Pure UI-kit, --sg-* themed.
   *
   * Headless: createPromptChat() below owns the messages, the routing to the
   * AI helpers, the provider fallback, the word-by-word reveal and Stop with no
   * markup. The component under it is one styled render of that core; import
   * createPromptChat from this file (or `npx @svgrid/ui add
   * ai-prompt-suggestions --headless` for the core alone) to draw your own.
   */
  import {
    aiFilter, aiSummarize, aiFindAnomalies, setAIProvider, getAIProvider, hasAIProvider, mockAIProvider,
    type AIRowSource, type TableFeatures, type AIFilterClause,
  } from '@svgrid/grid'

  export type Deal = { value: number; company: string; owner: string; stage: string; region: string; close: string }
  export type ChatMessage = { id: number; role: 'user' | 'assistant'; text: string; words: number; stopped?: boolean }
  export type Starter = { title: string; hint: string; prompt: string }
  export type PromptChatOptions = {
    deals?: Deal[]
    starters?: Starter[]
    /** Milliseconds per revealed word. */
    revealMs?: number
    /** Called when the user presses Stop (not when New chat stops a reply). */
    onStop?: () => void
  }

  const SAMPLE: Deal[] = [
    ['Acme Foods', 'Morgan Lee', 'Negotiation', 'EMEA', 84000], ['Blue Harbor', 'Sasha Kim', 'Proposal', 'NA', 22500],
    ['Cobalt Labs', 'Riley Chen', 'Won', 'APAC', 61000], ['Delta Freight', 'Morgan Lee', 'Lost', 'EMEA', 38000],
    ['Evergreen Co', 'Jamie Ortiz', 'Proposal', 'LATAM', 15800], ['Fable Studio', 'Sasha Kim', 'Won', 'NA', 47200],
    ['Granite Health', 'Riley Chen', 'Negotiation', 'APAC', 132000], ['Harbor & Pine', 'Jamie Ortiz', 'Lost', 'NA', 9400],
    ['Ion Mobility', 'Morgan Lee', 'Proposal', 'EMEA', 56300], ['Juniper Bank', 'Sasha Kim', 'Negotiation', 'NA', 71900],
    ['Kestrel Air', 'Riley Chen', 'Lost', 'LATAM', 27600], ['Lumen Retail', 'Jamie Ortiz', 'Won', 'EMEA', 33100],
  ].map(([company, owner, stage, region, value], i) => ({
    value: Number(value), company: String(company), owner: String(owner), stage: String(stage), region: String(region),
    close: `2026-${String(10 + (i % 3)).padStart(2, '0')}-${String(3 + i * 2).padStart(2, '0')}`,
  }))

  const STARTERS: Starter[] = [
    { title: 'Biggest deals', hint: 'Over $50k, largest first', prompt: 'Show deals over $50k, highest first' },
    { title: 'What did we lose?', hint: 'Closed-lost this quarter', prompt: 'List the lost deals' },
    { title: 'Pipeline summary', hint: 'One paragraph for the weekly call', prompt: 'Summarize the Q4 pipeline' },
    { title: 'Anything unusual?', hint: 'Outliers worth a second look', prompt: 'Find unusual deals' },
  ]

  // setAIProvider is global: register your model once at app start (root
  // +layout.svelte) and every call below goes to it. Until then the core lends
  // itself mockAIProvider for one call at a time, so it runs offline, and it
  // never replaces a provider the app already set.
  async function withProvider<T>(run: () => Promise<T>): Promise<T> {
    if (hasAIProvider()) return run()
    setAIProvider(mockAIProvider)
    try { return await run() } finally { if (getAIProvider() === mockAIProvider) setAIProvider(null) }
  }

  const money = (n: number) => `$${n.toLocaleString('en-US')}`
  const line = (d: Deal) => `- ${d.company}, ${money(d.value)}, ${d.stage} (${d.owner})`
  const tokens = (text: string) => text.split(/(?<=\s)/)

  function matches(d: Deal, c: AIFilterClause): boolean {
    const v = String(d[c.field as keyof Deal] ?? '').toLowerCase()
    const want = (c.value ?? '').toLowerCase()
    if (c.operator === 'greaterThan') return Number(v) > Number(want)
    if (c.operator === 'lessThan') return Number(v) < Number(want)
    if (c.operator === 'equals') return v === want
    if (c.operator === 'startsWith') return v.startsWith(want)
    if (c.operator === 'isBlank') return v === ''
    return v.includes(want)
  }

  function compare(a: Deal, b: Deal, field: string): number {
    const x = a[field as keyof Deal]
    const y = b[field as keyof Deal]
    return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
  }

  export function createPromptChat(opts: PromptChatOptions = {}) {
    const deals = opts.deals ?? SAMPLE
    const revealMs = opts.revealMs ?? 40
    // The AI helpers read rows through getData(). There is no grid on screen
    // here, so a plain row source stands in; next to an SvGrid, pass the api
    // from onApiReady instead.
    const api: AIRowSource<TableFeatures, Deal> = { getData: () => deals }
    const offline = !hasAIProvider() || getAIProvider() === mockAIProvider

    let messages = $state<ChatMessage[]>([])
    let draft = $state('')
    let busy = $state(false)
    let nextId = 1
    let controller: AbortController | null = null
    let timer: ReturnType<typeof setInterval> | undefined

    // AIProvider returns the whole answer as one string, so the word-by-word
    // reveal happens here, after the call resolves.
    async function answer(q: string, signal: AbortSignal): Promise<string> {
      if (/unusual|outlier|anomal|odd/i.test(q)) {
        const r = await aiFindAnomalies(api, { question: q, signal })
        return [r.summary, ...r.anomalies.map((a) => `- ${deals[a.rowIndex ?? -1]?.company ?? 'A deal'}: ${a.reason}`)].join('\n')
      }
      if (!/summar|overview|how are we/i.test(q)) {
        const plan = await aiFilter(api, q, { signal })
        if (plan.filters.length || plan.sort.length) {
          let rows = deals.filter((d) => plan.filters.every((c) => matches(d, c)))
          const s = plan.sort.at(-1)
          if (s) rows = [...rows].sort((a, b) => compare(a, b, s.field) * (s.desc ? -1 : 1))
          const more = rows.length > 5 ? `\n+ ${rows.length - 5} more` : ''
          return `${plan.rationale} ${rows.length} of ${deals.length} deals match.\n${rows.slice(0, 5).map(line).join('\n')}${more}`
        }
      }
      // Everything else is an open question: aiSummarize answers it over the rows.
      const s = await aiSummarize(api, { target: { kind: 'all' }, question: q, signal })
      return [s.text, ...s.bullets.map((b) => `- ${b}`)].join('\n')
    }

    function finish() {
      clearInterval(timer)
      busy = false
      controller = null
    }

    async function send(q = draft) {
      if (!q.trim() || busy) return
      draft = ''
      busy = true
      messages.push({ id: nextId++, role: 'user', text: q, words: 0 })
      messages.push({ id: nextId++, role: 'assistant', text: '', words: 0 })
      const msg = messages[messages.length - 1]!
      const ctl = new AbortController()
      controller = ctl
      try {
        const text = await withProvider(() => answer(q, ctl.signal))
        if (ctl.signal.aborted) return
        msg.text = text
        const total = tokens(text).length
        timer = setInterval(() => {
          msg.words += 1
          if (msg.words >= total) finish()
        }, revealMs)
      } catch (e) {
        if (ctl.signal.aborted) return
        msg.text = `Could not answer: ${e instanceof Error ? e.message : e}`
        msg.words = tokens(msg.text).length
        finish()
      }
    }

    // Stop cancels the request (the signal reaches your provider) and keeps
    // whatever part of the reply was already on screen.
    function stop(notify = true) {
      controller?.abort()
      const msg = messages[messages.length - 1]
      if (msg?.role === 'assistant') {
        msg.text = tokens(msg.text).slice(0, msg.words).join('').trimEnd()
        msg.stopped = true
      }
      finish()
      if (notify) opts.onStop?.()
    }

    function newChat() {
      if (busy) stop(false)
      messages = []
    }

    return {
      deals,
      starters: opts.starters ?? STARTERS,
      /** True when no app provider is registered (or it is mockAIProvider). */
      offline,
      get messages() { return messages },
      get draft() { return draft },
      set draft(v: string) { draft = v },
      get busy() { return busy },
      send,
      /** Fill the input with a starter's prompt and send it. */
      useStarter: (s: Starter) => { draft = s.prompt; void send() },
      stop,
      newChat,
      /** The part of a message on screen so far. */
      visible: (m: ChatMessage) => (m.role === 'user' ? m.text : tokens(m.text).slice(0, m.words).join('')),
      /** True while an assistant message waits for its first word. */
      thinking: (m: ChatMessage) => m.role === 'assistant' && !m.text && busy,
      /** Spread on the composer <form>. */
      formProps: () => ({ onsubmit: (e: Event) => { e.preventDefault(); void send() } }),
    }
  }
</script>

<script lang="ts">
  import { SvTextInput, SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const chat = createPromptChat({ onStop: () => toast('Response stopped') })
</script>

<main class="sv-suggest">
  <header class="sv-suggest-topbar">
    <div class="sv-suggest-bar-title">
      <h2>Pipeline assistant</h2>
      <SvBadge variant={chat.offline ? 'neutral' : 'success'} size="sm">{chat.offline ? 'Offline demo model' : 'Connected model'}</SvBadge>
    </div>
    {#if chat.messages.length}
      <SvButton size="sm" variant="ghost" onclick={chat.newChat}>New chat</SvButton>
    {/if}
  </header>

  <section class="sv-suggest-thread" aria-live="polite" aria-busy={chat.busy}>
    {#if chat.messages.length === 0}
      <div class="sv-suggest-empty">
        <svg class="sv-suggest-mark" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
          <rect width="40" height="40" rx="12" fill="currentColor" opacity=".14" />
          <path d="M20 9l2.7 7.6L30 19l-7.3 2.4L20 29l-2.7-7.6L10 19l7.3-2.4z" fill="currentColor" />
        </svg>
        <p class="sv-suggest-lead">What do you want to know about Q4?</p>
        <p class="sv-suggest-muted">Answers come from the {chat.deals.length} deals in the Fieldline pipeline.</p>
        <div class="sv-suggest-starters">
          {#each chat.starters as s (s.title)}
            <button type="button" class="sv-suggest-starter" onclick={() => chat.useStarter(s)}>
              <strong>{s.title}</strong>
              <span>{s.hint}</span>
            </button>
          {/each}
        </div>
      </div>
    {:else}
      {#each chat.messages as m (m.id)}
        <div class="sv-suggest-msg sv-suggest-{m.role}">
          {#if chat.thinking(m)}
            <span class="sv-suggest-dots" aria-label="Thinking"><i></i><i></i><i></i></span>
          {:else}
            <p>{chat.visible(m)}{#if m.stopped}<em class="sv-suggest-stopped"> (stopped)</em>{/if}</p>
          {/if}
        </div>
      {/each}
    {/if}
  </section>

  <form class="sv-suggest-composer" {...chat.formProps()}>
    <label class="sv-suggest-sr-only" for="sv-suggest-input">Message</label>
    <div class="sv-suggest-field">
      <SvTextInput id="sv-suggest-input" bind:value={chat.draft} placeholder="Ask about your deals" block />
    </div>
    {#if chat.busy}
      <SvButton variant="outline" onclick={() => chat.stop()}>Stop</SvButton>
    {:else}
      <SvButton type="submit" disabled={!chat.draft.trim()}>Send</SvButton>
    {/if}
  </form>
  <p class="sv-suggest-fine">Answers can be wrong. Check figures before you share them.</p>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-suggest {
    width: 100%; box-sizing: border-box; max-width: 760px; margin: 0 auto; min-height: 560px;
    display: flex; flex-direction: column; gap: 12px; padding: 20px 24px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-suggest-topbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-suggest-bar-title { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; min-width: 0; }
  .sv-suggest-topbar h2 { margin: 0; font-size: 16px; font-weight: 650; }
  .sv-suggest-thread { flex: 1; display: flex; flex-direction: column; gap: 10px; min-height: 320px; }
  .sv-suggest-empty { margin: auto 0; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 16px 0; }
  .sv-suggest-mark { display: block; color: var(--sg-accent, #4f46e5); margin-bottom: 6px; }
  .sv-suggest-lead { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-suggest-muted { margin: 0; font-size: 13.5px; color: var(--sg-muted, #64748b); }
  .sv-suggest-starters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; width: 100%; margin-top: 18px; }
  .sv-suggest-starter {
    display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 12px 14px; cursor: pointer;
    font: inherit; color: inherit; background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-suggest-starter:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-suggest-starter:focus-visible { outline: 2px solid var(--sg-focus-ring, #4f46e5); outline-offset: 2px; }
  .sv-suggest-starter strong { font-size: 14px; font-weight: 600; }
  .sv-suggest-starter span { font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .sv-suggest-msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.55; }
  .sv-suggest-msg p { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
  .sv-suggest-msg.sv-suggest-user { align-self: flex-end; background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); border-bottom-right-radius: 4px; }
  .sv-suggest-msg.sv-suggest-assistant { align-self: flex-start; background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, var(--sg-bg, #fff)); border-bottom-left-radius: 4px; }
  .sv-suggest-stopped { color: var(--sg-muted, #64748b); }
  .sv-suggest-dots { display: inline-flex; gap: 4px; padding: 4px 0; }
  .sv-suggest-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--sg-muted, #64748b); animation: blink 1s infinite; }
  .sv-suggest-dots i:nth-child(2) { animation-delay: .15s; }
  .sv-suggest-dots i:nth-child(3) { animation-delay: .3s; }
  @keyframes blink { 50% { opacity: .25; } }
  @media (prefers-reduced-motion: reduce) { .sv-suggest-dots i { animation: none; } }
  .sv-suggest-composer { display: flex; gap: 8px; align-items: center; }
  .sv-suggest-field { flex: 1; min-width: 0; }
  .sv-suggest-fine { margin: 0; font-size: 11.5px; text-align: center; color: var(--sg-muted, #64748b); }
  .sv-suggest-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  @media (max-width: 560px) {
    .sv-suggest { padding: 16px 12px; }
    .sv-suggest-starters { grid-template-columns: 1fr; }
    .sv-suggest-msg { max-width: 92%; }
  }
</style>
