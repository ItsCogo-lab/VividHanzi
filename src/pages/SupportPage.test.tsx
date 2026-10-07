import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { SupportPage } from './SupportPage.tsx'

describe('SupportPage', () => {
  it('embeds the Ko-fi panel and links to Ko-fi in a new tab', () => {
    renderWithProviders(<SupportPage />)

    expect(screen.getByTitle('Ko-fi donation panel')).toHaveAttribute(
      'src',
      'https://ko-fi.com/cogo8/?hidefeed=true&widget=true&embed=true&preview=true',
    )
    const link = screen.getByRole('link', { name: /Open Ko-fi/ })
    expect(link).toHaveAttribute('href', 'https://ko-fi.com/cogo8')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
