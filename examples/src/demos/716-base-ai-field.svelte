<script lang="ts">
  /**
   * 716. SvGrid Base: AI fields
   * ---------------------------
   * An AI field (`fieldType: 'ai'`) holds a value a model writes for each
   * record from a prompt that names the record's fields:
   * "Write a one-line pitch for {Name}, aimed at {Audience}, that mentions
   * {Key feature}." The answer is stored in the record, so it sorts, filters
   * and exports like typed text, and anyone can edit it by hand.
   *
   * - The spark in a cell generates that record; the column menu has
   *   "Generate for all". Requests run three at a time.
   * - Pitch has `auto` on: change a product's Audience or Key feature and its
   *   pitch is written again. Price band has it off, so it changes only when
   *   asked, and it picks one of its options (`output: 'singleSelect'`).
   * - A failed request shows its message in the cell (the product with no Key
   *   feature fails here on purpose). Values go through the grid's edit path:
   *   Ctrl+Z undoes a generated value like a typed one.
   *
   * The model here is a stand-in that writes from templates, so the demo runs
   * without a key. A real one is a function from a request to the model's text,
   * registered once with `setAIProvider` from `@svgrid/grid`. Keep the key on
   * your server:
   *
   *   setAIProvider(async ({ prompt, maxOutputTokens, signal }) => {
   *     const res = await fetch('/api/ai', { method: 'POST', body: JSON.stringify({ prompt, maxOutputTokens }), signal })
   *     return (await res.json()).text
   *   })
   */
  import { getAIProvider, setAIProvider, type AIProvider } from '@svgrid/grid'
  import { SvBase, enableBase, generateAIField, type BaseTable } from '@svgrid/enterprise/base'

  enableBase()

  // ---- The stand-in model ---------------------------------------------------------

  const OPENERS = ['Built for', 'Made for', 'Ready for']
  const pick = (list: string[], seed: string) => list[[...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % list.length]!

  const demoProvider: AIProvider = async (req) => {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 500))
    if (req.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    const ask = /Instruction:\n([\s\S]*?)\n\n/.exec(req.prompt)?.[1] ?? ''
    const pitch = /pitch for (.*), aimed at (.*), that mentions (.*)\.$/.exec(ask)
    if (pitch) {
      const [, name, audience, feature] = pitch
      if (!feature!.trim()) throw new Error('Key feature is empty: nothing to build the pitch on')
      return JSON.stringify({ value: `${pick(OPENERS, name!)} ${audience!.toLowerCase()}: the ${name} brings ${feature!.toLowerCase()}.` })
    }
    // "at $189.00", or however the locale writes it: the whole units are enough here.
    const price = /price band fits .* at \D*(\d+)/.exec(ask)
    if (price) {
      const n = Number(price[1])
      return JSON.stringify({ value: n < 80 ? 'Budget' : n < 200 ? 'Mid-range' : 'Premium' })
    }
    return JSON.stringify({ value: ask.slice(0, 80) })
  }

  // Registered before the base draws, so its cells see a provider; the
  // gallery's previous one comes back when the demo closes.
  const previous = getAIProvider()
  setAIProvider(demoProvider)
  $effect(() => () => setAIProvider(previous))

  // ---- The base -------------------------------------------------------------------

  const AUDIENCE = [
    { value: 'Hikers', color: '#16a34a' },
    { value: 'Trail runners', color: '#ea580c' },
    { value: 'Commuters', color: '#2563eb' },
    { value: 'Climbers', color: '#7c3aed' },
  ]
  const BANDS = [
    { value: 'Budget', color: '#94a3b8' },
    { value: 'Mid-range', color: '#0ea5e9' },
    { value: 'Premium', color: '#a855f7' },
  ]
  const PRODUCTS: Array<[string, string, string, number]> = [
    ['Ridge 40 pack', 'Hikers', 'A frame that carries 15 kg without shoulder strain', 189],
    ['Fellrunner vest', 'Trail runners', 'Two soft flasks at the chest', 95],
    ['Metro shell', 'Commuters', 'Taped seams and a hood that fits over a helmet', 229],
    ['Crag chalk bag', 'Climbers', 'A brush loop and a drawstring that closes one-handed', 29],
    ['Summit trekking poles', 'Hikers', 'Carbon shafts at 230 g a pair', 149],
    ['Night loop headlamp', 'Trail runners', '', 59],
    ['Commute pannier', 'Commuters', 'Clips on and off the rack in one move', 119],
    ['Belay gloves', 'Climbers', 'Leather palms that last through rope burn', 45],
  ]

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'ai-products',
      name: 'Products',
      primaryField: 'name',
      data: PRODUCTS.map(([name, audience, feature, price], i) => ({ id: `p${i + 1}`, name, audience, feature, price })),
      columns: [
        { field: 'name', header: 'Name', width: 180, fieldType: 'text' },
        { field: 'audience', header: 'Audience', width: 130, fieldType: 'singleSelect', fieldProps: { options: AUDIENCE } },
        { field: 'feature', header: 'Key feature', width: 210, fieldType: 'text' },
        {
          field: 'pitch', header: 'Pitch', width: 300, fieldType: 'ai',
          fieldProps: { prompt: 'Write a one-line pitch for {Name}, aimed at {Audience}, that mentions {Key feature}.', output: 'text', auto: true },
          description: 'Written by a model from Name, Audience and Key feature.',
        },
        { field: 'price', header: 'Price', width: 100, fieldType: 'number', fieldProps: { format: 'currency', precision: 2 } },
        {
          field: 'band', header: 'Price band', width: 130, fieldType: 'ai',
          fieldProps: { prompt: 'Which price band fits {Name} at {Price}?', output: 'singleSelect', options: BANDS, auto: false },
        },
      ],
      views: [{ id: 'all', name: 'All products', type: 'grid' }],
    },
  ])

  let api: unknown = null
  const onApiReady = (a: unknown) => (api = a)
  let busy = $state(false)
  let result = $state('')

  async function generateAll() {
    if (!api || busy) return
    busy = true
    result = ''
    try {
      const run = await generateAIField(api, 'pitch', 'all')
      result = `${run.written} written${run.failed ? `, ${run.failed} failed` : ''}`
    } finally {
      busy = false
    }
  }
</script>

<section class="aif-demo">
  <div class="aif-bar">
    <button type="button" class="aif-run" onclick={() => void generateAll()} disabled={busy}>{busy ? 'Generating...' : 'Generate all pitches'}</button>
    <span class="aif-result" aria-live="polite">{result}</span>
    <p class="aif-tip">Then change a product's Audience: its pitch is written again. Price band changes only from its spark or column menu.</p>
  </div>
  <SvBase
    bind:tables
    {onApiReady}
    editable
    sortable
    showRowNumbers
    expandRows
    showRowSelection={false}
    rowHeight={40}
    containerHeight="100%"
    columnAdder
    fieldMenu
  />
</section>

<style>
  .aif-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; gap: 10px; }
  .aif-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 13px; }
  .aif-run {
    height: 32px; padding: 0 14px; border: 0; border-radius: var(--sg-radius, 6px);
    background: var(--sg-accent, #2563eb); color: var(--sg-accent-fg, #fff); font: inherit; font-weight: 600; cursor: pointer;
  }
  .aif-run:disabled { opacity: 0.6; cursor: default; }
  .aif-result { color: var(--sg-fg, #0f172a); }
  .aif-tip { flex: 1 1 260px; margin: 0; line-height: 1.5; color: var(--sg-muted, #64748b); }
</style>
