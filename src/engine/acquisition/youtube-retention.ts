/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — YOUTUBE API DATA GOVERNANCE, RETENTION & COMPLIANCE ENGINE
 * SPRINT 11: WORK PACKAGE COMPLIANCE ADDENDUM (SECTIONS III.E.2, III.E.4 & TERMS)
 * PUSSIBERAD TNI AD × CODEPOLITAN (Kartika Cyber Hackathon 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Dasar Kepatuhan Kebijakan Pengembang YouTube (YouTube API Services Developer Policies):
 * 1. Section III.E.2 (Data Aggregation):
 *    - Dilarang mengagregasi YouTube API Data antarpemilik konten / kanal yang berbeda.
 *    - Dilarang menggabungkan metrik YouTube ke dalam metrik lintas-platform tanpa persetujuan tertulis.
 * 2. Section III.E.4 (Data Retention & Deletion):
 *    - Data API YouTube tidak boleh disimpan / di-cache melebihi 30 hari kalender tanpa penyegaran.
 *    - Wajib mendukung penghapusan data atas permintaan pengguna (user deletion requests).
 *    - Data yang kedaluwarsa atau ditarik izinnya harus dimusnahkan dan tidak boleh muncul kembali.
 * 3. Section III.A (API Client Terms & Privacy):
 *    - Tautan eksplisit ke Ketentuan Layanan YouTube (Terms of Service).
 *    - Tautan eksplisit ke Kebijakan Privasi Google.
 *    - Pengungkapan penggunaan YouTube API Services dan tujuan pemrosesan data publik.
 *    - Tautan pencabutan otorisasi melalui Google Security Settings.
 * 4. Section II (Branding & Attribution):
 *    - Atribusi jelas "Data from YouTube" / "Powered by YouTube".
 *    - Disclaimer bahwa analisis intelijen dihasilkan independen oleh NARADA, bukan oleh YouTube.
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  YOUTUBE_CAPABILITY_GATES,
  evaluateYouTubeCapability,
  type YouTubeCapabilityGate,
  type CapabilityStatus
} from './source-contracts.ts'

// ─── KONSTANTA RETENSI & KEBIJAKAN RESMI ───
export const YOUTUBE_MAX_RETENTION_DAYS = 30
export const YOUTUBE_MAX_RETENTION_MS = YOUTUBE_MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000 // 2.592.000.000 ms

// ─── TAUTAN HUKUM & KEBIJAKAN RESMI GOOGLE / YOUTUBE ───
export const YOUTUBE_TERMS_OF_SERVICE_URL = 'https://www.youtube.com/t/terms'
export const GOOGLE_PRIVACY_POLICY_URL = 'http://www.google.com/policies/privacy'
export const GOOGLE_SECURITY_SETTINGS_REVOCATION_URL = 'https://security.google.com/settings/security/permissions'

// ─── DISCLOSURE, ATRIBUSI & DISCLAIMER ───
export const YOUTUBE_API_SERVICES_DISCLOSURE =
  'NARADA menggunakan Layanan API YouTube (YouTube API Services) untuk mengakses metadata publik video dan komentar guna verifikasi disinformasi dan deteksi narasi hoaks. Penggunaan fitur ini tunduk pada Ketentuan Layanan YouTube dan Kebijakan Privasi Google.'

export const YOUTUBE_INDEPENDENT_ANALYSIS_DISCLAIMER =
  'DISCLAIMER RESMI: Penilaian verifikasi klaim, ekstraksi entitas, dan analisis sentimen disinformasi dihasilkan secara independen oleh sistem NARADA Satuan Siber TNI AD (PUSSIBERAD). Penilaian ini BUKAN merupakan pernyataan resmi, dukungan, atau asesmen dari YouTube LLC maupun Google LLC.'

export const YOUTUBE_DATA_PROCESSING_PURPOSE =
  'Tujuan Pemrosesan Data: Membantu analis intelijen mendeteksi peredaran disinformasi publik, klarifikasi hoaks terhadap institusi negara, dan verifikasi sumber terbuka (OSINT). Data yang diproses berupa teks judul, deskripsi publik, serta teks komentar teratas publik.'

export const YOUTUBE_CREDENTIAL_STORAGE_SAFEGUARD =
  'Prinsip Keamanan Kredensial: NARADA TIDAK PERNAH mengumpulkan, meminta, atau menyimpan kredensial login (username/password) pengguna YouTube. Akses hanya menggunakan Google Cloud API Key tingkat aplikasi publik tanpa izin data privat (zero OAuth user login scope).'

export interface YouTubeRetentionAuditRecord {
  recordId: string
  platform: 'youtube'
  channelId?: string
  acquiredAt: number
  retentionDeadline: number
  isExpired: boolean
  daysRemaining: number
}

/**
 * Manajer Tata Kelola Retensi & Kepatuhan Data YouTube API
 */
export class YouTubeDataRetentionManager {
  private maxRetentionMs: number

  constructor(maxRetentionMs = YOUTUBE_MAX_RETENTION_MS) {
    this.maxRetentionMs = maxRetentionMs
  }

  /**
   * Menghitung batas waktu kedaluwarsa (retention deadline)
   */
  public calculateRetentionDeadline(acquiredAt: number): number {
    return acquiredAt + this.maxRetentionMs
  }

