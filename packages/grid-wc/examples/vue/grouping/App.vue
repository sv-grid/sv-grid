<script setup lang="ts">
// Grouping by one or two columns, with an aggregate in the group row.
// `groupBy` is an array, which is exactly the kind of prop the wrapper exists
// to forward as a property.
import { computed, ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns } from '../data'

const groupBy = ref<string[]>(['team'])
const choices: string[][] = [['team'], ['country'], ['team', 'country'], []]
const withTotals = computed(() =>
  columns.map((c) => (c.id === 'amount' ? { ...c, aggregate: 'sum' } : c)),
)
</script>

<template>
  <div style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px">
    <div style="display: flex; gap: 8px; font: 13px system-ui">
      <button
        v-for="choice in choices"
        :key="choice.join('+') || 'none'"
        style="padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer"
        :style="{ background: groupBy.join() === choice.join() ? '#e2e8f0' : '#fff' }"
        @click="groupBy = choice"
      >
        {{ choice.join(' + ') || 'No grouping' }}
      </button>
    </div>
    <div style="flex: 1; min-height: 0">
      <SvGrid
        :data="people"
        :columns="withTotals"
        sortable
        filterable
        groupable
        :group-by="groupBy"
        group-footers
      />
    </div>
  </div>
</template>
