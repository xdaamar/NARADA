/**
 * NARADA — Cognitive Threat Defense System
 * Engine Dossier Forensik Medsos Dinamis & Generator Vektor Ancaman Multi-Platform
 * PUSSIBERAD TNI AD × CODEPOLITAN (Sprint 8: Dedicated Social Investigation)
 */

import type { DebunkKnowledgeEntry, ThreatSpectrumCluster } from '../types'
import {
  clusterComments,
  calculateJaccardSimilarity,
  type CopypastaCluster,
  type CommentInput
} from './forensic/jaccard-matrix'
import { analyzeSentiment } from './forensic/sentiment-engine'
import { calculateBurstVelocity, type TimeCommentItem } from './forensic/burst-velocity'

export type CommentTriageCategory = 'ORGANIK' | 'RAWAN_BUZZER' | 'BOT_COPYPASTA'

export interface EnhancedSocialComment {
  id: string
  authorHandle: string
  authorName: string
  avatarLetter: string
  avatarColor: string
  timestampSecondsAgo: number
  intervalSeconds: number
  timestampFormatted: string
  content: string
  likes: number
  sentiment: 'PROVOKATIF' | 'SKEPTIS' | 'NETRAL' | 'POSITIF'
  triageCategory: CommentTriageCategory
  isCopypasta: boolean
  matchedClusterPattern?: string
}

export interface PlatformThreatPreview {
  platform: 'TWITTER' | 'TIKTOK' | 'INSTAGRAM' | 'WHATSAPP'
  platformLabel: string
  accentColor: string
  authorHandle: string
  authorDisplayName: string
  accountMeta: string
  avatarColor: string
  captionText: string
  hashtags: string[]
  metrics: {
    viewsOrPlays: string
    likesOrFavs: string
    sharesOrForwards: string
    commentsCount: string
  }
  directSearchUrl: string
  specialTag?: string
  mediaBadge?: string
}

export interface SocialThreatDossier {
  targetClaim: string
  cluster: ThreatSpectrumCluster
  clusterLabel: string
  clusterColor: string
  interceptedAt: string
  velocityRate: string
  viewsEstimate: string
  sharesEstimate: string
  cibCoordinationIndex: number
  isBuzzerAlarmActive: boolean
  anomalyAlert: string
  escalationLevel: 'FASE 1: INKUBASI SINYAL LEMAH' | 'FASE 2: AMPLIFIKASI BUZZER AKTIF' | 'FASE 3: VIRALITAS ARUS UTAMA'
  rekapKomentar: {
    totalScanned: number
    organikCount: number
    organikPercent: number
    rawanCount: number
    rawanPercent: number
    botCount: number
    botPercent: number
    averageIntervalSeconds: number
    burstVelocityPerMinute: number
  }
  platformPreviews: PlatformThreatPreview[]
  copypastaClusters: CopypastaCluster[]
  commentsStream: EnhancedSocialComment[]
}

const CLUSTER_CONFIG: Record<ThreatSpectrumCluster, { label: string; color: string }> = {
  KEDAULATAN_MILITER: { label: 'Kedaulatan & Alutsista Militer', color: '#EF4444' },
  POLITIK_NEGARA: { label: 'Politik & Stabilitas Negara', color: '#F87171' },
  BENCANA_DARURAT: { label: 'Bencana Alam & Krisis BMKG', color: '#38BDF8' },
  PENIPUAN_BANSOS: { label: 'Penipuan Bansos & Finansial', color: '#FBBF24' },
  KESEHATAN_PANGAN: { label: 'Kesehatan Publik & Pangan', color: '#A78BFA' },
  UMUM_NETRAL: { label: 'Isu Umum & Kebijakan', color: '#94A3B8' }
}

/**
 * Mensintesis dossier forensik media sosial dinamis berdasarkan klaim dan klaster radar
 */
