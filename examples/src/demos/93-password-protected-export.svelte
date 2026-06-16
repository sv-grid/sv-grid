<script lang="ts">
  /**
   * 93. Password-protected export
   * -----------------------------
   * The export bar gates the download behind a passphrase. The user
   * picks a format + strength + passphrase; the demo:
   *
   *   - Builds the export payload (CSV by default; xlsx / PDF stubs
   *     in this demo show the same flow).
   *   - Derives a key from the passphrase via PBKDF2 (100k iters).
   *   - Encrypts the payload with AES-GCM using `window.crypto.subtle`.
   *   - Packages `salt | iv | ciphertext` into a `.sgexport` Blob and
   *     triggers a download.
   *
   * A built-in viewer below lets users decrypt the downloaded file in
   * place - the round-trip is fully client-side, no server.
   *
   * Production path (sv-grid-pro): xlsx encryption uses the ECMA-376
   * Agile-Encryption profile (key spin + HMAC over the container).
   * This demo shows the UX + key-derivation pattern; the Pro pack
   * wires it to the real .xlsx container.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from 'sv-grid-core'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let rows = $state<Person[]>(makePeople(40))

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName',  header: 'First',      width: 110 },
    { field: 'lastName',   header: 'Last',       width: 130 },
    { field: 'email',      header: 'Email',      width: 220 },
    { field: 'department', header: 'Department', width: 130 },
    { field: 'salary',     header: 'Salary',     width: 130, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'country',    header: 'Country',    width: 80 },
    { field: 'status',     header: 'Status',     width: 110 },
  ]

  // ---- Export state ------------------------------------------------------
  let dlgOpen = $state(false)
  let format = $state<'csv' | 'xlsx' | 'pdf'>('xlsx')
  let passphrase = $state('')
  let confirmPw = $state('')
  let busy = $state(false)
  let lastFilename = $state<string | null>(null)

  const strength = $derived.by(() => {
    const p = passphrase
    if (p.length === 0) return { score: 0, label: 'empty', color: '#cbd5e1' }
    let score = 0
    if (p.length >= 8) score += 1
    if (p.length >= 12) score += 1
    if (/[A-Z]/.test(p)) score += 1
    if (/[a-z]/.test(p)) score += 1
    if (/[0-9]/.test(p)) score += 1
    if (/[^A-Za-z0-9]/.test(p)) score += 1
    const label = score >= 5 ? 'strong'
                : score >= 4 ? 'good'
                : score >= 3 ? 'fair'
                : score >= 2 ? 'weak'
                :              'very weak'
    const color = score >= 5 ? '#16a34a'
                : score >= 4 ? '#65a30d'
                : score >= 3 ? '#f59e0b'
                : score >= 2 ? '#ea580c'
                :              '#dc2626'
    return { score, label, color }
  })
  const passwordsMatch = $derived(passphrase === confirmPw && passphrase.length > 0)
  const canExport      = $derived(passwordsMatch && strength.score >= 3 && !busy)

  // ---- Encryption pipeline (Web Crypto) ----------------------------------
  async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
    const enc = new TextEncoder()
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
    )
  }

  async function encryptPayload(plaintext: Uint8Array<ArrayBuffer>, passphrase: string): Promise<Uint8Array<ArrayBuffer>> {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv   = crypto.getRandomValues(new Uint8Array(12))
    const key  = await deriveKey(passphrase, salt)
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))
    // Bundle: [magic 'SGENC1' 6 bytes][format 1 byte][salt 16][iv 12][cipher ...]
    const formatByte: Record<typeof format, number> = { csv: 1, xlsx: 2, pdf: 3 }
    const magic = new TextEncoder().encode('SGENC1')
    const out = new Uint8Array(magic.length + 1 + salt.length + iv.length + cipher.length)
    let off = 0
    out.set(magic, off);                       off += magic.length
    out[off++] = formatByte[format]
    out.set(salt, off);                        off += salt.length
    out.set(iv, off);                          off += iv.length
    out.set(cipher, off)
    return out
  }

  async function decryptBundle(blob: ArrayBuffer, passphrase: string): Promise<{ format: string; plaintext: Uint8Array<ArrayBuffer> }> {
    const view = new Uint8Array(blob)
    const magic = new TextDecoder().decode(view.slice(0, 6))
    if (magic !== 'SGENC1') throw new Error('Not a valid .sgexport file')
    const formatByte = view[6]!
    const formatName = formatByte === 1 ? 'csv' : formatByte === 2 ? 'xlsx' : formatByte === 3 ? 'pdf' : 'unknown'
    const salt = view.slice(7, 7 + 16)
    const iv   = view.slice(23, 23 + 12)
    const cipher = view.slice(35)
    const key = await deriveKey(passphrase, salt)
    const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher))
    return { format: formatName, plaintext }
  }

  // ---- Payload builders --------------------------------------------------
  function buildCsv(): Uint8Array<ArrayBuffer> {
    const cols = columns.map((c) => c.header)
    const header = cols.join(',')
    const lines = rows.map((r) => cols.map((_, i) => {
      const field = columns[i]!.field as keyof Person
      const v = String(r[field] ?? '')
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
    }).join(','))
    return new TextEncoder().encode([header, ...lines].join('\n'))
  }
  function buildXlsxStub(): Uint8Array<ArrayBuffer> {
    // A real xlsx is a zip of XML parts. This demo stub packs a CSV
    // inside a `.xlsx`-named container with a header that signals to
    // the consumer that the production pipeline writes a real OOXML
    // workbook here.
    const note = `xlsx STUB - production: ECMA-376 OOXML container\n\n`
    return new TextEncoder().encode(note + new TextDecoder().decode(buildCsv()))
  }
  function buildPdfStub(): Uint8Array<ArrayBuffer> {
    const note = `%PDF stub - production: pdfmake / wkhtmltopdf with /Encrypt /R 6 entries\n\n`
    return new TextEncoder().encode(note + new TextDecoder().decode(buildCsv()))
  }

  async function runExport() {
    if (!canExport) return
    busy = true
    try {
      const plaintext = format === 'csv' ? buildCsv() : format === 'xlsx' ? buildXlsxStub() : buildPdfStub()
      const sealed = await encryptPayload(plaintext, passphrase)
      const filename = `export-${new Date().toISOString().slice(0, 10)}.sgexport`
      const url = URL.createObjectURL(new Blob([sealed], { type: 'application/octet-stream' }))
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      lastFilename = filename
      dlgOpen = false
    } catch (err) {
      console.error('[encrypt]', err)
    } finally {
      busy = false
    }
  }

  // ---- In-page decrypt tool ----------------------------------------------
  let unlockPw = $state('')
  let unlockBusy = $state(false)
  let unlockResult = $state<{ format: string; preview: string } | { error: string } | null>(null)
  let pickedFile = $state<File | null>(null)
  function onFilePick(e: Event) {
    const files = (e.currentTarget as HTMLInputElement).files
    pickedFile = files && files[0] ? files[0] : null
    unlockResult = null
  }
  async function tryUnlock() {
    if (!pickedFile || !unlockPw) return
    unlockBusy = true
    try {
      const buf = await pickedFile.arrayBuffer()
      const { format: f, plaintext } = await decryptBundle(buf, unlockPw)
      const text = new TextDecoder().decode(plaintext).slice(0, 320)
      unlockResult = { format: f, preview: text }
    } catch {
      unlockResult = { error: 'Could not decrypt - wrong passphrase or corrupted file.' }
    } finally {
      unlockBusy = false
    }
  }
</script>

<section class="pe-shell flex flex-col flex-1 min-h-0 gap-3">
  <header class="pe-head shrink-0">
    <div>
      <h2 class="pe-title">Password-protected export</h2>
      <p class="pe-sub">
        PBKDF2 (100k iterations) → AES-GCM 256. Salt + IV bundled in the file header.
        Works fully client-side via <code>window.crypto.subtle</code>.
      </p>
    </div>
    <div class="pe-head-actions">
      <button type="button" class="pe-btn pe-btn-primary" onclick={() => (dlgOpen = true)}>
        🔒 Export with password
      </button>
      {#if lastFilename}
        <span class="pe-success">Wrote <code>{lastFilename}</code></span>
      {/if}
    </div>
  </header>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>

  <!-- In-page decrypt tool -->
  <div class="pe-decrypt shrink-0">
    <h3 class="pe-decrypt-title">Decrypt a <code>.sgexport</code> file</h3>
    <div class="pe-decrypt-row">
      <input type="file" accept=".sgexport,application/octet-stream" onchange={onFilePick} />
      <input type="password" placeholder="Passphrase" bind:value={unlockPw} />
      <button type="button" class="pe-btn pe-btn-ghost" onclick={tryUnlock} disabled={!pickedFile || !unlockPw || unlockBusy}>
        {unlockBusy ? 'Decrypting…' : 'Decrypt'}
      </button>
    </div>
    {#if unlockResult && 'preview' in unlockResult}
      <div class="pe-decrypt-out pe-ok">
        <strong>{unlockResult.format.toUpperCase()}</strong> · first 320 chars:
        <pre>{unlockResult.preview}</pre>
      </div>
    {:else if unlockResult && 'error' in unlockResult}
      <div class="pe-decrypt-out pe-err">{unlockResult.error}</div>
    {/if}
  </div>
</section>

<!-- Password dialog -->
{#if dlgOpen}
  <div class="pe-dlg-back" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) dlgOpen = false }}>
    <div class="pe-dlg" role="dialog" aria-label="Encrypted export">
      <header class="pe-dlg-head">
        <h3>Encrypted export</h3>
        <button type="button" class="pe-dlg-close" onclick={() => (dlgOpen = false)} aria-label="Close">×</button>
      </header>

      <div class="pe-dlg-body">
        <label class="pe-field">
          <span class="pe-field-label">Format</span>
          <div class="pe-format" role="group">
            <button type="button" class:on={format === 'xlsx'} onclick={() => (format = 'xlsx')}>xlsx</button>
            <button type="button" class:on={format === 'pdf'}  onclick={() => (format = 'pdf')}>PDF</button>
            <button type="button" class:on={format === 'csv'}  onclick={() => (format = 'csv')}>CSV</button>
          </div>
        </label>

        <label class="pe-field">
          <span class="pe-field-label">Passphrase</span>
          <input type="password" autocomplete="new-password" bind:value={passphrase}
                 placeholder="At least 12 chars; mix case + digits + symbol" />
          <div class="pe-strength">
            <div class="pe-strength-bar"
              style={`width: ${(strength.score / 6) * 100}%; background: ${strength.color}`}>
            </div>
          </div>
          <span class="pe-strength-label" style={`color: ${strength.color}`}>Strength: {strength.label}</span>
        </label>

        <label class="pe-field">
          <span class="pe-field-label">Confirm passphrase</span>
          <input type="password" autocomplete="new-password" bind:value={confirmPw} />
          {#if confirmPw && !passwordsMatch}
            <span class="pe-warn">Passphrases don't match.</span>
          {/if}
        </label>

        <div class="pe-tip">
          The file is bundled as <code>magic | salt | iv | ciphertext</code>. Loss of the passphrase is
          unrecoverable - the key is derived locally and never persisted.
        </div>
      </div>

      <footer class="pe-dlg-foot">
        <button type="button" class="pe-btn pe-btn-ghost" onclick={() => (dlgOpen = false)}>Cancel</button>
        <button type="button" class="pe-btn pe-btn-primary" disabled={!canExport} onclick={runExport}>
          {busy ? 'Encrypting…' : 'Encrypt + download'}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .pe-shell { height: 100%; }
  .pe-head {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  }
  .pe-title { font-size: 20px; font-weight: 700; margin: 0; color: var(--sg-fg, #0f172a); }
  .pe-sub   { font-size: 13px; color: var(--sg-muted, #64748b); margin: 4px 0 0 0; max-width: 70ch; line-height: 1.45; }
  .pe-sub code, .pe-tip code, .pe-decrypt code {
    background: var(--sg-header-bg, #f1f5f9);
    padding: 1px 5px; border-radius: 3px;
    font-family: ui-monospace, Menlo, monospace; font-size: 11.5px;
  }
  .pe-head-actions { display: inline-flex; align-items: center; gap: 12px; }
  .pe-success { color: #16a34a; font-size: 12px; }

  .pe-btn {
    border-radius: 6px;
    padding: 7px 14px;
    font-size: 13px; font-weight: 600;
    cursor: pointer;
  }
  .pe-btn:disabled { opacity: 0.5; cursor: default; }
  .pe-btn-primary {
    background: linear-gradient(135deg, #16a34a, #047857);
    color: #fff; border: 0;
    box-shadow: 0 1px 2px rgba(16, 185, 129, 0.30);
  }
  .pe-btn-ghost   {
    background: transparent; color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
  }
  .pe-btn-ghost:hover:not(:disabled) { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }

  /* Decrypt tool */
  .pe-decrypt {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 10px 14px;
  }
  .pe-decrypt-title { margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: var(--sg-fg, #0f172a); }
  .pe-decrypt-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .pe-decrypt-row input[type="password"] {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px; outline: none;
  }
  .pe-decrypt-out {
    margin-top: 8px;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
  }
  .pe-ok  { background: rgba(34,197,94,0.12); color: #166534; }
  .pe-err { background: rgba(239,68,68,0.14); color: #991b1b; }
  .pe-decrypt-out pre {
    margin: 6px 0 0 0; overflow: auto;
    font-family: ui-monospace, Menlo, monospace; font-size: 11px;
    max-height: 120px;
  }

  /* Dialog */
  .pe-dlg-back {
    position: fixed; inset: 0; z-index: 60;
    background: rgba(15, 23, 42, 0.45);
    display: flex; align-items: center; justify-content: center;
  }
  .pe-dlg {
    width: min(440px, calc(100% - 32px));
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(15, 23, 42, 0.30);
    overflow: hidden;
  }
  .pe-dlg-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
  }
  .pe-dlg-head h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--sg-fg, #0f172a); }
  .pe-dlg-close   { border: 0; background: transparent; color: var(--sg-muted, #94a3b8); font-size: 20px; cursor: pointer; }
  .pe-dlg-body {
    padding: 14px 16px;
    display: flex; flex-direction: column; gap: 14px;
  }
  .pe-field { display: flex; flex-direction: column; gap: 4px; }
  .pe-field-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); font-weight: 600; }
  .pe-field input[type="password"] {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 14px; outline: none;
  }

  .pe-format { display: inline-flex; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 6px; overflow: hidden; width: fit-content; }
  .pe-format button {
    border: 0; background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    padding: 5px 14px; font-size: 13px; cursor: pointer;
    border-right: 1px solid var(--sg-border, #cbd5e1);
  }
  .pe-format button:last-child { border-right: 0; }
  .pe-format button.on { background: var(--sg-accent, #2563eb); color: #fff; font-weight: 600; }

  .pe-strength {
    height: 5px; border-radius: 999px;
    background: var(--sg-header-bg, #f1f5f9);
    overflow: hidden; margin-top: 6px;
  }
  .pe-strength-bar { height: 100%; transition: width 120ms ease, background 120ms ease; }
  .pe-strength-label { font-size: 11px; margin-top: 2px; font-weight: 600; }

  .pe-warn { font-size: 11.5px; color: #b91c1c; }
  .pe-tip  { background: rgba(99,102,241,0.08); border-radius: 6px; padding: 8px 10px; font-size: 12px; color: var(--sg-muted, #475569); }

  .pe-dlg-foot {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
  }
</style>
