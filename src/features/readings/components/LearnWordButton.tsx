import { t } from '../../../i18n/index.ts'
import { useCustomSets } from '../../customSets/customSetsContext.ts'
import { getStudyItemId, type StudyItem } from '../../dictionary/studyItem.ts'
import { useMyStudies } from '../../myStudies/myStudiesContext.ts'
import { toSetMeaning, toSetSentence } from '../bookSet.ts'
import type { ReadingSentence, ReadingWord } from '../types.ts'

/**
 * "I don't know this word": adds it to the custom set of the book's HSK level
 * ("Book words · HSK 4", created the first time and added to My Studies),
 * with its meaning in the text as the set's note and the sentence as its
 * example. Pressed again, it takes the word out.
 */
export function LearnWordButton({
  entry,
  word,
  sentence,
  level,
}: {
  entry: StudyItem
  word: ReadingWord
  sentence: ReadingSentence
  level: number | undefined
}) {
  const customSets = useCustomSets()
  const { addSet } = useMyStudies()
  const name = level === undefined ? t('readings.bookSetNameNoLevel') : t('readings.bookSetName', { level })
  const set = customSets.customSets.find((custom) => custom.name === name)
  const itemId = getStudyItemId(entry)
  const inSet = set?.itemIds.includes(itemId) ?? false

  const add = () => {
    let setId = set?.id
    if (setId === undefined) {
      setId = customSets.createSet({ name, description: t('readings.bookSetDescription') }, [itemId])
      addSet(setId)
    } else customSets.addItem(setId, itemId)
    if (word.meaning) customSets.setMeaning(setId, itemId, toSetMeaning(word.meaning))
    const example = toSetSentence(sentence)
    if (example) customSets.addSentence(setId, { ...example, itemId })
  }

  return (
    <button
      type="button"
      aria-pressed={inSet}
      onClick={() => (inSet && set ? customSets.removeItem(set.id, itemId) : add())}
      className={`rounded-lg border px-3 py-1.5 font-medium ${
        inSet ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line hover:bg-paper'
      }`}
    >
      {inSet ? t('readings.inBookSet', { name }) : t('readings.learnWord', { name })}
    </button>
  )
}
