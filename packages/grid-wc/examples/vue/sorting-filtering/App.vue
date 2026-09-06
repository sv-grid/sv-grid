<script setup lang="ts">
// A filter row under the headers, multi-column sort, and the current sort read
// back into a ref so it can drive your own UI.
import { ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns } from '../data'

const sorting = ref<Array<{ id: string; desc: boolean }>>([])
</script>

<template>
  <div style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px">
    <p style="margin: 0; font: 13px system-ui; color: #64748b">
      Sorted by:
      {{
        sorting.length === 0
          ? 'nothing yet - click a header, then shift-click a second one'
          : sorting.map((s) => `${s.id} ${s.desc ? 'desc' : 'asc'}`).join(', ')
      }}
    </p>
    <div style="flex: 1; min-height: 0">
      <SvGrid
        :data="people"
        :columns="columns"
        sortable
        filterable
        show-filter-row
        @sortingchange="sorting = $event"
      />
    </div>
  </div>
</template>
