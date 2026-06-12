<script lang="ts">
  /**
   * 92. Natural-language filter bar
   * -------------------------------
   * Type a sentence ("EMEA Q3 over 100k", "active sales rep starting with A
   * younger than 35"); a deterministic mini-parser maps it to a chain of
   * `api.setFilter(columnId, ...)` calls plus an optional `setSort`.
   *
   * The parser is rule-based, not ML-driven, so it stays fast, predictable,
   * and works offline. The same shape (token → intent → filter) is what
   * you'd hand to an LLM to JSON-out instead - swap the parser body for a
   * fetch and the rest of the wiring stays identical.
   *
   * Supported phrasing:
   *   - "over 100k", "less than 50", "between 100 and 200"
   *   - "before 2026-06-01", "after Jan 1", "this month", "Q2"
   *   - "EMEA", "active", "engineering" (matches set-filter values)
   *   - "starting with A", "containing 'ada'"
   *   - "sort by salary desc" / "highest amount" / "lowest age"
   *   - "top 5 by salary", "top 10"
   *
   * Tokens that don't resolve into a column drop into a generic "search"
   * filter on the title-like columns.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let rows = $state<Person[]>(makePeople(120))
  let api = $state<SvGridApi<typeof features, Person> | null>(null)

  type FieldKind = 'text' | 'number' | 'date' | 'enum'
  type FieldSpec = {
    id: keyof Person
    label: string
    kind: FieldKind
    values?: ReadonlyArray<string>
    aliases?: ReadonlyArray<string>
  }
  const FIELDS: FieldSpec[] = [
    { id: 'firstName', label: 'First name', kind: 'text' },
    { id: 'lastName',  label: 'Last name',  kind: 'text' },
    { id: 'email',     label: 'Email',      kind: 'text' },
    { id: 'department',label: 'Department', kind: 'enum',
      values: ['Engineering','Design','Product','Sales','Support','Operations'],
      aliases: ['dept', 'team'] },
    { id: 'country',   label: 'Country',    kind: 'enum',
      values: ['US','UK','DE','FR','JP','BR','IN','AU','CA','NL'],
      aliases: ['region'] },
    { id: 'status',    label: 'Status',     kind: 'enum',
      values: ['active','pending','inactive'] },
    { id: 'age',       label: 'Age',        kind: 'number' },
    { id: 'salary',    label: 'Salary',     kind: 'number',  aliases: ['compensation','pay'] },
    { id: 'joinedAt',  label: 'Joined',     kind: 'date',    aliases: ['joined','hired'] },
  ]

  type ParsedFilter = {
    field: keyof Person
    operator: 'equals' | 'contains' | 'startsWith' | 'greaterThan' | 'lessThan' | 'between'
    value: unknown
    valueTo?: unknown
    explain: string
  }
  type ParsedQuery = {
    filters: ParsedFilter[]
    sort: { field: keyof Person; desc: boolean } | null
    topN: number | null
    /** Tokens that the parser couldn't bind to a known column. */
    leftover: string[]
  }

  // ---- Helpers -----------------------------------------------------------
  const REL_DATE_RE = /^(today|yesterday|this\s+(?:week|month|quarter|year)|last\s+(?:week|month|quarter|year))$/i

  function parseAmount(token: string): number | null {
    const m = token.toLowerCase().replace(/[$,]/g, '').match(/^(\d+(?:\.\d+)?)([km])?$/)
    if (!m) return null
    const n = parseFloat(m[1]!)
    const suffix = m[2]
    if (suffix === 'k') return n * 1_000
    if (suffix === 'm') return n * 1_000_000
    return n
  }

  function parseDate(text: string): string | null {
    const t = text.trim().toLowerCase()
    const today = new Date()
    if (t === 'today')     return today.toISOString().slice(0, 10)
    if (t === 'yesterday') { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }
    if (t === 'this month') return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
    if (t === 'this year')  return `${today.getFullYear()}-01-01`
    if (t.startsWith('q')) {
      const q = parseInt(t.slice(1), 10)
      if (q >= 1 && q <= 4) {
        const month = (q - 1) * 3
        return `${today.getFullYear()}-${String(month + 1).padStart(2, '0')}-01`
      }
    }
    const d = new Date(text)
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }

  function findFieldByToken(token: string): FieldSpec | null {
    const t = token.toLowerCase()
    for (const f of FIELDS) {
      if (f.label.toLowerCase() === t) return f
      if (f.id.toString().toLowerCase() === t) return f
      if (f.aliases?.some((a) => a.toLowerCase() === t)) return f
    }
    return null
  }

  function findEnumValueAcrossFields(token: string): { field: FieldSpec; value: string } | null {
    const t = token.toLowerCase()
    for (const f of FIELDS) {
      if (f.kind !== 'enum' || !f.values) continue
      const v = f.values.find((vv) => vv.toLowerCase() === t)
      if (v) return { field: f, value: v }
    }
    return null
  }

  // ---- Parser ------------------------------------------------------------
  function parse(query: string): ParsedQuery {
    const out: ParsedQuery = { filters: [], sort: null, topN: null, leftover: [] }
    let s = query.trim()
    if (!s) return out

    // Pre-parse: pull out sort phrases.
    const sortRx = /\bsort\s+by\s+(\w+)(?:\s+(asc|desc|ascending|descending))?/i
    const sortMatch = s.match(sortRx)
    if (sortMatch) {
      const field = findFieldByToken(sortMatch[1]!)
      if (field) {
        out.sort = { field: field.id, desc: /^desc/i.test(sortMatch[2] ?? '') }
        s = s.replace(sortRx, ' ')
      }
    }
    const highestRx = /\b(highest|biggest|largest|top)\s+(\w+)/i
    const highestM = s.match(highestRx)
    if (!out.sort && highestM) {
      const field = findFieldByToken(highestM[2]!)
      if (field) {
        out.sort = { field: field.id, desc: true }
        s = s.replace(highestRx, ' ')
      }
    }
    const lowestRx = /\b(lowest|smallest|bottom)\s+(\w+)/i
    const lowestM = s.match(lowestRx)
    if (!out.sort && lowestM) {
      const field = findFieldByToken(lowestM[2]!)
      if (field) {
        out.sort = { field: field.id, desc: false }
        s = s.replace(lowestRx, ' ')
      }
    }

    const topNM = s.match(/\btop\s+(\d+)/i)
    if (topNM) {
      out.topN = parseInt(topNM[1]!, 10)
      s = s.replace(/\btop\s+\d+/i, ' ')
    }

    // Number comparators: "salary over 100k", "age less than 35", "between A and B".
    const numComparatorRx = /(\w+)\s+(?:greater than|more than|over|above|gt|>)\s*(\$?\d[\d.,kKmM]*)/g
    s = s.replace(numComparatorRx, (m, fieldTok, valueTok) => {
      const field = findFieldByToken(fieldTok)
      const n = parseAmount(valueTok)
      if (field && n !== null && field.kind === 'number') {
        out.filters.push({ field: field.id, operator: 'greaterThan', value: n,
          explain: `${field.label} > ${valueTok}` })
        return ' '
      }
      return m
    })
    const numLessRx = /(\w+)\s+(?:less than|under|below|lt|<)\s*(\$?\d[\d.,kKmM]*)/g
    s = s.replace(numLessRx, (m, fieldTok, valueTok) => {
      const field = findFieldByToken(fieldTok)
      const n = parseAmount(valueTok)
      if (field && n !== null && field.kind === 'number') {
        out.filters.push({ field: field.id, operator: 'lessThan', value: n,
          explain: `${field.label} < ${valueTok}` })
        return ' '
      }
      return m
    })
    const betweenRx = /(\w+)\s+between\s+(\$?\d[\d.,kKmM]*)\s+and\s+(\$?\d[\d.,kKmM]*)/gi
    s = s.replace(betweenRx, (m, fieldTok, lo, hi) => {
      const field = findFieldByToken(fieldTok)
      const n1 = parseAmount(lo), n2 = parseAmount(hi)
      if (field && n1 !== null && n2 !== null && field.kind === 'number') {
        out.filters.push({ field: field.id, operator: 'between', value: Math.min(n1, n2), valueTo: Math.max(n1, n2),
          explain: `${field.label} between ${lo} and ${hi}` })
        return ' '
      }
      return m
    })

    // Date comparators: "joined after 2026-01-01", "before this month".
    const dateAfterRx = /(\w+)\s+after\s+([\w\s-]+?)(?=\s+(?:and|or)\s+|$)/gi
    s = s.replace(dateAfterRx, (m, fieldTok, dateTok) => {
      const field = findFieldByToken(fieldTok)
      const iso = parseDate(dateTok.trim())
      if (field && iso && field.kind === 'date') {
        out.filters.push({ field: field.id, operator: 'greaterThan', value: iso,
          explain: `${field.label} after ${dateTok.trim()}` })
        return ' '
      }
      return m
    })
    const dateBeforeRx = /(\w+)\s+before\s+([\w\s-]+?)(?=\s+(?:and|or)\s+|$)/gi
    s = s.replace(dateBeforeRx, (m, fieldTok, dateTok) => {
      const field = findFieldByToken(fieldTok)
      const iso = parseDate(dateTok.trim())
      if (field && iso && field.kind === 'date') {
        out.filters.push({ field: field.id, operator: 'lessThan', value: iso,
          explain: `${field.label} before ${dateTok.trim()}` })
        return ' '
      }
      return m
    })

    // Text comparators: "name starting with A", "containing 'ada'".
    const startsWithRx = /(\w+)\s+(?:starting with|starts with|begins with)\s+'?([\w@.-]+)'?/gi
    s = s.replace(startsWithRx, (m, fieldTok, vTok) => {
      const field = findFieldByToken(fieldTok)
      if (field && (field.kind === 'text' || field.kind === 'enum')) {
        out.filters.push({ field: field.id, operator: 'startsWith', value: vTok,
          explain: `${field.label} starts with "${vTok}"` })
        return ' '
      }
      return m
    })
    const containsRx = /(\w+)\s+(?:contains?|with|includes?)\s+'?([\w@.-]+)'?/gi
    s = s.replace(containsRx, (m, fieldTok, vTok) => {
      const field = findFieldByToken(fieldTok)
      if (field && (field.kind === 'text' || field.kind === 'enum')) {
        out.filters.push({ field: field.id, operator: 'contains', value: vTok,
          explain: `${field.label} contains "${vTok}"` })
        return ' '
      }
      return m
    })

    // Bare enum tokens: "EMEA", "active", "engineering"
    const tokens = s.split(/\s+/).filter(Boolean)
    for (const tok of tokens) {
      if (REL_DATE_RE.test(tok)) continue
      const enumHit = findEnumValueAcrossFields(tok)
      if (enumHit) {
        out.filters.push({ field: enumHit.field.id, operator: 'equals', value: enumHit.value,
          explain: `${enumHit.field.label} = ${enumHit.value}` })
      } else if (tok.length >= 2) {
        out.leftover.push(tok)
      }
    }

    // Leftover tokens go to a "first-name contains" search to mimic
    // a global search.
    if (out.leftover.length > 0) {
      const phrase = out.leftover.join(' ')
      out.filters.push({ field: 'firstName', operator: 'contains', value: phrase,
        explain: `Free text "${phrase}" against First name` })
    }

    return out
  }

  // ---- Apply parsed query against the grid ------------------------------
  let queryText = $state('')
  let parsed = $state<ParsedQuery>({ filters: [], sort: null, topN: null, leftover: [] })

  function commitQuery() {
    if (!api) return
    parsed = parse(queryText)
    api.clearAllFilters()
    for (const f of parsed.filters) {
      api.setFilter(f.field as string, {
        operator: f.operator,
        value: f.value as never,
        valueTo: f.valueTo as never,
      } as never)
    }
    if (parsed.sort) {
      api.setSort(parsed.sort.field as string, parsed.sort.desc ? 'desc' : 'asc')
    } else {
      api.clearSort()
    }
  }
  function clear() {
    queryText = ''
    parsed = { filters: [], sort: null, topN: null, leftover: [] }
    api?.clearAllFilters()
    api?.clearSort()
  }

  const SAMPLES = [
    'EMEA active over 50k',
    'engineering younger than 35',
    'highest salary',
    'top 5 by salary',
    'department equals sales sort by age desc',
    'joined after 2026-01-01',
    'firstName starting with A',
  ]

  // ---- Grid setup --------------------------------------------------------
  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName',  header: 'First',      width: 110 },
    { field: 'lastName',   header: 'Last',       width: 130 },
    { field: 'email',      header: 'Email',      width: 200 },
    { field: 'department', header: 'Department', width: 130 },
    { field: 'country',    header: 'Country',    width: 80 },
    { field: 'status',     header: 'Status',     width: 110 },
    { field: 'age',        header: 'Age',        width: 70, align: 'right' },
    { field: 'salary',     header: 'Salary',     width: 130, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'joinedAt',   header: 'Joined',     width: 130 },
  ]
