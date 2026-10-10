/**
 * The free browser tools at /tools/<slug>: copy, search metadata and FAQ.
 *
 * One source for three readers, so the served HTML and the hydrated page say
 * the same thing:
 *   - tools/lib/route-seo.mjs builds each tool's ROUTE_SEO entry from it,
 *   - tools/prerender-site.mjs writes the crawlable body and the FAQPage +
 *     WebApplication graph,
 *   - website/src/routes/Tools.svelte renders the same intro, steps and FAQ.
 *
 * Why the tools exist (marketing/keyword-volume-2026-10.md): "csv viewer online"
 * and "json to table" are searched far more than every Svelte grid query put
 * together. Each tool is the free grid doing real work, with a "get the code"
 * panel that turns the visitor's own file into a <SvGrid> component.
 *
 * Every claim here has to be true of the code in website/src/lib/tools and
 * website/src/components/tools: nothing is uploaded, delimiters are detected,
 * rows are virtualized. No row-count or speed numbers: none were measured.
 *
 * Dependency-free so Vite can bundle it into the site.
 */

export const FREE_TOOLS = [
  {
    slug: 'csv-viewer',
    name: 'CSV Viewer',
    h1: 'CSV Viewer and Editor',
    query: 'csv viewer online',
    title: 'CSV Viewer Online - Open, Sort, Filter and Edit CSV Free',
    description:
      'Open a CSV file in your browser, sort, filter and edit it like a spreadsheet, then save it as CSV, JSON or Excel. Free, no sign-up, nothing uploaded.',
    keywords: ['csv viewer online', 'csv editor online', 'open csv file online', 'csv file viewer', 'view csv online', 'csv to json', 'csv to excel', 'csv to xlsx'],
    cardText: 'Open, sort, filter and edit a CSV file.',
    lead:
      'Drop a CSV file on the page, or paste the text, and it opens as a table you can sort, filter, search and edit. Your browser reads the file; it is never uploaded anywhere.',
    steps: [
      'Drop a .csv, .tsv or .txt file on the drop zone, choose one with the file picker, or paste the text.',
      'The delimiter (comma, semicolon, tab or pipe) is detected for you. Change it, or turn off "First row is a header", if the guess is wrong.',
      'Click a header to sort, use the column menu to filter, or type in the search box to filter every column at once. Double-click a cell to edit it.',
      'Download the rows you are looking at as CSV, JSON or an Excel .xlsx file. The download follows your sort, filters and edits.',
    ],
    faq: [
      {
        question: 'Is my CSV file uploaded to a server?',
        answer:
          'No. The file is read with your browser\'s File API and parsed by code running in this page. Nothing is sent anywhere, so it is safe to open files with customer or financial data.',
      },
      {
        question: 'How large a CSV file can it open?',
        answer:
          'The table only draws the rows that are on screen, so scrolling stays smooth on long files. The practical limit is your browser\'s memory, not a row cap set by the tool.',
      },
      {
        question: 'Which delimiters and formats does it read?',
        answer:
          'Comma, semicolon, tab and pipe, detected from the first rows. Quoted fields can contain the delimiter, line breaks and doubled quotes, as RFC 4180 describes. A byte order mark at the start of the file is ignored.',
      },
      {
        question: 'Can I edit the CSV and save it?',
        answer:
          'Yes. Double-click a cell, type the new value and press Enter. "Download CSV" then writes the edited rows, in the order and with the filters you have on screen.',
      },
      {
        question: 'Can I convert a CSV file to JSON?',
        answer:
          'Yes. "Download JSON" writes an array of objects keyed by the header row, with numeric columns written as numbers.',
      },
      {
        question: 'Can I convert a CSV file to Excel?',
        answer:
          'Yes. "Excel" writes an .xlsx file with numbers stored as numbers, the header row frozen and your sort and filters applied. It is the export from @svgrid/enterprise, the same exportGrid call you would use in your own Svelte app.',
      },
      {
        question: 'Why does a column of IDs or ZIP codes stay as text?',
        answer:
          'A column is treated as numbers only when every value is a plain number. A value with a leading zero, like 00501, keeps the whole column as text so the zero is not lost.',
      },
    ],
  },
  {
    slug: 'json-to-table',
    name: 'JSON to Table',
    h1: 'JSON to Table Converter',
    query: 'json to table',
    title: 'JSON to Table - View JSON as a Sortable Table, Export CSV',
    description:
      'Paste JSON or drop a .json file and see it as a sortable, filterable table. Nested objects become columns; download the result as CSV. Free and private.',
    keywords: ['json to table', 'json to csv', 'json viewer table', 'convert json to table', 'json table viewer online', 'json lines viewer', 'json to excel'],
    cardText: 'See JSON as a table, export it as CSV.',
    lead:
      'Paste JSON or drop a .json file and it turns into a table you can sort, filter and search. Nested objects become their own columns, and the result downloads as CSV. Everything runs in your browser.',
    steps: [
      'Paste JSON into the box or drop a .json, .jsonl or .ndjson file on it.',
      'An array of objects becomes one row per object. If the array is wrapped, as in an API response like {"data": {"items": [...]}}, the largest array of objects inside is found and shown.',
      'Nested objects are flattened into dot-path columns such as user.address.city. A list of plain values becomes one comma-separated cell.',
      'Sort, filter and search the table, then download what you see as CSV, as cleaned-up JSON or as an Excel .xlsx file.',
    ],
    faq: [
      {
        question: 'Is my JSON sent to a server?',
        answer:
          'No. The JSON is parsed by your browser in this page and never leaves your computer, so API responses with tokens or personal data are safe to paste.',
      },
      {
        question: 'How are nested objects shown?',
        answer:
          'Each nested field becomes a column named by its path, so {"user": {"name": "Ada"}} gives a column called user.name. An array of plain values is joined into one cell; an array of objects is kept as JSON text in its cell.',
      },
      {
        question: 'What if my JSON is an object, not an array?',
        answer:
          'The converter looks inside it for the largest array of objects, which is where most API responses keep their records, and tells you the path it used. An object with no such array is shown as a single row.',
      },
      {
        question: 'Does it read JSON Lines (NDJSON)?',
        answer: 'Yes. When the text is not one JSON document, each non-empty line is read as its own JSON value.',
      },
      {
        question: 'Can I convert JSON to Excel?',
        answer:
          'Yes. Load the JSON and choose "Excel". Nested fields arrive as their own columns, numbers stay numbers, and the file follows your sort and filters. The export is the one @svgrid/enterprise adds to a Svelte app.',
      },
      {
        question: 'How do I convert JSON to CSV?',
        answer:
          'Load the JSON, then choose "Download CSV". The header row uses the column paths, and the rows follow your current sort and filters.',
      },
    ],
  },
]

export function findFreeTool(slug) {
  return FREE_TOOLS.find((t) => t.slug === slug) ?? null
}