  /**
   * Memeriksa apakah suatu rekaman data YouTube telah melampaui batas retensi 30 hari
   */
  public isRecordExpired(
    record: { acquiredAt?: number; discoveredAt?: number; targetPlatform?: string; platform?: string },
    now = Date.now()
  ): boolean {
    const timestamp = record.acquiredAt || record.discoveredAt
    if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) {
      return false
    }
    const age = now - timestamp
    return age >= this.maxRetentionMs
  }

  /**
   * Mengaudit status retensi satu rekaman
   */
  public auditRecordRetention(
    record: { id: string; acquiredAt?: number; discoveredAt?: number; channelId?: string },
    now = Date.now()
  ): YouTubeRetentionAuditRecord {
    const timestamp = record.acquiredAt || record.discoveredAt || now
    const deadline = this.calculateRetentionDeadline(timestamp)
    const isExpired = now >= deadline
    const remainingMs = Math.max(0, deadline - now)
    const daysRemaining = Math.floor(remainingMs / (24 * 60 * 60 * 1000))

    return {
      recordId: record.id,
      platform: 'youtube',
      channelId: record.channelId,
      acquiredAt: timestamp,
      retentionDeadline: deadline,
      isExpired,
      daysRemaining
    }
  }

  /**
   * Memfilter daftar rekaman data YouTube untuk mengeluarkan data yang sudah kedaluwarsa (> 30 hari)
   */
  public filterActiveRecords<T extends { acquiredAt?: number; discoveredAt?: number }>(
    records: T[],
    now = Date.now()
  ): { active: T[]; expired: T[]; expiredCount: number } {
    const active: T[] = []
    const expired: T[] = []

    for (const item of records) {
      if (this.isRecordExpired(item, now)) {
        expired.push(item)
      } else {
        active.push(item)
      }
    }

    return {
      active,
      expired,
      expiredCount: expired.length
    }
  }

  /**
   * Memvalidasi apakah operasi agregasi komentar diperbolehkan oleh Kebijakan Section III.E.2
   */
  public validateCommentAggregation(channelIds: string[]): {
    permitted: boolean
    status: CapabilityStatus
    reason: string
    distinctChannelCount: number
  } {
    const distinct = Array.from(new Set(channelIds.filter(Boolean)))
    if (distinct.length > 1) {
      const evalRes = evaluateYouTubeCapability('YOUTUBE_CROSS_CHANNEL_COMMENT_AGGREGATION', {
        isCrossChannel: true,
        channelIds: distinct
      })
      return {
        permitted: false,
        status: evalRes.status,
        reason: `${evalRes.rationale} (Terdeteksi ${distinct.length} kanal berbeda)`,
        distinctChannelCount: distinct.length
      }
    }

    return {
      permitted: true,
      status: 'PERMITTED',
      reason: 'Operasi komentar berada dalam lingkup 1 kanal tunggal yang sah.',
      distinctChannelCount: distinct.length
    }
  }

  /**
   * Memvalidasi apakah penggabungan metrik lintas-platform diperbolehkan
   */
  public validateCrossPlatformCombination(platforms: string[]): {
    permitted: boolean
    status: CapabilityStatus
    reason: string
  } {
    const hasYouTube = platforms.some(p => p.toLowerCase() === 'youtube')
    const hasOther = platforms.some(p => p.toLowerCase() !== 'youtube')

    if (hasYouTube && hasOther) {
      const evalRes = evaluateYouTubeCapability('YOUTUBE_CROSS_PLATFORM_METRICS_COMBINATION', {
        isCrossPlatform: true
      })
      return {
        permitted: false,
        status: evalRes.status,
        reason: evalRes.rationale
      }
    }

    return {
      permitted: true,
      status: 'PERMITTED',
      reason: 'Operasi metrik tidak mencampur data YouTube ke platform lain.'
    }
  }

  /**
   * Mendapatkan seluruh teks kepatuhan hukum untuk ditampilkan di antarmuka pengguna
   */
  public getComplianceDocumentation(): {
    termsOfServiceUrl: string
    googlePrivacyPolicyUrl: string
    googleRevocationUrl: string
    disclosure: string
    disclaimer: string
    purpose: string
    credentialSafeguard: string
    maxRetentionDays: number
    gates: Record<string, YouTubeCapabilityGate>
  } {
    return {
      termsOfServiceUrl: YOUTUBE_TERMS_OF_SERVICE_URL,
      googlePrivacyPolicyUrl: GOOGLE_PRIVACY_POLICY_URL,
      googleRevocationUrl: GOOGLE_SECURITY_SETTINGS_REVOCATION_URL,
      disclosure: YOUTUBE_API_SERVICES_DISCLOSURE,
      disclaimer: YOUTUBE_INDEPENDENT_ANALYSIS_DISCLAIMER,
      purpose: YOUTUBE_DATA_PROCESSING_PURPOSE,
      credentialSafeguard: YOUTUBE_CREDENTIAL_STORAGE_SAFEGUARD,
      maxRetentionDays: YOUTUBE_MAX_RETENTION_DAYS,
      gates: YOUTUBE_CAPABILITY_GATES
    }
  }
}

export const youtubeRetentionManager = new YouTubeDataRetentionManager()
