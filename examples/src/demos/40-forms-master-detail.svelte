<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 40. Forms-in-grid (master / detail edit)
   * ----------------------------------------
   * The Salesforce / SAP pattern: a master grid on the left, a full
   * record-detail form on the right. Clicking a row loads it into the
   * form; editing any field updates the underlying record in real
   * time so the grid stays in lock-step.
   *
   * Three production-feel pieces sit on top of the basic split view:
   *
   *   1. **Tabbed sections.** A real record detail page rarely fits in
   *      one screen. Tabs (Profile / Billing / Contacts / Notes) keep
   *      the surface scrollable without forcing a 2,000-px form.
   *
   *   2. **Dirty tracking + Save / Discard.** Every edit lives in a
   *      "draft" record. Commits apply atomically; Discard rolls back
   *      to the version the grid currently has. Useful for any record
   *      where a Submit step is meaningful.
   *
   *   3. **Inline validation.** Email format, phone length, required
   *      fields - failures block Save and surface inline messages so
   *      the user knows what to fix.
   *
   * Editing the form also writes through to the grid cell live, which
   * is what you'd want when forms-in-grid wraps a real-time backend:
   * other operators see the same record update as you type.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ---- Domain ---------------------------------------------------------

  type AccountStatus = 'prospect' | 'active' | 'churn_risk' | 'closed_lost' | 'closed_won'
  type AccountTier = 'starter' | 'growth' | 'enterprise'
  type Region = 'NA' | 'EMEA' | 'APAC' | 'LATAM'
  type PaymentTerm = 'net15' | 'net30' | 'net45' | 'net60'

  type Contact = {
    id: string
    name: string
    title: string
    email: string
    phone: string
    primary: boolean
  }

  type Account = {
    id: string
    name: string
    status: AccountStatus
    tier: AccountTier
    region: Region
    arr: number
    owner: string
    // Billing
    billingStreet: string
    billingCity: string
    billingPostal: string
    billingCountry: string
    paymentTerm: PaymentTerm
    taxId: string
    // Contacts
    contacts: Contact[]
    // Notes
    notes: string
    updatedAt: string
  }

  // ---- Seed -----------------------------------------------------------

  const STATUSES: readonly AccountStatus[] = ['prospect', 'active', 'churn_risk', 'closed_lost', 'closed_won']
  const TIERS: readonly AccountTier[] = ['starter', 'growth', 'enterprise']
  const REGIONS: readonly Region[] = ['NA', 'EMEA', 'APAC', 'LATAM']
  const TERMS: readonly PaymentTerm[] = ['net15', 'net30', 'net45', 'net60']
  const OWNERS = ['Sasha Park', 'Jamie Chen', 'Robin Diaz', 'Casey Singh', 'Drew Olsen']
  const COUNTRIES = ['United States', 'Germany', 'United Kingdom', 'Japan', 'Brazil', 'Australia', 'Canada', 'France']
  const CITIES = ['New York', 'Berlin', 'London', 'Tokyo', 'São Paulo', 'Sydney', 'Toronto', 'Paris']
  const COMPANIES = [
    'Nordic Holdings', 'Pacific Industries', 'Atlas Logistics', 'Helios Group',
    'Vertex Trust', 'Quantum Resources', 'Stellar Networks', 'Apex Bio',
    'Crescent Labs', 'Sigma Capital', 'Pioneer Mining', 'Aurora Trading',
  ]
  const FIRST = ['Alex', 'Jamie', 'Casey', 'Drew', 'Robin', 'Morgan', 'Riley', 'Quinn', 'Avery', 'Reese']
  const LAST = ['Park', 'Singh', 'Khan', 'Cohen', 'Nakamura', 'Silva', 'Diaz', 'Mehta', 'Olsen', 'Tran']
  const TITLES = ['CEO', 'COO', 'VP Eng', 'Head of Ops', 'Procurement Lead', 'IT Director', 'Finance Manager']

  let prng = 0x4D45D17A11
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  function seedContacts(n: number): Contact[] {
    const out: Contact[] = []
    for (let i = 0; i < n; i += 1) {
      const first = pick(FIRST)
      const last = pick(LAST)
      const slug = `${first}.${last}`.toLowerCase()
      out.push({
        id: `CT-${i + 1}`,
        name: `${first} ${last}`,
        title: pick(TITLES),
        email: `${slug}@${slug}.example`,
        phone: `+1 (555) ${Math.floor(100 + rnd() * 900)}-${Math.floor(1000 + rnd() * 9000)}`,
        primary: i === 0,
      })
    }
    return out
  }

  function seedAccounts(): Account[] {
    return COMPANIES.map((name, i) => {
      const ix = i.toString().padStart(3, '0')
      const country = pick(COUNTRIES)
      const city = pick(CITIES)
      return {
        id: `ACC-${ix}`,
        name,
        status: pick(STATUSES),
        tier: pick(TIERS),
        region: pick(REGIONS),
        arr: Math.round((50_000 + rnd() * 1_950_000) / 1000) * 1000,
        owner: pick(OWNERS),
        billingStreet: `${Math.floor(rnd() * 999) + 1} Industrial Way`,
        billingCity: city,
        billingPostal: `${Math.floor(rnd() * 89999) + 10000}`,
        billingCountry: country,
        paymentTerm: pick(TERMS),
        taxId: `TAX-${Math.floor(rnd() * 999999).toString().padStart(6, '0')}`,
        contacts: seedContacts(2 + Math.floor(rnd() * 3)),
        notes: '',
        updatedAt: new Date().toISOString(),
      }
    })
  }

  // ---- Reactive state -------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let accounts = $state<Account[]>(seedAccounts())
  // svelte-ignore state_referenced_locally
  let selectedId = $state<string | null>(accounts[0]?.id ?? null)
  // svelte-ignore state_referenced_locally
  let draft = $state<Account | null>(accounts[0] ? $state.snapshot(accounts[0]) as Account : null)
  let activeTab = $state<'profile' | 'billing' | 'contacts' | 'notes'>('profile')

  function selectRow(id: string): void {
    selectedId = id
    const found = accounts.find((a) => a.id === id)
    draft = found ? ($state.snapshot(found) as Account) : null
  }

  const selected = $derived.by(() => {
    if (!selectedId) return null
    return accounts.find((a) => a.id === selectedId) ?? null
  })
  const isDirty = $derived.by(() => {
    if (!selected || !draft) return false
    return JSON.stringify(selected) !== JSON.stringify(draft)
  })

  // ---- Validation ------------------------------------------------------

  type ValidationErrors = Partial<Record<keyof Account | `contact-${number}-${'name' | 'email' | 'phone'}`, string>>

  const errors = $derived.by(() => {
    const out: ValidationErrors = {}
    if (!draft) return out
    if (!draft.name.trim()) out.name = 'Required'
    if (draft.arr < 0) out.arr = 'Must be ≥ 0'
    if (!draft.billingCity.trim()) out.billingCity = 'Required'
    if (!draft.billingCountry.trim()) out.billingCountry = 'Required'
    draft.contacts.forEach((c, i) => {
      if (!c.name.trim()) out[`contact-${i}-name`] = 'Required'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) out[`contact-${i}-email`] = 'Bad email'
      if (c.phone.replace(/\D/g, '').length < 7) out[`contact-${i}-phone`] = 'Short phone'
    })
    return out
  })
  const isValid = $derived(Object.keys(errors).length === 0)

  // ---- Save / discard -------------------------------------------------

  function saveDraft(): void {
    if (!draft || !isValid) return
    const idx = accounts.findIndex((a) => a.id === draft!.id)
    if (idx < 0) return
    const next = accounts.slice()
    next[idx] = { ...draft, updatedAt: new Date().toISOString() }
    accounts = next
    draft = $state.snapshot(next[idx]) as Account
  }

  function discardDraft(): void {
    if (!selected) return
    draft = $state.snapshot(selected) as Account
  }

  function setDraftField<K extends keyof Account>(field: K, value: Account[K]): void {
    if (!draft) return
    draft = { ...draft, [field]: value }
  }

  function setContactField(i: number, field: keyof Contact, value: string | boolean): void {
    if (!draft) return
    const contacts = draft.contacts.slice()
    contacts[i] = { ...contacts[i]!, [field]: value as never }
    if (field === 'primary' && value === true) {
      // Only one primary at a time - clear the flag on every other.
      for (let j = 0; j < contacts.length; j += 1) {
        if (j !== i) contacts[j] = { ...contacts[j]!, primary: false }
      }
    }
    draft = { ...draft, contacts }
  }

  function addContact(): void {
    if (!draft) return
    const id = `CT-NEW-${Date.now()}`
    draft = {
      ...draft,
      contacts: [
        ...draft.contacts,
        { id, name: '', title: '', email: '', phone: '', primary: draft.contacts.length === 0 },
      ],
    }
  }
  function removeContact(i: number): void {
    if (!draft) return
    const contacts = draft.contacts.slice()
    contacts.splice(i, 1)
    if (contacts.length && !contacts.some((c) => c.primary)) contacts[0] = { ...contacts[0]!, primary: true }
    draft = { ...draft, contacts }
  }

  // ---- Formatters ------------------------------------------------------

  function fmtMoney(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet StatusCell(props: { row: Account })}
  <span class={`fm-status fm-status-${props.row.status}`}>{props.row.status.replace('_', ' ')}</span>
{/snippet}

