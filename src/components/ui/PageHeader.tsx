import type { ReactNode } from 'react'
import { t } from '../../i18n/index.ts'

type PageHeaderProps = {
  title: string
  /** Language of the title if it differs from the UI's, e.g. "zh-Hans" for a hanzi. */
  titleLang?: string
  description?: string
  /** Optional actions to the right of the title (e.g. a button). */
  actions?: ReactNode
  /** Tab title, when it should say more than the heading. Defaults to "title · VividHanzi". */
  documentTitle?: string
}

export function PageHeader({ title, titleLang, description, actions, documentTitle }: PageHeaderProps) {
  return (
    <header className="mb-4 flex flex-col gap-3 sm:mb-8 sm:gap-4 sm:flex-row sm:items-end sm:justify-between">
      {/* React 19 hoists this <title> into the <head>: each page gets its own tab title */}
      <title>{documentTitle ?? `${title} · ${t('app.name')}`}</title>
      <div>
        <h1 lang={titleLang} className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-ink-muted sm:text-base">{description}</p>}
      </div>
      {actions}
    </header>
  )
}
