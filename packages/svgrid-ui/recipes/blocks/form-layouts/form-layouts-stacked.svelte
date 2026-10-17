<script lang="ts" module>
  /**
   * Stacked form block - a single-column "New project" form: name
   * (SvTextInput), description (SvTextArea with a character counter), owner
   * (SvDropDownList), visibility (SvRadioGroup) and a due date
   * (SvDateTimePicker in calendar-only mode). Cancel and Create (SvButton) sit
   * right-aligned at the bottom. Submit validates every field and shows the
   * errors inline; a valid submit shows a toast, lists the project and resets.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createProjectForm() below owns the fields, validation, submit
   * flow and the created list with no markup. The component under it is one
   * styled render of that core; import createProjectForm from this file (or
   * `npx @svgrid/ui add form-layouts-stacked --headless` for the core alone)
   * to draw your own.
   */
  export type ProjectOption = { value: string; label: string }
  export type Project = { name: string; owner: string; visibility: string; due: Date }
  export type ProjectErrors = { name?: string; owner?: string; due?: string }
  export type ProjectFormOptions = {
    owners?: ProjectOption[]
    visibilities?: ProjectOption[]
    /** Earliest allowed due date; defaults to today at midnight. */
    minDue?: Date
    /** Called with a valid project; throw (or reject) to keep the form filled in. */
    onCreate?: (project: Project) => Promise<void> | void
    /** Called when a submit fails validation. */
    onInvalid?: (errors: ProjectErrors) => void
  }

  const SAMPLE_OWNERS: ProjectOption[] = [
    { value: 'ada', label: 'Ada Lovelace' },
    { value: 'grace', label: 'Grace Hopper' },
    { value: 'alan', label: 'Alan Turing' },
    { value: 'katherine', label: 'Katherine Johnson' },
  ]
  const SAMPLE_VISIBILITIES: ProjectOption[] = [
    { value: 'private', label: 'Private - only you and the owner' },
    { value: 'team', label: 'Team - everyone in Northwind Ops' },
    { value: 'public', label: 'Public - anyone with the link can view' },
  ]

  export function createProjectForm(opts: ProjectFormOptions = {}) {
    // Sample owners stand in when the app passes none; the due date floor is today.
    const owners = opts.owners ?? SAMPLE_OWNERS
    const visibilities = opts.visibilities ?? SAMPLE_VISIBILITIES
    const minDue = opts.minDue ?? new Date(new Date().setHours(0, 0, 0, 0))

    let name = $state('')
    let description = $state('')
    let owner = $state<string | number | null>(null)
    let visibility = $state<string | number>('team')
    let due = $state<Date | null>(null)
    let errors = $state<ProjectErrors>({})
    let busy = $state(false)
    let created = $state<Project[]>([])

    function validate(): boolean {
      const e: ProjectErrors = {}
      if (name.trim().length < 3) e.name = 'Name needs at least 3 characters.'
      else if (created.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) e.name = 'A project with this name already exists.'
      if (owner == null) e.owner = 'Pick who owns this project.'
      if (!due) e.due = 'Set a due date.'
      else if (due < minDue) e.due = 'The due date cannot be in the past.'
      errors = e
      return Object.keys(e).length === 0
    }

    function reset() {
      name = ''; description = ''; owner = null; visibility = 'team'; due = null; errors = {}
    }

    async function submit(ev?: Event) {
      ev?.preventDefault()
      if (busy) return
      if (!validate()) { opts.onInvalid?.(errors); return }
      busy = true
      const project: Project = {
        name: name.trim(), owner: owners.find((o) => o.value === owner)?.label ?? String(owner),
        visibility: String(visibility), due: due!,
      }
      try {
        await opts.onCreate?.(project)
        created = [project, ...created]
        reset()
      } catch {
        // The form keeps what was typed so the user can retry.
      } finally {
        busy = false
      }
    }

    return {
      owners, visibilities, minDue,
      get name() { return name },
      set name(v: string) { name = v; errors.name = undefined },
      get description() { return description },
      set description(v: string) { description = v },
      get owner() { return owner },
      set owner(v: string | number | null) { owner = v; errors.owner = undefined },
      get visibility() { return visibility },
      set visibility(v: string | number) { visibility = v },
      get due() { return due },
      set due(v: Date | null) { due = v; errors.due = undefined },
      get errors() { return errors },
      get busy() { return busy },
      get created() { return created },
      validate, reset, submit,
      /** Spread on your <form>. */
      formProps: () => ({ novalidate: true, onsubmit: submit }),
      /** Spread on a plain <input> or <textarea> when you render your own fields. */
      fieldProps: (field: 'name' | 'description') => ({
        name: field,
        value: field === 'name' ? name : description,
        oninput: (e: Event) => {
          const v = (e.currentTarget as HTMLInputElement).value
          if (field === 'name') { name = v; errors.name = undefined } else description = v
        },
        'aria-invalid': field === 'name' && errors.name ? ('true' as const) : undefined,
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvTextInput, SvTextArea, SvDropDownList, SvRadioGroup, SvDateTimePicker,
    SvButton, SvBadge, SvToaster, toast,
  } from '@svgrid/grid'

  const form = createProjectForm({
    onInvalid: () => toast.warning('Fix the highlighted fields'),
    // Replace with your request; a thrown error leaves the form filled in.
    onCreate: (p) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 900)), {
        loading: 'Creating project...',
        success: `${p.name} created`,
        error: 'Could not create the project',
      }),
  })

  function cancel() {
    form.reset()
    toast('Form cleared')
  }
