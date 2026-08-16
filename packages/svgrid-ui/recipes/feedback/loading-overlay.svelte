<script lang="ts">
  // SvLoadingOverlay - a cover-a-container loading scrim. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-loading-overlay
  import { SvLoadingOverlay, SvButton } from '@svgrid/grid'
  let loading = $state(false)
  function run() {
    loading = true
    setTimeout(() => (loading = false), 1200)
  }
</script>

<div style="position: relative; padding: 24px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;">
  <SvLoadingOverlay visible={loading} label="Saving…" />
  <SvButton onclick={run} disabled={loading}>Run task</SvButton>
</div>
