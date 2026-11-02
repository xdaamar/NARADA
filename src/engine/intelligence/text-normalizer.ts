/**
 * ════════════════════════════════════════════════════════════════════════════════════
 * NARADA — DETERMINISTIC TEXT NORMALIZATION ENGINE
 * SPRINT 8: WORK PACKAGE 3 (TEXT NORMALIZATION)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ════════════════════════════════════════════════════════════════════════════════════
 */

export const NORMALIZATION_VERSION = '1.0.0'

/**
 * Daftar proskripsi kata negasi yang WAJIB dipertahankan (Section 7)
 */
export const PRESERVED_NEGATIONS = new Set<string>([
  'tidak',
  'bukan',
  'belum',
  'jangan',
  'nggak',
  'gak',
  'tak',
  'no',
  'not'
])

/**
 * Kamus slang / singkatan informal Bahasa Indonesia ke bentuk kanonikal
 */
export const INDONESIAN_SLANG_MAP: Record<string, string> = {
  // Negasi informal
  'tdk': 'tidak',
  'ga': 'tidak',
  'gak': 'tidak',
  'ngga': 'tidak',
  'nggak': 'tidak',
  'g': 'tidak',
  'bkn': 'bukan',
  'blm': 'belum',
  'jgn': 'jangan',
  'tak': 'tidak',

  // Kata ganti & penunjuk
  'sy': 'saya',
  'gw': 'saya',
  'gue': 'saya',
  'gua': 'saya',
  'aku': 'saya',
  'lu': 'kamu',
  'lo': 'kamu',
  'loe': 'kamu',
  'km': 'kamu',
  'kalian': 'kalian',
  'mrk': 'mereka',
  'dia': 'dia',

  // Kata sambung & preposisi
  'yg': 'yang',
  'dgn': 'dengan',
  'dg': 'dengan',
  'utk': 'untuk',
  'buat': 'untuk',
  'krn': 'karena',
  'karna': 'karena',
  'tp': 'tapi',
  'ttp': 'tetapi',
  'tpi': 'tapi',
  'sm': 'sama',
  'dr': 'dari',
  'dri': 'dari',
  'ke': 'ke',
  'dlm': 'dalam',
  'pd': 'pada',
  'pda': 'pada',
  'spt': 'seperti',
  'kek': 'seperti',
  'kyk': 'seperti',
  'klo': 'kalau',
  'kl': 'kalau',
  'kalo': 'kalau',

  // Kata keterangan & penguat
  'bgt': 'banget',
  'bgtu': 'begitu',
  'gitu': 'begitu',
  'gt': 'begitu',
  'gini': 'begini',
  'gmn': 'bagaimana',
  'gmna': 'bagaimana',
  'knp': 'kenapa',
  'sdh': 'sudah',
  'udh': 'sudah',
  'uda': 'sudah',
  'udah': 'sudah',
  'dpt': 'dapat',
  'bs': 'bisa',
  'bisa': 'bisa',
  'bener': 'benar',
  'beneran': 'beneran',
  'bnr': 'benar',
  'aja': 'saja',
  'aj': 'saja',
  'cmn': 'cuma',
  'cuma': 'cuma',
  'cm': 'cuma',
  'doang': 'saja',
  'dong': 'dong',
  'deh': 'deh',
  'sih': 'sih',
  'kok': 'kok',
  'kan': 'kan',
  'lg': 'lagi',
  'lgi': 'lagi',
  'skrg': 'sekarang',
  'skg': 'sekarang',
  'bnyk': 'banyak',
  'byk': 'banyak',
  'bbrp': 'beberapa',
  'org': 'orang',
  'kt': 'kita',
  'hrs': 'harus'
}

export interface TextToken {
  raw: string
  normalized: string
  isNegation: boolean
  isEmoji: boolean
  isUrl: boolean
  isHashtag: boolean
  isMention: boolean
  isPunctuation: boolean
}

export interface NormalizedTextResult {
  rawText: string
  normalizedText: string
  tokens: TextToken[]
  urls: string[]
  hashtags: string[]
  mentions: string[]
  emojis: string[]
  substantiveWordCount: number
}

