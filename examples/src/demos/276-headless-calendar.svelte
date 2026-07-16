<script lang="ts">
  /**
   * Headless calendar - SvCalendar is headless-first, exactly like the grid.
   * `createCalendar` is the framework-free-in-spirit state machine behind it:
   * view page + drill level, roving focus, every selectionMode, range preview
   * and full keyboard - all reused from the ./datetime engine and exposed as
   * prop-getters you spread onto YOUR OWN markup. Below, the same core drives the
   * styled <SvCalendar> AND a totally custom compact day-grid, both bound to one
   * value. No forked date math, no re-implemented keyboard.
   */
  import { SvCalendar, createCalendar } from '@svgrid/grid'

  let value = $state<Date | null>(new Date(2026, 5, 15))

  // The headless core - identical behavior, our own DOM. Clicking a day in either
  // render updates the single shared `value`.
  const cal = createCalendar({
    value: () => value,
    onChange: (d) => (value = d[0] ?? null),
  })

  const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
</script>

<div class="wrap">
  <header>
    <h2>Headless calendar</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createCalendar</code>
      drives both renders below; selection, navigation, focus and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvCalendar&gt;</code></h3>
      <SvCalendar {value} footer onChange={(d) => (value = d[0] ?? null)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <!-- A compact custom calendar - nothing shared with SvCalendar but the core. -->
      <div class="mini">
        <div class="mini__head">
          <button class="mini__nav" {...cal.navProps(-1)}>‹</button>
          <span class="mini__title">{cal.title}</span>
          <button class="mini__nav" {...cal.navProps(1)}>›</button>
        </div>
        <div class="mini__grid" {...cal.gridProps()}>
          {#each cal.weekdayHeaders as wh (wh.weekday)}
            <span class="mini__wd">{wh.label}</span>
          {/each}
          {#each cal.panels as panel (panel.month.getTime())}
            {#each panel.matrix as week, wi (wi)}
              {#each week as cell (cell.date.getTime())}
                {@const st = cal.dayState(cell.date, panel.month)}
                <button
                  class="mini__day"
                  class:on={st.selected}
                  class:today={st.today}
                  class:out={st.outside}
                  {...cal.dayProps(cell, panel.month)}
                >{cell.date.getDate()}</button>
              {/each}
            {/each}
          {/each}
        </div>
      </div>
      <p class="hint">Arrow keys move the focus ring, Enter/Space picks, PageUp/Down changes month - all from <code>createCalendar</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Selected</h3>
    {#if value}
      <div class="tags"><span class="tag">{fmt.format(value)}</span></div>
    {:else}
      <p class="empty">Nothing selected</p>
    {/if}
  </aside>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.55; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }

  /* Fully custom calendar render - nothing shared with SvCalendar but the core. */
  .mini {
    width: 252px; padding: 10px; border-radius: 12px;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-input-bg, #fff);
  }
  .mini__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .mini__title { font-weight: 650; font-size: 13px; }
  .mini__nav {
    width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 16px; line-height: 1;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .mini__nav:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .mini__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; outline: none; }
  .mini__wd { text-align: center; font-size: 10px; font-weight: 700; color: var(--sg-muted, #94a3b8); padding-bottom: 4px; text-transform: uppercase; }
  .mini__day {
    aspect-ratio: 1; display: grid; place-items: center; font-size: 12px; cursor: pointer;
    border: 0; background: none; color: var(--sg-fg, #0f172a); border-radius: 7px;
  }
  .mini__day:hover:not(.on) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .mini__day.out { color: var(--sg-muted, #94a3b8); opacity: 0.5; }
  .mini__day.today { box-shadow: inset 0 0 0 1px var(--sg-accent, #4f46e5); }
  .mini__day.on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); font-weight: 650; }
  .mini__day:focus-visible { outline: 2px solid var(--sg-accent, #4f46e5); outline-offset: -2px; }

  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
