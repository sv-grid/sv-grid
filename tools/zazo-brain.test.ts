import { describe, expect, it } from 'vitest'
import { matchFaq, searchTerms, understand } from '../examples/src/zazo/zazo-brain'

describe('Zazo understands', () => {
  it.each([
    ['hi', 'greet'],
    ['Hello Zazo!', 'greet'],
    ['thanks a lot', 'thanks'],
    ['bye', 'bye'],
    ['who are you?', 'who'],
    ['what does this demo show?', 'about'],
    ['explain this one', 'about'],
    ['How do I install it?', 'start'],
    ['how do I add it to my app', 'start'],
    ['show me the code', 'code'],
    ['is it free?', 'license'],
    ['how much does enterprise cost', 'license'],
  ])('%s -> %s', (text, kind) => {
    expect(understand(text).kind).toBe(kind)
  })

  it('opens the best match when asked to open or show something', () => {
    expect(understand('open the pivot demo')).toEqual({ kind: 'open', query: 'pivot' })
    expect(understand('show me tree data')).toEqual({ kind: 'open', query: 'tree data' })
  })

  it('treats anything else as a search for its topic words', () => {
    expect(understand('I need a grid with inline editing')).toEqual({ kind: 'search', query: 'grid inline editing' })
    expect(understand('export to excel')).toEqual({ kind: 'search', query: 'export excel' })
  })

  it('a greeting inside a longer question is still a question', () => {
    expect(understand('hi, do you have a gantt chart')).toEqual({ kind: 'search', query: 'gantt chart' })
  })
})

describe('matchFaq', () => {
  // The FAQ of demo 08 (examples/src/demos/meta/08-tree-and-master-detail.json).
  const faq = [
    { question: 'How is the file tree flattened?', answer: 'A recursive walk...' },
    { question: 'How does the detail grid follow the selection?', answer: 'The master grid reports...' },
    { question: 'Can the detail be inside the master row instead?', answer: 'Yes. The isDetailRow...' },
  ]
  it('finds the entry a question is about, in other words', () => {
    expect(matchFaq('how do you flatten the tree?', faq)?.answer).toBe('A recursive walk...')
    expect(matchFaq('does the detail follow the selected row', faq)?.answer).toBe('The master grid reports...')
    expect(matchFaq('can I put the detail inside the master row?', faq)?.answer).toBe('Yes. The isDetailRow...')
  })
  it('leaves questions about something else to the search', () => {
    expect(matchFaq('export to excel', faq)).toBeNull()
    expect(matchFaq('grid', faq)).toBeNull()
    expect(matchFaq('how do I sort the tree by size', faq)).toBeNull()
  })
})

describe('searchTerms', () => {
  it('drops the request words and keeps the topic', () => {
    expect(searchTerms('Can you find me a demo with grouping?')).toBe('grouping')
  })
  it('"grid" or "table" alone is no topic in a grid gallery', () => {
    expect(searchTerms('show me a grid')).toBe('')
    expect(searchTerms('a tree grid')).toBe('tree grid')
  })
})