</script>

<main class="sv-stacked">
  <form class="sv-stacked-sheet" {...form.formProps()}>
    <header>
      <h2>New project</h2>
      <p class="sv-stacked-muted">Projects group tasks, files and dashboards. You can change all of this later.</p>
    </header>

    <SvTextInput
      label="Project name" name="name" placeholder="Q3 warehouse audit" maxlength={60} block required
      bind:value={form.name} error={form.errors.name} invalid={!!form.errors.name}
    />
    <SvTextArea
      label="Description" name="description" placeholder="What is this project for?" rows={4}
      maxlength={280} showCount block bind:value={form.description} hint="Optional. Shown on the project card."
    />
    <SvDropDownList
      label="Owner" name="owner" placeholder="Choose an owner" options={form.owners} value={form.owner} block required
      error={form.errors.owner} invalid={!!form.errors.owner} onChange={(v) => (form.owner = v)}
    />
    <SvRadioGroup
      label="Visibility" name="visibility" options={form.visibilities} value={form.visibility}
      onChange={(v) => (form.visibility = v)}
    />
    <SvDateTimePicker
      label="Due date" name="due" placeholder="yyyy-mm-dd" formatString="yyyy-MM-dd"
      dropDownDisplayMode="calendar" min={form.minDue} value={form.due} block required
      error={form.errors.due} invalid={!!form.errors.due} onChange={(d) => (form.due = d)}
    />

    <footer class="sv-stacked-actions">
      <SvButton variant="ghost" onclick={cancel} disabled={form.busy}>Cancel</SvButton>
      <SvButton type="submit" variant="primary" loading={form.busy}>Create project</SvButton>
    </footer>
  </form>

  {#if form.created.length}
    <section class="sv-stacked-created" aria-label="Created projects">
      <h3>Created this session</h3>
      <ul>
        {#each form.created as p (p.name)}
          <li>
            <strong>{p.name}</strong>
            <span class="sv-stacked-muted">{p.owner} - due {p.due.toLocaleDateString()}</span>
            <SvBadge size="sm" variant="neutral">{p.visibility}</SvBadge>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-stacked {
    flex: none;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    min-height: 560px; padding: 32px 24px; box-sizing: border-box;
    background: var(--sg-bg-subtle, #f8fafc); color: var(--sg-fg, #0f172a);
  }
  .sv-stacked-sheet {
    display: flex; flex-direction: column; gap: 18px; width: 100%; max-width: 540px; box-sizing: border-box;
    padding: 28px; background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  header h2 { margin: 0 0 4px; font-weight: 700; font-size: 20px; letter-spacing: -.01em; }
  .sv-stacked-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 13px; }
  .sv-stacked-actions {
    display: flex; justify-content: flex-end; gap: 8px;
    padding-top: 16px; border-top: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-stacked-created { width: 100%; max-width: 540px; }
  .sv-stacked-created h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sv-stacked-created ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .sv-stacked-created li {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; font-size: 13.5px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px);
  }
  .sv-stacked-created li :global(.sv-badge) { margin-left: auto; text-transform: capitalize; }

  @media (max-width: 560px) {
    .sv-stacked { padding: 16px 12px; }
    .sv-stacked-sheet { padding: 20px 16px; }
    .sv-stacked-actions { flex-wrap: wrap; }
    .sv-stacked-actions :global(> *) { flex: 1; }
  }
</style>
