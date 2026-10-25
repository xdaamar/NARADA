// ─── COGNITIVE PSYCHOLOGY VECTORS ENGINE ───
// Menghitung indeks manipulasi psikologis: Rage-Bait, Urgensi Palsu, dan Polarisasi Sosial

import type { CognitivePsychologyVectors } from '../types'

// Kamus leksikal indikator emosi & manipulasi kognitif
const RAGE_BAIT_PATTERNS = [
  'serbuan', 'gantung', 'habisi', 'tangkap', 'lawan', 'hancurkan', 'biadab',
  'serang', 'bunuh', 'mampus', 'darah', 'bantai', 'bangsat', 'keparat',
  'bajingan', 'rezim lalim', 'penindas', 'laknat', 'usir', 'kutuk',
  'biadabnya', 'darah pejuang', 'tumpas', 'laknatullah', 'kurang ajar',
  'keji', 'dzalim', 'zalim', 'pengkhianat', 'fiktif', 'rongsokan',
  'korupsi', 'skandal', 'kebohongan', 'bobrok', 'dibungkam', 'tanpa izin'
]

const URGENCY_PATTERNS = [
  'viralkan', 'jangan ditunda', 'sebelum dihapus', 'info darurat', 'bahaya besar',
  'sebarkan ke semua grup', 'sebar cepat', 'darurat', 'awas', 'waspada',
  'detik-detik', 'bocor', 'bocoran', 'rahasia', 'rahasia terbongkar', 'jangan sampai lolos',
  'sekarang juga', 'jangan tunggu', 'segera sebarkan', 'sebarkan', 'sebelum dibungkam',
  'tonton sebelum diblokir', 'cepat simpan', 'share sebanyak-banyaknya', 'viralkan kawan',
  'kabar mengejutkan', 'sebelum kominfo blokir', 'jangan diabaikan'
]

const SOCIAL_CLEAVAGE_PATTERNS = [
  'pribumi', 'aseng', 'asing', 'cina', 'kafir', 'khilafah', 'makar',
  'separatis', 'papua merdeka', 'tni memusuhi rakyat', 'aparat jahat',
  'aparat menindas', 'bentrok warga', 'perang suku', 'adu domba',
  'boikot pemilu', 'referendum', 'disintegrasi', 'rezim boneka',
  'pengkhianat bangsa', 'antek asing', 'antek pki', 'antek barat',
  'penjajah jawa', 'melawan aparat', 'polisi dzalim'
]

/**
 * Menghitung vektor manipulasi psikologis kognitif dari teks masukan
 */
export function calculatePsychologyVectors(text: string): CognitivePsychologyVectors {
  if (!text || typeof text !== 'string') {
    return {
      rageBaitIndex: 0,
      artificialUrgency: 0,
      socialCleavage: 0,
      primaryEmotion: 'NEUTRAL',
    }
  }

  const normalized = text.toLowerCase()
  const words = text.trim().split(/\s+/).filter(Boolean)

  // 1. Hitung Rage-Bait Index (Agitasi Kemarahan & Kebencian)
  let ragePoints = 0
  for (const pattern of RAGE_BAIT_PATTERNS) {
    const isMulti = pattern.includes(' ')
    const matched = isMulti ? normalized.includes(pattern) : new RegExp(`\\b${pattern}\\b`, 'i').test(normalized)
    if (matched) {
      ragePoints += 18
    }
  }

  // Tanda seru (e.g. !, !!, !!!)
  const exclamationMatches = text.match(/!+/g)
  if (exclamationMatches) {
    ragePoints += Math.min(25, exclamationMatches.length * 8)
  }

  // Tanda tanya bertubi-tubi (e.g. ???)
  const questionMatches = text.match(/\?{2,}/g)
  if (questionMatches) {
    ragePoints += Math.min(15, questionMatches.length * 8)
  }

  // Rasio kata HURUF KAPITAL (SHOUTING)
  const allCapsWords = words.filter(w => w.length > 2 && w === w.toUpperCase() && /^[A-Z]+$/.test(w))
  if (allCapsWords.length > 0) {
    ragePoints += Math.min(25, allCapsWords.length * 7)
  }

  const rageBaitIndex = Math.min(100, Math.max(0, Math.round(ragePoints)))

  // 2. Hitung Artificial Urgency (Manipulasi Kepanikan / FOMO)
  let urgencyPoints = 0
  for (const pattern of URGENCY_PATTERNS) {
    const isMulti = pattern.includes(' ')
    const matched = isMulti ? normalized.includes(pattern) : new RegExp(`\\b${pattern}\\b`, 'i').test(normalized)
    if (matched) {
      urgencyPoints += 20
    }
  }

  // Kata penunjuk waktu mendesak / call to action
  if (/\b(sekarang|malam ini|hari ini|detik ini|secepatnya|sebarkan|viralkan)\b/i.test(normalized)) {
    urgencyPoints += 12
  }

  const artificialUrgency = Math.min(100, Math.max(0, Math.round(urgencyPoints)))

  // 3. Hitung Social Cleavage (Polarisasi Sosial & Adu Domba Identitas)
  let cleavagePoints = 0
  for (const pattern of SOCIAL_CLEAVAGE_PATTERNS) {
    const isMulti = pattern.includes(' ')
    const matched = isMulti ? normalized.includes(pattern) : new RegExp(`\\b${pattern}\\b`, 'i').test(normalized)
    if (matched) {
      cleavagePoints += 24
    }
  }

  const socialCleavage = Math.min(100, Math.max(0, Math.round(cleavagePoints)))

  // 4. Penentuan Primary Emotion Dominan
  let primaryEmotion: 'ANGER' | 'FEAR' | 'CONFUSION' | 'URGENCY' | 'NEUTRAL' = 'NEUTRAL'

  const maxVal = Math.max(rageBaitIndex, artificialUrgency, socialCleavage)
  if (maxVal < 20) {
    primaryEmotion = 'NEUTRAL'
  } else if (rageBaitIndex === maxVal) {
    primaryEmotion = 'ANGER'
  } else if (artificialUrgency === maxVal) {
    primaryEmotion = 'URGENCY'
  } else if (socialCleavage === maxVal) {
    // Jika polarisasi tinggi dengan ancaman kekerasan -> FEAR
    if (rageBaitIndex > 30 || /bahaya|ancaman|darurat|perang/i.test(normalized)) {
      primaryEmotion = 'FEAR'
    } else {
      primaryEmotion = 'CONFUSION'
    }
  }

  return {
    rageBaitIndex,
    artificialUrgency,
    socialCleavage,
    primaryEmotion,
  }
}
