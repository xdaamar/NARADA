import type { AnalysisResult, UserSettings } from '../types'
import { calculatePsychologyVectors } from '../engine/psychology'

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

import {
  saveAnalysisToDB,
  getAnalysesFromDB,
  clearAnalysesFromDB
} from './db-adapter'

// ─── Dual-Layer Memory Cache ───
let memoryCacheAnalyses: AnalysisResult[] | null = null

/**
 * Inisialisasi latar belakang sinkronisasi dari IndexedDB ke Memory Cache
 */
if (typeof window !== 'undefined') {
  setTimeout(() => {
    getAnalysesFromDB()
      .then((dbList) => {
        if (dbList && dbList.length > 0) {
          const current = memoryCacheAnalyses || getStoredAnalyses()
          const idMap = new Map<string, AnalysisResult>()
          // Masukkan DB list terlebih dahulu
          dbList.forEach(a => idMap.set(a.id, a))
          // Override dengan memory/session jika ada perubahan terbaru
          current.forEach(a => idMap.set(a.id, a))
          const merged = Array.from(idMap.values()).sort((a, b) => b.timestamp - a.timestamp)
          memoryCacheAnalyses = merged
          window.dispatchEvent(new CustomEvent('narada:analyses-updated', { detail: merged }))
        }
      })
      .catch((e) => {
        console.warn('[NARADA Storage] Init dari IndexedDB:', e)
      })
  }, 50)
}

/**
 * Mengambil daftar seluruh hasil analisis yang tersimpan (Dual-Layer: Memory Cache + Fallback)
 */
export function getStoredAnalyses(): AnalysisResult[] {
  if (memoryCacheAnalyses !== null) {
    return [...memoryCacheAnalyses]
  }

  try {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return []
    }
    const raw = sessionStorage.getItem(STORAGE_KEYS.ANALYSES)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : []
    memoryCacheAnalyses = list
    return list
  } catch (error) {
    console.error('[NARADA Storage] Gagal membaca sessionStorage analyses:', error)
    return []
  }
}

/**
 * Menyimpan hasil analisis baru: Simpan langsung ke Memory & Async IndexedDB
 */
export function saveAnalysis(analysis: AnalysisResult): void {
  try {
    const existing = getStoredAnalyses()
    // Hindari duplikasi ID
    const updated = [analysis, ...existing.filter(a => a.id !== analysis.id)]
    memoryCacheAnalyses = updated

    // Coba simpan ke sessionStorage (aman terhadap QuotaExceededError)
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(STORAGE_KEYS.ANALYSES, JSON.stringify(updated))
      } catch (quotaErr) {
        console.warn('[NARADA Storage] Kuota sessionStorage penuh, persistensi dialihkan 100% ke IndexedDB:', quotaErr)
      }
    }

    // Persistensi ke IndexedDB berkapasitas tinggi
    saveAnalysisToDB(analysis).catch((err) => {
      console.warn('[NARADA Storage] Gagal persistensi ke IndexedDB:', err)
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('narada:analyses-updated', { detail: updated }))
    }
  } catch (error) {
    console.error('[NARADA Storage] Gagal menyimpan analysis:', error)
  }
}

/**
 * Menghapus seluruh riwayat analisis pada sesi dan IndexedDB
 */
export function clearStoredAnalyses(): void {
  try {
    memoryCacheAnalyses = []
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEYS.ANALYSES)
    }

    clearAnalysesFromDB().catch((err) => {
      console.warn('[NARADA Storage] Gagal menghapus riwayat di IndexedDB:', err)
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('narada:analyses-updated', { detail: [] }))
    }
  } catch (error) {
    console.error('[NARADA Storage] Gagal membersihkan storage:', error)
  }
}

/**
 * Mengambil konfigurasi pengguna (disimpan di localStorage agar persisten)
 */
