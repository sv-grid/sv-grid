<script setup lang="ts">
// Client-side paging. `pageSize` is the INITIAL page size, read once at mount -
// change pages through the footer or the grid api, not by reassigning it.
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns } from '../data'
</script>

<template>
  <div style="height: 100%; padding: 16px">
    <SvGrid
      :data="people"
      :columns="columns"
      sortable
      filterable
      pageable
      :page-size="25"
      :page-size-options="[10, 25, 50, 100]"
      pagination-position="bottom"
    />
  </div>
</template>
