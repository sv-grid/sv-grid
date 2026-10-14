<script lang="ts">
  /**
   * 519. Database to app
   * --------------------
   * Plain SQL tables in, a working app out. Pick a database (or edit its SQL)
   * and press "Make the app": the tables are created in a real Postgres in
   * the page (PGlite), then one call reads them:
   *
   *   const tables = await baseFromDatabase({ execute })
   *
   * and `<SvBase {tables}>` shows them. Nothing about the app is written by
   * hand. From the database alone it gets:
   *  - a tab per table, with fields typed from the columns and their names
   *    (an email column is an email field, `price` is currency, `notes` long
   *    text, `due_on` a date);
   *  - a single select, with colors, for a text column that repeats a few
   *    values (a status, a priority, a category);
   *  - a link for each foreign key, with a field in the other table that
   *    links back, and a link to many records for a table that only pairs
   *    two others (`event_speakers`);
   *  - a Kanban board by the first select and a calendar by the first date.
   * Every edit goes back to the database as SQL.
   *
   * In an app, `execute` runs on your server: `createBaseEndpoint({ execute })`
   * in a SvelteKit route and `baseFromEndpoint('/api/base')` in the page.
   */
  import { PGlite } from '@electric-sql/pglite'
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, baseFromDatabase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import eventsSql from '../shared/base-sql/events.sql?raw'
  import shopSql from '../shared/base-sql/shop.sql?raw'
  import helpdeskSql from '../shared/base-sql/helpdesk.sql?raw'
  import trackerSql from '../shared/base-sql/tracker.sql?raw'
  import crmSql from '../shared/base-sql/crm.sql?raw'

  enableBase()

  // The sample databases `npm create @svgrid` offers for a base app: the same files.
  const SAMPLES: Record<string, { label: string; sql: string }> = {
    events: { label: 'Events', sql: eventsSql },
    shop: { label: 'Shop', sql: shopSql },
    helpdesk: { label: 'Help desk', sql: helpdeskSql },
    tracker: { label: 'Project tracker', sql: trackerSql },
    crm: { label: 'Sales CRM', sql: crmSql },
  }

  let sample = $state('events')
  let sql = $state(SAMPLES.events!.sql)
  let tables = $state.raw<BaseTable[] | null>(null)
  let busy = $state(false)
  let error = $state('')
  let tookMs = $state<number | null>(null)
  let run = 0

  function pick(key: string) {
    sample = key
    sql = SAMPLES[key]!.sql
    tables = null
    tookMs = null
    error = ''
  }

  async function makeApp() {
    busy = true
    error = ''
    tables = null
    const mine = ++run
    try {
      // A fresh database each time, with your SQL in it.
      const db = new PGlite()
      await db.exec(sql)
      const started = performance.now()
      // The one call: read the database, make the base.
      const made = await baseFromDatabase({ execute: async (text, params) => (await db.query(text, params)).rows as Record<string, unknown>[] })
      if (mine !== run) return
      tookMs = Math.round(performance.now() - started)
      tables = made
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      busy = false
    }
  }
</script>

<section class="dbapp">
  <div class="dbapp-setup">
    <div class="dbapp-pick" role="tablist" aria-label="Sample database">
      {#each Object.entries(SAMPLES) as [key, s] (key)}
        <button type="button" role="tab" aria-selected={sample === key} class:is-on={sample === key} onclick={() => pick(key)}>{s.label}</button>
      {/each}
    </div>
    <label class="dbapp-sql">
      <span>Your database (Postgres SQL)</span>
      <textarea bind:value={sql} spellcheck="false" rows="9"></textarea>
    </label>
    <div class="dbapp-go">
      <button type="button" class="dbapp-make" disabled={busy} onclick={makeApp}>{busy ? 'Reading the database…' : 'Make the app'}</button>
      <code class="dbapp-code">const tables = await baseFromDatabase({'{'} execute {'}'})</code>
      {#if tookMs != null}<span class="dbapp-took">Read {tables?.length ?? 0} tables in {tookMs} ms</span>{/if}
    </div>
    {#if error}<p class="dbapp-error">{error}</p>{/if}
  </div>
  <div class="dbapp-app">
    {#if tables}
      {#key tables}
        <SvBase {tables} editable sortable showRowNumbers showRowSelection={false} expandRows rowHeight={34} containerHeight="100%" columnAdder fieldMenu />
      {/key}
    {:else}
      <p class="dbapp-empty">Press "Make the app": the tables above become a base, with no other setup.</p>
    {/if}
  </div>
  <SvToaster />
</section>

<style>
  .dbapp { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(420px, 1fr); gap: 12px; flex: 1; min-height: 0; color: var(--sg-fg, #0f172a); }
  .dbapp-setup {
    display: grid; gap: 8px; padding: 12px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
    background: var(--sg-header-bg, var(--sg-bg, #fff));
  }
  .dbapp-pick { display: flex; gap: 6px; }
  .dbapp-pick button {
    height: 28px; padding: 0 12px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 999px; background: none; color: inherit; font: inherit; font-size: 13px; cursor: pointer;
  }
  .dbapp-pick button.is-on { border-color: var(--sg-accent, #2563eb); color: var(--sg-accent, #2563eb); }
  .dbapp-sql { display: grid; gap: 4px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .dbapp-sql textarea {
    width: 100%; box-sizing: border-box; padding: 8px; resize: vertical; min-height: 120px;
    font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--sg-fg, #0f172a);
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #cbd5e1); border-radius: var(--sg-radius, 6px);
  }
  .dbapp-go { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .dbapp-make {
    height: 34px; padding: 0 16px; border: 0; border-radius: var(--sg-radius, 6px); cursor: pointer; font: inherit; font-weight: 600;
    background: var(--sg-accent, #2563eb); color: var(--sg-accent-fg, #fff);
  }
  .dbapp-make:disabled { opacity: 0.6; cursor: default; }
  .dbapp-code { font-size: 12px; color: var(--sg-muted, #64748b); }
  .dbapp-took { font-size: 12px; font-weight: 600; color: var(--sg-success, #16a34a); }
  .dbapp-error { margin: 0; color: var(--sg-danger, #dc2626); font-size: 13px; }
  .dbapp-app { display: flex; flex-direction: column; min-width: 0; min-height: 420px; }
  .dbapp-empty {
    margin: 0; flex: 1; display: grid; place-items: center; color: var(--sg-muted, #64748b);
    border: 1px dashed var(--sg-border, #cbd5e1); border-radius: var(--sg-radius-lg, 10px);
  }
</style>
