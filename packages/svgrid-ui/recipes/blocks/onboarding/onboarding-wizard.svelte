<script lang="ts" module>
  /**
   * Setup wizard block - a four-step workspace setup in one SvCard. SvStepper
   * tracks the steps; SvTextInput takes the workspace name and a URL slug that
   * follows the name until edited; SvTagsInput collects teammate emails; plan
   * cards run on the createRadioGroup core; SvButton Back / Next validate each
   * step and Finish fires a toast.promise into SvToaster.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createWorkspaceWizard() below owns the current step, the values,
   * the slug rule, per-step validation and the create flow with no markup. The
   * component under it is one styled render of that core; import
   * createWorkspaceWizard from this file (or `npx @svgrid/ui add
   * onboarding-wizard --headless` for the core alone) to draw your own.
   */
  import { createRadioGroup, type StepItem, type RadioOption } from '@svgrid/grid'

  export type WizardPlan = { value: string; label: string; price: string; note: string }
  export type WizardValues = { name: string; slug: string; invites: string[]; plan: string }
  export type WizardErrors = { name?: string; slug?: string; invites?: string; plan?: string }
  export type WizardOptions = {
    plans?: WizardPlan[]
    /** Slugs already in use. Check against your API in a real app. */
    taken?: string[]
    initial?: { name?: string; invites?: string[] }
    /** Next was pressed on a step that has errors. */
    onBlocked?: (step: number) => void
    /** Creates the workspace; throw (or reject) to stay on Review. */
    onCreate?: (values: WizardValues) => Promise<void> | void
  }

  const WIZARD_STEPS: StepItem[] = [
    { label: 'Workspace' }, { label: 'Team' }, { label: 'Plan' }, { label: 'Review' },
  ]
  const SAMPLE_PLANS: WizardPlan[] = [
    { value: 'free', label: 'Free', price: '$0', note: '3 members, 1 GB' },
    { value: 'team', label: 'Team', price: '$12', note: 'per member / month' },
    { value: 'business', label: 'Business', price: '$24', note: 'SSO, audit log' },
  ]
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)

  export function createWorkspaceWizard(opts: WizardOptions = {}) {
    // Sample plans and taken slugs stand in when the app passes none; check slugs on the server too.
    const plans = opts.plans ?? SAMPLE_PLANS
    const taken = opts.taken ?? ['acme', 'northwind', 'admin']
    const options: RadioOption[] = plans.map((p) => ({ value: p.value, label: p.label }))
    const last = WIZARD_STEPS.length - 1

    let current = $state(0)
    let tried = $state([false, false, false, false])
    let name = $state(opts.initial?.name ?? 'Northwind Labs')
    let slugOverride = $state<string | null>(null)
    let invites = $state<string[]>(opts.initial?.invites ?? ['grace@northwind.io'])
    let plan = $state<string | number | null>(null)
    let busy = $state(false)
    let created = $state(false)

    const slug = $derived(slugOverride ?? slugify(name))
    const badEmails = $derived(invites.filter((e) => !EMAIL.test(e)))
    const errors = $derived<WizardErrors>({
      name: name.trim().length < 2 ? 'Give the workspace a name' : undefined,
      slug: slug.length < 3 ? 'Use at least 3 letters or digits'
        : taken.includes(slug) ? `${slug} is taken` : undefined,
      invites: badEmails.length ? `Not an email: ${badEmails.join(', ')}` : undefined,
      plan: plan == null ? 'Pick a plan to continue' : undefined,
    })
    const stepValid = $derived([!errors.name && !errors.slug, !errors.invites, !errors.plan, true])
    const chosen = $derived(plans.find((p) => p.value === plan))

    const rg = createRadioGroup({
      options: () => options,
      value: () => plan,
      onChange: (v) => (plan = v),
      ariaLabel: () => 'Plan',
      invalid: () => tried[2] && !!errors.plan,
    })

    function goTo(i: number) { current = Math.max(0, Math.min(last, i)) }

    /** Marks the step as tried (shows its errors) and moves on only when it is valid. */
    function next() {
      tried[current] = true
      if (!stepValid[current]) { opts.onBlocked?.(current); return }
      current += 1
    }

    async function finish() {
      if (busy) return
      busy = true
      try {
        await opts.onCreate?.({ name, slug, invites: [...invites], plan: String(plan) })
        created = true
        current = WIZARD_STEPS.length
      } catch {
        // The caller reported the failure; stay on Review.
      } finally {
        busy = false
      }
    }

    function restart() {
      current = 0; tried = [false, false, false, false]; created = false
      name = ''; slugOverride = null; invites = []; plan = null
    }

    return {
      steps: WIZARD_STEPS,
      plans,
      get current() { return current },
      get name() { return name },
      set name(v: string) { name = v },
      get slug() { return slug },
      /** Typing a slug stops it following the name. */
      set slug(v: string) { slugOverride = slugify(v) },
      get slugFollowsName() { return slugOverride == null },
      get invites() { return invites },
      set invites(v: string[]) { invites = v },
      get plan() { return plan },
      set plan(v: string | number | null) { plan = v },
      get chosen() { return chosen },
      get errors() { return errors },
      /** Per step: has Next been pressed on it (show its errors). */
      get tried() { return tried },
      get stepValid() { return stepValid },
      get busy() { return busy },
      get created() { return created },
      get isLast() { return current === last },
      goTo,
      back: () => goTo(current - 1),
      next,
      finish,
      restart,
      /** Spread on <SvStepper> or read for your own stepper. */
      stepperProps: () => ({ steps: WIZARD_STEPS, current, onChange: goTo }),
      /** Spread on the element that wraps the plan cards. */
      planGroupProps: () => rg.groupProps(),
      /** Spread on each plan card (a <button>): role radio, roving tabindex, data-checked. */
      planProps: (i: number) => rg.radioProps(options[i]!),
    }
  }
