<script lang="ts" module>
  /**
   * AI settings block - the assistant settings page for a workspace admin.
   * SvDropDownList picks the model, SvSlider sets temperature, SvNumberInput
   * caps the reply length, SvTextArea holds the system prompt with a character
   * counter, and one SvSwitchButton per tool turns tools on or off. A preview
   * card shows the request payload these settings produce, updated as you
   * type. Save (SvButton with loading, toast) and Reset to defaults; SvBadge
   * marks unsaved changes. Pure UI-kit, --sg-* themed.
   *
   * Headless: createAISettings() below owns the settings, validation, the
   * unsaved-changes check, the request payload preview and the save flow with
   * no markup. The component under it is one styled render of that core;
   * import createAISettings from this file (or `npx @svgrid/ui add
   * ai-settings --headless` for the core alone) to draw your own.
   */
  export type ToolId = 'search_help_center' | 'read_workspace' | 'create_ticket'
  export type AISettings = { model: string; temperature: number; maxOutputTokens: number | null; system: string; tools: Record<ToolId, boolean> }
  export type AIModelOption = { value: string; label: string; note: string }
  export type AIToolOption = { id: ToolId; label: string; note: string }
  export type AISettingsOptions = {
    models?: AIModelOption[]
    tools?: AIToolOption[]
    /** The shipped values Reset puts back. */
    defaults?: AISettings
    /** The last saved values, if they differ from the defaults. */
    saved?: AISettings
    /** Persist valid settings; throw (or reject) to keep them unsaved. */
    onSave?: (settings: AISettings) => Promise<unknown> | void
    /** Called when Save is pressed with invalid fields. */
    onInvalid?: () => void
    /** Called after reset() restores the defaults. */
    onReset?: () => void
  }

  export const MAX_PROMPT = 1200

  const MODELS: AIModelOption[] = [
    { value: 'lumen-mini', label: 'Lumen Mini', note: 'Fastest and cheapest. Good for short answers.' },
    { value: 'lumen-standard', label: 'Lumen Standard', note: 'The default. Handles most support questions.' },
    { value: 'lumen-large', label: 'Lumen Large', note: 'Slower. Reads long documents and threads.' },
  ]
  const TOOLS: AIToolOption[] = [
    { id: 'search_help_center', label: 'Search the help center', note: 'Cites articles from help.northwind.io' },
    { id: 'read_workspace', label: 'Read workspace data', note: 'Orders, customers and invoices the user can see' },
    { id: 'create_ticket', label: 'Create support tickets', note: 'Asks the user to confirm before filing' },
  ]
  const DEFAULTS: AISettings = {
    model: 'lumen-standard',
    temperature: 0.3,
    maxOutputTokens: 800,
    system: 'You are the Northwind support assistant. Answer in plain English, in five sentences or fewer. If you are not sure, say so and link the help center.',
    tools: { search_help_center: true, read_workspace: true, create_ticket: false },
  }

  export function createAISettings(opts: AISettingsOptions = {}) {
    const models = opts.models ?? MODELS
    const tools = opts.tools ?? TOOLS
    const defaults = opts.defaults ?? DEFAULTS

    let saved = $state<AISettings>(structuredClone(opts.saved ?? defaults))
    let s = $state<AISettings>(structuredClone(opts.saved ?? defaults))
    let busy = $state(false)

    const model = $derived(models.find((m) => m.value === s.model))
    const tokensError = $derived(s.maxOutputTokens == null || s.maxOutputTokens < 64 || s.maxOutputTokens > 4000 ? 'Between 64 and 4,000 tokens' : '')
    const systemError = $derived(s.system.trim() ? '' : 'The assistant needs a system prompt')
    const dirty = $derived(JSON.stringify(s) !== JSON.stringify(saved))

    // What your provider would POST to your own endpoint with these settings.
    const payload = $derived(JSON.stringify({
      model: s.model,
      temperature: s.temperature,
      maxOutputTokens: s.maxOutputTokens,
      system: s.system,
      tools: tools.filter((t) => s.tools[t.id]).map((t) => t.id),
      prompt: 'Where is order #10248?',
    }, null, 2))

    async function save(e?: Event) {
      e?.preventDefault()
      if (busy) return
      if (tokensError || systemError) { opts.onInvalid?.(); return }
      busy = true
      try {
        await opts.onSave?.($state.snapshot(s))
        saved = $state.snapshot(s)
      } catch {
        // Left unsaved; the caller reports the failure.
      } finally {
        busy = false
      }
    }

    function reset() {
      s = structuredClone(defaults)
      opts.onReset?.()
    }

    return {
      models, tools,
      maxPrompt: MAX_PROMPT,
      /** The values being edited; bind fields to its properties. */
      get settings() { return s },
      get saved() { return saved },
      get busy() { return busy },
      get dirty() { return dirty },
      /** The selected model's option, with its note. */
      get model() { return model },
      get tokensError() { return tokensError },
      get systemError() { return systemError },
      /** The request body these settings produce, pretty-printed. */
      get payload() { return payload },
      setTool: (id: ToolId, on: boolean) => { s.tools[id] = on },
      save,
      reset,
      /** Spread on the settings <form>. */
      formProps: () => ({ novalidate: true, onsubmit: save }),
      /** Spread on a native <input type="checkbox" role="switch"> for one tool. */
      toolProps: (id: ToolId) => ({
        type: 'checkbox' as const,
        role: 'switch' as const,
        checked: s.tools[id],
        onchange: (e: Event) => { s.tools[id] = (e.currentTarget as HTMLInputElement).checked },
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvDropDownList, SvSlider, SvNumberInput, SvTextArea, SvSwitchButton, SvButton, SvBadge,
    SvToaster, toast,
  } from '@svgrid/grid'

  const ai = createAISettings({
    // Replace with a PUT to your settings endpoint.
    onSave: () => toast.promise(new Promise<void>((res) => setTimeout(res, 900)), {
      loading: 'Saving assistant settings...',
      success: 'Assistant settings saved',
      error: 'Could not save settings',
    }),
    onInvalid: () => toast.error('Fix the highlighted fields first'),
    onReset: () => toast('Defaults restored. Save to keep them.'),
  })
</script>

<main class="sv-aiset">
  <header class="sv-aiset-head">
    <div>
      <h2>Assistant settings</h2>
      <p class="sv-aiset-muted">Applies to every chat in the Northwind support workspace.</p>
    </div>
    {#if ai.dirty}<SvBadge variant="warning" size="sm">Unsaved changes</SvBadge>{/if}
  </header>

  <div class="sv-aiset-cols">
    <form class="sv-aiset-form" onsubmit={ai.save}>
      <SvDropDownList label="Model" options={ai.models} value={ai.settings.model} onChange={(v) => (ai.settings.model = String(v))} hint={ai.model?.note} block />
      <SvSlider label="Temperature" value={ai.settings.temperature} onChange={(v: number) => (ai.settings.temperature = v)} min={0} max={1} step={0.1}
        labels="endpoints" showValue block hint="Lower is more predictable. Higher varies the wording more." />
      <SvNumberInput label="Max reply length" suffix=" tokens" bind:value={ai.settings.maxOutputTokens} min={64} max={4000} step={64}
        error={ai.tokensError} block />
      <SvTextArea label="System prompt" bind:value={ai.settings.system} rows={5} maxlength={ai.maxPrompt} showCount required error={ai.systemError} block />

      <fieldset class="sv-aiset-tools">
        <legend>Tools</legend>
        {#each ai.tools as t (t.id)}
          <div class="sv-aiset-tool">
            <div>
              <span class="sv-aiset-tool-label">{t.label}</span>
              <span class="sv-aiset-tool-note">{t.note}</span>
            </div>
            <SvSwitchButton ariaLabel={t.label} checked={ai.settings.tools[t.id]} onChange={(v) => ai.setTool(t.id, v)} />
          </div>
        {/each}
      </fieldset>

      <div class="sv-aiset-actions">
        <SvButton variant="ghost" onclick={ai.reset} disabled={ai.busy}>Reset to defaults</SvButton>
        <SvButton type="submit" loading={ai.busy} disabled={!ai.dirty}>Save settings</SvButton>
      </div>
    </form>

    <aside class="sv-aiset-preview" aria-label="Request preview">
      <div class="sv-aiset-preview-head">
        <h3>Request payload</h3>
        <code class="sv-aiset-route">POST /api/ai</code>
      </div>
      <pre>{ai.payload}</pre>
      <p class="sv-aiset-muted sv-aiset-small">Sent by your app's provider to your own endpoint, which adds the API key on the server.</p>
    </aside>
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-aiset {
    width: 100%; box-sizing: border-box; max-width: 980px; margin: 0 auto; min-height: 560px;
    display: flex; flex-direction: column; gap: 20px; padding: 28px 24px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-aiset-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  h2 { margin: 0 0 4px; font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
  h3 { margin: 0; font-size: 13px; font-weight: 600; }
  .sv-aiset-muted { margin: 0; font-size: 13.5px; color: var(--sg-muted, #64748b); }
  .sv-aiset-small { font-size: 12px; line-height: 1.5; }
  .sv-aiset-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 380px); gap: 24px; align-items: start; }
  .sv-aiset-form { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
  .sv-aiset-tools { margin: 0; padding: 0; border: 0; min-width: 0; }
  legend { padding: 0; margin-bottom: 6px; font-size: 12.5px; font-weight: 500; }
  .sv-aiset-tool {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0;
    border-top: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-aiset-tool-label { display: block; font-size: 13.5px; font-weight: 550; }
  .sv-aiset-tool-note { display: block; font-size: 12px; color: var(--sg-muted, #64748b); margin-top: 2px; }
  .sv-aiset-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .sv-aiset-preview {
    position: sticky; top: 16px; display: flex; flex-direction: column; gap: 10px; padding: 16px; min-width: 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
  }
  .sv-aiset-preview-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .sv-aiset-route { font-size: 11.5px; color: var(--sg-muted, #64748b); }
  pre {
    margin: 0; padding: 12px; overflow: auto; max-height: 360px; font-size: 12px; line-height: 1.55;
    white-space: pre-wrap; overflow-wrap: anywhere;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px);
  }

  @media (max-width: 760px) {
    .sv-aiset { padding: 20px 12px; }
    .sv-aiset-head, .sv-aiset-actions { flex-wrap: wrap; }
    .sv-aiset-cols { grid-template-columns: minmax(0, 1fr); }
    .sv-aiset-preview { position: static; }
    .sv-aiset-actions > :global(*) { flex: 1; }
  }
</style>