</script>

<section class="nlf-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- AI Platform key notice. This demo runs against a rule-based
       fallback so evaluators don't need a key to click around, but
       the production wiring routes queries through your AI Platform
       API key (set as VITE_AI_PLATFORM_KEY or POST'd via your backend).
       Pro feature - in `sv-grid-pro`. -->
  <aside class="nlf-aikey shrink-0" role="note">
    <span class="nlf-aikey-badge">PRO · AI</span>
    <div class="nlf-aikey-body">
      <strong>Requires an AI Platform key.</strong>
      The natural-language parser routes through your provider (OpenAI / Anthropic / Azure / your own endpoint).
      This demo runs against a built-in <em>rule-based fallback</em> so you can evaluate the UX without a key -
      production deployments wire <code>VITE_AI_PLATFORM_KEY</code> into the Pro <code>aiAssistant</code> adapter.
    </div>
    <a class="nlf-aikey-docs" href="#/docs/pro/ai-platform">Get a key →</a>
  </aside>

  <header class="nlf-bar shrink-0">
    <span class="nlf-spark" aria-hidden="true">✨</span>
    <input
      class="nlf-input"
      type="text"
      placeholder='Try "EMEA active over 50k" or "engineering younger than 35"'
      bind:value={queryText}
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitQuery() } }}
    />
    <button type="button" class="nlf-btn nlf-btn-primary" onclick={commitQuery}>Apply</button>
    <button type="button" class="nlf-btn nlf-btn-ghost"  onclick={clear} disabled={!queryText && parsed.filters.length === 0}>Clear</button>
  </header>

  {#if parsed.filters.length > 0 || parsed.sort}
    <div class="nlf-chain shrink-0">
      <span class="nlf-chain-label">Parsed</span>
      {#each parsed.filters as f, i (i)}
        <span class="nlf-chip">{f.explain}</span>
      {/each}
      {#if parsed.sort}
        <span class="nlf-chip nlf-chip-sort">Sort {String(parsed.sort.field)} {parsed.sort.desc ? '↓' : '↑'}</span>
      {/if}
      {#if parsed.topN}<span class="nlf-chip">Top {parsed.topN}</span>{/if}
    </div>
  {/if}

  <div class="nlf-samples shrink-0">
    <span class="nlf-samples-label">Try:</span>
    {#each SAMPLES as s (s)}
      <button type="button" class="nlf-sample" onclick={() => { queryText = s; commitQuery() }}>"{s}"</button>
    {/each}
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  .nlf-shell { height: 100%; }

  /* AI Platform key notice */
  .nlf-aikey {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 10px 12px;
    border: 1px solid color-mix(in oklab, #6366f1 30%, transparent);
    background: linear-gradient(135deg, color-mix(in oklab, #6366f1 8%, var(--sg-bg, #fff)),
                                         color-mix(in oklab, #8b5cf6 5%, var(--sg-bg, #fff)));
    border-radius: 8px;
    font-size: 12.5px; line-height: 1.4;
    color: var(--sg-fg, #0f172a);
  }
  .nlf-aikey-badge {
    flex-shrink: 0;
    font-size: 10px; font-weight: 800; letter-spacing: 0.06em;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    padding: 4px 8px; border-radius: 4px;
    align-self: center;
  }
  .nlf-aikey-body { flex: 1; min-width: 0; }
  .nlf-aikey-body strong { color: #4338ca; margin-right: 4px; }
  .nlf-aikey-body em { font-style: italic; color: var(--sg-muted, #64748b); }
  .nlf-aikey-body code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: color-mix(in oklab, #6366f1 12%, transparent);
    color: #4338ca; padding: 1px 5px; border-radius: 3px; font-size: 11.5px;
  }
  .nlf-aikey-docs {
    flex-shrink: 0; align-self: center;
    color: #6366f1; font-weight: 700; font-size: 12px;
    text-decoration: none; white-space: nowrap;
    padding: 4px 10px; border-radius: 6px;
    border: 1px solid color-mix(in oklab, #6366f1 30%, transparent);
    background: var(--sg-bg, #fff);
  }
  .nlf-aikey-docs:hover { background: color-mix(in oklab, #6366f1 10%, transparent); }

  .nlf-bar {
    display: flex; align-items: center; gap: 8px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 8px 12px;
    box-shadow: 0 1px 0 rgba(15,23,42,0.04);
  }
  .nlf-spark { font-size: 16px; color: var(--sg-accent, #6366f1); }
  .nlf-input {
    flex: 1;
    border: 0; outline: none; background: transparent;
    color: var(--sg-fg, #0f172a);
    font-size: 14px;
    padding: 4px 4px;
  }
  .nlf-input::placeholder { color: var(--sg-muted, #94a3b8); }
  .nlf-btn {
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px; font-weight: 600;
    cursor: pointer;
  }
  .nlf-btn:disabled { opacity: 0.5; cursor: default; }
  .nlf-btn-primary { background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff; border: 0; }
  .nlf-btn-ghost   {
    background: transparent; color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
  }
  .nlf-btn-ghost:hover:not(:disabled) { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }

  .nlf-chain {
    display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #fff);
  }
  .nlf-chain-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .nlf-chip {
    display: inline-block; padding: 2px 9px; border-radius: 999px;
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #0f172a);
    font-size: 12px;
  }
  .nlf-chip-sort { background: rgba(99,102,241,0.18); color: #3730a3; }
  :global([data-theme='dark']) .nlf-chip-sort { background: rgba(99,102,241,0.30); color: #c7d2fe; }

  .nlf-samples { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
  .nlf-samples-label { font-size: 11px; color: var(--sg-muted, #64748b); }
  .nlf-sample {
    background: var(--sg-header-bg, #f1f5f9);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .nlf-sample:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.18)); }
</style>
