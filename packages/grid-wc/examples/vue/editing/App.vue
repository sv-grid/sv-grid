<script setup lang="ts">
// Inline editing, written back into a ref.
//
// `cellvaluechange` fires once per committed edit; swap the local mutation for
// your own save call.
import { computed, ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns, type Person } from '../data'

const rows = ref<Person[]>([...people])
const log = ref<string[]>([])

const editable = computed(() =>
  columns.map((c) => (c.id === 'name' || c.id === 'amount' ? { ...c, editable: true } : c)),
)

function onEdit(e: { rowIndex: number; columnId: string; newValue: unknown }) {
  const row = rows.value[e.rowIndex]
  if (row) rows.value[e.rowIndex] = { ...row, [e.columnId]: e.newValue } as Person
  log.value.push(`${e.columnId} = ${String(e.newValue)}`)
}
</script>

<template>
  <div style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px">
    <p style="margin: 0; font: 13px system-ui; color: #64748b">
      Double-click a Name or Amount cell. Last edits:
      {{ log.slice(-3).join(' · ') || 'none yet' }}
    </p>
    <div style="flex: 1; min-height: 0">
      <SvGrid
        :data="rows"
        :columns="editable"
        sortable
        filterable
        editable
        @cellvaluechange="onEdit"
      />
    </div>
  </div>
</template>
