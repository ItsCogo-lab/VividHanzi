import { describe, expect, it } from 'vitest'
import type { CustomSet } from '../customSets/types.ts'
import type { ItemProgress } from '../progress/types.ts'
import { mergeCustomSets, mergeMyStudies, mergeProgress } from './merge.ts'

function item(itemId: ItemProgress['itemId'], lastReviewedAt: string, timesSeen = 1): ItemProgress {
  return {
    itemId,
    timesSeen,
    timesCorrect: timesSeen,
    timesWrong: 0,
    masteryLevel: 1,
    lastReviewedAt,
    nextReviewAt: lastReviewedAt,
  }
}

function customSet(id: string, updatedAt: string, name = id): CustomSet {
  return { id, name, description: '', itemIds: [], meanings: {}, sentences: [], createdAt: updatedAt, updatedAt }
}

describe('mergeProgress', () => {
  it('keeps items that exist on only one side', () => {
    const merged = mergeProgress(
      { excluded: {}, items: { 'char:你': item('char:你', '2026-09-28T10:00:00.000Z') }, writing: {}, activity: {} },
      { excluded: {}, items: { 'char:好': item('char:好', '2026-09-27T10:00:00.000Z') }, writing: {}, activity: {} },
    )
    expect(Object.keys(merged.items).toSorted()).toEqual(['char:你', 'char:好'])
  })

  it('for an item on both sides, keeps the one reviewed later', () => {
    const older = item('char:你', '2026-09-28T10:00:00.000Z', 5)
    const newer = item('char:你', '2026-09-29T10:00:00.000Z', 2)
    expect(mergeProgress({ excluded: {}, items: { 'char:你': older }, writing: {}, activity: {} }, { excluded: {}, items: { 'char:你': newer }, writing: {}, activity: {} }).items['char:你']).toBe(newer)
    expect(mergeProgress({ excluded: {}, items: { 'char:你': newer }, writing: {}, activity: {} }, { excluded: {}, items: { 'char:你': older }, writing: {}, activity: {} }).items['char:你']).toBe(newer)
  })

  it('on the same review time, keeps the one seen more times', () => {
    const date = '2026-09-28T10:00:00.000Z'
    const more = item('char:你', date, 4)
    expect(mergeProgress({ excluded: {}, items: { 'char:你': item('char:你', date, 1) }, writing: {}, activity: {} }, { excluded: {}, items: { 'char:你': more }, writing: {}, activity: {} }).items['char:你']).toBe(more)
  })

  it('merges writing progress the same way, apart from recognition', () => {
    const older = item('char:你', '2026-09-28T10:00:00.000Z')
    const newer = item('char:你', '2026-09-29T10:00:00.000Z')
    const merged = mergeProgress(
      { excluded: {}, items: {}, writing: { 'char:你': newer }, activity: {} },
      { excluded: {}, items: { 'char:你': older }, writing: { 'char:你': older, 'char:好': older }, activity: {} },
    )
    expect(merged.writing['char:你']).toBe(newer)
    expect(Object.keys(merged.writing).toSorted()).toEqual(['char:你', 'char:好'])
    expect(merged.items['char:你']).toBe(older)
  })

  it("for a word excluded or brought back on both sides, keeps the latest choice", () => {
    const excludedMonday = { excluded: true, changedAt: '2026-09-28T10:00:00.000Z' }
    const undoneTuesday = { excluded: false, changedAt: '2026-09-29T10:00:00.000Z' }
    const local = { items: {}, writing: {}, activity: {}, excluded: { 'word:你': undoneTuesday, 'word:好': excludedMonday } }
    const remote = { items: {}, writing: {}, activity: {}, excluded: { 'word:你': excludedMonday } }

    expect(mergeProgress(local, remote).excluded).toEqual({ 'word:你': undoneTuesday, 'word:好': excludedMonday })
    expect(mergeProgress(remote, local).excluded).toEqual({ 'word:你': undoneTuesday, 'word:好': excludedMonday })
  })

  it('keeps the day record with more answers instead of adding them up', () => {
    const merged = mergeProgress(
      { excluded: {}, items: {}, writing: {}, activity: { '2026-09-28': { answers: 10, correct: 8 }, '2026-09-29': { answers: 2, correct: 1 } } },
      { excluded: {}, items: {}, writing: {}, activity: { '2026-09-28': { answers: 4, correct: 4 }, '2026-09-27': { answers: 3, correct: 3 } } },
    )
    expect(merged.activity).toEqual({
      '2026-09-27': { answers: 3, correct: 3 },
      '2026-09-28': { answers: 10, correct: 8 },
      '2026-09-29': { answers: 2, correct: 1 },
    })
  })
})

describe('mergeMyStudies', () => {
  it('joins sets without duplicates and keeps the latest session date', () => {
    const merged = mergeMyStudies(
      {
        sets: [{ setId: 'hsk-1', addedAt: '2026-09-28T00:00:00.000Z' }],
        lastStudied: { 'hsk-1': '2026-09-29T00:00:00.000Z' },
      },
      {
        sets: [
          { setId: 'hsk-1', addedAt: '2026-09-20T00:00:00.000Z' },
          { setId: 'food', addedAt: '2026-09-21T00:00:00.000Z' },
        ],
        lastStudied: { 'hsk-1': '2026-09-25T00:00:00.000Z', food: '2026-09-26T00:00:00.000Z' },
      },
    )
    expect(merged).toEqual({
      sets: [
        { setId: 'hsk-1', addedAt: '2026-09-20T00:00:00.000Z' },
        { setId: 'food', addedAt: '2026-09-21T00:00:00.000Z' },
      ],
      lastStudied: { 'hsk-1': '2026-09-29T00:00:00.000Z', food: '2026-09-26T00:00:00.000Z' },
    })
  })
})

describe('mergeCustomSets', () => {
  it('joins sets and, for one on both sides, keeps the one edited later', () => {
    const merged = mergeCustomSets(
      [customSet('custom-a', '2026-09-28T00:00:00.000Z', 'Old name'), customSet('custom-b', '2026-09-28T00:00:00.000Z')],
      [customSet('custom-a', '2026-09-29T00:00:00.000Z', 'New name'), customSet('custom-c', '2026-09-29T00:00:00.000Z')],
    )
    expect(merged.map((set) => [set.id, set.name])).toEqual([
      ['custom-a', 'New name'],
      ['custom-b', 'custom-b'],
      ['custom-c', 'custom-c'],
    ])
  })
})
