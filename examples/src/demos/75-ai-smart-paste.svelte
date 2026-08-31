<script lang="ts">
  /**
   * 75. AI Smart Paste (Pro)
   * -----------------------
   * Drop ANY shape of contact data into the zone - CSV with header,
   * tab-separated from Excel, JSON array, free-form lines - and the
   * assistant figures out which column is which by INSPECTING THE CELLS,
   * not by demanding a fixed format.
   *
   * What makes this "smart":
   *   - Auto-detects the separator (tab / comma / semicolon / pipe)
   *   - Auto-detects whether the first line is a header (by name match
   *     OR by column-type contrast with line 2)
   *   - Per-column TYPE detection - email / phone / name / company /
   *     role - using content regex, then maps each detected type to the
   *     matching target field
   *   - Falls back to a free-form parser for prose lines: extracts the
   *     email first (definitive marker) and infers the rest by position
   *     relative to it
   *   - Per-row confidence score so the user can see what's solid
   *
   * Swap `assistant()` for a real LLM call - the rest of the wiring is
   * identical (preview panel, commit, etc.).
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    rowSelectionFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import { installEnterprise, setLicenseKey, type EnterpriseGridApi } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  type Contact = {
    id: string
    fullName: string
    email: string
    company: string
    role: string
    phone: string
  }

  let rows = $state<Contact[]>([
    { id: 'c1', fullName: 'Ada Lovelace',   email: 'ada@analytic.engine', company: 'Analytic Engine',  role: 'Founder',    phone: '+44 20 1234 5678' },
    { id: 'c2', fullName: 'Linus Torvalds', email: 'linus@kernel.org',    company: 'Linux Foundation', role: 'Maintainer', phone: '+1 503 555 0101' },
  ])

  const features = tableFeatures({ rowSortingFeature, rowSelectionFeature })
  let api = $state<EnterpriseGridApi<typeof features, Contact> | null>(null)

  // ---- Smart paste state ----------------------------------------------
  let pasteText = $state('')
  let preview = $state<{ rows: ParsedRow[]; log: string[] }>({ rows: [], log: [] })
  let working = $state(false)

  type Field = 'fullName' | 'email' | 'company' | 'role' | 'phone'
  type ParsedRow = {
    id: string
    source: string                     // original line for the preview
    values: Partial<Record<Field, string>>
    confidence: 'high' | 'medium' | 'low'
    issues: string[]
  }

  // ---- Detection helpers ----------------------------------------------
  const RX_EMAIL = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i
  const RX_PHONE = /^[+]?\(?\d[\d\s\-().]{5,}\d$/
  const RX_NAME  = /^[A-ZÀ-Ý][\p{L}.''\-]+(\s+[A-ZÀ-Ý][\p{L}.''\-]+)+$/u
  const RX_ROLE_WORDS = /\b(CEO|CTO|CFO|COO|CMO|CIO|CSO|VP|EVP|SVP|Head|Director|Manager|Lead|Engineer|Architect|Founder|Co-?founder|President|Officer|Specialist|Analyst|Designer|Developer|Consultant|Maintainer|Professor|Administrator|Operator|Owner|Partner|Principal|Senior|Junior|Staff|Distinguished|Fellow|Researcher|Scientist|Strategist|Coordinator|Supervisor)\b/i
  const RX_COMPANY_HINT = /\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Co\.?|GmbH|AG|S\.A\.?|S\.r\.l\.?|S\.p\.A\.?|Pty|K\.K\.|B\.V\.|N\.V\.|Holdings|Industries|Foundation|Labs?|Group|Systems|Solutions|Technologies|University|College|Institute|Networks?|Studios?|Partners|Capital|Bank|Trust|Bureau)\b/i

  // ---- Smart normalization helpers ------------------------------------
  /** Common email-domain typos → canonical. Real systems catch a long
   * tail of these by Levenshtein; the demo handles the obvious ones. */
  const EMAIL_DOMAIN_FIXES: Record<string, string> = {
    'gmial.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com',
    'gmal.com': 'gmail.com',  'gmail.con': 'gmail.com',  'gmail.co': 'gmail.com',
    'gmail.cm': 'gmail.com',  'gmaim.com': 'gmail.com',
    'yaho.com': 'yahoo.com',  'yhaoo.com': 'yahoo.com',  'yahoo.con': 'yahoo.com',
    'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlock.com': 'outlook.com',
    'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
    'icould.com': 'icloud.com', 'iclod.com': 'icloud.com',
  }
  function correctEmail(raw: string): { email: string; corrected: boolean } {
    const trimmed = raw.trim().toLowerCase()
    const at = trimmed.lastIndexOf('@')
    if (at < 1) return { email: trimmed, corrected: false }
    const user = trimmed.slice(0, at)
    const domain = trimmed.slice(at + 1)
    const fixed = EMAIL_DOMAIN_FIXES[domain]
    if (fixed) return { email: `${user}@${fixed}`, corrected: true }
    return { email: trimmed, corrected: false }
  }

  /** Normalize a phone to "+CC AAA BBB CCCC" style. Falls back to the
   * trimmed input if no recognizable country shape is found. */
  function normalizePhone(raw: string): string {
    const cleaned = raw.replace(/[^\d+]/g, '')
    if (!cleaned) return raw.trim()
    const startsPlus = cleaned.startsWith('+')
    const digits = startsPlus ? cleaned.slice(1) : cleaned
    // E.164-ish formatting per country code.
    if (startsPlus) {
      if (digits.length === 11 && digits.startsWith('1'))
        return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
      if (digits.length >= 12 && digits.startsWith('44'))
        return `+44 ${digits.slice(2, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`
      if (digits.length >= 11 && digits.startsWith('49'))
        return `+49 ${digits.slice(2, 4)} ${digits.slice(4)}`
      if (digits.length >= 11 && digits.startsWith('33'))
        return `+33 ${digits.slice(2, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`
      if (digits.length >= 12 && digits.startsWith('81'))
        return `+81 ${digits.slice(2, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`
      // Fall back: split country code (2 digits) + rest.
      return `+${digits.slice(0, 2)} ${digits.slice(2)}`.replace(/\s+$/, '')
    }
    // No leading +: assume North American 10 digits, or 11 with leading 1.
    if (digits.length === 10)
      return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    if (digits.length === 11 && digits.startsWith('1'))
      return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
    return raw.trim()
  }

  /** Strip titles (Dr., Mr.), suffixes (Jr., III), and rewrite
   * "Last, First Middle" into "First Middle Last". */
  const RX_NAME_TITLE  = /^(Mr|Mrs|Ms|Mx|Dr|Prof|Sir|Lord|Lady|Madam|Rev|Hon)\.?\s+/i
  const RX_NAME_SUFFIX = /,?\s+(Jr|Sr|II|III|IV|V|Esq|PhD|MD|MBA|CPA|RN)\.?$/i
  function cleanName(raw: string): string {
    let name = raw.trim().replace(/\s+/g, ' ')
    if (!name) return name
    // "Last, First Middle" → "First Middle Last" (only when no '@' to
    // avoid mangling "smith, john (acme)" style mixed lines).
    if (!name.includes('@') && /^[^,]+,\s*[^,]+$/.test(name)) {
      const [last, first] = name.split(/,\s*/)
      if (last && first) name = `${first} ${last}`
    }
    name = name.replace(RX_NAME_TITLE, '')
    name = name.replace(RX_NAME_SUFFIX, '')
    return name.trim()
  }

  /** "Boyko Markov <boykom@jqwidgets.com>" → { name, email }. Also
   * handles `mailto:` prefixes and unquoted names. */
  function extractEmailFromAngle(line: string): { name?: string; email: string } | null {
    const m = line.match(/^\s*"?([^<"]*?)"?\s*<\s*(?:mailto:)?([^>\s]+@[^>\s]+)\s*>/i)
    if (m && m[2]) return { name: cleanName(m[1] || ''), email: m[2] }
    const mail = line.match(/mailto:([^\s"']+@[^\s"']+)/i)
    if (mail && mail[1]) return { email: mail[1] }
    return null
  }

  // Multi-language field-name dictionary. Picks up CSV exports from
  // German / French / Spanish / Italian / Portuguese / Dutch CRMs.
  const HEADER_FIELD: Array<{ field: Field; rx: RegExp }> = [
    { field: 'email',    rx: /^(e[\s_-]?mail|mail|email[\s_-]?address|electronic[\s_-]?mail|courriel|m[éeê]l|correo|correo[\s_-]?electr[oó]nico|posta|e[\s_-]?posta|epost|epost[\s_-]?adresse)$/i },
    { field: 'phone',    rx: /^(phone|tel|telephone|tel[ée]phone|mobile|cell|cell[\s_-]?phone|handy|telefon|telefono|tel[eé]fono|tel\.|m[oó]vil|portable|port[aá]til|numero|n[uú]mero|tlf|gsm)$/i },
    { field: 'fullName', rx: /^(full[\s_-]?name|name|first[\s_-]?name|last[\s_-]?name|given[\s_-]?name|family[\s_-]?name|surname|nom|pr[eé]nom|nome|nombre|cliente|customer|contact|kontakt|nom[\s_-]?complet|nombre[\s_-]?completo|naam|navn)$/i },
    { field: 'company',  rx: /^(company|organi[sz]ation|org|firma|firm|entreprise|empresa|sociedad|soci[eé]t[eé]|business|account|account[\s_-]?name|department|abteilung|dept|azienda|bedrijf|virksomhed)$/i },
    { field: 'role',     rx: /^(role|title|position|job[\s_-]?title|jobtitle|poste|cargo|titre|funci[oó]n|funktion|puesto|rol|carica|titel|stilling)$/i },
  ]
  function fieldFromHeader(label: string): Field | null {
    const v = label.trim()
    for (const { field, rx } of HEADER_FIELD) if (rx.test(v)) return field
    return null
  }

  function classifyCell(v: string): Field | 'unknown' {
    const t = v.trim()
    if (!t) return 'unknown'
    if (RX_EMAIL.test(t)) return 'email'
    if (RX_PHONE.test(t.replace(/\s/g, ''))) return 'phone'
    if (RX_ROLE_WORDS.test(t) && t.length < 60) return 'role'
    if (RX_COMPANY_HINT.test(t)) return 'company'
    if (RX_NAME.test(t)) return 'fullName'
    return 'unknown'
  }

  /** Build a column-index → field map by voting on each column's cells. */
  function inferColumnMap(rows: string[][]): Map<number, Field> {
    const map = new Map<number, Field>()
    const taken = new Set<Field>()
    const colCount = Math.max(...rows.map((r) => r.length))
    const tally: Array<Record<Field | 'unknown', number>> = Array.from({ length: colCount }, () => ({
      fullName: 0, email: 0, company: 0, role: 0, phone: 0, unknown: 0,
    }))
    for (const row of rows) {
      row.forEach((cell, i) => {
        const k = classifyCell(cell)
        tally[i]![k] += 1
      })
    }
    // Assign each column to its top-voted field (skipping fields already
    // assigned to a different column).
    const ranked = tally.map((t, i) => {
      const entries = (Object.entries(t) as Array<[Field | 'unknown', number]>)
        .filter((e): e is [Field, number] => e[0] !== 'unknown')
        .sort((a, b) => b[1] - a[1])
      return { i, entries }
    })
    // Sort columns by how confident their top-vote is (descending) so
    // strong matches (email, phone) get picked first.
    ranked.sort((a, b) => (b.entries[0]?.[1] ?? 0) - (a.entries[0]?.[1] ?? 0))
    for (const { i, entries } of ranked) {
      const winner = entries.find(([k, n]) => n > 0 && !taken.has(k))
      if (winner) {
        map.set(i, winner[0])
        taken.add(winner[0])
      }
    }
    // Fill any unmapped column with the first remaining target field
    // (company → role → fullName order, since those are the least
    // distinguishable by regex alone).
    const fallback: Field[] = ['fullName', 'company', 'role', 'phone', 'email']
    for (let i = 0; i < colCount; i += 1) {
      if (map.has(i)) continue
      const next = fallback.find((f) => !taken.has(f))
      if (next) { map.set(i, next); taken.add(next) }
    }
    return map
  }

  // ---- Tokeniser -------------------------------------------------------
  /** Detect the delimiter. Counts occurrences across all lines, picks the
   * one with the highest median count > 0. */
  function detectDelimiter(lines: string[]): string | null {
    const candidates = ['\t', ',', ';', '|']
    let best: { d: string; n: number } | null = null
    for (const d of candidates) {
      const counts = lines.map((l) => splitRespectingQuotes(l, d).length - 1)
      counts.sort((a, b) => a - b)
      const median = counts[Math.floor(counts.length / 2)] ?? 0
      if (median >= 1 && (!best || median > best.n)) best = { d, n: median }
    }
    return best?.d ?? null
  }

  /** Split on delimiter, respecting "double-quoted" cells. */
  function splitRespectingQuotes(line: string, delim: string): string[] {
    const out: string[] = []
    let buf = ''
    let inQ = false
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { buf += '"'; i += 1 }
        else inQ = !inQ
      } else if (ch === delim && !inQ) {
        out.push(buf); buf = ''
      } else {
        buf += ch
      }
    }
    out.push(buf)
    return out.map((s) => s.trim())
  }

  // ---- vCard parser ----------------------------------------------------
  /** Parse RFC 6350 vCards. Contacts apps copy in this format on macOS,
   * iOS, Android, Outlook export, and Google Contacts download. */
  function parseVCards(text: string): ParsedRow[] | null {
    if (!/BEGIN:VCARD/i.test(text)) return null
    const out: ParsedRow[] = []
    const cards = text.split(/BEGIN:VCARD/i).slice(1)
    cards.forEach((card, i) => {
      const values: Partial<Record<Field, string>> = {}
      // vCard unfolding: lines starting with whitespace continue the prior.
      const unfolded: string[] = []
      for (const raw of card.split(/\r?\n/)) {
        if (/^\s/.test(raw) && unfolded.length) unfolded[unfolded.length - 1]! += raw.trim()
        else unfolded.push(raw)
      }
      for (const line of unfolded) {
        if (/^END:VCARD/i.test(line)) break
        const m = line.match(/^([A-Z]+)(?:;[^:]*)?:(.+)$/i)
        if (!m) continue
        const key = m[1]!.toUpperCase()
        const val = m[2]!.trim()
        if (key === 'FN' && !values.fullName)         values.fullName = cleanName(val)
        else if (key === 'N' && !values.fullName)     values.fullName = cleanName(val.split(';').reverse().filter(Boolean).join(' '))
        else if (key === 'EMAIL' && !values.email)    values.email = correctEmail(val).email
        else if (key === 'ORG' && !values.company)    values.company = val.split(';')[0]!.trim()
        else if (key === 'TITLE' && !values.role)     values.role = val
        else if (key === 'TEL' && !values.phone)      values.phone = normalizePhone(val)
      }
      if (Object.keys(values).length > 0) {
        out.push(finalise(`vcard-${i}`, `vCard · ${values.fullName ?? '(unnamed)'}`, values))
      }
    })
    return out.length > 0 ? out : null
  }

  // ---- Markdown table parser ------------------------------------------
  /** GitHub-flavored Markdown tables: `| header | header |` followed by
   * `|---|---|` separator, then data rows. Common when pasting from Slack
   * threads, GitHub issues, or docs. */
  function parseMarkdownTable(text: string): ParsedRow[] | null {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('|') && l.endsWith('|'))
    if (lines.length < 2) return null
    const rowsAsArr = lines.map((l) =>
      l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()),
    )
    const sepIdx = rowsAsArr.findIndex((r) => r.length > 0 && r.every((c) => /^:?-+:?$/.test(c)))
    if (sepIdx < 1) return null
    const headerLine = rowsAsArr[0]!
    const data = rowsAsArr.slice(sepIdx + 1).filter((r) => r.some((c) => c))
    if (data.length === 0) return null
    const colMap = new Map<number, Field>()
    headerLine.forEach((h, i) => {
      const f = fieldFromHeader(h)
      if (f) colMap.set(i, f)
    })
    const inferred = inferColumnMap(data)
    for (const [i, f] of inferred) if (!colMap.has(i)) colMap.set(i, f)
    return data.map((cells, i) => {
      const values: Partial<Record<Field, string>> = {}
      cells.forEach((cell, ix) => {
        const f = colMap.get(ix)
        if (f && cell) values[f] = cell
      })
      return finalise(`md-${i}`, cells.join(' | '), values)
    })
  }

  // ---- Signature-block parser -----------------------------------------
  /** Multi-line "email signature" blocks separated by blank lines.
   * Each block becomes one contact. Recognises:
   *   - "Name <email>" or `mailto:` first line
   *   - Title + Company on the same line ("CEO, Acme")
   *   - Phone with international or local format
   */
  function parseSignatureBlocks(text: string): ParsedRow[] | null {
    const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
    if (blocks.length < 1) return null
    const out: ParsedRow[] = []
    for (const block of blocks) {
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      if (lines.length < 2 || lines.length > 14) continue
      const hasEmail = lines.some((l) => /[\w.+-]+@[\w.-]+\.\w{2,}/.test(l))
      if (!hasEmail) continue
      const values: Partial<Record<Field, string>> = {}
      for (const line of lines) {
        // "Name <email>" pattern - capture both.
        const angle = extractEmailFromAngle(line)
        if (angle?.email && !values.email) values.email = correctEmail(angle.email).email
        if (angle?.name && !values.fullName) values.fullName = angle.name
        // Bare email.
        if (!values.email) {
          const em = line.match(/[\w.+-]+@[\w.-]+\.\w{2,}/)
          if (em) values.email = correctEmail(em[0]).email
        }
        // Phone.
        if (!values.phone) {
          const ph = line.match(/[+]?\(?\d[\d\s\-().]{6,}\d/)
          if (ph) values.phone = normalizePhone(ph[0])
        }
        // Name.
        if (!values.fullName) {
          const candidate = cleanName(line)
          if (RX_NAME.test(candidate)) values.fullName = candidate
        }
        // "Role, Company" or "Role at Company" patterns.
        if (!values.role && RX_ROLE_WORDS.test(line) && line.length < 100) {
          const split = line.split(/\s+at\s+|\s*[,|]\s*/i).map((p) => p.trim()).filter(Boolean)
          if (split[0]) values.role = split[0]
          if (split[1] && !values.company) values.company = split[1]
        }
        // Standalone company line with hint.
        if (!values.company && RX_COMPANY_HINT.test(line) && line.length < 100) {
          values.company = line
        }
      }
      const matched = Object.keys(values).length
      if (matched >= 2) out.push(finalise(`sig-${out.length}`, lines[0] || 'signature', values))
    }
    return out.length > 0 ? out : null
  }

  // ---- Free-form parser ------------------------------------------------
  /** For prose lines with no consistent delimiter, extract by signals. */
  function parseProseLine(line: string): { values: Partial<Record<Field, string>>; issues: string[] } {
    const issues: string[] = []
    const values: Partial<Record<Field, string>> = {}

    // 0. "Name <email>" / `mailto:` - extract both at once.
    const angle = extractEmailFromAngle(line)
    if (angle?.email) values.email = correctEmail(angle.email).email
    if (angle?.name)  values.fullName = angle.name

    // 1. Email - definitive marker. Skip if angle form already captured it.
    let rawEmail: string | null = null
    if (!values.email) {
      const m = line.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i)
      if (m) { rawEmail = m[0]; values.email = correctEmail(m[0]).email }
      else issues.push('No email found')
    }

    // 2. Phone - the leftmost +?(...)?digits group of 7+ chars.
    const phoneMatch = line.match(/[+]?\(?\d[\d\s\-().]{5,}\d/)
    if (phoneMatch && phoneMatch[0] !== rawEmail) values.phone = normalizePhone(phoneMatch[0])

    // 3. Strip the email + phone + angle form, then split.
    const stripped = line
      .replace(/^\s*"?([^<"]*?)"?\s*<\s*[^>]+\s*>/i, '$1')
      .replace(rawEmail ?? '', '')
      .replace(phoneMatch?.[0] ?? '', '')
      .trim()
    const parts = stripped
      .split(/\s*[-–|,;]\s*|\s{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)

    // 4. Identify name (RX_NAME) - usually the first qualifying chunk.
    if (!values.fullName) {
      const cleaned = parts.map((p) => cleanName(p))
      const nameIx = cleaned.findIndex((p) => RX_NAME.test(p))
      if (nameIx !== -1) { values.fullName = cleaned[nameIx]!; parts.splice(nameIx, 1) }
      else if (parts.length > 0) values.fullName = cleanName(parts.shift()!)
    }

    // 5. Role - chunk that matches role words. Same chunk can mention
    // company ("CEO at Acme") - split on " at ".
    const roleIx = parts.findIndex((p) => RX_ROLE_WORDS.test(p))
    if (roleIx !== -1) {
      const chunk = parts.splice(roleIx, 1)[0]!
      const atSplit = chunk.split(/\s+at\s+/i)
      values.role = atSplit[0]!.trim()
      if (atSplit[1] && !values.company) values.company = atSplit[1]!.trim()
    }

    // 6. Whatever's left is the company.
    if (!values.company && parts.length > 0) {
      values.company = parts.join(' ').replace(/\s*\(\)\s*$/, '').trim()
    }

    return { values, issues }
  }

  // ---- Main assistant --------------------------------------------------
  async function assistant(text: string): Promise<{ rows: ParsedRow[]; log: string[] }> {
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 300))
    const log: string[] = []
    const t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim()
    if (!t) { log.push('Nothing to paste.'); return { rows: [], log } }

    // ---- 1. vCard - most specific format, try first ----
    const vcards = parseVCards(t)
    if (vcards) {
      log.push(`Detected vCard · ${vcards.length} record${vcards.length === 1 ? '' : 's'}.`)
      return { rows: dedup(vcards, log), log }
    }

    // ---- 2. Markdown table ----
    const md = parseMarkdownTable(t)
    if (md) {
      log.push(`Detected Markdown table · ${md.length} row${md.length === 1 ? '' : 's'}.`)
      return { rows: dedup(md, log), log }
    }

    // ---- 3. JSON ----
    if (t.startsWith('[') || t.startsWith('{')) {
      try {
        const obj = JSON.parse(t)
        const arr = Array.isArray(obj) ? obj : [obj]
        log.push(`Detected JSON · ${arr.length} record${arr.length === 1 ? '' : 's'}.`)
        const out: ParsedRow[] = arr.map((entry, i) => {
          const values: Partial<Record<Field, string>> = {}
          for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
            const field = fieldFromHeader(k)
            if (field) values[field] = String(v ?? '')
          }
          return finalise(`json-${i}`, JSON.stringify(entry), values)
        })
        log.push(`Parsed ${out.length} record${out.length === 1 ? '' : 's'} from JSON.`)
        return { rows: dedup(out, log), log }
      } catch { log.push('Looked like JSON but did not parse, falling back to text mode.') }
    }

    const lines = t.split('\n').filter((l) => l.trim())

    // ---- 4. Tabular ----
    const delim = detectDelimiter(lines)
    if (delim) {
      log.push(`Detected delimiter: ${delim === '\t' ? 'TAB' : `"${delim}"`}.`)
      const rawRows = lines.map((l) => splitRespectingQuotes(l, delim))
      const headerLine = rawRows[0]!
      const headerLooksLikeData = headerLine.some((c) => RX_EMAIL.test(c) || RX_PHONE.test(c.replace(/\s/g, '')))
      const headerHasFieldNames = headerLine.some((c) => fieldFromHeader(c) !== null)
      const hasHeader = headerHasFieldNames && !headerLooksLikeData
      log.push(hasHeader ? 'First line treated as header (field names, multi-language).' : 'No header detected - sampling content to infer columns.')

      const data = hasHeader ? rawRows.slice(1) : rawRows

      // Map columns by header name OR by content inference.
      const colMap = new Map<number, Field>()
      if (hasHeader) {
        headerLine.forEach((h, i) => {
          const f = fieldFromHeader(h)
          if (f) colMap.set(i, f)
        })
      }
      // Inference for any column the header didn't cover.
      const inferred = inferColumnMap(data)
      for (const [i, f] of inferred) if (!colMap.has(i)) colMap.set(i, f)

      const mapDescription = Array.from(colMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([i, f]) => `col${i}→${f}`).join(', ')
      log.push(`Column map: ${mapDescription || '(none)'}.`)

      const out: ParsedRow[] = data.map((cells, i) => {
        const values: Partial<Record<Field, string>> = {}
        cells.forEach((cell, ix) => {
          const field = colMap.get(ix)
          if (field && cell) values[field] = cell
        })
        return finalise(`tab-${i}`, cells.join(delim === '\t' ? ' › ' : ` ${delim} `), values)
      })
      log.push(`Parsed ${out.length} row${out.length === 1 ? '' : 's'}.`)
      return { rows: dedup(out, log), log }
    }

    // ---- 5. Signature blocks ----
    const sigs = parseSignatureBlocks(t)
    if (sigs && sigs.length > 0) {
      log.push(`Detected ${sigs.length} signature block${sigs.length === 1 ? '' : 's'}.`)
      return { rows: dedup(sigs, log), log }
    }

    // ---- 6. Free-form prose (one line per record) ----
    log.push('No consistent delimiter or block structure - parsing each line as free-form prose.')
    const out: ParsedRow[] = lines.map((line, i) => {
      const r = parseProseLine(line)
      return finalise(`prose-${i}`, line, r.values, r.issues)
    })
    log.push(`Parsed ${out.length} line${out.length === 1 ? '' : 's'}.`)
    return { rows: dedup(out, log), log }
  }

  /** De-duplicate parsed rows by normalised email so a paste with the
   * same contact in two formats (CSV + signature, JSON + vCard) collapses
   * cleanly. The first occurrence wins; subsequent duplicates are merged
   * (filling any missing fields). */
  function dedup(rows: ParsedRow[], log: string[]): ParsedRow[] {
    const seen = new Map<string, ParsedRow>()
    const out: ParsedRow[] = []
    let duplicates = 0
    for (const r of rows) {
      const key = r.values.email?.toLowerCase().trim()
      if (!key) { out.push(r); continue }
      const existing = seen.get(key)
      if (!existing) { seen.set(key, r); out.push(r); continue }
      // Merge missing fields into the existing row.
      for (const f of ['fullName', 'company', 'role', 'phone'] as const) {
        if (!existing.values[f] && r.values[f]) existing.values[f] = r.values[f]
      }
      duplicates += 1
    }
    if (duplicates > 0) log.push(`Merged ${duplicates} duplicate${duplicates === 1 ? '' : 's'} by email.`)
    return out
  }

  function finalise(
    id: string,
    source: string,
    values: Partial<Record<Field, string>>,
    extraIssues: string[] = [],
  ): ParsedRow {
    const issues = [...extraIssues]

    // Auto-correct email typos (gmial.com → gmail.com) and surface what
    // was corrected so the user can see the assistant fixed it.
    if (values.email) {
      const trimmed = values.email.trim().toLowerCase()
      const { email: fixed, corrected } = correctEmail(trimmed)
      values.email = fixed
      if (corrected) issues.push(`Fixed domain typo → ${fixed.split('@')[1]}`)
      if (!RX_EMAIL.test(fixed)) issues.push('Email looks malformed')
    }
    // Normalize phone to a consistent E.164-ish format.
    if (values.phone) values.phone = normalizePhone(values.phone)
    // Clean name (strip titles, "Last, First" → "First Last").
    if (values.fullName) values.fullName = cleanName(values.fullName)

    if (!values.fullName) issues.push('No name detected')
    if (!values.email)    issues.push('No email detected')
    const filled = Object.values(values).filter((v) => v && v.trim()).length

    // Confidence: high if all 5 fields present and no real issues; medium
    // if 3-4 fields with minor issues; low otherwise. A "Fixed domain
    // typo" warning is informational, so don't count it against high.
    const seriousIssues = issues.filter((i) => !i.startsWith('Fixed domain typo')).length
    const confidence: ParsedRow['confidence'] =
      seriousIssues === 0 && filled >= 4 ? 'high'
        : seriousIssues <= 1 && filled >= 3 ? 'medium'
        : 'low'
    return { id, source, values, confidence, issues }
  }

  // ---- Clipboard + samples + commit -----------------------------------
  async function runFromTextarea() { await runAssistant(pasteText) }

  async function runAssistant(text: string) {
    pasteText = text
    working = true
    preview = { rows: [], log: [] }
    preview = await assistant(text)
    working = false
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) await runAssistant(text)
    } catch {
      preview = { rows: [], log: ['Clipboard read blocked - paste the text into the box instead.'] }
    }
  }

  function onPaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text') ?? ''
    if (!text) return
    e.preventDefault()
    void runAssistant(text)
  }

  // ---- Per-row apply mode: insert new, update existing, or skip -------
  type RowMode = 'insert' | 'update' | 'skip'
  let rowMode = $state<Record<string, RowMode>>({})
  let rowMatch = $state<Record<string, string | null>>({})  // parsedRowId → existing contact id

  /** Decide a default action per parsed row: if the email matches an
   * existing contact, default to "update"; otherwise if we have at least
   * an email, "insert"; else "skip". */
  $effect(() => {
    const mode: Record<string, RowMode> = {}
    const match: Record<string, string | null> = {}
    for (const r of preview.rows) {
      const email = r.values.email?.toLowerCase().trim()
      const existing = email
        ? rows.find((c) => c.email.toLowerCase().trim() === email)
        : undefined
      if (existing) { mode[r.id] = 'update'; match[r.id] = existing.id }
      else if (email)            { mode[r.id] = 'insert'; match[r.id] = null }
      else                       { mode[r.id] = 'skip';   match[r.id] = null }
    }
    rowMode = mode
    rowMatch = match
  })

  const applyCounts = $derived.by(() => {
    let insert = 0, update = 0, skip = 0
    for (const r of preview.rows) {
      const m = rowMode[r.id] ?? 'skip'
      if (m === 'insert') insert += 1
      else if (m === 'update') update += 1
      else skip += 1
    }
    return { insert, update, skip, total: insert + update }
  })

  function setRowMode(id: string, mode: RowMode) {
    rowMode = { ...rowMode, [id]: mode }
  }

  function commit() {
    if (!api || preview.rows.length === 0) return
    let inserted = 0, updated = 0
    const toInsert: Contact[] = []
    for (const r of preview.rows) {
      const mode = rowMode[r.id] ?? 'skip'
      if (mode === 'skip') continue
      const payload: Contact = {
        id: rowMatch[r.id] ?? `c_${Math.random().toString(36).slice(2, 9)}`,
        fullName: r.values.fullName ?? '',
        email:    r.values.email    ?? '',
        company:  r.values.company  ?? '',
        role:     r.values.role     ?? '',
        phone:    r.values.phone    ?? '',
      }
      if (mode === 'update' && rowMatch[r.id]) {
        // Find existing row's index in the source data; rewrite each cell
        // through the imperative API so the grid emits change events.
        const ix = rows.findIndex((c) => c.id === rowMatch[r.id])
        if (ix !== -1) {
          for (const f of ['fullName', 'email', 'company', 'role', 'phone'] as const) {
            const v = payload[f]
            if (v) api.setCellValue(ix, f, v)
          }
          updated += 1
        }
      } else {
        toInsert.push(payload)
        inserted += 1
      }
    }
    if (toInsert.length > 0) api.addRows(toInsert)
    const parts: string[] = []
    if (inserted > 0) parts.push(`Inserted ${inserted}`)
    if (updated > 0)  parts.push(`Updated ${updated}`)
    preview = { rows: [], log: [parts.join(' · ') || 'No changes applied.'] }
    pasteText = ''
  }
  function cancel() { preview = { rows: [], log: [] }; pasteText = '' }

  const SAMPLES: Array<{ label: string; text: string; hint: string; icon: string; tag: string }> = [
    {
      label: 'CSV with header',
      icon:  '📑',
      tag:   '3 contacts · commas',
      hint:  'Standard CSV - field names in the first line.',
      text:
`name,email,company,role,phone
Grace Hopper,grace@navy.mil,US Navy,Rear Admiral,+1 202 555 0144
Margaret Hamilton,margaret@nasa.gov,NASA,Lead Programmer,+1 281 555 0177
Edsger Dijkstra,edsger@cwi.nl,CWI,Researcher,+31 20 555 0188`,
    },
    {
      label: 'TSV from Excel (no header)',
      icon:  '📊',
      tag:   '3 contacts · tabs · scrambled columns',
      hint:  'Columns in a different order, no header - assistant infers each field from content.',
      text:
`anders@microsoft.com\tAnders Hejlsberg\tDistinguished Engineer\tMicrosoft\t+1 425 555 0198
brendan@brave.com\tBrendan Eich\tCEO\tBrave\t+1 415 555 0123
guido@python.org\tGuido van Rossum\tEmeritus BDFL\tPython\t+1 650 555 0177`,
    },
    {
      label: 'Free-form prose',
      icon:  '✍️',
      tag:   '3 contacts · mixed punctuation',
      hint:  'Sentences with dashes and parens - assistant pulls email first, then infers the rest.',
      text:
`Tim Berners-Lee – tim@w3.org – W3C – Director (+44 7700 900 123)
Bjarne Stroustrup, bjarne@morganstanley.com, Morgan Stanley, MD (+1 212 555 0188)
Contact Brian Kernighan at bwk@princeton.edu, Princeton, Professor +1 609 555 0166`,
    },
    {
      label: 'JSON array',
      icon:  '{ }',
      tag:   '2 contacts · API export',
      hint:  'API export - field names map automatically.',
      text:
`[
  {"fullName":"Ken Thompson","email":"ken@bell-labs.com","company":"Bell Labs","title":"Computer scientist","tel":"+1 908 555 0144"},
  {"fullName":"Dennis Ritchie","email":"dmr@bell-labs.com","company":"Bell Labs","title":"Inventor of C","tel":"+1 908 555 0166"}
]`,
    },
    {
      label: 'Semicolon CSV',
      icon:  '🇪🇺',
      tag:   '2 new contacts · semicolons',
      hint:  'European-style CSV uses semicolons. Same parser, different delimiter. These 2 emails are new, so the assistant defaults to Insert - applying adds them as new rows.',
      text:
`Edsger Dijkstra;edsger@cs.utexas.edu;UT Austin;Professor;+1 512 555 0144
Margaret Hamilton;m.hamilton@apollo.nasa.gov;NASA Apollo;Lead Engineer;+1 281 555 0199`,
    },
    {
      label: 'vCard (.vcf)',
      icon:  '🪪',
      tag:   '2 contacts · BEGIN:VCARD',
      hint:  'macOS / iOS / Google Contacts export this RFC 6350 format on copy. The assistant unfolds wrapped lines, reads FN / EMAIL / ORG / TITLE / TEL, and normalises the phone number.',
      text:
`BEGIN:VCARD
VERSION:3.0
FN:Brendan Eich
ORG:Brave Software
TITLE:CEO
EMAIL;TYPE=WORK:brendan@brave.com
TEL;TYPE=CELL:+1 415 555 0188
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Anders Hejlsberg
ORG:Microsoft
TITLE:Technical Fellow
EMAIL;TYPE=WORK:anders.h@microsoft.com
TEL;TYPE=WORK:+1 425 555 0177
END:VCARD`,
    },
    {
      label: 'Markdown table',
      icon:  '📝',
      tag:   '3 contacts · | pipes |',
      hint:  'Pasted from a GitHub issue, a Slack thread, or VS Code docs. The assistant locates the `|---|---|` separator, reads multi-language column headers, and parses every data row.',
      text:
`| Name | Email | Company | Rol | Téléphone |
|---|---|---|---|---|
| Grace Hopper | grace@nps.mil | US Navy | Rear Admiral | +1 202 555 0133 |
| Ken Thompson | ken@bell-labs.com | Bell Labs | Researcher | +1 908 555 0124 |
| Bjarne Stroustrup | bjarne@stroustrup.com | Morgan Stanley | Managing Director | +1 212 555 0166 |`,
    },
    {
      label: 'Signature blocks',
      icon:  '✉️',
      tag:   '2 contacts · email signatures',
      hint:  'Paste two email signatures separated by a blank line. The assistant finds "Name <email>", reads the role / company on the line below, and normalises the phone format.',
      text:
`Donald E. Knuth <knuth@cs.stanford.edu>
Professor Emeritus, Stanford University
Phone: (650) 555-0111

Barbara Liskov <liskov@csail.mit.edu>
Institute Professor at MIT CSAIL
Cell: +1.617.555.0142`,
    },
    {
      label: 'Messy paste',
      icon:  '🪄',
      tag:   'typos · titles · "Last, First"',
      hint:  'Real-world clipboard chaos: title prefixes ("Dr."), name inversion ("Wirth, Niklaus"), email typo (gmial.com), and varied phone formats. The assistant cleans, corrects, and normalises every field.',
      text:
`Dr. Margaret Rhodes; margaret@gmial.com; Rhodes Capital LLC; Managing Partner; (212) 555-0188
Wirth, Niklaus; niklaus.wirth@inf.ethz.ch; ETH Zurich; Professor Emeritus; +41 44 555 0166
"James Gosling" <james@gosling.con>; Amazon Web Services; Distinguished Engineer; 1-415-555-0177`,
    },
  ]

  function loadSample(s: (typeof SAMPLES)[number]) {
    void runAssistant(s.text)
  }

  const FIELD_LABEL: Record<Field, string> = {
    fullName: 'Name', email: 'Email', company: 'Company', role: 'Role', phone: 'Phone',
  }
  const FIELD_ORDER: Field[] = ['fullName', 'email', 'company', 'role', 'phone']

  const columns: ColumnDef<typeof features, Contact>[] = [
    { field: 'fullName', header: 'Name',    editorType: 'text', width: 180 },
    { field: 'email',    header: 'Email',   editorType: 'text', width: 220 },
    { field: 'company',  header: 'Company', editorType: 'text', width: 180 },
    { field: 'role',     header: 'Role',    editorType: 'text', width: 160 },
    { field: 'phone',    header: 'Phone',   editorType: 'text', width: 160 },
  ]
