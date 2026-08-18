<script lang="ts">
  /**
   * SvResult - a centered result / status page for the outcome of an operation or
   * a route state: success, error, warning, info, or not-found. An icon (built-in
   * per status, or your own), a title, an optional description, and an actions
   * slot. For empty data tables prefer SvEmptyState; use this for full-page
   * outcomes ("Payment complete", "Something went wrong", "404").
   *
   * ```svelte
   * <SvResult status="success" title="Payment complete" description="A receipt is on its way.">
   *   {#snippet actions()}<SvButton>Back to dashboard</SvButton>{/snippet}
   * </SvResult>
   * ```
   */
  import type { Snippet } from 'svelte'

  type Status = 'success' | 'error' | 'warning' | 'info' | 'notfound'

  type Props = {
    status?: Status
    title: string
    description?: string
    /** Replace the built-in status icon. */
    icon?: Snippet
    /** Action buttons row under the text. */
    actions?: Snippet
    children?: Snippet
  }

  let { status = 'info', title, description, icon, actions, children }: Props = $props()
</script>

<div class="sv-result sv-result--{status}" role="status">
  <div class="sv-result__icon" aria-hidden="true">
    {#if icon}{@render icon()}
    {:else if status === 'success'}
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    {:else if status === 'error'}
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
    {:else if status === 'warning'}
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
    {:else if status === 'notfound'}
      <span class="sv-result__code">404</span>
    {:else}
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
    {/if}
  </div>
  <h2 class="sv-result__title">{title}</h2>
  {#if description}<p class="sv-result__desc">{description}</p>{/if}
  {#if children}<div class="sv-result__body">{@render children()}</div>{/if}
  {#if actions}<div class="sv-result__actions">{@render actions()}</div>{/if}
</div>

<style>
  .sv-result {
    --_c: var(--sg-accent, #2563eb);
    display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;
    padding: 40px 24px; max-width: 460px; margin: 0 auto;
  }
  .sv-result--success { --_c: var(--sg-success, #16a34a); }
  .sv-result--error { --_c: var(--sg-danger, #dc2626); }
  .sv-result--warning { --_c: var(--sg-warning, #d97706); }
  .sv-result--notfound { --_c: var(--sg-muted, #64748b); }
  .sv-result__icon {
    display: grid; place-items: center; width: 60px; height: 60px; border-radius: 50%; margin-bottom: 4px;
    color: var(--_c); background: color-mix(in srgb, var(--_c) 12%, transparent);
  }
  .sv-result__code { font-size: 22px; font-weight: 800; letter-spacing: 0.02em; }
  .sv-result__title { margin: 0; font-size: 19px; font-weight: 700; color: var(--sg-fg, #0f172a); }
  .sv-result__desc { margin: 0; font-size: 14px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .sv-result__body { margin-top: 6px; }
  .sv-result__actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; justify-content: center; }
</style>
