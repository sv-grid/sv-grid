<script setup lang="ts">
// Server-side data: the grid renders the page you hand it and tells you when
// the user wants a different one.
//
// `externalSort` and `externalPagination` stop it doing the work locally;
// `rowCount` is how it knows how many pages exist.
import { ref, watchEffect } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns, type Person } from '../data'

const PAGE_SIZE = 25

const page = ref(0)
const sort = ref<Array<{ id: string; desc: boolean }>>([])
const rows = ref<Person[]>([])
const total = ref(0)
const loading = ref(true)

function fetchPage(): Promise<{ rows: Person[]; total: number }> {
  // Pretend this is a network call.
  const sorted = [...people].sort((a, b) => {
    for (const s of sort.value) {
      const av = a[s.id as keyof Person]
      const bv = b[s.id as keyof Person]
      if (av === bv) continue
      return (av > bv ? 1 : -1) * (s.desc ? -1 : 1)
    }
    return 0
  })
  const start = page.value * PAGE_SIZE
  return new Promise((resolve) =>
    setTimeout(
      () => resolve({ rows: sorted.slice(start, start + PAGE_SIZE), total: sorted.length }),
      250,
    ),
  )
}

watchEffect(async () => {
  loading.value = true
  const res = await fetchPage()
  rows.value = res.rows
  total.value = res.total
  loading.value = false
})
</script>

<template>
  <div style="height: 100%; padding: 16px">
    <SvGrid
      :data="rows"
      :columns="columns"
      :loading="loading"
      sortable
      external-sort
      external-pagination
      pageable
      :page-size="PAGE_SIZE"
      :row-count="total"
      :page-index="page"
      @sortingchange="((sort = $event), (page = 0))"
      @paginationchange="page = $event.pageIndex"
    />
  </div>
</template>
