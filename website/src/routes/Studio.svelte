<script lang="ts">
  /**
   * SvGrid Studio - the grid's visual data-app builder, given a full-screen
   * route of its own (NOT a boxed demo card). It's a tool, so it gets the whole
   * viewport: a slim title bar + the SvStudioDesigner canvas. Reached via a
   * "Launch SvGrid Studio" button from the Studio demos + the Pricing page - it
   * is deliberately NOT a primary-nav peer, so the Grid stays the single hero.
   */
  import { SvStudioDesigner } from '@svgrid/enterprise/designer'
  import {
    createProject,
    setEntityDataSource,
    setShell,
    setLicenseKey,
    dismissUnlicensedNudge,
    getSampleApp,
    type EntitySchema,
    type StudioProject,
  } from '@svgrid/enterprise'
  import { router } from '../lib/router.svelte'

  // `/studio/<id>` preloads a sample app (from the demos' "SvGrid Studio" gallery).
  type Props = { template?: string }
  let { template }: Props = $props()

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  dismissUnlicensedNudge()

  const customer: EntitySchema = {
    name: 'customers', label: 'Customer', idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, hidden: { form: true } },
      { field: 'name', type: 'text', required: true },
      { field: 'email', type: 'text', label: 'Email', format: 'email' },
      { field: 'tier', type: 'enum', options: [
        { value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'enterprise', label: 'Enterprise' },
      ] },
      { field: 'mrr', type: 'number', label: 'MRR ($)' },
      { field: 'active', type: 'boolean' },
    ],
  }
  const order: EntitySchema = {
    name: 'orders', label: 'Order', idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, hidden: { form: true } },
      { field: 'ref', type: 'text', label: 'Reference' },
      { field: 'customerId', type: 'relation', label: 'Customer', relation: { entity: 'customers', labelField: 'name' } },
      { field: 'amount', type: 'number', label: 'Amount ($)' },
      { field: 'status', type: 'enum', options: [
        { value: 'draft', label: 'Draft' }, { value: 'paid', label: 'Paid' }, { value: 'refunded', label: 'Refunded' },
      ] },
    ],
  }

  function seed(t?: string): StudioProject {
    // A named sample app (crm, ecommerce, ...) if one was requested.
    if (t) {
      const app = getSampleApp(t)
      if (app) return app.build()
    }
    // Default: a small REST-bound Sales App.
    let p = createProject([customer, order], { title: 'Sales App' })
    p = setEntityDataSource(p, 'customers', {
      kind: 'rest',
      baseUrl: 'https://jsonplaceholder.typicode.com',
      path: 'users',
      method: 'GET',
      params: [{ name: '_limit', location: 'query', type: 'number', value: '10' }],
    })
    p = setShell(p, { style: 'top-nav', brand: 'Sales App' })
    return p
  }

  let loaded = template ?? ''
  let project = $state<StudioProject>(seed(template))
  // Re-seed when navigating to a different sample (studio/crm -> studio/ecommerce).
  $effect(() => {
    const t = template ?? ''
    if (t !== loaded) { loaded = t; project = seed(t) }
  })

  // Follow the site's global light/dark toggle (html[data-theme]) so switching
  // it re-themes the whole Studio screen - chrome + the app preview together.
  const readAppearance = (): 'light' | 'dark' =>
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  let appearance = $state<'light' | 'dark'>(readAppearance())
  $effect(() => {
    const el = document.documentElement
    const sync = () => (appearance = readAppearance())
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  })
</script>

<div class="studio-page">
  <div class="studio-canvas">
    <SvStudioDesigner {project} {appearance} onChange={(p) => (project = p)} />
  </div>
</div>

<style>
  .studio-page {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--sg-bg, #fff);
  }
  .studio-canvas {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  /* The designer fills the canvas region. */
  .studio-canvas > :global(*) { height: 100%; }
</style>
