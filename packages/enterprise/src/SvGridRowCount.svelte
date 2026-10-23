<!--
  The status bar's row count ("250 rows", "12 of 250 rows" while filters hide
  some), drawn by the grid's `statusBarRows` seam once enableRowCount() has
  run. It sits outside the bar's live region: the grid already announces
  filter results, so a count in there would be read out twice.
-->
<script lang="ts">
  let { ctrl }: { ctrl: any } = $props()

  // When the server filters or pages, the grid holds one page and knows only
  // `rowCount`, so that is both numbers.
  const external = $derived(ctrl.props.externalFilter === true || ctrl.props.externalPagination === true)
  const filtered = $derived(ctrl.paginationTotalRows as number)
  const total = $derived(external ? filtered : ((ctrl.props.data?.length as number | undefined) ?? filtered))
  const messages = $derived(ctrl.messages)
  const fmt = (n: number) => n.toLocaleString()
  const text = $derived(
    (filtered !== total ? `${fmt(filtered)} ${messages.of} ` : "") +
      `${fmt(total)} ${total === 1 ? messages.rowSuffix : messages.rowsSuffix}`,
  )
</script>

<span class="sv-grid-status-item sv-grid-status-rows">{text}</span>
