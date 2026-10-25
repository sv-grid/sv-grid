
# svgrid-trial

Records who started an SvGrid Enterprise trial. The trial dialog on
svgrid.com (`website/src/components/TrialDialog.svelte`) posts the name,
email and optional company here, then downloads `/downloads/svgrid-trial.zip`
from the site. The zip is built by `tools/build-trial-bundle.mjs` during the
website deploy.

The same submit also adds the email (with first and last name) to the
jQWidgets Mailchimp audience, from the browser, through the audience's
embedded-form endpoint (`website/src/lib/mailchimp.ts`). This worker is not
involved in that, and Mailchimp works even while the worker is not deployed.

The rows live in a Cloudflare D1 database, one per email:

| Column | |
| --- | --- |
| `email`, `name`, `company` | what the person typed |
| `source` | where the dialog opened: `home-hero`, `pricing-try`, `pricing-faq` |
| `country` | Cloudflare's country code for the request |
| `created_at`, `last_download_at`, `downloads` | first and latest download, and how many |
| `support_until` | 30 days after the first download; a repeat download keeps it |

The IP address is never stored; a salted hash of it is kept per request to
limit each address to five requests an hour. A hidden `website` field catches
form-filling bots: their requests are answered as a success and not stored.

## Set up (once)

```bash
cd workers/svgrid-trial
npm install
npx wrangler login

npx wrangler d1 create svgrid-trials        # copy the database_id into wrangler.toml
npm run schema                              # creates the tables

npx wrangler secret put ADMIN_TOKEN         # any long random string: openssl rand -hex 32
npx wrangler secret put IP_SALT             # another long random string
npx wrangler secret put NOTIFY_WEBHOOK      # optional: Slack / Teams / Discord incoming webhook

npx wrangler deploy                         # serves https://trial.svgrid.com (custom domain in wrangler.toml)
```

Then point the site at it: in the sv-grid repo settings, add the Actions
variable (or secret) `TRIAL_API` = `https://trial.svgrid.com`. It is set as a
secret today. The deploy workflow passes
it to the website build as `VITE_TRIAL_API`. Without it the dialog still
downloads the zip and fires the analytics event, but stores nothing.

## Read the sign-ups

```bash
ADMIN_TOKEN=... npm run export > trials.csv
```

or query D1 directly:

```bash
npx wrangler d1 execute svgrid-trials --remote --command "SELECT * FROM trials ORDER BY created_at DESC LIMIT 50"
```

Support runs from `support@jqwidgets.com`: a person writing from an email in
this table with `support_until` on or after today is a trial user in their
30 days.

## Founding customers

`src/founding.js` runs the founding-customer offer behind
https://svgrid.com/founding/ (claim a place) and
https://svgrid.com/founding/testimonial/ (send a testimonial after shipping).
Both pages are noindex and out of the sitemap; people reach them from the
email. The offer closes at `FOUNDING_ENDS` (2026-11-30 23:59:59 UTC; extended from 2026-10-31) or when
the 15 places are taken, whichever comes first. The worker enforces both; the
page only shows them. Override either with `[vars]` `FOUNDING_ENDS` and
`FOUNDING_PLACES` in `wrangler.toml` (keep `website/src/lib/founding.ts` in
step).

After deploying this version, run `npm run schema` once more: it adds the
`founding_claims` and `founding_testimonials` tables and leaves the trial
tables alone.

Each new claim posts to `NOTIFY_WEBHOOK`. To review:

```bash
# Pending claims
npx wrangler d1 execute svgrid-trials --remote --command "SELECT created_at, name, email, company, company_url, developers, building, logo_url FROM founding_claims WHERE status = 'pending'"

# Approve: issue the license file and email it (welcome email), then
node ../../tools/issue-license.mjs --tenant "Acme Corp" --seats 3 --expires 2027-10 --plan suite
npx wrangler d1 execute svgrid-trials --remote --command "UPDATE founding_claims SET status = 'approved' WHERE email = 'person@example.com'"

# Reject (gives the place back)
npx wrangler d1 execute svgrid-trials --remote --command "UPDATE founding_claims SET status = 'rejected' WHERE email = 'person@example.com'"
```

Exports, with the admin token:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://trial.svgrid.com/founding/claims.csv > claims.csv
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://trial.svgrid.com/founding/testimonials.csv > testimonials.csv
```

Every claim carries its testimonial, and the form's checkbox is the permission
to publish it with the person's name. Add a published quote to
`website/src/lib/testimonials.ts` with `foundingCustomer: true`, which keeps it
out of the Review markup search engines read.

## Privacy

Name, email and company are personal data. `website/src/routes/Privacy.svelte`
says what is kept and why; keep it in step with this worker. The policy
promises deletion 12 months after the last download: the worker's daily cron
does that (`purge` in `src/index.js`). To delete someone on request:

```bash
npx wrangler d1 execute svgrid-trials --remote --command "DELETE FROM trials WHERE email = 'person@example.com'"
```