export function generateSocialThreatDossier(entry: Partial<DebunkKnowledgeEntry>): SocialThreatDossier {
  const claim = entry.claim || 'Isu Kontroversial Belum Terverifikasi'
  const cluster = entry.cluster || 'POLITIK_NEGARA'
  const clusterMeta = CLUSTER_CONFIG[cluster] || CLUSTER_CONFIG.POLITIK_NEGARA

  const interceptedAt = entry.interceptedAt || '18:15 WIB'
  const viewsEstimate = entry.engagement?.views || entry.trendTraffic || '+65K'
  const sharesEstimate = entry.engagement?.shares || '3.4K'
  const velocityRate = entry.engagement?.velocityRate || '+180%/jam'

  // Ekstraksi 2-3 kata kunci penting
  const cleanWords = claim
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !['yang', 'untuk', 'dengan', 'dalam', 'tidak', 'pada', 'dari', 'akan'].includes(w.toLowerCase()))
  
  const kw1 = cleanWords[0] || 'Isu'
  const kw2 = cleanWords[1] || 'Viral'
  const kw3 = cleanWords[2] || 'Publik'
  const topicKeyword = `${kw1} ${kw2}`.trim()

  // ─── 1. Sintesis 4 Vektor Postingan Multi-Platform ───
  const encodedQuery = encodeURIComponent(claim)
  const platformPreviews: PlatformThreatPreview[] = [
    {
      platform: 'TWITTER',
      platformLabel: 'X (Twitter Thread)',
      accentColor: '#1DA1F2',
      authorHandle: `@analis_rakyat_${Math.floor(100 + Math.random() * 899)}`,
      authorDisplayName: `Pemerhati ${kw1}`,
      accountMeta: 'Akun dibuat Okt 2026 • 12.4K Pengikut',
      avatarColor: '#1DA1F2',
      captionText: `🚨 BONGKAR FAKTA: Narasi terkait "${claim}" mulai ditutupi media arus utama. Jangan sampai warganet terkecoh oleh pengalihan isu! Silakan simak bukti awal yang beredar di lapangan thread di bawah ini. #KawalFakta #${kw1.replace(/\s+/g, '')} #${kw2.replace(/\s+/g, '')} #${kw3.replace(/\s+/g, '')} #BongkarTuntas`,
      hashtags: [`#KawalFakta`, `#${kw1}`, `#${kw2}`, `#${kw3}`],
      metrics: {
        viewsOrPlays: viewsEstimate,
        likesOrFavs: '8.4K',
        sharesOrForwards: sharesEstimate,
        commentsCount: '1.2K'
      },
      directSearchUrl: `https://twitter.com/search?q=${encodedQuery}&f=live`,
      mediaBadge: 'THREAD (4 TWEET)'
    },
    {
      platform: 'TIKTOK',
      platformLabel: 'TikTok Video (VT)',
      accentColor: '#00F2FE',
      authorHandle: `@suara_kritis_${Math.floor(10 + Math.random() * 89)}`,
      authorDisplayName: 'Kupas Tuntas ID',
      accountMeta: 'Video FYP • Sound: Suara Asli - Detik Menegangkan',
      avatarColor: '#00F2FE',
      captionText: `Ngeri banget kalau ini beneran terjadi! Kabar "${claim}" bikin heboh jagat maya. Sampai sekarang belum ada klarifikasi tegas dari pihak terkait. Share ke keluarga kalian sebelum videonya di-take down! 😱⚠️`,
      hashtags: [`#fyp`, `#beritatiktok`, `#${kw1.toLowerCase()}`, `#viralditiktok`],
      metrics: {
        viewsOrPlays: `${viewsEstimate.replace('+', '')} tayangan`,
        likesOrFavs: '14.2K',
        sharesOrForwards: '6.8K',
        commentsCount: '2.1K'
      },
      directSearchUrl: `https://www.tiktok.com/search?q=${encodedQuery}`,
      specialTag: '🔥 Masuk FYP Algoritma',
      mediaBadge: 'VIDEO VERTIKAL 9:16 (58s)'
    },
    {
      platform: 'INSTAGRAM',
      platformLabel: 'Instagram Reels & Carousel',
      accentColor: '#E1306C',
      authorHandle: `@fakta_tersembunyi.official`,
      authorDisplayName: 'Fakta Tersembunyi RI',
      accountMeta: 'Infografis Publik • 45.2K Followers',
      avatarColor: '#E1306C',
      captionText: `Slide 1-3: Dokumen dan kronologi perbincangan "${claim}". Apakah ini murni aspirasi masyarakat atau ada skenario besar di baliknya? Komen pendapat kalian secara bijak di bawah! 👇`,
      hashtags: [`#infografis`, `#polemiknasional`, `#indonesia2026`],
      metrics: {
        viewsOrPlays: '42.8K jangkauan',
        likesOrFavs: '5.6K',
        sharesOrForwards: '1.9K',
        commentsCount: '890'
      },
      directSearchUrl: `https://www.google.com/search?q=${encodedQuery}+site:instagram.com`,
      mediaBadge: 'CAROUSEL 4 SLIDE'
    },
    {
      platform: 'WHATSAPP',
      platformLabel: 'WhatsApp Chain Broadcast',
      accentColor: '#25D366',
      authorHandle: 'Grup WhatsApp Teritorial / Warga',
      authorDisplayName: 'Pesan Berantai Lintas Komunitas',
      accountMeta: 'Sirkulasi Cepat • Enkripsi End-to-End',
      avatarColor: '#25D366',
      captionText: `*INFO PENTING DAN MENDESAK DARI SUMBER A1* 📢\n\nBapak/Ibu mohon disimak, kabar mengenai: *"${claim}"* saat ini sedang ramai dibicarakan. Dimohon tetap waspada dan saling mengingatkan di lingkungan masing-masing. Jangan tunggu sampai situasi berkembang liar!\n\n_Mohon teruskan ke grup RT/RW dan kerabat dekat demi keselamatan bersama._`,
      hashtags: ['#PesanBerantai', '#GrupKeluarga', '#InfoWarga'],
      metrics: {
        viewsOrPlays: 'Terdokumentasi Masif',
        likesOrFavs: 'N/A',
        sharesOrForwards: '>10K Terusan',
        commentsCount: 'Grup Aktif'
      },
      directSearchUrl: `https://news.google.com/search?q=${encodedQuery}&hl=id&gl=ID`,
      specialTag: '⚠️ Diteruskan berkali-kali'
    }
  ]

  // ─── 2. Sintesis Komentar Kontekstual & Template Copypasta ───
  const templateA = `Viralkan fakta tentang ${topicKeyword}! Jangan mau dibodohi pengalihan isu media!`
  const templateB = `Kawal terus kasus ${kw1}! Usut tuntas siapa dalang di balik semua ini!`
  const templateC = `Bongkar terus biar rakyat melek kebobrokan ini! Viralkan!`

  const rawCommentDrafts: Array<{
    text: string
    author: string
    triageCategory: CommentTriageCategory
    interval: number
  }> = [
    // Kelompok Bot Copypasta Template A (Jeda waktu sangat rapat 1-3 detik)
    { text: templateA, author: '@cyber_hawk_01', triageCategory: 'BOT_COPYPASTA', interval: 2 },
    { text: templateA, author: '@garuda_merah_99', triageCategory: 'BOT_COPYPASTA', interval: 1 },
    { text: templateA, author: '@satria_nkri_id', triageCategory: 'BOT_COPYPASTA', interval: 3 },
    { text: `${templateA} viralkan sekarang!`, author: '@pejuang_opini88', triageCategory: 'BOT_COPYPASTA', interval: 2 },
    { text: templateA, author: '@user91028301', triageCategory: 'BOT_COPYPASTA', interval: 2 },

    // Komentar Rawan Buzzer (Akun baru, provokatif, memancing sentimen)
    { text: `Udah jelas ada yang panik makanya berita ${kw1} ditutup-tutupin! Giliran rakyat kritis langsung dicap pemecah belah!`, author: '@oposisi_garis_depan', triageCategory: 'RAWAN_BUZZER', interval: 6 },
    { text: `Kenapa instansi terkait bungkam dari kemarin? Ada apa sebenarnya di balik ${topicKeyword}? Usut tuntas!`, author: '@mata_rakyat_kritis', triageCategory: 'RAWAN_BUZZER', interval: 5 },
    { text: `Paling ujung-ujungnya klarifikasi normatif minta maaf. Rakyat udah pinter jangan dikira bisa dibohongi lagi!`, author: '@suara_lantang99', triageCategory: 'RAWAN_BUZZER', interval: 7 },
    { text: `Jangan kasih kendor netizen! Tag akun pejabat terkait biar ga pura-pura tidur!`, author: '@anak_bangsa_kecewa', triageCategory: 'RAWAN_BUZZER', interval: 4 },

    // Kelompok Bot Copypasta Template B (Jeda 2-4 detik)
    { text: templateB, author: '@law_defender_ri', triageCategory: 'BOT_COPYPASTA', interval: 2 },
    { text: templateB, author: '@front_kebenaran_02', triageCategory: 'BOT_COPYPASTA', interval: 3 },
    { text: templateB, author: '@suara_bawah_tanah', triageCategory: 'BOT_COPYPASTA', interval: 2 },
    { text: `${templateB} Jangan kasih panggung kompromi!`, author: '@user7712398', triageCategory: 'BOT_COPYPASTA', interval: 3 },

    // Komentar Warganet Organik (Berpikir kritis wajar, mencari bukti, meragukan hoaks)
    { text: `Tunggu dulu kawan-kawan, ini ada rilis resmi atau dokumen autentiknya ga? Jangan langsung percaya potongan klip di medsos.`, author: '@budi_santoso_id', triageCategory: 'ORGANIK', interval: 14 },
    { text: `Perasaan kemarin udah ada bantahan dari dinas terkait deh, tolong admin sertakan link berita utuhnya jangan cuma screenshot sepotong.`, author: '@anisa_rahmawati', triageCategory: 'ORGANIK', interval: 18 },
    { text: `Bahaya banget kalau berita ${kw1} dipelintir kayak gini. Harusnya disaring dulu sebelum ikut-ikutan repost.`, author: '@dimas_adityo', triageCategory: 'ORGANIK', interval: 22 },
    { text: `Saya warga daerah setempat, kondisi di lapangan aman-aman aja kok ga seperti narasi dramatis di video ini.`, author: '@warga_lokal_asli', triageCategory: 'ORGANIK', interval: 27 },

    // Kelompok Bot Copypasta Template C (Jeda 1-3 detik)
    { text: templateC, author: '@silent_majority_id', triageCategory: 'BOT_COPYPASTA', interval: 2 },
    { text: templateC, author: '@revolusi_suara_rakyat', triageCategory: 'BOT_COPYPASTA', interval: 1 },
    { text: templateC, author: '@indo_bersatu_99', triageCategory: 'BOT_COPYPASTA', interval: 3 },

    // Campuran Komentar Rawan & Organik Tambahan
    { text: `Curiga ini sengaja dimunculkan buat pengalihan isu yang lebih besar minggu ini. Hati-hati jangan gampang tersulut emosi.`, author: '@pengamat_santai', triageCategory: 'RAWAN_BUZZER', interval: 8 },
    { text: `Bagi yang punya dokumen resminya mohon di-drop di komentar ya biar kita bisa verifikasi fakta bareng-bareng.`, author: '@kolektif_cekfakta', triageCategory: 'ORGANIK', interval: 19 },
    { text: `Semoga jajaran keamanan segera memberikan penjelasan pers yang transparan supaya masyarakat tidak resah dan terpecah belah.`, author: '@hendro_wijaya', triageCategory: 'ORGANIK', interval: 25 },
    { text: `Siap kawal sampai terang benderang! Kalau beneran salah harus diproses hukum!`, author: '@gardadepan_keadilan', triageCategory: 'RAWAN_BUZZER', interval: 5 },
    { text: `Info dari tetangga sebelah juga bilang hoaks ini, mending kita tunggu jumpa pers resmi dari Humas/Dispen.`, author: '@ibu_retno_komunitas', triageCategory: 'ORGANIK', interval: 31 },
    { text: templateA, author: '@user0098214', triageCategory: 'BOT_COPYPASTA', interval: 2 }
  ]

  // ─── 3. Klastering Jaccard-Levenshtein ───
  const commentInputs: CommentInput[] = rawCommentDrafts.map((d, idx) => ({
    id: `com-${idx + 1}`,
    text: d.text,
    author: d.author
  }))

  const clusterResult = clusterComments(commentInputs, 15)
  const copypastaClusters = clusterResult.clusters

  // ─── 4. Pembentukan Stream Komentar dengan Jeda Detik & Stempel Waktu ───
  let accumulatedSeconds = 8
  const commentsStream: EnhancedSocialComment[] = rawCommentDrafts.map((d, idx) => {
    accumulatedSeconds += d.interval
    const sent = analyzeSentiment(d.text)

    // Cek apakah cocok dengan salah satu klaster copypasta
    const matchedCluster = copypastaClusters.find(c => 
      calculateJaccardSimilarity(d.text, c.templateText) >= 0.65
    )
    const isCopypasta = Boolean(matchedCluster) || d.triageCategory === 'BOT_COPYPASTA'

    const avatarColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']
    const avatarColor = isCopypasta ? '#EF4444' : d.triageCategory === 'RAWAN_BUZZER' ? '#F59E0B' : avatarColors[idx % avatarColors.length]

    return {
      id: `com-${idx + 1}`,
      authorHandle: d.author,
      authorName: d.author.replace('@', '').replace(/[_.]/g, ' ').toUpperCase(),
      avatarLetter: d.author.charAt(1).toUpperCase() || 'U',
      avatarColor,
      timestampSecondsAgo: accumulatedSeconds,
      intervalSeconds: d.interval,
      timestampFormatted: `${accumulatedSeconds} detik lalu (jeda ${d.interval}s)`,
      content: d.text,
      likes: isCopypasta ? Math.floor(Math.random() * 8) : Math.floor(12 + Math.random() * 45),
      sentiment: sent.label,
      triageCategory: isCopypasta ? 'BOT_COPYPASTA' : d.triageCategory,
      isCopypasta,
      matchedClusterPattern: matchedCluster?.templateText
    }
  })

  // ─── 5. Perhitungan Rekapitulasi Status & Anomali ───
  const totalScanned = commentsStream.length
  const botCount = commentsStream.filter(c => c.triageCategory === 'BOT_COPYPASTA').length
  const rawanCount = commentsStream.filter(c => c.triageCategory === 'RAWAN_BUZZER').length
  const organikCount = commentsStream.filter(c => c.triageCategory === 'ORGANIK').length

  const botPercent = Math.round((botCount / totalScanned) * 100)
  const rawanPercent = Math.round((rawanCount / totalScanned) * 100)
  const organikPercent = 100 - botPercent - rawanPercent

  const totalIntervals = rawCommentDrafts.reduce((acc, curr) => acc + curr.interval, 0)
  const averageIntervalSeconds = parseFloat((totalIntervals / totalScanned).toFixed(1))

  // Hitung Burst Velocity via modul resmi
  const timeItems: TimeCommentItem[] = commentsStream.map(c => ({
    id: c.id,
    timestamp: `${Math.round(c.timestampSecondsAgo / 60)} menit lalu`,
    authorHandle: c.authorHandle,
    isSuspiciousBot: c.triageCategory !== 'ORGANIK',
    isCopypastaTemplate: c.isCopypasta
  }))
  const burstData = calculateBurstVelocity(timeItems, botPercent)

  const isBuzzerAlarmActive = botPercent >= 15 || averageIntervalSeconds <= 4.0 || burstData.coordinationIndex >= 70
  const cibCoordinationIndex = Math.min(96, Math.max(68, burstData.coordinationIndex))

  const anomalyAlert = isBuzzerAlarmActive
    ? `🚨 ANOMALI KOORDINASI TINGGI (CIB ${cibCoordinationIndex}/100): Terdeteksi jeda rata-rata ${averageIntervalSeconds}s per komentar dengan ${botCount} akun menyuarakan template identik. Mustahil dilakukan warganet organik secara manual!`
    : `🟢 POLA INTERAKSI BERKEMBANG ORGANIK: Jeda waktu wajar dan rasio polarisasi masih dalam ambang batas pemantauan terkendali.`

  const escalationLevel = cibCoordinationIndex >= 80 
    ? 'FASE 2: AMPLIFIKASI BUZZER AKTIF'
    : botPercent >= 15
    ? 'FASE 1: INKUBASI SINYAL LEMAH'
    : 'FASE 3: VIRALITAS ARUS UTAMA'

  return {
    targetClaim: claim,
    cluster,
    clusterLabel: clusterMeta.label,
    clusterColor: clusterMeta.color,
    interceptedAt,
    velocityRate,
    viewsEstimate,
    sharesEstimate,
    cibCoordinationIndex,
    isBuzzerAlarmActive,
    anomalyAlert,
    escalationLevel,
    rekapKomentar: {
      totalScanned,
      organikCount,
      organikPercent,
      rawanCount,
      rawanPercent,
      botCount,
      botPercent,
      averageIntervalSeconds,
      burstVelocityPerMinute: Math.max(54, burstData.burstVelocityPerMinute)
    },
    platformPreviews,
    copypastaClusters,
    commentsStream
  }
}
