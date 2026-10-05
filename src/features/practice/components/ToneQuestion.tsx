import { useState } from 'react'
import { Card } from '../../../components/ui/Card.tsx'
import { t } from '../../../i18n/index.ts'
import type { Dictionary } from '../../dictionary/dictionary.ts'
import type { StudyItem } from '../../dictionary/studyItem.ts'
import { PinyinText } from '../../dictionary/components/PinyinText.tsx'
import { ToneHanzi } from '../../dictionary/components/ToneHanzi.tsx'
import { getTonelessReading } from '../toneExercises.ts'
import type { ToneExercise } from '../types.ts'
import { getOptionState, useChoiceShortcuts } from '../choiceState.ts'
import { AnswerFeedback, OptionButton } from './ChoiceParts.tsx'

type ToneQuestionProps = {
  exercise: ToneExercise
  dictionary: Dictionary
  onAnswer: (correct: boolean) => void
  onLookUp: (item: StudyItem) => void
}

/**
 * Tone question: the hanzi and its pinyin without marks ("ni hao"), and four
 * spellings that differ only in tones. Works like ChoiceQuestion.
 */
export function ToneQuestion({ exercise, dictionary, onAnswer, onLookUp }: ToneQuestionProps) {
  const [selected, setSelected] = useState<string>()
  const { item, options, answer } = exercise
  const isAnswered = selected !== undefined
  const isCorrect = selected === answer
  const next = () => onAnswer(isCorrect)
  useChoiceShortcuts(options.length, isAnswered, (index) => setSelected(options[index]), next)

  return (
    <Card className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium tracking-wide text-ink-muted uppercase">
          {t(item.kind === 'character' ? 'practice.kind.character' : 'practice.kind.word')}
        </p>
        {/* Tone colors would give the answer away until it is picked */}
        <ToneHanzi entry={item.entry} showTones={isAnswered} className="text-7xl leading-tight sm:text-8xl" />
        <p className="text-2xl text-ink-muted">{getTonelessReading(item)}</p>
        <h2 className="text-lg text-ink-muted">{t('practice.choice.toneQuestion')}</h2>
      </div>

      <ul aria-label={t('practice.choice.options')} className="grid gap-3 sm:grid-cols-2">
        {options.map((option, index) => (
          <li key={option}>
            <OptionButton
              shortcut={String(index + 1)}
              state={getOptionState(isAnswered, option === answer, option === selected)}
              disabled={isAnswered}
              onSelect={() => setSelected(option)}
            >
              <PinyinText pinyin={option} className="text-xl" />
            </OptionButton>
          </li>
        ))}
      </ul>

      {isAnswered && (
        <AnswerFeedback item={item} isCorrect={isCorrect} dictionary={dictionary} onLookUp={onLookUp} onContinue={next} />
      )}
    </Card>
  )
}