</script>

<section class="ai-demo flex flex-col flex-1 min-h-0 gap-3">
  <!-- Smart paste zone -->
  <div class="ai-zone shrink-0">
    <header class="ai-zone-head">
      <div class="ai-zone-title">
        <span class="ai-spark">✨</span>
        <div>
          <div class="ai-zone-h1">Smart paste with AI <span class="ai-pill">Pro</span></div>
          <div class="ai-zone-h2">Paste anything - the assistant detects the format and maps it into typed rows.</div>
        </div>
      </div>
      <button type="button" class="ai-clipboard" onclick={pasteFromClipboard}>
        <span>📋</span> Paste from clipboard
      </button>
    </header>

    <div class="ai-sample-grid">
      {#each SAMPLES as s (s.label)}
        <button type="button" class="ai-sample-card" onclick={() => loadSample(s)} title={s.hint}>
          <span class="ai-sample-icon">{s.icon}</span>
          <span class="ai-sample-body">
            <span class="ai-sample-label">{s.label}</span>
            <span class="ai-sample-tag">{s.tag}</span>
          </span>
        </button>
      {/each}
    </div>

    <textarea
      class="ai-textarea"
      placeholder="…or paste your own data here. CSV / TSV / JSON / semicolon-CSV / free-form prose - all supported. The assistant detects delimiters and infers columns from cell content (email, phone, name, role keywords)."
      bind:value={pasteText}
      onpaste={onPaste}
      rows="4"
    ></textarea>

    <div class="ai-actions">
      <button type="button" class="ai-primary"
        disabled={working || !pasteText.trim()}
        onclick={runFromTextarea}
      >{working ? 'Analysing…' : '✨ Parse with AI'}</button>
      {#if preview.rows.length > 0}
        {@const total = applyCounts.insert + applyCounts.update}
        {@const tip =
          (applyCounts.insert > 0 ? `${applyCounts.insert} new` : '') +
          (applyCounts.insert > 0 && applyCounts.update > 0 ? ' · ' : '') +
          (applyCounts.update > 0 ? `${applyCounts.update} update` : '') +
          (applyCounts.skip > 0 ? ` · ${applyCounts.skip} skip` : '')}
        <button
          type="button"
          class="ai-accept"
          onclick={commit}
          disabled={applyCounts.total === 0}
          title={tip || 'Apply'}
        >
          <span class="ai-accept-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <span class="ai-accept-label">Apply</span>
          <span class="ai-accept-spacer"></span>
          {#if total > 0}
            <span class="ai-accept-badge" aria-label={tip}>
              {total} row{total === 1 ? '' : 's'}
            </span>
          {/if}
        </button>
      {/if}
      {#if preview.rows.length > 0 || preview.log.length > 0}
        <button type="button" class="ai-cancel" onclick={cancel}>Discard</button>
      {/if}
      {#if preview.log.length > 0}
        <span class="ai-log-summary" title={preview.log.join(' • ')}>
          {preview.log[preview.log.length - 1] ?? ''}
        </span>
      {/if}
    </div>
  </div>

  <!-- Preview rows panel -->
  {#if preview.rows.length > 0}
    <div class="ai-preview shrink-0">
      <div class="ai-preview-head">
        <div>
          <strong>Preview · {preview.rows.length} row{preview.rows.length === 1 ? '' : 's'}</strong>
          <span class="ai-counts">
            {#if applyCounts.insert > 0}<span class="ai-count-pill ai-count-insert">+{applyCounts.insert} new</span>{/if}
            {#if applyCounts.update > 0}<span class="ai-count-pill ai-count-update">↻{applyCounts.update} update</span>{/if}
            {#if applyCounts.skip > 0}<span class="ai-count-pill ai-count-skip">⊘{applyCounts.skip} skip</span>{/if}
          </span>
        </div>
        <span class="ai-legend">pick an action per row · Update is only available when the email matches an existing row</span>
      </div>

      <div class="ai-card-list">
        {#each preview.rows as r (r.id)}
          {@const mode = rowMode[r.id] ?? 'skip'}
          {@const matchId = rowMatch[r.id]}
          {@const matchRow = matchId ? rows.find((c) => c.id === matchId) : null}
          <article class="ai-row-card ai-mode-{mode}">
            <header class="ai-row-card-head">
              <div class="ai-row-id">
                <span class={`ai-badge ai-badge-${r.confidence}`}>{r.confidence}</span>
                <span class="ai-row-name">{r.values.fullName || '(unnamed)'}</span>
                {#if r.values.email}
                  <code class="ai-row-email">{r.values.email}</code>
                {/if}
              </div>
              <div class="ai-mode-picker" role="group" aria-label="Apply mode">
                <button type="button"
                  class="ai-tag ai-tag-insert" class:is-active={mode === 'insert'}
                  onclick={() => setRowMode(r.id, 'insert')}>+ Insert</button>
                <button type="button"
                  class="ai-tag ai-tag-update"
                  disabled={!matchId}
                  title={matchId ? `Will overwrite ${matchRow?.fullName ?? matchId}` : 'No matching email in the grid'}
                  class:is-active={mode === 'update'}
                  onclick={() => matchId && setRowMode(r.id, 'update')}>↻ Update</button>
                <button type="button"
                  class="ai-tag ai-tag-skip" class:is-active={mode === 'skip'}
                  onclick={() => setRowMode(r.id, 'skip')}>⊘ Skip</button>
              </div>
            </header>

            <dl class="ai-row-fields">
              <div class="ai-field"><dt>Company</dt><dd class:ai-empty={!r.values.company}>{r.values.company || '-'}</dd></div>
              <div class="ai-field"><dt>Role</dt>   <dd class:ai-empty={!r.values.role}   >{r.values.role    || '-'}</dd></div>
              <div class="ai-field"><dt>Phone</dt>  <dd class:ai-empty={!r.values.phone}  >{r.values.phone   || '-'}</dd></div>
            </dl>

            {#if matchRow}
              <div class="ai-row-match">
                ↻ Will overwrite existing row <strong>{matchRow.fullName}</strong>
              </div>
            {/if}
            {#if r.issues.length > 0}
              <div class="ai-row-issues">⚠ {r.issues.join(' · ')}</div>
            {/if}
          </article>
        {/each}
      </div>
    </div>
  {/if}

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="row"
      showRowNumbers={true}
      enableInlineEditing={true}
      enableCellSelection={false}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = installEnterprise(next))}
    />
  </div>
</section>

<style>
  /* Status colours (insert / update / warn / error) carry meaning, so they
     stay off the theme tokens; only their dark ramp is adjusted here. */
  .ai-demo {
    --ai-pos-bg:   rgba(16, 185, 129, 0.15);
    --ai-pos-fg:   #047857;
    --ai-info-bg:  rgba(59, 130, 246, 0.15);
    --ai-info-fg:  #1d4ed8;
    --ai-info-soft: rgba(59, 130, 246, 0.05);
    --ai-warn-bg:  rgba(245, 158, 11, 0.15);
    --ai-warn-fg:  #b45309;
    --ai-neg-bg:   rgba(239, 68, 68, 0.15);
    --ai-neg-fg:   #b91c1c;
  }
  :global([data-theme="dark"]) .ai-demo {
    --ai-pos-bg:   rgba(16, 185, 129, 0.22);
    --ai-pos-fg:   #6ee7b7;
    --ai-info-bg:  rgba(59, 130, 246, 0.22);
    --ai-info-fg:  #93c5fd;
    --ai-info-soft: rgba(59, 130, 246, 0.10);
    --ai-warn-bg:  rgba(245, 158, 11, 0.22);
    --ai-warn-fg:  #fcd34d;
    --ai-neg-bg:   rgba(239, 68, 68, 0.22);
    --ai-neg-fg:   #fca5a5;
  }

  /* ---- Paste zone ---- */
  .ai-zone {
    border: 1px solid color-mix(in srgb, var(--sg-accent, #6366f1) 28%, transparent);
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 5%, transparent);
    border-radius: 12px;
    padding: 14px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .ai-zone-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .ai-zone-title  { display: inline-flex; align-items: flex-start; gap: 10px; }
  .ai-zone-h1     { font-weight: 700; font-size: 15px; color: var(--sg-fg, #0f172a); display: inline-flex; align-items: center; gap: 8px; }
  .ai-zone-h2     { font-size: 12px; color: var(--sg-muted, #64748b); margin-top: 1px; }
  .ai-spark       { font-size: 22px; line-height: 1; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--sg-accent, #a855f7) 55%, transparent)); padding-top: 2px; }
  .ai-pill        {
    background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff);
    font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
    padding: 2px 7px; border-radius: 999px; text-transform: uppercase;
  }
  .ai-clipboard {
    display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;
  }
  .ai-clipboard:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .ai-clipboard span  { font-size: 14px; }

  /* ---- Sample cards ---- */
  .ai-sample-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
  }
  .ai-sample-card {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    transition: border-color 80ms, background 80ms, transform 80ms;
  }
  .ai-sample-card:hover {
    border-color: var(--sg-accent, #6366f1);
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 4%, transparent);
    transform: translateY(-1px);
  }
  .ai-sample-icon {
    width: 32px; height: 32px;
    display: inline-grid; place-items: center;
    border-radius: 8px;
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 10%, transparent);
    color: var(--sg-accent, #4338ca);
    font-size: 16px; font-weight: 700; flex: none;
  }
  .ai-sample-body  { display: flex; flex-direction: column; min-width: 0; }
  .ai-sample-label { font-size: 13px; font-weight: 600; color: var(--sg-fg, #0f172a); }
  .ai-sample-tag   { font-size: 11px; color: var(--sg-muted, #64748b); }

  /* ---- Textarea ---- */
  .ai-textarea {
    width: 100%;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 8px;
    padding: 10px 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    resize: vertical;
    outline: none;
  }
  .ai-textarea:focus {
    border-color: var(--sg-accent, #6366f1);
    box-shadow: var(--sg-focus-ring, 0 0 0 3px color-mix(in srgb, var(--sg-accent, #6366f1) 18%, transparent));
  }

  /* ---- Action bar ---- */
  .ai-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ai-primary {
    background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff);
    border: 0; border-radius: 8px;
    padding: 8px 14px; font-weight: 600; cursor: pointer;
    box-shadow: 0 1px 2px color-mix(in srgb, var(--sg-accent, #6366f1) 25%, transparent);
  }
  .ai-primary:disabled { opacity: 0.50; cursor: default; box-shadow: none; }
  .ai-accept {
    display: flex;
    height: 100%;
    overflow: hidden;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #fff;
    border: 0;
    border-radius: 8px;
    padding: 7px 8px 7px 14px;
    font-weight: 600;
    font-size: 13.5px;
    line-height: 1.2;
    white-space: nowrap;
    flex-shrink: 0;
    cursor: pointer;
    width: 170px;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.18) inset,
      0 -1px 0 rgba(0, 0, 0, 0.10) inset,
      0 2px 5px rgba(16, 185, 129, 0.35);
    transition: transform 80ms ease, box-shadow 140ms ease, filter 140ms ease;
  }
  .ai-accept:hover:not(:disabled) {
    filter: brightness(1.06);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.20) inset,
      0 -1px 0 rgba(0,0,0,0.10) inset,
      0 3px 10px rgba(16,185,129,0.45);
  }
  .ai-accept:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 3px rgba(16,185,129,0.30),
      0 1px 0 rgba(255,255,255,0.18) inset,
      0 -1px 0 rgba(0,0,0,0.10) inset,
      0 2px 5px rgba(16,185,129,0.35);
  }
  .ai-accept:active:not(:disabled) { transform: translateY(1px); }

  .ai-accept-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; flex-shrink: 0;
    color: rgba(255,255,255,0.95);
  }
  .ai-accept-label { letter-spacing: 0.01em; flex-shrink: 0; }
  .ai-accept-spacer { flex: 1; min-width: 4px; }
  .ai-accept-badge {
    background: rgba(255,255,255,0.22);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 11.5px; font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .ai-accept:disabled {
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-muted, #94a3b8);
    box-shadow: 0 0 0 1px var(--sg-border, #cbd5e1) inset;
    cursor: default;
  }
  .ai-accept:disabled .ai-accept-badge {
    background: var(--sg-border, rgba(148, 163, 184, 0.18));
    color: var(--sg-muted, #94a3b8);
  }
  .ai-cancel {
    background: transparent; color: var(--sg-muted, #64748b);
    border: 1px solid var(--sg-border, #cbd5e1); border-radius: 8px;
    padding: 7px 12px; cursor: pointer;
  }
  .ai-cancel:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .ai-log-summary  {
    margin-left: auto;
    font-size: 11px; color: var(--sg-muted, #64748b);
    max-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ai-skip-count   { color: var(--sg-muted, rgba(148, 163, 184, 0.9)); font-weight: 500; margin-left: 4px; }

  /* ---- Preview panel ---- */
  .ai-preview {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    border-radius: 12px; overflow: hidden;
    max-height: 360px;
    display: flex; flex-direction: column;
  }
  .ai-preview-head {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    padding: 10px 14px;
    font-size: 13px;
    color: var(--sg-fg, #0f172a);
    background: var(--sg-header-bg, #f8fafc);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .ai-counts { display: inline-flex; gap: 4px; margin-left: 10px; }
  .ai-count-pill {
    font-size: 11px; font-weight: 600;
    padding: 1px 8px; border-radius: 999px;
  }
  .ai-count-insert { background: var(--ai-pos-bg);  color: var(--ai-pos-fg); }
  .ai-count-update { background: var(--ai-info-bg); color: var(--ai-info-fg); }
  .ai-count-skip   { background: var(--sg-border, rgba(148, 163, 184, 0.18)); color: var(--sg-muted, #475569); }
  .ai-legend       { font-size: 11px; color: var(--sg-muted, #64748b); }

  .ai-card-list {
    display: flex; flex-direction: column; gap: 8px;
    padding: 10px 14px;
    overflow: auto;
    min-height: 0;
  }

  .ai-row-card {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 10px 12px;
    display: flex; flex-direction: column; gap: 6px;
    transition: border-color 80ms, background 80ms;
  }
  .ai-row-card.ai-mode-insert { border-left: 3px solid #10b981; }
  .ai-row-card.ai-mode-update { border-left: 3px solid #3b82f6; background: var(--ai-info-soft); }
  .ai-row-card.ai-mode-skip   { border-left: 3px solid var(--sg-border, #cbd5e1); opacity: 0.65; }

  .ai-row-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .ai-row-id        { display: inline-flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
  .ai-row-name      { font-weight: 600; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .ai-row-email     {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 10%, transparent);
    color: var(--sg-accent, #4338ca);
    padding: 1px 6px; border-radius: 4px;
  }

  /* Action picker */
  .ai-mode-picker {
    display: inline-flex; gap: 2px;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 2px;
  }
  .ai-tag {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
    padding: 3px 9px; border-radius: 6px;
    border: 0; cursor: pointer;
    background: transparent;
    color: var(--sg-muted, #64748b);
  }
  .ai-tag:disabled            { opacity: 0.40; cursor: not-allowed; }
  .ai-tag-insert.is-active    { background: var(--ai-pos-bg);  color: var(--ai-pos-fg); }
  .ai-tag-update.is-active    { background: var(--ai-info-bg); color: var(--ai-info-fg); }
  .ai-tag-skip.is-active      { background: var(--sg-bg-subtle, var(--sg-header-bg, #e2e8f0)); color: var(--sg-fg, #334155); }
  .ai-tag:hover:not(:disabled):not(.is-active) { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); color: var(--sg-fg, #0f172a); }

  /* Confidence badge */
  .ai-badge        { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
                     padding: 2px 6px; border-radius: 4px; }
  .ai-badge-high   { background: var(--ai-pos-bg);  color: var(--ai-pos-fg); }
  .ai-badge-medium { background: var(--ai-warn-bg); color: var(--ai-warn-fg); }
  .ai-badge-low    { background: var(--ai-neg-bg);  color: var(--ai-neg-fg); }

  /* Field grid */
  .ai-row-fields {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px 16px;
    margin: 0;
  }
  .ai-field    { display: flex; flex-direction: column; min-width: 0; }
  .ai-field dt { font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--sg-muted, #94a3b8); }
  .ai-field dd { margin: 0; font-size: 12px; color: var(--sg-fg, #0f172a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ai-empty    { color: var(--sg-muted, #cbd5e1); font-style: italic; }

  /* Inline match / issues */
  .ai-row-match  {
    font-size: 11px; color: var(--ai-info-fg);
    background: var(--ai-info-bg);
    padding: 4px 8px; border-radius: 6px;
  }
  .ai-row-issues {
    font-size: 11px; color: var(--ai-warn-fg);
    background: var(--ai-warn-bg);
    padding: 4px 8px; border-radius: 6px;
  }
</style>
