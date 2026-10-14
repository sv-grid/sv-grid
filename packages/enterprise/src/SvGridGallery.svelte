<script
  lang="ts"
  generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData"
>
  // Gallery renderer for SvGrid: rendered in place of the table when the
  // `gallery` prop is set. Each row is a card - a cover image, a title and a
  // few fields - in a wall that fills the width. The rows are the grid's
  // filtered + sorted rows, so its search box, filters and sort flow through.
  //   - the cover is an image URL or the first image of a list of files
  //   - a column with a `fieldType` (the fields module) draws as its cell does
  //     (select pills, avatars, stars), other columns through their formatter
  //     or `format`
  //   - cards render in batches as the wall scrolls, so a big table does not
  //     mount thousands of cards up front
  // Themes entirely from the grid's `--sg-*` tokens.
  import type { ColumnDef, GalleryConfig, RowData, TableFeatures } from "@svgrid/grid";
  import { formatValueForExport, getGridExtension } from "@svgrid/grid";

  let {
    data,
    columns,
    gallery,
    getRowId,
  }: {
    data: ReadonlyArray<TData>;
    columns: ReadonlyArray<ColumnDef<TFeatures, TData>>;
    gallery: GalleryConfig<TFeatures, TData>;
    getRowId?: (row: TData, index: number) => string;
  } = $props();

  type Def = Record<string, any>;
  const ext = $derived(getGridExtension());
  const leaves = $derived.by(() => {
    const out: Def[] = [];
    const walk = (cols: ReadonlyArray<Def>) => {
      for (const c of cols) {
        if (Array.isArray(c.columns) && c.columns.length) walk(c.columns);
        else if (typeof c.field === "string") out.push(c);
      }
    };
    walk(columns as unknown as Def[]);
    // Field-typed columns filled in as the grid fills them (formatter, cell).
    const fill = ext?.column;
    return fill ? out.map((c) => (c.fieldType ? fill(c, out) : c)) : out;
  });
  const byField = $derived(new Map(leaves.map((c) => [c.field as string, c])));
  const titleField = $derived((gallery.titleField as string | undefined) ?? (leaves[0]?.field as string | undefined));
  const coverField = $derived(gallery.coverField as string | undefined);
  const MAX_FIELDS = 6;
  const cardFields = $derived(
    (gallery.cardFields as ReadonlyArray<string> | undefined) ??
      leaves
        .map((c) => c.field as string)
        .filter((f) => f !== titleField && f !== coverField)
        .slice(0, MAX_FIELDS),
  );
  const SIZES = { small: 180, medium: 240, large: 320 } as const;
  const cardWidth = $derived(
    typeof gallery?.cardSize === "number" ? gallery.cardSize : SIZES[gallery?.cardSize ?? "medium"],
  );
  const showLabels = $derived(gallery.showLabels !== false);

  // ---- values ----
  const valueOf = (row: TData, field: string) => {
    const def = byField.get(field);
    return def?.fieldFn ? def.fieldFn(row) : (row as Record<string, unknown>)[field];
  };
  // `id`: the card's key, so a formatter gets the row as a grid cell hands it over.
  function text(row: TData, field: string, id = ""): string {
    const def = byField.get(field);
    const value = valueOf(row, field);
    if (typeof def?.formatter === "function") {
      return String(def.formatter({ value, row: { id, original: row }, column: { id: def.id ?? field, columnDef: def } }) ?? "");
    }
    if (def?.format) return formatValueForExport(value, def.format);
    if (value == null) return "";
    if (value instanceof Date) return value.toLocaleDateString();
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.map((v) => (v && typeof v === "object" ? (v.name ?? v.label ?? "") : String(v))).join(", ");
    return String(value);
  }
  const isBlank = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
  /** The column when a field type draws its own cell, else null. */
  function cellDef(field: string): Def | null {
    const def = byField.get(field);
    if (!def?.fieldType || def.cell != null || !ext?.cell || ext.hasCell?.(def) === false) return null;
    return def;
  }
  // What a field cell reads off the grid it is in (the grid itself when the
  // gallery hands it over); a card has a width of its own.
  // `gallery` is gone for a moment while the view switches away: cells still read it.
  const CARD_GRID = $derived(gallery?.cellGrid?.(cardWidth - 24) ?? { getColumnWidth: () => cardWidth - 24 });

  // ---- cover ----
  const IMAGE_URL = /^(https?:|blob:|data:image\/(png|jpeg|gif|webp|avif|svg\+xml);)/i;
  const isImageFile = (f: { type?: string; name?: string; url?: string }) =>
    (f.type ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(f.name ?? f.url ?? "");
  function coverUrl(row: TData): string | null {
    if (!coverField) return null;
    const v = valueOf(row, coverField) as unknown;
    const pick = (u: unknown) => (typeof u === "string" && IMAGE_URL.test(u.trim()) ? u.trim() : null);
    if (typeof v === "string") return pick(v);
    if (Array.isArray(v)) {
      for (const f of v) {
        if (typeof f === "string" && pick(f)) return pick(f);
        if (f && typeof f === "object" && isImageFile(f)) return pick(f.thumbnailUrl ?? f.url);
      }
      return null;
    }
    if (v && typeof v === "object") return pick((v as { url?: unknown }).url);
    return null;
  }

  // ---- identity + batches ----
  const keyOf = (row: TData, i: number) => (getRowId ? getRowId(row, i) : String(i));
  const BATCH = 120;
  let shownCount = $state(BATCH);
  const shown = $derived(data.slice(0, shownCount));
  // A new filter or search starts the wall from the top batch again.
  $effect(() => {
    void data;
    shownCount = BATCH;
  });
  function more(node: HTMLElement) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) shownCount += BATCH;
    }, { rootMargin: "400px" });
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }

  const open = (row: TData) => gallery.onCardClick?.(row);
  const fieldLabel = (field: string) => {
    const h = byField.get(field)?.header;
    return typeof h === "string" ? h : field;
  };
  const iconOf = (field: string) => {
    const def = byField.get(field);
    return def ? (ext?.headerIcon?.(def) ?? null) : null;
  };
