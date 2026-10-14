// The founding-customer offer: the first 15 companies or freelancers get a free
// perpetual Enterprise Suite license with a year of updates and support, in
// exchange for a testimonial sent with the claim (and a company's logo). The offer closes at FOUNDING_ENDS or when the places are
// taken, whichever comes first, and the same deadline is shown on the page.
//
//   GET  /founding/status                 ->  { open, placesTotal, placesLeft, endsAt }
//   POST /founding/claim                  ->  { ok, placesLeft }       (svgrid.com/founding/)
//   POST /founding/testimonial            ->  { ok }                   (svgrid.com/founding/testimonial/)
//   GET  /founding/claims.csv             Authorization: Bearer <ADMIN_TOKEN>
//   GET  /founding/testimonials.csv       Authorization: Bearer <ADMIN_TOKEN>
//
// A claim takes a place while it is pending or approved; marking it rejected
// (README) gives the place back. Licenses are issued by hand after review.

import { EMAIL, json, clip, httpUrl, readJson, rateLimit, notify, exportCsv } from './shared.js'

export const FOUNDING_PLACES = 15
export const FOUNDING_ENDS = '2026-10-31T23:59:59Z'

const settings = (env) => ({
  places: Number(env.FOUNDING_PLACES) > 0 ? Number(env.FOUNDING_PLACES) : FOUNDING_PLACES,
  endsAt: env.FOUNDING_ENDS || FOUNDING_ENDS,
})

export async function foundingStatus(env, now) {
  const { places, endsAt } = settings(env)
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM founding_claims WHERE status IN ('pending', 'approved')").first()
  const placesLeft = Math.max(0, places - (row?.n ?? 0))
  const ended = now.getTime() > Date.parse(endsAt)
  return { open: !ended && placesLeft > 0, ended, placesTotal: places, placesLeft, endsAt }
}

/**
 * Validate a claim; returns the clean fields or an error message. Every claim
 * carries its testimonial. A company claim also gives its logo and may offer a
 * case study later; a freelancer or solo developer (`kind: 'freelancer'`) gives
 * the testimonial only, so the company, the logo and the team size are
 * optional for them (one seat).
 */
export function parseClaim(body) {
  if (!body || typeof body !== 'object') return { error: 'bad request' }
  const kind = body.kind === 'freelancer' ? 'freelancer' : 'company'
  const name = clip(body.name, 120)
  const email = clip(body.email, 254).toLowerCase()
  const company = clip(body.company, 160)
  const building = clip(body.building, 1000)
  const developers = kind === 'freelancer' ? 1 : Math.floor(Number(body.developers))
  if (!name) return { error: 'name is required' }
  if (!EMAIL.test(email)) return { error: 'a valid email is required' }
  if (kind === 'company' && !company) return { error: 'company is required' }
  if (!(developers >= 1 && developers <= 1000)) return { error: 'the number of developers is required' }
  // The testimonial comes with the claim: their experience so far (the free
  // grid, the demos, a trial), published with their name as the form allows.
  const quote = clip(body.quote, 3000)
  if (quote.length < 20) return { error: 'please write your testimonial' }
  if (body.agree !== true) return { error: 'please accept the terms of the offer' }
  return {
    kind, name, email, company, building, developers, quote,
    role: kind === 'freelancer' ? 'Freelance developer' : clip(body.role, 160),
    caseStudy: false,
    companyUrl: httpUrl(body.companyUrl),
    logoUrl: kind === 'company' ? httpUrl(body.logoUrl) : '',
    honeypot: clip(body.website, 200) !== '',
  }
}

/** Validate a testimonial; returns the clean fields or an error message. */
export function parseTestimonial(body) {
  if (!body || typeof body !== 'object') return { error: 'bad request' }
  const name = clip(body.name, 120)
  const email = clip(body.email, 254).toLowerCase()
  const role = clip(body.role, 160)
  const company = clip(body.company, 160)
  const quote = clip(body.quote, 3000)
  if (!name) return { error: 'name is required' }
  if (!EMAIL.test(email)) return { error: 'a valid email is required' }
  if (quote.length < 20) return { error: 'the testimonial is too short' }
  if (body.publish !== true) return { error: 'we need your permission to publish it' }
  return {
    name, email, role, company, quote,
    logoUrl: httpUrl(body.logoUrl),
    caseStudy: body.caseStudy === true,
    honeypot: clip(body.website, 200) !== '',
  }
}

