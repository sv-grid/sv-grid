<script lang="ts">
  /**
   * The framework floor: 28 rows x N columns of plain `<td>{text}</td>`, with
   * no grid, no virtualizer, no reactivity beyond the each blocks.
   *
   * Exists to answer one architectural question - when `<SvGrid>` spends ~11ms
   * mounting 252 cells even with every attribute, class, handler and a11y
   * binding stripped, is that OUR overhead or Svelte's cost to create that many
   * elements? Anything at or near this number is the framework floor and cannot
   * be optimised without changing how cells are created.
   */
  type Props = { rows: Array<Record<string, unknown>>; fields: string[] }
  const { rows, fields }: Props = $props()
</script>

<table>
  <tbody>
    {#each rows as row, r (r)}
      <tr>
        {#each fields as f (f)}
          <td>{row[f]}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
