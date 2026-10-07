import type { GrammarPoint } from '../features/grammar/types.ts'

/**
 * Grammar notes for the most common HSK 1-4 function words: particles
 * (的, 了...), prepositions (被, 把, 比, 在...) and conjunctions (虽然, 因为...).
 *
 * CURATED BY HAND, like topics.ts. Criteria (docs/DATA_SOURCES.md, "Grammar
 * notes"):
 *
 * - The usages and their levels follow AllSet Learning's Chinese Grammar Wiki,
 *   but the explanations are our own: the wiki is CC BY-NC-SA 3.0 (non-
 *   commercial), so neither its text nor its sentences are copied. Each point
 *   links to its page.
 * - The examples are Tatoeba sentences (CC BY 2.0 FR) already in
 *   public/examples/, copied as is with their id and author. A test
 *   checks that they exist and contain the word (or one in alsoShownOn).
 * - If there are no Tatoeba sentences for a usage, that usage is left out (which
 *   is why the ongoing-action 呢 is missing).
 *
 * Adding a point = adding an object to this list.
 */
const WIKI = 'https://resources.allsetlearning.com/chinese/grammar/'

export const grammarPoints: readonly GrammarPoint[] = [
  {
    id: 'de-possession',
    word: '的',
    pinyin: 'de',
    title: 'Possession with 的',
    pattern: 'Noun / Pronoun + 的 + Noun',
    explanation:
      'Put 的 between an owner and what they own, like English "\'s" or "of". If it is clear what you mean, the second noun can be left out: 谁的 means "whose (one)". With close people and groups, like family, 的 is often dropped: 我妈妈.',
    examples: [
      { tatoebaId: 2346872, zh: '这是我的电脑。', en: 'This is my computer.', author: 'everylanguage' },
      { tatoebaId: 330581, zh: '这是我的妈妈。', en: 'This is my mother.', author: 'vermouthmjl' },
      { tatoebaId: 360560, zh: '这把伞是谁的？', en: 'Whose umbrella is this?', author: 'sysko' },
    ],
    reference: { title: 'Expressing possession with "de"', url: `${WIKI}ASGUHQD2` },
  },
  {
    id: 'de-modifier',
    word: '的',
    pinyin: 'de',
    title: 'Describing nouns with 的',
    pattern: 'Adjective / Phrase + 的 + Noun',
    explanation:
      'In Chinese, everything that describes a noun comes before it, joined with 的: an adjective, a phrase or even a whole clause. Short one-syllable adjectives often skip it (好人), but longer descriptions need it. As with possession, the noun can be left out: 新的 is "the new one".',
    examples: [
      { tatoebaId: 2779412, zh: '这些是很旧的书。', en: 'These are very old books.', author: 'GlossaMatik' },
      { tatoebaId: 782250, zh: '这是一本关于星星的书。', en: 'This is a book about stars.', author: 'fucongcong' },
      { tatoebaId: 822110, zh: '这是新的。', en: 'This is new.', author: 'U2FS' },
    ],
    reference: { title: 'Modifying nouns with adjective + "de"', url: `${WIKI}ASGVUFKX` },
  },
  {
    id: 'le-completion',
    word: '了',
    pinyin: 'le',
    title: 'Completed actions with 了',
    pattern: 'Verb + 了 + (Quantity) + Object',
    explanation:
      '了 right after a verb says the action is done. It marks completion, not past tense, so it is not used for every past event. When the object has a number or a length of time, 了 goes right after the verb. To say something did not happen, use 没 before the verb and drop 了.',
    examples: [
      { tatoebaId: 817296, zh: '我买了两条裤子。', en: 'I bought two pairs of trousers.', author: 'fucongcong' },
      { tatoebaId: 784523, zh: '他学了两个小时。', en: 'He has been studying for two hours.', author: 'fucongcong' },
      { tatoebaId: 9007523, zh: '她睡了几小时。', en: 'She slept for a few hours.', author: 'jacintoo' },
    ],
    reference: { title: 'Expressing completion with "le"', url: `${WIKI}ASGAGDCQ` },
  },
  {
    id: 'le-change',
    word: '了',
    pinyin: 'le',
    title: 'Change of state with 了',
    pattern: 'Statement + 了',
    explanation:
      'At the end of a sentence, 了 says that a situation is new: something is true now that was not true before. 下雨了 is "it has started raining", not just "it rains". It works with adjectives, ages and times too.',
    examples: [
      { tatoebaId: 346836, zh: '下雨了。', en: 'It is raining.', author: 'fucongcong' },
      { tatoebaId: 841845, zh: '天气冷了。', en: 'The weather is cold now.', author: 'eastasiastudent' },
      { tatoebaId: 2292923, zh: '我二十五岁了。', en: "I'm 25 years old.", author: 'Vortarulo' },
    ],
    reference: { title: 'Change of state with "le"', url: `${WIKI}ASGT185D` },
  },
  {
    id: 'ma-questions',
    word: '吗',
    pinyin: 'ma',
    title: 'Yes-no questions with 吗',
    pattern: 'Statement + 吗？',
    explanation:
      'Add 吗 to the end of a statement to turn it into a yes-no question. The word order stays the same. Chinese has no single word for "yes" or "no": you answer by repeating the verb, with or without 不 (是 / 不是, 有 / 没有).',
    examples: [
      { tatoebaId: 352933, zh: '你是学生吗？', en: 'Are you a student?', author: 'zhouj1955' },
      { tatoebaId: 745160, zh: '您有手机吗？', en: 'Do you have a cellphone?', author: 'Vortarulo' },
      { tatoebaId: 480305, zh: '你想一起去吗？', en: 'Do you want to come along?', author: 'minshirui' },
    ],
    reference: { title: 'Yes-no questions with "ma"', url: `${WIKI}ASGQ2AZA` },
  },
  {
    id: 'ne-questions',
    word: '呢',
    pinyin: 'ne',
    title: '"What about...?" with 呢',
    pattern: 'Noun / Pronoun + 呢？',
    explanation:
      'After a noun or pronoun, 呢 turns the question just asked back on it: 你呢？ is "and you?". Asked out of the blue about a person or a thing, it means "where is...?".',
    examples: [
      { tatoebaId: 691992, zh: '你呢？', en: 'How about you?', author: 'sysko' },
      { tatoebaId: 2680906, zh: '那我呢?', en: 'What about me?', author: 'issiao1024' },
      { tatoebaId: 10966817, zh: '你妈妈呢？', en: "Where's your mom?", author: 'xjjAstrus' },
    ],
    reference: { title: 'Questions with "ne"', url: `${WIKI}ASGMJHZO` },
  },
  {
    id: 'ba-suggestions',
    word: '吧',
    pinyin: 'ba',
    title: 'Suggestions with 吧',
    pattern: 'Verb phrase + 吧',
    explanation:
      '吧 at the end of a command turns it into a suggestion or a friendly offer: "let\'s...", "why don\'t you...". With 我们 it is "let\'s"; with 我 it offers to do something.',
    examples: [
      { tatoebaId: 334277, zh: '走吧。', en: "Let's go!", author: 'fucongcong' },
      { tatoebaId: 7767999, zh: '我们开始吧。', en: "Let's start.", author: 'jiangche' },
      { tatoebaId: 526394, zh: '我送你回家吧。', en: 'Let me take you home.', author: 'nickyeow' },
    ],
    reference: { title: 'Suggestions with "ba"', url: `${WIKI}ASGMPZ6D` },
  },
  {
    id: 'ba-softening',
    word: '吧',
    pinyin: 'ba',
    title: 'Softening statements with 吧',
    pattern: 'Statement + 吧',
    explanation:
      '吧 also makes a statement sound less certain or less blunt. As a question, it shows you already think the answer is yes and want the other person to agree, like "..., right?". In answers it sounds easygoing: 好吧 is "OK, then".',
    examples: [
      { tatoebaId: 3534648, zh: '你喜欢昨晚的演出吧？', en: 'Did you enjoy the performance last night?', author: 'trieuho' },
      { tatoebaId: 5933582, zh: '好吧。', en: 'Okay.', author: 'Sethlang' },
      { tatoebaId: 710745, zh: '也许下一次吧。', en: 'Maybe some other time.', author: 'Yashanti' },
    ],
    reference: { title: 'Softening speech with "ba"', url: `${WIKI}ASGDHC1H` },
  },
  {
    id: 'guo-experience',
    word: '过',
    pinyin: 'guo',
    title: 'Past experiences with 过',
    pattern: 'Verb + 过 + Object',
    explanation:
      '过 after a verb says someone has done something at least once, at some point in the past: "have ever...". It talks about the experience, not about when it happened. To say you have never done it, use 没 before the verb and keep 过.',
    examples: [
      { tatoebaId: 5558523, zh: '他去过很多地方。', en: 'He has been to many places.', author: 'verdastelo9604' },
      { tatoebaId: 1428132, zh: '你去过哪些国家？', en: 'Which countries have you visited?', author: 'sadhen' },
      { tatoebaId: 411728, zh: '我从来没去过美国。', en: 'I have never gone to America.', author: 'GlossaMatik' },
    ],
    reference: { title: 'Expressing experiences with "guo"', url: `${WIKI}ASGQGV3P` },
  },
  {
    id: 'zhe-continuous',
    word: '着',
    pinyin: 'zhe',
    title: 'Ongoing states with 着',
    pattern: 'Verb + 着',
    explanation:
      '着 after a verb says that an action, or the state it leaves behind, keeps going: 穿着 is "wearing", 亮着 is "is on". It describes how things are at a moment rather than reporting an event. In words like 着急 and 睡着 the same character is read zháo and is not this particle.',
    examples: [
      { tatoebaId: 466164, zh: '猫看着鱼。', en: 'The cat is watching the fish.', author: 'fucongcong' },
      { tatoebaId: 349263, zh: '她穿着红裙子。', en: 'She was wearing a red skirt.', author: 'zhouj1955' },
      { tatoebaId: 1411641, zh: '灯亮着。', en: 'The light is on.', author: 'asosan' },
    ],
    reference: { title: 'Aspect particle "zhe"', url: `${WIKI}ASGOIDEO` },
  },
  {
    id: 'de-degree',
    word: '得',
    pinyin: 'de',
    title: 'How well: verb + 得',
    pattern: 'Verb + 得 + Description',
    explanation:
      '得 after a verb introduces a comment on how the action is done: well, fast, fluently... If the verb has an object, say the verb twice (说法语说得...) or put the object first. To negate, put 不 after 得, not before the verb.',
    examples: [
      { tatoebaId: 796906, zh: '他弹得很好。', en: 'He plays very well.', author: 'fucongcong' },
      { tatoebaId: 1753036, zh: '他说法语说得很流利。', en: 'He is fluent in French.', author: 'sadhen' },
      { tatoebaId: 3700364, zh: '她法语说得不流利。', en: 'Her French is not fluent.', author: 'katshi94' },
    ],
    reference: { title: 'Degree complement', url: `${WIKI}ASG79STE` },
  },
  {
    id: 'de-adverb',
    word: '地',
    pinyin: 'de',
    title: 'Manner of an action with 地',
    pattern: 'Adjective + 地 + Verb',
    explanation:
      '地 turns a description into an adverb placed before the verb, like English "-ly". 的, 得 and 地 all sound the same (de): 的 comes before nouns, 得 after verbs and 地 before verbs.',
    examples: [
      { tatoebaId: 512111, zh: '他慢慢地走。', en: 'He walks slowly.', author: 'fucongcong' },
      { tatoebaId: 1178232, zh: '她小心地做。', en: 'She did it carefully.', author: 'treskro3' },
      { tatoebaId: 429463, zh: '请详细地解释。', en: 'Please explain in detail.', author: 'aliene' },
    ],
    reference: { title: 'Turning adjectives into adverbs', url: `${WIKI}ASGMAFSX` },
  },
  {
    id: 'a-interjection',
    word: '啊',
    pinyin: 'a',
    title: 'Adding feeling with 啊',
    pattern: 'Sentence + 啊',
    explanation:
      '啊 at the end of a sentence adds emotion without changing the meaning: excitement in exclamations (多...啊！ is "how...!"), urgency in commands, or insistence and surprise in questions.',
    examples: [
      { tatoebaId: 5092632, zh: '多可爱啊！', en: 'How cute!', author: 'mirrorvan' },
      { tatoebaId: 7767996, zh: '说啊！', en: 'Speak!', author: 'jiangche' },
      { tatoebaId: 839261, zh: '他是什么样子的男人啊？', en: 'What kind of man was he?', author: 'U2FS' },
    ],
    reference: { title: 'Sentence-final interjection "a"', url: `${WIKI}ASGW66JM` },
  },
  {
    id: 'bei-passive',
    word: '被',
    pinyin: 'bei',
    title: 'Passive sentences with 被',
    pattern: 'Receiver + 被 + (Doer) + Verb + Result',
    explanation:
      '被 turns a sentence around so that it starts with the thing the action happens to, like the English passive "was eaten". The doer comes right after 被 and can be left out. The verb rarely stands alone: it usually ends with 了 or a result (踢开, 吃了一半). 被 is most common for things that are done to someone against their will or that turn out badly.',
    examples: [
      { tatoebaId: 5581800, zh: '门被踢开了。', en: 'The door was kicked open.', author: 'verdastelo9604' },
      { tatoebaId: 14023304, zh: '面包被吃了一半。', en: 'The bun was half eaten.', author: 'jan_OkulaJu' },
      { tatoebaId: 332862, zh: '他被选为市长。', en: 'He was elected mayor of the city.', author: 'fucongcong' },
    ],
    reference: { title: 'Using "bei" sentences', url: `${WIKI}ASGHF9F1` },
  },
  {
    id: 'ba-disposal',
    word: '把',
    pinyin: 'ba',
    title: 'What you do to something: the 把 sentence',
    pattern: 'Subject + 把 + Object + Verb + Result',
    explanation:
      '把 moves the object in front of the verb to focus on what happens to it: where it ends up, who gets it, what state it is left in. The object is something specific that both speakers know about, and the verb must be followed by something (给我, 刻在树上, 放下来), never used bare. It is the active counterpart of 被.',
    examples: [
      { tatoebaId: 4262244, zh: '把书给我。', en: 'Give me the book.', author: 'notabene' },
      { tatoebaId: 3487188, zh: '男孩把他的名字刻在树上。', en: 'The boy carved his name on the tree.', author: 'GlossaMatik' },
      { tatoebaId: 10252129, zh: '我把书放下来然后开灯。', en: 'I put the book down and turned on the light.', author: 'GlossaMatik' },
    ],
    reference: { title: 'Using "ba" sentences', url: `${WIKI}ASG2UB2B` },
  },
  {
    id: 'bi-comparison',
    word: '比',
    pinyin: 'bi',
    title: 'Comparisons with 比',
    pattern: 'A + 比 + B + Adjective',
    explanation:
      '比 compares two things: "A is more ... than B". The adjective takes no 很 (我比他高, never 我比他很高), but you can add 更 to stress the difference (比他更高). When B repeats a noun from A, it can be shortened: 我的 for 我的手表.',
    examples: [
      { tatoebaId: 635805, zh: '我比他高。', en: 'I am taller than he.', author: 'Shishir' },
      { tatoebaId: 481172, zh: '你的手表比我的贵。', en: 'Your watch is more expensive than mine.', author: 'fucongcong' },
      { tatoebaId: 340652, zh: '地球比太阳小。', en: 'The earth is smaller than the sun.', author: 'aaroned' },
    ],
    reference: { title: 'Basic comparisons with "bi"', url: `${WIKI}ASG8SI2K` },
  },
  {
    id: 'zai-progressive',
    word: '在',
    pinyin: 'zai',
    alsoShownOn: ['正在'],
    title: 'Actions in progress with 在',
    pattern: 'Subject + (正)在 + Verb',
    explanation:
      '在 before a verb says the action is going on right now, like English "-ing". 正在 means the same with more stress on "at this very moment". When 在 is followed by a place instead, it says where the action happens.',
    examples: [
      { tatoebaId: 347031, zh: '他在看电视。', en: 'He is watching TV.', author: 'fucongcong' },
      { tatoebaId: 5580848, zh: '她在睡觉。', en: 'She is sleeping.', author: 'grindeldore' },
      { tatoebaId: 1920765, zh: '我正在洗碗。', en: "I'm washing the dishes.", author: 'fercheung' },
    ],
    reference: { title: 'Expressing actions in progress with "zai"', url: `${WIKI}ASG846EA` },
  },
  {
    id: 'zai-location',
    word: '在',
    pinyin: 'zai',
    title: 'Where something happens: 在 + place',
    pattern: 'Subject + 在 + Place + Verb',
    explanation:
      'In Chinese the place where something happens goes before the verb, introduced by 在: "I at the bank work". Places like 椅子上 or 家里 add a position word (上, 里) after the noun.',
    examples: [
      { tatoebaId: 333599, zh: '我在银行工作。', en: 'I work in a bank.', author: 'al' },
      { tatoebaId: 6055171, zh: '他在北京工作。', en: 'He works in Beijing.', author: 'verdakoro' },
      { tatoebaId: 2827154, zh: '猫在椅子上睡觉。', en: 'The cat is sleeping on the chair.', author: 'GlossaMatik' },
    ],
    reference: { title: 'Indicating location with "zai" before verbs', url: `${WIKI}ASGX0Z0N` },
  },
  {
    id: 'yue-more-and-more',
    word: '越',
    pinyin: 'yue',
    title: '"More and more" with 越来越',
    pattern: '越来越 + Adjective',
    explanation:
      '越来越 before an adjective says something keeps increasing: "more and more", "-er and -er". It often ends with 了. With two different parts, 越 A 越 B means "the more A, the more B".',
    examples: [
      { tatoebaId: 2052540, zh: '他越来越有名了。', en: 'He became more and more famous.', author: 'sadhen' },
      { tatoebaId: 2305059, zh: '他越说越兴奋。', en: 'As he talked, he got more and more excited.', author: 'fercheung' },
      { tatoebaId: 335730, zh: '越快越好。', en: 'The sooner, the better.', author: 'sysko' },
    ],
    reference: { title: 'Expressing "more and more" with "yuelaiyue"', url: `${WIKI}ASG7UE4H` },
  },
  {
    id: 'suiran-danshi',
    word: '虽然',
    pinyin: 'sui ran',
    alsoShownOn: ['但是'],
    title: '"Although" with 虽然...但是',
    pattern: '虽然 + Fact + 但是 + Contrast',
    explanation:
      'Unlike English, where you say "although" or "but" and not both, Chinese usually uses the pair: 虽然 in the first part and 但是 (or 可是) in the second. Either one can be dropped. 虽然 can go before or after the subject.',
    examples: [
      { tatoebaId: 8976063, zh: '这本书虽然很厚，但是不贵。', en: "That book is thick, but it's not very expensive.", author: 'crescat' },
      { tatoebaId: 2002944, zh: '他虽然年轻，但是位好医生。', en: 'Young as he is, he is a good doctor.', author: 'sunnywqing' },
      { tatoebaId: 9779602, zh: '虽然时间好早，天气已经热了。', en: 'Although it was still early, it was already hot outside.', author: 'BobbyLee' },
    ],
    reference: { title: 'Expressing "although" with "suiran" and "danshi"', url: `${WIKI}ASGXI560` },
  },
  {
    id: 'yinwei-suoyi',
    word: '因为',
    pinyin: 'yin wei',
    alsoShownOn: ['所以'],
    title: 'Cause and effect with 因为...所以',
    pattern: '因为 + Cause + 所以 + Effect',
    explanation:
      '因为 introduces the reason and 所以 the result. The cause usually comes first, and it is fine to use both words together, or just one of them. When the reason comes second, only 因为 is used.',
    examples: [
      { tatoebaId: 8775992, zh: '因为堵车， 我开会迟到了。', en: 'Because there was traffic, I was late to the meeting.', author: 'crescat' },
      { tatoebaId: 348007, zh: '我很累所以早睡了。', en: 'I was very tired, so I went to bed early.', author: 'zhouj1955' },
      { tatoebaId: 334680, zh: '你不能喝海水，因为它太咸了。', en: "You can't drink seawater because it is too salty.", author: 'fucongcong' },
    ],
    reference: { title: 'Cause and effect with "yinwei" and "suoyi"', url: `${WIKI}ASGTDUJO` },
  },
  {
    id: 'ruguo-jiu',
    word: '如果',
    pinyin: 'ru guo',
    alsoShownOn: ['就'],
    title: '"If... then..." with 如果...就',
    pattern: '如果 + Condition + 就 + Result',
    explanation:
      '如果 opens the condition and 就 goes before the verb of the result, after its subject (你就必须...). 就 is often left out, especially when the result is a suggestion or a command.',
    examples: [
      { tatoebaId: 1477285, zh: '如果签证过期，你就必须离开中国。', en: 'If your visa expires, you must leave China.', author: 'eastasiastudent' },
      { tatoebaId: 12686056, zh: '如果饿了，吃吧。', en: "If you're hungry, eat.", author: 'soueihin' },
      { tatoebaId: 933952, zh: '如果进行尝试，任何人都可以做。', en: 'Anyone can do it if they try.', author: 'zhaoxin' },
    ],
    reference: { title: 'Expressing "if... then..." with "ruguo... jiu..."', url: `${WIKI}ASGGIVT0` },
  },
  {
    id: 'yibian',
    word: '一边',
    pinyin: 'yi bian',
    title: 'Doing two things at once with 一边',
    pattern: 'Subject + 一边 + Verb 1 + 一边 + Verb 2',
    explanation:
      'Put 一边 before each of two actions that the same person does at the same time: "while". Both verbs share the subject, which comes once at the start.',
    examples: [
      { tatoebaId: 1454456, zh: '他一边唱歌一边工作。', en: 'He sang while working.', author: 'sadhen' },
      { tatoebaId: 348196, zh: '他们一边唱歌一边走路。', en: 'They went along the street singing the song.', author: 'zhouj1955' },
    ],
    reference: { title: 'Simultaneous tasks with "yibian"', url: `${WIKI}ASG2ZC5S` },
  },
  {
    id: 'chule-yiwai',
    word: '除了',
    pinyin: 'chu le',
    title: '"Except" and "besides" with 除了',
    pattern: '除了 + A + (以外), + 都 / 也 / 还...',
    explanation:
      '除了 A (以外) sets A apart, and the adverb in the second part decides the meaning. With 都 it excludes A: "everything except A". With 也 or 还 it adds to A: "besides A, also...". 以外 at the end of the first part is optional.',
    examples: [
      { tatoebaId: 846427, zh: '除了星期天他每天工作。', en: 'He works every day except Sunday.', author: 'Martha' },
      { tatoebaId: 899118, zh: '除了语言，我也对技术感兴趣。', en: "Apart from languages, I'm also interested in technology.", author: 'eastasiastudent' },
      { tatoebaId: 396079, zh: '除了鼻子不通以外，我还发着高烧。', en: "In addition to a blocked nose, I'm also suffering from a high temperature.", author: 'aeriph' },
    ],
    reference: { title: 'Expressing "except" and "in addition" with "chule… yiwai"', url: `${WIKI}ASGHFPGG` },
  },
  {
    id: 'budan-erqie',
    word: '不但',
    pinyin: 'bu dan',
    alsoShownOn: ['而且'],
    title: '"Not only... but also" with 不但...而且',
    pattern: '不但 + A + 而且 + B',
    explanation:
      '不但 marks the first point and 而且 adds a second, usually stronger one: "not only A, but also B". 而且 also works alone to add information, like "and what\'s more".',
    examples: [
      { tatoebaId: 333469, zh: '她不但漂亮，而且聪明。', en: 'She is as clever as she is beautiful.', author: 'fucongcong' },
      { tatoebaId: 334650, zh: '我结婚了，而且有两个孩子。', en: 'I am married and have two children.', author: 'fucongcong' },
    ],
    reference: { title: 'Expressing "not only... but also" with "budan... erqie..."', url: `${WIKI}ASGTYJ3E` },
  },
  {
    id: 'yiyang',
    word: '一样',
    pinyin: 'yi yang',
    alsoShownOn: ['跟'],
    title: '"As... as" with 跟...一样',
    pattern: 'A + 跟 / 和 + B + 一样 + (Adjective)',
    explanation:
      'A 跟 B 一样 says two things are the same; add an adjective to say in what way: "as tall as". 和 works just like 跟. To say they are different, use 不一样.',
    examples: [
      { tatoebaId: 1173004, zh: '你跟我一样大。', en: 'You and me are the same age.', author: 'eastasiastudent' },
      { tatoebaId: 333772, zh: '他和我一样高。', en: 'He is as tall as I.', author: 'fucongcong' },
    ],
    reference: { title: 'Basic comparisons with "yiyang"', url: `${WIKI}ASGC06N0` },
  },
  {
    id: 'haishi-huozhe',
    word: '还是',
    pinyin: 'hai shi',
    title: '"Or" in questions: 还是 vs 或者',
    pattern: 'A + 还是 + B？',
    explanation:
      'Chinese has two words for "or". 还是 is for questions that ask someone to choose, and needs no 吗. 或者 is for statements, when either option is fine.',
    examples: [
      { tatoebaId: 1477275, zh: '你吃面条还是吃饭？', en: 'Do you want to eat noodles or rice?', author: 'GlossaMatik' },
      { tatoebaId: 813434, zh: '这是报纸还是杂志？', en: 'Is this a newspaper or a magazine?', author: 'eastasiastudent' },
    ],
    reference: { title: 'Comparing "haishi" and "huozhe"', url: `${WIKI}ASGQJ5IC` },
  },
  {
    id: 'huozhe',
    word: '或者',
    pinyin: 'huo zhe',
    title: '"Or" in statements with 或者',
    pattern: 'A + 或者 + B',
    explanation:
      '或者 joins two options when either one is fine or you are not sure which: "on foot or by bike". It can also offer options in a 吗 question ("milk or sugar?"). To ask someone to choose between A and B, use 还是 instead.',
    examples: [
      { tatoebaId: 791438, zh: '他走路或者骑车过来。', en: "He'll come on foot or by bicycle.", author: 'fucongcong' },
      { tatoebaId: 1878278, zh: '你或者我会被选中。', en: 'You or I will be chosen.', author: 'sadhen' },
      { tatoebaId: 13901003, zh: '要加点牛奶或者糖吗？', en: 'Any milk or sugar?', author: 'jan_OkulaJu' },
    ],
    reference: { title: 'Comparing "haishi" and "huozhe"', url: `${WIKI}ASGQJ5IC` },
  },
  {
    id: 'tai-le',
    word: '太',
    pinyin: 'tai',
    title: '"Too" with 太...了',
    pattern: '太 + Adjective + 了',
    explanation:
      '太 before an adjective, with 了 at the end, says "too much": 太贵了 is "too expensive". The same pattern is also used as praise, meaning "so" or "really": 太好了！ is "great!".',
    examples: [
      { tatoebaId: 399956, zh: '太贵了！', en: "It's too expensive!", author: 'fucongcong' },
      { tatoebaId: 512866, zh: '我太矮了。', en: 'I am too short.', author: 'fucongcong' },
      { tatoebaId: 1590379, zh: '你的衣服太漂亮了。', en: 'Your clothes are extremely beautiful.', author: 'trieuho' },
    ],
    reference: { title: 'Expressing "excessively" with "tai"', url: `${WIKI}ASG8HVFN` },
  },
  {
    id: 'hui-skill',
    word: '会',
    pinyin: 'hui',
    title: 'Learned skills with 会',
    pattern: 'Subject + 会 + Verb',
    explanation:
      '会 before a verb says someone has learned how to do something: swim, speak a language, sing. For being able to do something right now or being allowed to, Chinese uses 能 and 可以 instead. 会 can also mean "will" when talking about the future.',
    examples: [
      { tatoebaId: 408816, zh: '他会游泳。', en: 'He knows how to swim.', author: 'fucongcong' },
      { tatoebaId: 421010, zh: '你会讲普通话吗？', en: 'Can you speak Mandarin?', author: 'sysko' },
      { tatoebaId: 10696069, zh: '您会唱歌吗？', en: 'Can you sing?', author: 'GlossaMatik' },
    ],
    reference: { title: 'Expressing a learned skill with "hui"', url: `${WIKI}ASGRHM0E` },
  },
  {
    id: 'lian-dou',
    word: '连',
    pinyin: 'lian',
    title: '"Even" with 连...都',
    pattern: '连 + Extreme case + 都 / 也 + Verb',
    explanation:
      '连 highlights a surprising, extreme case, and 都 or 也 must follow before the verb: "even a child can do it". It is often used with negatives: 连...都没 is "not even".',
    examples: [
      { tatoebaId: 4757667, zh: '连小孩儿都会做。', en: 'Even a child could do it.', author: 'ryanwoo' },
      { tatoebaId: 9806203, zh: '连笑话也有限制。', en: 'Even jokes have a limit.', author: 'kupo033' },
    ],
    reference: { title: 'Expressing "even" with "lian" and "dou"', url: `${WIKI}ASGNP0WV` },
  },
]
