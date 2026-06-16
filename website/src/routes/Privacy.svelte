<section class="mx-auto max-w-3xl px-6 py-12">
  <header class="mb-10">
    <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
      Legal
    </p>
    <h1 class="mt-2 text-4xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
      Privacy policy
    </h1>
    <p class="mt-2 text-sm" style="color: var(--site-muted);">Last updated: 2026-06-16</p>
  </header>

  <article class="prose">
    <h2>Summary</h2>
    <p>
      This is a documentation and marketing site for an open-source library. We do not run an
      account system and we never sell or share contact data. The site uses two analytics layers:
      a <strong>cookieless</strong> service (Umami) for product-interest events, and
      <strong>Google Analytics 4 with Google Ads</strong> for conversion measurement on paid
      campaigns. The Google integration is what makes this page no longer cookie-free - if that
      matters to you, the "Opt out" section below covers your options.
    </p>

    <h2>Hosting</h2>
    <p>
      The site is served from <strong>GitHub Pages</strong>. GitHub logs server-side request
      metadata (IP address, user agent, timestamp) for the purpose of serving the page and
      preventing abuse. Their privacy policy at
      <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">docs.github.com/site-policy</a>
      applies to that processing - we do not see or store those logs.
    </p>

    <h2>Cookies &amp; local storage</h2>
    <p>
      The site itself uses <code>localStorage</code> to remember one preference: your light /
      dark theme choice (stored under the key <code>sg-theme</code>). Beyond that, the third
      parties below set their own cookies:
    </p>
    <ul>
      <li>
        <strong>Google Analytics 4 / Google Ads</strong> (loaded from
        <code>googletagmanager.com</code>) set first-party cookies such as
        <code>_ga</code>, <code>_ga_*</code>, and <code>_gid</code> to recognise returning
        visitors and to attribute conversions to ad clicks. Lifetime is up to 2 years
        (configurable on the Google side). Google may also set advertising cookies like
        <code>IDE</code> / <code>NID</code> in their <code>doubleclick.net</code> domain
        depending on your Google account state.
      </li>
      <li>
        <strong>Umami</strong> sets <strong>no cookies</strong>. It writes nothing to your
        device.
      </li>
    </ul>

    <h2>Umami (cookieless product analytics)</h2>
    <p>
      We use <strong>privacy-friendly, cookieless analytics</strong> from
      <a href="https://umami.is/docs/faq" target="_blank" rel="noopener noreferrer">Umami</a>
      to count page views and a small set of anonymous product-interest events - for example
      "pricing viewed", "demo viewed", or "checkout started". This helps us see which docs and
      demos are useful and where the experience can improve.
    </p>
    <p>
      The Umami layer:
    </p>
    <ul>
      <li>sets <strong>no cookies</strong> and writes nothing to your device for tracking;</li>
      <li>collects <strong>no personal data</strong> and no IP addresses we can read - visitors
        are counted with a daily-rotating, non-reversible hash;</li>
      <li>does <strong>not track you across other websites</strong>;</li>
      <li>is <strong>disabled automatically</strong> when your browser sends a Do Not Track or
        Global Privacy Control signal.</li>
    </ul>
    <p>
      Events carry only coarse, non-identifying properties (such as which pricing tier a button
      referred to). We never attach your name, email, or any identifier.
    </p>

    <h2>Google Analytics 4 &amp; Google Ads</h2>
    <p>
      We run Google Ads campaigns to reach Svelte developers searching for a data grid. To
      measure whether those ads actually drive useful traffic, the site loads
      <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">Google's gtag.js</a>
      with measurement ID <code>G-Z6896B9VX8</code> on every page. Specifically it:
    </p>
    <ul>
      <li>sends a <code>page_view</code> event to GA4 on the landing page and on every
        in-app navigation;</li>
      <li>uses GA4's data to attribute conversions (clicks on Pricing, Buy dialog opened,
        contact-sales) back to the originating Google Ads click;</li>
      <li>sets the GA cookies listed under "Cookies &amp; local storage";</li>
      <li>shares pseudonymous identifiers with Google so they can compute audience and
        conversion metrics. Google's processing of that data is governed by their
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        and
        <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">advertising policies</a>.</li>
    </ul>
    <p>
      We do <strong>not</strong> pass your name, email, or any direct identifier to Google. The
      conversion events we send are tied only to the gtag client ID Google generates in your
      browser.
    </p>

    <h2>Opt out</h2>
    <p>
      You have several options to keep GA4 / Google Ads from collecting data about your visit:
    </p>
    <ul>
      <li>Block the loader at the network level - any reputable content blocker (uBlock Origin,
        Privacy Badger, Brave's built-in shields) stops <code>googletagmanager.com</code> from
        loading and our SPA pageview helper becomes a silent no-op.</li>
      <li>Install Google's
        <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">official GA opt-out browser add-on</a>,
        which disables gtag tracking on every site that uses it.</li>
      <li>Clear the <code>_ga</code> / <code>_gid</code> cookies in your browser to reset the
        identifier between visits.</li>
    </ul>
    <p>
      The Umami layer respects Do Not Track and Global Privacy Control automatically; the
      Google layer currently does not (Google operates its own
      <a href="https://support.google.com/analytics/answer/9976101" target="_blank" rel="noopener noreferrer">consent mode</a>
      we haven't enabled yet). If you want belt-and-braces protection, use one of the methods
      above.
    </p>

    <h2>Outbound links</h2>
    <p>
      Some pages link to external services - GitHub, npm, jqwidgets.com, htmlelements.com,
      modelcontextprotocol.io. Those sites have their own privacy policies, which we encourage you
      to read.
    </p>

    <h2>npm package telemetry</h2>
    <p>
      The analytics above apply to <strong>this website only</strong>. The
      <code>@svgrid/grid</code>, <code>@svgrid/enterprise</code>, <code>@svgrid/grid-wc</code>, and
      <code>@svgrid/mcp</code> npm packages contain <strong>no telemetry and no analytics</strong>.
      They make no network calls at runtime - nothing in this analytics setup ships in the library
      you install. See the
      <a href="https://www.svgrid.com/docs/help/security" target="_blank" rel="noopener noreferrer">security page</a>
      for the full runtime accounting.
    </p>

    <h2>Sales & support contact</h2>
    <p>
      If you email <a href="mailto:sales@jqwidgets.com">sales@jqwidgets.com</a> or
      <a href="mailto:support@jqwidgets.com">support@jqwidgets.com</a>, jQWidgets receives the
      message including your email address. We use that information only to reply to you and, where
      relevant, to open a support ticket. We do not add you to a marketing list. Retention is
      indefinite unless you ask us to delete the thread.
    </p>

    <h2>Your rights</h2>
    <p>
      Under the GDPR and similar regimes you have the right to access, correct, or delete personal
      data we hold about you. To exercise any of those rights, email
      <a href="mailto:support@jqwidgets.com">support@jqwidgets.com</a>.
    </p>

    <h2>Changes</h2>
    <p>
      If we change this policy materially, the "Last updated" date at the top will move and the
      change will be summarized at the start of the document.
    </p>
  </article>
</section>
