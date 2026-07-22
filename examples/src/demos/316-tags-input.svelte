<script lang="ts">
  /**
   * SvTagsInput - a production token editor: type + Enter/comma to add, Backspace
   * or the chip x to remove. Unique + max enforced. Copy-paste ready.
   */
  import { SvTagsInput } from '@svgrid/grid'

  let skills = $state<string[]>(['Svelte', 'TypeScript', 'CSS'])
  let recipients = $state<string[]>([])
  let submitted = $state(false)
  const recipientsError = $derived(submitted && recipients.length === 0 ? 'Add at least one recipient' : undefined)
</script>

<div class="wrap">
  <header>
    <h2>Tags input</h2>
    <p>An editable set of tokens - skills, labels, email recipients, filters. Rejects duplicates and caps the count.</p>
  </header>

  <section class="block">
    <h3>Skills (max 6, unique)</h3>
    <SvTagsInput value={skills} max={6} placeholder="Add a skill..." onChange={(v) => (skills = v)} />
    <p class="out">{skills.length}/6 tags</p>
  </section>

  <section class="block">
    <SvTagsInput
      value={recipients}
      label="Recipients"
      hint="Press Enter or comma to add"
      required
      invalid={!!recipientsError}
      error={recipientsError}
      placeholder="name@company.com"
      onChange={(v) => (recipients = v)}
    />
    <button class="btn" onclick={() => (submitted = true)}>Send invites</button>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 460px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .block h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .out { margin: 8px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); }
  .btn { margin-top: 12px; font: inherit; font-size: 13px; font-weight: 600; padding: 7px 16px; border: 0; border-radius: 8px; background: var(--sg-accent, #2563eb); color: #fff; cursor: pointer; }
</style>
