import type { AnalysisResult, UserSettings } from '../types'

// ─── Storage Keys ───
export const STORAGE_KEYS = {
  ANALYSES: 'narada_analyses',
  SETTINGS: 'narada_settings',
} as const

// ─── Default Settings ───
export const DEFAULT_SETTINGS: UserSettings = {
  googleFactCheckApiKey: '',
  defaultUnit: 'PUSSIBERAD TNI AD',
  analystName: 'Sertu Damar / Analis Madya',
  analystNrp: '21260408',
  mlWeight: 0.6,
  ruleWeight: 0.4,
  offlineMode: false,
}

/**
 * Mengambil daftar seluruh hasil analisis yang tersimpan di sesi saat ini
 */
export function getStoredAnalyses(): AnalysisResult[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.ANALYSES)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('[NARADA Storage] Gagal membaca sessionStorage analyses:', error)
    return []
  }
}

/**
 * Menyimpan hasil analisis baru ke sessionStorage dan memicu custom event untuk reactivity
 */
export function saveAnalysis(analysis: AnalysisResult): void {
  try {
    const existing = getStoredAnalyses()
    // Hindari duplikasi ID
    const updated = [analysis, ...existing.filter(a => a.id !== analysis.id)]
    sessionStorage.setItem(STORAGE_KEYS.ANALYSES, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('narada:analyses-updated', { detail: updated }))
  } catch (error) {
    console.error('[NARADA Storage] Gagal menyimpan analysis:', error)
  }
}

/**
 * Menghapus seluruh riwayat analisis pada sesi ini
 */
export function clearStoredAnalyses(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.ANALYSES)
    window.dispatchEvent(new CustomEvent('narada:analyses-updated', { detail: [] }))
  } catch (error) {
    console.error('[NARADA Storage] Gagal membersihkan sessionStorage:', error)
  }
}

/**
 * Mengambil konfigurasi pengguna (disimpan di localStorage agar persisten)
 */
export function getUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch (error) {
    console.error('[NARADA Storage] Gagal membaca user settings:', error)
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * Menyimpan sebagian atau seluruh konfigurasi pengguna ke localStorage
 */
export function saveUserSettings(settings: Partial<UserSettings>): UserSettings {
  try {
    const current = getUserSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('narada:settings-updated', { detail: updated }))
    return updated
  } catch (error) {
    console.error('[NARADA Storage] Gagal menyimpan user settings:', error)
    return getUserSettings()
  }
}