// Regex deteksi URL aman
const URL_REGEX = /https?:\/\/[^\s$.?#].[^\s]*/gi
// Regex deteksi Hashtag
const HASHTAG_REGEX = /#[a-zA-Z0-9_\u0080-\uFFFF]+/g
// Regex deteksi Mention
const MENTION_REGEX = /@[a-zA-Z0-9_]+/g
// Regex deteksi Emoji Unicode
const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu

/**
 * Melakukan normalisasi teks kanonikal deterministik dan idempoten
 */
export function normalizeCommentText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return ''

  // 1. Unicode Normalization: NFC
  let text = rawText.normalize('NFC')

  // 2. Normalisasi Line Endings (CRLF / CR ke LF tunggal)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 3. Normalisasi Lowercase secara Locale-Safe
  text = text.toLocaleLowerCase('id-ID')

  // 4. Tokenisasi sederhana untuk memproses kata, menjaga emoji dan tanda baca penting
  // Pisahkan berdasarkan whitespace dulu
  const words = text.split(/\s+/).filter(Boolean)

  const normalizedWords = words.map(w => {
    // Jika kata adalah URL atau Mention atau Hashtag utuh, pertahankan
    if (w.startsWith('http://') || w.startsWith('https://') || w.startsWith('@') || w.startsWith('#')) {
      return w
    }

    // Pisahkan tanda baca depan/belakang jika ada: contoh "bgt!" -> "bgt" + "!"
    const match = w.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}]+)([^\p{L}\p{N}]*)$/u)
    if (match) {
      const [, prefix, core, suffix] = match
      const mappedCore = INDONESIAN_SLANG_MAP[core] || core
      return `${prefix}${mappedCore}${suffix}`
    }

    // Jika hanya kata slang murni
    return INDONESIAN_SLANG_MAP[w] || w
  })

  // 5. Gabungkan kembali dengan spasi tunggal
  let result = normalizedWords.join(' ')

  // 6. Normalisasi whitespace ganda dalam baris
  result = result.replace(/[ \t]+/g, ' ').trim()

  return result
}

/**
 * Ekstraksi token terperinci dan fitur leksikal dari teks
 */
export function extractTextFeatures(rawText: string): NormalizedTextResult {
  const normalized = normalizeCommentText(rawText)

  const urls: string[] = []
  const urlMatches = rawText.match(URL_REGEX)
  if (urlMatches) urls.push(...urlMatches)

  const hashtags: string[] = []
  const hashtagMatches = rawText.match(HASHTAG_REGEX)
  if (hashtagMatches) hashtags.push(...hashtagMatches)

  const mentions: string[] = []
  const mentionMatches = rawText.match(MENTION_REGEX)
  if (mentionMatches) mentions.push(...mentionMatches)

  const emojis: string[] = []
  const emojiMatches = rawText.match(EMOJI_REGEX)
  if (emojiMatches) emojis.push(...emojiMatches)

  // Pisahkan kata menjadi token
  const words = normalized.split(/\s+/).filter(Boolean)
  const tokens: TextToken[] = words.map(word => {
    const isUrl = word.startsWith('http://') || word.startsWith('https://')
    const isHashtag = word.startsWith('#')
    const isMention = word.startsWith('@')
    const isEmoji = EMOJI_REGEX.test(word)
    const isNegation = PRESERVED_NEGATIONS.has(word) || PRESERVED_NEGATIONS.has(word.replace(/[^\p{L}\p{N}]/gu, ''))
    const isPunctuation = /^[^\p{L}\p{N}\s]+$/u.test(word)

    return {
      raw: word,
      normalized: word,
      isNegation,
      isEmoji,
      isUrl,
      isHashtag,
      isMention,
      isPunctuation
    }
  })

  // Hitung substantive word count (mengabaikan tanda baca, url, hashtag murni)
  const substantiveWordCount = tokens.filter(t => !t.isPunctuation && !t.isUrl).length

  return {
    rawText,
    normalizedText: normalized,
    tokens,
    urls,
    hashtags,
    mentions,
    emojis,
    substantiveWordCount
  }
}
