<!--
  title: Movie ratings
  author: SvGrid team
  github: sv-grid
  tags: sorting, custom cells, chips
  discussion: 0
-->
<script lang="ts">
  /**
   * A film table with a star-rating cell, genre chips, release year, and box
   * office in currency. Click any header to sort. Self-contained - inline data,
   * only @svgrid/grid.
   */
  import { SvGrid, renderSnippet, tableFeatures, rowSortingFeature, type ColumnDef } from '@svgrid/grid'

  type Movie = { id: number; title: string; year: number; genres: string[]; rating: number; gross: number }

  const features = tableFeatures({ rowSortingFeature })

  const rows: Movie[] = [
    { id: 1, title: 'Interstellar',       year: 2014, genres: ['Sci-Fi', 'Drama'],       rating: 4.5, gross: 731_000_000 },
    { id: 2, title: 'The Grand Budapest',  year: 2014, genres: ['Comedy'],                rating: 4.0, gross: 173_000_000 },
    { id: 3, title: 'Mad Max: Fury Road',  year: 2015, genres: ['Action', 'Sci-Fi'],      rating: 4.5, gross: 375_000_000 },
    { id: 4, title: 'Parasite',            year: 2019, genres: ['Thriller', 'Drama'],      rating: 5.0, gross: 258_000_000 },
    { id: 5, title: 'Dune',                year: 2021, genres: ['Sci-Fi'],                 rating: 4.0, gross: 402_000_000 },
    { id: 6, title: 'Everything Everywhere', year: 2022, genres: ['Comedy', 'Sci-Fi'],    rating: 4.5, gross: 143_000_000 },
    { id: 7, title: 'Oppenheimer',         year: 2023, genres: ['Drama'],                 rating: 4.5, gross: 976_000_000 },
    { id: 8, title: 'Past Lives',          year: 2023, genres: ['Drama'],                 rating: 4.0, gross: 42_000_000 },
  ]

  const columns: ColumnDef<typeof features, Movie>[] = [
    { field: 'title', header: 'Title', width: 210 },
    { field: 'year', header: 'Year', width: 90, align: 'right' },
    { id: 'genres', header: 'Genres', field: 'genres', width: 200, cell: (ctx) => renderSnippet(Genres, { row: ctx.row.original }) },
    { field: 'rating', header: 'Rating', width: 140, cell: (ctx) => renderSnippet(Stars, { v: Number(ctx.getValue()) }) },
    { field: 'gross', header: 'Box office', width: 150, align: 'right', format: { type: 'currency', currency: 'USD', options: { notation: 'compact', maximumFractionDigits: 0 } } },
  ]
</script>

{#snippet Genres(p: { row: Movie })}
  <span class="genres">{#each p.row.genres as g (g)}<span class="genre">{g}</span>{/each}</span>
{/snippet}

{#snippet Stars(p: { v: number })}
  <span class="stars" title={`${p.v} / 5`}>
    {#each [1, 2, 3, 4, 5] as s (s)}<span class="star {s <= p.v ? 'on' : ''}">★</span>{/each}
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm shrink-0" style="color: var(--sg-muted)">Click a header to sort. A community-contributed demo.</div>
  <div class="flex-1 min-h-0">
    <SvGrid data={rows} columns={columns} features={features} showRowNumbers={false} rowHeight={40} containerHeight="100%" fitColumns={true} />
  </div>
</section>

<style>
  .genres { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .genre { padding: 1px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 600; background: color-mix(in oklab, var(--sg-accent, #6366f1) 14%, transparent); color: var(--sg-accent, #4f46e5); }
  .stars { display: inline-flex; gap: 1px; font-size: 14px; letter-spacing: 1px; }
  .star { color: color-mix(in oklab, var(--sg-muted) 40%, transparent); }
  .star.on { color: #f59e0b; }
</style>
