/**
 * NARADA — Cognitive Threat Defense System
 * Engine Forensik Postingan Medsos & Pola Buzzer Swarm (Sprint 7C)
 * 
 * Mengintegrasikan Algoritma Jaccard-Levenshtein Matrix, InSet Indonesian Sentiment Engine,
 * Burst Velocity Calculator, dan Generator Kontranarasi 4 Kanal Dispenad & Babinsa.
 */

import { searchLocalDebunk } from './data/debunk-service'
import {
  clusterComments,
  calculateJaccardSimilarity,
  calculateLevenshteinRatio,
  isCopypastaMatch,
  type CopypastaCluster,
  type CommentInput
} from './forensic/jaccard-matrix'
import {
  analyzeSentiment,
  aggregateSentimentMatrix,
  type SentimentLabel
} from './forensic/sentiment-engine'
import {
  calculateBurstVelocity,
  type BurstVelocityResult,
  type TimeCommentItem
} from './forensic/burst-velocity'
import {
  generateCounterNarratives,
  type CounterNarrativeChannels
} from './forensic/counter-narrative-generator'

// Re-export modul forensik agar dapat diakses komponen lain
export {
  calculateJaccardSimilarity,
  calculateLevenshteinRatio,
  isCopypastaMatch,
  clusterComments,
  analyzeSentiment,
  aggregateSentimentMatrix,
  calculateBurstVelocity,
  generateCounterNarratives
}
export type { CopypastaCluster, SentimentLabel, BurstVelocityResult, CounterNarrativeChannels }

// ─── Tipe Data Forensik Medsos ───
export type SocialPlatform = 'INSTAGRAM' | 'TIKTOK' | 'TWITTER' | 'FACEBOOK' | 'THREADS' | 'GENERIC_WEB'

export interface SocialCommentItem {
  id: string
  authorHandle: string
  authorName: string
  avatarLetter: string
  avatarColor: string
  timestamp: string
  content: string
  likes: number
  sentiment: SentimentLabel
  isSuspiciousBot: boolean
  isCopypastaTemplate: boolean
  matchedTemplatePattern?: string
}

export interface SocialPostForensicResult {
  id: string
  url: string
  platform: SocialPlatform
  analyzedAt: string
  author: {
    handle: string
    displayName: string
    isVerified: boolean
    followersCount: number
    accountAgeDays: number
    avatarLetter: string
    avatarColor: string
  }
  post: {
    publishedAt: string
    caption: string
    likesCount: number
    commentsCount: number
    sharesCount: number
    viewsCount?: number
    mediaType: 'VIDEO' | 'IMAGE' | 'THREAD' | 'TEXT'
  }
  cognitiveVerdict: {
    status: 'HOAKS_BERBAHAYA' | 'DISINFORMASI_TERKOORDINASI' | 'KAMPANYE_BUZZER' | 'FAKTA_TERVERIFIKASI' | 'AMBIGU'
    confidenceScore: number // 0 - 100
    classificationBadge: string
    summaryReason: string
    threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  }
  sentimentMatrix: {
    positivePercent: number
    neutralPercent: number
    provocativePercent: number
    dominantSentiment: SentimentLabel
  }
  buzzerForensic: {
    isBuzzerAlarmActive: boolean // true jika copypastaPercent >= 15% atau botRatio >= 30%
    copypastaPercent: number
    burstVelocityPerMinute: number // komentar / menit
    botAccountRatioPercent: number // %
    detectedClusters: CopypastaCluster[]
    coordinationIndex: number // 0 - 100
    swarmAnomalyDescription: string
  }
  tacticalRecommendation: {
    posture: 'NETRALISIR_SEGERA' | 'MONITOR_INTENSIF' | 'COUNTER_NARRATIVE_RESMI' | 'TAKEDOWN_REQUEST'
    officialClarificationDraft: string
    recommendedDispenadProtocol: string
    targetChannels: string[]
    counterNarratives?: CounterNarrativeChannels
  }
  commentsSample: SocialCommentItem[]
}

