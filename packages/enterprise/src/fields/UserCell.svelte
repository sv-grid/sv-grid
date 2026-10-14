<script lang="ts">
  /**
   * User, created-by and last-modified-by cells: an avatar (the picture, or
   * initials on a color from the name) and the name. Several users show as
   * overlapping avatars with the first name.
   */
  import type { FieldCellProps } from './registry.svelte'
  import { findFieldUser, type FieldUser } from './sources.svelte'
  import UserFace from './UserFace.svelte'

  let { value }: FieldCellProps = $props()

  const list = $derived(
    (Array.isArray(value) ? value : value == null || value === '' ? [] : [value])
      .map((v) => (v && typeof v === 'object' ? (v as FieldUser) : findFieldUser(v) ?? { id: String(v), name: String(v) }))
      .filter((u) => !!u),
  )
  const label = $derived(list.map((u) => u.name).join(', '))
</script>

<span class="sv-fus" title={label} aria-label={label || 'Nobody'}>
  <span class="sv-fus-faces">
    {#each list.slice(0, 4) as u (u.id)}
      <UserFace user={u} />
    {/each}
  </span>
  {#if list.length === 1}
    <span class="sv-fus-name">{list[0]!.name}</span>
  {:else if list.length > 1}
    <span class="sv-fus-name">{list[0]!.name} +{list.length - 1}</span>
  {/if}
</span>

<style>
  .sv-fus { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
  .sv-fus-faces { display: inline-flex; flex: none; }
  .sv-fus-faces > :global(* + *) { margin-inline-start: -6px; }
  .sv-fus-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
