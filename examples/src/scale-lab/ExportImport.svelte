<script lang="ts">
  /**
   * Area E: export and import. The CSV and JSON serializers are the real public
   * functions from @svgrid/grid. Each builds the whole output as one string, so
   * past a row count they throw "Invalid string length" (V8 caps a string at
   * ~536.9M chars). XLSX and import are listed from reading the code, with the
   * reference, and are not run here.
   */
  import { serializeDelimited, serializeJson } from '@svgrid/grid'
  import { fmtMs, fmtInt, tick } from './measure'

  const COLS = 20
  const fields = Array.from({ length: COLS }, (_, c) => `f${c}`)
  function makeRows(n: number) {
    const out = new Array(n)
    for (let i = 0; i < n; i += 1) {
      const r: Record<string, unknown> = {}
      for (let c = 0; c < COLS; c += 1) r[`f${c}`] = c % 2 ? `value ${i}-${c}` : i * 13 + c
      out[i] = r
    }
    return out
  }

  let fmt = $state<'csv' | 'json'>('csv')
  let count = $state(1_000_000)
  let busy = $state('')
  type Row = { fmt: string; rows: number; ms: string; chars: string; outcome: string; ok: boolean }
  let results = $state<Row[]>([])

  async function run() {
    busy = `Generating ${fmtInt(count)} rows x ${COLS} cols...`
    await tick()
    const rows = makeRows(count)
    busy = `Serializing to ${fmt.toUpperCase()}...`
    await tick()
    const t0 = performance.now()
    try {
      const s = fmt === 'csv' ? await serializeDelimited(rows, fields, {}) : await serializeJson(rows, fields, {})
      results = [{ fmt: fmt.toUpperCase(), rows: count, ms: fmtMs(performance.now() - t0), chars: `${(s.length / 1e6).toFixed(0)}M`, outcome: 'built', ok: true }, ...results]
    } catch (e) {
      results = [{ fmt: fmt.toUpperCase(), rows: count, ms: fmtMs(performance.now() - t0), chars: '-', outcome: `${(e as Error).name}: ${(e as Error).message}`, ok: false }, ...results]
    }
    busy = ''
  }
</script>

<section class="panel">
  <p class="why">
    <b>Claim:</b> export builds the whole file as one string in memory, so a big table runs past the
    browser's string limit. These run the real serializers from <code>@svgrid/grid</code>.
  </p>

  <div class="controls">
    <label>format
      <select bind:value={fmt}>
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
      </select>
    </label>
    <label>rows
      <select bind:value={count}>
        <option value={500000}>500,000</option>
        <option value={1000000}>1,000,000</option>
        <option value={1200000}>1,200,000</option>
        <option value={2400000}>2,400,000</option>
      </select>
    </label>
    <button class="btn" onclick={run} disabled={!!busy}>Export {COLS} columns</button>
    {#if busy}<span class="status">{busy}</span>{/if}
  </div>

  {#if results.length}
    <table class="results live">
      <thead><tr><th>Format</th><th>Rows</th><th>Time</th><th>Chars</th><th class="note">Outcome</th></tr></thead>
      <tbody>
        {#each results as r}
          <tr><td>{r.fmt}</td><td>{fmtInt(r.rows)}</td><td>{r.ms}</td><td>{r.chars}</td><td class="note {r.ok ? 'ok' : 'bad'}">{r.outcome}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="status">V8 caps one string at ~536,870,888 chars. JSON is ~2x the CSV size, so it crosses the cap first.</p>
  {/if}

  <table class="results">
    <thead><tr><th>Not run here (from the code)</th><th>Result</th><th class="note">Source</th></tr></thead>
    <tbody>
      <tr><td>XLSX, one string per sheet</td><td class="bad">string cap near ~450k rows x 20 (estimated)</td><td class="note">export-ooxml.ts:294</td></tr>
      <tr><td>XLSX files are not compressed</td><td class="bad">JSZip defaults to STORE</td><td class="note">export-ooxml.ts:505</td></tr>
      <tr><td>Server mode "export all"</td><td class="bad">exports loaded blocks only</td><td class="note">build-api.ts:116</td></tr>
      <tr><td>CSV/XLSX import</td><td class="bad">whole file parsed in memory, no yield</td><td class="note">import.ts:271</td></tr>
    </tbody>
  </table>
</section>
