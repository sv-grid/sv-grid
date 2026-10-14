<script lang="ts">
  /**
   * The view bar's "Sort" (and, with `group`, its "Group"): a list of fields
   * each with a direction labeled for its type ("1 → 9", "A → Z"),
   * added from a field picker, removed with the bin.
   */
  import { panelFocus } from './panel-focus'
  import { fieldColumns, type FieldColumn } from '../grid-access'
  import { sortLabels } from '../view-model'
  import { groupRules, userSorts, writeSortState, type SortRule } from './sort-state'
  import FieldIcon from './FieldIcon.svelte'

  let { ctrl, api, group = false }: { ctrl: any; api: any; group?: boolean } = $props()

  // Groups go three deep, as in a spreadsheet outline.
  const MAX_GROUPS = 3
  const NOT_SORTABLE = new Set(['attachment', 'button'])
  const columns = $derived(fieldColumns(ctrl).filter((c) => c.def.sortable !== false && !NOT_SORTABLE.has(c.fieldType ?? '')))
  const rules = $derived(group ? groupRules(ctrl) : userSorts(ctrl))
  const free = $derived(columns.filter((c) => !rules.some((r) => r.id === c.id)))
  const col = (id: string): FieldColumn | undefined => columns.find((c) => c.id === id)

  function write(next: SortRule[]) {
    if (group) writeSortState(api, next, userSorts(ctrl))
    else writeSortState(api, groupRules(ctrl), next)
  }
  const replace = (i: number, r: SortRule) => write(rules.map((x, j) => (j === i ? r : x)))
  const remove = (i: number) => write(rules.filter((_, j) => j !== i))
  // "+ Add another sort" opens the list of the fields not sorted by yet.
  let adding = $state(false)
  function add(id: string) {
    adding = false
    write([...rules, { id, desc: false }])
  }
  const canAdd = $derived(free.length > 0 && (!group || rules.length < MAX_GROUPS))
</script>

<div class="sv-fvb-panel sv-fsort" use:panelFocus>
  {#if rules.length}
    <p class="sv-fvb-title">{group ? 'Group by' : 'Sort by'}</p>
    {#each rules as r, i (r.id)}
      {@const c = col(r.id)}
      {@const [up, down] = sortLabels(c?.def)}
      <div class="sv-fsort-row">
        <select class="sv-fvb-select" aria-label="Field" value={r.id} onchange={(e) => replace(i, { id: (e.currentTarget as HTMLSelectElement).value, desc: r.desc })}>
          {#each columns.filter((x) => x.id === r.id || !rules.some((y) => y.id === x.id)) as x (x.id)}<option value={x.id}>{x.header}</option>{/each}
        </select>
        <select class="sv-fvb-select" aria-label="Direction" value={r.desc ? 'desc' : 'asc'} onchange={(e) => replace(i, { id: r.id, desc: (e.currentTarget as HTMLSelectElement).value === 'desc' })}>
          <option value="asc">{up}</option>
          <option value="desc">{down}</option>
        </select>
        <button type="button" class="sv-fvb-icon-btn" aria-label={group ? 'Remove group' : 'Remove sort'} onclick={() => remove(i)}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      </div>
    {/each}
  {/if}
  {#if !rules.length || adding}
    {#if !rules.length}<p class="sv-fvb-title">{group ? 'Group by' : 'Sort by'}</p>{/if}
    <ul class="sv-fsort-fields" role="list" aria-label="Fields">
      {#each free as x (x.id)}
        <li>
          <button type="button" class="sv-fsort-field" onclick={() => add(x.id)}>
            <FieldIcon column={x} />
            <span>{x.header}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else if canAdd}
    <button type="button" class="sv-fvb-text-btn sv-fsort-add" onclick={() => (adding = true)}>{group ? '+ Add subgroup' : '+ Add another sort'}</button>
  {/if}
</div>

<style>
  .sv-fsort { width: 340px; }
  .sv-fsort-row { display: grid; grid-template-columns: minmax(0, 1fr) 110px 28px; gap: 6px; margin: 6px 0; }
  .sv-fsort-add { margin-top: 8px; }
  .sv-fsort-fields { list-style: none; margin: 0; padding: 0; max-height: 300px; overflow: auto; }
  .sv-fsort-field {
    display: flex; align-items: center; gap: 8px; width: 100%; padding: 5px 6px; border: 0; border-radius: 6px;
    background: none; color: inherit; font: inherit; text-align: start; cursor: pointer;
  }
  .sv-fsort-field:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
</style>
