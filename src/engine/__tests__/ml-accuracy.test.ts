// ─── UNIT TEST SUITE: ML ACCURACY & XAI SALIENCE ENGINE (SPRINT 7B) ───
// Pengujian Mandiri (Zero-Dependency) Model Naive Bayes & XAI Attribution
// Sistem Pertahanan Kognitif NARADA - PUSSIBERAD TNI AD × CODEPOLITAN

import { predictNaiveBayes } from '../ml/naive-bayes'
import goldenDataset from '../../../scripts/golden-test-dataset.json'
import type { ContentCategory } from '../../types'

interface GoldenTestCase {
  id: string
  category: ContentCategory
  scenario: string
  text: string
  expectedCategory: ContentCategory
}

// ─── ZERO-DEPENDENCY TEST HARNESS ───
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
    toHaveProperty: (prop: string) => {
      if (actual === null || typeof actual !== 'object' || !(prop in actual)) {
        throw new Error(`Expected property ${prop} to exist on ${JSON.stringify(actual)}`)
      }
    },
    toContain: (item: unknown) => {
      if (!Array.isArray(actual) || !actual.includes(item as never)) {
        throw new Error(`Expected array to contain ${String(item)}`)
      }
    }
  }
}

const testCases = goldenDataset as GoldenTestCase[]

describe('NARADA ML Naive Bayes & XAI Engine Audit', () => {
  test('harus memuat kosakata model terkompilasi', () => {
    const dummyPrediction = predictNaiveBayes('siaran pers resmi dispenad tni ad')
    expect(dummyPrediction).toBeDefined()
    expect(dummyPrediction.probabilities).toBeDefined()
    expect(dummyPrediction.inferenceLatencyMs).toBeLessThanOrEqual(15)
  })

  test('harus memiliki Zero False Positive pada dokumen resmi militer/pemerintah', () => {
    const netralCases = testCases.filter(c => c.expectedCategory === 'NETRAL')
    expect(netralCases.length).toBe(10)

    for (const testCase of netralCases) {
      const pred = predictNaiveBayes(testCase.text)
      expect(pred.category).toBe('NETRAL')
    }
  })

  test('harus mencapai akurasi minimal 92% pada 50 kasus uji emas', () => {
    let correct = 0
    for (const testCase of testCases) {
      const pred = predictNaiveBayes(testCase.text)
      if (pred.category === testCase.expectedCategory) {
        correct++
      }
    }
    const accuracy = (correct / testCases.length) * 100
    expect(accuracy).toBeGreaterThanOrEqual(92.0)
  })

  test('harus menghasilkan atribusi token XAI salience dengan LLR valid', () => {
    const threatSample = 'Bantuan sosial tunai 5 juta kemensos cair klaim via link phising rekening'
    const pred = predictNaiveBayes(threatSample)

    expect(pred.salienceTokens).toBeDefined()
    expect(pred.salienceTokens.length).toBeGreaterThan(0)

    const firstToken = pred.salienceTokens[0]
    expect(firstToken).toHaveProperty('token')
    expect(firstToken).toHaveProperty('logLikelihoodRatio')
    expect(firstToken).toHaveProperty('intensity')
    expect(['CRIMSON', 'AMBER', 'EMERALD', 'NEUTRAL']).toContain(firstToken.intensity)
  })
})
