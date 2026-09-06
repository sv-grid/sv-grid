<script setup lang="ts">
// Excel export from a Vue host.
//
// `@svgrid/enterprise/export` is plain JavaScript - no Svelte in your build -
// so this works in any bundler. The same is true of `/import`, `/print`,
// `/pivot` and `/license`. The Kanban and scheduler views are the exception:
// they are Svelte components, so they need a Svelte-aware bundler.
//
// The api appears on the component once `apiready` has fired. It is typed
// `unknown` there because the wrapper does not depend on the grid's types, so
// the enterprise call needs a cast.
import { ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { exportGrid } from '@svgrid/enterprise/export'
import { people, columns } from '../data'

// The wrapper hands `api` over through `expose()`, which Vue does not thread
// into `InstanceType`, so the template ref is typed by shape instead.
const grid = ref<{ api: unknown } | null>(null)
const ready = ref(false)
const busy = ref(false)

async function exportXlsx() {
  const api = grid.value?.api
  if (!api) return
  busy.value = true
  try {
    await exportGrid(api as Parameters<typeof exportGrid>[0], {
      format: 'xlsx',
      filename: 'people',
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px">
    <button type="button" :disabled="!ready || busy" @click="exportXlsx">
      {{ busy ? 'Building…' : 'Export to Excel' }}
    </button>
    <div style="flex: 1; min-height: 0">
      <SvGrid
        ref="grid"
        :data="people"
        :columns="columns"
        sortable
        filterable
        @apiready="ready = true"
      />
    </div>
  </div>
</template>
