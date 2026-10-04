import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, saveSettings } from '../../settings/settings.ts'
import { memoryStorage } from '../../../test/memoryStorage.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { annotateSentence } from '../pinyinEngine.ts'
import { getDatasetReadings } from '../sentenceProcessing.ts'
import { createSentence } from '../sentences.ts'
import { SentenceView } from './SentenceView.tsx'

const now = new Date(2026, 8, 28)
const sentenceOf = (chinese: string) =>
  createSentence({ chinese, tokens: annotateSentence(chinese, getDatasetReadings) }, 'sentence-1', now)

function renderSentence(chinese: string, settings = DEFAULT_SETTINGS) {
  const storage = memoryStorage()
  saveSettings(settings, storage)
  const { container } = renderWithProviders(<SentenceView sentence={sentenceOf(chinese)} />, { storage })
  return container
}

describe('SentenceView', () => {
  it('colors each character by its tone and leaves punctuation uncolored', () => {
    const container = renderSentence('我每天学习中文。')

    const colored = [...container.querySelectorAll('[data-tone]')]
    expect(colored.map((span) => `${span.textContent}${span.getAttribute('data-tone')}`)).toEqual([
      '我3', '每3', '天1', '学2', '习2', '中1', '文2',
    ])
    expect(colored[0]).toHaveClass('text-tone-3')
    expect(screen.getByText('。', { selector: 'span' })).not.toHaveAttribute('data-tone')
    // The pinyin is colored like the characters
    expect(screen.getByText('wǒ')).toHaveClass('text-tone-3')
  })

  it('always shows the pinyin, also without colors', () => {
    const container = renderSentence('我在机场等你。', { ...DEFAULT_SETTINGS, toneColors: false })

    expect(container.querySelectorAll('[data-tone]')).toHaveLength(0)
    expect(screen.getByText('wǒ zài jī chǎng děng nǐ。')).toBeInTheDocument()
  })

  it('leaves uncertain characters without color, without a "?", and explains it', () => {
    const container = renderSentence('他长得很高。')

    expect([...container.querySelectorAll('[data-tone]')].map((span) => span.textContent)).toEqual(['他', '很', '高'])
    expect(screen.getAllByText('(uncertain)', { exact: false })).toHaveLength(2)
    expect(screen.getByText(/2 pronunciations couldn't be determined/)).toBeInTheDocument()
  })

  it('adds tone numbers if the user asks for them', () => {
    renderSentence('你好。', { ...DEFAULT_SETTINGS, toneNumbers: true })
    expect(screen.getByText('(ni3 hao3)')).toBeInTheDocument()
  })
})
