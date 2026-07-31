<script lang="ts">
  /**
   * SvCalendar as a date-of-birth picker: single selection, `max` clamped to
   * today so future dates can't be chosen, and `displayMode="decade"` so it
   * opens on the year grid (fewer clicks to reach a birth year). Same component
   * SvGrid mounts to edit a date cell.
   */
  import { SvCalendar } from '@svgrid/grid'

  let value = $state<Date[]>([])
  const today = new Date()

  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })
  const age = $derived.by(() => {
    const d = value[0]
    if (!d) return null
    let a = today.getFullYear() - d.getFullYear()
    const beforeBirthday =
      today.getMonth() < d.getMonth() ||
      (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())
    if (beforeBirthday) a -= 1
    return a
  })
</script>

<div class="wrap">
  <SvCalendar
    {value}
    selectionMode="one"
    max={today}
    displayMode="decade"
    footer
    onChange={(dates) => (value = dates)}
  />

  <p class="out">
    {#if value[0]}
      Born <strong>{fmt.format(value[0])}</strong> - {age} years old
    {:else}
      Pick a date of birth (future dates are blocked)
    {/if}
  </p>
</div>

<style>
  .wrap { padding: 20px; display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
  .out { margin: 0; font-size: 13.5px; color: var(--sg-muted, #64748b); }
  .out strong { color: var(--sg-fg, #0f172a); }
</style>
