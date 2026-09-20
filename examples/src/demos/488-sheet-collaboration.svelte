<script lang="ts">
  /**
   * 488. Two people on one sheet: the delta stream
   * ----------------------------------------------
   * Two full spreadsheets over two SEPARATE documents, wired to each other
   * by `createDeltaStream`. Type in either one and the other follows.
   *
   * What crosses the wire is a delta, not the document:
   *
   *   cells      the RAW TEXT of the cells that were written. A formula
   *              travels as `=SUM(B2:B4)` and the other side works out its
   *              own answer, so the two never disagree about a number.
   *   structure  the insert or delete itself, so both sides rewrite their
   *              own formulas the same way.
   *   state      the one part of the one sheet that changed: the formats,
   *              the merges, a rule, the objects.
   *   document   the whole thing, for adding or removing a sheet, and for
   *              a first read (`resync`).
   *
   * The log below is every delta as it goes, so you can watch a keystroke
   * become one small message. A real app puts a socket in the middle: the
   * same `onDelta` out, the same `apply` in.
   *
   * Conflicts are LAST WRITER WINS, per cell, and the pair converges on
   * whatever arrived last. Two people in different cells never conflict,
   * which is the case that happens.
   *
   * Presence rides the same wire and is NOT part of the document: each
   * window sends where its cursor is, and the other draws it as a coloured
   * box with a name on it. Nothing about it is ever saved, because a cursor
   * belongs to a session rather than to a file.
   *
   * Try: type a number in B2 on the left. Bold a row on the right. Insert
   * a row above 3 on either. Select a block in one window and watch the box
   * appear in the other. Watch the log, and the other sheet.
   */
  import {
    SvSheet, createSheetDocument, createDeltaStream,
    type SheetDelta, type SheetPresence,
  } from '@svgrid/enterprise'

  const cells: string[][] = [
    ['Region', 'Q1', 'Q2', 'Year'],
    ['North', '48000', '52500', '=SUM(B2:C2)'],
    ['South', '39000', '41500', '=SUM(B3:C3)'],
    ['EMEA', '71000', '69500', '=SUM(B4:C4)'],
    ['Total', '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)'],
  ]

  const left = createSheetDocument({ sheets: [{ name: 'Sales', cells: cells.map((r) => [...r]) }] })
  const right = createSheetDocument({ sheets: [{ name: 'Sales', cells: cells.map((r) => [...r]) }] })

  type Entry = { from: 'A' | 'B'; text: string; at: string }
  let log = $state<Entry[]>([])

  /** One line per delta: who sent it, and what it carried. */
  function describe(delta: SheetDelta): string {
    if (delta.kind === 'cells') {
      const cells = delta.cells.map((c) => `${String.fromCharCode(65 + c.col)}${c.row + 1}=${c.text || '(blank)'}`)
      return `cells ${cells.join(' ')}`
    }
    if (delta.kind === 'structure') return `structure ${delta.edit.kind} at ${delta.edit.at + 1} x${delta.edit.count}`
    if (delta.kind === 'state') return `state ${Object.keys(delta.entry).join(', ')}`
    if (delta.kind === 'presence') {
      const [r1, c1, r2, c2] = delta.who.rect
      const box = `${String.fromCharCode(65 + c1)}${r1 + 1}:${String.fromCharCode(65 + c2)}${r2 + 1}`
      return `presence ${delta.who.name} at ${box}`
    }
    return 'document (full state)'
  }

  function note(from: 'A' | 'B', delta: SheetDelta) {
    const at = new Date().toLocaleTimeString([], { hour12: false })
    const entry: Entry = { from, text: describe(delta), at }
    // A cursor moves on every arrow key, so the newest presence line from
    // one side replaces the last rather than filling the log with a line
    // per keystroke. A real transport throttles for the same reason.
    const top = log[0]
    if (delta.kind === 'presence' && top && top.from === from && top.text.startsWith('presence ')) {
      log = [entry, ...log.slice(1)]
      return
    }
    log = [entry, ...log].slice(0, 40)
  }

  // The wire. In an application these two callbacks are a socket send and a
  // socket message; here they hand the delta straight to the other stream.
  // Who each window sees. Presence is a prop rather than document state, so
  // it lives here in the page, not in either document.
  let inLeft = $state<SheetPresence[]>([])
  let inRight = $state<SheetPresence[]>([])

  const a = createDeltaStream(left, {
    onDelta: (delta) => { note('A', delta); b.apply(delta) },
    onPresence: (who) => { inLeft = [who] },
  })
  const b = createDeltaStream(right, {
    onDelta: (delta) => { note('B', delta); a.apply(delta) },
    onPresence: (who) => { inRight = [who] },
  })

  $effect(() => () => { a.stop(); b.stop() })
</script>

<div class="wrap">
  <div class="pair">
    <section>
      <header><span class="who a">A</span> Ada's window</header>
      <SvSheet
        document={left}
        height="100%"
        rows={14}
        columns={7}
        presence={inLeft}
        onPresence={(me) => a.sendPresence({ id: 'ada', name: 'Ada', colour: '#2563eb', ...me })}
      />
    </section>
    <section>
      <header><span class="who b">B</span> Grace's window</header>
      <SvSheet
        document={right}
        height="100%"
        rows={14}
        columns={7}
        presence={inRight}
        onPresence={(me) => b.sendPresence({ id: 'grace', name: 'Grace', colour: '#15803d', ...me })}
      />
    </section>
  </div>
  <aside>
    <header>On the wire</header>
    {#if log.length === 0}
      <p class="empty">Type in either sheet.</p>
    {:else}
      <ul>
        {#each log as entry, i (i)}
          <li><span class="who" class:a={entry.from === 'A'} class:b={entry.from === 'B'}>{entry.from}</span><code>{entry.text}</code><time>{entry.at}</time></li>
        {/each}
      </ul>
    {/if}
  </aside>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 0;
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    flex: 1;
    min-height: 0;
  }
  section {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 2px;
    font-size: 12px;
    font-weight: 600;
    color: var(--sg-muted, #64748b);
  }
  .who {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 9px;
    font-size: 11px;
    color: #fff;
    background: var(--sg-muted, #64748b);
  }
  .who.a { background: #2563eb; }
  .who.b { background: #15803d; }
  aside {
    flex: 0 0 150px;
    overflow: auto;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: var(--sg-radius, 6px);
    padding: 6px 10px;
    background: var(--sg-bg-subtle, #f8fafc);
  }
  aside ul { margin: 0; padding: 0; list-style: none; }
  aside li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
    font-size: 12px;
  }
  aside code { flex: 1; font-size: 11.5px; }
  aside time { color: var(--sg-muted, #94a3b8); font-size: 11px; }
  .empty { margin: 4px 0; color: var(--sg-muted, #94a3b8); font-size: 12px; }
  @media (max-width: 860px) {
    .pair { grid-template-columns: 1fr; }
  }
</style>