// ─── Deteksi Platform dari URL ───
export function detectSocialPlatform(url: string): SocialPlatform {
  if (!url) return 'GENERIC_WEB'
  const lower = url.toLowerCase()
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'INSTAGRAM'
  if (lower.includes('tiktok.com')) return 'TIKTOK'
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'TWITTER'
  if (lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.com')) return 'FACEBOOK'
  if (lower.includes('threads.net')) return 'THREADS'
  return 'GENERIC_WEB'
}

// ─── Basis Data Preset Kasus Nyata Siap Audit ───
export const SOCIAL_PRESET_SCENARIOS: SocialPostForensicResult[] = [
  // 1. INSTAGRAM REELS — Hoaks Pengadaan Alutsista Fiktif 24T
  {
    id: 'preset-ig-alutsista-24t',
    url: 'https://www.instagram.com/reel/C8k_x89LMnK/',
    platform: 'INSTAGRAM',
    analyzedAt: '2026-10-25 09:30 WIB',
    author: {
      handle: '@oposisi_gariskeras',
      displayName: 'Front Penegak Kedaulatan',
      isVerified: false,
      followersCount: 4210,
      accountAgeDays: 18,
      avatarLetter: 'F',
      avatarColor: '#EF4444'
    },
    post: {
      publishedAt: '2026-10-24 19:45 WIB',
      caption: 'Bongkar skandal! Anggaran alutsista 24 Triliun diduga dipakai buat beli tank rongsokan dari Eropa Timur yang udah karatan. Uang rakyat dihambur-hamburkan sementara prajurit disuruh tarung nyawa! Share sebelum di-takedown rezim!',
      likesCount: 9840,
      commentsCount: 1420,
      sharesCount: 3120,
      viewsCount: 84200,
      mediaType: 'VIDEO'
    },
    cognitiveVerdict: {
      status: 'KAMPANYE_BUZZER',
      confidenceScore: 94,
      classificationBadge: 'DISINFORMASI MILITER TERORGANISIR',
      summaryReason: 'Video mendaur ulang footage tank latih tahun 2012 yang dipelintir seolah pengadaan alutsista 2024-2026. Terdeteksi anomali 35% komentar copypasta dari kelompok akun anonim baru.',
      threatLevel: 'CRITICAL'
    },
    sentimentMatrix: {
      positivePercent: 12,
      neutralPercent: 20,
      provocativePercent: 68,
      dominantSentiment: 'PROVOKATIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true,
      copypastaPercent: 35,
      burstVelocityPerMinute: 68,
      botAccountRatioPercent: 44,
      coordinationIndex: 88,
      swarmAnomalyDescription: 'Terdeteksi lonjakan 68 komentar/menit dengan 4 variasi kalimat template identik yang diulang secara serempak oleh akun tanpa foto profil.',
      detectedClusters: [
        {
          templateText: 'Bongkar terus rezim panik! Viralkan biar rakyat melek kebobrokan ini!',
          occurrences: 148,
          percentageOfTotal: 10,
          sampleHandles: ['@user892314', '@indo_merdeka99', '@satria_cyber01', '@rakyat_bersatu77', '@garuda_hitam'],
          memberIds: ['c1', 'c3']
        },
        {
          templateText: 'Uang 24T menguap beli besi tua, kemana audit BPK? Usut tuntas!',
          occurrences: 122,
          percentageOfTotal: 9,
          sampleHandles: ['@bot_alutsista', '@prajurit_kecewa', '@reformasi_jilid2', '@mata_elang_ri', '@suara_bawah'],
          memberIds: ['c4']
        },
        {
          templateText: 'Prajurit jadi korban kebiadaban elite politik korup!',
          occurrences: 98,
          percentageOfTotal: 7,
          sampleHandles: ['@pejuang_keadilan_id', '@anti_oligarki88', '@merah_putih_kritis', '@silent_majority9', '@vocal_voice'],
          memberIds: []
        },
        {
          templateText: 'Siap-siap akun ini di-banned, admin hati-hati tetap kawal!',
          occurrences: 74,
          percentageOfTotal: 5,
          sampleHandles: ['@pejuang_subuh_ri', '@tni_bersama_rakyat', '@komando_moral', '@bela_negara_sejati', '@front_pembela_kebenaran'],
          memberIds: []
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'NETRALISIR_SEGERA',
      officialClarificationDraft: 'KLARIFIKASI RESMI DISPENAD: Narasi yang menyebutkan pengadaan tank rongsokan 24 Triliun adalah HOAKS TOTAL. Video yang ditampilkan merupakan dokumentasi latihan gabungan alutsista tahun 2012. Seluruh alutsista TNI AD diadakan melalui mekanisme audit ketat BPK dan Kementerian Pertahanan sesuai standar kelaikan militer internasional.',
      recommendedDispenadProtocol: '1. Rilis video kontra-narasi 60 detik di Instagram @tni_angkatan_darat dan @puspentni dengan watermark "FAKTA TERVERIFIKASI". 2. Kirim laporan terkoordinasi (Coordinated Inauthentic Behavior) ke Meta Indonesia untuk takedown akun penyebar klaster buzzer.',
      targetChannels: ['Instagram Reels', 'TikTok', 'WhatsApp Group Babinsa'],
      counterNarratives: generateCounterNarratives(
        'Pengadaan tank rongsokan fiktif 24 triliun TNI AD',
        {
          claim: 'Pengadaan tank rongsokan fiktif 24 Triliun',
          clarification: 'Video merupakan dokumentasi latihan tempur gabungan tahun 2012 yang dipelintir. Tidak ada pengadaan fiktif 24T; seluruh belanja alutsista diaudit BPK.',
          officialSource: 'Dispenad & Kemhan RI',
          sourceUrl: 'https://tniad.mil.id'
        },
        'INSTAGRAM'
      )
    },
    commentsSample: [
      {
        id: 'c1',
        authorHandle: '@user892314',
        authorName: 'Rakyat Sadar',
        avatarLetter: 'R',
        avatarColor: '#64748B',
        timestamp: '1 menit lalu',
        content: 'Bongkar terus rezim panik! Viralkan biar rakyat melek kebobrokan ini!',
        likes: 24,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Bongkar terus rezim panik'
      },
      {
        id: 'c2',
        authorHandle: '@hendra_gunawan',
        authorName: 'Hendra Gunawan',
        avatarLetter: 'H',
        avatarColor: '#3B82F6',
        timestamp: '2 menit lalu',
        content: 'Ini video lama deh min, perasaan tahun 2012 udah pernah liat pas pameran alutsista di Monas.',
        likes: 89,
        sentiment: 'NETRAL',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      },
      {
        id: 'c3',
        authorHandle: '@indo_merdeka99',
        authorName: 'Indo Merdeka',
        avatarLetter: 'I',
        avatarColor: '#EF4444',
        timestamp: '3 menit lalu',
        content: 'Bongkar terus rezim panik! Viralkan biar rakyat melek kebobrokan ini!',
        likes: 18,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Bongkar terus rezim panik'
      },
      {
        id: 'c4',
        authorHandle: '@bot_alutsista',
        authorName: 'Pemerhati Militer',
        avatarLetter: 'P',
        avatarColor: '#10B981',
        timestamp: '4 menit lalu',
        content: 'Uang 24T menguap beli besi tua, kemana audit BPK? Usut tuntas!',
        likes: 31,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Uang 24T menguap beli besi tua'
      },
      {
        id: 'c5',
        authorHandle: '@siti_rahmawati',
        authorName: 'Siti Rahmawati',
        avatarLetter: 'S',
        avatarColor: '#8B5CF6',
        timestamp: '5 menit lalu',
        content: 'Tetap dukung TNI menjaga kedaulatan NKRI! Jangan mudah terhasut video editan tanpa sumber jelas.',
        likes: 142,
        sentiment: 'POSITIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      }
    ]
  },

  // 2. TIKTOK — Megathrust BMKG Jam 23.00 (Kepanikan Publik)
  {
    id: 'preset-tiktok-megathrust-2300',
    url: 'https://www.tiktok.com/@kabar_akhirzaman/video/7391823901239',
    platform: 'TIKTOK',
    analyzedAt: '2026-10-25 09:32 WIB',
    author: {
      handle: '@kabar_akhirzaman',
      displayName: 'Waspada Bencana RI',
      isVerified: false,
      followersCount: 18500,
      accountAgeDays: 42,
      avatarLetter: 'W',
      avatarColor: '#F59E0B'
    },
    post: {
      publishedAt: '2026-10-24 21:15 WIB',
      caption: 'PERINGATAN BMKG! Malam ini jam 23.00 WIB gempa megathrust 9.1 SR diprediksi mengguncang Jakarta dan pesisir selatan Jawa. Sirine tsunami sudah disiapkan. Keluar rumah sekarang sebelum terlambat!! Sebarkan ke keluarga tercinta! 🚨🌊',
      likesCount: 41200,
      commentsCount: 3890,
      sharesCount: 28500,
      viewsCount: 520000,
      mediaType: 'VIDEO'
    },
    cognitiveVerdict: {
      status: 'HOAKS_BERBAHAYA',
      confidenceScore: 98,
      classificationBadge: 'MANIPULASI KEPANIKAN BENCANA ALAM',
      summaryReason: 'Pencatutan nama BMKG secara ilegal dengan klaim waktu pasti gempa (jam 23.00). Berdasarkan sains seismologi dunia, waktu terjadinya gempa tektonik belum dapat diprediksi secara eksak.',
      threatLevel: 'CRITICAL'
    },
    sentimentMatrix: {
      positivePercent: 14,
      neutralPercent: 14,
      provocativePercent: 72,
      dominantSentiment: 'PROVOKATIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true,
      copypastaPercent: 31,
      burstVelocityPerMinute: 142,
      botAccountRatioPercent: 28,
      coordinationIndex: 79,
      swarmAnomalyDescription: 'Velocity ekstrem mencapai 142 komentar/menit. Kolom komentar didominasi histeria massa buatan dan pesan berantai WA copy-paste.',
      detectedClusters: [
        {
          templateText: 'Beneran ya Allah, merinding banget Jakarta gimana ini keluar rumah ga ya 😭',
          occurrences: 210,
          percentageOfTotal: 12,
          sampleHandles: ['@anisafitri99', '@putra_jaksel', '@tiara_lestari', '@dian_pertiwi', '@bintang_timur'],
          memberIds: ['ct1']
        },
        {
          templateText: 'BMKG udah rilis resmi ya teman-teman, jangan anggap remeh siaga sekarang!',
          occurrences: 174,
          percentageOfTotal: 10,
          sampleHandles: ['@akun_panik1', '@info_siaga_id', '@berita_hot_indo', '@warga_depok', '@netizen_cemas'],
          memberIds: []
        },
        {
          templateText: 'Share ke grup WA keluarga cepetan sebelum mati lampu dan sinyal hilang!',
          occurrences: 156,
          percentageOfTotal: 9,
          sampleHandles: ['@wa_blaster', '@keluarga_cemara', '@update_gempa_24h', '@kabar_terdepan', '@viral_hari_ini'],
          memberIds: []
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'COUNTER_NARRATIVE_RESMI',
      officialClarificationDraft: 'KLARIFIKASI RESMI BMKG × PUSSIBERAD: Pesan yang menyatakan gempa megathrust akan terjadi malam ini pukul 23.00 WIB adalah HOAKS BERBAHAYA. Hingga saat ini tidak ada satupun teknologi di dunia yang dapat memprediksi waktu pasti (hari, jam, menit) terjadinya gempa bumi. Masyarakat diimbau tetap tenang dan hanya memantau kanal resmi @infobmkg.',
      recommendedDispenadProtocol: '1. Perintahkan jajaran Babinsa Kodam Jaya dan Kodam III/Siliwangi turun menenangkan warga di wilayah pesisir. 2. Sebarkan banner klarifikasi resmi di seluruh kanal radio daerah dan videotron kota.',
      targetChannels: ['TikTok FYP', 'Instagram Stories', 'Jaringan Babinsa'],
      counterNarratives: generateCounterNarratives(
        'Prediksi gempa megathrust jam 23.00 WIB BMKG',
        {
          claim: 'Gempa megathrust jam 23.00 WIB BMKG',
          clarification: 'BMKG tidak pernah merilis prediksi waktu spesifik gempa bumi. Sains seismologi dunia belum mampu memprediksi jam dan hari terjadinya gempa secara presisi.',
          officialSource: 'Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)',
          sourceUrl: 'https://bmkg.go.id'
        },
        'TIKTOK'
      )
    },
    commentsSample: [
      {
        id: 'ct1',
        authorHandle: '@anisafitri99',
        authorName: 'Anisa Fitri',
        avatarLetter: 'A',
        avatarColor: '#EC4899',
        timestamp: '30 detik lalu',
        content: 'Beneran ya Allah, merinding banget Jakarta gimana ini keluar rumah ga ya 😭',
        likes: 18,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Beneran ya Allah, merinding banget'
      },
      {
        id: 'ct2',
        authorHandle: '@edukasi_gempa',
        authorName: 'Edukasi Bencana',
        avatarLetter: 'E',
        avatarColor: '#10B981',
        timestamp: '1 menit lalu',
        content: 'HOAKS ini guys! BMKG udah berkali-kali bilang gempa ga bisa diprediksi jamnya. Tolong jangan bikin panik!',
        likes: 340,
        sentiment: 'POSITIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      }
    ]
  },

  // 3. TWITTER / X — Disinformasi Pembakaran Kampung di Intan Jaya
  {
    id: 'preset-x-separatisme-papua',
    url: 'https://x.com/papua_merdeka_free/status/1812938102931',
    platform: 'TWITTER',
    analyzedAt: '2026-10-25 09:35 WIB',
    author: {
      handle: '@papua_merdeka_free',
      displayName: 'Voice of West Papua',
      isVerified: false,
      followersCount: 12400,
      accountAgeDays: 620,
      avatarLetter: 'V',
      avatarColor: '#10B981'
    },
    post: {
      publishedAt: '2026-10-24 16:30 WIB',
      caption: 'URGENT: Indonesian military forces allegedly burned down civilian houses in Intan Jaya, displacing hundreds of indigenous families into the forest. Stand with West Papua! Stop the genocide! #FreeWestPapua #PapuaMerdeka',
      likesCount: 5400,
      commentsCount: 890,
      sharesCount: 4200,
      viewsCount: 125000,
      mediaType: 'THREAD'
    },
    cognitiveVerdict: {
      status: 'DISINFORMASI_TERKOORDINASI',
      confidenceScore: 92,
      classificationBadge: 'NARASI SEPARATISME & RECYCLED MEDIA',
      summaryReason: 'Foto kebakaran yang diunggah terbukti merupakan arsip kebakaran di Sumba Timur NTT tahun 2021 yang digunakan ulang untuk memicu kemarahan internasional terhadap aparat TNI.',
      threatLevel: 'CRITICAL'
    },
    sentimentMatrix: {
      positivePercent: 18,
      neutralPercent: 12,
      provocativePercent: 70,
      dominantSentiment: 'PROVOKATIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true,
      copypastaPercent: 31,
      burstVelocityPerMinute: 45,
      botAccountRatioPercent: 52,
      coordinationIndex: 82,
      swarmAnomalyDescription: 'Terdeteksi koordinasi botnet luar negeri (bot farm) yang meramaikan balasan dalam bahasa Inggris dengan kalimat identik "Stop human rights violations in West Papua".',
      detectedClusters: [
        {
          templateText: 'Stop human rights violations in West Papua! The world is watching your crimes!',
          occurrences: 124,
          percentageOfTotal: 14,
          sampleHandles: ['@papua_free_global', '@aus_activist_7', '@pacific_rights', '@humanity_now_nz', '@solidarity_melanesia'],
          memberIds: ['cx1']
        },
        {
          templateText: 'TNI jangan dzalim pada rakyat kecil, ingat sumpah prajurit pertanggungjawaban di akhirat!',
          occurrences: 92,
          percentageOfTotal: 10,
          sampleHandles: ['@suara_nurani_ri', '@umat_bangkit99', '@keadilan_sosial_id', '@pena_rakyat', '@nurani_bangsa'],
          memberIds: []
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'TAKEDOWN_REQUEST',
      officialClarificationDraft: 'FACT CHECK KOGNITIF: Klaim pembakaran perkampungan di Intan Jaya adalah DISINFORMASI DENGAN GAMBAR DAUR ULANG (RECYCLED MEDIA). Foto yang disebarkan adalah kebakaran akibat korsleting di Kabupaten Sumba Timur pada 14 Oktober 2021. Situasi di Intan Jaya terpantau aman dan kondusif dalam pengamanan Kodim bersama warga.',
      recommendedDispenadProtocol: '1. Koordinasikan pengiriman laporan takedown cepat (Violent Incitement) ke Global Trust & Safety X. 2. Terbitkan rilis pers dwibahasa (ID/EN) oleh Kapuspen TNI untuk konsumsi atase pertahanan dan media internasional.',
      targetChannels: ['X / Twitter', 'Portal Berita Mabes TNI', 'Atase Pertahanan'],
      counterNarratives: generateCounterNarratives(
        'Tuduhan pembakaran perkampungan warga sipil oleh TNI di Intan Jaya Papua',
        {
          claim: 'TNI membakar perkampungan warga di Intan Jaya',
          clarification: 'Foto adalah dokumentasi kebakaran korsleting di Sumba Timur NTT tahun 2021. Wilayah Intan Jaya kondusif dalam pengamanan Babinsa dan Satgas Pamtas.',
          officialSource: 'Puspen TNI & Pendam XVII/Cenderawasih',
          sourceUrl: 'https://tni.mil.id'
        },
        'TWITTER'
      )
    },
    commentsSample: [
      {
        id: 'cx1',
        authorHandle: '@papua_free_global',
        authorName: 'Global Papua',
        avatarLetter: 'G',
        avatarColor: '#10B981',
        timestamp: '1 menit lalu',
        content: 'Stop human rights violations in West Papua! The world is watching your crimes!',
        likes: 12,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Stop human rights violations'
      },
      {
        id: 'cx2',
        authorHandle: '@tito_kurniawan',
        authorName: 'Tito Kurniawan',
        avatarLetter: 'T',
        avatarColor: '#3B82F6',
        timestamp: '3 menit lalu',
        content: 'Woy itu foto kebakaran rumah di Sumba NTT tahun 2021! Jangan asal comot foto buat adu domba!',
        likes: 215,
        sentiment: 'POSITIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      }
    ]
  },

  // 4. FACEBOOK — Broadcast Hoaks Bansos Uang Tunai 5 Juta Kemensos
  {
    id: 'preset-fb-bansos-5jt',
    url: 'https://www.facebook.com/groups/bansos.pkh.2026/posts/948271049281/',
    platform: 'FACEBOOK',
    analyzedAt: '2026-10-25 09:38 WIB',
    author: {
      handle: 'Admin Info Bansos Resmi RI',
      displayName: 'Kemensos RI Bantuan Rakyat (Fanpage)',
      isVerified: false,
      followersCount: 890,
      accountAgeDays: 3,
      avatarLetter: 'K',
      avatarColor: '#EF4444'
    },
    post: {
      publishedAt: '2026-10-24 14:10 WIB',
      caption: 'Kabar Gembira! Bantuan Langsung Tunai (BLT) Kesejahteraan Rp 5.000.000 tahap 1 tahun 2026 sudah mulai dicairkan mulai hari ini untuk pemilik KTP dan KK. Pendaftaran hanya dibuka 24 jam di link resmi: http://bansos-kemensos-cair5jt.top/daftar. Segera daftar sebelum kuota habis!',
      likesCount: 1950,
      commentsCount: 840,
      sharesCount: 2100,
      viewsCount: 46000,
      mediaType: 'TEXT'
    },
    cognitiveVerdict: {
      status: 'HOAKS_BERBAHAYA',
      confidenceScore: 99,
      classificationBadge: 'SYBIL ATTACK PHISHING BANSOS',
      summaryReason: 'Tautan mengarah ke domain phishing .top untuk mencuri NIK KTP, nomor rekening, dan OTP perbankan warga. Dikuatkan oleh armada buzzer pemberi testimoni fiktif.',
      threatLevel: 'HIGH'
    },
    sentimentMatrix: {
      positivePercent: 70, // Testimoni buzzer buatan
      neutralPercent: 10,
      provocativePercent: 20,
      dominantSentiment: 'POSITIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true,
      copypastaPercent: 40,
      burstVelocityPerMinute: 28,
      botAccountRatioPercent: 65,
      coordinationIndex: 91,
      swarmAnomalyDescription: 'Armada buzzer merekayasa sentimen "positif" palsu berupa testimoni sukses penarikan uang 5 juta guna meyakinkan korban mengisi form phishing.',
      detectedClusters: [
        {
          templateText: 'Alhamdulillah barusan dicek saldo rekening nambah 5 juta, terima kasih Pak Presiden!',
          occurrences: 142,
          percentageOfTotal: 17,
          sampleHandles: ['Budi Santoso', 'Sri Mulyati', 'Agus Supriatna', 'Dewi Lestari', 'Slamet Riyadi'],
          memberIds: ['cfb1']
        },
        {
          templateText: 'Awalnya ragu tapi pas coba isi form beneran cair, ayo buruan daftar sebelum ditutup!',
          occurrences: 110,
          percentageOfTotal: 13,
          sampleHandles: ['Rina Wulandari', 'Bambang Irawan', 'Siti Aminah', 'Eko Prasetyo', 'Nurul Hidayah'],
          memberIds: []
        }
      ]
    },
    tacticalRecommendation: {
      posture: 'TAKEDOWN_REQUEST',
      officialClarificationDraft: 'PERINGATAN RESMI KEMENSOS & PUSSIBERAD: Tautan "bansos-kemensos-cair5jt.top" adalah SITUS PHISHING PENIPUAN PENCURIAN DATA PRIBADI. Kemensos tidak pernah menyalurkan bantuan Rp 5 juta dengan pendaftaran melalui tautan domain tidak resmi (.top/.xyz). Portal resmi bansos hanya melalui cekbansos.kemensos.go.id.',
      recommendedDispenadProtocol: '1. Mintakan pemblokiran domain darurat ke Ditjen Aptika Kominfo (TrustPositif). 2. Laporkan fanpage penipuan ke Meta Cyber Crime Unit untuk suspensi permanen.',
      targetChannels: ['Facebook Groups', 'Portal Resmi Kemensos', 'WhatsApp Warga'],
      counterNarratives: generateCounterNarratives(
        'Pencairan dana bansos tunai 5 juta pendaftaran via link phising',
        {
          claim: 'Pencairan bansos tunai 5 juta rupiah via link domain asing',
          clarification: 'Kemensos tidak pernah menyalurkan bansos melalui formulir link asing (.top/.xyz). Pengecekan bansos hanya melalui cekbansos.kemensos.go.id.',
          officialSource: 'Kementerian Sosial RI & Pussiberad',
          sourceUrl: 'https://cekbansos.kemensos.go.id'
        },
        'FACEBOOK'
      )
    },
    commentsSample: [
      {
        id: 'cfb1',
        authorHandle: 'Budi Santoso',
        authorName: 'Budi Santoso',
        avatarLetter: 'B',
        avatarColor: '#3B82F6',
        timestamp: '2 menit lalu',
        content: 'Alhamdulillah barusan dicek saldo rekening nambah 5 juta, terima kasih Pak Presiden!',
        likes: 14,
        sentiment: 'POSITIF',
        isSuspiciousBot: true,
        isCopypastaTemplate: true,
        matchedTemplatePattern: 'Alhamdulillah barusan dicek saldo'
      },
      {
        id: 'cfb2',
        authorHandle: 'Relawan Siber Kemensos',
        authorName: 'Relawan Anti Hoaks',
        avatarLetter: 'R',
        avatarColor: '#EF4444',
        timestamp: '5 menit lalu',
        content: 'Waspada penipuan! Kemensos ga pernah pake domain .top! Jangan kasih NIK atau foto KTP kalian!',
        likes: 67,
        sentiment: 'PROVOKATIF',
        isSuspiciousBot: false,
        isCopypastaTemplate: false
      }
    ]
  }
]

// ─── Ekstraksi & Forensik Postingan Fleksibel (URL Nyata / Custom Input) ───
export async function analyzeSocialPost(
  url: string,
  customPostText?: string,
  rawCommentsText?: string
): Promise<SocialPostForensicResult> {
  // 1. Cek apakah cocok dengan salah satu preset (berdasarkan kecocokan URL)
  const matchedPreset = SOCIAL_PRESET_SCENARIOS.find(p => 
    url && p.url.toLowerCase().trim() === url.toLowerCase().trim()
  )
  if (matchedPreset && !customPostText && !rawCommentsText) {
    return matchedPreset
  }

  // 2. Deteksi platform
  const platform = detectSocialPlatform(url)

  // 3. Evaluasi naskah klaim
  const textToAnalyze = (customPostText || url || '').trim()
  const matchResult = searchLocalDebunk(textToAnalyze)
  const topMatch = matchResult.matched && matchResult.entry ? matchResult.entry : null

  // 4. Proses komentar custom jika ada, atau buat data terstruktur
  let commentsSample: SocialCommentItem[] = []
  let detectedClusters: CopypastaCluster[] = []
  let copypastaPercent = 0
  let isBuzzerAlarmActive = false

  if (rawCommentsText && rawCommentsText.trim().length > 0) {
    const rawLines = rawCommentsText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    const commentInputs: CommentInput[] = rawLines.map((line, idx) => ({
      id: `custom-c-${idx}`,
      text: line,
      author: `@netizen_${100 + idx}`,
      timestamp: `${idx + 1} menit lalu`
    }))

    // Jalankan Jaccard-Levenshtein Clusterer
    const clusterResult = clusterComments(commentInputs, 15)
    detectedClusters = clusterResult.clusters
    copypastaPercent = clusterResult.copypastaPercent
    isBuzzerAlarmActive = clusterResult.isBuzzerAlarmActive

    // Analisis sentimen tiap baris menggunakan InSet Sentiment Engine
    commentsSample = rawLines.map((line, idx) => {
      const sent = analyzeSentiment(line)
      const isTemplate = detectedClusters.some(c => calculateJaccardSimilarity(line, c.templateText) >= 0.65)
      const matched = detectedClusters.find(c => calculateJaccardSimilarity(line, c.templateText) >= 0.65)

      return {
        id: `custom-c-${idx}`,
        authorHandle: `@netizen_${100 + idx}`,
        authorName: `Pengguna ${100 + idx}`,
        avatarLetter: 'U',
        avatarColor: isTemplate ? '#EF4444' : '#64748B',
        timestamp: `${idx + 1} menit lalu`,
        content: line,
        likes: Math.floor(Math.random() * 20),
        sentiment: sent.label,
        isSuspiciousBot: isTemplate,
        isCopypastaTemplate: isTemplate,
        matchedTemplatePattern: matched ? matched.templateText.slice(0, 25) + '...' : undefined
      }
    })
  } else {
    // Buat sampel terstandarisasi berdasarkan hasil pencarian semantik
    const keyword = topMatch ? topMatch.claim.slice(0, 30) : 'Isu Kontroversial'
    const template1 = `Viralkan fakta tentang ${keyword}! Jangan mau dibodohi narasi media penguasa!`
    const template2 = `Kawal terus kasus ini sampai tuntas! Usut aliran dananya!`

    const simulatedLines = [
      { text: template1, author: '@cyber_fighter1', isBot: true },
      { text: topMatch ? `Mohon cek sumber resminya ya kawan, ini sudah diklarifikasi oleh ${topMatch.officialSource}: ${topMatch.clarification}` : 'Tolong sertakan bukti autentik dari dokumen resmi.', author: '@warga_bijak', isBot: false },
      { text: template1, author: '@suara_rakyat_bebas', isBot: true },
      { text: template2, author: '@law_enforcer9', isBot: true },
      { text: template1, author: '@garuda_netizen', isBot: true },
      { text: 'Semoga ada pencerahan resmi dari komando agar warga tidak cemas.', author: '@bela_nkri', isBot: false },
      { text: template2, author: '@mata_kritis_ri', isBot: true }
    ]

    const commentInputs: CommentInput[] = simulatedLines.map((s, idx) => ({
      id: `gen-${idx}`,
      text: s.text,
      author: s.author,
      timestamp: `${idx + 1} menit lalu`
    }))

    const clusterResult = clusterComments(commentInputs, 15)
    detectedClusters = clusterResult.clusters
    copypastaPercent = clusterResult.copypastaPercent
    isBuzzerAlarmActive = clusterResult.isBuzzerAlarmActive

    commentsSample = simulatedLines.map((s, idx) => {
      const sent = analyzeSentiment(s.text)
      const isTemplate = detectedClusters.some(c => calculateJaccardSimilarity(s.text, c.templateText) >= 0.65)
      const matched = detectedClusters.find(c => calculateJaccardSimilarity(s.text, c.templateText) >= 0.65)

      return {
        id: `gen-${idx}`,
        authorHandle: s.author,
        authorName: s.author.replace('@', '').replace('_', ' ').toUpperCase(),
        avatarLetter: s.author.charAt(1).toUpperCase(),
        avatarColor: isTemplate ? '#EF4444' : '#3B82F6',
        timestamp: `${idx + 1} menit lalu`,
        content: s.text,
        likes: Math.floor(Math.random() * 40),
        sentiment: sent.label,
        isSuspiciousBot: s.isBot,
        isCopypastaTemplate: isTemplate,
        matchedTemplatePattern: matched ? matched.templateText.slice(0, 25) + '...' : undefined
      }
    })
  }

  // 5. Agregasi Matriks Sentimen Mekanikal (InSet Lexicon)
  const sentimentMatrix = aggregateSentimentMatrix(commentsSample)

  // 6. Hitung Burst Velocity & Indeks Koordinasi
  const timeItems: TimeCommentItem[] = commentsSample.map(c => ({
    id: c.id,
    timestamp: c.timestamp,
    authorHandle: c.authorHandle,
    isSuspiciousBot: c.isSuspiciousBot,
    isCopypastaTemplate: c.isCopypastaTemplate
  }))
  const burstResult = calculateBurstVelocity(timeItems, copypastaPercent)

  // Evaluasi kembali apakah alarm aktif berdasarkan copypasta ATAU burst velocity
  const finalBuzzerAlarmActive = isBuzzerAlarmActive || burstResult.isBurstAnomalyActive || burstResult.coordinationIndex >= 70

  // 7. Formulasi Generator Kontranarasi 4 Kanal
  const counterNarratives = generateCounterNarratives(textToAnalyze, topMatch || undefined, platform)

  // 8. Bentuk Objek Hasil Forensik Utuh
  const result: SocialPostForensicResult = {
    id: `forensic-${Date.now()}`,
    url: url || 'https://instagram.com/p/unknown',
    platform,
    analyzedAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB',
    author: {
      handle: `@akun_${platform.toLowerCase()}_analisis`,
      displayName: 'Entitas Terduga Kampanye',
      isVerified: false,
      followersCount: 3450,
      accountAgeDays: 24,
      avatarLetter: platform.charAt(0),
      avatarColor: '#6366F1'
    },
    post: {
      publishedAt: 'Beberapa jam lalu',
      caption: textToAnalyze || 'Postingan media sosial dengan potensi perang kognitif dan polarisasi opini publik.',
      likesCount: 3200,
      commentsCount: Math.max(450, commentsSample.length * 15),
      sharesCount: 1120,
      viewsCount: 28400,
      mediaType: platform === 'TIKTOK' || platform === 'INSTAGRAM' ? 'VIDEO' : 'TEXT'
    },
    cognitiveVerdict: {
      status: finalBuzzerAlarmActive ? 'KAMPANYE_BUZZER' : topMatch ? 'HOAKS_BERBAHAYA' : 'AMBIGU',
      confidenceScore: topMatch ? matchResult.confidence : finalBuzzerAlarmActive ? 91 : 65,
      classificationBadge: topMatch 
        ? `TERDETEKSI COCOK KASUS ${topMatch.cluster}` 
        : finalBuzzerAlarmActive 
        ? 'COORDINATED BUZZER SWARM' 
        : 'ANALISIS KONTEN UMUM',
      summaryReason: topMatch 
        ? `Naskah memiliki kemiripan semantik tinggi dengan data klarifikasi Mafindo/Dispenad: "${topMatch.clarification}"`
        : finalBuzzerAlarmActive 
        ? `Terdeteksi ${copypastaPercent}% komentar template identik yang memenuhi ambang batas alarm kampanye buzzer (>= 15%).`
        : 'Pola komentar masih dalam batas variasi wajar diskusi publik.',
      threatLevel: finalBuzzerAlarmActive || (topMatch && matchResult.confidence >= 90) ? 'CRITICAL' : 'MEDIUM'
    },
    sentimentMatrix: {
      positivePercent: sentimentMatrix.positivePercent,
      neutralPercent: sentimentMatrix.neutralPercent,
      provocativePercent: sentimentMatrix.provocativePercent,
      dominantSentiment: sentimentMatrix.dominantSentiment
    },
    buzzerForensic: {
      isBuzzerAlarmActive: finalBuzzerAlarmActive,
      copypastaPercent,
      burstVelocityPerMinute: burstResult.burstVelocityPerMinute,
      botAccountRatioPercent: burstResult.botAccountRatioPercent,
      detectedClusters,
      coordinationIndex: burstResult.coordinationIndex,
      swarmAnomalyDescription: burstResult.swarmAnomalyDescription
    },
    tacticalRecommendation: {
      posture: finalBuzzerAlarmActive ? 'NETRALISIR_SEGERA' : 'MONITOR_INTENSIF',
      officialClarificationDraft: counterNarratives.dispenadOfficial,
      recommendedDispenadProtocol: 'Pantau eskalasi sentimen selama 2 jam ke depan dan gunakan naskah 4 kanal Dispenad/Babinsa untuk netralisir serempak.',
      targetChannels: [platform, 'WhatsApp Babinsa', 'Portal Resmi Dispenad'],
      counterNarratives
    },
    commentsSample
  }

  return result
}

// ─── 9. FUNGSI SIMULASI INJEKSI BUZZER SWARM (+30 KOMENTAR IDENTIK) ───
export function injectBuzzerSwarm(
  baseResult: SocialPostForensicResult,
  customTemplate = 'Viralkan terus kawan-kawan! Jangan biarkan rezim panik tidur nyenyak! Usut tuntas kebobrokan ini!'
): SocialPostForensicResult {
  const injectedComments: SocialCommentItem[] = []
  
  // Suntik 25 komentar identik / variasi typo
  const botNames = [
    'Garuda Hitam', 'Satria Siber 01', 'Rakyat Bersatu 77', 'Pejuang Keadilan',
    'Anti Oligarki 88', 'Pemerhati Militer', 'Indo Merdeka 99', 'Suara Bawah',
    'Mata Elang RI', 'Prajurit Kecewa', 'Front Kebenaran', 'Pejuang Subuh RI',
    'Cyber Army ID', 'Satu Komando', 'Buzzer Pembela', 'Netizen Kritis'
  ]

  for (let i = 0; i < 25; i++) {
    const botHandle = `@bot_swarm_${100 + i}`
    const botName = botNames[i % botNames.length]
    // Variasi penulisan typo buzzer realistis
    let content = customTemplate
    if (i % 4 === 1) content = customTemplate.replace('Viralkan', 'Viralkannn')
    else if (i % 4 === 2) content = customTemplate.replace('panik', 'panikk bgt')
    else if (i % 4 === 3) content = customTemplate.replace('Usut tuntas', 'Usut tuntas aliran dana')

    injectedComments.push({
      id: `injected-${i}`,
      authorHandle: botHandle,
      authorName: `${botName} #${i + 1}`,
      avatarLetter: botName.charAt(0),
      avatarColor: '#EF4444',
      timestamp: `${Math.floor(i / 5) + 1} menit lalu`,
      content,
      likes: Math.floor(Math.random() * 15),
      sentiment: 'PROVOKATIF',
      isSuspiciousBot: true,
      isCopypastaTemplate: true,
      matchedTemplatePattern: customTemplate.slice(0, 30) + '...'
    })
  }

  // Gabungkan dengan sampel asli
  const combinedComments = [...injectedComments, ...baseResult.commentsSample]

  // Re-cluster dengan algoritma Jaccard-Levenshtein
  const commentInputs: CommentInput[] = combinedComments.map(c => ({
    id: c.id,
    text: c.content,
    author: c.authorHandle,
    timestamp: c.timestamp
  }))

  const clusterResult = clusterComments(commentInputs, 15)
  const sentimentMatrix = aggregateSentimentMatrix(combinedComments)
  
  const timeItems: TimeCommentItem[] = combinedComments.map(c => ({
    id: c.id,
    timestamp: c.timestamp,
    authorHandle: c.authorHandle,
    isSuspiciousBot: c.isSuspiciousBot,
    isCopypastaTemplate: c.isCopypastaTemplate
  }))
  const burstResult = calculateBurstVelocity(timeItems, clusterResult.copypastaPercent)

  return {
    ...baseResult,
    cognitiveVerdict: {
      ...baseResult.cognitiveVerdict,
      status: 'KAMPANYE_BUZZER',
      threatLevel: 'CRITICAL',
      classificationBadge: 'COORDINATED BUZZER SWARM DETECTED',
      summaryReason: `Terdeteksi suntikan massal ${clusterResult.copypastaPercent}% komentar template copypasta identik dalam tempo <5 menit (Indeks Koordinasi: ${burstResult.coordinationIndex}/100).`
    },
    sentimentMatrix: {
      positivePercent: sentimentMatrix.positivePercent,
      neutralPercent: sentimentMatrix.neutralPercent,
      provocativePercent: sentimentMatrix.provocativePercent,
      dominantSentiment: 'PROVOKATIF'
    },
    buzzerForensic: {
      isBuzzerAlarmActive: true,
      copypastaPercent: clusterResult.copypastaPercent,
      burstVelocityPerMinute: Math.max(75, burstResult.burstVelocityPerMinute),
      botAccountRatioPercent: Math.max(68, burstResult.botAccountRatioPercent),
      detectedClusters: clusterResult.clusters,
      coordinationIndex: Math.max(89, burstResult.coordinationIndex),
      swarmAnomalyDescription: `🚨 ANOMALI EKSTREM: Terdeteksi 25+ komentar template copypasta diinjeksi secara serempak oleh sindikat akun anonim baru (Velocity: ${Math.max(75, burstResult.burstVelocityPerMinute)} kom/mnt, Indeks Koordinasi: ${Math.max(89, burstResult.coordinationIndex)}/100).`
    },
    tacticalRecommendation: {
      ...baseResult.tacticalRecommendation,
      posture: 'NETRALISIR_SEGERA'
    },
    commentsSample: combinedComments
  }
}
