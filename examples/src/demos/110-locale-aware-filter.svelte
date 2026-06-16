<script lang="ts">
  /**
   * 110. Locale-aware text filtering (accent + case insensitive)
   * ------------------------------------------------------------
   * Set `filterLocale` on `<SvGrid>` (BCP-47 tag) and the grid filters
   * text using NFD-decomposition + diacritic stripping + locale-aware
   * lowercasing. The result:
   *
   *   - "cafe" matches "Café", "CAFÉ", "café"
   *   - "munch" matches "München"
   *   - "tunel" matches "túnel"
   *   - In `tr-TR`: "istanbul" matches "İstanbul" (dotted-I rule)
   *
   * The same pipeline drives global search AND every column's contains /
   * equals / startsWith operator in the column menu.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from 'sv-grid-core'

  type City = {
    id: number
    city: string
    country: string
    region: 'Europe' | 'Americas' | 'Asia' | 'Africa' | 'Oceania'
    population: number
    notes: string
  }

  let rows = $state<City[]>([
    { id: 1,  city: 'München',       country: 'Deutschland',     region: 'Europe',   population:  1_510_000, notes: 'Bayerische Hauptstadt' },
    { id: 2,  city: 'Köln',          country: 'Deutschland',     region: 'Europe',   population:  1_080_000, notes: 'Dom-Stadt am Rhein' },
    { id: 3,  city: 'Zürich',        country: 'Schweiz',         region: 'Europe',   population:    430_000, notes: 'Finanzplatz' },
    { id: 4,  city: 'Genève',        country: 'Suisse',          region: 'Europe',   population:    203_000, notes: 'Siège des Nations Unies' },
    { id: 5,  city: 'Montréal',      country: 'Canada',          region: 'Americas', population:  1_780_000, notes: 'Ville francophone' },
    { id: 6,  city: 'Québec',        country: 'Canada',          region: 'Americas', population:    540_000, notes: 'Capitale provinciale' },
    { id: 7,  city: 'México',        country: 'México',          region: 'Americas', population:  9_210_000, notes: 'Ciudad de México' },
    { id: 8,  city: 'São Paulo',     country: 'Brasil',          region: 'Americas', population: 12_330_000, notes: 'Maior cidade do país' },
    { id: 9,  city: 'Brasília',      country: 'Brasil',          region: 'Americas', population:  3_050_000, notes: 'Capital federal' },
    { id: 10, city: 'Bogotá',        country: 'Colombia',        region: 'Americas', population:  7_410_000, notes: 'Capital andina' },
    { id: 11, city: 'Tōkyō',         country: '日本',              region: 'Asia',     population: 13_960_000, notes: 'Cherry blossoms in spring' },
    { id: 12, city: 'Ōsaka',         country: '日本',              region: 'Asia',     population:  2_750_000, notes: 'Famous for street food' },
    { id: 13, city: 'Sapporo',       country: '日本',              region: 'Asia',     population:  1_970_000, notes: 'Snow festival hub' },
    { id: 14, city: 'İstanbul',      country: 'Türkiye',         region: 'Asia',     population: 15_840_000, notes: 'Köprü Asya ile Avrupa arasında' },
    { id: 15, city: 'İzmir',         country: 'Türkiye',         region: 'Asia',     population:  4_390_000, notes: 'Ege Denizi kıyısında' },
    { id: 16, city: 'Tunis',         country: 'Tunisie',         region: 'Africa',   population:    640_000, notes: 'Médina inscrite UNESCO' },
    { id: 17, city: "N'Djamena",     country: 'Tchad',           region: 'Africa',   population:  1_440_000, notes: 'Capitale sur le Chari' },
    { id: 18, city: 'Reykjavík',     country: 'Ísland',          region: 'Europe',   population:    140_000, notes: 'Nyrsta höfuðborg heims' },
    { id: 19, city: 'København',     country: 'Danmark',         region: 'Europe',   population:    660_000, notes: 'Hovedstad og kongesæde' },
    { id: 20, city: 'Göteborg',      country: 'Sverige',         region: 'Europe',   population:    580_000, notes: 'Hamnstad på västkusten' },
    { id: 21, city: 'Málaga',        country: 'España',          region: 'Europe',   population:    580_000, notes: 'Ciudad natal de Picasso' },
    { id: 22, city: 'A Coruña',      country: 'España',          region: 'Europe',   population:    245_000, notes: 'Torre de Hércules' },
    { id: 23, city: 'Wrocław',       country: 'Polska',          region: 'Europe',   population:    640_000, notes: 'Miasto stu mostów' },
    { id: 24, city: 'Łódź',          country: 'Polska',          region: 'Europe',   population:    670_000, notes: 'Dawna stolica przemysłu' },
    { id: 25, city: 'Reykjanesbær',  country: 'Ísland',          region: 'Europe',   population:     22_000, notes: 'Bær á Suðurnesjum' },
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- Locale picker ---------------------------------------------------
  type LocalePreset = { id: string; label: string; locale: string | undefined; hint: string }
  const LOCALES: LocalePreset[] = [
    { id: 'browser', label: 'Browser default',  locale: undefined,  hint: 'Whatever navigator.language reports' },
    { id: 'en-US',   label: 'English (US)',     locale: 'en-US',    hint: 'Standard Western lowercasing' },
    { id: 'de-DE',   label: 'German',           locale: 'de-DE',    hint: 'ÄÖÜ → äöü → aou; ß stays as ss when normalized' },
    { id: 'fr-FR',   label: 'French',           locale: 'fr-FR',    hint: 'É È Ê Ë → eee; Ç → c' },
    { id: 'es-ES',   label: 'Spanish',          locale: 'es-ES',    hint: 'Á É Í Ó Ú Ü Ñ all fold to a e i o u u n' },
    { id: 'pt-BR',   label: 'Portuguese (BR)',  locale: 'pt-BR',    hint: 'Ã Õ Ç → a o c; São → sao' },
    { id: 'tr-TR',   label: 'Turkish',          locale: 'tr-TR',    hint: 'İ → i (dotted), I → ı (dotless). "istanbul" matches "İstanbul"' },
    { id: 'is',      label: 'Icelandic',        locale: 'is',       hint: 'Þ Ð Æ Ö - non-ASCII letters stay distinct' },
  ]
  let selectedLocaleId = $state<string>('browser')
  const currentLocale = $derived(LOCALES.find((l) => l.id === selectedLocaleId)?.locale)
  const currentHint = $derived(LOCALES.find((l) => l.id === selectedLocaleId)?.hint ?? '')

  // ---- Sample queries that prove locale-aware matching ------------------
  const SAMPLES = [
    { q: 'munchen',     why: '→ matches München (German umlaut stripped)' },
    { q: 'cafe',        why: '→ matches Genève? No - try "geneve" or "geneve" instead' },
    { q: 'geneve',      why: '→ matches Genève (è → e)' },
    { q: 'sao paulo',   why: '→ matches São Paulo (ã → a)' },
    { q: 'tokyo',       why: '→ matches Tōkyō (macron stripped)' },
    { q: 'istanbul',    why: '→ matches İstanbul under any locale (NFD strips the dot)' },
    { q: 'mexico',      why: '→ matches México (é → e)' },
    { q: 'wroclaw',     why: '→ matches Wrocław (Polish stroke-l would not strip with NFD; this only matches the rest)' },
    { q: 'reykjavik',   why: '→ matches Reykjavík (í → i)' },
    { q: 'rhein',       why: '→ matches "Dom-Stadt am Rhein"' },
  ]

  const columns: ColumnDef<typeof features, City>[] = [
    { field: 'city',       header: 'City',       width: 180, editable: false },
    { field: 'country',    header: 'Country',    width: 160, editable: false },
    { field: 'region',     header: 'Region',     width: 110, editable: false },
    { field: 'population', header: 'Population', width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'notes',      header: 'Notes',      width: 360, editable: false },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="info shrink-0">
    <p>
      <strong>Type any unaccented query in the global filter</strong> - the grid normalises both the
      query and every cell value (NFD-decompose + strip combining marks + locale-aware lowercase)
      before matching. The chosen locale only affects edge cases like Turkish dotted-I.
    </p>
    <div class="controls">
      <label class="ctrl">
        <span>Locale</span>
        <select bind:value={selectedLocaleId}>
          {#each LOCALES as l (l.id)}<option value={l.id}>{l.label}</option>{/each}
        </select>
      </label>
      <span class="hint-inline"><strong>Locale hint:</strong> {currentHint}</span>
    </div>
    <p class="hint">
      Use the global filter input in the grid header (top-left), or click one of these sample queries
      to test (it copies to clipboard - then paste into the filter input):
    </p>
    <div class="samples">
      {#each SAMPLES as s (s.q)}
        <button class="sample" onclick={() => navigator.clipboard?.writeText(s.q)} title={s.why}>"{s.q}"</button>
      {/each}
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showGlobalFilter={true}
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
      filterLocale={currentLocale}
    />
  </div>
</section>

<style>
  .info {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(99,102,241,0.04), rgba(16,185,129,0.04));
    border-radius: 8px; padding: 10px 14px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .info p { margin: 0 0 6px; }
  .controls { display: flex; gap: 10px; align-items: stretch; margin-top: 4px; }
  .ctrl { display: flex; flex-direction: column; gap: 3px; }
  .ctrl.flex-1 { flex: 1; }
  .ctrl > span {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
    font-weight: 700; color: var(--sg-muted, #64748b);
  }
  .hint-inline { font-size: 12px; align-self: flex-end; color: var(--sg-muted, #64748b); }
  .hint-inline strong { color: #6366f1; }
  .ctrl input, .ctrl select {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 6px 10px; font-size: 13px;
  }
  .hint {
    color: var(--sg-muted, #64748b); font-size: 12px; font-style: italic;
    margin-top: 4px !important;
  }
  .hint strong { font-style: normal; color: #6366f1; font-weight: 700; }

  .samples { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .samples-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #94a3b8); font-weight: 700;
    align-self: center;
  }
  .sample {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 999px; padding: 2px 10px;
    font-size: 11px; font-family: ui-monospace, monospace;
    cursor: pointer;
  }
  .sample:hover { background: color-mix(in oklab, #6366f1 8%, transparent);
                  border-color: #6366f1; color: #4338ca; }
</style>
