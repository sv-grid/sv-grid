<script setup lang="ts">
// Row checkboxes, with the selected rows handed back so you can act on them.
import { computed, ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns, type Person } from '../data'

const selected = ref<Person[]>([])
const total = computed(() => selected.value.reduce((sum, r) => sum + r.amount, 0))
const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
</script>

<template>
  <div style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px">
    <div style="font: 13px system-ui; color: #64748b">
      {{
        selected.length === 0
          ? 'Tick some rows to total them'
          : `${selected.length} selected · ${money(total)}`
      }}
    </div>
    <div style="flex: 1; min-height: 0">
      <SvGrid
        :data="people"
        :columns="columns"
        sortable
        filterable
        show-row-selection
        @rowselectionchange="selected = $event.rows as Person[]"
      />
    </div>
  </div>
</template>
