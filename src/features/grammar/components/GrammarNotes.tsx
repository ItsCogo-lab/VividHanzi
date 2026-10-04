import { HanziText } from '../../../components/ui/HanziText.tsx'
import { t } from '../../../i18n/index.ts'
import { UncertainNote } from '../../customSets/components/SentenceView.tsx'
import { ExampleText } from '../../dictionary/components/ExampleSentences.tsx'
import { useUncertainCounts } from '../../dictionary/useUncertainCounts.ts'
import { tatoebaSentenceUrl } from '../../dictionary/examples.ts'
import type { EntryOpener } from '../../dictionary/components/EntryLink.tsx'
import type { StudyItem } from '../../dictionary/studyItem.ts'
import { getGrammarPoints } from '../grammar.ts'
import type { GrammarPoint } from '../types.ts'

/**
 * Grammar notes for a function word (的, 了, 被, 虽然...). If the entry isn't one of
 * them, nothing is shown. Each note links to its Chinese Grammar Wiki page
 * and each sentence, to Tatoeba. Pronunciations that couldn't be determined
 * are counted in one note at the end.
 */
export function GrammarNotes({ item, opener }: { item: StudyItem; opener: EntryOpener }) {
  const points = getGrammarPoints(item)
  const uncertain = useUncertainCounts()
  if (points.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t('grammar.title')}</h2>
      <ul className="flex flex-col gap-4">
        {points.map((point) => (
          <li key={point.id}>
            <GrammarCard point={point} opener={opener} onUncertain={uncertain.report} />
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <UncertainNote
          count={uncertain.total(points.flatMap((point) => point.examples.map((example) => exampleKey(point, example.tatoebaId))))}
        />
      </div>
      <p className="mt-3 text-sm text-ink-muted">{t('grammar.credits')}</p>
    </section>
  )
}

/** One use of the word: header, pattern, explanation, examples and link. */
function GrammarCard({
  point,
  opener,
  onUncertain,
}: {
  point: GrammarPoint
  opener: EntryOpener
  onUncertain: (key: string, count: number) => void
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-accent/30 border-l-4 border-l-accent bg-accent-soft">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 min-w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-accent px-2 text-on-accent shadow-sm"
          >
            <HanziText className={`leading-none ${point.word.length > 1 ? 'text-lg' : 'text-2xl'}`}>{point.word}</HanziText>
            <span className="text-xs leading-tight">{point.pinyin}</span>
          </span>
          <h3 className="text-lg leading-snug font-semibold text-accent-strong">{point.title}</h3>
        </div>
        <Pattern point={point} />
        <p className="leading-relaxed">{point.explanation}</p>
      </div>

      <ul className="divide-y divide-line border-t border-accent/20 bg-surface">
        {point.examples.map((example) => (
          <li key={example.tatoebaId} className="px-4 py-3">
            <ExampleText
              chinese={example.zh}
              opener={opener}
              onUncertain={(count) => onUncertain(exampleKey(point, example.tatoebaId), count)}
            />
            <p>{example.en}</p>
            <p className="text-sm text-ink-muted">
              <a
                href={tatoebaSentenceUrl(example.tatoebaId)}
                className="underline underline-offset-2 hover:text-accent-strong"
              >
                {t('dictionary.exampleAttribution', { id: example.tatoebaId, author: example.author })}
              </a>
            </p>
          </li>
        ))}
      </ul>

      <p className="border-t border-line bg-surface px-4 py-3 text-sm">
        {t('grammar.learnMore')}{' '}
        <a href={point.reference.url} className="font-medium text-accent-strong underline underline-offset-2">
          {point.reference.title}
        </a>
      </p>
    </article>
  )
}

function exampleKey(point: GrammarPoint, tatoebaId: number): string {
  return `${point.id}-${tatoebaId}`
}

const HAN = /\p{Script=Han}/u

/**
 * The pattern as a formula: "Verb + 了 + Object" is shown as pieces
 * separated by "+", with the Chinese pieces (the words the point is about)
 * highlighted.
 */
function Pattern({ point }: { point: GrammarPoint }) {
  const parts = point.pattern.split(' + ')
  return (
    <p className="flex flex-wrap items-center gap-1.5">
      <span className="sr-only">{point.pattern}</span>
      {parts.map((part, index) => (
        <span key={`${index}-${part}`} className="flex items-center gap-1.5" aria-hidden="true">
          {index > 0 && <span className="font-semibold text-accent">+</span>}
          <HanziText
            className={
              HAN.test(part)
                ? 'rounded-lg bg-accent px-2.5 py-1 font-semibold text-on-accent'
                : 'rounded-lg border border-accent/30 bg-surface px-2.5 py-1 text-ink'
            }
          >
            {part}
          </HanziText>
        </span>
      ))}
    </p>
  )
}
