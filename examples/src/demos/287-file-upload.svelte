<script lang="ts">
  /**
   * SvFileUpload - a drag-and-drop file field with click-to-browse, accept /
   * size / count validation and a selected-files list. Carries the shared editor
   * contract (label, hint, required/error validation), so it drops into a form
   * exactly like the other inputs.
   */
  import { SvFileUpload } from '@svgrid/grid'
  import type { FileRejection } from '@svgrid/grid'

  let avatar = $state<File[]>([])
  let docs = $state<File[]>([])
  let lastReject = $state<string>('')

  const onReject = (rejections: FileRejection[]) => {
    const r = rejections[0]
    lastReject = r ? `Rejected ${r.file.name} (${r.reason})` : ''
  }
  // A required single-file field is invalid until a file is chosen.
  const avatarError = $derived(avatar.length ? undefined : 'An avatar image is required')
</script>

<div class="wrap">
  <header>
    <h2>File upload</h2>
    <p>Drag files onto the zone or click to browse. <code>accept</code>, <code>maxSize</code> and <code>maxFiles</code> validate on drop; rejects fire <code>onReject</code>. Same label / validation contract as every field.</p>
  </header>

  <div class="cols">
    <section>
      <h3>Single (required, images only)</h3>
      <SvFileUpload
        files={avatar}
        label="Avatar"
        accept="image/*"
        required
        invalid={!!avatarError}
        error={avatarError}
        onChange={(f) => (avatar = f)}
        onReject={onReject}
      />
    </section>

    <section>
      <h3>Multiple (PDF, max 3, 5 MB each)</h3>
      <SvFileUpload
        files={docs}
        label="Documents"
        hint="Up to 3 PDFs, 5 MB each"
        accept=".pdf"
        multiple
        maxFiles={3}
        maxSize={5 * 1024 * 1024}
        onChange={(f) => (docs = f)}
        onReject={onReject}
      />
      {#if lastReject}<p class="reject">{lastReject}</p>{/if}
    </section>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 820px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; max-width: 660px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; align-items: start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .reject { margin: 10px 0 0; font-size: 12.5px; color: var(--sg-danger, #dc2626); font-weight: 600; }
</style>