</script>

<div class="sv-gal" style:--sv-gal-card={`${cardWidth}px`} role="list" aria-label="Records">
  {#each shown as row, i (keyOf(row, i))}
    {@const url = coverUrl(row)}
    {@const title = titleField ? text(row, titleField, keyOf(row, i)) : ""}
    {#if gallery.card}
      <div class="sv-gal-custom" role="listitem">
        {#if gallery.onCardClick}
          <!-- A drawn card is one button: a click or Enter opens it. -->
          <div
            class="sv-gal-custom-hit"
            role="button"
            tabindex="0"
            onclick={() => open(row)}
            onkeydown={(e) => {
              if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
              e.preventDefault()
              open(row)
            }}
          >{@render gallery.card(row)}</div>
        {:else}
          {@render gallery.card(row)}
        {/if}
      </div>
    {:else}
      <!-- The title is the card's button; a click anywhere else on the card does the same. -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="sv-gal-card" class:is-clickable={!!gallery.onCardClick} role="listitem" onclick={() => open(row)}>
        {#if coverField}
          <div class="sv-gal-cover" class:is-contain={gallery.coverFit === "contain"} class:is-empty={!url}>
            {#if url}<img src={url} alt="" loading="lazy" decoding="async" />{/if}
          </div>
        {/if}
        <div class="sv-gal-body">
          {#if gallery.onCardClick}
            <button
              type="button"
              class="sv-gal-title"
              onclick={(e) => {
                e.stopPropagation();
                open(row);
              }}>{title || "Untitled"}</button
            >
          {:else}
            <div class="sv-gal-title">{title || "Untitled"}</div>
          {/if}
          {#each cardFields as field (field)}
            {@const def = cellDef(field)}
            {@const value = valueOf(row, field)}
            {#if !isBlank(value)}
              <div class="sv-gal-field">
                {#if showLabels}
                  <div class="sv-gal-label">
                    {#if iconOf(field)}
                      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d={iconOf(field)} fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    {/if}
                    {fieldLabel(field)}
                  </div>
                {/if}
                <div class="sv-gal-value">
                  {#if def && ext?.cell}
                    {@const Cell = ext.cell}
                    <Cell ctrl={CARD_GRID} row={{ id: keyOf(row, i), original: row }} column={{ id: def.id ?? field, columnDef: def }} {value} />
                  {:else}
                    {text(row, field, keyOf(row, i))}
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  {:else}
    <p class="sv-gal-empty">{gallery.emptyText ?? "No records"}</p>
  {/each}
  {#if shownCount < data.length}
    <div class="sv-gal-more" use:more aria-hidden="true"></div>
  {/if}
</div>

<style>
  .sv-gal {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--sv-gal-card)), 1fr));
    grid-auto-rows: max-content;
    gap: 18px;
    padding: 18px;
    height: 100%;
    box-sizing: border-box;
    overflow: auto;
    align-content: start;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff));
    color: var(--sg-fg, #0f172a);
    font-family: var(--sg-font, inherit);
    font-size: 13px;
  }
  .sv-gal-card {
    min-width: 0;
    overflow: hidden;
    background: var(--sg-bg, #fff);
    border: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 9%, transparent);
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
  }
  .sv-gal-card.is-clickable { cursor: pointer; }
  .sv-gal-card.is-clickable:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--sg-fg, #0f172a) 14%, transparent);
    box-shadow: 0 2px 4px rgba(15, 23, 42, 0.06), 0 12px 28px -12px rgba(15, 23, 42, 0.32);
  }
  .sv-gal-card:has(.sv-gal-title:focus-visible) { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 2px; }
  .sv-gal-cover {
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, transparent);
  }
  .sv-gal-cover img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
  .sv-gal-cover.is-contain img { object-fit: contain; }
  .sv-gal-card.is-clickable:hover .sv-gal-cover img { transform: scale(1.04); }
  .sv-gal-body { padding: 12px 14px 14px; display: grid; gap: 9px; min-width: 0; }
  .sv-gal-title {
    padding: 0; border: 0; background: none; color: inherit; font: inherit; font-weight: 600; font-size: 14.5px; line-height: 1.3;
    letter-spacing: -0.005em; text-align: start; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: inherit; outline: none;
  }
  .sv-gal-field { min-width: 0; }
  .sv-gal-label {
    display: flex; align-items: center; gap: 4px; margin-bottom: 2px;
    font-size: 10.5px; font-weight: 500; letter-spacing: 0.03em; text-transform: uppercase; color: var(--sg-muted, #64748b);
  }
  .sv-gal-label svg { flex: none; }
  /* Values are read here, not edited: a click on one opens the card. */
  .sv-gal-value { min-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; }
  .sv-gal-custom { min-width: 0; }
  .sv-gal-custom-hit { cursor: pointer; border-radius: 12px; outline: none; }
  .sv-gal-custom-hit:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 2px; }
  .sv-gal-empty { grid-column: 1 / -1; color: var(--sg-muted, #64748b); margin: 8px 2px; }
  .sv-gal-more { grid-column: 1 / -1; height: 1px; }
  @media (prefers-reduced-motion: reduce) {
    .sv-gal-card, .sv-gal-cover img { transition: none; }
    .sv-gal-card.is-clickable:hover, .sv-gal-card.is-clickable:hover .sv-gal-cover img { transform: none; }
  }
</style>