</script>

<script lang="ts">
  import { SvCard, SvStepper, SvTextInput, SvTagsInput, SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const wiz = createWorkspaceWizard({
    onBlocked: () => toast.warning('Fix the highlighted fields first'),
    // Replace the timer with your request; a rejection keeps the wizard on Review.
    onCreate: (v) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 1200)), {
        loading: `Creating ${v.slug}.northwind.app...`,
        success: () => `${v.name} is ready`,
        error: 'Could not create the workspace',
      }),
  })
</script>

<main class="sv-wizard">
  <SvCard>
    <div class="sv-wizard-head">
      <h2>Set up your workspace</h2>
      <p class="sv-wizard-muted">{wiz.created ? 'All steps complete' : `Step ${wiz.current + 1} of ${wiz.steps.length}: ${wiz.steps[wiz.current]?.label}`}</p>
    </div>
    <div class="sv-wizard-stepper">
      <SvStepper {...wiz.stepperProps()} />
    </div>

    {#if wiz.created}
      <div class="sv-wizard-done">
        <span class="sv-wizard-tick" aria-hidden="true">✓</span>
        <h3>{wiz.name} is live</h3>
        <p class="sv-wizard-muted">{wiz.invites.length ? `Invites sent to ${wiz.invites.length} ${wiz.invites.length === 1 ? 'person' : 'people'}.` : 'Invite your team any time from Settings.'}</p>
        <SvButton variant="outline" onclick={wiz.restart}>Set up another workspace</SvButton>
      </div>
    {:else}
      <div class="sv-wizard-body">
        {#if wiz.current === 0}
          <SvTextInput label="Workspace name" bind:value={wiz.name} block required
            invalid={wiz.tried[0] && !!wiz.errors.name} error={wiz.tried[0] ? wiz.errors.name : undefined} />
          <SvTextInput label="Workspace URL" value={wiz.slug} suffix=".northwind.app" block required
            onChange={(v) => (wiz.slug = v)}
            invalid={wiz.tried[0] && !!wiz.errors.slug}
            error={wiz.tried[0] ? wiz.errors.slug : undefined}
            hint={wiz.slugFollowsName ? 'Follows the name until you edit it.' : 'Lowercase letters, digits and dashes.'} />
        {:else if wiz.current === 1}
          <SvTagsInput label="Invite teammates" bind:value={wiz.invites} placeholder="name@company.com" block max={10}
            messages={{ add: 'Invite teammates', remove: 'Remove' }}
            invalid={wiz.tried[1] && !!wiz.errors.invites} error={wiz.tried[1] ? wiz.errors.invites : undefined}
            hint="Press Enter or comma after each address. You can skip this." />
        {:else if wiz.current === 2}
          <div class="sv-wizard-plans" {...wiz.planGroupProps()}>
            {#each wiz.plans as p, i (p.value)}
              <button class="sv-wizard-plan" {...wiz.planProps(i)}>
                <span class="sv-wizard-plan-top"><strong>{p.label}</strong>{#if p.value === 'team'}<SvBadge variant="accent" size="sm">Popular</SvBadge>{/if}</span>
                <span class="sv-wizard-price">{p.price}</span>
                <span class="sv-wizard-muted sv-wizard-small">{p.note}</span>
              </button>
            {/each}
          </div>
          {#if wiz.tried[2] && wiz.errors.plan}<p class="sv-wizard-err" role="alert">{wiz.errors.plan}</p>{/if}
        {:else}
          <dl class="sv-wizard-summary">
            <dt>Workspace</dt><dd>{wiz.name}</dd>
            <dt>URL</dt><dd>{wiz.slug}.northwind.app</dd>
            <dt>Invites</dt><dd>{wiz.invites.length ? wiz.invites.join(', ') : 'None yet'}</dd>
            <dt>Plan</dt><dd>{wiz.chosen?.label} ({wiz.chosen?.price} {wiz.chosen?.note})</dd>
          </dl>
        {/if}
      </div>

      <div class="sv-wizard-actions">
        <SvButton variant="ghost" disabled={wiz.current === 0 || wiz.busy} onclick={wiz.back}>Back</SvButton>
        {#if !wiz.isLast}
          <SvButton variant="primary" onclick={wiz.next}>{wiz.current === 1 && !wiz.invites.length ? 'Skip' : 'Next'}</SvButton>
        {:else}
          <SvButton variant="primary" loading={wiz.busy} onclick={wiz.finish}>Create workspace</SvButton>
        {/if}
      </div>
    {/if}
  </SvCard>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-wizard { min-height: 560px; padding: 32px 24px; display: flex; justify-content: center; align-items: flex-start; box-sizing: border-box; color: var(--sg-fg, #0f172a); }
  .sv-wizard > :global(*) { width: 100%; max-width: 620px; }
  .sv-wizard-head h2 { margin: 0 0 4px; font-size: 21px; letter-spacing: -.01em; }
  .sv-wizard-muted { color: var(--sg-muted, #64748b); font-size: 13.5px; margin: 0; }
  .sv-wizard-small { font-size: 12px; }
  .sv-wizard-stepper { margin: 18px 0 20px; padding-bottom: 16px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-wizard-body { display: flex; flex-direction: column; gap: 16px; min-height: 170px; }
  .sv-wizard-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .sv-wizard-plan {
    display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px; cursor: pointer; text-align: start;
    font: inherit; color: inherit; background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
  }
  .sv-wizard-plan:hover { background: var(--sg-row-hover-bg, #f8fafc); }
  .sv-wizard-plan:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; }
  .sv-wizard-plan[data-checked] { border-color: var(--sg-accent, #4f46e5); background: color-mix(in srgb, var(--sg-accent, #4f46e5) 8%, transparent); }
  .sv-wizard-plan-top { display: flex; align-items: center; gap: 8px; }
  .sv-wizard-price { font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
  .sv-wizard-err { margin: 0; font-size: 12.5px; color: var(--sg-danger, #dc2626); }
  .sv-wizard-summary { display: grid; grid-template-columns: 110px 1fr; gap: 10px 16px; margin: 0; font-size: 14px; }
  .sv-wizard-summary dt { color: var(--sg-muted, #64748b); }
  .sv-wizard-summary dd { margin: 0; overflow-wrap: anywhere; }
  .sv-wizard-actions { display: flex; justify-content: space-between; margin-top: 22px; }
  .sv-wizard-done { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 18px 0 6px; }
  .sv-wizard-done h3 { margin: 4px 0 0; font-size: 17px; }
  .sv-wizard-done :global(button) { margin-top: 10px; }
  .sv-wizard-tick {
    display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; font-size: 20px; font-weight: 700;
    color: var(--sg-success, #16a34a); background: color-mix(in srgb, var(--sg-success, #16a34a) 16%, transparent);
  }

  @media (max-width: 560px) {
    .sv-wizard { padding: 16px 12px; }
    .sv-wizard-stepper :global(.sv-step__text) { display: none; }
    .sv-wizard-plans { grid-template-columns: 1fr; }
    .sv-wizard-summary { grid-template-columns: 1fr; gap: 2px; }
    .sv-wizard-summary dd { margin-bottom: 10px; }
  }
</style>
