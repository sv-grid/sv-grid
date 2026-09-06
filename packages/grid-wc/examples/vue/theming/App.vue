<script setup lang="ts">
// Theming through `--sg-*` custom properties. They are ordinary CSS custom
// properties, so they cascade from any ancestor - which is also why they reach
// into `<sv-grid-shadow>`.
import { ref } from 'vue'
import { SvGrid } from '@svgrid/grid-wc/vue'
import { people, columns } from '../data'

const THEMES: Record<string, Record<string, string>> = {
  Light: {},
  Dark: {
    '--sg-bg': '#0b1220',
    '--sg-fg': '#e2e8f0',
    '--sg-border': '#1e293b',
    '--sg-header-bg': '#111a2e',
    '--sg-row-hover': '#111a2e',
  },
  Warm: {
    '--sg-bg': '#fffaf5',
    '--sg-fg': '#42302a',
    '--sg-border': '#f0dcc9',
    '--sg-header-bg': '#fdf1e4',
    '--sg-accent': '#c2410c',
  },
}

const theme = ref('Light')
</script>

<template>
  <div
    style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px"
    :style="THEMES[theme]"
  >
    <div style="display: flex; gap: 8px">
      <button
        v-for="name in Object.keys(THEMES)"
        :key="name"
        style="padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer"
        :style="{ background: theme === name ? '#e2e8f0' : '#fff' }"
        @click="theme = name"
      >
        {{ name }}
      </button>
    </div>
    <div style="flex: 1; min-height: 0">
      <SvGrid :data="people" :columns="columns" sortable filterable zebra-rows />
    </div>
  </div>
</template>