{#snippet TierCell(props: { row: Account })}
  <span class={`fm-tier fm-tier-${props.row.tier}`}>{props.row.tier}</span>
{/snippet}

{#snippet ArrCell(props: { row: Account })}
  <span class="fm-arr">{fmtMoney(props.row.arr)}</span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="fm-shell flex flex-1 min-h-0 gap-3">
  <!-- Master grid -->
  <div class="fm-master">
    <header class="fm-master-head">
      <span>{accounts.length} accounts</span>
      {#if selected}
        <span class="fm-current-tag">→ {selected.name}</span>
      {/if}
    </header>
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
        data={accounts}
        columns={[
          { field: 'id', header: 'ID', width: 100, editable: false },
          { field: 'name', header: 'Account', width: 200, editable: false },
          { field: 'status', header: 'Status', width: 130, editable: false,
            cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
          { field: 'tier', header: 'Tier', width: 100, editable: false,
            cell: (ctx) => renderSnippet(TierCell, { row: ctx.row.original }) },
          { field: 'region', header: 'Region', width: 80, editable: false },
          { field: 'arr', header: 'ARR', editorType: 'number', width: 130, editable: false,
            cell: (ctx) => renderSnippet(ArrCell, { row: ctx.row.original }) },
          { field: 'owner', header: 'Owner', width: 150, editable: false },
        ] satisfies ColumnDef<typeof features, Account>[]}
        features={features}
        filterMode="menu"
        selectionMode="row"
        showRowSelection={true}
        showPagination={false}
        enableInlineEditing={false}
        enableCellSelection={false}
        enableRowSummaries={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns={true}
        onCellValueChange={() => {}}
        onActiveCellChange={(args) => {
          const row = accounts[args.rowIndex]
          if (row && row.id !== selectedId) selectRow(row.id)
        }}
      />
    </div>
  </div>

  <!-- Detail form -->
  <aside class="fm-detail">
    {#if !draft}
      <div class="fm-empty">Select an account to view its record.</div>
    {:else}
      <header class="fm-detail-head">
        <div>
          <h2 class="fm-detail-title">{draft.name || 'Untitled account'}</h2>
          <p class="fm-detail-sub">{draft.id} · last updated {new Date(draft.updatedAt).toLocaleString('en-US')}</p>
        </div>
        <div class="fm-detail-actions">
          <button type="button" class="fm-btn" disabled={!isDirty} onclick={discardDraft}>Discard</button>
          <button type="button" class="fm-btn fm-btn-primary" disabled={!isDirty || !isValid} onclick={saveDraft}>
            {isDirty ? 'Save' : 'Saved ✓'}
          </button>
        </div>
      </header>

      <nav class="fm-tabs">
        {#each [{id: 'profile', label: 'Profile'}, {id: 'billing', label: 'Billing'}, {id: 'contacts', label: `Contacts (${draft.contacts.length})`}, {id: 'notes', label: 'Notes'}] as tab (tab.id)}
          <button
            type="button"
            class="fm-tab"
            class:fm-tab-active={activeTab === tab.id}
            onclick={() => (activeTab = tab.id as typeof activeTab)}
          >{tab.label}</button>
        {/each}
      </nav>

      <div class="fm-form">
        {#if activeTab === 'profile'}
          <div class="fm-row">
            <label class="fm-field">
              <span>Account name</span>
              <input type="text" value={draft.name} oninput={(e) => setDraftField('name', (e.currentTarget as HTMLInputElement).value)} />
              {#if errors.name}<span class="fm-err">{errors.name}</span>{/if}
            </label>
            <label class="fm-field">
              <span>Owner</span>
              <select value={draft.owner} onchange={(e) => setDraftField('owner', (e.currentTarget as HTMLSelectElement).value)}>
                {#each OWNERS as owner (owner)}<option>{owner}</option>{/each}
              </select>
            </label>
          </div>
          <div class="fm-row">
            <label class="fm-field">
              <span>Status</span>
              <select value={draft.status} onchange={(e) => setDraftField('status', (e.currentTarget as HTMLSelectElement).value as AccountStatus)}>
                {#each STATUSES as s (s)}<option value={s}>{s.replace('_', ' ')}</option>{/each}
              </select>
            </label>
            <label class="fm-field">
              <span>Tier</span>
              <select value={draft.tier} onchange={(e) => setDraftField('tier', (e.currentTarget as HTMLSelectElement).value as AccountTier)}>
                {#each TIERS as t (t)}<option value={t}>{t}</option>{/each}
              </select>
            </label>
            <label class="fm-field">
              <span>Region</span>
              <select value={draft.region} onchange={(e) => setDraftField('region', (e.currentTarget as HTMLSelectElement).value as Region)}>
                {#each REGIONS as r (r)}<option value={r}>{r}</option>{/each}
              </select>
            </label>
          </div>
          <div class="fm-row">
            <label class="fm-field fm-field-wide">
              <span>ARR (USD)</span>
              <input type="number" value={draft.arr} oninput={(e) => setDraftField('arr', Number((e.currentTarget as HTMLInputElement).value) || 0)} />
              {#if errors.arr}<span class="fm-err">{errors.arr}</span>{/if}
            </label>
          </div>
        {:else if activeTab === 'billing'}
          <div class="fm-row">
            <label class="fm-field fm-field-wide">
              <span>Street</span>
              <input type="text" value={draft.billingStreet} oninput={(e) => setDraftField('billingStreet', (e.currentTarget as HTMLInputElement).value)} />
            </label>
          </div>
          <div class="fm-row">
            <label class="fm-field">
              <span>City</span>
              <input type="text" value={draft.billingCity} oninput={(e) => setDraftField('billingCity', (e.currentTarget as HTMLInputElement).value)} />
              {#if errors.billingCity}<span class="fm-err">{errors.billingCity}</span>{/if}
            </label>
            <label class="fm-field">
              <span>Postal</span>
              <input type="text" value={draft.billingPostal} oninput={(e) => setDraftField('billingPostal', (e.currentTarget as HTMLInputElement).value)} />
            </label>
            <label class="fm-field">
              <span>Country</span>
              <select value={draft.billingCountry} onchange={(e) => setDraftField('billingCountry', (e.currentTarget as HTMLSelectElement).value)}>
                {#each COUNTRIES as c (c)}<option>{c}</option>{/each}
              </select>
              {#if errors.billingCountry}<span class="fm-err">{errors.billingCountry}</span>{/if}
            </label>
          </div>
          <div class="fm-row">
            <label class="fm-field">
              <span>Payment terms</span>
              <select value={draft.paymentTerm} onchange={(e) => setDraftField('paymentTerm', (e.currentTarget as HTMLSelectElement).value as PaymentTerm)}>
                {#each TERMS as t (t)}<option value={t}>{t.toUpperCase()}</option>{/each}
              </select>
            </label>
            <label class="fm-field">
              <span>Tax ID</span>
              <input type="text" value={draft.taxId} oninput={(e) => setDraftField('taxId', (e.currentTarget as HTMLInputElement).value)} />
            </label>
          </div>
        {:else if activeTab === 'contacts'}
          <div class="fm-contact-list">
            {#each draft.contacts as contact, i (contact.id)}
              <article class="fm-contact-card">
                <div class="fm-contact-head">
                  <input
                    type="text"
                    placeholder="Name"
                    class="fm-contact-name"
                    value={contact.name}
                    oninput={(e) => setContactField(i, 'name', (e.currentTarget as HTMLInputElement).value)}
                  />
                  {#if contact.primary}<span class="fm-contact-primary">PRIMARY</span>{/if}
                  <button type="button" class="fm-contact-del" onclick={() => removeContact(i)}>✕</button>
                </div>
                {#if errors[`contact-${i}-name`]}<span class="fm-err">{errors[`contact-${i}-name`]}</span>{/if}
                <div class="fm-contact-grid">
                  <label class="fm-field">
                    <span>Title</span>
                    <input type="text" value={contact.title} oninput={(e) => setContactField(i, 'title', (e.currentTarget as HTMLInputElement).value)} />
                  </label>
                  <label class="fm-field">
                    <span>Email</span>
                    <input type="email" value={contact.email} oninput={(e) => setContactField(i, 'email', (e.currentTarget as HTMLInputElement).value)} />
                    {#if errors[`contact-${i}-email`]}<span class="fm-err">{errors[`contact-${i}-email`]}</span>{/if}
                  </label>
                  <label class="fm-field">
                    <span>Phone</span>
                    <input type="text" value={contact.phone} oninput={(e) => setContactField(i, 'phone', (e.currentTarget as HTMLInputElement).value)} />
                    {#if errors[`contact-${i}-phone`]}<span class="fm-err">{errors[`contact-${i}-phone`]}</span>{/if}
                  </label>
                </div>
                {#if !contact.primary}
                  <button type="button" class="fm-make-primary" onclick={() => setContactField(i, 'primary', true)}>
                    Make primary
                  </button>
                {/if}
              </article>
            {/each}
          </div>
          <button type="button" class="fm-add-contact" onclick={addContact}>+ Add contact</button>
        {:else if activeTab === 'notes'}
          <label class="fm-field fm-field-tall">
            <span>Account notes</span>
            <textarea
              rows="10"
              placeholder="Free-form notes about the account…"
              value={draft.notes}
              oninput={(e) => setDraftField('notes', (e.currentTarget as HTMLTextAreaElement).value)}
            ></textarea>
          </label>
        {/if}
      </div>
    {/if}
  </aside>
</section>

<style>
  /* Status / tier chip colours identify a value, not the theme, so they
     stay hardcoded; only their dark ramp is adjusted here for legibility. */
  .fm-shell {
    height: 100%;
    --fm-err-fg:  #b91c1c;
    --fm-blue-bg: #dbeafe;   --fm-blue-fg: #1d4ed8;
    --fm-green-bg: #dcfce7;  --fm-green-fg: #166534;
    --fm-amber-bg: #fef3c7;  --fm-amber-fg: #92400e;
    --fm-teal-bg: #ccfbf1;   --fm-teal-fg: #115e59;
    --fm-red-bg:  #fee2e2;   --fm-red-fg:  #b91c1c;
    --fm-violet-bg: #ede9fe; --fm-violet-fg: #5b21b6;
  }
  :global([data-theme='dark']) .fm-shell {
    --fm-err-fg:  #f87171;
    --fm-blue-bg: rgba(59,130,246,.18);  --fm-blue-fg: #93c5fd;
    --fm-green-bg: rgba(34,197,94,.18);  --fm-green-fg: #4ade80;
    --fm-amber-bg: rgba(245,158,11,.18); --fm-amber-fg: #fbbf24;
    --fm-teal-bg: rgba(20,184,166,.18);  --fm-teal-fg: #5eead4;
    --fm-red-bg:  rgba(239,68,68,.18);   --fm-red-fg:  #f87171;
    --fm-violet-bg: rgba(139,92,246,.18); --fm-violet-fg: #c4b5fd;
  }

  /* Master grid */
  .fm-master {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    overflow: hidden;
  }
  .fm-master-head {
    padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    font-size: 11.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .fm-current-tag {
    color: var(--sg-accent, #2563eb);
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
  }

  /* Detail panel */
  .fm-detail {
    width: 480px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    overflow: hidden;
  }
  .fm-empty {
    flex: 1 1 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sg-muted, #64748b);
    font-style: italic;
  }
  .fm-detail-head {
    padding: 14px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .fm-detail-title { font-size: 17px; margin: 0; }
  .fm-detail-sub   { font-size: 11px; color: var(--sg-muted, #64748b); margin: 2px 0 0 0; }
  .fm-detail-actions { display: inline-flex; gap: 6px; flex-shrink: 0; }
  .fm-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .fm-btn:hover:not(:disabled) { background: var(--sg-header-bg, #f1f5f9); }
  .fm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .fm-btn-primary {
    border-color: transparent;
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
  }

  /* Tabs */
  .fm-tabs {
    display: flex;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
  }
  .fm-tab {
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    padding: 8px 14px;
    font-size: 12.5px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .fm-tab:hover { color: var(--sg-fg, #1e293b); }
  .fm-tab-active {
    color: var(--sg-accent, #2563eb);
    border-bottom-color: var(--sg-accent, #2563eb);
    font-weight: 600;
  }

  /* Form */
  .fm-form {
    flex: 1 1 0;
    overflow: auto;
    padding: 16px;
  }
  .fm-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }
  .fm-row:has(.fm-field:nth-child(3)) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .fm-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .fm-field-wide { grid-column: 1 / -1; }
  .fm-field-tall textarea {
    width: 100%;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 6px 8px;
    font-size: 12.5px;
    font-family: inherit;
    resize: vertical;
  }
  .fm-field > span {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted, #64748b);
  }
  .fm-field > input,
  .fm-field > select {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 5px 8px;
    font-size: 12.5px;
  }
  .fm-err {
    font-size: 10.5px;
    color: var(--fm-err-fg);
  }

  /* Contacts */
  .fm-contact-list { display: flex; flex-direction: column; gap: 10px; }
  .fm-contact-card {
    padding: 10px;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 8px;
  }
  .fm-contact-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .fm-contact-name {
    flex: 1 1 0;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 5px 8px;
    font-size: 12.5px;
    font-weight: 600;
  }
  .fm-contact-primary {
    font-size: 10px;
    font-weight: 700;
    color: var(--sg-on-accent, #fff);
    background: var(--sg-accent, #2563eb);
    padding: 2px 6px;
    border-radius: 3px;
    letter-spacing: 0.04em;
  }
  .fm-contact-del {
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    cursor: pointer;
    font-size: 12px;
  }
  .fm-contact-del:hover { color: #dc2626; }
  .fm-contact-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 8px;
  }
  .fm-make-primary {
    margin-top: 6px;
    border: 0;
    background: transparent;
    color: var(--sg-accent, #2563eb);
    cursor: pointer;
    font-size: 11.5px;
    padding: 0;
  }
  .fm-add-contact {
    margin-top: 12px;
    border: 1px dashed var(--sg-border, #cbd5e1);
    background: transparent;
    color: var(--sg-muted, #64748b);
    border-radius: 6px;
    padding: 8px;
    width: 100%;
    cursor: pointer;
    font-size: 12px;
  }
  .fm-add-contact:hover {
    border-color: var(--sg-accent, #2563eb);
    color: var(--sg-accent, #2563eb);
  }

  /* Cell pills (mirrors of master columns) */
  :global(.fm-status) {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }
  :global(.fm-status-prospect)    { background: var(--fm-blue-bg);  color: var(--fm-blue-fg); }
  :global(.fm-status-active)      { background: var(--fm-green-bg); color: var(--fm-green-fg); }
  :global(.fm-status-churn_risk)  { background: var(--fm-amber-bg); color: var(--fm-amber-fg); }
  :global(.fm-status-closed_won)  { background: var(--fm-teal-bg);  color: var(--fm-teal-fg); }
  :global(.fm-status-closed_lost) { background: var(--fm-red-bg);   color: var(--fm-red-fg); }

  :global(.fm-tier) {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }
  :global(.fm-tier-starter)    { background: var(--sg-bg-subtle, var(--sg-header-bg, #e2e8f0)); color: var(--sg-muted, #475569); }
  :global(.fm-tier-growth)     { background: var(--fm-blue-bg);   color: var(--fm-blue-fg); }
  :global(.fm-tier-enterprise) { background: var(--fm-violet-bg); color: var(--fm-violet-fg); }

  :global(.fm-arr) { font-variant-numeric: tabular-nums; font-weight: 600; }
</style>
