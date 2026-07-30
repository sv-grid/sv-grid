<script lang="ts">
  /**
   * DockPopoutHost - the tiny root mounted into a popped-out browser window. It
   * just renders the manager's `pane` snippet for the popped pane, so a pop-out
   * shows the exact same content as the docked view.
   */
  import type { Snippet } from 'svelte'
  import type { DockPane } from './dock-model'

  let { pane, paneData }: { pane: Snippet<[DockPane]>; paneData: DockPane } = $props()
</script>

<div class="sv-popout-host">{@render pane(paneData)}</div>

<style>
  .sv-popout-host { width: 100%; height: 100vh; overflow: auto; box-sizing: border-box; }
</style>
