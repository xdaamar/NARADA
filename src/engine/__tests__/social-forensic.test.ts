// ─── UNIT TEST SUITE: SOCIAL FORENSIC & BUZZER SWARM CLUSTERING (SPRINT 7D) ───
// Pengujian Mandiri (Zero-Dependency) Matriks Jaccard-Levenshtein, InSet Sentiment, & Burst Velocity
// Sistem Pertahanan Kognitif NARADA - PUSSIBERAD TNI AD × CODEPOLITAN

import {
  clusterComments,
  calculateJaccardSimilarity,
  calculateLevenshteinRatio,
  isCopypastaMatch
} from '../forensic/jaccard-matrix'
import {
  analyzeSentiment,
  aggregateSentimentMatrix
} from '../forensic/sentiment-engine'
import {
  calculateBurstVelocity,
  parseRelativeMinutes
} from '../forensic/burst-velocity'
import {
  generateCounterNarratives
} from '../forensic/counter-narrative-generator'
import stressDataset from '../../../scripts/stress-comments-dataset.json'

// ─── ZERO-DEPENDENCY TEST HARNESS (TypeScript Compatible) ───
function describe(_suiteName: string, fn: () => void): void {
  fn()
}

function test(_testName: string, fn: () => void): void {
  try {
    fn()
  } catch (err) {
    console.error(`  ✗ ${_testName}:`, err)
    throw err
  }
}

function expect<T>(actual: T) {
  return {
    toBeDefined: () => {
      if (actual === undefined || actual === null) {
        throw new Error(`Expected defined, but received ${String(actual)}`)
      }
    },
    toBe: (expected: unknown) => {
      if (actual !== expected) {
        throw new Error(`Expected ${String(expected)}, but received ${String(actual)}`)
      }
    },
    toBeLessThanOrEqual: (num: number) => {
      if (typeof actual !== 'number' || actual > num) {
        throw new Error(`Expected <= ${num}, but received ${String(actual)}`)
      }
    },
    toBeGreaterThan: (num: number) => {
      if (typeof actual !== 'number' || actual <= num) {
        throw new Error(`Expected > ${num}, but received ${String(actual)}`)
      }
    },
    toBeGreaterThanOrEqual: (num: number) => {
      if (typeof actual !== 'number' || actual < num) {
        throw new Error(`Expected >= ${num}, but received ${String(actual)}`)
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected truthy, but received ${String(actual)}`)
      }
    }
  }
}

// ─── SUITE 1: JACCARD N-GRAM & FUZZY LEVENSHTEIN ───
describe('Forensic Jaccard-Levenshtein Clusterer', () => {
  test('Identical strings should have Jaccard = 1.0 and Levenshtein Ratio = 1.0', () => {
    const text = 'Uang 24T menguap beli besi tua, kemana audit BPK? Usut!'
    expect(calculateJaccardSimilarity(text, text)).toBe(1.0)
    expect(calculateLevenshteinRatio(text, text)).toBe(1.0)
    expect(isCopypastaMatch(text, text)).toBe(true)
  })

  test('Typo spoofing variation should be matched by fuzzy Levenshtein ratio', () => {
    const base = 'Bongkar terus rezim panik! Viralkan biar rakyat melek kebobrokan'
    const typo = 'Bongkar terus rezimm panikk! Viralkan biar rakyat melek kebobrokan'
    expect(calculateLevenshteinRatio(base, typo)).toBeGreaterThanOrEqual(0.85)
    expect(isCopypastaMatch(base, typo)).toBe(true)
  })

  test('High-load clustering of 500 comments should execute within 150ms', () => {
    const t0 = performance.now()
    const result = clusterComments(stressDataset, 15)
    const duration = performance.now() - t0

    expect(duration).toBeLessThanOrEqual(150.0)
    expect(result.clusters.length).toBeGreaterThanOrEqual(4)
    expect(result.copypastaPercent).toBeGreaterThanOrEqual(15)
    expect(result.isBuzzerAlarmActive).toBe(true)
  })
})

// ─── SUITE 2: INSET SENTIMENT ENGINE ───
describe('InSet Indonesian Sentiment Engine', () => {
  test('Positive territorial civil-military support text should be POSITIF', () => {
    const posText = 'Terima kasih TNI AD dan Babinsa selalu tulus membantu evakuasi warga'
    const res = analyzeSentiment(posText)
    expect(res.label).toBe('POSITIF')
    expect(res.score).toBeGreaterThan(0.6)
  })

  test('Provocative agitation and rebellion text should be PROVOKATIF', () => {
    const provText = 'Bongkar rezim tiran gulingkan pejabat korup bubarkan parlemen!'
    const res = analyzeSentiment(provText)
    expect(res.label).toBe('PROVOKATIF')
    expect(res.score).toBeLessThanOrEqual(-0.6)
  })

  test('Factual query regarding recruitment schedule should be NETRAL', () => {
    const netText = 'Kapan pengumuman hasil rikmin awal panitia daerah diumumkan'
    const res = analyzeSentiment(netText)
    expect(res.label).toBe('NETRAL')
  })

  test('Aggregate matrix on 500 comments should reflect comprehensive distribution', () => {
    const matrix = aggregateSentimentMatrix(stressDataset)
    expect(matrix.totalCount).toBe(500)
    expect(matrix.positiveCount + matrix.neutralCount + matrix.provocativeCount).toBe(500)
    expect(matrix.provocativePercent).toBeGreaterThan(40)
  })
})

// ─── SUITE 3: BURST VELOCITY & INDEKS KOORDINASI BOTNET ───
describe('Burst Velocity & Botnet Coordination', () => {
  test('Relative timestamp parser should parse relative Indonesian formats accurately', () => {
    expect(parseRelativeMinutes('5 menit lalu')).toBe(5)
    expect(parseRelativeMinutes('2 jam lalu')).toBe(120)
    expect(parseRelativeMinutes('30 detik lalu')).toBeLessThanOrEqual(1)
  })

  test('Massive copypasta comments should trigger high coordination index', () => {
    const burstInput = stressDataset.map(c => ({
      id: c.id,
      timestamp: '5 menit lalu',
      authorHandle: c.author
    }))
    const result = calculateBurstVelocity(burstInput, 30)
    expect(result.burstVelocityPerMinute).toBeGreaterThan(30)
    expect(result.coordinationIndex).toBeGreaterThan(40)
    expect(result.isBurstAnomalyActive).toBe(true)
  })
})

// ─── SUITE 4: 4-CHANNEL COUNTER-NARRATIVE GENERATOR ───
describe('4-Channel Adaptive Counter-Narrative Generator', () => {
  test('All 4 channels must be fully generated with non-empty doctrinal content', () => {
    const narratives = generateCounterNarratives(
      'Uang 24T menguap beli besi tua, kemana audit BPK? Usut!',
      undefined,
      'Media Sosial'
    )

    expect(narratives.dispenadOfficial.length).toBeGreaterThan(150)
    expect(narratives.babinsaTerritorial.length).toBeGreaterThan(150)
    expect(narratives.whatsappCivilian.length).toBeGreaterThan(100)
    expect(narratives.socialTactical.length).toBeGreaterThan(50)
  })
})