export async function handleFounding(url, request, env, ctx, cors) {
  const path = url.pathname
  if (path === '/founding/status' && request.method === 'GET') {
    return json(await foundingStatus(env, new Date()), 200, { ...cors, 'cache-control': 'no-store' })
  }
  if (path === '/founding/claim' && request.method === 'POST') return claim(request, env, ctx, cors)
  if (path === '/founding/testimonial' && request.method === 'POST') return testimonial(request, env, ctx, cors)
  if (path === '/founding/claims.csv' && request.method === 'GET') {
    return exportCsv(request, env, 'SELECT * FROM founding_claims ORDER BY created_at',
      ['created_at', 'status', 'kind', 'name', 'email', 'company', 'company_url', 'developers', 'building', 'logo_url', 'country'], 'svgrid-founding-claims.csv')
  }
  if (path === '/founding/testimonials.csv' && request.method === 'GET') {
    return exportCsv(request, env, 'SELECT * FROM founding_testimonials ORDER BY created_at',
      ['created_at', 'name', 'email', 'role', 'company', 'quote', 'logo_url', 'case_study'], 'svgrid-founding-testimonials.csv')
  }
  return null
}

async function claim(request, env, ctx, cors) {
  const form = parseClaim(await readJson(request))
  if (form.error) return json({ ok: false, error: form.error }, 400, cors)
  const now = new Date()
  const status = await foundingStatus(env, now)
  if (form.honeypot) return json({ ok: true, placesLeft: status.placesLeft }, 200, cors)

  // Sending the form again from the same email updates the claim, even after
  // the offer closes, and never takes a second place.
  const existing = await env.DB.prepare('SELECT status FROM founding_claims WHERE email = ?').bind(form.email).first()
  if (!existing) {
    if (status.ended) return json({ ok: false, error: 'the founding offer has ended' }, 410, cors)
    if (status.placesLeft <= 0) return json({ ok: false, error: 'all founding places are taken' }, 409, cors)
  }

  const record = await rateLimit(request, env, now)
  if (!record) return json({ ok: false, error: 'too many requests, try again later' }, 429, cors)

  const country = request.cf?.country ?? ''
  const userAgent = clip(request.headers.get('user-agent') ?? '', 300)
  const stamp = now.toISOString()
  await env.DB.batch([
    record,
    env.DB.prepare(
      `INSERT INTO founding_claims (email, kind, name, company, company_url, building, developers, logo_url, country, user_agent, created_at, updated_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
       ON CONFLICT(email) DO UPDATE SET
         kind = excluded.kind, name = excluded.name, company = excluded.company, company_url = excluded.company_url,
         building = excluded.building, developers = excluded.developers, logo_url = excluded.logo_url,
         updated_at = excluded.updated_at`,
    ).bind(form.email, form.kind, form.name, form.company, form.companyUrl, form.building, form.developers, form.logoUrl, country, userAgent, stamp, stamp),
    // The testimonial arrives with the claim and joins the others.
    env.DB.prepare(
      `INSERT INTO founding_testimonials (created_at, email, name, role, company, quote, logo_url, case_study)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(stamp, form.email, form.name, form.role, form.company, form.quote, form.logoUrl, form.caseStudy ? 1 : 0),
  ])
  const after = await foundingStatus(env, now)
  if (!existing) {
    notify(env, ctx,
      `Founding claim to review (${form.kind}${form.caseStudy ? ', open to a case study' : ''}):${form.name} <${form.email}>${form.company ? `, ${form.company}` : ''}${form.companyUrl ? ` (${form.companyUrl})` : ''}, ` +
      `${form.developers} dev${form.developers === 1 ? '' : 's'}.${form.building ? ` Building: ${form.building}.` : ''}` +
      ` Testimonial${form.role ? ` (${form.role})` : ''}: "${form.quote.slice(0, 300)}${form.quote.length > 300 ? '...' : ''}" Places left:${after.placesLeft} of ${after.placesTotal}.`)
  }
  return json({ ok: true, placesLeft: after.placesLeft }, 200, cors)
}

async function testimonial(request, env, ctx, cors) {
  const form = parseTestimonial(await readJson(request))
  if (form.error) return json({ ok: false, error: form.error }, 400, cors)
  if (form.honeypot) return json({ ok: true }, 200, cors)
  const now = new Date()
  const record = await rateLimit(request, env, now)
  if (!record) return json({ ok: false, error: 'too many requests, try again later' }, 429, cors)
  await env.DB.batch([
    record,
    env.DB.prepare(
      `INSERT INTO founding_testimonials (created_at, email, name, role, company, quote, logo_url, case_study)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(now.toISOString(), form.email, form.name, form.role, form.company, form.quote, form.logoUrl, form.caseStudy ? 1 : 0),
  ])
  notify(env, ctx,
    `New testimonial from ${form.name}${form.role ? `, ${form.role}` : ''}${form.company ? ` at ${form.company}` : ''} <${form.email}>` +
    `${form.caseStudy ? ' (open to a case study call)' : ''}: "${form.quote.slice(0, 300)}${form.quote.length > 300 ? '...' : ''}"`)
  return json({ ok: true }, 200, cors)
}
