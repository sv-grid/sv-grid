<script setup lang="ts">
// The smallest useful grid: rows, columns, and the two features almost every
// table wants. The wrapper forwards arrays as DOM properties, so no `.prop`
// modifier and no `isCustomElement` build config.
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns } from '../data'
</script>

<template>
  <div style="height: 100%; padding: 16px">
    <SvGrid :data="people" :columns="columns" sortable filterable />
  </div>
</template>
