import { useState } from 'react'
import { Card } from '../../../components/ui/Card.tsx'
import { t, type MessageKey } from '../../../i18n/index.ts'
import type { Dictionary } from '../../dictionary/dictionary.ts'
import { getStudyItemId, type StudyItem } from '../../dictionary/studyItem.ts'
import { getMeaningLabel, getPinyinLabel, isCorrectOption } from '../choiceExercises.ts'
import type { ChoiceExercise, ChoiceExerciseType } from '../types.ts'
import { getOptionState, useChoiceShortcuts } from '../choiceState.ts'
import { AnswerFeedback, OptionButton } from './ChoiceParts.tsx'
import { PinyinText } from '../../dictionary/components/PinyinText.tsx'
import { ToneHanzi } from '../../dictionary/components/ToneHanzi.tsx'

const QUESTIONS: Record<ChoiceExerciseType, MessageKey> = {
  'meaning-choice': 'practice.choice.meaningQuestion',
  'pinyin-choice': 'practice.choice.pinyinQuestion',
  'hanzi-choice': 'practice.choice.hanziQuestion',
}

type ChoiceQuestionProps = {
  exercise: ChoiceExercise
  dictionary: Dictionary
  onAnswer: (correct: boolean) => void
  onLookUp: (item: StudyItem) => void
}

/**
 * Multiple-choice question. Picking an option grades it right away
 * (the correct one in green, the picked one in red if wrong) and shows the
 * full answer; "Continue" moves on to the next exercise.
 */
export function ChoiceQuestion({ exercise, dictionary, onAnswer, onLookUp }: ChoiceQuestionProps) {
  const [selected, setSelected] = useState<StudyItem>()
  const { type, item, options } = exercise
  const isAnswered = selected !== undefined
  const isCorrect = isAnswered && isCorrectOption(exercise, selected)
  const next = () => onAnswer(isCorrect)
  useChoiceShortcuts(options.length, isAnswered, (index) => setSelected(options[index]), next)

  return (
    <Card className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium tracking-wide text-ink-muted uppercase">
          {t(item.kind === 'character' ? 'practice.kind.character' : 'practice.kind.word')}
        </p>
        {type === 'hanzi-choice' ? (
          <p className="text-2xl font-medium">{getMeaningLabel(item)}</p>
        ) : (
          // If the question is about pronunciation, tone colors do not appear until answered
          <ToneHanzi
            entry={item.entry}
            showTones={isAnswered || type !== 'pinyin-choice'}
            className="text-7xl leading-tight sm:text-8xl"
          />
        )}
        <h2 className="text-lg text-ink-muted">{t(QUESTIONS[type])}</h2>
      </div>

      <ul aria-label={t('practice.choice.options')} className="grid gap-3 sm:grid-cols-2">
        {options.map((option, index) => (
          <li key={getStudyItemId(option)}>
            <OptionButton
              shortcut={String(index + 1)}
              state={getOptionState(isAnswered, isCorrectOption(exercise, option), option === selected)}
              disabled={isAnswered}
              onSelect={() => setSelected(option)}
            >
              {type === 'hanzi-choice' ? (
                <ToneHanzi entry={option.entry} className="text-3xl" />
              ) : (
                <span className="text-lg">
                  {type === 'pinyin-choice' ? <PinyinText pinyin={getPinyinLabel(option)} /> : getMeaningLabel(option)}
                </span>
              )}
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
