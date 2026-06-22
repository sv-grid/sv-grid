<script lang="ts">
  /**
   * 166. Pivot - Analysis workspace (Enterprise)
   * --------------------------------------------
   * A loyalty / membership analytics workspace built on `<SvPivotDesigner>`
   * (see demo 168 for the canonical sales example). The component handles
   * the whole authoring UX - field rail, four drop wells, drag-and-drop,
   * chip menus, presets, totals toggles, and the inline pivot grid - so
   * a real workspace is now ~80 lines of glue.
   *
   * The seed dataset is a loyalty shape: 6 cities × 3 membership tiers ×
   * 8 hourly time buckets, with spend + rating measures and a few extra
   * dimensions (gender, age band, discount) the user can pull into the
   * layout. ~1800 rows pivots live without virtualisation.
   */
  import {
    SvPivotDesigner,
    setLicenseKey,
    type PivotField,
    type PivotLayout,
    type PivotPreset,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  // ---- Domain --------------------------------------------------------
  type City = 'Chicago' | 'Houston' | 'Los Angeles' | 'Miami' | 'New York' | 'San Francisco'
  type Membership = 'Bronze' | 'Silver' | 'Gold'
  type Gender = 'M' | 'F' | 'X'
  type AgeBand = '18-24' | '25-34' | '35-44' | '45-54' | '55+'
  type Fact = {
    age: AgeBand
    time: string
    city: City
    gender: Gender
    membership: Membership
    spend: number
    spendChange: number
    rating: number
    discount: 'Yes' | 'No'
  }

  const CITIES: readonly City[] = ['Chicago', 'Houston', 'Los Angeles', 'Miami', 'New York', 'San Francisco']
  const MEMBERSHIPS: readonly Membership[] = ['Bronze', 'Silver', 'Gold']
  const GENDERS: readonly Gender[] = ['M', 'F', 'X']
  const AGES: readonly AgeBand[] = ['18-24', '25-34', '35-44', '45-54', '55+']
  const TIMES: readonly string[] = Array.from({ length: 8 }, (_, i) => String(i).padStart(2, '0') + ':00')
  const CITY_BASE: Record<City, number> = {
    Chicago: 320, Houston: 240, 'Los Angeles': 480,
    Miami: 220, 'New York': 580, 'San Francisco': 520,
  }
  const TIER_MULT: Record<Membership, number> = { Bronze: 1, Silver: 1.6, Gold: 2.4 }

  // Deterministic PRNG so the same dataset renders across reloads.
  let prng = 0x12345678
  function rnd(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }
  function seedFacts(): Fact[] {
    const out: Fact[] = []
    for (let i = 0; i < 1800; i += 1) {
      const city = pick(CITIES)
      const membership = pick(MEMBERSHIPS)
      const baseline = CITY_BASE[city] * TIER_MULT[membership]
      out.push({
        age: pick(AGES),
        time: pick(TIMES),
        city, gender: pick(GENDERS), membership,
        spend: Math.round(baseline * (0.55 + rnd() * 1.4)),
        spendChange: Math.round((rnd() * 60 - 18) * 10) / 10,
        rating: Math.round((2.6 + rnd() * 2.4) * 100) / 100,
        discount: rnd() < 0.32 ? 'Yes' : 'No',
      })
    }
    return out
  }
  const facts: Fact[] = seedFacts()

  // ---- Fields offered to the designer's left rail --------------------
  const fields: PivotField<Fact>[] = [
    { field: 'city',        label: 'City',         kind: 'dimension', group: 'Customer' },
    { field: 'membership',  label: 'Membership',   kind: 'dimension', group: 'Customer' },
    { field: 'age',         label: 'Age band',     kind: 'dimension', group: 'Customer' },
    { field: 'gender',      label: 'Gender',       kind: 'dimension', group: 'Customer' },
    { field: 'time',        label: 'Time bucket',  kind: 'dimension', group: 'Visit' },
    { field: 'discount',    label: 'Discount?',    kind: 'dimension', group: 'Visit' },
    { field: 'spend',       label: 'Total spend',  kind: 'measure',   defaultAgg: 'sum',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'rating',      label: 'Avg rating',   kind: 'measure',   defaultAgg: 'avg',
      format: { type: 'number',   options: { maximumFractionDigits: 2 } } },
    { field: 'spendChange', label: 'Spend Δ%',     kind: 'measure',   defaultAgg: 'avg',
      format: { type: 'number',   options: { maximumFractionDigits: 1 } } },
  ]

  // Saved layouts shown in the designer's toolbar Presets menu.
  const presets: PivotPreset[] = [
    {
      name: 'Spend by city × hour',
      layout: {
        rows: ['city'], cols: ['time'],
        values: [{ field: 'spend', agg: 'sum', label: 'Spend',
          format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } }],
        filters: [],
      },
    },
    {
      name: 'Tier scorecard',
      layout: {
        rows: ['membership', 'city'], cols: [],
        values: [
          { field: 'spend',  agg: 'sum',
            format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
          { field: 'rating', agg: 'avg', format: { type: 'number', options: { maximumFractionDigits: 2 } } },
          { field: 'spend',  agg: 'avg', label: 'Avg ticket',
            format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
        ],
        filters: [],
      },
    },
    {
      name: 'Demographics deep-dive',
      layout: {
        rows: ['age', 'gender'], cols: ['membership'],
        values: [{ field: 'spend', agg: 'avg', label: 'Avg spend',
          format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } }],
        filters: [{ field: 'discount', allowed: ['Yes'] }],
      },
    },
  ]

  // Bindable layout - the designer reads + writes this single shape.
  let layout = $state<PivotLayout>(presets[0]!.layout)

  function onExport(layout: PivotLayout, rows: unknown[]) {
    console.log('Pivot export:', { layout, rowCount: rows.length })
    alert(`Would export ${rows.length} pivot rows. See console for layout payload.`)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Loyalty analytics workspace - built on &lt;SvPivotDesigner&gt;
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      1,800 simulated visits across 6 cities × 3 membership tiers × 8 time buckets. Drag any
      field into the wells, change measures' aggregators (sum / avg / min / max / …), or pick a
      preset to jump to a curated view. Filters narrow the source rows before the pivot.
    </p>
  </div>

  <div class="flex-1 min-h-0">
    <SvPivotDesigner
      data={facts}
      {fields}
      bind:layout
      {presets}
      {onExport}
    />
  </div>
</section>