export function getUserSettings(): UserSettings {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return { ...DEFAULT_SETTINGS }
    }
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
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return { ...DEFAULT_SETTINGS, ...settings }
    }
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

/**
 * Memuat kumpulan data skenario intelijen siap pantau (demo mode) ke sessionStorage
 */
export function seedDemoAnalyses(): AnalysisResult[] {
  const now = Date.now()
  const demoItems: AnalysisResult[] = [
    {
      id: `NRD-${now}-101`,
      timestamp: now - 1000 * 60 * 18, // 18 menit lalu
      inputSource: 'url',
      title: 'Kemhan Buka Suara Terkait Beredarnya Dokumen Pembelian Alutsista Fiktif',
      rawContent: 'BAHAYA!! Beredar bocoran dokumen rahasia pembelian alutsista fiktif Kemhan senilai Rp 24 triliun. Pemerintah dan TNI sengaja menutup-nutupi fakta ini dari publik. Viralkan sekarang ke seluruh grup WhatsApp!',
      input: 'BAHAYA!! Beredar bocoran dokumen rahasia pembelian alutsista fiktif Kemhan senilai Rp 24 triliun. Pemerintah dan TNI sengaja menutup-nutupi fakta ini dari publik. Viralkan sekarang ke seluruh grup WhatsApp!',
      sourceMeta: {
        siteName: 'Detik News',
        author: 'Tim Investigasi Cyber',
        url: 'https://news.detik.com/berita/alutsista-fiktif-kemhan',
      },
      category: 'HOAKS',
      threatLevel: 'critical',
      confidence: 91,
      mlScore: 92,
      ruleScore: 90,
      scores: [
        { label: 'HOAKS', score: 91 },
        { label: 'PROPAGANDA', score: 45 },
        { label: 'DISINFORMASI', score: 40 },
        { label: 'BUZZER', score: 30 },
        { label: 'NETRAL', score: 5 },
      ],
      explanation: 'Ditemukan klaim palsu berkadar tinggi menuduh korupsi alutsista fiktif pertahanan dengan ajakan amplifikasi masif.',
      keywords: ['dokumen rahasia', 'alutsista fiktif', 'kemhan', 'viralkan', 'menutup-nutupi'],
      targetedEntities: ['Kemhan RI', 'TNI AD'],
      recommendation: 'Tindakan Mendesak: Segera rilis klarifikasi resmi melalui Penerangan TNI (Dispenad). Kirimkan permintaan takedown ke BSSN/Kominfo dan lakukan pelacakan simpul awal penyebar.',
      factCheck: {
        available: true,
        query: 'alutsista fiktif kemhan',
        manualSearchUrl: 'https://search.turnbackhoax.id/?q=alutsista%20fiktif',
        explorerUrl: 'https://toolbox.google.com/factcheck/explorer/search/alutsista;hl=id',
        checkedAt: now,
        claims: [
          {
            claimText: 'Beredar selebaran pengadaan alutsista fiktif senilai puluhan triliun oleh Kemhan RI',
            claimant: 'Pesan Berantai WhatsApp',
            publisherName: 'TurnBackHoax - Mafindo',
            publisherSite: 'turnbackhoax.id',
            articleUrl: 'https://turnbackhoax.id/2026/08/14/salah-dokumen-pengadaan-alutsista-fiktif-kemhan/',
            articleTitle: '[SALAH] Dokumen Pengadaan Sistem Alutsista Fiktif Kemhan Senilai Rp 24 Triliun',
            rating: 'SALAH (Fabricated Content)',
            ratingColor: '#EF4444',
            reviewDate: '14-AGU-2026',
          },
        ],
      },
    },
    {
      id: `NRD-${now}-102`,
      timestamp: now - 1000 * 60 * 42, // 42 menit lalu
      inputSource: 'ocr',
      title: 'OCR: Screenshot Post Medsos Separatis',
      rawContent: 'Panggilan perjuangan untuk seluruh kawan di Papua Barat! Rezim militer NKRI terus menindas dan merampas kekayaan adat. Saatnya kita boikot seluruh komando militer Kodam XVII/Cenderawasih dan menuntut hak penentuan nasib sendiri. Hancurkan penjajah!',
      input: 'Panggilan perjuangan untuk seluruh kawan di Papua Barat! Rezim militer NKRI terus menindas dan merampas kekayaan adat. Saatnya kita boikot seluruh komando militer Kodam XVII/Cenderawasih dan menuntut hak penentuan nasib sendiri. Hancurkan penjajah!',
      category: 'PROPAGANDA',
      threatLevel: 'critical',
      confidence: 93,
      mlScore: 90,
      ruleScore: 96,
      scores: [
        { label: 'PROPAGANDA', score: 93 },
        { label: 'HOAKS', score: 35 },
        { label: 'DISINFORMASI', score: 30 },
        { label: 'BUZZER', score: 25 },
        { label: 'NETRAL', score: 5 },
      ],
      explanation: 'Narasi memuat hasutan disintegrasi bangsa, delegitimasi otoritas komando militer wilayah, dan ajakan boikot teritorial.',
      keywords: ['penindas', 'boikot', 'kodam xvii/cenderawasih', 'penjajah', 'separatis'],
      targetedEntities: ['Kodam XVII/Cenderawasih', 'TNI AD'],
      recommendation: 'Eskalasi Komando: Terdeteksi propaganda separatis/makar berintensitas tinggi. Teruskan laporan segera ke Asintel/Pussiberad dan siapkan narasi penyeimbang wawasan kebangsaan di wilayah teritorial terdampak.',
    },
    {
      id: `NRD-${now}-103`,
      timestamp: now - 1000 * 60 * 85, // 1.4 jam lalu
      inputSource: 'text',
      title: 'Analisis Koordinasi Buzzer Medsos',
      rawContent: 'Ayo kawan-kawan relawan, retweet dan share postingan ini serentak malam ini pukul 20.00 WIB! Tag 10 akun teman kalian! Kita harus kompak dan solid viralkan narasi ini agar trending topik nomor satu di Indonesia!',
      input: 'Ayo kawan-kawan relawan, retweet dan share postingan ini serentak malam ini pukul 20.00 WIB! Tag 10 akun teman kalian! Kita harus kompak dan solid viralkan narasi ini agar trending topik nomor satu di Indonesia!',
      category: 'BUZZER',
      threatLevel: 'high',
      confidence: 82,
      mlScore: 85,
      ruleScore: 78,
      scores: [
        { label: 'BUZZER', score: 82 },
        { label: 'PROPAGANDA', score: 25 },
        { label: 'HOAKS', score: 20 },
        { label: 'DISINFORMASI', score: 20 },
        { label: 'NETRAL', score: 10 },
      ],
      explanation: 'Terdeteksi struktur kalimat khas amplifikasi terkoordinasi (astroturfing) dengan ajakan penyeragaman waktu dan tagar buatan.',
      keywords: ['retweet serentak', 'trending topik', 'kompak dan solid', 'viralkan narasi'],
      targetedEntities: ['Ruang Siber Publik'],
      recommendation: 'Pengawasan Jaringan: Terdeteksi pola koordinasi artifisial buzzer. Lakukan pemetaan jejaring akun pada Nexus Graph untuk mengidentifikasi botnet dan aktor pengendali.',
    },
    {
      id: `NRD-${now}-104`,
      timestamp: now - 1000 * 60 * 150, // 2.5 jam lalu
      inputSource: 'url',
      title: 'Disinformasi Pemotongan Video Pos Teritorial',
      rawContent: 'Beredar video viral rekaman kontak senjata di pedalaman yang diklaim sebagai penyerangan baru pos pengamanan TNI AD, padahal rekaman tersebut merupakan dokumentasi lama tahun 2019 yang dipotong konteksnya.',
      input: 'Beredar video viral rekaman kontak senjata di pedalaman yang diklaim sebagai penyerangan baru pos pengamanan TNI AD, padahal rekaman tersebut merupakan dokumentasi lama tahun 2019 yang dipotong konteksnya.',
      sourceMeta: {
        siteName: 'Media Sosial X',
        author: 'Akun Oposisi',
      },
      category: 'DISINFORMASI',
      threatLevel: 'medium',
      confidence: 66,
      mlScore: 68,
      ruleScore: 64,
      scores: [
        { label: 'DISINFORMASI', score: 66 },
        { label: 'HOAKS', score: 42 },
        { label: 'PROPAGANDA', score: 32 },
        { label: 'BUZZER', score: 20 },
        { label: 'NETRAL', score: 15 },
      ],
      explanation: 'Konten manipulasi konteks temporal dengan mempublikasikan video arsip lama seolah-olah peristiwa kontemporer.',
      keywords: ['video viral', 'dipotong konteksnya', 'pos pengamanan tni', 'kontak senjata'],
      targetedEntities: ['TNI AD'],
      recommendation: 'Verifikasi Konteks: Konten memuat pemotongan fakta yang menyesatkan. Dispenad disarankan mempublikasikan dokumentasi utuh/video pembanding untuk meluruskan persepsi publik.',
    },
    {
      id: `NRD-${now}-105`,
      timestamp: now - 1000 * 60 * 240, // 4 jam lalu
      inputSource: 'text',
      title: 'Kegiatan Bakti TNI Manunggal Membangun Desa',
      rawContent: 'Prajurit TNI Angkatan Darat dari Kodim 0734 bersama warga masyarakat menggelar program bakti sosial gotong royong pembersihan aliran sungai dan perbaikan saluran drainase untuk mencegah risiko bencana di wilayah Yogyakarta.',
      input: 'Prajurit TNI Angkatan Darat dari Kodim 0734 bersama warga masyarakat menggelar program bakti sosial gotong royong pembersihan aliran sungai dan perbaikan saluran drainase untuk mencegah risiko bencana di wilayah Yogyakarta.',
      category: 'NETRAL',
      threatLevel: 'low',
      confidence: 92,
      mlScore: 12,
      ruleScore: 10,
      scores: [
        { label: 'NETRAL', score: 92 },
        { label: 'HOAKS', score: 5 },
        { label: 'PROPAGANDA', score: 5 },
        { label: 'BUZZER', score: 5 },
        { label: 'DISINFORMASI', score: 5 },
      ],
      explanation: 'Pemberitaan kegiatan kemanunggalan teritorial rutin TNI AD yang tidak memuat sentimen negatif maupun manipulasi kognitif.',
      keywords: ['tni angkatan darat', 'kodim 0734', 'bakti sosial', 'gotong royong'],
      targetedEntities: ['Kodim 0734', 'TNI AD'],
      recommendation: 'Status Aman: Lanjutkan pemantauan rutin. Konten tidak memerlukan tindakan kontranarasi atau eskalasi komando.',
    },
  ]

  const enhancedItems = demoItems.map((item, idx) => {
    const hashes = [
      '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      'c8b52f36f6d2f317b6299b9cf90b411d7f1d46e16f3933c0ff87d1000632a939',
      '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce',
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
    ]
    return {
      ...item,
      psychology: calculatePsychologyVectors(item.rawContent),
      forensicHash: hashes[idx] || hashes[0]
    }
  })

  try {
    sessionStorage.setItem(STORAGE_KEYS.ANALYSES, JSON.stringify(enhancedItems))
    window.dispatchEvent(new CustomEvent('narada:analyses-updated', { detail: enhancedItems }))
  } catch (err) {
    console.error('[NARADA Storage] Gagal men-seed demo analyses:', err)
  }

  return enhancedItems
}
