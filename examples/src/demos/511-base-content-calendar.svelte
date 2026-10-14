<script lang="ts">
  /**
   * 511. SvGrid Base: content calendar
   * ----------------------------------
   * An editorial team's content calendar as a ready-to-use base with two
   * tables. Posts have a stage, channels, an author, a publish date, a cover,
   * a brief and the campaign they belong to; Campaigns list their posts and
   * add up the words written for them.
   *
   * The Posts views: the planning grid (colored by stage, in publishing
   * order), the pipeline as a Kanban, the publishing calendar, a wall of
   * covers, and the form a writer uses to pitch an idea.
   *
   * Everything is <SvBase>: drag a card to move a post along, pick a day on
   * the calendar to schedule one, Space on a row to open it with its comments.
   */
  import { SvBase, enableBase, type Attachment, type BaseTable } from '@svgrid/enterprise/base'
  import { editorialArt } from '../shared/gallery-art'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  type Post = {
    id: number
    title: string
    stage: string
    channels: string[]
    author: string
    publish: string
    cover: Attachment[]
    words: number
    brief: string
    link: string
    campaign: string[]
  }

  const STAGES = [
    { value: 'Idea', color: '#94a3b8' },
    { value: 'Drafting', color: '#2d7ff9' },
    { value: 'In review', color: '#fcb400' },
    { value: 'Scheduled', color: '#8b46ff' },
    { value: 'Published', color: '#20c933' },
  ]
  const CHANNELS = [
    { value: 'Blog', color: '#2d7ff9' },
    { value: 'Newsletter', color: '#ff6f2c' },
    { value: 'LinkedIn', color: '#18bfff' },
    { value: 'YouTube', color: '#f82b60' },
    { value: 'Podcast', color: '#8b46ff' },
  ]
  const TITLES = [
    'Why we rebuilt our onboarding',
    'Ten keyboard shortcuts power users love',
    'Customer story: a logistics team at scale',
    'The state of remote teams in 2026',
    'Behind the scenes: our design review',
    'A field guide to quarterly planning',
    'Podcast: shipping weekly without burnout',
    'How to write a product brief people read',
    'Year in review: what our customers built',
    'The case for fewer meetings',
    'Five templates for running a launch',
    'Interview: the people behind support',
    'Our new pricing, explained',
    'What we learned from 1,000 user calls',
    'Newsletter: October roundup',
    'Video: building a dashboard in ten minutes',
    'Hiring for curiosity',
    'A short history of the spreadsheet',
  ]
  const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10)
  let nextId = TITLES.length + 1
  const CAMPAIGNS = [
    ['Fall launch', 'Sign-ups from the new onboarding', 'u1', 0, 20],
    ['Customer stories', 'Three case studies in sales decks', 'u5', 5, 34],
    ['Hiring push', 'Twelve engineering applicants a week', 'u6', 10, 30],
  ] as const
  const posts: Post[] = TITLES.map((title, i) => ({
    id: i + 1,
    title,
    stage: STAGES[[4, 4, 3, 3, 2, 2, 1, 1, 1, 0, 0, 3, 2, 4, 3, 1, 0, 2][i]!]!.value,
    channels: [CHANNELS[i % 5]!.value, ...(i % 3 === 0 ? [CHANNELS[(i + 2) % 5]!.value] : [])],
    author: ['u1', 'u3', 'u5', 'u6', 'u2', 'u8'][i % 6]!,
    publish: day((i * 5) % 34),
    cover: [{ id: `cover-${i}`, name: `cover-${i + 1}.svg`, type: 'image/svg+xml', url: editorialArt(i + 1) }],
    words: 600 + ((i * 377) % 1900),
    brief: 'Audience: team leads. Angle: one concrete practice and the numbers behind it.',
    link: i % 4 === 0 ? `https://example.com/blog/post-${i + 1}` : '',
    campaign: [`k${(i % 3) + 1}`],
  }))
  const campaigns = CAMPAIGNS.map(([name, goal, owner, from, to], i) => ({
    id: `k${i + 1}`,
    name,
    goal,
    owner,
    starts: day(from),
    ends: day(to),
    posts: posts.filter((p) => p.campaign[0] === `k${i + 1}`).map((p) => String(p.id)),
  }))

  const postColumns: any[] = [
    { field: 'title', header: 'Title', width: 300, fieldType: 'text' },
    { field: 'stage', header: 'Stage', width: 130, fieldType: 'singleSelect', fieldProps: { options: STAGES } },
    { field: 'channels', header: 'Channels', width: 200, fieldType: 'multiSelect', fieldProps: { options: CHANNELS } },
    { field: 'author', header: 'Author', width: 160, fieldType: 'user' },
    { field: 'campaign', header: 'Campaign', width: 170, fieldType: 'link', fieldProps: { table: 'content-campaigns', multiple: false, inverse: 'posts' } },
    { field: 'publish', header: 'Publish date', width: 160, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
    { field: 'cover', header: 'Cover', width: 120, fieldType: 'attachment' },
    { field: 'words', header: 'Words', width: 100, fieldType: 'number', fieldProps: { format: 'integer', summary: 'sum' } },
    { field: 'brief', header: 'Brief', width: 260, fieldType: 'longText' },
    { field: 'link', header: 'Link', width: 220, fieldType: 'url' },
  ]

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'content-posts',
      name: 'Posts',
      primaryField: 'title',
      data: posts,
      columns: postColumns,
      views: [
        { id: 'plan', name: 'Content plan', type: 'grid', color: { mode: 'field', field: 'stage' }, state: { sorting: [{ id: 'publish', desc: false }] } },
        { id: 'pipeline', name: 'Pipeline', type: 'kanban', stackBy: 'stage' },
        { id: 'calendar', name: 'Publishing calendar', type: 'calendar', dateField: 'publish', color: { mode: 'field', field: 'stage' } },
        { id: 'covers', name: 'Covers', type: 'gallery', coverField: 'cover' },
        { id: 'pitch', name: 'Pitch an idea', type: 'form', formFields: ['title', 'channels', 'author', 'campaign', 'brief'], formDescription: 'Tell the editors what you want to write. They pick it up in Monday planning.' },
      ],
      props: { rowAdder: { label: 'Add post', defaults: () => ({ id: nextId++, title: '', stage: 'Idea', channels: [], cover: [] }) } },
    },
    {
      id: 'content-campaigns',
      name: 'Campaigns',
      primaryField: 'name',
      data: campaigns,
      columns: [
        { field: 'name', header: 'Campaign', width: 200, fieldType: 'text' },
        { field: 'goal', header: 'Goal', width: 280, fieldType: 'text' },
        { field: 'owner', header: 'Owner', width: 160, fieldType: 'user' },
        { field: 'starts', header: 'Starts', width: 160, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'ends', header: 'Ends', width: 160, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'posts', header: 'Posts', width: 320, fieldType: 'link', fieldProps: { table: 'content-posts', multiple: true, inverse: 'campaign' } },
        { field: 'words', header: 'Words', width: 110, fieldType: 'rollup', fieldProps: { linkField: 'posts', field: 'words', aggregation: 'SUM' } },
      ],
      views: [
        { id: 'campaigns', name: 'All campaigns', type: 'grid' },
        { id: 'when', name: 'Campaign calendar', type: 'calendar', dateField: 'starts', endField: 'ends' },
      ],
      props: { rowAdder: { label: 'Add campaign' } },
    },
  ])
</script>

<section class="base-demo">
  <SvBase
    bind:tables
    editable
    sortable
    showRowNumbers
    expandRows
    pinSplitter
    summary
    rowNumberWidth={64}
    showRowSelection={false}
    rowHeight={44}
    containerHeight="100%"
    selectionBar={['selectAll', 'editFields', 'deleteRows']}
    columnAdder
    fieldMenu
  />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; }
</style>
