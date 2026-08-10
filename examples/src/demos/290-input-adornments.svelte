<script lang="ts">
  /**
   * Input adornments - leading/trailing icons + text affixes on SvTextInput,
   * all owned by SvField's shared `frame` chrome (so size, invalid, focus ring,
   * clear button and adornments behave identically across the text family).
   */
  import { SvTextInput } from '@svgrid/grid'

  let search = $state('')
  let site = $state('')
  let price = $state('')
  let weight = $state('')
  let user = $state('')
  let sized = $state('Medium')
  let floatName = $state('')
  let floatEmail = $state('ada@example.com')
  let apiKey = $state('')
  let copied = $state(false)
  function genKey() { apiKey = 'sk_' + Math.random().toString(36).slice(2, 14) }
  function copyKey() { copied = true; setTimeout(() => (copied = false), 1200) }
</script>

<div class="wrap">
  <section>
    <h3>Leading & trailing icons</h3>
    <div class="grid">
      <SvTextInput bind:value={search} type="search" placeholder="Search orders" label="Search" clearable block>
        {#snippet leading()}<span class="ic">🔎</span>{/snippet}
      </SvTextInput>

      <SvTextInput bind:value={user} placeholder="username" label="Username" block>
        {#snippet leading()}<span class="ic">@</span>{/snippet}
        {#snippet trailing()}{#if user}<span class="ok">✓</span>{/if}{/snippet}
      </SvTextInput>
    </div>
  </section>

  <section>
    <h3>Text affixes (prefix / suffix)</h3>
    <div class="grid">
      <SvTextInput bind:value={site} label="Website" prefix="https://" placeholder="example.com" block />
      <SvTextInput bind:value={price} label="Price" prefix="$" suffix="USD" placeholder="0.00" block />
      <SvTextInput bind:value={weight} label="Weight" suffix="kg" placeholder="0" block />
    </div>
  </section>

  <section>
    <h3>Floating labels</h3>
    <p class="hint">The label rests inside the field and floats up on focus or when filled.</p>
    <div class="grid">
      <SvTextInput bind:value={floatName} label="Full name" labelMode="floating" block />
      <SvTextInput bind:value={floatEmail} label="Email address" type="email" labelMode="floating" clearable block>
        {#snippet leading()}<span class="ic">✉</span>{/snippet}
      </SvTextInput>
    </div>
  </section>

  <section>
    <h3>In-field action buttons</h3>
    <p class="hint">Compact buttons live inside the field - the generalized form of clear/reveal (lookup, generate, copy...).</p>
    <div class="grid">
      <SvTextInput
        bind:value={apiKey}
        label="API key"
        placeholder="Click generate"
        block
        actions={[
          { label: 'Generate', onClick: genKey },
          { label: copied ? 'Copied' : 'Copy', onClick: copyKey, disabled: !apiKey },
        ]}
      >
        {#snippet leading()}<span class="ic">🔑</span>{/snippet}
      </SvTextInput>
    </div>
  </section>

  <section>
    <h3>Sizes & states (shared frame)</h3>
    <div class="grid">
      <SvTextInput bind:value={sized} label="Small" size="sm" clearable block />
      <SvTextInput bind:value={sized} label="Medium" size="md" clearable block />
      <SvTextInput bind:value={sized} label="Large" size="lg" clearable block />
      <SvTextInput value="not-an-email" label="Invalid" invalid error="Enter a valid email" block>
        {#snippet leading()}<span class="ic">✉</span>{/snippet}
      </SvTextInput>
      <SvTextInput value="read only" label="Read-only" readonly block />
      <SvTextInput value="disabled" label="Disabled" disabled block />
    </div>
  </section>
</div>

<style>
  .wrap { padding: 22px; display: flex; flex-direction: column; gap: 24px; max-width: 720px; }
  section h3 { margin: 0 0 12px; font-size: 15px; font-weight: 700; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; }
  .hint { margin: -6px 0 12px; font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .ic { display: inline-flex; font-size: 13px; color: var(--sg-muted, #64748b); }
  .ok { color: var(--sg-success, #16a34a); font-weight: 700; }
</style>
