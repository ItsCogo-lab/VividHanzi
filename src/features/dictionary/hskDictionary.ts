import { allCharacters, allWords } from '../../data/index.ts'
import { createDictionary } from './dictionary.ts'
import { createWordList } from './exampleChoice.ts'
import { listStudyItems } from './studyItem.ts'

/** The app's dictionary, built once from the whole dataset. */
export const hskDictionary = createDictionary(allCharacters, allWords)

/** All characters and words in the dataset as study items. */
export const hskStudyItems = listStudyItems(hskDictionary)

/**
 * What the app teaches: the dataset's words. Characters are learned through
 * them (each word's card breaks it down, and the dictionary has every
 * character), so they are not studied as cards of their own.
 */
export const hskWordItems = hskStudyItems.filter((item) => item.kind === 'word')

/** The dataset's characters, for the "characters learned" statistics (see summarizeCharacters). */
export const hskCharacterItems = hskStudyItems.filter((item) => item.kind === 'character')

/** The dataset's words, to tell whether a word stands on its own in an example sentence (see exampleChoice.ts). */
export const hskWordList = createWordList(allWords.map((word) => word.hanzi))
